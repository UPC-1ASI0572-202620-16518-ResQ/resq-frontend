import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { INCIDENTS, SPACES } from '../../core/mock-data/resq.mock';
import { AlertService } from '../../core/services/data.services';
import { KpiCardComponent, DoughnutChartComponent, LineChartComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';

@Component({
  selector: 'resq-dashboard-page', standalone: true, imports: [RouterLink,KpiCardComponent,DoughnutChartComponent,LineChartComponent,StatusBadgeComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis"><resq-kpi-card icon="▥" [value]="3" label="Buildings Monitored" trend="↑ 0%"/><resq-kpi-card icon="◉" [value]="142" label="Active Devices" trend="↑ 12%" tone="green"/><resq-kpi-card icon="△" [value]="recentAlertCount()" label="Recent Alerts" tone="red"/><resq-kpi-card icon="!" [value]="3" label="Critical Spaces" trend="↑ 200%" tone="red"/></section>
    <section class="hero-grid"><article class="card environmental"><div class="card-head"><div><h2>Environmental Overview</h2><p>Average readings across monitored buildings</p></div><select><option>Last 24 Hours</option><option>Last 7 Days</option></select></div><div class="metric-tabs"><button class="active">Temperature</button><button>Smoke</button><button>Gas</button><div><b>24.2 °C</b><small>Average</small></div><div><b>18.1 °C</b><small>Minimum</small></div><div><b>32.6 °C</b><small>Maximum</small></div></div><resq-line-chart/></article>
      <article class="card risk"><div class="card-head"><div><h2>Risk Distribution</h2><p>Live space status</p></div><a routerLink="/spaces">View spaces →</a></div><div class="risk-chart"><div class="ring"><span><b>64</b>Spaces</span></div><ul><li><i class="normal"></i><span>Normal</span><b>52</b><em>81%</em></li><li><i class="warning"></i><span>Warning</span><b>7</b><em>11%</em></li><li><i class="critical"></i><span>Critical</span><b>3</b><em>5%</em></li><li><i class="offline"></i><span>Offline</span><b>2</b><em>3%</em></li></ul></div></article>
    </section>
    <section class="lower-grid"><article class="card"><div class="card-head"><div><h2>Recent Alerts</h2><p>Latest classified risks</p></div><a routerLink="/alerts">View all →</a></div><div class="feed">@for(alert of alerts();track alert.id){<a [routerLink]="'/alerts/'+alert.id"><span class="alert-icon" [class.critical]="alert.severity==='Critical'">!</span><div><b>{{alert.title}}</b><small>{{alert.location.zoneName}} · {{alert.severity}}</small></div><time>{{minutesAgo(alert.generatedAt)}} min</time></a>}</div></article>
      <article class="card device-card"><div class="card-head"><div><h2>Device Status</h2><p>Fleet connectivity</p></div><span>Total: 142</span></div><div class="device-content"><resq-doughnut-chart/><ul><li><i class="normal"></i>Online <b>118</b><em>83%</em></li><li><i class="warning"></i>Warning <b>12</b><em>8%</em></li><li><i class="critical"></i>Critical <b>6</b><em>4%</em></li><li><i class="offline"></i>Offline <b>6</b><em>4%</em></li></ul></div></article>
      <article class="card"><div class="card-head"><div><h2>Recent Incidents</h2><p>Response activity</p></div><a routerLink="/incidents">View all →</a></div><div class="incident-list">@for(incident of incidents;track incident.id){<a [routerLink]="'/incidents/'+incident.id"><div><b>{{incident.title}}</b><small>{{incident.id}} · {{spaceName(incident.spaceId)}}</small></div><resq-status-badge [status]="incident.status"/></a>}</div></article>
    </section>
  `,
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage {
  private readonly alertService = inject(AlertService);
  readonly alerts = this.alertService.latestAlerts; readonly recentAlertCount = this.alertService.recentAlertCount; readonly incidents = INCIDENTS.slice(0,4);
  spaceName(id:string):string { return SPACES.find(item=>item.id===id)?.name ?? 'Unknown space'; }
  minutesAgo(date:Date):number { return Math.max(1,Math.round((Date.now()-date.getTime())/60000)); }
}
