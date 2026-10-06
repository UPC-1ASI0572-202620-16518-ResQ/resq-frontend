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
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthSessionFacade } from '../auth/auth-session.facade';
import { UserFacade } from '../users/data-access/user.facade';
import { AppLanguage, LanguageService } from '../../core/services/language.service';
import { AuthorizationService } from '../auth/authorization.service';

@Component({
  selector: 'resq-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
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
            <span><mat-icon>{{ item.icon }}</mat-icon></span>
            <div>
              <b>{{ language.t(item.key, item.label) }}</b>
              <small>{{ language.t(item.helpKey, item.help) }}</small>
            </div>
          </button>
        }
      </nav>

      <section class="panel">
        @if (loading()) {
          <div class="state">{{language.t('loadingProfile','Loading your profile...')}}</div>
        } @else {
          @if (section() === 'profile') {
            <header>
              <h2>{{language.t('profile','Profile')}}</h2>
              <p>{{language.t('personalInfo','Personal information and contact details for your account.')}}</p>
            </header>

            <div class="identity-card">
              <div class="avatar">{{ initials() }}</div>
              <div>
                <b>{{ session.fullName() || 'ResQ User' }}</b>
                <small>User ID: {{ profile()?.userId || 'Unavailable' }}</small>
              </div>
            </div>

            <h3 class="section-heading">{{language.t('accountOverview','Account overview')}}</h3>
            <dl class="profile-meta">
              <div><dt>{{language.t('userId','User ID')}}</dt><dd>{{profile()?.userId || language.t('unavailable','Unavailable')}}</dd></div>
              <div><dt>{{language.t('role','Role')}}</dt><dd>{{ authorization.roleLabel() }}</dd></div>
              <div><dt>{{language.t('accountStatus','Account status')}}</dt><dd class="active-state">{{language.t('active','Active')}}</dd></div>
              <div><dt>{{language.t('applicationLanguage','Application language')}}</dt><dd>{{language.language()==='es' ? language.t('spanish','Spanish') : language.t('english','English')}}</dd></div>
              <div><dt>{{language.t('timeZone','Time zone')}}</dt><dd>{{profile()?.preferences?.timeZone || 'America/Lima'}}</dd></div>
            </dl>

            <form [formGroup]="contactForm" (ngSubmit)="saveContact()">
              <div class="fields">
                <label>
                  {{language.t('firstName','First name')}}
                  <input [value]="profile()?.firstName || ''" readonly />
                </label>

                <label>
                  {{language.t('lastName','Last name')}}
                  <input [value]="profile()?.lastName || ''" readonly />
                </label>

                <label>
                  {{language.t('email','Email address')}}
                  <input type="email" formControlName="email" autocomplete="email" />
                </label>

                <label>
                  {{language.t('phone','Phone number')}}
                  <input formControlName="phoneNumber" autocomplete="tel" [placeholder]="language.t('enterPhone','Enter phone number')" />
                </label>
              </div>

              @if (user.error(); as error) {
                <p class="error">{{ error.message }}</p>
              }

              <footer>
                <button type="button" class="cancel" (click)="resetContact()">{{language.t('reset','Reset')}}</button>
                <button type="submit" [disabled]="contactForm.invalid || user.saving()">
                  {{ user.saving() ? language.t('saving','Saving...') : language.t('saveContact','Save contact information') }}
                </button>
              </footer>
            </form>
          }

          @if (section() === 'preferences') {
            <header>
              <h2>{{language.t('preferences','Preferences')}}</h2>
              <p>{{language.t('preferencesDescription','Configure language, time zone and SMS notifications.')}}</p>
            </header>

            <form [formGroup]="preferencesForm" (ngSubmit)="savePreferences()">
              <div class="fields">
                <label>
                  {{language.t('applicationLanguage','Application language')}}
                  <select formControlName="language" (change)="changeLanguage($any($event.target).value)">
                    <option value="en_US">English</option>
                    <option value="es_419">Español</option>
                  </select>
                </label>

                <label>
                  {{language.t('timeZone','Time zone')}}
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
                    <b>{{language.t('smsAlerts','SMS alerts')}}</b>
                    <small>{{language.t('smsHelp','Allow ResQ to send alert notifications to your registered phone number.')}}</small>
                  </div>
                  <input type="checkbox" formControlName="receiveSMSAlerts" />
                </label>
              </div>

              <p class="note">
                {{language.t('languageApplied','Language changes are applied immediately and retained for future sessions.')}}
              </p>

              <footer>
                <button type="button" class="cancel" (click)="resetPreferences()">{{language.t('reset','Reset')}}</button>
                <button type="submit" [disabled]="user.saving()">
                  {{ user.saving() ? language.t('saving','Saving...') : language.t('savePreferences','Save preferences') }}
                </button>
              </footer>
            </form>
          }

          @if (section() === 'security') {
            <header>
              <h2>{{language.t('security','Security & Access')}}</h2>
              <p>Authentication belongs to IAM. Personal profile data is not duplicated here.</p>
            </header>

            <dl class="security-grid">
              <div>
                <dt>{{language.t('authenticationState','Authentication state')}}</dt>
                <dd>{{ session.authenticated() ? language.t('authenticated','Authenticated') : language.t('localProfile','Local profile only') }}</dd>
              </div>
              <div>
                <dt>{{language.t('identityId','Identity ID')}}</dt>
                <dd>{{ session.identityId() || 'Not available in current session' }}</dd>
              </div>
              <div>
                <dt>{{language.t('userId','User ID')}}</dt>
                <dd>{{ profile()?.userId || 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>{{language.t('roleManagement','Role management')}}</dt>
                <dd>{{language.t('roleHelp','Roles are managed by the identity service.')}}</dd>
              </div>
            </dl>

            <div class="security-actions">
              <div>
                <b>{{language.t('endSession','End this session')}}</b>
                <small>{{language.t('endSessionHelp','Clears the current frontend session and profile state.')}}</small>
              </div>
              <button type="button" class="danger" (click)="signOut()">{{language.t('signOut','Sign out')}}</button>
            </div>
          }
        }
      </section>
    </div>
  `,
  styleUrls: ['./settings.page.scss', './settings.readability.scss'],
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly user = inject(UserFacade);
  readonly session = inject(AuthSessionFacade);
  readonly language = inject(LanguageService);
  readonly authorization = inject(AuthorizationService);

  readonly section = signal<'profile' | 'preferences' | 'security'>('profile');
  readonly sections = [
    { id: 'profile' as const, key: 'profile', label: 'Profile', icon: 'person', helpKey: 'contactInfo', help: 'Contact information' },
    { id: 'preferences' as const, key: 'preferences', label: 'Preferences', icon: 'tune', helpKey: 'languageNotifications', help: 'Language and notifications' },
    { id: 'security' as const, key: 'security', label: 'Security & Access', icon: 'security', helpKey: 'sessionInfo', help: 'IAM session information' },
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
    language: ['en_US'],
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
    this.language.setLanguage(this.language.fromPreference(value.language));
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

  changeLanguage(preference: string): void {
    this.language.setLanguage(this.language.fromPreference(preference) as AppLanguage);
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
      language: preferences?.language ?? this.language.toPreference(),
      timeZone: preferences?.timeZone ?? '',
      receiveSMSAlerts: preferences?.receiveSMSAlerts ?? false,
    });
    this.language.setLanguage(this.language.fromPreference(preferences?.language ?? this.language.toPreference()));
  }
}
