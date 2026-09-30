import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  AlertDetailViewModel,
  AlertListItem,
  AlertPeriod,
  AlertSeverity,
  AlertSummary,
  Building,
  Floor,
  Space,
} from '../../core/models/resq.models';
import {
  AlertService,
  BuildingService,
  FloorService,
  SpaceService,
} from '../../core/services/data.services';
import { KpiCardComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';

@Component({
  selector: 'resq-alerts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    KpiCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis" aria-label="Alert summary for the last 24 hours">
      <resq-kpi-card icon="△" [value]="summary().total" label="Alerts — Last 24h" />
      <resq-kpi-card icon="!" [value]="summary().critical" label="Critical" tone="red" />
      <resq-kpi-card icon="△" [value]="summary().warning" label="Warning" tone="amber" />
      <resq-kpi-card icon="×" [value]="summary().notificationFailures" label="Notification Failures" tone="red" />
    </section>

    <section class="filters" aria-label="Alert filters">
      <label class="search-field">
        <span>Search</span><span class="search-icon" aria-hidden="true">⌕</span>
        <input [(ngModel)]="query" (ngModelChange)="applyFilters()" placeholder="Risk, location, detection or device..." aria-label="Search alerts" />
      </label>
      <label><span>Building</span><select [(ngModel)]="buildingId" (ngModelChange)="onBuildingChange()" aria-label="Filter alerts by building"><option value="">All buildings</option>@for (building of buildings(); track building.id) {<option [value]="building.id">{{ building.name }}</option>}</select></label>
      <label><span>Floor</span><select [(ngModel)]="floorId" (ngModelChange)="onFloorChange()" aria-label="Filter alerts by floor"><option value="">All floors</option>@for (floor of availableFloors(); track floor.id) {<option [value]="floor.id">{{ floor.name }}</option>}</select></label>
      <label><span>Zone / Space</span><select [(ngModel)]="zoneId" (ngModelChange)="applyFilters()" aria-label="Filter alerts by zone or space"><option value="">All zones</option>@for (zone of availableZones(); track zone.id) {<option [value]="zone.id">{{ zone.name }}</option>}</select></label>
      <label><span>Risk Type</span><select [(ngModel)]="riskType" (ngModelChange)="applyFilters()" aria-label="Filter alerts by risk type"><option value="">All risk types</option>@for (risk of riskTypes(); track risk.code) {<option [value]="risk.code">{{ risk.label }}</option>}</select></label>
      <label><span>Severity</span><select [(ngModel)]="severity" (ngModelChange)="applyFilters()" aria-label="Filter alerts by severity"><option value="">All severities</option><option value="Critical">Critical</option><option value="Warning">Warning</option><option value="Info">Info</option></select></label>
      <label><span>Period</span><select [(ngModel)]="period" (ngModelChange)="applyFilters()" aria-label="Filter alerts by period"><option value="24h">Last 24 Hours</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="all">All Time</option></select></label>
      <button class="reset" type="button" (click)="resetFilters()">Reset Filters</button>
    </section>

    <div class="result-summary" aria-live="polite"><b>{{ filteredCount() }} alerts</b><span>Risk alerts with detection and delivery context</span></div>

    @if (loading()) {
      <div class="state-card" role="status"><span class="spinner"></span>Loading Alerts...</div>
    } @else if (loadError()) {
      <div class="state-card error" role="alert"><b>Unable to load alerts</b><span>Please try again.</span><button type="button" (click)="load()">Retry</button></div>
    } @else if (!dataSource.data.length) {
      <div class="state-card"><b>{{ allAlerts().length ? 'No alerts match the selected filters' : 'No alerts found' }}</b>@if (allAlerts().length) {<button type="button" (click)="resetFilters()">Reset Filters</button>}</div>
    } @else {
      <section class="table-card" aria-label="Risk alerts">
        <div class="table-scroll">
          <table mat-table [dataSource]="dataSource" matSort aria-label="Alert Center results">
            <ng-container matColumnDef="severity"><th mat-header-cell *matHeaderCellDef mat-sort-header>Severity</th><td mat-cell *matCellDef="let alert"><span [class]="'severity ' + alert.severity.toLowerCase()"><span aria-hidden="true">{{ severityIcon(alert.severity) }}</span> {{ alert.severity }}</span></td></ng-container>
            <ng-container matColumnDef="alert"><th mat-header-cell *matHeaderCellDef mat-sort-header>Alert / Risk</th><td mat-cell *matCellDef="let alert"><span class="primary-cell"><b>{{ alert.title }}</b><small>{{ alert.riskTypeLabel }} · {{ alert.id }}</small></span></td></ng-container>
            <ng-container matColumnDef="location"><th mat-header-cell *matHeaderCellDef mat-sort-header>Location</th><td mat-cell *matCellDef="let alert"><span class="primary-cell"><b>{{ alert.location.buildingName }}</b><small>{{ locationDetail(alert) }}</small></span></td></ng-container>
            <ng-container matColumnDef="detected"><th mat-header-cell *matHeaderCellDef mat-sort-header>Detected</th><td mat-cell *matCellDef="let alert"><time [attr.datetime]="alert.detectedAt.toISOString()" [attr.title]="formatDate(alert.detectedAt)" [attr.aria-label]="'Detected ' + formatDate(alert.detectedAt)">{{ relativeTime(alert.detectedAt) }}</time></td></ng-container>
            <ng-container matColumnDef="detection"><th mat-header-cell *matHeaderCellDef mat-sort-header>Detection</th><td mat-cell *matCellDef="let alert"><span class="primary-cell detection-cell"><b>{{ alert.riskDetectionId }}</b>@if (alert.primaryEvidence) {<small>{{ alert.primaryEvidence.deviceCode }} · {{ alert.primaryEvidence.measurementName }}</small>} @else {<small>Evidence unavailable</small>}</span></td></ng-container>
            <ng-container matColumnDef="delivery"><th mat-header-cell *matHeaderCellDef mat-sort-header>Delivery</th><td mat-cell *matCellDef="let alert"><span [class]="'delivery ' + alert.delivery.status.toLowerCase()">{{ alert.delivery.label }}</span></td></ng-container>
            <ng-container matColumnDef="incident"><th mat-header-cell *matHeaderCellDef mat-sort-header>Related Incident</th><td mat-cell *matCellDef="let alert">@if (alert.relatedIncident) {<a class="incident-link" [routerLink]="['/incidents', alert.relatedIncident.id]" (click)="$event.stopPropagation()" [attr.aria-label]="'Open incident ' + alert.relatedIncident.id"><b>{{ alert.relatedIncident.id }}</b><small>{{ incidentStatus(alert) }}</small></a>} @else {<span aria-label="No related incident">—</span>}</td></ng-container>
            <ng-container matColumnDef="open"><th mat-header-cell *matHeaderCellDef><span class="sr-only">Open</span></th><td mat-cell *matCellDef="let alert"><span aria-hidden="true">›</span></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let alert; columns: displayedColumns" tabindex="0" (click)="openAlert(alert)" (keydown.enter)="openAlert(alert)" (keydown.space)="openAlertFromKeyboard($event, alert)" [attr.aria-label]="'Open alert ' + alert.id + ', ' + alert.title"></tr>
          </table>
        </div>
        <mat-paginator [pageSize]="10" [pageSizeOptions]="[10, 20, 50]" showFirstLastButtons aria-label="Alert table pagination" />
      </section>
    }
  `,
  styleUrl: './alerts.pages.scss',
})
export class AlertsPage implements OnInit {
  readonly dataSource = new MatTableDataSource<AlertListItem>([]);
  readonly displayedColumns = ['severity', 'alert', 'location', 'detected', 'detection', 'delivery', 'incident', 'open'];
  readonly allAlerts = signal<AlertListItem[]>([]);
  readonly buildings = signal<Building[]>([]);
  readonly floors = signal<Floor[]>([]);
  readonly zones = signal<Space[]>([]);
  readonly summary = signal<AlertSummary>({ total: 0, critical: 0, warning: 0, notificationFailures: 0 });
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly filteredCount = signal(0);
  query = '';
  buildingId = '';
  floorId = '';
  zoneId = '';
  riskType = '';
  severity = '';
  period: AlertPeriod = '24h';
  private paginator?: MatPaginator;
  private sort?: MatSort;

  @ViewChild(MatPaginator) set tablePaginator(value: MatPaginator | undefined) { this.paginator = value; this.dataSource.paginator = value ?? null; }
  @ViewChild(MatSort) set tableSort(value: MatSort | undefined) { this.sort = value; this.dataSource.sort = value ?? null; }

  constructor(
    private readonly alertService: AlertService,
    private readonly buildingService: BuildingService,
    private readonly floorService: FloorService,
    private readonly spaceService: SpaceService,
    private readonly router: Router,
  ) {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'severity': return item.severity === 'Critical' ? 3 : item.severity === 'Warning' ? 2 : 1;
        case 'alert': return item.title;
        case 'location': return `${item.location.buildingName} ${item.location.floorName} ${item.location.zoneName}`;
        case 'detected': return item.detectedAt.getTime();
        case 'detection': return item.riskDetectionId;
        case 'delivery': return item.delivery.status;
        case 'incident': return item.relatedIncident?.id ?? '';
        default: return item.id;
      }
    };
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      alerts: this.alertService.getAlerts(),
      buildings: this.buildingService.getBuildings(),
      floors: this.floorService.getFloors(),
      zones: this.spaceService.getSpaces(),
      summary: this.alertService.getAlertSummary('24h'),
    }).pipe(
      catchError(() => { this.loadError.set(true); return of(undefined); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((result) => {
      if (!result) return;
      this.allAlerts.set(result.alerts);
      this.buildings.set(result.buildings);
      this.floors.set(result.floors);
      this.zones.set(result.zones);
      this.summary.set(result.summary);
      this.applyFilters();
    });
  }

  availableFloors(): Floor[] { return this.buildingId ? this.floors().filter((floor) => floor.buildingId === this.buildingId) : this.floors(); }
  availableZones(): Space[] { return this.zones().filter((zone) => (!this.buildingId || zone.buildingId === this.buildingId) && (!this.floorId || zone.floorId === this.floorId)); }
  riskTypes(): Array<{ code: string; label: string }> { const values = new Map<string, string>(); this.allAlerts().forEach((alert) => values.set(alert.riskTypeCode, alert.riskTypeLabel)); return [...values].map(([code, label]) => ({ code, label })); }
  onBuildingChange(): void { this.floorId = ''; this.zoneId = ''; this.applyFilters(); }
  onFloorChange(): void { this.zoneId = ''; this.applyFilters(); }

  applyFilters(): void {
    const query = this.query.trim().toLowerCase();
    const periodStart = this.periodStart(this.period);
    const filtered = this.allAlerts().filter((alert) => {
      const searchable = [alert.title, alert.riskTypeLabel, alert.riskTypeCode, alert.riskDetectionId, alert.location.buildingName, alert.location.floorName, alert.location.zoneName, alert.location.roomNumber, alert.primaryEvidence?.deviceCode].filter(Boolean).join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (!this.buildingId || alert.location.buildingId === this.buildingId) && (!this.floorId || alert.location.floorId === this.floorId) && (!this.zoneId || alert.location.zoneId === this.zoneId) && (!this.riskType || alert.riskTypeCode === this.riskType) && (!this.severity || alert.severity === this.severity) && (!periodStart || alert.generatedAt.getTime() >= periodStart);
    });
    this.dataSource.data = filtered;
    this.filteredCount.set(filtered.length);
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.paginator?.firstPage();
  }

  resetFilters(): void { this.query = ''; this.buildingId = ''; this.floorId = ''; this.zoneId = ''; this.riskType = ''; this.severity = ''; this.period = '24h'; this.applyFilters(); }
  openAlert(alert: AlertListItem): void { this.router.navigate(['/alerts', alert.id]); }
  openAlertFromKeyboard(event: Event, alert: AlertListItem): void { event.preventDefault(); this.openAlert(alert); }
  severityIcon(severity: AlertSeverity): string { return severity === 'Critical' ? '!' : severity === 'Warning' ? '△' : 'i'; }
  locationDetail(alert: AlertListItem): string { if (!alert.location.available) return 'Location unavailable'; return [alert.location.floorName, alert.location.zoneName, alert.location.roomNumber ? `Room ${alert.location.roomNumber}` : undefined].filter(Boolean).join(' · '); }
  incidentStatus(alert: AlertListItem): string { const status = alert.relatedIncident?.status; return status === 'InProgress' ? 'In Progress' : (status ?? ''); }
  relativeTime(date: Date): string { const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000)); if (minutes < 1) return 'Just now'; if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`; }
  formatDate(date: Date): string { return date.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  private periodStart(period: AlertPeriod): number | undefined { if (period === 'all') return undefined; const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30; return Date.now() - hours * 60 * 60 * 1_000; }
}

@Component({
  selector: 'resq-alert-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="state-card detail-state" role="status"><span class="spinner"></span>Loading Alert...</div>
    } @else if (loadError()) {
      <div class="state-card detail-state error" role="alert"><b>Unable to load alert</b><a routerLink="/alerts">Return to Alert Center</a></div>
    } @else if (detail(); as current) {
      <header class="detail-head"><div><a routerLink="/alerts">← Alert Center</a><div class="alert-title"><span [class]="'severity-mark ' + current.severity.toLowerCase()" aria-hidden="true">{{ severityIcon(current.severity) }}</span><div><div class="title-line"><h2>{{ current.title }}</h2><resq-status-badge [status]="current.severity" /></div><p>{{ current.id }} · Detected {{ formatDate(current.detectedAt) }} · {{ relativeTime(current.detectedAt) }}</p></div></div></div></header>
      <div class="detail-grid">
        <main>
          <article class="card context-card"><div class="card-head"><div><h3>Alert Context</h3><p>Risk information preserved when the alert was generated.</p></div></div><dl class="context-grid"><div><dt>Severity</dt><dd><resq-status-badge [status]="current.severity" /></dd></div><div><dt>Risk Type</dt><dd>{{ current.riskTypeLabel }} <code>{{ current.riskTypeCode }}</code></dd></div><div><dt>Risk Detection ID</dt><dd><code>{{ current.riskDetectionId }}</code></dd></div><div><dt>Detected At</dt><dd>{{ formatDate(current.detectedAt) }}</dd></div><div><dt>Generated At</dt><dd>{{ formatDate(current.generatedAt) }}</dd></div><div><dt>Building</dt><dd>{{ current.location.buildingName }}</dd></div><div><dt>Floor</dt><dd>{{ current.location.floorName }}</dd></div><div><dt>Zone / Space</dt><dd>{{ current.location.zoneName }}</dd></div><div><dt>Room</dt><dd>{{ current.location.roomNumber || '—' }}</dd></div></dl></article>
          <article class="card evidence-card"><div class="card-head"><div><h3>Detection Evidence</h3><p>Measurements captured when the risk was detected.</p></div></div>@if (current.evidence.length) {<div class="evidence-list">@for (evidence of current.evidence; track evidence.deviceId + evidence.capabilityCode) {<section><div class="evidence-device"><span aria-hidden="true">◉</span><div><a [routerLink]="['/devices', evidence.deviceId]">{{ evidence.deviceName }}</a><small>{{ evidence.deviceCode }} · {{ evidence.hardware }}</small></div></div><div class="measurement"><span>{{ evidence.measurementName }}</span><b>{{ evidence.value }} {{ evidence.unit }}</b></div><dl><div><dt>Captured</dt><dd>{{ formatDate(evidence.capturedAt) }}</dd></div><div><dt>Capability</dt><dd><code>{{ evidence.capabilityCode }}</code></dd></div></dl></section>}</div>} @else {<p class="inline-empty">Detection evidence is unavailable.</p>}</article>
          <article class="card delivery-card"><div class="card-head"><div><h3>Notification Delivery</h3><p>Communication attempts associated with this alert.</p></div></div>@if (current.alert.deliveries.length) {<div class="delivery-list">@for (delivery of current.alert.deliveries; track delivery.deliveryId) {<section><div class="delivery-heading"><div><b>{{ channelLabel(delivery.channel) }}</b><small>{{ delivery.deliveryId }}</small></div><resq-status-badge [status]="delivery.status" /></div><dl><div><dt>Recipient</dt><dd><code>{{ delivery.recipientUserId }}</code></dd></div><div><dt>Destination</dt><dd>{{ delivery.destination }}</dd></div><div><dt>Requested</dt><dd>{{ formatDate(delivery.requestedAt) }}</dd></div><div><dt>Completed</dt><dd>{{ delivery.completedAt ? formatDate(delivery.completedAt) : '—' }}</dd></div>@if (delivery.failureReason) {<div class="failure"><dt>Failure reason</dt><dd>{{ delivery.failureReason }}</dd></div>}</dl></section>}</div>} @else {<p class="inline-empty">No notification deliveries were requested.</p>}</article>
          @if (current.responseExecutions.length) {<article class="card response-card"><div class="card-head"><div><h3>Response Activity</h3><p>Response executions recorded for this risk detection.</p></div></div><div class="response-list">@for (execution of current.responseExecutions; track execution.responseExecutionId) {<section><div class="response-heading"><div><b>{{ execution.action.actionName }}</b><small>{{ execution.responseExecutionId }}</small></div><resq-status-badge [status]="execution.status" /></div><dl><div><dt>Target Device</dt><dd><a [routerLink]="['/devices', execution.action.targetDeviceId]">{{ execution.targetDeviceCode }}</a></dd></div><div><dt>Capability</dt><dd><code>{{ execution.action.targetCapabilityCode }}</code></dd></div><div><dt>Authorization</dt><dd>{{ authorizationLabel(execution.action.authorizationMode) }}</dd></div><div><dt>Requested</dt><dd>{{ formatDate(execution.requestedAt) }}</dd></div><div><dt>Completed</dt><dd>{{ execution.result ? formatDate(execution.result.completedAt) : '—' }}</dd></div>@if (execution.result?.message) {<div class="result"><dt>Result</dt><dd>{{ execution.result?.message }}</dd></div>}</dl></section>}</div></article>}
        </main>
        <aside>@if (current.relatedIncident; as incident) {<article class="card incident-card"><div class="card-head"><div><h3>Related Incident</h3><p>Operational follow-up is managed in Incidents.</p></div></div><div class="incident-summary"><span aria-hidden="true">◇</span><div><b>{{ incident.title }}</b><small>{{ incident.id }}</small></div><resq-status-badge [status]="incident.status" /></div><dl><div><dt>Severity</dt><dd>{{ incident.severity }}</dd></div><div><dt>Status</dt><dd>{{ incidentStatus(incident.status) }}</dd></div></dl><a [routerLink]="['/incidents', incident.id]">Open Incident →</a></article>} @else {<article class="card incident-card"><div class="card-head"><div><h3>Related Incident</h3></div></div><p class="inline-empty">No incident is associated with this alert.</p></article>}</aside>
      </div>
    } @else {
      <div class="not-found"><span aria-hidden="true">△</span><h2>Alert Not Found</h2><p>The requested alert does not exist or is unavailable.</p><a routerLink="/alerts">Return to Alert Center</a></div>
    }
  `,
  styleUrl: './alert-detail.page.scss',
})
export class AlertDetailPage implements OnInit {
  readonly detail = signal<AlertDetailViewModel | undefined>(undefined);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  constructor(private readonly route: ActivatedRoute, private readonly alertService: AlertService) {}
  ngOnInit(): void { const id = this.route.snapshot.paramMap.get('alertId') ?? ''; this.alertService.getAlertDetail(id).pipe(catchError(() => { this.loadError.set(true); return of(undefined); }), finalize(() => this.loading.set(false))).subscribe((detail) => this.detail.set(detail)); }
  severityIcon(severity: AlertSeverity): string { return severity === 'Critical' ? '!' : severity === 'Warning' ? '△' : 'i'; }
  formatDate(date: Date): string { return date.toLocaleString([], { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  relativeTime(date: Date): string { const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000)); if (minutes < 1) return 'just now'; if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`; }
  channelLabel(channel: string): string { return channel === 'PUSH' ? 'Push notification' : channel; }
  authorizationLabel(mode: string): string { return mode === 'HUMAN_REQUIRED' ? 'Human required' : 'Automatic'; }
  incidentStatus(status: string): string { return status === 'InProgress' ? 'In Progress' : status; }
}
