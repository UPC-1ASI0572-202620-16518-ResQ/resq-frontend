import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SearchResult } from '../../core/models/resq.models';
import { AlertService, SearchService } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { AuthSessionFacade } from '../../features/auth/auth-session.facade';

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
          @if (activeAlerts().length) { <i></i> }
        </button>
        @if (notificationsOpen()) {
          <div class="notifications">
            <h3>{{language.t('notifications','Notifications')}} <span>{{ activeAlerts().length }}</span></h3>
            @for (alert of activeAlerts().slice(0, 3); track alert.id) {
              <a [routerLink]="'/alerts/' + alert.id" (click)="notificationsOpen.set(false)"><i [class.critical]="alert.severity === 'Critical'">!</i><div><b>{{ alert.title }}</b><small>{{ alert.severity }} · {{language.t('recent','recently')}}</small></div></a>
            }
            <a class="view-all" routerLink="/alerts" (click)="notificationsOpen.set(false)">{{language.t('viewAlerts','View all alerts')}} →</a>
          </div>
        }
      </div>

      <div class="user-wrap" #userWrap>
        <button type="button" class="user" title="User profile" (click)="userMenuOpen.update(value => !value)">
          <span>{{initials()}}</span><div><b>{{userName()}}</b><small>{{language.t('administrator','Administrator')}}</small></div><mat-icon [class.open]="userMenuOpen()">expand_more</mat-icon>
        </button>
        @if(userMenuOpen()) {
          <div class="user-menu">
            <div class="user-menu-header"><span>{{initials()}}</span><div><b>{{userName()}}</b><small>{{language.t('administrator','Administrator')}}</small></div></div>
            <div class="user-menu-separator"></div>
            <a routerLink="/settings" (click)="userMenuOpen.set(false)"><mat-icon>settings</mat-icon><span>{{language.t('settings','Settings')}}</span></a>
            <a class="sign-out" routerLink="/login"><mat-icon>logout</mat-icon><span>{{language.t('signOut','Sign out')}}</span></a>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly searchService = inject(SearchService);
  private readonly alertService = inject(AlertService);
  private readonly session = inject(AuthSessionFacade);
  readonly language = inject(LanguageService);

  @Output() readonly menuClick = new EventEmitter<void>();
  readonly results = signal<SearchResult[]>([]);
  readonly notificationsOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly activeAlerts = this.alertService.latestAlerts;
  readonly userName = computed(() => this.session.fullName() || 'Sofia Ramirez');
  readonly initials = computed(() => this.userName().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase());
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

  search(query: string): void { this.searchService.search(query).subscribe(items => this.results.set(items)); }
  groupedResults(): Array<{ type: string; items: SearchResult[] }> {
    return ['Space', 'Device', 'Building'].map(type => ({ type, items: this.results().filter(item => item.type === type) })).filter(group => group.items.length);
  }
  clearSearch(): void { this.query = ''; this.results.set([]); }
}
