import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AlertListItem, Device, DeviceType, FloorPlanElement, FloorPlanPoint } from '../../core/models/resq.models';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { AlertService } from '../../core/services/data.services';
import { DoughnutChartComponent, KpiCardComponent, LineChartComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';
import { ThreeFloorViewerComponent } from './three-floor-viewer/three-floor-viewer.component';
import { visualDevicePosition } from '../../shared/utils/floor-plan-device.utils';

@Component({
  selector: 'resq-floor-monitoring',
  standalone: true,
  imports: [RouterLink, MatIconModule, KpiCardComponent, DoughnutChartComponent, LineChartComponent, StatusBadgeComponent, ThreeFloorViewerComponent],
  templateUrl: './floor-monitoring.page.html',
  styleUrls: ['./floor-monitoring.page.scss', './floor-monitoring.typography.scss', './floor-monitoring.renderer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorMonitoringPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);
  readonly store = inject(BuildingStoreService);
  readonly buildingId = signal(this.route.snapshot.paramMap.get('buildingId') ?? 'science');
  readonly floorId = signal(this.route.snapshot.paramMap.get('floorId') ?? 'science-f2');
  readonly building = computed(() => this.store.getBuilding(this.buildingId()));
  readonly floor = computed(() => this.store.getFloor(this.buildingId(), this.floorId()));
  readonly sortedFloors = computed(() => [...(this.building()?.floors ?? [])].sort((a, b) => a.level - b.level));
  readonly visibleFloors = computed(() => {
    const selectedLevel = this.floor()?.level;
    return selectedLevel === undefined ? [] : this.sortedFloors().filter(item => item.level <= selectedLevel);
  });
  readonly floorSpaces = computed(() => this.floor()?.spaces ?? []);
  readonly buildingSpaces = computed(() => this.building()?.floors.flatMap(item => item.spaces) ?? []);
  readonly buildingDevices = computed(() => {
    const ids = new Set(this.buildingSpaces().map(space => space.id));
    return this.store.devices().filter(device => ids.has(device.spaceId));
  });
  readonly floorDevices = computed(() => this.floorSpaces().flatMap(space => space.devices));
  readonly environmentalMetric = signal<DeviceType>('Temperature');
  readonly environmentalMetrics: DeviceType[] = ['Temperature', 'Smoke', 'Gas'];
  readonly environmentalReadings = computed(() => this.floorDevices().flatMap(device => device.readings)
    .filter(reading => reading.metric === this.environmentalMetric())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(-24));
  readonly deviceStatuses = ['Online', 'Warning', 'Critical', 'Offline'] as const;
  readonly deviceStatusValues = computed(() => this.deviceStatuses.map(status => this.floorDevices().filter(device => device.status === status).length));
  readonly selectedSpaceId = signal(this.floorSpaces()[0]?.id ?? '');
  readonly selectedDeviceId = signal('');
  readonly selected = computed(() => this.floorSpaces().find(space => space.id === this.selectedSpaceId()) ?? this.floorSpaces()[0]);
  readonly selectedDevice = computed(() => this.floorSpaces().flatMap(space => space.devices).find(device => device.id === this.selectedDeviceId()));
  readonly view = signal<'2d' | '3d'>('2d');
  readonly zoom = signal(1);
  readonly detailTab = signal('Overview');
  readonly alertItems = signal<AlertListItem[]>([]);
  readonly recentAlerts = computed(() => this.alertItems().filter(alert => alert.location.floorId === this.floorId()).slice(0, 4));
  readonly selectedAlerts = computed(() => this.alertItems().filter(alert => alert.location.zoneId === this.selected()?.id).slice(0, 5));
  readonly buildingAlertCount = computed(() => this.alertItems().filter(alert => alert.location.buildingId === this.buildingId()).length);

  constructor() {
    this.alertService.getRecentAlerts('24h').subscribe(alerts => this.alertItems.set(alerts));
  }

  selectSpace(spaceId: string): void { this.selectedSpaceId.set(spaceId); this.selectedDeviceId.set(''); }
  selectDevice(deviceId: string, spaceId?: string): void {
    const device = this.floorSpaces().flatMap(space => space.devices).find(item => item.id === deviceId);
    if (!device) return;
    this.selectedDeviceId.set(device.id); this.selectedSpaceId.set(spaceId ?? device.spaceId);
  }
  selectSpaceKey(event: Event, spaceId: string): void { event.preventDefault(); this.selectSpace(spaceId); }
  zoomIn(): void { this.zoom.update(value => Math.min(3, Number((value + .25).toFixed(2)))); }
  zoomOut(): void { this.zoom.update(value => Math.max(.5, Number((value - .25).toFixed(2)))); }
  fit(): void { this.zoom.set(1); }
  chooseBuilding(buildingId: string): void {
    const building = this.store.getBuilding(buildingId);
    const firstFloor = [...(building?.floors ?? [])].sort((a, b) => a.level - b.level)[0];
    if (!building || !firstFloor) return;
    this.buildingId.set(building.id);
    this.floorId.set(firstFloor.id);
    this.selectedSpaceId.set(firstFloor.spaces[0]?.id ?? '');
    this.selectedDeviceId.set('');
    this.detailTab.set('Overview');
    void this.router.navigate(['/monitoring', building.id, 'floors', firstFloor.id]);
  }
  chooseFloor(floorId: string): void {
    this.floorId.set(floorId);
    this.selectedSpaceId.set(this.store.getFloor(this.buildingId(), floorId)?.spaces[0]?.id ?? '');
    this.selectedDeviceId.set('');
    void this.router.navigate(['/monitoring', this.buildingId(), 'floors', floorId]);
  }
  points(points: FloorPlanPoint[]): string { return points.map(point => `${point.x},${point.y}`).join(' '); }
  bounds(points: FloorPlanPoint[]) {
    const xs = points.map(point => point.x); const ys = points.map(point => point.y);
    const x = Math.min(...xs); const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  elementLabel(element: FloorPlanElement): string { return element.label ?? element.type; }
  deviceLetter(device: Device): string { return device.type.charAt(0); }
  deviceLabel(device: Device): string { return device.displayName || device.name; }
  devicePosition(devices: Device[], index: number): FloorPlanPoint | undefined { return visualDevicePosition(devices, index); }
  currentReading(type: string): string {
    const reading = this.selected()?.devices.find(device => device.type === type)?.readings.at(-1);
    return reading ? String(reading.value) : '—';
  }
  environmentalLabels(): string[] { return this.environmentalReadings().map(reading => reading.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); }
  environmentalValues(): number[] { return this.environmentalReadings().map(reading => reading.value); }
  environmentalUnit(): string { return this.environmentalReadings()[0]?.unit ?? (this.environmentalMetric() === 'Temperature' ? '°C' : 'ppm'); }
  spaceName(id: string): string {
    const space = this.store.spaces().find(item => item.id === id);
    return `${space?.name ?? 'Space'}${space?.roomNumber ? ' (Room ' + space.roomNumber + ')' : ''}`;
  }
  minutesAgo(alert: AlertListItem): number { return Math.max(1, Math.round((Date.now() - alert.generatedAt.getTime()) / 60000)); }
}
