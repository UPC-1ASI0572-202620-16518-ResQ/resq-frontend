import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent, KpiCardComponent, LoadingStateComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';
import { AlertWorkspaceFacade, AlertWorkspaceRow } from './alert-workspace.facade';
import { ResponseExecutionRecord } from './data-access/alert.gateway';
import { ResponseActivityComponent } from '../../shared/ui/response-activity.component';

@Component({
  selector: 'resq-alerts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatIconModule,
    KpiCardComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ResponseActivityComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <resq-response-activity/>
    <section class="kpis" aria-label="Alert summary">
      <resq-kpi-card icon="warning_amber" [value]="workspace.summary().warning" label="Warning Alerts" tone="amber" />
      <resq-kpi-card icon="domain" [value]="buildings().length" label="Affected Buildings" />
      <resq-kpi-card icon="policy" [value]="riskTypes().length" label="Risk Types" />
      <resq-kpi-card icon="notification_important" [value]="workspace.summary().notificationFailures" label="Delivery Failures" />
    </section>

    <section class="filters" aria-label="Alert filters">
      <label class="search-field">
        <span>Search</span><mat-icon class="search-icon">search</mat-icon>
        <input [(ngModel)]="query" (ngModelChange)="applyFilters()" placeholder="Alert, risk, building or zone..." />
      </label>
      <label>
        <span>Building</span>
        <select [(ngModel)]="buildingFilter" (ngModelChange)="applyFilters()">
          <option value="">All buildings</option>
          @for (item of buildings(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
        </select>
      </label>
      <label>
        <span>Risk Type</span>
        <select [(ngModel)]="riskFilter" (ngModelChange)="applyFilters()">
          <option value="">All risks</option>
          @for (item of riskTypes(); track item) { <option [value]="item">{{ riskLabel(item) }}</option> }
        </select>
      </label>
      <label>
        <span>Severity</span>
        <select [(ngModel)]="severityFilter" (ngModelChange)="applyFilters()">
          <option value="">All severities</option>
          <option>Warning</option>
        </select>
      </label>
      <label>
        <span>Period</span>
        <select [(ngModel)]="periodFilter" (ngModelChange)="applyFilters()">
          <option value="all">All time</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
        </select>
      </label>
      <button type="button" class="reset" (click)="resetFilters()">Reset filters</button>
    </section>

    @if (workspace.loading()) {
      <resq-loading-state message="Loading alerts..." />
    } @else if (workspace.error()) {
      <resq-empty-state title="Alerts could not be loaded" [message]="workspace.error()!.message" />
    } @else {
      <div class="result-summary"><b>{{ filteredCount() }} warning alerts</b><span>Alerts are created only when a warning threshold is exceeded.</span></div>
      <section class="table-card" aria-label="Alerts">
        <div class="table-scroll">
          <table mat-table [dataSource]="dataSource" matSort>
            <ng-container matColumnDef="severity"><th mat-header-cell *matHeaderCellDef mat-sort-header>Severity</th><td mat-cell *matCellDef="let row"><span [class]="'severity ' + severityClass(row.severity)"><mat-icon>{{ severityIcon(row.severity) }}</mat-icon>{{ row.severity }}</span></td></ng-container>
            <ng-container matColumnDef="alert"><th mat-header-cell *matHeaderCellDef mat-sort-header>Alert</th><td mat-cell *matCellDef="let row"><span class="primary-cell"><b>{{ row.title }}</b><small>{{ row.riskTypeLabel }} · {{ row.id }}</small></span></td></ng-container>
            <ng-container matColumnDef="location"><th mat-header-cell *matHeaderCellDef mat-sort-header>Location</th><td mat-cell *matCellDef="let row"><span class="primary-cell"><b>{{ row.location.buildingName }}</b><small>{{ row.location.floorLabel || '—' }} · {{ row.location.zoneName }}</small></span></td></ng-container>
            <ng-container matColumnDef="detected"><th mat-header-cell *matHeaderCellDef mat-sort-header>Detected</th><td mat-cell *matCellDef="let row">{{ relativeTime(row.detectedAt) }}</td></ng-container>
            <ng-container matColumnDef="detection"><th mat-header-cell *matHeaderCellDef>Risk Detection</th><td mat-cell *matCellDef="let row"><span class="primary-cell detection-cell"><b>{{ row.riskDetectionId }}</b><small>{{ row.riskTypeCode }}</small></span></td></ng-container>
            <ng-container matColumnDef="delivery"><th mat-header-cell *matHeaderCellDef mat-sort-header>Delivery</th><td mat-cell *matCellDef="let row"><span [class]="'delivery ' + row.delivery.status.toLowerCase()">{{ row.delivery.label }}</span></td></ng-container>
            <ng-container matColumnDef="open"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let row"><mat-icon>chevron_right</mat-icon></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns" tabindex="0" [attr.aria-label]="'Open ' + row.title" (click)="open(row)" (keydown.enter)="open(row)" (keydown.space)="open(row); $event.preventDefault()"></tr>
          </table>
        </div>
        @if (!filteredCount()) { <resq-empty-state title="No alerts found" message="Try changing the filters." /> }
        <mat-paginator [pageSize]="25" [pageSizeOptions]="[25,50,100]" showFirstLastButtons aria-label="Alert table pagination" />
      </section>
    }
  `,
  styleUrls: ['./alerts.pages.scss', './alerts.readability.scss'],
})
export class AlertsPage implements OnInit {
  readonly workspace = inject(AlertWorkspaceFacade);
  private readonly router = inject(Router);
  readonly displayedColumns = ['severity', 'alert', 'location', 'detected', 'detection', 'delivery', 'open'];
  readonly dataSource = new MatTableDataSource<AlertWorkspaceRow>([]);
  readonly filteredCount = signal(0);
  query = '';
  buildingFilter = '';
  riskFilter = '';
  severityFilter = '';
  periodFilter = 'all';

  @ViewChild(MatSort) set matSort(sort: MatSort | undefined) { if (sort) this.dataSource.sort = sort; }
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator | undefined) { if (paginator) this.dataSource.paginator = paginator; }

  readonly buildings = computed(() => {
    const map = new Map<string, string>();
    this.workspace.rows().forEach((row) => { if (row.location.buildingId) map.set(row.location.buildingId, row.location.buildingName); });
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly riskTypes = computed(() => [...new Set(this.workspace.rows().map((row) => row.riskTypeCode))].sort());

  ngOnInit(): void {
    this.workspace.loadAlerts().subscribe({
      next: () => { this.configureSorting(); this.applyFilters(); },
      error: () => undefined,
    });
  }

  applyFilters(): void {
    const q = this.query.trim().toLowerCase();
    const cutoff = periodCutoff(this.periodFilter);
    const filtered = this.workspace.rows().filter((row) => {
      const searchable = `${row.id} ${row.title} ${row.riskTypeLabel} ${row.location.buildingName} ${row.location.zoneName}`.toLowerCase();
      return (!q || searchable.includes(q)) &&
        (!this.buildingFilter || row.location.buildingId === this.buildingFilter) &&
        (!this.riskFilter || row.riskTypeCode === this.riskFilter) &&
        (!this.severityFilter || row.severity === this.severityFilter) &&
        (!cutoff || row.generatedAt >= cutoff);
    });
    this.dataSource.data = filtered;
    this.filteredCount.set(filtered.length);
    this.dataSource.paginator?.firstPage();
  }

  resetFilters(): void { this.query = this.buildingFilter = this.riskFilter = this.severityFilter = ''; this.periodFilter = 'all'; this.applyFilters(); }
  open(row: AlertWorkspaceRow): void { void this.router.navigate(['/alerts', row.id]); }
  severityClass(value: string): string { return value.toLowerCase(); }
  severityIcon(value: string): string { return value === 'Critical' ? 'error_outline' : value === 'Warning' ? 'warning_amber' : 'info_outline'; }
  riskLabel(value: string): string { return this.workspace.rows().find((row) => row.riskTypeCode === value)?.riskTypeLabel ?? value; }
  relativeTime(date: Date): string { const min = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000)); return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.floor(min / 60)}h ago` : `${Math.floor(min / 1440)}d ago`; }
  private configureSorting(): void { this.dataSource.sortingDataAccessor = (row, column) => ({ severity: row.severity, alert: row.title, location: `${row.location.buildingName} ${row.location.zoneName}`, detected: row.detectedAt.getTime(), delivery: row.delivery.status } as Record<string, string | number>)[column] ?? ''; }
}

@Component({
  selector: 'resq-alert-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, StatusBadgeComponent, LoadingStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (workspace.loading()) {
      <resq-loading-state message="Loading alert..." />
    } @else if (workspace.error()) {
      <resq-empty-state title="Alert could not be loaded" [message]="workspace.error()!.message" />
    } @else if (workspace.detail(); as current) {
      <header class="detail-head"><div><a routerLink="/alerts">← Alert Center</a><div class="alert-title"><span [class]="'severity-mark ' + current.severity.toLowerCase()">{{ severityIcon(current.severity) }}</span><div><div class="title-line"><h2>{{ current.title }}</h2><resq-status-badge [status]="current.severity" /></div><p>{{ current.description }}</p></div></div></div></header>
      <div class="detail-grid">
        <main>
          <article class="card context-card"><div class="card-head"><div><h3>Alert Context</h3><p>Alert is read-only; risk classification belongs to Risk Detection.</p></div></div><dl class="context-grid"><div><dt>Alert ID</dt><dd><code>{{ current.id }}</code></dd></div><div><dt>Risk Detection ID</dt><dd><code>{{ current.riskDetectionId }}</code></dd></div><div><dt>Risk Type</dt><dd>{{ current.riskTypeLabel }}</dd></div><div><dt>Detected At</dt><dd>{{ formatDate(current.detectedAt) }}</dd></div><div><dt>Generated At</dt><dd>{{ formatDate(current.generatedAt) }}</dd></div><div><dt>Building</dt><dd>{{ current.location.buildingName }}</dd></div><div><dt>Floor</dt><dd>{{ current.location.floorLabel || '—' }}</dd></div><div><dt>Zone</dt><dd>{{ current.location.zoneName }}</dd></div></dl></article>
          <article class="card evidence-card"><div class="card-head"><div><h3>Detection Evidence</h3><p>Warning threshold exceeded.</p></div></div>@if(current.evidence.length){<div class="evidence-list">@for(evidence of current.evidence;track evidence.deviceId + evidence.variableType){<section><div class="evidence-device"><span>◉</span><div><a [routerLink]="['/devices',evidence.deviceId]">{{ evidence.deviceName }}</a><small>{{ evidence.deviceCode }} · {{ evidence.hardware }}</small></div></div><div class="measurement"><span>{{ evidence.measurementName }}</span><b>{{ evidence.value }} {{ evidence.unit || '' }}</b></div><dl><div><dt>Measured value</dt><dd>{{ evidence.value }} {{ evidence.unit || '' }}</dd></div><div><dt>Warning threshold</dt><dd>{{ evidence.warningThreshold ?? 'Unavailable' }} {{ evidence.unit || '' }}</dd></div><div><dt>Critical threshold</dt><dd>{{ evidence.criticalThreshold ?? 'Unavailable' }} {{ evidence.unit || '' }}</dd></div><div><dt>Detected at</dt><dd>{{ formatDate(evidence.measuredAt) }}</dd></div><div><dt>Variable</dt><dd><code>{{ evidence.variableType }}</code></dd></div></dl>@if(evidence.warningThreshold !== undefined && evidence.criticalThreshold !== undefined){<p class="threshold-proof">{{ evidence.warningThreshold }} ≤ {{ evidence.value }} &lt; {{ evidence.criticalThreshold }} · Warning threshold exceeded</p>}</section>}</div>}@else{<p class="inline-empty">Detection evidence is unavailable in the current data source.</p>}</article>
          <article class="card delivery-card"><div class="card-head"><div><h3>Notification Delivery</h3><p>Communication attempts associated with this alert.</p></div></div>@if(current.alert.deliveries.length){<div class="delivery-list">@for(delivery of current.alert.deliveries;track delivery.deliveryId){<section><div class="delivery-heading"><div><b>{{ delivery.channel }}</b><small>{{ delivery.deliveryId }}</small></div><resq-status-badge [status]="delivery.status" /></div><dl><div><dt>Recipient</dt><dd><code>{{ delivery.recipientUserId }}</code></dd></div><div><dt>Destination</dt><dd>{{ delivery.destination }}</dd></div><div><dt>Requested</dt><dd>{{ formatDate(delivery.requestedAt) }}</dd></div><div><dt>Completed</dt><dd>{{ delivery.completedAt ? formatDate(delivery.completedAt) : '—' }}</dd></div>@if(delivery.failureReason){<div class="failure"><dt>Failure reason</dt><dd>{{ delivery.failureReason }}</dd></div>}</dl></section>}</div>}@else{<p class="inline-empty">No notification deliveries were requested.</p>}</article>
          @if(current.responseExecutions.length){<article class="card response-card"><div class="card-head"><div><h3>Response Activity</h3><p>Execution lifecycle belongs to Alert & Response Management.</p></div></div><div class="response-list">@for(execution of current.responseExecutions;track execution.responseExecutionId){<section><div class="response-heading"><div><b>{{ actionLabel(execution) }}</b><small>{{ execution.responseExecutionId }}</small></div><resq-status-badge [status]="execution.status" /></div><dl><div><dt>Target Device</dt><dd><a [routerLink]="['/devices',execution.action.targetDeviceId]">{{ execution.action.targetDeviceId }}</a></dd></div><div><dt>Capability</dt><dd><code>{{ execution.action.targetCapabilityCode }}</code></dd></div><div><dt>Authorization</dt><dd>{{ execution.action.authorizationMode === 'HUMAN_REQUIRED' ? 'Human required' : 'Automatic' }}</dd></div><div><dt>Requested</dt><dd>{{ formatDate(execution.requestedAt) }}</dd></div>@if(execution.authorization){<div><dt>Decision</dt><dd>{{ execution.authorization.decision }}</dd></div>}@if(execution.result){<div class="result"><dt>Result</dt><dd>{{ execution.result.message || execution.result.resultCode }}</dd></div>}</dl>@if(workspace.canDecideAuthorization(execution)){<div class="authorization-actions"><button type="button" (click)="decide(execution,'APPROVED')">Approve</button><button type="button" class="reject" (click)="decide(execution,'REJECTED')">Reject</button></div>}</section>}</div></article>}
        </main>
        <aside><article class="card incident-card"><div class="card-head"><div><h3>Independent Critical Outcome</h3><p>Alerts do not escalate into Incidents.</p></div></div><p class="inline-empty">This alert was generated because the warning threshold was exceeded. Incidents are generated independently when the critical threshold is reached.</p><a routerLink="/incidents">Open Incidents →</a></article></aside>
      </div>
    } @else {
      <div class="not-found"><span>△</span><h2>Alert Not Found</h2><p>The requested alert does not exist or is unavailable.</p><a routerLink="/alerts">Return to Alert Center</a></div>
    }
  `,
  styleUrls: ['./alert-detail.page.scss', './alerts.readability.scss'],
})
export class AlertDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  readonly workspace = inject(AlertWorkspaceFacade);
  ngOnInit(): void { this.workspace.loadDetail(this.route.snapshot.paramMap.get('alertId') ?? '').subscribe({ error: () => undefined }); }
  severityIcon(severity: string): string { return severity === 'Critical' ? '!' : severity === 'Warning' ? '△' : 'i'; }
  formatDate(date: Date): string { return date.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  actionLabel(execution: ResponseExecutionRecord): string { return execution.action.actionCode.replace(/[_-]+/g,' ').replace(/\b\w/g,(value)=>value.toUpperCase()); }
  decide(execution: ResponseExecutionRecord, decision: 'APPROVED' | 'REJECTED'): void { this.workspace.decideAuthorization(execution.responseExecutionId, decision).subscribe({ next: () => this.snack.open(`Response ${decision.toLowerCase()}.`, 'Close', { duration: 2200 }), error: () => undefined }); }
}

function periodCutoff(period: string): Date | undefined { const now = Date.now(); if(period==='24h') return new Date(now-86_400_000); if(period==='7d') return new Date(now-7*86_400_000); if(period==='30d') return new Date(now-30*86_400_000); return undefined; }
