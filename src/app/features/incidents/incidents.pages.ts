import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { EmptyStateComponent, KpiCardComponent, LoadingStateComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';
import { IncidentWorkspaceFacade, IncidentWorkspaceRow } from './incident-workspace.facade';

@Component({
  selector: 'resq-incidents-page',
  standalone: true,
  imports: [FormsModule, RouterLink, MatIconModule, KpiCardComponent, StatusBadgeComponent, LoadingStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis" aria-label="Incident summary">
      <resq-kpi-card icon="emergency" [value]="count('ACTIVE')" label="Active Incidents" tone="red" />
      <resq-kpi-card icon="pending_actions" [value]="count('IN_PROGRESS')" label="In Progress" tone="amber" />
      <resq-kpi-card icon="task_alt" [value]="count('RESOLVED')" label="Resolved" tone="green" />
      <resq-kpi-card icon="schedule" [value]="averageResolution()" label="Avg. Resolution" />
    </section>

    <section class="filters" aria-label="Incident filters">
      <label><mat-icon>search</mat-icon><input [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search incidents, type or zone..." /></label>
      <select [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Incident status">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="CLOSED">Closed</option>
      </select>
      <select [ngModel]="type()" (ngModelChange)="type.set($event)" aria-label="Incident type">
        <option value="">All types</option>
        <option value="GAS_LEAK">Gas leak</option>
        <option value="FIRE">Fire</option>
        <option value="EARTHQUAKE">Earthquake</option>
        <option value="UNKNOWN">Other</option>
      </select>
    </section>

    @if (workspace.loading()) {
      <resq-loading-state message="Loading incidents..." />
    } @else if (workspace.error()) {
      <resq-empty-state title="Incidents could not be loaded" [message]="workspace.error()!.message" />
    } @else if (!filtered().length) {
      <resq-empty-state title="No incidents found" message="Try changing the filters." />
    } @else {
      <div class="incident-grid">
        @for (row of filtered(); track row.incident.incidentId) {
          <article>
            <div class="card-head">
              <span [class]="'severity ' + levelClass(row)">{{ row.levelLabel }}</span>
              <resq-status-badge [status]="row.incident.status" [label]="row.statusLabel" />
            </div>

            <a [routerLink]="['/incidents', row.incident.incidentId]">
              <h3>{{ row.title }}</h3>
              <p>{{ row.description }}</p>
            </a>

            <div class="meta">
              <span>⌖ {{ row.location.buildingName }} · {{ row.location.zoneName }}</span>
              <span>▱ {{ row.location.floorLabel || 'Floor not specified' }}</span>
              <span>◷ {{ age(row.incident.createdAt) }}</span>
              <span>◉ {{ row.assigneeLabel }}</span>
            </div>

            <footer>
              <b>{{ row.incident.incidentId }}</b>
              <a [routerLink]="['/incidents', row.incident.incidentId]">Details →</a>
            </footer>
          </article>
        }
      </div>
    }
  `,
  styleUrls: ['./incidents.pages.scss', './incidents.readability.scss'],
})
export class IncidentsPage implements OnInit {
  readonly workspace = inject(IncidentWorkspaceFacade);
  readonly query = signal('');
  readonly status = signal('');
  readonly type = signal('');

  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.workspace.rows().filter((row) => {
      const searchable = `${row.incident.incidentId} ${row.title} ${row.typeLabel} ${row.location.buildingName} ${row.location.zoneName}`.toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!this.status() || row.incident.status === this.status()) &&
        (!this.type() || row.incident.type === this.type())
      );
    });
  });

  ngOnInit(): void {
    this.workspace.loadIncidents().subscribe({ error: () => undefined });
  }

  count(status: string): number {
    return this.workspace.rows().filter((row) => row.incident.status === status).length;
  }

  averageResolution(): string {
    const resolved = this.workspace
      .rows()
      .filter((row) => row.incident.resolvedAt)
      .map((row) => Math.max(0, row.incident.resolvedAt!.getTime() - row.incident.createdAt.getTime()));
    if (!resolved.length) return '—';
    const minutes = Math.round(resolved.reduce((sum, value) => sum + value, 0) / resolved.length / 60_000);
    return minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
  }

  age(date: Date): string {
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
    if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
  }

  levelClass(row: IncidentWorkspaceRow): string {
    return row.incident.level?.toLowerCase() ?? 'unknown';
  }
}

@Component({
  selector: 'resq-incident-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, LoadingStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (workspace.loading()) {
      <resq-loading-state message="Loading incident..." />
    } @else if (workspace.error()) {
      <resq-empty-state title="Incident could not be loaded" [message]="workspace.error()!.message" />
    } @else if (workspace.detail(); as row) {
      <div class="detail-head">
        <div>
          <a routerLink="/incidents">← Incidents</a>
          <p>{{ row.incident.incidentId }}</p>
          <h2>{{ row.title }}</h2>
          <span>{{ row.description }}</span>
        </div>
        <div>
          <resq-status-badge [status]="row.incident.level || 'Info'" [label]="row.levelLabel" />
          <resq-status-badge [status]="row.incident.status" [label]="row.statusLabel" />
        </div>
      </div>

      <div class="actions">
        @if (workspace.canAssign(row)) {
          <button type="button" class="secondary" (click)="assignToMe()" [disabled]="busy()">
            Assign to me
          </button>
        }
        @if (workspace.canResolve(row)) {
          <button type="button" (click)="showResolve.set(true)" [disabled]="busy()">Resolve incident</button>
        }
        @if (row.incident.status === 'RESOLVED' || row.incident.status === 'CLOSED') {
          <button type="button" disabled>✓ {{ row.statusLabel }}</button>
        }
      </div>

      @if (row.incident.status === 'IN_PROGRESS' && row.currentCondition !== 'Normal') {
        <p class="contract-note">Resolution is blocked: the current measurement must be below the warning threshold. Current condition: {{ row.currentCondition }}.</p>
      }

      @if (showResolve()) {
        <section class="resolve-box">
          <label>
            Resolution notes
            <textarea [(ngModel)]="resolutionNotes" rows="4" placeholder="Describe what was verified and how the incident was resolved."></textarea>
          </label>
          <div>
            <button type="button" class="secondary" (click)="showResolve.set(false)">Cancel</button>
            <button type="button" (click)="resolve()" [disabled]="!resolutionNotes.trim() || busy()">Confirm resolution</button>
          </div>
        </section>
      }

      <article class="critical-evidence">
        <header><div><h3>Original Critical Detection</h3><p>This immutable evidence explains why Risk Detection created the Incident. Actor: SYSTEM.</p></div><span>Critical condition detected</span></header>
        @if (row.evidence.length) {
          @for (evidence of row.evidence; track evidence.deviceId + evidence.metric) {
            <div class="critical-reading">
              <section><small>Metric</small><b>{{ evidence.metric }}</b></section>
              <section><small>Measured value</small><b>{{ evidence.value }} {{ evidence.unit || '' }}</b></section>
              <section><small>Critical threshold</small><b>{{ evidence.criticalThreshold ?? 'Unavailable' }} {{ evidence.unit || '' }}</b></section>
              <section><small>Device</small><b><a [routerLink]="['/devices', evidence.deviceId]">{{ evidence.deviceName }}</a></b><em>{{ evidence.deviceCode }}</em></section>
              <section><small>Zone</small><b>{{ row.location.zoneName }}</b></section>
              <section><small>Detected at</small><b>{{ evidence.measuredAt.toLocaleString() }}</b></section>
              @if (evidence.criticalThreshold !== undefined) {<section><small>Detection rule</small><b>{{ evidence.value }} ≥ {{ evidence.criticalThreshold }} {{ evidence.unit || '' }}</b></section>}
            </div>
          }
        } @else {
          <p class="contract-note">Original critical detection evidence is unavailable.</p>
        }
      </article>

      <article class="critical-evidence current-condition">
        <header><div><h3>Current Condition</h3><p>The latest device reading determines whether the monitored condition is safe now.</p></div><span [class.safe]="row.currentCondition === 'Normal'">{{ row.currentCondition === 'Normal' ? 'SAFE' : 'UNSAFE' }}</span></header>
        @if (row.currentEvidence; as current) {
          <div class="critical-reading">
            <section><small>Current value</small><b>{{ current.value }} {{ current.unit || '' }}</b></section>
            <section><small>Warning threshold</small><b>{{ current.warningThreshold ?? 'Unavailable' }} {{ current.unit || '' }}</b></section>
            <section><small>Critical threshold</small><b>{{ current.criticalThreshold ?? 'Unavailable' }} {{ current.unit || '' }}</b></section>
            <section><small>Current classification</small><b>{{ row.currentCondition }}</b></section>
            <section><small>Latest reading at</small><b>{{ current.measuredAt.toLocaleString() }}</b></section>
          </div>
          <p class="contract-note">{{ row.currentCondition === 'Normal' ? 'The monitored condition returned below the warning threshold.' : 'The monitored condition remains unsafe.' }}</p>
        } @else {
          <p class="contract-note">The current device reading is unavailable.</p>
        }
      </article>

      <article class="critical-evidence">
        <header><div><h3>Critical Response Actions</h3><p>These actions require an assigned Administrator. Unsupported device capabilities are not invented.</p></div><span>HUMAN_REQUIRED</span></header>
        @if (row.incident.status === 'ACTIVE' && !row.incident.assignedTo) {
          <p class="contract-note">Take this incident before authorizing critical response actions.</p>
        }
        @if (row.responseExecutions.length) {
          @for (execution of row.responseExecutions; track execution.responseExecutionId) {
            <div class="critical-reading">
              <section><small>Action</small><b>{{ actionLabel(execution.action.actionCode) }}</b></section>
              <section><small>Action code</small><b>{{ execution.action.actionCode }}</b></section>
              <section><small>Target device</small><b><a [routerLink]="['/devices', execution.action.targetDeviceId]">{{ execution.action.targetDeviceId }}</a></b></section>
              <section><small>Target capability</small><b>{{ execution.action.targetCapabilityCode }}</b></section>
              <section><small>Authorization mode</small><b>{{ execution.action.authorizationMode === 'HUMAN_REQUIRED' ? 'Human required' : 'Automatic' }}</b></section>
              <section><small>Status</small><b>{{ execution.status }}</b></section>
              <section><small>Requested at</small><b>{{ execution.requestedAt.toLocaleString() }}</b></section>
              @if (execution.status === 'SUCCEEDED') {<section><small>Lifecycle</small><b>AUTHORIZED → EXECUTION_REQUESTED → SUCCEEDED</b></section>}
              @if (execution.authorization) {
                <section><small>{{ execution.authorization.decision === 'APPROVED' ? 'Authorized by' : 'Rejected by' }}</small><b>{{ workspace.actorLabel(execution.authorization.decidedByUserId) }}</b></section>
                <section><small>{{ execution.authorization.decision === 'APPROVED' ? 'Decision time' : 'Rejected at' }}</small><b>{{ execution.authorization.decidedAt.toLocaleString() }}</b></section>
              } @else {<section><small>Actor</small><b>Administrator pending</b></section>}
              @if (execution.executionRequestedAt) {<section><small>Execution requested</small><b>{{ execution.executionRequestedAt.toLocaleString() }}</b></section>}
              @if (execution.result) {<section><small>Result</small><b>{{ execution.result.resultCode }} · {{ execution.result.message || 'Completed' }}</b></section><section><small>Completed at</small><b>{{ execution.result.completedAt.toLocaleString() }}</b></section>}
              @if (workspace.canAuthorize(execution)) {
                <section><small>Decision</small><b><button type="button" (click)="decide(execution.responseExecutionId, 'APPROVED')" [disabled]="busy()">Approve &amp; Execute</button> <button type="button" class="secondary" (click)="decide(execution.responseExecutionId, 'REJECTED')" [disabled]="busy()">Reject</button></b></section>
              }
            </div>
          }
        } @else {
          <p class="contract-note">No supported critical actuator capability is available for this Incident's device.</p>
        }
      </article>

      <div class="grid">
        <article>
          <h3>Incident lifecycle</h3>
          <div class="timeline">
            @if (row.evidence.at(0); as detected) {<div class="done"><i>✓</i><section><b>Critical condition detected</b><small>{{ detected.measuredAt.toLocaleString() }}</small><p>Risk Detection classified the measurement as CRITICAL.</p></section></div>}
            <div class="done"><i>✓</i><section><b>Incident created</b><small>{{ row.incident.createdAt.toLocaleString() }}</small><p>Risk Detection created this Incident independently after the critical threshold was reached.</p></section></div>
            <div [class.done]="row.incident.assignedTo"><i>{{ row.incident.assignedTo ? '✓' : '2' }}</i><section><b>Assignment</b><small>{{ row.incident.assignedAt?.toLocaleString() || 'Pending' }}</small><p>{{ row.assigneeLabel }}</p></section></div>
            @for (execution of row.responseExecutions; track execution.responseExecutionId) {
              <div [class.done]="execution.authorization"><i>{{ execution.authorization ? '✓' : '3' }}</i><section><b>{{ actionLabel(execution.action.actionCode) }}</b><small>{{ execution.authorization?.decidedAt?.toLocaleString() || 'Authorization pending' }}</small><p>{{ execution.authorization ? execution.authorization.decision + ' by ' + workspace.actorLabel(execution.authorization.decidedByUserId) : 'Administrator decision required.' }}</p></section></div>
              @if (execution.result) {<div class="done"><i>✓</i><section><b>Action result</b><small>{{ execution.result.completedAt.toLocaleString() }}</small><p>{{ execution.result.message || execution.result.resultCode }}</p></section></div>}
            }
            <div [class.done]="row.incident.safeAt"><i>{{ row.incident.safeAt ? '✓' : '4' }}</i><section><b>Safe condition verified</b><small>{{ row.incident.safeAt?.toLocaleString() || 'Pending' }}</small><p>The current measurement must be below the warning threshold.</p></section></div>
            <div [class.done]="row.incident.status === 'RESOLVED' || row.incident.status === 'CLOSED'"><i>{{ row.incident.resolvedAt ? '✓' : '5' }}</i><section><b>Resolution</b><small>{{ row.incident.resolvedAt?.toLocaleString() || 'Pending' }}</small><p>{{ row.incident.resolutionNotes || 'Resolution notes have not been registered yet.' }}</p></section></div>
          </div>
        </article>

        <aside>
          <h3>Incident context</h3>
          <dl>
            <dt>Type</dt><dd>{{ row.typeLabel }}</dd>
            <dt>Risk Detection</dt><dd>{{ row.incident.riskDetectionId || 'Unavailable' }}</dd>
            <dt>Risk level</dt><dd>{{ row.levelLabel }}</dd>
            <dt>Status</dt><dd>{{ row.statusLabel }}</dd>
            <dt>Assigned to</dt><dd>{{ row.assigneeLabel }}</dd>
            <dt>Assigned at</dt><dd>{{ row.incident.assignedAt?.toLocaleString() || '—' }}</dd>
            <dt>Current condition</dt><dd>{{ row.currentCondition }}</dd>
            <dt>Safe at</dt><dd>{{ row.incident.safeAt?.toLocaleString() || '—' }}</dd>
            <dt>Building</dt><dd>{{ row.location.buildingName }}</dd>
            <dt>Floor</dt><dd>{{ row.location.floorLabel || '—' }}</dd>
            <dt>Zone</dt><dd>{{ row.location.zoneName }}</dd>
            <dt>Created</dt><dd>{{ row.incident.createdAt.toLocaleString() }}</dd>
            <dt>Resolved</dt><dd>{{ row.incident.resolvedAt?.toLocaleString() || '—' }}</dd>
            <dt>Resolved by</dt><dd>{{ row.incident.resolvedBy ? workspace.actorLabel(row.incident.resolvedBy) : '—' }}</dd>
          </dl>
          <p class="contract-note">Incident creation is not exposed as a manual Web action. Assignment and resolution are the supported operator actions.</p>
        </aside>
      </div>
    } @else {
      <div class="not-found"><h2>Incident not found</h2><a routerLink="/incidents">Back to Incidents</a></div>
    }
  `,
  styleUrls: ['./incident-detail.page.scss', './incidents.readability.scss'],
})
export class IncidentDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  readonly workspace = inject(IncidentWorkspaceFacade);
  readonly busy = signal(false);
  readonly showResolve = signal(false);
  resolutionNotes = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('incidentId') ?? '';
    this.workspace.loadDetail(id).subscribe({ error: () => undefined });
  }

  assignToMe(): void {
    this.busy.set(true);
    this.workspace.assignToCurrentUser().subscribe({
      next: () => {
        this.busy.set(false);
        this.snack.open('Incident assigned to your user.', 'Close', { duration: 2200 });
      },
      error: (error: { message?: string }) => {
        this.busy.set(false);
        this.snack.open(error.message ?? 'Incident assignment failed.', 'Close', { duration: 3500 });
      },
    });
  }

  resolve(): void {
    const notes = this.resolutionNotes.trim();
    if (!notes) return;
    this.busy.set(true);
    this.workspace.resolve(notes).subscribe({
      next: () => {
        this.busy.set(false);
        this.showResolve.set(false);
        this.resolutionNotes = '';
        this.snack.open('Incident resolved.', 'Close', { duration: 2200 });
      },
      error: (error: { message?: string }) => {
        this.busy.set(false);
        this.snack.open(error.message ?? 'Incident resolution failed.', 'Close', { duration: 3500 });
      },
    });
  }

  decide(executionId: string, decision: 'APPROVED' | 'REJECTED'): void {
    this.busy.set(true);
    this.workspace.decideAuthorization(executionId, decision).subscribe({
      next: () => {
        this.busy.set(false);
        this.snack.open(
          decision === 'APPROVED'
            ? 'Critical action authorized and completed.'
            : 'Critical action rejected.',
          'Close',
          { duration: 2600 },
        );
      },
      error: (error: { message?: string }) => {
        this.busy.set(false);
        this.snack.open(error.message ?? 'Authorization failed.', 'Close', { duration: 3500 });
      },
    });
  }

  actionLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
