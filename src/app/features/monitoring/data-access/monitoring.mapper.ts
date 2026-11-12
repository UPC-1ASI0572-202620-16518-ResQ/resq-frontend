import {
  BuildingMonitoringStatus,
  DeviceAvailability,
  DeviceMonitoringState,
  MonitoringMeasurement,
  ZoneMonitoringState,
} from './monitoring.gateway';
import {
  BuildingMonitoringStatusResourceDto,
  DeviceMonitoringStateResourceDto,
  MonitoringMeasurementResourceDto,
  ZoneMonitoringStateResourceDto,
} from './monitoring.dto';

export function mapMonitoringMeasurement(dto: MonitoringMeasurementResourceDto): MonitoringMeasurement {
  return {
    ...dto,
    zoneId: dto.zoneId ?? undefined,
    measurementValue: { ...dto.measurementValue },
    measuredAt: new Date(dto.measuredAt),
    recordedAt: new Date(dto.recordedAt),
  };
}

export function mapDeviceMonitoringState(dto: DeviceMonitoringStateResourceDto): DeviceMonitoringState {
  return {
    deviceId: dto.deviceId,
    zoneId: dto.zoneId ?? undefined,
    availability: dto.availability.toUpperCase() as DeviceAvailability,
    lastMeasurementAt: dto.lastMeasurementAt ? new Date(dto.lastMeasurementAt) : undefined,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapZoneMonitoringState(dto: ZoneMonitoringStateResourceDto): ZoneMonitoringState {
  return {
    ...dto,
    activeRiskId: dto.activeRiskId ?? undefined,
    lastUpdatedAt: new Date(dto.lastUpdatedAt),
  };
}

export function mapBuildingMonitoringStatus(
  dto: BuildingMonitoringStatusResourceDto,
): BuildingMonitoringStatus {
  return {
    ...dto,
    lastUpdatedAt: new Date(dto.lastUpdatedAt),
    zones: dto.zones.map(mapZoneMonitoringState),
  };
}
