// Black-box тесты сценария WinterSummer («❄️☀️ Зима/Лето») — ЛОГИЧЕСКАЯ часть.
//
// Эти тесты написаны ИСКЛЮЧИТЕЛЬНО от поведенческой спецификации задания
// (SPEC.md / поведенческий контракт разделов 1-2), без чтения исходников
// сценария, README.md сценария или существующих тестов WinterSummer.
// Каждый describe соответствует разделу спецификации, каждый it — одному
// конкретному утверждению из неё.
//
// Пункты, отмеченные спецификацией как «Открытые вопросы» /
// «Неспецифицированные зоны» (часовой пояс, високосный год, точная позиция
// календарно несуществующих дат, оставшиеся 7 родительных названий месяцев,
// точный текст/уровень лога, регистрозависимость, офлайн-устройство),
// сознательно НЕ проверяются жёсткими assert — по правилам задания это
// зона наблюдений, а не падающих тестов.

function baseOptions(overrides = {}) {
  return {
    startDate: '1.12',
    endDate: '1.03',
    ...overrides,
  };
}

function addSwitch(hub, { id = 1, name = 'Выключатель', room = 'Тест', on = false, serviceName = 'Исходное имя' } = {}) {
  return hub.addAccessory({
    id,
    name,
    room,
    services: [
      {
        type: HS.Switch,
        name: serviceName,
        characteristics: [{ type: HC.On, value: on }],
      },
    ],
  });
}

function runTrigger(scenario, source, { value, variables = {}, options = baseOptions(), context = '' } = {}) {
  return scenario.run({
    source,
    value: value === undefined ? source.getValue() : value,
    variables,
    options,
    context,
  });
}

// ---------------------------------------------------------------------------
// 1.2 Метаданные (info) — справочно, но наблюдаемо через scenario.info()
// ---------------------------------------------------------------------------
describe('1.2 Метаданные сценария (info)', () => {
  it('name и description соответствуют спецификации', ({ scenario }) => {
    const info = scenario.info();
    expect(info.name).toBe('❄️☀️ Зима/Лето');
    expect(info.description).toBe('Автоматическое включение/выключение выключателя в зависимости от указанной даты');
  });

  it('version и author соответствуют спецификации', ({ scenario }) => {
    const info = scenario.info();
    expect(info.version).toBe('1.2');
    expect(info.author).toBe('@BOOMikru');
  });

  it('onStart=true (срабатывает при старте хаба и сохранении сценария)', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });

  it('sourceServices содержит Switch, sourceCharacteristics содержит On', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceServices).toContain(HS.Switch);
    expect(info.sourceCharacteristics).toContain(HC.On);
  });

  it('функции compute нет: синхронное вычисление недоступно/не выполняется', ({ hub, scenario }) => {
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    let threw = false;
    let result;
    try {
      result = scenario.compute({ source, value: true, variables: {}, options: baseOptions(), context: '' });
    } catch (e) {
      threw = true;
    }
    // compute либо не определена (вызов бросает), либо ничего не вычисляет (undefined) —
    // в любом случае она не должна вернуть осмысленное синхронное значение.
    expect(threw || result === undefined).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2.1 Триггеры выполнения — независимость результата от value/context/
//     предыдущего состояния (платформенная механика описана в спецификации,
//     наблюдаемое следствие проверяем через сравнение результатов)
// ---------------------------------------------------------------------------
describe('2.1 Триггеры выполнения — независимость результата', () => {
  it('результат не зависит от переданного value и от состояния On до срабатывания', ({ hub, scenario, time }) => {
    // 15 декабря — по умолчанию (1.12–1.03) должно быть ВКЛ.
    time.set('2026-12-15T12:00:00Z');
    const combos = [
      { initialOn: true, value: true },
      { initialOn: true, value: false },
      { initialOn: false, value: true },
      { initialOn: false, value: false },
    ];
    combos.forEach(({ initialOn, value }, idx) => {
      const acc = addSwitch(hub, { id: idx + 1, on: initialOn });
      const source = acc.char(HS.Switch, HC.On);
      runTrigger(scenario, source, { value, options: baseOptions() });
      expect(source.getValue()).toBe(true);
    });
  });

  it('результат не зависит от context срабатывания', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const contexts = ['', 'onStart', 'manual', 'cloud-command', 'physical-button', 'xyz-random'];
    contexts.forEach((context, idx) => {
      const acc = addSwitch(hub, { id: idx + 1, on: false });
      const source = acc.char(HS.Switch, HC.On);
      runTrigger(scenario, source, { value: false, options: baseOptions(), context });
      expect(source.getValue()).toBe(true);
    });
  });

  it('срабатывание типа onStart (value = текущее состояние) всё равно приводит состояние к вычисленному целевому', ({ hub, scenario, time }) => {
    // Текущая дата — вне зимнего диапазона (должно быть ВЫКЛ), но выключатель ошибочно включён.
    // "onStart" эмулируется вызовом trigger с value, равным уже установленному состоянию.
    time.set('2026-07-15T12:00:00Z');
    const acc = addSwitch(hub, { on: true });
    const source = acc.char(HS.Switch, HC.On);
    expect(source.getValue()).toBe(true);
    runTrigger(scenario, source, { value: source.getValue(), options: baseOptions() });
    expect(source.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2.2 Опции — поддерживаемые форматы (позитивные случаи)
// ---------------------------------------------------------------------------
describe('2.2 Формат дат — цифровой (формат A)', () => {
  it('ведущий ноль необязателен для обеих частей одновременно ("01.12"/"01.03" эквивалентно "1.12"/"1.03")', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '01.12', endDate: '01.03' });

    time.set('2026-12-15T12:00:00Z');
    const accWinter = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accWinter.char(HS.Switch, HC.On), { options: opts });
    expect(accWinter.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-07-15T12:00:00Z');
    const accSummer = addSwitch(hub, { id: 2, on: true });
    runTrigger(scenario, accSummer.char(HS.Switch, HC.On), { options: opts });
    expect(accSummer.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('месяц без ведущего нуля ("1.6"/"1.9") работает так же, как "01.06"/"01.09"', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '1.6', endDate: '1.9' });

    time.set('2026-07-01T12:00:00Z'); // середина диапазона
    const accIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accIn.char(HS.Switch, HC.On), { options: opts });
    expect(accIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-05-31T12:00:00Z'); // на день раньше начала
    const accOut = addSwitch(hub, { id: 2, on: true });
    runTrigger(scenario, accOut.char(HS.Switch, HC.On), { options: opts });
    expect(accOut.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('день из двух цифр с месяцем из одной цифры ("1.06"–"15.6") разбирается корректно', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '1.06', endDate: '15.6' });

    time.set('2026-06-10T12:00:00Z'); // середина
    const accIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accIn.char(HS.Switch, HC.On), { options: opts });
    expect(accIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-06-20T12:00:00Z'); // после конца диапазона
    const accOut = addSwitch(hub, { id: 2, on: true });
    runTrigger(scenario, accOut.char(HS.Switch, HC.On), { options: opts });
    expect(accOut.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('предельные значения "31.12" (максимальный день и месяц) принимаются без ошибки', ({ hub, scenario, time, logs }) => {
    time.set('2026-12-31T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ startDate: '31.12', endDate: '1.03' }) });
    expect(logs.byLevel('error').length).toBe(0);
  });
});

describe('2.2 Формат дат — текстовый (формат B, подтверждённые README примеры)', () => {
  it('"1 декабря" как startDate в паре с числовым endDate работает как "1.12"', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '1 декабря', endDate: '1.03' });

    time.set('2026-12-15T12:00:00Z');
    const accIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accIn.char(HS.Switch, HC.On), { options: opts });
    expect(accIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-07-15T12:00:00Z');
    const accOut = addSwitch(hub, { id: 2, on: true });
    runTrigger(scenario, accOut.char(HS.Switch, HC.On), { options: opts });
    expect(accOut.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('"1 марта" как endDate в паре с числовым startDate работает как "1.03"', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '1.12', endDate: '1 марта' });

    time.set('2026-12-31T12:00:00Z');
    const accIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accIn.char(HS.Switch, HC.On), { options: opts });
    expect(accIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-03-02T12:00:00Z');
    const accOut = addSwitch(hub, { id: 2, on: true });
    runTrigger(scenario, accOut.char(HS.Switch, HC.On), { options: opts });
    expect(accOut.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('"1 ноября"/"28 февраля" (оба текстовые) эквивалентны "1.11"/"28.2" (оба числовые)', ({ hub, scenario, time }) => {
    const optsText = baseOptions({ startDate: '1 ноября', endDate: '28 февраля' });
    const optsNumeric = baseOptions({ startDate: '1.11', endDate: '28.2' });

    time.set('2026-11-01T12:00:00Z');
    const accTextIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accTextIn.char(HS.Switch, HC.On), { options: optsText });
    const accNumericIn = addSwitch(hub, { id: 2, on: false });
    runTrigger(scenario, accNumericIn.char(HS.Switch, HC.On), { options: optsNumeric });
    expect(accTextIn.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(accNumericIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-03-01T12:00:00Z');
    const accTextOut = addSwitch(hub, { id: 3, on: true });
    runTrigger(scenario, accTextOut.char(HS.Switch, HC.On), { options: optsText });
    const accNumericOut = addSwitch(hub, { id: 4, on: true });
    runTrigger(scenario, accNumericOut.char(HS.Switch, HC.On), { options: optsNumeric });
    expect(accTextOut.char(HS.Switch, HC.On).getValue()).toBe(false);
    expect(accNumericOut.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('"15 марта" как граница конца невраппингового диапазона ("1.01"–"15 марта")', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '1.01', endDate: '15 марта' });

    time.set('2026-02-01T12:00:00Z'); // середина диапазона
    const accIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accIn.char(HS.Switch, HC.On), { options: opts });
    expect(accIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-03-15T12:00:00Z'); // граница конца включительно
    const accBoundary = addSwitch(hub, { id: 2, on: false });
    runTrigger(scenario, accBoundary.char(HS.Switch, HC.On), { options: opts });
    expect(accBoundary.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-03-16T12:00:00Z'); // на день позже границы
    const accOut = addSwitch(hub, { id: 3, on: true });
    runTrigger(scenario, accOut.char(HS.Switch, HC.On), { options: opts });
    expect(accOut.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('"10 сентября" как граница начала невраппингового диапазона ("10 сентября"–"20.09")', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '10 сентября', endDate: '20.09' });

    time.set('2026-09-15T12:00:00Z'); // середина
    const accIn = addSwitch(hub, { id: 1, on: false });
    runTrigger(scenario, accIn.char(HS.Switch, HC.On), { options: opts });
    expect(accIn.char(HS.Switch, HC.On).getValue()).toBe(true);

    time.set('2026-09-05T12:00:00Z'); // до начала
    const accBefore = addSwitch(hub, { id: 2, on: true });
    runTrigger(scenario, accBefore.char(HS.Switch, HC.On), { options: opts });
    expect(accBefore.char(HS.Switch, HC.On).getValue()).toBe(false);

    time.set('2026-09-21T12:00:00Z'); // после конца
    const accAfter = addSwitch(hub, { id: 3, on: true });
    runTrigger(scenario, accAfter.char(HS.Switch, HC.On), { options: opts });
    expect(accAfter.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2.2 / 2.9 Валидация — некорректные значения дат
// ---------------------------------------------------------------------------
describe('2.2/2.9 Валидация дат — некорректные значения логируются как ошибка', () => {
  const invalidCases = [
    { startDate: '', endDate: '1.03', label: 'пустая строка в startDate' },
    { startDate: '1.12', endDate: '', label: 'пустая строка в endDate' },
    { startDate: '', endDate: '', label: 'обе даты — пустые строки' },
    { startDate: '0.5', endDate: '1.03', label: 'день = 0 (числовой формат)' },
    { startDate: '32.5', endDate: '1.03', label: 'день = 32 (числовой формат)' },
    { startDate: '15.0', endDate: '1.03', label: 'месяц = 0 (числовой формат)' },
    { startDate: '15.13', endDate: '1.03', label: 'месяц = 13 (числовой формат)' },
    { startDate: '99.99', endDate: '1.03', label: 'день и месяц одновременно вне диапазона' },
    { startDate: '1 December', endDate: '1.03', label: 'иностранное название месяца' },
    { startDate: '1 абырвалг', endDate: '1.03', label: 'нераспознанное русское слово вместо месяца' },
    { startDate: 'not-a-date', endDate: '1.03', label: 'полностью произвольная строка' },
    { startDate: '1.12', endDate: 'abc', label: 'endDate не соответствует ни одному формату' },
    { startDate: '1.13', endDate: '32.1', label: 'обе даты некорректны одновременно' },
    { startDate: '100.12', endDate: '1.03', label: 'день из трёх цифр (нарушает формат "1 или 2 цифры")' },
    { startDate: '1.100', endDate: '1.03', label: 'месяц из трёх цифр (нарушает формат "1 или 2 цифры")' },
    { startDate: '1.5.6', endDate: '1.03', label: 'лишний разделитель "." (три части вместо двух)' },
    { startDate: '-1.5', endDate: '1.03', label: 'отрицательный день' },
    { startDate: '1a.12', endDate: '1.03', label: 'нечисловой символ внутри числового формата' },
  ];

  invalidCases.forEach(({ startDate, endDate, label }, idx) => {
    it(`${label} → в логе есть запись уровня ошибки`, ({ hub, scenario, time, logs }) => {
      time.set('2026-12-15T12:00:00Z');
      const acc = addSwitch(hub, { id: idx + 1, on: false });
      const source = acc.char(HS.Switch, HC.On);
      runTrigger(scenario, source, { options: baseOptions({ startDate, endDate }) });
      expect(logs.byLevel('error').length).toBeGreaterThan(0);
    });
  });

  it('startDate валиден, endDate некорректен (частичная валидность) → тоже ошибка (не применяется только валидная граница)', ({ hub, scenario, time, logs }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ startDate: '1.12', endDate: 'плохая-дата' }) });
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('startDate некорректен, endDate валиден (частичная валидность) → тоже ошибка', ({ hub, scenario, time, logs }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ startDate: 'плохая-дата', endDate: '1.03' }) });
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

describe('2.9 Валидация дат — календарно несуществующие, но численно допустимые дни ПРИНИМАЮТСЯ (не ошибка)', () => {
  const acceptedCases = [
    { startDate: '31.04', endDate: '1.03', label: '31.04 (в апреле нет 31 числа) как startDate' },
    { startDate: '1.12', endDate: '30 февраля', label: '30 февраля (в феврале нет 30 числа) как endDate' },
    { startDate: '31.06', endDate: '1.09', label: '31.06 (в июне нет 31 числа) как startDate' },
  ];

  acceptedCases.forEach(({ startDate, endDate, label }, idx) => {
    it(`${label} → НЕ считается ошибкой конфигурации`, ({ hub, scenario, time, logs }) => {
      time.set('2026-12-15T12:00:00Z');
      const acc = addSwitch(hub, { id: idx + 1, on: false });
      runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ startDate, endDate }) });
      expect(logs.byLevel('error').length).toBe(0);
      // Точная позиция такой даты в годовом порядке не специфицирована (раздел 4) —
      // конкретное итоговое значение On намеренно не проверяется здесь.
    });
  });
});

// ---------------------------------------------------------------------------
// 2.4 Алгоритм определения состояния — таблица примеров из спецификации
// ---------------------------------------------------------------------------
describe('2.4 Алгоритм определения состояния — примеры из спецификации', () => {
  const examples = [
    { start: '1.12', end: '1.03', date: '2026-12-15T12:00:00Z', expected: true, label: '15 декабря — середина диапазона, пересекающего год' },
    { start: '1.12', end: '1.03', date: '2026-12-31T12:00:00Z', expected: true, label: '31 декабря — внутри диапазона' },
    { start: '1.12', end: '1.03', date: '2026-01-01T12:00:00Z', expected: true, label: '1 января — внутри диапазона (после Нового года)' },
    { start: '1.12', end: '1.03', date: '2026-03-01T12:00:00Z', expected: true, label: '1 марта — граница конца включительно' },
    { start: '1.12', end: '1.03', date: '2026-03-02T12:00:00Z', expected: false, label: '2 марта — на день позже границы конца' },
    { start: '1.12', end: '1.03', date: '2026-11-30T12:00:00Z', expected: false, label: '30 ноября — на день раньше границы начала' },
    { start: '1.12', end: '1.03', date: '2026-07-15T12:00:00Z', expected: false, label: '15 июля — вне диапазона' },
    { start: '1.06', end: '1.09', date: '2026-06-01T12:00:00Z', expected: true, label: '1 июня — граница начала (диапазон в пределах года)' },
    { start: '1.06', end: '1.09', date: '2026-07-01T12:00:00Z', expected: true, label: '1 июля — внутри диапазона' },
    { start: '1.06', end: '1.09', date: '2026-09-01T12:00:00Z', expected: true, label: '1 сентября — граница конца включительно' },
    { start: '1.06', end: '1.09', date: '2026-09-02T12:00:00Z', expected: false, label: '2 сентября — на день позже границы конца' },
    { start: '1.06', end: '1.09', date: '2026-03-01T12:00:00Z', expected: false, label: '1 марта — вне диапазона' },
    { start: '1 ноября', end: '28 февраля', date: '2026-11-01T12:00:00Z', expected: true, label: '1 ноября — граница начала (текстовый формат)' },
    { start: '1 ноября', end: '28 февраля', date: '2026-02-28T12:00:00Z', expected: true, label: '28 февраля (невисокосный 2026 год) — граница конца включительно' },
    { start: '1 ноября', end: '28 февраля', date: '2026-03-01T12:00:00Z', expected: false, label: '1 марта — на день позже границы конца' },
    { start: '1 ноября', end: '28 февраля', date: '2026-10-31T12:00:00Z', expected: false, label: '31 октября — на день раньше границы начала' },
  ];

  examples.forEach(({ start, end, date, expected, label }, idx) => {
    it(`${label}: startDate="${start}", endDate="${end}" → ${expected ? 'ВКЛ' : 'ВЫКЛ'}`, ({ hub, scenario, time }) => {
      time.set(date);
      // Начальное состояние — намеренно противоположное ожидаемому, чтобы
      // убедиться, что сценарий АКТИВНО устанавливает нужное состояние,
      // а не просто оставляет его как есть.
      const acc = addSwitch(hub, { id: idx + 1, on: !expected });
      const source = acc.char(HS.Switch, HC.On);
      runTrigger(scenario, source, { options: baseOptions({ startDate: start, endDate: end }) });
      expect(source.getValue()).toBe(expected);
    });
  });
});

// ---------------------------------------------------------------------------
// 2.9 Краевые случаи диапазона
// ---------------------------------------------------------------------------
describe('2.9 Краевые случаи — вырожденный однодневный диапазон (startDate == endDate)', () => {
  const opts = baseOptions({ startDate: '1.06', endDate: '1.06' });

  it('текущая дата совпадает с единственным днём диапазона → ВКЛ', ({ hub, scenario, time }) => {
    time.set('2026-06-01T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: opts });
    expect(acc.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('на день раньше единственного дня диапазона → ВЫКЛ', ({ hub, scenario, time }) => {
    time.set('2026-05-31T12:00:00Z');
    const acc = addSwitch(hub, { on: true });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: opts });
    expect(acc.char(HS.Switch, HC.On).getValue()).toBe(false);
  });

  it('на день позже единственного дня диапазона → ВЫКЛ', ({ hub, scenario, time }) => {
    time.set('2026-06-02T12:00:00Z');
    const acc = addSwitch(hub, { on: true });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: opts });
    expect(acc.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

describe('2.9 Краевые случаи — startDate на 1 день позже endDate (диапазон покрывает весь год)', () => {
  const opts = baseOptions({ startDate: '2.06', endDate: '1.06' });
  const alwaysOnDates = [
    { date: '2026-06-01T12:00:00Z', label: '1 июня (граница endDate)' },
    { date: '2026-06-02T12:00:00Z', label: '2 июня (граница startDate)' },
    { date: '2026-12-15T12:00:00Z', label: '15 декабря (произвольная дата)' },
    { date: '2026-01-01T12:00:00Z', label: '1 января (произвольная дата)' },
  ];

  alwaysOnDates.forEach(({ date, label }, idx) => {
    it(`${label} → ВКЛ (диапазон покрывает каждый день года)`, ({ hub, scenario, time }) => {
      time.set(date);
      const acc = addSwitch(hub, { id: idx + 1, on: false });
      runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: opts });
      expect(acc.char(HS.Switch, HC.On).getValue()).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 2.3 Переменные состояния — statelessness и идемпотентность
// ---------------------------------------------------------------------------
describe('2.3 Переменные состояния — результат не зависит от истории срабатываний', () => {
  it('повторные срабатывания подряд с одинаковыми входами дают один и тот же результат', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    for (let i = 0; i < 5; i++) {
      runTrigger(scenario, source, { options: baseOptions() });
      expect(source.getValue()).toBe(true);
    }
  });

  it('результат одинаков независимо от того, переиспользуется ли объект variables или создаётся заново', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');

    const accReused = addSwitch(hub, { id: 1, on: false });
    const sourceReused = accReused.char(HS.Switch, HC.On);
    const sharedVars = {};
    runTrigger(scenario, sourceReused, { options: baseOptions(), variables: sharedVars });
    runTrigger(scenario, sourceReused, { options: baseOptions(), variables: sharedVars });

    const accFresh = addSwitch(hub, { id: 2, on: false });
    const sourceFresh = accFresh.char(HS.Switch, HC.On);
    runTrigger(scenario, sourceFresh, { options: baseOptions(), variables: {} });
    runTrigger(scenario, sourceFresh, { options: baseOptions(), variables: {} });

    expect(sourceReused.getValue()).toBe(sourceFresh.getValue());
    expect(sourceReused.getValue()).toBe(true);
  });

  it('повторные срабатывания с теми же датами не плодят вторую полуночную задачу', ({ hub, scenario, time, cron }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    const vars = {};
    for (let i = 0; i < 5; i++) {
      runTrigger(scenario, source, { options: baseOptions(), variables: vars });
    }
    expect(cron.listScheduled().length).toBe(1);
  });

  it('срабатывание с изменёнными датами заменяет задачу, а не добавляет вторую', ({ hub, scenario, time, cron }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    const vars = {};

    runTrigger(scenario, source, { options: baseOptions(), variables: vars });
    // Пользователь поменял даты и пересохранил сценарий.
    runTrigger(scenario, source, { options: baseOptions({ startDate: '1.06', endDate: '1.09' }), variables: vars });

    expect(cron.listScheduled().length).toBe(1);

    // Задача должна работать с НОВЫМИ датами: 15 декабря вне 1.06-1.09 → ВЫКЛ.
    cron.tickNow();
    expect(source.getValue()).toBe(false);
  });

  it('несколько независимых привязок с разными опциями не влияют друг на друга', ({ hub, scenario, time }) => {
    // 15 декабря: внутри зимнего диапазона (1.12–1.03), но вне летнего (1.06–1.09).
    time.set('2026-12-15T12:00:00Z');

    const winterAcc = addSwitch(hub, { id: 1, name: 'Зимний выключатель', on: false });
    const summerAcc = addSwitch(hub, { id: 2, name: 'Летний выключатель', on: false });

    runTrigger(scenario, winterAcc.char(HS.Switch, HC.On), { options: baseOptions({ startDate: '1.12', endDate: '1.03' }) });
    runTrigger(scenario, summerAcc.char(HS.Switch, HC.On), { options: baseOptions({ startDate: '1.06', endDate: '1.09' }) });

    expect(winterAcc.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(summerAcc.char(HS.Switch, HC.On).getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2.6 Тайминги — синхронная обработка + полуночное расписание
// ---------------------------------------------------------------------------
describe('2.6 Тайминги — синхронная обработка и полуночное расписание', () => {
  it('состояние устанавливается синхронно сразу после trigger, без продвижения времени', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions() });
    // Никакого time.tick/advance не было — значение уже должно быть выставлено.
    expect(acc.char(HS.Switch, HC.On).getValue()).toBe(true);
  });

  it('срабатывание регистрирует ровно одну полуночную (00:00) cron-задачу', ({ hub, scenario, time, cron }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions() });

    const scheduled = cron.listScheduled();
    expect(scheduled.length).toBe(1);
    expect(scheduled[0].kind).toBe('cron');
    // Следующее срабатывание — ближайшая полночь, то есть начало следующих суток.
    const nextAt = new Date(scheduled[0].nextAtMs);
    expect(nextAt.getHours()).toBe(0);
    expect(nextAt.getMinutes()).toBe(0);
  });

  it('полуночная задача переключает выключатель в день границы БЕЗ внешних событий', ({ hub, scenario, time, cron }) => {
    // 30 ноября, середина дня — за сутки до начала зимнего диапазона 1.12-1.03 → ВЫКЛ.
    time.set('2026-11-30T12:00:00Z');
    const acc = addSwitch(hub, { on: true });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions(), variables: {} });
    expect(source.getValue()).toBe(false);

    // Наступила полночь 1 декабря: ни ручных переключений, ни рестарта хаба.
    cron.tickNow();

    expect(source.getValue()).toBe(true);
  });

  it('полуночная задача выключает выключатель на следующий день после конца диапазона', ({ hub, scenario, time, cron }) => {
    // 1 марта — последний день диапазона 1.12-1.03 (граница включительно) → ВКЛ.
    time.set('2027-03-01T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions(), variables: {} });
    expect(source.getValue()).toBe(true);

    // Полночь 2 марта — диапазон закончился.
    cron.tickNow();

    expect(source.getValue()).toBe(false);
  });

  it('задача остаётся активной и срабатывает в каждую следующую полночь', ({ hub, scenario, time, cron }) => {
    time.set('2026-11-29T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions(), variables: {} });
    expect(source.getValue()).toBe(false);

    // Полночь 30 ноября — всё ещё вне диапазона.
    cron.tickNow();
    expect(source.getValue()).toBe(false);

    // Полночь 1 декабря — вторая подряд отработка той же задачи.
    cron.tickNow();
    expect(source.getValue()).toBe(true);
  });

  it('сценарий не создаёт иных отложенных таймеров, кроме полуночной задачи', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions() });
    expect(time.pendingCount()).toBe(1);
  });

  it('текущая дата считывается заново при каждом вызове trigger, а не кэшируется; до ближайшей полуночи состояние не меняется', ({ hub, scenario, time }) => {
    // T1: середина лета — вне зимнего диапазона → ВЫКЛ.
    time.set('2026-07-15T12:00:00Z');
    const acc = addSwitch(hub, { on: true });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions() });
    expect(source.getValue()).toBe(false);

    // Переводим виртуальное время на дату внутри зимнего диапазона БЕЗ повторного
    // вызова trigger и без прохождения полуночи (time.set не выполняет расписания) —
    // само по себе чтение часов состояние не пересчитывает.
    time.set('2026-12-15T12:00:00Z');
    expect(source.getValue()).toBe(false);

    // Только новый вызов trigger пересчитывает состояние по актуальной дате.
    runTrigger(scenario, source, { options: baseOptions() });
    expect(source.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2.2 / 2.4 Опция invert — инверсия записываемого значения
// ---------------------------------------------------------------------------
describe('2.2/2.4 Опция invert', () => {
  it('invert=true: внутри периода выключатель ВЫКЛЮЧАЕТСЯ', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z'); // внутри 1.12-1.03
    const acc = addSwitch(hub, { on: true });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions({ invert: true }) });
    expect(source.getValue()).toBe(false);
  });

  it('invert=true: вне периода выключатель ВКЛЮЧАЕТСЯ', ({ hub, scenario, time }) => {
    time.set('2026-07-15T12:00:00Z'); // вне 1.12-1.03
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions({ invert: true }) });
    expect(source.getValue()).toBe(true);
  });

  it('invert=false задан явно — поведение как без опции', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions({ invert: false }) });
    expect(source.getValue()).toBe(true);
  });

  it('invert применяется и при полуночном пересчёте', ({ hub, scenario, time, cron }) => {
    time.set('2026-11-30T12:00:00Z'); // вне периода → при инверсии ВКЛ
    const acc = addSwitch(hub, { on: false });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions({ invert: true }), variables: {} });
    expect(source.getValue()).toBe(true);

    cron.tickNow(); // полночь 1 декабря — период начался → при инверсии ВЫКЛ
    expect(source.getValue()).toBe(false);
  });

  it('вырожденный диапазон «один день» с invert=true: в этот день ВЫКЛ, в остальные ВКЛ', ({ hub, scenario, time }) => {
    const opts = baseOptions({ startDate: '1.06', endDate: '1.06', invert: true });

    time.set('2026-06-01T12:00:00Z');
    const acc = addSwitch(hub, { id: 1, on: true });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: opts });
    expect(acc.char(HS.Switch, HC.On).getValue()).toBe(false);

    time.set('2026-06-02T12:00:00Z');
    const acc2 = addSwitch(hub, { id: 2, on: false });
    runTrigger(scenario, acc2.char(HS.Switch, HC.On), { options: opts });
    expect(acc2.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2.4 Опция changeServiceName — имя сервиса по типу периода
// ---------------------------------------------------------------------------
describe('2.4 Опция changeServiceName', () => {
  it('по умолчанию (опция не задана) имя сервиса не меняется', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false, serviceName: 'Отопление' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions() });
    expect(acc.getService(HS.Switch).getName()).toBe('Отопление');
  });

  it('changeServiceName=false — имя сервиса не меняется', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false, serviceName: 'Отопление' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ changeServiceName: false }) });
    expect(acc.getService(HS.Switch).getName()).toBe('Отопление');
  });

  it('диапазон пересекает год, дата внутри периода → «Зима»', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false, serviceName: 'Отопление' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ changeServiceName: true }) });
    expect(acc.getService(HS.Switch).getName()).toBe('Зима');
  });

  it('диапазон пересекает год, дата вне периода → «Лето»', ({ hub, scenario, time }) => {
    time.set('2026-07-15T12:00:00Z');
    const acc = addSwitch(hub, { on: true, serviceName: 'Отопление' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions({ changeServiceName: true }) });
    expect(acc.getService(HS.Switch).getName()).toBe('Лето');
  });

  it('диапазон внутри года, дата внутри периода → «Лето»', ({ hub, scenario, time }) => {
    time.set('2026-07-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false, serviceName: 'Кондиционер' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), {
      options: baseOptions({ startDate: '1.06', endDate: '1.09', changeServiceName: true }),
    });
    expect(acc.getService(HS.Switch).getName()).toBe('Лето');
  });

  it('диапазон внутри года, дата вне периода → «Зима»', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: true, serviceName: 'Кондиционер' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), {
      options: baseOptions({ startDate: '1.06', endDate: '1.09', changeServiceName: true }),
    });
    expect(acc.getService(HS.Switch).getName()).toBe('Зима');
  });

  it('invert не влияет на имя сервиса — оно отражает период, а не состояние', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: true, serviceName: 'Отопление' });
    const source = acc.char(HS.Switch, HC.On);
    runTrigger(scenario, source, { options: baseOptions({ changeServiceName: true, invert: true }) });

    expect(source.getValue()).toBe(false);                    // инверсия применилась к значению
    expect(acc.getService(HS.Switch).getName()).toBe('Зима'); // а имя осталось по периоду
  });

  it('имя обновляется и при полуночном пересчёте', ({ hub, scenario, time, cron }) => {
    time.set('2026-11-30T12:00:00Z');
    const acc = addSwitch(hub, { on: false, serviceName: 'Отопление' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), {
      options: baseOptions({ changeServiceName: true }), variables: {},
    });
    expect(acc.getService(HS.Switch).getName()).toBe('Лето');

    cron.tickNow(); // полночь 1 декабря — начался зимний период
    expect(acc.getService(HS.Switch).getName()).toBe('Зима');
  });

  it('при некорректной дате имя сервиса не меняется', ({ hub, scenario, time }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false, serviceName: 'Отопление' });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), {
      options: baseOptions({ startDate: 'не дата', changeServiceName: true }),
    });
    expect(acc.getService(HS.Switch).getName()).toBe('Отопление');
  });
});

// ---------------------------------------------------------------------------
// 2.7 Логирование
// ---------------------------------------------------------------------------
describe('2.7 Логирование', () => {
  it('при успешной обработке (валидные даты) записей уровня ошибки нет', ({ hub, scenario, time, logs }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions() });
    expect(logs.byLevel('error').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2.8 Внешние зависимости
// ---------------------------------------------------------------------------
describe('2.8 Внешние зависимости — сценарий не обращается к сети', () => {
  it('после срабатывания нет ни одного HTTP-запроса', ({ hub, scenario, time, http }) => {
    time.set('2026-12-15T12:00:00Z');
    const acc = addSwitch(hub, { on: false });
    runTrigger(scenario, acc.char(HS.Switch, HC.On), { options: baseOptions() });
    expect(http.requests.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2.9 Краевые случаи — отсутствующее устройство/сервис
// ---------------------------------------------------------------------------
describe('2.9 Краевые случаи — аксессуар без сервиса Switch', () => {
  it('аксессуар без сервиса Switch → своя характеристика On не изменяется, ошибка в логе', ({ hub, scenario, time, logs }) => {
    time.set('2026-12-15T12:00:00Z'); // дата, при которой по умолчанию было бы ВКЛ
    const lamp = hub.addAccessory({
      id: 1,
      name: 'Лампа без Switch',
      room: 'Тест',
      services: [
        {
          type: HS.Lightbulb,
          characteristics: [{ type: HC.On, value: false }],
        },
      ],
    });
    const source = lamp.char(HS.Lightbulb, HC.On);
    runTrigger(scenario, source, { options: baseOptions() });
    expect(source.getValue()).toBe(false);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});
