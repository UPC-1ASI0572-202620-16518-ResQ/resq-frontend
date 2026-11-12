import { Inject, Injectable, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import {
  BUILDING_GATEWAY,
  BuildingCatalogRecord,
  BuildingGateway,
  ZoneCatalogRecord,
} from '../buildings/data-access/building.gateway';
import { UserFacade } from '../users/data-access/user.facade';
import {
  DEVICE_GATEWAY,
  DeviceCatalogRecord,
  DeviceGateway,
} from '../devices/data-access/device.gateway';
import {
  RISK_DETECTION_GATEWAY,
  DetectionEvidenceRecord,
  DetectionRuleRecord,
  RiskDetectionRecord,
  RiskDetectionGateway,
} from '../risk-detection/data-access/risk-detection.gateway';
import { capabilityLabel } from '../../shared/presentation/domain-labels';
import { AlertFacade } from '../alerts/data-access/alert.facade';
import {
  ALERT_RESPONSE_GATEWAY,
  AlertResponseGateway,
  AuthorizationDecision,
  ResponseExecutionRecord,
} from '../alerts/data-access/alert.gateway';
import { IncidentFacade } from './data-access/incident.facade';
import {
  IncidentEvidenceRecord,
  IncidentRecord,
  IncidentStatus,
} from './data-access/incident.gateway';
import {
  MONITORING_GATEWAY,
  MonitoringGateway,
  MonitoringMeasurement,
} from '../monitoring/data-access/monitoring.gateway';
import {
  CONNECTIVITY_GATEWAY,
  ConnectivityGateway,
  DeviceConnectionState,
} from '../connectivity/data-access/connectivity.gateway';

export interface IncidentWorkspaceLocation {
  buildingId?: string;
  buildingName: string;
  zoneId: string;
  zoneName: string;
  floorLabel?: string;
}

export interface IncidentWorkspaceRow {
  incident: IncidentRecord;
  title: string;
  description: string;
  typeLabel: string;
  levelLabel: string;
  statusLabel: string;
  assigneeLabel: string;
  location: IncidentWorkspaceLocation;
}

export interface IncidentWorkspaceEvidence {
  deviceId: string;
  deviceName: string;
  deviceCode: string;
  metric: string;
  variableType: string;
  value: number;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  measuredAt: Date;
  ruleId?: string;
  operator?: string;
}

export interface IncidentWorkspaceDetail extends IncidentWorkspaceRow {
  detection?: RiskDetectionRecord;
  evidence: IncidentWorkspaceEvidence[];
  currentEvidence?: IncidentWorkspaceEvidence;
  currentConnection?: DeviceConnectionState;
  currentCondition: 'Normal' | 'Warning' | 'Critical' | 'Offline' | 'Timeout' | 'Unknown';
  responseExecutions: ResponseExecutionRecord[];
  suggestedAlerts: Array<{
    alertId: string;
    riskDetectionId: string;
    severity: string;
    generatedAt: Date;
  }>;
}

@Injectable({ providedIn: 'root' })
export class IncidentWorkspaceFacade {
  private readonly rowsState = signal<IncidentWorkspaceRow[]>([]);
  private readonly detailState = signal<IncidentWorkspaceDetail | undefined>(undefined);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);

  readonly rows = this.rowsState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(
    private readonly incidents: IncidentFacade,
    @Inject(BUILDING_GATEWAY) private readonly buildings: BuildingGateway,
    @Inject(DEVICE_GATEWAY) private readonly devices: DeviceGateway,
    @Inject(RISK_DETECTION_GATEWAY) private readonly risk: RiskDetectionGateway,
    @Inject(MONITORING_GATEWAY) private readonly monitoring: MonitoringGateway,
    @Inject(CONNECTIVITY_GATEWAY) private readonly connectivity: ConnectivityGateway,
    @Inject(ALERT_RESPONSE_GATEWAY) private readonly responses: AlertResponseGateway,
    private readonly alertFacade: AlertFacade,
    private readonly user: UserFacade,
  ) {}

  loadIncidents(): Observable<IncidentWorkspaceRow[]> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      incidents: this.incidents.loadIncidents({}, { page: 0, size: 100 }),
      buildings: this.buildings.getBuildings({}, { page: 0, size: 100 }),
    }).pipe(
      map(({ incidents, buildings }) =>
        incidents.items
          .map((incident) => this.toRow(incident, buildings.items))
          .sort((a, b) => b.incident.createdAt.getTime() - a.incident.createdAt.getTime()),
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

  loadDetail(incidentId: string): Observable<IncidentWorkspaceDetail | undefined> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      incident: this.incidents.loadIncident(incidentId),
      buildings: this.buildings.getBuildings({}, { page: 0, size: 100 }),
      devices: this.devices.getDevices({}, { page: 0, size: 200 }),
    }).pipe(
      switchMap(({ incident, buildings, devices }) => {
        if (!incident) return of(undefined);
        const row = this.toRow(incident, buildings.items);
        return forkJoin({
          detection: incident.riskDetectionId
            ? this.risk.getRiskDetectionEvidence(incident.riskDetectionId)
            : of(undefined),
          executions: incident.riskDetectionId
            ? this.responses.getResponseExecutions({ riskDetectionId: incident.riskDetectionId })
            : of([]),
          rules: this.risk.getDetectionRules(),
          candidateAlerts: incident.riskDetectionId
            ? of([])
            : this.responses.getAlerts({ zoneId: incident.zoneId, riskTypeCode: incident.type }),
        }).pipe(
          switchMap(({ detection, executions, rules, candidateAlerts }) => {
            const suggestedAlerts = candidateAlerts
              .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
              .slice(0, 3)
              .map((alert) => ({
                alertId: alert.alertId,
                riskDetectionId: alert.context.riskDetectionId,
                severity: alert.context.severityCode,
                generatedAt: alert.generatedAt,
              }));
            const detectedEvidence = incident.detectedEvidence
              ? [this.mapIncidentEvidence(incident.detectedEvidence, devices.items)]
              : this.mapEvidence(detection?.evidence ?? [], devices.items, rules, detection);
            const source = detectedEvidence.at(-1);
            if (!source) {
              return of({
                ...row,
                detection,
                evidence: detectedEvidence,
                currentCondition: 'Unknown' as const,
                responseExecutions: executions,
                suggestedAlerts,
              });
            }

            return forkJoin({
              measurements: this.monitoring.getCurrentMeasurements({ deviceId: source.deviceId }),
              connection: this.connectivity.getDeviceConnectionStatus(source.deviceId),
            }).pipe(
              map(({ measurements, connection }) => {
                const measurement = newestMatchingMeasurement(measurements, source.variableType);
                const currentEvidence = measurement
                  ? this.mapCurrentMeasurement(measurement, devices.items, rules)
                  : undefined;
                return {
                  ...row,
                  detection,
                  evidence: detectedEvidence,
                  currentEvidence,
                  currentConnection: connection,
                  currentCondition: classifyCurrentCondition(measurement, connection, rules),
                  responseExecutions: executions,
                  suggestedAlerts,
                } satisfies IncidentWorkspaceDetail;
              }),
            );
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

  assignToCurrentUser(): Observable<IncidentRecord> {
    return this.incidents.assignCurrentUser().pipe(
      tap((incident) => this.refreshCurrent(incident)),
    );
  }

  verifySafe() {
    return this.incidents.verifySafe();
  }

  recordHumanAction(actionCode: string, notes?: string) {
    return this.incidents.recordHumanAction(actionCode, notes);
  }

  resolve(resolutionNotes: string): Observable<IncidentRecord> {
    return this.incidents.resolveIncident(resolutionNotes).pipe(
      tap((incident) => this.refreshCurrent(incident)),
    );
  }

  close(): Observable<IncidentRecord> {
    return this.incidents.closeIncident().pipe(tap((incident) => this.refreshCurrent(incident)));
  }

  canAssign(row: IncidentWorkspaceRow): boolean {
    return this.incidents.canAssign(row.incident);
  }

  canResolve(row: IncidentWorkspaceRow): boolean {
    return this.incidents.canResolve(row.incident);
  }

  canClose(row: IncidentWorkspaceRow): boolean {
    return this.incidents.canClose(row.incident);
  }

  canAuthorize(execution: ResponseExecutionRecord): boolean {
    return this.alertFacade.canDecideAuthorization(execution);
  }

  actorLabel(userId?: string): string {
    if (!userId) return 'Pending';
    const profile = this.user.profile();
    return profile?.userId === userId && this.user.fullName()
      ? this.user.fullName()
      : userId;
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
                responseExecutions: detail.responseExecutions.map((item) =>
                  item.responseExecutionId === updated.responseExecutionId ? updated : item,
                ),
              }
            : detail,
        );
      }),
    );
  }

  private refreshCurrent(incident: IncidentRecord): void {
    const existing = this.detailState();
    if (existing) {
      this.detailState.set({
        ...existing,
        incident,
        statusLabel: statusLabel(incident.status),
        assigneeLabel: this.actorLabel(incident.assignedTo),
      });
    }

    this.rowsState.update((rows) =>
      rows.map((row) =>
        row.incident.incidentId === incident.incidentId
          ? {
              ...row,
              incident,
              statusLabel: statusLabel(incident.status),
              assigneeLabel: incident.assignedTo ?? 'Unassigned',
            }
          : row,
      ),
    );
  }

  private toRow(
    incident: IncidentRecord,
    buildings: BuildingCatalogRecord[],
  ): IncidentWorkspaceRow {
    const location = locateIncident(incident, buildings);
    const type = typeLabel(incident.type);
    return {
      incident,
      title: `${type} critical incident`,
      description: `Critical threshold exceeded. Incident ${incident.incidentId} requires operational follow-up in ${location.zoneName}.`,
      typeLabel: type,
      levelLabel: incident.level ?? 'Not classified',
      statusLabel: statusLabel(incident.status),
      assigneeLabel: incident.assignedTo ? this.actorLabel(incident.assignedTo) : 'Unassigned',
      location,
    };
  }

  private mapEvidence(
    evidence: DetectionEvidenceRecord[],
    devices: DeviceCatalogRecord[],
    rules: DetectionRuleRecord[],
    detection?: RiskDetectionRecord,
  ): IncidentWorkspaceEvidence[] {
    return evidence.map((item) => {
      const device = devices.find((candidate) => candidate.id === item.deviceId);
      const capability = device?.capabilities.find((candidate) => candidate.code === item.variableType);
      const appliedRule = rules.find((rule) => rule.ruleId === detection?.ruleId);
      const thresholds = thresholdsFor(item.variableType, rules);
      return {
        deviceId: item.deviceId,
        deviceName: device?.name ?? item.deviceId,
        deviceCode: device?.deviceCode ?? item.deviceId,
        metric: item.metric ?? capabilityLabel(item.variableType),
        variableType: item.variableType,
        value: item.value,
        unit: item.unit ?? capability?.unit,
        warningThreshold: item.warningThreshold ?? thresholds.warning,
        criticalThreshold: item.criticalThreshold ?? thresholds.critical,
        measuredAt: item.measuredAt,
        ruleId: appliedRule?.ruleId,
        operator: appliedRule?.condition.operator,
      };
    });
  }

  private mapIncidentEvidence(
    item: IncidentEvidenceRecord,
    devices: DeviceCatalogRecord[],
  ): IncidentWorkspaceEvidence {
    const device = devices.find((candidate) => candidate.id === item.deviceId);
    return {
      deviceId: item.deviceId,
      deviceName: device?.name ?? item.deviceId,
      deviceCode: device?.deviceCode ?? item.deviceId,
      metric: item.metric,
      variableType: item.metric,
      value: item.value,
      unit: item.unit,
      warningThreshold: item.warningThreshold,
      criticalThreshold: item.criticalThreshold,
      measuredAt: item.measuredAt,
    };
  }

  private mapCurrentMeasurement(
    item: MonitoringMeasurement,
    devices: DeviceCatalogRecord[],
    rules: DetectionRuleRecord[],
  ): IncidentWorkspaceEvidence {
    const device = devices.find((candidate) => candidate.id === item.deviceId);
    const thresholds = thresholdsFor(item.variableType, rules);
    return {
      deviceId: item.deviceId,
      deviceName: device?.name ?? item.deviceId,
      deviceCode: device?.deviceCode ?? item.deviceId,
      metric: capabilityLabel(item.variableType),
      variableType: item.variableType,
      value: item.measurementValue.value,
      unit: item.measurementValue.unit,
      warningThreshold: thresholds.warning,
      criticalThreshold: thresholds.critical,
      measuredAt: item.measuredAt,
    };
  }
}

function newestMatchingMeasurement(
  measurements: MonitoringMeasurement[],
  variableType: string,
): MonitoringMeasurement | undefined {
  return measurements
    .filter((item) => item.variableType.toUpperCase() === variableType.toUpperCase())
    .sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())
    .at(0);
}

function classifyCurrentCondition(
  measurement: MonitoringMeasurement | undefined,
  connection: DeviceConnectionState | undefined,
  rules: DetectionRuleRecord[],
): IncidentWorkspaceDetail['currentCondition'] {
  if (!connection) return 'Unknown';
  if (connection.status === 'OFFLINE') return 'Offline';
  if (connection.status === 'TIMEOUT') return 'Timeout';
  if (!measurement) return 'Unknown';
  const applicable = rules.filter(
    (rule) =>
      rule.status === 'ACTIVE' &&
      rule.condition.variableType.toUpperCase() === measurement.variableType.toUpperCase(),
  );
  if (!applicable.length) return 'Unknown';
  const matches = applicable.filter((rule) =>
    matchesRule(measurement.measurementValue.value, rule),
  );
  if (matches.some((rule) => rule.severityCode.toUpperCase() === 'CRITICAL')) return 'Critical';
  if (matches.some((rule) => rule.severityCode.toUpperCase() === 'WARNING')) return 'Warning';
  return 'Normal';
}

function matchesRule(value: number, rule: DetectionRuleRecord): boolean {
  const threshold = rule.condition.threshold;
  switch (rule.condition.operator) {
    case 'GREATER_THAN': return value > threshold;
    case 'GREATER_THAN_OR_EQUAL': return value >= threshold;
    case 'LESS_THAN': return value < threshold;
    case 'LESS_THAN_OR_EQUAL': return value <= threshold;
    case 'EQUAL': return value === threshold;
  }
}

function thresholdsFor(
  variableType: string,
  rules: DetectionRuleRecord[],
): { warning?: number; critical?: number } {
  const applicable = rules.filter(
    (rule) =>
      rule.status === 'ACTIVE' &&
      rule.condition.variableType.toUpperCase() === variableType.toUpperCase() &&
      (rule.condition.operator === 'GREATER_THAN' ||
        rule.condition.operator === 'GREATER_THAN_OR_EQUAL'),
  );
  return {
    warning: applicable.find((rule) => rule.severityCode.toUpperCase() === 'WARNING')?.condition.threshold,
    critical: applicable.find((rule) => rule.severityCode.toUpperCase() === 'CRITICAL')?.condition.threshold,
  };
}

function locateIncident(
  incident: IncidentRecord,
  buildings: BuildingCatalogRecord[],
): IncidentWorkspaceLocation {
  let building: BuildingCatalogRecord | undefined;
  let zone: ZoneCatalogRecord | undefined;

  for (const candidate of buildings) {
    const candidateZone = candidate.zones.find((item) => item.id === incident.zoneId);
    if (candidateZone) {
      building = candidate;
      zone = candidateZone;
      break;
    }
  }

  return {
    buildingId: building?.id,
    buildingName: building?.name ?? 'Unknown building',
    zoneId: incident.zoneId,
    zoneName: zone?.name ?? incident.zoneId,
    floorLabel: zone?.floorLabel,
  };
}

function typeLabel(value: string): string {
  const labels: Record<string, string> = {
    GAS_LEAK: 'Gas leak',
    FIRE: 'Fire risk',
    EARTHQUAKE: 'Earthquake',
    UNKNOWN: 'Safety incident',
  };
  return labels[value] ?? value.replace(/_/g, ' ').toLowerCase();
}

function statusLabel(value: IncidentStatus): string {
  const labels: Record<IncidentStatus, string> = {
    ACTIVE: 'Active',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  };
  return labels[value];
}
