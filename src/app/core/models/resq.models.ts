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
  | 'Stairs'
  | 'Restroom'
  | 'MeetingRoom'
  | 'ControlRoom'
  | 'Reception'
  | 'Other';
export type SensorType = 'Temperature' | 'Smoke' | 'Gas' | 'Humidity' | 'Motion';
export type ActuatorType = 'HVAC' | 'AudibleAlarm' | 'VisualSignal' | 'Servomotor';
export type DisplayType = 'OLED';
export type DeviceType = SensorType | ActuatorType | DisplayType;
export type DeviceStatus = 'Online' | 'Warning' | 'Critical' | 'Offline';
export type SensorMetric = SensorType;
export type DeviceAdministrativeStatus = 'INACTIVE' | 'ACTIVE' | 'RETIRED';
export type DeviceConnectivityStatus = 'ONLINE' | 'OFFLINE';
export type DeviceHealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';
export type CapabilityKind = 'MEASUREMENT' | 'ACTUATION';
/** Semantic category used to keep sensing, response and local display separate. */
export type DeviceCapabilityCategory = 'SENSOR' | 'ACTUATOR' | 'DISPLAY';
export type ActuatorState =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'OPEN'
  | 'CLOSED'
  | 'MOVING'
  | 'ERROR'
  | 'NORMAL'
  | 'WARNING'
  | 'ALERT'
  | 'PLANNED';
export type HardwareAvailability = 'MVP' | 'PLANNED' | 'SIMULATED';
export interface DeviceCatalogEntry {
  type: DeviceType;
  category: DeviceCapabilityCategory;
  label: string;
  icon: string;
  unit?: string;
  capabilityCode: string;
  hardware: string;
}
export const DEVICE_CATALOG: DeviceCatalogEntry[] = [
  {
    type: 'Temperature',
    category: 'SENSOR',
    label: 'Temperature',
    icon: 'thermostat',
    unit: '°C',
    capabilityCode: 'temperature_measurement',
    hardware: 'Temperature sensing module',
  },
  {
    type: 'Smoke',
    category: 'SENSOR',
    label: 'Smoke',
    icon: 'cloud',
    unit: 'ppm',
    capabilityCode: 'smoke_measurement',
    hardware: 'MQ-2',
  },
  {
    type: 'Gas',
    category: 'SENSOR',
    label: 'Gas',
    icon: 'air',
    unit: 'ppm',
    capabilityCode: 'gas_measurement',
    hardware: 'MQ-2',
  },
  {
    type: 'Humidity',
    category: 'SENSOR',
    label: 'Humidity',
    icon: 'water_drop',
    unit: '%',
    capabilityCode: 'humidity_measurement',
    hardware: 'Humidity sensing module',
  },
  {
    type: 'Motion',
    category: 'SENSOR',
    label: 'Human motion',
    icon: 'directions_run',
    unit: 'events',
    capabilityCode: 'motion_measurement',
    hardware: 'Motion sensing module',
  },
  {
    type: 'HVAC',
    category: 'ACTUATOR',
    label: 'Ventilation / HVAC',
    icon: 'air',
    capabilityCode: 'environmental_ventilation',
    hardware: 'Planned capability · not installed in MVP',
  },
  {
    type: 'AudibleAlarm',
    category: 'ACTUATOR',
    label: 'Audible alarm',
    icon: 'notifications_active',
    capabilityCode: 'audible_alarm',
    hardware: 'Active buzzer 5 V',
  },
  {
    type: 'VisualSignal',
    category: 'ACTUATOR',
    label: 'Visual signaling',
    icon: 'lightbulb',
    capabilityCode: 'visual_status_signaling',
    hardware: 'Red LED + Green LED',
  },
  {
    type: 'Servomotor',
    category: 'ACTUATOR',
    label: 'Servomotor',
    icon: 'settings',
    capabilityCode: 'mechanical_servo',
    hardware: 'Planned capability · not installed in MVP',
  },
  {
    type: 'OLED',
    category: 'DISPLAY',
    label: 'OLED display',
    icon: 'display_settings',
    capabilityCode: 'local_status_display',
    hardware: 'SSD1306 OLED',
  },
];
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';
export type RiskTypeCode = 'GAS_LEAK' | 'FIRE';
export type NotificationDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';
export type NotificationChannel = 'PUSH';
export type AuthorizationMode = 'AUTOMATIC' | 'HUMAN_REQUIRED';
export type ResponseExecutionStatus =
  | 'PENDING'
  | 'PENDING_AUTHORIZATION'
  | 'AUTHORIZED'
  | 'EXECUTION_REQUESTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED';
export type IncidentStatus = 'Open' | 'InProgress' | 'Resolved';

export interface FloorPlanPoint {
  x: number;
  y: number;
}
export interface FloorPlanPosition {
  x: number;
  y: number;
}
export type FloorPlanElementType = 'Space' | 'Hallway' | 'Stairs' | 'Restroom' | 'Wall' | 'Door';
export interface FloorPlanElement {
  id: string;
  type: FloorPlanElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  label?: string;
  spaceId?: string;
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
  category?: DeviceCapabilityCategory;
  hardware: string;
  unit?: string;
  description?: string;
  state?: ActuatorState;
}

export interface ResponseRule {
  id: string;
  sensor: SensorType;
  operator?: '>' | '<' | '>=' | '<=' | '=';
  threshold?: number;
  actuatorCapabilities: string[];
  condition: string;
  enabled: boolean;
  /** A configured sensor rule overrides the default template for that sensor. */
  sourceDeviceId?: string;
  targets?: ResponseTarget[];
}
export type ResponseAction = 'ACTIVATE' | 'OPEN' | 'CLOSE';
export interface ResponseTarget {
  deviceId: string;
  capabilityCode: string;
  action: ResponseAction;
}
export interface ResponseEvent {
  id: string;
  sensor: SensorType;
  value: number;
  unit: string;
  risk: RiskStatus;
  message: string;
  createdAt: Date;
  deviceId: string;
  spaceId: string;
  ruleIds: string[];
  targets: ResponseTarget[];
  simulated: boolean;
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

  /**
   * Technical/system name.
   */
  name: string;

  /**
   * Friendly name assigned by the user.
   */
  displayName?: string;

  description: string;

  specifications: DeviceSpecifications;

  assignment: DeviceAssignment;

  externalReference?: string;
  externalReferenceDetails?: { sourceSystem: string; externalDeviceId: string };

  administrativeStatus: DeviceAdministrativeStatus;

  connectivityStatus: DeviceConnectivityStatus;

  healthStatus: DeviceHealthStatus;

  capabilities: DeviceCapability[];

  power: DevicePowerInfo;

  signalStrength?: number;

  lastSeen: Date;

  readings: SensorReading[];
  /** Optional override, in the measurement unit (e.g. raw MQ-2 ADC). */
  sensorThreshold?: MetricThreshold;
  availability?: HardwareAvailability;

  hardwareImageUrl?: string;

  hardwareComponents: DeviceHardwareComponent[];

  assemblyComponents?: string[];

  maintenance?: DeviceMaintenanceInfo;

  createdAt: Date;

  updatedAt: Date;

  version: number;

  /**
   * Compatibility fields currently used by
   * monitoring / spaces / buildings views.
   */
  spaceId: string;

  code: string;

  type: DeviceType;

  status: DeviceStatus;

  firmware: string;

  battery?: number;

  signal: number;

  /**
   * Position inside the floor plan editor.
   */
  floorPlanPosition?: FloorPlanPosition;
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
  /** Threshold values saved independently for each sensitivity preset. */
  thresholdProfiles?: Partial<Record<SensitivityLevel, SpaceThresholds>>;
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
  planImageUrl?: string;
  planElements?: FloorPlanElement[];
  planConfigured?: boolean;
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
export interface AlertContext {
  riskDetectionId: string;
  riskTypeCode: RiskTypeCode;
  severityCode: AlertSeverity;
  buildingId?: string;
  zoneId?: string;
  detectedAt: Date;
}
export interface NotificationDelivery {
  deliveryId: string;
  recipientUserId: string;
  channel: NotificationChannel;
  destination: string;
  status: NotificationDeliveryStatus;
  requestedAt: Date;
  completedAt?: Date;
  failureReason?: string;
}
export interface Alert {
  alertId: string;
  organizationId: string;
  context: AlertContext;
  generatedAt: Date;
  deliveries: NotificationDelivery[];
}
export interface DetectionEvidence {
  deviceId: string;
  capabilityCode: string;
  measurementName: string;
  value: number;
  unit: string;
  capturedAt: Date;
}
export interface RiskDetectionSummary {
  riskDetectionId: string;
  riskTypeCode: RiskTypeCode;
  severityCode: AlertSeverity;
  detectedAt: Date;
  evidence: DetectionEvidence[];
}
export interface ResponseActionSnapshot {
  actionId: string;
  actionCode: string;
  actionName: string;
  targetDeviceId: string;
  targetCapabilityCode: string;
  authorizationMode: AuthorizationMode;
  critical: boolean;
}
export interface ExecutionResult {
  successful: boolean;
  resultCode: string;
  message?: string;
  completedAt: Date;
}
export interface ResponseExecution {
  responseExecutionId: string;
  organizationId: string;
  riskDetectionId: string;
  policyId: string;
  action: ResponseActionSnapshot;
  status: ResponseExecutionStatus;
  requestedAt: Date;
  result?: ExecutionResult;
}
export interface AlertLocationViewModel {
  buildingId?: string;
  buildingName: string;
  floorId?: string;
  floorName: string;
  zoneId?: string;
  zoneName: string;
  roomNumber?: string;
  available: boolean;
}
export interface AlertDetectionEvidenceViewModel extends DetectionEvidence {
  deviceName: string;
  deviceCode: string;
  hardware: string;
}
export interface NotificationDeliverySummary {
  status: NotificationDeliveryStatus;
  delivered: number;
  pending: number;
  failed: number;
  label: string;
}
export interface RelatedIncidentViewModel {
  id: string;
  title: string;
  severity: AlertSeverity;
  status: IncidentStatus;
}
export interface AlertListItem {
  id: string;
  title: string;
  description: string;
  riskDetectionId: string;
  riskTypeCode: RiskTypeCode;
  riskTypeLabel: string;
  severity: AlertSeverity;
  detectedAt: Date;
  generatedAt: Date;
  location: AlertLocationViewModel;
  primaryEvidence?: AlertDetectionEvidenceViewModel;
  delivery: NotificationDeliverySummary;
  relatedIncident?: RelatedIncidentViewModel;
}
export interface ResponseExecutionViewModel extends ResponseExecution {
  targetDeviceName: string;
  targetDeviceCode: string;
}
export interface AlertDetailViewModel extends AlertListItem {
  alert: Alert;
  evidence: AlertDetectionEvidenceViewModel[];
  responseExecutions: ResponseExecutionViewModel[];
}
export type AlertPeriod = '24h' | '7d' | '30d' | 'all';
export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  notificationFailures: number;
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
