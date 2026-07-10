// Тесты логического сценария "Кнопка из счётчиков нажатий".
// Написаны от спецификации docs/superpowers/specs/2026-07-06-pulse-counter-button-design.md
// (и README сценария). Каждый describe — раздел спеки, каждый it — конкретное утверждение.
//
// Механика: ProgrammableSwitchEvent — eventLike, поэтому каждую эмиссию считаем
// через независимую тестовую подписку на кнопку (pressEvents), а не по итоговому значению.

// --- helpers ---------------------------------------------------------------

function makeButton(hub, id) {
  return hub.addAccessory({
    id, name: 'Кнопочный модуль', room: 'Прихожая',
    services: [
      { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: true }] },
      { type: HS.StatelessProgrammableSwitch, name: 'Кнопка',
        characteristics: [{ type: HC.ProgrammableSwitchEvent, value: 0 }] },
    ],
  });
}

function makeCounter(hub, id, name, value) {
  return hub.addAccessory({
    id, name, room: 'Прихожая',
    services: [
      { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: true }] },
      { type: HS.C_PulseMeter, name,
        characteristics: [{ type: HC.C_PulseCount, value: value != null ? value : 0 }] },
    ],
  });
}

function counterUUID(counterAcc) {
  return counterAcc.getService(HS.C_PulseMeter).getUUID();
}
function anchorChar(buttonAcc) {
  return buttonAcc.char(HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent);
}
function pulseChar(counterAcc) {
  return counterAcc.char(HS.C_PulseMeter, HC.C_PulseCount);
}

// Независимая подписка на кнопку: собирает все эмитированные коды события.
// hub.raw — сырой HubMock (тот же Hub, что видит сценарий), с subscribeWithCondition.
function pressEvents(hub) {
  const events = [];
  hub.raw.subscribeWithCondition('', '', [HS.StatelessProgrammableSwitch], [HC.ProgrammableSwitchEvent],
    (src, val) => events.push(val));
  return events;
}

function freshVars() {
  return { subscribed: false, subscription: undefined, prev: {} };
}
function baseOptions(o) {
  const base = { singleCounter: '', doubleCounter: '', longCounter: '', debug: false };
  if (o) for (const k of Object.keys(o)) base[k] = o[k];
  return base;
}

// Оформляет подписку сценария (onStart) и возвращает собиратель событий.
function arm(hub, scenario, button, options, vars) {
  const events = pressEvents(hub);
  scenario.run({
    source: anchorChar(button), value: 0,
    variables: vars, options, context: 'HUB[OnStart]',
  });
  return events;
}

// --- info-блок -------------------------------------------------------------

describe('info-блок', () => {
  it('якорь — StatelessProgrammableSwitch / ProgrammableSwitchEvent', ({ scenario }) => {
    const info = scenario.info();
    expect(info).not.toBeNull();
    expect(info.sourceServices).toContain(HS.StatelessProgrammableSwitch);
    expect(info.sourceCharacteristics).toContain(HC.ProgrammableSwitchEvent);
  });

  it('onStart=true', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });
});

// --- Спека §1.2 / §5.4: определение типа нажатия по счётчику ----------------

describe('Определение типа нажатия', () => {
  it('инкремент счётчика одиночных → событие 0 (SINGLE_PRESS)', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 0);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    pulseChar(single).setValue(1);

    expect(events.length).toBe(1);
    expect(events[0]).toBe(0);
  });

  it('инкремент счётчика двойных → событие 1 (DOUBLE_PRESS)', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const dbl = makeCounter(hub, 21, 'Счётчик двойных', 0);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ doubleCounter: counterUUID(dbl) }), vars);

    pulseChar(dbl).setValue(1);

    expect(events.length).toBe(1);
    expect(events[0]).toBe(1);
  });

  it('инкремент счётчика долгих → событие 2 (LONG_PRESS)', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const long = makeCounter(hub, 22, 'Счётчик длинных', 0);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ longCounter: counterUUID(long) }), vars);

    pulseChar(long).setValue(1);

    expect(events.length).toBe(1);
    expect(events[0]).toBe(2);
  });

  it('невыбранный счётчик (не указан ни в одной опции) → события нет', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 0);
    const stranger = makeCounter(hub, 99, 'Чужой счётчик', 0);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    pulseChar(stranger).setValue(1);

    expect(events.length).toBe(0);
  });
});

// --- Спека §8: детект инкремента и игнор сброса ----------------------------

describe('Детект инкремента и сброса', () => {
  it('игнор сброса: 5 → 0 не даёт события, следующий 0 → 1 даёт', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 5); // база = 5
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    pulseChar(single).setValue(0);      // сброс — не нажатие
    expect(events.length).toBe(0);

    pulseChar(single).setValue(1);      // 0 -> 1 — нажатие
    expect(events.length).toBe(1);
    expect(events[0]).toBe(0);
  });

  it('равное значение не даёт события', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 5);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    pulseChar(single).setValue(5);      // равно базе
    expect(events.length).toBe(0);
  });

  it('уменьшение (не 0) не даёт события и синхронизирует базу', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 5);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    pulseChar(single).setValue(4);      // уменьшение — не нажатие
    expect(events.length).toBe(0);

    pulseChar(single).setValue(5);      // 4 -> 5 — снова нажатие
    expect(events.length).toBe(1);
    expect(events[0]).toBe(0);
  });

  it('скачок +2 даёт ровно одно событие', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 5);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    pulseChar(single).setValue(7);      // 5 -> 7
    expect(events.length).toBe(1);
    expect(events[0]).toBe(0);
  });
});

// --- Спека §5.3: инициализация базы — первое нажатие не теряется ------------

describe('Инициализация базы (первое нажатие не теряется)', () => {
  it('счётчик стартует с 5, первый инкремент до 6 даёт событие', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 5); // ненулевая база на старте
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    // initPrev прочитал 5; первый же реальный инкремент даёт событие (не «инициализация»)
    pulseChar(single).setValue(6);
    expect(events.length).toBe(1);
    expect(events[0]).toBe(0);
  });

  it('prev сохраняется в variables', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 5);
    const vars = freshVars();
    arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    expect(vars.prev[counterUUID(single)]).toBe(5);
  });
});

// --- Спека §6: защита от self-change ---------------------------------------

describe('Защита от self-change', () => {
  // Формат self-context: "LOGIC[id] <- C[..] <- LOGIC[id]" (echo собственной записи).
  const SELF = 'LOGIC[1_btn] <- C[10.2.73 StatelessProgrammableSwitch.ProgrammableSwitchEvent] <- LOGIC[1_btn]';

  it('self-context при первом вызове → подписка не оформляется, событий нет', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 0);
    const vars = freshVars();
    const events = pressEvents(hub);

    // trigger приходит как эхо нашей же записи — раньше, чем штатный onStart
    scenario.run({
      source: anchorChar(button), value: 0,
      variables: vars, options: baseOptions({ singleCounter: counterUUID(single) }),
      context: SELF,
    });

    expect(vars.subscribed).toBe(false);   // подписка не оформлена
    pulseChar(single).setValue(1);
    expect(events.length).toBe(0);         // изменение счётчика ни к чему не приводит
  });

  it('self-context после штатной подписки не ломает работу', ({ hub, scenario }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 0);
    const vars = freshVars();
    const events = arm(hub, scenario, button, baseOptions({ singleCounter: counterUUID(single) }), vars);

    // приходит эхо — не должно оформлять вторую подписку и не должно падать
    scenario.run({
      source: anchorChar(button), value: 0,
      variables: vars, options: baseOptions({ singleCounter: counterUUID(single) }),
      context: SELF,
    });

    pulseChar(single).setValue(1);         // одно реальное нажатие
    expect(events.length).toBe(1);         // ровно одно событие
    expect(events[0]).toBe(0);
  });
});
