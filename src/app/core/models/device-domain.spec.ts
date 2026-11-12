import { capabilityCategory, capabilityDefinition } from './device-domain';

describe('device capability classification regression', () => {
  it('classifies an OLED with uppercase backend capability as DISPLAY', () => {
    expect(capabilityCategory({ code: 'LOCAL_STATUS_DISPLAY', kind: 'ACTUATION' })).toBe('DISPLAY');
    expect(capabilityDefinition('local_status_display')?.type).toBe('OLED');
  });

  it('classifies uppercase actuator capabilities as ACTUATOR', () => {
    expect(capabilityCategory({ code: 'AUDIBLE_ALARM', kind: 'ACTUATION' })).toBe('ACTUATOR');
    expect(capabilityCategory({ code: 'ENVIRONMENTAL_VENTILATION', kind: 'ACTUATION' })).toBe('ACTUATOR');
  });

  it('keeps measurement capabilities in SENSOR regardless of letter case', () => {
    expect(capabilityCategory({ code: 'GAS_PPM', kind: 'MEASUREMENT' })).toBe('SENSOR');
    expect(capabilityCategory({ code: 'GAS_MEASUREMENT', kind: 'MEASUREMENT' })).toBe('SENSOR');
  });
});
