import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SearchResult } from '../../core/models/resq.models';
import { LanguageService } from '../../core/services/language.service';
import { AuthSessionFacade } from '../../features/auth/auth-session.facade';
import { AuthorizationService } from '../../features/auth/authorization.service';
import { AnalyticsWorkspaceFacade } from '../../features/analytics/analytics-workspace.facade';

@Component({
  selector: 'resq-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="menu" aria-label="Open navigation" (click)="menuClick.emit()">
      <mat-icon>menu</mat-icon>
    </button>

    <div class="search">
      <mat-icon>search</mat-icon>
      <input aria-label="Global search" [placeholder]="language.t('search', 'Search spaces, devices...')" [(ngModel)]="query" (ngModelChange)="search($event)" />
      @if (results().length) {
        <div class="search-results">
          @for (group of groupedResults(); track group.type) {
            <b>{{ group.type }}s</b>
            @for (item of group.items; track item.id) {
              <a [routerLink]="item.route" (click)="clearSearch()"><span>{{ item.title }}</span><small>{{ item.subtitle }}</small></a>
            }
          }
        </div>
      }
    </div>

    <div class="actions">
      <div class="notification-wrap" #notificationWrap>
        <button type="button" class="icon-button" aria-label="Notifications" title="Notifications" (click)="notificationsOpen.update(value => !value)">
          <mat-icon>notifications_none</mat-icon>
          @if (notificationItems().length) { <i></i> }
        </button>
        @if (notificationsOpen()) {
          <div class="notifications">
            <h3>{{language.t('notifications','Notifications')}} <span>{{ notificationItems().length }}</span></h3>
            @for (item of notificationItems().slice(0, 6); track item.id) {
              <a [routerLink]="item.route" (click)="notificationsOpen.set(false)"><i [class.critical]="item.kind === 'Incident'">!</i><div><b>{{ item.eventLabel }}</b><span>{{ item.title }}</span><small>{{ item.location }}</small></div></a>
            }
            <a class="view-all" routerLink="/alerts" (click)="notificationsOpen.set(false)">View Alerts</a>
            <a class="view-all" routerLink="/incidents" (click)="notificationsOpen.set(false)">View Incidents →</a>
          </div>
        }
      </div>

      <div class="user-wrap" #userWrap>
        <button type="button" class="user" title="User profile" (click)="userMenuOpen.update(value => !value)">
          <span>{{initials()}}</span><div><b>{{userName()}}</b><small>{{roleLabel()}}</small></div><mat-icon [class.open]="userMenuOpen()">expand_more</mat-icon>
        </button>
        @if(userMenuOpen()) {
          <div class="user-menu">
            <div class="user-menu-header"><span>{{initials()}}</span><div><b>{{userName()}}</b><small>{{roleLabel()}}</small></div></div>
            <div class="user-menu-separator"></div>
            <a routerLink="/settings" (click)="userMenuOpen.set(false)"><mat-icon>settings</mat-icon><span>{{language.t('settings','Settings')}}</span></a>
            <a class="sign-out" routerLink="/login" (click)="signOut()"><mat-icon>logout</mat-icon><span>{{language.t('signOut','Sign out')}}</span></a>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly analytics = inject(AnalyticsWorkspaceFacade);
  private readonly session = inject(AuthSessionFacade);
  private readonly authorization = inject(AuthorizationService);
  readonly language = inject(LanguageService);

  @Output() readonly menuClick = new EventEmitter<void>();
  readonly results = signal<SearchResult[]>([]);
  readonly notificationsOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly roleLabel = this.authorization.roleLabel;
  readonly notificationItems = computed(() => [
    ...this.analytics.alerts()
      .filter((alert) => alert.status === 'ACTIVE')
      .map((alert) => ({
        id: alert.id,
        kind: 'Alert' as const,
        eventLabel: 'WARNING ALERT',
        title: alert.title,
        location: alert.location.zoneName,
        status: 'Active',
        route: `/alerts/${alert.id}`,
        at: alert.generatedAt,
      })),
    ...this.analytics.incidents()
      .filter((row) => row.incident.status === 'ACTIVE' || row.incident.status === 'IN_PROGRESS')
      .map((row) => ({
        id: row.incident.incidentId,
        kind: 'Incident' as const,
        eventLabel: 'CRITICAL INCIDENT',
        title: row.title,
        location: row.location.zoneName,
        status: row.incident.status === 'ACTIVE' ? 'Active' : 'In Progress',
        route: `/incidents/${row.incident.incidentId}`,
        at: row.incident.createdAt,
      })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime()));
  readonly userName = computed(() => this.session.fullName() || this.session.username());
  readonly initials = computed(() => this.userName().split(/\s+/).slice(0, 2).map((part: string) => part.charAt(0)).join('').toUpperCase());
  query = '';

  @ViewChild('notificationWrap') private notificationWrap?: ElementRef<HTMLElement>;
  @ViewChild('userWrap') private userWrap?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  closeMenusOnOutsideClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.notificationWrap?.nativeElement.contains(target)) this.notificationsOpen.set(false);
    if (!this.userWrap?.nativeElement.contains(target)) this.userMenuOpen.set(false);
  }

  search(query: string): void {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) { this.results.set([]); return; }
    const buildings: SearchResult[] = this.analytics.buildings()
      .filter((item) => `${item.name} ${item.buildingCode}`.toLowerCase().includes(normalized))
      .map((item) => ({ id: item.id, type: 'Building', title: item.name, subtitle: item.buildingCode, route: `/buildings/${item.id}` }));
    const spaces: SearchResult[] = this.analytics.buildings().flatMap((building) => building.zones)
      .filter((item) => `${item.name} ${item.zoneCode}`.toLowerCase().includes(normalized))
      .map((item) => ({ id: item.id, type: 'Space', title: item.name, subtitle: item.zoneCode, route: `/spaces/${item.id}` }));
    const devices: SearchResult[] = this.analytics.devices()
      .filter((row) => `${row.catalog.name} ${row.catalog.deviceCode}`.toLowerCase().includes(normalized))
      .map((row) => ({ id: row.catalog.id, type: 'Device', title: row.catalog.name, subtitle: row.catalog.deviceCode, route: `/devices/${row.catalog.id}` }));
    this.results.set([...buildings, ...spaces, ...devices].slice(0, 10));
  }
  groupedResults(): Array<{ type: string; items: SearchResult[] }> {
    return ['Space', 'Device', 'Building'].map(type => ({ type, items: this.results().filter(item => item.type === type) })).filter(group => group.items.length);
  }
  clearSearch(): void { this.query = ''; this.results.set([]); }
  signOut(): void { this.session.signOut(); }
}
