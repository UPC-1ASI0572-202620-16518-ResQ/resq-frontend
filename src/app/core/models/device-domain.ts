import {
  DEVICE_CATALOG,
  Device,
  DeviceCapability,
  DeviceCapabilityCategory,
  DeviceType,
  MetricThreshold,
  ResponseRule,
  SensorType,
  Space,
  SpaceThresholds,
  SpaceType,
} from './resq.models';

export const sensorDefinitions = DEVICE_CATALOG.filter((item) => item.category === 'SENSOR');
export const comparisonOperators = ['>', '<', '>=', '<=', '='] as const;
export const deviceDefinition = (type: DeviceType) =>
  DEVICE_CATALOG.find((item) => item.type === type)!;
export const isSensorType = (type: DeviceType): type is SensorType =>
  deviceDefinition(type).category === 'SENSOR';
/** Legacy multi-capability MVP codes resolve through the same catalog. */
const capabilityAliases: Record<string, DeviceType> = {
  gas_smoke_level: 'Gas',
  critical_status_indicator: 'VisualSignal',
  normal_status_indicator: 'VisualSignal',
};
export const capabilityDefinition = (code: string) =>
  DEVICE_CATALOG.find(
    (item) => item.capabilityCode === code || item.type === capabilityAliases[code],
  );
export function capabilityCategory(
  capability: Pick<DeviceCapability, 'code' | 'kind' | 'category'>,
): DeviceCapabilityCategory {
  return (
    capability.category ??
    capabilityDefinition(capability.code)?.category ??
    (capability.kind === 'MEASUREMENT' ? 'SENSOR' : 'ACTUATOR')
  );
}
export function sensorThreshold(device: Device, space: Space): MetricThreshold | undefined {
  if (!isSensorType(device.type)) return undefined;
  const unit =
    device.capabilities.find((cap) => cap.kind === 'MEASUREMENT')?.unit ??
    device.readings.at(-1)?.unit;
  // Never compare raw ADC to thresholds expressed in ppm.
  return (
    device.sensorThreshold ??
    (unit === deviceDefinition(device.type).unit ? space.thresholds[device.type] : undefined)
  );
}
export function defaultThresholds(type: SpaceType): SpaceThresholds {
  const common = {
    Temperature: { warning: 32, critical: 40 },
    Smoke: { warning: 100, critical: 150 },
    Gas: { warning: 250, critical: 400 },
    Humidity: { warning: 70, critical: 85 },
    Motion: { warning: 1, critical: 2 },
  };
  const overrides =
    type === 'Laboratory'
      ? {
          Temperature: { warning: 28, critical: 35 },
          Smoke: { warning: 80, critical: 120 },
          Gas: { warning: 200, critical: 300 },
        }
      : type === 'ServerRoom'
        ? {
            Temperature: { warning: 27, critical: 32 },
            Smoke: { warning: 60, critical: 100 },
            Gas: { warning: 250, critical: 400 },
            Humidity: { warning: 65, critical: 80 },
          }
        : {};
  return structuredClone({ ...common, ...overrides });
}

export function matchesCondition(
  value: number,
  operator: ResponseRule['operator'],
  threshold: number,
): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return false;
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '=':
      return value === threshold;
    default:
      return value >= threshold;
  }
}

export function makeDevice(
  type: DeviceType,
  space: Space,
  devices: Device[],
  position?: Device['floorPlanPosition'],
): Device {
  const definition = deviceDefinition(type);
  const prefix = type.toUpperCase();
  let number = 1;
  const used = new Set(devices.map((device) => device.deviceCode.toUpperCase()));
  while (used.has(`${prefix}-${String(number).padStart(3, '0')}`)) number++;
  const code = `${prefix}-${String(number).padStart(3, '0')}`;
  const id = crypto.randomUUID();
  const now = new Date();
  return {
    id,
    organizationId: devices[0]?.organizationId ?? 'securitybear',
    deviceCode: code,
    code,
    name: `${definition.label} ${code}`,
    description: '',
    type,
    status: 'Online',
    availability: 'SIMULATED',
    spaceId: space.id,
    assignment: {
      buildingId: space.buildingId,
      floorId: space.floorId,
      zoneId: space.id,
      spaceId: space.id,
    },
    administrativeStatus: 'ACTIVE',
    connectivityStatus: 'ONLINE',
    healthStatus: 'NORMAL',
    specifications: {
      manufacturer: 'Unspecified',
      model: definition.label,
      serialNumber: code,
      firmware: '',
      protocol: 'Simulation',
      samplingIntervalSeconds: 60,
    },
    capabilities: [
      {
        id: `${id}-cap`,
        code: definition.capabilityCode,
        name: definition.label,
        category: definition.category,
        kind: definition.category === 'SENSOR' ? 'MEASUREMENT' : 'ACTUATION',
        hardware: definition.hardware,
        unit: definition.unit,
        state:
          definition.category === 'DISPLAY'
            ? 'NORMAL'
            : type === 'Servomotor'
              ? 'CLOSED'
              : definition.category === 'ACTUATOR'
                ? 'INACTIVE'
                : undefined,
      },
    ],
    power: { source: 'Simulation', status: 'POWERED' },
    lastSeen: now,
    readings: [],
    hardwareComponents: [],
    firmware: '',
    signal: 0,
    createdAt: now,
    updatedAt: now,
    version: 1,
    floorPlanPosition: position,
  };
}
