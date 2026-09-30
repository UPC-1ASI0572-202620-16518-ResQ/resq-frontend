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
import { IncidentFacade } from './data-access/incident.facade';
import { IncidentRecord, IncidentStatus } from './data-access/incident.gateway';

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

@Injectable({ providedIn: 'root' })
export class IncidentWorkspaceFacade {
  private readonly rowsState = signal<IncidentWorkspaceRow[]>([]);
  private readonly detailState = signal<IncidentWorkspaceRow | undefined>(undefined);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);

  readonly rows = this.rowsState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(
    private readonly incidents: IncidentFacade,
    @Inject(BUILDING_GATEWAY) private readonly buildings: BuildingGateway,
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

  loadDetail(incidentId: string): Observable<IncidentWorkspaceRow | undefined> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      incident: this.incidents.loadIncident(incidentId),
      buildings: this.buildings.getBuildings({}, { page: 0, size: 100 }),
    }).pipe(
      map(({ incident, buildings }) =>
        incident ? this.toRow(incident, buildings.items) : undefined,
      ),
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
    return this.incidents.canResolve(row.incident);
  }

  private refreshCurrent(incident: IncidentRecord): void {
    const existing = this.detailState();
    if (existing) {
      this.detailState.set({
        ...existing,
        incident,
        statusLabel: statusLabel(incident.status),
        assigneeLabel: incident.assignedTo ?? 'Unassigned',
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
      title: `${type} response`,
      description: `Incident ${incident.incidentId} requires operational follow-up in ${location.zoneName}.`,
      typeLabel: type,
      levelLabel: incident.level ?? 'Not classified',
      statusLabel: statusLabel(incident.status),
      assigneeLabel: incident.assignedTo ?? 'Unassigned',
      location,
    };
  }
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
