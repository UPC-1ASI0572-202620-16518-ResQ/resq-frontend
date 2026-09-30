import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  Alert,
  Building,
  Device,
  DeviceCapability,
  DeviceStatusSummary,
  Floor,
  SensorReading,
  Space,
} from '../../core/models/resq.models';
import {
  AlertService,
  BuildingService,
  DeviceService,
  FloorService,
  SpaceService,
} from '../../core/services/data.services';
import {
  EmptyStateComponent,
  KpiCardComponent,
  LineChartComponent,
  LoadingStateComponent,
  StatusBadgeComponent,
} from '../../shared/ui/ui.components';

interface DeviceTableRow {
  device: Device;
  building?: Building;
  floor?: Floor;
  space?: Space;
}

@Component({
  selector: 'resq-devices-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    KpiCardComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis" aria-label="Device fleet summary">
      <resq-kpi-card icon="◉" [value]="summary().total" label="Total Devices" />
      <resq-kpi-card icon="✓" [value]="summary().online" label="Online" tone="green" />
      <resq-kpi-card
        icon="△"
        [value]="summary().warningDegraded"
        label="Warning / Degraded"
        tone="amber"
      />
      <resq-kpi-card icon="—" [value]="summary().offline" label="Offline" />
    </section>
    @if (loading()) {
      <resq-loading-state message="Loading devices..." />
    } @else if (loadError()) {
      <resq-empty-state
        title="Devices could not be loaded"
        message="Please refresh the page and try again."
      />
    } @else {
      <section class="filters" aria-label="Device filters">
        <label class="search-field"
          ><span>⌕</span><span class="sr-only">Search devices</span
          ><input
            [(ngModel)]="query"
            (ngModelChange)="applyFilters()"
            placeholder="Search name, code, model or serial..."
        /></label>
        <label
          ><span>Building</span
          ><select [(ngModel)]="buildingFilter" (ngModelChange)="buildingChanged()">
            <option value="">All buildings</option>
            @for (building of buildings; track building.id) {
              <option [value]="building.id">{{ building.name }}</option>
            }
          </select></label
        >
        <label
          ><span>Floor</span
          ><select [(ngModel)]="floorFilter" (ngModelChange)="floorChanged()">
            <option value="">All floors</option>
            @for (floor of availableFloors(); track floor.id) {
              <option [value]="floor.id">{{ floor.name }}</option>
            }
          </select></label
        >
        <label
          ><span>Space / Zone</span
          ><select [(ngModel)]="spaceFilter" (ngModelChange)="applyFilters()">
            <option value="">All spaces</option>
            @for (space of availableSpaces(); track space.id) {
              <option [value]="space.id">
                {{ space.name }}{{ space.roomNumber ? ' · ' + space.roomNumber : '' }}
              </option>
            }
          </select></label
        >
        <label
          ><span>Administrative status</span
          ><select [(ngModel)]="administrativeFilter" (ngModelChange)="applyFilters()">
            <option value="">All statuses</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
            <option>RETIRED</option>
          </select></label
        >
        <label
          ><span>Connectivity</span
          ><select [(ngModel)]="connectivityFilter" (ngModelChange)="applyFilters()">
            <option value="">All connectivity</option>
            <option>ONLINE</option>
            <option>OFFLINE</option>
          </select></label
        >
        <label
          ><span>Capability</span
          ><select [(ngModel)]="capabilityFilter" (ngModelChange)="applyFilters()">
            <option value="">All capabilities</option>
            @for (capability of capabilities; track capability.code) {
              <option [value]="capability.code">{{ capability.name }}</option>
            }
          </select></label
        >
        <button type="button" class="reset" (click)="resetFilters()">Reset filters</button>
      </section>
      <div class="result-summary">
        <b>{{ filteredCount() }} devices</b
        ><span
          >Filtered from {{ summary().total }} registered physical devices · Mock data updated
          moments ago</span
        >
      </div>
      <section class="table-card" aria-label="Registered devices">
        <div class="table-scroll">
          <table mat-table [dataSource]="dataSource" matSort>
            <ng-container matColumnDef="device"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Device</th>
              <td mat-cell *matCellDef="let row">
                <span class="device-icon" aria-hidden="true">◉</span
                ><span class="primary-cell"
                  ><b>{{ row.device.name }}</b
                  ><small>{{ row.device.description }}</small></span
                >
              </td></ng-container
            >
            <ng-container matColumnDef="code"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th>
              <td mat-cell *matCellDef="let row">
                <code>{{ row.device.deviceCode }}</code>
              </td></ng-container
            >
            <ng-container matColumnDef="model"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Model</th>
              <td mat-cell *matCellDef="let row">
                {{ row.device.specifications.model }}
              </td></ng-container
            >
            <ng-container matColumnDef="location"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Location</th>
              <td mat-cell *matCellDef="let row">
                <span class="primary-cell"
                  ><b>{{ row.building?.name || 'Unassigned' }}</b
                  ><small>{{ row.floor?.name || '—' }} · {{ row.space?.name || '—' }}</small></span
                >
              </td></ng-container
            >
            <ng-container matColumnDef="capabilities"
              ><th mat-header-cell *matHeaderCellDef>Capabilities</th>
              <td mat-cell *matCellDef="let row">
                <div class="capability-chips">
                  @for (capability of row.device.capabilities.slice(0, 2); track capability.id) {
                    <span>{{ shortCapability(capability) }}</span>
                  }
                  @if (row.device.capabilities.length > 2) {
                    <span>+{{ row.device.capabilities.length - 2 }}</span>
                  }
                </div>
              </td></ng-container
            >
            <ng-container matColumnDef="administrative"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Administrative</th>
              <td mat-cell *matCellDef="let row">
                <resq-status-badge [status]="row.device.administrativeStatus" /></td
            ></ng-container>
            <ng-container matColumnDef="connectivity"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Connectivity</th>
              <td mat-cell *matCellDef="let row">
                <div class="status-stack">
                  <resq-status-badge [status]="row.device.connectivityStatus" /><small
                    >{{ titleCase(row.device.healthStatus) }} health</small
                  >
                </div>
              </td></ng-container
            >
            <ng-container matColumnDef="reading"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Latest Reading</th>
              <td mat-cell *matCellDef="let row">
                <b>{{ latestReading(row.device) }}</b>
              </td></ng-container
            >
            <ng-container matColumnDef="signal"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Signal</th>
              <td mat-cell *matCellDef="let row">
                {{
                  row.device.signalStrength !== undefined ? row.device.signalStrength + ' dBm' : '—'
                }}
              </td></ng-container
            >
            <ng-container matColumnDef="lastSeen"
              ><th mat-header-cell *matHeaderCellDef mat-sort-header>Last Seen</th>
              <td mat-cell *matCellDef="let row">
                {{ relativeTime(row.device.lastSeen) }}
              </td></ng-container
            >
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: displayedColumns"
              tabindex="0"
              [attr.aria-label]="'Open ' + row.device.name"
              (click)="openDevice(row.device)"
              (keydown.enter)="openDevice(row.device)"
              (keydown.space)="openDevice(row.device); $event.preventDefault()"
            ></tr>
          </table>
        </div>
        @if (!filteredCount()) {
          <resq-empty-state
            title="No devices found"
            message="Try adjusting or resetting the filters."
          />
        }
        <mat-paginator
          [pageSize]="25"
          [pageSizeOptions]="[25, 50, 100]"
          showFirstLastButtons
          aria-label="Device table pagination"
        />
      </section>
    }
  `,
  styleUrl: './devices.pages.scss',
})
export class DevicesPage implements OnInit {
  private readonly deviceService = inject(DeviceService);
  private readonly buildingService = inject(BuildingService);
  private readonly floorService = inject(FloorService);
  private readonly spaceService = inject(SpaceService);
  private readonly router = inject(Router);
  @ViewChild(MatSort) set matSort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator | undefined) {
    if (paginator) this.dataSource.paginator = paginator;
  }
  readonly displayedColumns = [
    'device',
    'code',
    'model',
    'location',
    'capabilities',
    'administrative',
    'connectivity',
    'reading',
    'signal',
    'lastSeen',
  ];
  readonly dataSource = new MatTableDataSource<DeviceTableRow>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly filteredCount = signal(0);
  readonly summary = signal<DeviceStatusSummary>({
    total: 0,
    online: 0,
    warningDegraded: 0,
    offline: 0,
  });
  buildings: Building[] = [];
  floors: Floor[] = [];
  spaces: Space[] = [];
  capabilities: Array<{ code: string; name: string }> = [];
  private rows: DeviceTableRow[] = [];
  query = '';
  buildingFilter = '';
  floorFilter = '';
  spaceFilter = '';
  administrativeFilter = '';
  connectivityFilter = '';
  capabilityFilter = '';

  ngOnInit(): void {
    forkJoin({
      devices: this.deviceService.getDevices(),
      buildings: this.buildingService.getBuildings(),
      floors: this.floorService.getFloors(),
      spaces: this.spaceService.getSpaces(),
      summary: this.deviceService.getStatusSummary(),
    })
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of(undefined);
        }),
      )
      .subscribe((result) => {
        if (!result) {
          this.loading.set(false);
          return;
        }
        this.buildings = result.buildings;
        this.floors = result.floors;
        this.spaces = result.spaces;
        this.summary.set(result.summary);
        this.rows = result.devices.map((device) => ({
          device,
          building: result.buildings.find((item) => item.id === device.assignment.buildingId),
          floor: result.floors.find((item) => item.id === device.assignment.floorId),
          space: result.spaces.find((item) => item.id === device.assignment.spaceId),
        }));
        const capabilityMap = new Map<string, string>();
        result.devices
          .flatMap((device) => device.capabilities)
          .forEach((capability) => capabilityMap.set(capability.code, capability.name));
        this.capabilities = [...capabilityMap]
          .map(([code, name]) => ({ code, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.configureSorting();
        this.applyFilters();
        this.loading.set(false);
      });
  }
  availableFloors(): Floor[] {
    return this.floors.filter(
      (floor) => !this.buildingFilter || floor.buildingId === this.buildingFilter,
    );
  }
  availableSpaces(): Space[] {
    return this.spaces.filter(
      (space) =>
        (!this.buildingFilter || space.buildingId === this.buildingFilter) &&
        (!this.floorFilter || space.floorId === this.floorFilter),
    );
  }
  buildingChanged(): void {
    this.floorFilter = '';
    this.spaceFilter = '';
    this.applyFilters();
  }
  floorChanged(): void {
    this.spaceFilter = '';
    this.applyFilters();
  }
  applyFilters(): void {
    const query = this.query.trim().toLowerCase();
    const filtered = this.rows.filter(({ device }) => {
      const searchable =
        `${device.name} ${device.deviceCode} ${device.specifications.model} ${device.specifications.serialNumber}`.toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!this.buildingFilter || device.assignment.buildingId === this.buildingFilter) &&
        (!this.floorFilter || device.assignment.floorId === this.floorFilter) &&
        (!this.spaceFilter || device.assignment.spaceId === this.spaceFilter) &&
        (!this.administrativeFilter || device.administrativeStatus === this.administrativeFilter) &&
        (!this.connectivityFilter || device.connectivityStatus === this.connectivityFilter) &&
        (!this.capabilityFilter ||
          device.capabilities.some((capability) => capability.code === this.capabilityFilter))
      );
    });
    this.dataSource.data = filtered;
    this.filteredCount.set(filtered.length);
    this.dataSource.paginator?.firstPage();
  }
  resetFilters(): void {
    this.query = this.buildingFilter = this.floorFilter = this.spaceFilter = '';
    this.administrativeFilter = this.connectivityFilter = this.capabilityFilter = '';
    this.applyFilters();
  }
  openDevice(device: Device): void {
    void this.router.navigate(['/devices', device.id]);
  }
  latestReading(device: Device): string {
    const reading = device.readings.at(-1);
    return reading ? `${reading.value} ${reading.unit}` : 'No readings';
  }
  shortCapability(capability: DeviceCapability): string {
    return capability.name.replace(' Measurement', '').replace(' Status', '');
  }
  titleCase(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }
  relativeTime(date: Date): string {
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
    return `${Math.round(minutes / 1_440)}d ago`;
  }
  private configureSorting(): void {
    this.dataSource.sortingDataAccessor = (row, column) => {
      const values: Record<string, string | number> = {
        device: row.device.name,
        code: row.device.deviceCode,
        model: row.device.specifications.model,
        location: `${row.building?.name ?? ''} ${row.floor?.name ?? ''} ${row.space?.name ?? ''}`,
        administrative: row.device.administrativeStatus,
        connectivity: row.device.connectivityStatus,
        reading: row.device.readings.at(-1)?.value ?? -Infinity,
        signal: row.device.signalStrength ?? -Infinity,
        lastSeen: row.device.lastSeen.getTime(),
      };
      return values[column] ?? '';
    };
  }
}

@Component({
  selector: 'resq-device-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    LineChartComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <resq-loading-state message="Loading device..." />
    } @else if (loadError()) {
      <resq-empty-state
        title="Device could not be loaded"
        message="Please refresh the page and try again."
      />
    } @else if (device(); as current) {
      <header class="detail-head">
        <div>
          <a routerLink="/devices">← Devices</a>
          <div class="device-title">
            <span class="device-mark" aria-hidden="true">◉</span>
            <div>
              <div class="title-line">
                <h2>{{ current.name }}</h2>
                <code>{{ current.deviceCode }}</code>
              </div>
              <div class="badges">
                <resq-status-badge [status]="current.administrativeStatus" /><resq-status-badge
                  [status]="current.connectivityStatus"
                /><resq-status-badge [status]="current.healthStatus" />
              </div>
              <p>{{ current.description }}</p>
            </div>
          </div>
        </div>
      </header>
      <section class="stats" aria-label="Device summary">
        <article>
          <span>Current Reading</span><b>{{ latestReading() }}</b
          ><small>{{ measurementCapability()?.name || 'Latest device measurement' }}</small>
        </article>
        <article>
          <span>Power</span><b>{{ current.power.source }}</b
          ><small>{{ powerStatus(current) }}</small>
        </article>
        <article>
          <span>Signal Strength</span
          ><b>{{
            current.signalStrength !== undefined ? current.signalStrength + ' dBm' : 'Unavailable'
          }}</b
          ><small>{{ connectionQuality(current.signalStrength) }} connection</small>
        </article>
        <article>
          <span>Last Seen</span><b>{{ relativeTime(current.lastSeen) }}</b
          ><small>Last device heartbeat</small>
        </article>
      </section>
      <main class="detail-grid">
        <article class="card chart-card">
          <div class="card-head">
            <div>
              <h3>Reading History</h3>
              <p>Device telemetry · {{ measurementCapability()?.name || 'Measurement' }}</p>
            </div>
            <label
              ><span class="sr-only">Reading history period</span
              ><select aria-label="Reading history period">
                <option>Last 24 Hours</option>
                <option disabled>Last 7 Days — coming soon</option>
                <option disabled>Last 30 Days — coming soon</option>
              </select></label
            >
          </div>
          @if (measurements().length) {
            <resq-line-chart
              [labels]="chartLabels()"
              [values]="chartValues()"
              [datasetLabel]="measurementCapability()?.name || 'Reading'"
              [unit]="measurements()[0].unit"
            />
          } @else {
            <resq-empty-state
              title="No readings available"
              message="Telemetry has not been received for this device."
            />
          }
        </article>
        <aside class="card hardware-card">
          <div class="card-head">
            <div>
              <h3>Hardware Reference</h3>
              <p>Physical device and installed components</p>
            </div>
          </div>
          <div class="hardware-image">
            @if (current.hardwareImageUrl && !imageFailed()) {
              <img
                [src]="current.hardwareImageUrl"
                [alt]="current.name + ' hardware'"
                (error)="imageFailed.set(true)"
              />
            } @else {
              <div class="hardware-fallback">
                <span aria-hidden="true">▦</span><b>{{ current.name }}</b
                ><small>Hardware photo pending</small>
              </div>
            }
          </div>
          <h4>{{ current.name }}</h4>
          <p class="hardware-summary">{{ hardwareSummary(current) }}</p>
          <button
            type="button"
            class="components-toggle"
            [attr.aria-expanded]="componentsOpen()"
            (click)="componentsOpen.update((value) => !value)"
          >
            {{ componentsOpen() ? 'Hide components' : 'View components' }}
            <span>{{ componentsOpen() ? '⌃' : '⌄' }}</span>
          </button>
          @if (componentsOpen()) {
            <div class="component-list">
              @for (component of current.hardwareComponents; track component.name) {
                <div>
                  <span aria-hidden="true">▦</span>
                  <p>
                    <b>{{ component.name }}</b
                    ><small>{{ component.role }}</small>
                  </p>
                </div>
              }
            </div>
            @if (current.assemblyComponents?.length) {
              <div class="assembly">
                <b>Prototype Assembly Components</b>
                <p>{{ current.assemblyComponents?.join(' · ') }}</p>
              </div>
            }
          }
        </aside>
        <article class="card capabilities-card">
          <div class="card-head">
            <div>
              <h3>Device Capabilities</h3>
              <p>
                {{ current.capabilities.length }} capabilities registered for this physical device
              </p>
            </div>
          </div>
          <div class="capability-list">
            @for (capability of capabilities(); track capability.id) {
              <div>
                <span
                  class="capability-icon"
                  [class.actuation]="capability.kind === 'ACTUATION'"
                  aria-hidden="true"
                  >{{ capability.kind === 'MEASUREMENT' ? '⌁' : '⚡' }}</span
                >
                <div>
                  <b>{{ capability.name }}</b
                  ><small
                    >{{ capability.hardware
                    }}{{ capability.unit ? ' · ' + capability.unit : '' }}</small
                  >
                </div>
                <em [class.actuation]="capability.kind === 'ACTUATION'">{{ capability.kind }}</em>
              </div>
            }
          </div>
        </article>
        <aside class="card info-card">
          <h3>Assigned Location</h3>
          <div class="location">
            <span aria-hidden="true">▥</span>
            <div>
              <b>{{ building()?.name || 'Unassigned' }}</b
              ><small
                >{{ floor()?.name || '—' }} · {{ space()?.name || '—'
                }}{{ space()?.roomNumber ? ' · Room ' + space()?.roomNumber : '' }}</small
              >
            </div>
          </div>
          @if (building() && floor()) {
            <a [routerLink]="['/monitoring', building()!.id, 'floors', floor()!.id]"
              >Open in Floor Monitoring →</a
            >
          }
          <h3>Technical Information</h3>
          <dl>
            <dt>Device Code</dt>
            <dd>{{ current.deviceCode }}</dd>
            <dt>Model</dt>
            <dd>{{ current.specifications.model }}</dd>
            @if (current.specifications.controller) {
              <dt>Controller</dt>
              <dd>{{ current.specifications.controller }}</dd>
            }
            @if (current.specifications.board) {
              <dt>Board</dt>
              <dd>{{ current.specifications.board }}</dd>
            }
            <dt>Firmware</dt>
            <dd>{{ current.specifications.firmware }}</dd>
            <dt>Serial Number</dt>
            <dd>{{ current.specifications.serialNumber }}</dd>
            <dt>Protocol</dt>
            <dd>{{ current.specifications.protocol }}</dd>
            <dt>Power Source</dt>
            <dd>{{ current.power.source }}</dd>
            <dt>Edge Integration</dt>
            <dd>{{ current.specifications.edgeIntegration || '—' }}</dd>
            <dt>Sampling Interval</dt>
            <dd>{{ current.specifications.samplingIntervalSeconds }} seconds</dd>
          </dl>
        </aside>
        <article class="card alerts-card">
          <div class="card-head">
            <div>
              <h3>Device Alerts</h3>
              <p>Alerts reported specifically by {{ current.deviceCode }}</p>
            </div>
          </div>
          @if (alerts().length) {
            @for (alert of alerts(); track alert.id) {
              <a [routerLink]="['/alerts', alert.id]"
                ><span
                  class="alert-icon"
                  [class.warning]="alert.severity === 'Warning'"
                  [class.info]="alert.severity === 'Info'"
                  aria-hidden="true"
                  >!</span
                >
                <div>
                  <b>{{ alert.title }}</b
                  ><small>{{ alert.severity }} · {{ relativeTime(alert.timestamp) }}</small>
                </div>
                <resq-status-badge [status]="alert.status" /><span aria-hidden="true">›</span></a
              >
            }
          } @else {
            <resq-empty-state
              title="No alerts for this device"
              message="There are no device-specific alerts in the current mock data."
            />
          }
        </article>
        <aside class="side-stack">
          <article class="card connectivity-card">
            <h3>Connectivity</h3>
            <dl>
              <dt>Status</dt>
              <dd><resq-status-badge [status]="current.connectivityStatus" /></dd>
              <dt>Wi-Fi RSSI</dt>
              <dd>
                {{
                  current.signalStrength !== undefined
                    ? current.signalStrength + ' dBm'
                    : 'Unavailable'
                }}
              </dd>
              <dt>Last Heartbeat</dt>
              <dd>{{ relativeTime(current.lastSeen) }}</dd>
              <dt>Connection Quality</dt>
              <dd>
                <span
                  class="quality-dot"
                  [class.offline]="current.connectivityStatus === 'OFFLINE'"
                ></span
                >{{ connectionQuality(current.signalStrength) }}
              </dd>
            </dl>
          </article>
          <article class="card calibration-card">
            <h3>Sensor Health / Calibration</h3>
            @if (current.maintenance?.calibrationStatus; as calibration) {
              <resq-status-badge [status]="calibration" [label]="calibrationLabel(calibration)" />
            }
            <p>
              {{
                current.maintenance?.calibrationNote ||
                  'No device-specific calibration note is required.'
              }}
            </p>
            @if (current.maintenance?.lastInspection) {
              <small>Last inspected {{ dateLabel(current.maintenance!.lastInspection!) }}</small>
            }
          </article>
        </aside>
      </main>
    } @else {
      <div class="not-found">
        <span aria-hidden="true">◇</span>
        <h2>Device Not Found</h2>
        <p>The requested device does not exist or is no longer available.</p>
        <a routerLink="/devices">Back to Devices</a>
      </div>
    }
  `,
  styleUrl: './device-detail.page.scss',
})
export class DeviceDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly deviceService = inject(DeviceService);
  private readonly buildingService = inject(BuildingService);
  private readonly floorService = inject(FloorService);
  private readonly spaceService = inject(SpaceService);
  private readonly alertService = inject(AlertService);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly device = signal<Device | undefined>(undefined);
  readonly building = signal<Building | undefined>(undefined);
  readonly floor = signal<Floor | undefined>(undefined);
  readonly space = signal<Space | undefined>(undefined);
  readonly capabilities = signal<DeviceCapability[]>([]);
  readonly measurements = signal<SensorReading[]>([]);
  readonly alerts = signal<Alert[]>([]);
  readonly componentsOpen = signal(false);
  readonly imageFailed = signal(false);
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('deviceId') ?? '';
    this.deviceService
      .getDeviceById(id)
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of(undefined);
        }),
      )
      .subscribe((device) => {
        this.device.set(device);
        if (!device) {
          this.loading.set(false);
          return;
        }
        forkJoin({
          building: this.buildingService.getBuildingById(device.assignment.buildingId),
          floor: this.floorService.getFloorById(device.assignment.floorId),
          space: this.spaceService.getSpaceById(device.assignment.spaceId),
          capabilities: this.deviceService.getDeviceCapabilities(device.id),
          measurements: this.deviceService.getDeviceMeasurements(device.id),
          alerts: this.alertService.getAlertsByDevice(device.id),
        })
          .pipe(
            catchError(() => {
              this.loadError.set(true);
              return of(undefined);
            }),
          )
          .subscribe((result) => {
            if (result) {
              this.building.set(result.building);
              this.floor.set(result.floor);
              this.space.set(result.space);
              this.capabilities.set(result.capabilities);
              this.measurements.set(result.measurements);
              this.alerts.set(result.alerts.slice(0, 6));
            }
            this.loading.set(false);
          });
      });
  }
  measurementCapability(): DeviceCapability | undefined {
    return this.capabilities().find((capability) => capability.kind === 'MEASUREMENT');
  }
  latestReading(): string {
    const reading = this.measurements().at(-1);
    return reading ? `${reading.value} ${reading.unit}` : 'No reading';
  }
  chartLabels(): string[] {
    return this.measurements().map((reading) =>
      reading.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    );
  }
  chartValues(): number[] {
    return this.measurements().map((reading) => reading.value);
  }
  relativeTime(date: Date): string {
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
    return `${Math.round(minutes / 1_440)}d ago`;
  }
  connectionQuality(signal?: number): string {
    if (signal === undefined) return 'Offline';
    if (signal >= -60) return 'Good';
    if (signal >= -75) return 'Fair';
    return 'Weak';
  }
  powerStatus(device: Device): string {
    return `${device.power.status === 'POWERED' ? 'Powered' : device.power.status === 'ON_BATTERY' ? 'On battery' : 'Unpowered'}${device.power.batteryPercentage !== undefined ? ` · ${device.power.batteryPercentage}%` : ''}`;
  }
  hardwareSummary(device: Device): string {
    return device.id === 'resq-mvp-001'
      ? 'ESP32 DevKit V1 + MQ-2 + OLED + Buzzer + Status LEDs'
      : `${device.specifications.model} · demo hardware`;
  }
  calibrationLabel(value: string): string {
    return value
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
  dateLabel(date: Date): string {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
