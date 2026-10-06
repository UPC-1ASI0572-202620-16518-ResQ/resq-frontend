import { Injectable, signal } from '@angular/core';
import { ALERTS, INCIDENTS, RISK_DETECTIONS } from '../mock-data/resq.mock';
import { Alert, Incident, RiskDetectionSummary } from '../models/resq.models';

/**
 * Session-only event projection used by the mock adapters.
 *
 * Real-time transport is deliberately outside this store. A future SSE or
 * WebSocket adapter can publish the same domain records without changing the
 * pages, facades, or gateway contracts.
 */
@Injectable({ providedIn: 'root' })
export class RiskEventStoreService {
  private readonly detectionsState = signal<RiskDetectionSummary[]>(
    structuredClone(RISK_DETECTIONS),
  );
  private readonly alertsState = signal<Alert[]>(structuredClone(ALERTS));
  private readonly incidentsState = signal<Incident[]>(structuredClone(INCIDENTS));

  readonly detections = this.detectionsState.asReadonly();
  readonly alerts = this.alertsState.asReadonly();
  readonly incidents = this.incidentsState.asReadonly();

  recordWarning(detection: RiskDetectionSummary, alert: Alert): void {
    this.detectionsState.update((items) => [structuredClone(detection), ...items]);
    this.alertsState.update((items) => [structuredClone(alert), ...items]);
  }

  recordCritical(detection: RiskDetectionSummary, incident: Incident): void {
    this.detectionsState.update((items) => [structuredClone(detection), ...items]);
    this.incidentsState.update((items) => [structuredClone(incident), ...items]);
  }

  updateIncident(incident: Incident): void {
    this.incidentsState.update((items) =>
      items.map((item) => (item.id === incident.id ? structuredClone(incident) : item)),
    );
  }
}
