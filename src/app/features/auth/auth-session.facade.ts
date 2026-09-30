import {
  Injectable,
  computed,
  inject,
} from '@angular/core';

import {
  Observable,
  catchError,
  of,
  switchMap,
  throwError,
} from 'rxjs';

import {
  UserFacade,
} from '../users/data-access/user.facade';

import {
  UserProfileRecord,
} from '../users/data-access/user.gateway';

import {
  IamFacade,
} from './data-access/iam.facade';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionFacade {

  private readonly iam =
    inject(
      IamFacade,
    );

  private readonly user =
    inject(
      UserFacade,
    );

  readonly authenticated =
    this.iam.authenticated;

  readonly identityId =
    this.iam.identityId;

  readonly profile =
    this.user.profile;

  readonly fullName =
    this.user.fullName;

  readonly email =
    this.user.email;

  readonly loading =
    computed(
      () =>
        this.iam.loading() ||
        this.user.loading(),
    );

  readonly error =
    computed(
      () =>
        this.iam.error() ??
        this.user.error(),
    );

  signIn(
    loginIdentifier: string,
    credentialSecret: string,
  ):
    Observable<
      UserProfileRecord
      | undefined
    > {

    this.clearError();

    return this.iam
      .authenticate({
        loginIdentifier,
        credentialSecret,
      })
      .pipe(

        switchMap(
          () =>
            this.user
              .loadMyProfile(),
        ),

        catchError(
          error => {

            /*
             * Avoid leaving the frontend in a
             * partially authenticated state when
             * authentication succeeds but profile
             * loading fails.
             */
            this.iam
              .clearSession();

            this.user
              .clearProfile();

            return throwError(
              () =>
                error,
            );
          },
        ),
      );
  }

  ensureProfileLoaded():
    Observable<
      UserProfileRecord
      | undefined
    > {

    const current =
      this.user.profile();

    if (current) {

      return of(
        current,
      );
    }

    /*
     * This also supports a future backend session
     * restored through cookies or another
     * server-authoritative session mechanism.
     *
     * We deliberately do not assume JWT/Bearer
     * persistence until IAM's final backend
     * contract is defined.
     */
    return this.user
      .loadMyProfile();
  }

  signOut():
    void {

    /*
     * Client-side cleanup only.
     *
     * No backend logout/session-revocation endpoint
     * is fabricated here.
     */
    this.iam
      .clearSession();

    this.user
      .clearProfile();
  }

  clearError():
    void {

    this.iam
      .clearError();

    this.user
      .clearError();
  }
}