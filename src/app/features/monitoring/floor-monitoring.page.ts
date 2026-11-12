import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Device,
  DeviceType,
  FloorPlanElement,
  FloorPlanPoint,
} from '../../core/models/resq.models';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { FloorPlanLocalStorageService } from '../../core/services/floor-plan-local-storage.service';
import {
  AlertWorkspaceFacade,
  AlertWorkspaceRow,
} from '../alerts/alert-workspace.facade';
import {
  DoughnutChartComponent,
  KpiCardComponent,
  LineChartComponent,
  StatusBadgeComponent,
} from '../../shared/ui/ui.components';
import { ThreeFloorViewerComponent } from './three-floor-viewer/three-floor-viewer.component';
import { visualDevicePosition } from '../../shared/utils/floor-plan-device.utils';
import {
  deviceDefinition,
  sensorDefinitions,
} from '../../core/models/device-domain';
import { SensorHistoryComponent } from '../../shared/ui/sensor-history.component';

@Component({
  selector: 'resq-floor-monitoring',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    KpiCardComponent,
    DoughnutChartComponent,
    LineChartComponent,
    StatusBadgeComponent,
    ThreeFloorViewerComponent,
    SensorHistoryComponent,
  ],
  templateUrl: './floor-monitoring.page.html',
  styleUrls: [
    './floor-monitoring.page.scss',
    './floor-monitoring.typography.scss',
    './floor-monitoring.renderer.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorMonitoringPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertWorkspace = inject(AlertWorkspaceFacade);
  private readonly snack = inject(MatSnackBar);
  readonly store = inject(BuildingStoreService);
  private readonly localPlans = inject(FloorPlanLocalStorageService);
  private readonly restoredPlanKeys = new Set<string>();
  readonly buildingId = signal(this.route.snapshot.paramMap.get('buildingId') ?? '');
  readonly floorId = signal(this.route.snapshot.paramMap.get('floorId') ?? '');
  readonly building = computed(() => this.store.getBuilding(this.buildingId()));
  readonly floor = computed(() => this.store.getFloor(this.buildingId(), this.floorId()));
  readonly sortedFloors = computed(() =>
    [...(this.building()?.floors ?? [])].sort((a, b) => a.level - b.level),
  );
  readonly visibleFloors = computed(() => {
    const selectedLevel = this.floor()?.level;
    return selectedLevel === undefined
      ? []
      : this.sortedFloors().filter((item) => item.level <= selectedLevel);
  });
  readonly floorSpaces = computed(() => this.floor()?.spaces ?? []);
  readonly buildingSpaces = computed(
    () => this.building()?.floors.flatMap((item) => item.spaces) ?? [],
  );
  readonly buildingDevices = computed(() => {
    const ids = new Set(this.buildingSpaces().map((space) => space.id));
    return this.store.devices().filter((device) => ids.has(device.spaceId));
  });
  readonly buildingConnectedDevices = computed(
    () => this.buildingDevices().filter((device) => device.connectivityStatus === 'ONLINE').length,
  );
  readonly floorDevices = computed(() => this.floorSpaces().flatMap((space) => space.devices));
  readonly environmentalMetric = signal<DeviceType>('Temperature');
  readonly environmentalMetrics: DeviceType[] = sensorDefinitions
    .filter((item) => item.type !== 'Motion')
    .map((item) => item.type);
  readonly environmentalReadings = computed(() =>
    this.floorDevices()
      .flatMap((device) => device.readings)
      .filter(
        (reading) =>
          reading.metric === this.environmentalMetric() &&
          reading.unit === deviceDefinition(this.environmentalMetric()).unit,
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-24),
  );
  readonly deviceStatuses = ['Online', 'Warning', 'Critical', 'Offline'] as const;
  readonly deviceStatusValues = computed(() =>
    this.deviceStatuses.map(
      (status) => this.floorDevices().filter((device) => device.status === status).length,
    ),
  );
  readonly selectedSpaceId = signal(this.floorSpaces()[0]?.id ?? '');
  readonly selectedDeviceId = signal('');
  readonly selected = computed(
    () =>
      this.floorSpaces().find((space) => space.id === this.selectedSpaceId()) ??
      this.floorSpaces()[0],
  );
  readonly selectedDevice = computed(() =>
    this.floorSpaces()
      .flatMap((space) => space.devices)
      .find((device) => device.id === this.selectedDeviceId()),
  );
  readonly view = signal<'2d' | '3d'>('2d');
  readonly zoom = signal(1);
  readonly detailTab = signal('Overview');
  readonly alertItems = this.alertWorkspace.rows;
  readonly recentAlerts = computed(() => {
    const floorZoneIds = new Set(this.floorSpaces().map((space) => space.id));
    return this.alertItems()
      .filter(
        (alert) =>
          alert.status === 'ACTIVE' &&
          !!alert.location.zoneId &&
          floorZoneIds.has(alert.location.zoneId),
      )
      .slice(0, 4);
  });
  readonly selectedAlerts = computed(() =>
    this.alertItems()
      .filter(
        (alert) => alert.status === 'ACTIVE' && alert.location.zoneId === this.selected()?.id,
      )
      .slice(0, 5),
  );
  readonly buildingAlertCount = computed(
    () =>
      this.alertItems().filter(
        (alert) =>
          alert.status === 'ACTIVE' && alert.location.buildingId === this.buildingId(),
      ).length,
  );
  readonly lastSimulation = signal('');

  constructor() {
    this.alertWorkspace.loadAlerts().subscribe();
    // The sidebar links to /monitoring without route parameters.
    // Resolve it to an actual API-backed floor once buildings arrive.
    effect(() => {
      if (this.route.snapshot.paramMap.has('buildingId')) return;
      if (this.buildingId()) return;
      const building = this.store.buildings().find((item) => item.floors.length > 0);
      const floor = building?.floors[0];
      if (!building || !floor) return;
      this.buildingId.set(building.id);
      this.floorId.set(floor.id);
      void this.router.navigate(['/monitoring', building.id, 'floors', floor.id], { replaceUrl: true });
    });
    effect(() => {
      const buildingId = this.buildingId();
      const floorId = this.floorId();
      const floor = this.store.getFloor(buildingId, floorId);
      if (!floor) return;
      const key = `${buildingId}:${floorId}`;
      if (this.restoredPlanKeys.has(key)) return;
      this.restoredPlanKeys.add(key);
      this.localPlans.restoreToStore(this.store, buildingId, floorId);
    });
  }

  selectSpace(spaceId: string): void {
    this.selectedSpaceId.set(spaceId);
    this.selectedDeviceId.set('');
  }
  selectDevice(deviceId: string, spaceId?: string): void {
    const device = this.floorSpaces()
      .flatMap((space) => space.devices)
      .find((item) => item.id === deviceId);
    if (!device) return;
    this.selectedDeviceId.set(device.id);
    this.selectedSpaceId.set(spaceId ?? device.spaceId);
  }
  selectSpaceKey(event: Event, spaceId: string): void {
    event.preventDefault();
    this.selectSpace(spaceId);
  }
  zoomIn(): void {
    this.zoom.update((value) => Math.min(3, Number((value + 0.25).toFixed(2))));
  }
  zoomOut(): void {
    this.zoom.update((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
  }
  fit(): void {
    this.zoom.set(1);
  }
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
  points(points: FloorPlanPoint[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  }
  bounds(points: FloorPlanPoint[]) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  elementLabel(element: FloorPlanElement): string {
    return element.label ?? element.type;
  }
  isStairSpace(type: string): boolean {
    return type === 'Stairs';
  }
  deviceLetter(device: Device): string {
    return device.type.charAt(0);
  }
  deviceLabel(device: Device): string {
    return device.displayName || device.name;
  }
  devicePosition(devices: Device[], index: number): FloorPlanPoint | undefined {
    return visualDevicePosition(devices, index);
  }
  currentReading(type: string): string {
    const reading = this.selected()
      ?.devices.find((device) => device.type === type)
      ?.readings.at(-1);
    return reading ? `${reading.value} ${reading.unit}` : '—';
  }
  environmentalLabels(): string[] {
    return this.environmentalReadings().map((reading) =>
      reading.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    );
  }
  environmentalValues(): number[] {
    return this.environmentalReadings().map((reading) => reading.value);
  }
  environmentalUnit(): string {
    return deviceDefinition(this.environmentalMetric()).unit ?? '';
  }
  spaceName(id: string): string {
    const space = this.store.spaces().find((item) => item.id === id);
    return `${space?.name ?? 'Space'}${space?.roomNumber ? ' (Room ' + space.roomNumber + ')' : ''}`;
  }
  minutesAgo(alert: AlertWorkspaceRow): number {
    return Math.max(1, Math.round((Date.now() - alert.generatedAt.getTime()) / 60000));
  }
  simulateGas(value: number): void {
    void value;
    this.snack.open('Telemetry simulation is disabled when using the real backend.', 'Close', { duration: 3500 });
  }
}
