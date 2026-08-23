// Интеграционные тесты для сценария "❄️☀️ Зима/Лето".
//
// Тесты написаны от README — каждый describe соответствует разделу,
// каждый it — конкретному утверждению спецификации.

function makeSwitch(hub, id, initialOn) {
  return hub.addAccessory({
    id, name: 'Сезонный выключатель', room: 'Дом',
    services: [{
      type: HS.Switch,
      characteristics: [{ type: HC.On, value: initialOn === true }],
    }],
  });
}

function baseOptions(overrides) {
  const o = {
    startDate: '1.12',
    endDate: '1.03',
  };
  if (overrides) for (const k of Object.keys(overrides)) o[k] = overrides[k];
  return o;
}

// ---------------------------------------------------------------------------
// README §"info / sourceServices / sourceCharacteristics"
// ---------------------------------------------------------------------------

describe('info-блок', () => {
  it('sourceServices содержит Switch', ({ scenario }) => {
    const info = scenario.info();
    expect(info).not.toBeNull();
    expect(info.sourceServices).toContain(HS.Switch);
  });

  it('sourceCharacteristics содержит On', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceCharacteristics).toContain(HC.On);
  });

  it('onStart=true', ({ scenario }) => {
    const info = scenario.info();
    expect(info.onStart).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика работы" — диапазон не пересекает год (1.06 - 1.09)
// "Выключатель включен, если текущая дата находится в диапазоне"
// ---------------------------------------------------------------------------

describe('README §"Логика работы" — диапазон в одном году', () => {
  it('1 июля внутри 1.06 - 1.09 → включается', ({ hub, scenario, time }) => {
    time.set('2024-07-01T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.06', endDate: '1.09' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('1 марта вне 1.06 - 1.09 → выключается', ({ hub, scenario, time }) => {
    time.set('2024-03-01T12:00:00Z');
    const sw = makeSwitch(hub, 10, true);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: true, variables: {},
      options: baseOptions({ startDate: '1.06', endDate: '1.09' }), context: '',
    });

    expect(onChar.getValue()).toBe(false);
  });

  it('1 июня (граница) внутри 1.06 - 1.09 → включается', ({ hub, scenario, time }) => {
    time.set('2024-06-01T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.06', endDate: '1.09' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('1 сентября (граница) внутри 1.06 - 1.09 → включается', ({ hub, scenario, time }) => {
    time.set('2024-09-01T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.06', endDate: '1.09' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика работы" — диапазон пересекает год (1.12 - 1.03)
// "Выключатель включен, если текущая дата >= даты включения ИЛИ <= даты выключения"
// ---------------------------------------------------------------------------

describe('README §"Логика работы" — диапазон пересекает год', () => {
  it('15 декабря внутри 1.12 - 1.03 → включается', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.12', endDate: '1.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('15 января внутри 1.12 - 1.03 → включается (через переход года)', ({ hub, scenario, time }) => {
    time.set('2025-01-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.12', endDate: '1.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('15 апреля вне 1.12 - 1.03 → выключается', ({ hub, scenario, time }) => {
    time.set('2024-04-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, true);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: true, variables: {},
      options: baseOptions({ startDate: '1.12', endDate: '1.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Поддерживаемые форматы дат" — цифровой формат
// ---------------------------------------------------------------------------

describe('README §"Поддерживаемые форматы дат" — цифровой', () => {
  it('формат "1.12" парсится', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.12', endDate: '1.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('формат "01.03" с ведущим нулем парсится', ({ hub, scenario, time }) => {
    time.set('2024-02-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '01.12', endDate: '01.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('формат "15.6" без ведущих нулей парсится', ({ hub, scenario, time }) => {
    time.set('2024-06-20T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '15.6', endDate: '15.9' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Поддерживаемые форматы дат" — текстовый формат
// "В текстовом формате названия месяцев должны быть в родительном падеже."
//
// NOTE: README обещает работу формата "1 декабря", но регулярка в коде
// /^(\d{1,2})\s+(\w+)$/ использует \w, который под V8/Nashorn по умолчанию
// НЕ матчит кириллицу (без флага 'u' и без явного класса [а-я]).
// Поэтому тесты на текстовый формат ожидаемо падают на симуляторе.
// Сохраняем их как контракт README — это сигнал о расхождении README↔код.
// ---------------------------------------------------------------------------

describe('README §"Поддерживаемые форматы дат" — текстовый', () => {
  it('формат "1 декабря" парсится', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1 декабря', endDate: '1 марта' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });

  it('формат "15 марта" парсится', ({ hub, scenario, time }) => {
    time.set('2024-03-20T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '15 марта', endDate: '15 сентября' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Логика работы" — не меняет уже соответствующее состояние
// "Сценарий проверяет текущее состояние, и если оно уже соответствует —
//  логирует это и не выставляет повторно".
// (По коду: если currentState === shouldBeOn, не вызывает setValue, но это
//  внутренняя оптимизация. Проверяем итоговое состояние.)
// ---------------------------------------------------------------------------

describe('README §"Логика работы" — итоговое состояние', () => {
  it('если уже выключен и должен быть выключен — остаётся выключен', ({ hub, scenario, time }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.12', endDate: '1.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(false);
  });

  it('если уже включен и должен быть включен — остаётся включен', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, true);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: true, variables: {},
      options: baseOptions({ startDate: '1.12', endDate: '1.03' }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Ограничения" — некорректные форматы дат
// "Поддерживает только характеристику включения/выключения (HC.On)"
// (По коду: при ошибке парсинга — console.error, ничего не меняет)
// ---------------------------------------------------------------------------

describe('README §"Ограничения" — некорректный формат даты', () => {
  it('некорректный формат → логируется ошибка', ({ hub, scenario, time, logs }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: 'некорректно', endDate: '1.03' }), context: '',
    });

    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('месяц > 12 → логируется ошибка', ({ hub, scenario, time, logs }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '1.13', endDate: '1.03' }), context: '',
    });

    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('день > 31 → логируется ошибка', ({ hub, scenario, time, logs }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ startDate: '32.06', endDate: '1.09' }), context: '',
    });

    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// README §"Когда сценарий срабатывает" — полуночная Cron-задача
// "Каждую полночь — по Cron-задаче, которую сценарий регистрирует
//  при первом срабатывании"
// ---------------------------------------------------------------------------

describe('README §"Когда сценарий срабатывает" — полуночная проверка даты', () => {
  it('первое срабатывание регистрирует полуночную задачу и пишет её в variables', ({ hub, scenario, time, cron }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const vars = {};

    scenario.run({ source: onChar, value: false, variables: vars, options: baseOptions(), context: '' });

    expect(cron.listScheduled()).toHaveLength(1);
    expect(vars.midnightTask).toBeDefined();
  });

  it('в полночь дня границы состояние пересчитывается без внешних событий', ({ hub, scenario, time, cron }) => {
    // 30 ноября: до начала диапазона 1.12 - 1.03 → выключен.
    time.set('2024-11-30T12:00:00Z');
    const sw = makeSwitch(hub, 10, true);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({ source: onChar, value: true, variables: {}, options: baseOptions(), context: '' });
    expect(onChar.getValue()).toBe(false);

    // Полночь 1 декабря — сценарий просыпается сам.
    cron.tickNow();
    expect(onChar.getValue()).toBe(true);
  });

  it('после правки дат задача работает с новыми значениями, дубля не появляется', ({ hub, scenario, time, cron }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const vars = {};

    // Зимний диапазон: 15 декабря → включен.
    scenario.run({ source: onChar, value: false, variables: vars, options: baseOptions(), context: '' });
    expect(onChar.getValue()).toBe(true);

    // Пользователь переключил сценарий на летний диапазон и сохранил.
    scenario.run({
      source: onChar, value: true, variables: vars,
      options: baseOptions({ startDate: '1.06', endDate: '1.09' }), context: '',
    });
    expect(onChar.getValue()).toBe(false);

    expect(cron.listScheduled()).toHaveLength(1);

    // Полночь 16 декабря — задача считает уже по летним датам → остаётся выключен.
    cron.tickNow();
    expect(onChar.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// README §"Инвертировать"
// "Внутри периода записывается «выключено», вне периода — «включено»"
// ---------------------------------------------------------------------------

describe('README §"Инвертировать"', () => {
  it('внутри периода 1.12 - 1.03 при инверсии выключатель выключен', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, true);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: true, variables: {},
      options: baseOptions({ invert: true }), context: '',
    });

    expect(onChar.getValue()).toBe(false);
  });

  it('вне периода 1.12 - 1.03 при инверсии выключатель включен', ({ hub, scenario, time }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const onChar = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: onChar, value: false, variables: {},
      options: baseOptions({ invert: true }), context: '',
    });

    expect(onChar.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"Менять имя сервиса"
// "Период пересекает конец года → Зима/Лето; период внутри года → Лето/Зима"
// ---------------------------------------------------------------------------

describe('README §"Менять имя сервиса"', () => {
  function makeNamedSwitch(hub, id, initialOn, serviceName) {
    return hub.addAccessory({
      id, name: 'Сезонный выключатель', room: 'Дом',
      services: [{
        type: HS.Switch,
        name: serviceName,
        characteristics: [{ type: HC.On, value: initialOn === true }],
      }],
    });
  }

  it('период 1.12 - 1.03, декабрь → имя сервиса "Зима"', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeNamedSwitch(hub, 10, false, 'Отопление');

    scenario.run({
      source: sw.char(HS.Switch, HC.On), value: false, variables: {},
      options: baseOptions({ changeServiceName: true }), context: '',
    });

    expect(sw.getService(HS.Switch).getName()).toBe('Зима');
  });

  it('период 1.12 - 1.03, июль → имя сервиса "Лето"', ({ hub, scenario, time }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeNamedSwitch(hub, 10, true, 'Отопление');

    scenario.run({
      source: sw.char(HS.Switch, HC.On), value: true, variables: {},
      options: baseOptions({ changeServiceName: true }), context: '',
    });

    expect(sw.getService(HS.Switch).getName()).toBe('Лето');
  });

  it('период 1.06 - 1.09, июль → имя сервиса "Лето"', ({ hub, scenario, time }) => {
    time.set('2024-07-15T12:00:00Z');
    const sw = makeNamedSwitch(hub, 10, false, 'Кондиционер');

    scenario.run({
      source: sw.char(HS.Switch, HC.On), value: false, variables: {},
      options: baseOptions({ startDate: '1.06', endDate: '1.09', changeServiceName: true }), context: '',
    });

    expect(sw.getService(HS.Switch).getName()).toBe('Лето');
  });

  it('опция выключена → имя сервиса остаётся исходным', ({ hub, scenario, time }) => {
    time.set('2024-12-15T12:00:00Z');
    const sw = makeNamedSwitch(hub, 10, false, 'Отопление');

    scenario.run({
      source: sw.char(HS.Switch, HC.On), value: false, variables: {},
      options: baseOptions(), context: '',
    });

    expect(sw.getService(HS.Switch).getName()).toBe('Отопление');
  });
});
