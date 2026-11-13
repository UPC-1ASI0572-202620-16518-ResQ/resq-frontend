import { Inject, Injectable, computed, signal } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiError, isApiError } from '../../core/api/api-error';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { mapWorkspaceDeviceToPresentation } from './device-legacy.mapper';
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
  VersionedDeviceCatalogRecord,
} from './data-access/device.gateway';

export interface DeviceWorkspaceLocation {
  buildingId: string;
  buildingName: string;
  zoneId?: string;
  zoneName?: string;
  floorLabel?: string;
  floorId?: string;
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
  private readonly partialErrorsState = signal<string[]>([]);

  readonly rows = this.rowsState.asReadonly();
  readonly buildings = this.buildingsState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly partialErrors = this.partialErrorsState.asReadonly();

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
      offline: rows.filter((row) => row.connection?.status === 'OFFLINE' || row.connection?.status === 'TIMEOUT').length,
    };
  });

  constructor(
    private readonly devices: DeviceFacade,
    @Inject(BUILDING_GATEWAY) private readonly buildingGateway: BuildingGateway,
    @Inject(MONITORING_GATEWAY) private readonly monitoring: MonitoringGateway,
    @Inject(CONNECTIVITY_GATEWAY) private readonly connectivity: ConnectivityGateway,
    @Inject(ALERT_RESPONSE_GATEWAY) private readonly alertsGateway: AlertResponseGateway,
    @Inject(RISK_DETECTION_GATEWAY) private readonly riskGateway: RiskDetectionGateway,
    private readonly buildingProjection: BuildingStoreService,
  ) {}

  loadFleet(): Observable<DeviceWorkspaceRow[]> {
    this.loadingState.set(true);
    this.errorState.set(undefined);
    this.partialErrorsState.set([]);
    const partialErrors: string[] = [];

    return forkJoin({
      devices: this.devices.loadDevices({}, { page: 0, size: 100 }),
      buildings: this.recover(
        this.buildingGateway.getBuildings({}, { page: 0, size: 100 }),
        pageFrom(this.buildingsState()),
        partialErrors,
        'No se pudieron actualizar los edificios; se conservó la última asignación conocida.',
      ),
    }).pipe(
      tap(({ buildings }) => this.buildingsState.set(buildings.items)),
      switchMap(({ devices, buildings }) => {
        if (!devices.items.length) {
          return of([] as DeviceWorkspaceRow[]);
        }

        return forkJoin(
          devices.items.map((device) =>
            forkJoin({
              monitoring: this.recover(
                this.monitoring.getDeviceStatus(device.id),
                undefined,
                partialErrors,
                `No se pudo consultar el estado de Monitoring de ${device.name}.`,
              ),
              connection: this.recover(
                this.connectivity.getDeviceConnectionStatus(device.id),
                undefined,
                partialErrors,
                `No se pudo consultar Connectivity para ${device.name}.`,
              ),
              current: this.recover(
                this.monitoring.getCurrentMeasurements({ deviceId: device.id }),
                [] as MonitoringMeasurement[],
                partialErrors,
                `No se pudieron consultar las mediciones actuales de ${device.name}.`,
              ),
            }).pipe(
              map(({ monitoring, connection, current }) =>
                this.toRow(device, buildings.items, monitoring, connection, newestMeasurement(current)),
              ),
            ),
          ),
        );
      }),
      tap({
        next: (rows) => {
          this.rowsState.set(rows);
          this.buildingProjection.replaceDevices(rows.map(mapWorkspaceDeviceToPresentation));
          this.partialErrorsState.set(uniqueMessages(partialErrors));
        },
        error: (error: ApiError) => {
          this.errorState.set(error);
        },
      }),
      finalize(() => this.loadingState.set(false)),
    );
  }

  loadDetail(deviceId: string): Observable<DeviceWorkspaceDetail | undefined> {
    this.loadingState.set(true);
    this.errorState.set(undefined);
    this.partialErrorsState.set([]);
    const partialErrors: string[] = [];

    return forkJoin({
      versioned: this.devices.loadDevice(deviceId),
      buildings: this.recover(
        this.buildingGateway.getBuildings({}, { page: 0, size: 100 }),
        pageFrom(this.buildingsState()),
        partialErrors,
        'No se pudo actualizar la asignación del dispositivo.',
      ),
      monitoring: this.recover(
        this.monitoring.getDeviceStatus(deviceId),
        undefined,
        partialErrors,
        'No se pudo consultar el estado de Monitoring.',
      ),
      connection: this.recover(
        this.connectivity.getDeviceConnectionStatus(deviceId),
        undefined,
        partialErrors,
        'No se pudo consultar el estado de Connectivity.',
      ),
      measurements: this.recover(
        this.monitoring.getDeviceMeasurements(deviceId),
        this.detailState()?.catalog.id === deviceId ? this.detailState()!.measurements : [],
        partialErrors,
        'No se pudo actualizar el historial de mediciones.',
      ),
      alerts: this.recover(
        this.alertsGateway.getAlerts({}),
        [] as AlertRecord[],
        partialErrors,
        'No se pudieron actualizar las alertas relacionadas.',
      ),
    }).pipe(
      tap(({ buildings }) => this.buildingsState.set(buildings.items)),
      switchMap((result) => {
        const catalog = result.versioned?.device;
        if (!catalog) {
          return of(undefined);
        }

        const relevantAlertRisks = result.alerts
          .filter((alert) => isGuidRiskId(alert.context.riskDetectionId))
          .map((alert) =>
          this.recover(
            this.riskGateway.getRiskDetectionEvidence(alert.context.riskDetectionId),
            undefined,
            partialErrors,
            'No se pudo consultar una evidencia de Risk Detection.',
          ).pipe(
            map((risk) => ({ alert, risk })),
          ),
        );

        const riskResults$ = relevantAlertRisks.length
          ? forkJoin(relevantAlertRisks)
          : of([] as Array<{ alert: AlertRecord; risk: RiskDetectionRecord | undefined }>);

        return riskResults$.pipe(
          map((riskResults) => {
            const compactDeviceId = deviceId.replace(/-/g, '').toUpperCase();
            const connectivityAlerts = result.alerts
              .filter((alert) => alert.context.riskDetectionId.toUpperCase() === `CONNECTIVITY-${compactDeviceId}`);
            const matchingRiskAlerts = riskResults
              .filter(({ risk }) => risk?.evidence.some((evidence) => evidence.deviceId === deviceId))
              .map(({ alert }) => alert);
            const deviceAlerts = [...matchingRiskAlerts, ...connectivityAlerts]
              .map((alert) => ({
                id: alert.alertId,
                riskTypeCode: alert.context.riskTypeCode,
                riskTypeLabel: riskTypeLabel(alert.context.riskTypeCode),
                severity: alert.context.severityCode,
                detectedAt: alert.context.detectedAt,
              }))
              .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

            const current = newestMeasurement(result.measurements);
            return {
              ...this.toRow(
                catalog,
                result.buildings.items,
                result.monitoring,
                result.connection,
                current,
              ),
              measurements: [...result.measurements].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()),
              alerts: deviceAlerts,
            } satisfies DeviceWorkspaceDetail;
          }),
        );
      }),
      tap({
        next: (detail) => {
          this.detailState.set(detail);
          if (detail) this.buildingProjection.updateDevice(mapWorkspaceDeviceToPresentation(detail));
          this.partialErrorsState.set(uniqueMessages(partialErrors));
        },
        error: (error: ApiError) => {
          this.errorState.set(error);
        },
      }),
      finalize(() => this.loadingState.set(false)),
    );
  }

  registerDevice(resource: RegisterDeviceResourceDto): Observable<VersionedDeviceCatalogRecord> {
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

  private recover<T>(
    request: Observable<T>,
    fallback: T,
    partialErrors: string[],
    message: string,
  ): Observable<T> {
    return request.pipe(catchError((error: unknown) => {
      if (isApiError(error) && error.status === 401) return throwError(() => error);
      partialErrors.push(message);
      return of(fallback);
    }));
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
      floorId: building?.floors.find(floor => floor.label === zone?.floorLabel)?.id,
    };
  }
}

function isGuidRiskId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function newestMeasurement(items: MonitoringMeasurement[]): MonitoringMeasurement | undefined {
  return [...items].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())[0];
}

function pageFrom<T>(items: T[]) {
  return {
    items,
    page: 0,
    size: 100,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
  };
}

function uniqueMessages(messages: string[]): string[] {
  return [...new Set(messages)];
}
