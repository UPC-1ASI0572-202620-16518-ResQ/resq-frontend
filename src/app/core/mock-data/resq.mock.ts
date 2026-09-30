import { Alert, Building, Device, Floor, Incident, SensorReading, Space, SpaceThresholds } from '../models/resq.models';

const now = Date.now();
const ago = (minutes: number): Date => new Date(now - minutes * 60_000);
const threshold = (type: string): SpaceThresholds => type === 'Laboratory'
  ? { Temperature: { warning: 28, critical: 35 }, Smoke: { warning: 80, critical: 120 }, Gas: { warning: 200, critical: 300 }, Humidity: { warning: 70, critical: 85 } }
  : type === 'ServerRoom'
    ? { Temperature: { warning: 27, critical: 32 }, Smoke: { warning: 60, critical: 100 }, Gas: { warning: 250, critical: 400 }, Humidity: { warning: 65, critical: 80 } }
    : { Temperature: { warning: 32, critical: 40 }, Smoke: { warning: 100, critical: 150 }, Gas: { warning: 250, critical: 400 }, Humidity: { warning: 70, critical: 85 } };

const units: Record<string, string> = { Temperature: '°C', Smoke: 'ppm', Gas: 'ppm', Humidity: '%', Motion: 'events' };
const currentValues: Record<string, number> = { Temperature: 24.2, Smoke: 34, Gas: 112, Humidity: 48, Motion: 2 };
const readings = (deviceId: string, metric: Device['type'], base: number): SensorReading[] => Array.from({ length: 24 }, (_, index) => ({
  id: `${deviceId}-r${index}`, deviceId, metric, value: index === 23 ? base : Number((base + Math.sin(index / 3) * base * .08 + index * base * .004).toFixed(1)),
  unit: units[metric], timestamp: ago((23 - index) * 60),
}));
const makeDevice = (id: string, spaceId: string, type: Device['type'], status: Device['status'] = 'Online', value?: number): Device => ({
  id, spaceId, type, status, code: id.toUpperCase(), name: `${type} Sensor ${id.toUpperCase()}`, lastSeen: ago(status === 'Offline' ? 185 : 2),
  readings: readings(id, type, value ?? currentValues[type]), firmware: 'v3.8.2', battery: status === 'Offline' ? 0 : 86, signal: status === 'Offline' ? 0 : -58,
});

const scienceF2Specs: Array<[string, string, string, Space['type'], Space['status'], Space['sensitivity'], number[][]]> = [
  ['chem-lab-201', 'Chemistry Laboratory', '201', 'Laboratory', 'Critical', 'High', [[70,55],[330,55],[330,210],[70,210]]],
  ['office-202', 'Office', '202', 'Office', 'Normal', 'Normal', [[350,55],[490,55],[490,210],[350,210]]],
  ['office-203', 'Office', '203', 'Office', 'Normal', 'Normal', [[510,55],[690,55],[690,210],[510,210]]],
  ['server-204', 'Server Room', '204', 'ServerRoom', 'Warning', 'High', [[710,55],[900,55],[900,210],[710,210]]],
  ['class-205', 'Classroom', '205', 'Classroom', 'Normal', 'Normal', [[70,310],[280,310],[280,455],[70,455]]],
  ['storage-206', 'Storage', '206', 'Storage', 'Offline', 'Normal', [[300,310],[430,310],[430,455],[300,455]]],
  ['class-207', 'Classroom', '207', 'Classroom', 'Normal', 'Normal', [[570,310],[760,310],[760,455],[570,455]]],
  ['office-208', 'Office', '208', 'Office', 'Normal', 'Normal', [[780,310],[900,310],[900,455],[780,455]]],
  ['hallway-f2', 'Central Hallway', '', 'Hallway', 'Normal', 'Low', [[70,225],[900,225],[900,295],[70,295]]],
];

let deviceCounter = 1;
function makeSpace(spec: typeof scienceF2Specs[number], buildingId: string, floorId: string): Space {
  const [id, name, roomNumber, type, status, sensitivity, points] = spec;
  const types: Device['type'][] = id === 'chem-lab-201' ? ['Temperature','Smoke','Gas','Humidity','Motion','Gas'] : ['Temperature','Smoke','Humidity'];
  const devices = types.map((deviceType, index) => {
    const deviceId = id === 'chem-lab-201'
      ? ['lab-temp-01','lab-smoke-01','lab-gas-01','lab-hum-01','lab-motion-01','lab-gas-02'][index]
      : `dev-${String(deviceCounter++).padStart(3,'0')}`;
    const value = id === 'chem-lab-201' ? [28.4,125,320,68,4,284][index] : undefined;
    const deviceStatus: Device['status'] = status === 'Offline' ? 'Offline' : status === 'Critical' && ['Smoke','Gas'].includes(deviceType) ? 'Critical' : status === 'Warning' && deviceType === 'Temperature' ? 'Warning' : 'Online';
    return makeDevice(deviceId, id, deviceType, deviceStatus, value);
  });
  return { id, floorId, buildingId, name, roomNumber, type, status, sensitivity, thresholds: threshold(type), polygon: points.map(([x,y]) => ({x,y})), devices };
}

const genericNames = ['Reception','Open Office','Meeting Room','Control Room','Training Room','Kitchen','Archive','Operations'];
function makeGenericFloor(buildingId: string, level: number, index: number): Floor {
  const floorId = `${buildingId}-f${level}`;
  const spaces = genericNames.slice(0, level % 3 + 5).map((name, room) => makeSpace([
    `${floorId}-s${room+1}`, name, `${level}0${room+1}`, room === 0 ? 'Reception' : room === 2 ? 'MeetingRoom' : 'Office',
    (index + room) % 11 === 0 ? 'Warning' : 'Normal', 'Normal', [[0,0],[1,0],[1,1],[0,1]]
  ], buildingId, floorId));
  return { id: floorId, buildingId, name: `Floor ${level}`, level, spaces, status: spaces.some(space => space.status === 'Warning') ? 'Warning' : 'Normal' };
}

const scienceF2Spaces = scienceF2Specs.map(spec => makeSpace(spec, 'science', 'science-f2'));
const scienceFloors: Floor[] = [1,2,3,4].map((level, index) => level === 2
  ? { id: 'science-f2', buildingId: 'science', name: 'Floor 2', level: 2, spaces: scienceF2Spaces, status: 'Critical' }
  : makeGenericFloor('science', level, index));
const mainFloors = [1,2,3].map((level, index) => makeGenericFloor('main', level, index + 4));
const researchFloors: Floor[] = [1, 2].map((level, index) => {
  const floor = makeGenericFloor('research', level, index + 7);

  return {
    ...floor,
    status: 'Normal',
    spaces: floor.spaces.map(space => ({
      ...space,
      status: 'Normal',
      devices: space.devices.map(device => ({
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

export const FLOORS: Floor[] = BUILDINGS.flatMap(building => building.floors);
export const SPACES: Space[] = FLOORS.flatMap(floor => floor.spaces);
const baseDevices = SPACES.flatMap(space => space.devices);
export const DEVICES: Device[] = [...baseDevices, ...Array.from({ length: Math.max(0, 142 - baseDevices.length) }, (_, index) => {
  const space = SPACES[index % SPACES.length];
  const type = (['Temperature','Smoke','Gas','Humidity','Motion'] as Device['type'][])[index % 5];
  const status: Device['status'] = index < 6 ? 'Critical' : index < 18 ? 'Warning' : index < 24 ? 'Offline' : 'Online';
  return makeDevice(`aux-${String(index+1).padStart(3,'0')}`, space.id, type, status);
})];

const alertTitles = ['High gas level detected','Temperature above threshold','Smoke detected','Device offline','Humidity outside safe range','Unexpected motion detected'];
export const ALERTS: Alert[] = Array.from({ length: 56 }, (_, index) => {
  const space = index < 3 ? scienceF2Spaces[[0,3,5][index]] : SPACES[index % SPACES.length];
  const severity: Alert['severity'] = index % 5 === 0 || index < 3 ? 'Critical' : index % 3 === 0 ? 'Info' : 'Warning';
  return { id: `alert-${index+1}`, buildingId: space.buildingId, floorId: space.floorId, spaceId: space.id, deviceId: space.devices[0]?.id,
    severity, title: alertTitles[index % alertTitles.length], description: `A ${severity.toLowerCase()} condition was reported by the monitoring system.`,
    timestamp: ago(index === 0 ? 2 : index * 7 + 1), status: index < 12 ? 'New' : index < 25 ? 'Acknowledged' : 'Resolved' };
});

export const INCIDENTS: Incident[] = Array.from({ length: 18 }, (_, index) => {
  const alert = ALERTS[index];
  return { id: `INC-${String(index+1001)}`, alertIds: [alert.id], buildingId: alert.buildingId, floorId: alert.floorId, spaceId: alert.spaceId,
    title: index % 3 === 0 ? 'Air quality investigation' : index % 3 === 1 ? 'Sensor anomaly review' : 'Safety threshold response',
    description: 'Facilities team response and investigation record.', severity: alert.severity,
    status: index < 4 ? 'Open' : index < 8 ? 'InProgress' : 'Resolved', createdAt: ago(index * 90 + 30), resolvedAt: index >= 8 ? ago(index * 60) : undefined };
});

export const DEMO_USER = { id: 'user-1', name: 'John Doe', email: 'admin@resq.io', initials: 'JD' };
