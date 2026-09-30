import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  Router,
} from '@angular/router';

import {
  AuthSessionFacade,
} from './auth-session.facade';

@Component({
  selector:
    'resq-login-page',

  standalone:
    true,

  imports: [
    ReactiveFormsModule,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <main>

      <section class="visual">

        <div class="brand">

          <span>◇</span>

          <div>
            <b>ResQ</b>
            <small>
              Smart Buildings. Safer People.
            </small>
          </div>

        </div>

        <div class="message">

          <span>
            Connected building intelligence
          </span>

          <h1>
            See risk sooner.<br>
            Respond with confidence.
          </h1>

          <p>
            Monitor every floor, space and sensor
            from one secure operations platform.
          </p>

          <div class="mini">

            <div>
              <b>142</b>
              <small>
                Connected devices
              </small>
            </div>

            <div>
              <b>98.7%</b>
              <small>
                System uptime
              </small>
            </div>

            <div>
              <b>24/7</b>
              <small>
                Live monitoring
              </small>
            </div>

          </div>

        </div>

        <div class="grid-art"></div>

      </section>

      <section class="login">

        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
        >

          <div class="mobile-brand">
            ◇ ResQ
          </div>

          <h2>
            Welcome back
          </h2>

          <p>
            Sign in to continue to your
            monitoring workspace.
          </p>

          <label>
            Email address

            <input
              type="email"
              formControlName="email"
              autocomplete="username"
            />
          </label>

          <label>
            Password

            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
          </label>

          @if (formError()) {

            <div class="error">
              {{ formError() }}
            </div>
          }

          @if (session.error(); as authError) {

            <div class="error">
              {{ authError.message }}
            </div>
          }

          <button
            type="submit"
            [disabled]="
              form.invalid ||
              session.loading()
            "
          >
            {{
              session.loading()
                ? 'Signing in...'
                : 'Sign in'
            }}
          </button>

          <div class="demo">

            <b>
              Demo credentials
            </b>

            <span>
              admin@resq.io
            </span>

            <span>
              password123
            </span>

          </div>

          <small class="copyright">
            © 2026 ResQ ·
            Secure building intelligence
          </small>

        </form>

      </section>

    </main>
  `,

  styleUrl:
    './login.page.scss',
})
export class LoginPage {

  private readonly fb =
    inject(
      FormBuilder,
    );

  private readonly router =
    inject(
      Router,
    );

  readonly session =
    inject(
      AuthSessionFacade,
    );

  readonly formError =
    signal(
      '',
    );

  readonly form =
    this.fb
      .nonNullable
      .group({

        email: [
          'admin@resq.io',

          [
            Validators.required,
            Validators.email,
          ],
        ],

        password: [
          'password123',

          Validators.required,
        ],
      });

  submit():
    void {

    this.formError.set(
      '',
    );

    this.session
      .clearError();

    if (
      this.form.invalid
    ) {

      this.form
        .markAllAsTouched();

      this.formError.set(
        'Enter a valid email address and password.',
      );

      return;
    }

    const {
      email,
      password,
    } =
      this.form
        .getRawValue();

    this.session
      .signIn(
        email,
        password,
      )
      .subscribe({

        next:
          () => {

            void this.router
              .navigateByUrl(
                '/dashboard',
              );
          },

        error:
          () => {

            /*
             * Error presentation is provided by
             * AuthSessionFacade.error().
             */
          },
      });
  }
}