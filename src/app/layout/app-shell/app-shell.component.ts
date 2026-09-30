import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  RouterOutlet,
} from '@angular/router';

import {
  AuthSessionFacade,
} from '../../features/auth/auth-session.facade';

import {
  SidebarComponent,
} from '../sidebar/sidebar.component';

import {
  TopbarComponent,
} from '../topbar/topbar.component';

@Component({
  selector:
    'resq-app-shell',

  standalone:
    true,

  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <aside
      [class.open]="menuOpen()"
    >
      <resq-sidebar
        (navigate)="
          menuOpen.set(false)
        "
      />
    </aside>

    @if (menuOpen()) {

      <button
        class="backdrop"
        aria-label="Close navigation"
        (click)="
          menuOpen.set(false)
        "
      >
      </button>
    }

    <section>

      <resq-topbar
        (menuClick)="
          menuOpen.update(
            value => !value
          )
        "
      />

      <main>
        <router-outlet />
      </main>

    </section>
  `,

  styles: [
    `
      :host {
        display: flex;
        min-height: 100dvh;
        background: var(--resq-background);
      }

      aside {
        position: fixed;
        inset: 0 auto 0 0;
        width: 220px;
        background:
          linear-gradient(
            180deg,
            #071c35,
            #08213e
          );
        z-index: 50;
      }

      section {
        margin-left: 220px;
        min-width: 0;
        width: calc(100% - 220px);
      }

      main {
        min-height:
          calc(100dvh - 70px);
        padding:
          12px 14px 22px;
      }

      .backdrop {
        display: none;
      }

      @media(max-width: 800px) {

        aside {
          transform:
            translateX(-100%);
          transition: .2s;
        }

        aside.open {
          transform: none;
        }

        .backdrop {
          display: block;
          position: fixed;
          inset: 0;
          border: 0;
          background: #10182880;
          z-index: 45;
        }

        section {
          margin-left: 0;
          width: 100%;
        }

        main {
          padding: 10px;
        }
      }
    `,
  ],
})
export class AppShellComponent
  implements OnInit {

  private readonly session =
    inject(
      AuthSessionFacade,
    );

  readonly menuOpen =
    signal(
      false,
    );

  ngOnInit():
    void {

    /*
     * When navigation reaches the application
     * shell directly, try to restore the user
     * presentation state.
     *
     * With the current mock this resolves locally.
     * With the future backend this can work with
     * whichever session mechanism IAM ultimately
     * defines.
     */
    this.session
      .ensureProfileLoaded()
      .subscribe({

        error:
          () => {

            /*
             * Route protection will be connected
             * once the backend session/token
             * contract is finalized.
             *
             * We intentionally do not invent a
             * token-persistence strategy here.
             */
          },
      });
  }

  @HostListener(
    'window:resize',
  )
  resize():
    void {

    if (
      innerWidth > 760
    ) {

      this.menuOpen.set(
        false,
      );
    }
  }
}