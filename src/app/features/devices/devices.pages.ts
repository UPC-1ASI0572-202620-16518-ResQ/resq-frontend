import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DeviceAdministrativeStatus } from '../../core/models/resq.models';
import { EmptyStateComponent, KpiCardComponent, LineChartComponent, LoadingStateComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';
import { BuildingCatalogRecord, ZoneCatalogRecord } from '../buildings/data-access/building.gateway';
import { CapabilityDefinitionResourceDto } from './data-access/device.dto';
import { DeviceCatalogRecord } from './data-access/device.gateway';
import { DeviceWorkspaceFacade, DeviceWorkspaceRow } from './device-workspace.facade';

@Component({
  selector: 'resq-devices-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatPaginatorModule, MatSortModule, MatTableModule, KpiCardComponent, LoadingStateComponent, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-actions"><div><b>Device Management</b><span>Devices are created and positioned directly from each Floor Plan Editor.</span></div></div>

    <section class="kpis" aria-label="Device fleet summary">
      <resq-kpi-card icon="sensors" [value]="workspace.summary().total" label="Total Devices" />
      <resq-kpi-card icon="check_circle" [value]="workspace.summary().online" label="Online" tone="green" />
      <resq-kpi-card icon="warning_amber" [value]="workspace.summary().warningDegraded" label="Weak Signal" tone="amber" />
      <resq-kpi-card icon="sensors_off" [value]="workspace.summary().offline" label="Offline / Timeout" />
    </section>

    @if (workspace.loading()) {
      <resq-loading-state message="Loading devices..." />
    } @else if (workspace.error()) {
      <resq-empty-state title="Devices could not be loaded" [message]="workspace.error()!.message" />
    } @else {
      <section class="filters" aria-label="Device filters">
        <label class="search-field"><mat-icon>search</mat-icon><span class="sr-only">Search devices</span><input [(ngModel)]="query" (ngModelChange)="applyFilters()" placeholder="Search name, code, model or serial..." /></label>
        <label><span>Building</span><select [(ngModel)]="buildingFilter" (ngModelChange)="applyFilters()"><option value="">All buildings</option>@for(building of workspace.buildings();track building.id){<option [value]="building.id">{{building.name}}</option>}</select></label>
        <label><span>Floor</span><select [(ngModel)]="floorFilter" (ngModelChange)="applyFilters()"><option value="">All floors</option>@for(floor of floors();track floor){<option [value]="floor">{{floor}}</option>}</select></label>
        <label><span>Zone</span><select [(ngModel)]="zoneFilter" (ngModelChange)="applyFilters()"><option value="">All zones</option>@for(zone of zones();track zone.id){<option [value]="zone.id">{{zone.name}}</option>}</select></label>
        <label><span>Administrative status</span><select [(ngModel)]="administrativeFilter" (ngModelChange)="applyFilters()"><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option><option>RETIRED</option></select></label>
        <label><span>Connectivity</span><select [(ngModel)]="connectivityFilter" (ngModelChange)="applyFilters()"><option value="">All connectivity</option><option>ONLINE</option><option>OFFLINE</option><option>TIMEOUT</option></select></label>
        <label><span>Capability</span><select [(ngModel)]="capabilityFilter" (ngModelChange)="applyFilters()"><option value="">All capabilities</option>@for(capability of capabilities();track capability.code){<option [value]="capability.code">{{capability.label}}</option>}</select></label>
        <button type="button" class="reset" (click)="resetFilters()">Reset filters</button>
      </section>
      <div class="result-summary"><b>{{ filteredCount() }} devices</b><span>Composed from Device Management, Monitoring, Connectivity and Building Management.</span></div>
      <section class="table-card" aria-label="Registered devices">
        <div class="table-scroll"><table mat-table [dataSource]="dataSource" matSort>
          <ng-container matColumnDef="device"><th mat-header-cell *matHeaderCellDef mat-sort-header>Device</th><td mat-cell *matCellDef="let row"><span class="device-icon"><mat-icon>sensors</mat-icon></span><span class="primary-cell"><b>{{row.catalog.name}}</b><small>{{row.catalog.description || 'No description'}}</small></span></td></ng-container>
          <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th><td mat-cell *matCellDef="let row"><code>{{row.catalog.deviceCode}}</code></td></ng-container>
          <ng-container matColumnDef="model"><th mat-header-cell *matHeaderCellDef mat-sort-header>Model</th><td mat-cell *matCellDef="let row">{{row.catalog.specifications.model || '—'}}</td></ng-container>
          <ng-container matColumnDef="location"><th mat-header-cell *matHeaderCellDef mat-sort-header>Location</th><td mat-cell *matCellDef="let row"><span class="primary-cell"><b>{{row.location.buildingName}}</b><small>{{row.location.floorLabel || '—'}} · {{row.location.zoneName || 'Unassigned zone'}}</small></span></td></ng-container>
          <ng-container matColumnDef="capabilities"><th mat-header-cell *matHeaderCellDef>Capabilities</th><td mat-cell *matCellDef="let row"><div class="capability-chips">@for(capability of row.capabilities.slice(0,2);track capability.id){<span>{{capability.label}}</span>}@if(row.capabilities.length>2){<span>+{{row.capabilities.length-2}}</span>}</div></td></ng-container>
          <ng-container matColumnDef="administrative"><th mat-header-cell *matHeaderCellDef mat-sort-header>Administrative</th><td mat-cell *matCellDef="let row"><resq-status-badge [status]="row.catalog.administrativeStatus" /></td></ng-container>
          <ng-container matColumnDef="connectivity"><th mat-header-cell *matHeaderCellDef mat-sort-header>Connectivity</th><td mat-cell *matCellDef="let row"><div class="status-stack"><resq-status-badge [status]="row.connection?.status || 'UNKNOWN'" /><small>{{row.monitoring?.availability || 'UNKNOWN'}} monitoring</small></div></td></ng-container>
          <ng-container matColumnDef="reading"><th mat-header-cell *matHeaderCellDef mat-sort-header>Latest Reading</th><td mat-cell *matCellDef="let row"><b>{{measurementLabel(row)}}</b></td></ng-container>
          <ng-container matColumnDef="signal"><th mat-header-cell *matHeaderCellDef mat-sort-header>Signal</th><td mat-cell *matCellDef="let row">{{row.connection?.signalStrength !== undefined ? row.connection.signalStrength+' dBm' : '—'}}</td></ng-container>
          <ng-container matColumnDef="lastSeen"><th mat-header-cell *matHeaderCellDef mat-sort-header>Last Seen</th><td mat-cell *matCellDef="let row">{{row.connection ? relativeTime(row.connection.lastHeartbeatAt) : '—'}}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr><tr mat-row *matRowDef="let row;columns:displayedColumns" tabindex="0" [attr.aria-label]="'Open '+row.catalog.name" (click)="openDevice(row)" (keydown.enter)="openDevice(row)" (keydown.space)="openDevice(row);$event.preventDefault()"></tr>
        </table></div>
        @if(!filteredCount()){<resq-empty-state title="No devices found" message="Try adjusting or resetting the filters." />}
        <mat-paginator [pageSize]="25" [pageSizeOptions]="[25,50,100]" showFirstLastButtons aria-label="Device table pagination" />
      </section>
    }
  `,
  styleUrls: ['./devices.pages.scss', './devices.readability.scss'],
})
export class DevicesPage implements OnInit {
  readonly workspace = inject(DeviceWorkspaceFacade);
  private readonly router = inject(Router);
  @ViewChild(MatSort) set matSort(sort: MatSort | undefined){if(sort)this.dataSource.sort=sort;}
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator | undefined){if(paginator)this.dataSource.paginator=paginator;}
  readonly displayedColumns=['device','code','model','location','capabilities','administrative','connectivity','reading','signal','lastSeen'];
  readonly dataSource=new MatTableDataSource<DeviceWorkspaceRow>([]);
  readonly filteredCount=signal(0);
  query='';buildingFilter='';floorFilter='';zoneFilter='';administrativeFilter='';connectivityFilter='';capabilityFilter='';
  readonly floors=computed(()=>[...new Set(this.workspace.rows().map(row=>row.location.floorLabel).filter((value):value is string=>Boolean(value)))].sort());
  readonly zones=computed(()=>{const map=new Map<string,string>();this.workspace.rows().forEach(row=>{if(row.location.zoneId)map.set(row.location.zoneId,row.location.zoneName||row.location.zoneId)});return [...map].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));});
  readonly capabilities=computed(()=>{const map=new Map<string,string>();this.workspace.rows().flatMap(row=>row.capabilities).forEach(cap=>map.set(cap.code,cap.label));return [...map].map(([code,label])=>({code,label})).sort((a,b)=>a.label.localeCompare(b.label));});
  ngOnInit():void{this.workspace.loadFleet().subscribe({next:()=>{this.configureSorting();this.applyFilters();},error:()=>undefined});}
  applyFilters():void{const q=this.query.trim().toLowerCase();const rows=this.workspace.rows().filter(row=>{const searchable=`${row.catalog.name} ${row.catalog.deviceCode} ${row.catalog.specifications.model??''} ${row.catalog.specifications.serialNumber??''}`.toLowerCase();return(!q||searchable.includes(q))&&(!this.buildingFilter||row.location.buildingId===this.buildingFilter)&&(!this.floorFilter||row.location.floorLabel===this.floorFilter)&&(!this.zoneFilter||row.location.zoneId===this.zoneFilter)&&(!this.administrativeFilter||row.catalog.administrativeStatus===this.administrativeFilter)&&(!this.connectivityFilter||row.connection?.status===this.connectivityFilter)&&(!this.capabilityFilter||row.catalog.capabilities.some(cap=>cap.code===this.capabilityFilter));});this.dataSource.data=rows;this.filteredCount.set(rows.length);this.dataSource.paginator?.firstPage();}
  resetFilters():void{this.query=this.buildingFilter=this.floorFilter=this.zoneFilter=this.administrativeFilter=this.connectivityFilter=this.capabilityFilter='';this.applyFilters();}
  openDevice(row:DeviceWorkspaceRow):void{void this.router.navigate(['/devices',row.catalog.id]);}
  measurementLabel(row:DeviceWorkspaceRow):string{const item=row.latestMeasurement;return item?`${item.measurementValue.value} ${item.measurementValue.unit}`:'No reading';}
  relativeTime(date:Date):string{const minutes=Math.max(0,Math.round((Date.now()-date.getTime())/60000));return minutes<1?'Just now':minutes<60?`${minutes} min ago`:minutes<1440?`${Math.round(minutes/60)}h ago`:`${Math.round(minutes/1440)}d ago`;}
  private configureSorting():void{this.dataSource.sortingDataAccessor=(row,column)=>({device:row.catalog.name,code:row.catalog.deviceCode,model:row.catalog.specifications.model??'',location:`${row.location.buildingName} ${row.location.floorLabel??''} ${row.location.zoneName??''}`,administrative:row.catalog.administrativeStatus,connectivity:row.connection?.status??'',reading:row.latestMeasurement?.measurementValue.value??-Infinity,signal:row.connection?.signalStrength??-Infinity,lastSeen:row.connection?.lastHeartbeatAt.getTime()??0}as Record<string,string|number>)[column]??'';}
}

@Component({
  selector:'resq-device-detail',standalone:true,imports:[CommonModule,FormsModule,RouterLink,MatIconModule,EmptyStateComponent,LineChartComponent,LoadingStateComponent,StatusBadgeComponent],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    @if(workspace.loading()){<resq-loading-state message="Loading device..." />}@else if(workspace.error()){<resq-empty-state title="Device could not be loaded" [message]="workspace.error()!.message" />}@else if(workspace.detail();as current){
      <header class="detail-head"><div><a routerLink="/devices">← Devices</a><div class="device-title"><span class="device-mark">◉</span><div><div class="title-line"><h2>{{current.catalog.name}}</h2><code>{{current.catalog.deviceCode}}</code></div><div class="badges"><resq-status-badge [status]="current.catalog.administrativeStatus" /><resq-status-badge [status]="current.connection?.status||'UNKNOWN'" /><resq-status-badge [status]="current.monitoring?.availability||'UNKNOWN'" /></div><p>{{current.catalog.description||'No description provided.'}}</p></div></div></div><div class="detail-actions"><button type="button" (click)="openEditor('details')" [disabled]="!workspace.canEditDetails(current.catalog)">Edit details</button>@if(workspace.canChangeAssignment(current.catalog)){<button type="button" (click)="openEditor('assignment')">Assignment</button>}@if(workspace.canChangeCapabilities(current.catalog)){<button type="button" (click)="openEditor('capabilities')">Capabilities</button>}</div></header>
      <div class="lifecycle-actions">@if(workspace.canActivate(current.catalog)){<button type="button" (click)="changeStatus('ACTIVE')">Activate</button>}@if(workspace.canDeactivate(current.catalog)){<button type="button" (click)="changeStatus('INACTIVE')">Deactivate</button>}@if(workspace.canRetire(current.catalog)){<button type="button" class="danger" (click)="changeStatus('RETIRED')">Retire</button>}@if(current.catalog.administrativeStatus==='RETIRED'){<span>Retired devices are read-only.</span>}</div>
      @if(editor()){<section class="editor-card detail-editor"><header><div><h3>{{editorTitle()}}</h3><p>Backend domain rules are also enforced by the mock adapter.</p></div><button type="button" class="close" (click)="editor.set(null)">×</button></header>@if(editor()==='details'){<div class="editor-grid"><label>Name<input [(ngModel)]="detailForm.name" /></label><label>Description<input [(ngModel)]="detailForm.description" /></label><label>Manufacturer<input [(ngModel)]="detailForm.manufacturer" /></label><label>Model<input [(ngModel)]="detailForm.model" /></label><label>Serial number<input [(ngModel)]="detailForm.serialNumber" /></label></div>}@if(editor()==='assignment'){<div class="editor-grid"><label>Building<select [(ngModel)]="detailForm.buildingId" (ngModelChange)="detailForm.zoneId=''">@for(building of workspace.buildings();track building.id){<option [value]="building.id">{{building.name}}</option>}</select></label><label>Zone<select [(ngModel)]="detailForm.zoneId"><option value="">No zone</option>@for(zone of zonesFor(detailForm.buildingId);track zone.id){<option [value]="zone.id">{{zone.name}}{{zone.floorLabel?' · '+zone.floorLabel:''}}</option>}</select></label></div>}@if(editor()==='capabilities'){<div class="editor-grid"><label class="wide">Capabilities<textarea [(ngModel)]="detailForm.capabilitiesText" rows="5"></textarea><small>One per line: code | MEASUREMENT/ACTUATION | optional unit</small></label></div>}@if(formError()){<p class="form-error">{{formError()}}</p>}<footer><button type="button" class="secondary" (click)="editor.set(null)">Cancel</button><button type="button" (click)="saveEditor()" [disabled]="saving()">{{saving()?'Saving...':'Save changes'}}</button></footer></section>}
      <section class="stats"><article><span>Current Reading</span><b>{{latestReading()}}</b><small>Latest monitoring measurement</small></article><article><span>Administrative</span><b>{{current.catalog.administrativeStatus}}</b><small>Device Management lifecycle</small></article><article><span>Signal Strength</span><b>{{current.connection?.signalStrength!==undefined?current.connection!.signalStrength+' dBm':'Unavailable'}}</b><small>{{connectionQuality(current.connection?.signalStrength)}} connection</small></article><article><span>Last Heartbeat</span><b>{{current.connection?relativeTime(current.connection.lastHeartbeatAt):'Unavailable'}}</b><small>Connectivity Management</small></article></section>
      <main class="detail-grid">
        <article class="card chart-card"><div class="card-head"><div><h3>Reading History</h3><p>Monitoring measurements received for this physical device.</p></div></div>@if(current.measurements.length){<resq-line-chart [labels]="chartLabels()" [values]="chartValues()" [datasetLabel]="measurementName()" [unit]="current.measurements[0].measurementValue.unit" />}@else{<resq-empty-state title="No readings available" message="Telemetry has not been received for this device." />}</article>
        <aside class="card hardware-card"><div class="card-head"><div><h3>Hardware Reference</h3><p>Presentation reference, not part of the Device aggregate.</p></div></div>@if(isMvp(current.catalog)){<div class="hardware-image"><img src="/assets/devices/resq-mvp-node.webp" alt="ResQ MVP node hardware reference" /></div><h4>ResQ Safety Node MVP</h4><p class="hardware-summary">ESP32 DevKit V1 + MQ-2 + OLED SSD1306 + active buzzer + red/green status LEDs.</p>}@else{<div class="hardware-fallback"><span>▦</span><b>{{current.catalog.specifications.model||current.catalog.name}}</b><small>{{current.catalog.specifications.manufacturer||'Hardware image not provided'}}</small></div>}</aside>
        <article class="card capabilities-card"><div class="card-head"><div><h3>Device Capabilities</h3><p>{{current.capabilities.length}} capabilities registered in Device Management.</p></div></div><div class="capability-list">@for(capability of current.capabilities;track capability.id){<div><span class="capability-icon" [class.actuation]="capability.kind==='ACTUATION'">{{capability.kind==='MEASUREMENT'?'⌁':'⚡'}}</span><div><b>{{capability.label}}</b><small>{{capability.hardwareLabel}}{{capability.unit?' · '+capability.unit:''}}</small></div><em [class.actuation]="capability.kind==='ACTUATION'">{{capability.kind}}</em></div>}</div></article>
        <aside class="card info-card"><h3>Assigned Location</h3><div class="location"><span>▥</span><div><b>{{current.location.buildingName}}</b><small>{{current.location.floorLabel||'—'}} · {{current.location.zoneName||'No zone assigned'}}</small></div></div><h3>Device Catalog</h3><dl><dt>Device Code</dt><dd>{{current.catalog.deviceCode}}</dd><dt>Manufacturer</dt><dd>{{current.catalog.specifications.manufacturer||'—'}}</dd><dt>Model</dt><dd>{{current.catalog.specifications.model||'—'}}</dd><dt>Serial Number</dt><dd>{{current.catalog.specifications.serialNumber||'—'}}</dd><dt>Version</dt><dd>{{current.catalog.version}}</dd><dt>Created</dt><dd>{{dateLabel(current.catalog.createdAt)}}</dd><dt>Updated</dt><dd>{{dateLabel(current.catalog.updatedAt)}}</dd></dl></aside>
        <article class="card alerts-card"><div class="card-head"><div><h3>Device Alerts</h3><p>Alerts whose Risk Detection evidence references this device.</p></div></div>@if(current.alerts.length){@for(alert of current.alerts.slice(0,6);track alert.id){<a [routerLink]="['/alerts',alert.id]"><span class="alert-icon">!</span><div><b>{{alert.riskTypeLabel}} detected</b><small>{{alert.id}} · {{alert.severity}} · {{relativeTime(alert.detectedAt)}}</small></div><resq-status-badge [status]="alert.severity" /><span>›</span></a>}}@else{<resq-empty-state title="No alerts for this device" message="No risk-detection evidence currently references this device." />}</article>
        <aside class="side-stack"><article class="card connectivity-card"><h3>Connectivity</h3><dl><dt>Status</dt><dd><resq-status-badge [status]="current.connection?.status||'UNKNOWN'" /></dd><dt>Wi-Fi RSSI</dt><dd>{{current.connection?.signalStrength!==undefined?current.connection!.signalStrength+' dBm':'Unavailable'}}</dd><dt>Last Heartbeat</dt><dd>{{current.connection?relativeTime(current.connection.lastHeartbeatAt):'—'}}</dd><dt>Monitoring availability</dt><dd>{{current.monitoring?.availability||'UNKNOWN'}}</dd></dl></article></aside>
      </main>
    }@else{<div class="not-found"><span>◇</span><h2>Device Not Found</h2><p>The requested device does not exist or is unavailable.</p><a routerLink="/devices">Back to Devices</a></div>}
  `,styleUrls:['./device-detail.page.scss','./devices.readability.scss']
})
export class DeviceDetailPage implements OnInit{
  private readonly route=inject(ActivatedRoute);private readonly snack=inject(MatSnackBar);readonly workspace=inject(DeviceWorkspaceFacade);readonly editor=signal<'details'|'assignment'|'capabilities'|null>(null);readonly saving=signal(false);readonly formError=signal('');
  detailForm={name:'',description:'',manufacturer:'',model:'',serialNumber:'',buildingId:'',zoneId:'',capabilitiesText:''};
  ngOnInit():void{this.reload();}
  reload():void{const id=this.route.snapshot.paramMap.get('deviceId')??'';this.workspace.loadDetail(id).subscribe({next:detail=>{if(detail)this.populate(detail.catalog);},error:()=>undefined});}
  openEditor(editor:'details'|'assignment'|'capabilities'):void{const detail=this.workspace.detail();if(!detail)return;this.populate(detail.catalog);this.editor.set(editor);this.formError.set('');}
  editorTitle():string{return this.editor()==='details'?'Edit Device Details':this.editor()==='assignment'?'Change Device Assignment':'Replace Device Capabilities';}
  zonesFor(buildingId:string):ZoneCatalogRecord[]{return this.workspace.buildings().find(item=>item.id===buildingId)?.zones.filter(zone=>zone.availableForAssignment)??[];}
  saveEditor():void{const mode=this.editor();if(!mode)return;this.formError.set('');this.saving.set(true);let operation;if(mode==='details'){if(!this.detailForm.name.trim()){this.saving.set(false);this.formError.set('Name is required.');return;}operation=this.workspace.updateDetails({name:this.detailForm.name,description:this.detailForm.description||undefined,specifications:{manufacturer:this.detailForm.manufacturer||undefined,model:this.detailForm.model||undefined,serialNumber:this.detailForm.serialNumber||undefined}});}else if(mode==='assignment'){if(!this.detailForm.buildingId){this.saving.set(false);this.formError.set('Building is required.');return;}operation=this.workspace.changeAssignment({buildingId:this.detailForm.buildingId,zoneId:this.detailForm.zoneId||undefined});}else{const capabilities=parseCapabilities(this.detailForm.capabilitiesText);if(!capabilities.length){this.saving.set(false);this.formError.set('At least one valid capability is required.');return;}operation=this.workspace.replaceCapabilities({capabilities});}operation.subscribe({next:()=>{this.saving.set(false);this.editor.set(null);this.snack.open('Device updated.','Close',{duration:2200});this.reload();},error:(error:any)=>{this.saving.set(false);this.formError.set(error?.message??'Device could not be updated.');}});}
  changeStatus(status:DeviceAdministrativeStatus):void{this.saving.set(true);this.workspace.changeStatus({administrativeStatus:status}).subscribe({next:()=>{this.saving.set(false);this.snack.open(`Device status changed to ${status}.`,'Close',{duration:2200});this.reload();},error:(error:any)=>{this.saving.set(false);this.snack.open(error?.message??'Status could not be changed.','Close',{duration:3200});}});}
  latestReading():string{const item=this.workspace.detail()?.measurements.at(-1);return item?`${item.measurementValue.value} ${item.measurementValue.unit}`:'No reading';}
  measurementName():string{return this.workspace.detail()?.measurements.at(-1)?.variableType.replace(/[_-]+/g,' ')??'Measurement';}
  chartLabels():string[]{return(this.workspace.detail()?.measurements??[]).map(item=>item.measuredAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));}
  chartValues():number[]{return(this.workspace.detail()?.measurements??[]).map(item=>item.measurementValue.value);}
  relativeTime(date:Date):string{const minutes=Math.max(0,Math.round((Date.now()-date.getTime())/60000));return minutes<1?'Just now':minutes<60?`${minutes} min ago`:minutes<1440?`${Math.round(minutes/60)}h ago`:`${Math.round(minutes/1440)}d ago`;}
  connectionQuality(signal?:number):string{if(signal===undefined)return'Unavailable';if(signal>=-60)return'Good';if(signal>=-75)return'Fair';return'Weak';}
  dateLabel(date:Date):string{return date.toLocaleDateString([],{year:'numeric',month:'short',day:'numeric'});}
  isMvp(device:DeviceCatalogRecord):boolean{return device.deviceCode==='RESQ-MVP-001';}
  private populate(device:DeviceCatalogRecord):void{this.detailForm={name:device.name,description:device.description??'',manufacturer:device.specifications.manufacturer??'',model:device.specifications.model??'',serialNumber:device.specifications.serialNumber??'',buildingId:device.assignment.buildingId,zoneId:device.assignment.zoneId??'',capabilitiesText:device.capabilities.map(cap=>`${cap.code}|${cap.kind}${cap.unit?`|${cap.unit}`:''}`).join('\n')};}
}

function parseCapabilities(text:string):CapabilityDefinitionResourceDto[]{return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).flatMap(line=>{const[code,kind,unit]=line.split('|').map(value=>value.trim());if(!code||(kind!=='MEASUREMENT'&&kind!=='ACTUATION'))return[];return[{code,kind,unit:unit||undefined}];});}
