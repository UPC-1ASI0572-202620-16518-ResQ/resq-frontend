import { Injectable, signal } from '@angular/core';
import { AuthenticationSessionRecord } from './data-access/iam.gateway';

const STORAGE_KEY = 'resq.auth.session';

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  private readonly state = signal<AuthenticationSessionRecord | undefined>(readPersistedSession());
  readonly session = this.state.asReadonly();

  read(): AuthenticationSessionRecord | undefined {
    return this.state();
  }

  write(session: AuthenticationSessionRecord): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.state.set(session);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state.set(undefined);
  }

  token(): string | undefined {
    return this.read()?.token;
  }
}

function readPersistedSession(): AuthenticationSessionRecord | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<AuthenticationSessionRecord>;
    if (
      typeof value.userId !== 'number' ||
      typeof value.username !== 'string' ||
      typeof value.token !== 'string' ||
      typeof value.role !== 'string' ||
      isExpired(value.token)
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return value as AuthenticationSessionRecord;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
