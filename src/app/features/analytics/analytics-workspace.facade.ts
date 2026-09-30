import { Inject, Injectable, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AlertWorkspaceFacade, AlertWorkspaceRow } from '../alerts/alert-workspace.facade';
import { DeviceWorkspaceFacade, DeviceWorkspaceRow } from '../devices/device-workspace.facade';
import { IncidentWorkspaceFacade, IncidentWorkspaceRow } from '../incidents/incident-workspace.facade';
import { MONITORING_GATEWAY, MonitoringGateway, MonitoringMeasurement } from '../monitoring/data-access/monitoring.gateway';

@Injectable({ providedIn: 'root' })
export class AnalyticsWorkspaceFacade {
  private readonly alertsState = signal<AlertWorkspaceRow[]>([]);
  private readonly incidentsState = signal<IncidentWorkspaceRow[]>([]);
  private readonly devicesState = signal<DeviceWorkspaceRow[]>([]);
  private readonly measurementsState = signal<MonitoringMeasurement[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);

  readonly alerts = this.alertsState.asReadonly();
  readonly incidents = this.incidentsState.asReadonly();
  readonly devices = this.devicesState.asReadonly();
  readonly measurements = this.measurementsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(
    private readonly alertWorkspace: AlertWorkspaceFacade,
    private readonly incidentWorkspace: IncidentWorkspaceFacade,
    private readonly deviceWorkspace: DeviceWorkspaceFacade,
    @Inject(MONITORING_GATEWAY) private readonly monitoring: MonitoringGateway,
  ) {}

  load(): Observable<void> {
    this.loadingState.set(true);
    this.errorState.set(undefined);

    return forkJoin({
      alerts: this.alertWorkspace.loadAlerts(),
      incidents: this.incidentWorkspace.loadIncidents(),
      devices: this.deviceWorkspace.loadFleet(),
    }).pipe(
      switchMap(({ alerts, incidents, devices }) => {
        this.alertsState.set(alerts);
        this.incidentsState.set(incidents);
        this.devicesState.set(devices);
        if (!devices.length) {
          return of([] as MonitoringMeasurement[]);
        }
        return forkJoin(devices.map((row) => this.monitoring.getDeviceMeasurements(row.catalog.id))).pipe(
          map((groups) => groups.flat()),
        );
      }),
      tap({
        next: (measurements) => {
          this.measurementsState.set(measurements.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()));
          this.loadingState.set(false);
        },
        error: (error: ApiError) => {
          this.errorState.set(error);
          this.loadingState.set(false);
        },
      }),
      map(() => undefined),
    );
  }
}
