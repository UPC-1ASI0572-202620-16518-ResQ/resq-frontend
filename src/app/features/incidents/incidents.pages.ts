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

      <div class="grid">
        <article>
          <h3>Incident lifecycle</h3>
          <div class="timeline">
            <div class="done"><i>✓</i><section><b>Incident created</b><small>{{ row.incident.createdAt.toLocaleString() }}</small><p>The incident was created by the operational risk flow.</p></section></div>
            <div [class.done]="row.incident.assignedTo"><i>{{ row.incident.assignedTo ? '✓' : '2' }}</i><section><b>Assignment</b><small>{{ row.assigneeLabel }}</small><p>Assignment is managed by Incident Management.</p></section></div>
            <div [class.done]="row.incident.status === 'RESOLVED' || row.incident.status === 'CLOSED'"><i>{{ row.incident.resolvedAt ? '✓' : '3' }}</i><section><b>Resolution</b><small>{{ row.incident.resolvedAt?.toLocaleString() || 'Pending' }}</small><p>{{ row.incident.resolutionNotes || 'Resolution notes have not been registered yet.' }}</p></section></div>
          </div>
        </article>

        <aside>
          <h3>Incident context</h3>
          <dl>
            <dt>Type</dt><dd>{{ row.typeLabel }}</dd>
            <dt>Risk level</dt><dd>{{ row.levelLabel }}</dd>
            <dt>Status</dt><dd>{{ row.statusLabel }}</dd>
            <dt>Assigned to</dt><dd>{{ row.assigneeLabel }}</dd>
            <dt>Building</dt><dd>{{ row.location.buildingName }}</dd>
            <dt>Floor</dt><dd>{{ row.location.floorLabel || '—' }}</dd>
            <dt>Zone</dt><dd>{{ row.location.zoneName }}</dd>
            <dt>Created</dt><dd>{{ row.incident.createdAt.toLocaleString() }}</dd>
            <dt>Resolved</dt><dd>{{ row.incident.resolvedAt?.toLocaleString() || '—' }}</dd>
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
      error: () => this.busy.set(false),
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
      error: () => this.busy.set(false),
    });
  }
}
