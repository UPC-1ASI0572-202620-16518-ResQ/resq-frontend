import { ResponseRule } from '../models/resq.models';

/** Initial templates. Custom rules are scoped to a concrete sensor and concrete targets. */
export const INITIAL_RESPONSE_RULES: ResponseRule[] = [
  {
    id: 'temperature-hvac',
    sensor: 'Temperature',
    operator: '>=',
    actuatorCapabilities: ['environmental_ventilation'],
    condition: 'Temperature reaches area warning threshold',
    enabled: true,
  },
  {
    id: 'smoke-alarm-light',
    sensor: 'Smoke',
    operator: '>=',
    actuatorCapabilities: ['audible_alarm', 'visual_status_signaling', 'critical_status_indicator'],
    condition: 'Smoke reaches area warning threshold',
    enabled: true,
  },
  {
    id: 'gas-alarm-hvac',
    sensor: 'Gas',
    operator: '>=',
    actuatorCapabilities: [
      'audible_alarm',
      'environmental_ventilation',
      'visual_status_signaling',
      'critical_status_indicator',
    ],
    condition: 'Gas reaches area warning threshold',
    enabled: true,
  },
  {
    id: 'humidity-hvac',
    sensor: 'Humidity',
    operator: '>=',
    actuatorCapabilities: ['environmental_ventilation'],
    condition: 'Humidity reaches area warning threshold',
    enabled: true,
  },
  {
    id: 'motion-security',
    sensor: 'Motion',
    operator: '>',
    threshold: 0,
    actuatorCapabilities: ['audible_alarm', 'visual_status_signaling'],
    condition: 'Zone security response',
    enabled: false,
  },
];
