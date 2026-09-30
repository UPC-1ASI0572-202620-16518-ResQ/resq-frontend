import {
  HttpClient,
} from '@angular/common/http';

import {
  Inject,
  Injectable,
} from '@angular/core';

import {
  Observable,
  catchError,
  map,
  of,
  throwError,
} from 'rxjs';

import {
  API_CONFIG,
  ApiConfig,
  buildApiUrl,
} from '../../../core/api/api.config';

import {
  mapHttpError,
} from '../../../core/api/http-error.mapper';

import {
  UpdateContactInformationResourceDto,
  UpdateUserPreferencesResourceDto,
  UserProfileResourceDto,
} from './user.dto';

import {
  UpdateContactInformationInput,
  UpdateUserPreferencesInput,
  UserGateway,
  UserProfileRecord,
} from './user.gateway';

import {
  mapUserProfileResourceDto,
} from './user.mapper';

@Injectable()
export class HttpUserGateway
  implements UserGateway {

  private readonly profilePath =
    '/api/v1/users/me';

  constructor(

    private readonly http:
      HttpClient,

    @Inject(
      API_CONFIG,
    )
    private readonly apiConfig:
      ApiConfig,
  ) {}

  getMyProfile():
    Observable<
      UserProfileRecord
      | undefined
    > {

    return this.http
      .get<
        UserProfileResourceDto
      >(
        buildApiUrl(
          this.apiConfig,
          this.profilePath,
        ),
      )
      .pipe(

        map(
          mapUserProfileResourceDto,
        ),

        catchError(
          error => {

            const mapped =
              mapHttpError(
                error,
              );

            return mapped.status ===
              404
              ? of(
                  undefined,
                )
              : throwError(
                  () =>
                    mapped,
                );
          },
        ),
      );
  }

  updateMyContactInformation(
    input:
      UpdateContactInformationInput,
  ):
    Observable<
      UserProfileRecord
    > {

    /*
     * The endpoint itself is documented.
     *
     * The exact request DTO must still be verified
     * against backend OpenAPI before enabling HTTP
     * mode in production.
     */
    const body:
      UpdateContactInformationResourceDto = {

      email:
        input.email,

      phoneNumber:
        input.phoneNumber,
    };

    return this.http
      .put<
        UserProfileResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.profilePath}/contact`,
        ),

        body,
      )
      .pipe(

        map(
          mapUserProfileResourceDto,
        ),

        catchError(
          error =>
            throwError(
              () =>
                mapHttpError(
                  error,
                ),
            ),
        ),
      );
  }

  updateMyPreferences(
    input:
      UpdateUserPreferencesInput,
  ):
    Observable<
      UserProfileRecord
    > {

    const body:
      UpdateUserPreferencesResourceDto = {

      ...(input.language !==
      undefined
        ? {
            language:
              input.language,
          }
        : {}),

      ...(input.timeZone !==
      undefined
        ? {
            timeZone:
              input.timeZone,
          }
        : {}),

      ...(input.receiveSMSAlerts !==
      undefined
        ? {
            receiveSMSAlerts:
              input
                .receiveSMSAlerts,
          }
        : {}),
    };

    return this.http
      .patch<
        UserProfileResourceDto
      >(
        buildApiUrl(
          this.apiConfig,

          `${this.profilePath}/preferences`,
        ),

        body,
      )
      .pipe(

        map(
          mapUserProfileResourceDto,
        ),

        catchError(
          error =>
            throwError(
              () =>
                mapHttpError(
                  error,
                ),
            ),
        ),
      );
  }
}