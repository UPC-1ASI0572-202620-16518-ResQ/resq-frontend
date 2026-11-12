import { Device, DeviceType, SensorReading } from '../../core/models/resq.models';
import { capabilityCategory } from '../../core/models/device-domain';
import type { DeviceWorkspaceRow } from './device-workspace.facade';

const legacyTypeByCode: Record<string, DeviceType> = {
  TEMPERATURE: 'Temperature', SMOKE: 'Smoke', GAS: 'Gas',
  HUMIDITY: 'Humidity', MOTION: 'Motion',
  HVAC: 'HVAC', AUDIBLE_ALARM: 'AudibleAlarm',
  VISUAL_SIGNAL: 'VisualSignal', SERVOMOTOR: 'Servomotor', OLED: 'OLED',
  TEMPERATURE_MEASUREMENT: 'Temperature', GAS_SMOKE_LEVEL: 'Gas',
  LOCAL_STATUS_DISPLAY: 'OLED',
  GAS_PPM: 'Gas', SMOKE_PPM: 'Smoke',
  GAS_MEASUREMENT: 'Gas', SMOKE_MEASUREMENT: 'Smoke',
  HUMIDITY_MEASUREMENT: 'Humidity', MOTION_MEASUREMENT: 'Motion',
  VISUAL_STATUS_SIGNALING: 'VisualSignal',
  ENVIRONMENTAL_VENTILATION: 'HVAC',
  MECHANICAL_SERVO: 'Servomotor',
};

/** Adapter for old floor/space components. Backend data is the only source of readings. */
export function mapWorkspaceDeviceToPresentation(row: DeviceWorkspaceRow): Device {
  const catalog = row.catalog;
  const primary = row.capabilities.find((cap) => cap.kind === 'MEASUREMENT') ?? row.capabilities[0];
  const type = primary ? legacyTypeByCode[primary.code.toUpperCase()] : undefined;
  // Unrecognized API capabilities remain visible under their actual code in Devices.
  // The legacy floor widgets only understand catalog-supported device types.
  const compatibilityType = type ?? (primary?.kind === 'ACTUATION' ? 'VisualSignal' : 'Temperature');
  const zoneId = catalog.assignment.zoneId ?? '';
  const floorId = row.location.floorId ?? '';
  const status = !row.connection ? 'Unknown' : row.connection.status === 'ONLINE' ? 'Online' : 'Offline';
  const reading = row.latestMeasurement;
  const readingType = reading ? legacyTypeByCode[reading.variableType.toUpperCase()] : undefined;
  const readings: SensorReading[] = reading && readingType && ['Temperature','Smoke','Gas','Humidity','Motion'].includes(readingType)
    ? [{ id: reading.measurementId, deviceId: catalog.id, metric: readingType as SensorReading['metric'],
        value: reading.measurementValue.value, unit: reading.measurementValue.unit,
        timestamp: reading.measuredAt }]
    : [];

  return {
    id: catalog.id, organizationId: catalog.organizationId,
    deviceCode: catalog.deviceCode, code: catalog.deviceCode,
    name: catalog.name, displayName: catalog.name, description: catalog.description ?? '',
    specifications: {
      manufacturer: catalog.specifications.manufacturer ?? 'Not reported',
      model: catalog.specifications.model ?? 'Not reported',
      serialNumber: catalog.specifications.serialNumber ?? 'Not reported',
      firmware: 'Not reported', protocol: 'Not reported', samplingIntervalSeconds: 0,
    },
    assignment: { buildingId: catalog.assignment.buildingId, floorId, zoneId, spaceId: zoneId },
    spaceId: zoneId,
    externalReference: catalog.externalReference?.externalDeviceId,
    externalReferenceDetails: catalog.externalReference,
    administrativeStatus: catalog.administrativeStatus,
    connectivityStatus: !row.connection ? 'UNKNOWN' : row.connection.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
    healthStatus: 'UNKNOWN',
    capabilities: row.capabilities.map((cap) => ({
      id: cap.id, code: cap.code, name: cap.label, kind: cap.kind,
      category: capabilityCategory(cap),
      hardware: cap.hardwareLabel, unit: cap.unit,
    })),
    power: { source: 'Not reported', status: 'UNKNOWN' },
    signalStrength: row.connection?.signalStrength,
    lastSeen: row.connection?.lastHeartbeatAt ?? new Date(0),
    readings,
    hardwareComponents: [],
    createdAt: catalog.createdAt, updatedAt: catalog.updatedAt, version: catalog.version,
    type: compatibilityType, status, firmware: 'Not reported', signal: row.connection?.signalStrength ?? 0,
  };
}
