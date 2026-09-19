// ============================================================================
// BLACK-BOX приёмочные тесты сценария ExhaustFanAutomation (логическая часть).
//
// Тесты написаны ОТ СПЕЦИФИКАЦИИ (.tests/SPEC.md), БЕЗ обращения к исходному коду
// сценария (source/**), его README или иным его артефактам. Каждый describe
// соответствует разделу SPEC.md, каждый it — одному утверждению из него.
//
// Пункты SPEC.md §17 «Открытые вопросы» и §18 «Неспецифицированные зоны»
// сознательно НЕ оформлены как падающие тесты.
//
// Соглашения стенда — SPEC.md §19:
//   • собственная запись сценария в привязанную характеристику повторный trigger
//     не вызывает; внешнее изменение эмулируется явно (externalSet);
//   • время виртуальное, таймеры срабатывают только по time.advance(...).
// ============================================================================

// ---- Общие хелперы ---------------------------------------------------------

// Значения по умолчанию из SPEC.md §4.
function baseOptions(overrides) {
  const options = {
    motion1: '', motion2: '', motion3: '',
    contactInverted: false,
    humiditySensor: '',
    targetHumidity: 60,
    referenceHumiditySensor: '',
    referenceDelta: 5,
    humidityHighDelta: 10,
    humidityStartsFan: false,
    boostEnabled: false,
    normalSpeed: 50,
    boostSpeed: 100,
    manualControl1: '', manualControl2: '', manualControl3: '',
    gateAutoSwitch: '',
    gateAutoSwitchInvert: false,
    gateBlocksManualInputs: false,
    noAutoOffWhenManualOn: false,
    noAutoOnAfterManualOff: false,
    ignoreManualWithin5sAfterSensorOn: true,
    onDelaySeconds: 120,
    offDelaySeconds: 300,
    minRunMinutes: 0,
    cooldownMinutes: 0,
    maxRunMinutes: 180,
    notifyOnDryTimeout: false,
    notifyChannels: '',
    notifyClients: '',
    debug: false,
  };
  if (overrides) {
    for (const key in overrides) options[key] = overrides[key];
  }
  return options;
}

// Привязанный сервис вытяжки. По умолчанию Switch/On; Fan работает через Active (1/0).
function addFan(hub, cfg) {
  cfg = cfg || {};
  const type = cfg.type || HS.Switch;
  const chars = [];
  if (type === HS.Fan) chars.push({ type: HC.Active, value: cfg.on ? 1 : 0 });
  else chars.push({ type: HC.On, value: !!cfg.on });
  if (cfg.speed !== undefined) chars.push({ type: HC.RotationSpeed, value: cfg.speed });
  const acc = hub.addAccessory({
    id: 1, name: 'Вытяжка', room: 'Санузел',
    services: [{ type: type, characteristics: chars }],
  });
  return {
    acc: acc,
    type: type,
    on: acc.char(type, type === HS.Fan ? HC.Active : HC.On),
    speed: cfg.speed === undefined ? null : acc.char(type, HC.RotationSpeed),
  };
}

function isOn(fan) {
  const v = fan.on.getValue();
  return v === true || v === 1;
}

function addMotion(hub, id, active) {
  return hub.addAccessory({
    id: id, name: 'Движение ' + id, room: 'Санузел',
    services: [{ type: HS.MotionSensor, characteristics: [{ type: HC.MotionDetected, value: !!active }] }],
  });
}

function addOccupancy(hub, id, value) {
  return hub.addAccessory({
    id: id, name: 'Присутствие ' + id, room: 'Санузел',
    services: [{ type: HS.OccupancySensor, characteristics: [{ type: HC.OccupancyDetected, value: value || 0 }] }],
  });
}

function addContact(hub, id, value) {
  return hub.addAccessory({
    id: id, name: 'Контакт ' + id, room: 'Санузел',
    services: [{ type: HS.ContactSensor, characteristics: [{ type: HC.ContactSensorState, value: value || 0 }] }],
  });
}

function addHumidity(hub, id, value) {
  return hub.addAccessory({
    id: id, name: 'Влажность ' + id, room: 'Санузел',
    services: [{ type: HS.HumiditySensor, characteristics: [{ type: HC.CurrentRelativeHumidity, value: value || 0 }] }],
  });
}

function addSwitch(hub, id, on) {
  return hub.addAccessory({
    id: id, name: 'Выключатель ' + id, room: 'Санузел',
    services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: !!on }] }],
  });
}

function addButton(hub, id) {
  return hub.addAccessory({
    id: id, name: 'Кнопка ' + id, room: 'Санузел',
    services: [{ type: HS.StatelessProgrammableSwitch, characteristics: [{ type: HC.ProgrammableSwitchEvent, value: 0 }] }],
  });
}

function addPulse(hub, id, value) {
  return hub.addAccessory({
    id: id, name: 'Импульсы ' + id, room: 'Санузел',
    services: [{ type: HS.C_PulseMeter, characteristics: [{ type: HC.C_PulseCount, value: value || 0 }] }],
  });
}

// Короткие обёртки над характеристиками.
function motionChar(acc) { return acc.char(HS.MotionSensor, HC.MotionDetected); }
function humidityChar(acc) { return acc.char(HS.HumiditySensor, HC.CurrentRelativeHumidity); }
function switchChar(acc) { return acc.char(HS.Switch, HC.On); }
function contactChar(acc) { return acc.char(HS.ContactSensor, HC.ContactSensorState); }
function buttonChar(acc) { return acc.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent); }
function pulseChar(acc) { return acc.char(HS.C_PulseMeter, HC.C_PulseCount); }

function uuidOf(acc, serviceType) { return acc.getService(serviceType).getUUID(); }

// Первый вызов trigger() — старт хаба / сохранение сценария (onStart, SPEC §14).
function boot(scenario, fan, vars, options) {
  scenario.run({ source: fan.on, value: fan.on.getValue(), variables: vars, options: options, context: '' });
}

// Внешнее изменение самой вытяжки (приложение/сцена/голос/кнопка на корпусе):
// платформа обязана вызвать trigger() (SPEC §3.1), поэтому запись + повторный run.
function externalSet(scenario, fan, vars, options, on) {
  const raw = fan.type === HS.Fan ? (on ? 1 : 0) : !!on;
  fan.on.setValue(raw);
  scenario.run({ source: fan.on, value: raw, variables: vars, options: options, context: '' });
}

// ============================================================================

describe('§1/§3.1 Метаданные сценария (info-контракт)', () => {
  it('sourceServices содержит Switch, FanBasic и Fan', ({ scenario }) => {
    const services = scenario.info().sourceServices;
    expect(services).toContain('Switch');
    expect(services).toContain('FanBasic');
    expect(services).toContain('Fan');
  });

  it('sourceServices не содержит Outlet и Lightbulb', ({ scenario }) => {
    const services = scenario.info().sourceServices;
    expect(services).not.toContain('Outlet');
    expect(services).not.toContain('Lightbulb');
  });

  it('sourceCharacteristics содержит On и Active', ({ scenario }) => {
    const chars = scenario.info().sourceCharacteristics;
    expect(chars).toContain('On');
    expect(chars).toContain('Active');
  });

  it('onStart === true', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });

  it('name, description, version и author заполнены', ({ scenario }) => {
    const info = scenario.info();
    expect(typeof info.name).toBe('string');
    expect(info.name.length).toBeGreaterThan(0);
    expect(typeof info.description).toBe('string');
    expect(info.description.length).toBeGreaterThan(0);
    expect(typeof info.version).toBe('string');
    expect(info.version.length).toBeGreaterThan(0);
    expect(typeof info.author).toBe('string');
    expect(info.author.length).toBeGreaterThan(0);
  });

  it('функция compute не объявлена — сценарий только реагирует на события', ({ scenario }) => {
    expect(scenario.global('compute')).toBeUndefined();
  });
});

describe('§4 Опции — состав и значения по умолчанию', () => {
  it('датчики активности: motion1..3 = "" и contactInverted = false', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.motion1.value).toBe('');
    expect(options.motion2.value).toBe('');
    expect(options.motion3.value).toBe('');
    expect(options.contactInverted.value).toBe(false);
  });

  it('влажность: humiditySensor "", targetHumidity 60, referenceHumiditySensor "", referenceDelta 5, humidityHighDelta 10, humidityStartsFan false', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.humiditySensor.value).toBe('');
    expect(options.targetHumidity.value).toBe(60);
    expect(options.referenceHumiditySensor.value).toBe('');
    expect(options.referenceDelta.value).toBe(5);
    expect(options.humidityHighDelta.value).toBe(10);
    expect(options.humidityStartsFan.value).toBe(false);
  });

  it('скорость: boostEnabled false, normalSpeed 50, boostSpeed 100', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.boostEnabled.value).toBe(false);
    expect(options.normalSpeed.value).toBe(50);
    expect(options.boostSpeed.value).toBe(100);
  });

  it('ручные входы и рубильник: manualControl1..3 "", gateAutoSwitch "", gateAutoSwitchInvert false, gateBlocksManualInputs false', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.manualControl1.value).toBe('');
    expect(options.manualControl2.value).toBe('');
    expect(options.manualControl3.value).toBe('');
    expect(options.gateAutoSwitch.value).toBe('');
    expect(options.gateAutoSwitchInvert.value).toBe(false);
    expect(options.gateBlocksManualInputs.value).toBe(false);
  });

  it('ручное удержание: noAutoOffWhenManualOn false, noAutoOnAfterManualOff false, ignoreManualWithin5sAfterSensorOn true', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.noAutoOffWhenManualOn.value).toBe(false);
    expect(options.noAutoOnAfterManualOff.value).toBe(false);
    expect(options.ignoreManualWithin5sAfterSensorOn.value).toBe(true);
  });

  it('таймеры: onDelaySeconds 120, offDelaySeconds 300, minRunMinutes 0, cooldownMinutes 0, maxRunMinutes 180', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.onDelaySeconds.value).toBe(120);
    expect(options.offDelaySeconds.value).toBe(300);
    expect(options.minRunMinutes.value).toBe(0);
    expect(options.cooldownMinutes.value).toBe(0);
    expect(options.maxRunMinutes.value).toBe(180);
  });

  it('уведомления и отладка: notifyOnDryTimeout false, notifyChannels "", notifyClients "", debug false', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.notifyOnDryTimeout.value).toBe(false);
    expect(options.notifyChannels.value).toBe('');
    expect(options.notifyClients.value).toBe('');
    expect(options.debug.value).toBe(false);
  });

  it('диапазоны целочисленных опций соответствуют §4', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.targetHumidity.minValue).toBe(0);
    expect(options.targetHumidity.maxValue).toBe(100);
    expect(options.referenceDelta.maxValue).toBe(50);
    expect(options.humidityHighDelta.maxValue).toBe(50);
    expect(options.onDelaySeconds.maxValue).toBe(86400);
    expect(options.offDelaySeconds.maxValue).toBe(86400);
    expect(options.minRunMinutes.maxValue).toBe(1440);
    expect(options.cooldownMinutes.maxValue).toBe(1440);
    expect(options.maxRunMinutes.maxValue).toBe(10080);
  });
});

// ============================================================================

describe('§3.2 Подписки — учитывается только выбранный в опциях сервис', () => {
  it('движение на датчике, не назначенном ни в один слот, вытяжку не включает', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const chosen = addMotion(hub, 2, false);
    const stray = addMotion(hub, 3, false);
    const options = baseOptions({ motion1: uuidOf(chosen, HS.MotionSensor), onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(stray).setValue(true);
    expect(isOn(fan)).toBe(false);
  });

  it('влажность на датчике, не назначенном в опции, вытяжку не включает', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const chosen = addHumidity(hub, 2, 40);
    const stray = addHumidity(hub, 3, 40);
    const options = baseOptions({
      humiditySensor: uuidOf(chosen, HS.HumiditySensor),
      humidityStartsFan: true,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(stray).setValue(95);
    expect(isOn(fan)).toBe(false);
  });

  it('выключатель, не назначенный ни в gateAutoSwitch, ни в manualControl, вытяжку не трогает', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const stray = addSwitch(hub, 2, false);
    const options = baseOptions();
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(stray).setValue(true);
    expect(isOn(fan)).toBe(false);
  });

  it('ссылка слота на несуществующий сервис не ломает сценарий: рабочий слот включает и выключает вытяжку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: '999.99',
      motion2: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);     // мёртвый слот не сломал обработку рабочего

    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);    // мёртвый слот не считается вечной активностью
  });

  it('§16 один и тот же датчик в двух слотах результата не меняет', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const uuid = uuidOf(motion, HS.MotionSensor);
    const options = baseOptions({
      motion1: uuid, motion2: uuid,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });
});

describe('§3.3 Активные значения датчиков активности', () => {
  it('MotionSensor: MotionDetected = true — активность', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({ motion1: uuidOf(motion, HS.MotionSensor), onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('OccupancySensor: OccupancyDetected = 1 — активность', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const occ = addOccupancy(hub, 2, 0);
    const options = baseOptions({ motion1: uuidOf(occ, HS.OccupancySensor), onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    occ.char(HS.OccupancySensor, HC.OccupancyDetected).setValue(1);
    expect(isOn(fan)).toBe(true);
  });

  it('ContactSensor: ContactSensorState = 1 («Открыто») — активность при contactInverted = false', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const contact = addContact(hub, 2, 0);
    const options = baseOptions({ motion1: uuidOf(contact, HS.ContactSensor), onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    contactChar(contact).setValue(1);
    expect(isOn(fan)).toBe(true);
  });

  it('G06 contactInverted = true: «Закрыто» (0) считается занятостью', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const contact = addContact(hub, 2, 1);
    const options = baseOptions({
      motion1: uuidOf(contact, HS.ContactSensor),
      contactInverted: true,
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    contactChar(contact).setValue(0);
    expect(isOn(fan)).toBe(true);
  });

  it('G06 contactInverted = true: «Открыто» (1) активностью не считается', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const contact = addContact(hub, 2, 0);
    const options = baseOptions({
      motion1: uuidOf(contact, HS.ContactSensor),
      contactInverted: true,
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    contactChar(contact).setValue(1);
    expect(isOn(fan)).toBe(false);
  });
});

// ============================================================================

describe('§6 Накопление присутствия', () => {
  it('активность короче onDelaySeconds вытяжку не включает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({ motion1: uuidOf(motion, HS.MotionSensor), onDelaySeconds: 120 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('119s');
    expect(isOn(fan)).toBe(false);
  });

  it('присутствие дольше onDelaySeconds включает вытяжку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({ motion1: uuidOf(motion, HS.MotionSensor), onDelaySeconds: 120 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('119s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);
  });

  it('onDelaySeconds = 0 — включение при первой же активности', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({ motion1: uuidOf(motion, HS.MotionSensor), onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('короткий провал активности отсчёт накопления не сбрасывает (импульсный PIR)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 120,
      offDelaySeconds: 300,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('30s');
    motionChar(motion).setValue(true);
    time.advance('29s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);
  });

  it('отсутствие активности дольше offDelaySeconds снимает таймер накопления', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 600,
      offDelaySeconds: 300,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10s');
    motionChar(motion).setValue(false);
    time.advance('300s');   // сессия присутствия сброшена
    time.advance('400s');   // исходный таймер накопления истёк бы здесь
    expect(isOn(fan)).toBe(false);
  });

  it('после сброса сессии отсчёт накопления начинается заново с нуля', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 600,
      offDelaySeconds: 300,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10s');
    motionChar(motion).setValue(false);
    time.advance('310s');   // сессия сброшена
    motionChar(motion).setValue(true);
    time.advance('599s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);
  });

  it('ни один слот не заполнен — авто-включения по присутствию не бывает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({ onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('1h');
    expect(isOn(fan)).toBe(false);
  });

  it('слоты равноправны: датчик в motion3 включает вытяжку так же, как в motion1', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({ motion3: uuidOf(motion, HS.MotionSensor), onDelaySeconds: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('активность хотя бы одного датчика удерживает вытяжку: отсчёт выключения идёт только после потери всей активности', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const first = addMotion(hub, 2, false);
    const second = addMotion(hub, 3, false);
    const options = baseOptions({
      motion1: uuidOf(first, HS.MotionSensor),
      motion2: uuidOf(second, HS.MotionSensor),
      onDelaySeconds: 0,
      offDelaySeconds: 300,
      maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(first).setValue(true);
    motionChar(second).setValue(true);
    expect(isOn(fan)).toBe(true);

    motionChar(first).setValue(false);
    time.advance('400s');
    expect(isOn(fan)).toBe(true);

    motionChar(second).setValue(false);
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });
});

// ============================================================================

describe('§7 Влажность — пороги и условие выключения', () => {
  it('датчик влажности не выбран — выключение чисто по таймеру присутствия', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });

  it('влажность выше порога продолжает досушку после истечения таймера выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 80);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('400s');
    expect(isOn(fan)).toBe(true);
  });

  it('падение влажности до рабочего порога выключает вытяжку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 80);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('400s');
    humidityChar(hum).setValue(55);
    expect(isOn(fan)).toBe(false);
  });

  it('R26i сухая комната не мешает обычной логике: влажность ≤ порога — выключение по присутствию', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 45);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });

  it('значение ровно равно порогу — условие по влажности выполнено', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 60);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });

  it('R13/R14 контрольный ≥ целевой: рабочий порог = контрольный + referenceDelta', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 72);
    const ref = addHumidity(hub, 4, 70);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      referenceHumiditySensor: uuidOf(ref, HS.HumiditySensor),
      targetHumidity: 60, referenceDelta: 5,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    // 72 ≤ min(100, 70 + 5) = 75 — условие выполнено
    expect(isOn(fan)).toBe(false);
  });

  it('R14 контрольный < целевой: рабочий порог остаётся равным targetHumidity', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 65);
    const ref = addHumidity(hub, 4, 50);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      referenceHumiditySensor: uuidOf(ref, HS.HumiditySensor),
      targetHumidity: 60, referenceDelta: 5,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(true);   // 65 > 60

    humidityChar(hum).setValue(58);
    expect(isOn(fan)).toBe(false);
  });

  it('R14.1 событие контрольного датчика переоценивает выключение', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 72);
    const ref = addHumidity(hub, 4, 40);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      referenceHumiditySensor: uuidOf(ref, HS.HumiditySensor),
      targetHumidity: 60, referenceDelta: 5,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('400s');
    expect(isOn(fan)).toBe(true);   // порог 60, влажность 72

    humidityChar(ref).setValue(70); // порог стал 75 — досушка больше не нужна
    expect(isOn(fan)).toBe(false);
  });

  it('нечитаемый контрольный датчик: рабочий порог равен targetHumidity', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 65);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      referenceHumiditySensor: '999.99',
      targetHumidity: 60, referenceDelta: 5,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(true);     // 65 > 60 — порог не «уехал» вверх

    humidityChar(hum).setValue(58);
    expect(isOn(fan)).toBe(false);    // 58 ≤ 60 — порог не «уехал» и вниз
  });

  it('R28i мёртвый датчик влажности: условие считается выполненным, работает таймер присутствия', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: '999.99',
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });
});

// ============================================================================

describe('§8 Авто-включение — условия', () => {
  it('G01 humidityStartsFan: высокая влажность включает вытяжку без присутствия', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60, humidityHighDelta: 10,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(70);   // порог 60 + запас 10
    expect(isOn(fan)).toBe(true);
  });

  it('G01 выключен по умолчанию: высокая влажность сама по себе вытяжку не включает', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60, humidityHighDelta: 10,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(85);
    expect(isOn(fan)).toBe(false);
  });

  it('G01 граница: порог + запас − 1 не включает, порог + запас включает', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60, humidityHighDelta: 10,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(69);
    expect(isOn(fan)).toBe(false);
    humidityChar(hum).setValue(70);
    expect(isOn(fan)).toBe(true);
  });

  it('включение без активности датчиков сразу заводит таймер выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60, humidityHighDelta: 10,
      offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(70);
    expect(isOn(fan)).toBe(true);
    humidityChar(hum).setValue(50);   // условие по влажности выполнено
    expect(isOn(fan)).toBe(true);     // но таймер выключения ещё не истёк
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('G05 пауза после авто-выключения блокирует повторное авто-включение', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, cooldownMinutes: 10, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);    // авто-выключение, пауза началась

    time.advance('10s');
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);    // пауза ещё идёт
  });

  it('G05 cooldownMinutes = 0 — паузы нет, вытяжка включается снова сразу', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, cooldownMinutes: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);

    time.advance('10s');
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('G05 во время паузы ручное включение кнопкой работает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      onDelaySeconds: 0, offDelaySeconds: 300, cooldownMinutes: 10, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);    // авто-выключение, пауза идёт

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
  });

  it('G05 во время паузы внешнее включение работает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 3000, cooldownMinutes: 10, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('3000s');
    expect(isOn(fan)).toBe(false);

    externalSet(scenario, fan, vars, options, true);
    expect(isOn(fan)).toBe(true);
  });
});

// ============================================================================

describe('§9 Скорость и форсаж (G02)', () => {
  it('форсаж включён и влажность высокая — пишется boostSpeed', ({ hub, scenario }) => {
    const fan = addFan(hub, { type: HS.FanBasic, speed: 0 });
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true, boostEnabled: true,
      normalSpeed: 50, boostSpeed: 100,
      targetHumidity: 60, humidityHighDelta: 10,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(85);
    expect(isOn(fan)).toBe(true);
    expect(fan.speed.getValue()).toBe(100);
  });

  it('форсаж включён, влажность не высокая — пишется normalSpeed', ({ hub, scenario }) => {
    const fan = addFan(hub, { type: HS.FanBasic, speed: 0 });
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 62);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      boostEnabled: true, normalSpeed: 50, boostSpeed: 100,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    expect(fan.speed.getValue()).toBe(50);
  });

  it('падение влажности ниже «высокой» переводит работающую вытяжку на обычную скорость', ({ hub, scenario }) => {
    const fan = addFan(hub, { type: HS.FanBasic, speed: 0 });
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true, boostEnabled: true,
      normalSpeed: 40, boostSpeed: 90,
      targetHumidity: 60, humidityHighDelta: 10,
      maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(85);
    expect(fan.speed.getValue()).toBe(90);
    humidityChar(hum).setValue(65);   // выше целевой, но ниже «высокой»
    expect(isOn(fan)).toBe(true);
    expect(fan.speed.getValue()).toBe(40);
  });

  it('boostEnabled = false — скорость сценарием не трогается', ({ hub, scenario }) => {
    const fan = addFan(hub, { type: HS.FanBasic, speed: 33 });
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      boostEnabled: false, onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    expect(fan.speed.getValue()).toBe(33);
  });

  it('скорость не пишется, пока вытяжка выключена', ({ hub, scenario }) => {
    const fan = addFan(hub, { type: HS.FanBasic, speed: 33 });
    const hum = addHumidity(hub, 2, 50);
    const options = baseOptions({
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      boostEnabled: true, normalSpeed: 50, boostSpeed: 100,
      targetHumidity: 60, humidityHighDelta: 10,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(hum).setValue(85);   // вытяжка выключена (humidityStartsFan = false)
    expect(isOn(fan)).toBe(false);
    expect(fan.speed.getValue()).toBe(33);
  });

  it('у сервиса нет RotationSpeed — опция просто не действует, сценарий работает', ({ hub, scenario }) => {
    const fan = addFan(hub);   // Switch: RotationSpeed отсутствует
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      boostEnabled: true, onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });
});

// ============================================================================

describe('§10 Авто-выключение, минимальное время', () => {
  it('выключение через offDelaySeconds после потери активности', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('R27i возврат активности отменяет отсчёт выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('200s');
    motionChar(motion).setValue(true);
    time.advance('200s');
    expect(isOn(fan)).toBe(true);     // отсчёт сброшен возвратом активности

    motionChar(motion).setValue(false);
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('G04 minRunMinutes не даёт выключить вытяжку раньше срока', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, minRunMinutes: 10, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10s');
    motionChar(motion).setValue(false);
    time.advance('300s');             // работа 310 с < 600 с
    expect(isOn(fan)).toBe(true);
  });

  it('G04 minRunMinutes истёк — авто-выключение происходит', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, minRunMinutes: 5, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10s');
    motionChar(motion).setValue(false);
    time.advance('300s');             // работа 310 с > 300 с
    expect(isOn(fan)).toBe(false);
  });
});

describe('§10 Предельный таймер и блокировка после него', () => {
  it('R11 предел гасит вытяжку, несмотря на присутствие и высокую влажность', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 90);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('179s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('R27i предельный таймер не сбрасывается возвратом активности', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('30s');
    motionChar(motion).setValue(true);
    time.advance('89s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');               // ровно 180 с от включения
    expect(isOn(fan)).toBe(false);
  });

  it('maxRunMinutes = 0 — предела нет', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('24h');
    expect(isOn(fan)).toBe(true);
  });

  it('R24i предел действует и на ручное (внешнее) включение', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = baseOptions({ offDelaySeconds: 3000, maxRunMinutes: 3 });
    const vars = {};
    boot(scenario, fan, vars, options);

    externalSet(scenario, fan, vars, options, true);
    time.advance('179s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('R11.1 после предела авто-включение заблокировано, пока повод не исчез', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(isOn(fan)).toBe(false);    // сработал предел

    humidityChar(hum).setValue(85);   // повод по влажности есть, но стоит блокировка
    expect(isOn(fan)).toBe(false);
  });

  it('R11.1 блокировка снимается, когда повод исчез сам (нет активности + влажность в норме)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(isOn(fan)).toBe(false);

    motionChar(motion).setValue(false);
    time.advance('310s');             // активности нет дольше offDelaySeconds, влажность в норме
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('R11.1 ручное включение после предела работает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 3000, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(isOn(fan)).toBe(false);

    externalSet(scenario, fan, vars, options, true);
    time.advance('5s');
    expect(isOn(fan)).toBe(true);
  });
});

describe('§10 Уведомление о недосушке (G03)', () => {
  it('предел истёк, влажность выше порога, уведомление включено — сообщение отправлено', ({ hub, scenario, time, notify }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 85);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      notifyOnDryTimeout: true, notifyChannels: 'telegram',
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(isOn(fan)).toBe(false);
    expect(notify.sent.length).toBeGreaterThanOrEqual(1);
  });

  it('влажность в норме на момент предела — уведомления нет', ({ hub, scenario, time, notify }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 45);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      notifyOnDryTimeout: true, notifyChannels: 'telegram',
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(notify.sent.length).toBe(0);
  });

  it('notifyOnDryTimeout = false — уведомления нет даже при высокой влажности', ({ hub, scenario, time, notify }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 85);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      notifyOnDryTimeout: false, notifyChannels: 'telegram',
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(notify.sent.length).toBe(0);
  });

  it('клиенты указаны без канала — ошибка в лог', ({ hub, scenario, time, logs }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 85);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      notifyOnDryTimeout: true, notifyChannels: '', notifyClients: 'ivan',
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(logs.byLevel('error').length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================

describe('§11 Разрешение автоматики («рубильник»)', () => {
  it('рубильник в Off блокирует авто-включение', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);
  });

  it('рубильник в On разрешает авто-включение', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('gateAutoSwitchInvert = true: рубильник в Off разрешает авто-включение', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateAutoSwitchInvert: true,
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('gateAutoSwitchInvert = true: рубильник в On запрещает авто-включение выключенной вытяжки', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateAutoSwitchInvert: true,
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10m');
    expect(isOn(fan)).toBe(false);
  });

  it('запрет автоматики не гасит уже работающую вытяжку, таймеры продолжают работать', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);

    switchChar(gate).setValue(false);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });

  it('переход рубильника в «разрешено» при активных датчиках включает вытяжку', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      onDelaySeconds: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);

    switchChar(gate).setValue(true);
    expect(isOn(fan)).toBe(true);
  });
});

// ============================================================================

describe('§12 Ручные входы — типы и семантика', () => {
  it('ручной Switch: вытяжка повторяет его состояние', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const wall = addSwitch(hub, 2, false);
    const options = baseOptions({ manualControl1: uuidOf(wall, HS.Switch) });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);
    expect(isOn(fan)).toBe(true);
    switchChar(wall).setValue(false);
    expect(isOn(fan)).toBe(false);
  });

  it('два ручных Switch: вытяжка гаснет только с выключением последнего', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const first = addSwitch(hub, 2, false);
    const second = addSwitch(hub, 3, false);
    const options = baseOptions({
      manualControl1: uuidOf(first, HS.Switch),
      manualControl2: uuidOf(second, HS.Switch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(first).setValue(true);
    switchChar(second).setValue(true);
    switchChar(first).setValue(false);
    expect(isOn(fan)).toBe(true);
    switchChar(second).setValue(false);
    expect(isOn(fan)).toBe(false);
  });

  it('ручной Switch в On блокирует авто-выключение', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const wall = addSwitch(hub, 3, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(wall, HS.Switch),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);
    expect(isOn(fan)).toBe(true);
    time.advance('1h');
    expect(isOn(fan)).toBe(true);
  });

  it('ручной Switch в On блокирует предельный таймер', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const wall = addSwitch(hub, 2, false);
    const options = baseOptions({
      manualControl1: uuidOf(wall, HS.Switch),
      maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);
    time.advance('600s');
    expect(isOn(fan)).toBe(true);
  });

  it('контакт как ручной вход: 1 переключает, 0 игнорируется', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const contact = addContact(hub, 2, 0);
    const options = baseOptions({ manualControl1: uuidOf(contact, HS.ContactSensor), maxRunMinutes: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    contactChar(contact).setValue(1);
    expect(isOn(fan)).toBe(true);
    contactChar(contact).setValue(0);
    expect(isOn(fan)).toBe(true);
    contactChar(contact).setValue(1);
    expect(isOn(fan)).toBe(false);
  });

  it('кнопка: одиночное нажатие (0) переключает, двойное/долгое игнорируются', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const button = addButton(hub, 2);
    const options = baseOptions({ manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch), maxRunMinutes: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
    buttonChar(button).setValue(1);
    expect(isOn(fan)).toBe(true);
    buttonChar(button).setValue(2);
    expect(isOn(fan)).toBe(true);
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);
  });

  it('счётчик импульсов: любое значение > 0 переключает, 0 игнорируется', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const pulse = addPulse(hub, 2, 0);
    const options = baseOptions({ manualControl1: uuidOf(pulse, HS.C_PulseMeter), maxRunMinutes: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    pulseChar(pulse).setValue(1);
    expect(isOn(fan)).toBe(true);
    pulseChar(pulse).setValue(0);
    expect(isOn(fan)).toBe(true);
    pulseChar(pulse).setValue(3);
    expect(isOn(fan)).toBe(false);
  });
});

describe('§12 «Также не реагировать на ручные входы» (gateBlocksManualInputs)', () => {
  it('автоматика запрещена — событие кнопки игнорируется полностью', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);
  });

  it('автоматика запрещена — ручной Switch тоже игнорируется', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);
    const wall = addSwitch(hub, 3, false);
    const options = baseOptions({
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      manualControl1: uuidOf(wall, HS.Switch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);
    expect(isOn(fan)).toBe(false);
  });

  it('события, пришедшие во время запрета, задним числом не применяются', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);
    const wall = addSwitch(hub, 3, false);
    const options = baseOptions({
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      manualControl1: uuidOf(wall, HS.Switch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);   // проигнорировано
    switchChar(gate).setValue(true);   // автоматика снова разрешена
    expect(isOn(fan)).toBe(false);     // вытяжка не «догоняет» положение выключателя
  });

  it('прямое (внешнее) изменение самой вытяжки во время запрета обрабатывается штатно', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    externalSet(scenario, fan, vars, options, true);
    expect(isOn(fan)).toBe(true);
  });

  it('автоматика разрешена — ручные входы работают, несмотря на включённую опцию', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, true);
    const button = addButton(hub, 3);
    const options = baseOptions({
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
  });

  it('рубильник не выбран — опция не действует', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const button = addButton(hub, 2);
    const options = baseOptions({
      gateBlocksManualInputs: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
  });
});

describe('§12 Ручное удержание (noAutoOffWhenManualOn)', () => {
  it('включение кнопкой поднимает удержание — обычный таймер выключения не гасит вытяжку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const button = addButton(hub, 2);
    const options = baseOptions({
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
    time.advance('600s');
    expect(isOn(fan)).toBe(true);
  });

  it('при удержании остаётся только предельный таймер', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const button = addButton(hub, 2);
    const options = baseOptions({
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 300, maxRunMinutes: 10,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    time.advance('599s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('noAutoOffWhenManualOn = false — кнопочное включение гаснет по обычному таймеру', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const button = addButton(hub, 2);
    const options = baseOptions({
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: false,
      offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('внешнее включение (сцена/приложение) тоже поднимает удержание', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = baseOptions({
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    externalSet(scenario, fan, vars, options, true);
    time.advance('600s');
    expect(isOn(fan)).toBe(true);
  });

  it('удержание снимается при любом выключении вытяжки', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: true,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);           // включение кнопкой — удержание поднято
    externalSet(scenario, fan, vars, options, false);
    expect(isOn(fan)).toBe(false);          // выключение снимает удержание

    motionChar(motion).setValue(true);      // авто-включение по датчику удержание не поднимает
    expect(isOn(fan)).toBe(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);          // значит обычный таймер снова гасит
  });

  it('ручной Switch удержание не поднимает: перевод в Off гасит вытяжку сразу', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const wall = addSwitch(hub, 2, false);
    const options = baseOptions({
      manualControl1: uuidOf(wall, HS.Switch),
      noAutoOffWhenManualOn: true,
      maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);
    expect(isOn(fan)).toBe(true);
    switchChar(wall).setValue(false);
    expect(isOn(fan)).toBe(false);
  });
});

describe('§12 Блокировка после ручного выключения (noAutoOnAfterManualOff)', () => {
  it('ручное выключение при живом поводе блокирует авто-включение', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const button = addButton(hub, 4);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOnAfterManualOff: true,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    time.advance('6s');               // вне окна антидребезга
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);

    humidityChar(hum).setValue(85);   // повод по влажности есть, но стоит блокировка
    expect(isOn(fan)).toBe(false);
  });

  it('noAutoOnAfterManualOff = false — блокировки нет, повод снова включает вытяжку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const button = addButton(hub, 4);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOnAfterManualOff: false,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('6s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);

    humidityChar(hum).setValue(85);
    expect(isOn(fan)).toBe(true);
  });

  it('блокировка снимается, когда вытяжка погасла бы сама', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOnAfterManualOff: true,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('6s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);

    motionChar(motion).setValue(false);
    time.advance('310s');             // блокировка должна сняться
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
  });

  it('возврат активности до истечения таймаута держит блокировку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const button = addButton(hub, 4);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOnAfterManualOff: true,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('6s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);

    motionChar(motion).setValue(false);
    time.advance('200s');
    motionChar(motion).setValue(true);   // отсчёт сброшен
    time.advance('200s');
    humidityChar(hum).setValue(85);
    expect(isOn(fan)).toBe(false);       // блокировка всё ещё стоит
  });

  it('перевод ручного Switch в Off блокировку не ставит', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const wall = addSwitch(hub, 4, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      manualControl1: uuidOf(wall, HS.Switch),
      noAutoOnAfterManualOff: true,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);   // активность есть
    switchChar(wall).setValue(true);
    switchChar(wall).setValue(false);    // штатное состояние автоматики, не «ручное выключение»
    expect(isOn(fan)).toBe(false);

    humidityChar(hum).setValue(85);
    expect(isOn(fan)).toBe(true);
  });
});

describe('§12 Антидребезг (ignoreManualWithin5sAfterSensorOn)', () => {
  it('кнопка в пределах 5 секунд после авто-включения игнорируется', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      ignoreManualWithin5sAfterSensorOn: true,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    time.advance('3s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
  });

  it('после окна антидребезга кнопка снова работает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      ignoreManualWithin5sAfterSensorOn: true,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('6s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);
  });

  it('антидребезг выключен — кнопка работает сразу', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      ignoreManualWithin5sAfterSensorOn: false,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('1s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);
  });

  it('антидребезг не подавляет ручной Switch', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const wall = addSwitch(hub, 3, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(wall, HS.Switch),
      ignoreManualWithin5sAfterSensorOn: true,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    time.advance('2s');
    switchChar(wall).setValue(true);
    switchChar(wall).setValue(false);
    expect(isOn(fan)).toBe(false);
  });
});

describe('§13.4 Подавленное событие не порождает побочных эффектов', () => {
  it('антидребезг: подавленная кнопка не поднимает удержание', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: true,
      ignoreManualWithin5sAfterSensorOn: true,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    time.advance('3s');
    buttonChar(button).setValue(0);       // подавлено окном антидребезга
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // удержания нет — обычный таймер гасит
  });

  it('gateBlocksManualInputs: подавленная кнопка не поднимает удержание', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const gate = addSwitch(hub, 4, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      noAutoOffWhenManualOn: true,
      ignoreManualWithin5sAfterSensorOn: false,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    switchChar(gate).setValue(false);     // автоматика запрещена, ручные входы игнорируются
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // удержания нет — таймеры продолжают работать
  });

  it('gateBlocksManualInputs: подавленная кнопка не снимает блокировку noAutoOnAfterManualOff', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const button = addButton(hub, 4);
    const gate = addSwitch(hub, 5, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: true,
      noAutoOnAfterManualOff: true,
      ignoreManualWithin5sAfterSensorOn: false,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    buttonChar(button).setValue(0);       // ручное выключение при живом поводе — блокировка
    expect(isOn(fan)).toBe(false);

    switchChar(gate).setValue(false);     // автоматика запрещена
    buttonChar(button).setValue(0);       // событие подавлено: блокировку не снимает
    expect(isOn(fan)).toBe(false);

    switchChar(gate).setValue(true);      // попытка авто-включения по разрешению
    expect(isOn(fan)).toBe(false);
    humidityChar(hum).setValue(85);       // повод по влажности
    expect(isOn(fan)).toBe(false);        // блокировка всё ещё стоит
  });
});

// ============================================================================

describe('§14 Перезапуск хаба и сохранение сценария (onStart)', () => {
  it('R25i включённая вытяжка получает предельный таймер заново от момента старта', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { on: true });
    const options = baseOptions({ offDelaySeconds: 3000, maxRunMinutes: 3 });
    const vars = {};
    boot(scenario, fan, vars, options);

    time.advance('179s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('включённая вытяжка без активности получает обычный таймер выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { on: true });
    const options = baseOptions({ offDelaySeconds: 300, maxRunMinutes: 0 });
    const vars = {};
    boot(scenario, fan, vars, options);

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('выключенная вытяжка при уже активном датчике начинает накопление присутствия', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { on: false });
    const motion = addMotion(hub, 2, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 120, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    time.advance('119s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);
  });

  it('перезапуск не делает включение «ручным»: удержание не поднимается', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { on: true });
    const options = baseOptions({
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('перезапуск не ставит блокировку авто-включения: накопление присутствия начинается штатно', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { on: false });
    const motion = addMotion(hub, 2, true);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      noAutoOnAfterManualOff: true,
      onDelaySeconds: 120, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    time.advance('119s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);
  });

  it('повторный вызов trigger (пересохранение) не переключает вытяжку и не срабатывает таймером дважды', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    motionChar(motion).setValue(false);
    time.advance('100s');

    boot(scenario, fan, vars, options);   // пересохранение сценария
    expect(isOn(fan)).toBe(true);         // состояние задним числом не меняется

    time.advance('20m');
    expect(isOn(fan)).toBe(false);        // выключилась ровно один раз
    time.advance('20m');
    expect(isOn(fan)).toBe(false);        // и обратно не включилась
  });

  it('повторный вызов trigger при выключенной вытяжке и без активности её не включает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);
    boot(scenario, fan, vars, options);

    time.advance('10m');
    expect(isOn(fan)).toBe(false);
  });
});

describe('§2 Типы привязанного сервиса', () => {
  it('FanBasic управляется через On', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { type: HS.FanBasic });
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(fan.on.getValue()).toBe(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(fan.on.getValue()).toBe(false);
  });

  it('Fan управляется через Active (1 = включена, 0 = выключена)', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { type: HS.Fan });
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    expect(fan.on.getValue()).toBe(1);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(fan.on.getValue()).toBe(0);
  });
});

describe('§4 Режим отладки (R29i)', () => {
  it('debug = true — сценарий пишет сообщения в лог', ({ hub, scenario, time, logs }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
      debug: true,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(logs.all().length).toBeGreaterThanOrEqual(1);
  });

  it('debug = false — на том же сценарии лог остаётся пустым', ({ hub, scenario, time, logs }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
      debug: false,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(logs.all().length).toBe(0);
  });
});
