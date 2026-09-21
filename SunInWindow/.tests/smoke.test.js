// Смоук-тест сценария "☀️ Свет в окне" (SunInWindow).
//
// Минимальный набор: доказывает, что сценарий грузится, считает положение Солнца
// по опорным значениям спецификации и учитывает дату. Полное покрытие — отдельный
// набор black-box тестов.

function makeSwitch(hub, id, on) {
  return hub.addAccessory({
    id: id, name: 'Окно', room: 'Зал',
    services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: on === true }] }],
  });
}

function baseOptions(overrides) {
  const o = {
    latitude: 55.7558,          // Москва
    longitude: 37.6173,
    windowDirection: 180,       // Юг
    windowAzimuth: -1,          // не задан — берётся румб
    minSunAltitude: 5,
    maxAzimuthDeviation: 90,
    updateInterval: 1,
    allowManualControl: false,
    changeServiceName: false,
    invert: false,
  };
  if (overrides) for (const k of Object.keys(overrides)) o[k] = overrides[k];
  return o;
}

// Считает обращения к методу, не подменяя поведение: нужен там, где проверяется
// "не писали вообще", а не "значение осталось прежним".
function spyOn(target, method) {
  const calls = [];
  const original = target[method].bind(target);
  target[method] = function (arg) {
    calls.push(arg);
    return original(arg);
  };
  return calls;
}

function freshVars() {
  return {
    initialState: undefined,
    lastState: undefined,
    generation: undefined,
    generationKey: undefined,
    timerTask: undefined,
  };
}

// ---------------------------------------------------------------------------
// §3 "Формула", опора: Москва, 21 июня, истинный солнечный полдень →
// высота ≈ 57,7°, азимут ≈ 180°.
// ---------------------------------------------------------------------------

describe('§3 Формула — опора «Москва, 21 июня, солнечный полдень»', () => {
  it('окно на Юг, допуск отклонения 5° → флаг поднят', ({ hub, scenario, time }) => {
    time.set('2026-06-21T09:31:00Z');   // истинный солнечный полдень в Москве
    const sw = makeSwitch(hub, 10, false);
    const on = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: on, value: false, variables: freshVars(),
      options: baseOptions({ maxAzimuthDeviation: 5 }), context: '',
    });

    expect(on.getValue()).toBe(true);
  });

  it('окно на Север, допуск отклонения 5° → флаг снят', ({ hub, scenario, time }) => {
    time.set('2026-06-21T09:31:00Z');
    const sw = makeSwitch(hub, 10, true);
    const on = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: on, value: true, variables: freshVars(),
      options: baseOptions({ windowDirection: 0, maxAzimuthDeviation: 5 }), context: '',
    });

    expect(on.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// История 2 (R05, G01): "в одно и то же время суток 21 декабря и 21 июня
// сценарий даёт разный ответ для одного окна".
// 12:00 UTC, окно на Запад, пороги по умолчанию: 21 июня солнце высоко (≈48°),
// 21 декабря — ниже порога 5° (≈4,5°).
// ---------------------------------------------------------------------------

describe('История 2 (G01) — расчёт учитывает дату', () => {
  it('21 июня и 21 декабря в 12:00 UTC дают разный результат для окна на Запад', ({ hub, scenario, time }) => {
    const sw = makeSwitch(hub, 10, false);
    const on = sw.char(HS.Switch, HC.On);
    const options = baseOptions({ windowDirection: 270 });

    time.set('2026-06-21T12:00:00Z');
    scenario.run({ source: on, value: false, variables: freshVars(), options: options, context: '' });
    const inJune = on.getValue();

    time.set('2026-12-21T12:00:00Z');
    scenario.run({ source: on, value: inJune, variables: freshVars(), options: options, context: '' });
    const inDecember = on.getValue();

    expect(inJune).toBe(true);
    expect(inDecember).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §9 "Невалидные настройки — сценарий молчит, а не врёт".
// ---------------------------------------------------------------------------

describe('§9 Невалидные настройки', () => {
  // Выключатель стартует включённым: значение, которое расчёт в этот момент
  // не выдал бы (окно на Юг, ночь по Гринвичу), а spy ловит саму запись —
  // так "не писали" отличается от "записали то же самое".
  it('широта вне диапазона → ошибка в лог, характеристика не записывается вообще, таймер не поставлен', ({ hub, scenario, time, logs }) => {
    time.set('2026-06-21T22:00:00Z');
    const sw = makeSwitch(hub, 10, true);
    const on = sw.char(HS.Switch, HC.On);
    const writes = spyOn(on, 'setValue');

    scenario.run({
      source: on, value: true, variables: freshVars(),
      options: baseOptions({ latitude: 120 }), context: '',
    });

    expect(writes).toHaveLength(0);
    expect(on.getValue()).toBe(true);
    expect(logs.byLevel('error')).toHaveLength(1);
    expect(time.pendingCount()).toBe(0);
  });

  it('нечисловой порог отклонения → ошибка в лог, характеристика не записывается, таймер не поставлен', ({ hub, scenario, time, logs }) => {
    time.set('2026-06-21T09:31:00Z');
    const sw = makeSwitch(hub, 10, false);
    const on = sw.char(HS.Switch, HC.On);
    const writes = spyOn(on, 'setValue');

    scenario.run({
      source: on, value: false, variables: freshVars(),
      options: baseOptions({ maxAzimuthDeviation: 'много' }), context: '',
    });

    expect(writes).toHaveLength(0);
    expect(logs.byLevel('error')).toHaveLength(1);
    expect(time.pendingCount()).toBe(0);
  });

  // История 15 (R10i.1) на стыке с §9: пересохранение со сломанными настройками
  // обязано погасить таймер прошлого экземпляра, а не оставить его управлять флагом.
  it('пересохранение со сломанной широтой останавливает таймер прошлого поколения', ({ hub, scenario, time }) => {
    time.set('2026-06-21T13:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const on = sw.char(HS.Switch, HC.On);
    const options = baseOptions({ windowDirection: 270, maxAzimuthDeviation: 5 });

    scenario.run({ source: on, value: false, variables: freshVars(), options: options, context: '' });
    expect(on.getValue()).toBe(false);

    // Пересохранение сценария: хаб запускает скрипт заново со свежими variables
    scenario.run({
      source: on, value: false, variables: freshVars(),
      options: baseOptions({ latitude: 120, windowDirection: 270, maxAzimuthDeviation: 5 }), context: '',
    });

    // К 14:00 UTC солнце вошло бы в окно — но управлять флагом уже некому
    for (let i = 0; i < 60; i++) time.advance('1m');

    expect(on.getValue()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §7 "Запись состояния": одинаковое повторно не пишется. Имя сервиса — по тому же
// правилу, иначе минутный таймер переписывает его без смены состояния.
// ---------------------------------------------------------------------------

describe('§7 Запись состояния — имя сервиса', () => {
  it('имя сервиса пишется один раз и не переписывается на каждом пересчёте', ({ hub, scenario, time }) => {
    time.set('2026-06-21T09:31:00Z');
    const sw = makeSwitch(hub, 10, false);
    const on = sw.char(HS.Switch, HC.On);
    const names = spyOn(sw.getService(HS.Switch), 'setName');

    scenario.run({
      source: on, value: false, variables: freshVars(),
      options: baseOptions({ changeServiceName: true }), context: '',
    });
    expect(names).toHaveLength(1);
    expect(names[0]).toBe('Солнце в окне');

    // Состояние не меняется — три тика таймера не должны ничего переписать
    for (let i = 0; i < 3; i++) time.advance('1m');

    expect(names).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// История 10 (R10i): пересчёт по таймеру с интервалом из опции.
// 21 июня, Москва, окно на Запад, допуск 5°: в 13:00 UTC азимут Солнца ≈ 251,6°
// (отклонение 18,4° — не в окне), в 14:00 UTC ≈ 265,2° (отклонение 4,8° — в окне).
// Флаг должен подняться сам, без нового вызова trigger.
// ---------------------------------------------------------------------------

describe('История 10 (R10i) — пересчёт по таймеру', () => {
  it('флаг поднимается сам, когда солнце входит в окно', ({ hub, scenario, time }) => {
    time.set('2026-06-21T13:00:00Z');
    const sw = makeSwitch(hub, 10, false);
    const on = sw.char(HS.Switch, HC.On);

    scenario.run({
      source: on, value: false, variables: freshVars(),
      options: baseOptions({ windowDirection: 270, maxAzimuthDeviation: 5 }), context: '',
    });
    expect(on.getValue()).toBe(false);

    for (let i = 0; i < 60; i++) time.advance('1m');

    expect(on.getValue()).toBe(true);
  });
});
