import { capabilityDefinition } from '../../core/models/device-domain';

export function capabilityLabel(code: string): string {
  const known: Record<string, string> = {
    ALERT_FLAG: 'Firmware Alert Flag',
    GAS_ADC: 'Gas MQ-2 (raw ADC)',
    HUMIDITY: 'Humidity',
    MOTION: 'PIR Motion',
    TEMPERATURE_C: 'Temperature',
    WIFI_RSSI: 'Wi-Fi Signal Strength',
    gas_smoke_level: 'Gas / Smoke Level',
    local_status_display: 'Local Status Display',
    audible_alarm: 'Audible Alarm',
    critical_status_indicator: 'Critical Status Indicator',
    normal_status_indicator: 'Normal Status Indicator',
  };
  return known[code] ?? known[code.toUpperCase()] ?? capabilityDefinition(code)?.label ?? code.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

export function capabilityHardware(code: string): string {
  const known: Record<string, string> = {
    ALERT_FLAG: 'ESP32 firmware state',
    GAS_ADC: 'MQ-2 gas sensor',
    HUMIDITY: 'DHT22 humidity sensor',
    MOTION: 'PIR motion sensor',
    TEMPERATURE_C: 'DHT22 temperature sensor',
    WIFI_RSSI: 'ESP32 Wi-Fi radio',
    gas_smoke_level: 'MQ-2 gas/smoke sensor',
    local_status_display: 'SSD1306 OLED display',
    audible_alarm: 'Active buzzer',
    critical_status_indicator: 'Red status LED',
    normal_status_indicator: 'Green status LED',
  };
  return known[code] ?? known[code.toUpperCase()] ?? capabilityDefinition(code)?.hardware ?? 'Registered device capability';
}

export function riskTypeLabel(code: string): string {
  const known: Record<string, string> = {
    GAS_LEAK: 'Gas Leak',
    FIRE: 'Fire',
    EARTHQUAKE: 'Earthquake',
  };
  return known[code] ?? code.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}
