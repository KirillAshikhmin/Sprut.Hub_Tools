// Black-box тесты логического сценария «☀️ Свет в окне» (SunInWindow) от поведенческой
// спецификации `.tests/SPEC.md`. Исходник сценария, его README и чужие тесты НЕ читались:
// все ожидания выведены из SPEC.md, а опорные значения астрономии посчитаны независимой
// реализацией алгоритма NOAA Solar Calculator (см. §4.3/§4.4 SPEC.md).
//
// Каждый describe — раздел SPEC.md, каждый it — одно конкретное утверждение.
// Единственный шов — scenario.run(...) плюс виртуальное время (§18.1).

// --------------------------------------------------------------------------------------
// Хелперы
// --------------------------------------------------------------------------------------

// Полный набор опций из §3 SPEC.md со значениями по умолчанию.
function baseOptions(overrides) {
  const o = {
    latitude: 55.7558,
    longitude: 37.6173,
    windowDirection: 180,
    windowAzimuth: -1,
    minSunAltitude: 5,
    maxAzimuthDeviation: 90,
    updateInterval: 1,
    allowManualControl: false,
    changeServiceName: false,
    invert: false,
  };
  if (overrides) {
    const keys = Object.keys(overrides);
    for (let i = 0; i < keys.length; i++) o[keys[i]] = overrides[keys[i]];
  }
  return o;
}

// Уникальные id аксессуаров внутри одного it (стенд пересоздаёт хаб на каждый тест).
let nextAccId = 1;

// Виртуальный выключатель, на котором живёт сценарий (§2.1).
function addWindowSwitch(hub, id, serviceName) {
  return hub.addAccessory({
    id: id === undefined ? 10 : id,
    name: 'Окно',
    services: [{
      type: HS.Switch,
      name: serviceName === undefined ? 'Окно' : serviceName,
      characteristics: [{ type: HC.On, value: false }],
    }],
  });
}

// Один прогон сценария «с нуля» в заданный момент времени.
// Характеристика предварительно ставится в ЗАВЕДОМО ПРОТИВОПОЛОЖНОЕ ожидаемому значение,
// поэтому совпадение с `expected` доказывает, что сценарий реально записал результат,
// а не «промолчал».
function flagAt(ctx, iso, overrides, expected) {
  ctx.time.set(iso);
  const acc = addWindowSwitch(ctx.hub, 10 + (nextAccId++));
  const char = acc.char(HS.Switch, HC.On);
  char.setValueSilent(!expected);
  ctx.scenario.run({
    source: char,
    value: char.getValue(),
    variables: {},
    options: baseOptions(overrides),
    context: '',
  });
  return char.getValue();
}

// Азимутонезависимая проверка высоты Солнца: при maxAzimuthDeviation = 90 хотя бы один
// из четырёх кардинальных румбов заведомо укладывается в сектор при ЛЮБОМ азимуте Солнца.
// Значит «хотя бы один румб дал true» эквивалентно «высота >= minSunAltitude» (§4.3, §17.6).
function anyCardinalOn(ctx, iso, overrides) {
  const rumbs = [0, 90, 180, 270];
  for (let i = 0; i < rumbs.length; i++) {
    const merged = baseOptions(overrides);
    merged.windowDirection = rumbs[i];
    merged.windowAzimuth = -1;
    merged.maxAzimuthDeviation = 90;
    ctx.time.set(iso);
    const acc = addWindowSwitch(ctx.hub, 10 + (nextAccId++));
    const char = acc.char(HS.Switch, HC.On);
    ctx.scenario.run({ source: char, value: false, variables: {}, options: merged, context: '' });
    if (char.getValue() === true) return true;
  }
  return false;
}

// --------------------------------------------------------------------------------------
// Опорные моменты времени (UTC) из §4.3/§4.4 SPEC.md
// --------------------------------------------------------------------------------------

const MSK_JUN_NOON = '2024-06-21T09:31:26Z'; // высота 57,68°, азимут 180,0°
const MSK_DEC_NOON = '2024-12-21T09:27:48Z'; // высота 10,81°, азимут 180,0°
const EQ_EQUINOX_NOON = '2024-03-20T12:07:17Z'; // экватор: высота 89,85°
const EQ_EQUINOX_1200 = '2024-03-20T12:00:00Z'; // экватор: высота 88,17° (поправка D01)
const MSK_JUN_0100 = '2024-06-21T01:00:00Z'; // высота 0,69°, азимут 46,44°
const MSK_JUN_1700 = '2024-06-21T17:00:00Z'; // высота 7,72°, азимут 300,94°
const MSK_JUN_AZ90 = '2024-06-21T04:40:00Z'; // высота 28,76°, азимут 89,99°
const MSK_JUN_AZ135 = '2024-06-21T07:36:30Z'; // высота 51,40°, азимут 135,02°
const MSK_JUN_AZ225 = '2024-06-21T11:26:20Z'; // высота 51,41°, азимут 224,97°
const MSK_JUN_AZ270 = '2024-06-21T14:22:50Z'; // высота 28,76°, азимут 270,00°
const SVALBARD = { latitude: 78, longitude: 15 };
const SVAL_JUN_MIDNIGHT = '2024-06-21T23:02:00Z'; // высота 11,44°, азимут 359,99°
const SVAL_JUN_0600 = '2024-06-21T06:00:00Z'; // высота 25,91°, азимут 99,12°
const SYDNEY = { latitude: -33.87, longitude: 151.21 };
const SYD_DEC_AZ350 = '2024-12-21T02:01:10Z'; // высота 79,43°, азимут 350,09°
const SYD_DEC_AZ10 = '2024-12-21T01:45:20Z'; // высота 79,43°, азимут 9,97°

// ======================================================================================
// §2. Триггеры и жизненный цикл
// ======================================================================================

describe('§2 Триггеры и жизненный цикл', () => {
  it('§2.1 сценарий привязан к сервисам Switch / Outlet / Lightbulb', ({ scenario }) => {
    const services = scenario.info().sourceServices;
    expect(services).toContain(HS.Switch);
    expect(services).toContain(HS.Outlet);
    expect(services).toContain(HS.Lightbulb);
  });

  it('§2.1 триггерными характеристиками объявлены On и Active', ({ scenario }) => {
    const chars = scenario.info().sourceCharacteristics;
    expect(chars).toContain(HC.On);
    expect(chars).toContain(HC.Active);
  });

  it('§2.2 onStart включён — сценарий считается при запуске хаба и сохранении', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });

  it('§2.3 первый расчёт выполняется в том же вызове trigger, а не по таймеру', (ctx) => {
    ctx.time.set(MSK_JUN_NOON);
    const acc = addWindowSwitch(ctx.hub);
    const char = acc.char(HS.Switch, HC.On);
    expect(char.getValue()).toBe(false);
    ctx.scenario.run({
      source: char,
      value: false,
      variables: {},
      options: baseOptions({ windowDirection: 180, maxAzimuthDeviation: 5 }),
      context: '',
    });
    // Ни одного продвижения времени не было — значение уже корректное.
    expect(char.getValue()).toBe(true);
  });
});

// Правдоподобные чужие строки context: так хаб помечает изменение из веб-интерфейса и из
// мобильного приложения. Формат «своей» строки для этих тестов знать не нужно — важно, что
// чужая не должна глушить сценарий (§2.2 пункт 3, §18.8).
const CONTEXT_WEB = 'WEB[admin]_123';
const CONTEXT_APP = 'APP[iphone]';

describe('§2.2 Чужой context — обычное внешнее изменение, а не «своя» запись', () => {
  it('§2.2 первый расчёт выполняется и при непустом чужом context', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON, { windowDirection: 180, maxAzimuthDeviation: 5 }, false);
    s.run(false, CONTEXT_WEB);
    expect(s.char.getValue()).toBe(true);
  });

  it('§2.2 выключение из веб-интерфейса откатывается, как любое чужое изменение', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: false }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    s.char.setValue(false);
    s.run(false, CONTEXT_WEB);
    expect(s.char.getValue()).toBe(true);
  });

  it('§2.2 то же с context мобильного приложения', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: false }, false);
    s.run();
    s.char.setValue(false);
    s.run(false, CONTEXT_APP);
    expect(s.char.getValue()).toBe(true);
  });

  it('§2.2 при чужом context таймер пересчёта ставится как обычно', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, updateInterval: 1 }, false);
    s.run(false, CONTEXT_WEB);
    expect(ctx.time.pendingCount()).toBe(1);
  });
});

// ======================================================================================
// §4. Астрономия — опорные значения формулы
// ======================================================================================

describe('§4.3 Опора О1 — Москва, 21 июня, истинный солнечный полдень', () => {
  it('§4.3 высота Солнца не ниже 57,0° (ожидание 57,68°)', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, minSunAltitude: 57 }, true)).toBe(true);
  });

  it('§4.3 высота Солнца ниже 58,5° — значит это 57,7°, а не «просто высоко»', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, minSunAltitude: 58.5 }, false)).toBe(false);
  });

  it('§4.3 азимут Солнца отличается от Юга меньше чем на 1°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 1, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§4.3 окно на Север в тот же момент солнца не видит', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 0, maxAzimuthDeviation: 90, minSunAltitude: 0 }, false)).toBe(false);
  });
});

describe('§4.3 Опора О2 — Москва, 21 декабря, истинный солнечный полдень', () => {
  it('§4.3 высота Солнца не ниже 10,2° (ожидание 10,81°)', (ctx) => {
    expect(flagAt(ctx, MSK_DEC_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, minSunAltitude: 10.2 }, true)).toBe(true);
  });

  it('§4.3 высота Солнца ниже 11,4° — зимний полдень, а не летний', (ctx) => {
    expect(flagAt(ctx, MSK_DEC_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, minSunAltitude: 11.4 }, false)).toBe(false);
  });

  it('§4.3 азимут Солнца отличается от Юга меньше чем на 1°', (ctx) => {
    expect(flagAt(ctx, MSK_DEC_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 1, minSunAltitude: 0 }, true)).toBe(true);
  });
});

describe('§4.3 Опора О3 — экватор, равноденствие, истинный солнечный полдень', () => {
  it('§4.3 Солнце практически в зените: высота не ниже 89°', (ctx) => {
    expect(anyCardinalOn(ctx, EQ_EQUINOX_NOON,
      { latitude: 0, longitude: 0, minSunAltitude: 89 })).toBe(true);
  });
});

describe('§4.3 Поправка D01 — 12:00 UTC в равноденствие не является солнечным полднем', () => {
  it('§4.2 в 12:00 UTC высота на экваторе НИЖЕ 89° (уравнение времени учтено)', (ctx) => {
    expect(anyCardinalOn(ctx, EQ_EQUINOX_1200,
      { latitude: 0, longitude: 0, minSunAltitude: 89 })).toBe(false);
  });

  it('§4.2 но не ниже 87,5° — это 88,2°, а не произвольная ошибка', (ctx) => {
    expect(anyCardinalOn(ctx, EQ_EQUINOX_1200,
      { latitude: 0, longitude: 0, minSunAltitude: 87.5 })).toBe(true);
  });
});

describe('§4.3 Опора О4 — Москва, 21 июня, утро и вечер', () => {
  it('§4.3 в 04:00 местного (01:00 UTC) Солнце в северо-восточном секторе', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_0100,
      { windowDirection: 45, maxAzimuthDeviation: 5, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§4.3 в 04:00 местного окно на Юго-Запад солнца не видит', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_0100,
      { windowDirection: 225, maxAzimuthDeviation: 90, minSunAltitude: 0 }, false)).toBe(false);
  });

  it('§4.3 в 20:00 местного (17:00 UTC) Солнце в северо-западном секторе', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_1700,
      { windowDirection: 315, maxAzimuthDeviation: 20, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§4.3 в 20:00 местного отклонение от Северо-Запада больше 10° (азимут 300,9°)', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_1700,
      { windowDirection: 315, maxAzimuthDeviation: 10, minSunAltitude: 0 }, false)).toBe(false);
  });
});

// ======================================================================================
// §3. Опции — контракт info (типы, диапазоны, значения по умолчанию)
// ======================================================================================

describe('§3 Опции — типы, диапазоны и значения по умолчанию', () => {
  it('§3 latitude: Double, −90…90, по умолчанию 55.7558', ({ scenario }) => {
    const o = scenario.info().options.latitude;
    expect(o.type).toBe('Double');
    expect(o.value).toBe(55.7558);
    expect(o.minValue).toBe(-90);
    expect(o.maxValue).toBe(90);
  });

  it('§3 longitude: Double, −180…180, по умолчанию 37.6173', ({ scenario }) => {
    const o = scenario.info().options.longitude;
    expect(o.type).toBe('Double');
    expect(o.value).toBe(37.6173);
    expect(o.minValue).toBe(-180);
    expect(o.maxValue).toBe(180);
  });

  it('§3 windowDirection: Integer, по умолчанию 180 (Юг)', ({ scenario }) => {
    const o = scenario.info().options.windowDirection;
    expect(o.type).toBe('Integer');
    expect(o.value).toBe(180);
  });

  it('§6.2 windowAzimuth: Double, −1…360, по умолчанию −1 (сентинел «не задан»)', ({ scenario }) => {
    const o = scenario.info().options.windowAzimuth;
    expect(o.type).toBe('Double');
    expect(o.value).toBe(-1);
    expect(o.minValue).toBe(-1);
    expect(o.maxValue).toBe(360);
  });

  it('§7.1 minSunAltitude: Double, 0…90, по умолчанию 5', ({ scenario }) => {
    const o = scenario.info().options.minSunAltitude;
    expect(o.type).toBe('Double');
    expect(o.value).toBe(5);
    expect(o.minValue).toBe(0);
    expect(o.maxValue).toBe(90);
  });

  it('§7.2 maxAzimuthDeviation: Double, 1…90, по умолчанию 90', ({ scenario }) => {
    const o = scenario.info().options.maxAzimuthDeviation;
    expect(o.type).toBe('Double');
    expect(o.value).toBe(90);
    expect(o.minValue).toBe(1);
    expect(o.maxValue).toBe(90);
  });

  it('§13.2 updateInterval: Integer, 1…60, по умолчанию 1', ({ scenario }) => {
    const o = scenario.info().options.updateInterval;
    expect(o.type).toBe('Integer');
    expect(o.value).toBe(1);
    expect(o.minValue).toBe(1);
    expect(o.maxValue).toBe(60);
  });

  it('§12 allowManualControl: Boolean, по умолчанию false', ({ scenario }) => {
    const o = scenario.info().options.allowManualControl;
    expect(o.type).toBe('Boolean');
    expect(o.value).toBe(false);
  });

  it('§11 changeServiceName: Boolean, по умолчанию false', ({ scenario }) => {
    const o = scenario.info().options.changeServiceName;
    expect(o.type).toBe('Boolean');
    expect(o.value).toBe(false);
  });

  it('§10 invert: Boolean, по умолчанию false', ({ scenario }) => {
    const o = scenario.info().options.invert;
    expect(o.type).toBe('Boolean');
    expect(o.value).toBe(false);
  });
});

// ======================================================================================
// §5. Правило «солнце в окне»
// ======================================================================================

describe('§5 Правило «солнце в окне» — оба условия обязательны', () => {
  it('§5 высота и азимут проходят → флаг поднят', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§7.3 азимут идеально совпал, но высота ниже порога → флаг снят', (ctx) => {
    // Москва 01:00Z: высота 0,69°, азимут 46,44° — окно на СВ, порог высоты 5°.
    expect(flagAt(ctx, MSK_JUN_0100,
      { windowDirection: 45, maxAzimuthDeviation: 5, minSunAltitude: 5 }, false)).toBe(false);
  });

  it('§7.3 тот же момент с порогом высоты 0 → флаг поднят (виноват был именно порог)', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_0100,
      { windowDirection: 45, maxAzimuthDeviation: 5, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§7.3 высота отличная, но азимут вне сектора → флаг снят', (ctx) => {
    // Москва, солнечный полдень: азимут 180°, окно на ЮВ (135°) — отклонение 45° > 30°.
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 135, maxAzimuthDeviation: 30, minSunAltitude: 0 }, false)).toBe(false);
  });

  it('§7.3 тот же момент с допуском 50° → флаг поднят (виноват был именно сектор)', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 135, maxAzimuthDeviation: 50, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§5 не проходят оба условия сразу → флаг снят', (ctx) => {
    // Москва, 21.12 00:00Z: высота −47,3°, азимут 56,6°; окно на Юг, допуск 45°.
    expect(flagAt(ctx, '2024-12-21T00:00:00Z',
      { windowDirection: 180, maxAzimuthDeviation: 45, minSunAltitude: 0 }, false)).toBe(false);
  });

  it('§5 ночью флаг снят даже при нулевом пороге и совпадающем азимуте', (ctx) => {
    // Москва, 21.12 20:00Z: высота −53,85°, азимут 324,36° — окно на СЗ, допуск 20°, порог 0.
    expect(flagAt(ctx, '2024-12-21T20:00:00Z',
      { windowDirection: 315, maxAzimuthDeviation: 20, minSunAltitude: 0 }, false)).toBe(false);
  });
});

describe('§5 Круговая разность азимутов', () => {
  it('§5 окно на 10°, солнце на 350° — отклонение 20°, а не 340° → флаг поднят', (ctx) => {
    expect(flagAt(ctx, SYD_DEC_AZ350, {
      latitude: SYDNEY.latitude, longitude: SYDNEY.longitude,
      windowAzimuth: 10, maxAzimuthDeviation: 25, minSunAltitude: 5,
    }, true)).toBe(true);
  });

  it('§5 тот же момент с допуском 15° → флаг снят (отклонение всё же 19,9°)', (ctx) => {
    expect(flagAt(ctx, SYD_DEC_AZ350, {
      latitude: SYDNEY.latitude, longitude: SYDNEY.longitude,
      windowAzimuth: 10, maxAzimuthDeviation: 15, minSunAltitude: 5,
    }, false)).toBe(false);
  });

  it('§5 зеркально: окно на 350°, солнце на 10° → отклонение 20°, флаг поднят', (ctx) => {
    expect(flagAt(ctx, SYD_DEC_AZ10, {
      latitude: SYDNEY.latitude, longitude: SYDNEY.longitude,
      windowAzimuth: 350, maxAzimuthDeviation: 25, minSunAltitude: 5,
    }, true)).toBe(true);
  });

  it('§5 зеркально с допуском 15° → флаг снят', (ctx) => {
    expect(flagAt(ctx, SYD_DEC_AZ10, {
      latitude: SYDNEY.latitude, longitude: SYDNEY.longitude,
      windowAzimuth: 350, maxAzimuthDeviation: 15, minSunAltitude: 5,
    }, false)).toBe(false);
  });

  it('§5 контроль без перехода через север: окно 320°, солнце 300,9° → отклонение 19,1°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_1700,
      { windowAzimuth: 320, maxAzimuthDeviation: 25, minSunAltitude: 5 }, true)).toBe(true);
  });
});

// ======================================================================================
// §6. Направление окна
// ======================================================================================

describe('§6.1 Восемь румбов — попадание', () => {
  it('§6.1 Север (0°): полярный день, нижняя кульминация — азимут 359,99°', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_MIDNIGHT, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 0, maxAzimuthDeviation: 5, minSunAltitude: 5,
    }, true)).toBe(true);
  });

  it('§6.1 Северо-Восток (45°): Москва 01:00Z — азимут 46,44°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_0100,
      { windowDirection: 45, maxAzimuthDeviation: 5, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§6.1 Восток (90°): Москва 04:40Z — азимут 89,99°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ90,
      { windowDirection: 90, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.1 Юго-Восток (135°): Москва 07:36:30Z — азимут 135,02°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ135,
      { windowDirection: 135, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.1 Юг (180°): Москва, солнечный полдень — азимут 180,0°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.1 Юго-Запад (225°): Москва 11:26:20Z — азимут 224,97°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ225,
      { windowDirection: 225, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.1 Запад (270°): Москва 14:22:50Z — азимут 270,00° (окно на запад, вторая половина дня)', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ270,
      { windowDirection: 270, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.1 Северо-Запад (315°): Москва 17:00Z — азимут 300,94°, допуск 20°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_1700,
      { windowDirection: 315, maxAzimuthDeviation: 20, minSunAltitude: 5 }, true)).toBe(true);
  });
});

describe('§6.1 Восемь румбов — промах', () => {
  it('§6.1 в южный солнечный полдень при допуске 30° попадает только румб Юг', (ctx) => {
    const misses = [0, 45, 90, 135, 225, 270, 315];
    for (let i = 0; i < misses.length; i++) {
      expect(flagAt(ctx, MSK_JUN_NOON,
        { windowDirection: misses[i], maxAzimuthDeviation: 30, minSunAltitude: 0 }, false)).toBe(false);
    }
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 30, minSunAltitude: 0 }, true)).toBe(true);
  });

  it('§6.1 в полярный день окно на Восток в нижней кульминации солнца не видит', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_MIDNIGHT, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 90, maxAzimuthDeviation: 5, minSunAltitude: 5,
    }, false)).toBe(false);
  });
});

describe('§6.2 Приоритет точного азимута над румбом', () => {
  it('§6.2 windowAzimuth = 270 перебивает румб Север', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ270,
      { windowDirection: 0, windowAzimuth: 270, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.2 windowAzimuth = 0 (законный Север) тоже перебивает румб Юг', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_MIDNIGHT, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 180, windowAzimuth: 0, maxAzimuthDeviation: 5, minSunAltitude: 5,
    }, true)).toBe(true);
  });

  it('§6.2 windowAzimuth = 360 эквивалентен 0 (Север)', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_MIDNIGHT, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 180, windowAzimuth: 360, maxAzimuthDeviation: 5, minSunAltitude: 5,
    }, true)).toBe(true);
  });

  it('§6.2 windowAzimuth = −1 → направление берётся из румба (Запад попадает)', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ270,
      { windowDirection: 270, windowAzimuth: -1, maxAzimuthDeviation: 5, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.2 windowAzimuth = −1 → румб Север в тот же момент промахивается', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ270,
      { windowDirection: 0, windowAzimuth: -1, maxAzimuthDeviation: 5, minSunAltitude: 5 }, false)).toBe(false);
  });

  it('§6.2 дробный азимут 300,9° попадает с допуском 1°', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_1700,
      { windowDirection: 0, windowAzimuth: 300.9, maxAzimuthDeviation: 1, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§6.2 азимут 295° с допуском 1° не попадает — угол учитывается точно', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_1700,
      { windowDirection: 0, windowAzimuth: 295, maxAzimuthDeviation: 1, minSunAltitude: 5 }, false)).toBe(false);
  });
});

// ======================================================================================
// §8. Сезонная и суточная зависимость (G01)
// ======================================================================================

describe('§8 Расчёт ведётся на текущие дату и время (G01)', () => {
  it('§8 в 09:30 UTC 21 июня окно на Юг с порогом высоты 30° солнце видит', (ctx) => {
    expect(flagAt(ctx, '2024-06-21T09:30:00Z',
      { windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 30 }, true)).toBe(true);
  });

  it('§8 в то же время суток 21 декабря то же окно солнца НЕ видит', (ctx) => {
    expect(flagAt(ctx, '2024-12-21T09:30:00Z',
      { windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 30 }, false)).toBe(false);
  });

  it('§8 разница именно в высоте: с порогом 5° декабрьский полдень окно видит', (ctx) => {
    expect(flagAt(ctx, '2024-12-21T09:30:00Z',
      { windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 5 }, true)).toBe(true);
  });

  it('§8 в течение одного дня азимут уходит с востока на запад: утром западное окно пусто', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ90,
      { windowDirection: 270, maxAzimuthDeviation: 45, minSunAltitude: 5 }, false)).toBe(false);
  });

  it('§8 …а вечером того же дня западное окно освещено', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_AZ270,
      { windowDirection: 270, maxAzimuthDeviation: 45, minSunAltitude: 5 }, true)).toBe(true);
  });
});

// ======================================================================================
// §9. Высокие широты
// ======================================================================================

describe('§9 Полярная ночь и полярный день', () => {
  it('§9 полярная ночь: флаг снят в любое время суток при нулевом пороге высоты', (ctx) => {
    const moments = [
      '2024-12-21T00:00:00Z', '2024-12-21T06:00:00Z',
      '2024-12-21T12:00:00Z', '2024-12-21T18:00:00Z',
    ];
    for (let i = 0; i < moments.length; i++) {
      expect(flagAt(ctx, moments[i], {
        latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
        windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 0,
      }, false)).toBe(false);
    }
  });

  it('§9 полярный день: в местную полночь северное окно освещено', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_MIDNIGHT, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 0, maxAzimuthDeviation: 10, minSunAltitude: 5,
    }, true)).toBe(true);
  });

  it('§9 полярный день не означает «флаг всегда поднят»: в 06:00Z северное окно пусто', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_0600, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 0, maxAzimuthDeviation: 10, minSunAltitude: 5,
    }, false)).toBe(false);
  });

  it('§9 полярный день: в 06:00Z освещено восточное окно (азимут 99,1°)', (ctx) => {
    expect(flagAt(ctx, SVAL_JUN_0600, {
      latitude: SVALBARD.latitude, longitude: SVALBARD.longitude,
      windowDirection: 90, maxAzimuthDeviation: 15, minSunAltitude: 5,
    }, true)).toBe(true);
  });
});

// --------------------------------------------------------------------------------------
// Хелпер для сценариев с состоянием: сохраняет один и тот же объект variables между
// вызовами trigger (то есть «хаб не перезапускался и сценарий не пересохранялся»).
// --------------------------------------------------------------------------------------

function setup(ctx, iso, overrides, initialValue, serviceName) {
  ctx.time.set(iso);
  const acc = addWindowSwitch(ctx.hub, 10 + (nextAccId++), serviceName);
  const char = acc.char(HS.Switch, HC.On);
  if (initialValue !== undefined) char.setValueSilent(initialValue);
  const service = acc.getService(HS.Switch);
  const vars = {};
  const options = baseOptions(overrides);
  return {
    acc: acc, char: char, service: service, vars: vars, options: options,
    // Вызов trigger с сохранённым состоянием сценария.
    run: function (value, context) {
      ctx.scenario.run({
        source: char,
        value: value === undefined ? char.getValue() : value,
        variables: vars,
        options: options,
        context: context === undefined ? '' : context,
      });
    },
    // Вызов trigger со свежим variables — «запуск хаба / сохранение сценария» (§2.2).
    runFresh: function (value) {
      ctx.scenario.run({
        source: char,
        value: value === undefined ? char.getValue() : value,
        variables: {},
        options: options,
        context: '',
      });
    },
  };
}

// Счётчик ВСЕХ вызовов записи в характеристику, включая запись того же самого значения.
// Мок характеристики глушит дубликат внутри себя (prev === next → ранний выход), поэтому
// по итоговому значению и по подпискам «лишнюю» запись не увидеть. Перехватываем сам метод
// на экземпляре: через него проходят и source.setValue(), и Hub.setCharacteristicValue(),
// потому что оба пути ведут к одному и тому же объекту характеристики.
function spyWrites(char) {
  const calls = [];
  const original = char.setValue;
  char.setValue = function (v) {
    calls.push(v);
    return original.call(char, v);
  };
  return calls;
}

// ======================================================================================
// §10. Запись состояния и инверсия
// ======================================================================================

describe('§10 Запись состояния и invert', () => {
  it('§10 invert = false: солнце в окне → характеристика true', (ctx) => {
    expect(flagAt(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, invert: false }, true)).toBe(true);
  });

  it('§10 invert = true: солнце в окне → характеристика false', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, invert: true }, true);
    s.run();
    expect(s.char.getValue()).toBe(false);
  });

  it('§10 invert = true: солнца в окне нет → характеристика true', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 0, maxAzimuthDeviation: 5, invert: true }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
  });

  it('§10 смена состояния делает ровно одну запись в характеристику', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON, { windowDirection: 180, maxAzimuthDeviation: 5 }, false);
    const writes = spyWrites(s.char);
    s.run();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toBe(true);
  });

  it('§10 одинаковое значение не пишется: повторный вызов trigger не делает ни одной записи', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON, { windowDirection: 180, maxAzimuthDeviation: 5 }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    const writes = spyWrites(s.char);   // считаем только то, что будет после первого расчёта
    s.run();
    expect(writes).toHaveLength(0);
    expect(s.char.getValue()).toBe(true);
  });

  it('§10 одинаковое значение не пишется: пересчёты по таймеру не делают ни одной записи', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 5, updateInterval: 1 }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    const writes = spyWrites(s.char);
    ctx.time.advance('5m');             // пять пересчётов, состояние всё то же
    expect(writes).toHaveLength(0);
  });
});

// ======================================================================================
// §11. Имя сервиса
// ======================================================================================

describe('§11 Имя сервиса (changeServiceName)', () => {
  it('§11 changeServiceName = false: имя сервиса не трогается вообще', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, changeServiceName: false }, false, 'Штора кабинет');
    s.run();
    expect(s.char.getValue()).toBe(true);
    expect(s.service.getName()).toBe('Штора кабинет');
  });

  it('§11 changeServiceName = true, солнце в окне → «Солнце в окне»', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, changeServiceName: true }, false, 'Штора кабинет');
    s.run();
    expect(s.service.getName()).toBe('Солнце в окне');
  });

  it('§11 changeServiceName = true, солнца нет → «Солнца в окне нет»', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 0, maxAzimuthDeviation: 5, changeServiceName: true }, true, 'Штора кабинет');
    s.run();
    expect(s.service.getName()).toBe('Солнца в окне нет');
  });

  it('§11 (§7a) при invert имя отражает реальное Солнце, а не характеристику: солнце есть', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, changeServiceName: true, invert: true }, true);
    s.run();
    expect(s.char.getValue()).toBe(false);
    expect(s.service.getName()).toBe('Солнце в окне');
  });

  it('§11 (§7a) при invert имя отражает реальное Солнце: солнца нет', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 0, maxAzimuthDeviation: 5, changeServiceName: true, invert: true }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    expect(s.service.getName()).toBe('Солнца в окне нет');
  });
});

// ======================================================================================
// §12. Ручное управление
// ======================================================================================

describe('§12.1 allowManualControl = false — расчётное состояние восстанавливается', () => {
  it('§12.1 внешнее изменение откатывается на ближайшем вызове trigger', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: false }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    s.char.setValue(false);           // пользователь выключил
    s.run(false);                     // хаб сообщил сценарию о чужом изменении
    expect(s.char.getValue()).toBe(true);
  });

  it('§12.1 чужое значение откатывается и очередным пересчётом по таймеру', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: false, updateInterval: 1 }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    s.char.setValueSilent(false);     // изменение без вызова trigger (§18.3)
    ctx.time.advance('1m');
    expect(s.char.getValue()).toBe(true);
  });
});

describe('§12.2 allowManualControl = true — сценарий не спорит между переходами', () => {
  it('§12.2 внешнее изменение НЕ откатывается при вызове trigger', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: true }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    s.char.setValue(false);
    s.run(false);
    expect(s.char.getValue()).toBe(false);
  });

  it('§12.2 чужое значение НЕ откатывается пересчётом по таймеру без перехода', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: true, updateInterval: 1 }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    s.char.setValueSilent(false);
    ctx.time.advance('5m');
    expect(s.char.getValue()).toBe(false);
  });

  it('§12.2 на переходе «солнце вышло из окна» ручное состояние перезаписывается', (ctx) => {
    // Москва 21.06, окно на Юг, допуск 90°, порог высоты 50° (числа — из таблицы §4.4):
    // 07:00Z высота 47,43° (солнца нет) → 08:00Z 53,57° (есть) → 12:00Z 47,76° (нет).
    const s = setup(ctx, '2024-06-21T07:00:00Z', {
      windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 50,
      allowManualControl: true, updateInterval: 1,
    }, false);
    s.run();
    expect(s.char.getValue()).toBe(false);
    s.char.setValue(true);            // пользователь включил вручную
    s.run(true);
    expect(s.char.getValue()).toBe(true);   // удержано
    ctx.time.advance('60m');          // 08:00Z — переход «солнце вошло»
    expect(s.char.getValue()).toBe(true);
    ctx.time.advance('4h');           // 12:00Z — переход «солнце вышло»
    expect(s.char.getValue()).toBe(false);
  });
});

describe('§12.3 Ручное удержание не переживает перезапуск (§7b)', () => {
  it('§12.3 при allowManualControl = true свежий variables записывает расчётное значение', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, allowManualControl: true }, false);
    s.run();
    s.char.setValue(false);
    s.run(false);
    expect(s.char.getValue()).toBe(false);
    s.runFresh(false);                // «запуск хаба / сохранение сценария»
    expect(s.char.getValue()).toBe(true);
  });
});

// ======================================================================================
// §13. Таймер пересчёта и поколения
// ======================================================================================

describe('§13.1 Периодический пересчёт', () => {
  it('§13.1 после успешного расчёта висит ровно один таймер', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON, { windowDirection: 180, maxAzimuthDeviation: 5 }, false);
    s.run();
    expect(ctx.time.pendingCount()).toBe(1);
  });

  it('§13.1 флаг меняется сам по таймеру, без нового вызова trigger', (ctx) => {
    // Москва 21.06, окно на Запад, допуск 45° → сектор 225…315°.
    // 11:21Z азимут 223,3° (отклонение 46,8° — мимо), 11:31Z азимут 226,6° (43,4° — попал).
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 1 }, false);
    s.run();
    expect(s.char.getValue()).toBe(false);
    ctx.time.advance('10m');
    expect(s.char.getValue()).toBe(true);
  });

  it('§13.1 таймер остаётся ровно один и после многих срабатываний', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, updateInterval: 1 }, false);
    s.run();
    ctx.time.advance('30m');
    expect(ctx.time.pendingCount()).toBe(1);
  });
});

describe('§13.2 updateInterval зажимается, а не валит сценарий', () => {
  it('§13.2 updateInterval = 0 не останавливает сценарий: расчёт есть, таймер поставлен', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, updateInterval: 0 }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    expect(ctx.time.pendingCount()).toBe(1);
  });

  it('§13.2 updateInterval = 0 работает как 1 минута', (ctx) => {
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 0 }, false);
    s.run();
    ctx.time.advance('10m');
    expect(s.char.getValue()).toBe(true);
  });

  it('§13.2 updateInterval = 999 зажимается до 60: через 10 минут пересчёта ещё не было', (ctx) => {
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 999 }, false);
    s.run();
    expect(s.char.getValue()).toBe(false);
    ctx.time.advance('10m');
    expect(s.char.getValue()).toBe(false);
  });

  it('§13.2 updateInterval = 999: через 61 минуту пересчёт случился', (ctx) => {
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 999 }, false);
    s.run();
    ctx.time.advance('10m');
    ctx.time.advance('51m');
    expect(s.char.getValue()).toBe(true);
  });

  it('§13.2 updateInterval = 60 ведёт себя так же, как зажатый 999', (ctx) => {
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 60 }, false);
    s.run();
    ctx.time.advance('10m');
    expect(s.char.getValue()).toBe(false);
    ctx.time.advance('51m');
    expect(s.char.getValue()).toBe(true);
  });
});

describe('§13.3 Поколения таймеров', () => {
  it('§13.3 после пересохранения сценария старый цикл прекращается — остаётся один таймер', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, updateInterval: 1 }, false);
    s.run();
    expect(ctx.time.pendingCount()).toBe(1);
    s.runFresh();                     // пересохранение сценария — новый variables, новое поколение
    expect(ctx.time.pendingCount()).toBe(2);
    ctx.time.advance('1m');
    expect(ctx.time.pendingCount()).toBe(1);
  });

  it('§13.3 число таймеров не растёт и после нескольких пересохранений', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 5, updateInterval: 1 }, false);
    s.run();
    s.runFresh();
    s.runFresh();
    s.runFresh();
    ctx.time.advance('5m');
    expect(ctx.time.pendingCount()).toBe(1);
  });
});

describe('§13.4 Несколько окон', () => {
  it('§13.4 два окна с разными настройками считаются независимо', (ctx) => {
    ctx.time.set(MSK_JUN_AZ270);
    const west = addWindowSwitch(ctx.hub, 41, 'Запад');
    const east = addWindowSwitch(ctx.hub, 42, 'Восток');
    const wc = west.char(HS.Switch, HC.On);
    const ec = east.char(HS.Switch, HC.On);
    ec.setValueSilent(true);
    const wv = {}, ev = {};
    ctx.scenario.run({ source: wc, value: false, variables: wv,
      options: baseOptions({ windowDirection: 270, maxAzimuthDeviation: 5 }), context: '' });
    ctx.scenario.run({ source: ec, value: true, variables: ev,
      options: baseOptions({ windowDirection: 90, maxAzimuthDeviation: 5 }), context: '' });
    expect(wc.getValue()).toBe(true);
    expect(ec.getValue()).toBe(false);
  });

  it('§13.4 запуск второго окна не гасит таймер первого', (ctx) => {
    ctx.time.set(MSK_JUN_AZ270);
    const west = addWindowSwitch(ctx.hub, 41, 'Запад');
    const east = addWindowSwitch(ctx.hub, 42, 'Восток');
    const wc = west.char(HS.Switch, HC.On);
    const ec = east.char(HS.Switch, HC.On);
    ctx.scenario.run({ source: wc, value: false, variables: {},
      options: baseOptions({ windowDirection: 270, maxAzimuthDeviation: 5, updateInterval: 1 }), context: '' });
    ctx.scenario.run({ source: ec, value: false, variables: {},
      options: baseOptions({ windowDirection: 90, maxAzimuthDeviation: 5, updateInterval: 1 }), context: '' });
    expect(ctx.time.pendingCount()).toBe(2);
    ctx.time.advance('5m');
    expect(ctx.time.pendingCount()).toBe(2);
    expect(wc.getValue()).toBe(true);
    expect(ec.getValue()).toBe(false);
  });
});

// ======================================================================================
// §14. Невалидные настройки — сценарий молчит, а не врёт
// ======================================================================================

// Опорная обстановка: Москва, 21.12 00:00Z — Солнце глубоко под горизонтом, поэтому
// ИСПРАВНЫЙ сценарий записал бы false. Характеристика заранее ставится в true, значит
// «осталось true» = «не тронута вообще» (§14.2).
const INVALID_MOMENT = '2024-12-21T00:00:00Z';

function invalidOptions(overrides) {
  const merged = { windowDirection: 180, maxAzimuthDeviation: 45, minSunAltitude: 5 };
  const keys = Object.keys(overrides);
  for (let i = 0; i < keys.length; i++) merged[keys[i]] = overrides[keys[i]];
  return merged;
}

function expectSilentRefusal(ctx, overrides, nameRe) {
  const s = setup(ctx, INVALID_MOMENT, invalidOptions(overrides), true);
  s.run();
  expect(s.char.getValue()).toBe(true);           // характеристика не записана вообще
  expect(ctx.time.pendingCount()).toBe(0);        // таймер пересчёта не поставлен
  const entries = ctx.logs.all();
  expect(entries).toHaveLength(1);                // ровно одна строка ошибки
  expect(nameRe.test(entries[0].message)).toBe(true); // и она называет параметр
}

// Пустая форма windowAzimuth = «не задан» (§6.2): направление берётся из румба, строки
// ошибки нет, таймер пересчёта ставится. Проверяется двумя настройками сразу — румб Запад
// в этот момент попадает, румб Север нет, — иначе «откат к румбу» было бы не отличить от
// подстановки фиксированного направления. Отсутствие строки ошибки видно по числу записей
// в лог: при успешном пересчёте пишется ровно строка состояния (§15), лишней строки нет.
function expectEmptyAzimuthFallsBackToRumb(ctx, emptyValue) {
  const hit = setup(ctx, MSK_JUN_AZ270, {
    windowDirection: 270, windowAzimuth: emptyValue,
    maxAzimuthDeviation: 5, minSunAltitude: 5, updateInterval: 1,
  }, false);
  hit.run();
  expect(hit.char.getValue()).toBe(true);
  expect(ctx.time.pendingCount()).toBe(1);   // таймер стоит ⇒ настройки приняты (§14, пункт 3)
  expect(ctx.logs.all()).toHaveLength(1);    // только строка состояния, строки ошибки нет

  ctx.logs.clear();
  const miss = setup(ctx, MSK_JUN_AZ270, {
    windowDirection: 0, windowAzimuth: emptyValue,
    maxAzimuthDeviation: 5, minSunAltitude: 5, updateInterval: 1,
  }, true);
  miss.run();
  expect(miss.char.getValue()).toBe(false);  // тот же момент, другой румб — другой ответ
  expect(ctx.logs.all()).toHaveLength(1);
}

function expectAccepted(ctx, overrides) {
  const s = setup(ctx, INVALID_MOMENT, invalidOptions(overrides), true);
  s.run();
  expect(ctx.time.pendingCount()).toBe(1);        // таймер поставлен ⇒ проверка пройдена
}

describe('§14 Контрольный случай — исправные настройки', () => {
  it('§14 при валидных настройках характеристика записывается и таймер ставится', (ctx) => {
    const s = setup(ctx, INVALID_MOMENT, invalidOptions({}), true);
    s.run();
    expect(s.char.getValue()).toBe(false);
    expect(ctx.time.pendingCount()).toBe(1);
  });
});

describe('§14.1 Невалидная широта', () => {
  it('§14.1 latitude = 100 → одна строка ошибки, характеристика цела, таймера нет', (ctx) => {
    expectSilentRefusal(ctx, { latitude: 100 }, /latitude|широт/i);
  });

  it('§14.1 latitude = −91 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { latitude: -91 }, /latitude|широт/i);
  });

  it('§14.1 latitude = "abc" (не число) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { latitude: 'abc' }, /latitude|широт/i);
  });

  it('§14.1 latitude = null → отказ', (ctx) => {
    expectSilentRefusal(ctx, { latitude: null }, /latitude|широт/i);
  });

  it('§14 после отказа время идёт, но ничего не происходит', (ctx) => {
    const s = setup(ctx, INVALID_MOMENT, invalidOptions({ latitude: 100 }), true);
    s.run();
    ctx.time.advance('10m');
    expect(s.char.getValue()).toBe(true);
    expect(ctx.time.pendingCount()).toBe(0);
    expect(ctx.logs.all()).toHaveLength(1);
  });
});

describe('§14.1 Невалидная долгота', () => {
  it('§14.1 longitude = 200 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { longitude: 200 }, /longitude|долгот/i);
  });

  it('§14.1 longitude = −181 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { longitude: -181 }, /longitude|долгот/i);
  });

  it('§14.1 longitude = undefined → отказ', (ctx) => {
    expectSilentRefusal(ctx, { longitude: undefined }, /longitude|долгот/i);
  });
});

describe('§6.2 Пустые формы windowAzimuth — «не задан», а не ошибка', () => {
  it('§6.2 windowAzimuth = null → откат к румбу, без ошибки, с таймером', (ctx) => {
    expectEmptyAzimuthFallsBackToRumb(ctx, null);
  });

  it('§6.2 windowAzimuth = undefined → откат к румбу, без ошибки, с таймером', (ctx) => {
    expectEmptyAzimuthFallsBackToRumb(ctx, undefined);
  });

  it('§6.2 windowAzimuth = "" (пустая строка) → откат к румбу, без ошибки, с таймером', (ctx) => {
    expectEmptyAzimuthFallsBackToRumb(ctx, '');
  });

  it('§6.2 windowAzimuth = "   " (одни пробелы) → откат к румбу, без ошибки, с таймером', (ctx) => {
    expectEmptyAzimuthFallsBackToRumb(ctx, '   ');
  });
});

describe('§14.1 Невалидный точный азимут — только непустое значение', () => {
  it('§14.1 windowAzimuth = "юг" (непустое, не разбирается в число) → отказ и полный останов', (ctx) => {
    expectSilentRefusal(ctx, { windowAzimuth: 'юг' }, /windowAzimuth|азимут/i);
  });

  it('§14.1 windowAzimuth = 400 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { windowAzimuth: 400 }, /windowAzimuth|азимут/i);
  });

  it('§14.1 windowAzimuth = −5 (не пустая форма и не рабочий диапазон) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { windowAzimuth: -5 }, /windowAzimuth|азимут/i);
  });
});

describe('§14.1 Невалидные пороги', () => {
  it('§14.1 minSunAltitude = −1 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { minSunAltitude: -1 }, /minSunAltitude|высот/i);
  });

  it('§14.1 minSunAltitude = 91 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { minSunAltitude: 91 }, /minSunAltitude|высот/i);
  });

  it('§14.1 maxAzimuthDeviation = 0 (диапазон начинается с 1) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { maxAzimuthDeviation: 0 }, /maxAzimuthDeviation|отклонен/i);
  });

  it('§14.1 maxAzimuthDeviation = 91 → отказ', (ctx) => {
    expectSilentRefusal(ctx, { maxAzimuthDeviation: 91 }, /maxAzimuthDeviation|отклонен/i);
  });

  it('§14.1 minSunAltitude = "abc" (не число) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { minSunAltitude: 'abc' }, /minSunAltitude|высот/i);
  });

  it('§14.1 minSunAltitude = null (не число, хотя Number(null) = 0) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { minSunAltitude: null }, /minSunAltitude|высот/i);
  });

  it('§14.1 maxAzimuthDeviation = "abc" (не число) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { maxAzimuthDeviation: 'abc' }, /maxAzimuthDeviation|отклонен/i);
  });

  it('§14.1 maxAzimuthDeviation = undefined (не число) → отказ', (ctx) => {
    expectSilentRefusal(ctx, { maxAzimuthDeviation: undefined }, /maxAzimuthDeviation|отклонен/i);
  });
});

describe('§14.2 Границы диапазонов валидны', () => {
  it('§14.2 latitude = 90 принимается', (ctx) => { expectAccepted(ctx, { latitude: 90 }); });
  it('§14.2 latitude = −90 принимается', (ctx) => { expectAccepted(ctx, { latitude: -90 }); });
  it('§14.2 longitude = 180 принимается', (ctx) => { expectAccepted(ctx, { longitude: 180 }); });
  it('§14.2 longitude = −180 принимается', (ctx) => { expectAccepted(ctx, { longitude: -180 }); });
  it('§14.2 windowAzimuth = 0 принимается', (ctx) => { expectAccepted(ctx, { windowAzimuth: 0 }); });
  it('§14.2 windowAzimuth = 360 принимается', (ctx) => { expectAccepted(ctx, { windowAzimuth: 360 }); });
  it('§14.2 windowAzimuth = −1 (сентинел) принимается', (ctx) => { expectAccepted(ctx, { windowAzimuth: -1 }); });
  it('§14.2 minSunAltitude = 0 принимается', (ctx) => { expectAccepted(ctx, { minSunAltitude: 0 }); });
  it('§14.2 minSunAltitude = 90 принимается', (ctx) => { expectAccepted(ctx, { minSunAltitude: 90 }); });
  it('§14.2 maxAzimuthDeviation = 1 принимается', (ctx) => { expectAccepted(ctx, { maxAzimuthDeviation: 1 }); });
  it('§14.2 maxAzimuthDeviation = 90 принимается', (ctx) => { expectAccepted(ctx, { maxAzimuthDeviation: 90 }); });
});

// ======================================================================================
// §15. Логирование
// ======================================================================================

describe('§15 Логирование', () => {
  it('§15 изменившийся пересчёт пишет строку с префиксом «☀️ Свет в окне.»', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON, { windowDirection: 180, maxAzimuthDeviation: 5 }, false);
    s.run();
    expect(ctx.logs.containing('☀️ Свет в окне.').length).toBeGreaterThan(0);
  });

  it('§15 строка состояния несёт высоту, азимут и отклонение — не меньше трёх чисел', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON, { windowDirection: 180, maxAzimuthDeviation: 5 }, false);
    s.run();
    const entries = ctx.logs.containing('☀️ Свет в окне.');
    expect(entries.length).toBeGreaterThan(0);
    const numbers = entries[0].message.match(/-?\d+[.,]?\d*/g) || [];
    expect(numbers.length).toBeGreaterThanOrEqual(3);
  });

  it('§15 пересчёты по таймеру без смены состояния в лог не пишут', (ctx) => {
    const s = setup(ctx, MSK_JUN_NOON,
      { windowDirection: 180, maxAzimuthDeviation: 90, minSunAltitude: 5, updateInterval: 1 }, false);
    s.run();
    expect(s.char.getValue()).toBe(true);
    ctx.logs.clear();
    ctx.time.advance('5m');
    expect(s.char.getValue()).toBe(true);
    expect(ctx.logs.all()).toHaveLength(0);
  });
});

// ======================================================================================
// §14 (пункт 4). Пересохранение с невалидной настройкой глушит и уже живущий таймер
// ======================================================================================

describe('§14 Невалидная настройка останавливает сценарий целиком', () => {
  it('§14 после пересохранения со сломанной широтой ни один таймер больше не пишет флаг', (ctx) => {
    // Исправный запуск: окно на Запад, солнце войдёт в сектор через ~5 минут (§4.4).
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 1 }, false);
    s.run();
    expect(s.char.getValue()).toBe(false);
    expect(ctx.time.pendingCount()).toBe(1);

    // Пересохранение сценария со сломанной широтой: свежий variables, невалидные опции.
    const broken = baseOptions({
      windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 1, latitude: 100,
    });
    ctx.scenario.run({
      source: s.char, value: s.char.getValue(), variables: {}, options: broken, context: '',
    });

    // Время идёт далеко за момент, когда солнце вошло бы в окно.
    const writes = spyWrites(s.char);
    ctx.time.advance('30m');
    expect(writes).toHaveLength(0);
    expect(s.char.getValue()).toBe(false);
    expect(ctx.time.pendingCount()).toBe(0);
  });

  it('§14 то же со сломанным порогом отклонения', (ctx) => {
    const s = setup(ctx, '2024-06-21T11:21:00Z',
      { windowDirection: 270, maxAzimuthDeviation: 45, updateInterval: 1 }, false);
    s.run();
    expect(ctx.time.pendingCount()).toBe(1);
    const broken = baseOptions({
      windowDirection: 270, maxAzimuthDeviation: 0, updateInterval: 1,
    });
    ctx.scenario.run({
      source: s.char, value: s.char.getValue(), variables: {}, options: broken, context: '',
    });
    const writes = spyWrites(s.char);
    ctx.time.advance('30m');
    expect(writes).toHaveLength(0);
    expect(ctx.time.pendingCount()).toBe(0);
  });
});
