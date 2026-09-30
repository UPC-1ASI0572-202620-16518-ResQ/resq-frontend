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
  ConfigureDetectionRuleInput,
  DetectionRuleRecord,
  RISK_DETECTION_GATEWAY,
  RiskDetectionGateway,
  RiskDetectionRecord,
} from './risk-detection.gateway';

@Injectable()
export class RiskDetectionFacade {

  private readonly selectedDetectionState =
    signal<
      RiskDetectionRecord
      | undefined
    >(
      undefined,
    );

  private readonly evidenceState =
    signal<
      RiskDetectionRecord
      | undefined
    >(
      undefined,
    );

  private readonly selectedRuleState =
    signal<
      DetectionRuleRecord
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

  readonly selectedDetection =
    this.selectedDetectionState
      .asReadonly();

  readonly evidence =
    this.evidenceState
      .asReadonly();

  readonly selectedRule =
    this.selectedRuleState
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
      RISK_DETECTION_GATEWAY,
    )

    private readonly gateway:
      RiskDetectionGateway,
  ) {}

  loadRiskDetection(
    riskDetectionId:
      string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getRiskDetectionById(
        riskDetectionId,
      )
      .pipe(

        tap(
          detection =>
            this.selectedDetectionState.set(
              detection,
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

  loadRiskDetectionEvidence(
    riskDetectionId:
      string,
  ):
    Observable<
      RiskDetectionRecord
      | undefined
    > {

    this.beginLoad();

    return this.gateway
      .getRiskDetectionEvidence(
        riskDetectionId,
      )
      .pipe(

        tap(
          detection =>
            this.evidenceState.set(
              detection,
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

  configureDetectionRule(
    input:
      ConfigureDetectionRuleInput,
  ):
    Observable<
      DetectionRuleRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .configureDetectionRule(
        input,
      )
      .pipe(

        tap(
          rule =>
            this.selectedRuleState.set(
              rule,
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

  changeDetectionRuleStatus(
    ruleId: string,

    active: boolean,
  ):
    Observable<
      DetectionRuleRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .changeDetectionRuleStatus(
        ruleId,
        active,
      )
      .pipe(

        tap(
          rule =>
            this.selectedRuleState.set(
              rule,
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

  clearSelected():
    void {

    this.selectedDetectionState.set(
      undefined,
    );

    this.evidenceState.set(
      undefined,
    );

    this.selectedRuleState.set(
      undefined,
    );
  }

  clearError():
    void {

    this.errorState.set(
      undefined,
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