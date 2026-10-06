import { capabilityCategory, sensorThreshold, matchesCondition } from './device-domain';
import {
  Device,
  MetricThreshold,
  ResponseRule,
  ResponseTarget,
  RiskStatus,
  Space,
  riskRank,
} from './resq.models';

export interface RuleMatch {
  sourceDeviceId: string;
  ruleId: string;
  targets: ResponseTarget[];
}
export interface ZoneEvaluation {
  devices: Device[];
  matches: RuleMatch[];
  risk: RiskStatus;
}

/** All active conditions are aggregated before changing any output. */
export function evaluateZone(
  space: Space,
  devices: Device[],
  rules: ResponseRule[],
  evaluateMetric: (value: number, threshold?: MetricThreshold) => RiskStatus,
): ZoneEvaluation {
  const matches: RuleMatch[] = [];
  let zoneRisk: RiskStatus = 'Normal';
  const evaluated = devices.map((device) => {
    if (!device.capabilities.some((cap) => capabilityCategory(cap) === 'SENSOR')) return device;
    const reading = device.readings.at(-1);
    const available =
      device.connectivityStatus === 'ONLINE' && device.administrativeStatus === 'ACTIVE';
    const configured = rules.filter((rule) => rule.sourceDeviceId === device.id);
    const candidates = configured.length
      ? configured
      : rules.filter((rule) => !rule.sourceDeviceId && rule.sensor === reading?.metric);
    const threshold = sensorThreshold(device, space);
    let risk: RiskStatus = available ? 'Normal' : 'Offline';
    if (available && reading && reading.metric !== 'Motion')
      risk = evaluateMetric(reading.value, threshold);
    for (const rule of candidates) {
      const limit = rule.threshold ?? threshold?.warning;
      if (
        !available ||
        !reading ||
        !rule.enabled ||
        limit === undefined ||
        !matchesCondition(reading.value, rule.operator, limit)
      )
        continue;
      const targets =
        rule.targets ??
        devices.flatMap((target) =>
          target.capabilities
            .filter(
              (cap) =>
                capabilityCategory(cap) === 'ACTUATOR' &&
                rule.actuatorCapabilities.includes(cap.code),
            )
            .map((cap) => ({
              deviceId: target.id,
              capabilityCode: cap.code,
              action: 'ACTIVATE' as const,
            })),
        );
      matches.push({ sourceDeviceId: device.id, ruleId: rule.id, targets });
      if (risk === 'Normal') risk = 'Warning';
    }
    if (riskRank[risk] > riskRank[zoneRisk]) zoneRisk = risk;
    return {
      ...device,
      status: risk === 'Normal' ? ('Online' as const) : risk,
      healthStatus:
        risk === 'Critical'
          ? ('CRITICAL' as const)
          : risk === 'Warning'
            ? ('WARNING' as const)
            : ('NORMAL' as const),
    };
  });
  const requested = matches.flatMap((match) => match.targets);
  return {
    risk: zoneRisk,
    matches,
    devices: evaluated.map((device) => ({
      ...device,
      capabilities: device.capabilities.map((cap) => {
        const category = capabilityCategory(cap);
        if (category === 'SENSOR') return cap;
        if (device.connectivityStatus === 'OFFLINE') return { ...cap, state: 'ERROR' as const };
        if (category === 'DISPLAY')
          return {
            ...cap,
            state:
              zoneRisk === 'Critical'
                ? ('ALERT' as const)
                : zoneRisk === 'Warning'
                  ? ('WARNING' as const)
                  : ('NORMAL' as const),
          };
        if (cap.state === 'PLANNED' || device.availability === 'PLANNED')
          return { ...cap, state: 'PLANNED' as const };
        if (device.administrativeStatus !== 'ACTIVE') return { ...cap, state: 'INACTIVE' as const };
        const actions = requested.filter(
          (target) => target.deviceId === device.id && target.capabilityCode === cap.code,
        );
        if (cap.code === 'normal_status_indicator')
          return {
            ...cap,
            state: zoneRisk === 'Normal' ? ('ACTIVE' as const) : ('INACTIVE' as const),
          };
        if (cap.code === 'mechanical_servo')
          return {
            ...cap,
            state: actions.some((action) => action.action === 'CLOSE')
              ? ('CLOSED' as const)
              : actions.length
                ? ('OPEN' as const)
                : ('CLOSED' as const),
          };
        return { ...cap, state: actions.length ? ('ACTIVE' as const) : ('INACTIVE' as const) };
      }),
    })),
  };
}
