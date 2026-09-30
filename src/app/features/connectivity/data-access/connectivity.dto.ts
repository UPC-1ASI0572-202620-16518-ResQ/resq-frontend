export type ConnectionStatusDto =
  | 'ONLINE'
  | 'OFFLINE'
  | 'TIMEOUT';

export interface SensorConnectionResourceDto {
  sensorId: string;

  status: ConnectionStatusDto;

  lastHeartbeatTime: string;

  signalStrength?: number | null;
}