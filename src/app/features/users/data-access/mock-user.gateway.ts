import {
  Injectable,
  signal,
} from '@angular/core';

import {
  Observable,
  delay,
  of,
  throwError,
} from 'rxjs';

import {
  ApiError,
} from '../../../core/api/api-error';

import {
  DEMO_USER,
} from '../../../core/mock-data/resq.mock';

import {
  cloneUserProfile,
  mapLegacyUserToProfile,
} from './user.mapper';

import {
  UpdateContactInformationInput,
  UpdateUserPreferencesInput,
  UserGateway,
  UserProfileRecord,
} from './user.gateway';

@Injectable()
export class MockUserGateway
  implements UserGateway {

  private readonly profileState =
    signal<UserProfileRecord>(
      mapLegacyUserToProfile(
        DEMO_USER,
      ),
    );

  getMyProfile():
    Observable<
      UserProfileRecord
      | undefined
    > {

    return of(
      cloneUserProfile(
        this.profileState(),
      ),
    ).pipe(
      delay(60),
    );
  }

  updateMyContactInformation(
    input:
      UpdateContactInformationInput,
  ):
    Observable<
      UserProfileRecord
    > {

    const email =
      input.email
        .trim()
        .toLowerCase();

    const phoneNumber =
      input.phoneNumber
        .trim();

    if (
      !isValidEmail(
        email,
      )
    ) {

      return throwError(
        () =>
          badRequest(
            'INVALID_EMAIL',

            'A valid email address is required.',
          ),
      );
    }

    if (
      !phoneNumber
    ) {

      return throwError(
        () =>
          badRequest(
            'PHONE_NUMBER_REQUIRED',

            'A phone number is required.',
          ),
      );
    }

    const next:
      UserProfileRecord = {

      ...cloneUserProfile(
        this.profileState(),
      ),

      contactInformation: {

        email,

        phoneNumber,
      },
    };

    this.profileState.set(
      next,
    );

    return of(
      cloneUserProfile(
        next,
      ),
    ).pipe(
      delay(90),
    );
  }

  updateMyPreferences(
    input:
      UpdateUserPreferencesInput,
  ):
    Observable<
      UserProfileRecord
    > {

    if (
      input.language ===
        undefined &&

      input.timeZone ===
        undefined &&

      input.receiveSMSAlerts ===
        undefined
    ) {

      return throwError(
        () =>
          badRequest(
            'PREFERENCES_REQUIRED',

            'At least one preference must be provided.',
          ),
      );
    }

    const language =
      normalizeOptionalValue(
        input.language,
      );

    const timeZone =
      normalizeOptionalValue(
        input.timeZone,
      );

    if (
      input.language !==
        undefined &&
      !language
    ) {

      return throwError(
        () =>
          badRequest(
            'INVALID_LANGUAGE',

            'Language cannot be empty.',
          ),
      );
    }

    if (
      input.timeZone !==
        undefined &&
      !timeZone
    ) {

      return throwError(
        () =>
          badRequest(
            'INVALID_TIME_ZONE',

            'Time zone cannot be empty.',
          ),
      );
    }

    const current =
      cloneUserProfile(
        this.profileState(),
      );

    const next:
      UserProfileRecord = {

      ...current,

      preferences: {

        language:
          input.language !==
          undefined
            ? language
            : current
                .preferences
                .language,

        timeZone:
          input.timeZone !==
          undefined
            ? timeZone
            : current
                .preferences
                .timeZone,

        receiveSMSAlerts:
          input.receiveSMSAlerts !==
          undefined
            ? input.receiveSMSAlerts
            : current
                .preferences
                .receiveSMSAlerts,
      },
    };

    this.profileState.set(
      next,
    );

    return of(
      cloneUserProfile(
        next,
      ),
    ).pipe(
      delay(90),
    );
  }
}

function normalizeOptionalValue(
  value?:
    string,
):
  string
  | undefined {

  const normalized =
    value?.trim();

  return normalized
    ? normalized
    : undefined;
}

function isValidEmail(
  value:
    string,
): boolean {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      value,
    );
}

function badRequest(
  code:
    string,

  message:
    string,
):
  ApiError {

  return {
    status:
      400,

    code,

    message,

    fieldErrors:
      [],
  };
}