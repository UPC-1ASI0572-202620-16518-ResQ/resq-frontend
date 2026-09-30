import {
  Alert,
  AlertSeverity,
  Building,
  DetectionEvidence,
  Device,
  DeviceCapability,
  Floor,
  Incident,
  NotificationDeliveryStatus,
  ResponseExecution,
  RiskDetectionSummary,
  RiskTypeCode,
  SensorReading,
  Space,
  SpaceThresholds,
} from '../models/resq.models';

const now = Date.now();
const ago = (minutes: number): Date => new Date(now - minutes * 60_000);
const threshold = (type: string): SpaceThresholds =>
  type === 'Laboratory'
    ? {
        Temperature: { warning: 28, critical: 35 },
        Smoke: { warning: 80, critical: 120 },
        Gas: { warning: 200, critical: 300 },
        Humidity: { warning: 70, critical: 85 },
      }
    : type === 'ServerRoom'
      ? {
          Temperature: { warning: 27, critical: 32 },
          Smoke: { warning: 60, critical: 100 },
          Gas: { warning: 250, critical: 400 },
          Humidity: { warning: 65, critical: 80 },
        }
      : {
          Temperature: { warning: 32, critical: 40 },
          Smoke: { warning: 100, critical: 150 },
          Gas: { warning: 250, critical: 400 },
          Humidity: { warning: 70, critical: 85 },
        };

const units: Record<Device['type'], string> = {
  Temperature: '°C',
  Smoke: 'ppm',
  Gas: 'ppm',
  Humidity: '%',
  Motion: 'events',
};
const currentValues: Record<string, number> = {
  Temperature: 24.2,
  Smoke: 34,
  Gas: 112,
  Humidity: 48,
  Motion: 2,
};
const readings = (
  deviceId: string,
  metric: Device['type'],
  base: number,
  unit = units[metric],
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

const capabilityFor = (id: string, type: Device['type']): DeviceCapability => ({
  id: `${id}-${type.toLowerCase()}`,
  code: `${type.toLowerCase()}_measurement`,
  name: `${type} Measurement`,
  kind: 'MEASUREMENT',
  hardware: `${type} sensing module`,
  unit: units[type],
});

const makeDevice = (
  id: string,
  spaceId: string,
  buildingId: string,
  floorId: string,
  type: Device['type'],
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
        hardware: 'MQ-2',
        unit: 'ADC',
        description: 'Raw/relative gas and smoke level for the MVP.',
      },
      {
        id: 'mvp-cap-display',
        code: 'local_status_display',
        name: 'Local Status Display',
        kind: 'ACTUATION',
        hardware: 'SSD1306 OLED',
      },
      {
        id: 'mvp-cap-alarm',
        code: 'audible_alarm',
        name: 'Audible Alarm',
        kind: 'ACTUATION',
        hardware: 'Active Buzzer 5 V',
      },
      {
        id: 'mvp-cap-red-led',
        code: 'critical_status_indicator',
        name: 'Critical Status Indicator',
        kind: 'ACTUATION',
        hardware: 'Red LED',
      },
      {
        id: 'mvp-cap-green-led',
        code: 'normal_status_indicator',
        name: 'Normal Status Indicator',
        kind: 'ACTUATION',
        hardware: 'Green LED',
      },
    ],
    power: { source: 'USB 5 V', status: 'POWERED' },
    signalStrength: -58,
    lastSeen: ago(2),
    readings: readings(id, 'Gas', 1830, 'ADC'),
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
      [70, 225],
      [900, 225],
      [900, 295],
      [70, 295],
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
  const types: Device['type'][] = ['Temperature', 'Smoke', 'Humidity'];
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

const genericNames = [
  'Reception',
  'Open Office',
  'Meeting Room',
  'Control Room',
  'Training Room',
  'Kitchen',
  'Archive',
  'Operations',
];
function makeGenericFloor(buildingId: string, level: number, index: number): Floor {
  const floorId = `${buildingId}-f${level}`;
  const spaces = genericNames.slice(0, (level % 3) + 5).map((name, room) =>
    makeSpace(
      [
        `${floorId}-s${room + 1}`,
        name,
        `${level}0${room + 1}`,
        room === 0 ? 'Reception' : room === 2 ? 'MeetingRoom' : 'Office',
        (index + room) % 11 === 0 ? 'Warning' : 'Normal',
        'Normal',
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
      buildingId,
      floorId,
    ),
  );
  return {
    id: floorId,
    buildingId,
    name: `Floor ${level}`,
    level,
    spaces,
    status: spaces.some((space) => space.status === 'Warning') ? 'Warning' : 'Normal',
  };
}

const scienceF2Spaces = scienceF2Specs.map((spec) => makeSpace(spec, 'science', 'science-f2'));
const scienceFloors: Floor[] = [1, 2, 3, 4].map((level, index) =>
  level === 2
    ? {
        id: 'science-f2',
        buildingId: 'science',
        name: 'Floor 2',
        level: 2,
        spaces: scienceF2Spaces,
        status: 'Critical',
      }
    : makeGenericFloor('science', level, index),
);
const mainFloors = [1, 2, 3].map((level, index) => makeGenericFloor('main', level, index + 4));
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
    floors: scienceFloors,
    status: 'Critical',
  },
  {
    id: 'main',
    name: 'Main Building',
    address: '1 University Plaza',
    description: 'Administration, shared services and collaborative spaces.',
    floors: mainFloors,
    status: 'Warning',
  },
  {
    id: 'research',
    name: 'Research Center',
    address: '44 Innovation Drive',
    description: 'Specialized research facilities and controlled environments.',
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
    const type = (['Temperature', 'Smoke', 'Gas', 'Humidity', 'Motion'] as Device['type'][])[
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

export const DEMO_USER = { id: 'user-1', name: 'John Doe', email: 'admin@resq.io', initials: 'JD' };
