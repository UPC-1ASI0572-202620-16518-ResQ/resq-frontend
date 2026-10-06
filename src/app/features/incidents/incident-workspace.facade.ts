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
  RiskDetectionGateway,
} from '../risk-detection/data-access/risk-detection.gateway';
import { capabilityLabel } from '../../shared/presentation/domain-labels';
import { evaluateMeasurement } from '../../core/services/risk-evaluation.service';
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
  value: number;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  measuredAt: Date;
}

export interface IncidentWorkspaceDetail extends IncidentWorkspaceRow {
  evidence: IncidentWorkspaceEvidence[];
  currentEvidence?: IncidentWorkspaceEvidence;
  currentCondition: 'Normal' | 'Warning' | 'Critical' | 'Unknown';
  responseExecutions: ResponseExecutionRecord[];
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
        if (!incident.riskDetectionId) {
          return of({
            ...row,
            evidence: [],
            currentCondition: 'Unknown' as const,
            responseExecutions: [],
          });
        }
        return forkJoin({
          detection: this.risk.getRiskDetectionEvidence(incident.riskDetectionId),
          executions: this.responses.getResponseExecutions({
            riskDetectionId: incident.riskDetectionId,
          }),
        }).pipe(
          map(({ detection, executions }) => {
            const detectedEvidence = incident.detectedEvidence
              ? [this.mapIncidentEvidence(incident.detectedEvidence, devices.items)]
              : this.mapEvidence(detection?.evidence ?? [], devices.items);
            const currentEvidence = incident.currentEvidence
              ? this.mapIncidentEvidence(incident.currentEvidence, devices.items)
              : detectedEvidence.at(-1);
            return {
              ...row,
              evidence: detectedEvidence,
              currentEvidence,
              currentCondition: classifyEvidence(currentEvidence),
              responseExecutions: executions,
            };
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
    const profile = this.user.profile();
    const profile$ = profile ? of(profile) : this.user.loadMyProfile();

    return profile$.pipe(
      switchMap((current) => {
        if (!current) {
          throw new Error('A user profile is required to assign the incident.');
        }
        return this.incidents.assignIncident(current.userId);
      }),
      tap((incident) => this.refreshCurrent(incident)),
    );
  }

  resolve(resolutionNotes: string): Observable<IncidentRecord> {
    return this.incidents.resolveIncident(resolutionNotes).pipe(
      tap((incident) => this.refreshCurrent(incident)),
    );
  }

  canAssign(row: IncidentWorkspaceRow): boolean {
    return this.incidents.canAssign(row.incident);
  }

  canResolve(row: IncidentWorkspaceRow): boolean {
    const detail = this.detailState();
    return (
      this.incidents.canResolve(row.incident) &&
      row.incident.assignedTo === this.user.profile()?.userId &&
      detail?.currentCondition === 'Normal'
    );
  }

  canAuthorize(execution: ResponseExecutionRecord): boolean {
    const detail = this.detailState();
    return Boolean(
      detail &&
      detail.incident.status === 'IN_PROGRESS' &&
      detail.incident.assignedTo === this.user.profile()?.userId &&
      this.alertFacade.canDecideAuthorization(execution),
    );
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
  ): IncidentWorkspaceEvidence[] {
    return evidence.map((item) => {
      const device = devices.find((candidate) => candidate.id === item.deviceId);
      const capability = device?.capabilities.find((candidate) => candidate.code === item.variableType);
      return {
        deviceId: item.deviceId,
        deviceName: device?.name ?? item.deviceId,
        deviceCode: device?.deviceCode ?? item.deviceId,
        metric: item.metric ?? capabilityLabel(item.variableType),
        value: item.value,
        unit: item.unit ?? capability?.unit,
        warningThreshold: item.warningThreshold,
        criticalThreshold: item.criticalThreshold,
        measuredAt: item.measuredAt,
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
      value: item.value,
      unit: item.unit,
      warningThreshold: item.warningThreshold,
      criticalThreshold: item.criticalThreshold,
      measuredAt: item.measuredAt,
    };
  }
}

function classifyEvidence(
  evidence?: IncidentWorkspaceEvidence,
): 'Normal' | 'Warning' | 'Critical' | 'Unknown' {
  if (
    !evidence ||
    evidence.warningThreshold === undefined ||
    evidence.criticalThreshold === undefined
  ) {
    return 'Unknown';
  }
  return evaluateMeasurement(evidence.value, {
    warning: evidence.warningThreshold,
    critical: evidence.criticalThreshold,
  });
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
