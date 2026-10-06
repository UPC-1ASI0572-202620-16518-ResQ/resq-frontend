import { Injectable, signal } from '@angular/core';
import {
  ALERTS,
  INCIDENTS,
  RESPONSE_EXECUTIONS,
  RISK_DETECTIONS,
} from '../mock-data/resq.mock';
import {
  Alert,
  AlertClearReason,
  DetectionEvidence,
  Incident,
  ResponseExecution,
  RiskDetectionSummary,
  RiskTypeCode,
} from '../models/resq.models';

export interface RiskCorrelation {
  deviceId: string;
  metric: string;
  zoneId: string;
  riskTypeCode: RiskTypeCode;
}

export interface UpsertResult<T> {
  item: T;
  created: boolean;
}

/**
 * Session-only aggregate projection used by every mock adapter.
 *
 * It is the single mock boundary for event correlation, deduplication and
 * lifecycle state. A future SSE/WebSocket ingress can issue these same domain
 * commands without moving threshold rules into pages or transport adapters.
 */
@Injectable({ providedIn: 'root' })
export class RiskEventStoreService {
  private readonly detectionsState = signal<RiskDetectionSummary[]>(
    structuredClone(RISK_DETECTIONS),
  );
  private readonly alertsState = signal<Alert[]>(structuredClone(ALERTS));
  private readonly incidentsState = signal<Incident[]>(structuredClone(INCIDENTS));
  private readonly executionsState = signal<ResponseExecution[]>(
    structuredClone(RESPONSE_EXECUTIONS),
  );

  readonly detections = this.detectionsState.asReadonly();
  readonly alerts = this.alertsState.asReadonly();
  readonly incidents = this.incidentsState.asReadonly();
  readonly responseExecutions = this.executionsState.asReadonly();

  upsertWarning(
    correlation: RiskCorrelation,
    detection: RiskDetectionSummary,
    alert: Alert,
  ): UpsertResult<Alert> {
    const active = this.findActiveAlert(correlation);
    if (!active) {
      this.detectionsState.update((items) => [structuredClone(detection), ...items]);
      this.alertsState.update((items) => [structuredClone(alert), ...items]);
      return { item: structuredClone(alert), created: true };
    }

    this.updateDetectionEvidence(active.context.riskDetectionId, detection.evidence[0]);
    return { item: structuredClone(active), created: false };
  }

  clearActiveAlert(
    correlation: RiskCorrelation,
    reason: AlertClearReason,
    clearedAt: Date,
  ): Alert | undefined {
    const active = this.findActiveAlert(correlation);
    if (!active) return undefined;
    const cleared: Alert = {
      ...active,
      status: 'CLEARED',
      clearedAt,
      clearReason: reason,
    };
    this.alertsState.update((items) =>
      items.map((item) => (item.alertId === active.alertId ? structuredClone(cleared) : item)),
    );
    return structuredClone(cleared);
  }

  upsertCritical(
    correlation: RiskCorrelation,
    detection: RiskDetectionSummary,
    incident: Incident,
  ): UpsertResult<Incident> {
    const active = this.findOperationalIncident(correlation);
    if (!active) {
      this.detectionsState.update((items) => [structuredClone(detection), ...items]);
      this.incidentsState.update((items) => [structuredClone(incident), ...items]);
      return { item: structuredClone(incident), created: true };
    }

    const updated: Incident = {
      ...active,
      currentEvidence: structuredClone(detection.evidence[0]),
      safeAt: undefined,
    };
    this.updateDetectionEvidence(active.riskDetectionId, detection.evidence[0]);
    this.updateIncident(updated);
    return { item: structuredClone(updated), created: false };
  }

  updateCurrentIncidentEvidence(
    correlation: RiskCorrelation,
    evidence: DetectionEvidence,
  ): Incident | undefined {
    const incident = this.findOperationalIncident(correlation);
    if (!incident) return undefined;
    const updated = { ...incident, currentEvidence: structuredClone(evidence), safeAt: undefined };
    this.updateDetectionEvidence(incident.riskDetectionId, evidence);
    this.updateIncident(updated);
    return structuredClone(updated);
  }

  markIncidentSafe(
    correlation: RiskCorrelation,
    evidence: DetectionEvidence,
    safeAt: Date,
  ): Incident | undefined {
    const incident = this.findOperationalIncident(correlation);
    if (!incident) return undefined;
    const updated = {
      ...incident,
      currentEvidence: structuredClone(evidence),
      safeAt: incident.safeAt ?? safeAt,
    };
    this.updateDetectionEvidence(incident.riskDetectionId, evidence);
    this.updateIncident(updated);
    return structuredClone(updated);
  }

  updateIncident(incident: Incident): void {
    this.incidentsState.update((items) =>
      items.map((item) => (item.id === incident.id ? structuredClone(incident) : item)),
    );
  }

  addResponseExecutions(executions: ResponseExecution[]): void {
    if (!executions.length) return;
    this.executionsState.update((items) => [
      ...executions.map((item) => structuredClone(item)),
      ...items,
    ]);
  }

  updateResponseExecution(execution: ResponseExecution): void {
    this.executionsState.update((items) =>
      items.map((item) =>
        item.responseExecutionId === execution.responseExecutionId
          ? structuredClone(execution)
          : item,
      ),
    );
  }

  incidentForDetection(riskDetectionId: string): Incident | undefined {
    const incident = this.incidentsState().find(
      (item) => item.riskDetectionId === riskDetectionId,
    );
    return incident ? structuredClone(incident) : undefined;
  }

  private findActiveAlert(correlation: RiskCorrelation): Alert | undefined {
    return this.alertsState().find(
      (alert) =>
        alert.status === 'ACTIVE' &&
        alert.context.zoneId === correlation.zoneId &&
        alert.context.riskTypeCode === correlation.riskTypeCode &&
        this.detectionMatches(alert.context.riskDetectionId, correlation),
    );
  }

  private findOperationalIncident(correlation: RiskCorrelation): Incident | undefined {
    return this.incidentsState().find(
      (incident) =>
        (incident.status === 'Open' || incident.status === 'InProgress') &&
        incident.spaceId === correlation.zoneId &&
        incident.riskTypeCode === correlation.riskTypeCode &&
        incident.currentEvidence.deviceId === correlation.deviceId &&
        incident.currentEvidence.metric === correlation.metric,
    );
  }

  private detectionMatches(
    riskDetectionId: string,
    correlation: RiskCorrelation,
  ): boolean {
    return Boolean(
      this.detectionsState()
        .find((item) => item.riskDetectionId === riskDetectionId)
        ?.evidence.some(
          (evidence) =>
            evidence.deviceId === correlation.deviceId &&
            evidence.metric === correlation.metric,
        ),
    );
  }

  private updateDetectionEvidence(
    riskDetectionId: string,
    evidence: DetectionEvidence,
  ): void {
    this.detectionsState.update((items) =>
      items.map((item) =>
        item.riskDetectionId === riskDetectionId
          ? { ...item, evidence: [structuredClone(evidence)] }
          : item,
      ),
    );
  }
}
