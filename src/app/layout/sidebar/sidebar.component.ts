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

import { AlertWorkspaceFacade } from '../../features/alerts/alert-workspace.facade';
import { DeviceWorkspaceFacade } from '../../features/devices/device-workspace.facade';

@Component({
  selector: 'resq-sidebar',

  standalone: true,

  imports: [
    RouterLink,
    RouterLinkActive,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <div class="brand">

      <div class="logo">

        @if (!logoFailed()) {

          <img
            src="/assets/brand/resq-logo.png"
            alt="ResQ"
            (error)="logoFailed.set(true)"
          />

        } @else {

          <div class="logo-fallback">
            ◇
          </div>
        }

      </div>

      <div class="brand-copy">

        <b>
          ResQ
        </b>

        <span>
          Smart Buildings
          <br>
          Safer People
        </span>

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
            {{ item.icon }}
          </span>

          <span class="nav-label">
            {{ item.label }}
          </span>

          @if (item.route === '/alerts' && alertCount()) {
            <em>{{ alertCount() }}</em>
          }

        </a>
      }

    </nav>

    <div class="sidebar-bottom">

      <div class="system">

        <b>
          System Status
        </b>

        <span>
          <i [class.attention]="systemAttention()"></i>
          {{ systemStatus() }}
        </span>

      </div>

      <small>
        v1.0.0
      </small>

    </div>
  `,

  styleUrl:
    './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {

  @Output()
  navigate =
    new EventEmitter<void>();

  private readonly alerts = inject(AlertWorkspaceFacade);
  private readonly devices = inject(DeviceWorkspaceFacade);

  readonly logoFailed =
    signal(
      false,
    );

  readonly alertCount = this.alerts.recentCount;
  readonly systemAttention = computed(() => this.devices.summary().offline > 0);
  readonly systemStatus = computed(() =>
    this.systemAttention()
      ? `${this.devices.summary().offline} device(s) offline / timeout`
      : 'All Systems Operational',
  );

  ngOnInit(): void {
    if (!this.alerts.rows().length) this.alerts.loadAlerts().subscribe({ error: () => undefined });
    if (!this.devices.rows().length) this.devices.loadFleet().subscribe({ error: () => undefined });
  }

  readonly items = [

    {
      label:
        'Dashboard',

      icon:
        '⌂',

      route:
        '/dashboard',
    },

    {
      label:
        'Buildings',

      icon:
        '▥',

      route:
        '/buildings',
    },

    {
      label:
        'Floor Monitoring',

      icon:
        '⌘',

      route:
        '/monitoring',
    },

    {
      label:
        'Spaces',

      icon:
        '⌂',

      route:
        '/spaces',
    },

    {
      label:
        'Devices',

      icon:
        '◉',

      route:
        '/devices',
    },

    {
      label:
        'Alerts',

      icon:
        '△',

      route:
        '/alerts',
    },

    {
      label:
        'Incidents',

      icon:
        '◷',

      route:
        '/incidents',
    },

    {
      label:
        'Analytics',

      icon:
        '⌁',

      route:
        '/analytics',
    },

    {
      label:
        'Settings',

      icon:
        '⚙',

      route:
        '/settings',
    },
  ];
}