export type RiskStatus = 'Normal' | 'Warning' | 'Critical' | 'Offline';
export type MeasurementRiskLevel = Exclude<RiskStatus, 'Offline'>;
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
export type DeviceType = 'Temperature' | 'Smoke' | 'Gas' | 'Humidity' | 'Motion';
export type DeviceStatus = 'Online' | 'Warning' | 'Critical' | 'Offline';
export type SensorMetric = DeviceType;
export type DeviceAdministrativeStatus = 'INACTIVE' | 'ACTIVE' | 'RETIRED';
export type DeviceConnectivityStatus = 'ONLINE' | 'OFFLINE';
export type DeviceHealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';
export type CapabilityKind = 'MEASUREMENT' | 'ACTUATION';
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';
export type AlertStatus = 'ACTIVE' | 'CLEARED';
export type AlertClearReason = 'RETURNED_TO_NORMAL' | 'CRITICAL_THRESHOLD_REACHED';
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

export interface FloorPlanPoint { x: number; y: number; }
export interface FloorPlanPosition { x: number; y: number; }
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
export interface MetricThreshold { warning: number; critical: number; }
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
  status: AlertStatus;
  clearedAt?: Date;
  clearReason?: AlertClearReason;
  deliveries: NotificationDelivery[];
}
export interface DetectionEvidence {
  deviceId: string;
  capabilityCode: string;
  metric: SensorMetric;
  measurementName: string;
  value: number;
  unit: string;
  warningThreshold: number;
  criticalThreshold: number;
  capturedAt: Date;
}
export interface RiskDetectionSummary {
  riskDetectionId: string;
  ruleId: string;
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
  executionRequestedAt?: Date;
  authorization?: {
    authorizationId: string;
    decision: 'APPROVED' | 'REJECTED';
    decidedByUserId: string;
    decidedAt: Date;
  };
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
  /** @deprecated Compatibility only. Alerts do not originate or own Incidents. */
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
  riskDetectionId: string;
  riskTypeCode: RiskTypeCode;
  evidence: DetectionEvidence;
  currentEvidence: DetectionEvidence;
  /**
   * @deprecated Compatibility only. Incidents are not created from Alerts and
   * this field must never be used to derive Incident data.
   */
  alertIds?: string[];
  buildingId: string;
  floorId: string;
  spaceId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  assignedTo?: string;
  assignedAt?: Date;
  safeAt?: Date;
  resolutionNotes?: string;
  resolvedBy?: string;
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
