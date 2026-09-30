import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter, switchMap } from 'rxjs';
import { SearchResult } from '../../core/models/resq.models';
import { AlertService, SearchService } from '../../core/services/data.services';

@Component({
  selector: 'resq-topbar', standalone: true, imports: [CommonModule, FormsModule, RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="menu" aria-label="Open navigation" (click)="menuClick.emit()">☰</button>
    <div class="page-title"><div class="page-icon">{{ icon() }}</div><div><h1>{{ title() }}</h1><p>{{ subtitle() }}</p></div></div>
    <div class="actions">
      <label class="select"><span>▥</span><select aria-label="Building" (change)="selectBuilding($event)"><option value="science">Science Building</option><option value="main">Main Building</option><option value="research">Research Center</option></select></label>
      <label class="select floor"><span>▱</span><select aria-label="Floor" (change)="selectFloor($event)"><option value="2">Floor 2</option><option value="1">Floor 1</option><option value="3">Floor 3</option><option value="4">Floor 4</option></select></label>
      <div class="search"><span>⌕</span><input aria-label="Global search" placeholder="Search spaces, devices..." [(ngModel)]="query" (ngModelChange)="search($event)" />
        @if(results().length){<div class="search-results">@for(group of groupedResults();track group.type){<b>{{group.type}}s</b>@for(item of group.items;track item.id){<a [routerLink]="item.route" (click)="clearSearch()"><span>{{item.title}}</span><small>{{item.subtitle}}</small></a>}}</div>}
      </div>
      <div class="notification-wrap"><button class="icon-button" aria-label="Notifications" (click)="notificationsOpen.update(v=>!v)">♢<i></i></button>
        @if(notificationsOpen()){<div class="notifications"><h3>Notifications <span>{{activeAlerts().length}}</span></h3>@for(alert of activeAlerts().slice(0,3);track alert.id){<a [routerLink]="'/alerts/'+alert.id"><i [class.critical]="alert.severity==='Critical'">!</i><div><b>{{alert.title}}</b><small>{{alert.severity}} · recently</small></div></a>}<a class="view-all" routerLink="/alerts">View all alerts →</a></div>}
      </div>
      <div class="user"><span>JD</span><div><b>John Doe</b><small>Administrator</small></div><i>⌄</i></div>
    </div>
  `,
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);
  private readonly alertService = inject(AlertService);
  @Output() menuClick = new EventEmitter<void>();
  readonly title = signal('Dashboard'); readonly subtitle = signal('Overview of your monitored infrastructure'); readonly icon = signal('⌂');
  readonly results = signal<SearchResult[]>([]); readonly notificationsOpen = signal(false); readonly activeAlerts = this.alertService.activeAlerts; query = '';
  private subscription?: Subscription;
  ngOnInit(): void { this.subscription = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.updateTitle()); this.updateTitle(); }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
  updateTitle(): void {
    const path = this.router.url.split('/')[1] || 'dashboard';
    const map: Record<string,[string,string,string]> = {
      dashboard:['Dashboard','Overview of your monitored infrastructure','⌂'], buildings:['Buildings','Manage and monitor your property portfolio','▥'], monitoring:['Floor Monitoring','Real-time monitoring of spaces, devices and environmental conditions','⌘'],
      spaces:['Spaces','Monitor risk and environmental conditions by space','⌂'], devices:['Devices','IoT device health, telemetry and assignments','◉'], alerts:['Alert Center','Review, acknowledge and resolve safety alerts','△'], incidents:['Incidents','Coordinate response and track resolution','◷'], analytics:['Analytics','Operational trends and safety intelligence','⌁'], settings:['Settings','Personalize your ResQ experience','⚙']
    };
    const current = map[path] ?? ['ResQ','Smart buildings. Safer people.','◇']; this.title.set(current[0]); this.subtitle.set(current[1]); this.icon.set(current[2]);
  }
  search(query: string): void { this.searchService.search(query).subscribe(items => this.results.set(items)); }
  groupedResults(): Array<{type:string;items:SearchResult[]}> { return ['Space','Device','Building'].map(type => ({type,items:this.results().filter(item=>item.type===type)})).filter(group=>group.items.length); }
  clearSearch(): void { this.query=''; this.results.set([]); }
  selectBuilding(event: Event): void { const id = (event.target as HTMLSelectElement).value; this.router.navigate(['/monitoring', id, 'floors', `${id}-f${id === 'research' ? 1 : 2}`]); }
  selectFloor(event: Event): void { const level = (event.target as HTMLSelectElement).value; const building = this.router.url.split('/')[2] || 'science'; this.router.navigate(['/monitoring', building, 'floors', `${building}-f${level}`]); }
}
