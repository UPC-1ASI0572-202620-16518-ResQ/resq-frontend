import {
  Inject,
  Injectable,
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
  ALERT_RESPONSE_GATEWAY,
  AlertQueryFilters,
  AlertRecord,
  AlertResponseGateway,
  AuthorizationDecision,
  ConfigureResponsePolicyInput,
  ResponseExecutionQueryFilters,
  ResponseExecutionRecord,
  ResponsePolicyRecord,
  UpdateResponsePolicyInput,
} from './alert.gateway';

@Injectable()
export class AlertFacade {

  private readonly alertsState =
    signal<
      AlertRecord[]
    >(
      [],
    );

  private readonly selectedAlertState =
    signal<
      AlertRecord
      | undefined
    >(
      undefined,
    );

  private readonly executionsState =
    signal<
      ResponseExecutionRecord[]
    >(
      [],
    );

  private readonly selectedExecutionState =
    signal<
      ResponseExecutionRecord
      | undefined
    >(
      undefined,
    );

  private readonly selectedPolicyState =
    signal<
      ResponsePolicyRecord
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

  readonly alerts =
    this.alertsState
      .asReadonly();

  readonly selectedAlert =
    this.selectedAlertState
      .asReadonly();

  readonly responseExecutions =
    this.executionsState
      .asReadonly();

  readonly selectedExecution =
    this.selectedExecutionState
      .asReadonly();

  readonly selectedPolicy =
    this.selectedPolicyState
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

  constructor(

    @Inject(
      ALERT_RESPONSE_GATEWAY,
    )

    private readonly gateway:
      AlertResponseGateway,
  ) {}

  loadAlerts(
    filters:
      AlertQueryFilters = {},
  ):
    Observable<
      AlertRecord[]
    > {

    this.beginLoad();

    return this.gateway
      .getAlerts(
        filters,
      )
      .pipe(

        tap(
          alerts =>
            this.alertsState.set(
              alerts,
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
            this.endLoad(),
        ),
      );
  }

  loadAlert(
    alertId: string,
  ):
    Observable<
      AlertRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getAlertById(
        alertId,
      )
      .pipe(

        tap(
          alert =>
            this.selectedAlertState.set(
              alert,
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
            this.endLoad(),
        ),
      );
  }

  loadResponseExecutions(
    filters:
      ResponseExecutionQueryFilters = {},
  ):
    Observable<
      ResponseExecutionRecord[]
    > {

    this.beginLoad();

    return this.gateway
      .getResponseExecutions(
        filters,
      )
      .pipe(

        tap(
          executions =>
            this.executionsState.set(
              executions,
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
            this.endLoad(),
        ),
      );
  }

  loadResponseExecution(
    responseExecutionId:
      string,
  ):
    Observable<
      ResponseExecutionRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getResponseExecutionById(
        responseExecutionId,
      )
      .pipe(

        tap(
          execution =>
            this.selectedExecutionState.set(
              execution,
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
            this.endLoad(),
        ),
      );
  }

  decideAuthorization(
    responseExecutionId:
      string,

    decision:
      AuthorizationDecision,
  ):
    Observable<
      ResponseExecutionRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .decideResponseAuthorization(
        responseExecutionId,
        decision,
      )
      .pipe(

        tap(
          execution => {

            this.selectedExecutionState.set(
              execution,
            );

            this.executionsState.update(
              items =>
                items.map(
                  item =>
                    item
                      .responseExecutionId ===
                      execution
                        .responseExecutionId
                      ? execution
                      : item,
                ),
            );
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
            this.savingState.set(
              false,
            ),
        ),
      );
  }

  loadResponsePolicy(
    policyId: string,
  ):
    Observable<
      ResponsePolicyRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getResponsePolicy(
        policyId,
      )
      .pipe(

        tap(
          policy =>
            this.selectedPolicyState.set(
              policy,
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
            this.endLoad(),
        ),
      );
  }

  configureResponsePolicy(
    input:
      ConfigureResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    return this.mutatePolicy(
      this.gateway
        .configureResponsePolicy(
          input,
        ),
    );
  }

  updateResponsePolicy(
    policyId: string,

    input:
      UpdateResponsePolicyInput,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    return this.mutatePolicy(
      this.gateway
        .updateResponsePolicy(
          policyId,
          input,
        ),
    );
  }

  changeResponsePolicyStatus(
    policyId: string,

    active: boolean,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    return this.mutatePolicy(
      this.gateway
        .changeResponsePolicyStatus(
          policyId,
          active,
        ),
    );
  }

  canDecideAuthorization(
    execution:
      ResponseExecutionRecord,
  ): boolean {

    return (
      execution
        .action
        .authorizationMode ===
        'HUMAN_REQUIRED' &&
      execution.status ===
        'PENDING_AUTHORIZATION' &&
      !execution.authorization
    );
  }

  clearError(): void {

    this.errorState.set(
      undefined,
    );
  }

  clearSelectedAlert(): void {

    this.selectedAlertState.set(
      undefined,
    );
  }

  clearSelectedExecution():
    void {

    this.selectedExecutionState.set(
      undefined,
    );
  }

  private mutatePolicy(
    operation:
      Observable<
        ResponsePolicyRecord
      >,
  ):
    Observable<
      ResponsePolicyRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return operation.pipe(

      tap(
        policy =>
          this.selectedPolicyState.set(
            policy,
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

  private beginLoad():
    void {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );
  }

  private endLoad():
    void {

    this.loadingState.set(
      false,
    );
  }

  private fail(
    error: unknown,
  ):
    Observable<never> {

    const apiError:
      ApiError =
      isApiError(
        error,
      )
        ? error
        : {
            status: 0,

            code:
              'CLIENT_ERROR',

            message:
              error instanceof Error
                ? error.message
                : 'An unexpected client error occurred.',

            fieldErrors: [],

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