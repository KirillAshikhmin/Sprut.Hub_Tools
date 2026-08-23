// Интеграционные тесты для сценария "🌡️ Виртуальный термостат".
//
// README §"Логика управления реле":
//   1. Выключено (targetState=0 OR currentState=0): оба реле OFF.
//   2. Нагрев (targetState=1 OR 3, currentState=1): нагрев ON, охлаждение OFF.
//   3. Охлаждение (targetState=2 OR 3, currentState=2): нагрев OFF, охлаждение ON.
//
// README §"Получение данных с датчика": подписка + cron в полночь.
// README §"Автоматическое управление вентилятором": по разнице температур.

function makeThermostat(hub, id, currentState, targetState, opts) {
  opts = opts || {};
  const chars = [
    { type: HC.CurrentHeatingCoolingState, value: currentState != null ? currentState : 0 },
    { type: HC.TargetHeatingCoolingState, value: targetState != null ? targetState : 0 },
    { type: HC.CurrentTemperature, value: opts.currentTemp != null ? opts.currentTemp : 20 },
    { type: HC.TargetTemperature, value: opts.targetTemp != null ? opts.targetTemp : 22 },
  ];
  if (opts.fanSpeed != null) {
    chars.push({ type: HC.C_FanSpeed, value: opts.fanSpeed });
  }
  if (opts.heatThr != null) {
    chars.push({ type: HC.HeatingThresholdTemperature, value: opts.heatThr });
  }
  if (opts.coolThr != null) {
    chars.push({ type: HC.CoolingThresholdTemperature, value: opts.coolThr });
  }
  return hub.addAccessory({
    id, name: 'Термостат', room: 'Спальня',
    services: [
      {
        type: HS.AccessoryInformation,
        characteristics: [{ type: HC.C_Online, value: true }],
      },
      {
        type: HS.Thermostat,
        characteristics: chars,
      },
    ],
  });
}

function makeTempSensor(hub, id, temp, online) {
  return hub.addAccessory({
    id, name: 'Датчик температуры', room: 'Спальня',
    services: [
      {
        type: HS.AccessoryInformation,
        characteristics: [{ type: HC.C_Online, value: online !== false }],
      },
      {
        type: HS.TemperatureSensor,
        characteristics: [{ type: HC.CurrentTemperature, value: temp != null ? temp : 20 }],
      },
    ],
  });
}

function makeRelay(hub, id, name, initialOn) {
  return hub.addAccessory({
    id, name, room: 'Спальня',
    services: [
      {
        type: HS.AccessoryInformation,
        characteristics: [{ type: HC.C_Online, value: true }],
      },
      {
        type: HS.Switch,
        characteristics: [{ type: HC.On, value: initialOn === true }],
      },
    ],
  });
}

function baseOptions(overrides) {
  const o = {
    sensor: '',
    heatingRelay: '',
    coolingRelay: '',
    heatingRelayInvert: false,
    coolingRelayInvert: false,
    fanTempStep: 0.5,
    fanSpeedManualLock: true,
    emulateThermostat: false,
    hysteresis: 0.5,
    offBehavior: 0,
    failureBehavior: 0,
    failureTimeout: 240,
    debug: false,
  };
  if (overrides) for (const k of Object.keys(overrides)) o[k] = overrides[k];
  return o;
}

function freshVars() {
  return {
    lastTemp: undefined,
    lastUpdateTime: undefined,
    subscribed: false,
    subscribe: undefined,
    relaySubscribe: undefined,
    relaySubscribed: false,
    fanSpeedManuallySet: false,
    midnightTask: undefined,
    failureCheckTask: undefined,
    sensorFailed: false,
    lastUserTargetState: undefined,
    offBehaviorApplied: false,
  };
}

// ---------------------------------------------------------------------------
// info-блок
// ---------------------------------------------------------------------------

describe('info-блок', () => {
  it('sourceServices содержит Thermostat', ({ scenario }) => {
    const info = scenario.info();
    expect(info).not.toBeNull();
    expect(info.sourceServices).toContain(HS.Thermostat);
  });

  it('sourceCharacteristics покрывают режимы, температуры, пороги и FanSpeed', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceCharacteristics).toContain(HC.CurrentHeatingCoolingState);
    expect(info.sourceCharacteristics).toContain(HC.TargetHeatingCoolingState);
    expect(info.sourceCharacteristics).toContain(HC.CurrentTemperature);
    expect(info.sourceCharacteristics).toContain(HC.TargetTemperature);
    expect(info.sourceCharacteristics).toContain(HC.HeatingThresholdTemperature);
    expect(info.sourceCharacteristics).toContain(HC.CoolingThresholdTemperature);
    expect(info.sourceCharacteristics).toContain(HC.C_FanSpeed);
  });

  it('onStart=true', ({ scenario }) => {
    const info = scenario.info();
    expect(info.onStart).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика управления реле" — Выключено
// ---------------------------------------------------------------------------

describe('README §"Логика управления реле" — Выключено', () => {
  it('targetState=0 → оба реле OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 0);
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);

    scenario.run({
      source, value: 0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('currentState=0 → оба реле OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 1);
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика управления реле" — Нагрев
// ---------------------------------------------------------------------------

describe('README §"Логика управления реле" — Нагрев', () => {
  it('current=1, target=1 → нагрев ON, охлаждение OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1);
    const sensor = makeTempSensor(hub, 30, 18);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 1, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('current=1, target=3 (Автомат) → нагрев ON, охлаждение OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 3);
    const sensor = makeTempSensor(hub, 30, 18);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 1, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика управления реле" — Охлаждение
// ---------------------------------------------------------------------------

describe('README §"Логика управления реле" — Охлаждение', () => {
  it('current=2, target=2 → нагрев OFF, охлаждение ON', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 2);
    const sensor = makeTempSensor(hub, 30, 28);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 2, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('current=2, target=3 (Автомат) → нагрев OFF, охлаждение ON', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 3);
    const sensor = makeTempSensor(hub, 30, 28);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 2, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Получение данных с датчика"
// "Подписывается на изменения датчика, Обновляет CurrentTemperature на термостате"
// ---------------------------------------------------------------------------

describe('README §"Получение данных с датчика" — подписка', () => {
  it('после trigger значение датчика копируется на термостат', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 18);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentTemperature).getValue()).toBe(18);
  });

  it('изменение датчика после подписки обновляет термостат', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(15);
    expect(t.char(HS.Thermostat, HC.CurrentTemperature).getValue()).toBe(15);
  });

  it('подписка создаётся однажды (variables.subscribed=true)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0);
    const sensor = makeTempSensor(hub, 30, 20);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    expect(vars.subscribed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Получение данных с датчика" — cron в полночь
// "Обновляет значение каждый день в полночь (cron задача)"
// ---------------------------------------------------------------------------

describe('README §"Получение данных с датчика" — cron в полночь', () => {
  it('после trigger создан midnightTask', ({ hub, scenario, cron }) => {
    const t = makeThermostat(hub, 10, 0, 0);
    const sensor = makeTempSensor(hub, 30, 20);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    expect(vars.midnightTask).not.toBeUndefined();
    expect(cron.listScheduled().length).toBeGreaterThan(0);
  });

  it('cron tick → значение обновляется', ({ hub, scenario, cron }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValueSilent(12);
    cron.tickNow();

    expect(t.char(HS.Thermostat, HC.CurrentTemperature).getValue()).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// README §"Важные замечания" — мониторинг датчика
// "Проверяет, в сети ли датчик"
// ---------------------------------------------------------------------------

describe('README §"Важные замечания" — мониторинг датчика', () => {
  it('датчик не в сети → warn', ({ hub, scenario, logs }) => {
    const t = makeThermostat(hub, 10, 0, 0);
    const sensor = makeTempSensor(hub, 30, 20, false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// README §"Автоматическое управление вентилятором"
//   diff < step → speed 1
//   step ≤ diff < 2*step → 2
//   2*step ≤ diff < 3*step → 3
//   3*step ≤ diff < 4*step → 4
//   diff ≥ 4*step → 5
// Только при поддержке C_FanSpeed.
// ---------------------------------------------------------------------------

describe('README §"Автоматическое управление вентилятором"', () => {
  it('diff = 0 → скорость 1', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 22, targetTemp: 22, fanSpeed: 3 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 22, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanTempStep: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.C_FanSpeed).getValue()).toBe(1);
  });

  it('diff = 0.7 (между 0.5 и 1) → скорость 2', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 21.3, targetTemp: 22, fanSpeed: 1 });
    const sensor = makeTempSensor(hub, 30, 21.3);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 21.3, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanTempStep: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.C_FanSpeed).getValue()).toBe(2);
  });

  it('diff = 2.5 (≥ 4*step=2.0) → скорость 5', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 19.5, targetTemp: 22, fanSpeed: 1 });
    const sensor = makeTempSensor(hub, 30, 19.5);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 19.5, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanTempStep: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.C_FanSpeed).getValue()).toBe(5);
  });

  it('термостат выключен (currentState=0) → скорость 1', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22, targetTemp: 25, fanSpeed: 4 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanTempStep: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.C_FanSpeed).getValue()).toBe(1);
  });

  it('без C_FanSpeed (термостат не поддерживает) → автоматика без ошибок', ({ hub, scenario, logs }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 19.5, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 19.5);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 19.5, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanTempStep: 0.5,
      }), context: '',
    });

    expect(logs.byLevel('error').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// README §"Ручная фиксация скорости вентилятора"
// "Если включена фиксация и пользователь установил конкретную скорость —
//  автоматика отключается до возврата к Авто (0)"
// ---------------------------------------------------------------------------

describe('README §"Ручная фиксация скорости вентилятора"', () => {
  it('user changes fan speed (context не self) + fanSpeedManualLock=true → fanSpeedManuallySet=true', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 22, targetTemp: 22, fanSpeed: 1 });
    const sensor = makeTempSensor(hub, 30, 22);
    const fanSpeedChar = t.char(HS.Thermostat, HC.C_FanSpeed);
    const vars = freshVars();

    scenario.run({
      source: fanSpeedChar, value: 3, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanSpeedManualLock: true,
      }), context: 'USER',
    });

    expect(vars.fanSpeedManuallySet).toBe(true);
  });

  it('user sets fan speed = 0 (Авто) → flag сбрасывается', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 22, targetTemp: 22, fanSpeed: 0 });
    const sensor = makeTempSensor(hub, 30, 22);
    const fanSpeedChar = t.char(HS.Thermostat, HC.C_FanSpeed);
    const vars = freshVars();
    vars.fanSpeedManuallySet = true;

    scenario.run({
      source: fanSpeedChar, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanSpeedManualLock: true,
      }), context: 'USER',
    });

    expect(vars.fanSpeedManuallySet).toBe(false);
  });

  it('self change (context LOGIC<-C<-LOGIC) → flag не ставится', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 22, targetTemp: 22, fanSpeed: 1 });
    const sensor = makeTempSensor(hub, 30, 22);
    const fanSpeedChar = t.char(HS.Thermostat, HC.C_FanSpeed);
    const vars = freshVars();

    scenario.run({
      source: fanSpeedChar, value: 3, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        fanSpeedManualLock: true,
      }), context: 'LOGIC[1] <- C[10.13.123] <- LOGIC[1]',
    });

    expect(vars.fanSpeedManuallySet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Параметры" — одно реле опционально
// ---------------------------------------------------------------------------

describe('README §"Параметры" — одно реле опционально', () => {
  it('только нагрев: режим Нагрев → нагрев ON', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1);
    const sensor = makeTempSensor(hub, 30, 18);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 1, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: '',
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('только охлаждение: режим Охлаждение → охлаждение ON', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 2);
    const sensor = makeTempSensor(hub, 30, 28);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 2, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: '',
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика управления реле — стандартное поведение"
// "Логика срабатывает на любое изменение характеристик термостата"
// ---------------------------------------------------------------------------

describe('README §"стандартное поведение реле"', () => {
  it('изменение CurrentTemperature триггерит handleHeatingCoolingLogic (бывшая опция forceRelayState теперь стандарт)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 20, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('изменение TargetTemperature триггерит handleHeatingCoolingLogic', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 2, { currentTemp: 26, targetTemp: 24 });
    const sensor = makeTempSensor(hub, 30, 26);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.TargetTemperature);

    scenario.run({
      source, value: 24, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика управления реле" — расширенные целевые режимы
// "Выключено / Вентилятор / Осушитель → оба реле выключены"
// ---------------------------------------------------------------------------

describe('README §"Логика управления реле — расширенные режимы"', () => {
  it('targetState=-1 (Вентилятор) → оба реле OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, -1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);

    scenario.run({
      source, value: -1, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('targetState=-2 (Осушитель) → оба реле OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, -2, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);

    scenario.run({
      source, value: -2, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
      }), context: '',
    });

    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Эмуляция обычного термостата" — info-блок и hysteresis
// ---------------------------------------------------------------------------

describe('README §"Эмуляция обычного термостата" — настройки info', () => {
  it('опция emulateThermostat по умолчанию false', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.emulateThermostat).not.toBeUndefined();
    expect(info.options.emulateThermostat.value).toBe(false);
  });

  it('опция hysteresis имеет default=0.5 и шаг 0.1', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.hysteresis).not.toBeUndefined();
    expect(info.options.hysteresis.value).toBe(0.5);
    expect(info.options.hysteresis.minStep).toBe(0.1);
  });

  it('опция forceRelayState удалена — теперь это стандартное поведение', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.forceRelayState).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// README §"Эмуляция обычного термостата" — режим OFF / FAN_ONLY / DRY
// "Текущий режим всегда Выключен"
// ---------------------------------------------------------------------------

describe('README §"Эмуляция: OFF → 0; FAN/DRY — не трогаем (как в штатной логике)"', () => {
  function runWith(hub, scenario, targetState, currentState) {
    const t = makeThermostat(hub, 10, currentState, targetState, { currentTemp: 15, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 15);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    scenario.run({
      source, value: targetState, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
      }), context: '',
    });
    return t;
  }

  it('OFF (0) → CurrentHCState=0', ({ hub, scenario }) => {
    const t = runWith(hub, scenario, 0, 1);
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });

  it('FAN_ONLY (-1) → CurrentHCState не меняется', ({ hub, scenario }) => {
    const t = runWith(hub, scenario, -1, 1);
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(1);
  });

  it('DRY (-2) → CurrentHCState не меняется', ({ hub, scenario }) => {
    const t = runWith(hub, scenario, -2, 2);
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// README §"Эмуляция: HEAT — учитывается Целевая температура (эталон GenericThermostat)"
// "выкл при temp ≥ target; нагрев при target − temp ≥ hysteresis; иначе держим"
// ---------------------------------------------------------------------------

describe('README §"Эмуляция: HEAT — мёртвая зона ниже Целевой температуры"', () => {
  it('current=21.4, target=22, h=0.5 → CurrentHCState=1 (нужно греть)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 21.4, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 21.4);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 21.4, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(1);
  });

  it('currentState=1 + current=22.6, target=22, h=0.5 → CurrentHCState=0 (нагрелись)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 22.6, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22.6);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 22.6, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });

  it('currentState=1 + current=21.8 (в мёртвой зоне target-h..target) → CurrentHCState не меняется (=1)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 21.8, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 21.8);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 21.8, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(1);
  });

  it('currentState=1 + current=22.0 (=target) → CurrentHCState=0 (эталон выключает при достижении цели)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 22.0, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22.0);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 22.0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });

  it('ECO (-3) → CurrentHCState не меняется (штатная логика режим ECO не обрабатывает)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, -3, { currentTemp: 18, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 18);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 18, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    // Несмотря на то что по нагреву было бы 1, ECO штатная логика не трогает → остаётся 2
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// README §"Эмуляция: COOL — гистерезис вокруг TargetTemperature"
// ---------------------------------------------------------------------------

describe('README §"Эмуляция: COOL — гистерезис вокруг TargetTemperature"', () => {
  it('current=24.6, target=24, h=0.5 → CurrentHCState=2', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 2, { currentTemp: 24.6, targetTemp: 24 });
    const sensor = makeTempSensor(hub, 30, 24.6);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 24.6, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(2);
  });

  it('currentState=2 + current=24.0 (=target) → CurrentHCState=0 (эталон выключает при достижении цели)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 2, { currentTemp: 24.0, targetTemp: 24 });
    const sensor = makeTempSensor(hub, 30, 24.0);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 24.0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });

  it('currentState=2 + current=23.7 (в мёртвой зоне target..target+h) → не меняется (=2)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 2, { currentTemp: 24.3, targetTemp: 24 });
    const sensor = makeTempSensor(hub, 30, 24.3);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 24.3, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    // temp=24.3: > target(24), но temp-target=0.3 < h=0.5 → мёртвая зона, держим текущий режим
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// README §"Эмуляция: AUTO — Порог нагрева/охлаждения"
// ---------------------------------------------------------------------------

describe('README §"Эмуляция: AUTO — пороги"', () => {
  it('current=18.4, heatThr=20, coolThr=24, h=0.5 → нагрев', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 18.4, heatThr: 20, coolThr: 24 });
    const sensor = makeTempSensor(hub, 30, 18.4);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 18.4, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(1);
  });

  it('current=25.0, heatThr=20, coolThr=24, h=0.5 → охлаждение', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 25.0, heatThr: 20, coolThr: 24 });
    const sensor = makeTempSensor(hub, 30, 25.0);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 25.0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(2);
  });

  it('current=22 (между порогами), currentState=0 → остаётся 0', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 22, heatThr: 20, coolThr: 24 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 22, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });

  it('currentState=1 + current=20.6 (heatThr+h) → выключаемся (CurrentHCState=0)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 3, { currentTemp: 20.6, heatThr: 20, coolThr: 24 });
    const sensor = makeTempSensor(hub, 30, 20.6);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 20.6, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// README §"Эмуляция: AUTO — фолбэк на TargetTemperature, если нет порогов"
// "Если у термостата нет характеристик Порогов — используется Целевая температура"
// ---------------------------------------------------------------------------

describe('README §"Эмуляция: AUTO — фолбэк на TargetTemperature"', () => {
  it('нет heatThr/coolThr, current=21.4, target=22, h=0.5 → нагрев', ({ hub, scenario }) => {
    // Термостат без HeatingThresholdTemperature и CoolingThresholdTemperature
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 21.4, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 21.4);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 21.4, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(1);
  });

  it('нет heatThr/coolThr, current=22.6, target=22, h=0.5 → охлаждение', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 22.6, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22.6);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 22.6, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(2);
  });

  it('нет heatThr/coolThr, current=22 (=target), currentState=0 → остаётся 0', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 22, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });

  it('есть только coolThr (heatThr нет) → фолбэк на TargetTemperature (как в штатной: нет хотя бы одного порога)', ({ hub, scenario }) => {
    // Только Порог охлаждения; Порога нагрева нет → эталон уходит в фолбэк на Целевую температуру
    const t = makeThermostat(hub, 10, 0, 3, { currentTemp: 21.4, targetTemp: 22, coolThr: 24 });
    const sensor = makeTempSensor(hub, 30, 21.4);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 21.4, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: true,
        hysteresis: 0.5,
      }), context: '',
    });

    // Фолбэк на target=22: target-temp=0.6 >= 0.5 → нагрев
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// README §"emulateThermostat=false — Текущий режим управляется снаружи"
// ---------------------------------------------------------------------------

describe('README §"emulateThermostat=false"', () => {
  it('сценарий НЕ меняет CurrentHCState — оставляет значение, которое было', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 18, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 18);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);

    scenario.run({
      source, value: 18, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        emulateThermostat: false,
      }), context: '',
    });

    // CurrentHCState остаётся 0, несмотря на холодную текущую температуру
    expect(t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).getValue()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// README §"Параметр failureTimeout" — нормализация значения
// "Минимум 15. Кратно 15. По умолчанию 240."
// ---------------------------------------------------------------------------

describe('README §"Время до отказа" — настройки info', () => {
  it('опция failureTimeout имеет defaults: 240, minValue 15, minStep 15', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.failureTimeout).not.toBeUndefined();
    expect(info.options.failureTimeout.value).toBe(240);
    expect(info.options.failureTimeout.minValue).toBe(15);
    expect(info.options.failureTimeout.minStep).toBe(15);
  });

  it('опция failureBehavior имеет 5 значений и default=0 (Отключить все)', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.failureBehavior).not.toBeUndefined();
    expect(info.options.failureBehavior.value).toBe(0);
    expect(info.options.failureBehavior.values.length).toBe(5);
    const values = info.options.failureBehavior.values.map((v) => v.value);
    expect(values).toContain(0); // Отключить все
    expect(values).toContain(1); // Нагрев
    expect(values).toContain(2); // Охлаждение
    expect(values).toContain(3); // Ничего не делать
    expect(values).toContain(4); // Включить все
  });
});

// ---------------------------------------------------------------------------
// README §"Каждые 15 минут проверяет, как давно от датчика поступали данные"
// ---------------------------------------------------------------------------

describe('README §"Cron-проверка отказа датчика"', () => {
  it('после trigger создаётся failureCheckTask (если есть sensor)', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0);
    const sensor = makeTempSensor(hub, 30, 20);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: '',
    });

    expect(vars.failureCheckTask).not.toBeUndefined();
  });

  it('cron tick при свежем lastUpdateTime → отказ не срабатывает', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureTimeout: 240,
      }), context: '',
    });

    // Продвигаем время ровно на 15 мин — сработает только первая итерация failureCheckTask.
    // setValueFromSensor при первом trigger установил lastUpdateTime = now (12:00:00).
    // После tick(15 мин) elapsed = 15 мин < 240 мин — отказ не должен сработать.
    time.tick(15 * 60 * 1000);
    expect(vars.sensorFailed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отказе датчика температуры" — Отключать (0)
// ---------------------------------------------------------------------------

describe('README §"failureBehavior=Отключить"', () => {
  it('lastUpdateTime > failureTimeout → TargetHCState=0, оба реле OFF, sensorFailed=true', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    // lastTemp = текущее значение датчика → setValueFromSensor не обновит lastUpdateTime
    vars.lastTemp = 20;
    // lastUpdateTime — 5 часов назад от текущего времени теста
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        failureTimeout: 240,
      }), context: '',
    });

    // Продвигаем время на 15 мин — сработает первая итерация failureCheckTask.
    // elapsed = 5ч + 15мин = 315 мин > 240 мин → отказ
    time.tick(15 * 60 * 1000);

    expect(vars.sensorFailed).toBe(true);
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(0);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('cron tick → пишет error в лог про отказ датчика (Отключить)', ({ hub, scenario, time, logs }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    const errors = logs.byLevel('error');
    const hasFailureLog = errors.some((e) => e.message.indexOf('Нет показаний от датчика') >= 0);
    expect(hasFailureLog).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отказе датчика температуры" — Нагрев (1)
// "Целевой режим не меняется, реле нагрева ON, реле охлаждения OFF"
// ---------------------------------------------------------------------------

describe('README §"failureBehavior=Нагрев"', () => {
  it('реле нагрева ON, охлаждения OFF, TargetHCState НЕ меняется', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 0, 2, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 22;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 1,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    expect(vars.sensorFailed).toBe(true);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
    // Целевой режим не меняется — остался 2 (Cool)
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отказе датчика температуры" — Охлаждение (2)
// ---------------------------------------------------------------------------

describe('README §"failureBehavior=Охлаждение"', () => {
  it('реле охлаждения ON, нагрева OFF, TargetHCState НЕ меняется', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 22;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 2,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    expect(vars.sensorFailed).toBe(true);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
    // Целевой режим не меняется — остался 1 (Heat)
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отказе датчика температуры" — Ничего не делать (3)
// "Состояние термостата и реле не трогается"
// ---------------------------------------------------------------------------

describe('README §"failureBehavior=Ничего не делать"', () => {
  it('TargetHCState, реле — все остаются как были', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 3,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    // sensorFailed=true, но никаких изменений — реле и режим в исходном состоянии
    expect(vars.sensorFailed).toBe(true);
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(1);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"При отказе датчика управление реле берёт на себя applyFailureBehavior"
// handleHeatingCoolingLogic при sensorFailed=true → реле меняются по failureBehavior, а не по режиму
// ---------------------------------------------------------------------------

describe('README §"sensorFailed=true блокирует обычную логику реле"', () => {
  it('sensorFailed=true + смена режима термостата → не возвращает обычную логику', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.sensorFailed = true;
    vars.lastTemp = 20;

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
      }), context: '',
    });

    // failureBehavior=0 → реле обоих OFF, несмотря на текущий режим Нагрев
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"После восстановления данных управление реле возвращается в обычный режим"
// ---------------------------------------------------------------------------

describe('README §"Восстановление датчика"', () => {
  it('новый callback подписки обновляет lastUpdateTime → cron tick сбрасывает sensorFailed', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    // Предустановим состояние "отказ"
    vars.sensorFailed = true;
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    // failureBehavior=3 (Ничего не делать), чтобы TargetHCState не менялся
    // и handleHeatingCoolingLogic после восстановления вернулся к обычной логике.
    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 3,
        failureTimeout: 240,
      }), context: '',
    });

    // Сымитируем callback подписки — изменение значения датчика.
    // Это обновит lastUpdateTime на текущее время (12:00).
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(18);

    // Tick на 15 мин → failureCheckTask. elapsed = 15 мин < 240 → восстановление.
    time.tick(15 * 60 * 1000);

    expect(vars.sensorFailed).toBe(false);
    // После восстановления применяется обычная логика: режим Нагрев (target=1, current=1) → нагрев ON
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Запоминание последнего пользовательского Целевого режима"
// "Сценарий запоминает последний целевой режим, выставленный пользователем (а не
//  самим сценарием), чтобы восстановить его после отказа датчика."
// ---------------------------------------------------------------------------

describe('README §"Запоминание lastUserTargetState"', () => {
  it('пользователь сменил TargetHCState → lastUserTargetState обновляется', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 2, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();

    scenario.run({
      source, value: 2, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: 'LOGIC[1] <- C[10.13.0] <- CLOUD[0]',
    });

    expect(vars.lastUserTargetState).toBe(2);
  });

  it('self change TargetHCState (LOGIC<-C<-LOGIC) → lastUserTargetState НЕ обновляется', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.lastUserTargetState = 1;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      }), context: 'LOGIC[1] <- C[10.13.0] <- LOGIC[1]',
    });

    // Self change — старое значение сохраняется
    expect(vars.lastUserTargetState).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// README §"Смена режима пользователем во время отказа датчика"
// "Если пользователь меняет режим, пока датчик в отказе — пишется log.error,
//  новое значение сохраняется в lastUserTargetState, режим всё равно сбрасывается."
// ---------------------------------------------------------------------------

describe('README §"Смена режима во время отказа"', () => {
  it('user change TargetHCState=2 при sensorFailed → log.error + lastUserTargetState=2 + applyFailureBehavior сбрасывает', ({ hub, scenario, logs }) => {
    const t = makeThermostat(hub, 10, 0, 2, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.sensorFailed = true;
    vars.lastUserTargetState = 1;
    vars.lastTemp = 22;

    scenario.run({
      source, value: 2, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
      }), context: 'LOGIC[1] <- C[10.13.0] <- CLOUD[0]',
    });

    // Новый выбор пользователя запомнен
    expect(vars.lastUserTargetState).toBe(2);
    // Лог-ошибка
    const errors = logs.byLevel('error');
    const hasUserChangeLog = errors.some((e) => e.message.indexOf('Датчик температуры отказал. Режим будет сброшен в Выключен') >= 0);
    expect(hasUserChangeLog).toBe(true);
    // applyFailureBehavior сбросил Целевой режим в 0 и реле выкл
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(0);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('user change TargetHCState=0 при sensorFailed → НЕТ log.error (пользователь выбрал Выключено — это уже совпадает с отказом)', ({ hub, scenario, logs }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.sensorFailed = true;
    vars.lastUserTargetState = 1;
    vars.lastTemp = 22;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        failureBehavior: 0,
      }), context: 'LOGIC[1] <- C[10.13.0] <- CLOUD[0]',
    });

    expect(vars.lastUserTargetState).toBe(0);
    const errors = logs.byLevel('error');
    const hasUserChangeLog = errors.some((e) => e.message.indexOf('Датчик температуры отказал. Режим будет сброшен в Выключен') >= 0);
    expect(hasUserChangeLog).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Автоматическое восстановление при возврате данных от датчика"
// "После свежего callback подписки сценарий сбрасывает sensorFailed и
//  восстанавливает Целевой режим из lastUserTargetState."
// ---------------------------------------------------------------------------

describe('README §"Авто-восстановление через callback подписки"', () => {
  it('callback подписки при sensorFailed → sensorFailed=false + TargetHCState восстановлен', ({ hub, scenario }) => {
    // Сценарий ранее перевёл термостат в OFF (target=0), lastUserTargetState=1 был сохранён
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);
    const vars = freshVars();
    vars.sensorFailed = true;
    vars.lastUserTargetState = 1;
    vars.lastTemp = 20;

    scenario.run({
      source, value: 20, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
      }), context: '',
    });

    // Имитируем callback подписки: датчик прислал новое значение
    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(21);

    expect(vars.sensorFailed).toBe(false);
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(1);
  });

  it('callback подписки → восстанавливается НОВЫЙ режим, который пользователь поставил во время отказа', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 22, targetTemp: 24 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);
    const vars = freshVars();
    vars.sensorFailed = true;
    // Пользователь поменял режим на 2 (Охлаждение) во время отказа
    vars.lastUserTargetState = 2;
    vars.lastTemp = 22;

    scenario.run({
      source, value: 22, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
      }), context: '',
    });

    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(23);

    expect(vars.sensorFailed).toBe(false);
    // Восстановили новый режим, а не старый
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(2);
  });

  it('callback подписки при failureBehavior!=0 → НЕ трогает TargetHCState (его никто не сбрасывал)', ({ hub, scenario }) => {
    // failureBehavior=1 (Нагрев) не сбрасывает TargetHCState, поэтому при восстановлении
    // TargetHCState не нужно менять.
    const t = makeThermostat(hub, 10, 0, 2, { currentTemp: 22, targetTemp: 24 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', true);  // включён applyFailureBehavior
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentTemperature);
    const vars = freshVars();
    vars.sensorFailed = true;
    vars.lastUserTargetState = 1; // пользователь когда-то ставил Нагрев
    vars.lastTemp = 22;

    scenario.run({
      source, value: 22, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 1,
      }), context: '',
    });

    sensor.char(HS.TemperatureSensor, HC.CurrentTemperature).setValue(23);

    expect(vars.sensorFailed).toBe(false);
    // TargetHCState остался 2 — сценарий его не трогал
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// README §"Лог-ошибка при обнаружении отказа датчика"
// Уже проверено в "cron tick → пишет error в лог про отказ датчика".
// Здесь дополнительно — что лог-ошибка выводится и при failureBehavior!=0.
// ---------------------------------------------------------------------------

describe('README §"Лог-ошибка при обнаружении отказа"', () => {
  it('cron tick + failureBehavior=Нагрев → error в логе про отказ', ({ hub, scenario, time, logs }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureBehavior: 1,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    const errors = logs.byLevel('error');
    const hasFailureLog = errors.some((e) => e.message.indexOf('Нет показаний от датчика') >= 0);
    expect(hasFailureLog).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Инвертировать реле" + §"Поведение при отключении термостата" — info
// ---------------------------------------------------------------------------

describe('README §"Инвертировать реле" — настройки info', () => {
  it('опция heatingRelayInvert: Boolean, default false', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.heatingRelayInvert).not.toBeUndefined();
    expect(info.options.heatingRelayInvert.type).toBe('Boolean');
    expect(info.options.heatingRelayInvert.value).toBe(false);
  });

  it('опция coolingRelayInvert: Boolean, default false', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.coolingRelayInvert).not.toBeUndefined();
    expect(info.options.coolingRelayInvert.type).toBe('Boolean');
    expect(info.options.coolingRelayInvert.value).toBe(false);
  });
});

describe('README §"Поведение при отключении термостата" — настройки info', () => {
  it('опция offBehavior имеет 4 значения и default=0 (Отключить все реле)', ({ scenario }) => {
    const info = scenario.info();
    expect(info.options.offBehavior).not.toBeUndefined();
    expect(info.options.offBehavior.value).toBe(0);
    expect(info.options.offBehavior.values.length).toBe(4);
    const values = info.options.offBehavior.values.map((v) => v.value);
    expect(values).toContain(0); // Отключить все реле
    expect(values).toContain(1); // Включить все реле
    expect(values).toContain(2); // Нагрев
    expect(values).toContain(3); // Охлаждение
  });
});

// ---------------------------------------------------------------------------
// README §"Инвертировать реле нагрева":
//   "При включении нагрева реле отключается, при отключении нагрева — включается"
// ---------------------------------------------------------------------------

describe('README §"Инвертировать реле нагрева"', () => {
  it('режим Нагрев (current=1) + invert → реле нагрева физически OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 18, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 18);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 1, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        heatingRelayInvert: true,
      }), context: '',
    });

    // Логически нагрев ON → физически OFF (инверсия)
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    // Реле охлаждения не инвертировано: логически OFF → физически OFF
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('отключение нагрева (зона комфорта current=0 в активном режиме) + invert → реле нагрева физически ON', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 0, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        heatingRelayInvert: true,
      }), context: '',
    });

    // Логически нагрев OFF → физически ON (инверсия)
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});

describe('README §"Инвертировать реле охлаждения"', () => {
  it('режим Охлаждение (current=2) + invert → реле охлаждения физически OFF', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 2, 2, { currentTemp: 26, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 26);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source, value: 2, variables: freshVars(),
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        coolingRelayInvert: true,
      }), context: '',
    });

    // Логически охлаждение ON → физически OFF (инверсия)
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отключении термостата"
// Применяется к Выключено (0), Вентилятор (-1) и Осушитель (-2).
// ---------------------------------------------------------------------------

function runOff(hub, scenario, targetState, behavior, heatInit, coolInit, opts) {
  opts = opts || {};
  const t = makeThermostat(hub, 10, 0, targetState);
  const sensor = makeTempSensor(hub, 30, 20);
  const heat = makeRelay(hub, 20, 'Нагрев', heatInit);
  const cool = makeRelay(hub, 21, 'Охлаждение', coolInit);
  const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
  const vars = opts.variables || freshVars();

  scenario.run({
    source, value: targetState, variables: vars,
    options: baseOptions({
      sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
      heatingRelay: heat.getService(HS.Switch).getUUID(),
      coolingRelay: cool.getService(HS.Switch).getUUID(),
      offBehavior: behavior,
      heatingRelayInvert: opts.heatingRelayInvert === true,
      coolingRelayInvert: opts.coolingRelayInvert === true,
    }), context: '',
  });

  return { heat, cool, t, vars, source };
}

describe('README §"Поведение при отключении термостата"', () => {
  it('offBehavior=0 (Отключить все реле) + Выключено → оба реле физически OFF', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, 0, 0, true, true);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('offBehavior=1 (Включить все реле) + Выключено → оба реле физически ON', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, 0, 1, false, false);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('offBehavior=2 (Нагрев) + Выключено → нагрев ON, охлаждение OFF', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, 0, 2, false, true);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('offBehavior=3 (Охлаждение) + Выключено → охлаждение ON, нагрев OFF', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, 0, 3, true, false);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('offBehavior распространяется на Вентилятор (-1): Включить все реле → оба ON', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, -1, 1, false, false);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('offBehavior распространяется на Осушитель (-2): Включить все реле → оба ON', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, -2, 1, false, false);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Отключить/Включить все реле — без учёта инверсии"
// ---------------------------------------------------------------------------

describe('README §"Отключить/Включить все реле игнорируют инверсию"', () => {
  it('offBehavior=0 (Отключить все реле) + инверсия нагрева → нагрев всё равно физически OFF', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, 0, 0, true, true, { heatingRelayInvert: true, coolingRelayInvert: true });
    // Инверсия не учитывается: оба реле физически OFF
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('offBehavior=1 (Включить все реле) + инверсия нагрева → нагрев всё равно физически ON', ({ hub, scenario }) => {
    const { heat, cool } = runOff(hub, scenario, 0, 1, false, false, { heatingRelayInvert: true, coolingRelayInvert: true });
    // Инверсия не учитывается: оба реле физически ON
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('offBehavior=2 (Нагрев) + инверсия нагрева → реле нагрева физически OFF (инверсия учитывается)', ({ hub, scenario }) => {
    const { heat } = runOff(hub, scenario, 0, 2, true, false, { heatingRelayInvert: true });
    // Логически нагрев ON → физически OFF (инверсия)
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отключении применяется один раз"
// "Пока термостат отключён, сценарий больше не управляет реле"
// ---------------------------------------------------------------------------

describe('README §"offBehavior применяется один раз"', () => {
  it('повторный trigger в отключённом режиме не перезаписывает изменённое вручную реле', ({ hub, scenario }) => {
    // Первый раз: Включить все реле → оба ON, offBehaviorApplied=true
    const { heat, cool, vars, source } = runOff(hub, scenario, 0, 1, false, false);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(vars.offBehaviorApplied).toBe(true);

    // Пользователь вручную выключил реле нагрева
    heat.char(HS.Switch, HC.On).setValue(false);

    // Повторный trigger в том же отключённом режиме (те же variables)
    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        offBehavior: 1,
      }), context: '',
    });

    // Сценарий не вернул реле нагрева в ON — оставил как поставил пользователь
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('возврат в активный режим сбрасывает offBehaviorApplied и восстанавливает управление реле', ({ hub, scenario }) => {
    // Отключение: Включить все реле → offBehaviorApplied=true
    const { heat, cool, vars, t } = runOff(hub, scenario, 0, 1, false, false);
    expect(vars.offBehaviorApplied).toBe(true);

    // Переходим в активный режим Нагрев (current=1)
    t.char(HS.Thermostat, HC.CurrentHeatingCoolingState).setValue(1);
    t.char(HS.Thermostat, HC.TargetHeatingCoolingState).setValue(1);
    const source2 = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);

    scenario.run({
      source: source2, value: 1, variables: vars,
      options: baseOptions({
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        offBehavior: 1,
      }), context: '',
    });

    // Флаг сброшен, обычная логика отработала: нагрев ON, охлаждение OFF
    expect(vars.offBehaviorApplied).toBe(false);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Поведение при отказе датчика температуры" — Включить все (4)
// ---------------------------------------------------------------------------

describe('README §"failureBehavior=Включить все"', () => {
  it('оба реле ON, TargetHCState НЕ меняется', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 22, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 22);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 22;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 4,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    expect(vars.sensorFailed).toBe(true);
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(true);
    // Целевой режим не меняется — остался 1 (Heat)
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(1);
  });
});

describe('README §"Инверсия применяется при отказе датчика"', () => {
  it('failureBehavior=0 (Отключить все) + инверсия нагрева → нагрев физически ON, TargetHCState=0', ({ hub, scenario, time }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', true);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        heatingRelayInvert: true,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    expect(vars.sensorFailed).toBe(true);
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(0);
    // Логически нагрев OFF → физически ON (инверсия)
    expect(heat.char(HS.Switch, HC.On).getValue()).toBe(true);
    // Охлаждение не инвертировано: логически OFF → физически OFF
    expect(cool.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Отказ датчика не отслеживается при выключенном термостате"
// "Выключили термостат — никаких уведомлений и действий с реле. При включении —
//  возобновить отслеживание и сразу проверить датчик."
// ---------------------------------------------------------------------------

describe('README §"Отказ датчика при выключенном термостате"', () => {
  it('термостат выключен пользователем → cron НЕ фиксирует отказ, нет ошибки в логе', ({ hub, scenario, time, logs }) => {
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.lastUserTargetState = 0; // пользователь выключил термостат
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000; // данных нет уже 5 часов (просрочено)

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    // Отказ не зафиксирован, уведомление не отправлено, термостат остался выключен
    expect(vars.sensorFailed).toBe(false);
    const errors = logs.byLevel('error');
    expect(errors.some((e) => e.message.indexOf('Нет показаний от датчика') >= 0)).toBe(false);
    expect(t.char(HS.Thermostat, HC.TargetHeatingCoolingState).getValue()).toBe(0);
  });

  it('пользователь выключает термостат при активном отказе → sensorFailed снимается', ({ hub, scenario }) => {
    const t = makeThermostat(hub, 10, 1, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', true);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.sensorFailed = true;
    vars.lastUserTargetState = 1;

    // Пользователь переводит термостат в Выключено
    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
      }), context: '',
    });

    expect(vars.sensorFailed).toBe(false);
  });

  it('включение термостата при недоступном датчике → немедленно фиксируется отказ + ошибка в логе', ({ hub, scenario, time, logs }) => {
    // Термостат включается в Нагрев (target=1), датчик недоступен (данные просрочены)
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const cool = makeRelay(hub, 21, 'Охлаждение', false);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.lastUserTargetState = 0; // до этого был выключен
    vars.lastTemp = 20;           // = показанию датчика → lastUpdateTime не обновится
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000; // просрочено

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        coolingRelay: cool.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        failureTimeout: 240,
      }), context: '',
    });

    // Уведомление отправлено сразу при включении, не дожидаясь cron
    expect(vars.sensorFailed).toBe(true);
    const errors = logs.byLevel('error');
    expect(errors.some((e) => e.message.indexOf('Нет показаний от датчика') >= 0)).toBe(true);
  });

  it('включение термостата при живом датчике → отказ НЕ фиксируется', ({ hub, scenario, time, logs }) => {
    const t = makeThermostat(hub, 10, 0, 1, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.TargetHeatingCoolingState);
    const vars = freshVars();
    vars.lastUserTargetState = 0;
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 60 * 1000; // данные свежие (1 мин назад)

    scenario.run({
      source, value: 1, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        failureTimeout: 240,
      }), context: '',
    });

    expect(vars.sensorFailed).toBe(false);
    const errors = logs.byLevel('error');
    expect(errors.some((e) => e.message.indexOf('Нет показаний от датчика') >= 0)).toBe(false);
  });

  it('failureBehavior=0: сценарий сам сбросил target в 0 — это НЕ пользовательское выключение, мониторинг продолжается', ({ hub, scenario, time }) => {
    // Термостат показывает Выключено (сценарий сбросил при отказе), но пользователь хочет Нагрев
    const t = makeThermostat(hub, 10, 0, 0, { currentTemp: 20, targetTemp: 22 });
    const sensor = makeTempSensor(hub, 30, 20);
    const heat = makeRelay(hub, 20, 'Нагрев', false);
    const source = t.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
    const vars = freshVars();
    vars.sensorFailed = true;       // отказ уже зафиксирован
    vars.lastUserTargetState = 1;   // пользователь хочет Нагрев (target=0 поставил сценарий)
    vars.lastTemp = 20;
    vars.lastUpdateTime = time.now() - 5 * 60 * 60 * 1000;

    scenario.run({
      source, value: 0, variables: vars,
      options: baseOptions({
        sensor: sensor.getService(HS.TemperatureSensor).getUUID(),
        heatingRelay: heat.getService(HS.Switch).getUUID(),
        failureBehavior: 0,
        failureTimeout: 240,
      }), context: '',
    });

    time.tick(15 * 60 * 1000);

    // Мониторинг НЕ приостановлен (это не пользовательское выключение): отказ остаётся зафиксированным
    expect(vars.sensorFailed).toBe(true);
  });
});
