export type RiskStatus = 'Normal' | 'Warning' | 'Critical' | 'Offline';
export type SensitivityLevel = 'Low' | 'Normal' | 'High' | 'Custom';
export type SpaceType =
  | 'Laboratory'
  | 'Classroom'
  | 'Office'
  | 'ServerRoom'
  | 'Storage'
  | 'Kitchen'
  | 'Hallway'
  | 'MeetingRoom'
  | 'ControlRoom'
  | 'Reception'
  | 'Other';
export type DeviceType = 'Temperature' | 'Smoke' | 'Gas' | 'Humidity' | 'Motion';
export type DeviceStatus = 'Online' | 'Warning' | 'Critical' | 'Offline';
export type SensorMetric = DeviceType;
export type DeviceAdministrativeStatus = 'INACTIVE' | 'ACTIVE' | 'RETIRED';
export type DeviceConnectivityStatus = 'ONLINE' | 'OFFLINE';
export type DeviceHealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';
export type CapabilityKind = 'MEASUREMENT' | 'ACTUATION';
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';
export type AlertStatus = 'New' | 'Acknowledged' | 'Resolved';
export type IncidentStatus = 'Open' | 'InProgress' | 'Resolved';

export interface FloorPlanPoint {
  x: number;
  y: number;
}
export interface MetricThreshold {
  warning: number;
  critical: number;
}
export interface SpaceThresholds {
  Temperature?: MetricThreshold;
  Smoke?: MetricThreshold;
  Gas?: MetricThreshold;
  Humidity?: MetricThreshold;
  Motion?: MetricThreshold;
}
export interface SensorReading {
  id: string;
  deviceId: string;
  metric: SensorMetric;
  value: number;
  unit: string;
  timestamp: Date;
}
export interface DeviceCapability {
  id: string;
  code: string;
  name: string;
  kind: CapabilityKind;
  hardware: string;
  unit?: string;
  description?: string;
}
export interface DeviceSpecifications {
  manufacturer: string;
  model: string;
  serialNumber: string;
  controller?: string;
  board?: string;
  firmware: string;
  protocol: string;
  samplingIntervalSeconds: number;
  edgeIntegration?: string;
}
export interface DeviceAssignment {
  buildingId: string;
  floorId: string;
  zoneId: string;
  spaceId: string;
}
export interface DevicePowerInfo {
  source: string;
  status: 'POWERED' | 'ON_BATTERY' | 'UNPOWERED';
  batteryPercentage?: number;
}
export interface DeviceHardwareComponent {
  name: string;
  role: string;
  imageUrl?: string;
}
export interface DeviceMaintenanceInfo {
  calibrationStatus?:
    'NOT_REQUIRED' | 'PENDING_CALIBRATION' | 'CALIBRATION_REQUIRED' | 'CALIBRATED';
  calibrationNote?: string;
  lastInspection?: Date;
  nextInspection?: Date;
}
export interface DeviceStatusSummary {
  total: number;
  online: number;
  warningDegraded: number;
  offline: number;
}
export interface Device {
  id: string;
  organizationId: string;
  deviceCode: string;
  name: string;
  description: string;
  specifications: DeviceSpecifications;
  assignment: DeviceAssignment;
  externalReference?: string;
  administrativeStatus: DeviceAdministrativeStatus;
  connectivityStatus: DeviceConnectivityStatus;
  healthStatus: DeviceHealthStatus;
  capabilities: DeviceCapability[];
  power: DevicePowerInfo;
  signalStrength?: number;
  lastSeen: Date;
  readings: SensorReading[];
  hardwareImageUrl?: string;
  hardwareComponents: DeviceHardwareComponent[];
  assemblyComponents?: string[];
  maintenance?: DeviceMaintenanceInfo;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  /** Temporary compatibility fields for the existing monitoring, spaces and alerts views. */
  spaceId: string;
  code: string;
  type: DeviceType;
  status: DeviceStatus;
  firmware: string;
  battery?: number;
  signal: number;
}
export interface Space {
  id: string;
  floorId: string;
  buildingId: string;
  name: string;
  roomNumber?: string;
  type: SpaceType;
  sensitivity: SensitivityLevel;
  status: RiskStatus;
  thresholds: SpaceThresholds;
  polygon: FloorPlanPoint[];
  devices: Device[];
}
export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  level: number;
  spaces: Space[];
  status: RiskStatus;
}
export interface Building {
  id: string;
  name: string;
  address: string;
  description?: string;
  imageUrl?: string;
  floors: Floor[];
  status: RiskStatus;
}
export interface Alert {
  id: string;
  buildingId: string;
  floorId: string;
  spaceId: string;
  deviceId?: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: Date;
  status: AlertStatus;
}
export interface Incident {
  id: string;
  alertIds: string[];
  buildingId: string;
  floorId: string;
  spaceId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  createdAt: Date;
  resolvedAt?: Date;
}
export interface SearchResult {
  id: string;
  type: 'Building' | 'Space' | 'Device';
  title: string;
  subtitle: string;
  route: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export const riskRank: Record<RiskStatus, number> = {
  Offline: 0,
  Normal: 1,
  Warning: 2,
  Critical: 3,
};
export const statusLabel = (status: string): string =>
  status === 'InProgress' ? 'In Progress' : status;
