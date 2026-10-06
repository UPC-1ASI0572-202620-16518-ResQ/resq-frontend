import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DeviceType } from '../../core/models/resq.models';
import { AlertService } from '../../core/services/data.services';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { RiskEventStoreService } from '../../core/services/risk-event-store.service';
import { BarChartComponent, DoughnutChartComponent, KpiCardComponent, LineChartComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';
import { AnalyticsWorkspaceFacade } from '../analytics/analytics-workspace.facade';

@Component({
  selector: 'resq-dashboard-page',
  standalone: true,
  imports: [RouterLink, KpiCardComponent, DoughnutChartComponent, LineChartComponent, BarChartComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis"><resq-kpi-card icon="apartment" [value]="store.buildings().length" label="Buildings Monitored"/><resq-kpi-card icon="sensors" [value]="activeDevices()" label="Active Devices" tone="green"/><resq-kpi-card icon="warning_amber" [value]="recentAlertCount()" label="Active Alerts" tone="red"/><resq-kpi-card icon="grid_view" [value]="criticalSpaces()" label="Critical Spaces" tone="red"/></section>
    <section class="hero-grid">
      <article class="card environmental"><div class="card-head"><div><h2>Environmental Overview</h2><p>Average readings across monitored buildings</p></div></div><div class="metric-tabs">@for(metric of environmentalMetrics;track metric){<button type="button" [class.active]="environmentalMetric()===metric" (click)="environmentalMetric.set(metric)">{{metric}}</button>}<div><b>{{environmentalAverage()}} {{environmentalUnit()}}</b><small>Average</small></div><div><b>{{environmentalMinimum()}} {{environmentalUnit()}}</b><small>Minimum</small></div><div><b>{{environmentalMaximum()}} {{environmentalUnit()}}</b><small>Maximum</small></div></div><resq-line-chart [labels]="environmentalLabels()" [values]="environmentalValues()" [datasetLabel]="environmentalMetric()" [unit]="environmentalUnit()"/></article>
      <article class="card risk"><div class="card-head"><div><h2>Risk Distribution</h2><p>Live space status</p></div><a routerLink="/spaces">View spaces →</a></div><div class="risk-chart"><div class="ring"><span><b>{{store.spaces().length}}</b>Spaces</span></div><ul>@for(status of riskStatuses;track status){<li><i [class]="status.toLowerCase()"></i><span>{{status}}</span><b>{{spaceStatusCount(status)}}</b><em>{{spaceStatusPercent(status)}}%</em></li>}</ul></div></article>
    </section>
    <section class="lower-grid">
      <article class="card"><div class="card-head"><div><h2>Active Alerts</h2><p>Latest classified risks</p></div><a routerLink="/alerts">View all →</a></div><div class="feed">@for(alert of alerts();track alert.id){<a [routerLink]="'/alerts/'+alert.id"><span class="alert-icon" [class.critical]="alert.severity==='Critical'">!</span><div><b>{{alert.title}}</b><small>{{alert.location.zoneName}} · {{alert.severity}}</small></div><time>{{minutesAgo(alert.generatedAt)}} min</time></a>}</div></article>
      <article class="card device-card"><div class="card-head"><div><h2>Device Status</h2><p>Fleet connectivity</p></div><span>Total: {{store.devices().length}}</span></div><div class="device-content"><resq-doughnut-chart [values]="deviceStatusValues()" [centerValue]="store.devices().length" centerLabel="Devices"/><ul>@for(status of deviceStatuses;track status){<li><i [class]="status.toLowerCase()"></i>{{status}} <b>{{deviceStatusCount(status)}}</b><em>{{deviceStatusPercent(status)}}%</em></li>}</ul></div></article>
      <article class="card"><div class="card-head"><div><h2>Recent Incidents</h2><p>Response activity</p></div><a routerLink="/incidents">View all →</a></div><div class="incident-list">@for(incident of incidents();track incident.id){<a [routerLink]="'/incidents/'+incident.id"><div><b>{{incident.title}}</b><small>{{incident.id}} · {{spaceName(incident.spaceId)}}</small></div><resq-status-badge [status]="incident.status"/></a>}</div></article>
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
  private readonly alertService = inject(AlertService);
  readonly analytics = inject(AnalyticsWorkspaceFacade);
  readonly store = inject(BuildingStoreService);
  private readonly events = inject(RiskEventStoreService);
  readonly alerts = this.alertService.latestAlerts;
  readonly recentAlertCount = this.alertService.recentAlertCount;
  readonly incidents = computed(() => this.events.incidents().slice(0, 4));
  readonly period = signal<'24h' | '7d' | '30d'>('7d');
  readonly periods = [{ value: '24h' as const, label: 'Last 24 Hours' }, { value: '7d' as const, label: 'Last 7 Days' }, { value: '30d' as const, label: 'Last 30 Days' }];
  readonly environmentalMetric = signal<DeviceType>('Temperature');
  readonly environmentalMetrics: DeviceType[] = ['Temperature', 'Smoke', 'Gas', 'Humidity'];
  readonly activeDevices = computed(() => this.store.devices().filter(device => device.status !== 'Offline').length);
  readonly criticalSpaces = computed(() => this.store.spaces().filter(space => space.status === 'Critical').length);
  readonly riskStatuses = ['Normal', 'Warning', 'Critical', 'Offline'] as const;
  readonly deviceStatuses = ['Online', 'Warning', 'Critical', 'Offline'] as const;
  readonly deviceStatusValues = computed(() => this.deviceStatuses.map(status => this.deviceStatusCount(status)));
  readonly environmentalReadings = computed(() => this.store.devices().flatMap(device => device.readings).filter(reading => reading.metric === this.environmentalMetric()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).slice(-30));
  readonly filteredAlerts = computed(() => this.analytics.alerts().filter(item => item.generatedAt >= this.cutoff()));
  readonly filteredIncidents = computed(() => this.analytics.incidents().filter(item => item.incident.createdAt >= this.cutoff()));

  ngOnInit(): void { this.analytics.load().subscribe({ error: () => undefined }); }
  environmentalLabels(): string[] { return this.environmentalReadings().map(item => item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); }
  environmentalValues(): number[] { return this.environmentalReadings().map(item => item.value); }
  environmentalUnit(): string { return this.environmentalReadings()[0]?.unit ?? (this.environmentalMetric() === 'Temperature' ? '°C' : this.environmentalMetric() === 'Humidity' ? '%' : 'ppm'); }
  environmentalAverage(): string { return this.stat(values => values.reduce((sum, value) => sum + value, 0) / values.length); }
  environmentalMinimum(): string { return this.stat(values => Math.min(...values)); }
  environmentalMaximum(): string { return this.stat(values => Math.max(...values)); }
  spaceName(id: string): string { return this.store.spaces().find(item => item.id === id)?.name ?? 'Unknown space'; }
  spaceStatusCount(status: typeof this.riskStatuses[number]): number { return this.store.spaces().filter(space => space.status === status).length; }
  spaceStatusPercent(status: typeof this.riskStatuses[number]): number { return this.percentage(this.spaceStatusCount(status), this.store.spaces().length); }
  deviceStatusCount(status: typeof this.deviceStatuses[number]): number { return this.store.devices().filter(device => device.status === status).length; }
  deviceStatusPercent(status: typeof this.deviceStatuses[number]): number { return this.percentage(this.deviceStatusCount(status), this.store.devices().length); }
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
