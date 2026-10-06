import {
  Injectable,
} from '@angular/core';

import {
  Observable,
  delay,
  of,
} from 'rxjs';

import { BuildingStoreService } from '../../../core/services/building-store.service';
import { Device, Space } from '../../../core/models/resq.models';

import {
  BuildingMonitoringStatus,
  CurrentMeasurementsQuery,
  DeviceAvailability,
  DeviceMonitoringState,
  MeasurementTimeRange,
  MonitoringGateway,
  MonitoringMeasurement,
  ZoneMonitoringState,
} from './monitoring.gateway';

@Injectable()
export class MockMonitoringGateway
  implements MonitoringGateway {

  constructor(private readonly store: BuildingStoreService) {}

  getBuildingStatus(
    buildingId: string,
  ):
    Observable<
      BuildingMonitoringStatus
      | undefined
    > {

    const building =
      this.store.buildings().find(
        item =>
          item.id ===
          buildingId,
      );

    if (!building) {

      return of(
        undefined,
      ).pipe(
        delay(80),
      );
    }

    const zones =
      this.store.spaces()
        .filter(
          space =>
            space.buildingId ===
            buildingId,
        )
        .map(
          space =>
            toZoneMonitoringState(
              space.id,
              this.store.spaces(),
              this.store.devices(),
            ),
        )
        .filter(
          (
            state,
          ): state is
            ZoneMonitoringState =>
              state !== undefined,
        );

    const devices =
      this.store.devices().filter(
        device =>
          device.assignment
            .buildingId ===
          buildingId,
      );

    const availability =
      devices.map(
        device =>
          toAvailability(
            device.connectivityStatus,
          ),
      );

    return of({
      buildingId,

      lastUpdatedAt:
        resolveLatestDate(
          [
            ...zones.map(
              zone =>
                zone.lastUpdatedAt,
            ),

            ...devices.map(
              device =>
                new Date(
                  device.updatedAt,
                ),
            ),
          ],
        ),

      zones,

      availableDevices:
        availability.filter(
          status =>
            status ===
            'AVAILABLE',
        ).length,

      unavailableDevices:
        availability.filter(
          status =>
            status ===
            'UNAVAILABLE',
        ).length,

      unknownDevices:
        availability.filter(
          status =>
            status ===
            'UNKNOWN',
        ).length,
    }).pipe(
      delay(100),
    );
  }

  getZoneStatus(
    zoneId: string,
  ):
    Observable<
      ZoneMonitoringState
      | undefined
    > {

    return of(
      toZoneMonitoringState(
        zoneId,
        this.store.spaces(),
        this.store.devices(),
      ),
    ).pipe(
      delay(70),
    );
  }

  getDeviceStatus(
    deviceId: string,
  ):
    Observable<
      DeviceMonitoringState
      | undefined
    > {

    const device =
      this.store.devices().find(
        item =>
          item.id ===
          deviceId,
      );

    if (!device) {

      return of(
        undefined,
      ).pipe(
        delay(60),
      );
    }

    const measurements =
      toDeviceMeasurements(
        device.id,
        this.store.devices(),
      );

    const latestMeasurement =
      measurements.at(
        -1,
      );

    return of({
      deviceId:
        device.id,

      zoneId:
        device.assignment
          .zoneId,

      availability:
        toAvailability(
          device
            .connectivityStatus,
        ),

      lastMeasurementAt:
        latestMeasurement
          ?.measuredAt,

      updatedAt:
        latestMeasurement
          ?.measuredAt ??
        new Date(
          device.updatedAt,
        ),
    }).pipe(
      delay(70),
    );
  }

  getCurrentMeasurements(
    query:
      CurrentMeasurementsQuery,
  ):
    Observable<
      MonitoringMeasurement[]
    > {

    if (
      query.deviceId
    ) {

      const measurements =
        toDeviceMeasurements(
          query.deviceId,
          this.store.devices(),
        );

      return of(
        latestByVariable(
          measurements,
        ),
      ).pipe(
        delay(70),
      );
    }

    if (
      query.zoneId
    ) {

      const deviceIds =
        this.store.devices()
          .filter(
            device =>
              device.assignment
                .zoneId ===
              query.zoneId,
          )
          .map(
            device =>
              device.id,
          );

      const measurements =
        deviceIds.flatMap(
          deviceId =>
            toDeviceMeasurements(
              deviceId,
              this.store.devices(),
            ),
        );

      return of(
        latestByVariable(
          measurements,
        ),
      ).pipe(
        delay(70),
      );
    }

    return of(
      [],
    ).pipe(
      delay(40),
    );
  }

  getDeviceMeasurements(
    deviceId: string,

    range?:
      MeasurementTimeRange,
  ):
    Observable<
      MonitoringMeasurement[]
    > {

    let measurements =
      toDeviceMeasurements(
        deviceId,
        this.store.devices(),
      );

    if (range) {

      const from =
        range.from.getTime();

      const to =
        range.to.getTime();

      measurements =
        measurements.filter(
          measurement => {

            const timestamp =
              measurement
                .measuredAt
                .getTime();

            return (
              timestamp >= from &&
              timestamp <= to
            );
          },
        );
    }

    return of(
      measurements,
    ).pipe(
      delay(80),
    );
  }
}

function toDeviceMeasurements(
  deviceId: string,
  devices: Device[],
):
  MonitoringMeasurement[] {

  const device =
    devices.find(
      item =>
        item.id ===
        deviceId,
    );

  if (!device) {
    return [];
  }

  return device.readings
    .map(
      reading => {

        const measuredAt =
          new Date(
            reading.timestamp,
          );

        /*
         * The current frontend mock does not
         * distinguish measuredAt from recordedAt.
         * For the mock adapter they are equivalent.
         * The future HTTP mapper must preserve both
         * timestamps independently when backend
         * provides them.
         */
        return {
          measurementId:
            reading.id,

          deviceId:
            device.id,

          buildingId:
            device.assignment
              .buildingId,

          zoneId:
            device.assignment
              .zoneId,

          variableType:
            reading.metric,

          measurementValue: {
            value:
              reading.value,

            unit:
              reading.unit,
          },

          measuredAt,

          recordedAt:
            new Date(
              measuredAt,
            ),
        };
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.measuredAt
          .getTime() -
        right.measuredAt
          .getTime(),
    );
}

function toZoneMonitoringState(
  zoneId: string,
  spaces: Space[],
  allDevices: Device[],
):
  ZoneMonitoringState
  | undefined {

  const space =
    spaces.find(
      item =>
        item.id ===
        zoneId,
    );

  if (!space) {
    return undefined;
  }

  const devices =
    allDevices.filter(
      device =>
        device.assignment
          .zoneId ===
        zoneId,
    );

  const observationDates =
    devices.flatMap(
      device => [

        ...device.readings.map(
          reading =>
            new Date(
              reading.timestamp,
            ),
        ),

        new Date(
          device.updatedAt,
        ),
      ],
    );

  return {
    zoneId:
      space.id,

    buildingId:
      space.buildingId,

    lastUpdatedAt:
      resolveLatestDate(
        observationDates,
      ),

    /*
     * BuildingStore exposes the Risk Detection projection. Monitoring only
     * reads that classified state and never repeats threshold comparisons.
     */
    conditionCode:
      normalizeConditionCode(
        space.status,
      ),
  };
}

function latestByVariable(
  measurements:
    MonitoringMeasurement[],
):
  MonitoringMeasurement[] {

  const latest =
    new Map<
      string,
      MonitoringMeasurement
    >();

  for (
    const measurement
    of measurements
  ) {

    const key =
      `${measurement.deviceId}:` +
      measurement.variableType;

    const current =
      latest.get(
        key,
      );

    if (
      !current ||
      measurement
        .measuredAt
        .getTime() >
      current
        .measuredAt
        .getTime()
    ) {

      latest.set(
        key,
        measurement,
      );
    }
  }

  return Array.from(
    latest.values(),
  ).sort(
    (
      left,
      right,
    ) =>
      right.measuredAt
        .getTime() -
      left.measuredAt
        .getTime(),
  );
}

function toAvailability(
  connectivityStatus:
    'ONLINE'
    | 'OFFLINE',
):
  DeviceAvailability {

  switch (
    connectivityStatus
  ) {

    case 'ONLINE':
      return 'AVAILABLE';

    case 'OFFLINE':
      return 'UNAVAILABLE';

    default:
      return 'UNKNOWN';
  }
}

function normalizeConditionCode(
  status: string,
): string {

  return status
    .trim()
    .replace(
      /\s+/g,
      '_',
    )
    .toUpperCase();
}

function resolveLatestDate(
  dates:
    Date[],
): Date {

  if (!dates.length) {

    return new Date(
      0,
    );
  }

  return new Date(
    Math.max(
      ...dates.map(
        date =>
          date.getTime(),
      ),
    ),
  );
}
