# PulseCounterButton — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Логический сценарий Sprut.Hub, который превращает три счётчика импульсов (одиночные/двойные/долгие нажатия) в стандартное событие HomeKit-кнопки `ProgrammableSwitchEvent`.

**Architecture:** Сценарий привязан к кнопке (`StatelessProgrammableSwitch` / `ProgrammableSwitchEvent`). На `onStart` `trigger` инициализирует базу счётчиков и оформляет подписку `Hub.subscribeWithCondition` на все `C_PulseMeter/C_PulseCount`. В колбэке по инкременту выбранного счётчика (сравнение `source.getService().getUUID()` с опциями) пишет код `0/1/2` в `ProgrammableSwitchEvent` (это и есть `source` якоря). Собственная запись отсекается проверкой `isSelfChanged(context)`.

**Tech Stack:** Nashorn (ES5 + точечный ES6), тест-раннер ScenarioSimulator (bun), запуск `./sim`.

Полная спецификация: `docs/superpowers/specs/2026-07-06-pulse-counter-button-design.md`.

## Global Constraints

- **Язык сценария:** только ES5 + точечный ES6 (стрелочные функции, шаблонные строки, `const`/`let`). **Запрещено** в `source/*.js`: классы, `import`/`export`, деструктуризация, промисы, `async`/`await`, spread/rest, `Object.assign`.
- **Тест-файлы** (`.tests/*.test.js`) исполняются в bun — там разрешён современный JS (деструктуризация контекста, стрелки, `for...of`).
- `trigger` — синхронная функция; асинхронность только через `Hub.subscribeWithCondition`.
- Из кода **нельзя** читать блок `info` — только аргументы `trigger`.
- Имена папок/`.js`-файлов — CamelCase. README и комментарии — на русском. `name`/`desc` опций — `{ ru, en }`.
- **Тесты пишутся от спецификации/README**, не от реализации.
- `PulseCounterButton.json` генерируется `./publish` — **вручную не создавать и не редактировать**.
- Коды события (подтверждено `sh_types.json`): `0`=SINGLE_PRESS, `1`=DOUBLE_PRESS, `2`=LONG_PRESS. `ProgrammableSwitchEvent` — `Integer`, `eventLike:true` (каждая запись = событие). `C_PulseCount` — `Double`.
- Автор: `@BOOMikru`. Версия: `1.0`.
- Прогон одного сценария: `./sim run PulseCounterButton` (из корня репозитория). Полный прогон: `./sim run`.

## Файловая структура

```
PulseCounterButton/
  source/PulseCounterButton.js          # весь код сценария (один файл)
  .tests/config.json                    # конфиг тестов, logic-only
  .tests/pulse-counter-button.test.js   # тесты от спецификации
  .tests/preset.json                    # фикстура для веб-UI
  README.md                             # документация сценария
  publish.json                          # генерируется `./publish --init`
```

- `source/PulseCounterButton.js` — единственная единица кода: `info`, `trigger`, вспомогательные функции. Держим в одном файле (сценарий небольшой, так принято в репозитории).
- Тесты и фикстуры — рядом, в `.tests/`.

---

### Task 1: Ядро — подписка, инициализация базы, детект инкремента, эмиссия

**Files:**
- Create: `PulseCounterButton/source/PulseCounterButton.js`
- Create: `PulseCounterButton/.tests/config.json`
- Create: `PulseCounterButton/.tests/pulse-counter-button.test.js`

**Interfaces (Produces):**
- `trigger(source, value, variables, options, context)` — точка входа; на `onStart` оформляет подписку.
- `setupSubscription(anchorSource, variables, options)` — идемпотентно (флаг `variables.subscribed`); `eventChar` = `anchorSource` (сам `ProgrammableSwitchEvent`).
- `initPrev(variables, options)` — заполняет `variables.prev[uuid]` текущими значениями выбранных счётчиков.
- `handleCounter(counterSource, value, variables, options, eventChar)` — колбэк подписки.
- `resolveEventCode(serviceUUID, options)` → `0|1|2|-1`.
- `getServiceByUUID(uuid)` → сервис или `null`.
- `getPulseCounters()` → массив `{ name:{ru,en}, value:uuid }` для опций.
- `variables`: `{ subscribed:false, subscription:undefined, prev:{} }`.

- [ ] **Step 1: Создать `PulseCounterButton/.tests/config.json`**

```json
{
  "$schema": "../../ScenarioSimulator/schemas/config.schema.json",
  "name": "PulseCounterButton",
  "scenario": { "globals": [], "logic": ["../source/PulseCounterButton.js"] },
  "tests": ["*.test.js"],
  "execution": { "timeoutMs": 5000, "strictMode": "off", "encoding": "utf-8", "isolation": "per-test" }
}
```

- [ ] **Step 2: Написать тесты ядра — `PulseCounterButton/.tests/pulse-counter-button.test.js`**

```js
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
function pressEvents(hub) {
  const events = [];
  hub.subscribeWithCondition('', '', [HS.StatelessProgrammableSwitch], [HC.ProgrammableSwitchEvent],
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
```

- [ ] **Step 3: Запустить тесты — убедиться, что падают**

Run: `./sim run PulseCounterButton`
Expected: FAIL — сценарий/исходник ещё не существует (ошибка загрузки logic-файла либо все `it` красные).

- [ ] **Step 4: Создать `PulseCounterButton/source/PulseCounterButton.js`**

```js
// Кнопка из счётчиков нажатий.
// Логика применяется к кнопке (StatelessProgrammableSwitch). На старте подписывается
// на счётчики импульсов (C_PulseMeter/C_PulseCount) и по инкременту выбранного счётчика
// пишет код события в ProgrammableSwitchEvent: 0=одиночное, 1=двойное, 2=долгое.

// Список счётчиков для опций (обновляется на старте хаба и при сохранении сценария).
let pulseCounters = getPulseCounters();

info = {
  name: "Кнопка из счётчиков нажатий",
  description: "Превращает счётчики импульсов (короткие/двойные/долгие нажатия) в событие HomeKit-кнопки ProgrammableSwitchEvent того же устройства.",
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.StatelessProgrammableSwitch],
  sourceCharacteristics: [HC.ProgrammableSwitchEvent],

  options: {
    singleCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик одиночных нажатий", en: "Single press counter" },
      desc: { ru: "Счётчик импульсов, соответствующий одиночному нажатию", en: "Pulse counter for single press" }
    },
    doubleCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик двойных нажатий", en: "Double press counter" },
      desc: { ru: "Счётчик импульсов, соответствующий двойному нажатию", en: "Pulse counter for double press" }
    },
    longCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик долгих нажатий", en: "Long press counter" },
      desc: { ru: "Счётчик импульсов, соответствующий долгому нажатию", en: "Pulse counter for long press" }
    },
    debug: {
      type: "Boolean", value: false,
      name: { ru: "Отладочный лог", en: "Debug log" },
      desc: { ru: "Подробный вывод в консоль сценария", en: "Verbose console output" }
    }
  },

  variables: {
    subscribed: false,
    subscription: undefined,
    prev: {}
  }
};

function trigger(source, value, variables, options, context) {
  setupSubscription(source, variables, options);
}

// Оформляет подписку на счётчики один раз. eventChar — сам источник (ProgrammableSwitchEvent кнопки).
function setupSubscription(anchorSource, variables, options) {
  if (variables.subscribed) return;
  let eventChar = anchorSource;
  if (!variables.prev) variables.prev = {};

  initPrev(variables, options);

  variables.subscription = Hub.subscribeWithCondition("", "", [HS.C_PulseMeter], [HC.C_PulseCount],
    function (counterSource, counterValue) {
      handleCounter(counterSource, counterValue, variables, options, eventChar);
    });
  variables.subscribed = true;
}

// Инициализирует базу prev текущими значениями выбранных счётчиков — чтобы первое
// реальное нажатие после старта не было потеряно (колбэк на старте не вызывается).
function initPrev(variables, options) {
  let uuids = [options.singleCounter, options.doubleCounter, options.longCounter];
  uuids.forEach(function (uuid) {
    if (!uuid) return;
    let svc = getServiceByUUID(uuid);
    if (!svc) return;
    let ch = svc.getCharacteristic(HC.C_PulseCount);
    if (!ch) return;
    let n = Number(ch.getValue());
    variables.prev[uuid] = isNaN(n) ? 0 : n;
  });
}

function getServiceByUUID(uuid) {
  let parts = uuid.split(".");
  let acc = Hub.getAccessory(parts[0]);
  return acc ? acc.getService(parts[1]) : null;
}

// Колбэк подписки: детект инкремента и эмиссия события.
function handleCounter(counterSource, value, variables, options, eventChar) {
  let key = counterSource.getService().getUUID();
  let code = resolveEventCode(key, options);
  if (code < 0) {
    logDebug(options, "изменение невыбранного счётчика " + key + " — пропуск");
    return;
  }

  let v = Number(value);
  if (isNaN(v)) return;
  let prev = variables.prev[key];

  if (v === 0) { variables.prev[key] = 0; return; }              // сброс — не нажатие
  if (prev === undefined) { variables.prev[key] = v; return; }   // счётчик впервые виден — не нажатие
  if (v > prev) {                                                 // положительный инкремент = нажатие
    variables.prev[key] = v;
    eventChar.setValue(code);
    logDebug(options, "нажатие типа " + code + " (счётчик " + key + ": " + prev + " -> " + v + ")");
    return;
  }
  variables.prev[key] = v;                                        // равно/уменьшилось (не 0) — синхронизация
}

function resolveEventCode(key, options) {
  if (options.singleCounter && key === options.singleCounter) return 0;
  if (options.doubleCounter && key === options.doubleCounter) return 1;
  if (options.longCounter && key === options.longCounter) return 2;
  return -1;
}

// Список сервисов-счётчиков импульсов для выпадающих опций.
function getPulseCounters() {
  let list = [{ name: { ru: "Не выбрано", en: "Not selected" }, value: "" }];
  Hub.getAccessories().forEach(function (a) {
    a.getServices().forEach(function (s) {
      if (s.getType() === HS.C_PulseMeter && s.getCharacteristic(HC.C_PulseCount)) {
        let name = getCounterName(s);
        list.push({ name: { ru: name, en: name }, value: s.getUUID() });
      }
    });
  });
  return list;
}

function getCounterName(service) {
  let acc = service.getAccessory();
  let accName = acc.getName();
  let sName = service.getName();
  let full = (accName === sName) ? accName : (accName + " " + sName);
  return full + " (" + service.getUUID() + ")";
}

function logDebug(options, message) {
  if (options && options.debug) console.log("[PulseCounterButton] " + message);
}
```

- [ ] **Step 5: Запустить тесты — убедиться, что проходят**

Run: `./sim run PulseCounterButton`
Expected: PASS — все `it` в блоках «info-блок» и «Определение типа нажатия» зелёные.

- [ ] **Step 6: Commit**

```bash
git add PulseCounterButton/source/PulseCounterButton.js PulseCounterButton/.tests/config.json PulseCounterButton/.tests/pulse-counter-button.test.js
git commit -m "feat(pulse-counter-button): ядро — подписка на счётчики, детект инкремента, эмиссия события"
```

---

### Task 2: Краевые случаи детекта (покрытие спеки §8)

Ядро из Task 1 уже реализует `prev`-логику и `initPrev`. Эта задача добавляет тесты на краевые случаи спецификации. Если какой-то тест падает — дефект в `handleCounter`/`initPrev`, чинить ядро (не подгонять тест).

**Files:**
- Modify: `PulseCounterButton/.tests/pulse-counter-button.test.js` (добавить describe-блоки)

**Interfaces (Consumes):** helpers и функции из Task 1.

- [ ] **Step 1: Добавить блоки краевых случаев в конец тест-файла**

```js
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
```

- [ ] **Step 2: Запустить тесты**

Run: `./sim run PulseCounterButton`
Expected: PASS — новые блоки зелёные (ядро уже реализует эту логику).

- [ ] **Step 3: Commit**

```bash
git add PulseCounterButton/.tests/pulse-counter-button.test.js
git commit -m "test(pulse-counter-button): краевые случаи детекта — сброс, равно, уменьшение, скачок, инициализация базы"
```

---

### Task 3: Защита от self-change

**Files:**
- Modify: `PulseCounterButton/source/PulseCounterButton.js` (добавить `isSelfChanged` и вызов в `trigger`)
- Modify: `PulseCounterButton/.tests/pulse-counter-button.test.js` (добавить describe)

**Interfaces (Produces):**
- `isSelfChanged(context)` → `boolean` — `true`, если изменение вызвано этим же сценарием.

- [ ] **Step 1: Добавить тесты self-change в конец тест-файла**

```js
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
```

- [ ] **Step 2: Запустить тесты — убедиться, что первый тест падает**

Run: `./sim run PulseCounterButton`
Expected: FAIL на «self-context при первом вызове …» — без `isSelfChanged` `trigger` оформляет подписку и событие проходит (`vars.subscribed` становится `true`, `events.length` = 1).

- [ ] **Step 3: Добавить `isSelfChanged` и вызвать его в `trigger`**

Замени функцию `trigger` в `source/PulseCounterButton.js` на:

```js
function trigger(source, value, variables, options, context) {
  if (isSelfChanged(context)) return;
  setupSubscription(source, variables, options);
}
```

И добавь в файл (например, перед `logDebug`) блок разбора контекста:

```js
// --- Определение self-change (эталон PassthroughSwitch) ---------------------

let CONTEXT_CONSTANTS = { DELIMITER: " <- ", LOGIC_PREFIX: "LOGIC", CHARACTERISTIC_PREFIX: "C", MIN_ELEMENTS: 3 };

function isSelfChanged(context) {
  if (!context) return false;
  let ctx = context.toString();
  let elements = ctx.split(CONTEXT_CONSTANTS.DELIMITER);
  if (isSameLogicEcho(elements)) return true;
  if (hasMultipleLogicInChain(ctx, elements)) return true;
  return false;
}

function isSameLogicEcho(elements) {
  if (elements.length < CONTEXT_CONSTANTS.MIN_ELEMENTS) return false;
  let firstIsLogic = elements[0].indexOf(CONTEXT_CONSTANTS.LOGIC_PREFIX) === 0;
  let secondIsChar = elements[1].indexOf(CONTEXT_CONSTANTS.CHARACTERISTIC_PREFIX) === 0;
  return firstIsLogic && secondIsChar && elements[0] === elements[2];
}

function hasMultipleLogicInChain(contextStr, elements) {
  let lastLogic = null;
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i].indexOf(CONTEXT_CONSTANTS.LOGIC_PREFIX) === 0) { lastLogic = elements[i]; break; }
  }
  if (!lastLogic) return false;
  let prefix = lastLogic.split(" ")[0];
  let count = 0, pos = 0;
  while ((pos = contextStr.indexOf(prefix, pos)) !== -1) { count++; pos += prefix.length; }
  return count >= 2;
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `./sim run PulseCounterButton`
Expected: PASS — оба теста self-change зелёные, остальные не сломаны.

- [ ] **Step 5: Commit**

```bash
git add PulseCounterButton/source/PulseCounterButton.js PulseCounterButton/.tests/pulse-counter-button.test.js
git commit -m "feat(pulse-counter-button): отсечение self-change по context"
```

---

### Task 4: Ошибка конфигурации — один счётчик на несколько типов

**Files:**
- Modify: `PulseCounterButton/source/PulseCounterButton.js` (добавить `hasDuplicateCounters` и проверку в `trigger`)
- Modify: `PulseCounterButton/.tests/pulse-counter-button.test.js` (добавить describe)

**Interfaces (Produces):**
- `hasDuplicateCounters(options)` → `boolean` — один и тот же непустой UUID выбран более чем в одной опции.

- [ ] **Step 1: Добавить тесты дубликата в конец тест-файла**

```js
// --- Спека §7: ошибка конфигурации (дубликат счётчика) ---------------------

describe('Ошибка конфигурации: дубликат счётчика', () => {
  it('один счётчик выбран для single и double → error в логе, подписки/событий нет', ({ hub, scenario, logs }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 0);
    const uuid = counterUUID(single);
    const vars = freshVars();
    const events = pressEvents(hub);

    scenario.run({
      source: anchorChar(button), value: 0, variables: vars,
      options: baseOptions({ singleCounter: uuid, doubleCounter: uuid }),
      context: 'HUB[OnStart]',
    });

    expect(logs.byLevel('error').length).toBeGreaterThan(0);
    expect(vars.subscribed).toBe(false);

    pulseChar(single).setValue(1);
    expect(events.length).toBe(0);
  });

  it('разные счётчики для разных типов → ошибки нет, подписка оформлена', ({ hub, scenario, logs }) => {
    const button = makeButton(hub, 10);
    const single = makeCounter(hub, 20, 'Счётчик коротких', 0);
    const dbl = makeCounter(hub, 21, 'Счётчик двойных', 0);
    const vars = freshVars();
    arm(hub, scenario, button, baseOptions({
      singleCounter: counterUUID(single), doubleCounter: counterUUID(dbl),
    }), vars);

    expect(logs.byLevel('error').length).toBe(0);
    expect(vars.subscribed).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что первый тест падает**

Run: `./sim run PulseCounterButton`
Expected: FAIL на «один счётчик выбран для single и double …» — без проверки дубликата подписка оформляется, событие проходит, error не логируется.

- [ ] **Step 3: Добавить `hasDuplicateCounters` и проверку в `trigger`**

Замени функцию `trigger` на:

```js
function trigger(source, value, variables, options, context) {
  if (isSelfChanged(context)) return;
  if (hasDuplicateCounters(options)) {
    console.error("Кнопка из счётчиков нажатий: один счётчик выбран для нескольких типов нажатий — исправьте настройки логики. События не отправляются.");
    return;
  }
  setupSubscription(source, variables, options);
}
```

И добавь функцию (например, рядом с `resolveEventCode`):

```js
function hasDuplicateCounters(options) {
  let picked = [];
  let keys = [options.singleCounter, options.doubleCounter, options.longCounter];
  for (let i = 0; i < keys.length; i++) {
    if (!keys[i]) continue;
    if (picked.indexOf(keys[i]) >= 0) return true;
    picked.push(keys[i]);
  }
  return false;
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `./sim run PulseCounterButton`
Expected: PASS — оба теста дубликата зелёные, остальные не сломаны.

- [ ] **Step 5: Commit**

```bash
git add PulseCounterButton/source/PulseCounterButton.js PulseCounterButton/.tests/pulse-counter-button.test.js
git commit -m "feat(pulse-counter-button): ошибка конфигурации при дубликате счётчика"
```

---

### Task 5: preset.json, README, публикация

**Files:**
- Create: `PulseCounterButton/.tests/preset.json`
- Create: `PulseCounterButton/README.md`
- Create: `PulseCounterButton/publish.json` (через `./publish --init`)

- [ ] **Step 1: Создать `PulseCounterButton/.tests/preset.json`**

Реалистичное устройство: кнопка + три счётчика на одном аксессуаре (`target:true` — его `ProgrammableSwitchEvent` якорит `trigger`).

```json
{
  "name": "Кнопка из счётчиков нажатий — вход 2",
  "description": "Кнопочный модуль: HomeKit-кнопка и три счётчика импульсов (короткие/двойные/долгие). Выберите в опциях счётчик для каждого типа нажатия и переактивируйте сценарий, затем инкрементируйте счётчики для проверки.",
  "options": { "singleCounter": "", "doubleCounter": "", "longCounter": "", "debug": true },
  "variables": {},
  "rooms": [{ "name": "Прихожая" }],
  "accessories": [
    {
      "id": 100,
      "name": "Кнопочный модуль",
      "room": "Прихожая",
      "target": true,
      "services": [
        { "type": "AccessoryInformation", "characteristics": [{ "type": "C_Online", "value": true }] },
        { "type": "StatelessProgrammableSwitch", "name": "Кнопка",
          "characteristics": [{ "type": "ProgrammableSwitchEvent", "value": 0 }] },
        { "type": "C_PulseMeter", "name": "Счётчик коротких нажатий",
          "characteristics": [{ "type": "C_PulseCount", "value": 0 }] },
        { "type": "C_PulseMeter", "name": "Счётчик двойных нажатий",
          "characteristics": [{ "type": "C_PulseCount", "value": 0 }] },
        { "type": "C_PulseMeter", "name": "Счётчик длинных нажатий",
          "characteristics": [{ "type": "C_PulseCount", "value": 0 }] }
      ]
    }
  ]
}
```

- [ ] **Step 2: Создать `PulseCounterButton/README.md`**

```markdown
# Кнопка из счётчиков нажатий (PulseCounterButton)

Логический сценарий Sprut.Hub. Превращает счётчики импульсов кнопочного модуля
(короткие/двойные/долгие нажатия) в стандартное событие HomeKit-кнопки
`ProgrammableSwitchEvent`, к которому штатно привязываются сцены хаба.

## Назначение и поведение

Некоторые модули ввода отдают нажатия не событием кнопки, а тремя счётчиками
импульсов: при нажатии соответствующий счётчик увеличивается на 1. Сценарий
применяется к кнопке (`StatelessProgrammableSwitch`) устройства, на старте
подписывается на счётчики и по инкременту выбранного счётчика записывает код в
`ProgrammableSwitchEvent`:

- одиночное нажатие → `0` (SINGLE_PRESS);
- двойное нажатие → `1` (DOUBLE_PRESS);
- долгое нажатие → `2` (LONG_PRESS).

Сброс счётчика в `0` (перезапуск устройства) нажатием не считается. Первое
нажатие после старта хаба не теряется: база счётчиков инициализируется их
текущими значениями. Собственная запись в кнопку отсекается проверкой контекста
(`self-change`), поэтому цикла не возникает.

## Опции

- **Счётчик одиночных нажатий** (`singleCounter`) — сервис-счётчик `C_PulseMeter`, соответствующий одиночному нажатию (→ событие `0`).
- **Счётчик двойных нажатий** (`doubleCounter`) — счётчик двойного нажатия (→ событие `1`).
- **Счётчик долгих нажатий** (`longCounter`) — счётчик долгого нажатия (→ событие `2`).
- **Отладочный лог** (`debug`) — подробный вывод в консоль сценария.

Невыбранный тип не обрабатывается. Один и тот же счётчик, выбранный для двух
типов, — ошибка настройки: сценарий пишет ошибку в лог и не отправляет события.

## Переменные

- `subscribed` — подписка на счётчики уже оформлена.
- `subscription` — задача подписки.
- `prev` — последнее известное значение каждого счётчика (по UUID сервиса).

Переменные сбрасываются при перезагрузке хаба; `trigger` на `onStart`
восстанавливает подписку и базу.

## Настройка в Sprut.Hub

1. У устройства должен быть сервис `StatelessProgrammableSwitch` («Кнопка»). Если его нет — добавьте виртуальную кнопку к устройству.
2. Примените логику к кнопке.
3. В опциях выберите счётчик для каждого типа нажатия.
4. Сохраните и переактивируйте сценарий (после смены счётчиков подписка переоформляется только при переактивации/рестарте).
5. Привяжите сцены хаба к событиям кнопки штатными средствами.

## Ограничения и замечания

- `ProgrammableSwitchEvent` — событийная характеристика: повторное одинаковое нажатие в хабе регистрируется как новое событие.
- Берётся первый сервис `StatelessProgrammableSwitch` устройства. Многокнопочные устройства (`ServiceLabelIndex`) не поддерживаются.
- Подписка на счётчики оформляется по типу `C_PulseMeter`/`C_PulseCount` (глобально), фильтрация — по выбранным UUID.

## История изменений

### 1.0
- Первая версия: счётчики импульсов → событие HomeKit-кнопки; инициализация базы, игнор сброса, отсечение self-change, ошибка при дубликате счётчика.
```

- [ ] **Step 3: Прогнать все тесты сценария**

Run: `./sim run PulseCounterButton`
Expected: PASS — все блоки зелёные.

- [ ] **Step 4: Сгенерировать манифест публикации**

Run: `./publish PulseCounterButton --init`
Expected: создан `PulseCounterButton/publish.json`. Проверить, что `files[0].source` = `source/PulseCounterButton.js`, есть запись версии.

- [ ] **Step 5: Проверить публикацию без записи на диск**

Run: `./publish PulseCounterButton --check`
Expected: проверки проходят (синтаксис/ES5, метаданные `info`, запись changelog `1.0` в README, тесты). Если проверка ругается на несоответствие — устранить (обычно: запись в README «История изменений», версия в `info`).

- [ ] **Step 6: Полный прогон всех сценариев (регресс)**

Run: `./sim run`
Expected: PASS — новый сценарий не сломал остальные.

- [ ] **Step 7: Commit**

```bash
git add PulseCounterButton/.tests/preset.json PulseCounterButton/README.md PulseCounterButton/publish.json
git commit -m "docs(pulse-counter-button): README, preset и манифест публикации"
```

---

## Self-Review (заполняется автором плана)

**Покрытие спеки:**
- §1.2/§5.4 определение типа → Task 1 (single/double/long).
- §5.2/§5.3 подписка + initPrev → Task 1.
- §5.4 детект инкремента, игнор 0, синхронизация → Task 1 (код) + Task 2 (тесты краевых).
- §6 self-change → Task 3.
- §7 дубликат счётчика → Task 4.
- §4 опции, §3 info → Task 1.
- §10 preset, §12 README, §13 публикация → Task 5.

**Изменения относительно спеки (уточнено при исследовании эмулятора):**
- `eventChar = source` напрямую (источник `trigger` и есть `ProgrammableSwitchEvent`), поэтому кейс «нет характеристики кнопки» невозможен и убран.
- Тесты считают события подпиской на кнопку (`ProgrammableSwitchEvent` — `eventLike`), а не по итоговому значению.
Эти уточнения нужно внести в спеку (§5.2, §8, §9, §14) для синхронности.
```
