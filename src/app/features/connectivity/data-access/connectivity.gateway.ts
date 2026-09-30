import {
  InjectionToken,
} from '@angular/core';

import {
  Observable,
} from 'rxjs';

export type ConnectionStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'TIMEOUT';

export interface DeviceConnectionState {
  deviceId: string;

  status:
    ConnectionStatus;

  lastHeartbeatAt:
    Date;

  signalStrength?: number;
}

export interface ConnectivityGateway {

  getDeviceConnectionStatus(
    deviceId: string,
  ):
    Observable<
      DeviceConnectionState
      | undefined
    >;

  getOfflineDevices():
    Observable<
      DeviceConnectionState[]
    >;
}

export const CONNECTIVITY_GATEWAY =
  new InjectionToken<ConnectivityGateway>(
    'CONNECTIVITY_GATEWAY',
  );