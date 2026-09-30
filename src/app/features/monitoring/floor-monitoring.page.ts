import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert, Space } from '../../core/models/resq.models';
import { ALERTS, SPACES } from '../../core/mock-data/resq.mock';
import { DoughnutChartComponent, KpiCardComponent, LineChartComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';

@Component({
  selector: 'resq-floor-monitoring', standalone: true, imports:[RouterLink,KpiCardComponent,DoughnutChartComponent,LineChartComponent,StatusBadgeComponent], changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <div class="monitor-layout"><div class="monitor-main">
      <section class="kpis"><resq-kpi-card icon="▥" [value]="3" label="Buildings Monitored" trend="↑ 0%"/><resq-kpi-card icon="◉" [value]="142" label="Active Devices" trend="↑ 12%" tone="green"/><resq-kpi-card icon="△" [value]="12" label="Active Alerts" trend="↑ 67%" tone="red"/><resq-kpi-card icon="!" [value]="3" label="Spaces in Critical" trend="↑ 200%" tone="red"/></section>
      <article class="floor-card"><div class="card-title"><h2>Floor Plan – Science Building (Floor 2)</h2><div class="controls"><button [class.active]="view()==='2d'" (click)="view.set('2d')">2D View</button><button [class.active]="view()==='3d'" (click)="view.set('3d')">3D View</button><i></i><button aria-label="Zoom in" (click)="zoomIn()">＋</button><button aria-label="Zoom out" (click)="zoomOut()">−</button><button aria-label="Reset zoom" (click)="zoom.set(1)">⛶</button></div></div>
        <div class="plan-viewport" [class.isometric]="view()==='3d'"><svg viewBox="0 0 970 510" role="img" aria-label="Interactive floor plan for Science Building Floor 2"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#d5e5d7" stroke-width=".5"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-opacity=".2"/></filter></defs><rect width="970" height="510" rx="12" fill="#e8f3e7"/><rect width="970" height="510" rx="12" fill="url(#grid)" opacity=".6"/>
          <g class="building" [attr.transform]="'translate(0 0) scale('+zoom()+')'">
            <path class="outer-wall" d="M45 35H925V220H950V320H925V475H45V320H20V220H45Z"/>
            <path class="hall" d="M60 218H910V303H60Z"/><text x="485" y="265" class="hall-label">Central Hallway</text>
            @for(space of floorSpaces;track space.id){<g class="space" tabindex="0" role="button" [attr.aria-label]="space.name+', Room '+space.roomNumber+', '+space.status" [class.selected]="selected().id===space.id" [class]="'space status-'+space.status.toLowerCase()+(selected().id===space.id?' selected':'')" (click)="selected.set(space)" (keydown.enter)="selected.set(space)" (keydown.space)="selectSpace($event,space)">
              <polygon [attr.points]="points(space)"/><title>{{space.name}} — Room {{space.roomNumber}} — {{space.status}}</title>
              @if(space.type!=='Hallway'){<text [attr.x]="center(space).x" [attr.y]="center(space).y-8" class="room-name">{{space.name}}</text><rect [attr.x]="center(space).x-16" [attr.y]="center(space).y+2" width="32" height="18" rx="8" class="room-tag"/><text [attr.x]="center(space).x" [attr.y]="center(space).y+15" class="room-number">{{space.roomNumber}}</text><g class="sensor-dots">@for(device of space.devices.slice(0,4);track device.id;let i=$index){<circle [attr.cx]="center(space).x-30+i*20" [attr.cy]="center(space).y+43" r="7"/><text [attr.x]="center(space).x-30+i*20" [attr.y]="center(space).y+46">{{device.type.charAt(0)}}</text>}</g>}
            </g>}
            <g class="stairs"><rect x="438" y="312" width="112" height="142"/><path d="M450 440h88m-88-13h88m-88-13h88m-88-13h88m-88-13h88m-88-13h88m-88-13h88m-88-13h88m-88-13h88"/><text x="494" y="331">STAIRS</text></g>
            <g class="restroom"><rect x="438" y="55" width="58" height="155"/><text x="467" y="122">WC</text><circle cx="457" cy="150" r="7"/><circle cx="478" cy="150" r="7"/></g>
            <g class="doors"><path d="M300 210v-22a22 22 0 0 1 22 22M390 210v-22a22 22 0 0 0-22 22M640 210v-22a22 22 0 0 1 22 22M835 210v-22a22 22 0 0 0-22 22M245 310v22a22 22 0 0 0 22-22M660 310v22a22 22 0 0 1-22-22"/></g>
          </g></svg></div>
        <div class="legend"><span><i class="normal"></i>Normal</span><span><i class="warning"></i>Warning</span><span><i class="critical"></i>Critical</span><span><i class="offline"></i>Offline</span><em>Click any room to inspect details</em></div>
      </article>
      <section class="bottom-widgets"><article class="mini-card alerts"><div class="mini-head"><h3>Recent Alerts</h3><a routerLink="/alerts">View All →</a></div>@for(alert of recentAlerts;track alert.id){<a [routerLink]="'/alerts/'+alert.id"><i [class.critical]="alert.severity==='Critical'">!</i><div><b>{{alert.title}}</b><span>{{spaceName(alert.spaceId)}}</span></div><time>{{minutesAgo(alert)}} min ago</time></a>}</article>
        <article class="mini-card devices"><div class="mini-head"><h3>Device Status</h3><span>Total: 142</span></div><div class="device-wrap"><resq-doughnut-chart/><ul><li><i class="normal"></i>Online <b>118</b><em>83%</em></li><li><i class="warning"></i>Warning <b>12</b><em>8%</em></li><li><i class="critical"></i>Critical <b>6</b><em>4%</em></li><li><i class="offline"></i>Offline <b>6</b><em>4%</em></li></ul></div></article>
        <article class="mini-card chart"><div class="mini-head"><h3>Environmental Overview</h3><select><option>Last 24 Hours</option></select></div><div class="tabs"><button class="active">Temperature</button><button>Smoke</button><button>Gas</button><span>Avg. <b>24.2 °C</b></span></div><resq-line-chart/></article></section>
    </div><aside class="right-panel"><article class="building-card"><div class="mini-head"><div><h3>Building Overview</h3><p>Science Building</p></div></div><div class="building-stack"><svg viewBox="0 0 310 175"><g class="stack-art"><path d="M25 135l100-38 105 38-102 40z"/><path d="M38 105l88-34 92 34-90 36z"/><path d="M50 75l76-29 79 29-78 31z"/><path d="M63 48l63-24 65 24-65 27z"/><path class="supports" d="M42 105v28m174-28v28M55 75v28m147-28v28M68 48v25m120-25v25"/></g></svg><div class="floor-buttons">@for(floor of [4,3,2,1];track floor){<button [class.active]="floor===2" (click)="chooseFloor(floor)">▥ Floor {{floor}} @if(floor===2){<i></i>}</button>}</div></div></article>
      <article class="details-card"><div class="details-head"><span>⚗</span><div><h2>{{selected().name}}</h2><p>Room {{selected().roomNumber}}　|　{{selected().type}}　|　{{selected().sensitivity}} Sensitivity</p></div><resq-status-badge [status]="selected().status"/></div><nav>@for(tab of ['Overview','Devices ('+selected().devices.length+')','Alerts (3)','History'];track tab){<button [class.active]="detailTab()===tab.split(' ')[0]" (click)="detailTab.set(tab.split(' ')[0])">{{tab}}</button>}</nav>
        @if(detailTab()==='Overview'){<div class="readings"><div><i>♨</i><span>Temperature</span><b>{{currentReading('Temperature')}} °C</b><em>↑ +4.2°</em></div><div><i>☁</i><span>Smoke Level</span><b>{{currentReading('Smoke')}} ppm</b><em>↑ High</em></div><div><i>≋</i><span>Gas Level</span><b>{{currentReading('Gas')}} ppm</b><em>↑ High</em></div></div><div class="details-chart"><h4>Environmental Readings (Last 24 Hours)</h4><resq-line-chart [multi]="true"/></div>}
        @if(detailTab()==='Devices'){<div class="panel-list">@for(device of selected().devices;track device.id){<a [routerLink]="'/devices/'+device.id"><span>◉</span><div><b>{{device.name}}</b><small>{{device.code}} · Last seen {{device.status==='Offline'?'3h ago':'2m ago'}}</small></div><resq-status-badge [status]="device.status"/></a>}</div>}
        @if(detailTab()==='Alerts'){<div class="panel-list">@for(alert of selectedAlerts();track alert.id){<a [routerLink]="'/alerts/'+alert.id"><span>△</span><div><b>{{alert.title}}</b><small>{{alert.description}}</small></div><resq-status-badge [status]="alert.severity"/></a>}</div>}
        @if(detailTab()==='History'){<div class="timeline"><h4>Risk history</h4><p><i class="critical"></i><b>14:32</b> Critical <small>Gas crossed 300 ppm</small></p><p><i class="warning"></i><b>14:10</b> Warning <small>Smoke rising</small></p><p><i class="normal"></i><b>13:48</b> Normal <small>All readings in range</small></p><resq-line-chart/></div>}
      </article>
    </aside></div>
  `,
  styleUrls:['./floor-monitoring.page.scss','./floor-monitoring.typography.scss']
})
export class FloorMonitoringPage {
  readonly floorSpaces=SPACES.filter(space=>space.floorId==='science-f2'); readonly selected=signal<Space>(this.floorSpaces[0]); readonly view=signal<'2d'|'3d'>('2d'); readonly zoom=signal(1); readonly detailTab=signal('Overview'); readonly recentAlerts=ALERTS.slice(0,4);
  readonly selectedAlerts=computed(()=>ALERTS.filter(alert=>alert.spaceId===this.selected().id).slice(0,5));
  constructor(private readonly router:Router){}
  points(space:Space):string{return space.polygon.map(point=>`${point.x},${point.y}`).join(' ')} center(space:Space){return{x:space.polygon.reduce((sum,p)=>sum+p.x,0)/space.polygon.length,y:space.polygon.reduce((sum,p)=>sum+p.y,0)/space.polygon.length}}
  zoomIn():void{this.zoom.update(value=>Math.min(2,Number((value+.25).toFixed(2))))} zoomOut():void{this.zoom.update(value=>Math.max(.75,Number((value-.25).toFixed(2))))}
  selectSpace(event:Event,space:Space):void{event.preventDefault();this.selected.set(space)} chooseFloor(floor:number):void{if(floor!==2)this.router.navigate(['/monitoring/science/floors',`science-f${floor}`])}
  currentReading(type:string):string{const reading=this.selected().devices.find(device=>device.type===type)?.readings.at(-1);return reading?String(reading.value):'—'}
  spaceName(id:string):string{const space=SPACES.find(item=>item.id===id);return `${space?.name??'Space'}${space?.roomNumber?' (Room '+space.roomNumber+')':''}`}
  minutesAgo(alert:Alert):number{return Math.max(1,Math.round((Date.now()-alert.timestamp.getTime())/60000))}
}
