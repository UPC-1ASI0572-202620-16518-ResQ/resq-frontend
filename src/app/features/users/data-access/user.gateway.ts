import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export interface ContactInformationRecord {
  email: string;

  /**
   * Optional because existing backend profiles may not have a phone.
   */
  phoneNumber?: string;
}

export interface UserPreferencesRecord {

  /**
   * These fields are temporarily optional because
   * the backend profile contract does not expose
   * persisted preferences.
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
