import { Injectable } from '@angular/core';
import { Device, MetricThreshold, RiskStatus, Space, riskRank } from '../models/resq.models';

@Injectable({ providedIn: 'root' })
export class RiskEvaluationService {
  evaluateMetric(value: number, threshold?: MetricThreshold): RiskStatus {
    if (!threshold) return 'Normal';
    if (value >= threshold.critical) return 'Critical';
    if (value >= threshold.warning) return 'Warning';
    return 'Normal';
  }
  evaluateDevice(device: Device, space: Space): RiskStatus {
    if (device.status === 'Offline') return 'Offline';
    const last = device.readings.at(-1);
    return last ? this.evaluateMetric(last.value, space.thresholds[last.metric]) : 'Offline';
  }
  evaluateSpace(space: Space): RiskStatus {
    if (space.devices.length > 0 && space.devices.every(device => device.status === 'Offline')) return 'Offline';
    return space.devices.map(device => this.evaluateDevice(device, space)).reduce((highest, current) => riskRank[current] > riskRank[highest] ? current : highest, 'Normal' as RiskStatus);
  }
  getRiskStatus(space: Space): RiskStatus { return this.evaluateSpace(space); }
}
