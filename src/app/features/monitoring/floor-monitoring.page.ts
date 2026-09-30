import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Alert, Device, FloorPlanElement, FloorPlanPoint } from '../../core/models/resq.models';
import { ALERTS } from '../../core/mock-data/resq.mock';
import { BuildingStoreService } from '../../core/services/building-store.service';
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
  readonly store = inject(BuildingStoreService);
  readonly buildingId = this.route.snapshot.paramMap.get('buildingId') ?? 'science';
  readonly floorId = signal(this.route.snapshot.paramMap.get('floorId') ?? 'science-f2');
  readonly building = computed(() => this.store.getBuilding(this.buildingId));
  readonly floor = computed(() => this.store.getFloor(this.buildingId, this.floorId()));
  readonly floorSpaces = computed(() => this.floor()?.spaces ?? []);
  readonly selectedSpaceId = signal(this.floorSpaces()[0]?.id ?? '');
  readonly selectedDeviceId = signal('');
  readonly selected = computed(() => this.floorSpaces().find(space => space.id === this.selectedSpaceId()) ?? this.floorSpaces()[0]);
  readonly selectedDevice = computed(() => this.floorSpaces().flatMap(space => space.devices).find(device => device.id === this.selectedDeviceId()));
  readonly view = signal<'2d' | '3d'>('2d');
  readonly zoom = signal(1);
  readonly detailTab = signal('Overview');
  readonly recentAlerts = computed(() => ALERTS.filter(alert => alert.floorId === this.floorId()).slice(0, 4));
  readonly selectedAlerts = computed(() => ALERTS.filter(alert => alert.spaceId === this.selected()?.id).slice(0, 5));

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
  chooseFloor(floorId: string): void {
    this.floorId.set(floorId);
    this.selectedSpaceId.set(this.store.getFloor(this.buildingId, floorId)?.spaces[0]?.id ?? '');
    this.selectedDeviceId.set('');
    void this.router.navigate(['/monitoring', this.buildingId, 'floors', floorId]);
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
  spaceName(id: string): string {
    const space = this.store.spaces().find(item => item.id === id);
    return `${space?.name ?? 'Space'}${space?.roomNumber ? ' (Room ' + space.roomNumber + ')' : ''}`;
  }
  minutesAgo(alert: Alert): number { return Math.max(1, Math.round((Date.now() - alert.timestamp.getTime()) / 60000)); }
}
