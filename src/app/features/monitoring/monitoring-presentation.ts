import { MonitoringMeasurement } from './data-access/monitoring.gateway';

export const ENVIRONMENTAL_VARIABLES = ['TEMPERATURE_C', 'HUMIDITY', 'GAS_ADC'] as const;

export type EnvironmentalVariable = typeof ENVIRONMENTAL_VARIABLES[number];

const VARIABLE_LABELS: Record<string, string> = {
  ALERT_FLAG: 'Bandera del firmware',
  GAS_ADC: 'Gas MQ-2',
  HUMIDITY: 'Humedad',
  MOTION: 'Movimiento PIR',
  TEMPERATURE_C: 'Temperatura',
  WIFI_RSSI: 'Intensidad Wi-Fi',
};

const EXPECTED_UNITS: Partial<Record<string, string>> = {
  ALERT_FLAG: 'BOOLEAN',
  GAS_ADC: 'ADC',
  HUMIDITY: 'PERCENT',
  MOTION: 'BOOLEAN',
  TEMPERATURE_C: 'C',
  WIFI_RSSI: 'DBM',
};

const DISPLAY_UNITS: Record<string, string> = {
  ADC: 'ADC',
  BOOLEAN: '',
  C: '°C',
  DBM: 'dBm',
  PERCENT: '%',
};

export function monitoringVariableLabel(variableType: string): string {
  const normalized = normalize(variableType);
  return VARIABLE_LABELS[normalized]
    ?? normalized.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

export function monitoringUnitLabel(variableType: string, unit: string): string {
  const normalizedUnit = normalize(unit);
  const expectedUnit = EXPECTED_UNITS[normalize(variableType)];
  if (expectedUnit && normalizedUnit !== expectedUnit) return unit;
  return DISPLAY_UNITS[normalizedUnit] ?? unit;
}

export function monitoringValueLabel(variableType: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Sin lectura';

  switch (normalize(variableType)) {
    case 'ALERT_FLAG':
      return value === 1 ? 'Activa' : value === 0 ? 'Normal' : 'Lectura no válida';
    case 'MOTION':
      return value === 1 ? 'Detectado' : value === 0 ? 'Sin movimiento' : 'Lectura no válida';
    case 'HUMIDITY':
    case 'TEMPERATURE_C':
      return value.toFixed(1);
    default:
      return String(value);
  }
}

export function latestMeasurementsByVariable(
  measurements: readonly MonitoringMeasurement[],
): MonitoringMeasurement[] {
  const latest = new Map<string, MonitoringMeasurement>();
  [...measurements]
    .sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())
    .forEach((measurement) => {
      const variable = normalize(measurement.variableType);
      if (!latest.has(variable)) latest.set(variable, measurement);
    });
  return [...latest.values()];
}

export function isMeasurementFresh(
  measurement: MonitoringMeasurement,
  now = Date.now(),
  maximumAgeMs = 120_000,
): boolean {
  const measuredAt = measurement.measuredAt.getTime();
  return Number.isFinite(measuredAt) && now - measuredAt <= maximumAgeMs;
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}
