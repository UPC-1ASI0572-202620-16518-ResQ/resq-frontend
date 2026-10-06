import {
  Alert,
  AlertSeverity,
  Building,
  DetectionEvidence,
  Device,
  DeviceCapability,
  Floor,
  FloorPlanElement,
  FloorPlanPoint,
  Incident,
  NotificationDeliveryStatus,
  ResponseExecution,
  RiskDetectionSummary,
  RiskTypeCode,
  SensorReading,
  SensorType,
  Space,
  SpaceThresholds,
} from '../models/resq.models';
import { defaultThresholds, deviceDefinition } from '../models/device-domain';

const now = Date.now();
const ago = (minutes: number): Date => new Date(now - minutes * 60_000);
const threshold = defaultThresholds;

const currentValues: Record<string, number> = {
  Temperature: 24.2,
  Smoke: 34,
  Gas: 112,
  Humidity: 48,
  Motion: 2,
};
const readings = (
  deviceId: string,
  metric: SensorType,
  base: number,
  unit = deviceDefinition(metric).unit!,
): SensorReading[] => {
  const phase = [...deviceId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 9;
  return Array.from({ length: 24 }, (_, index) => ({
    id: `${deviceId}-r${index}`,
    deviceId,
    metric,
    value:
      index === 23
        ? base
        : Number(
            (base + Math.sin((index + phase) / 3) * base * 0.08 + index * base * 0.002).toFixed(1),
          ),
    unit,
    timestamp: ago((23 - index) * 60),
  }));
};

const capabilityFor = (id: string, type: SensorType): DeviceCapability => ({
  id: `${id}-${type.toLowerCase()}`,
  code: `${type.toLowerCase()}_measurement`,
  name: `${type} Measurement`,
  kind: 'MEASUREMENT',
  category: 'SENSOR',
  hardware: `${type} sensing module`,
  unit: deviceDefinition(type).unit,
});

const makeDevice = (
  id: string,
  spaceId: string,
  buildingId: string,
  floorId: string,
  type: SensorType,
  status: Device['status'] = 'Online',
  value?: number,
): Device => {
  const deviceCode = id.toUpperCase();
  const connectivityStatus = status === 'Offline' ? 'OFFLINE' : 'ONLINE';
  const healthStatus =
    status === 'Critical' ? 'CRITICAL' : status === 'Warning' ? 'WARNING' : 'NORMAL';
  const batteryPercentage = status === 'Offline' ? 0 : 86;
  const signalStrength = status === 'Offline' ? undefined : -54 - (id.length % 12);
  return {
    id,
    organizationId: 'securitybear',
    deviceCode,
    name: `${type} Monitoring Node ${deviceCode}`,
    description: 'Physical IoT node registered for environmental monitoring in ResQ.',
    specifications: {
      manufacturer: 'SecurityBear',
      model: `${type} Monitoring Node`,
      serialNumber: `RSQ-${deviceCode}`,
      firmware: 'v3.8.2',
      protocol: 'Wi-Fi',
      samplingIntervalSeconds: 60,
      edgeIntegration: 'Edge API',
    },
    assignment: { buildingId, floorId, zoneId: spaceId, spaceId },
    administrativeStatus: 'ACTIVE',
    connectivityStatus,
    healthStatus,
    capabilities: [capabilityFor(id, type)],
    power: {
      source: 'Battery',
      status: batteryPercentage > 0 ? 'ON_BATTERY' : 'UNPOWERED',
      batteryPercentage,
    },
    signalStrength,
    lastSeen: ago(status === 'Offline' ? 185 : 2 + (id.length % 4)),
    readings: readings(id, type, value ?? currentValues[type]),
    hardwareComponents: [{ name: `${type} sensing module`, role: 'Measurement hardware' }],
    maintenance: {
      calibrationStatus: 'NOT_REQUIRED',
      lastInspection: ago(60 * 24 * 21),
      nextInspection: ago(-60 * 24 * 69),
    },
    createdAt: ago(60 * 24 * 180),
    updatedAt: ago(2),
    version: 1,
    spaceId,
    code: deviceCode,
    type,
    status,
    firmware: 'v3.8.2',
    battery: batteryPercentage,
    signal: signalStrength ?? 0,
  };
};

const makeMvpDevice = (spaceId: string, buildingId: string, floorId: string): Device => {
  const id = 'resq-mvp-001';
  const deviceCode = 'RESQ-MVP-001';
  return {
    id,
    organizationId: 'securitybear',
    deviceCode,
    name: 'ResQ Safety Node MVP',
    description: 'ESP32-based emergency monitoring and local response node.',
    specifications: {
      manufacturer: 'SecurityBear',
      model: 'ResQ Safety Node v0.1',
      serialNumber: 'SB-RSN-MVP-0001',
      controller: 'ESP32 DevKit V1',
      board: '30-pin',
      firmware: 'v0.1.0-mvp',
      protocol: 'Wi-Fi',
      samplingIntervalSeconds: 60,
      edgeIntegration: 'Edge API',
    },
    assignment: { buildingId, floorId, zoneId: spaceId, spaceId },
    externalReference: 'SECURITYBEAR-MVP-NODE-01',
    administrativeStatus: 'ACTIVE',
    connectivityStatus: 'ONLINE',
    healthStatus: 'NORMAL',
    capabilities: [
      {
        id: 'mvp-cap-gas-smoke',
        code: 'gas_smoke_level',
        name: 'Gas / Smoke Level',
        kind: 'MEASUREMENT',
        category: 'SENSOR',
        hardware: 'MQ-2',
        unit: 'ADC',
        description: 'Raw/relative gas and smoke level for the MVP.',
      },
      {
        id: 'mvp-cap-display',
        code: 'local_status_display',
        name: 'Local Status Display',
        kind: 'ACTUATION',
        category: 'DISPLAY',
        hardware: 'SSD1306 OLED',
        state: 'NORMAL',
      },
      {
        id: 'mvp-cap-alarm',
        code: 'audible_alarm',
        name: 'Audible Alarm',
        kind: 'ACTUATION',
        category: 'ACTUATOR',
        hardware: 'Active Buzzer 5 V',
        state: 'INACTIVE',
      },
      {
        id: 'mvp-cap-red-led',
        code: 'critical_status_indicator',
        name: 'Critical Status Indicator',
        kind: 'ACTUATION',
        category: 'ACTUATOR',
        hardware: 'Red LED',
        state: 'INACTIVE',
      },
      {
        id: 'mvp-cap-green-led',
        code: 'normal_status_indicator',
        name: 'Normal Status Indicator',
        kind: 'ACTUATION',
        category: 'ACTUATOR',
        hardware: 'Green LED',
        state: 'NORMAL',
      },
      {
        id: 'mvp-cap-hvac',
        code: 'environmental_ventilation',
        name: 'Ventilation / HVAC',
        kind: 'ACTUATION',
        category: 'ACTUATOR',
        hardware: 'Planned capability · not installed in MVP',
        state: 'PLANNED',
        description: 'Regulates temperature and environmental conditions when a response rule is triggered.',
      },
      {
        id: 'mvp-cap-servo',
        code: 'mechanical_servo',
        name: 'Servomotor',
        kind: 'ACTUATION',
        category: 'ACTUATOR',
        hardware: 'Planned capability · not installed in MVP',
        state: 'PLANNED',
        description: 'Opens or closes doors, windows, valves or ventilation dampers according to a configured rule.',
      },
    ],
    power: { source: 'USB 5 V', status: 'POWERED' },
    signalStrength: -58,
    lastSeen: ago(2),
    readings: readings(id, 'Gas', 1830, 'ADC'),
    sensorThreshold: { warning: 2000, critical: 3000 },
    availability: 'MVP',
    hardwareImageUrl: '/assets/devices/resq-mvp-node.webp',
    hardwareComponents: [
      {
        name: 'ESP32 DevKit V1',
        role: 'Controller',
        imageUrl: '/assets/devices/esp32-devkit-v1.webp',
      },
      { name: 'MQ-2', role: 'Gas / Smoke Measurement', imageUrl: '/assets/devices/mq2.webp' },
      {
        name: 'SSD1306 OLED',
        role: 'Local Display',
        imageUrl: '/assets/devices/oled-ssd1306.webp',
      },
      {
        name: 'Active Buzzer',
        role: 'Audible Alarm',
        imageUrl: '/assets/devices/active-buzzer.webp',
      },
      { name: 'Red LED', role: 'Critical Indicator', imageUrl: '/assets/devices/led-red.webp' },
      { name: 'Green LED', role: 'Normal Indicator', imageUrl: '/assets/devices/led-green.webp' },
    ],
    assemblyComponents: [
      'MB-102 Breadboard',
      '220 Ω Resistors',
      'Male-Male Jumpers',
      'Male-Female Jumpers',
      'USB Cable',
    ],
    maintenance: {
      calibrationStatus: 'PENDING_CALIBRATION',
      calibrationNote:
        'Raw/relative readings are used in the MVP until the MQ-2 calibration procedure is completed.',
      lastInspection: ago(60 * 24 * 2),
    },
    createdAt: ago(60 * 24 * 30),
    updatedAt: ago(2),
    version: 1,
    spaceId,
    code: deviceCode,
    type: 'Gas',
    status: 'Online',
    firmware: 'v0.1.0-mvp',
    signal: -58,
  };
};

const scienceF2Specs: Array<
  [string, string, string, Space['type'], Space['status'], Space['sensitivity'], number[][]]
> = [
  [
    'chem-lab-201',
    'Chemistry Laboratory',
    '201',
    'Laboratory',
    'Critical',
    'High',
    [
      [70, 55],
      [330, 55],
      [330, 210],
      [70, 210],
    ],
  ],
  [
    'office-202',
    'Office',
    '202',
    'Office',
    'Normal',
    'Normal',
    [
      [350, 55],
      [490, 55],
      [490, 210],
      [350, 210],
    ],
  ],
  [
    'office-203',
    'Office',
    '203',
    'Office',
    'Normal',
    'Normal',
    [
      [510, 55],
      [690, 55],
      [690, 210],
      [510, 210],
    ],
  ],
  [
    'server-204',
    'Server Room',
    '204',
    'ServerRoom',
    'Warning',
    'High',
    [
      [710, 55],
      [900, 55],
      [900, 210],
      [710, 210],
    ],
  ],
  [
    'class-205',
    'Classroom',
    '205',
    'Classroom',
    'Normal',
    'Normal',
    [
      [70, 310],
      [280, 310],
      [280, 455],
      [70, 455],
    ],
  ],
  [
    'storage-206',
    'Storage',
    '206',
    'Storage',
    'Offline',
    'Normal',
    [
      [300, 310],
      [430, 310],
      [430, 455],
      [300, 455],
    ],
  ],
  [
    'class-207',
    'Classroom',
    '207',
    'Classroom',
    'Normal',
    'Normal',
    [
      [570, 310],
      [760, 310],
      [760, 455],
      [570, 455],
    ],
  ],
  [
    'office-208',
    'Office',
    '208',
    'Office',
    'Normal',
    'Normal',
    [
      [780, 310],
      [900, 310],
      [900, 455],
      [780, 455],
    ],
  ],
  [
    'hallway-f2',
    'Central Hallway',
    '',
    'Hallway',
    'Normal',
    'Low',
    [
      [145, 225],
      [825, 225],
      [825, 295],
      [145, 295],
    ],
  ],
];

let deviceCounter = 1;
function makeSpace(
  spec: (typeof scienceF2Specs)[number],
  buildingId: string,
  floorId: string,
): Space {
  const [id, name, roomNumber, type, status, sensitivity, points] = spec;
  if (id === 'chem-lab-201') {
    return {
      id,
      floorId,
      buildingId,
      name,
      roomNumber,
      type,
      status,
      sensitivity,
      thresholds: threshold(type),
      polygon: points.map(([x, y]) => ({ x, y })),
      devices: [makeMvpDevice(id, buildingId, floorId)],
    };
  }
  const types: SensorType[] = ['Temperature', 'Smoke', 'Humidity'];
  const devices = types.map((deviceType) => {
    const deviceId = `dev-${String(deviceCounter++).padStart(3, '0')}`;
    const deviceStatus: Device['status'] =
      status === 'Offline'
        ? 'Offline'
        : status === 'Critical' && ['Smoke', 'Gas'].includes(deviceType)
          ? 'Critical'
          : status === 'Warning' && deviceType === 'Temperature'
            ? 'Warning'
            : 'Online';
    return makeDevice(deviceId, id, buildingId, floorId, deviceType, deviceStatus);
  });
  return {
    id,
    floorId,
    buildingId,
    name,
    roomNumber,
    type,
    status,
    sensitivity,
    thresholds: threshold(type),
    polygon: points.map(([x, y]) => ({ x, y })),
    devices,
  };
}

const rectanglePolygon = (x: number, y: number, width: number, height: number): FloorPlanPoint[] => [
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
];

function makeSpatialSpace(
  id: string,
  buildingId: string,
  floorId: string,
  name: string,
  type: 'Hallway' | 'Stairs' | 'Restroom',
  polygon: FloorPlanPoint[],
): Space {
  return {
    id, buildingId, floorId, name, type,
    sensitivity: type === 'Hallway' || type === 'Stairs' ? 'Low' : 'Normal',
    status: 'Normal', thresholds: threshold(type), polygon, devices: [],
  };
}

function positionDevices(space: Space): Space {
  if (space.polygon.length < 3) return space;
  const xs = space.polygon.map(point => point.x);
  const ys = space.polygon.map(point => point.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  const width = Math.max(...xs) - x; const height = Math.max(...ys) - y;
  const positions: Record<SensorType, [number, number]> = {
    Temperature: [.24, .28], Smoke: [.74, .28], Gas: [.5, .5], Humidity: [.25, .72], Motion: [.74, .72],
  };
  return {
    ...space,
    devices: space.devices.map((device, index) => {
      const [px, py] = device.type in positions ? positions[device.type as SensorType] : [.5, .5];
      const offsetX = ((index % 3) - 1) * 10;
      const offsetY = Math.floor(index / 3) * 10;
      return { ...device, floorPlanPosition: { x: x + width * px + offsetX, y: y + height * py + offsetY } };
    }),
  };
}

function configureDemoFloor(floor: Floor, variant = 0): Floor {
  const spaces = floor.spaces;
  const topCount = Math.ceil(spaces.length / 2);
  const bottomCount = spaces.length - topCount;
  const padding = 50 + (variant % 3) * 8;
  const gap = 18;
  const usableWidth = 1000 - padding * 2;
  const row = (items: Space[], y: number, height: number): Space[] => {
    const width = (usableWidth - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
    return items.map((space, index) => positionDevices({
      ...space,
      polygon: rectanglePolygon(padding + index * (width + gap), y, width, height),
    }));
  };
  const configuredRooms = [
    ...row(spaces.slice(0, topCount), 45 + variant * 3, 155),
    ...row(spaces.slice(topCount), 305 - variant * 2, 145),
  ];
  const stairsX = 445 + variant * 8;
  const restroomX = 535 + variant * 6;
  const rightEdge = padding + usableWidth;
  const configuredSpaces = [
    ...configuredRooms,
    makeSpatialSpace(`${floor.id}-hall-west`, floor.buildingId, floor.id, 'West Hallway', 'Hallway', rectanglePolygon(padding, 220, stairsX - padding - 10, 65)),
    makeSpatialSpace(`${floor.id}-stairs`, floor.buildingId, floor.id, 'Stairs', 'Stairs', rectanglePolygon(stairsX, 220, 70, 65)),
    makeSpatialSpace(`${floor.id}-wc`, floor.buildingId, floor.id, 'Restroom', 'Restroom', rectanglePolygon(restroomX, 220, 65, 65)),
    makeSpatialSpace(`${floor.id}-hall-east`, floor.buildingId, floor.id, 'East Hallway', 'Hallway', rectanglePolygon(restroomX + 75, 220, rightEdge - restroomX - 75, 65)),
  ];
  const areaElements: FloorPlanElement[] = configuredSpaces.map(space => {
    const xs = space.polygon.map(point => point.x); const ys = space.polygon.map(point => point.y);
    return {
      id: `plan-area-${space.id}`,
      type: 'Space',
      spaceId: space.id,
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      label: space.name,
    };
  });
  return { ...floor, spaces: configuredSpaces, planElements: areaElements, planConfigured: configuredSpaces.length > 0 };
}

const genericNames = ['Reception','Open Office','Meeting Room','Control Room','Training Room','Kitchen','Archive','Operations'];
function makeGenericFloor(buildingId: string, level: number, index: number): Floor {
  const floorId = `${buildingId}-f${level}`;
  const spaces = genericNames.slice(0, level % 3 + 5).map((name, room) => makeSpace([
    `${floorId}-s${room+1}`, name, `${level}0${room+1}`, room === 0 ? 'Reception' : room === 2 ? 'MeetingRoom' : 'Office',
    (index + room) % 11 === 0 ? 'Warning' : 'Normal', 'Normal', [[0,0],[1,0],[1,1],[0,1]]
  ], buildingId, floorId));
  return configureDemoFloor({ id: floorId, buildingId, name: `Floor ${level}`, level, spaces, status: spaces.some(space => space.status === 'Warning') ? 'Warning' : 'Normal' }, index % 3);
}

const scienceF2Spaces = [
  ...scienceF2Specs.map(spec => positionDevices(makeSpace(spec, 'science', 'science-f2'))),
  makeSpatialSpace('science-f2-stairs-a', 'science', 'science-f2', 'Stairs A', 'Stairs', rectanglePolygon(445, 310, 45, 145)),
  makeSpatialSpace('science-f2-stairs-b', 'science', 'science-f2', 'Stairs B', 'Stairs', rectanglePolygon(70, 232, 55, 56)),
  makeSpatialSpace('science-f2-wc-a', 'science', 'science-f2', 'Restroom A', 'Restroom', rectanglePolygon(505, 310, 45, 145)),
  makeSpatialSpace('science-f2-wc-b', 'science', 'science-f2', 'Restroom B', 'Restroom', rectanglePolygon(845, 232, 55, 56)),
];
const scienceFloors: Floor[] = [1,2,3,4].map((level, index) => level === 2
  ? {
      id: 'science-f2', buildingId: 'science', name: 'Floor 2', level: 2,
      spaces: scienceF2Spaces, status: 'Critical', planConfigured: true,
      planElements: [
        ...scienceF2Spaces.map(space => {
          const xs = space.polygon.map(point => point.x); const ys = space.polygon.map(point => point.y);
          return { id: `plan-area-${space.id}`, type: 'Space' as const, spaceId: space.id, label: space.name, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
        }),
      ],
    }
  : makeGenericFloor('science', level, index));
const mainFloors = [1,2,3].map((level, index) => makeGenericFloor('main', level, index + 4));
const researchFloors: Floor[] = [1, 2].map((level, index) => {
  const floor = makeGenericFloor('research', level, index + 7);

  return {
    ...floor,
    status: 'Normal',
    spaces: floor.spaces.map((space) => ({
      ...space,
      status: 'Normal',
      devices: space.devices.map((device) => ({
        ...device,
        status: device.status === 'Offline' ? 'Offline' : 'Online',
      })),
    })),
  };
});

export const BUILDINGS: Building[] = [
  {
    id: 'science',
    name: 'Science Building',
    address: '120 Discovery Avenue',
    description: 'Advanced teaching laboratories and science classrooms.',
    imageUrl: '/images/buildings/science-building.webp',
    floors: scienceFloors,
    status: 'Critical',
  },
  {
    id: 'main',
    name: 'Main Building',
    address: '1 University Plaza',
    description: 'Administration, shared services and collaborative spaces.',
    imageUrl: '/images/buildings/main-building.webp',
    floors: mainFloors,
    status: 'Warning',
  },
  {
    id: 'research',
    name: 'Research Center',
    address: '44 Innovation Drive',
    description: 'Specialized research facilities and controlled environments.',
    imageUrl: '/images/buildings/research-center.webp',
    floors: researchFloors,
    status: 'Normal',
  },
];

export const FLOORS: Floor[] = BUILDINGS.flatMap((building) => building.floors);
export const SPACES: Space[] = FLOORS.flatMap((floor) => floor.spaces);
const baseDevices = SPACES.flatMap((space) => space.devices);
export const DEVICES: Device[] = [
  ...baseDevices,
  ...Array.from({ length: Math.max(0, 142 - baseDevices.length) }, (_, index) => {
    const space = SPACES[index % SPACES.length];
    const type = (['Temperature', 'Smoke', 'Gas', 'Humidity', 'Motion'] as SensorType[])[
      index % 5
    ];
    const status: Device['status'] =
      index < 6 ? 'Critical' : index < 18 ? 'Warning' : index < 24 ? 'Offline' : 'Online';
    return makeDevice(
      `aux-${String(index + 1).padStart(3, '0')}`,
      space.id,
      space.buildingId,
      space.floorId,
      type,
      status,
    );
  }),
];

interface AlertScenario {
  alertId: string;
  riskDetectionId: string;
  riskTypeCode: RiskTypeCode;
  severityCode: AlertSeverity;
  minutesAgo: number;
  spaceId: string;
  deviceType: Device['type'];
  deliveryStatus: NotificationDeliveryStatus;
  relatedIncident?: {
    id: string;
    status: Incident['status'];
  };
}

const alertScenarios: AlertScenario[] = [
  {
    alertId: 'alert-001',
    riskDetectionId: 'RISK-0001',
    riskTypeCode: 'GAS_LEAK',
    severityCode: 'Critical',
    minutesAgo: 2,
    spaceId: 'chem-lab-201',
    deviceType: 'Gas',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1001', status: 'Open' },
  },
  {
    alertId: 'alert-002',
    riskDetectionId: 'RISK-0002',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 18,
    spaceId: 'server-204',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1002', status: 'InProgress' },
  },
  {
    alertId: 'alert-003',
    riskDetectionId: 'RISK-0003',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 55,
    spaceId: 'class-205',
    deviceType: 'Smoke',
    deliveryStatus: 'FAILED',
  },
  {
    alertId: 'alert-004',
    riskDetectionId: 'RISK-0004',
    riskTypeCode: 'FIRE',
    severityCode: 'Critical',
    minutesAgo: 90,
    spaceId: 'science-f1-s1',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1004', status: 'Open' },
  },
  {
    alertId: 'alert-005',
    riskDetectionId: 'RISK-0005',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 300,
    spaceId: 'office-208',
    deviceType: 'Smoke',
    deliveryStatus: 'PENDING',
  },
  {
    alertId: 'alert-006',
    riskDetectionId: 'RISK-0006',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 720,
    spaceId: 'science-f3-s3',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-007',
    riskDetectionId: 'RISK-0007',
    riskTypeCode: 'FIRE',
    severityCode: 'Critical',
    minutesAgo: 1_380,
    spaceId: 'main-f1-s6',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1007', status: 'InProgress' },
  },
  {
    alertId: 'alert-008',
    riskDetectionId: 'RISK-0008',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 2_880,
    spaceId: 'main-f2-s1',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-009',
    riskDetectionId: 'RISK-0009',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 5_760,
    spaceId: 'main-f3-s4',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-010',
    riskDetectionId: 'RISK-0010',
    riskTypeCode: 'FIRE',
    severityCode: 'Critical',
    minutesAgo: 8_640,
    spaceId: 'research-f1-s2',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1010', status: 'Resolved' },
  },
  {
    alertId: 'alert-011',
    riskDetectionId: 'RISK-0011',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 12_960,
    spaceId: 'research-f2-s5',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-012',
    riskDetectionId: 'RISK-0012',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 20_160,
    spaceId: 'science-f4-s2',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-013',
    riskDetectionId: 'RISK-0013',
    riskTypeCode: 'FIRE',
    severityCode: 'Critical',
    minutesAgo: 30_240,
    spaceId: 'main-f1-s4',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1013', status: 'Resolved' },
  },
  {
    alertId: 'alert-014',
    riskDetectionId: 'RISK-0014',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 41_760,
    spaceId: 'research-f2-s1',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-015',
    riskDetectionId: 'RISK-0015',
    riskTypeCode: 'FIRE',
    severityCode: 'Warning',
    minutesAgo: 64_800,
    spaceId: 'science-f1-s5',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
  },
  {
    alertId: 'alert-016',
    riskDetectionId: 'RISK-0016',
    riskTypeCode: 'FIRE',
    severityCode: 'Critical',
    minutesAgo: 100_800,
    spaceId: 'main-f3-s2',
    deviceType: 'Smoke',
    deliveryStatus: 'DELIVERED',
    relatedIncident: { id: 'INC-1016', status: 'Resolved' },
  },
];

const scenarioDevice = (scenario: AlertScenario): Device => {
  if (scenario.alertId === 'alert-001') {
    return DEVICES.find((device) => device.id === 'resq-mvp-001')!;
  }
  return DEVICES.find(
    (device) =>
      device.assignment.spaceId === scenario.spaceId && device.type === scenario.deviceType,
  )!;
};

const detectedAtFor = (scenario: AlertScenario): Date => ago(scenario.minutesAgo);
const after = (date: Date, seconds: number): Date => new Date(date.getTime() + seconds * 1_000);

export const RISK_DETECTIONS: RiskDetectionSummary[] = alertScenarios.map((scenario) => {
  const device = scenarioDevice(scenario);
  const capability = device.capabilities.find((item) => item.kind === 'MEASUREMENT')!;
  const detectedAt = detectedAtFor(scenario);
  const latestReading = device.readings.at(-1);
  const evidence: DetectionEvidence = {
    deviceId: device.id,
    capabilityCode: capability.code,
    measurementName: capability.name,
    value: scenario.alertId === 'alert-001' ? 1830 : (latestReading?.value ?? 0),
    unit: scenario.alertId === 'alert-001' ? 'ADC' : (capability.unit ?? latestReading?.unit ?? ''),
    capturedAt: detectedAt,
  };
  return {
    riskDetectionId: scenario.riskDetectionId,
    riskTypeCode: scenario.riskTypeCode,
    severityCode: scenario.severityCode,
    detectedAt,
    evidence: [evidence],
  };
});

export const ALERTS: Alert[] = alertScenarios.map((scenario) => {
  const space = SPACES.find((item) => item.id === scenario.spaceId)!;
  const detectedAt = detectedAtFor(scenario);
  const generatedAt = after(detectedAt, 1);
  const requestedAt = after(detectedAt, 2);
  const completedAt =
    scenario.deliveryStatus === 'PENDING' ? undefined : after(detectedAt, 3);
  return {
    alertId: scenario.alertId,
    organizationId: 'securitybear',
    context: {
      riskDetectionId: scenario.riskDetectionId,
      riskTypeCode: scenario.riskTypeCode,
      severityCode: scenario.severityCode,
      buildingId: space.buildingId,
      zoneId: space.id,
      detectedAt,
    },
    generatedAt,
    deliveries: [
      {
        deliveryId: `delivery-${scenario.alertId}`,
        recipientUserId: 'user-1',
        channel: 'PUSH',
        destination: 'registered-mobile-device',
        status: scenario.deliveryStatus,
        requestedAt,
        completedAt,
        failureReason:
          scenario.deliveryStatus === 'FAILED'
            ? 'The push provider did not confirm delivery.'
            : undefined,
      },
    ],
  };
});

export const RESPONSE_EXECUTIONS: ResponseExecution[] = [
  {
    responseExecutionId: 'response-001',
    organizationId: 'securitybear',
    riskDetectionId: 'RISK-0001',
    policyId: 'policy-gas-leak-mvp',
    action: {
      actionId: 'action-audible-alarm',
      actionCode: 'ACTIVATE_AUDIBLE_ALARM',
      actionName: 'Audible Alarm',
      targetDeviceId: 'resq-mvp-001',
      targetCapabilityCode: 'audible_alarm',
      authorizationMode: 'AUTOMATIC',
      critical: true,
    },
    status: 'SUCCEEDED',
    requestedAt: after(RISK_DETECTIONS[0].detectedAt, 4),
    result: {
      successful: true,
      resultCode: 'ACTUATOR_CONFIRMED',
      message: 'The audible alarm was activated locally.',
      completedAt: after(RISK_DETECTIONS[0].detectedAt, 5),
    },
  },
  {
    responseExecutionId: 'response-002',
    organizationId: 'securitybear',
    riskDetectionId: 'RISK-0001',
    policyId: 'policy-gas-leak-mvp',
    action: {
      actionId: 'action-critical-indicator',
      actionCode: 'ACTIVATE_CRITICAL_INDICATOR',
      actionName: 'Critical Status Indicator',
      targetDeviceId: 'resq-mvp-001',
      targetCapabilityCode: 'critical_status_indicator',
      authorizationMode: 'AUTOMATIC',
      critical: true,
    },
    status: 'SUCCEEDED',
    requestedAt: after(RISK_DETECTIONS[0].detectedAt, 4),
    result: {
      successful: true,
      resultCode: 'ACTUATOR_CONFIRMED',
      message: 'The critical status indicator was activated locally.',
      completedAt: after(RISK_DETECTIONS[0].detectedAt, 5),
    },
  },
  {
    responseExecutionId: 'response-003',
    organizationId: 'securitybear',
    riskDetectionId: 'RISK-0001',
    policyId: 'policy-gas-leak-mvp',
    action: {
      actionId: 'action-local-display',
      actionCode: 'SHOW_CRITICAL_STATUS',
      actionName: 'Local Status Display',
      targetDeviceId: 'resq-mvp-001',
      targetCapabilityCode: 'local_status_display',
      authorizationMode: 'AUTOMATIC',
      critical: true,
    },
    status: 'SUCCEEDED',
    requestedAt: after(RISK_DETECTIONS[0].detectedAt, 4),
    result: {
      successful: true,
      resultCode: 'ACTUATOR_CONFIRMED',
      message: 'The local display was updated with the critical status.',
      completedAt: after(RISK_DETECTIONS[0].detectedAt, 5),
    },
  },
];

export const INCIDENTS: Incident[] = alertScenarios
  .filter((scenario) => scenario.relatedIncident)
  .map((scenario) => {
    const space = SPACES.find((item) => item.id === scenario.spaceId)!;
    const detectedAt = detectedAtFor(scenario);
    const relatedIncident = scenario.relatedIncident!;
    const resolvedAt =
      relatedIncident.status === 'Resolved'
        ? new Date(Math.min(detectedAt.getTime() + 45 * 60_000, now - 60_000))
        : undefined;
    return {
      id: relatedIncident.id,
      alertIds: [scenario.alertId],
      buildingId: space.buildingId,
      floorId: space.floorId,
      spaceId: space.id,
      title:
        scenario.riskTypeCode === 'GAS_LEAK'
          ? 'Gas leak response'
          : 'Fire risk investigation',
      description: 'Facilities response and investigation record for the classified risk.',
      severity: scenario.severityCode,
      status: relatedIncident.status,
      createdAt: after(detectedAt, 8),
      resolvedAt,
    };
  });

export const DEMO_USER = { id: 'user-1', name: 'Sofia Ramirez', email: 'sofia.ramirez@resq.io', initials: 'SR' };
