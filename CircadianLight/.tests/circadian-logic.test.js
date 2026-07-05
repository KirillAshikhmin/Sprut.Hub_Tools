// Интеграционные тесты основного логического сценария "Циркадное освещение"
// (CircadianLight/source/Логический.js).
//
// README §"Логический сценарий": "Режим активируется для каждой конкретной лампы
// и всегда работает когда она включена, обновляя значения яркости и цветовой
// температуры, если лампа поддерживает или оттенка с насыщенностью раз в 5 минут".
//
// Триггер реагирует на изменения характеристик лампы: On, Brightness,
// ColorTemperature, Hue, Saturation.

function makeColorTempLamp(hub, id, on) {
  return hub.addAccessory({
    id, name: 'Лампа', room: 'Тест',
    services: [{
      type: HS.Lightbulb,
      characteristics: [
        { type: HC.On, value: on === true },
        { type: HC.Brightness, value: 100 },
        { type: HC.ColorTemperature, value: 400 },
      ],
    }],
  });
}

function makeHueSatLamp(hub, id, on) {
  return hub.addAccessory({
    id, name: 'Лампа RGB', room: 'Тест',
    services: [{
      type: HS.Lightbulb,
      characteristics: [
        { type: HC.On, value: on === true },
        { type: HC.Brightness, value: 100 },
        { type: HC.Hue, value: 0 },
        { type: HC.Saturation, value: 0 },
      ],
    }],
  });
}

function defaultOptions(overrides) {
  const o = {
    Preset: 0,
    WhatChange: 0,
    Behavior: 0,
    SmoothOnTime: 0,
    LinkedBehavior: 0,
    RandomSeconds: false,
    ChangeTempDelay: false,
    Debug: false,
  };
  if (overrides) for (const k of Object.keys(overrides)) o[k] = overrides[k];
  return o;
}

function freshVars() {
  return {
    startParameter: {
      brightAtStart: -1,
      isTurnOnByBright: false,
      isTurnOnByTemp: false,
      isTurnOnByHue: false,
      isTurnOnBySat: false,
    },
    smoothOn: { target: 1, active: false, task: undefined },
    cronTask: undefined,
    changed: { bright: false, temp: false, hue: false, sat: false },
    disabled: false,
    runtime: {
      stopped: false,
      dontChangeBright: false,
      dontChangeTemp: false,
      dontChangeHue: false,
      dontChangeSat: false,
    },
  };
}

// ---------------------------------------------------------------------------
// README §"Логический сценарий": info-блок
// ---------------------------------------------------------------------------

describe('info-блок', () => {
  it('sourceServices содержит Lightbulb', ({ scenario }) => {
    const info = scenario.info();
    expect(info).not.toBeNull();
    expect(info.sourceServices).toContain(HS.Lightbulb);
  });

  it('sourceCharacteristics включает On, Brightness, ColorTemperature, Hue, Saturation', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceCharacteristics).toContain(HC.On);
    expect(info.sourceCharacteristics).toContain(HC.Brightness);
    expect(info.sourceCharacteristics).toContain(HC.ColorTemperature);
    expect(info.sourceCharacteristics).toContain(HC.Hue);
    expect(info.sourceCharacteristics).toContain(HC.Saturation);
  });

  it('onStart=true', ({ scenario }) => {
    const info = scenario.info();
    expect(info.onStart).toBe(true);
  });

  it('options содержит Preset, WhatChange, Behavior, SmoothOnTime, LinkedBehavior, RandomSeconds, ChangeTempDelay, Debug', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.Preset).toBeDefined();
    expect(info.options.WhatChange).toBeDefined();
    expect(info.options.Behavior).toBeDefined();
    expect(info.options.SmoothOnTime).toBeDefined();
    expect(info.options.LinkedBehavior).toBeDefined();
    expect(info.options.RandomSeconds).toBeDefined();
    expect(info.options.ChangeTempDelay).toBeDefined();
    expect(info.options.Debug).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// README §"Логический сценарий": "включается вместе с включением лампы".
// При On=true сценарий устанавливает циркадные значения и запускает cron каждые 5 минут.
// ---------------------------------------------------------------------------

describe('Включение лампы (On=true) — установка циркадных значений', () => {
  it('On=true → яркость и температура устанавливаются по пресету', ({ hub, scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Preset: 0 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    // onTime[0][12] = [50, 100]
    expect(lamp.char(HS.Lightbulb, HC.Brightness).getValue()).toBe(100);
    expect(lamp.char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
  });

  it('On=true → cron-задача запланирована (раз в 5 минут)', ({ hub, scenario, cron }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions();

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    const tasks = cron.listScheduled();
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('лампа RGB (Hue/Sat): устанавливаются hue, saturation, brightness', ({ hub, scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const lamp = makeHueSatLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Preset: 0 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    // mired=50 → [hue=210, sat=30]
    expect(lamp.char(HS.Lightbulb, HC.Hue).getValue()).toBe(210);
    expect(lamp.char(HS.Lightbulb, HC.Saturation).getValue()).toBe(30);
    expect(lamp.char(HS.Lightbulb, HC.Brightness).getValue()).toBe(100);
  });

  it('On=false → cron отменяется, состояние сбрасывается', ({ hub, scenario, cron }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions();

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    expect(cron.listScheduled().length).toBeGreaterThan(0);

    scenario.run({ source: onChar, value: false, variables: vars, options, context: '' });
    expect(vars.cronTask).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// README §"Параметры — Что изменять?":
//   0 - яркость и температура
//   1 - только яркость
//   2 - только температура
// ---------------------------------------------------------------------------

describe('Параметр WhatChange', () => {
  it('WhatChange=1 (только яркость): температура не меняется', ({ hub, scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Preset: 0, WhatChange: 1 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    expect(lamp.char(HS.Lightbulb, HC.Brightness).getValue()).toBe(100);
    expect(lamp.char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(400);  // не изменилось
  });

  it('WhatChange=2 (только температура): яркость не меняется', ({ hub, scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const lamp = hub.addAccessory({
      id: 99, name: 'Лампа', room: 'Тест',
      services: [{
        type: HS.Lightbulb,
        characteristics: [
          { type: HC.On, value: true },
          { type: HC.Brightness, value: 50 },
          { type: HC.ColorTemperature, value: 400 },
        ],
      }],
    });
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Preset: 0, WhatChange: 2 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    expect(lamp.char(HS.Lightbulb, HC.Brightness).getValue()).toBe(50);  // не изменилось
    expect(lamp.char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// README §"Параметры — Не менять параметр автоматически после его ручного изменения":
// "Если включено, то при ручном (или внешнем) изменении любого параметра
// (яркость, температура, оттенок, насыщенность) это сохранение запомнится
// и не будет устанавливаться циркадное значение. Сбрасывается при выключении лампы."
//
// Поведение Behavior=0 (StopChar): запоминает изменение и не меняет автоматически.
// ---------------------------------------------------------------------------

describe('Behavior=0 (StopChar): ручное изменение блокирует автоматическое', () => {
  it('изменение Brightness вручную → variables.changed.bright = true', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Behavior: 0 });

    // Сначала запустить циркадный режим
    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    // Имитируем ручное изменение яркости (без авто-контекста)
    const brightChar = lamp.char(HS.Lightbulb, HC.Brightness);
    scenario.run({ source: brightChar, value: 50, variables: vars, options, context: 'USER' });

    expect(vars.changed.bright).toBe(true);
    expect(vars.runtime.dontChangeBright).toBe(true);
  });

  it('изменение ColorTemperature вручную → variables.changed.temp = true', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Behavior: 0 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    const tempChar = lamp.char(HS.Lightbulb, HC.ColorTemperature);
    scenario.run({ source: tempChar, value: 200, variables: vars, options, context: 'USER' });

    expect(vars.changed.temp).toBe(true);
    expect(vars.runtime.dontChangeTemp).toBe(true);
  });

  it('все параметры изменены → циркадный режим останавливается', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Behavior: 0 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    // Меняем яркость
    scenario.run({ source: lamp.char(HS.Lightbulb, HC.Brightness), value: 50, variables: vars, options, context: 'USER' });
    // Меняем температуру
    scenario.run({ source: lamp.char(HS.Lightbulb, HC.ColorTemperature), value: 200, variables: vars, options, context: 'USER' });

    expect(vars.runtime.stopped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Параметры — Останавливать циркадный режим после изменения любого параметра":
// "Если включено, то при изменении любого параметра лампочки циркадный режим
// отключается до следующего включения лампы".
//
// Behavior=1 (StopCircade).
// ---------------------------------------------------------------------------

describe('Behavior=1 (StopCircade): любое изменение останавливает циркаду', () => {
  it('единственное изменение Brightness → runtime.stopped = true', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ Behavior: 1 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    const brightChar = lamp.char(HS.Lightbulb, HC.Brightness);
    scenario.run({ source: brightChar, value: 50, variables: vars, options, context: 'USER' });

    expect(vars.runtime.stopped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Взаимодействие — Перезапуск циркадного режима":
// "Из Блока кода в нужный момент вызвать функцию
//   global.resetCircadianLight(Hub.getAccessory(aId).getService(sId))"
// → handler с action="reset" вызовется и применит новые циркадные значения.
//
// Зарегистрированный логическим сценарием handler в GlobalVariables.CircadianLight_Callbacks.handlers[uuid].
// ---------------------------------------------------------------------------

describe('Регистрация callback handler', () => {
  it('после trigger в handlers появляется handler по UUID сервиса', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = lamp.getService(HS.Lightbulb).getUUID();
    const vars = freshVars();
    const options = defaultOptions();

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    const handler = variables.global.CircadianLight_Callbacks.handlers[uuid];
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('handler с action="disable" → vars.disabled=true, циркада останавливается', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = lamp.getService(HS.Lightbulb).getUUID();
    const vars = freshVars();
    const options = defaultOptions();

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    const handler = variables.global.CircadianLight_Callbacks.handlers[uuid];
    handler('disable', {});

    expect(vars.disabled).toBe(true);
    expect(vars.cronTask).toBeUndefined();
  });

  it('handler с action="enable" → vars.disabled=false, восстанавливает циркаду', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = lamp.getService(HS.Lightbulb).getUUID();
    const vars = freshVars();
    const options = defaultOptions();

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    const handler = variables.global.CircadianLight_Callbacks.handlers[uuid];
    handler('disable', {});
    handler('enable', {});

    expect(vars.disabled).toBe(false);
  });

  it('handler с action="reset" → восстанавливает циркадные значения', ({ hub, scenario, variables, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = lamp.getService(HS.Lightbulb).getUUID();
    const vars = freshVars();
    const options = defaultOptions({ Preset: 0 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });
    // Меняем значения вручную
    lamp.char(HS.Lightbulb, HC.Brightness).setValueSilent(50);
    lamp.char(HS.Lightbulb, HC.ColorTemperature).setValueSilent(200);

    const handler = variables.global.CircadianLight_Callbacks.handlers[uuid];
    handler('reset', {});

    // После сброса циркадные значения должны примениться
    expect(lamp.char(HS.Lightbulb, HC.Brightness).getValue()).toBe(100);
    expect(lamp.char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// README §"Параметры — Плавное изменение яркости при включении":
// "Позволяет плавно увеличивать яркость лампы при включении".
// SmoothOnTime > 0 → активирует плавный режим.
// ---------------------------------------------------------------------------

describe('Параметр SmoothOnTime — плавное включение', () => {
  it('SmoothOnTime > 0 → запускается setInterval для плавного увеличения', ({ hub, scenario, time }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ SmoothOnTime: 2 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    expect(vars.smoothOn.active).toBe(true);
    expect(vars.smoothOn.task).toBeDefined();
  });

  it('SmoothOnTime=0 — плавный режим не активируется', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ SmoothOnTime: 0 });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    expect(vars.smoothOn.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"История изменений 5.1":
// "Параметр Случайное время изменения — значение будет устанавливаться в 5 минут и 0-59 секунд".
// Логически: cron-выражение должно меняться от "0 */5..." до "<rand> */5...".
// ---------------------------------------------------------------------------

describe('Параметр RandomSeconds', () => {
  it('RandomSeconds=false → cron работает каждые 5 минут (секунды = 0)', ({ hub, scenario, cron }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ RandomSeconds: false });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    const tasks = cron.listScheduled();
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].spec).toContain('0 */5');
  });

  it('RandomSeconds=true → cron выражение содержит */5 каждые 5 минут', ({ hub, scenario, cron }) => {
    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const vars = freshVars();
    const options = defaultOptions({ RandomSeconds: true });

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    const tasks = cron.listScheduled();
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].spec).toContain('*/5');
  });
});

// ---------------------------------------------------------------------------
// Спека §4: регистрация обязана быть самодостаточной — логический сам создаёт
// реестр, не завися от того, успел ли глобальный отработать top-level init.
// Это фикс «хрупкого рестарта»: на холодном старте onStart-триггер может
// сработать раньше глобального.
// ---------------------------------------------------------------------------

describe('Самоинициализация реестра коллбеков (рестарт хаба)', () => {
  it('trigger регистрирует handler, даже если реестр ещё не создан', ({ hub, scenario, variables }) => {
    // Симулируем состояние до top-level init глобального
    delete variables.global.CircadianLight_Callbacks;

    const lamp = makeColorTempLamp(hub, 99, true);
    const onChar = lamp.char(HS.Lightbulb, HC.On);
    const uuid = lamp.getService(HS.Lightbulb).getUUID();
    const vars = freshVars();
    const options = defaultOptions();

    scenario.run({ source: onChar, value: true, variables: vars, options, context: '' });

    expect(variables.global.CircadianLight_Callbacks).toBeDefined();
    expect(variables.global.CircadianLight_Callbacks.handlers).toBeDefined();
    expect(typeof variables.global.CircadianLight_Callbacks.handlers[uuid]).toBe('function');
  });
});
