import {
  SensorConnectionResourceDto,
} from './connectivity.dto';

import {
  DeviceConnectionState,
} from './connectivity.gateway';

export function mapSensorConnectionResourceDto(
  dto:
    SensorConnectionResourceDto,
):
  DeviceConnectionState {

  return {
    deviceId:
      dto.sensorId,

    status:
      dto.status,

    lastHeartbeatAt:
      new Date(
        dto.lastHeartbeatTime,
      ),

    signalStrength:
      dto.signalStrength ??
      undefined,
  };
}