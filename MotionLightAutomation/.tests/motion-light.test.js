// Интеграционные тесты для сценария "💡 Автоматизация света по движению".
//
// Тесты написаны от README (../README.md) — каждый it проверяет конкретное
// утверждение спецификации. Если тест падает, значит код или README
// расходятся — это сигнал что что-то надо чинить.

// ---------------------------------------------------------------------------
// helpers — общий каркас фикстуры и обёртки над DSL
// ---------------------------------------------------------------------------

function makeLamp(hub, id) {
  return hub.addAccessory({
    id, name: 'Лампа', room: 'Кухня',
    services: [{ type: HS.Lightbulb, characteristics: [{ type: HC.On, value: false }] }],
  });
}

function makeMotion(hub, id) {
  return hub.addAccessory({
    id, name: 'Датчик движения', room: 'Кухня',
    services: [{ type: HS.MotionSensor, characteristics: [{ type: HC.MotionDetected, value: false }] }],
  });
}

function makeOccupancy(hub, id) {
  return hub.addAccessory({
    id, name: 'Датчик присутствия', room: 'Кухня',
    services: [{ type: HS.OccupancySensor, characteristics: [{ type: HC.OccupancyDetected, value: 0 }] }],
  });
}

function makeContact(hub, id) {
  return hub.addAccessory({
    id, name: 'Контактный датчик', room: 'Кухня',
    services: [{ type: HS.ContactSensor, characteristics: [{ type: HC.ContactSensorState, value: 0 }] }],
  });
}

function makeLuxSensor(hub, id, initialLux) {
  return hub.addAccessory({
    id, name: 'Датчик света', room: 'Кухня',
    services: [{ type: HS.LightSensor, characteristics: [{ type: HC.CurrentAmbientLightLevel, value: initialLux }] }],
  });
}

function makeSwitch(hub, id, initialOn) {
  return hub.addAccessory({
    id, name: 'Выключатель', room: 'Кухня',
    services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: initialOn === true }] }],
  });
}

function makeButton(hub, id) {
  return hub.addAccessory({
    id, name: 'Кнопка', room: 'Кухня',
    services: [{
      type: HS.StatelessProgrammableSwitch,
      characteristics: [{ type: HC.ProgrammableSwitchEvent, value: 0 }],
    }],
  });
}

function makePulseMeter(hub, id) {
  return hub.addAccessory({
    id, name: 'Импульсный вход', room: 'Кухня',
    services: [{
      type: HS.C_PulseMeter,
      characteristics: [{ type: HC.C_PulseCount, value: 0 }],
    }],
  });
}

function baseOptions(overrides) {
  const o = {
    motion1: '', motion2: '', motion3: '',
    manualControl1: '', manualControl2: '', manualControl3: '',
    luxSensor: '', maxAmbientLux: 50,
    gateAutoSwitch: '', gateAutoSwitchInvert: false,
    noAutoOffWhenManualOn: false,
    noAutoOnAfterManualOff: false,
    ignoreManualWithin5sAfterSensorOn: true,
    offDelaySeconds: 30,
    manualHoldSafetyOffDelayMinutes: 240,
    debug: false,
  };
  if (overrides) for (const k of Object.keys(overrides)) o[k] = overrides[k];
  return o;
}

function freshVars() {
  return {
    cachedLightService: undefined,
    externalSubscribed: false,
    manualHold: false,
    offTimerId: undefined,
    manualHoldSafetyTimerId: undefined,
    lastSensorAutoOnAt: undefined,
    manualOffLock: false,
    manualOffLockTimerId: undefined,
  };
}

// "Сцена" или хаб поменяли привязанный On — эмулируем поведение хаба:
// меняем значение и вызываем trigger со ссылкой на характеристику.
function externalTriggerLampOn(scenario, lampOnChar, value, vars, options) {
  lampOnChar.setValueSilent(value);
  scenario.run({ source: lampOnChar, value, variables: vars, options });
}

// ---------------------------------------------------------------------------
// README §"Автоматическое включение"
// "Свет включается автоматически, когда:
//   1. Есть активность хотя бы по одному датчику из motion1 ... motion3.
//   2. Разрешено автоматическое включение (gateAutoSwitch, если выбран).
//   3. Освещенность не выше maxAmbientLux (если выбран luxSensor).
//   4. Свет в текущий момент выключен."
// ---------------------------------------------------------------------------

describe('README §"Автоматическое включение"', () => {
  it('MotionSensor: MotionDetected=true → лампа включается', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ motion1: motion.getService(HS.MotionSensor).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    expect(lampOn.getValue()).toBe(true);
  });

  it('OccupancySensor: OccupancyDetected=1 → лампа включается', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const occ = makeOccupancy(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ motion1: occ.getService(HS.OccupancySensor).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    occ.char(HS.OccupancySensor, HC.OccupancyDetected).setValue(1);

    expect(lampOn.getValue()).toBe(true);
  });

  it('ContactSensor: ContactSensorState=1 ("Открыто") → лампа включается (README §"Важные замечания" п.3)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const contact = makeContact(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ motion1: contact.getService(HS.ContactSensor).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);

    expect(lampOn.getValue()).toBe(true);
  });

  it('активен хотя бы один из выбранных датчиков (motion2 активен, motion1 нет) → включает', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const m1 = makeMotion(hub, 21);
    const m2 = makeMotion(hub, 22);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    expect(lampOn.getValue()).toBe(true);
  });

  it('gateAutoSwitch=false → авто-включение НЕ срабатывает', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const gate = makeSwitch(hub, 30, false);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    expect(lampOn.getValue()).toBe(false);
  });

  it('gateAutoSwitchInvert=true: gate=ВКЛ запрещает авто-включение', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const gate = makeSwitch(hub, 30, true);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      gateAutoSwitch: gate.getService(HS.Switch).getUUID(),
      gateAutoSwitchInvert: true,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    expect(lampOn.getValue()).toBe(false);
  });

  it('lux > maxAmbientLux → авто-включение блокируется', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lux = makeLuxSensor(hub, 40, 1000);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    expect(lampOn.getValue()).toBe(false);
  });

  it('lux ≤ maxAmbientLux → авто-включение проходит', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lux = makeLuxSensor(hub, 40, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      luxSensor: lux.getService(HS.LightSensor).getUUID(),
      maxAmbientLux: 50,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    expect(lampOn.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Автоматическое выключение"
// "Свет выключается по offDelaySeconds, если:
//    - все выбранные датчики неактивны;
//    - не включен режим удержания после ручного включения.
//  Если свет был включен внешним действием (например сценой), и датчики
//  неактивны, сценарий также запускает этот же таймер выключения."
// ---------------------------------------------------------------------------

describe('README §"Автоматическое выключение"', () => {
  it('гасит через offDelaySeconds после потери всех датчиков', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      offDelaySeconds: 30,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);

    time.advance('29s');
    expect(lampOn.getValue()).toBe(true);
    time.advance('1s');
    expect(lampOn.getValue()).toBe(false);
  });

  it('offDelaySeconds=0 → выключение немедленно при потере активности', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      offDelaySeconds: 0,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);

    expect(lampOn.getValue()).toBe(false);
  });

  it('внешнее включение лампы при неактивных датчиках запускает offTimer', ({ hub, scenario, time }) => {
    // README: "Если свет был включен внешним действием (например сценой),
    // и датчики неактивны, сценарий также запускает этот же таймер выключения."
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      offDelaySeconds: 10,
    });

    // "сцена" включает лампу — это вызывает trigger с value=true
    externalTriggerLampOn(scenario, lampOn, true, vars, options);
    expect(lampOn.getValue()).toBe(true);

    time.advance('9s');
    expect(lampOn.getValue()).toBe(true);
    time.advance('1s');
    expect(lampOn.getValue()).toBe(false);
  });

  it('новая активность отменяет запланированный offTimer', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      offDelaySeconds: 30,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);

    time.advance('20s');
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);  // активность вернулась

    time.advance('40s');                                              // прошло достаточно времени
    expect(lampOn.getValue()).toBe(true);                              // но лампа всё ещё горит
  });
});

// ---------------------------------------------------------------------------
// README §"Ручные входы"
// "Switch: привязанная лампа повторяет состояние On.
//  StatelessProgrammableSwitch (событие 0): переключение света.
//  C_PulseMeter (C_PulseCount > 0): переключение света."
// ---------------------------------------------------------------------------

describe('README §"Ручные входы"', () => {
  it('Switch: ON → лампа повторяет состояние (вкл)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const sw = makeSwitch(hub, 30, false);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    sw.char(HS.Switch, HC.On).setValue(true);

    expect(lampOn.getValue()).toBe(true);
  });

  it('Switch: OFF → лампа повторяет состояние (выкл)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const sw = makeSwitch(hub, 30, true);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    lampOn.setValueSilent(true);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID() });

    scenario.run({ source: lampOn, value: true, variables: vars, options });
    sw.char(HS.Switch, HC.On).setValue(false);

    expect(lampOn.getValue()).toBe(false);
  });

  it('StatelessProgrammableSwitch event=0 → toggle (выключенная → включается)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);

    expect(lampOn.getValue()).toBe(true);
  });

  it('StatelessProgrammableSwitch event=0 → toggle (включённая → выключается)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    lampOn.setValueSilent(true);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID() });

    scenario.run({ source: lampOn, value: true, variables: vars, options });
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);

    expect(lampOn.getValue()).toBe(false);
  });

  it('C_PulseMeter с C_PulseCount>0 → toggle света', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const pulse = makePulseMeter(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: pulse.getService(HS.C_PulseMeter).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    pulse.char(HS.C_PulseMeter, HC.C_PulseCount).setValue(1);

    expect(lampOn.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Ручной режим (manualHold) для кнопок и импульсов"
// "Если включена опция Не отключать свет автоматически после ручного включения,
//  при включении света кнопкой или импульсом активируется удержание:
//    - стандартный таймер выключения не гасит свет;
//    - при отсутствии активности запускается защитный таймер
//      manualHoldSafetyOffDelayMinutes;
//    - по срабатыванию защитного таймера свет выключается, если активности
//      все еще нет."
// ---------------------------------------------------------------------------

describe('README §"Ручной режим (manualHold) для кнопок и импульсов"', () => {
  it('noAutoOffWhenManualOn=true: кнопка → стандартный offDelay не гасит', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 5,
      manualHoldSafetyOffDelayMinutes: 240,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    expect(lampOn.getValue()).toBe(true);
    expect(vars.manualHold).toBe(true);

    time.advance('10s');  // прошло больше offDelay
    expect(lampOn.getValue()).toBe(true);
  });

  it('manualHoldSafetyOffDelayMinutes: защитный таймер гасит свет после кнопки', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOffWhenManualOn: true,
      manualHoldSafetyOffDelayMinutes: 1,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('59s');
    expect(lampOn.getValue()).toBe(true);
    time.advance('2s');
    expect(lampOn.getValue()).toBe(false);
    expect(vars.manualHold).toBe(false);
  });

  it('noAutoOffWhenManualOn=true: внешнее включение лампы → ручное удержание, обычный offDelay не действует', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 5,
      manualHoldSafetyOffDelayMinutes: 1,
    });

    externalTriggerLampOn(scenario, lampOn, true, vars, options);
    expect(lampOn.getValue()).toBe(true);
    expect(vars.manualHold).toBe(true);

    time.advance('30s');
    expect(lampOn.getValue()).toBe(true);
  });

  it('noAutoOffWhenManualOn=true: внешнее включение лампы → защитный таймер всё-таки гасит', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOffWhenManualOn: true,
      offDelaySeconds: 5,
      manualHoldSafetyOffDelayMinutes: 1,
    });

    externalTriggerLampOn(scenario, lampOn, true, vars, options);
    time.advance('59s');
    expect(lampOn.getValue()).toBe(true);
    time.advance('2s');
    expect(lampOn.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Удержание выключателем (manualControl* типа Switch)"
// "Если в manualControl* привязан Switch, привязанная лампа повторяет его
//  состояние:
//    - пока выключатель в On — авто-выключение по offDelaySeconds и защитный
//      таймер manualHoldSafetyOffDelayMinutes отключены, свет не гаснет
//      по таймауту;
//    - при переводе выключателя в Off свет гасится сразу; если в других
//      слотах manualControl* ещё остался выключатель в On, свет остаётся
//      включённым;
//    - ограничения работают независимо от опций noAutoOffWhenManualOn и
//      manualHoldSafetyOffDelayMinutes — они относятся только к кнопкам
//      и импульсам."
// ---------------------------------------------------------------------------

describe('README §"Удержание выключателем"', () => {
  it('Switch=On + потеря occupancy → свет НЕ гаснет по offDelaySeconds', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const sw = makeSwitch(hub, 30, true);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    lampOn.setValueSilent(true);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: sw.getService(HS.Switch).getUUID(),
      offDelaySeconds: 5,
    });

    scenario.run({ source: lampOn, value: true, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);

    time.advance('60s');
    expect(lampOn.getValue()).toBe(true);
  });

  it('Switch=On + manualHoldSafetyOffDelayMinutes=1 → свет НЕ гаснет защитным таймером', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const sw = makeSwitch(hub, 30, false);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      manualControl1: sw.getService(HS.Switch).getUUID(),
      noAutoOffWhenManualOn: true,
      manualHoldSafetyOffDelayMinutes: 1,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    sw.char(HS.Switch, HC.On).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('5m');
    expect(lampOn.getValue()).toBe(true);
    expect(vars.manualHold).toBe(true);
  });

  it('Switch=On + внешнее включение лампы при неактивных датчиках НЕ запускает offTimer', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const sw = makeSwitch(hub, 30, true);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: sw.getService(HS.Switch).getUUID(),
      offDelaySeconds: 10,
    });

    externalTriggerLampOn(scenario, lampOn, true, vars, options);
    expect(lampOn.getValue()).toBe(true);

    time.advance('30s');
    expect(lampOn.getValue()).toBe(true);
  });

  it('Switch=On → Off → свет гаснет сразу', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const sw = makeSwitch(hub, 30, false);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: sw.getService(HS.Switch).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    sw.char(HS.Switch, HC.On).setValue(true);
    expect(lampOn.getValue()).toBe(true);

    sw.char(HS.Switch, HC.On).setValue(false);
    expect(lampOn.getValue()).toBe(false);
  });

  it('Два Switch в manualControl: один Off, другой ON → лампа остаётся включённой', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const sw1 = makeSwitch(hub, 31, false);
    const sw2 = makeSwitch(hub, 32, false);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      manualControl1: sw1.getService(HS.Switch).getUUID(),
      manualControl2: sw2.getService(HS.Switch).getUUID(),
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    sw1.char(HS.Switch, HC.On).setValue(true);
    sw2.char(HS.Switch, HC.On).setValue(true);
    expect(lampOn.getValue()).toBe(true);

    sw1.char(HS.Switch, HC.On).setValue(false);
    expect(lampOn.getValue()).toBe(true);  // sw2 ещё в On — свет остаётся

    sw2.char(HS.Switch, HC.On).setValue(false);
    expect(lampOn.getValue()).toBe(false);  // все Off — свет гаснет
  });
});

// ---------------------------------------------------------------------------
// README §"Антидребезг кнопки/импульса после авто-включения"
// "Если включена опция Игнорировать кнопку/импульс 5 секунд после включения по
//  датчику, то в течение 5 секунд после авто-включения:
//    - события от кнопки и импульсного входа игнорируются полностью
//      (и включение, и выключение);
//    - ручной Switch продолжает работать без подавления."
// ---------------------------------------------------------------------------

describe('README §"Антидребезг кнопки/импульса"', () => {
  it('кнопка в окне 5с после авто-включения по датчику — игнорируется', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: true,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampOn.getValue()).toBe(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('2s');
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampOn.getValue()).toBe(true);  // кнопка не выключила
  });

  it('импульс (C_PulseMeter) в окне 5с после авто-включения — игнорируется', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const pulse = makePulseMeter(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: pulse.getService(HS.C_PulseMeter).getUUID(),
      ignoreManualWithin5sAfterSensorOn: true,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('2s');
    pulse.char(HS.C_PulseMeter, HC.C_PulseCount).setValue(1);
    expect(lampOn.getValue()).toBe(true);  // импульс не выключил
  });

  it('ручной Switch продолжает работать в окне 5с (без подавления)', ({ hub, scenario, time }) => {
    // README: "ручной Switch продолжает работать без подавления".
    // Sprut.Hub шлёт уведомление при изменении значения, поэтому начальное
    // состояние Switch должно отличаться от того, в которое мы его переводим.
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const sw = makeSwitch(hub, 30, true);  // изначально выключатель ВКЛ
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: sw.getService(HS.Switch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: true,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('2s');
    sw.char(HS.Switch, HC.On).setValue(false);   // выключатель → OFF
    expect(lampOn.getValue()).toBe(false);        // README: Switch не подавляется
  });

  it('после 5с окно закрывается — кнопка снова работает', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: true,
      noAutoOffWhenManualOn: false,
      offDelaySeconds: 600,  // чтобы лампа не успела сама погаснуть
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('6s');  // окно прошло
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);
    expect(lampOn.getValue()).toBe(false);  // кнопка выключила
  });

  it('ignoreManualWithin5sAfterSensorOn=false: окна нет, кнопка работает сразу', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      ignoreManualWithin5sAfterSensorOn: false,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });
    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);

    expect(lampOn.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Ручные входы" — Датчик открытия (контакт)
// "Датчик открытия (контакт): ведёт себя как кнопка — реагирует только на
//  Открытие (переход в состояние «Открыто»), каждое открытие переключает свет
//  (toggle). Закрытие игнорируется, удержания нет."
// ---------------------------------------------------------------------------

describe('README §"Ручные входы" — Датчик открытия (контакт)', () => {
  it('ContactSensor: Открытие (1) при выключенном свете → включает (toggle)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const contact = makeContact(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: contact.getService(HS.ContactSensor).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);

    expect(lampOn.getValue()).toBe(true);
  });

  it('ContactSensor: Закрытие (0) игнорируется — свет не меняется', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const contact = makeContact(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: contact.getService(HS.ContactSensor).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);  // Открытие → вкл
    expect(lampOn.getValue()).toBe(true);

    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(0);  // Закрытие → игнор
    expect(lampOn.getValue()).toBe(true);
  });

  it('ContactSensor: повторное Открытие → выключает (toggle)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const contact = makeContact(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({ manualControl1: contact.getService(HS.ContactSensor).getUUID() });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);  // 1-е Открытие → вкл
    expect(lampOn.getValue()).toBe(true);

    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(0);  // Закрытие → игнор
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);  // 2-е Открытие → выкл
    expect(lampOn.getValue()).toBe(false);
  });

  it('ContactSensor: Открытие в окне 5с после авто-включения по датчику — игнорируется', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const contact = makeContact(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      manualControl1: contact.getService(HS.ContactSensor).getUUID(),
      ignoreManualWithin5sAfterSensorOn: true,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampOn.getValue()).toBe(true);
    scenario.run({ source: lampOn, value: true, variables: vars, options });

    time.advance('2s');
    contact.char(HS.ContactSensor, HC.ContactSensorState).setValue(1);  // Открытие в окне
    expect(lampOn.getValue()).toBe(true);  // контакт не выключил
  });
});

// ---------------------------------------------------------------------------
// README §"Запрет авто-включения после ручного выключения"
// "Если включена опция Не включать свет, если его отключили вручную, то ручное
//  выключение света при активных датчиках блокирует повторное авто-включение
//  по датчикам, пока вся активность не спадёт."
// ---------------------------------------------------------------------------

describe('README §"Запрет авто-включения после ручного выключения"', () => {
  it('noAutoOnAfterManualOff=true: ручное (внешнее) выключение при активном датчике блокирует повторное авто-вкл', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const m1 = makeMotion(hub, 21);
    const m2 = makeMotion(hub, 22);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 600,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    m1.char(HS.MotionSensor, HC.MotionDetected).setValue(true);  // авто-вкл
    expect(lampOn.getValue()).toBe(true);

    externalTriggerLampOn(scenario, lampOn, false, vars, options);  // погасили вручную, m1 ещё активен
    expect(lampOn.getValue()).toBe(false);

    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);  // новое срабатывание датчика
    expect(lampOn.getValue()).toBe(false);  // авто-вкл заблокировано
  });

  it('noAutoOnAfterManualOff=true: блокировка снимается только после спада активности И таймаута offDelaySeconds', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 30,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    externalTriggerLampOn(scenario, lampOn, false, vars, options);
    expect(lampOn.getValue()).toBe(false);

    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);  // активность спала → пошёл отсчёт offDelay
    time.advance('30s');                                              // прошёл таймаут — блокировка снята
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);   // новая активность
    expect(lampOn.getValue()).toBe(true);  // авто-вкл снова работает
  });

  it('noAutoOnAfterManualOff=true: возврат активности до таймаута держит блокировку (свет не включается)', ({ hub, scenario, time }) => {
    const lamp = makeLamp(hub, 10);
    const motion = makeMotion(hub, 20);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 30,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    externalTriggerLampOn(scenario, lampOn, false, vars, options);
    expect(lampOn.getValue()).toBe(false);

    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);  // отсчёт offDelay пошёл
    time.advance('29s');                                             // таймаут ещё не вышел
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);   // активность вернулась
    expect(lampOn.getValue()).toBe(false);  // блокировка держится — свет не включается
  });

  it('noAutoOnAfterManualOff=true: пока есть присутствие, движение на другом датчике не включает свет', ({ hub, scenario, time }) => {
    // Сценарий из задачи: присутствие на датчике присутствия сохраняется,
    // на датчике движения появляется движение — авто-вкл должен оставаться заблокирован.
    const lamp = makeLamp(hub, 10);
    const occ = makeOccupancy(hub, 21);
    const motion = makeMotion(hub, 22);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: occ.getService(HS.OccupancySensor).getUUID(),
      motion2: motion.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 30,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    occ.char(HS.OccupancySensor, HC.OccupancyDetected).setValue(1);  // присутствие → свет вкл
    expect(lampOn.getValue()).toBe(true);

    externalTriggerLampOn(scenario, lampOn, false, vars, options);   // погасили вручную, присутствие осталось
    expect(lampOn.getValue()).toBe(false);

    // присутствие не сбрасывается, на датчике движения появляется/пропадает движение
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampOn.getValue()).toBe(false);
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);
    time.advance('60s');  // присутствие всё ещё активно — таймаут снятия не идёт
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampOn.getValue()).toBe(false);  // блокировка держится, пока есть присутствие
  });

  it('noAutoOnAfterManualOff=true: ручное выключение кнопкой при активном датчике блокирует авто-вкл', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const m1 = makeMotion(hub, 21);
    const m2 = makeMotion(hub, 22);
    const btn = makeButton(hub, 30);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
      manualControl1: btn.getService(HS.StatelessProgrammableSwitch).getUUID(),
      noAutoOnAfterManualOff: true,
      ignoreManualWithin5sAfterSensorOn: false,
      offDelaySeconds: 600,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    m1.char(HS.MotionSensor, HC.MotionDetected).setValue(true);  // авто-вкл
    expect(lampOn.getValue()).toBe(true);

    btn.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent).setValue(0);  // кнопка → выкл
    expect(lampOn.getValue()).toBe(false);

    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampOn.getValue()).toBe(false);  // авто-вкл заблокировано
  });

  it('noAutoOnAfterManualOff=false (по умолчанию): после ручного выключения датчик снова включает свет', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const m1 = makeMotion(hub, 21);
    const m2 = makeMotion(hub, 22);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
      noAutoOnAfterManualOff: false,
      offDelaySeconds: 600,
    });

    scenario.run({ source: lampOn, value: false, variables: vars, options });
    m1.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    externalTriggerLampOn(scenario, lampOn, false, vars, options);
    expect(lampOn.getValue()).toBe(false);

    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    expect(lampOn.getValue()).toBe(true);  // блокировки нет — свет включается
  });

  it('noAutoOnAfterManualOff не действует на ручной Switch (off = рабочее состояние автоматики)', ({ hub, scenario }) => {
    const lamp = makeLamp(hub, 10);
    const m1 = makeMotion(hub, 21);
    const m2 = makeMotion(hub, 22);
    const sw = makeSwitch(hub, 30, true);
    const lampOn = lamp.char(HS.Lightbulb, HC.On);
    lampOn.setValueSilent(true);
    const vars = freshVars();
    const options = baseOptions({
      motion1: m1.getService(HS.MotionSensor).getUUID(),
      motion2: m2.getService(HS.MotionSensor).getUUID(),
      manualControl1: sw.getService(HS.Switch).getUUID(),
      noAutoOnAfterManualOff: true,
      offDelaySeconds: 600,
    });

    scenario.run({ source: lampOn, value: true, variables: vars, options });
    m1.char(HS.MotionSensor, HC.MotionDetected).setValue(true);  // активность
    sw.char(HS.Switch, HC.On).setValue(false);                   // выключатель → off (свет гаснет)
    expect(lampOn.getValue()).toBe(false);

    m2.char(HS.MotionSensor, HC.MotionDetected).setValue(true);  // датчик
    expect(lampOn.getValue()).toBe(true);  // автоматика по движению снова работает
  });
});

// ---------------------------------------------------------------------------
// info-блок (контракт сценария)
// ---------------------------------------------------------------------------

describe('info-блок', () => {
  it('sourceServices содержит Lightbulb и Switch', ({ scenario }) => {
    const info = scenario.info();
    expect(info).not.toBeNull();
    expect(info.sourceServices).toContain(HS.Lightbulb);
    expect(info.sourceServices).toContain(HS.Switch);
  });

  it('sourceCharacteristics содержит On', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceCharacteristics).toContain(HC.On);
  });

  it('onStart=true (трюк для пересоздания подписки при перезагрузке хаба)', ({ scenario }) => {
    const info = scenario.info();
    expect(info.onStart).toBe(true);
  });
});
