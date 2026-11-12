import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  DEVICE_CATALOG,
  Device,
  DeviceCapabilityCategory,
  DeviceType,
  ResponseAction,
  ResponseRule,
  Space,
} from '../../core/models/resq.models';
import {
  capabilityCategory,
  comparisonOperators,
  deviceDefinition,
  isSensorType,
  sensorThreshold,
} from '../../core/models/device-domain';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { SensorResponseService } from '../../core/services/sensor-response.service';
import { StatusBadgeComponent } from './ui.components';

@Component({
  selector: 'resq-device-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, StatusBadgeComponent],
  templateUrl: './device-configuration.component.html',
  styleUrl: './device-configuration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceConfigurationComponent implements OnInit {
  readonly deviceId = input('');
  readonly spaces = input<Space[]>([]);
  readonly initialSpaceId = input('');
  readonly saved = output<Device>();
  readonly changing = output<void>();
  readonly removed = output<string>();
  readonly closed = output<void>();
  readonly store = inject(BuildingStoreService);
  readonly response = inject(SensorResponseService);
  readonly catalog = DEVICE_CATALOG;
  readonly operators = comparisonOperators;
  readonly current = computed(() =>
    this.store.devices().find((device) => device.id === this.deviceId()),
  );
  readonly events = computed(() =>
    this.store
      .events()
      .filter(
        (event) =>
          event.deviceId === this.deviceId() ||
          event.targets.some((target) => target.deviceId === this.deviceId()),
      )
      .slice(0, 6),
  );
  readonly error = signal('');
  readonly confirmDelete = signal(false);
  readonly ruleEditorOpen = signal(false);
  category: DeviceCapabilityCategory = 'SENSOR';
  type: DeviceType = 'Temperature';
  name = '';
  displayName = '';
  code = '';
  description = '';
  spaceId = '';
  unit = '';
  manufacturer = '';
  model = '';
  serialNumber = '';
  x = 0;
  y = 0;
  positioned = true;
  useAreaThreshold = true;
  warning = 0;
  critical = 0;
  measurement = 0;
  ruleId = '';
  ruleName = '';
  operator: ResponseRule['operator'] = '>=';
  ruleThreshold: number | null = null;
  ruleEnabled = true;
  targets: { key: string; deviceId: string; capabilityCode: string; action: ResponseAction }[] = [];

  ngOnInit(): void {
    const device = this.current();
    this.spaceId = device?.spaceId ?? this.initialSpaceId() ?? '';
    if (!this.spaceId) this.spaceId = this.spaces()[0]?.id ?? '';
    if (device) {
      this.type = device.type;
      this.category = deviceDefinition(device.type).category;
      this.name = device.name;
      this.displayName = device.displayName ?? '';
      this.code = device.deviceCode;
      this.description = device.description;
      this.manufacturer = device.specifications.manufacturer;
      this.model = device.specifications.model;
      this.serialNumber = device.specifications.serialNumber;
      this.unit = device.capabilities.find((cap) => cap.kind === 'MEASUREMENT')?.unit ?? '';
      this.positioned = !!device.floorPlanPosition;
      this.x = device.floorPlanPosition?.x ?? 0;
      this.y = device.floorPlanPosition?.y ?? 0;
      this.useAreaThreshold = !device.sensorThreshold;
      this.measurement = device.readings.at(-1)?.value ?? 0;
    } else this.changeType(this.type);
    this.loadThreshold();
    this.newRule();
    this.ruleEditorOpen.set(false);
  }
  options() {
    return this.catalog.filter((item) => item.category === this.category);
  }
  definition() {
    return deviceDefinition(this.type);
  }
  isSensor() {
    return isSensorType(this.type);
  }
  changeCategory(category: DeviceCapabilityCategory): void {
    this.category = category;
    this.changeType(this.options()[0].type);
  }
  changeType(type: DeviceType): void {
    this.type = type;
    this.unit = deviceDefinition(type).unit ?? '';
    this.loadThreshold();
  }
  area(): Space | undefined {
    return (
      this.spaces().find((space) => space.id === this.spaceId) ??
      this.store.spaces().find((space) => space.id === this.spaceId)
    );
  }
  loadThreshold(): void {
    const area = this.area();
    const device = this.current();
    const thresholds =
      this.useAreaThreshold && isSensorType(this.type)
        ? area?.thresholds[this.type]
        : device && area
          ? sensorThreshold(device, area)
          : undefined;
    this.warning = thresholds?.warning ?? 0;
    this.critical = thresholds?.critical ?? 0;
  }
  save(): void {
    this.error.set('Floor-plan device configuration is not supported by the backend API.');
  }
  removePosition(): void {
    this.error.set('Floor-plan position persistence is not supported by the backend API.');
  }
  deleteDevice(): void {
    this.error.set('Physical device deletion is not supported by the backend API.');
  }
  rules() {
    const device = this.current();
    if (!device) return [];
    const custom = this.response.rules().filter((rule) => rule.sourceDeviceId === device.id);
    if (this.isSensor())
      return custom.length
        ? custom
        : this.response
            .rules()
            .filter((rule) => !rule.sourceDeviceId && rule.sensor === device.type);
    return this.response
      .rules()
      .filter((rule) =>
        rule.targets
          ? rule.targets.some((target) => target.deviceId === device.id)
          : rule.actuatorCapabilities.some((code) =>
              device.capabilities.some((cap) => cap.code === code),
            ),
      );
  }
  newRule(): void {
    this.ruleEditorOpen.set(true);
    this.ruleId = '';
    this.ruleName = '';
    this.operator = '>=';
    this.ruleThreshold = null;
    this.ruleEnabled = this.type !== 'Motion';
    this.targets = [];
  }
  editRule(rule: ResponseRule): void {
    this.ruleEditorOpen.set(true);
    this.ruleId = rule.sourceDeviceId ? rule.id : '';
    this.ruleName = rule.condition;
    this.operator = rule.operator;
    this.ruleThreshold = rule.threshold ?? null;
    this.ruleEnabled = rule.enabled;
    this.targets = (
      rule.targets ??
      this.targetOptions()
        .filter((option) => rule.actuatorCapabilities.includes(option.capabilityCode))
        .map((option) => ({
          deviceId: option.deviceId,
          capabilityCode: option.capabilityCode,
          action: 'ACTIVATE' as const,
        }))
    ).map((target) => ({ ...target, key: `${target.deviceId}:${target.capabilityCode}` }));
  }
  targetOptions() {
    return this.store
      .devices()
      .filter((device) => device.spaceId === this.current()?.spaceId)
      .flatMap((device) =>
        device.capabilities
          .filter((cap) => capabilityCategory(cap) === 'ACTUATOR')
          .map((cap) => ({
            key: `${device.id}:${cap.code}`,
            deviceId: device.id,
            capabilityCode: cap.code,
            label: `${device.displayName || device.name} · ${cap.name}`,
            servo: cap.code === 'mechanical_servo',
          })),
      );
  }
  hasTarget(key: string) {
    return this.targets.some((target) => target.key === key);
  }
  toggleTarget(option: ReturnType<DeviceConfigurationComponent['targetOptions']>[number]): void {
    this.targets = this.hasTarget(option.key)
      ? this.targets.filter((target) => target.key !== option.key)
      : [
          ...this.targets,
          {
            key: option.key,
            deviceId: option.deviceId,
            capabilityCode: option.capabilityCode,
            action: option.servo ? 'OPEN' : 'ACTIVATE',
          },
        ];
  }
  action(key: string) {
    return this.targets.find((target) => target.key === key)?.action ?? 'OPEN';
  }
  setAction(key: string, action: ResponseAction): void {
    this.targets = this.targets.map((target) =>
      target.key === key ? { ...target, action } : target,
    );
  }
  saveRule(): void {
    const device = this.current();
    if (!device || !isSensorType(device.type)) return;
    try {
      if (this.ruleEnabled && !this.targets.length)
        throw new Error('Select at least one actuator.');
      this.response.saveRule({
        id: this.ruleId || crypto.randomUUID(),
        sourceDeviceId: device.id,
        sensor: device.type,
        operator: this.operator,
        threshold: this.ruleThreshold === null ? undefined : Number(this.ruleThreshold),
        condition: this.ruleName.trim() || `${device.name} response`,
        enabled: this.ruleEnabled,
        actuatorCapabilities: this.targets.map((target) => target.capabilityCode),
        targets: this.targets.map(({ key, ...target }) => target),
      });
      this.newRule();
      this.ruleEditorOpen.set(false);
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Rule could not be saved.');
    }
  }
  toggleRule(rule: ResponseRule): void {
    const device = this.current();
    if (!device) return;
    if (rule.sourceDeviceId) this.response.updateRule(rule.id, { enabled: !rule.enabled });
    else if (this.isSensor()) {
      this.editRule(rule);
      this.ruleEnabled = !rule.enabled;
      this.saveRule();
    }
  }
  simulate(): void {
    const result = this.response.simulateMeasurement(this.deviceId(), Number(this.measurement));
    this.error.set(result ? '' : 'Select an active, connected sensor and a finite measurement.');
  }
  private inside(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
    return inside;
  }
}
