import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthSessionFacade } from '../auth/auth-session.facade';
import { UserFacade } from '../users/data-access/user.facade';

@Component({
  selector: 'resq-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings">
      <nav aria-label="Settings sections">
        @for (item of sections; track item.id) {
          <button
            type="button"
            [class.active]="section() === item.id"
            (click)="section.set(item.id)"
          >
            <span>{{ item.icon }}</span>
            <div>
              <b>{{ item.label }}</b>
              <small>{{ item.help }}</small>
            </div>
          </button>
        }
      </nav>

      <section class="panel">
        @if (loading()) {
          <div class="state">Loading your profile...</div>
        } @else {
          @if (section() === 'profile') {
            <header>
              <h2>Profile</h2>
              <p>Personal information owned by the User bounded context.</p>
            </header>

            <div class="identity-card">
              <div class="avatar">{{ initials() }}</div>
              <div>
                <b>{{ session.fullName() || 'ResQ User' }}</b>
                <small>User ID: {{ profile()?.userId || 'Unavailable' }}</small>
              </div>
            </div>

            <form [formGroup]="contactForm" (ngSubmit)="saveContact()">
              <div class="fields">
                <label>
                  Full name
                  <input [value]="session.fullName()" readonly />
                  <small>Name editing is not exposed by the current User API contract.</small>
                </label>

                <label>
                  Email address
                  <input type="email" formControlName="email" autocomplete="email" />
                </label>

                <label>
                  Phone number
                  <input formControlName="phoneNumber" autocomplete="tel" placeholder="Enter phone number" />
                </label>
              </div>

              @if (user.error(); as error) {
                <p class="error">{{ error.message }}</p>
              }

              <footer>
                <button type="button" class="cancel" (click)="resetContact()">Reset</button>
                <button type="submit" [disabled]="contactForm.invalid || user.saving()">
                  {{ user.saving() ? 'Saving...' : 'Save contact information' }}
                </button>
              </footer>
            </form>
          }

          @if (section() === 'preferences') {
            <header>
              <h2>Preferences</h2>
              <p>Language, time zone and SMS alert preferences from the User bounded context.</p>
            </header>

            <form [formGroup]="preferencesForm" (ngSubmit)="savePreferences()">
              <div class="fields">
                <label>
                  Application language
                  <select formControlName="language">
                    <option value="">Not set</option>
                    <option value="en_US">English (en_US)</option>
                    <option value="es_419">Español Latinoamérica (es_419)</option>
                  </select>
                </label>

                <label>
                  Time zone
                  <select formControlName="timeZone">
                    <option value="">Not set</option>
                    <option value="America/Lima">America/Lima</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
              </div>

              <div class="toggles">
                <label>
                  <div>
                    <b>SMS alerts</b>
                    <small>Allow ResQ to send alert notifications to your registered phone number.</small>
                  </div>
                  <input type="checkbox" formControlName="receiveSMSAlerts" />
                </label>
              </div>

              <p class="note">
                The interface remains English-first. These values are already backend-ready; full UI
                localization can be connected independently without changing the User contract.
              </p>

              <footer>
                <button type="button" class="cancel" (click)="resetPreferences()">Reset</button>
                <button type="submit" [disabled]="user.saving()">
                  {{ user.saving() ? 'Saving...' : 'Save preferences' }}
                </button>
              </footer>
            </form>
          }

          @if (section() === 'security') {
            <header>
              <h2>Security & Access</h2>
              <p>Authentication belongs to IAM. Personal profile data is not duplicated here.</p>
            </header>

            <dl class="security-grid">
              <div>
                <dt>Authentication state</dt>
                <dd>{{ session.authenticated() ? 'Authenticated' : 'Local profile only' }}</dd>
              </div>
              <div>
                <dt>Identity ID</dt>
                <dd>{{ session.identityId() || 'Not available in current session' }}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd>{{ profile()?.userId || 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Role management</dt>
                <dd>Backend role catalog required before exposing assignments in the UI.</dd>
              </div>
            </dl>

            <div class="security-actions">
              <div>
                <b>End this session</b>
                <small>Clears the current frontend session and profile state.</small>
              </div>
              <button type="button" class="danger" (click)="signOut()">Sign out</button>
            </div>
          }
        }
      </section>
    </div>
  `,
  styleUrl: './settings.page.scss',
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly user = inject(UserFacade);
  readonly session = inject(AuthSessionFacade);

  readonly section = signal<'profile' | 'preferences' | 'security'>('profile');
  readonly sections = [
    { id: 'profile' as const, label: 'Profile', icon: '◉', help: 'Contact information' },
    { id: 'preferences' as const, label: 'Preferences', icon: '◎', help: 'Language and notifications' },
    { id: 'security' as const, label: 'Security & Access', icon: '⌾', help: 'IAM session information' },
  ];

  readonly loading = computed(() => this.user.loading() || this.session.loading());
  readonly profile = this.user.profile;
  readonly initials = computed(() => {
    const profile = this.profile();
    if (!profile) return 'RQ';
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || 'RQ';
  });

  readonly contactForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', Validators.required],
  });

  readonly preferencesForm = this.fb.nonNullable.group({
    language: [''],
    timeZone: [''],
    receiveSMSAlerts: [false],
  });

  ngOnInit(): void {
    const load$ = this.user.profile() ? undefined : this.user.loadMyProfile();
    if (load$) {
      load$.subscribe({
        next: () => this.populateForms(),
        error: () => undefined,
      });
    } else {
      this.populateForms();
    }
  }

  saveContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.user.updateContactInformation(this.contactForm.getRawValue()).subscribe({
      next: () => {
        this.populateForms();
        this.snack.open('Contact information saved.', 'Close', { duration: 2200 });
      },
      error: () => undefined,
    });
  }

  savePreferences(): void {
    const value = this.preferencesForm.getRawValue();
    this.user
      .updatePreferences({
        ...(value.language ? { language: value.language } : {}),
        ...(value.timeZone ? { timeZone: value.timeZone } : {}),
        receiveSMSAlerts: value.receiveSMSAlerts,
      })
      .subscribe({
        next: () => {
          this.populateForms();
          this.snack.open('Preferences saved.', 'Close', { duration: 2200 });
        },
        error: () => undefined,
      });
  }

  resetContact(): void {
    this.populateContact();
  }

  resetPreferences(): void {
    this.populatePreferences();
  }

  signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl('/login');
  }

  private populateForms(): void {
    this.populateContact();
    this.populatePreferences();
  }

  private populateContact(): void {
    const profile = this.profile();
    this.contactForm.setValue({
      email: profile?.contactInformation.email ?? '',
      phoneNumber: profile?.contactInformation.phoneNumber ?? '',
    });
  }

  private populatePreferences(): void {
    const preferences = this.profile()?.preferences;
    this.preferencesForm.setValue({
      language: preferences?.language ?? '',
      timeZone: preferences?.timeZone ?? '',
      receiveSMSAlerts: preferences?.receiveSMSAlerts ?? false,
    });
  }
}
