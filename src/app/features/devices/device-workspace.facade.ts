import { Inject, Injectable, computed, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { capabilityHardware, capabilityLabel, riskTypeLabel } from '../../shared/presentation/domain-labels';
import {
  ALERT_RESPONSE_GATEWAY,
  AlertRecord,
  AlertResponseGateway,
} from '../alerts/data-access/alert.gateway';
import {
  BUILDING_GATEWAY,
  BuildingCatalogRecord,
  BuildingGateway,
  ZoneCatalogRecord,
} from '../buildings/data-access/building.gateway';
import {
  CONNECTIVITY_GATEWAY,
  ConnectivityGateway,
  DeviceConnectionState,
} from '../connectivity/data-access/connectivity.gateway';
import {
  MONITORING_GATEWAY,
  DeviceMonitoringState,
  MonitoringGateway,
  MonitoringMeasurement,
} from '../monitoring/data-access/monitoring.gateway';
import {
  RISK_DETECTION_GATEWAY,
  RiskDetectionGateway,
  RiskDetectionRecord,
} from '../risk-detection/data-access/risk-detection.gateway';
import {
  AssignDeviceToLocationResourceDto,
  ChangeDeviceAdministrativeStatusResourceDto,
  RegisterDeviceResourceDto,
  ReplaceDeviceCapabilitiesResourceDto,
  UpdateDeviceDetailsResourceDto,
} from './data-access/device.dto';
import { DeviceFacade } from './data-access/device.facade';
import {
  DeviceCatalogCapability,
  DeviceCatalogRecord,
} from './data-access/device.gateway';

export interface DeviceWorkspaceLocation {
  buildingId: string;
  buildingName: string;
  zoneId?: string;
  zoneName?: string;
  floorLabel?: string;
}

export interface DeviceWorkspaceCapability extends DeviceCatalogCapability {
  label: string;
  hardwareLabel: string;
}

export interface DeviceAlertSummary {
  id: string;
  riskTypeCode: string;
  riskTypeLabel: string;
  severity: string;
  detectedAt: Date;
}

export interface DeviceWorkspaceRow {
  catalog: DeviceCatalogRecord;
  location: DeviceWorkspaceLocation;
  monitoring?: DeviceMonitoringState;
  connection?: DeviceConnectionState;
  latestMeasurement?: MonitoringMeasurement;
  capabilities: DeviceWorkspaceCapability[];
}

export interface DeviceWorkspaceDetail extends DeviceWorkspaceRow {
  measurements: MonitoringMeasurement[];
  alerts: DeviceAlertSummary[];
}

export interface DeviceFleetSummary {
  total: number;
  online: number;
  warningDegraded: number;
  offline: number;
}

@Injectable({ providedIn: 'root' })
export class DeviceWorkspaceFacade {
  private readonly rowsState = signal<DeviceWorkspaceRow[]>([]);
  private readonly buildingsState = signal<BuildingCatalogRecord[]>([]);
  private readonly detailState = signal<DeviceWorkspaceDetail | undefined>(undefined);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);

  readonly rows = this.rowsState.asReadonly();
  readonly buildings = this.buildingsState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly summary = computed<DeviceFleetSummary>(() => {
    const rows = this.rowsState();
    return {
      total: rows.length,
      online: rows.filter((row) => row.connection?.status === 'ONLINE').length,
      warningDegraded: rows.filter(
        (row) =>
          row.connection?.status === 'ONLINE' &&
          row.connection.signalStrength !== undefined &&
          row.connection.signalStrength < -75,
      ).length,
      offline: rows.filter((row) => row.connection?.status !== 'ONLINE').length,
    };
  });

  constructor(
    private readonly devices: DeviceFacade,
    @Inject(BUILDING_GATEWAY) private readonly buildingGateway: BuildingGateway,
    @Inject(MONITORING_GATEWAY) private readonly monitoring: MonitoringGateway,
    @Inject(CONNECTIVITY_GATEWAY) private readonly connectivity: ConnectivityGateway,
    @Inject(ALERT_RESPONSE_GATEWAY) private readonly alertsGateway: AlertResponseGateway,
    @Inject(RISK_DETECTION_GATEWAY) private readonly riskGateway: RiskDetectionGateway,
  ) {}

  loadFleet(): Observable<DeviceWorkspaceRow[]> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      devices: this.devices.loadDevices({}, { page: 0, size: 100 }),
      buildings: this.buildingGateway.getBuildings({}, { page: 0, size: 100 }),
    }).pipe(
      tap(({ buildings }) => this.buildingsState.set(buildings.items)),
      switchMap(({ devices, buildings }) => {
        if (!devices.items.length) {
          return of([] as DeviceWorkspaceRow[]);
        }

        return forkJoin(
          devices.items.map((device) =>
            forkJoin({
              monitoring: this.monitoring.getDeviceStatus(device.id),
              connection: this.connectivity.getDeviceConnectionStatus(device.id),
              current: this.monitoring.getCurrentMeasurements({ deviceId: device.id }),
            }).pipe(
              map(({ monitoring, connection, current }) =>
                this.toRow(device, buildings.items, monitoring, connection, current.at(0)),
              ),
            ),
          ),
        );
      }),
      tap({
        next: (rows) => {
          this.rowsState.set(rows);
          this.loadingState.set(false);
        },
        error: (error: ApiError) => {
          this.errorState.set(error);
          this.loadingState.set(false);
        },
      }),
    );
  }

  loadDetail(deviceId: string): Observable<DeviceWorkspaceDetail | undefined> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      versioned: this.devices.loadDevice(deviceId),
      buildings: this.buildingGateway.getBuildings({}, { page: 0, size: 100 }),
      monitoring: this.monitoring.getDeviceStatus(deviceId),
      connection: this.connectivity.getDeviceConnectionStatus(deviceId),
      measurements: this.monitoring.getDeviceMeasurements(deviceId),
      alerts: this.alertsGateway.getAlerts({}),
    }).pipe(
      tap(({ buildings }) => this.buildingsState.set(buildings.items)),
      switchMap((result) => {
        const catalog = result.versioned?.device;
        if (!catalog) {
          return of(undefined);
        }

        const relevantAlertRisks = result.alerts.map((alert) =>
          this.riskGateway.getRiskDetectionEvidence(alert.context.riskDetectionId).pipe(
            map((risk) => ({ alert, risk })),
          ),
        );

        const riskResults$ = relevantAlertRisks.length
          ? forkJoin(relevantAlertRisks)
          : of([] as Array<{ alert: AlertRecord; risk: RiskDetectionRecord | undefined }>);

        return riskResults$.pipe(
          map((riskResults) => {
            const deviceAlerts = riskResults
              .filter(({ risk }) => risk?.evidence.some((evidence) => evidence.deviceId === deviceId))
              .map(({ alert }) => ({
                id: alert.alertId,
                riskTypeCode: alert.context.riskTypeCode,
                riskTypeLabel: riskTypeLabel(alert.context.riskTypeCode),
                severity: alert.context.severityCode,
                detectedAt: alert.context.detectedAt,
              }))
              .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

            const current = result.measurements.at(-1);
            return {
              ...this.toRow(
                catalog,
                result.buildings.items,
                result.monitoring,
                result.connection,
                current,
              ),
              measurements: result.measurements,
              alerts: deviceAlerts,
            } satisfies DeviceWorkspaceDetail;
          }),
        );
      }),
      tap({
        next: (detail) => {
          this.detailState.set(detail);
          this.loadingState.set(false);
        },
        error: (error: ApiError) => {
          this.errorState.set(error);
          this.loadingState.set(false);
        },
      }),
    );
  }

  registerDevice(resource: RegisterDeviceResourceDto): Observable<unknown> {
    return this.devices.registerDevice(resource);
  }

  updateDetails(resource: UpdateDeviceDetailsResourceDto): Observable<unknown> {
    return this.devices.updateDeviceDetails(resource);
  }

  replaceCapabilities(resource: ReplaceDeviceCapabilitiesResourceDto): Observable<unknown> {
    return this.devices.replaceDeviceCapabilities(resource);
  }

  changeAssignment(resource: AssignDeviceToLocationResourceDto): Observable<unknown> {
    return this.devices.assignDeviceToLocation(resource);
  }

  changeStatus(resource: ChangeDeviceAdministrativeStatusResourceDto): Observable<unknown> {
    return this.devices.changeAdministrativeStatus(resource);
  }

  canEditDetails(device: DeviceCatalogRecord): boolean {
    return this.devices.canEditDetails(device);
  }

  canChangeCapabilities(device: DeviceCatalogRecord): boolean {
    return this.devices.canChangeCapabilities(device);
  }

  canChangeAssignment(device: DeviceCatalogRecord): boolean {
    return this.devices.canChangeAssignment(device);
  }

  canActivate(device: DeviceCatalogRecord): boolean {
    return this.devices.canActivate(device);
  }

  canDeactivate(device: DeviceCatalogRecord): boolean {
    return this.devices.canDeactivate(device);
  }

  canRetire(device: DeviceCatalogRecord): boolean {
    return this.devices.canRetire(device);
  }

  clearError(): void {
    this.devices.clearError();
    this.errorState.set(undefined);
  }

  private toRow(
    device: DeviceCatalogRecord,
    buildings: BuildingCatalogRecord[],
    monitoring?: DeviceMonitoringState,
    connection?: DeviceConnectionState,
    latestMeasurement?: MonitoringMeasurement,
  ): DeviceWorkspaceRow {
    const building = buildings.find((item) => item.id === device.assignment.buildingId);
    const zone = building?.zones.find((item) => item.id === device.assignment.zoneId);

    return {
      catalog: device,
      location: this.locationFor(device, building, zone),
      monitoring,
      connection,
      latestMeasurement,
      capabilities: device.capabilities.map((capability) => ({
        ...capability,
        label: capabilityLabel(capability.code),
        hardwareLabel: capabilityHardware(capability.code),
      })),
    };
  }

  private locationFor(
    device: DeviceCatalogRecord,
    building?: BuildingCatalogRecord,
    zone?: ZoneCatalogRecord,
  ): DeviceWorkspaceLocation {
    return {
      buildingId: device.assignment.buildingId,
      buildingName: building?.name ?? 'Unknown building',
      zoneId: device.assignment.zoneId,
      zoneName: zone?.name,
      floorLabel: zone?.floorLabel,
    };
  }
}
