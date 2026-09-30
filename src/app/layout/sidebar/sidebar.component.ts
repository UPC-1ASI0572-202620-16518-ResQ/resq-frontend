import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { AlertWorkspaceFacade } from '../../features/alerts/alert-workspace.facade';
import { LanguageService } from '../../core/services/language.service';
import { AuthSessionFacade } from '../../features/auth/auth-session.facade';

@Component({
  selector: 'resq-sidebar',

  standalone: true,

  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <div class="brand">

      <div class="logo">

        @if (!logoFailed()) {

          <img class="logo-full"
            src="/assets/brand/resq-logo.png"
            alt="ResQ"
            (error)="logoFailed.set(true)"
          />
          <img class="logo-mobile" src="/assets/brand/resq-icon.png" alt="ResQ" />

        } @else {

          <div class="logo-fallback"><mat-icon>shield</mat-icon></div>
        }

      </div>

    </div>

    <nav
      aria-label="Primary navigation"
    >

      @for (
        item of items;
        track item.route
      ) {

        <a
          [routerLink]="item.route"
          routerLinkActive="active"
          (click)="navigate.emit()"
        >

          <span class="nav-icon">
            <mat-icon>{{ item.icon }}</mat-icon>
          </span>

          <span class="nav-label">
            {{ language.t(item.key, item.label) }}
          </span>

          @if (item.route === '/alerts' && alertCount()) {
            <em>{{ alertCount() }}</em>
          }

        </a>
      }

    </nav>

    <section class="mobile-account" aria-label="Mobile account controls">
      <button type="button" class="mobile-notifications" (click)="mobileNotificationsOpen.update(open => !open)">
        <span><mat-icon>notifications_none</mat-icon></span>
        <div><b>{{ language.t('notifications', 'Notifications') }}</b><small>{{ alertCount() }} {{ language.t('alerts', 'Alerts') }}</small></div>
        @if (alertCount()) { <em>{{ alertCount() }}</em> }
        <mat-icon class="expand" [class.open]="mobileNotificationsOpen()">expand_more</mat-icon>
      </button>
      @if (mobileNotificationsOpen()) {
        <div class="mobile-alert-list">
          @for (alert of alerts.rows().slice(0, 3); track alert.id) {
            <a [routerLink]="'/alerts/' + alert.id" (click)="navigate.emit()">
              <mat-icon>{{ alert.severity === 'Critical' ? 'error_outline' : 'warning_amber' }}</mat-icon>
              <div><b>{{ alert.title }}</b><small>{{ alert.severity }}</small></div>
            </a>
          }
          <a class="mobile-view-all" routerLink="/alerts" (click)="navigate.emit()">{{ language.t('viewAlerts', 'View all alerts') }}</a>
        </div>
      }
      <a routerLink="/settings" (click)="navigate.emit()" class="mobile-user">
        <span class="avatar">{{ initials() }}</span>
        <div><b>{{ userName() }}</b><small>{{ language.t('administrator', 'Administrator') }}</small></div>
        <mat-icon>chevron_right</mat-icon>
      </a>
    </section>

  `,

  styleUrl:
    './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {

  @Output()
  navigate =
    new EventEmitter<void>();

  readonly alerts = inject(AlertWorkspaceFacade);
  private readonly session = inject(AuthSessionFacade);
  readonly language = inject(LanguageService);
  readonly userName = computed(() => this.session.fullName() || 'Sofia Ramirez');
  readonly initials = computed(() => this.userName().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase());
  readonly mobileNotificationsOpen = signal(false);

  readonly logoFailed =
    signal(
      false,
    );

  readonly alertCount = this.alerts.recentCount;
  ngOnInit(): void {
    if (!this.alerts.rows().length) this.alerts.loadAlerts().subscribe({ error: () => undefined });
  }

  readonly items = [

    {
      key: 'dashboard',
      label:
        'Dashboard',

      icon:
        'dashboard',

      route:
        '/dashboard',
    },

    {
      key: 'buildings',
      label:
        'Buildings',

      icon:
        'apartment',

      route:
        '/buildings',
    },

    {
      key: 'monitoring',
      label:
        'Floor Monitoring',

      icon:
        'monitoring',

      route:
        '/monitoring',
    },

    {
      key: 'spaces',
      label:
        'Spaces',

      icon:
        'grid_view',

      route:
        '/spaces',
    },

    {
      key: 'devices',
      label:
        'Devices',

      icon:
        'sensors',

      route:
        '/devices',
    },

    {
      key: 'alerts',
      label:
        'Alerts',

      icon:
        'warning_amber',

      route:
        '/alerts',
    },

    {
      key: 'incidents',
      label:
        'Incidents',

      icon:
        'assignment_late',

      route:
        '/incidents',
    },

    {
      key: 'settings',
      label:
        'Settings',

      icon:
        'settings',

      route:
        '/settings',
    },
  ];
}
