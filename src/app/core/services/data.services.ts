import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import {
  DEMO_USER,
  INCIDENTS,
  RESPONSE_EXECUTIONS,
} from '../mock-data/resq.mock';

import {
  Alert,
  AlertDetailViewModel,
  AlertListItem,
  AlertPeriod,
  AlertSummary,
  Building,
  Device,
  DeviceCapability,
  DeviceStatusSummary,
  Floor,
  Incident,
  IncidentStatus,
  SearchResult,
  SensorReading,
  Space,
  SpaceThresholds,
  User,
} from '../models/resq.models';

import { BuildingStoreService } from './building-store.service';
import { RiskEventStoreService } from './risk-event-store.service';
import { invalidThresholdMetrics } from './risk-evaluation.service';

@Injectable({ providedIn: 'root' })
export class ResqStore {
  private readonly buildingStore = inject(BuildingStoreService);
  readonly buildings = this.buildingStore.buildings;
  readonly devices = this.buildingStore.devices;
  readonly incidents = signal<Incident[]>(INCIDENTS);
}

@Injectable({ providedIn: 'root' })
export class BuildingService {
  private readonly store = inject(BuildingStoreService);
  readonly buildings = this.store.buildings;
  getBuildings(): Observable<Building[]> { return of(this.store.buildings()).pipe(delay(150)); }
  getBuildingById(id: string): Observable<Building | undefined> { return of(this.store.getBuilding(id)).pipe(delay(100)); }
}

@Injectable({ providedIn: 'root' })
export class FloorService {
  private readonly store = inject(BuildingStoreService);
  getFloorsByBuilding(buildingId: string): Observable<Floor[]> { return of(this.store.getBuilding(buildingId)?.floors ?? []).pipe(delay(100)); }
  getFloorById(id: string): Observable<Floor | undefined> { return of(this.store.floors().find(item => item.id === id)).pipe(delay(80)); }
}

@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly store = inject(BuildingStoreService);
  getSpaces(): Observable<Space[]> { return of(this.store.spaces()).pipe(delay(120)); }
  getSpacesByFloor(floorId: string): Observable<Space[]> { return of(this.store.spaces().filter(item => item.floorId === floorId)).pipe(delay(100)); }
  getSpaceById(id: string): Observable<Space | undefined> { return of(this.store.spaces().find(item => item.id === id)).pipe(delay(80)); }
  updateConfiguration(
    id: string,
    sensitivity: Space['sensitivity'],
    thresholds: SpaceThresholds,
    thresholdProfiles?: Space['thresholdProfiles'],
  ): void {
    const invalidMetrics = invalidThresholdMetrics(thresholds);
    if (invalidMetrics.length) {
      throw new Error(
        `Warning threshold must be lower than the critical threshold for: ${invalidMetrics.join(', ')}.`,
      );
    }
    const space = this.store.spaces().find(item => item.id === id);
    if (space) this.store.updateSpace(space.buildingId, space.floorId, {
      ...space,
      sensitivity,
      thresholds,
      thresholdProfiles: thresholdProfiles ?? space.thresholdProfiles,
    });
  }
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly store = inject(BuildingStoreService);
  getDevices(): Observable<Device[]> {
    return of(this.store.devices()).pipe(delay(120));
  }
  getDeviceById(id: string): Observable<Device | undefined> {
    return of(this.store.devices().find((item) => item.id === id)).pipe(delay(80));
  }
  getDevicesBySpace(spaceId: string): Observable<Device[]> {
    return of(this.store.devices().filter((item) => item.spaceId === spaceId)).pipe(delay(80));
  }
  getDevicesByBuilding(buildingId: string): Observable<Device[]> {
    return of(this.store.devices().filter((item) => item.assignment.buildingId === buildingId)).pipe(delay(80));
  }
  getDevicesByFloor(floorId: string): Observable<Device[]> {
    return of(this.store.devices().filter((item) => item.assignment.floorId === floorId)).pipe(delay(80));
  }
  getDeviceCapabilities(deviceId: string): Observable<DeviceCapability[]> {
    return of(this.store.devices().find((item) => item.id === deviceId)?.capabilities ?? []).pipe(delay(80));
  }
  getDeviceMeasurements(deviceId: string): Observable<SensorReading[]> {
    return of(this.store.devices().find((item) => item.id === deviceId)?.readings ?? []).pipe(delay(80));
  }
  getStatusSummary(): Observable<DeviceStatusSummary> {
    return of({
      total: this.store.devices().length,
      online: this.store.devices().filter((item) => item.connectivityStatus === 'ONLINE').length,
      warningDegraded: this.store.devices().filter(
        (item) => item.healthStatus === 'WARNING' || item.healthStatus === 'CRITICAL',
      ).length,
      offline: this.store.devices().filter((item) => item.connectivityStatus === 'OFFLINE').length,
    }).pipe(delay(80));
  }
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly store = inject(BuildingStoreService);
  private readonly events = inject(RiskEventStoreService);
  private readonly listItems = computed(() =>
    this.events.alerts()
      .map((alert) => this.toListItem(alert))
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()),
  );
  readonly latestAlerts = computed(() => this.listItems().slice(0, 3));
  readonly recentAlertCount = computed(
    () => this.filterByPeriod(this.listItems(), '24h').length,
  );
  getAlerts(): Observable<AlertListItem[]> {
    return of(this.listItems()).pipe(delay(120));
  }
  getAlertById(id: string): Observable<Alert | undefined> {
    return of(this.events.alerts().find((item) => item.alertId === id)).pipe(delay(80));
  }
  getAlertsByZone(zoneId: string): Observable<AlertListItem[]> {
    return of(this.listItems().filter((item) => item.location.zoneId === zoneId)).pipe(delay(80));
  }
  getAlertsBySpace(spaceId: string): Observable<AlertListItem[]> {
    return this.getAlertsByZone(spaceId);
  }
  getAlertsByDevice(deviceId: string): Observable<AlertListItem[]> {
    const detectionIds = new Set(
      this.events.detections().filter((detection) =>
        detection.evidence.some((evidence) => evidence.deviceId === deviceId),
      ).map((detection) => detection.riskDetectionId),
    );
    return of(
      this.listItems().filter((item) => detectionIds.has(item.riskDetectionId)),
    ).pipe(delay(80));
  }
  getRecentAlerts(period: AlertPeriod): Observable<AlertListItem[]> {
    return of(this.filterByPeriod(this.listItems(), period)).pipe(delay(80));
  }
  getAlertSummary(period: AlertPeriod): Observable<AlertSummary> {
    const alerts = this.filterByPeriod(this.listItems(), period);
    return of({
      total: alerts.length,
      critical: 0,
      warning: alerts.filter((item) => item.severity === 'Warning').length,
      notificationFailures: alerts.reduce((total, item) => total + item.delivery.failed, 0),
    }).pipe(delay(80));
  }
  getAlertDetail(id: string): Observable<AlertDetailViewModel | undefined> {
    const alert = this.events.alerts().find((item) => item.alertId === id);
    if (!alert) return of(undefined).pipe(delay(80));
    const listItem = this.toListItem(alert);
    const detection = this.events.detections().find(
      (item) => item.riskDetectionId === alert.context.riskDetectionId,
    );
    const evidence =
      detection?.evidence.map((item) => {
        const device = this.store.devices().find((candidate) => candidate.id === item.deviceId);
        const capability = device?.capabilities.find(
          (candidate) => candidate.code === item.capabilityCode,
        );
        return {
          ...item,
          deviceName: device?.name ?? 'Device unavailable',
          deviceCode: device?.deviceCode ?? item.deviceId,
          hardware: capability?.hardware ?? 'Hardware unavailable',
        };
      }) ?? [];
    const responseExecutions = RESPONSE_EXECUTIONS.filter(
      (execution) => execution.riskDetectionId === alert.context.riskDetectionId,
    ).map((execution) => {
      const device = this.store.devices().find((item) => item.id === execution.action.targetDeviceId);
      return {
        ...execution,
        targetDeviceName: device?.name ?? 'Device unavailable',
        targetDeviceCode: device?.deviceCode ?? execution.action.targetDeviceId,
      };
    });
    return of({ ...listItem, alert, evidence, responseExecutions }).pipe(delay(100));
  }
  private toListItem(alert: Alert): AlertListItem {
    const detection = this.events.detections().find(
      (item) => item.riskDetectionId === alert.context.riskDetectionId,
    );
    const space = this.store.spaces().find((item) => item.id === alert.context.zoneId);
    const floor = this.store.floors().find((item) => item.id === space?.floorId);
    const building = this.store.buildings().find((item) => item.id === alert.context.buildingId);
    const evidence = detection?.evidence[0];
    const device = this.store.devices().find((item) => item.id === evidence?.deviceId);
    const capability = device?.capabilities.find(
      (item) => item.code === evidence?.capabilityCode,
    );
    const delivered = alert.deliveries.filter((item) => item.status === 'DELIVERED').length;
    const pending = alert.deliveries.filter((item) => item.status === 'PENDING').length;
    const failed = alert.deliveries.filter((item) => item.status === 'FAILED').length;
    const deliveryStatus = failed ? 'FAILED' : pending ? 'PENDING' : 'DELIVERED';
    const title =
      alert.context.riskTypeCode === 'GAS_LEAK'
        ? 'Gas warning'
        : 'Fire risk warning';
    const riskTypeLabel = this.riskTypeLabel(alert.context.riskTypeCode);
    return {
      id: alert.alertId,
      title,
      description: 'Warning threshold exceeded. The measurement remains below the critical threshold.',
      riskDetectionId: alert.context.riskDetectionId,
      riskTypeCode: alert.context.riskTypeCode,
      riskTypeLabel,
      severity: alert.context.severityCode,
      detectedAt: alert.context.detectedAt,
      generatedAt: alert.generatedAt,
      location: {
        buildingId: building?.id,
        buildingName: building?.name ?? 'Location unavailable',
        floorId: floor?.id,
        floorName: floor?.name ?? 'Location unavailable',
        zoneId: space?.id,
        zoneName: space?.name ?? 'Location unavailable',
        roomNumber: space?.roomNumber,
        available: Boolean(building && floor && space),
      },
      primaryEvidence:
        evidence && device
          ? {
              ...evidence,
              deviceName: device.name,
              deviceCode: device.deviceCode,
              hardware: capability?.hardware ?? 'Hardware unavailable',
            }
          : undefined,
      delivery: {
        status: deliveryStatus,
        delivered,
        pending,
        failed,
        label: this.deliveryLabel(delivered, pending, failed),
      },
    };
  }
  private filterByPeriod(items: AlertListItem[], period: AlertPeriod): AlertListItem[] {
    if (period === 'all') return items;
    const duration = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30;
    const start = Date.now() - duration * 60 * 60 * 1_000;
    return items.filter((item) => item.generatedAt.getTime() >= start);
  }
  private riskTypeLabel(code: Alert['context']['riskTypeCode']): string {
    return code === 'GAS_LEAK' ? 'Gas leak' : 'Fire';
  }
  private deliveryLabel(delivered: number, pending: number, failed: number): string {
    const parts: string[] = [];
    if (delivered) parts.push(`${delivered} delivered`);
    if (pending) parts.push(`${pending} pending`);
    if (failed) parts.push(`${failed} failed`);
    return parts.join(' · ') || 'No delivery attempts';
  }
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly items = signal<Incident[]>(INCIDENTS);
  readonly incidents = this.items.asReadonly();
  getIncidents(): Observable<Incident[]> {
    return of(this.items()).pipe(delay(120));
  }
  getIncidentById(id: string): Observable<Incident | undefined> {
    return of(this.items().find((item) => item.id === id)).pipe(delay(80));
  }
  updateStatus(id: string, status: IncidentStatus): void {
    this.items.update((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, status, resolvedAt: status === 'Resolved' ? new Date() : undefined }
          : item,
      ),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly store = inject(BuildingStoreService);
  search(query: string): Observable<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return of([]);
    const results: SearchResult[] = [
      ...this.store.buildings().filter((item) => item.name.toLowerCase().includes(q)).map((item) => ({
        id: item.id,
        type: 'Building' as const,
        title: item.name,
        subtitle: item.address,
        route: `/buildings/${item.id}`,
      })),
      ...this.store.spaces().filter((item) => `${item.name} ${item.roomNumber}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          type: 'Space' as const,
          title: item.name,
          subtitle: `Room ${item.roomNumber ?? '—'}`,
          route: `/spaces/${item.id}`,
        })),
      ...this.store.devices().filter((item) =>
        `${item.name} ${item.deviceCode} ${item.specifications.model} ${item.specifications.serialNumber}`
          .toLowerCase()
          .includes(q),
      )
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          type: 'Device' as const,
          title: item.name,
          subtitle: item.deviceCode,
          route: `/devices/${item.id}`,
        })),
    ];
    return of(results.slice(0, 10)).pipe(delay(100));
  }
}

@Injectable({ providedIn: 'root' })
export class AuthMockService {
  readonly currentUser = signal<User | null>(null);
  login(email: string, password: string): boolean {
    const valid = email === 'admin@resq.io' && password === 'password123';
    if (valid) this.currentUser.set(DEMO_USER);
    return valid;
  }
  logout(): void {
    this.currentUser.set(null);
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly store = inject(BuildingStoreService);
  private readonly alertService = inject(AlertService);
  summary() {
    return {
      buildings: this.store.buildings().length,
      devices: this.store.devices().length,
      alerts: this.alertService.recentAlertCount(),
      criticalSpaces: this.store.spaces().filter((item) => item.status === 'Critical').length,
    };
  }
}
