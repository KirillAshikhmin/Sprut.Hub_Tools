// Тесты логического сценария "Кодовый замок".
// Написаны от спецификации docs/superpowers/specs/2026-08-17-code-lock-design.md.
// Каждый describe — раздел спеки, каждый it — конкретное утверждение.

const BTN = HS.StatelessProgrammableSwitch;
const EVT = HC.ProgrammableSwitchEvent;

const SINGLE = 0;
const DOUBLE = 1;
const LONG = 2;

const LOCK_OPEN = 0;    // LockTargetState: Открыто
const LOCK_CLOSED = 1;  // LockTargetState: Закрыто

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// --- фикстуры --------------------------------------------------------------

function addButton(hub, id, name) {
  return hub.addAccessory({
    id, name: name, room: 'Прихожая',
    services: [
      { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: true }] },
      { type: BTN, name: 'Кнопка', characteristics: [{ type: EVT, value: SINGLE }] },
    ],
  });
}

function addLock(hub) {
  return hub.addAccessory({
    id: 1, name: 'Умный замок', room: 'Прихожая',
    services: [
      { type: HS.AccessoryInformation, characteristics: [{ type: HC.C_Online, value: true }] },
      { type: HS.LockMechanism, name: 'Замок', characteristics: [
        { type: HC.LockCurrentState, value: LOCK_CLOSED },
        { type: HC.LockTargetState, value: LOCK_CLOSED },
      ] },
    ],
  });
}

function buttonUUID(acc) { return acc.getService(BTN).getUUID(); }

function baseOptions(o) {
  const base = {
    code: '', allowExtraPresses: false, enterButton: '',
    pressTimeout: 10, restoreDelay: 0, debug: false,
  };
  DIGITS.forEach((d) => { base['button' + d] = ''; });
  if (o) Object.keys(o).forEach((k) => { base[k] = o[k]; });
  return base;
}

function freshVars() {
  return {
    subscribed: false, opts: null, code: null, buffer: [],
    lastPressAt: 0, blocked: false, restoreTask: undefined, restoreValue: undefined,
  };
}

// Полное окружение: замок + 10 кнопок + кнопка ввода, trigger уже вызван.
// o.buttons — какие цифровые поля заполнять (по умолчанию все);
// o.withEnter — заполнить ли поле «Кнопка ввода».
function setupEnv(ctx, o) {
  const opts = o || {};
  const lock = addLock(ctx.hub);
  const buttons = {};
  DIGITS.forEach((d, i) => { buttons[d] = addButton(ctx.hub, 11 + i, 'Кнопка ' + d); });
  const enterButton = addButton(ctx.hub, 30, 'Кнопка ввода');

  const filled = opts.buttons || DIGITS;
  const options = baseOptions(opts.options);
  filled.forEach((d) => { options['button' + d] = buttonUUID(buttons[d]); });
  if (opts.withEnter) options.enterButton = buttonUUID(enterButton);

  const anchor = lock.char(HS.LockMechanism, HC.LockTargetState);
  const vars = freshVars();
  ctx.scenario.run({
    source: anchor, value: anchor.getValue(),
    variables: vars, options, context: 'HUB[OnStart]',
  });

  return {
    lock, anchor, buttons, enterButton, options, vars,
    press: (digit, type) => buttons[digit].char(BTN, EVT).setValue(type == null ? SINGLE : type),
    pressEnter: (type) => enterButton.char(BTN, EVT).setValue(type == null ? SINGLE : type),
    isOpen: () => anchor.getValue() === LOCK_OPEN,
    rerun: (patch) => {
      const next = baseOptions(options);
      if (patch) Object.keys(patch).forEach((k) => { next[k] = patch[k]; });
      ctx.scenario.run({
        source: anchor, value: anchor.getValue(),
        variables: vars, options: next, context: 'HUB[OnSave]',
      });
      return next;
    },
  };
}

// Ввод последовательности вида '1S 2D 0L' по описанию шагов.
function enterSequence(env, steps) {
  steps.split(' ').forEach((token) => {
    const digit = token.charAt(0);
    const type = token.charAt(1) === 'D' ? DOUBLE : token.charAt(1) === 'L' ? LONG : SINGLE;
    env.press(digit, type);
  });
}

// --- info-блок -------------------------------------------------------------

describe('info-блок (спека §2)', () => {
  it('якорь включает замок, сигнализацию, выключатель и ворота', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceServices).toContain(HS.LockMechanism);
    expect(info.sourceServices).toContain(HS.SecuritySystem);
    expect(info.sourceServices).toContain(HS.Switch);
    expect(info.sourceServices).toContain(HS.GarageDoorOpener);
  });

  it('сценарий реагирует на характеристики-якоря из §1.1', ({ scenario }) => {
    const info = scenario.info();
    expect(info.sourceCharacteristics).toContain(HC.LockTargetState);
    expect(info.sourceCharacteristics).toContain(HC.SecuritySystemTargetState);
    expect(info.sourceCharacteristics).toContain(HC.On);
    expect(info.sourceCharacteristics).toContain(HC.TargetDoorState);
  });

  it('trigger вызывается при старте хаба', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });
});

// --- §4 Парсер кода --------------------------------------------------------

describe('Парсер кода (спека §4)', () => {
  it('буква без цифры относится к кнопке 1', (ctx) => {
    const env = setupEnv(ctx, { options: { code: 'SSDL' } });
    enterSequence(env, '1S 1S 1D 1L');
    expect(env.isOpen()).toBe(true);
  });

  it('цифра без буквы означает одиночное нажатие', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '12357' } });
    enterSequence(env, '1S 2S 3S 5S 7S');
    expect(env.isOpen()).toBe(true);
  });

  it('полная запись с разделителями разбирается как есть', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S 1D 2S' } });
    enterSequence(env, '1S 2S 1D 2S');
    expect(env.isOpen()).toBe(true);
  });

  it('кнопка 0 доступна в коде', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '0D9L' } });
    enterSequence(env, '0D 9L');
    expect(env.isOpen()).toBe(true);
  });

  it('повторная буква подряд открывает новый шаг на той же кнопке', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1SS' } });
    env.press('1');
    expect(env.isOpen()).toBe(false);
    env.press('1');
    expect(env.isOpen()).toBe(true);
  });

  it('цифра после букв продолжает последовательность', (ctx) => {
    const env = setupEnv(ctx, { options: { code: 'SS1' } });
    enterSequence(env, '1S 1S 1S');
    expect(env.isOpen()).toBe(true);
  });

  it('регистр букв не имеет значения', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1d 2l' } });
    enterSequence(env, '1D 2L');
    expect(env.isOpen()).toBe(true);
  });

  it('разделители игнорируются', (ctx) => {
    const env = setupEnv(ctx, { options: { code: ' 1S,-2S ' } });
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(true);
  });
});

// --- §5 Скользящее окно (без кнопки ввода, галка ВКЛ) ----------------------

describe('Режим скользящего окна (спека §5: без кнопки ввода, галка ВКЛ)', () => {
  it('произвольные нажатия до кода не мешают', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '9S 3D 1S 2S');
    expect(env.isOpen()).toBe(true);
  });

  it('окно ловит код, который не начинается с чистого буфера', (ctx) => {
    // Ключевой кейс спеки: код 1S 1S 2S, ввод 1S 1S 1S 2S.
    const env = setupEnv(ctx, { options: { code: '1S 1S 2S', allowExtraPresses: true } });
    enterSequence(env, '1S 1S 1S 2S');
    expect(env.isOpen()).toBe(true);
  });

  it('неполный код не срабатывает', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '1S');
    expect(env.isOpen()).toBe(false);
  });

  it('после успеха буфер очищается', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '1S 2S');
    expect(env.vars.buffer.length).toBe(0);
  });
});

// --- §5 Строгий режим (без кнопки ввода, галка ВЫКЛ) -----------------------

describe('Строгий режим (спека §5: без кнопки ввода, галка ВЫКЛ)', () => {
  it('точная последовательность открывает замок', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S' } });
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(true);
  });

  it('лишнее нажатие перед кодом ломает попытку', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S' } });
    enterSequence(env, '9S 1S 2S');
    expect(env.isOpen()).toBe(false);
  });

  it('ошибка блокирует ввод: правильный код сразу после неё не срабатывает', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S' } });
    env.press('9');                 // несовпадение — блокировка
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(false);
  });

  it('пауза не меньше pressTimeout снимает блокировку', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', pressTimeout: 10 } });
    env.press('9');
    ctx.time.advance('11s');
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(true);
  });

  it('нажатия без пауз не снимают блокировку', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', pressTimeout: 10 } });
    env.press('9');
    for (let i = 0; i < 20; i++) {
      ctx.time.advance('1s');
      enterSequence(env, '1S 2S');
    }
    expect(env.isOpen()).toBe(false);
  });

  it('неверный тип нажатия ломает попытку', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2D' } });
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(false);
  });
});

// --- §5 Режим с кнопкой ввода ----------------------------------------------

describe('Кнопка ввода, галка ВКЛ (спека §5: код как подпоследовательность)', () => {
  it('произвольные нажатия до и после кода не мешают', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '9S 1S 2S 3D');
    env.pressEnter();
    expect(env.isOpen()).toBe(true);
  });

  it('без нажатия «Ввод» код не срабатывает', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(false);
  });

  it('разорванный код не считается подпоследовательностью', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '1S 9S 2S');
    env.pressEnter();
    expect(env.isOpen()).toBe(false);
  });

  it('буфер очищается после нажатия «Ввод»', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S', allowExtraPresses: true } });
    enterSequence(env, '1S 2S');
    env.pressEnter();
    expect(env.vars.buffer.length).toBe(0);
  });
});

describe('Кнопка ввода, галка ВЫКЛ (спека §5: точное равенство)', () => {
  it('точный код с подтверждением открывает замок', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S' } });
    enterSequence(env, '1S 2S');
    env.pressEnter();
    expect(env.isOpen()).toBe(true);
  });

  it('лишнее нажатие перед кодом даёт провал', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S' } });
    enterSequence(env, '9S 1S 2S');
    env.pressEnter();
    expect(env.isOpen()).toBe(false);
  });

  it('после провала можно ввести код заново', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S' } });
    enterSequence(env, '9S 1S 2S');
    env.pressEnter();
    enterSequence(env, '1S 2S');
    env.pressEnter();
    expect(env.isOpen()).toBe(true);
  });

  it('ошибка в середине не блокирует ввод до паузы', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S' } });
    env.press('9');
    enterSequence(env, '1S 2S');
    env.pressEnter();
    expect(env.isOpen()).toBe(false);   // буфер 9S 1S 2S ≠ коду
    enterSequence(env, '1S 2S');
    env.pressEnter();
    expect(env.isOpen()).toBe(true);    // блокировки нет, следующая попытка проходит
  });
});

describe('Двойное и долгое нажатие на кнопке ввода (спека §6)', () => {
  it('двойное нажатие на «Ввод» не подтверждает и не сбрасывает буфер', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S' } });
    enterSequence(env, '1S 2S');
    env.pressEnter(DOUBLE);
    expect(env.isOpen()).toBe(false);
    env.pressEnter(SINGLE);
    expect(env.isOpen()).toBe(true);
  });

  it('долгое нажатие на «Ввод» не подтверждает и не сбрасывает буфер', (ctx) => {
    const env = setupEnv(ctx, { withEnter: true, options: { code: '1S 2S' } });
    enterSequence(env, '1S 2S');
    env.pressEnter(LONG);
    expect(env.isOpen()).toBe(false);
    env.pressEnter(SINGLE);
    expect(env.isOpen()).toBe(true);
  });
});

// --- §6 Таймаут между нажатиями --------------------------------------------

describe('Задержка на ввод (спека §6)', () => {
  it('пауза больше pressTimeout сбрасывает набранное', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', pressTimeout: 10 } });
    env.press('1');
    ctx.time.advance('11s');
    env.press('2');
    expect(env.isOpen()).toBe(false);
  });

  it('пауза в пределах pressTimeout не мешает вводу', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', pressTimeout: 10 } });
    env.press('1');
    ctx.time.advance('9s');
    env.press('2');
    expect(env.isOpen()).toBe(true);
  });

  it('pressTimeout = 0 отключает сброс по времени', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', pressTimeout: 0, allowExtraPresses: true } });
    env.press('1');
    ctx.time.advance('1h');
    env.press('2');
    expect(env.isOpen()).toBe(true);
  });
});

// --- Чужие кнопки ----------------------------------------------------------

describe('Кнопки вне настроек сценария (спека §6)', () => {
  it('событие невыбранной кнопки не влияет на набранный код', (ctx) => {
    const env = setupEnv(ctx, { buttons: ['1', '2'], options: { code: '1S 2S' } });
    const foreign = addButton(ctx.hub, 50, 'Чужая кнопка');
    env.press('1');
    foreign.char(BTN, EVT).setValue(SINGLE);
    env.press('2');
    expect(env.isOpen()).toBe(true);
  });
});

// --- §7 Успех: действие над якорем -----------------------------------------

describe('Действие при верном коде (спека §7)', () => {
  it('замок переводится в «Открыто»', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S' } });
    env.press('1');
    expect(env.anchor.getValue()).toBe(LOCK_OPEN);
  });

  it('выключатель включается', (ctx) => {
    const sw = ctx.hub.addAccessory({
      id: 2, name: 'Свет', room: 'Прихожая',
      services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: false }] }],
    });
    const button = addButton(ctx.hub, 11, 'Кнопка 1');
    const anchor = sw.char(HS.Switch, HC.On);
    const options = baseOptions({ code: '1S', button1: buttonUUID(button) });
    ctx.scenario.run({ source: anchor, value: false, variables: freshVars(), options, context: 'HUB[OnStart]' });

    button.char(BTN, EVT).setValue(SINGLE);
    expect(anchor.getValue()).toBe(true);
  });

  it('сигнализация снимается с охраны', (ctx) => {
    const alarm = ctx.hub.addAccessory({
      id: 3, name: 'Сигнализация', room: 'Прихожая',
      services: [{ type: HS.SecuritySystem, characteristics: [
        { type: HC.SecuritySystemCurrentState, value: 1 },
        { type: HC.SecuritySystemTargetState, value: 1 },
      ] }],
    });
    const button = addButton(ctx.hub, 11, 'Кнопка 1');
    const anchor = alarm.char(HS.SecuritySystem, HC.SecuritySystemTargetState);
    const options = baseOptions({ code: '1S', button1: buttonUUID(button) });
    ctx.scenario.run({ source: anchor, value: 1, variables: freshVars(), options, context: 'HUB[OnStart]' });

    button.char(BTN, EVT).setValue(SINGLE);
    expect(anchor.getValue()).toBe(3);
  });

  it('ворота открываются', (ctx) => {
    const gate = ctx.hub.addAccessory({
      id: 4, name: 'Ворота', room: 'Двор',
      services: [{ type: HS.GarageDoorOpener, characteristics: [
        { type: HC.CurrentDoorState, value: 1 },
        { type: HC.TargetDoorState, value: 1 },
        { type: HC.ObstructionDetected, value: false },
      ] }],
    });
    const button = addButton(ctx.hub, 11, 'Кнопка 1');
    const anchor = gate.char(HS.GarageDoorOpener, HC.TargetDoorState);
    const options = baseOptions({ code: '1S', button1: buttonUUID(button) });
    ctx.scenario.run({ source: anchor, value: 1, variables: freshVars(), options, context: 'HUB[OnStart]' });

    button.char(BTN, EVT).setValue(SINGLE);
    expect(anchor.getValue()).toBe(0);
  });

  it('успешный ввод пишется в журнал', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S' } });
    env.press('1');
    expect(ctx.logs.byLevel('info').length).toBeGreaterThan(0);
  });
});

// --- §7 Автовозврат --------------------------------------------------------

describe('Автовозврат (спека §7)', () => {
  it('через restoreDelay возвращается прежнее состояние', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S', restoreDelay: 30 } });
    env.press('1');
    expect(env.isOpen()).toBe(true);
    ctx.time.advance('30s');
    expect(env.anchor.getValue()).toBe(LOCK_CLOSED);
  });

  it('до истечения restoreDelay состояние не меняется', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S', restoreDelay: 30 } });
    env.press('1');
    ctx.time.advance('29s');
    expect(env.isOpen()).toBe(true);
  });

  it('restoreDelay = 0 отключает автовозврат', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S', restoreDelay: 0 } });
    env.press('1');
    ctx.time.advance('1h');
    expect(env.isOpen()).toBe(true);
  });

  it('повторный верный код во время ожидания сохраняет исходное состояние для возврата', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S', restoreDelay: 30, allowExtraPresses: true } });
    env.press('1');
    ctx.time.advance('20s');
    env.press('1');                       // второй успех, пока автовозврат ещё ждёт
    ctx.time.advance('30s');
    expect(env.anchor.getValue()).toBe(LOCK_CLOSED);
  });

  it('ручное изменение якоря отменяет запланированный автовозврат', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S', restoreDelay: 30 } });
    env.press('1');
    env.rerun();                          // не-self trigger — пользователь тронул устройство
    ctx.time.advance('1h');
    expect(env.isOpen()).toBe(true);
  });
});

// --- §8 Ошибки конфигурации ------------------------------------------------

describe('Ошибки конфигурации (спека §8)', () => {
  it('пустой код — ошибка, нажатия игнорируются', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '' } });
    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    env.press('1');
    expect(env.isOpen()).toBe(false);
  });

  it('код с посторонним символом — ошибка', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1X' } });
    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    env.press('1');
    expect(env.isOpen()).toBe(false);
  });

  it('код длиннее 32 шагов — ошибка', (ctx) => {
    const long = new Array(34).join('1');   // 33 символа
    const env = setupEnv(ctx, { options: { code: long, allowExtraPresses: true } });
    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    env.press('1');
    expect(env.isOpen()).toBe(false);
  });

  it('код ровно из 32 шагов допустим', (ctx) => {
    const max = new Array(33).join('1');    // 32 символа
    const env = setupEnv(ctx, { options: { code: max } });
    expect(ctx.logs.byLevel('error').length).toBe(0);
  });

  it('код ссылается на незаполненное поле кнопки — ошибка', (ctx) => {
    const env = setupEnv(ctx, { buttons: ['1'], options: { code: '1S 3S' } });
    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    env.press('1');
    expect(env.isOpen()).toBe(false);
  });

  it('одна кнопка в двух полях — ошибка', (ctx) => {
    const lock = addLock(ctx.hub);
    const button = addButton(ctx.hub, 11, 'Кнопка 1');
    const options = baseOptions({
      code: '1S', button1: buttonUUID(button), button2: buttonUUID(button),
    });
    const anchor = lock.char(HS.LockMechanism, HC.LockTargetState);
    ctx.scenario.run({ source: anchor, value: LOCK_CLOSED, variables: freshVars(), options, context: 'HUB[OnStart]' });

    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    button.char(BTN, EVT).setValue(SINGLE);
    expect(anchor.getValue()).toBe(LOCK_CLOSED);
  });

  it('кнопка ввода совпадает с кодовой кнопкой — ошибка', (ctx) => {
    const lock = addLock(ctx.hub);
    const button = addButton(ctx.hub, 11, 'Кнопка 1');
    const options = baseOptions({
      code: '1S', button1: buttonUUID(button), enterButton: buttonUUID(button),
    });
    const anchor = lock.char(HS.LockMechanism, HC.LockTargetState);
    ctx.scenario.run({ source: anchor, value: LOCK_CLOSED, variables: freshVars(), options, context: 'HUB[OnStart]' });

    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('строгий режим без кнопки ввода и без таймаута — ошибка', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S', allowExtraPresses: false, pressTimeout: 0 } });
    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(false);
  });

  it('после исправления настроек сценарий работает без перезагрузки хаба', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1X' } });
    expect(ctx.logs.byLevel('error').length).toBeGreaterThan(0);
    env.rerun({ code: '1S' });
    env.press('1');
    expect(env.isOpen()).toBe(true);
  });
});

// --- §2 Подписка и актуальность опций --------------------------------------

describe('Подписка и опции (спека §2)', () => {
  it('подписка оформляется при первом вызове trigger', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S' } });
    expect(env.vars.subscribed).toBe(true);
  });

  it('повторный trigger не создаёт вторую подписку', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S' } });
    env.rerun();
    env.press('1');
    expect(env.vars.buffer.length).toBe(1);   // одно нажатие обработано один раз
  });

  it('новый код из опций подхватывается сохранением сценария', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S' } });
    env.rerun({ code: '3S 4S' });
    enterSequence(env, '3S 4S');
    expect(env.isOpen()).toBe(true);
  });

  it('прежний код после смены не срабатывает', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S 2S' } });
    env.rerun({ code: '3S 4S' });
    enterSequence(env, '1S 2S');
    expect(env.isOpen()).toBe(false);
  });

  it('эхо собственной записи не оформляет подписку', (ctx) => {
    const lock = addLock(ctx.hub);
    const button = addButton(ctx.hub, 11, 'Кнопка 1');
    const anchor = lock.char(HS.LockMechanism, HC.LockTargetState);
    const vars = freshVars();
    const options = baseOptions({ code: '1S', button1: buttonUUID(button) });
    const SELF = 'LOGIC[1_lock] <- C[1.2.30 LockMechanism.LockTargetState] <- LOGIC[1_lock]';

    ctx.scenario.run({ source: anchor, value: LOCK_CLOSED, variables: vars, options, context: SELF });

    expect(vars.subscribed).toBe(false);
    button.char(BTN, EVT).setValue(SINGLE);
    expect(anchor.getValue()).toBe(LOCK_CLOSED);
  });

  it('эхо собственной записи не отменяет автовозврат', (ctx) => {
    const env = setupEnv(ctx, { options: { code: '1S', restoreDelay: 30 } });
    env.press('1');
    const SELF = 'LOGIC[1_lock] <- C[1.2.30 LockMechanism.LockTargetState] <- LOGIC[1_lock]';
    ctx.scenario.run({
      source: env.anchor, value: LOCK_OPEN,
      variables: env.vars, options: env.options, context: SELF,
    });
    ctx.time.advance('30s');
    expect(env.anchor.getValue()).toBe(LOCK_CLOSED);
  });
});
