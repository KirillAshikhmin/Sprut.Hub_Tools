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
    noRunWhilePresent: false,
    airingMinutes: 5,
    airingIntervalHours: 0,
    notifyOnDryTimeout: false,
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

  it('режим присутствия: noRunWhilePresent false, airingMinutes 5 (§20/§21)', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.noRunWhilePresent).toBeTruthy();       // опция объявлена
    expect(options.noRunWhilePresent.type).toBe('Boolean');
    expect(options.noRunWhilePresent.value).toBe(false);  // по умолчанию режим выключен
    expect(options.airingMinutes).toBeTruthy();
    expect(options.airingMinutes.type).toBe('Integer');
    expect(options.airingMinutes.value).toBe(5);          // общая длительность §20 и §21
  });

  it('периодическая вентиляция: airingIntervalHours 0 (§21)', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.airingIntervalHours).toBeTruthy();     // опция объявлена
    expect(options.airingIntervalHours.type).toBe('Integer');
    expect(options.airingIntervalHours.value).toBe(0);    // по умолчанию механизм выключен
  });

  it('отдельной опции длительности у периодической вентиляции нет (§21)', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.airingDurationMinutes).toBeUndefined();
    expect(options.periodicAiringMinutes).toBeUndefined();
    expect(options.purgeMinutes).toBeUndefined();         // прежнее имя убрано вместе с ним
  });

  it('уведомления и отладка: notifyOnDryTimeout false, debug false', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.notifyOnDryTimeout).toBeTruthy();    // опция объявлена
    expect(options.notifyOnDryTimeout.type).toBe('Boolean');
    expect(options.notifyOnDryTimeout.value).toBe(false);
    expect(options.debug.value).toBe(false);
  });

  it('опций доставки уведомления в составе нет: notifyChannels, notifyClients, notifySilent', ({ scenario }) => {
    const options = scenario.info().options;
    expect(options.notifyChannels).toBeUndefined();
    expect(options.notifyClients).toBeUndefined();
    expect(options.notifySilent).toBeUndefined();
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
    expect(options.airingMinutes.minValue).toBe(0);
    expect(options.airingMinutes.maxValue).toBe(1440);
    expect(options.airingIntervalHours.minValue).toBe(0);
    expect(options.airingIntervalHours.maxValue).toBe(168);
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

  // §16 «повторный учёт не меняет результата». Обе проверки ниже подобраны так, чтобы
  // ДВОЙНОЙ учёт активности их изменил: иначе исход совпадает с обычным одно-слотовым
  // сценарием и утверждение проходит у любой реализации.
  it('§16 один и тот же датчик в двух слотах: возврат активности снимает отсчёт выключения целиком', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const uuid = uuidOf(motion, HS.MotionSensor);
    const options = baseOptions({
      motion1: uuid, motion2: uuid,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(false);   // потеря активности учтена по обоим слотам
    time.advance('200s');
    motionChar(motion).setValue(true);    // возврат активности отменяет отсчёт (§10)
    time.advance('200s');
    expect(isOn(fan)).toBe(true);         // «забытый» второй отсчёт погасил бы на 300-й секунде

    motionChar(motion).setValue(false);   // и обычное выключение по-прежнему работает
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('§16 один и тот же датчик в двух слотах: сброс сессии снимает накопление целиком', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const uuid = uuidOf(motion, HS.MotionSensor);
    const options = baseOptions({
      motion1: uuid, motion3: uuid,
      onDelaySeconds: 120, offDelaySeconds: 10, maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);    // сессия началась, таймер включения на 120 с
    time.advance('5s');
    motionChar(motion).setValue(false);   // таймер сброса сессии на 10 с
    time.advance('10s');                  // сессия обнулена, таймер включения снят (§6)

    time.advance('200s');
    expect(isOn(fan)).toBe(false);        // «забытый» второй таймер включения поднял бы вытяжку
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

  it('G05 пауза кончилась, присутствие держится — вытяжка возвращается сама, без нового фронта', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, cooldownMinutes: 15, maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    motionChar(motion).setValue(false);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);    // авто-выключение по таймеру — пауза началась

    motionChar(motion).setValue(true);  // человек вернулся; дальше фронтов на датчике нет
    expect(isOn(fan)).toBe(false);      // пауза не пускает

    // Смысл паузы — переждать и продолжить: по её окончании повод всё ещё жив,
    // и вытяжка обязана включиться сама, а не ждать следующего события.
    time.advance('14m');
    expect(isOn(fan)).toBe(false);      // пауза ещё идёт
    time.advance('1m');
    expect(isOn(fan)).toBe(true);       // ровно через cooldownMinutes — возврат
  });

  it('G05 после предельного таймера возврата нет: блокировка ждёт, пока повод исчезнет сам', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 0, offDelaySeconds: 300, cooldownMinutes: 15, maxRunMinutes: 10,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);  // присутствие держится всё время теста
    expect(isOn(fan)).toBe(true);
    time.advance('10m');
    expect(isOn(fan)).toBe(false);      // сработал предел — это не пауза

    time.advance('15m');
    expect(isOn(fan)).toBe(false);      // окончание паузы блокировку после предела не снимает
    time.advance('60m');
    expect(isOn(fan)).toBe(false);      // пока повод жив, возврата нет
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

// Один и тот же повод для уведомления о недосушке (§10): вытяжка включается по движению,
// гаснет по предельному таймеру через 45 минут, влажность 87 % при рабочем пороге 62 %.
// Значения выбраны различимыми, чтобы искать их в тексте записи по отдельности.
function fireDryTimeout(hub, scenario, time, extraOptions) {
  const fan = addFan(hub);
  const motion = addMotion(hub, 2, false);
  const hum = addHumidity(hub, 3, 87);
  const overrides = {
    motion1: uuidOf(motion, HS.MotionSensor),
    humiditySensor: uuidOf(hum, HS.HumiditySensor),
    targetHumidity: 62,
    notifyOnDryTimeout: true,
    onDelaySeconds: 0,
    maxRunMinutes: 45,
  };
  if (extraOptions) {
    for (const key in extraOptions) overrides[key] = extraOptions[key];
  }
  const options = baseOptions(overrides);
  const vars = {};
  boot(scenario, fan, vars, options);

  motionChar(motion).setValue(true);
  expect(isOn(fan)).toBe(true);
  time.advance('45m');
  expect(isOn(fan)).toBe(false);          // сработал предел — это и есть повод уведомить
  return fan;
}

// Доставка уведомления — `log.message(...)`, в стенде это отдельный уровень `message`.
// Уровень `message` сценарий использует только для этого уведомления, отладка идёт
// уровнями `info` и `error` (§19), поэтому отбор — по уровню. Привязываться к словам
// нельзя: формулировки вне контракта (§17.6).
function dryTimeoutRecords(logs) {
  return logs.byLevel('message');
}

describe('§10 Уведомление о недосушке (G03)', () => {
  it('предел истёк, влажность выше порога, уведомление включено — ровно одна запись уровня message', ({ hub, scenario, time, logs }) => {
    fireDryTimeout(hub, scenario, time);

    expect(dryTimeoutRecords(logs).length).toBe(1);     // один повод — одно уведомление
  });

  it('запись несёт факты: влажность, рабочий порог, сколько отработала, устройство, комната', ({ hub, scenario, time, logs }) => {
    const fan = fireDryTimeout(hub, scenario, time);

    const records = dryTimeoutRecords(logs);
    expect(records.length).toBe(1);
    const text = records[0].message;
    expect(text).toContain('87');                       // влажность
    expect(text).toContain('62');                       // рабочий порог
    expect(text).toContain('45');                       // сколько отработала, мин
    expect(text).toContain(uuidOf(fan.acc, fan.type));  // устройство — с идентификатором
    expect(text).toContain('Санузел');                  // комната
  });

  it('notifyOnDryTimeout = false — на том же поводе записи о недосушке нет', ({ hub, scenario, time, logs }) => {
    fireDryTimeout(hub, scenario, time, { notifyOnDryTimeout: false });

    expect(dryTimeoutRecords(logs).length).toBe(0);
  });

  it('влажность в норме на момент предела — записи о недосушке нет', ({ hub, scenario, time, logs }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 45);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      targetHumidity: 60,
      notifyOnDryTimeout: true,
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(isOn(fan)).toBe(false);
    expect(dryTimeoutRecords(logs).length).toBe(0);
  });

  it('датчик влажности не выбран — записи о недосушке нет', ({ hub, scenario, time, logs }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      notifyOnDryTimeout: true,
      onDelaySeconds: 0, maxRunMinutes: 3,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('180s');
    expect(isOn(fan)).toBe(false);
    expect(dryTimeoutRecords(logs).length).toBe(0);
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

  // Окно отсчитывается от момента АВТО-включения (§15) и не перезапускается событием,
  // которое состояние вытяжки не меняет.
  it('событие ручного Switch → On при уже включённой вытяжке окно антидребезга не сбрасывает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const wall = addSwitch(hub, 4, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      manualControl2: uuidOf(wall, HS.Switch),
      ignoreManualWithin5sAfterSensorOn: true,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);    // авто-включение — отсюда идут 5 секунд
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    switchChar(wall).setValue(true);      // вытяжка уже включена — состояние не меняется
    expect(isOn(fan)).toBe(true);

    time.advance('2s');                   // 3 с от авто-включения, а не от события Switch
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);         // всё ещё внутри окна — нажатие подавлено
  });

  it('через 6 секунд после авто-включения кнопка работает, несмотря на промежуточное событие Switch', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const wall = addSwitch(hub, 4, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      manualControl2: uuidOf(wall, HS.Switch),
      ignoreManualWithin5sAfterSensorOn: true,
      onDelaySeconds: 0, maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);    // авто-включение — отсюда идут 5 секунд
    time.advance('1s');
    switchChar(wall).setValue(true);      // вытяжка уже включена — состояние не меняется
    time.advance('5s');                   // 6 с от авто-включения: окно кончилось

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(false);        // кнопка снова переключает
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

  // «Подавленное событие не СТАВИТ блокировку» наблюдаемо ровно одним путём: погасить
  // вытяжку, не тронув блокировку, умеет только ручной Switch в Off (§12 — к нему
  // noAutoOnAfterManualOff не относится, это отдельно проверено в §12). Его событие
  // Switch → On идёт ДО подавленной кнопки, поэтому снять поставленную ею блокировку
  // ему нечем; на окно антидребезга это событие не влияет (§12, §15).
  it('антидребезг: подавленная кнопка не ставит блокировку noAutoOnAfterManualOff', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const hum = addHumidity(hub, 3, 50);
    const button = addButton(hub, 4);
    const wall = addSwitch(hub, 5, false);
    const options = baseOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(hum, HS.HumiditySensor),
      humidityStartsFan: true,
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      manualControl2: uuidOf(wall, HS.Switch),
      noAutoOnAfterManualOff: true,
      ignoreManualWithin5sAfterSensorOn: true,
      targetHumidity: 60, humidityHighDelta: 10,
      onDelaySeconds: 0, offDelaySeconds: 300, maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);    // авто-включение по датчику — окно антидребезга пошло
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    switchChar(wall).setValue(true);      // вытяжка уже включена — состояние не меняется
    time.advance('2s');
    buttonChar(button).setValue(0);       // подавлено окном антидребезга: блокировку ставить нельзя
    expect(isOn(fan)).toBe(true);

    switchChar(wall).setValue(false);     // гасим ручным Switch — блокировку он не ставит
    expect(isOn(fan)).toBe(false);

    humidityChar(hum).setValue(85);       // живой повод по влажности
    expect(isOn(fan)).toBe(true);         // блокировки нет — авто-включение работает
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
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);
    motionChar(motion).setValue(false);   // прежний отсчёт выключения пошёл отсюда: до 300 с
    time.advance('100s');

    // Пересохранение сценария: хаб исполняет скрипт заново со СВЕЖИМ variables
    // (spec §9). С прежним объектом вызов пошёл бы по ветке внешнего изменения,
    // и утверждения ниже прошли бы при любой реализации старта.
    boot(scenario, fan, {}, options);
    expect(isOn(fan)).toBe(true);         // состояние задним числом не меняется

    // Отсчёт §14 ведётся от момента старта, проверяем точной границей.
    time.advance('200s');                 // 300 с от потери активности — прежний таймер
    expect(isOn(fan)).toBe(true);         // сработать он уже не должен
    time.advance('99s');                  // 299 с от пересохранения
    expect(isOn(fan)).toBe(true);
    time.advance('1s');                   // ровно 300 с от пересохранения
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
    boot(scenario, fan, {}, options);
    boot(scenario, fan, {}, options);     // пересохранение — снова свежий variables

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

// ============================================================================

// Опции режима §20 «Не включать при присутствии».
// Явные значения вместо дефолтов §4, чтобы шаги теста читались в секундах:
//   onDelaySeconds 60  — сколько человек должен пробыть, чтобы визит засчитался;
//   offDelaySeconds 60 — подтверждение того, что человек действительно ушёл;
//   airingMinutes 5     — продувка 300 с;
//   minRunMinutes 0, maxRunMinutes 0 — пределы выключены, чтобы не мешать границам.
function modeOptions(overrides) {
  const base = {
    noRunWhilePresent: true,
    onDelaySeconds: 60,
    offDelaySeconds: 60,
    airingMinutes: 5,
    minRunMinutes: 0,
    maxRunMinutes: 0,
  };
  if (overrides) {
    for (const key in overrides) base[key] = overrides[key];
  }
  return baseOptions(base);
}

describe('§20 Режим «Не включать при присутствии» — режим выключен, поведение прежнее', () => {
  it('режим выключен — включение по присутствию работает как раньше', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      noRunWhilePresent: false,
      motion1: uuidOf(motion, HS.MotionSensor),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('59s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);        // накопление присутствия, §8 — как до режима
  });

  it('режим выключен — уход гасит вытяжку, продувка не начинается', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      noRunWhilePresent: false,
      motion1: uuidOf(motion, HS.MotionSensor),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);       // обычное авто-выключение

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);       // airingMinutes при выключенном режиме инертна
  });

  it('режим выключен — включение по влажности при человеке в комнате работает как раньше', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const humidity = addHumidity(hub, 3, 40);
    const options = modeOptions({
      noRunWhilePresent: false,
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60,
      offDelaySeconds: 600,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    humidityChar(humidity).setValue(95);
    expect(isOn(fan)).toBe(true);        // §8: высокая влажность — самостоятельный повод
  });
});

// ============================================================================

describe('§20 Режим «Не включать при присутствии» — запрет, пока человек внутри', () => {
  it('присутствие активно — авто-включение по присутствию не выполняется', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({ motion1: uuidOf(motion, HS.MotionSensor) });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);       // накопление набрано, но включения нет

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);       // и дальше, пока человек внутри
  });

  it('запрет сильнее влажности: humidityStartsFan + высокая влажность + присутствие → не включается', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const humidity = addHumidity(hub, 3, 40);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60,
      offDelaySeconds: 600,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    humidityChar(humidity).setValue(95);         // 95 ≥ 60 + 10 — «высокая»
    expect(isOn(fan)).toBe(false);

    time.advance('600s');
    expect(isOn(fan)).toBe(false);
  });

  it('влажность включает вытяжку в этом режиме, когда присутствия нет', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const humidity = addHumidity(hub, 3, 40);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60,
      offDelaySeconds: 600,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(humidity).setValue(95);
    expect(isOn(fan)).toBe(true);        // запрет привязан к присутствию, а не к режиму
  });

  it('работа по влажности прекращается, как только присутствие появилось', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const humidity = addHumidity(hub, 3, 40);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60,
      offDelaySeconds: 600,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    humidityChar(humidity).setValue(95);
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);       // работающая вытяжка гаснет сразу
  });
});

// ============================================================================

describe('§20 Режим «Не включать при присутствии» — продувка после ухода', () => {
  it('продувка начинается ровно по истечении Задержки выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({ motion1: uuidOf(motion, HS.MotionSensor) });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');                 // визит ровно onDelaySeconds — засчитан
    expect(isOn(fan)).toBe(false);

    motionChar(motion).setValue(false);
    time.advance('59s');
    expect(isOn(fan)).toBe(false);       // уход ещё не подтверждён
    time.advance('1s');
    expect(isOn(fan)).toBe(true);        // подтверждён — продувка
  });

  it('продувка длится ровно airingMinutes', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      offDelaySeconds: 600,              // заведомо больше продувки — не мешает границе
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('600s');
    expect(isOn(fan)).toBe(true);        // продувка началась здесь

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);       // ровно 300 с = airingMinutes
  });

  it('продувку не обрезает Задержка выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({ motion1: uuidOf(motion, HS.MotionSensor) });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);

    time.advance('61s');
    expect(isOn(fan)).toBe(true);        // 60 с без активности прошли, продувка идёт
    time.advance('238s');
    expect(isOn(fan)).toBe(true);        // 299 с продувки
    time.advance('1s');
    expect(isOn(fan)).toBe(false);
  });

  it('высокая влажность продувку не продлевает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const humidity = addHumidity(hub, 3, 95);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      targetHumidity: 60,
      humidityStartsFan: false,
      offDelaySeconds: 600,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('600s');
    expect(isOn(fan)).toBe(true);

    time.advance('300s');
    expect(isOn(fan)).toBe(false);       // только время продувки, влажность не при чём
  });

  it('продувка одна на визит — сама себя не перезапускает', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({ motion1: uuidOf(motion, HS.MotionSensor) });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    time.advance('300s');
    expect(isOn(fan)).toBe(false);       // продувка закончилась

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);       // нового визита не было — и продувки нет
  });

  it('короткий визит (10 с при накоплении 120 с) — продувки нет', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 120,
      offDelaySeconds: 30,               // 10 + 30 < 120: сессия гарантированно обнулена
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10s');
    motionChar(motion).setValue(false);
    time.advance('30s');
    expect(isOn(fan)).toBe(false);

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);       // визит не засчитан — продувки не было
  });

  it('airingMinutes = 0 — продувки нет', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      airingMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);       // режим сводится к «никогда не включаться»
  });
});

// ============================================================================

describe('§20 Режим «Не включать при присутствии» — возврат, предел, ручные входы', () => {
  it('возврат во время продувки — выключение сразу', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({ motion1: uuidOf(motion, HS.MotionSensor) });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);

    time.advance('10s');
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);       // «если опять зашёл и работала — выключаем»

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);       // и не возвращается, пока человек внутри
  });

  it('возврат во время продувки сильнее minRunMinutes', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      minRunMinutes: 30,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);

    time.advance('10s');                 // минимальное время работы далеко не вышло
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);
  });

  it('maxRunMinutes остаётся верхним пределом продувки', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      airingMinutes: 60,                  // продувка 3600 с
      maxRunMinutes: 10,                 // предел 600 с — раньше
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);

    time.advance('599s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);       // предельный таймер, а не конец продувки
  });

  it('ручной выключатель включает вытяжку при активном присутствии', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const wall = addSwitch(hub, 3, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(wall, HS.Switch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    switchChar(wall).setValue(true);
    expect(isOn(fan)).toBe(true);        // запрет — на автоматику, а не на человека
  });

  it('ручной выключатель в On удерживает вытяжку, пока человек внутри', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const wall = addSwitch(hub, 3, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(wall, HS.Switch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    switchChar(wall).setValue(true);
    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);        // §13.1 выше запрета §20
    time.advance('3600s');
    expect(isOn(fan)).toBe(true);
  });

  it('кнопка включает вытяжку при активном присутствии', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);
  });
});

// ============================================================================

describe('§20 Режим «Не включать при присутствии» — источник включения и удержание', () => {
  // --- §20.1a: обратный порядок. Пара с двумя утверждениями ниже («присутствие гасит»)
  // стоит рядом намеренно: по отдельности каждое из четырёх фиксировало бы просто исходное
  // состояние вытяжки, различает их только сопоставление порядков.

  it('§20.1a присутствие уже активно, включение кнопкой — вытяжка остаётся работать', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: false,      // удержание не поднимается: держать её нечему,
      minRunMinutes: 0,                  // кроме самого исключения §20.1a
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);   // человек уже внутри
    time.advance('10s');
    expect(isOn(fan)).toBe(false);       // режим не включает по присутствию (§20.1)

    buttonChar(button).setValue(0);      // включает сам, при себе
    expect(isOn(fan)).toBe(true);        // нажал при себе — режим не отменяет (§20.1a)

    time.advance('600s');
    expect(isOn(fan)).toBe(true);        // и таймеры её не гасят, пока человек внутри
  });

  it('§20.1a присутствие уже активно, включение извне (приложение/сцена) — остаётся работать', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      noAutoOffWhenManualOn: false,
      minRunMinutes: 0,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('10s');
    expect(isOn(fan)).toBe(false);

    externalSet(scenario, fan, vars, options, true);
    expect(isOn(fan)).toBe(true);        // работа пришла к присутствию — не гасим

    time.advance('600s');
    expect(isOn(fan)).toBe(true);
  });

  it('вытяжку, включённую кнопкой, присутствие гасит', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: false,      // удержание не поднимается
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);       // источник включения роли не играет
  });

  it('вытяжку, включённую извне (приложение/сцена), присутствие гасит', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      noAutoOffWhenManualOn: false,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    externalSet(scenario, fan, vars, options, true);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);
  });

  it('поднятое ручное удержание (noAutoOffWhenManualOn) присутствие не отменяет', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      noAutoOffWhenManualOn: true,       // кнопочное включение поднимает удержание (§12)
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);        // удержание — явное «держать включённой»
    time.advance('3600s');
    expect(isOn(fan)).toBe(true);
  });
});

// ============================================================================

describe('§20 Режим «Не включать при присутствии» — пауза, рубильник, минимальное время', () => {
  it('окончание продувки запускает паузу — следующая продувка её ждёт', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      cooldownMinutes: 10,               // 600 с паузы после авто-выключения
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);       // продувка закончилась — пауза пошла

    motionChar(motion).setValue(true);   // второй визит
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);       // 120 с из 600 — продувки нет
  });

  it('пауза выключена — второй визит даёт новую продувку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      cooldownMinutes: 0,                // контроль к предыдущему тесту
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    time.advance('300s');
    expect(isOn(fan)).toBe(false);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);        // ровно те же шаги, что и при паузе 10 мин
  });

  it('автоматика запрещена — продувки после ухода нет', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, false);   // рубильник в Off — автоматика запрещена (§11)
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);       // те же шаги при разрешённой автоматике дают продувку
    time.advance('300s');
    expect(isOn(fan)).toBe(false);
  });

  it('автоматика запрещена — возврат человека вытяжку не гасит', ({ hub, scenario }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const button = addButton(hub, 3);
    const gate = addSwitch(hub, 4, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      manualControl1: uuidOf(button, HS.StatelessProgrammableSwitch),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      gateBlocksManualInputs: false,     // ручные входы рубильник не трогает
      noAutoOffWhenManualOn: false,      // удержания нет — гасило бы §20.1
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    buttonChar(button).setValue(0);
    expect(isOn(fan)).toBe(true);

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(true);        // запрещённая автоматика не выключает (§11)
  });

  it('minRunMinutes больше airingMinutes продлевает продувку', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      airingMinutes: 5,                   // 300 с
      minRunMinutes: 10,                 // 600 с — нижняя граница любого сеанса
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);

    time.advance('300s');
    expect(isOn(fan)).toBe(true);        // продувка вышла, минимальное время нет
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);       // ровно minRunMinutes от включения
  });

  it('продувка при высокой влажности всё равно длится ровно airingMinutes', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const humidity = addHumidity(hub, 3, 40);
    const options = modeOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60,
      offDelaySeconds: 600,
      cooldownMinutes: 1,                // пауза мешает мгновенному возврату по влажности
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    motionChar(motion).setValue(true);
    humidityChar(humidity).setValue(95);
    expect(isOn(fan)).toBe(false);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('600s');
    expect(isOn(fan)).toBe(true);        // продувка, хотя повод по влажности тоже есть

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);       // сеанс ведётся как продувка, влажность не продлевает
  });

  it('старт хаба с включённой вытяжкой и активным присутствием: гасит и начинает сессию', ({ hub, scenario, time }) => {
    const fan = addFan(hub, { on: true });
    const motion = addMotion(hub, 2, true);      // человек внутри уже на старте
    const options = modeOptions({ motion1: uuidOf(motion, HS.MotionSensor) });
    const vars = {};
    boot(scenario, fan, vars, options);
    expect(isOn(fan)).toBe(false);               // человек внутри — вытяжка молчит

    time.advance('60s');                         // сессия присутствия идёт со старта
    expect(isOn(fan)).toBe(false);
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);                // визит засчитан — продувка после ухода
  });
});

// ============================================================================

// Опции §21 «Периодическая вентиляция». Явные значения вместо дефолтов §4,
// чтобы шаги теста читались в секундах:
//   airingIntervalHours 1 — интервал ожидания 3600 с;
//   airingMinutes 5       — вентиляция 300 с;
//   onDelaySeconds 60     — накопление присутствия, когда слот датчика заполнен;
//   offDelaySeconds 600   — заведомо больше вентиляции, чтобы выключение по её
//                           окончании не спутать с обычным авто-выключением (§10);
//   minRunMinutes 0, maxRunMinutes 0, cooldownMinutes 0 — пределы и пауза выключены,
//                           чтобы не мешать границам;
//   noRunWhilePresent false — режим §20 по умолчанию выключен.
function airingOptions(overrides) {
  const base = {
    airingIntervalHours: 1,
    airingMinutes: 5,
    onDelaySeconds: 60,
    offDelaySeconds: 600,
    minRunMinutes: 0,
    cooldownMinutes: 0,
    maxRunMinutes: 0,
    noRunWhilePresent: false,
  };
  if (overrides) {
    for (const key in overrides) base[key] = overrides[key];
  }
  return baseOptions(base);
}

describe('§21 Периодическая вентиляция — интервал и длительность', () => {
  it('вентиляция включается ровно по истечении интервала (§21.6: отсчёт от старта)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions();
    boot(scenario, fan, {}, options);

    time.advance('3599s');
    expect(isOn(fan)).toBe(false);        // интервал ещё не истёк
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // ровно 3600 с = airingIntervalHours
  });

  it('вентиляция длится ровно airingMinutes', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions();
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // ровно 300 с = airingMinutes
  });

  it('Задержка выключения вентиляцию не обрезает (§21.3)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    // offDelaySeconds 60 < вентиляции 300 с; датчик влажности не выбран, поэтому
    // условие §7 выполнено — обычное авто-выключение сработало бы на 60-й секунде.
    const options = airingOptions({ offDelaySeconds: 60 });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);

    time.advance('61s');
    expect(isOn(fan)).toBe(true);         // 60 с без активности прошли, вентиляция идёт
    time.advance('238s');
    expect(isOn(fan)).toBe(true);         // 299 с вентиляции
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // выключение по её окончании, не по задержке
  });

  it('вторая вентиляция — через интервал после окончания первой, пауза выключена (§21.1)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions({ cooldownMinutes: 0 });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // t = 3900 с: первая вентиляция кончилась

    time.advance('3599s');
    expect(isOn(fan)).toBe(false);        // t = 7499 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 7500 с = 3900 + 3600
  });
});

// ============================================================================

describe('§21 Периодическая вентиляция — выключенный механизм и присутствие', () => {
  it('airingIntervalHours = 0 — вытяжка не включается никогда', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions({ airingIntervalHours: 0, airingMinutes: 5 });
    boot(scenario, fan, {}, options);

    time.advance('168h');                 // весь верх диапазона опции
    expect(isOn(fan)).toBe(false);
    time.advance('168h');
    expect(isOn(fan)).toBe(false);        // и дальше — механизм выключен целиком
  });

  it('присутствие в момент истечения интервала — вентиляции нет (§21.2)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    // Накопление присутствия заведомо не наберётся за время теста, поэтому
    // обычное включение по присутствию (§8) картину не путает.
    const options = airingOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 86400,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);    // человек внутри
    time.advance('3600s');
    expect(isOn(fan)).toBe(false);        // интервал истёк, но активность есть
    time.advance('3600s');
    expect(isOn(fan)).toBe(false);        // пока человек внутри — вентиляции нет
  });

  it('те же шаги без присутствия дают вентиляцию', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = airingOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 86400,
    });
    const vars = {};
    boot(scenario, fan, vars, options);

    time.advance('3600s');                // датчик неактивен — единственное отличие
    expect(isOn(fan)).toBe(true);
  });
});

// ============================================================================

describe('§21 Периодическая вентиляция — обнуление отсчёта (§21.1)', () => {
  it('работа по присутствию переносит следующую вентиляцию на интервал вперёд', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = airingOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 60,
      offDelaySeconds: 60,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);         // t = 60 с: включение по присутствию (§8)
    motionChar(motion).setValue(false);
    time.advance('59s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // t = 120 с: обычное авто-выключение (§10)

    time.advance('3480s');
    expect(isOn(fan)).toBe(false);        // t = 3600 с: интервал от старта истёк, а вентиляции нет
    time.advance('119s');
    expect(isOn(fan)).toBe(false);        // t = 3719 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 3720 с = 120 + 3600: отсчёт от выключения
  });

  it('ручная работа переносит следующую вентиляцию на интервал вперёд', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const sw = addSwitch(hub, 2, false);
    const options = airingOptions({ manualControl1: uuidOf(sw, HS.Switch) });
    boot(scenario, fan, {}, options);

    switchChar(sw).setValue(true);
    expect(isOn(fan)).toBe(true);         // ручное включение
    time.advance('60s');
    switchChar(sw).setValue(false);
    expect(isOn(fan)).toBe(false);        // t = 60 с: ручной Switch в Off гасит сразу (§12)

    time.advance('3540s');
    expect(isOn(fan)).toBe(false);        // t = 3600 с: интервал от старта истёк, а вентиляции нет
    time.advance('59s');
    expect(isOn(fan)).toBe(false);        // t = 3659 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 3660 с = 60 + 3600
  });

  it('работа по влажности переносит следующую вентиляцию на интервал вперёд', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const humidity = addHumidity(hub, 2, 40);
    const options = airingOptions({
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      humidityStartsFan: true,
      targetHumidity: 60,
      offDelaySeconds: 60,
    });
    boot(scenario, fan, {}, options);

    humidityChar(humidity).setValue(95);  // 95 ≥ 60 + 10 — высокая, самостоятельный повод (§8)
    expect(isOn(fan)).toBe(true);
    humidityChar(humidity).setValue(50);  // помещение высушено — условие §7 выполнено
    time.advance('59s');
    expect(isOn(fan)).toBe(true);         // таймер выключения ещё идёт (§10)
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // t = 60 с: авто-выключение

    time.advance('3540s');
    expect(isOn(fan)).toBe(false);        // t = 3600 с: интервал от старта истёк, а вентиляции нет
    time.advance('59s');
    expect(isOn(fan)).toBe(false);        // t = 3659 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 3660 с = 60 + 3600
  });

  it('продувка §20 переносит следующую вентиляцию на интервал вперёд', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = airingOptions({
      noRunWhilePresent: true,
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 60,
      offDelaySeconds: 60,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);        // визит засчитан, вытяжка молчит (§20.1)
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);         // t = 120 с: продувка после ухода (§20.3)
    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // t = 420 с: продувка кончилась

    time.advance('3180s');
    expect(isOn(fan)).toBe(false);        // t = 3600 с: интервал от старта истёк, а вентиляции нет
    time.advance('419s');
    expect(isOn(fan)).toBe(false);        // t = 4019 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 4020 с = 420 + 3600
  });
});

// ============================================================================

describe('§21 Периодическая вентиляция — рубильник, пауза, пределы, влажность', () => {
  it('автоматика запрещена — периодической вентиляции нет (§21.4)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);   // рубильник в Off — автоматика запрещена (§11)
    const options = airingOptions({ gateAutoSwitch: uuidOf(gate, HS.Switch) });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);
    time.advance('3600s');
    expect(isOn(fan)).toBe(false);        // пока автоматика запрещена — вентиляции нет
  });

  it('автоматика разрешена — те же шаги дают вентиляцию', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, true);    // единственное отличие — рубильник в On
    const options = airingOptions({ gateAutoSwitch: uuidOf(gate, HS.Switch) });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);
  });

  it('пауза после вентиляции соблюдается: следующая её ждёт (§21.4)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    // Пауза 7200 с длиннее интервала 3600 с — иначе её действие ненаблюдаемо.
    // Контроль к этому утверждению — те же шаги при cooldownMinutes: 0 выше.
    const options = airingOptions({ cooldownMinutes: 120 });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);
    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // t = 3900 с: авто-выключение запустило паузу

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);        // t = 7500 с: интервал истёк, но пауза ещё идёт
  });

  it('minRunMinutes больше airingMinutes продлевает вентиляцию (§21.4)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions({
      airingMinutes: 5,                   // 300 с
      minRunMinutes: 10,                  // 600 с — нижняя граница любого сеанса
    });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);

    time.advance('300s');
    expect(isOn(fan)).toBe(true);         // вентиляция вышла, минимальное время нет
    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // ровно minRunMinutes от включения
  });

  it('maxRunMinutes обрывает вентиляцию (§21.4)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions({
      airingMinutes: 60,                  // 3600 с
      maxRunMinutes: 2,                   // 120 с — предел наступает раньше
    });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);

    time.advance('119s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // ровно maxRunMinutes от включения
  });

  it('высокая влажность вентиляцию не продлевает (§21.8)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const humidity = addHumidity(hub, 2, 95);
    const options = airingOptions({
      humiditySensor: uuidOf(humidity, HS.HumiditySensor),
      targetHumidity: 60,                 // 95 > 60 — условие §7 НЕ выполнено
      humidityStartsFan: false,           // влажность сама вытяжку не включает
    });
    boot(scenario, fan, {}, options);
    expect(isOn(fan)).toBe(false);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // только время вентиляции, влажность не при чём
  });
});

// ============================================================================

describe('§21 Периодическая вентиляция — присутствие во время неё и перезапуск', () => {
  it('присутствие во время вентиляции гасит её сразу при включённом режиме §20 (§21.5)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = airingOptions({
      noRunWhilePresent: true,
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 60,
      offDelaySeconds: 60,
    });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);         // комната пустая — периодическая вентиляция

    motionChar(motion).setValue(true);
    expect(isOn(fan)).toBe(false);        // человек внутри — вытяжка молчит (§20.1)
  });

  it('пересохранение сценария обнуляет отсчёт (§21.6)', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const options = airingOptions();
    boot(scenario, fan, {}, options);

    time.advance('3000s');                // до интервала осталось 600 с
    // Пересохранение: хаб исполняет скрипт заново со СВЕЖИМ variables (§14).
    boot(scenario, fan, {}, options);

    time.advance('600s');
    expect(isOn(fan)).toBe(false);        // t = 3600 с: интервал от первого старта не считается
    time.advance('2999s');
    expect(isOn(fan)).toBe(false);        // t = 6599 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 6600 с = 3000 + 3600 от пересохранения
  });
});

// ============================================================================

describe('§21.10/§20.16 Окончание сеанса, когда выключить не дали', () => {
  it('вентиляция: активность к её окончанию → сеанс уходит под обычный таймер выключения', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    // Накопление присутствия заведомо не наберётся — включение по присутствию картину не путает.
    // maxRunMinutes 0: если сеанс так и остался вентиляцией, гасить его станет нечем,
    // и вытяжка останется включённой навсегда — именно это утверждение и различает.
    const options = airingOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 86400,
      offDelaySeconds: 60,
      maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(true);         // t = 3600 с: вентиляция

    motionChar(motion).setValue(true);    // активность вернулась во время вентиляции
    time.advance('300s');
    expect(isOn(fan)).toBe(true);         // t = 3900 с: срок вышел, но выключить не дали

    motionChar(motion).setValue(false);   // активность ушла — пошёл обычный отсчёт (§10)
    time.advance('59s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // t = 3960 с = уход + offDelaySeconds
  });

  it('продувка: активность к её окончанию при подвешенном режиме → тот же общий путь', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const gate = addSwitch(hub, 3, true);
    // Рубильник переводится в Off уже во время продувки: по §20.12 режим подвешен, поэтому
    // вернувшееся присутствие вытяжку не гасит (§20.1 не действует) — единственная достижимая
    // через шов помеха окончанию продувки.
    const options = airingOptions({
      noRunWhilePresent: true,
      motion1: uuidOf(motion, HS.MotionSensor),
      gateAutoSwitch: uuidOf(gate, HS.Switch),
      onDelaySeconds: 60,
      offDelaySeconds: 60,
      maxRunMinutes: 0,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    time.advance('60s');                  // визит засчитан
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);         // t = 120 с: продувка после ухода

    time.advance('10s');
    switchChar(gate).setValue(false);     // t = 130 с: автоматика запрещена, режим подвешен
    time.advance('10s');
    motionChar(motion).setValue(true);    // t = 140 с: человек вернулся, вытяжку не гасит
    expect(isOn(fan)).toBe(true);

    time.advance('280s');
    expect(isOn(fan)).toBe(true);         // t = 420 с: срок продувки вышел, выключить не дали

    motionChar(motion).setValue(false);   // активность ушла — обычный отсчёт (§10)
    time.advance('59s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // t = 480 с = уход + offDelaySeconds
  });
});

// ============================================================================

describe('§21.9 Пропуск по активности — следующая попытка через полный интервал', () => {
  it('активность в момент истечения: вентиляции нет ни тогда, ни сразу после ухода', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = airingOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 86400,
      offDelaySeconds: 60,
    });
    boot(scenario, fan, {}, options);

    time.advance('3000s');
    motionChar(motion).setValue(true);
    time.advance('600s');
    expect(isOn(fan)).toBe(false);        // t = 3600 с: интервал истёк при активности — пропуск

    time.advance('400s');
    motionChar(motion).setValue(false);   // t = 4000 с: человек ушёл
    time.advance('200s');
    expect(isOn(fan)).toBe(false);        // t = 4200 с: вентиляция в очереди не стояла
  });

  it('следующая попытка — ровно через полный интервал от момента пропуска', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    const options = airingOptions({
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 86400,
      offDelaySeconds: 60,
    });
    boot(scenario, fan, {}, options);

    time.advance('3000s');
    motionChar(motion).setValue(true);
    time.advance('600s');                 // t = 3600 с: пропуск по активности
    time.advance('400s');
    motionChar(motion).setValue(false);   // t = 4000 с: человек ушёл

    time.advance('3199s');
    expect(isOn(fan)).toBe(false);        // t = 7199 с
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 7200 с = 3600 + 3600 — от пропуска, не от ухода

    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // и длится обычные airingMinutes
  });
});

// ============================================================================

describe('§21.11 Просьба о вентиляции живёт до ближайшей попытки авто-включения', () => {
  it('рубильник разрешил автоматику — отложенная вентиляция случается тогда же', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);   // автоматика запрещена (§11)
    const options = airingOptions({ gateAutoSwitch: uuidOf(gate, HS.Switch) });
    boot(scenario, fan, {}, options);

    time.advance('3600s');
    expect(isOn(fan)).toBe(false);        // интервал истёк, но включать нельзя
    time.advance('1400s');
    expect(isOn(fan)).toBe(false);        // t = 5000 с: ждёт разрешения, а не следующего интервала

    switchChar(gate).setValue(true);      // t = 5000 с: автоматика разрешена
    expect(isOn(fan)).toBe(true);         // просьба дожила до ближайшей попытки
  });

  it('отложенная вентиляция длится обычные airingMinutes', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const gate = addSwitch(hub, 2, false);
    const options = airingOptions({ gateAutoSwitch: uuidOf(gate, HS.Switch) });
    boot(scenario, fan, {}, options);

    time.advance('5000s');
    switchChar(gate).setValue(true);
    expect(isOn(fan)).toBe(true);

    time.advance('299s');
    expect(isOn(fan)).toBe(true);
    time.advance('1s');
    expect(isOn(fan)).toBe(false);        // ровно 300 с от разрешения
  });
});

// ============================================================================

describe('§21.10a2 Принудительное выключение при присутствии паузу не заводит', () => {
  it('вошёл во время продувки — выключилась, вышел — проветривание проходит, паузу не ждёт', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    // Пауза 600 с заведомо длиннее всей дорожки: если бы принудительное выключение
    // её заводило, продувка за второй визит попала бы под запрет. Контроль к утверждению —
    // «окончание продувки запускает паузу» (§20.11) на той же cooldownMinutes: 10.
    const options = airingOptions({
      noRunWhilePresent: true,
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 60,
      offDelaySeconds: 60,
      cooldownMinutes: 10,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    time.advance('60s');                  // визит засчитан
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);         // t = 120 с: продувка за первый визит

    time.advance('80s');
    motionChar(motion).setValue(true);    // t = 200 с: человек вернулся
    expect(isOn(fan)).toBe(false);        // принудительное выключение (§20.4)

    time.advance('60s');                  // t = 260 с: второй визит засчитан
    motionChar(motion).setValue(false);
    time.advance('59s');
    expect(isOn(fan)).toBe(false);
    time.advance('1s');
    expect(isOn(fan)).toBe(true);         // t = 320 с: продувка прошла, паузы нет
  });

  it('обычное окончание продувки паузу заводит — та же cooldownMinutes', ({ hub, scenario, time }) => {
    const fan = addFan(hub);
    const motion = addMotion(hub, 2, false);
    // Контрольная половина пары: отличие от теста выше только в том, ЧЕМ закончился
    // первый сеанс — своим сроком, а не приходом человека.
    const options = airingOptions({
      noRunWhilePresent: true,
      motion1: uuidOf(motion, HS.MotionSensor),
      onDelaySeconds: 60,
      offDelaySeconds: 60,
      cooldownMinutes: 10,
    });
    boot(scenario, fan, {}, options);

    motionChar(motion).setValue(true);
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(true);         // t = 120 с: продувка за первый визит
    time.advance('300s');
    expect(isOn(fan)).toBe(false);        // t = 420 с: кончилась своим сроком — пауза пошла

    motionChar(motion).setValue(true);    // второй визит
    time.advance('60s');
    motionChar(motion).setValue(false);
    time.advance('60s');
    expect(isOn(fan)).toBe(false);        // t = 540 с: 120 с из 600 — продувку держит пауза
  });
});
