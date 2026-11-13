import { MonitoringMeasurement } from './data-access/monitoring.gateway';
import { capabilityHardware, capabilityLabel } from '../../shared/presentation/domain-labels';
import {
  isMeasurementFresh,
  latestMeasurementsByVariable,
  monitoringUnitLabel,
  monitoringValueLabel,
  monitoringVariableLabel,
} from './monitoring-presentation';

describe('Monitoring presentation', () => {
  it('maps the six ESP32 variables and their real units', () => {
    expect(monitoringVariableLabel('TEMPERATURE_C')).toBe('Temperatura');
    expect(monitoringVariableLabel('HUMIDITY')).toBe('Humedad');
    expect(monitoringVariableLabel('GAS_ADC')).toBe('Gas MQ-2');
    expect(monitoringVariableLabel('WIFI_RSSI')).toBe('Intensidad Wi-Fi');
    expect(monitoringVariableLabel('MOTION')).toBe('Movimiento PIR');
    expect(monitoringVariableLabel('ALERT_FLAG')).toBe('Bandera del firmware');
    expect(monitoringUnitLabel('TEMPERATURE_C', 'C')).toBe('°C');
    expect(monitoringUnitLabel('HUMIDITY', 'PERCENT')).toBe('%');
    expect(monitoringUnitLabel('GAS_ADC', 'ADC')).toBe('ADC');
    expect(monitoringUnitLabel('WIFI_RSSI', 'DBM')).toBe('dBm');
    expect(capabilityLabel('GAS_ADC')).toBe('Gas MQ-2 (raw ADC)');
    expect(capabilityHardware('MOTION')).toBe('PIR motion sensor');
  });

  it('does not confuse zero with a missing value', () => {
    expect(monitoringValueLabel('MOTION', 0)).toBe('Sin movimiento');
    expect(monitoringValueLabel('ALERT_FLAG', 0)).toBe('Normal');
    expect(monitoringValueLabel('GAS_ADC', 0)).toBe('0');
    expect(monitoringValueLabel('MOTION', null)).toBe('Sin lectura');
  });

  it('keeps the newest stored measurement for every variable', () => {
    const oldTemperature = measurement('old', 'TEMPERATURE_C', 20, '2026-11-12T10:00:00Z');
    const gas = measurement('gas', 'GAS_ADC', 480, '2026-11-12T10:00:10Z');
    const newTemperature = measurement('new', 'TEMPERATURE_C', 21, '2026-11-12T10:00:20Z');

    expect(latestMeasurementsByVariable([oldTemperature, gas, newTemperature]).map((item) => item.measurementId))
      .toEqual(['new', 'gas']);
  });

  it('marks measurements older than 120 seconds as stale', () => {
    const reading = measurement('temperature', 'TEMPERATURE_C', 20, '2026-11-12T10:00:00Z');
    expect(isMeasurementFresh(reading, new Date('2026-11-12T10:02:00Z').getTime())).toBe(true);
    expect(isMeasurementFresh(reading, new Date('2026-11-12T10:02:00.001Z').getTime())).toBe(false);
  });
});

function measurement(
  measurementId: string,
  variableType: string,
  value: number,
  measuredAt: string,
): MonitoringMeasurement {
  return {
    measurementId,
    deviceId: 'device-1',
    buildingId: 'building-1',
    variableType,
    measurementValue: { value, unit: variableType === 'GAS_ADC' ? 'ADC' : 'C' },
    measuredAt: new Date(measuredAt),
    recordedAt: new Date(measuredAt),
  };
}
