import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { DeviceMonitoringState, MonitoringMeasurement } from '../monitoring/data-access/monitoring.gateway';
import { DeviceCatalogRecord } from './data-access/device.gateway';
import { DeviceWorkspaceFacade } from './device-workspace.facade';

describe('DeviceWorkspaceFacade resilient composition', () => {
  it('keeps a registered device when its Monitoring status fails', async () => {
    const device = catalogDevice();
    const facade = createFacade({
      getDeviceStatus: () => throwError(() => apiError(500, 'Monitoring unavailable')),
    });

    const rows = await firstValueFrom(facade.loadFleet());

    expect(rows).toHaveLength(1);
    expect(rows[0].catalog).toEqual(device);
    expect(rows[0].monitoring).toBeUndefined();
    expect(facade.partialErrors()).toContain('No se pudo consultar el estado de Monitoring de ESP32 ResQ.');
  });

  it('returns real history even when related alerts fail', async () => {
    const oldReading = measurement('old', '2026-11-12T10:00:00Z');
    const newReading = measurement('new', '2026-11-12T10:01:00Z');
    const facade = createFacade({
      history: [newReading, oldReading],
      alertsFail: true,
    });

    const detail = await firstValueFrom(facade.loadDetail('device-1'));

    expect(detail?.measurements.map((item) => item.measurementId)).toEqual(['old', 'new']);
    expect(detail?.alerts).toEqual([]);
    expect(facade.partialErrors()).toContain('No se pudieron actualizar las alertas relacionadas.');
  });
});

function createFacade(options: {
  getDeviceStatus?: () => Observable<DeviceMonitoringState | undefined>;
  history?: MonitoringMeasurement[];
  alertsFail?: boolean;
}): DeviceWorkspaceFacade {
  const device = catalogDevice();
  const devices = {
    loadDevices: vi.fn(() => of(page([device]))),
    loadDevice: vi.fn(() => of({ device })),
  };
  const buildings = { getBuildings: vi.fn(() => of(page([]))) };
  const monitoring = {
    getDeviceStatus: vi.fn(() => options.getDeviceStatus?.() ?? of(undefined)),
    getCurrentMeasurements: vi.fn(() => of([])),
    getDeviceMeasurements: vi.fn(() => of(options.history ?? [])),
  };
  const connectivity = { getDeviceConnectionStatus: vi.fn(() => of(undefined)) };
  const alerts = {
    getAlerts: vi.fn(() => options.alertsFail
      ? throwError(() => apiError(503, 'Alerts unavailable'))
      : of([])),
  };
  const risk = { getRiskDetectionEvidence: vi.fn(() => of(undefined)) };
  return new DeviceWorkspaceFacade(
    devices as never,
    buildings as never,
    monitoring as never,
    connectivity as never,
    alerts as never,
    risk as never,
    new BuildingStoreService(),
  );
}

function catalogDevice(): DeviceCatalogRecord {
  return {
    id: 'device-1',
    organizationId: 'organization-1',
    deviceCode: 'ESP32-RESQ-01',
    name: 'ESP32 ResQ',
    specifications: { manufacturer: 'Espressif', model: 'ESP32' },
    assignment: { buildingId: 'building-1' },
    administrativeStatus: 'ACTIVE',
    capabilities: [{ id: 'capability-1', code: 'TEMPERATURE_C', kind: 'MEASUREMENT', unit: 'C' }],
    createdAt: new Date('2026-11-12T10:00:00Z'),
    updatedAt: new Date('2026-11-12T10:00:00Z'),
    version: 1,
  };
}

function measurement(id: string, measuredAt: string): MonitoringMeasurement {
  return {
    measurementId: id,
    deviceId: 'device-1',
    buildingId: 'building-1',
    variableType: 'TEMPERATURE_C',
    measurementValue: { value: 0, unit: 'C' },
    measuredAt: new Date(measuredAt),
    recordedAt: new Date(measuredAt),
  };
}

function page<T>(items: T[]) {
  return { items, page: 0, size: 100, totalElements: items.length, totalPages: items.length ? 1 : 0 };
}

function apiError(status: number, message: string): ApiError {
  return { status, code: `HTTP_${status}`, message, fieldErrors: [] };
}
