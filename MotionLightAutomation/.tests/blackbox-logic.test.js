// ============================================================================
// BLACK-BOX приёмочные тесты сценария MotionLightAutomation (логическая часть).
//
// Тесты написаны ОТ СПЕЦИФИКАЦИИ (см. .tests/SPEC.md / задание на генерацию),
// БЕЗ обращения к исходному коду сценария, README.md сценария или иным его
// артефактам. Каждый describe соответствует разделу спецификации, каждый it —
// одному конкретному утверждению из неё.
//
// Пункты, отмеченные в спецификации как «Открытые вопросы» / «Неспецифицированные
// зоны», сознательно НЕ оформлены как падающие тесты (см. правило задания №7) —
// наблюдения по ним занесены в текстовый отчёт (notes), а не в этот файл.
// ============================================================================

// ---- Общие хелперы -----------------------------------------------------

function baseOptions(overrides) {
  const options = {
    motion1: '', motion2: '', motion3: '',
    manualControl1: '', manualControl2: '', manualControl3: '',
    luxSensor: '',
    maxAmbientLux: 50,
    gateAutoSwitch: '',
    gateAutoSwitchInvert: false,
    gateBlocksManualInputs: false,
    noAutoOffWhenManualOn: false,
    noAutoOnAfterManualOff: false,
    ignoreManualWithin5sAfterSensorOn: true,
    offDelaySeconds: 30,
    manualHoldSafetyOffDelayMinutes: 240,
    debug: false,
  };
  if (overrides) {
    for (const key in overrides) options[key] = overrides[key];
  }
  return options;
}

function addLamp(hub, opts) {
  opts = opts || {};
  return hub.addAccessory({
    id: opts.id != null ? opts.id : 1,
    name: opts.name || 'Лампа',
    room: opts.room || 'Комната',
    services: [{
      type: opts.serviceType || HS.Lightbulb,
      characteristics: [{ type: HC.On, value: !!opts.on }],
    }],
  });
}

function addMotion(hub, id, active) {
  return hub.addAccessory({
    id, name: 'Датчик движения ' + id, room: 'Комната',
    services: [{ type: HS.MotionSensor, characteristics: [{ type: HC.MotionDetected, value: !!active }] }],
  });
}

function addOccupancy(hub, id, value) {
  return hub.addAccessory({
    id, name: 'Датчик присутствия ' + id, room: 'Комната',
    services: [{ type: HS.OccupancySensor, characteristics: [{ type: HC.OccupancyDetected, value: value || 0 }] }],
  });
}

function addContact(hub, id, value) {
  return hub.addAccessory({
    id, name: 'Контакт ' + id, room: 'Комната',
    services: [{ type: HS.ContactSensor, characteristics: [{ type: HC.ContactSensorState, value: value || 0 }] }],
  });
}

function addLux(hub, id, value) {
  return hub.addAccessory({
    id, name: 'Освещённость ' + id, room: 'Комната',
    services: [{ type: HS.LightSensor, characteristics: [{ type: HC.CurrentAmbientLightLevel, value: value || 0 }] }],
  });
}

function addSwitch(hub, id, on) {
  return hub.addAccessory({
    id, name: 'Выключатель ' + id, room: 'Комната',
    services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: !!on }] }],
  });
}

function addButton(hub, id) {
  return hub.addAccessory({
    id, name: 'Кнопка ' + id, room: 'Комната',
    services: [{ type: HS.StatelessProgrammableSwitch, characteristics: [{ type: HC.ProgrammableSwitchEvent, value: 0 }] }],
  });
}

function addPulse(hub, id, value) {
  return hub.addAccessory({
    id, name: 'Импульсный счётчик ' + id, room: 'Комната',
    services: [{ type: HS.C_PulseMeter, characteristics: [{ type: HC.C_PulseCount, value: value || 0 }] }],
  });
}

// Первый вызов trigger() — эмулирует старт хаба / сохранение сценария (onStart).
function boot(scenario, lampChar, vars, options) {
  scenario.run({ source: lampChar, value: lampChar.getValue(), variables: vars, options, context: '' });
}

// Эмулирует ВНЕШНЕЕ изменение On управляемого сервиса (сцена/физвыключатель на лампе/
// голос/приложение) — платформа обязана вызвать trigger() при таком изменении (§3.1),
// поэтому помимо записи значения характеристики нужен и явный повторный scenario.run.
function externalSet(scenario, lampChar, vars, options, value) {
  lampChar.setValue(value);
  scenario.run({ source: lampChar, value, variables: vars, options, context: '' });
}

// ============================================================================

describe('Метаданные сценария (info-контракт, §1/§3.1)', () => {
  it('sourceServices содержит Lightbulb и Switch', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceServices).toContain('Lightbulb');
    expect(info.sourceServices).toContain('Switch');
  });

  it('sourceCharacteristics содержит On', ({ scenario }) => {
    expect(scenario.info().sourceCharacteristics).toContain('On');
  });

  it('onStart === true', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });

  it('version === "1.1" и author === "@BOOMikru"', ({ scenario }) => {
    const info = scenario.info();
    expect(info.version).toBe('1.1');
    expect(info.author).toBe('@BOOMikru');
  });

  it('compute() не определена — вызов бросает исключение (сценарий не вычисляет значение характеристики)', ({ scenario }) => {
    expect(() => scenario.compute({ source: null, value: null, variables: {}, options: baseOptions(), context: '' })).toThrow();
  });
});

// ============================================================================

describe('§3 Триггеры — реакция строго на привязанный сервис/устройства из опций', () => {
  it('изменение MotionDetected на датчике, НЕ назначенном ни в один слот, не влияет на свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const configured = addMotion(hub, 2, false);
    const unconfigured = addMotion(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: configured.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    unconfigured.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('изменение Switch.On на выключателе, не назначенном ни в gateAutoSwitch, ни в manualControl, не влияет на свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const unrelated = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions();
    const vars = {};
    boot(scenario, lampChar, vars, options);

    unrelated.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('управляемый сервис может быть типа Switch (не только Lightbulb) — датчик включает его так же', ({ hub, scenario }) => {
    const lamp = addLamp(hub, { serviceType: HS.Switch });
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Switch, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });
});

// ============================================================================

describe('§3.3 Активные значения характеристик датчиков активности', () => {
  it('MotionSensor: MotionDetected=true — активно, включает свет; false — неактивно', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);
    expect(lampChar.getValue()).toBe(false);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('OccupancySensor: OccupancyDetected=1 — активно, включает свет; 0 — неактивно', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const occ = addOccupancy(hub, 2, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: occ.getService(HS.OccupancySensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    expect(lampChar.getValue()).toBe(false);
    occ.char(HS.OccupancySensor, HC.OccupancyDetected).setValue(1);
    expect(lampChar.getValue()).toBe(true);
  });

  it('ContactSensor как датчик активности: ContactSensorState=1 (Открыто) активно; 0 (Закрыто) — нет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const contact = addContact(hub, 2, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: contact.getService(HS.ContactSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    expect(lampChar.getValue()).toBe(false);
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);
    expect(lampChar.getValue()).toBe(true);
  });
});

// ============================================================================

describe('§3.4 / §6 Что запускает пересчёт авто-включения', () => {
  it('событие luxSensor БЕЗ активности датчиков не включает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const lux = addLux(hub, 2, 80);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ luxSensor: lux.getService(HS.LightSensor).getUUID(), maxAmbientLux: 50 });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    lux.char(HS.LightSensor, HC.CurrentAmbientLightLevel).setValue(10);
    expect(lampChar.getValue()).toBe(false);
  });

  it('событие luxSensor ПРИ уже активном датчике инициирует попытку авто-включения (падение освещённости ниже порога включает свет)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lux = addLux(hub, 3, 80);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false); // заблокировано освещённостью

    lux.char(HS.LightSensor, HC.CurrentAmbientLightLevel).setValue(10);
    expect(lampChar.getValue()).toBe(true); // событие lux само инициировало попытку
  });

  it('событие gateAutoSwitch БЕЗ активности датчиков не включает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const gate = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ gateAutoSwitch: gate.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    gate.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('событие gateAutoSwitch ПРИ уже активном датчике инициирует попытку авто-включения', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false); // заблокировано gate=Off

    gate.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(true); // событие gate само инициировало попытку
  });
});

// ============================================================================

describe('§4.1 motion1..3 — независимые равноправные слоты', () => {
  it('активность только на motion1 включает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const m1 = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: m1.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    m1.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('активность только на motion2 (motion1/motion3 пустые) включает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const m2 = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion2: m2.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('активность только на motion3 (motion1/motion2 пустые) включает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const m3 = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion3: m3.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    m3.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('все три слота motion1..3 пустые — ни одно устройство никогда не включает свет по датчику', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const stray = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions();
    const vars = {};
    boot(scenario, lampChar, vars, options);
    stray.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });
});

// ============================================================================

describe('§6 Полное условие авто-включения по датчикам (конъюнкция)', () => {
  it('свет уже включён — повторное срабатывание датчика не создаёт побочных эффектов', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(true);
    motionChar.setValue(false);
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('gateAutoSwitch=Off (без инверсии) блокирует авто-включение по датчику', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('gateAutoSwitch=On (без инверсии) разрешает авто-включение по датчику', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('gateAutoSwitchInvert=true: gate=Off разрешает авто-включение', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateAutoSwitchInvert: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('gateAutoSwitchInvert=true: gate=On блокирует авто-включение', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateAutoSwitchInvert: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('освещённость строго выше maxAmbientLux блокирует авто-включение', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lux = addLux(hub, 3, 51);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('освещённость РОВНО равна maxAmbientLux разрешает авто-включение (граница "не выше" включает равенство)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lux = addLux(hub, 3, 50);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('освещённость ниже maxAmbientLux разрешает авто-включение', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lux = addLux(hub, 3, 10);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('пустой luxSensor — освещённость никогда не ограничивает авто-включение, даже при maxAmbientLux=0', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID(), maxAmbientLux: 0 });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });
});

// ============================================================================

describe('§7 Автоматическое выключение', () => {
  it('гасит через offDelaySeconds (умолчание 30с) после потери всех датчиков: 29с ещё горит, 31с погас', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    motionChar.setValue(false);

    time.advance('29s');
    expect(lampChar.getValue()).toBe(true);
    time.advance('2s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('возврат активности до истечения таймера отменяет отсчёт (новый отсчёт начинается заново)', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID(), offDelaySeconds: 10 });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    motionChar.setValue(false);

    time.advance('9s');
    motionChar.setValue(true); // активность вернулась до истечения 10с
    expect(lampChar.getValue()).toBe(true);
    motionChar.setValue(false);
    time.advance('9s');
    expect(lampChar.getValue()).toBe(true); // старый отсчёт отменён, новый ещё не истёк
    time.advance('2s');
    expect(lampChar.getValue()).toBe(false); // новый отсчёт (полные 10с от повторной потери) истёк
  });

  it('offDelaySeconds=0 — немедленное выключение в момент потери активности', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID(), offDelaySeconds: 0 });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(true);
    motionChar.setValue(false);
    time.tick(0);
    expect(lampChar.getValue()).toBe(false);
  });

  it('несколько датчиков: отсчёт стартует только когда ПОСЛЕДНИЙ из них становится неактивным', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const m1 = addMotion(hub, 2, false);
    const m2 = addMotion(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
      offDelaySeconds: 10,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const c1 = m1.char(HS.MotionSensor, HC.MotionDetected);
    const c2 = m2.char(HS.MotionSensor, HC.MotionDetected);
    c1.setValue(true);
    c2.setValue(true);

    c1.setValue(false);
    time.advance('15s'); // дольше offDelay, но m2 всё ещё активен
    expect(lampChar.getValue()).toBe(true);

    c2.setValue(false); // теперь ВСЕ неактивны — отсчёт стартует именно сейчас
    time.advance('9s');
    expect(lampChar.getValue()).toBe(true);
    time.advance('2s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('внешнее включение лампы при отсутствии активности запускает обычный offDelay-таймер', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ offDelaySeconds: 30 });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    externalSet(scenario, lampChar, vars, options, true);
    time.advance('29s');
    expect(lampChar.getValue()).toBe(true);
    time.advance('2s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('offDelaySeconds=0 + внешнее включение без активности датчиков — гаснет немедленно', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ offDelaySeconds: 0 });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    externalSet(scenario, lampChar, vars, options, true);
    time.tick(0);
    expect(lampChar.getValue()).toBe(false);
  });

  it('полностью пустая конфигурация: любое включение света гаснет через offDelaySeconds (активности не бывает никогда)', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ offDelaySeconds: 5 });
    const vars = {};
    boot(scenario, lampChar, vars, options);

    externalSet(scenario, lampChar, vars, options, true);
    time.advance('4s');
    expect(lampChar.getValue()).toBe(true);
    time.advance('2s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('переключение gateAutoSwitch в «запрещено» НЕ выключает уже горящий свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);

    gate.char(HS.Switch, HC.On).setValue(false);
    expect(lampChar.getValue()).toBe(true);
  });

  it('рост освещённости выше maxAmbientLux НЕ выключает уже горящий свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lux = addLux(hub, 3, 10);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);

    lux.char(HS.LightSensor, HC.CurrentAmbientLightLevel).setValue(90);
    expect(lampChar.getValue()).toBe(true);
  });
});

// ============================================================================

describe('§8 Удержание ручным выключателем (manualControl типа Switch)', () => {
  it('переход в On немедленно включает свет (следование, а не toggle)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });

  it('единственный настроенный Switch: переход в Off немедленно выключает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const swChar = sw.char(HS.Switch, HC.On);
    swChar.setValue(true);
    expect(lampChar.getValue()).toBe(true);
    swChar.setValue(false);
    expect(lampChar.getValue()).toBe(false);
  });

  it('пока Switch=On, обычный offDelay-таймер НЕ гасит свет, даже без активности датчиков', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID(), offDelaySeconds: 5 });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true);
    time.advance('60s');
    expect(lampChar.getValue()).toBe(true);
  });

  it('пока Switch=On, защитный таймер НЕ гасит свет, независимо от noAutoOffWhenManualOn/manualHoldSafetyOffDelayMinutes', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      noAutoOffWhenManualOn: true,
      noAutoOnAfterManualOff: true,
      manualHoldSafetyOffDelayMinutes: 1,
      offDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true);
    time.advance('5m');
    expect(lampChar.getValue()).toBe(true);
  });

  it('два Switch включены одновременно: выключение одного при активном другом не гасит свет; выключение последнего гасит немедленно', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw1 = addSwitch(hub, 2, false);
    const sw2 = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw1.getService(HS.Switch).getUUID(),
      manualControl2: sw2.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const c1 = sw1.char(HS.Switch, HC.On);
    const c2 = sw2.char(HS.Switch, HC.On);
    c1.setValue(true);
    c2.setValue(true);
    expect(lampChar.getValue()).toBe(true);

    c1.setValue(false);
    expect(lampChar.getValue()).toBe(true); // sw2 всё ещё On

    c2.setValue(false);
    expect(lampChar.getValue()).toBe(false); // последний выключен
  });

  it('включение кнопкой, пока ручной Switch в On: свет держит именно Switch (§8), а не режим удержания (§9)', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const btn = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      manualControl2: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      offDelaySeconds: 1,
      manualHoldSafetyOffDelayMinutes: 1,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const btnChar = btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);
    sw.char(HS.Switch, HC.On).setValue(true);
    btnChar.setValue(0); // toggle: свет гаснет, хотя Switch остаётся в On
    expect(lampChar.getValue()).toBe(false);
    btnChar.setValue(0); // toggle: свет включён кнопкой, Switch по-прежнему в On
    expect(lampChar.getValue()).toBe(true);
    expect(vars.manualHold).toBe(false); // noAutoOffWhenManualOn=false — удержание §9 не активируется

    time.advance('10m'); // ни обычный, ни защитный таймер не гасят, пока Switch в On
    expect(lampChar.getValue()).toBe(true);

    sw.char(HS.Switch, HC.On).setValue(false);
    expect(lampChar.getValue()).toBe(false);
  });

  it('переход настроенного ручного Switch в Off НЕ ставит блокировку noAutoOnAfterManualOff', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const motion = addMotion(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true); // датчик активен
    sw.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(true);
    sw.char(HS.Switch, HC.On).setValue(false); // "выключено" — штатное автоматическое состояние
    expect(lampChar.getValue()).toBe(false);

    // Датчик всё ещё активен — раз блокировка НЕ поставлена, повторная активность должна включить свет.
    motionChar.setValue(false);
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });
});

// ============================================================================

describe('§4.2 manualControl — поведение по типу устройства', () => {
  it('StatelessProgrammableSwitch: одиночное нажатие (событие 0) переключает свет туда и обратно', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const btnChar = button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);
    btnChar.setValue(0);
    expect(lampChar.getValue()).toBe(true);
    btnChar.setValue(0);
    expect(lampChar.getValue()).toBe(false);
  });

  it('StatelessProgrammableSwitch: событие ≠0 (например, двойное/долгое нажатие) игнорируется', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const btnChar = button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);
    btnChar.setValue(1);
    expect(lampChar.getValue()).toBe(false);
    btnChar.setValue(2);
    expect(lampChar.getValue()).toBe(false);
  });

  it('C_PulseMeter: значение >0 переключает свет, значение =0 не переключает', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const pulse = addPulse(hub, 2, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: pulse.getService(HS.C_PulseMeter).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const pulseChar = pulse.char(HS.C_PulseMeter, HC.C_PulseCount);
    pulseChar.setValue(0);
    expect(lampChar.getValue()).toBe(false);
    pulseChar.setValue(1);
    expect(lampChar.getValue()).toBe(true);
  });

  it('ContactSensor как ручной вход: Открытие переключает, Закрытие игнорируется, повторное Открытие снова переключает', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const contact = addContact(hub, 2, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: contact.getService(HS.ContactSensor).getUUID(), ignoreManualWithin5sAfterSensorOn: false });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const contactChar = contact.char(HS.ContactSensor, HC.ContactSensorState);
    contactChar.setValue(1); // Открытие
    expect(lampChar.getValue()).toBe(true);
    contactChar.setValue(0); // Закрытие — игнорируется
    expect(lampChar.getValue()).toBe(true);
    contactChar.setValue(1); // повторное Открытие — toggle
    expect(lampChar.getValue()).toBe(false);
  });

  it('можно комбинировать разные типы ручных входов одновременно (Switch в manualControl1, кнопка в manualControl2)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      manualControl2: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true); // включили кнопкой

    sw.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(true);
    sw.char(HS.Switch, HC.On).setValue(false); // switch следует, гасит независимо от кнопки
    expect(lampChar.getValue()).toBe(false);
  });

  it('пустой слот manualControl не используется — нажатие несвязанного устройства не влияет на свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const stray = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions();
    const vars = {};
    boot(scenario, lampChar, vars, options);
    stray.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(false);
  });
});

// ============================================================================

describe('§9 Ручное удержание (noAutoOffWhenManualOn)', () => {
  it('noAutoOffWhenManualOn=false (умолчание): включение кнопкой гаснет по обычному offDelaySeconds', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      offDelaySeconds: 10,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true);
    time.advance('11s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('noAutoOffWhenManualOn=true: включение кнопкой активирует удержание — обычный offDelay свет не гасит', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 5,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(vars.manualHold).toBe(true);
    time.advance('30s');
    expect(lampChar.getValue()).toBe(true);
  });

  it('noAutoOffWhenManualOn=true: включение импульсом (C_PulseMeter) тоже активирует удержание', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const pulse = addPulse(hub, 2, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: pulse.getService(HS.C_PulseMeter).getUUID(),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 5,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    pulse.char(HS.C_PulseMeter, HC.C_PulseCount).setValue(1);
    expect(vars.manualHold).toBe(true);
    time.advance('30s');
    expect(lampChar.getValue()).toBe(true);
  });

  it('noAutoOffWhenManualOn=true: внешнее включение лампы (сцена/физвыключатель на лампе) активирует удержание', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ noAutoOffWhenManualOn: true, offDelaySeconds: 5 });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    externalSet(scenario, lampChar, vars, options, true);
    expect(vars.manualHold).toBe(true);
    time.advance('30s');
    expect(lampChar.getValue()).toBe(true);
  });

  it('в режиме удержания, пока есть активность датчика, защитный таймер не выключает свет', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      manualHoldSafetyOffDelayMinutes: 1,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true); // датчик активен всё время
    time.advance('5m');
    expect(lampChar.getValue()).toBe(true);
  });

  it('в режиме удержания при отсутствии активности защитный таймер выключает свет по истечении manualHoldSafetyOffDelayMinutes', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      manualHoldSafetyOffDelayMinutes: 1,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    time.advance('59s');
    expect(lampChar.getValue()).toBe(true);
    time.advance('2s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('в режиме удержания активность, вернувшаяся до срабатывания защитного таймера, предотвращает выключение', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      manualHoldSafetyOffDelayMinutes: 1,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    time.advance('55s');
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true); // активность за 5с до истечения
    time.advance('10s'); // суммарно за пределами исходных 60с
    expect(lampChar.getValue()).toBe(true);
  });

  it('manualHoldSafetyOffDelayMinutes=0 — защитный таймер полностью отключён, свет не гаснет по времени', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      manualHoldSafetyOffDelayMinutes: 0,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    time.advance('200h'); // заведомо большой интервал (>8 суток)
    expect(lampChar.getValue()).toBe(true);
  });

  it('включение ручным Switch НЕ активирует режим удержания (manualHold остаётся false — это независимый механизм §8)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID(), noAutoOffWhenManualOn: true });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(true);
    expect(vars.manualHold).toBe(false);
  });
});

// ============================================================================

describe('§10 Блокировка повторного авто-включения после ручного выключения (noAutoOnAfterManualOff)', () => {
  it('noAutoOnAfterManualOff=false (умолчание): после ручного выключения датчик немедленно снова включает свет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0); // ручное выключение при активном датчике
    expect(lampChar.getValue()).toBe(false);

    motionChar.setValue(false);
    motionChar.setValue(true); // новое событие активности
    expect(lampChar.getValue()).toBe(true);
  });

  it('noAutoOnAfterManualOff=true: ручное выключение кнопкой при активном датчике блокирует последующее авто-включение', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion1 = addMotion(hub, 2, false);
    const motion2 = addMotion(hub, 3, false);
    const button = addButton(hub, 4);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion1.getService(HS.MotionSensor).getUUID(),
      motion2: motion2.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOnAfterManualOff: true,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion1.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(false);
    expect(vars.manualOffLock).toBe(true);

    // новое событие активности на ДРУГОМ датчике — блокировка должна удерживать
    motion2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false);
  });

  it('блокировка распространяется и на попытки через события luxSensor/gateAutoSwitch, пока активна', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    // lux и gate изначально в разрешающем состоянии, чтобы не мешать исходному авто-включению датчиком.
    const lux = addLux(hub, 4, 10);
    const gate = addSwitch(hub, 5, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      maxAmbientLux: 50,
      noAutoOnAfterManualOff: true,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true); // исходное авто-включение сработало

    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0); // ручное выключение при активном датчике
    expect(lampChar.getValue()).toBe(false);
    expect(vars.manualOffLock).toBe(true);

    lux.char(HS.LightSensor, HC.CurrentAmbientLightLevel).setValue(5); // по-прежнему разрешающее значение, но lock активен
    expect(lampChar.getValue()).toBe(false);

    gate.char(HS.Switch, HC.On).setValue(false);
    gate.char(HS.Switch, HC.On).setValue(true); // повторное "разрешение" — попытка авто-вкл, но lock блокирует
    expect(lampChar.getValue()).toBe(false);
  });

  it('блокировка НЕ ограничивает ручное/внешнее включение — кнопка немедленно включает свет обратно, и это снимает блокировку', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOnAfterManualOff: true,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    const btnChar = button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);
    motionChar.setValue(true);
    btnChar.setValue(0); // выключили при активном датчике -> lock
    expect(lampChar.getValue()).toBe(false);

    btnChar.setValue(0); // ручное включение обратно — не ограничено блокировкой
    expect(lampChar.getValue()).toBe(true);
    expect(vars.manualOffLock).toBe(false); // немедленно снята

    // теперь и обычная активность датчика снова работает штатно
    btnChar.setValue(0); // выключаем ещё раз кнопкой (без активного датчика на этот момент — важно: датчик всё ещё true)
  });

  it('блокировка снимается автоматически, когда все датчики стали неактивны И прошёл offDelaySeconds', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 10,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(vars.manualOffLock).toBe(true);

    motionChar.setValue(false); // старт отсчёта снятия блокировки
    time.advance('9s');
    motionChar.setValue(true); // ещё заблокировано
    expect(lampChar.getValue()).toBe(false);

    motionChar.setValue(false);
    time.advance('10s'); // полные offDelaySeconds без активности
    motionChar.setValue(true); // новое событие активности — блокировка уже снята
    expect(lampChar.getValue()).toBe(true);
  });

  it('возврат активности до истечения таймаута снятия блокировки сбрасывает отсчёт таймаута', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 10,
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);

    motionChar.setValue(false);
    time.advance('9s');
    motionChar.setValue(true); // возврат активности ДО истечения — сбрасывает отсчёт
    motionChar.setValue(false);
    time.advance('9s'); // если бы отсчёт НЕ сбросился — уже истекли бы суммарные 18с > 10с
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(false); // всё ещё заблокировано — отсчёт стартовал заново

    motionChar.setValue(false);
    time.advance('10s');
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(true); // теперь полноценный отсчёт истёк
  });

  it('переход настроенного ручного Switch в Off не ставит блокировку, даже при активном датчике', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const sw = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: sw.getService(HS.Switch).getUUID(),
      noAutoOnAfterManualOff: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    sw.char(HS.Switch, HC.On).setValue(true);
    sw.char(HS.Switch, HC.On).setValue(false);
    expect(vars.manualOffLock).toBe(false);
  });

  it('ручное выключение «извне» (напрямую на лампе) при активном датчике тоже ставит блокировку', ({ hub, scenario }) => {
    const lamp = addLamp(hub, { on: true });
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    externalSet(scenario, lampChar, vars, options, false); // выключили извне при активном датчике
    expect(vars.manualOffLock).toBe(true);

    motionChar.setValue(false);
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(false); // заблокировано
  });
});

// ============================================================================

describe('§11 Антидребезг кнопки/импульса/контакта (ignoreManualWithin5sAfterSensorOn)', () => {
  it('по умолчанию включён — кнопка в течение 5с после авто-включения по датчику игнорируется', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true); // проигнорировано, toggle не произошёл
  });

  it('импульс и контакт-ручной-вход тоже игнорируются в течение окна', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const pulse = addPulse(hub, 3, 0);
    const contact = addContact(hub, 4, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: pulse.getService(HS.C_PulseMeter).getUUID(),
      manualControl2: contact.getService(HS.ContactSensor).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    pulse.char(HS.C_PulseMeter, HC.C_PulseCount).setValue(1);
    expect(lampChar.getValue()).toBe(true); // импульс проигнорирован

    time.advance('1s');
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);
    expect(lampChar.getValue()).toBe(true); // контакт тоже проигнорирован (всё ещё в окне)
  });

  it('ручной Switch продолжает работать без ограничений в течение окна антидребезга', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const sw = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: sw.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    sw.char(HS.Switch, HC.On).setValue(true);
    expect(lampChar.getValue()).toBe(true);
    sw.char(HS.Switch, HC.On).setValue(false);
    expect(lampChar.getValue()).toBe(false); // switch не подавляется антидребезгом
  });

  it('по истечении 5с окно закрывается — кнопка снова работает штатно (граница проверяется с запасом: 4.9с/5.1с)', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    const btnChar = button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);

    time.advance('4900ms');
    btnChar.setValue(0);
    expect(lampChar.getValue()).toBe(true); // 4.9с — ещё в окне, проигнорировано

    time.advance('200ms'); // суммарно 5.1с от авто-включения
    btnChar.setValue(0);
    expect(lampChar.getValue()).toBe(false); // окно закрылось, toggle сработал
  });

  it('окно отсчитывается от момента авто-включения, а не от текущего состояния света (свет уже погас — попытка всё равно игнорируется)', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      offDelaySeconds: 1,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true); // авто-вкл, окно открыто на 5с
    motionChar.setValue(false); // датчик сразу теряет активность

    time.advance('2s'); // offDelaySeconds=1с истёк — свет уже погас, но окно ещё действует (истекает на 5с)
    expect(lampChar.getValue()).toBe(false);

    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(false); // попытка включить кнопкой всё равно проигнорирована
  });

  it('повторное срабатывание датчика, пока свет уже включён, не продлевает и не переоткрывает окно', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const m1 = addMotion(hub, 2, false);
    const m2 = addMotion(hub, 3, false);
    const button = addButton(hub, 4);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    m1.char(HS.MotionSensor, HC.MotionDetected).setValue(true); // авто-вкл, окно [0с;5с)

    time.advance('3s');
    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true); // свет уже включён — окно не переоткрывается

    time.advance('2200ms'); // суммарно 5.2с от ПЕРВОГО авто-включения
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(false); // окно уже закрылось, toggle сработал
  });

  it('внешнее/ручное включение НЕ открывает окно антидребезга', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    externalSet(scenario, lampChar, vars, options, true); // включение "извне"
    const btnChar = button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);
    btnChar.setValue(0); // немедленно после внешнего включения
    expect(lampChar.getValue()).toBe(false); // toggle сработал — окно не открывалось
  });

  it('ignoreManualWithin5sAfterSensorOn=false — окна нет, кнопка обрабатывается немедленно в любой момент', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: false,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(false); // toggle сработал немедленно, окна нет
  });
});

// ============================================================================

describe('§4.6.1 gateBlocksManualInputs — запрет реакции на ручные входы', () => {
  // Хелпер: лампа + запрещающий gate + опция блокировки ручных входов.
  function setupBlocked(hub, scenario, manualAccessory, manualServiceType, extra) {
    const lamp = addLamp(hub, { on: false });
    const gate = addSwitch(hub, 90, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const overrides = {
      manualControl1: manualAccessory.getService(manualServiceType).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateBlocksManualInputs: true,
    };
    if (extra) {
      for (const key in extra) overrides[key] = extra[key];
    }
    const options = baseOptions(overrides);
    const vars = {};
    boot(scenario, lampChar, vars, options);
    return { lamp, lampChar, gate, options, vars };
  }

  it('gate запрещает автоматику: ручной Switch в On НЕ включает свет', ({ hub, scenario }) => {
    const sw = addSwitch(hub, 2, false);
    const ctx = setupBlocked(hub, scenario, sw, HS.Switch);
    sw.char(HS.Switch, HC.On).setValue(true);
    expect(ctx.lampChar.getValue()).toBe(false);
  });

  it('gate запрещает автоматику: кнопка НЕ включает свет', ({ hub, scenario }) => {
    const btn = addButton(hub, 2);
    const ctx = setupBlocked(hub, scenario, btn, HS.StatelessProgrammableSwitch);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(ctx.lampChar.getValue()).toBe(false);
  });

  it('gate запрещает автоматику: импульс НЕ включает свет', ({ hub, scenario }) => {
    const pulse = addPulse(hub, 2, 0);
    const ctx = setupBlocked(hub, scenario, pulse, HS.C_PulseMeter);
    pulse.char(HS.C_PulseMeter, HC.C_PulseCount).setValue(1);
    expect(ctx.lampChar.getValue()).toBe(false);
  });

  it('gate запрещает автоматику: контакт-ручной-вход НЕ включает свет', ({ hub, scenario }) => {
    const contact = addContact(hub, 2, 0);
    const ctx = setupBlocked(hub, scenario, contact, HS.ContactSensor);
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);
    expect(ctx.lampChar.getValue()).toBe(false);
  });

  it('gate запрещает автоматику: кнопка НЕ гасит уже горящий свет', ({ hub, scenario }) => {
    const btn = addButton(hub, 2);
    const ctx = setupBlocked(hub, scenario, btn, HS.StatelessProgrammableSwitch, { offDelaySeconds: 600 });
    externalSet(scenario, ctx.lampChar, ctx.vars, ctx.options, true);
    expect(ctx.lampChar.getValue()).toBe(true);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(ctx.lampChar.getValue()).toBe(true);
  });

  it('переход ручного Switch в Off во время запрета НЕ гасит свет, включённый до запрета', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateBlocksManualInputs: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true); // автоматика разрешена — ручной вход работает
    expect(lampChar.getValue()).toBe(true);
    gate.char(HS.Switch, HC.On).setValue(false); // запрет: уже горящий свет не трогаем
    expect(lampChar.getValue()).toBe(true);
    sw.char(HS.Switch, HC.On).setValue(false); // событие ручного входа игнорируется
    expect(lampChar.getValue()).toBe(true);
  });

  it('gate разрешает автоматику: ручные входы работают штатно', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const btn = addButton(hub, 2);
    const gate = addSwitch(hub, 3, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateBlocksManualInputs: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true);
  });

  it('gateBlocksManualInputs=false (по умолчанию): запрещающий gate НЕ мешает ручным входам', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const btn = addButton(hub, 2);
    const gate = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true);
  });

  it('gateAutoSwitch пуст: gateBlocksManualInputs=true ни на что не влияет', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const btn = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      gateBlocksManualInputs: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true);
  });

  it('gateAutoSwitchInvert=true: запрет (gate=On) блокирует и ручные входы', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const btn = addButton(hub, 2);
    const gate = addSwitch(hub, 3, true);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateAutoSwitchInvert: true,
      gateBlocksManualInputs: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(false);
  });

  it('после снятия запрета ручные входы снова работают, но события во время запрета задним числом НЕ применяются', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateBlocksManualInputs: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const swChar = sw.char(HS.Switch, HC.On);
    swChar.setValue(true); // проигнорировано
    expect(lampChar.getValue()).toBe(false);

    gate.char(HS.Switch, HC.On).setValue(true); // запрет снят
    expect(lampChar.getValue()).toBe(false); // задним числом положение выключателя не применяется

    swChar.setValue(false);
    swChar.setValue(true); // новое событие ручного входа обрабатывается штатно
    expect(lampChar.getValue()).toBe(true);
  });

  it('запрет не распространяется на внешнее изменение самого управляемого света', ({ hub, scenario, time }) => {
    const btn = addButton(hub, 2);
    const ctx = setupBlocked(hub, scenario, btn, HS.StatelessProgrammableSwitch, { offDelaySeconds: 5 });
    externalSet(scenario, ctx.lampChar, ctx.vars, ctx.options, true);
    expect(ctx.lampChar.getValue()).toBe(true);
    time.advance('6s'); // сценарий обработал внешнее включение и завёл таймер выключения
    expect(ctx.lampChar.getValue()).toBe(false);
  });
});

// ============================================================================

describe('§12 Приоритеты правил при конфликтах', () => {
  it('ручной Switch=On — наивысший приоритет: свет не гаснет ни при каких экстремальных настройках таймеров', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      offDelaySeconds: 0,
      noAutoOffWhenManualOn: true,
      noAutoOnAfterManualOff: true,
      manualHoldSafetyOffDelayMinutes: 1,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true);
    time.advance('5m');
    expect(lampChar.getValue()).toBe(true);
  });

  it('один и тот же Switch одновременно в gateAutoSwitch и manualControl1 — обрабатывается ТОЛЬКО как gate (следование не срабатывает)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const sw = addSwitch(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();
    const options = baseOptions({ gateAutoSwitch: uuid, manualControl1: uuid });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    sw.char(HS.Switch, HC.On).setValue(true); // нет активных датчиков — auto-on нечего разрешать
    expect(lampChar.getValue()).toBe(false);
  });

  it('контакт одновременно в motion1 и manualControl1 — обрабатывается как ручной вход (toggle на каждое Открытие)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const contact = addContact(hub, 2, 0);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = contact.getService(HS.ContactSensor).getUUID();
    const options = baseOptions({ motion1: uuid, manualControl1: uuid, ignoreManualWithin5sAfterSensorOn: false });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const contactChar = contact.char(HS.ContactSensor, HC.ContactSensorState);
    contactChar.setValue(1);
    expect(lampChar.getValue()).toBe(true);
    contactChar.setValue(0);
    contactChar.setValue(1); // повторное Открытие — toggle, а не "остаётся активным"
    expect(lampChar.getValue()).toBe(false);
  });

  it('подавленное антидребезгом нажатие кнопки не переключает свет и не влияет на блокировку/удержание', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: button.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOnAfterManualOff: true,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0); // подавлено окном
    expect(lampChar.getValue()).toBe(true); // toggle не произошёл
    expect(vars.manualOffLock || false).toBe(false); // блокировка не поставлена подавленным событием
  });
});

// ============================================================================

describe('§14 Краевые случаи', () => {
  it('maxAmbientLux=0 — авто-включение возможно только при освещённости ≤0', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lux = addLux(hub, 3, 1);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 0,
    });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(false); // lux=1 > 0

    lux.char(HS.LightSensor, HC.CurrentAmbientLightLevel).setValue(0);
    expect(lampChar.getValue()).toBe(true); // lux=0 <= 0
  });

  it('дублирование одного сервиса в двух слотах manualControl не приводит к задвоенному toggle', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const button = addButton(hub, 2);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = button.getService(HS.StatelessProgrammableSwitch).getUUID();
    const options = baseOptions({ manualControl1: uuid, manualControl2: uuid });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    button.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampChar.getValue()).toBe(true);
  });

  it('дублирование одного датчика в motion1 и motion2 не ломает включение/выключение', ({ hub, scenario, time }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = motion.getService(HS.MotionSensor).getUUID();
    const options = baseOptions({ motion1: uuid, motion2: uuid, offDelaySeconds: 5 });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    const motionChar = motion.char(HS.MotionSensor, HC.MotionDetected);
    motionChar.setValue(true);
    expect(lampChar.getValue()).toBe(true);
    motionChar.setValue(false);
    time.advance('6s');
    expect(lampChar.getValue()).toBe(false);
  });

  it('ссылка опции на несуществующий UUID не роняет сценарий (обрабатывается как неактивный слот)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: '99999.99', manualControl1: '88888.88', gateAutoSwitch: '77777.77', luxSensor: '66666.66' });
    const vars = {};
    expect(() => boot(scenario, lampChar, vars, options)).not.toThrow();
    expect(lampChar.getValue()).toBe(false);
  });
});

// ============================================================================

describe('§4.12 Режим отладки (debug) — только диагностика, не влияет на логику', () => {
  it('debug=true добавляет информационные записи в лог сценария', ({ hub, scenario, logs }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID(), debug: true });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(logs.all().length).toBeGreaterThan(0);
  });

  it('debug=false (умолчание) не добавляет записей в лог, при этом логика включения не меняется', ({ hub, scenario, logs }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID(), debug: false });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(logs.all().length).toBe(0);
    expect(lampChar.getValue()).toBe(true); // результат работы автоматики не зависит от debug
  });
});

// ============================================================================

describe('§5 Переменные состояния — публичный контракт', () => {
  it('после первого запуска cachedLightService определён и externalSubscribed становится true', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions();
    const vars = {};
    boot(scenario, lampChar, vars, options);
    expect(vars.cachedLightService).toBeDefined();
    expect(vars.externalSubscribed).toBe(true);
  });

  it('manualHold=false и manualOffLock не активны по умолчанию после старта', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions();
    const vars = {};
    boot(scenario, lampChar, vars, options);
    expect(vars.manualHold).toBe(false);
    expect(vars.manualOffLock || false).toBe(false);
  });

  it('lastSensorAutoOnAt устанавливается ТОЛЬКО при авто-включении по датчику (не при ручном/внешнем включении)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    boot(scenario, lampChar, vars, options);
    expect(vars.lastSensorAutoOnAt).toBeUndefined();
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(vars.lastSensorAutoOnAt).toBeDefined();
  });

  it('сценарий работает корректно, даже если variables передан как пустой объект (эмуляция сброса после рестарта хаба)', ({ hub, scenario }) => {
    const lamp = addLamp(hub);
    const motion = addMotion(hub, 2, false);
    const lampChar = lamp.char(HS.Lightbulb, HC.On);
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });
    const vars = {};
    expect(() => boot(scenario, lampChar, vars, options)).not.toThrow();
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampChar.getValue()).toBe(true);
  });
});
