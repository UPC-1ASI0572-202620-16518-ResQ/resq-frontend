// Executable integration checks against the actual TypeScript domain and Angular services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
require('@angular/compiler');
const { createEnvironmentInjector, runInInjectionContext } = require('@angular/core');
const { firstValueFrom } = require('rxjs');
const { BuildingStoreService } = require('../src/app/core/services/building-store.service.ts');
const { SensorResponseService } = require('../src/app/core/services/sensor-response.service.ts');
const { RiskEvaluationService } = require('../src/app/core/services/risk-evaluation.service.ts');
const { DeviceService } = require('../src/app/core/services/data.services.ts');
const { RiskEventStoreService } = require('../src/app/core/services/risk-event-store.service.ts');
const {
  RiskDetectionSimulationService,
} = require('../src/app/features/risk-detection/risk-detection-simulation.service.ts');
const { DEVICE_CATALOG } = require('../src/app/core/models/resq.models.ts');
const {
  makeDevice,
  defaultThresholds,
  matchesCondition,
} = require('../src/app/core/models/device-domain.ts');
const {
  MockDeviceGateway,
} = require('../src/app/features/devices/data-access/mock-device.gateway.ts');
const { visualDevicePosition } = require('../src/app/shared/utils/floor-plan-device.utils.ts');
const injector = createEnvironmentInjector([
  BuildingStoreService,
  SensorResponseService,
  RiskEvaluationService,
  DeviceService,
]);
const store = injector.get(BuildingStoreService),
  response = injector.get(SensorResponseService),
  devices = injector.get(DeviceService);
const gateway = runInInjectionContext(injector, () => new MockDeviceGateway());
let checks = 0;
function check(label, callback) {
  callback();
  checks++;
  console.log(`PASS ${label}`);
}
check('Initial risk projection classifies the raw MQ-2 reading with its ADC threshold', () => {
  assert.equal(store.devices().find((item) => item.id === 'resq-mvp-001').status, 'Online');
});
const area = {
  id: 'qa-area',
  buildingId: 'science',
  floorId: 'science-f2',
  name: 'QA integration area',
  type: 'Laboratory',
  sensitivity: 'Normal',
  status: 'Normal',
  thresholds: defaultThresholds('Laboratory'),
  polygon: [
    { x: 20, y: 20 },
    { x: 400, y: 20 },
    { x: 400, y: 400 },
    { x: 20, y: 400 },
  ],
  devices: [],
};
store.addSpace(area.buildingId, area.floorId, area);
const created = new Map();
for (const entry of DEVICE_CATALOG) {
  const device = makeDevice(entry.type, area, store.devices(), { x: 150, y: 150 });
  devices.saveDevice(device);
  created.set(entry.type, device);
  check(`Create ${entry.type}: category, assignment, canvas position`, () => {
    const actual = store.devices().find((item) => item.id === device.id);
    assert.equal(actual.capabilities[0].category, entry.category);
    assert.equal(actual.spaceId, area.id);
    assert.ok(
      visualDevicePosition(
        store.spaces().find((item) => item.id === area.id).devices,
        store
          .spaces()
          .find((item) => item.id === area.id)
          .devices.findIndex((item) => item.id === device.id),
      ),
    );
  });
}
const gas = created.get('Gas'),
  temp = created.get('Temperature'),
  motion = created.get('Motion'),
  servo = created.get('Servomotor');
const target = (type, action = 'ACTIVATE') => ({
  deviceId: created.get(type).id,
  capabilityCode: created.get(type).capabilities[0].code,
  action,
});
response.saveRule({
  id: 'qa-gas-rule',
  sensor: 'Gas',
  sourceDeviceId: gas.id,
  condition: 'Gas emergency',
  operator: '>',
  threshold: 300,
  enabled: true,
  actuatorCapabilities: [],
  targets: [
    target('AudibleAlarm'),
    target('HVAC'),
    target('VisualSignal'),
    target('Servomotor', 'OPEN'),
  ],
});
response.saveRule({
  id: 'qa-temperature-rule',
  sensor: 'Temperature',
  sourceDeviceId: temp.id,
  condition: 'Temperature ventilation',
  operator: '>',
  threshold: 28,
  enabled: true,
  actuatorCapabilities: [],
  targets: [target('HVAC')],
});
const state = (type) =>
  store.devices().find((item) => item.id === created.get(type).id).capabilities[0].state;
response.simulateMeasurement(gas.id, 350);
check(
  'Gas -> alarm, HVAC, LED ACTIVE, servo OPEN, OLED ALERT, sensor Critical, event recorded',
  () => {
    for (const type of ['AudibleAlarm', 'HVAC', 'VisualSignal'])
      assert.equal(state(type), 'ACTIVE');
    assert.equal(state('Servomotor'), 'OPEN');
    assert.equal(state('OLED'), 'ALERT');
    assert.equal(store.devices().find((item) => item.id === gas.id).status, 'Critical');
    assert.equal(store.events()[0].spaceId, area.id);
    assert.ok(store.events()[0].ruleIds.includes('qa-gas-rule'));
  },
);
response.simulateMeasurement(temp.id, 32);
response.simulateMeasurement(gas.id, 100);
check('Concurrent rules: gas recovery does not stop HVAC while temperature remains high', () => {
  assert.equal(state('HVAC'), 'ACTIVE');
  assert.equal(state('AudibleAlarm'), 'INACTIVE');
  assert.equal(state('Servomotor'), 'CLOSED');
  assert.equal(state('OLED'), 'WARNING');
});
response.simulateMeasurement(temp.id, 24);
check('Recovery clears outputs and OLED, maps sensor Normal to Online', () => {
  assert.equal(state('HVAC'), 'INACTIVE');
  assert.equal(state('OLED'), 'NORMAL');
  assert.equal(store.devices().find((item) => item.id === temp.id).status, 'Online');
});
response.simulateMeasurement(motion.id, 1);
check('Motion does not activate emergency outputs by default', () =>
  assert.equal(state('AudibleAlarm'), 'INACTIVE'),
);
response.saveRule({
  id: 'qa-motion-rule',
  sensor: 'Motion',
  sourceDeviceId: motion.id,
  condition: 'Security zone',
  operator: '>',
  threshold: 0,
  enabled: true,
  actuatorCapabilities: [],
  targets: [target('AudibleAlarm')],
});
check('Configured motion rule activates alarm immediately', () =>
  assert.equal(state('AudibleAlarm'), 'ACTIVE'),
);
response.updateRule('qa-motion-rule', { enabled: false });
check('Disabling a rule immediately reconciles actuator state', () =>
  assert.equal(state('AudibleAlarm'), 'INACTIVE'),
);
for (const [operator, a, b, expected] of [
  ['>', 3, 2, true],
  ['<', 1, 2, true],
  ['>=', 2, 2, true],
  ['<=', 2, 2, true],
  ['=', 2, 2, true],
  ['=', 1, 2, false],
]) {
  check(`Comparison ${operator} (${a},${b})`, () =>
    assert.equal(matchesCondition(a, operator, b), expected),
  );
}
response.saveRule({
  id: 'qa-humidity-low',
  sensor: 'Humidity',
  sourceDeviceId: created.get('Humidity').id,
  condition: 'Low humidity',
  operator: '<',
  threshold: 30,
  enabled: true,
  actuatorCapabilities: [],
  targets: [target('HVAC')],
});
response.simulateMeasurement(created.get('Humidity').id, 20);
check('Lower-bound humidity rule drives ventilation', () => assert.equal(state('HVAC'), 'ACTIVE'));
response.simulateMeasurement(created.get('Humidity').id, 50);
check('Rule validation rejects cross-area response targets', () => {
  const outsider = store
    .devices()
    .find(
      (item) =>
        item.spaceId !== area.id && item.capabilities.some((cap) => cap.category === 'ACTUATOR'),
    );
  assert.throws(() =>
    response.saveRule({
      id: 'bad',
      sensor: 'Gas',
      sourceDeviceId: gas.id,
      condition: 'bad',
      enabled: true,
      actuatorCapabilities: [],
      targets: [
        {
          deviceId: outsider.id,
          capabilityCode: outsider.capabilities.find((cap) => cap.category === 'ACTUATOR').code,
          action: 'ACTIVATE',
        },
      ],
    }),
  );
});
check('Nonfinite input and actuator measurement ingestion are rejected', () => {
  assert.equal(response.simulateMeasurement(gas.id, NaN), undefined);
  assert.equal(response.simulateMeasurement(servo.id, 5), undefined);
});
const mvp = store.devices().find((item) => item.id === 'resq-mvp-001');
response.simulateMeasurement(mvp.id, 1830);
check('MQ-2 ADC uses device ADC thresholds instead of ppm', () =>
  assert.equal(store.devices().find((item) => item.id === mvp.id).status, 'Online'),
);
// Regression checks for the merged risk lifecycle and the existing IoT pipeline.
const lifecycle = new RiskEventStoreService();
const riskSimulation = new RiskDetectionSimulationService(store, lifecycle, response);
const initialEventCount = store.events().length;
const warning = riskSimulation.simulateMeasurement(gas.id, 250);
check('Risk demo ingests once through the sensor pipeline and creates a warning Alert', () => {
  assert.equal(store.events().length, initialEventCount + 1);
  assert.equal(warning.classification, 'Warning');
  assert.equal(
    lifecycle.alerts().find((item) => item.alertId === warning.alertId).status,
    'ACTIVE',
  );
});
riskSimulation.simulateMeasurement(gas.id, 100);
check('Normal demo reading clears its Alert', () => {
  assert.equal(
    lifecycle.alerts().find((item) => item.alertId === warning.alertId).status,
    'CLEARED',
  );
});
const secondWarning = riskSimulation.simulateMeasurement(gas.id, 250);
const critical = riskSimulation.simulateMeasurement(gas.id, 350);
check('Critical demo creates an Incident, clears the warning and drives real rule targets', () => {
  assert.equal(critical.classification, 'Critical');
  assert.equal(
    lifecycle.incidents().find((item) => item.id === critical.incidentId).status,
    'Open',
  );
  assert.equal(
    lifecycle.alerts().find((item) => item.alertId === secondWarning.alertId).clearReason,
    'CRITICAL_THRESHOLD_REACHED',
  );
  for (const type of ['HVAC', 'AudibleAlarm', 'VisualSignal']) {
    const target = store.devices().find((item) => item.id === created.get(type).id);
    assert.equal(target.capabilities[0].state, 'ACTIVE');
  }
  assert.equal(store.devices().find((item) => item.id === servo.id).capabilities[0].state, 'OPEN');
  assert.equal(
    store.devices().find((item) => item.id === created.get('OLED').id).capabilities[0].state,
    'ALERT',
  );
});
const repeated = riskSimulation.simulateMeasurement(gas.id, 360);
check('Repeated critical measurement reuses its Incident and updates evidence', () => {
  assert.equal(repeated.created, false);
  assert.equal(repeated.incidentId, critical.incidentId);
  assert.equal(
    lifecycle.incidents().find((item) => item.id === critical.incidentId).currentEvidence.value,
    360,
  );
});
riskSimulation.simulateMeasurement(gas.id, 100);
check('Risk demo recovery resets outputs but leaves its safe Incident open for follow-up', () => {
  const incident = lifecycle.incidents().find((item) => item.id === critical.incidentId);
  assert.ok(incident.safeAt);
  assert.equal(incident.status, 'Open');
  assert.equal(
    store.devices().find((item) => item.id === created.get('HVAC').id).capabilities[0].state,
    'INACTIVE',
  );
  assert.equal(
    store.devices().find((item) => item.id === created.get('OLED').id).capabilities[0].state,
    'NORMAL',
  );
});
const adcWarning = riskSimulation.simulateMeasurement(mvp.id, 2400);
check('Risk demo evidence preserves actual MQ-2 ADC units and thresholds', () => {
  assert.equal(adcWarning.classification, 'Warning');
  const evidence = lifecycle.detections().find((item) => item.evidence[0].deviceId === mvp.id)
    .evidence[0];
  assert.equal(evidence.unit, 'ADC');
  assert.equal(evidence.warningThreshold, 2000);
  assert.equal(evidence.criticalThreshold, 3000);
});
riskSimulation.simulateMeasurement(mvp.id, 1830);
async function finish() {
  const record = await firstValueFrom(gateway.getDeviceById(gas.id));
  const updated = await firstValueFrom(
    gateway.updateDeviceDetails(
      gas.id,
      { name: 'Edited Gas', description: 'edited', specifications: record.device.specifications },
      record.etag,
    ),
  );
  check('Gateway edits device created in editor, preserves shared identity', () =>
    assert.equal(store.devices().find((item) => item.id === gas.id).name, 'Edited Gas'),
  );
  const after = await firstValueFrom(gateway.getDeviceById(gas.id));
  check('Gateway ETag/version matches authoritative store', () =>
    assert.equal(after.device.version, updated.device.version),
  );
  devices.deleteDevice(servo.id);
  check('Delete actuator removes canvas/list entity and target references', () => {
    assert.ok(!store.devices().some((item) => item.id === servo.id));
    assert.ok(
      !store.rules().some((rule) => rule.targets?.some((target) => target.deviceId === servo.id)),
    );
  });
  devices.deleteDevice(gas.id);
  const deleted = await firstValueFrom(gateway.getDeviceById(gas.id));
  check('Delete sensor removes its rules and cannot reappear through gateway', () => {
    assert.ok(!store.rules().some((rule) => rule.sourceDeviceId === gas.id));
    assert.equal(deleted, undefined);
  });
  console.log(`Verified ${checks} IoT integration checks.`);
  injector.destroy();
}
finish().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
