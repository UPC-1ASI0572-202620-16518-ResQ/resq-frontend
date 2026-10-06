import { Injectable } from '@angular/core';
import {
  Alert,
  DetectionEvidence,
  Incident,
  MeasurementRiskLevel,
  ResponseExecution,
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
  created: boolean;
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

    const riskTypeCode = riskTypeFor(updatedDevice.type);
    const correlation = {
      deviceId: updatedDevice.id,
      metric: updatedDevice.type,
      zoneId: space.id,
      riskTypeCode,
    };

    if (classification === 'Normal') {
      const cleared = this.events.clearActiveAlert(
        correlation,
        'RETURNED_TO_NORMAL',
        measuredAt,
      );
      const safeIncident = this.events.markIncidentSafe(correlation, evidence, measuredAt);
      if (cleared && updatedDevice.capabilities.some((item) => item.code === 'local_status_display')) {
        this.events.addResponseExecutions([
          automaticExecution(
            cleared.context.riskDetectionId,
            updatedDevice.id,
            'SHOW_NORMAL_STATUS',
            'Show Normal Status',
            measuredAt,
          ),
        ]);
      }
      return {
        classification,
        created: false,
        incidentId: safeIncident?.id,
        message: safeIncident
          ? `Normal: ${metricLabel} returned below the warning threshold. The Incident is safe to resolve but remains open.`
          : cleared
            ? `Normal: ${metricLabel} returned below the warning threshold. The active Alert was cleared.`
            : `Normal: ${metricLabel} is below the warning threshold. No Alert or Incident was created.`,
      };
    }

    const suffix = createLocalId();
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
      const operationalIncident = this.events.updateCurrentIncidentEvidence(correlation, evidence);
      if (operationalIncident) {
        return {
          classification,
          created: false,
          incidentId: operationalIncident.id,
          message: `Warning: ${metricLabel} is below critical but the existing Incident remains open until a safe reading is verified.`,
        };
      }

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
        status: 'ACTIVE',
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
      const result = this.events.upsertWarning(correlation, detection, alert);
      if (result.created) {
        this.events.addResponseExecutions([
          automaticExecution(
            riskDetectionId,
            updatedDevice.id,
            'SHOW_WARNING_STATUS',
            'Show Warning Status',
            measuredAt,
          ),
        ]);
      }
      return {
        classification,
        created: result.created,
        alertId: result.item.alertId,
        message: result.created
          ? `Warning: ${metricLabel} exceeded the warning threshold. A warning Alert was created and the local warning status was shown automatically.`
          : `Warning: ${metricLabel} remains above the warning threshold. The existing active Alert was updated.`,
      };
    }

    this.events.clearActiveAlert(correlation, 'CRITICAL_THRESHOLD_REACHED', measuredAt);
    const incidentId = `INC-CRITICAL-${suffix}`;
    const incident: Incident = {
      id: incidentId,
      riskDetectionId,
      riskTypeCode,
      evidence,
      currentEvidence: evidence,
      buildingId: space.buildingId,
      floorId: space.floorId,
      spaceId: space.id,
      title: riskTypeCode === 'GAS_LEAK' ? 'Gas leak response' : 'Fire risk response',
      description: 'Critical threshold exceeded. Operational follow-up is required.',
      severity: 'Critical',
      status: 'Open',
      createdAt: measuredAt,
    };
    const result = this.events.upsertCritical(correlation, detection, incident);
    if (result.created) {
      this.events.addResponseExecutions(
        criticalExecutions(updatedDevice, riskDetectionId, measuredAt),
      );
    }
    return {
      classification,
      created: result.created,
      incidentId: result.item.id,
      message: result.created
        ? `Critical incident: ${metricLabel} exceeded the critical threshold. An ACTIVE Incident was created with administrator authorization pending.`
        : `Critical incident update: ${metricLabel} remains above the critical threshold. The existing Incident evidence was updated.`,
    };
  }
}

function automaticExecution(
  riskDetectionId: string,
  deviceId: string,
  actionCode: string,
  actionName: string,
  now: Date,
): ResponseExecution {
  const suffix = createLocalId();
  return {
    responseExecutionId: `response-${suffix}`,
    organizationId: 'securitybear',
    riskDetectionId,
    policyId: 'policy-warning-local-status',
    action: {
      actionId: `action-${suffix}`,
      actionCode,
      actionName,
      targetDeviceId: deviceId,
      targetCapabilityCode: 'local_status_display',
      authorizationMode: 'AUTOMATIC',
      critical: false,
    },
    status: 'SUCCEEDED',
    requestedAt: now,
    executionRequestedAt: now,
    result: {
      successful: true,
      resultCode: 'ACTUATOR_CONFIRMED',
      message: `${actionName} completed automatically by SYSTEM.`,
      completedAt: now,
    },
  };
}

function criticalExecutions(
  device: { id: string; capabilities: Array<{ code: string }> },
  riskDetectionId: string,
  now: Date,
): ResponseExecution[] {
  const actions = [
    ['ACTIVATE_AUDIBLE_ALARM', 'Activate Audible Alarm', 'audible_alarm'],
    ['ACTIVATE_CRITICAL_INDICATOR', 'Activate Critical Indicator', 'critical_status_indicator'],
    ['SHOW_CRITICAL_STATUS', 'Show Critical Status', 'local_status_display'],
  ] as const;
  const capabilities = new Set(device.capabilities.map((item) => item.code));
  return actions
    .filter(([, , capability]) => capabilities.has(capability))
    .map(([actionCode, actionName, capability]) => {
      const suffix = createLocalId();
      return {
        responseExecutionId: `response-${suffix}`,
        organizationId: 'securitybear',
        riskDetectionId,
        policyId: 'policy-critical-device-actions',
        action: {
          actionId: `action-${suffix}`,
          actionCode,
          actionName,
          targetDeviceId: device.id,
          targetCapabilityCode: capability,
          authorizationMode: 'HUMAN_REQUIRED',
          critical: true,
        },
        status: 'PENDING_AUTHORIZATION',
        requestedAt: now,
      } satisfies ResponseExecution;
    });
}

function riskTypeFor(metric: string): RiskTypeCode {
  return metric === 'Gas' ? 'GAS_LEAK' : 'FIRE';
}

function createLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}
