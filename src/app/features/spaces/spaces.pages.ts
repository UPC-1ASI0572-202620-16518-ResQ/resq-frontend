import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import {
  SensitivityLevel,
  Space,
  SpaceThresholds,
} from '../../core/models/resq.models';
import { SpaceService } from '../../core/services/data.services';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { SensorResponseService } from '../../core/services/sensor-response.service';
import { SensorHistoryComponent } from '../../shared/ui/sensor-history.component';
import { ResponseActivityComponent } from '../../shared/ui/response-activity.component';
import {
  capabilityCategory,
  capabilityDefinition,
  sensorDefinitions,
} from '../../core/models/device-domain';
import { StatusBadgeComponent } from '../../shared/ui/ui.components';
import { AlertWorkspaceFacade } from '../alerts/alert-workspace.facade';
import {
  RISK_DETECTION_GATEWAY,
  ComparisonOperator,
  DetectionRuleRecord,
  RiskDetectionGateway,
} from '../risk-detection/data-access/risk-detection.gateway';

@Component({
  selector: 'resq-spaces-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters">
      <label class="search"
        ><mat-icon>search</mat-icon
        ><input
          [(ngModel)]="query"
          (ngModelChange)="apply()"
          placeholder="Search rooms or spaces..." /></label
      ><select [(ngModel)]="building" (ngModelChange)="apply()">
        <option value="">All buildings</option>
        @for (item of buildings(); track item.id) {
          <option [value]="item.id">{{ item.name }}</option>
        }</select
      ><select [(ngModel)]="type" (ngModelChange)="apply()">
        <option value="">All types</option>
        @for (item of types; track item) {
          <option>{{ item }}</option>
        }</select
      ><select [(ngModel)]="risk" (ngModelChange)="apply()">
        <option value="">All risk levels</option>
        <option>Normal</option>
        <option>Warning</option>
        <option>Critical</option>
        <option>Offline</option>
      </select>
      <div class="views">
        <button
          aria-label="Card view"
          [class.active]="view() === 'cards'"
          (click)="view.set('cards')"
        >
          <mat-icon>grid_view</mat-icon></button
        ><button
          aria-label="Table view"
          [class.active]="view() === 'table'"
          (click)="view.set('table')"
        >
          <mat-icon>table_rows</mat-icon>
        </button>
      </div>
    </div>
    <div class="result-count">
      <b>{{ filtered().length }} spaces</b><span>Data from the ResQ API</span>
    </div>
    @if (view() === 'cards') {
      <div class="space-grid">
        @for (space of filtered(); track space.id) {
          <a [routerLink]="'/spaces/' + space.id"
            ><div class="card-head">
              <span class="type-icon">{{ icon(space) }}</span
              ><resq-status-badge [status]="space.status" />
            </div>
            <h3>{{ space.name }}</h3>
            <p>Room {{ space.roomNumber || '—' }} · {{ space.type }}</p>
            <div class="location">
              ▥ {{ buildingName(space.buildingId) }} <span>›</span> {{ floorName(space.floorId) }}
            </div>
            <div class="space-stats">
              <span
                ><b>{{ space.devices.length }}</b
                >Devices</span
              ><span
                ><b>{{ space.sensitivity }}</b
                >Sensitivity</span
              ><span
                ><b>{{ alertCount(space.id) }}</b
                >Alerts</span
              >
            </div>
            <footer>Open space details <span>→</span></footer></a
          >
        }
      </div>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Space</th>
              <th>Type</th>
              <th>Building</th>
              <th>Floor</th>
              <th>Sensitivity</th>
              <th>Risk</th>
              <th>Devices</th>
              <th>Alerts</th>
            </tr>
          </thead>
          <tbody>
            @for (space of filtered(); track space.id) {
              <tr [routerLink]="'/spaces/' + space.id">
                <td>
                  <b>{{ space.name }}</b
                  ><small>Room {{ space.roomNumber }}</small>
                </td>
                <td>{{ space.type }}</td>
                <td>{{ buildingName(space.buildingId) }}</td>
                <td>{{ floorName(space.floorId) }}</td>
                <td>{{ space.sensitivity }}</td>
                <td><resq-status-badge [status]="space.status" /></td>
                <td>{{ space.devices.length }}</td>
                <td>{{ alertCount(space.id) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styleUrl: './spaces.pages.scss',
})
export class SpacesPage {
  private readonly store = inject(BuildingStoreService);
  private readonly alertWorkspace = inject(AlertWorkspaceFacade);
  readonly alertItems = this.alertWorkspace.rows;
  readonly buildings = this.store.buildings;
  readonly types = [
    'Laboratory',
    'Classroom',
    'Office',
    'ServerRoom',
    'Storage',
    'Hallway',
    'Stairs',
    'Restroom',
  ];
  private readonly filterRevision = signal(0);
  readonly filtered = computed(() => {
    this.filterRevision();
    const q = this.query.toLowerCase();
    return this.store.spaces().filter((space) =>
      (!q || `${space.name} ${space.roomNumber}`.toLowerCase().includes(q)) &&
      (!this.building || space.buildingId === this.building) &&
      (!this.type || space.type === this.type) &&
      (!this.risk || space.status === this.risk),
    );
  });
  readonly view = signal<'cards' | 'table'>('cards');
  query = '';
  building = '';
  type = '';
  risk = '';
  constructor() {
    this.alertWorkspace.loadAlerts().subscribe();
  }
  apply(): void {
    this.filterRevision.update((revision) => revision + 1);
  }
  icon(space: Space): string {
    return space.type === 'Laboratory'
      ? '⚗'
      : space.type === 'ServerRoom'
        ? '▤'
        : space.type === 'Classroom'
          ? '▥'
          : space.type === 'Restroom'
            ? 'WC'
            : space.type === 'Stairs'
              ? '≋'
              : '⌂';
  }
  buildingName(id: string) {
    return this.store.getBuilding(id)?.name ?? '—';
  }
  floorName(id: string) {
    return this.store.getFloorById(id)?.name ?? '—';
  }
  alertCount(id: string) {
    return this.alertItems().filter((a) => a.location.zoneId === id).length;
  }
}

@Component({
  selector: 'resq-space-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    StatusBadgeComponent,
    ResponseActivityComponent,
    SensorHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (space()) {
      <div class="detail-head">
        <div>
          <a routerLink="/spaces"><mat-icon>arrow_back</mat-icon>Spaces</a>
          <div class="title">
            <span><mat-icon>grid_view</mat-icon></span>
            <div>
              <h2>{{ space()!.name }}</h2>
              <p>Room {{ space()!.roomNumber }} · {{ buildingName() }} · {{ floorName() }}</p>
            </div>
          </div>
        </div>
        <resq-status-badge [status]="space()!.status" />
      </div>
      <nav class="tabs">
        <button [class.active]="tab() === 'Overview'" (click)="tab.set('Overview')">
          <mat-icon>dashboard</mat-icon>Overview</button
        ><button [class.active]="tab() === 'Devices'" (click)="tab.set('Devices')">
          <mat-icon>sensors</mat-icon>Devices</button
        ><button [class.active]="tab() === 'Alerts'" (click)="tab.set('Alerts')">
          <mat-icon>warning_amber</mat-icon>Alerts</button
        ><button
          [class.active]="tab() === 'Monitoring Configuration'"
          (click)="tab.set('Monitoring Configuration')"
        >
          <mat-icon>tune</mat-icon>Monitoring Configuration</button
        ><button [class.active]="tab() === 'History'" (click)="tab.set('History')">
          <mat-icon>history</mat-icon>History
        </button>
      </nav>
      @if (tab() === 'Overview') {
        <div class="overview-grid">
          <article>
            <h3>Current Conditions</h3>
            <div class="reading-grid">
              @for (device of sensors(); track device.id) {
                <div>
                  <span>{{ device.type }}</span>
                  @if (device.readings.at(-1); as reading) {
                    <b>{{ reading.value }} {{ reading.unit }}</b>
                  } @else {
                    <span>No current reading</span>
                  }
                  <resq-status-badge [status]="device.status" />
                </div>
              }
            </div>
            <h3>Environmental History</h3>
            <resq-sensor-history [devices]="space()!.devices" />
          </article>
          <aside>
            <h3>Space information</h3>
            <dl>
              <dt>Room</dt>
              <dd>{{ space()!.roomNumber }}</dd>
              <dt>Type</dt>
              <dd>{{ space()!.type }}</dd>
              <dt>Sensitivity</dt>
              <dd>{{ space()!.sensitivity }}</dd>
              <dt>Devices</dt>
              <dd>{{ space()!.devices.length }}</dd>
              <dt>Risk status</dt>
              <dd><resq-status-badge [status]="space()!.status" /></dd>
            </dl>
          </aside>
        </div>
      }
      @if (tab() === 'Devices') {
        <div class="device-groups">
          <section>
            <h3><mat-icon>sensors</mat-icon>Sensores</h3>
            <div class="list-panel">
              @for (device of sensors(); track device.id) {
                <a [routerLink]="'/devices/' + device.id"
                  ><span><mat-icon>sensors</mat-icon></span>
                  <div>
                    <b>{{ device.displayName || device.name }}</b
                    ><small>{{ device.code }} · {{ device.type }}</small>
                  </div>
                  <resq-status-badge [status]="device.status" /><mat-icon
                    >chevron_right</mat-icon
                  ></a
                >
              }
            </div>
          </section>
          <section>
            <h3><mat-icon>bolt</mat-icon>Actuadores</h3>
            <div class="list-panel actuator-list">
              @for (item of actuators(); track item.code) {
                <div>
                  <span
                    ><mat-icon>{{ item.icon }}</mat-icon></span
                  >
                  <div>
                    <b>{{ item.name }}</b
                    ><small>{{ item.description }}</small>
                  </div>
                  <resq-status-badge [status]="item.state" />
                </div>
              }
            </div>
          </section>
          <section>
            <h3><mat-icon>display_settings</mat-icon>Visualización local</h3>
            <div class="list-panel actuator-list">
              @for (item of displays(); track item.code) {
                <div>
                  <span><mat-icon>display_settings</mat-icon></span>
                  <div>
                    <b>{{ item.name }}</b
                    ><small>{{ item.description }}</small>
                  </div>
                  <resq-status-badge [status]="item.state" />
                </div>
              }
            </div>
          </section>
        </div>
        <section class="response-simulator">
          <h3>Sensor configuration</h3>
          <p>Telemetry simulation is unavailable while connected to the real backend.</p>
        </section>
        <resq-response-activity [spaceId]="space()!.id" />
      }
      @if (tab() === 'Alerts') {
        <div class="list-panel">
          @for (alert of alerts(); track alert.id) {
            <a [routerLink]="'/alerts/' + alert.id"
              ><span><mat-icon>warning_amber</mat-icon></span>
              <div>
                <b>{{ alert.title }}</b
                ><small>{{ alert.riskTypeLabel }} · {{ alert.description }}</small>
              </div>
              <resq-status-badge [status]="alert.severity" /><mat-icon>chevron_right</mat-icon></a
            >
          }
        </div>
      }
      @if (tab() === 'Monitoring Configuration') {
        <section class="config rules-config">
          <div class="config-intro">
            <div>
              <h3>Global Risk Detection Rules</h3>
              <p>These backend rules apply across the organization by variable type, not only to {{ space()!.name }}.</p>
            </div>
            <button type="button" (click)="showRuleForm.set(!showRuleForm())">{{ showRuleForm() ? 'Cancel' : 'Create global rule' }}</button>
          </div>
          <p class="contract-note">Per-zone sensitivity profiles are not supported by the API. The sensitivity label shown elsewhere is presentation-only.</p>
          @if (showRuleForm()) {
            <form class="rule-form" (ngSubmit)="createRule()">
              <label>Risk type code<input name="riskTypeCode" [(ngModel)]="ruleRiskType" required pattern="[A-Za-z][A-Za-z0-9_]*" placeholder="GAS_LEAK" /></label>
              <label>Severity<select name="severityCode" [(ngModel)]="ruleSeverity"><option>Info</option><option>Warning</option><option>Critical</option></select></label>
              <label>Variable type<input name="variableType" [(ngModel)]="ruleVariableType" required pattern="[A-Za-z][A-Za-z0-9_]*" placeholder="GAS_PPM" list="zone-variable-types" /></label>
              <datalist id="zone-variable-types">@for (code of availableVariableTypes(); track code) {<option [value]="code"></option>}</datalist>
              <label>Operator<select name="operator" [(ngModel)]="ruleOperator">@for (operator of operators; track operator) {<option [value]="operator">{{ operatorLabel(operator) }}</option>}</select></label>
              <label>Threshold<input name="threshold" type="number" step="any" [(ngModel)]="ruleThreshold" required /></label>
              <button type="submit" [disabled]="ruleBusy() || !ruleRiskType.trim() || !ruleVariableType.trim() || ruleThreshold === null">Create active global rule</button>
            </form>
          }
          @if (rulesLoading()) {<p class="contract-note">Loading global rules…</p>}
          @if (rulesError()) {<p class="contract-note">{{ rulesError() }} <button type="button" (click)="loadRules()">Retry</button></p>}
          <div class="rule-list">
            @for (rule of rules(); track rule.ruleId) {
              <article [class.inactive]="rule.status === 'INACTIVE'">
                <div><b>{{ rule.riskTypeCode }}</b><small>{{ rule.ruleId }}</small></div>
                <span>{{ rule.severityCode }}</span>
                <div><b>{{ rule.condition.variableType }}</b><small>{{ operatorLabel(rule.condition.operator) }} {{ rule.condition.threshold }}</small></div>
                <em>{{ appliesToZone(rule) ? 'Variable present in this zone' : 'Global · variable not present here' }}</em>
                <button type="button" [disabled]="ruleBusy()" (click)="toggleRule(rule)">{{ rule.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}</button>
              </article>
            } @empty {
              @if (!rulesLoading() && !rulesError()) {<p class="contract-note">No global detection rules are configured.</p>}
            }
          </div>
        </section>
      }
      @if (tab() === 'History') {
        <resq-response-activity [spaceId]="space()!.id" />
      }
    } @else {
      <div class="not-found">
        <h2>Space not found</h2>
        <a routerLink="/dashboard">Back to Dashboard</a>
      </div>
    }
  `,
  styleUrls: ['./space-detail.page.scss', './space-detail.improvements.scss'],
})
export class SpaceDetailPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SpaceService);
  private readonly alertWorkspace = inject(AlertWorkspaceFacade);
  private readonly riskGateway = inject<RiskDetectionGateway>(RISK_DETECTION_GATEWAY);
  readonly store = inject(BuildingStoreService);
  private readonly snack = inject(MatSnackBar);
  readonly response = inject(SensorResponseService);
  readonly alertItems = this.alertWorkspace.rows;
  readonly space = computed(() =>
    this.store.spaces().find((space) => space.id === this.route.snapshot.paramMap.get('spaceId')),
  );
  readonly tab = signal('Overview');
  readonly activeSensitivity = signal<SensitivityLevel>('Normal');
  readonly thresholdProfiles = signal<Partial<Record<SensitivityLevel, SpaceThresholds>>>({});
  readonly metrics = ['Temperature', 'Smoke', 'Gas', 'Humidity', 'Motion'] as const;
  readonly simulationDeviceId = signal('');
  readonly rules = signal<DetectionRuleRecord[]>([]);
  readonly rulesLoading = signal(false);
  readonly rulesError = signal('');
  readonly ruleBusy = signal(false);
  readonly showRuleForm = signal(false);
  readonly operators: ComparisonOperator[] = [
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'EQUAL',
  ];
  ruleRiskType = 'GAS_LEAK';
  ruleSeverity = 'Warning';
  ruleVariableType = '';
  ruleOperator: ComparisonOperator = 'GREATER_THAN_OR_EQUAL';
  ruleThreshold: number | null = null;
  readonly availableVariableTypes = computed(() =>
    [
      ...new Set(
        (this.space()?.devices ?? []).flatMap((device) =>
          device.capabilities.map((capability) => capability.code),
        ),
      ),
    ].sort(),
  );
  sensors() {
    return (
      this.space()?.devices.filter((device) =>
        device.capabilities.some((cap) => capabilityCategory(cap) === 'SENSOR'),
      ) ?? []
    );
  }
  private capabilityItems(category: 'ACTUATOR' | 'DISPLAY') {
    return (this.space()?.devices ?? []).flatMap((device) =>
      device.capabilities
        .filter((capability) => capabilityCategory(capability) === category)
        .map((capability) => ({
          code: `${device.id}:${capability.code}`,
          name: capability.name,
          description: capability.description ?? capability.hardware,
          state: capability.state ?? (capability.kind === 'ACTUATION' ? 'INACTIVE' : 'NORMAL'),
          icon:
            capabilityDefinition(capability.code)?.icon ??
            (category === 'DISPLAY' ? 'display_settings' : 'bolt'),
        })),
    );
  }
  actuators() {
    return this.capabilityItems('ACTUATOR');
  }
  displays() {
    return this.capabilityItems('DISPLAY');
  }
  simulationDevices() {
    return (
      this.space()?.devices.filter((device) =>
        device.capabilities.some((capability) => capabilityCategory(capability) === 'SENSOR'),
      ) ?? []
    );
  }
  readonly sensitivityLevels: SensitivityLevel[] = ['Low', 'Normal', 'High', 'Custom'];
  readonly form = this.fb.nonNullable.group(
    {
      sensitivity: ['Normal' as SensitivityLevel, Validators.required],
      TemperatureWarning: [0, Validators.required],
      TemperatureCritical: [0, Validators.required],
      SmokeWarning: [0, Validators.required],
      SmokeCritical: [0, Validators.required],
      GasWarning: [0, Validators.required],
      GasCritical: [0, Validators.required],
      HumidityWarning: [0, Validators.required],
      HumidityCritical: [0, Validators.required],
      MotionWarning: [0, Validators.required],
      MotionCritical: [0, Validators.required],
    },
    { validators: thresholdOrderValidator(['Temperature', 'Smoke', 'Gas', 'Humidity', 'Motion']) },
  );

  ngOnInit(): void {
    // Per-zone sensitivity/threshold read and write endpoints are not implemented.
    // Disable the entire form instead of showing fictitious editable settings.
    this.form.disable({ emitEvent: false });
    const found = this.store
      .spaces()
      .find((space) => space.id === this.route.snapshot.paramMap.get('spaceId'));
    this.alertWorkspace.loadAlerts().subscribe();
    this.loadRules();
    if (!found) return;

    const profiles: Partial<Record<SensitivityLevel, SpaceThresholds>> = {};
    for (const level of this.sensitivityLevels) {
      profiles[level] = this.cloneThresholds(found.thresholdProfiles?.[level] ?? found.thresholds);
    }
    this.thresholdProfiles.set(profiles);
    this.activeSensitivity.set(found.sensitivity);
    this.patchConfiguration(found.sensitivity, profiles[found.sensitivity]!);
  }

  loadRules(): void {
    this.rulesLoading.set(true);
    this.rulesError.set('');
    this.riskGateway.getDetectionRules().subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.rulesLoading.set(false);
        if (!this.ruleVariableType) this.ruleVariableType = this.availableVariableTypes()[0] ?? '';
      },
      error: (error: { message?: string }) => {
        this.rulesLoading.set(false);
        this.rulesError.set(error.message ?? 'Global rules could not be loaded.');
      },
    });
  }

  createRule(): void {
    const riskTypeCode = this.ruleRiskType.trim().toUpperCase();
    const variableType = this.ruleVariableType.trim().toUpperCase();
    if (
      !riskTypeCode ||
      !variableType ||
      this.ruleThreshold === null ||
      !Number.isFinite(this.ruleThreshold)
    ) return;
    const duplicateScope = this.rules().filter(
      (rule) =>
        rule.status === 'ACTIVE' &&
        rule.riskTypeCode === riskTypeCode &&
        rule.severityCode.toUpperCase() === this.ruleSeverity.toUpperCase() &&
        rule.condition.variableType === variableType,
    );
    if (
      duplicateScope.length &&
      !window.confirm(
        `There are already ${duplicateScope.length} active global rule(s) for this risk, severity and variable. Create another active rule anyway?`,
      )
    ) return;
    if (
      !window.confirm(
        `Create an ACTIVE organization-wide rule for ${variableType}? This will not be limited to ${this.space()?.name ?? 'this zone'}.`,
      )
    ) return;
    this.ruleBusy.set(true);
    this.riskGateway
      .configureDetectionRule({
        riskTypeCode,
        severityCode: this.ruleSeverity,
        variableType,
        operator: this.ruleOperator,
        threshold: this.ruleThreshold,
      })
      .subscribe({
        next: () => {
          this.ruleBusy.set(false);
          this.showRuleForm.set(false);
          this.snack.open('Global detection rule created and activated.', 'Close', { duration: 3000 });
          this.loadRules();
        },
        error: (error: { message?: string }) => {
          this.ruleBusy.set(false);
          this.snack.open(error.message ?? 'Rule could not be created.', 'Close', { duration: 3500 });
        },
      });
  }

  toggleRule(rule: DetectionRuleRecord): void {
    const activate = rule.status !== 'ACTIVE';
    if (!window.confirm(`${activate ? 'Activate' : 'Deactivate'} this organization-wide rule?`)) return;
    this.ruleBusy.set(true);
    this.riskGateway.changeDetectionRuleStatus(rule.ruleId, activate).subscribe({
      next: () => {
        this.ruleBusy.set(false);
        this.snack.open(`Global rule ${activate ? 'activated' : 'deactivated'}.`, 'Close', { duration: 2500 });
        this.loadRules();
      },
      error: (error: { message?: string }) => {
        this.ruleBusy.set(false);
        this.snack.open(error.message ?? 'Rule status could not be changed.', 'Close', { duration: 3500 });
      },
    });
  }

  appliesToZone(rule: DetectionRuleRecord): boolean {
    return this.availableVariableTypes().includes(rule.condition.variableType);
  }

  operatorLabel(operator: ComparisonOperator): string {
    return ({
      GREATER_THAN: '>',
      GREATER_THAN_OR_EQUAL: '≥',
      LESS_THAN: '<',
      LESS_THAN_OR_EQUAL: '≤',
      EQUAL: '=',
    } as const)[operator];
  }

  changeSensitivity(next: SensitivityLevel): void {
    const previous = this.activeSensitivity();
    this.thresholdProfiles.update((profiles) => ({
      ...profiles,
      [previous]: this.thresholdsFromForm(),
    }));
    this.activeSensitivity.set(next);
    const profile = this.thresholdProfiles()[next] ?? this.space()?.thresholds;
    if (profile) this.patchConfiguration(next, profile);
  }

  alerts() {
    return this.alertItems()
      .filter(
        (alert) => alert.status === 'ACTIVE' && alert.location.zoneId === this.space()?.id,
      )
      .slice(0, 8);
  }
  buildingName() {
    const id = this.space()?.buildingId;
    return id ? (this.store.getBuilding(id)?.name ?? '—') : '—';
  }
  floorName() {
    const id = this.space()?.floorId;
    return id ? (this.store.getFloorById(id)?.name ?? '—') : '—';
  }
  unit(metric: string) {
    return sensorDefinitions.find((item) => item.type === metric)?.unit ?? '';
  }
  thresholdError(metric: (typeof this.metrics)[number]): boolean {
    return Boolean(this.form.errors?.['thresholdOrder']?.[metric]);
  }

  save(): void {
    const space = this.space();
    if (!space || this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open(
        'Warning threshold must be lower than the critical threshold for every metric.',
        'Close',
        { duration: 3500 },
      );
      return;
    }
    const sensitivity = this.activeSensitivity();
    const thresholds = this.thresholdsFromForm();
    const profiles = { ...this.thresholdProfiles(), [sensitivity]: thresholds };
    this.thresholdProfiles.set(profiles);
    try {
      this.service.updateConfiguration(space.id, sensitivity, thresholds, profiles);
    } catch (error) {
      this.snack.open(
        error instanceof Error ? error.message : 'Configuration could not be saved.',
        'Close',
        { duration: 3000 },
      );
      return;
    }
    this.response.reconcile(space.id);
    this.snack.open(`${sensitivity} sensitivity configuration updated.`, 'Close', {
      duration: 2500,
    });
  }

  private thresholdsFromForm(): SpaceThresholds {
    const value = this.form.getRawValue();
    return {
      Temperature: { warning: value.TemperatureWarning, critical: value.TemperatureCritical },
      Smoke: { warning: value.SmokeWarning, critical: value.SmokeCritical },
      Gas: { warning: value.GasWarning, critical: value.GasCritical },
      Humidity: { warning: value.HumidityWarning, critical: value.HumidityCritical },
      Motion: { warning: value.MotionWarning, critical: value.MotionCritical },
    };
  }

  private patchConfiguration(sensitivity: SensitivityLevel, thresholds: SpaceThresholds): void {
    this.form.patchValue(
      {
        sensitivity,
        TemperatureWarning: thresholds.Temperature?.warning,
        TemperatureCritical: thresholds.Temperature?.critical,
        SmokeWarning: thresholds.Smoke?.warning,
        SmokeCritical: thresholds.Smoke?.critical,
        GasWarning: thresholds.Gas?.warning,
        GasCritical: thresholds.Gas?.critical,
        HumidityWarning: thresholds.Humidity?.warning,
        HumidityCritical: thresholds.Humidity?.critical,
        MotionWarning: thresholds.Motion?.warning,
        MotionCritical: thresholds.Motion?.critical,
      },
      { emitEvent: false },
    );
  }

  private cloneThresholds(thresholds: SpaceThresholds): SpaceThresholds {
    return Object.fromEntries(
      Object.entries(thresholds).map(([metric, value]) => [metric, value ? { ...value } : value]),
    ) as SpaceThresholds;
  }
}

function thresholdOrderValidator(metrics: readonly string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const invalid = Object.fromEntries(
      metrics
        .filter((metric) => {
          const warning = Number(control.get(`${metric}Warning`)?.value);
          const critical = Number(control.get(`${metric}Critical`)?.value);
          return !Number.isFinite(warning) || !Number.isFinite(critical) || warning >= critical;
        })
        .map((metric) => [metric, true]),
    );
    return Object.keys(invalid).length ? { thresholdOrder: invalid } : null;
  };
}
