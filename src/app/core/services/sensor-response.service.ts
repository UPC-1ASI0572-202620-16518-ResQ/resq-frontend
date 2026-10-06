import { Injectable, inject } from '@angular/core';
import { capabilityCategory, isSensorType } from '../models/device-domain';
import { evaluateZone } from '../models/response-evaluation';
import { Device, ResponseEvent, ResponseRule } from '../models/resq.models';
import { BuildingStoreService } from './building-store.service';
import { RiskEvaluationService } from './risk-evaluation.service';

/** Coordinates ingest -> evaluation -> output state -> event in the same session store. */
@Injectable({ providedIn: 'root' })
export class SensorResponseService {
  private readonly store = inject(BuildingStoreService);
  private readonly risk = inject(RiskEvaluationService);
  readonly rules = this.store.rules;
  readonly events = this.store.events;
  updateRule(id: string, patch: Partial<ResponseRule>): void {
    const current = this.rules().find((rule) => rule.id === id);
    if (current) this.saveRule({ ...current, ...patch });
  }
  saveRule(rule: ResponseRule): void {
    if (rule.threshold !== undefined && !Number.isFinite(rule.threshold))
      throw new Error('Threshold must be a finite number.');
    const source = rule.sourceDeviceId
      ? this.store.devices().find((device) => device.id === rule.sourceDeviceId)
      : undefined;
    if (rule.sourceDeviceId && (!source || !isSensorType(source.type)))
      throw new Error('Select an existing sensor.');
    if (source && source.type !== rule.sensor)
      throw new Error('Rule sensor type must match its source device.');
    for (const target of rule.targets ?? []) {
      if ((target.capabilityCode === 'mechanical_servo') === (target.action === 'ACTIVATE'))
        throw new Error('Use OPEN/CLOSE for servomotors and ACTIVATE for other actuators.');
      const device = this.store.devices().find((device) => device.id === target.deviceId);
      if (
        !device ||
        (source && device.spaceId !== source.spaceId) ||
        !device.capabilities.some(
          (cap) => cap.code === target.capabilityCode && capabilityCategory(cap) === 'ACTUATOR',
        )
      )
        throw new Error('Select an actuator in the sensor area.');
    }
    this.store.setRules([...this.rules().filter((item) => item.id !== rule.id), rule]);
    (source ? [source.spaceId] : this.store.spaces().map((space) => space.id)).forEach((id) =>
      this.reconcile(id),
    );
  }
  deleteRule(id: string): void {
    this.store.setRules(this.rules().filter((rule) => rule.id !== id));
    this.store.spaces().forEach((space) => this.reconcile(space.id));
  }
  reconcile(spaceId: string): void {
    const space = this.store.spaces().find((space) => space.id === spaceId);
    if (!space) return;
    const devices = this.store.devices().filter((device) => device.spaceId === spaceId);
    this.store.updateDevices(
      evaluateZone(space, devices, this.rules(), (value, threshold) =>
        this.risk.evaluateMetric(value, threshold),
      ).devices,
    );
  }
  ingestMeasurement(deviceId: string, value: number, simulated = false): ResponseEvent | undefined {
    const device = this.store.devices().find((item) => item.id === deviceId);
    if (
      !device ||
      !isSensorType(device.type) ||
      !Number.isFinite(value) ||
      device.connectivityStatus === 'OFFLINE' ||
      device.administrativeStatus !== 'ACTIVE'
    )
      return undefined;
    const space = this.store.spaces().find((space) => space.id === device.spaceId);
    if (!space) return undefined;
    const unit =
      device.capabilities.find((cap) => cap.kind === 'MEASUREMENT')?.unit ??
      device.readings.at(-1)?.unit ??
      '';
    const now = new Date();
    const updated: Device = {
      ...device,
      readings: [
        ...device.readings,
        { id: crypto.randomUUID(), deviceId, metric: device.type, value, unit, timestamp: now },
      ].slice(-240),
      lastSeen: now,
      updatedAt: now,
    };
    const devices = this.store
      .devices()
      .filter((item) => item.spaceId === space.id)
      .map((item) => (item.id === deviceId ? updated : item));
    const result = evaluateZone(space, devices, this.rules(), (value, threshold) =>
      this.risk.evaluateMetric(value, threshold),
    );
    this.store.updateDevices(result.devices);
    const evaluated = result.devices.find((item) => item.id === deviceId)!;
    const matches = result.matches.filter((match) => match.sourceDeviceId === deviceId);
    const event: ResponseEvent = {
      id: crypto.randomUUID(),
      deviceId,
      spaceId: space.id,
      sensor: device.type,
      value,
      unit,
      risk: evaluated.status === 'Online' ? 'Normal' : evaluated.status,
      ruleIds: matches.map((match) => match.ruleId),
      targets: matches.flatMap((match) => match.targets),
      message: matches.length
        ? `${matches.length} response rule(s) matched`
        : 'No response condition matched',
      createdAt: now,
      simulated,
    };
    this.store.recordEvent(event);
    return event;
  }
  simulateMeasurement(deviceId: string, value: number): ResponseEvent | undefined {
    return this.ingestMeasurement(deviceId, value, true);
  }
  evaluate(device: Device): void {
    this.reconcile(device.spaceId);
  }
}
