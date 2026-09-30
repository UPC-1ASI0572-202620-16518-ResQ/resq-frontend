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
  PagedResult,
  PageRequest,
} from '../../../core/api/pagination';

import {
  AssignDeviceToLocationResourceDto,
  ChangeDeviceAdministrativeStatusResourceDto,
  RegisterDeviceResourceDto,
  ReplaceDeviceCapabilitiesResourceDto,
  UpdateDeviceDetailsResourceDto,
} from './device.dto';

import {
  DEVICE_GATEWAY,
  DeviceCatalogRecord,
  DeviceGateway,
  DeviceQueryFilters,
  ExternalDeviceReferenceQuery,
  VersionedDeviceCatalogRecord,
} from './device.gateway';

const EMPTY_PAGE:
  PagedResult<DeviceCatalogRecord> = {

  items: [],

  page: 0,

  size: 20,

  totalElements: 0,

  totalPages: 0,
};

@Injectable()
export class DeviceFacade {

  private readonly pageState =
    signal<
      PagedResult<DeviceCatalogRecord>
    >(
      EMPTY_PAGE,
    );

  private readonly selectedState =
    signal<
      VersionedDeviceCatalogRecord
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

  readonly page =
    this.pageState
      .asReadonly();

  readonly devices =
    computed(
      () =>
        this.pageState()
          .items,
    );

  readonly selected =
    computed(
      () =>
        this.selectedState()
          ?.device,
    );

  readonly selectedEtag =
    computed(
      () =>
        this.selectedState()
          ?.etag,
    );

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
      DEVICE_GATEWAY,
    )

    private readonly gateway:
      DeviceGateway,
  ) {}

  loadDevices(
    filters:
      DeviceQueryFilters = {},

    page:
      PageRequest = {
        page: 0,
        size: 20,
      },
  ):
    Observable<
      PagedResult<DeviceCatalogRecord>
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .getDevices(
        filters,
        page,
      )
      .pipe(

        tap(
          result =>
            this.pageState.set(
              result,
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

  loadDevice(
    deviceId: string,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .getDeviceById(
        deviceId,
      )
      .pipe(

        tap(
          result =>
            this.selectedState.set(
              result,
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

  loadByExternalReference(
    reference:
      ExternalDeviceReferenceQuery,
  ):
    Observable<
      VersionedDeviceCatalogRecord
      | undefined
    > {

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return this.gateway
      .getDeviceByExternalReference(
        reference,
      )
      .pipe(

        tap(
          result =>
            this.selectedState.set(
              result,
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

  registerDevice(
    resource:
      RegisterDeviceResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    return this.mutate(
      this.gateway
        .registerDevice(
          resource,
        ),
    );
  }

  updateDeviceDetails(
    resource:
      UpdateDeviceDetailsResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .updateDeviceDetails(

          selected.device.id,

          resource,

          selected.etag,
        ),
    );
  }

  replaceDeviceCapabilities(
    resource:
      ReplaceDeviceCapabilitiesResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .replaceDeviceCapabilities(

          selected.device.id,

          resource,

          selected.etag,
        ),
    );
  }

  assignDeviceToLocation(
    resource:
      AssignDeviceToLocationResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .assignDeviceToLocation(

          selected.device.id,

          resource,

          selected.etag,
        ),
    );
  }

  changeAdministrativeStatus(
    resource:
      ChangeDeviceAdministrativeStatusResourceDto,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    const selected =
      this.requireSelected();

    return this.mutate(

      this.gateway
        .changeDeviceAdministrativeStatus(

          selected.device.id,

          resource,

          selected.etag,
        ),
    );
  }

  clearError(): void {

    this.errorState.set(
      undefined,
    );
  }

  clearSelected(): void {

    this.selectedState.set(
      undefined,
    );
  }

  canEditDetails(
    device:
      DeviceCatalogRecord,
  ): boolean {

    return (
      device.administrativeStatus !==
      'RETIRED'
    );
  }

  canChangeCapabilities(
    device:
      DeviceCatalogRecord,
  ): boolean {

    return (
      device.administrativeStatus ===
      'INACTIVE'
    );
  }

  canChangeAssignment(
    device:
      DeviceCatalogRecord,
  ): boolean {

    return (
      device.administrativeStatus ===
      'INACTIVE'
    );
  }

  canActivate(
    device:
      DeviceCatalogRecord,
  ): boolean {

    return (
      device.administrativeStatus ===
      'INACTIVE'
    );
  }

  canDeactivate(
    device:
      DeviceCatalogRecord,
  ): boolean {

    return (
      device.administrativeStatus ===
      'ACTIVE'
    );
  }

  canRetire(
    device:
      DeviceCatalogRecord,
  ): boolean {

    return (
      device.administrativeStatus ===
      'INACTIVE'
    );
  }

  private mutate(
    operation:
      Observable<
        VersionedDeviceCatalogRecord
      >,
  ):
    Observable<
      VersionedDeviceCatalogRecord
    > {

    this.savingState.set(
      true,
    );

    this.errorState.set(
      undefined,
    );

    return operation.pipe(

      tap(
        result => {

          this.selectedState.set(
            result,
          );

          this.replacePageItem(
            result.device,
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

  private replacePageItem(
    device:
      DeviceCatalogRecord,
  ): void {

    this.pageState.update(
      page => ({

        ...page,

        items:
          page.items.map(
            item =>
              item.id ===
              device.id
                ? device
                : item,
          ),
      }),
    );
  }

  private requireSelected(): {
    device:
      DeviceCatalogRecord;

    etag:
      string;
  } {

    const selected =
      this.selectedState();

    if (
      !selected
    ) {

      throw new Error(
        'A device must be loaded before it can be modified.',
      );
    }

    if (
      !selected.etag
    ) {

      throw <ApiError>{
        status: 428,

        code:
          'PRECONDITION_REQUIRED',

        message:
          'The latest device version is required before making changes.',

        fieldErrors: [],
      };
    }

    return {
      device:
        selected.device,

      etag:
        selected.etag,
    };
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