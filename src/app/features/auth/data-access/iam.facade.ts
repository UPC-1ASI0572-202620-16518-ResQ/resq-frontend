import {
  Inject,
  Injectable,
  computed,
  inject,
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
  IAM_GATEWAY,
  AssignRoleInput,
  AuthenticationInput,
  AuthenticationSessionRecord,
  IamGateway,
  RoleAssignmentRecord,
} from './iam.gateway';
import { AuthSessionStore } from '../auth-session.store';

@Injectable()
export class IamFacade {

  private readonly sessionStore = inject(AuthSessionStore);

  private readonly sessionState = this.sessionStore.session;

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

  readonly session =
    this.sessionState;

  readonly authenticated =
    computed(
      () =>
        this.sessionState() !==
        undefined,
    );

  readonly identityId =
    computed(
      () =>
        this.sessionState()?.userId.toString(),
    );

  readonly role = computed(() => this.sessionState()?.role);

  readonly loading =
    this.loadingState
      .asReadonly();

  readonly saving =
    this.savingState
      .asReadonly();

  readonly error =
    this.errorState
      .asReadonly();

  constructor(

    @Inject(
      IAM_GATEWAY,
    )

    private readonly gateway:
      IamGateway,
  ) {}

  authenticate(
    input:
      AuthenticationInput,
  ):
    Observable<
      AuthenticationSessionRecord
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .authenticate(
        input,
      )
      .pipe(

        tap(
          session => {
            this.sessionStore.write(session);
          },
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

  assignRole(
    identityId:
      string,

    input:
      AssignRoleInput,
  ):
    Observable<
      RoleAssignmentRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .assignRole(
        identityId,
        input,
      )
      .pipe(

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

  /**
   * Client-side session cleanup.
   *
   * The report currently does not define a logout
   * endpoint, so we do not fabricate one.
   *
   * If backend later exposes session revocation,
   * logout can become a Gateway operation.
   */
  clearSession():
    void {

    this.sessionStore.clear();

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
