import { Inject, Injectable, signal } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiError, isApiError } from '../../core/api/api-error';
import { AlertWorkspaceFacade, AlertWorkspaceRow } from '../alerts/alert-workspace.facade';
import { DeviceWorkspaceFacade, DeviceWorkspaceRow } from '../devices/device-workspace.facade';
import { IncidentWorkspaceFacade, IncidentWorkspaceRow } from '../incidents/incident-workspace.facade';
import { MONITORING_GATEWAY, MonitoringGateway, MonitoringMeasurement } from '../monitoring/data-access/monitoring.gateway';
import { BuildingCatalogRecord } from '../buildings/data-access/building.gateway';

export interface AnalyticsLoadIssue {
  source: 'alerts' | 'incidents' | 'devices' | 'monitoring';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsWorkspaceFacade {
  private readonly alertsState = signal<AlertWorkspaceRow[]>([]);
  private readonly incidentsState = signal<IncidentWorkspaceRow[]>([]);
  private readonly devicesState = signal<DeviceWorkspaceRow[]>([]);
  private readonly measurementsState = signal<MonitoringMeasurement[]>([]);
  private readonly buildingsState = signal<BuildingCatalogRecord[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);
  private readonly partialErrorsState = signal<AnalyticsLoadIssue[]>([]);

  readonly alerts = this.alertsState.asReadonly();
  readonly incidents = this.incidentsState.asReadonly();
  readonly devices = this.devicesState.asReadonly();
  readonly measurements = this.measurementsState.asReadonly();
  readonly buildings = this.buildingsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly partialErrors = this.partialErrorsState.asReadonly();

  constructor(
    private readonly alertWorkspace: AlertWorkspaceFacade,
    private readonly incidentWorkspace: IncidentWorkspaceFacade,
    private readonly deviceWorkspace: DeviceWorkspaceFacade,
    @Inject(MONITORING_GATEWAY) private readonly monitoring: MonitoringGateway,
  ) {}

  load(): Observable<void> {
    this.loadingState.set(true);
    this.errorState.set(undefined);
    this.partialErrorsState.set([]);
    const issues: AnalyticsLoadIssue[] = [];

    return forkJoin({
      alerts: this.recover('alerts', this.alertWorkspace.loadAlerts(), this.alertsState(), issues),
      incidents: this.recover('incidents', this.incidentWorkspace.loadIncidents(), this.incidentsState(), issues),
      devices: this.recover('devices', this.deviceWorkspace.loadFleet(), this.devicesState(), issues),
    }).pipe(
      switchMap(({ alerts, incidents, devices }) => {
        this.alertsState.set(alerts);
        this.incidentsState.set(incidents);
        this.devicesState.set(devices);
        this.buildingsState.set(this.deviceWorkspace.buildings());
        this.deviceWorkspace.partialErrors().forEach((message) => {
          issues.push({ source: 'devices', message });
        });
        if (!devices.length) {
          return of([] as MonitoringMeasurement[]);
        }
        return forkJoin(devices.map((row) => this.recover(
          'monitoring',
          this.monitoring.getDeviceMeasurements(row.catalog.id),
          this.measurementsState().filter((measurement) => measurement.deviceId === row.catalog.id),
          issues,
          `No se pudo actualizar el historial de ${row.catalog.name}.`,
        ))).pipe(
          map((groups) => groups.flat()),
        );
      }),
      tap({
        next: (measurements) => {
          this.measurementsState.set(measurements.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()));
          this.partialErrorsState.set(this.uniqueIssues(issues));
        },
        error: (error: ApiError) => {
          this.errorState.set(error);
        },
      }),
      map(() => undefined),
      finalize(() => this.loadingState.set(false)),
    );
  }

  private recover<T>(
    source: AnalyticsLoadIssue['source'],
    request: Observable<T>,
    fallback: T,
    issues: AnalyticsLoadIssue[],
    message?: string,
  ): Observable<T> {
    return request.pipe(catchError((error: unknown) => {
      if (isApiError(error) && error.status === 401) return throwError(() => error);
      issues.push({
        source,
        message: message ?? this.defaultIssueMessage(source),
      });
      return of(fallback);
    }));
  }

  private defaultIssueMessage(source: AnalyticsLoadIssue['source']): string {
    const messages: Record<AnalyticsLoadIssue['source'], string> = {
      alerts: 'No se pudieron actualizar las alertas.',
      incidents: 'No se pudieron actualizar los incidentes.',
      devices: 'No se pudo actualizar el catálogo de dispositivos.',
      monitoring: 'No se pudieron actualizar algunas mediciones de Monitoring.',
    };
    return messages[source];
  }

  private uniqueIssues(issues: AnalyticsLoadIssue[]): AnalyticsLoadIssue[] {
    return [...new Map(issues.map((issue) => [`${issue.source}:${issue.message}`, issue])).values()];
  }
}
