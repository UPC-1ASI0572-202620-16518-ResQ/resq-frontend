import { Injectable } from '@angular/core';
import {
  Alert,
  DetectionEvidence,
  Incident,
  MeasurementRiskLevel,
  RiskDetectionSummary,
  RiskTypeCode,
} from '../../core/models/resq.models';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { RiskEventStoreService } from '../../core/services/risk-event-store.service';
import { RiskDetectionFacade } from './data-access/risk-detection.facade';

export interface RiskSimulationResult {
  classification: MeasurementRiskLevel;
  message: string;
  alertId?: string;
  incidentId?: string;
}

/**
 * Mock event ingress for the demo. It models the boundary that a future live
 * telemetry adapter will call after receiving a measurement.
 */
@Injectable({ providedIn: 'root' })
export class RiskDetectionSimulationService {
  constructor(
    private readonly buildings: BuildingStoreService,
    private readonly events: RiskEventStoreService,
    private readonly riskDetection: RiskDetectionFacade,
  ) {}

  simulateMeasurement(deviceId: string, value: number): RiskSimulationResult | undefined {
    const device = this.buildings.devices().find((item) => item.id === deviceId);
    const space = this.buildings.spaces().find((item) => item.id === device?.spaceId);
    if (!device || !space) return undefined;

    const thresholds = space.thresholds[device.type];
    if (!thresholds) return undefined;

    const classification = this.riskDetection.classifyMeasurement(value, thresholds);
    const measuredAt = new Date();
    const updatedDevice = this.buildings.updateLatestReading(device.id, value, measuredAt);
    if (!updatedDevice) return undefined;

    const capability = updatedDevice.capabilities.find((item) => item.kind === 'MEASUREMENT');
    const unit = updatedDevice.readings.at(-1)?.unit ?? capability?.unit ?? '';
    const evidence: DetectionEvidence = {
      deviceId: updatedDevice.id,
      capabilityCode: capability?.code ?? `${updatedDevice.type.toLowerCase()}_measurement`,
      metric: updatedDevice.type,
      measurementName: capability?.name ?? `${updatedDevice.type} measurement`,
      value,
      unit,
      warningThreshold: thresholds.warning,
      criticalThreshold: thresholds.critical,
      capturedAt: measuredAt,
    };
    const metricLabel = capability?.name ?? updatedDevice.type;

    if (classification === 'Normal') {
      return {
        classification,
        message: `Normal: ${metricLabel} is below the warning threshold.`,
      };
    }

    const suffix = createLocalId();
    const riskTypeCode = riskTypeFor(updatedDevice.type);
    const riskDetectionId = `RISK-${classification.toUpperCase()}-${suffix}`;
    const detection: RiskDetectionSummary = {
      riskDetectionId,
      ruleId: `rule-${updatedDevice.type.toLowerCase()}-${classification.toLowerCase()}`,
      riskTypeCode,
      severityCode: classification,
      detectedAt: measuredAt,
      evidence: [evidence],
    };

    if (classification === 'Warning') {
      const alertId = `alert-warning-${suffix}`;
      const alert: Alert = {
        alertId,
        organizationId: updatedDevice.organizationId,
        context: {
          riskDetectionId,
          riskTypeCode,
          severityCode: 'Warning',
          buildingId: space.buildingId,
          zoneId: space.id,
          detectedAt: measuredAt,
        },
        generatedAt: measuredAt,
        deliveries: [
          {
            deliveryId: `delivery-${suffix}`,
            recipientUserId: 'user-1',
            channel: 'PUSH',
            destination: 'in-app-notification',
            status: 'DELIVERED',
            requestedAt: measuredAt,
            completedAt: measuredAt,
          },
        ],
      };
      this.events.recordWarning(detection, alert);
      return {
        classification,
        alertId,
        message: `Warning: ${metricLabel} exceeded the warning threshold.`,
      };
    }

    const incidentId = `INC-CRITICAL-${suffix}`;
    const incident: Incident = {
      id: incidentId,
      riskDetectionId,
      riskTypeCode,
      evidence,
      buildingId: space.buildingId,
      floorId: space.floorId,
      spaceId: space.id,
      title: riskTypeCode === 'GAS_LEAK' ? 'Gas leak response' : 'Fire risk response',
      description: 'Critical threshold exceeded. Operational follow-up is required.',
      severity: 'Critical',
      status: 'Open',
      createdAt: measuredAt,
    };
    this.events.recordCritical(detection, incident);
    return {
      classification,
      incidentId,
      message: `Critical incident: ${metricLabel} exceeded the critical threshold.`,
    };
  }
}

function riskTypeFor(metric: string): RiskTypeCode {
  return metric === 'Gas' ? 'GAS_LEAK' : 'FIRE';
}

function createLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}
