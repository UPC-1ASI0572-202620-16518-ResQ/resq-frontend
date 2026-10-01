import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { AlertListItem, SensitivityLevel, Space, SpaceThresholds } from '../../core/models/resq.models';
import { AlertService, SpaceService } from '../../core/services/data.services';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { LineChartComponent, StatusBadgeComponent } from '../../shared/ui/ui.components';

@Component({selector:'resq-spaces-page',standalone:true,imports:[CommonModule,FormsModule,RouterLink,MatIconModule,StatusBadgeComponent],changeDetection:ChangeDetectionStrategy.OnPush,template:`
  <div class="filters"><label class="search"><mat-icon>search</mat-icon><input [(ngModel)]="query" (ngModelChange)="apply()" placeholder="Search rooms or spaces..."/></label><select [(ngModel)]="building" (ngModelChange)="apply()"><option value="">All buildings</option>@for(item of buildings;track item.id){<option [value]="item.id">{{item.name}}</option>}</select><select [(ngModel)]="type" (ngModelChange)="apply()"><option value="">All types</option>@for(item of types;track item){<option>{{item}}</option>}</select><select [(ngModel)]="risk" (ngModelChange)="apply()"><option value="">All risk levels</option><option>Normal</option><option>Warning</option><option>Critical</option><option>Offline</option></select><div class="views"><button aria-label="Card view" [class.active]="view()==='cards'" (click)="view.set('cards')"><mat-icon>grid_view</mat-icon></button><button aria-label="Table view" [class.active]="view()==='table'" (click)="view.set('table')"><mat-icon>table_rows</mat-icon></button></div></div>
  <div class="result-count"><b>{{filtered().length}} spaces</b><span>Live data updated moments ago</span></div>
  @if(view()==='cards'){<div class="space-grid">@for(space of filtered();track space.id){<a [routerLink]="'/spaces/'+space.id"><div class="card-head"><span class="type-icon">{{icon(space)}}</span><resq-status-badge [status]="space.status"/></div><h3>{{space.name}}</h3><p>Room {{space.roomNumber||'—'}} · {{space.type}}</p><div class="location">▥ {{buildingName(space.buildingId)}} <span>›</span> {{floorName(space.floorId)}}</div><div class="space-stats"><span><b>{{space.devices.length}}</b>Devices</span><span><b>{{space.sensitivity}}</b>Sensitivity</span><span><b>{{alertCount(space.id)}}</b>Alerts</span></div><footer>Open space details <span>→</span></footer></a>}</div>}@else{<div class="table-wrap"><table><thead><tr><th>Space</th><th>Type</th><th>Building</th><th>Floor</th><th>Sensitivity</th><th>Risk</th><th>Devices</th><th>Alerts</th></tr></thead><tbody>@for(space of filtered();track space.id){<tr [routerLink]="'/spaces/'+space.id"><td><b>{{space.name}}</b><small>Room {{space.roomNumber}}</small></td><td>{{space.type}}</td><td>{{buildingName(space.buildingId)}}</td><td>{{floorName(space.floorId)}}</td><td>{{space.sensitivity}}</td><td><resq-status-badge [status]="space.status"/></td><td>{{space.devices.length}}</td><td>{{alertCount(space.id)}}</td></tr>}</tbody></table></div>}
`,styleUrl:'./spaces.pages.scss'})
export class SpacesPage {private readonly store=inject(BuildingStoreService);private readonly alertService=inject(AlertService);readonly alertItems=signal<AlertListItem[]>([]);readonly buildings=this.store.buildings();readonly types=['Laboratory','Classroom','Office','ServerRoom','Storage','Hallway','Stairs','Restroom'];readonly filtered=signal(this.store.spaces());readonly view=signal<'cards'|'table'>('cards');query='';building='';type='';risk='';constructor(){this.alertService.getRecentAlerts('all').subscribe(items=>this.alertItems.set(items))}apply():void{const q=this.query.toLowerCase();this.filtered.set(this.store.spaces().filter(s=>(!q||`${s.name} ${s.roomNumber}`.toLowerCase().includes(q))&&(!this.building||s.buildingId===this.building)&&(!this.type||s.type===this.type)&&(!this.risk||s.status===this.risk)))}icon(space:Space):string{return space.type==='Laboratory'?'⚗':space.type==='ServerRoom'?'▤':space.type==='Classroom'?'▥':space.type==='Restroom'?'WC':space.type==='Stairs'?'≋':'⌂'}buildingName(id:string){return this.store.getBuilding(id)?.name??'—'}floorName(id:string){return this.store.getFloorById(id)?.name??'—'}alertCount(id:string){return this.alertItems().filter(a=>a.location.zoneId===id).length}}

@Component({selector:'resq-space-detail',standalone:true,imports:[CommonModule,ReactiveFormsModule,RouterLink,MatIconModule,StatusBadgeComponent,LineChartComponent],changeDetection:ChangeDetectionStrategy.OnPush,template:`
  @if(space()){
    <div class="detail-head"><div><a routerLink="/spaces"><mat-icon>arrow_back</mat-icon>Spaces</a><div class="title"><span><mat-icon>grid_view</mat-icon></span><div><h2>{{space()!.name}}</h2><p>Room {{space()!.roomNumber}} · {{buildingName()}} · {{floorName()}}</p></div></div></div><resq-status-badge [status]="space()!.status"/></div>
    <nav class="tabs"><button [class.active]="tab()==='Overview'" (click)="tab.set('Overview')"><mat-icon>dashboard</mat-icon>Overview</button><button [class.active]="tab()==='Devices'" (click)="tab.set('Devices')"><mat-icon>sensors</mat-icon>Devices</button><button [class.active]="tab()==='Alerts'" (click)="tab.set('Alerts')"><mat-icon>warning_amber</mat-icon>Alerts</button><button [class.active]="tab()==='Monitoring Configuration'" (click)="tab.set('Monitoring Configuration')"><mat-icon>tune</mat-icon>Monitoring Configuration</button><button [class.active]="tab()==='History'" (click)="tab.set('History')"><mat-icon>history</mat-icon>History</button></nav>
    @if(tab()==='Overview'){<div class="overview-grid"><article><h3>Current Conditions</h3><div class="reading-grid">@for(device of space()!.devices.slice(0,4);track device.id){<div><span>{{device.type}}</span><b>{{device.readings.at(-1)?.value}} {{device.readings.at(-1)?.unit}}</b><resq-status-badge [status]="device.status"/></div>}</div><h3>Environmental History</h3><resq-line-chart [multi]="true"/></article><aside><h3>Space information</h3><dl><dt>Room</dt><dd>{{space()!.roomNumber}}</dd><dt>Type</dt><dd>{{space()!.type}}</dd><dt>Sensitivity</dt><dd>{{space()!.sensitivity}}</dd><dt>Devices</dt><dd>{{space()!.devices.length}}</dd><dt>Risk status</dt><dd><resq-status-badge [status]="space()!.status"/></dd></dl></aside></div>}
    @if(tab()==='Devices'){<div class="list-panel">@for(device of space()!.devices;track device.id){<a [routerLink]="'/devices/'+device.id"><span><mat-icon>sensors</mat-icon></span><div><b>{{device.displayName || device.name}}</b><small>{{device.code}} · {{device.name}} · {{device.type}}</small></div><resq-status-badge [status]="device.status"/><mat-icon>chevron_right</mat-icon></a>}</div>}
    @if(tab()==='Alerts'){<div class="list-panel">@for(alert of alerts();track alert.id){<a [routerLink]="'/alerts/'+alert.id"><span><mat-icon>warning_amber</mat-icon></span><div><b>{{alert.title}}</b><small>{{alert.riskTypeLabel}} · {{alert.description}}</small></div><resq-status-badge [status]="alert.severity"/><mat-icon>chevron_right</mat-icon></a>}</div>}
    @if(tab()==='Monitoring Configuration'){<form class="config" [formGroup]="form" (ngSubmit)="save()"><div class="config-intro"><h3>Monitoring Configuration</h3><p>Each sensitivity level keeps its own warning and critical thresholds.</p></div><label>Sensitivity level<select formControlName="sensitivity" (change)="changeSensitivity($any($event.target).value)"><option>Low</option><option>Normal</option><option>High</option><option>Custom</option></select></label><h4>Environmental thresholds for {{activeSensitivity()}}</h4><div class="thresholds">@for(metric of metrics;track metric){<div><span><b>{{metric}}</b><small>{{unit(metric)}}</small></span><label>Warning<input type="number" [formControlName]="metric+'Warning'"/></label><label>Critical<input type="number" [formControlName]="metric+'Critical'"/></label></div>}</div><button type="submit" [disabled]="form.invalid">Save {{activeSensitivity()}} configuration</button></form>}
    @if(tab()==='History'){<article class="history"><h3>Risk History</h3><p><i class="critical"></i><b>Today, 14:32</b><span>Critical</span><small>Gas crossed critical threshold</small></p><p><i class="warning"></i><b>Today, 14:10</b><span>Warning</span><small>Smoke levels increasing</small></p><p><i class="normal"></i><b>Today, 13:48</b><span>Normal</span><small>All conditions within range</small></p><resq-line-chart [multi]="true"/></article>}
  }@else{<div class="not-found"><h2>Space not found</h2><a routerLink="/dashboard">Back to Dashboard</a></div>}
`,styleUrls: ['./space-detail.page.scss','./space-detail.improvements.scss']})
export class SpaceDetailPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SpaceService);
  private readonly alertService = inject(AlertService);
  private readonly store = inject(BuildingStoreService);
  private readonly snack = inject(MatSnackBar);
  readonly alertItems = signal<AlertListItem[]>([]);
  readonly space = signal<Space | undefined>(undefined);
  readonly tab = signal('Overview');
  readonly activeSensitivity = signal<SensitivityLevel>('Normal');
  readonly thresholdProfiles = signal<Partial<Record<SensitivityLevel, SpaceThresholds>>>({});
  readonly metrics = ['Temperature', 'Smoke', 'Gas', 'Humidity'] as const;
  readonly sensitivityLevels: SensitivityLevel[] = ['Low', 'Normal', 'High', 'Custom'];
  readonly form = this.fb.nonNullable.group({
    sensitivity: ['Normal' as SensitivityLevel, Validators.required],
    TemperatureWarning: [28, Validators.required], TemperatureCritical: [35, Validators.required],
    SmokeWarning: [80, Validators.required], SmokeCritical: [120, Validators.required],
    GasWarning: [200, Validators.required], GasCritical: [300, Validators.required],
    HumidityWarning: [70, Validators.required], HumidityCritical: [85, Validators.required],
  });

  ngOnInit(): void {
    const found = this.store.spaces().find(space => space.id === this.route.snapshot.paramMap.get('spaceId'));
    this.space.set(found);
    this.alertService.getRecentAlerts('all').subscribe(items => this.alertItems.set(items));
    if (!found) return;

    const profiles: Partial<Record<SensitivityLevel, SpaceThresholds>> = {};
    for (const level of this.sensitivityLevels) {
      profiles[level] = this.cloneThresholds(found.thresholdProfiles?.[level] ?? found.thresholds);
    }
    this.thresholdProfiles.set(profiles);
    this.activeSensitivity.set(found.sensitivity);
    this.patchConfiguration(found.sensitivity, profiles[found.sensitivity]!);
  }

  changeSensitivity(next: SensitivityLevel): void {
    const previous = this.activeSensitivity();
    this.thresholdProfiles.update(profiles => ({ ...profiles, [previous]: this.thresholdsFromForm() }));
    this.activeSensitivity.set(next);
    const profile = this.thresholdProfiles()[next] ?? this.space()?.thresholds;
    if (profile) this.patchConfiguration(next, profile);
  }

  alerts() { return this.alertItems().filter(alert => alert.location.zoneId === this.space()?.id).slice(0, 8); }
  buildingName() { const id = this.space()?.buildingId; return id ? this.store.getBuilding(id)?.name ?? '—' : '—'; }
  floorName() { const id = this.space()?.floorId; return id ? this.store.getFloorById(id)?.name ?? '—' : '—'; }
  unit(metric: string) { return metric === 'Temperature' ? '°C' : metric === 'Humidity' ? '%' : 'ppm'; }

  save(): void {
    const space = this.space();
    if (!space || this.form.invalid) return;
    const sensitivity = this.activeSensitivity();
    const thresholds = this.thresholdsFromForm();
    const profiles = { ...this.thresholdProfiles(), [sensitivity]: thresholds };
    this.thresholdProfiles.set(profiles);
    this.service.updateConfiguration(space.id, sensitivity, thresholds, profiles);
    this.space.set({ ...space, sensitivity, thresholds, thresholdProfiles: profiles });
    this.snack.open(`${sensitivity} sensitivity configuration updated.`, 'Close', { duration: 2500 });
  }

  private thresholdsFromForm(): SpaceThresholds {
    const value = this.form.getRawValue();
    return {
      Temperature: { warning: value.TemperatureWarning, critical: value.TemperatureCritical },
      Smoke: { warning: value.SmokeWarning, critical: value.SmokeCritical },
      Gas: { warning: value.GasWarning, critical: value.GasCritical },
      Humidity: { warning: value.HumidityWarning, critical: value.HumidityCritical },
    };
  }

  private patchConfiguration(sensitivity: SensitivityLevel, thresholds: SpaceThresholds): void {
    this.form.patchValue({
      sensitivity,
      TemperatureWarning: thresholds.Temperature?.warning, TemperatureCritical: thresholds.Temperature?.critical,
      SmokeWarning: thresholds.Smoke?.warning, SmokeCritical: thresholds.Smoke?.critical,
      GasWarning: thresholds.Gas?.warning, GasCritical: thresholds.Gas?.critical,
      HumidityWarning: thresholds.Humidity?.warning, HumidityCritical: thresholds.Humidity?.critical,
    }, { emitEvent: false });
  }

  private cloneThresholds(thresholds: SpaceThresholds): SpaceThresholds {
    return Object.fromEntries(Object.entries(thresholds).map(([metric, value]) => [metric, value ? { ...value } : value])) as SpaceThresholds;
  }
}
