export type RiskStatus = 'Normal' | 'Warning' | 'Critical' | 'Offline';
export type SensitivityLevel = 'Low' | 'Normal' | 'High' | 'Custom';
export type SpaceType = 'Laboratory' | 'Classroom' | 'Office' | 'ServerRoom' | 'Storage' | 'Kitchen' | 'Hallway' | 'MeetingRoom' | 'ControlRoom' | 'Reception' | 'Other';
export type DeviceType = 'Temperature' | 'Smoke' | 'Gas' | 'Humidity' | 'Motion';
export type DeviceStatus = 'Online' | 'Warning' | 'Critical' | 'Offline';
export type SensorMetric = DeviceType;
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';
export type AlertStatus = 'New' | 'Acknowledged' | 'Resolved';
export type IncidentStatus = 'Open' | 'InProgress' | 'Resolved';

export interface FloorPlanPoint { x: number; y: number; }
export interface MetricThreshold { warning: number; critical: number; }
export interface SpaceThresholds {
  Temperature?: MetricThreshold;
  Smoke?: MetricThreshold;
  Gas?: MetricThreshold;
  Humidity?: MetricThreshold;
  Motion?: MetricThreshold;
}
export interface SensorReading { id: string; deviceId: string; metric: SensorMetric; value: number; unit: string; timestamp: Date; }
export interface Device {
  id: string; spaceId: string; name: string; code: string; type: DeviceType; status: DeviceStatus;
  lastSeen: Date; readings: SensorReading[]; firmware: string; battery: number; signal: number;
}
export interface Space {
  id: string; floorId: string; buildingId: string; name: string; roomNumber?: string; type: SpaceType;
  sensitivity: SensitivityLevel; status: RiskStatus; thresholds: SpaceThresholds; polygon: FloorPlanPoint[]; devices: Device[];
}
export interface Floor { id: string; buildingId: string; name: string; level: number; spaces: Space[]; status: RiskStatus; }
export interface Building { id: string; name: string; address: string; description?: string; floors: Floor[]; status: RiskStatus; }
export interface Alert {
  id: string; buildingId: string; floorId: string; spaceId: string; deviceId?: string; severity: AlertSeverity;
  title: string; description: string; timestamp: Date; status: AlertStatus;
}
export interface Incident {
  id: string; alertIds: string[]; buildingId: string; floorId: string; spaceId: string; title: string;
  description: string; severity: AlertSeverity; status: IncidentStatus; createdAt: Date; resolvedAt?: Date;
}
export interface SearchResult { id: string; type: 'Building' | 'Space' | 'Device'; title: string; subtitle: string; route: string; }
export interface User { id: string; name: string; email: string; initials: string; }

export const riskRank: Record<RiskStatus, number> = { Offline: 0, Normal: 1, Warning: 2, Critical: 3 };
export const statusLabel = (status: string): string => status === 'InProgress' ? 'In Progress' : status;
