// ============================================================================
// BLACK-BOX приёмочные тесты логического сценария «Виртуальный термостат»
// (VirtualThermostat, версия по спецификации 3.1).
//
// Тесты написаны ТОЛЬКО от текстовой поведенческой спецификации, выданной
// в задании на генерацию (разделы §1–§16), БЕЗ чтения исходников сценария,
// README.md сценария, экспортированного .json или существующих тестов
// сценария. Каждый describe соответствует разделу/пункту спецификации,
// каждый it — одному конкретному утверждению из неё.
//
// Падающий тест здесь означает расхождение между спецификацией и фактическим
// поведением (либо ошибку в самом тесте) — тест НЕ подгоняется под код.
//
// Пункты, отмеченные в спецификации как «Открытые вопросы» /
// «Неспецифицированные зоны», сознательно НЕ оформлены как падающие тесты —
// наблюдения по ним вынесены в текстовый отчёт (notes), а не в этот файл.
//
// Технические соглашения (см. .tests/ и README ScenarioSimulator):
//  - `fire()` симулирует изменение характеристики ПРИВЯЗАННОГО термостата
//    (источник из §2.1) — платформа обязана вызвать trigger() при таком
//    изменении, поэтому помимо setValue() нужен явный scenario.run().
//  - Изменения характеристик ВНЕШНИХ устройств (датчик §2.5.a, онлайн-статус
//    реле §2.5.b) обрабатываются подпиской, которую сценарий сам создаёт
//    внутри trigger() — для них достаточно обычного setValue(), обработчик
//    вызывается синхронно самим симулятором.
//  - Самоизменение (self-change, §2.3) эмулируется передачей в scenario.run()
//    context вида 'LOGIC<id> <- C<uuid> <- LOGIC<id>' (тот же идентификатор
//    в начале и в конце цепочки) — это подтверждённое соглашение репозитория
//    (см. ParameterTimer/.tests/parameter-timer.test.js,
//    MotionLightAutomationGrouped/.tests/blackbox-logic.test.js). Обычное
//    пользовательское/внешнее изменение — context 'USER' (или ''), запуск по
//    onStart — context 'HUB[OnStart]'.
//  - `variables` — тот же объект, который сценарий мутирует; переменные
//    состояния из §5 (lastUserTargetState, sensorFailed, fanSpeedManuallySet,
//    offBehaviorApplied и т.д.) документированы спецификацией как
//    «наблюдаемые эффекты», поэтому используются как ДОПОЛНИТЕЛЬНОЕ
//    подтверждение рядом с поведенческими проверками (состояние реле,
//    характеристик, логов), а не единственный источник истины.
// ============================================================================

// ─────────────────────────── Хелперы окружения ───────────────────────────

// Полный набор функциональных опций сценария с дефолтами из §3.
// Статические UI-заголовки (desc/thermostatLogic/off/failure/fan/other, §3
// «Общее замечание») намеренно не включены — по спецификации они не влияют
// на поведение.
function baseOptions(overrides) {
  const o = {
    sensor: '',
    heatingRelay: '',
    heatingRelayInvert: false,
    coolingRelay: '',
    coolingRelayInvert: false,
    emulateThermostat: false,
    hysteresis: 0.5,
    offBehavior: 0,
    failureBehavior: 0,
    failureTimeout: 240,
    fanTempStep: 0.5,
    fanSpeedManualLock: true,
    debug: false,
  };
  if (overrides) {
    for (const k in overrides) o[k] = overrides[k];
  }
  return o;
}

// Привязанный аксессуар-сервис «Термостат» (§1, §2.1).
// cfg: { id, name, room, current, target, currentTemp, targetTemp,
//        thresholds, heatThreshold, coolThreshold, fanSpeed }
function addThermostat(hub, cfg) {
  cfg = cfg || {};
  const chars = [
    { type: HC.CurrentHeatingCoolingState, value: cfg.current !== undefined ? cfg.current : 0 },
    { type: HC.TargetHeatingCoolingState, value: cfg.target !== undefined ? cfg.target : 0 },
    { type: HC.CurrentTemperature, value: cfg.currentTemp !== undefined ? cfg.currentTemp : 20 },
    { type: HC.TargetTemperature, value: cfg.targetTemp !== undefined ? cfg.targetTemp : 22 },
  ];
  if (cfg.thresholds || cfg.heatThreshold !== undefined) {
    chars.push({ type: HC.HeatingThresholdTemperature, value: cfg.heatThreshold !== undefined ? cfg.heatThreshold : 20 });
  }
  if (cfg.thresholds || cfg.coolThreshold !== undefined) {
    chars.push({ type: HC.CoolingThresholdTemperature, value: cfg.coolThreshold !== undefined ? cfg.coolThreshold : 24 });
  }
  if (cfg.fanSpeed !== undefined) {
    chars.push({ type: HC.C_FanSpeed, value: cfg.fanSpeed });
  }
  return hub.addAccessory({
    id: cfg.id !== undefined ? cfg.id : 1,
    name: cfg.name || 'Термостат',
    room: cfg.room || 'Тест',
    services: [{ type: HS.Thermostat, characteristics: chars }],
  });
}

// Быстрый доступ к основным характеристикам термостата.
function thermoChars(thermo) {
  return {
    current: thermo.char(HS.Thermostat, HC.CurrentHeatingCoolingState),
    target: thermo.char(HS.Thermostat, HC.TargetHeatingCoolingState),
    currentTemp: thermo.char(HS.Thermostat, HC.CurrentTemperature),
    targetTemp: thermo.char(HS.Thermostat, HC.TargetTemperature),
  };
}

// Датчик температуры (§3.1): AccessoryInformation(C_Online) + TemperatureSensor(CurrentTemperature).
function addSensor(hub, cfg) {
  cfg = cfg || {};
  return hub.addAccessory({
    id: cfg.id !== undefined ? cfg.id : 2,
    name: cfg.name || 'Датчик температуры',
    room: cfg.room || 'Тест',
    services: [
      { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: cfg.online !== false }] },
      { type: HS.TemperatureSensor, characteristics: [{ type: HC.CurrentTemperature, value: cfg.temp !== undefined ? cfg.temp : 20 }] },
    ],
  });
}

// Реле нагрева/охлаждения (§1.6, §3.2/§3.4): Switch либо Outlet + On,
// плюс AccessoryInformation(C_Online) для §2.5.b/§11.
function addRelay(hub, cfg) {
  cfg = cfg || {};
  return hub.addAccessory({
    id: cfg.id !== undefined ? cfg.id : 3,
    name: cfg.name || 'Реле',
    room: cfg.room || 'Тест',
    services: [
      { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: cfg.online !== false }] },
      { type: cfg.outlet ? HS.Outlet : HS.Switch, characteristics: [{ type: HC.On, value: !!cfg.on }] },
    ],
  });
}

function relayOn(relayAcc, outlet) {
  return relayAcc.char(outlet ? HS.Outlet : HS.Switch, HC.On).getValue();
}

// Симулирует срабатывание trigger() из-за изменения характеристики
// ПРИВЯЗАННОГО термостата (источники из §2.1) — платформа сама обязана
// вызвать trigger(), поэтому помимо записи значения нужен явный scenario.run().
function fire(scenario, char, value, vars, options, context) {
  char.setValue(value);
  return scenario.run({ source: char, value: value, variables: vars, options: options, context: context !== undefined ? context : '' });
}

// Первый вызов trigger() — эмулирует автозапуск при старте хаба / сохранении
// настроек (§2.2, onStart), устанавливает подписки и cron-задачи (§2.5).
function boot(scenario, char, vars, options) {
  return scenario.run({ source: char, value: char.getValue(), variables: vars, options: options, context: 'HUB[OnStart]' });
}

// Соглашение репозитория для context (см. заголовок файла).
const SELF_CTX = 'LOGIC42 <- C123 <- LOGIC42';
const USER_CTX = 'USER';

const MIN = 60 * 1000;

// ============================================================================

describe('Метаданные сценария (версия, onStart, compute, info-контракт)', () => {
  it('версия сценария — "3.1"', ({ scenario }) => {
    expect(scenario.info().version).toBe('3.1');
  });

  it('onStart === true (автозапуск при старте хаба и при сохранении настроек, §2.2)', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });

  it('sourceServices содержит "Thermostat"', ({ scenario }) => {
    expect(scenario.info().sourceServices).toContain('Thermostat');
  });

  it('sourceCharacteristics содержит все 7 характеристик из §2.1', ({ scenario }) => {
    const chars = scenario.info().sourceCharacteristics;
    const expected = [
      'CurrentHeatingCoolingState', 'TargetHeatingCoolingState',
      'CurrentTemperature', 'TargetTemperature',
      'HeatingThresholdTemperature', 'CoolingThresholdTemperature',
      'C_FanSpeed',
    ];
    for (const c of expected) {
      expect(chars).toContain(c);
    }
  });

  it('compute() не определена — сценарий никогда не вычисляет значение характеристики синхронно (§2.6)', ({ scenario }) => {
    expect(() => scenario.compute({ source: null, value: null, variables: {}, options: baseOptions(), context: '' })).toThrow();
  });
});

// ============================================================================

describe('§3 Пустые опции — базовая устойчивость без датчика/реле', () => {
  it('sensor, heatingRelay, coolingRelay все пустые — обычная логика по CurrentHeatingCoolingState работает, исключений нет', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const t = thermoChars(thermo);
    const vars = {};
    expect(() => boot(scenario, t.target, vars, baseOptions())).not.toThrow();
  });
});

// ============================================================================

describe('§6.1 Базовое управление реле при активном целевом режиме', () => {
  it('CurrentHeatingCoolingState=1 (Нагревает) → реле нагрева ON, реле охлаждения OFF', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(true);
    expect(relayOn(cool)).toBe(false);
  });

  it('CurrentHeatingCoolingState=2 (Охлаждает) → реле охлаждения ON, реле нагрева OFF', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 2, current: 2 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(cool)).toBe(true);
    expect(relayOn(heat)).toBe(false);
  });

  it('целевой режим активный, CurrentHeatingCoolingState=0 (зона комфорта) → оба реле OFF', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false);
    expect(relayOn(cool)).toBe(false);
  });

  it('перепроверяется при каждом подходящем срабатывании, даже если ни целевой, ни текущий режим не менялись', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 18 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(true);
    heat.char(HS.Switch, HC.On).setValue(false); // внешнее вмешательство
    fire(scenario, t.currentTemp, 18.5, vars, options); // срабатывание из-за температуры, режимы не менялись
    expect(relayOn(heat)).toBe(true); // пересинхронизировалось обратно
  });

  it('конфигурация «только нагрев» (coolingRelay пусто): целевой режим Охлаждение выключает реле нагрева без ошибок', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 2, current: 2 });
    const heat = addRelay(hub, { id: 10, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID() });
    const vars = {};
    expect(() => boot(scenario, t.target, vars, options)).not.toThrow();
    expect(relayOn(heat)).toBe(false);
  });

  it('конфигурация «только охлаждение» (heatingRelay пусто): целевой режим Нагрев выключает реле охлаждения без ошибок', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ coolingRelay: cool.getService(HS.Switch).getUUID() });
    const vars = {};
    expect(() => boot(scenario, t.target, vars, options)).not.toThrow();
    expect(relayOn(cool)).toBe(false);
  });

  it('Outlet поддерживается как тип реле наравне со Switch (§1.6)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false, outlet: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Outlet).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat, true)).toBe(true);
  });
});

// ============================================================================

describe('§6.2 «Поведение при отключении термостата» (offBehavior)', () => {
  it('offBehavior=0 (по умолчанию): оба реле физически выключаются', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID(), offBehavior: 0 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false);
    expect(relayOn(cool)).toBe(false);
  });

  it('offBehavior=1: оба реле физически включаются', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: false });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID(), offBehavior: 1 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(true);
    expect(relayOn(cool)).toBe(true);
  });

  it('offBehavior=2 («Нагрев»): реле нагрева включается, реле охлаждения выключается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: false });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID(), offBehavior: 2 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(true);
    expect(relayOn(cool)).toBe(false);
  });

  it('offBehavior=3 («Охлаждение»): реле охлаждения включается, реле нагрева выключается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID(), offBehavior: 3 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(cool)).toBe(true);
    expect(relayOn(heat)).toBe(false);
  });

  it('некорректное числовое offBehavior (99) трактуется как 0', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), coolingRelay: cool.getService(HS.Switch).getUUID(), offBehavior: 99 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false);
    expect(relayOn(cool)).toBe(false);
  });

  it('отрицательное offBehavior (-1) тоже трактуется как 0', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), offBehavior: -1 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false);
  });

  it('применяется ОДИН РАЗ при входе в пассивный режим: ручное вмешательство в реле после этого больше не перезаписывается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), offBehavior: 0 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 0, vars, options); // выключаем → offBehavior применяется (оба OFF)
    expect(relayOn(heat)).toBe(false);
    heat.char(HS.Switch, HC.On).setValue(true); // ручное вмешательство извне, пока термостат пассивен
    fire(scenario, t.currentTemp, 19, vars, options); // ещё одно срабатывание в пассивном режиме
    expect(relayOn(heat)).toBe(true); // не тронуто повторно
  });

  it('переключение между пассивными состояниями (0→−1→−2) НЕ переприменяет offBehavior повторно (§15)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), offBehavior: 1 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 0, vars, options);
    expect(relayOn(heat)).toBe(true); // offBehavior=1 применилось
    heat.char(HS.Switch, HC.On).setValue(false); // вручную гасим
    fire(scenario, t.target, -1, vars, options); // 0 → −1, оба пассивные
    expect(relayOn(heat)).toBe(false); // НЕ переприменилось
    fire(scenario, t.target, -2, vars, options); // −1 → −2
    expect(relayOn(heat)).toBe(false);
  });

  it('возврат в активный режим восстанавливает §6.1, а следующий переход в пассивный снова применяет offBehavior', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), offBehavior: 1 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 0, vars, options);
    expect(relayOn(heat)).toBe(true); // offBehavior=1
    heat.char(HS.Switch, HC.On).setValue(false);
    fire(scenario, t.target, 1, vars, options); // назад в активный
    fire(scenario, t.current, 1, vars, options);
    expect(relayOn(heat)).toBe(true); // §6.1 восстановлена (Нагревает → ON)
    heat.char(HS.Switch, HC.On).setValue(false);
    fire(scenario, t.target, 0, vars, options); // снова выключаем
    expect(relayOn(heat)).toBe(true); // offBehavior=1 применилось ЗАНОВО
  });
});

// ============================================================================

describe('§6.3 Инверсия реле', () => {
  it('heatingRelayInvert=true в §6.1: логическое ON → физическое OFF', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), heatingRelayInvert: true });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false);
  });

  it('coolingRelayInvert=true в §6.1: логическое OFF → физическое ON', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ coolingRelay: cool.getService(HS.Switch).getUUID(), coolingRelayInvert: true });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(cool)).toBe(true);
  });

  it('offBehavior=0/1 ИГНОРИРУЮТ инверсию (физическое поведение как есть)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), heatingRelayInvert: true, offBehavior: 0 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false); // offBehavior=0 всегда физически выключает
  });

  it('offBehavior=2/3 УЧИТЫВАЮТ инверсию', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID(), heatingRelayInvert: true, offBehavior: 2 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false); // логически включено, физически выключено из-за инверсии
  });
});

// ============================================================================

describe('§7 Эмуляция обычного термостата (emulateThermostat=true)', () => {
  it('§7.1 target=Выключено(0): CurrentHeatingCoolingState всегда 0, независимо от температуры', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0, current: 1, currentTemp: 10, targetTemp: 25 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
  });

  it('§7.2 target=Нагрев(1): temp >= target → CurrentHeatingCoolingState=0 (цель достигнута)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 22 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
  });

  it('§7.2 target=Нагрев(1): target−temp >= h → CurrentHeatingCoolingState=1 (греть)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 21.5, targetTemp: 22 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(1);
  });

  it('§7.2 target=Нагрев(1): мёртвая зона (target−h < temp < target) — значение НЕ меняется', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 21.8, targetTemp: 22 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(1); // сохранило предыдущее
  });

  it('§7.2 полный цикл гистерезиса нагрева: цель достигнута(0) → греть(1) → мёртвая зона держит(1) → цель снова достигнута(0)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 22, targetTemp: 22 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
    fire(scenario, t.currentTemp, 21.4, vars, options); // target-temp=0.6>=0.5 → греть
    expect(t.current.getValue()).toBe(1);
    fire(scenario, t.currentTemp, 21.6, vars, options); // target-temp=0.4<0.5, мёртвая зона
    expect(t.current.getValue()).toBe(1);
    fire(scenario, t.currentTemp, 22, vars, options); // temp>=target
    expect(t.current.getValue()).toBe(0);
  });

  it('§7.3 target=Охлаждение(2): temp<=target→0; temp−target>=h→2 (охлаждать); иначе мёртвая зона — не меняется', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 2, current: 0, currentTemp: 24, targetTemp: 24 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
    fire(scenario, t.currentTemp, 24.6, vars, options); // temp-target=0.6>=0.5
    expect(t.current.getValue()).toBe(2);
    fire(scenario, t.currentTemp, 24.3, vars, options); // 0.3<0.5, temp>target → мёртвая зона
    expect(t.current.getValue()).toBe(2); // сохраняет
  });

  it('§7.4 AUTO с обоими порогами: temp−cool>=h→2; heat−temp>=h→1; иначе 0 (БЕЗ мёртвой зоны)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 3, current: 0, currentTemp: 22, thresholds: true, heatThreshold: 20, coolThreshold: 24 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0); // между порогами
    fire(scenario, t.currentTemp, 19.4, vars, options); // heat-temp=0.6>=0.5 → греть
    expect(t.current.getValue()).toBe(1);
    fire(scenario, t.currentTemp, 24.6, vars, options); // temp-cool=0.6>=0.5 → охлаждать
    expect(t.current.getValue()).toBe(2);
    fire(scenario, t.currentTemp, 22, vars, options); // ни один порог не выполняется, БЕЗ мёртвой зоны → 0
    expect(t.current.getValue()).toBe(0);
  });

  it('§7.4 AUTO без обоих порогов: резервная логика на TargetTemperature (temp−target>=h→2; target−temp>=h→1; иначе 0)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 3, current: 0, currentTemp: 22, targetTemp: 22 }); // без thresholds
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
    fire(scenario, t.currentTemp, 21.4, vars, options); // target-temp=0.6 → греть
    expect(t.current.getValue()).toBe(1);
    fire(scenario, t.currentTemp, 22.6, vars, options); // temp-target=0.6 → охлаждать
    expect(t.current.getValue()).toBe(2);
  });

  it('§7.4 AUTO только с ОДНИМ из двух порогов — тоже резервная логика на TargetTemperature', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 3, current: 0, currentTemp: 22, targetTemp: 22, heatThreshold: 15 }); // только heatThreshold
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.currentTemp, 22.6, vars, options); // резервная логика: temp-target=0.6 → охлаждать
    expect(t.current.getValue()).toBe(2);
  });

  it('§7.5 target ∈ {ECO(-3), FAN(-1), DRY(-2)}: CurrentHeatingCoolingState НЕ пересчитывается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: -3, current: 1, currentTemp: 10, targetTemp: 25 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(1); // не тронуто
  });

  it('§7.6 emulateThermostat=false: CurrentHeatingCoolingState никогда не пересчитывается сценарием, используется «как есть»', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 10, targetTemp: 25 }); // при эмуляции должно было бы греть
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: false });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
  });

  it('при отсутствии характеристики TargetTemperature во время Нагрева — пересчёт пропускается, без исключений', ({ hub, scenario }) => {
    const thermo = hub.addAccessory({
      id: 1, name: 'Термостат', room: 'Тест',
      services: [{
        type: HS.Thermostat, characteristics: [
          { type: HC.CurrentHeatingCoolingState, value: 0 },
          { type: HC.TargetHeatingCoolingState, value: 1 },
          { type: HC.CurrentTemperature, value: 15 },
        ],
      }],
    });
    const target = thermo.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const current = thermo.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = {};
    expect(() => boot(scenario, target, vars, baseOptions({ emulateThermostat: true }))).not.toThrow();
    expect(current.getValue()).toBe(0);
  });
});

// ============================================================================

describe('§8 Получение данных с датчика температуры', () => {
  it('§8.1 показание датчика копируется на CurrentTemperature термостата сразу при первой настройке', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { currentTemp: 0 });
    const sensor = addSensor(hub, { temp: 23.4 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.currentTemp.getValue()).toBe(23.4);
  });

  it('§2.5.a новое показание датчика (через подписку) обновляет CurrentTemperature термостата', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { currentTemp: 20 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(25.5);
    expect(t.currentTemp.getValue()).toBe(25.5);
  });

  it('sensor="" — подписка не создаётся, CurrentTemperature термостата не трогается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { currentTemp: 19 });
    const sensor = addSensor(hub, { temp: 30 }); // существует, но не выбран в опциях
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: '' });
    const vars = {};
    boot(scenario, t.target, vars, options);
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(30.5);
    expect(t.currentTemp.getValue()).toBe(19);
  });

  it('§8.2 офлайн-датчик: значение всё равно переносится, но пишется warn в лог', ({ hub, scenario, logs }) => {
    const thermo = addThermostat(hub, {});
    const sensor = addSensor(hub, { temp: 21, online: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.currentTemp.getValue()).toBe(21);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('§2.5.a подписка создаётся не более одного раза за время жизни состояния (идемпотентность повторных автозапусков)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { currentTemp: 20 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    boot(scenario, t.target, vars, options); // второй «автозапуск» в рамках той же сессии variables
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(26);
    expect(t.currentTemp.getValue()).toBe(26);
  });

  it('§8.3 при sensor="" полуночная задача НЕ создаётся; проверка отказа не падает и не помечает отказ без датчика', ({ hub, scenario, cron, time }) => {
    // Примечание по прочтению спецификации: §2.5 явно ограничивает правило
    // «пустая опция → подписка не создаётся» источниками (a) и (b) («Для
    // источников (a) и (b) требуется, чтобы...») — источник (c), сама
    // cron-задача проверки отказа раз в 15 минут, в этом предложении не
    // упомянут. §8.3 отдельно и явно требует датчик именно для полуночной
    // задачи («Если выбран датчик, создаётся... периодическая задача»).
    // Поэтому проверяем узкое, дословно специфицированное утверждение:
    // среди созданных задач нет полуночной (суточного масштаба), а сама
    // 15-минутная задача (если создана) при срабатывании без датчика не
    // бросает исключений и не помечает датчик отказавшим.
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const t = thermoChars(thermo);
    const vars = {};
    boot(scenario, t.target, vars, baseOptions({ sensor: '' }));
    const entries = cron.listScheduled();
    const HOUR = 60 * 60 * 1000;
    const dailyScale = entries.filter((e) => e.nextAtMs - time.now() > 2 * HOUR);
    expect(dailyScale.length).toBe(0); // нет полуночной задачи без датчика
    expect(() => time.advance(16 * MIN)).not.toThrow();
    expect(vars.sensorFailed).toBeFalsy(); // без датчика отказ не может быть зафиксирован
  });

  it('§8.3 при выбранном датчике создаётся периодическая задача, которая в полночь копирует свежее показание', ({ hub, scenario, cron, time }) => {
    const thermo = addThermostat(hub, { currentTemp: 10 });
    const sensor = addSensor(hub, { temp: 10 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    const entries = cron.listScheduled();
    expect(entries.length).toBeGreaterThan(0);
    const midnight = entries.slice().sort((a, b) => b.nextAtMs - a.nextAtMs)[0]; // самая дальняя задача — полуночная
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValueSilent(17.5); // «молча» обновилось, без события
    time.advance(midnight.nextAtMs - time.now() + 500);
    expect(t.currentTemp.getValue()).toBe(17.5);
  });

  it('§8.4 информационное сообщение о подключении датчика пишется при первом запуске с выбранным датчиком (при debug=true — §3.13: инфо-уровень гейтится опцией debug)', ({ hub, scenario, logs }) => {
    const thermo = addThermostat(hub, {});
    const sensor = addSensor(hub, { temp: 20, name: 'Датчик кухни' });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), debug: true });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(logs.byLevel('info').length).toBeGreaterThan(0);
  });

  it('§3.13 при debug=false (по умолчанию) информационные сообщения о работе датчика не пишутся в лог', ({ hub, scenario, logs }) => {
    const thermo = addThermostat(hub, {});
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), debug: false });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(logs.byLevel('info').length).toBe(0);
  });
});

// ============================================================================

describe('§8.2/§9.7/§14 Уровни логирования офлайн-статуса', () => {
  it('попытка физической записи в офлайн-реле — error в лог (отличие от warn у офлайн-датчика)', ({ hub, scenario, logs }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false, online: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

// ============================================================================

describe('§3.10/§9.4 Нормализация failureTimeout (точная граница через немедленную проверку §9.4)', () => {
  it('failureTimeout=100 округляется ВВЕРХ до 105 (не до 100): при 101 прошедшей минуте датчик ещё НЕ отказавший', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 0, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 100 });
    const vars = {};
    boot(scenario, t.target, vars, options); // target=0, lastUpdateTime=0
    time.advance(101 * MIN);
    fire(scenario, t.target, 1, vars, options, USER_CTX); // пассивный → активный, немедленная проверка §9.4
    // sensorFailed никогда не переходил в true в этом тесте, поэтому допустимо, что переменная
    // остаётся не инициализированной (undefined) — §5 описывает "изначально false" концептуально
    // (falsy), код может не делать явного присваивания false, если отказа никогда не было.
    expect(vars.sensorFailed).toBeFalsy();
  });

  it('failureTimeout=100 округляется ВВЕРХ до 105: при 110 прошедших минутах датчик считается отказавшим', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 0, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 100 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(110 * MIN);
    fire(scenario, t.target, 1, vars, options, USER_CTX);
    expect(vars.sensorFailed).toBe(true);
  });

  it('failureTimeout=5 округляется до минимума 15: при 10 прошедших минутах датчик ещё НЕ отказавший', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 0, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(10 * MIN);
    fire(scenario, t.target, 1, vars, options, USER_CTX);
    expect(vars.sensorFailed).toBeFalsy(); // никогда не отказывал в этом тесте — допустимо undefined
  });

  it('failureTimeout=5 округляется до минимума 15: при 20 прошедших минутах датчик считается отказавшим', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 0, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 5 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(20 * MIN);
    fire(scenario, t.target, 1, vars, options, USER_CTX);
    expect(vars.sensorFailed).toBe(true);
  });
});

// ============================================================================

describe('§9.1 Периодическая проверка отказа датчика (раз в 15 минут)', () => {
  it('данные не устарели дольше failureTimeout — датчик НЕ считается отказавшим', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 45 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN); // после проверки на 30-й минуте: 30 < 45
    expect(vars.sensorFailed).toBeFalsy(); // никогда не отказывал — допустимо undefined
  });

  it('данные устарели дольше failureTimeout — датчик помечается отказавшим, error в лог', ({ hub, scenario, time, logs }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 30 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(46 * MIN); // после проверки на 45-й минуте: 45 > 30
    expect(vars.sensorFailed).toBe(true);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

// ============================================================================

describe('§9.2 Поведения при отказе датчика (failureBehavior)', () => {
  it('failureBehavior=0 («Отключить все», по умолчанию): целевой режим принудительно 0, оба реле логически выключены', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      coolingRelay: cool.getService(HS.Switch).getUUID(),
      failureTimeout: 15, failureBehavior: 0,
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(0);
    expect(relayOn(heat)).toBe(false);
    expect(relayOn(cool)).toBe(false);
  });

  it('failureBehavior=1 («Нагрев»): целевой режим НЕ меняется; реле нагрева ON, охлаждения OFF', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 2, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: false });
    const cool = addRelay(hub, { id: 11, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      coolingRelay: cool.getService(HS.Switch).getUUID(),
      failureTimeout: 15, failureBehavior: 1,
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(2); // не изменился
    expect(relayOn(heat)).toBe(true);
    expect(relayOn(cool)).toBe(false);
  });

  it('failureBehavior=2 («Охлаждение»): целевой режим НЕ меняется; реле охлаждения ON, нагрева OFF', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: true });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      coolingRelay: cool.getService(HS.Switch).getUUID(),
      failureTimeout: 15, failureBehavior: 2,
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(1);
    expect(relayOn(cool)).toBe(true);
    expect(relayOn(heat)).toBe(false);
  });

  it('failureBehavior=3 («Ничего не делать»): ни режим, ни реле не пересчитываются §6.1, только error в лог', ({ hub, scenario, time, logs }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0 }); // §6.1 дал бы heat=OFF
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: true }); // вручную включено — конфликтует с §6.1
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), heatingRelay: heat.getService(HS.Switch).getUUID(), failureTimeout: 30, failureBehavior: 3 });
    const vars = {};
    boot(scenario, t.target, vars, options); // §6.1 на боевом запуске выключит heat
    heat.char(HS.Switch, HC.On).setValue(true); // снова вручную включаем ПОСЛЕ штатной логики
    time.advance(46 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(relayOn(heat)).toBe(true); // не тронуто
    expect(t.target.getValue()).toBe(1); // не тронуто
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('failureBehavior=4 («Включить все»): целевой режим НЕ меняется; оба реле ON', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: false });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      coolingRelay: cool.getService(HS.Switch).getUUID(),
      failureTimeout: 15, failureBehavior: 4,
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(1);
    expect(relayOn(heat)).toBe(true);
    expect(relayOn(cool)).toBe(true);
  });

  it('некорректное числовое failureBehavior (42) трактуется как 0', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: true });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), heatingRelay: heat.getService(HS.Switch).getUUID(), failureTimeout: 15, failureBehavior: 42 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(0);
    expect(relayOn(heat)).toBe(false);
  });

  it('инверсия реле применяется и к failureBehavior (в отличие от offBehavior 0/1, §6.3)', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(), heatingRelayInvert: true,
      failureTimeout: 15, failureBehavior: 1,
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(relayOn(heat)).toBe(false); // логически ON, физически OFF из-за инверсии
  });
});

// ============================================================================

describe('§9.3 Приостановка отслеживания, когда термостат выключен пользователем', () => {
  it('термостат выключен пользователем ДО истечения failureTimeout — периодическая проверка не помечает отказ', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 15 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 0, vars, options, USER_CTX); // пользователь выключает
    time.advance(46 * MIN);
    expect(vars.sensorFailed).toBeFalsy(); // никогда не отказывал (приостановлено) — допустимо undefined
  });

  it('если отказ уже зафиксирован, а пользователь ЗАТЕМ выключает термостат — признак отказа немедленно снимается', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 15 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    fire(scenario, t.target, 0, vars, options, USER_CTX); // пользователь выключает
    expect(vars.sensorFailed).toBe(false);
  });

  it('переход в 0 самим сценарием (failureBehavior=0 при отказе) НЕ считается «выключением пользователем» — отслеживание продолжается', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 15, failureBehavior: 0 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN); // отказ, сценарий сам переводит target в 0
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(0);
    // раз это не «выключение пользователем» — восстановление по новому показанию должно сработать
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(21);
    expect(vars.sensorFailed).toBe(false);
  });
});

// ============================================================================

describe('§9.4 Немедленная проверка при переходе из пассивного в активный режим', () => {
  it('переход в активный режим при уже большом времени простоя датчика немедленно фиксирует отказ, не дожидаясь 15-мин цикла', ({ hub, scenario, time, logs }) => {
    const thermo = addThermostat(hub, { target: 0, current: 0 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 240 });
    const vars = {};
    boot(scenario, t.target, vars, options); // target=0, отслеживание приостановлено (§9.3)
    time.advance(250 * MIN); // датчик молчит намного дольше failureTimeout
    fire(scenario, t.target, 1, vars, options, USER_CTX); // включение — немедленная проверка §9.4
    expect(vars.sensorFailed).toBe(true); // обнаружено в рамках ЭТОГО ЖЕ вызова
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

// ============================================================================

describe('§9.5/§9.6 Восстановление после отказа и смена режима пользователем во время отказа', () => {
  it('восстановление возвращает реле к обычной логике §6.1 (а не оставляет их в состоянии failureBehavior), пишет warn', ({ hub, scenario, time, logs }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0 }); // §6.1: в зоне комфорта → OFF
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), heatingRelay: heat.getService(HS.Switch).getUUID(), failureTimeout: 15, failureBehavior: 1 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false); // §6.1: current=0 → OFF
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(relayOn(heat)).toBe(true); // failureBehavior=1 подменил логику
    logs.clear();
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(19); // восстановление, current всё ещё 0
    expect(vars.sensorFailed).toBe(false);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
    expect(relayOn(heat)).toBe(false); // вернулись к §6.1 (current=0 → OFF)
  });

  it('восстановление при failureBehavior=0: целевой режим возвращается к lastUserTargetState', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 2, current: 2 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 15, failureBehavior: 0 });
    const vars = {};
    fire(scenario, t.target, 2, vars, options, USER_CTX); // явный пользовательский выбор Охлаждение (+ establishes subscriptions)
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(0); // принудительно выключен
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(19); // восстановление
    expect(vars.sensorFailed).toBe(false);
    expect(t.target.getValue()).toBe(2); // вернулось к последнему пользовательскому выбору
  });

  it('§9.6 смена режима пользователем ВО ВРЕМЯ отказа (failureBehavior=0): запоминается, но фактический режим удерживается в 0 до восстановления', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 15, failureBehavior: 0 });
    const vars = {};
    fire(scenario, t.target, 1, vars, options, USER_CTX); // пользователь выбрал Нагрев
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(0);
    fire(scenario, t.target, 2, vars, options, USER_CTX); // пользователь МЕНЯЕТ выбор на Охлаждение ВО ВРЕМЯ отказа
    expect(t.target.getValue()).toBe(0); // всё ещё принудительно удерживается в 0
    expect(vars.lastUserTargetState).toBe(2); // но запомнено новое значение
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(19); // восстановление
    expect(vars.sensorFailed).toBe(false);
    expect(t.target.getValue()).toBe(2); // перешёл в НОВЫЙ выбор пользователя, а не в старый (Нагрев)
  });
});

// ============================================================================

describe('§2.3 Определение self-change: TargetHeatingCoolingState', () => {
  it('self-change запись TargetHeatingCoolingState НЕ запоминается как lastUserTargetState', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const t = thermoChars(thermo);
    const options = baseOptions();
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 2, vars, options, SELF_CTX);
    expect(vars.lastUserTargetState).not.toBe(2);
  });

  it('обычное (не self) изменение TargetHeatingCoolingState запоминается как lastUserTargetState', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const t = thermoChars(thermo);
    const options = baseOptions();
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 2, vars, options, USER_CTX);
    expect(vars.lastUserTargetState).toBe(2);
  });

  it('self-change в пассивный режим НЕ считается «выключением пользователем» для §9.3 — отслеживание отказа продолжается', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const t = thermoChars(thermo);
    const options = baseOptions({ sensor: sensor.getService(HS.TemperatureSensor).getUUID(), failureTimeout: 15 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, t.target, 0, vars, options, SELF_CTX); // "сам сценарий" перевёл в 0
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true); // отслеживание НЕ приостановлено
  });
});

// ============================================================================

describe('§10 Автоматическое управление скоростью вентилятора (C_FanSpeed)', () => {
  it('термостат без C_FanSpeed — блок §10 полностью пропускается, ошибок в лог не пишется', ({ hub, scenario, logs }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 }); // без fanSpeed
    const t = thermoChars(thermo);
    const vars = {};
    expect(() => boot(scenario, t.target, vars, baseOptions())).not.toThrow();
    expect(logs.byLevel('error').length).toBe(0);
  });

  it('§10.2 CurrentHeatingCoolingState=0 (Выключен) → скорость принудительно 1, независимо от температур', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 0, current: 0, currentTemp: 30, targetTemp: 10, fanSpeed: 5 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const vars = {};
    boot(scenario, t.target, vars, baseOptions());
    expect(fan.getValue()).toBe(1);
  });

  it('§10.1 формула по шагам: diff<step→1; step..2step→2; 2..3step→3; 3..4step→4; >=4step→5', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 22, fanSpeed: 0 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 1 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(fan.getValue()).toBe(1); // diff=0<1

    fire(scenario, t.currentTemp, 22.5, vars, options); // diff=0.5<1
    expect(fan.getValue()).toBe(1);

    fire(scenario, t.currentTemp, 23, vars, options); // diff=1 → 2
    expect(fan.getValue()).toBe(2);

    fire(scenario, t.currentTemp, 24, vars, options); // diff=2 → 3
    expect(fan.getValue()).toBe(3);

    fire(scenario, t.currentTemp, 25, vars, options); // diff=3 → 4
    expect(fan.getValue()).toBe(4);

    fire(scenario, t.currentTemp, 26, vars, options); // diff=4 → 5
    expect(fan.getValue()).toBe(5);

    fire(scenario, t.currentTemp, 30, vars, options); // diff=8 → 5 (максимум)
    expect(fan.getValue()).toBe(5);
  });

  it('§10.1 при отсутствии TargetTemperature — пересчёт скорости пропускается, без исключений', ({ hub, scenario }) => {
    const thermo = hub.addAccessory({
      id: 1, name: 'Термостат', room: 'Тест',
      services: [{
        type: HS.Thermostat, characteristics: [
          { type: HC.CurrentHeatingCoolingState, value: 1 },
          { type: HC.TargetHeatingCoolingState, value: 1 },
          { type: HC.CurrentTemperature, value: 20 },
          { type: HC.C_FanSpeed, value: 3 },
        ],
      }],
    });
    const target = thermo.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const vars = {};
    expect(() => boot(scenario, target, vars, baseOptions())).not.toThrow();
    expect(fan.getValue()).toBe(3); // не изменилось
  });

  it('§10.1 пересчёт НЕ происходит в срабатывании, где изменившаяся характеристика — именно C_FanSpeed', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 30, targetTemp: 10, fanSpeed: 1 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 1, fanSpeedManualLock: false });
    const vars = {};
    boot(scenario, t.target, vars, options); // diff=20 → 5 на боевом запуске
    expect(fan.getValue()).toBe(5);
    fan.setValueSilent(2); // молча меняем скорость, минуя обработчик
    fire(scenario, fan, 2, vars, options); // событие ИМЕННО от C_FanSpeed
    expect(fan.getValue()).toBe(2); // НЕ пересчиталось обратно в 5 в рамках этого срабатывания
  });

  it('§15 fanTempStep=5.0 (верхняя граница): скорость почти всегда 1, кроме разниц >=20°C (скорость 5)', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 22, fanSpeed: 0 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 5.0 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(fan.getValue()).toBe(1);
    fire(scenario, t.currentTemp, 40, vars, options); // diff=18: 15<=18<20 → 4
    expect(fan.getValue()).toBe(4);
    fire(scenario, t.currentTemp, 43, vars, options); // diff=21>=20 → 5
    expect(fan.getValue()).toBe(5);
  });
});

// ============================================================================

describe('§10.3 Ручная фиксация скорости вентилятора (fanSpeedManualLock)', () => {
  it('fanSpeedManualLock=true: пользователь ставит скорость ≠0 → автопересчёт приостанавливается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 22, fanSpeed: 0 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 1, fanSpeedManualLock: true });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, fan, 4, vars, options, USER_CTX);
    expect(vars.fanSpeedManuallySet).toBe(true);
    fire(scenario, t.currentTemp, 30, vars, options); // diff резко вырос, формула дала бы 5
    expect(fan.getValue()).toBe(4); // не пересчиталось — фиксация активна
  });

  it('fanSpeedManualLock=true: возврат в 0 (Авто) снимает фиксацию и немедленно пересчитывает по формуле', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 30, fanSpeed: 0 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 1, fanSpeedManualLock: true });
    const vars = {};
    boot(scenario, t.target, vars, options); // diff=8 → 5
    fire(scenario, fan, 2, vars, options, USER_CTX);
    expect(vars.fanSpeedManuallySet).toBe(true);
    fire(scenario, fan, 0, vars, options, USER_CTX); // возврат в Авто
    expect(vars.fanSpeedManuallySet).toBe(false);
    expect(fan.getValue()).toBe(5); // немедленно пересчитано (diff всё ещё 8)
  });

  it('fanSpeedManualLock=false: ручная установка НЕ фиксируется, автопересчёт продолжает подменять значение', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 22, fanSpeed: 0 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 1, fanSpeedManualLock: false });
    const vars = {};
    boot(scenario, t.target, vars, options);
    fire(scenario, fan, 4, vars, options, USER_CTX);
    // фиксация никогда не включалась в этом тесте — допустимо, что fanSpeedManuallySet
    // остаётся не инициализированной (undefined), а не явно false.
    expect(vars.fanSpeedManuallySet).toBeFalsy();
    fire(scenario, t.currentTemp, 30, vars, options); // diff=8 → пересчёт заменяет ручное значение
    expect(fan.getValue()).toBe(5);
  });

  it('self-change C_FanSpeed (сценарий сам записал) НЕ считается ручной установкой — фиксация не включается', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1, currentTemp: 22, targetTemp: 30, fanSpeed: 0 });
    const fan = thermo.char(HS.Thermostat, HC.C_FanSpeed);
    const t = thermoChars(thermo);
    const options = baseOptions({ fanTempStep: 1, fanSpeedManualLock: true });
    const vars = {};
    boot(scenario, t.target, vars, options); // diff=8 → 5, записано самим сценарием
    expect(fan.getValue()).toBe(5);
    // симулируем self-эхо этой записи, как если бы хаб вызвал trigger от имени сценария
    fire(scenario, fan, 5, vars, options, SELF_CTX);
    expect(vars.fanSpeedManuallySet).toBeFalsy(); // фиксация не включалась — допустимо undefined
    fire(scenario, t.currentTemp, 30, vars, options); // temp==target(30) → diff=0 → формула свободно пересчитывает в 1
    expect(fan.getValue()).toBe(1);
  });
});

// ============================================================================

describe('§11 Подписка на онлайн-статус реле', () => {
  it('переход владельца реле нагрева в онлайн пересчитывает реле заново, даже если термостат не менялся', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false, online: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    heat.char(HS.AccessoryInformation, HC.C_Online).setValue(true); // устройство появилось в сети
    expect(relayOn(heat)).toBe(true); // §6.1 пересчиталась
  });

  it('переход владельца реле охлаждения в онлайн тоже пересчитывает реле', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 2, current: 2 });
    const cool = addRelay(hub, { id: 11, on: false, online: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ coolingRelay: cool.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    cool.char(HS.AccessoryInformation, HC.C_Online).setValue(true);
    expect(relayOn(cool)).toBe(true);
  });

  it('переход в онлайн НЕСВЯЗАННОГО устройства не влияет на реле термостата', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const heat = addRelay(hub, { id: 10, on: false });
    const stray = addRelay(hub, { id: 12, on: false, online: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ heatingRelay: heat.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(true);
    heat.char(HS.Switch, HC.On).setValue(false); // вручную гасим
    stray.char(HS.AccessoryInformation, HC.C_Online).setValue(true); // постороннее устройство
    expect(relayOn(heat)).toBe(false); // не пересчиталось
  });

  it('без выбранных реле подписка на онлайн-статус не создаётся — переход устройств в онлайн не вызывает исключений', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const stray = addRelay(hub, { id: 12, on: false, online: false });
    const t = thermoChars(thermo);
    const vars = {};
    boot(scenario, t.target, vars, baseOptions());
    expect(() => stray.char(HS.AccessoryInformation, HC.C_Online).setValue(true)).not.toThrow();
  });
});

// ============================================================================

describe('§2.4 Каскадные срабатывания через запись CurrentTemperature', () => {
  // Методическое примечание: CurrentTemperature термостата входит в список
  // источников §2.1, поэтому в РЕАЛЬНОМ хабе запись, которую сам сценарий
  // делает при переносе показания датчика (§8.1), сама по себе порождает
  // повторный вызов trigger() для этой характеристики (§2.4) — это
  // ответственность хаба (привязка "Логика" к сервису-источнику), а НЕ
  // подписки, которую сценарий сам ставит через Hub.subscribeWithCondition
  // (как для самого датчика, §2.5.a, — та воспроизводится симулятором
  // синхронно). Тестовый стенд не эмулирует автоматическую hub-cascade для
  // ПРИВЯЗАННОГО сервиса (см. также fire()/boot() в этом файле и аналогичные
  // хелперы других сценариев репозитория, например
  // MotionLightAutomation/.tests: `externalSet` явно требует повторного
  // scenario.run() после setValue()) — поэтому второй шаг цепочки
  // воспроизводится явным вызовом fire(), как это сделал бы хаб.
  it('перенос показания датчика (§8.1) и последующее срабатывание по CurrentTemperature термостата вместе пересчитывают эмуляцию и логику реле', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 22, targetTemp: 22 }); // зона комфорта → реле OFF
    const sensor = addSensor(hub, { temp: 22 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      emulateThermostat: true, hysteresis: 0.5,
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(relayOn(heat)).toBe(false);
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(21); // §2.5.a: подписка сценария срабатывает синхронно
    expect(t.currentTemp.getValue()).toBe(21); // §8.1: перенос сработал в рамках этого же события
    fire(scenario, t.currentTemp, 21, vars, options); // хаб реагирует на изменившуюся CurrentTemperature термостата (§2.1/§2.4)
    expect(t.current.getValue()).toBe(1); // §7.2: эмуляция пересчиталась (target-temp=1>=0.5 → греть)
    expect(relayOn(heat)).toBe(true); // §6.1: реле пересчиталось по новому текущему режиму
  });
});

// ============================================================================

describe('§13 Приоритеты правил при конфликтах', () => {
  it('отказ датчика (failureBehavior=0 перевёл target в 0) важнее offBehavior — реле управляются исключительно §9.2', ({ hub, scenario, time }) => {
    const thermo = addThermostat(hub, { target: 1, current: 1 });
    const sensor = addSensor(hub, { temp: 20 });
    const heat = addRelay(hub, { id: 10, on: false });
    const cool = addRelay(hub, { id: 11, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      coolingRelay: cool.getService(HS.Switch).getUUID(),
      failureTimeout: 15, failureBehavior: 0, offBehavior: 1, // offBehavior=1 включил бы ОБА реле, если бы применился
    });
    const vars = {};
    boot(scenario, t.target, vars, options);
    time.advance(31 * MIN);
    expect(vars.sensorFailed).toBe(true);
    expect(t.target.getValue()).toBe(0);
    expect(relayOn(heat)).toBe(false); // §9.2(failureBehavior=0), не offBehavior=1
    expect(relayOn(cool)).toBe(false);
  });

  it('эмуляция термостата пересчитывается ДО управления реле в рамках ОДНОГО И ТОГО ЖЕ срабатывания', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 22, targetTemp: 22 });
    const heat = addRelay(hub, { id: 10, on: false });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.5, heatingRelay: heat.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0);
    expect(relayOn(heat)).toBe(false);
    fire(scenario, t.currentTemp, 21, vars, options); // одно срабатывание: temp падает, эмуляция → греть, реле → ON
    expect(t.current.getValue()).toBe(1);
    expect(relayOn(heat)).toBe(true);
  });
});

// ============================================================================

describe('§15 Краевые случаи', () => {
  it('hysteresis=0.0 (нижняя граница): решения принимаются на самой границе целевой температуры', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 21.9, targetTemp: 22 });
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 0.0 });
    const vars = {};
    boot(scenario, t.target, vars, options); // target-temp=0.1>=0 → греть
    expect(t.current.getValue()).toBe(1);
    fire(scenario, t.currentTemp, 22, vars, options); // temp>=target → выкл
    expect(t.current.getValue()).toBe(0);
  });

  it('hysteresis=5.0 (верхняя граница): мёртвая зона максимально широкая — переключение требует перепада >=5°C', ({ hub, scenario }) => {
    const thermo = addThermostat(hub, { target: 1, current: 0, currentTemp: 20, targetTemp: 22 }); // перепад 2 < 5
    const t = thermoChars(thermo);
    const options = baseOptions({ emulateThermostat: true, hysteresis: 5.0 });
    const vars = {};
    boot(scenario, t.target, vars, options);
    expect(t.current.getValue()).toBe(0); // недостаточный перепад — сохраняет начальное
    fire(scenario, t.currentTemp, 17, vars, options); // target-temp=5>=5 → греть
    expect(t.current.getValue()).toBe(1);
  });
});

// ============================================================================
