import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';
import { ComparisonOperator, DetectionRuleRecord } from '../../risk-detection/data-access/risk-detection.gateway';

export type DeviceAvailability =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export interface MeasurementValue {
  value: number;
  unit: string;
}

export interface MonitoringMeasurement {
  measurementId: string;

  deviceId: string;

  buildingId: string;

  zoneId?: string;

  variableType: string;

  measurementValue:
    MeasurementValue;

  measuredAt: Date;

  recordedAt: Date;
}

export interface DeviceMonitoringState {
  deviceId: string;

  zoneId?: string;

  availability:
    DeviceAvailability;

  lastMeasurementAt?:
    Date;

  updatedAt:
    Date;
}

export interface ZoneMonitoringState {
  zoneId: string;

  buildingId: string;

  lastUpdatedAt:
    Date;

  activeRiskId?: string;

  conditionCode:
    string;
}

export interface BuildingMonitoringStatus {
  buildingId: string;

  lastUpdatedAt:
    Date;

  zones:
    ZoneMonitoringState[];

  availableDevices:
    number;

  unavailableDevices:
    number;

  unknownDevices:
    number;
}

export interface CurrentMeasurementsQuery {
  deviceId?: string;

  zoneId?: string;
}

export interface MeasurementTimeRange {
  from: Date;

  to: Date;
}

export interface ZoneMonitoringProfile {
  zoneId: string;
  source: 'ZONE_OVERRIDE' | 'GLOBAL_FALLBACK';
  rules: DetectionRuleRecord[];
}

export interface ZoneMonitoringRuleInput {
  riskTypeCode: string;
  severityCode: string;
  variableType: string;
  operator: ComparisonOperator;
  threshold: number;
}

export interface MonitoringGateway {

  getBuildingStatus(
    buildingId: string,
  ):
    Observable<
      BuildingMonitoringStatus
      | undefined
    >;

  getZoneStatus(
    zoneId: string,
  ):
    Observable<
      ZoneMonitoringState
      | undefined
    >;

  getDeviceStatus(
    deviceId: string,
  ):
    Observable<
      DeviceMonitoringState
      | undefined
    >;

  getCurrentMeasurements(
    query:
      CurrentMeasurementsQuery,
  ):
    Observable<
      MonitoringMeasurement[]
    >;

  getDeviceMeasurements(
    deviceId: string,

    range?:
      MeasurementTimeRange,
  ):
    Observable<
      MonitoringMeasurement[]
    >;

  getZoneProfile(zoneId: string): Observable<ZoneMonitoringProfile>;

  saveZoneProfile(zoneId: string, rules: ZoneMonitoringRuleInput[]): Observable<ZoneMonitoringProfile>;
}

export const MONITORING_GATEWAY =
  new InjectionToken<MonitoringGateway>(
    'MONITORING_GATEWAY',
  );
