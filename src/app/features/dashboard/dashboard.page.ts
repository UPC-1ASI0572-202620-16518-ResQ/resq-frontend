import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, exhaustMap, timer } from 'rxjs';
import { BarChartComponent, DoughnutChartComponent, EmptyStateComponent, KpiCardComponent, LineChartComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';
import { AnalyticsWorkspaceFacade } from '../analytics/analytics-workspace.facade';
import { ResponseActivityComponent } from '../../shared/ui/response-activity.component';
import {
  ENVIRONMENTAL_VARIABLES,
  EnvironmentalVariable,
  monitoringUnitLabel,
  monitoringVariableLabel,
} from '../monitoring/monitoring-presentation';

@Component({
  selector: 'resq-dashboard-page',
  standalone: true,
  imports: [RouterLink, KpiCardComponent, DoughnutChartComponent, LineChartComponent, BarChartComponent, StatusBadgeComponent, ResponseActivityComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis"><resq-kpi-card icon="apartment" [value]="analytics.buildings().length" label="Buildings Monitored"/><resq-kpi-card icon="sensors" [value]="activeDevices()" label="Connected Devices" tone="green"/><resq-kpi-card icon="warning_amber" [value]="recentAlertCount()" label="Active Alerts" tone="red"/><resq-kpi-card icon="grid_view" [value]="criticalSpaces()" label="Critical Spaces" tone="red"/></section>
    @if (analytics.partialErrors().length) {
      <section class="partial-errors" role="status"><b>Datos parciales</b><span>{{ partialErrorMessage() }}</span></section>
    }
    <resq-response-activity/>
    <section class="hero-grid">
      <article class="card environmental"><div class="card-head"><div><h2>Environmental Overview</h2><p>Historical measurements stored by Monitoring</p></div></div><div class="metric-tabs">@for(metric of environmentalMetrics;track metric.value){<button type="button" [class.active]="environmentalMetric()===metric.value" (click)="environmentalMetric.set(metric.value)">{{metric.label}}</button>}<div><b>{{environmentalAverage()}} {{environmentalUnit()}}</b><small>Average</small></div><div><b>{{environmentalMinimum()}} {{environmentalUnit()}}</b><small>Minimum</small></div><div><b>{{environmentalMaximum()}} {{environmentalUnit()}}</b><small>Maximum</small></div></div>@if(environmentalReadings().length){<resq-line-chart [labels]="environmentalLabels()" [values]="environmentalValues()" [datasetLabel]="environmentalLabel()" [unit]="environmentalUnit()"/>}@else{<resq-empty-state title="No stored measurements" [message]="'Monitoring has no '+environmentalLabel().toLowerCase()+' readings for registered devices.'"/>}</article>
      <article class="card risk"><div class="card-head"><div><h2>Risk Distribution</h2><p>Current zone status</p></div><a routerLink="/spaces">View spaces →</a></div><div class="risk-chart"><div class="ring"><span><b>{{totalZones()}}</b>Spaces</span></div><ul>@for(status of riskStatuses;track status){<li><i [class]="status.toLowerCase()"></i><span>{{status}}</span><b>{{spaceStatusCount(status)}}</b><em>{{spaceStatusPercent(status)}}%</em></li>}</ul></div></article>
    </section>
    <section class="lower-grid">
      <article class="card"><div class="card-head"><div><h2>Active Alerts</h2><p>Latest classified risks</p></div><a routerLink="/alerts">View all →</a></div><div class="feed">@for(alert of alerts();track alert.id){<a [routerLink]="'/alerts/'+alert.id"><span class="alert-icon">!</span><div><b>{{alert.title}}</b><small>{{alert.location.zoneName}} · {{alert.severity}}</small></div><time>{{minutesAgo(alert.generatedAt)}} min</time></a>}</div></article>
      <article class="card device-card"><div class="card-head"><div><h2>Device Status</h2><p>Fleet connectivity</p></div><span>Total: {{analytics.devices().length}}</span></div><div class="device-content"><resq-doughnut-chart [values]="deviceStatusValues()" [centerValue]="analytics.devices().length" centerLabel="Devices"/><ul>@for(status of deviceStatuses;track status){<li><i [class]="status.toLowerCase()"></i>{{status}} <b>{{deviceStatusCount(status)}}</b><em>{{deviceStatusPercent(status)}}%</em></li>}</ul></div></article>
      <article class="card"><div class="card-head"><div><h2>Recent Incidents</h2><p>Response activity</p></div><a routerLink="/incidents">View all →</a></div><div class="incident-list">@for(incident of incidents();track incident.incident.incidentId){<a [routerLink]="'/incidents/'+incident.incident.incidentId"><div><b>{{incident.title}}</b><small>{{incident.incident.incidentId}} · {{incident.location.zoneName}}</small></div><resq-status-badge [status]="incident.incident.status"/></a>}</div></article>
    </section>
    <section class="insights-head"><div><h2>Operational Analytics</h2><p>Trends from alerts, incidents and monitored zones</p></div><div class="period">@for(item of periods;track item.value){<button type="button" [class.active]="period()===item.value" (click)="period.set(item.value)">{{item.label}}</button>}</div></section>
    <section class="analytics-grid">
      <article class="card wide"><div class="card-head"><div><h2>Alerts Over Time</h2><p>Alert & Response read model for the selected period</p></div></div><resq-line-chart [labels]="alertTimeLabels()" [values]="alertTimeValues()" datasetLabel="Alerts"/></article>
      <article class="card"><div class="card-head"><div><h2>Most Affected Zones</h2><p>Alerts grouped by Building Management zone</p></div></div><resq-bar-chart [labels]="affectedZoneLabels()" [values]="affectedZoneValues()" color="#f04438"/></article>
      <article class="card"><div class="card-head"><div><h2>Incidents Over Time</h2><p>Incidents created in the selected period</p></div></div><resq-bar-chart [labels]="incidentTimeLabels()" [values]="incidentTimeValues()"/></article>
      <article class="card wide"><div class="card-head"><div><h2>Resolution Performance</h2><p>Observed Incident Management durations</p></div></div><div class="performance"><div><span>Resolved incidents</span><b>{{resolvedCount()}}</b><em [style.--w]="resolutionWidth(resolvedCount())"></em></div><div><span>In progress</span><b>{{inProgressCount()}}</b><em [style.--w]="resolutionWidth(inProgressCount())"></em></div><div><span>Active</span><b>{{activeCount()}}</b><em [style.--w]="resolutionWidth(activeCount())"></em></div></div></article>
    </section>
  `,
  styleUrls: ['./dashboard.page.scss', './dashboard.analytics.scss'],
})
export class DashboardPage implements OnInit {
  readonly analytics = inject(AnalyticsWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);
  readonly alerts = computed(() => this.analytics.alerts().slice(0, 5));
  readonly recentAlertCount = computed(() => this.analytics.alerts().filter((item) => item.status === 'ACTIVE').length);
  readonly incidents = computed(() => this.analytics.incidents().slice(0, 4));
  readonly period = signal<'24h' | '7d' | '30d'>('7d');
  readonly periods = [{ value: '24h' as const, label: 'Last 24 Hours' }, { value: '7d' as const, label: 'Last 7 Days' }, { value: '30d' as const, label: 'Last 30 Days' }];
  readonly environmentalMetric = signal<EnvironmentalVariable>('TEMPERATURE_C');
  readonly environmentalMetrics = ENVIRONMENTAL_VARIABLES.map((value) => ({
    value,
    label: monitoringVariableLabel(value),
  }));
  readonly activeDevices = computed(() => this.analytics.devices().filter((row) => row.connection?.status === 'ONLINE').length);
  readonly criticalSpaces = computed(() => new Set(this.analytics.alerts().filter((item) => item.status === 'ACTIVE' && item.severity.toUpperCase() === 'CRITICAL').map((item) => item.location.zoneId).filter(Boolean)).size);
  readonly totalZones = computed(() => this.analytics.buildings().reduce((total, building) => total + building.zones.length, 0));
  readonly riskStatuses = ['Normal', 'Warning', 'Critical', 'Offline'] as const;
  readonly deviceStatuses = ['Online', 'Warning', 'Critical', 'Offline'] as const;
  readonly deviceStatusValues = computed(() => this.deviceStatuses.map(status => this.deviceStatusCount(status)));
  readonly environmentalReadings = computed(() => {
    const readings = this.analytics.measurements()
      .filter((reading) => reading.variableType.toUpperCase() === this.environmentalMetric())
      .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
    const latestUnit = readings.at(-1)?.measurementValue.unit.toUpperCase();
    return readings
      .filter((reading) => !latestUnit || reading.measurementValue.unit.toUpperCase() === latestUnit)
      .slice(-30);
  });
  readonly filteredAlerts = computed(() => this.analytics.alerts().filter(item => item.generatedAt >= this.cutoff()));
  readonly filteredIncidents = computed(() => this.analytics.incidents().filter(item => item.incident.createdAt >= this.cutoff()));

  ngOnInit(): void {
    timer(0, 30_000).pipe(
      exhaustMap(() => this.analytics.load().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
  environmentalLabels(): string[] { return this.environmentalReadings().map(item => item.measuredAt.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })); }
  environmentalValues(): number[] { return this.environmentalReadings().map(item => item.measurementValue.value); }
  environmentalUnit(): string { const item = this.environmentalReadings().at(-1); return item ? monitoringUnitLabel(item.variableType, item.measurementValue.unit) : ''; }
  environmentalLabel(): string { return monitoringVariableLabel(this.environmentalMetric()); }
  partialErrorMessage(): string { return this.analytics.partialErrors().map((issue) => issue.message).join(' '); }
  environmentalAverage(): string { return this.stat(values => values.reduce((sum, value) => sum + value, 0) / values.length); }
  environmentalMinimum(): string { return this.stat(values => Math.min(...values)); }
  environmentalMaximum(): string { return this.stat(values => Math.max(...values)); }
  spaceStatusCount(status: typeof this.riskStatuses[number]): number { const active = this.analytics.alerts().filter((item) => item.status === 'ACTIVE' && item.location.zoneId); const critical = new Set(active.filter((item) => item.severity.toUpperCase() === 'CRITICAL').map((item) => item.location.zoneId)); const warning = new Set(active.filter((item) => item.severity.toUpperCase() !== 'CRITICAL').map((item) => item.location.zoneId)); if (status === 'Critical') return critical.size; if (status === 'Warning') return [...warning].filter((id) => !critical.has(id)).length; if (status === 'Offline') return 0; return Math.max(0, this.totalZones() - new Set([...critical, ...warning]).size); }
  spaceStatusPercent(status: typeof this.riskStatuses[number]): number { return this.percentage(this.spaceStatusCount(status), this.totalZones()); }
  deviceStatusCount(status: typeof this.deviceStatuses[number]): number { const rows = this.analytics.devices(); if (status === 'Offline') return rows.filter((row) => row.connection?.status !== 'ONLINE').length; if (status === 'Warning') return rows.filter((row) => row.connection?.status === 'ONLINE' && row.connection.signalStrength !== undefined && row.connection.signalStrength < -75).length; if (status === 'Critical') return 0; return rows.filter((row) => row.connection?.status === 'ONLINE' && (row.connection.signalStrength === undefined || row.connection.signalStrength >= -75)).length; }
  deviceStatusPercent(status: typeof this.deviceStatuses[number]): number { return this.percentage(this.deviceStatusCount(status), this.analytics.devices().length); }
  minutesAgo(date: Date): number { return Math.max(1, Math.round((Date.now() - date.getTime()) / 60000)); }
  alertTimeLabels(): string[] { return this.timeBuckets(this.filteredAlerts().map(item => item.generatedAt)).labels; }
  alertTimeValues(): number[] { return this.timeBuckets(this.filteredAlerts().map(item => item.generatedAt)).values; }
  incidentTimeLabels(): string[] { return this.timeBuckets(this.filteredIncidents().map(item => item.incident.createdAt)).labels; }
  incidentTimeValues(): number[] { return this.timeBuckets(this.filteredIncidents().map(item => item.incident.createdAt)).values; }
  affectedZoneLabels(): string[] { return this.zoneDistribution().map(item => item[0]); }
  affectedZoneValues(): number[] { return this.zoneDistribution().map(item => item[1]); }
  resolvedCount(): number { return this.filteredIncidents().filter(row => row.incident.status === 'RESOLVED' || row.incident.status === 'CLOSED').length; }
  inProgressCount(): number { return this.filteredIncidents().filter(row => row.incident.status === 'IN_PROGRESS').length; }
  activeCount(): number { return this.filteredIncidents().filter(row => row.incident.status === 'ACTIVE').length; }
  resolutionWidth(value: number): string { return `${this.percentage(value, Math.max(1, this.filteredIncidents().length))}%`; }
  private stat(calculate: (values: number[]) => number): string { const values = this.environmentalValues(); return values.length ? calculate(values).toFixed(1) : '—'; }
  private percentage(value: number, total: number): number { return total ? Math.round(value / total * 100) : 0; }
  private cutoff(): Date { const days = this.period() === '24h' ? 1 : this.period() === '7d' ? 7 : 30; return new Date(Date.now() - days * 86400000); }
  private zoneDistribution(): Array<[string, number]> { const map = new Map<string, number>(); this.filteredAlerts().forEach(item => map.set(item.location.zoneName, (map.get(item.location.zoneName) ?? 0) + 1)); return [...map].sort((a, b) => b[1] - a[1]).slice(0, 6); }
  private timeBuckets(dates: Date[]): { labels: string[]; values: number[] } { const map = new Map<string, number>(); dates.forEach(date => { const key = this.period() === '24h' ? date.toLocaleTimeString([], { hour: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: '2-digit' }); map.set(key, (map.get(key) ?? 0) + 1); }); const items = [...map]; return { labels: items.map(item => item[0]), values: items.map(item => item[1]) }; }
}
