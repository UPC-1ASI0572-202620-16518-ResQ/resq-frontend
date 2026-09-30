import {
  Injectable,
} from '@angular/core';

import {
  Observable,
  delay,
  of,
} from 'rxjs';

import {
  DEVICES,
} from '../../../core/mock-data/resq.mock';

import {
  ConnectivityGateway,
  DeviceConnectionState,
} from './connectivity.gateway';

@Injectable()
export class MockConnectivityGateway
  implements ConnectivityGateway {

  getDeviceConnectionStatus(
    deviceId: string,
  ):
    Observable<
      DeviceConnectionState
      | undefined
    > {

    const device =
      DEVICES.find(
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

    return of(
      toConnectionState(
        device,
      ),
    ).pipe(
      delay(60),
    );
  }

  getOfflineDevices():
    Observable<
      DeviceConnectionState[]
    > {

    const devices =
      DEVICES
        .filter(
          device =>
            device.connectivityStatus ===
            'OFFLINE',
        )
        .map(
          toConnectionState,
        );

    return of(
      devices,
    ).pipe(
      delay(80),
    );
  }
}

function toConnectionState(
  device:
    (typeof DEVICES)[number],
):
  DeviceConnectionState {

  return {
    deviceId:
      device.id,

    status:
      device.connectivityStatus,

    lastHeartbeatAt:
      new Date(
        device.lastSeen,
      ),

    signalStrength:
      device.signalStrength,
  };
}