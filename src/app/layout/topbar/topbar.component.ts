import {
  CommonModule,
} from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormsModule,
} from '@angular/forms';

import {
  NavigationEnd,
  Router,
  RouterLink,
} from '@angular/router';

import {
  Subscription,
  filter,
} from 'rxjs';

import {
  SearchResult,
} from '../../core/models/resq.models';


import {
  AlertWorkspaceFacade,
} from '../../features/alerts/alert-workspace.facade';

import { GlobalSearchFacade } from '../../features/search/global-search.facade';

import {
  AuthSessionFacade,
} from '../../features/auth/auth-session.facade';

@Component({
  selector:
    'resq-topbar',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <button
      class="menu"
      type="button"
      aria-label="Open navigation"
      (click)="menuClick.emit()"
    >
      ☰
    </button>

    <div class="page-title">

      <div class="page-icon">
        {{ icon() }}
      </div>

      <div>

        <h1>
          {{ title() }}
        </h1>

        <p>
          {{ subtitle() }}
        </p>

      </div>

    </div>

    <div class="actions">

      @if (
        showLocationSelectors()
      ) {

        <label class="select">

          <span>
            ▥
          </span>

          <select
            aria-label="Building"
            (change)="
              selectBuilding(
                $event
              )
            "
          >

            <option value="science">
              Science Building
            </option>

            <option value="main">
              Main Building
            </option>

            <option value="research">
              Research Center
            </option>

          </select>

        </label>

        <label class="select floor">

          <span>
            ▱
          </span>

          <select
            aria-label="Floor"
            (change)="
              selectFloor(
                $event
              )
            "
          >

            <option value="2">
              Floor 2
            </option>

            <option value="1">
              Floor 1
            </option>

            <option value="3">
              Floor 3
            </option>

            <option value="4">
              Floor 4
            </option>

          </select>

        </label>
      }

      <div class="search">

        <span>
          ⌕
        </span>

        <input
          aria-label="Global search"
          placeholder="Search spaces, devices..."
          [(ngModel)]="query"
          (ngModelChange)="
            search(
              $event
            )
          "
        />

        @if (
          results().length
        ) {

          <div class="search-results">

            @for (
              group of groupedResults();
              track group.type
            ) {

              <b>
                {{ group.type }}s
              </b>

              @for (
                item of group.items;
                track item.id
              ) {

                <a
                  [routerLink]="item.route"
                  (click)="clearSearch()"
                >

                  <span>
                    {{ item.title }}
                  </span>

                  <small>
                    {{ item.subtitle }}
                  </small>

                </a>
              }
            }

          </div>
        }

      </div>

      <div class="notification-wrap">

        <button
          class="icon-button"
          type="button"
          aria-label="Notifications"
          [attr.aria-expanded]="
            notificationsOpen()
          "
          (click)="toggleNotifications()"
        >
          ♢

          <i></i>

        </button>

        @if (
          notificationsOpen()
        ) {

          <div class="notifications">

            <h3>
              Recent Alerts

              <span>
                {{ recentAlertCount() }}
              </span>
            </h3>

            @for (
              alert of latestAlerts();
              track alert.id
            ) {

              <a
                [routerLink]="
                  '/alerts/' + alert.id
                "
                (click)="
                  notificationsOpen.set(
                    false
                  )
                "
              >

                <i
                  [class.critical]="
                    alert.severity ===
                    'Critical'
                  "
                >
                  !
                </i>

                <div>

                  <b>
                    {{ alert.title }}
                  </b>

                  <small>
                    {{ alert.severity }}
                    ·
                    {{
                      relativeTime(
                        alert.generatedAt
                      )
                    }}
                  </small>

                </div>

              </a>
            }

            <a
              class="view-all"
              routerLink="/alerts"
              (click)="
                notificationsOpen.set(
                  false
                )
              "
            >
              View all alerts →
            </a>

          </div>
        }

      </div>

      <div class="user-wrap">

        <button
          class="user"
          type="button"
          [attr.aria-label]="
            'Account menu for ' +
            userName()
          "
          [attr.aria-expanded]="
            userMenuOpen()
          "
          (click)="toggleUserMenu()"
        >

          <span>
            {{ userInitials() }}
          </span>

          <div>

            <b>
              {{ userName() }}
            </b>

            <small>
              {{ userSubtitle() }}
            </small>

          </div>

          <i
            [class.open]="
              userMenuOpen()
            "
          >
            ⌄
          </i>

        </button>

        @if (
          userMenuOpen()
        ) {

          <div class="user-menu">

            <div class="user-menu-header">

              <span>
                {{ userInitials() }}
              </span>

              <div>

                <b>
                  {{ userName() }}
                </b>

                <small>
                  {{ userSubtitle() }}
                </small>

              </div>

            </div>

            <div class="user-menu-separator">
            </div>

            <a
              routerLink="/settings"
              (click)="
                userMenuOpen.set(
                  false
                )
              "
            >

              <span>
                ⚙
              </span>

              Settings

            </a>

            <button
              type="button"
              class="sign-out"
              (click)="signOut()"
            >

              <span>
                ↪
              </span>

              Sign out

            </button>

          </div>
        }

      </div>

    </div>
  `,

  styleUrl:
    './topbar.component.scss',
})
export class TopbarComponent
  implements OnInit, OnDestroy {

  private readonly router =
    inject(
      Router,
    );

  private readonly searchService =
    inject(
      GlobalSearchFacade,
    );

  private readonly alertWorkspace =
    inject(
      AlertWorkspaceFacade,
    );

  private readonly session =
    inject(
      AuthSessionFacade,
    );

  @Output()
  menuClick =
    new EventEmitter<void>();

  readonly title =
    signal(
      'Dashboard',
    );

  readonly subtitle =
    signal(
      'Overview of your monitored infrastructure',
    );

  readonly icon =
    signal(
      '⌂',
    );

  readonly showLocationSelectors =
    signal(
      false,
    );

  readonly results =
    signal<
      SearchResult[]
    >(
      [],
    );

  readonly notificationsOpen =
    signal(
      false,
    );

  readonly userMenuOpen =
    signal(
      false,
    );

  readonly latestAlerts =
    this.alertWorkspace
      .recent;

  readonly recentAlertCount =
    this.alertWorkspace
      .recentCount;

  readonly userName =
    computed(
      () =>
        this.session
          .fullName()
          .trim() ||
        'ResQ User',
    );

  readonly userSubtitle =
    computed(
      () =>
        this.session
          .email()
          .trim() ||
        'Authenticated user',
    );

  readonly userInitials =
    computed(
      () => {

        const profile =
          this.session
            .profile();

        if (!profile) {
          return 'RQ';
        }

        const first =
          profile.firstName
            .trim()
            .charAt(0);

        const last =
          profile.lastName
            .trim()
            .charAt(0);

        return (
          `${first}${last}`
            .toUpperCase() ||
          'RQ'
        );
      },
    );

  query =
    '';

  private subscription?:
    Subscription;

  ngOnInit():
    void {

    this.subscription =
      this.router.events
        .pipe(

          filter(
            event =>
              event instanceof
              NavigationEnd,
          ),
        )
        .subscribe(
          () => {

            this.updateTitle();

            this.userMenuOpen.set(
              false,
            );

            this.notificationsOpen.set(
              false,
            );
          },
        );

    this.updateTitle();

    if (!this.alertWorkspace.rows().length) {
      this.alertWorkspace.loadAlerts().subscribe({ error: () => undefined });
    }
  }

  ngOnDestroy():
    void {

    this.subscription
      ?.unsubscribe();
  }

  @HostListener(
    'document:keydown.escape',
  )
  closeMenusOnEscape():
    void {

    this.userMenuOpen.set(
      false,
    );

    this.notificationsOpen.set(
      false,
    );
  }

  toggleUserMenu():
    void {

    this.notificationsOpen.set(
      false,
    );

    this.userMenuOpen.update(
      value =>
        !value,
    );
  }

  toggleNotifications():
    void {

    this.userMenuOpen.set(
      false,
    );

    this.notificationsOpen.update(
      value =>
        !value,
    );
  }

  signOut():
    void {

    this.userMenuOpen.set(
      false,
    );

    this.notificationsOpen.set(
      false,
    );

    this.clearSearch();

    this.session
      .signOut();

    void this.router
      .navigateByUrl(
        '/login',
      );
  }

  updateTitle():
    void {

    const path =
      this.router.url
        .split(
          '/',
        )[1] ||
      'dashboard';

    const map:
      Record<
        string,
        [
          string,
          string,
          string,
        ]
      > = {

      dashboard: [
        'Dashboard',
        'Overview of your monitored infrastructure',
        '⌂',
      ],

      buildings: [
        'Buildings',
        'Manage and monitor your property portfolio',
        '▥',
      ],

      monitoring: [
        'Floor Monitoring',
        'Real-time monitoring of spaces, devices and environmental conditions',
        '⌘',
      ],

      spaces: [
        'Spaces',
        'Monitor risk and environmental conditions by space',
        '⌂',
      ],

      devices: [
        'Devices',
        'IoT device health, capabilities, connectivity and assignments',
        '◉',
      ],

      alerts: [
        'Alert Center',
        'Review risk alerts and detection context',
        '△',
      ],

      incidents: [
        'Incidents',
        'Coordinate response and track resolution',
        '◷',
      ],

      analytics: [
        'Analytics',
        'Operational trends and safety intelligence',
        '⌁',
      ],

      settings: [
        'Settings',
        'Personalize your ResQ experience',
        '⚙',
      ],
    };

    const current =
      map[path] ??
      [
        'ResQ',
        'Smart buildings. Safer people.',
        '◇',
      ];

    this.title.set(
      current[0],
    );

    this.subtitle.set(
      current[1],
    );

    this.icon.set(
      current[2],
    );

    this.showLocationSelectors.set(
      path ===
      'monitoring',
    );
  }

  search(
    query:
      string,
  ):
    void {

    this.searchService
      .search(
        query,
      )
      .subscribe(
        items =>
          this.results.set(
            items,
          ),
      );
  }

  groupedResults():
    Array<{
      type: string;
      items: SearchResult[];
    }> {

    return [
      'Space',
      'Device',
      'Building',
    ]
      .map(
        type => ({
          type,

          items:
            this.results()
              .filter(
                item =>
                  item.type ===
                  type,
              ),
        }),
      )
      .filter(
        group =>
          group.items.length,
      );
  }

  clearSearch():
    void {

    this.query =
      '';

    this.results.set(
      [],
    );
  }

  relativeTime(
    date:
      Date,
  ):
    string {

    const minutes =
      Math.max(
        0,

        Math.floor(
          (
            Date.now() -
            date.getTime()
          ) /
          60_000,
        ),
      );

    if (
      minutes < 1
    ) {

      return 'just now';
    }

    if (
      minutes < 60
    ) {

      return `${minutes} min ago`;
    }

    const hours =
      Math.floor(
        minutes / 60,
      );

    return hours < 24
      ? `${hours}h ago`
      : `${Math.floor(
          hours / 24,
        )}d ago`;
  }

  selectBuilding(
    event:
      Event,
  ):
    void {

    const id =
      (
        event.target as
          HTMLSelectElement
      ).value;

    void this.router
      .navigate([

        '/monitoring',

        id,

        'floors',

        `${id}-f${
          id ===
          'research'
            ? 1
            : 2
        }`,
      ]);
  }

  selectFloor(
    event:
      Event,
  ):
    void {

    const level =
      (
        event.target as
          HTMLSelectElement
      ).value;

    const building =
      this.router.url
        .split(
          '/',
        )[2] ||
      'science';

    void this.router
      .navigate([

        '/monitoring',

        building,

        'floors',

        `${building}-f${level}`,
      ]);
  }
}