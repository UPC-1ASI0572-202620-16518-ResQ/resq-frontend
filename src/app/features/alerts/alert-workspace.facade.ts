import { Inject, Injectable, computed, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import {
  BUILDING_GATEWAY,
  BuildingCatalogRecord,
  BuildingGateway,
  ZoneCatalogRecord,
} from '../buildings/data-access/building.gateway';
import {
  DEVICE_GATEWAY,
  DeviceCatalogRecord,
  DeviceGateway,
} from '../devices/data-access/device.gateway';
import {
  RISK_DETECTION_GATEWAY,
  DetectionEvidenceRecord,
  RiskDetectionGateway,
  RiskDetectionRecord,
} from '../risk-detection/data-access/risk-detection.gateway';
import { AlertFacade } from './data-access/alert.facade';
import {
  ALERT_RESPONSE_GATEWAY,
  AlertRecord,
  AlertResponseGateway,
  AuthorizationDecision,
  NotificationDeliveryRecord,
  ResponseExecutionRecord,
} from './data-access/alert.gateway';
import { capabilityHardware, capabilityLabel, riskTypeLabel } from '../../shared/presentation/domain-labels';

export interface AlertWorkspaceLocation {
  buildingId?: string;
  buildingName: string;
  zoneId?: string;
  zoneName: string;
  floorLabel?: string;
  available: boolean;
}

export interface AlertDeliverySummary {
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  delivered: number;
  pending: number;
  failed: number;
  label: string;
}

export interface AlertWorkspaceEvidence {
  measurementId?: string;
  deviceId: string;
  deviceName: string;
  deviceCode: string;
  variableType: string;
  measurementName: string;
  hardware: string;
  value: number;
  unit?: string;
  measuredAt: Date;
}

export interface AlertWorkspaceRow {
  id: string;
  riskDetectionId: string;
  riskTypeCode: string;
  riskTypeLabel: string;
  title: string;
  description: string;
  severity: string;
  detectedAt: Date;
  generatedAt: Date;
  location: AlertWorkspaceLocation;
  delivery: AlertDeliverySummary;
}

export interface AlertWorkspaceDetail extends AlertWorkspaceRow {
  alert: AlertRecord;
  risk?: RiskDetectionRecord;
  evidence: AlertWorkspaceEvidence[];
  responseExecutions: ResponseExecutionRecord[];
}

export interface AlertWorkspaceSummary {
  total: number;
  critical: number;
  warning: number;
  notificationFailures: number;
}

@Injectable({ providedIn: 'root' })
export class AlertWorkspaceFacade {
  private readonly rowsState = signal<AlertWorkspaceRow[]>([]);
  private readonly detailState = signal<AlertWorkspaceDetail | undefined>(undefined);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);

  readonly rows = this.rowsState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly recent = computed(() => this.rowsState().slice(0, 5));
  readonly recentCount = computed(() => this.rowsState().length);
  readonly summary = computed<AlertWorkspaceSummary>(() => {
    const rows = this.rowsState();
    return {
      total: rows.length,
      critical: rows.filter((item) => normalizeSeverity(item.severity) === 'critical').length,
      warning: rows.filter((item) => normalizeSeverity(item.severity) === 'warning').length,
      notificationFailures: rows.reduce((sum, item) => sum + item.delivery.failed, 0),
    };
  });

  constructor(
    @Inject(ALERT_RESPONSE_GATEWAY) private readonly alerts: AlertResponseGateway,
    @Inject(RISK_DETECTION_GATEWAY) private readonly risk: RiskDetectionGateway,
    @Inject(BUILDING_GATEWAY) private readonly buildings: BuildingGateway,
    @Inject(DEVICE_GATEWAY) private readonly devices: DeviceGateway,
    private readonly alertFacade: AlertFacade,
  ) {}

  loadAlerts(): Observable<AlertWorkspaceRow[]> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      alerts: this.alerts.getAlerts({}),
      buildings: this.buildings.getBuildings({}, { page: 0, size: 100 }),
    }).pipe(
      map(({ alerts, buildings }) =>
        alerts
          .map((alert) => this.toRow(alert, buildings.items))
          .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()),
      ),
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

  loadDetail(alertId: string): Observable<AlertWorkspaceDetail | undefined> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      alert: this.alerts.getAlertById(alertId),
      buildings: this.buildings.getBuildings({}, { page: 0, size: 100 }),
      devices: this.devices.getDevices({}, { page: 0, size: 100 }),
    }).pipe(
      switchMap(({ alert, buildings, devices }) => {
        if (!alert) {
          return of(undefined);
        }

        return forkJoin({
          risk: this.risk.getRiskDetectionEvidence(alert.context.riskDetectionId),
          executions: this.alerts.getResponseExecutions({
            riskDetectionId: alert.context.riskDetectionId,
          }),
        }).pipe(
          map(({ risk, executions }) => {
            const row = this.toRow(alert, buildings.items);
            return {
              ...row,
              alert,
              risk,
              evidence: this.mapEvidence(risk?.evidence ?? [], devices.items),
              responseExecutions: executions,
            } satisfies AlertWorkspaceDetail;
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

  decideAuthorization(
    executionId: string,
    decision: AuthorizationDecision,
  ): Observable<ResponseExecutionRecord> {
    return this.alertFacade.decideAuthorization(executionId, decision).pipe(
      tap((updated) => {
        this.detailState.update((detail) =>
          detail
            ? {
                ...detail,
                responseExecutions: detail.responseExecutions.map((execution) =>
                  execution.responseExecutionId === updated.responseExecutionId ? updated : execution,
                ),
              }
            : detail,
        );
      }),
    );
  }

  canDecideAuthorization(execution: ResponseExecutionRecord): boolean {
    return this.alertFacade.canDecideAuthorization(execution);
  }

  private toRow(alert: AlertRecord, buildings: BuildingCatalogRecord[]): AlertWorkspaceRow {
    const building = buildings.find((item) => item.id === alert.context.buildingId);
    const zone = building?.zones.find((item) => item.id === alert.context.zoneId);
    const label = riskTypeLabel(alert.context.riskTypeCode);
    const delivery = summarizeDelivery(alert.deliveries);

    return {
      id: alert.alertId,
      riskDetectionId: alert.context.riskDetectionId,
      riskTypeCode: alert.context.riskTypeCode,
      riskTypeLabel: label,
      title: `${label} detected`,
      description: `Risk detection ${alert.context.riskDetectionId}`,
      severity: alert.context.severityCode,
      detectedAt: alert.context.detectedAt,
      generatedAt: alert.generatedAt,
      location: locationFor(alert, building, zone),
      delivery,
    };
  }

  private mapEvidence(
    evidence: DetectionEvidenceRecord[],
    devices: DeviceCatalogRecord[],
  ): AlertWorkspaceEvidence[] {
    return evidence.map((item) => {
      const device = devices.find((candidate) => candidate.id === item.deviceId);
      const capability = device?.capabilities.find((candidate) => candidate.code === item.variableType);
      return {
        measurementId: item.measurementId,
        deviceId: item.deviceId,
        deviceName: device?.name ?? item.deviceId,
        deviceCode: device?.deviceCode ?? item.deviceId,
        variableType: item.variableType,
        measurementName: capabilityLabel(item.variableType),
        hardware: capabilityHardware(item.variableType),
        value: item.value,
        unit: capability?.unit,
        measuredAt: item.measuredAt,
      };
    });
  }
}

function locationFor(
  alert: AlertRecord,
  building?: BuildingCatalogRecord,
  zone?: ZoneCatalogRecord,
): AlertWorkspaceLocation {
  return {
    buildingId: alert.context.buildingId,
    buildingName: building?.name ?? 'Location unavailable',
    zoneId: alert.context.zoneId,
    zoneName: zone?.name ?? 'Zone unavailable',
    floorLabel: zone?.floorLabel,
    available: Boolean(building || zone),
  };
}

function summarizeDelivery(deliveries: NotificationDeliveryRecord[]): AlertDeliverySummary {
  const delivered = deliveries.filter((item) => item.status === 'DELIVERED').length;
  const pending = deliveries.filter((item) => item.status === 'PENDING').length;
  const failed = deliveries.filter((item) => item.status === 'FAILED').length;
  const status: AlertDeliverySummary['status'] = failed
    ? 'FAILED'
    : pending
      ? 'PENDING'
      : 'DELIVERED';

  return {
    status,
    delivered,
    pending,
    failed,
    label: deliveries.length
      ? `${delivered}/${deliveries.length} delivered`
      : 'No deliveries',
  };
}

function normalizeSeverity(value: string): string {
  return value.trim().toLowerCase();
}
