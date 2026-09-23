/**
 * Black-box приёмочные тесты сценария «ExternalTempSensor» (логическая часть).
 *
 * Тесты написаны ИСКЛЮЧИТЕЛЬНО от поведенческой спецификации, выданной QA-агенту
 * в задании (см. описание задачи). Исходники сценария (`source/**`), README.md
 * сценария и существующие `.tests/*.test.js` НЕ читались при подготовке этого
 * файла — весь набор ожиданий выведен из текста спецификации и документации
 * ScenarioSimulator (`ScenarioSimulator/README.md`).
 *
 * Каждый describe соответствует разделу спецификации (§N), каждый it —
 * одному конкретному утверждению из этого раздела. Пункты из разделов
 * «Открытые вопросы» и «Неспецифицированные зоны» спецификации сознательно
 * не превращены в падающие тесты (см. правило 7 задания) — при необходимости
 * наблюдения по ним фиксируются в отчёте QA-агента, а не в виде assert’ов тут.
 */

// ---------------------------------------------------------------------------
// Константы и вспомогательные функции
// ---------------------------------------------------------------------------

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;
/**
 * Сколько миллисекунд осталось до ближайшей полуночи ПО ЛОКАЛЬНОМУ времени машины,
 * на которой выполняются тесты (cron-планировщик симулятора резолвит "0 0 * * * *"
 * без явного tz, т.е. через локальную таймзону процесса — см. CronScheduler/cron-parser).
 * Считать заранее нельзя: смещение зависит от TZ окружения, где гоняются тесты.
 */
function msUntilNextMidnight(nowMs) {
  const d = new Date(nowMs);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - nowMs;
}

const START_CTX = 'HUB[OnStart]';
const MANUAL_CTX = '';

// Модели термоголовок, поддерживаемые согласно §1.2 спецификации.
const MODELS = {
  AQARA: { modelId: 'lumi.airrtc.agl001', manufacturer: 'Aqara', hasSwitch: true, label: 'Aqara E1 (SRTS-A01)' },
  SONOFF: { modelId: 'TRVZB', manufacturer: 'SONOFF', hasSwitch: true, label: 'SONOFF TRVZB' },
  DANFOSS: { modelId: 'eTRV0101', manufacturer: 'Danfoss', hasSwitch: true, label: 'Danfoss 014G2463 (eTRV0101)' },
  SMARTKOT: { modelId: 'Opentherm', manufacturer: 'SmartKot', hasSwitch: false, label: 'SmartKot Opentherm' },
};

/** Полный набор опций сценария с возможностью переопределить отдельные поля. */
function baseOptions(overrides) {
  return Object.assign({ desc: '', sensor: '', changeTempPeriodically: 0 }, overrides || {});
}

/**
 * Собирает аксессуар термоголовки с нужным набором сервисов.
 * По умолчанию — полностью корректная термоголовка (все нужные сервисы на месте).
 */
function buildThermostat(hub, opts) {
  opts = opts || {};
  const id = opts.id !== undefined ? opts.id : 100;
  const model = opts.model || MODELS.AQARA;
  const chcState = opts.chcState !== undefined ? opts.chcState : 0;
  const switchOn = opts.switchOn !== undefined ? opts.switchOn : false;
  const targetTemp = opts.targetTemp !== undefined ? opts.targetTemp : 20;
  const includeThermostat = opts.includeThermostat !== undefined ? opts.includeThermostat : true;
  const includeSwitch = opts.includeSwitch !== undefined ? opts.includeSwitch : !!model.hasSwitch;
  const includeTempControl = opts.includeTempControl !== undefined ? opts.includeTempControl : true;

  const services = [];
  if (includeThermostat) {
    services.push({
      type: HS.Thermostat,
      characteristics: [{ type: HC.CurrentHeatingCoolingState, value: chcState }],
    });
  }
  if (includeSwitch) {
    services.push({ type: HS.Switch, characteristics: [{ type: HC.On, value: switchOn }] });
  }
  if (includeTempControl) {
    services.push({
      type: HS.C_TemperatureControl,
      characteristics: [{ type: HC.TargetTemperature, value: targetTemp }],
    });
  }

  return hub.addAccessory({
    id,
    name: opts.name || 'Термоголовка',
    room: opts.room || 'Гостиная',
    modelId: model.modelId,
    manufacturer: model.manufacturer,
    services,
  });
}

/** Собирает аксессуар внешнего датчика температуры. */
function buildSensor(hub, opts) {
  opts = opts || {};
  const id = opts.id !== undefined ? opts.id : 200;
  const temp = opts.temp !== undefined ? opts.temp : 21.5;
  const includeAccessoryInfo = opts.includeAccessoryInfo !== undefined ? opts.includeAccessoryInfo : opts.online !== undefined;

  const services = [
    { type: HS.TemperatureSensor, characteristics: [{ type: HC.CurrentTemperature, value: temp }] },
  ];
  if (includeAccessoryInfo) {
    services.push({
      type: HS.AccessoryInformation,
      characteristics: [{ type: HC.C_Online, value: opts.online }],
    });
  }

  return hub.addAccessory({
    id,
    name: opts.name || 'Датчик воздуха',
    room: opts.room || 'Гостиная',
    services,
  });
}

function sensorUUID(sensorAcc) {
  return sensorAcc.getService(HS.TemperatureSensor).getUUID();
}

function chcChar(thermo) {
  return thermo.char(HS.Thermostat, HC.CurrentHeatingCoolingState);
}
function switchChar(thermo) {
  return thermo.char(HS.Switch, HC.On);
}
function targetTempChar(thermo) {
  return thermo.char(HS.C_TemperatureControl, HC.TargetTemperature);
}
function sensorTempChar(sensor) {
  return sensor.char(HS.TemperatureSensor, HC.CurrentTemperature);
}

/** Вызывает основной триггер сценария (§2.1): источник — CurrentHeatingCoolingState термоголовки. */
function fireTrigger(scenario, thermo, variables, options, callOpts) {
  callOpts = callOpts || {};
  const value = callOpts.value !== undefined ? callOpts.value : 0;
  const context = callOpts.context !== undefined ? callOpts.context : '';
  const source = chcChar(thermo);
  return scenario.run({ source, value, variables, options, context });
}

// ---------------------------------------------------------------------------
// §1.1 — Классификация сценария
// ---------------------------------------------------------------------------

describe('§1.1 Тип сценария и файлы', () => {
  it('info-блок определён и является объектом', ({ scenario }) => {
    const info = scenario.info();
    expect(info).not.toBeNull();
    expect(typeof info).toBe('object');
  });

  it('функции compute нет — scenario.compute бросает исключение', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    expect(() =>
      scenario.compute({ source: chcChar(thermo), value: 0, variables: {}, options: baseOptions() }),
    ).toThrow();
  });

  it('info.sourceServices содержит Thermostat, sourceCharacteristics — CurrentHeatingCoolingState (§2.1)', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceServices).toBeDefined();
    expect(info.sourceCharacteristics).toBeDefined();
    expect(info.sourceServices).toContain(HS.Thermostat);
    expect(info.sourceCharacteristics).toContain(HC.CurrentHeatingCoolingState);
  });

  it('info.onStart === true — сценарий также запускается при старте хаба и при каждом сохранении', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §1.2 — Поддерживаемые термоголовки
// ---------------------------------------------------------------------------

describe('§1.2 Поддерживаемые термоголовки', () => {
  [MODELS.AQARA, MODELS.SONOFF, MODELS.DANFOSS].forEach((model) => {
    it(`${model.label} — распознаётся, переключатель включается, значение синхронизируется`, ({ hub, scenario }) => {
      const thermo = buildThermostat(hub, { model, switchOn: false, targetTemp: 20 });
      const sensor = buildSensor(hub, { temp: 23.4 });
      const vars = {};
      fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
      expect(switchChar(thermo).getValue()).toBe(true);
      expect(targetTempChar(thermo).getValue()).toBe(23.4);
    });
  });

  it('SmartKot Opentherm — переключатель не требуется, синхронизация всё равно происходит', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.SMARTKOT, includeSwitch: false, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 19.9 });
    const vars = {};
    expect(() =>
      fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) })),
    ).not.toThrow();
    expect(targetTempChar(thermo).getValue()).toBe(19.9);
  });

  it('неподдерживаемая модель/производитель — полная остановка, ничего на устройстве не меняется', ({ hub, scenario, logs, cron }) => {
    const thermo = buildThermostat(hub, {
      model: { modelId: 'BadModel123', manufacturer: 'BadBrand', hasSwitch: true },
      switchOn: false,
      targetTemp: 20,
    });
    const sensor = buildSensor(hub, { temp: 22.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 }));
    expect(switchChar(thermo).getValue()).toBe(false);
    expect(targetTempChar(thermo).getValue()).toBe(20);
    expect(cron.listScheduled().length).toBe(0);
    expect(logs.containing('Поддерживаются').length).toBeGreaterThan(0);
    expect(logs.containing('BadBrand').length).toBeGreaterThan(0);
    expect(logs.containing('BadModel123').length).toBeGreaterThan(0);
  });

  it('модель одного поддерживаемого термостата в паре с производителем другого — неподдерживаемая комбинация', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, {
      model: { modelId: MODELS.AQARA.modelId, manufacturer: MODELS.SONOFF.manufacturer, hasSwitch: true },
      switchOn: false,
      targetTemp: 20,
    });
    const sensor = buildSensor(hub, { temp: 22.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(switchChar(thermo).getValue()).toBe(false);
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });

  it('пустые modelId/manufacturer — неподдерживаемый термостат, остановка', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, {
      model: { modelId: '', manufacturer: '', hasSwitch: true },
      switchOn: false,
      targetTemp: 20,
    });
    const sensor = buildSensor(hub, { temp: 22.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(switchChar(thermo).getValue()).toBe(false);
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// §2.1 — Основной триггер
// ---------------------------------------------------------------------------

describe('§2.1 Основной триггер запуска', () => {
  [0, 1, 2].forEach((v) => {
    it(`значение value=${v} на источнике приводит к той же полной процедуре настройки`, ({ hub, scenario }) => {
      const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 10, chcState: v });
      const sensor = buildSensor(hub, { temp: 22.0 });
      const vars = {};
      fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }), { value: v });
      expect(switchChar(thermo).getValue()).toBe(true);
      expect(targetTempChar(thermo).getValue()).toBe(22.0);
    });
  });
});

// ---------------------------------------------------------------------------
// §2.3 — Постоянная подписка на датчик
// ---------------------------------------------------------------------------

describe('§2.3 Постоянная подписка на изменения датчика', () => {
  it('после первого успешного запуска обновление ВЫБРАННОГО датчика мгновенно обновляет TargetTemperature', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 18.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    sensorTempChar(sensor).setValue(24.0);
    expect(targetTempChar(thermo).getValue()).toBe(24.0);
  });

  it('обновление НЕвыбранного датчика (другой TemperatureSensor в системе) игнорируется', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const chosen = buildSensor(hub, { id: 200, temp: 18.0 });
    const other = buildSensor(hub, { id: 201, name: 'Другой датчик', temp: 30.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(chosen) }));
    sensorTempChar(other).setValue(99.0);
    expect(targetTempChar(thermo).getValue()).toBe(18.0);
  });

  it('датчик выбран как сервис типа Thermostat — мгновенные push-обновления по подписке не срабатывают', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const altSensor = hub.addAccessory({
      id: 250,
      name: 'Термостат-как-датчик',
      room: 'Гостиная',
      services: [
        {
          type: HS.Thermostat,
          characteristics: [
            { type: HC.CurrentHeatingCoolingState, value: 0 },
            { type: HC.CurrentTemperature, value: 18.0 },
          ],
        },
      ],
    });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: altSensor.getService(HS.Thermostat).getUUID() }));
    expect(targetTempChar(thermo).getValue()).toBe(18.0);
    altSensor.char(HS.Thermostat, HC.CurrentTemperature).setValue(30.0);
    expect(targetTempChar(thermo).getValue()).toBe(18.0);
  });

  it('повторный успешный trigger не создаёт вторую подписку — единичное обновление датчика обрабатывается один раз', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 18.0 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options);
    fireTrigger(scenario, thermo, vars, options); // повторное "сохранение"
    logs.clear();
    sensorTempChar(sensor).setValue(25.0); // одно реальное срабатывание подписки
    // Если бы подписка задублировалась, обработчик отреагировал бы на это единственное
    // событие дважды, и лог содержал бы вдвое больше записей об обработке.
    expect(logs.all().length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §3.1 — desc
// ---------------------------------------------------------------------------

describe('§3.1 Опция desc', () => {
  it('значение desc не влияет на результат синхронизации', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 22.0 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor), desc: 'Произвольный текст статуса' });
    fireTrigger(scenario, thermo, vars, options);
    expect(targetTempChar(thermo).getValue()).toBe(22.0);
    expect(switchChar(thermo).getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §3.2 — Опция sensor
// ---------------------------------------------------------------------------

describe('§3.2 Опция sensor — валидация и разбор', () => {
  it('sensor="" — ошибка "Выберите внешний датчик", полная остановка', ({ hub, scenario, logs, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }));
    expect(switchChar(thermo).getValue()).toBe(false);
    expect(targetTempChar(thermo).getValue()).toBe(20);
    expect(cron.listScheduled().length).toBe(0);
    expect(logs.containing('Выберите внешний датчик').length).toBeGreaterThan(0);
  });

  it('sensor указывает на несуществующий аксессуар — переключатель включается, значение не пишется, крон-задачи создаются', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '999.1' }));
    expect(switchChar(thermo).getValue()).toBe(true);
    expect(targetTempChar(thermo).getValue()).toBe(20);
    expect(cron.listScheduled().length).toBe(1); // ошибка датчика не мешает настройке ежесуточной задачи
  });

  it('sensor указывает на существующий аксессуар, но несуществующий сервис — значение не пишется', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 22.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: `${sensor.id}.999` }));
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });

  it('sensor без точки-разделителя — трактуется как "датчик не найден"', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: 'abc' }));
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });

  it('sensor с более чем одной точкой — используются первые два сегмента, остальное игнорируется', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 24.5 });
    const svc = sensor.getService(HS.TemperatureSensor);
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: `${sensor.id}.${svc.id}.garbage.more` }));
    expect(targetTempChar(thermo).getValue()).toBe(24.5);
  });

  it('sensor = число вместо строки — не роняет сценарий, обрабатывается как "не найден"', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const vars = {};
    expect(() => fireTrigger(scenario, thermo, vars, baseOptions({ sensor: 424242 }))).not.toThrow();
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// §3.3 — Опция changeTempPeriodically
// ---------------------------------------------------------------------------

describe('§3.3 Опция changeTempPeriodically', () => {
  it('0 (по умолчанию) — задача встряски не создаётся (только ежесуточная)', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 0 }));
    expect(cron.listScheduled().length).toBe(1);
  });

  it('отрицательное значение — трактуется как выключено, задача встряски не создаётся', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: -10 }));
    expect(cron.listScheduled().length).toBe(1);
  });

  it('30 — создаётся дополнительная периодическая задача (2 активных cron)', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 }));
    expect(cron.listScheduled().length).toBe(2);
  });

  it('60 — создаётся дополнительная периодическая задача (2 активных cron)', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }));
    expect(cron.listScheduled().length).toBe(2);
  });

  it('включено → выключено между сохранениями — задача встряски снимается, попутно происходит свежая синхронизация', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 }));
    expect(cron.listScheduled().length).toBe(2);
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 0 }));
    expect(cron.listScheduled().length).toBe(1);
    expect(targetTempChar(thermo).getValue()).toBe(21);
  });

  it('повторный успешный trigger с тем же положительным значением не создаёт лишних задач', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 });
    fireTrigger(scenario, thermo, vars, options);
    fireTrigger(scenario, thermo, vars, options);
    fireTrigger(scenario, thermo, vars, options);
    expect(cron.listScheduled().length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §4 — Переменные состояния
// ---------------------------------------------------------------------------

describe('§4 Переменные состояния', () => {
  it('lastTemp/lastUpdateTime заполняются после первого успешного запуска', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21.3 });
    const vars = {};
    const t0 = time.now();
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(vars.lastTemp).toBe(21.3);
    expect(vars.lastUpdateTime).toBe(t0);
  });

  it('lastUpdateTime не обновляется, если полуночная синхронизация читает то же значение датчика', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21.3 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    const t1 = vars.lastUpdateTime;
    time.advance(msUntilNextMidnight(time.now()));
    expect(targetTempChar(thermo).getValue()).toBe(21.3);
    expect(vars.lastUpdateTime).toBe(t1);
  });

  it('ежесуточная задача создаётся один раз — повторные успешные trigger не плодят вторую', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options);
    fireTrigger(scenario, thermo, vars, options);
    expect(cron.listScheduled().length).toBe(1);
  });

  it('переключатель включается заново на каждом успешном запуске, даже если уже был включён', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: true });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options);
    expect(switchChar(thermo).getValue()).toBe(true);
    switchChar(thermo).setValue(false);
    fireTrigger(scenario, thermo, vars, options);
    expect(switchChar(thermo).getValue()).toBe(true);
  });

  it('синхронизация выполняется заново на каждом успешном запуске (перезаписывает ручное отклонение)', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options);
    expect(targetTempChar(thermo).getValue()).toBe(21);
    targetTempChar(thermo).setValue(30); // ручное отклонение
    fireTrigger(scenario, thermo, vars, options);
    expect(targetTempChar(thermo).getValue()).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// §5 — Порядок проверок и приоритеты
// ---------------------------------------------------------------------------

describe('§5 Порядок проверок и приоритеты', () => {
  it('неподдерживаемый термостат блокирует всё, даже если сенсор и сервисы корректны', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, {
      model: { modelId: 'Q', manufacturer: 'R', hasSwitch: true },
      switchOn: false,
      targetTemp: 20,
    });
    const sensor = buildSensor(hub, { temp: 22 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 }));
    expect(switchChar(thermo).getValue()).toBe(false);
    expect(targetTempChar(thermo).getValue()).toBe(20);
    expect(cron.listScheduled().length).toBe(0);
  });

  it('sensor="" проверяется только после того, как термостат распознан (сначала тип, потом датчик)', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, {
      model: { modelId: 'Q', manufacturer: 'R', hasSwitch: true },
      switchOn: false,
      targetTemp: 20,
    });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }));
    expect(logs.containing('Поддерживаются').length).toBeGreaterThan(0);
    expect(logs.containing('Выберите внешний датчик').length).toBe(0);
  });

  it('переключатель отсутствует (нужен для типа термостата) — ошибка "Не обнаружен переключатель", синхронизация не выполняется', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, includeSwitch: false, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 22 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(20);
    expect(logs.containing('переключатель').length).toBeGreaterThan(0);
  });

  it('сервис "Управление температурой" отсутствует — переключатель НЕ включается (проверка раньше включения)', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, includeTempControl: false, switchOn: false });
    const sensor = buildSensor(hub, { temp: 22 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(switchChar(thermo).getValue()).toBe(false);
  });

  it('переключатель включается безусловно, даже если внешний датчик не найден (шаг 6 раньше шага 7)', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, switchOn: false, targetTemp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '999.999' }));
    expect(switchChar(thermo).getValue()).toBe(true);
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });

  it('офлайн-статус датчика не блокирует применение значения (предупреждение, не ошибка)', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 22.2, online: false });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(22.2);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('несколько сервисов Switch на термоголовке — используется только первый по порядку', ({ hub, scenario }) => {
    const services = [
      { type: HS.Thermostat, characteristics: [{ type: HC.CurrentHeatingCoolingState, value: 0 }] },
      { type: HS.Switch, characteristics: [{ type: HC.On, value: false }] },
      { type: HS.Switch, characteristics: [{ type: HC.On, value: false }] },
      { type: HS.C_TemperatureControl, characteristics: [{ type: HC.TargetTemperature, value: 20 }] },
    ];
    const thermo = hub.addAccessory({
      id: 100,
      name: 'Термоголовка',
      room: 'Гостиная',
      modelId: MODELS.AQARA.modelId,
      manufacturer: MODELS.AQARA.manufacturer,
      services,
    });
    const sensor = buildSensor(hub, { temp: 22 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    const switches = thermo.getServices(undefined, HS.Switch);
    expect(switches.length).toBe(2);
    expect(switches[0].getCharacteristic(HC.On).getValue()).toBe(true);
    expect(switches[1].getCharacteristic(HC.On).getValue()).toBe(false);
  });

  it('несколько сервисов "Управление температурой" — используется только первый по порядку', ({ hub, scenario }) => {
    const services = [
      { type: HS.Thermostat, characteristics: [{ type: HC.CurrentHeatingCoolingState, value: 0 }] },
      { type: HS.Switch, characteristics: [{ type: HC.On, value: false }] },
      { type: HS.C_TemperatureControl, characteristics: [{ type: HC.TargetTemperature, value: 20 }] },
      { type: HS.C_TemperatureControl, characteristics: [{ type: HC.TargetTemperature, value: 15 }] },
    ];
    const thermo = hub.addAccessory({
      id: 100,
      name: 'Термоголовка',
      room: 'Гостиная',
      modelId: MODELS.AQARA.modelId,
      manufacturer: MODELS.AQARA.manufacturer,
      services,
    });
    const sensor = buildSensor(hub, { temp: 26 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    const controls = thermo.getServices(undefined, HS.C_TemperatureControl);
    expect(controls.length).toBe(2);
    expect(controls[0].getCharacteristic(HC.TargetTemperature).getValue()).toBe(26);
    expect(controls[1].getCharacteristic(HC.TargetTemperature).getValue()).toBe(15);
  });

  it('ежесуточная задача создаётся независимо от значения changeTempPeriodically (в т.ч. при выключенной встряске)', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 0 }));
    expect(cron.listScheduled().length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §6 — Процедура синхронизации значения с датчика
// ---------------------------------------------------------------------------

describe('§6 Процедура синхронизации значения с датчика', () => {
  it('нормальное показание датчика (21.7°C) передаётся на TargetTemperature без изменений', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 21.7 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(21.7);
  });

  it('значение ровно -50°C — предупреждения нет, значение применяется', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 25 });
    const sensor = buildSensor(hub, { temp: -50 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(10); // клипается диапазоном характеристики TargetTemperature 10..38
    expect(logs.byLevel('warn').length).toBe(0);
  });

  it('значение чуть меньше -50°C (-50.5) — предупреждение "подозрительное значение", но применяется', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 25 });
    const sensor = buildSensor(hub, { temp: -50.5 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(10);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('значение ровно 100°C — предупреждения нет, значение применяется', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 15 });
    const sensor = buildSensor(hub, { temp: 100 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(38);
    expect(logs.byLevel('warn').length).toBe(0);
  });

  it('значение чуть больше 100°C (100.5) — предупреждение, но значение применяется', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 15 });
    const sensor = buildSensor(hub, { temp: 100.5 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(38);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('датчик online (C_Online=true) — нет предупреждения об офлайне', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 22, online: true });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(22);
    expect(logs.byLevel('warn').length).toBe(0);
  });

  it('у датчика нет сервиса AccessoryInformation вовсе — проверка "в сети" пропускается без предупреждений', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 22 }); // includeAccessoryInfo=false
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(22);
    expect(logs.byLevel('warn').length).toBe(0);
  });

  it('сервис AccessoryInformation есть, но характеристика C_Online отсутствует — трактуется как офлайн (предупреждение), значение применяется', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = hub.addAccessory({
      id: 200,
      name: 'Датчик',
      room: 'Гостиная',
      services: [
        { type: HS.TemperatureSensor, characteristics: [{ type: HC.CurrentTemperature, value: 22 }] },
        { type: HS.AccessoryInformation, characteristics: [] },
      ],
    });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(22);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('на выбранном сервисе отсутствует характеристика CurrentTemperature — значение не передаётся', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const oddAcc = hub.addAccessory({
      id: 300,
      name: 'Не датчик',
      room: 'Гостиная',
      services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: false }] }],
    });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: oddAcc.getService(HS.Switch).getUUID() }));
    expect(targetTempChar(thermo).getValue()).toBe(20);
  });

  it('более суток без реального изменения — при следующей обычной синхронизации фиксируется ошибка ПОСЛЕ применения значения', ({ hub, scenario, time, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 5 });
    const sensor = buildSensor(hub, { temp: 21.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) })); // t=0, lastUpdateTime=0
    // Первая полночь: gap = задержка_до_первой_полуночи (< 24ч) — синк без «суточной» ошибки,
    // значение датчика не меняется => lastUpdateTime остаётся замороженным на 0 (шаг 10 §6).
    time.advance(msUntilNextMidnight(time.now()));
    logs.clear();
    // Вторая полночь: gap = (первая полночь - 0) + 24ч, заведомо > 24ч.
    time.advance(msUntilNextMidnight(time.now()));
    expect(targetTempChar(thermo).getValue()).toBe(21.0); // значение всё равно применено
    expect(logs.byLevel('error').length).toBeGreaterThan(0); // и после этого — ошибка о показаниях более суток
  });
});

// ---------------------------------------------------------------------------
// §7 — Периодическая встряска температуры
// ---------------------------------------------------------------------------

describe('§7 Периодическая встряска температуры', () => {
  it('lastUpdateTime ещё не установлено (первый sync тоже не удался) — встряска всё равно выполняется', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '999.999', changeTempPeriodically: 30 }));
    expect(vars.lastUpdateTime).toBeUndefined();
    time.advance(30 * MS_MIN);
    const v = targetTempChar(thermo).getValue();
    expect(v).toBeGreaterThan(20.05);
    expect(v).toBeLessThan(20.15);
  });

  it('режим 30 минут: 4 минуты 59 секунд с последнего обновления — встряска пропускается', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 })); // t=0
    time.advance(25 * MS_MIN + 1000); // t=25:01
    sensorTempChar(sensor).setValue(19.5);
    time.advance(5 * MS_MIN - 1000); // t=30:00, gap=4:59
    expect(targetTempChar(thermo).getValue()).toBe(19.5);
  });

  it('режим 30 минут: ровно 5 минут с последнего обновления — встряска применяется (порог включительно)', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 30 })); // t=0
    time.advance(25 * MS_MIN); // t=25:00
    sensorTempChar(sensor).setValue(19.5);
    time.advance(5 * MS_MIN); // t=30:00, gap=5:00 ровно
    const v = targetTempChar(thermo).getValue();
    expect(v).toBeGreaterThan(19.55);
    expect(v).toBeLessThan(19.65);
  });

  it('режим 60 минут: 59 минут 59 секунд с последнего обновления — встряска пропускается', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 })); // t=0
    time.advance(1000); // t=0:01
    sensorTempChar(sensor).setValue(19.5);
    time.advance(60 * MS_MIN - 1000); // t=60:00, gap=59:59
    expect(targetTempChar(thermo).getValue()).toBe(19.5);
  });

  it('режим 60 минут: ровно 60 минут с последнего обновления — встряска применяется', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 })); // t=0, lastUpdateTime=0
    time.advance(60 * MS_MIN); // t=60:00, gap=60:00 ровно
    const v = targetTempChar(thermo).getValue();
    expect(v).toBeGreaterThan(19.05);
    expect(v).toBeLessThan(19.15);
  });

  it('более суток без реального изменения показаний — встряска перестаёт срабатывать', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 })); // t=0
    // Проходят все часовые отметки 1..24ч (применяются и восстанавливаются — датчик статичен,
    // поэтому lastUpdateTime остаётся замороженным на t=0), затем отметка 25ч должна быть
    // ПРОПУЩЕНА (с последнего реального изменения прошло 25ч > 24ч).
    time.advance(25 * MS_HOUR);
    expect(targetTempChar(thermo).getValue()).toBe(19.0);
  });

  it('встряска в режиме нагрева (CurrentHeatingCoolingState=1) уменьшает температуру на 0.1°C', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 1 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }), { value: 1 });
    time.advance(60 * MS_MIN);
    const v = targetTempChar(thermo).getValue();
    expect(v).toBeGreaterThan(18.85);
    expect(v).toBeLessThan(18.95);
  });

  [0, 2].forEach((state) => {
    it(`встряска НЕ в режиме нагрева (CurrentHeatingCoolingState=${state}) увеличивает температуру на 0.1°C`, ({ hub, scenario, time }) => {
      const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: state });
      const sensor = buildSensor(hub, { temp: 19.0 });
      const vars = {};
      fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }), { value: state });
      time.advance(60 * MS_MIN);
      const v = targetTempChar(thermo).getValue();
      expect(v).toBeGreaterThan(19.05);
      expect(v).toBeLessThan(19.15);
    });
  });

  it('направление встряски определяется ТЕКУЩИМ состоянием термостата на момент встряски, а не значением при настройке', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }), { value: 0 });
    chcChar(thermo).setValue(1); // напрямую переводим термостат в "нагрев" без повторного trigger
    time.advance(60 * MS_MIN);
    const v = targetTempChar(thermo).getValue();
    // Если бы направление считалось по значению на момент настройки (0 — не нагрев), температура выросла бы.
    expect(v).toBeGreaterThan(18.85);
    expect(v).toBeLessThan(18.95);
  });

  it('через 10 секунд после встряски температура восстанавливается до реального значения с датчика', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }));
    time.advance(60 * MS_MIN); // встряска: ~19.1
    expect(targetTempChar(thermo).getValue()).not.toBe(19.0);
    time.advance(10 * 1000); // +10с -> восстановление
    expect(targetTempChar(thermo).getValue()).toBe(19.0);
  });
});

// ---------------------------------------------------------------------------
// §8 — Ежесуточное полуночное обновление
// ---------------------------------------------------------------------------

describe('§8 Ежесуточное полуночное обновление', () => {
  it('в полночь безусловно выполняется синхронизация — подхватывает значение, изменённое в обход подписки', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 18.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(18.0);
    sensorTempChar(sensor).setValueSilent(23.0); // меняем в обход подписки
    expect(targetTempChar(thermo).getValue()).toBe(18.0); // подписка не сработала
    time.advance(msUntilNextMidnight(time.now()));
    expect(targetTempChar(thermo).getValue()).toBe(23.0); // полночь подхватила
  });

  it('полуночная синхронизация работает при выключенной периодической встряске (changeTempPeriodically=0)', ({ hub, scenario, time, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 18.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 0 }));
    expect(cron.listScheduled().length).toBe(1);
    sensorTempChar(sensor).setValueSilent(17.0);
    time.advance(msUntilNextMidnight(time.now()));
    expect(targetTempChar(thermo).getValue()).toBe(17.0);
  });

  it('полуночное обновление повторяется каждый день', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 10 });
    const sensor = buildSensor(hub, { temp: 18.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    sensorTempChar(sensor).setValueSilent(19.0);
    time.advance(msUntilNextMidnight(time.now())); // первая полночь
    expect(targetTempChar(thermo).getValue()).toBe(19.0);
    sensorTempChar(sensor).setValueSilent(20.0);
    time.advance(MS_DAY); // вторая полночь (местные полуночи ровно в сутках друг от друга)
    expect(targetTempChar(thermo).getValue()).toBe(20.0);
  });
});

// ---------------------------------------------------------------------------
// §9 — Пользовательские сообщения и уровни логирования
// ---------------------------------------------------------------------------

describe('§9 Сообщения и уровни логирования', () => {
  it('успешное первое подключение — в логах появляется сообщение "Подключен внешний датчик"', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(logs.containing('Подключен').length).toBeGreaterThan(0);
  });

  it('сообщение о подключении показывается только один раз за время жизни variables', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 20 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options);
    fireTrigger(scenario, thermo, vars, options);
    fireTrigger(scenario, thermo, vars, options);
    expect(logs.containing('Подключен').length).toBe(1);
  });

  it('ошибка при старте хаба (context содержит HUB[OnStart]) не выводится как полноценная ошибка', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: { modelId: 'X', manufacturer: 'Y', hasSwitch: true } });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }), { context: START_CTX });
    expect(logs.byLevel('error').length).toBe(0);
  });

  it('та же ошибка не при старте хаба — выводится как полноценная ошибка', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: { modelId: 'X', manufacturer: 'Y', hasSwitch: true } });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }), { context: MANUAL_CTX });
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('маркер старта распознаётся как ПОДСТРОКА — context, лишь содержащий "HUB[OnStart]" среди прочего текста, тоже считается стартовым', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }), { context: 'prefix HUB[OnStart] suffix' });
    expect(logs.byLevel('error').length).toBe(0);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('маркер старта регистрозависим — "hub[onstart]" в другом регистре НЕ считается стартовым', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }), { context: 'hub[onstart]' });
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('предупреждения (например, офлайн датчика) выводятся как предупреждение независимо от того, стартовый ли это запуск', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 20, online: false });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }), { context: START_CTX });
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
    expect(logs.byLevel('error').length).toBe(0);
  });

  it('при старте хаба сообщение о подключении идёт тихим уровнем (не message/уведомление), но факт события есть в логе', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }), { context: START_CTX });
    expect(logs.byLevel('message').length).toBe(0);
    expect(logs.containing('Подключен').length).toBeGreaterThan(0);
  });

  it('вне контекста старта сообщение о подключении идёт заметным уровнем message (== всплывающее уведомление)', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 20 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }), { context: MANUAL_CTX });
    expect(logs.byLevel('message').length).toBeGreaterThan(0);
  });

  it('пониженная серьёзность на старте хаба — это уровень warn, а не полное подавление сообщения', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: '' }), { context: START_CTX });
    expect(logs.byLevel('error').length).toBe(0);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §2.2 / §2.3 — Изоляция между независимыми экземплярами сценария
// ---------------------------------------------------------------------------
// У сценария нет общего состояния между устройствами — variables/options
// передаются отдельно на каждый вызов trigger() для конкретной термоголовки,
// а общесистемная подписка на датчик (§2.3) фильтрует события по UUID,
// захваченному в options конкретного экземпляра.

describe('§2.2/§2.3 Изоляция между независимыми экземплярами сценария', () => {
  it('обновление датчика одной термоголовки не влияет на другую термоголовку с другим датчиком', ({ hub, scenario }) => {
    const thermoA = buildThermostat(hub, { id: 100, model: MODELS.AQARA, targetTemp: 20 });
    const sensorA = buildSensor(hub, { id: 200, temp: 18.0 });
    const thermoB = buildThermostat(hub, { id: 101, model: MODELS.AQARA, targetTemp: 20 });
    const sensorB = buildSensor(hub, { id: 201, temp: 30.0 });
    const varsA = {};
    const varsB = {};
    fireTrigger(scenario, thermoA, varsA, baseOptions({ sensor: sensorUUID(sensorA) }));
    fireTrigger(scenario, thermoB, varsB, baseOptions({ sensor: sensorUUID(sensorB) }));
    sensorTempChar(sensorA).setValue(19.0);
    expect(targetTempChar(thermoA).getValue()).toBe(19.0);
    expect(targetTempChar(thermoB).getValue()).toBe(30.0); // не затронута чужим датчиком
  });
});

// ---------------------------------------------------------------------------
// §3.2 (продолжение) — Смена датчика между сохранениями
// ---------------------------------------------------------------------------

describe('§3.2 Смена датчика между сохранениями', () => {
  it('повторный успешный trigger с НОВЫМ sensor немедленно синхронизирует значение с нового датчика (шаг 7 §5 использует актуальные options на каждом вызове)', ({ hub, scenario }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const sensorA = buildSensor(hub, { id: 200, temp: 18.0 });
    const sensorB = buildSensor(hub, { id: 201, temp: 25.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensorA) }));
    expect(targetTempChar(thermo).getValue()).toBe(18.0);
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensorB) }));
    expect(targetTempChar(thermo).getValue()).toBe(25.0);
  });
});

// ---------------------------------------------------------------------------
// §3.3 / §7 — Отмена отложенного восстановления при отключении встряски "в полёте"
// ---------------------------------------------------------------------------

describe('§3.3/§7 Отмена восстановления при отключении встряски в 10-секундном окне', () => {
  it('отключение встряски и порча датчика в одном и том же trigger — термоголовка остаётся на встряхнутом значении дольше исходных 10с', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }));
    time.advance(60 * MS_MIN); // встряска: ~19.1, запланировано восстановление через 10с
    const shaken = targetTempChar(thermo).getValue();
    expect(shaken).not.toBe(19.0);
    // в том же сохранении отключаем встряску И одновременно ломаем датчик (ссылка на сервис без CurrentTemperature)
    const brokenSensorRef = thermo.getService(HS.Switch).getUUID();
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: brokenSensorRef, changeTempPeriodically: 0 }));
    time.advance(15 * 1000); // заведомо позже исходных 10с восстановления
    // если бы отложенное восстановление не было отменено вместе с задачей встряски, оно сработало бы
    // через 10с после встряски и вернуло бы значение; здесь оно остаётся "застрявшим"
    expect(targetTempChar(thermo).getValue()).toBe(shaken);
  });
});

// ---------------------------------------------------------------------------
// §5 (продолжение) — Уровни логирования и дополнительные краевые случаи порядка
// ---------------------------------------------------------------------------

describe('§5 Дополнительные проверки уровня логирования и порядка', () => {
  it('отсутствие переключателя вне контекста старта — уровень error, без warn', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, includeSwitch: false, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 22 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
    expect(logs.byLevel('warn').length).toBe(0);
  });

  it('отсутствие сервиса "Управление температурой" вне контекста старта — уровень error', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, includeTempControl: false, switchOn: false });
    const sensor = buildSensor(hub, { temp: 22 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('несколько сервисов Thermostat — направление встряски определяется ПЕРВЫМ по порядку сервисом, а не остальными', ({ hub, scenario, time }) => {
    const services = [
      { type: HS.Thermostat, characteristics: [{ type: HC.CurrentHeatingCoolingState, value: 1 }] }, // первый: нагрев -> уменьшение
      { type: HS.Thermostat, characteristics: [{ type: HC.CurrentHeatingCoolingState, value: 0 }] }, // второй: не нагрев -> увеличение (не должен использоваться)
      { type: HS.Switch, characteristics: [{ type: HC.On, value: false }] },
      { type: HS.C_TemperatureControl, characteristics: [{ type: HC.TargetTemperature, value: 20 }] },
    ];
    const thermo = hub.addAccessory({
      id: 100,
      name: 'Термоголовка',
      room: 'Гостиная',
      modelId: MODELS.AQARA.modelId,
      manufacturer: MODELS.AQARA.manufacturer,
      services,
    });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    const thermostats = thermo.getServices(undefined, HS.Thermostat);
    scenario.run({
      source: thermostats[0].getCharacteristic(HC.CurrentHeatingCoolingState),
      value: 1,
      variables: vars,
      options: baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }),
      context: '',
    });
    time.advance(60 * MS_MIN);
    const v = targetTempChar(thermo).getValue();
    // если бы использовался второй сервис (chcState=0, не нагрев), температура выросла бы выше 19.0
    expect(v).toBeGreaterThan(18.85);
    expect(v).toBeLessThan(18.95);
  });

  it('датчик офлайн И одновременно вне разумных пределов одновременно — оба предупреждения, значение применяется, ошибки нет', ({ hub, scenario, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const sensor = hub.addAccessory({
      id: 200,
      name: 'Датчик',
      room: 'Гостиная',
      services: [
        { type: HS.TemperatureSensor, characteristics: [{ type: HC.CurrentTemperature, value: 150 }] },
        { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: false }] },
      ],
    });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor) }));
    expect(targetTempChar(thermo).getValue()).toBe(38); // 150 применено, клипировано диапазоном характеристики (10..38)
    expect(logs.byLevel('warn').length).toBe(2); // офлайн + подозрительное значение
    expect(logs.byLevel('error').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §6 — Точная суточная граница (24ч) при пост-проверке синхронизации (шаг 11)
// ---------------------------------------------------------------------------

describe('§6 Точная суточная граница (шаг 11)', () => {
  it('ровно 24 часа с последнего обновления — ошибка "более суток" ещё НЕ фиксируется', ({ hub, scenario, time, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 19.0 }); // статичное значение — lastUpdateTime не продлевается
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options); // t=0, lastUpdateTime=0
    time.advance(MS_DAY); // ровно 24ч
    logs.clear();
    fireTrigger(scenario, thermo, vars, options); // форсируем синхронизацию ровно в момент t=24ч
    expect(logs.byLevel('error').length).toBe(0);
  });

  it('чуть больше 24 часов с последнего обновления — ошибка "более суток" фиксируется', ({ hub, scenario, time, logs }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20 });
    const sensor = buildSensor(hub, { temp: 19.0 });
    const vars = {};
    const options = baseOptions({ sensor: sensorUUID(sensor) });
    fireTrigger(scenario, thermo, vars, options); // t=0
    time.advance(MS_DAY + 1000); // 24ч + 1с
    logs.clear();
    fireTrigger(scenario, thermo, vars, options);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §7 — Точная суточная граница (24ч) при предпроверке встряски (шаг 2)
// ---------------------------------------------------------------------------

describe('§7 Точная суточная граница встряски (шаг 2)', () => {
  it('встряска ровно в момент 24ч с последнего обновления — ещё выполняется; на 25ч — уже пропущена', ({ hub, scenario, time }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA, targetTemp: 20, chcState: 0 });
    const sensor = buildSensor(hub, { temp: 19.0 }); // статичное значение, lastUpdateTime заморожен на t=0
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 60 }));
    time.advance(24 * MS_HOUR); // 24-й часовой тик — gap ровно 24ч (не "больше" 24ч)
    const atExactly24h = targetTempChar(thermo).getValue();
    expect(atExactly24h).toBeGreaterThan(19.05);
    expect(atExactly24h).toBeLessThan(19.15);
    time.advance(10 * 1000); // восстановление 24-го тика
    expect(targetTempChar(thermo).getValue()).toBe(19.0);
    time.advance(1 * MS_HOUR - 10 * 1000); // 25-й часовой тик — gap 25ч > 24ч, встряска пропущена
    expect(targetTempChar(thermo).getValue()).toBe(19.0);
  });
});

// ---------------------------------------------------------------------------
// §3.3 — Нестандартное положительное значение (в обход UI-списка {0,30,60})
// ---------------------------------------------------------------------------

describe('§3.3 Нестандартное положительное значение changeTempPeriodically', () => {
  it('45 (технически передано в обход UI-списка) всё равно создаёт дополнительную периодическую задачу', ({ hub, scenario, cron }) => {
    const thermo = buildThermostat(hub, { model: MODELS.AQARA });
    const sensor = buildSensor(hub, { temp: 21 });
    const vars = {};
    fireTrigger(scenario, thermo, vars, baseOptions({ sensor: sensorUUID(sensor), changeTempPeriodically: 45 }));
    expect(cron.listScheduled().length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Метаданные info.options — соответствие §3
// ---------------------------------------------------------------------------

describe('Метаданные опций (info.options) соответствуют §3', () => {
  it('desc: тип String, formType status, значение по умолчанию ""', ({ scenario }) => {
    const opt = scenario.info().options.desc;
    expect(opt.type).toBe('String');
    expect(opt.formType).toBe('status');
    expect(opt.value).toBe('');
  });

  it('sensor: тип String, formType list, значение по умолчанию ""', ({ scenario }) => {
    const opt = scenario.info().options.sensor;
    expect(opt.type).toBe('String');
    expect(opt.formType).toBe('list');
    expect(opt.value).toBe('');
  });

  it('changeTempPeriodically: тип Integer, formType list, значение по умолчанию 0, три пункта списка со значениями 0/30/60', ({ scenario }) => {
    const opt = scenario.info().options.changeTempPeriodically;
    expect(opt.type).toBe('Integer');
    expect(opt.formType).toBe('list');
    expect(opt.value).toBe(0);
    expect(opt.values.length).toBe(3);
    expect(opt.values.map((v) => v.value)).toEqual([0, 30, 60]);
    expect(opt.values.map((v) => v.key)).toEqual(['OFF', 'MIN_30', 'HOUR_1']);
  });
});

// ---------------------------------------------------------------------------
// §2.1/§2.2 — Триггерящая характеристика — только CurrentHeatingCoolingState
// ---------------------------------------------------------------------------

describe('§2.2 Триггерящая характеристика — только CurrentHeatingCoolingState', () => {
  it('info.sourceCharacteristics содержит РОВНО одну характеристику CurrentHeatingCoolingState и не содержит прочих характеристик термостата', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceCharacteristics.length).toBe(1);
    expect(info.sourceCharacteristics).toContain(HC.CurrentHeatingCoolingState);
    expect(info.sourceCharacteristics).not.toContain(HC.TargetTemperature);
    expect(info.sourceCharacteristics).not.toContain(HC.TargetHeatingCoolingState);
    expect(info.sourceCharacteristics).not.toContain(HC.CurrentTemperature);
  });
});

