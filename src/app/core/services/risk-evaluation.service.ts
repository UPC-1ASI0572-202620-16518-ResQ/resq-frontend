import { Injectable } from '@angular/core';
import { Device, MetricThreshold, RiskStatus, Space, riskRank } from '../models/resq.models';
import { sensorThreshold, capabilityCategory } from '../models/device-domain';

@Injectable({ providedIn: 'root' })
export class RiskEvaluationService {
  evaluateMetric(value: number, threshold?: MetricThreshold): RiskStatus {
    if (!threshold) return 'Normal';
    if (value >= threshold.critical) return 'Critical';
    if (value >= threshold.warning) return 'Warning';
    return 'Normal';
  }
  evaluateDevice(device: Device, space: Space): RiskStatus {
    if (device.connectivityStatus === 'OFFLINE') return 'Offline';
    if (!device.capabilities.some((cap) => capabilityCategory(cap) === 'SENSOR')) return 'Normal';
    const last = device.readings.at(-1);
    return last ? this.evaluateMetric(last.value, sensorThreshold(device, space)) : 'Normal';
  }
  evaluateSpace(space: Space): RiskStatus {
    const sensors = space.devices.filter((device) =>
      device.capabilities.some((cap) => capabilityCategory(cap) === 'SENSOR'),
    );
    if (sensors.length > 0 && sensors.every((device) => device.connectivityStatus === 'OFFLINE'))
      return 'Offline';
    return sensors
      .map((device) => this.evaluateDevice(device, space))
      .reduce(
        (highest, current) => (riskRank[current] > riskRank[highest] ? current : highest),
        'Normal' as RiskStatus,
      );
  }
  getRiskStatus(space: Space): RiskStatus {
    return this.evaluateSpace(space);
  }
}
