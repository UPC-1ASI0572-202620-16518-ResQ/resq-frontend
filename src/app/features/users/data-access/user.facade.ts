import {
  Inject,
  Injectable,
  computed,
  signal,
} from '@angular/core';

import {
  Observable,
  catchError,
  finalize,
  tap,
  throwError,
} from 'rxjs';

import {
  ApiError,
  isApiError,
} from '../../../core/api/api-error';

import {
  USER_GATEWAY,
  UpdateContactInformationInput,
  UpdateUserPreferencesInput,
  UserGateway,
  UserProfileRecord,
} from './user.gateway';

@Injectable()
export class UserFacade {

  private readonly profileState =
    signal<
      UserProfileRecord
      | undefined
    >(
      undefined,
    );

  private readonly loadingState =
    signal(
      false,
    );

  private readonly savingState =
    signal(
      false,
    );

  private readonly errorState =
    signal<
      ApiError
      | undefined
    >(
      undefined,
    );

  readonly profile =
    this.profileState
      .asReadonly();

  readonly loading =
    this.loadingState
      .asReadonly();

  readonly saving =
    this.savingState
      .asReadonly();

  readonly error =
    this.errorState
      .asReadonly();

  readonly fullName =
    computed(
      () => {

        const profile =
          this.profileState();

        if (!profile) {
          return '';
        }

        return [
          profile.firstName,
          profile.lastName,
        ]
          .filter(
            value =>
              value.trim()
                .length > 0,
          )
          .join(
            ' ',
          );
      },
    );

  readonly email =
    computed(
      () =>
        this.profileState()
          ?.contactInformation
          .email ??
        '',
    );

  loadMyProfile():
    Observable<
      UserProfileRecord
      | undefined
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .getMyProfile()
      .pipe(

        tap(
          profile =>
            this.profileState.set(
              profile,
            ),
        ),

        catchError(
          error =>
            this.fail(
              error,
            ),
        ),

        finalize(
          () =>
            this.loadingState.set(
              false,
            ),
        ),
      );
  }

  updateContactInformation(
    input:
      UpdateContactInformationInput,
  ):
    Observable<
      UserProfileRecord
    > {

    return this.mutate(
      this.gateway
        .updateMyContactInformation(
          input,
        ),
    );
  }

  updatePreferences(
    input:
      UpdateUserPreferencesInput,
  ):
    Observable<
      UserProfileRecord
    > {

    return this.mutate(
      this.gateway
        .updateMyPreferences(
          input,
        ),
    );
  }

  clearProfile():
    void {

    this.profileState.set(
      undefined,
    );

    this.errorState.set(
      undefined,
    );
  }

  clearError():
    void {

    this.errorState.set(
      undefined,
    );
  }

  constructor(

    @Inject(
      USER_GATEWAY,
    )

    private readonly gateway:
      UserGateway,
  ) {}

  private mutate(
    operation:
      Observable<
        UserProfileRecord
      >,
  ):
    Observable<
      UserProfileRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return operation.pipe(

      tap(
        profile =>
          this.profileState.set(
            profile,
          ),
      ),

      catchError(
        error =>
          this.fail(
            error,
          ),
      ),

      finalize(
        () =>
          this.savingState.set(
            false,
          ),
      ),
    );
  }

  private fail(
    error:
      unknown,
  ):
    Observable<never> {

    const apiError:
      ApiError =
      isApiError(
        error,
      )
        ? error
        : {
            status:
              0,

            code:
              'CLIENT_ERROR',

            message:
              error instanceof Error
                ? error.message
                : 'An unexpected client error occurred.',

            fieldErrors:
              [],

            details:
              error,
          };

    this.errorState.set(
      apiError,
    );

    return throwError(
      () =>
        apiError,
    );
  }
}