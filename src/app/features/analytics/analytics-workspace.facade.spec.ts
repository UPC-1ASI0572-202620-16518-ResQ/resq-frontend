import { signal } from '@angular/core';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AlertWorkspaceRow } from '../alerts/alert-workspace.facade';
import { DeviceWorkspaceRow } from '../devices/device-workspace.facade';
import { IncidentWorkspaceRow } from '../incidents/incident-workspace.facade';
import { MonitoringMeasurement } from '../monitoring/data-access/monitoring.gateway';
import { AnalyticsWorkspaceFacade } from './analytics-workspace.facade';

describe('AnalyticsWorkspaceFacade partial loading', () => {
  it('keeps Monitoring measurements when Incident Management fails', async () => {
    const row = deviceRow('device-1', 'ESP32 ResQ');
    const facade = createFacade({
      incidents: throwError(() => apiError(500, 'Incident service unavailable')),
      devices: of([row]),
      histories: { 'device-1': of([measurement('measurement-1', 'device-1')]) },
    });

    await firstValueFrom(facade.load());

    expect(facade.devices()).toHaveLength(1);
    expect(facade.measurements()).toHaveLength(1);
    expect(facade.partialErrors().some((issue) => issue.source === 'incidents')).toBe(true);
  });

  it('does not hide devices when Alert Management fails', async () => {
    const row = deviceRow('device-1', 'ESP32 ResQ');
    const facade = createFacade({
      alerts: throwError(() => apiError(503, 'Alert service unavailable')),
      devices: of([row]),
      histories: { 'device-1': of([]) },
    });

    await firstValueFrom(facade.load());

    expect(facade.devices()).toEqual([row]);
    expect(facade.partialErrors().some((issue) => issue.source === 'alerts')).toBe(true);
  });

  it('keeps the rest of the fleet when one measurement history fails', async () => {
    const facade = createFacade({
      devices: of([deviceRow('device-1', 'ESP32 ResQ'), deviceRow('device-2', 'Other device')]),
      histories: {
        'device-1': throwError(() => apiError(500, 'History unavailable')),
        'device-2': of([measurement('measurement-2', 'device-2')]),
      },
    });

    await firstValueFrom(facade.load());

    expect(facade.devices()).toHaveLength(2);
    expect(facade.measurements().map((item) => item.deviceId)).toEqual(['device-2']);
    expect(facade.partialErrors().some((issue) => issue.source === 'monitoring')).toBe(true);
  });

  it('does not swallow authentication failures', async () => {
    const facade = createFacade({ alerts: throwError(() => apiError(401, 'Unauthorized')) });
    await expect(firstValueFrom(facade.load())).rejects.toMatchObject({ status: 401 });
  });
});

function createFacade(options: {
  alerts?: Observable<AlertWorkspaceRow[]>;
  incidents?: Observable<IncidentWorkspaceRow[]>;
  devices?: Observable<DeviceWorkspaceRow[]>;
  histories?: Record<string, Observable<MonitoringMeasurement[]>>;
}): AnalyticsWorkspaceFacade {
  const deviceWorkspace = {
    loadFleet: vi.fn(() => options.devices ?? of([])),
    buildings: signal([]).asReadonly(),
    partialErrors: signal<string[]>([]).asReadonly(),
  };
  const monitoring = {
    getDeviceMeasurements: vi.fn((deviceId: string) => options.histories?.[deviceId] ?? of([])),
  };
  return new AnalyticsWorkspaceFacade(
    { loadAlerts: vi.fn(() => options.alerts ?? of([])) } as never,
    { loadIncidents: vi.fn(() => options.incidents ?? of([])) } as never,
    deviceWorkspace as never,
    monitoring as never,
  );
}

function deviceRow(id: string, name: string): DeviceWorkspaceRow {
  return {
    catalog: {
      id,
      organizationId: 'organization-1',
      deviceCode: id.toUpperCase(),
      name,
      specifications: {},
      assignment: { buildingId: 'building-1' },
      administrativeStatus: 'ACTIVE',
      capabilities: [],
      createdAt: new Date('2026-11-12T10:00:00Z'),
      updatedAt: new Date('2026-11-12T10:00:00Z'),
      version: 1,
    },
    location: { buildingId: 'building-1', buildingName: 'Building 1' },
    capabilities: [],
  };
}

function measurement(measurementId: string, deviceId: string): MonitoringMeasurement {
  return {
    measurementId,
    deviceId,
    buildingId: 'building-1',
    variableType: 'TEMPERATURE_C',
    measurementValue: { value: 22, unit: 'C' },
    measuredAt: new Date('2026-11-12T10:00:00Z'),
    recordedAt: new Date('2026-11-12T10:00:01Z'),
  };
}

function apiError(status: number, message: string): ApiError {
  return { status, code: `HTTP_${status}`, message, fieldErrors: [] };
}
