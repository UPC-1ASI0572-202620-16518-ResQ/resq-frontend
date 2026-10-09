import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthSessionFacade } from '../auth/auth-session.facade';
import { UserFacade } from '../users/data-access/user.facade';
import { AppLanguage, LanguageService } from '../../core/services/language.service';
import { AuthorizationService } from '../auth/authorization.service';
import { SubscriptionFacade } from '../subscriptions/data-access/subscription.facade';

@Component({
  selector: 'resq-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings">
      <nav aria-label="Settings sections">
        @for (item of sections; track item.id) {
          <button type="button" [class.active]="section() === item.id" (click)="section.set(item.id)">
            <span><mat-icon>{{ item.icon }}</mat-icon></span>
            <div><b>{{ item.label }}</b><small>{{ item.help }}</small></div>
          </button>
        }
      </nav>

      <section class="panel">
        @if (loading() || subscription.loading()) {
          <div class="state">Cargando información...</div>
        } @else {
          @if (section() === 'profile') {
            <header>
              <h2>Perfil</h2>
              <p>Información personal y de contacto.</p>
            </header>
            <div class="identity-card">
              <div class="avatar">{{ initials() }}</div>
              <div><b>{{ session.fullName() || 'ResQ User' }}</b><small>User ID: {{ profile()?.userId || 'Unavailable' }}</small></div>
            </div>
            <h3 class="section-heading">Resumen de la cuenta</h3>
            <dl class="profile-meta">
              <div><dt>ID de usuario</dt><dd>{{profile()?.userId || 'No disponible'}}</dd></div>
              <div><dt>Rol</dt><dd>{{ authorization.roleLabel() }}</dd></div>
              <div><dt>Estado de la cuenta</dt><dd class="active-state">Activa</dd></div>
              <div><dt>Idioma</dt><dd>{{language.language() === 'es' ? 'Español' : 'Inglés'}}</dd></div>
              <div><dt>Zona horaria</dt><dd>{{profile()?.preferences?.timeZone || 'America/Lima'}}</dd></div>
            </dl>
            <form [formGroup]="contactForm" (ngSubmit)="saveContact()">
              <div class="fields">
                <label>Nombre<input [value]="profile()?.firstName || ''" readonly /></label>
                <label>Apellido<input [value]="profile()?.lastName || ''" readonly /></label>
                <label>Correo electrónico<input type="email" formControlName="email" autocomplete="email" /></label>
                <label>Teléfono<input formControlName="phoneNumber" autocomplete="tel" placeholder="Ingresa tu teléfono" /></label>
              </div>
              @if (user.error(); as error) { <p class="error">{{ error.message }}</p> }
              <footer>
                <button type="button" class="cancel" (click)="resetContact()">Restablecer</button>
                <button type="submit" [disabled]="contactForm.invalid || user.saving()">{{ user.saving() ? 'Guardando...' : 'Guardar contacto' }}</button>
              </footer>
            </form>
          }

          @if (section() === 'preferences') {
            <header>
              <h2>Preferencias</h2>
              <p>Configura idioma, zona horaria y notificaciones.</p>
            </header>
            <form [formGroup]="preferencesForm" (ngSubmit)="savePreferences()">
              <div class="fields">
                <label>Idioma de la aplicación
                  <select formControlName="language" (change)="changeLanguage($any($event.target).value)">
                    <option value="en_US">English</option>
                    <option value="es_419">Español</option>
                  </select>
                </label>
                <label>Zona horaria
                  <select formControlName="timeZone">
                    <option value="">No configurado</option>
                    <option value="America/Lima">America/Lima</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
              </div>
              <div class="toggles">
                <label>
                  <div>
                    <b>Alertas SMS</b>
                    <small>Permitir que ResQ envíe notificaciones a tu teléfono.</small>
                  </div>
                  <input type="checkbox" formControlName="receiveSMSAlerts" />
                </label>
              </div>
              <footer>
                <button type="button" class="cancel" (click)="resetPreferences()">Restablecer</button>
                <button type="submit" [disabled]="user.saving()">{{ user.saving() ? 'Guardando...' : 'Guardar preferencias' }}</button>
              </footer>
            </form>
          }

          @if (section() === 'security') {
            <header>
              <h2>Seguridad y acceso</h2>
              <p>Información de tu sesión en IAM.</p>
            </header>
            <dl class="security-grid">
              <div><dt>Estado de autenticación</dt><dd>{{ session.authenticated() ? 'Autenticado' : 'Perfil local' }}</dd></div>
              <div><dt>ID de Identidad</dt><dd>{{ session.identityId() || 'No disponible' }}</dd></div>
              <div><dt>Rol en la app</dt><dd>{{ authorization.roleLabel() }}</dd></div>
            </dl>
            <div class="security-actions">
              <div><b>Finalizar sesión</b><small>Limpia la sesión y datos locales.</small></div>
              <button type="button" class="danger" (click)="signOut()">Cerrar sesión</button>
            </div>
          }

          @if (section() === 'subscription') {
            <header>
              <h2>Suscripción</h2>
              <p>Estado de tu plan de ResQ.</p>
            </header>

            @if (subscription.isActive()) {
              <dl class="security-grid">
                <div><dt>Fecha inicio</dt><dd>{{ formatDate(subscription.subscription()?.startDate) }}</dd></div>
                <div><dt>Fecha fin</dt><dd>{{ formatDate(subscription.subscription()?.endDate) }}</dd></div>
                <div><dt>Estado</dt><dd class="active-state">{{ formatStatus(subscription.subscription()?.status) }}</dd></div>
              </dl>
              <footer>
                <button type="button" class="cancel" (click)="cancelSubscription()">Cancelar</button>
                <button type="button" (click)="renewSubscription()">Renovar</button>
              </footer>
            } @else {
              <div class="state">
                <p>para tener los beneficios compre su suscripción</p>
              </div>
              <footer>
                <button type="button" (click)="activateSubscription()">Activar</button>
              </footer>
            }
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
  readonly subscription = inject(SubscriptionFacade);

  readonly section = signal<'profile' | 'preferences' | 'security' | 'subscription'>('profile');

  readonly sections = [
    { id: 'profile' as const, label: 'Perfil', icon: 'person', help: 'Información de contacto' },
    { id: 'preferences' as const, label: 'Preferencias', icon: 'tune', help: 'Idioma y notificaciones' },
    { id: 'security' as const, label: 'Seguridad y Acceso', icon: 'security', help: 'Información de sesión IAM' },
    { id: 'subscription' as const, label: 'Suscripción', icon: 'card_membership', help: 'Estado de tu plan' },
  ];

  readonly loading = computed(() => this.user.loading() || this.session.loading());
  readonly profile = this.user.profile;
  readonly initials = computed(() => {
    const profile = this.profile();
    return profile ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() : 'RQ';
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
    if (load$) load$.subscribe({ next: () => this.populateForms(), error: () => undefined });
    else this.populateForms();

    this.subscription.loadMySubscription().subscribe();
  }

  saveContact(): void {
    if (this.contactForm.invalid) { this.contactForm.markAllAsTouched(); return; }
    this.user.updateContactInformation(this.contactForm.getRawValue()).subscribe({
      next: () => { this.populateForms(); this.snack.open('Contacto guardado.', 'Cerrar', { duration: 2200 }); },
      error: () => undefined,
    });
  }

  savePreferences(): void {
    const value = this.preferencesForm.getRawValue();
    this.language.setLanguage(this.language.fromPreference(value.language));
    this.user.updatePreferences({ ...(value.language ? { language: value.language } : {}), ...(value.timeZone ? { timeZone: value.timeZone } : {}), receiveSMSAlerts: value.receiveSMSAlerts }).subscribe({
      next: () => { this.populateForms(); this.snack.open('Preferencias guardadas.', 'Cerrar', { duration: 2200 }); },
      error: () => undefined,
    });
  }

  resetContact(): void { this.populateContact(); }
  resetPreferences(): void { this.populatePreferences(); }
  changeLanguage(preference: string): void { this.language.setLanguage(this.language.fromPreference(preference) as AppLanguage); }
  signOut(): void { this.session.signOut(); void this.router.navigateByUrl('/login'); }

  private populateForms(): void { this.populateContact(); this.populatePreferences(); }
  private populateContact(): void { const profile = this.profile(); this.contactForm.setValue({ email: profile?.contactInformation.email ?? '', phoneNumber: profile?.contactInformation.phoneNumber ?? '' }); }
  private populatePreferences(): void { const preferences = this.profile()?.preferences; this.preferencesForm.setValue({ language: preferences?.language ?? this.language.toPreference(), timeZone: preferences?.timeZone ?? '', receiveSMSAlerts: preferences?.receiveSMSAlerts ?? false }); this.language.setLanguage(this.language.fromPreference(preferences?.language ?? this.language.toPreference())); }

  activateSubscription(): void {
    const now = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(now.getFullYear() + 1);

    this.subscription.activate({ startDate: now, endDate: nextYear }).subscribe({
      next: () => this.snack.open('Suscripción activada exitosamente.', 'Cerrar', { duration: 3000 })
    });
  }

  renewSubscription(): void {
    const sub = this.subscription.subscription();
    if (!sub) return;

    const baseDate = sub.endDate.getTime() > Date.now() ? sub.endDate : new Date();
    const newEndDate = new Date(baseDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    this.subscription.renew(sub.id, { newEndDate }).subscribe({
      next: () => this.snack.open('Suscripción renovada por 1 año más.', 'Cerrar', { duration: 3000 })
    });
  }

  cancelSubscription(): void {
    const sub = this.subscription.subscription();
    if (!sub) return;

    if (confirm('¿Estás seguro de que deseas cancelar tu suscripción? Perderás los beneficios.')) {
      this.subscription.cancel(sub.id).subscribe({
        next: () => this.snack.open('La suscripción ha sido cancelada.', 'Cerrar', { duration: 3000 })
      });
    }
  }

  formatDate(date?: Date): string {
    return date ? date.toLocaleDateString() : '—';
  }

  formatStatus(status?: string): string {
    const statusMap: Record<string, string> = {
      'ACTIVE': 'activa',
      'CANCELLED': 'cancelada',
      'EXPIRED': 'expirada'
    };
    return status ? (statusMap[status] || status) : '—';
  }
}
