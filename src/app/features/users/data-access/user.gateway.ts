import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export interface ContactInformationRecord {
  email: string;

  /**
   * Temporarily optional because the current
   * legacy frontend mock does not contain a phone.
   *
   * The final User domain expects contact
   * information to include it.
   */
  phoneNumber?: string;
}

export interface UserPreferencesRecord {

  /**
   * These fields are temporarily optional because
   * the existing DEMO_USER has no persisted
   * preferences.
   *
   * The real backend UserProfile should provide
   * the complete preference value object.
   */
  language?: string;

  timeZone?: string;

  receiveSMSAlerts?: boolean;
}

export interface UserProfileRecord {
  userId: string;

  firstName: string;

  lastName: string;

  contactInformation:
    ContactInformationRecord;

  preferences:
    UserPreferencesRecord;
}

export interface UpdateContactInformationInput {
  email: string;

  phoneNumber: string;
}

export interface UpdateUserPreferencesInput {
  language?: string;

  timeZone?: string;

  receiveSMSAlerts?: boolean;
}

export interface UserGateway {

  getMyProfile():
    Observable<
      UserProfileRecord
      | undefined
    >;

  updateMyContactInformation(
    input:
      UpdateContactInformationInput,
  ):
    Observable<
      UserProfileRecord
    >;

  updateMyPreferences(
    input:
      UpdateUserPreferencesInput,
  ):
    Observable<
      UserProfileRecord
    >;
}

export const USER_GATEWAY =
  new InjectionToken<UserGateway>(
    'USER_GATEWAY',
  );