export interface MeasurementValueResourceDto {
  value: number;
  unit: string;
}

export interface MonitoringMeasurementResourceDto {
  measurementId: string;
  deviceId: string;
  buildingId: string;
  zoneId?: string | null;
  variableType: string;
  measurementValue: MeasurementValueResourceDto;
  measuredAt: string;
  recordedAt: string;
}

export interface DeviceMonitoringStateResourceDto {
  deviceId: string;
  zoneId?: string | null;
  availability: string;
  lastMeasurementAt?: string | null;
  updatedAt: string;
}

export interface ZoneMonitoringStateResourceDto {
  zoneId: string;
  buildingId: string;
  lastUpdatedAt: string;
  activeRiskId?: string | null;
  conditionCode: string;
}

export interface BuildingMonitoringStatusResourceDto {
  buildingId: string;
  lastUpdatedAt: string;
  zones: ZoneMonitoringStateResourceDto[];
  availableDevices: number;
  unavailableDevices: number;
  unknownDevices: number;
}
