# Канонический контракт коллбеков + укрепление CircadianLight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Укрепить callback-механизм CircadianLight (самоинициализация реестра, boolean-результат `fire`, автоочистка мёртвых сервисов, `unregister`, `broadcast`), причесать SwitchCallbackControl в эталонный пример и задокументировать канонический паттерн в ScenarioTemplate.

**Architecture:** Реестр коллбеков в `GlobalVariables["<Имя>_Callbacks"] = { handlers: {} }`, `handlers[uuid] = function(action, data)`. Регистрация — inline и самоинициализирующаяся на стороне **логического** сценария (независимость от порядка загрузки); `fire`/`unregister`/`broadcast` — на стороне **глобального** (их зовут внешние сценарии). Ключ по конвенции — UUID сервиса `"aid.sid"`, что включает автоочистку.

**Tech Stack:** Sprut.Hub scenarios (Nashorn), тесты — ScenarioSimulator (`bun run cli run <Name> --root ..`).

## Global Constraints

- **Nashorn ES5 + узкое подмножество ES6.** Разрешено: arrow, шаблонные строки, `const`/`let`, `Map`/`Set`, `for...of`. Запрещено: классы, `import`/`export`, деструктуризация, промисы, `async`/`await`, spread/rest, `Object.assign`.
- **`trigger`/`compute` — синхронные** (без `async`/`await`).
- **README и комментарии — на русском.** Поля `name`/`desc` опций — `{ ru, en }`.
- **Публичный API CircadianLight сохранить дословно** (`resetCircadianLight`, `setCircadianLightDisabled/Enabled`, `disable/enable/resetCircadianLightFor`, `enableSunrise/SunsetModeFor`, `disableModeFor`) — это контракт README.
- **Ключ реестра совпадает с обеих сторон:** `"CircadianLight_Callbacks"` (в логическом константа `CIRCADIAN_CALLBACKS_GV`, в глобальном `CIRCADIAN_LIGHT_CALLBACKS_GV`).
- **Версия CircadianLight — единая запись 7.0** в «Истории изменений» (сейчас `info.version="7.0"`, а в changelog максимум 6.0).
- **Тесты — ОТ СПЕЦИФИКАЦИИ** (`docs/superpowers/specs/2026-07-05-circadian-callbacks-design.md` + README), каждый `describe` — раздел, каждый `it` — утверждение.
- **Прогон тестов:** из каталога `ScenarioSimulator/`: `bun run cli run <Name> --root ..`; полный — `bun run cli run --root ..`.
- **Не трогать:** систему режимов рассвета/заката (`processMode` + `GlobalVariables[..._Mode_..]`), плавное включение, логику ручных изменений/связанных ламп, конвертер температуры.

---

### Task 1: CircadianLight — самоинициализация реестра в логическом (фикс рестарта)

**Files:**
- Modify: `CircadianLight/source/Логический.js` (функция `registerCircadianCallback`, ~строки 414-457)
- Test: `CircadianLight/.tests/circadian-logic.test.js` (добавить `describe` в конец файла)

**Interfaces:**
- Consumes: харнесс `scenario.run({source,value,variables,options,context})`, `variables.global`, хелперы файла теста `makeColorTempLamp(hub,id,on)`, `freshVars()`, `defaultOptions(overrides)`.
- Produces: поведение — после `trigger` в `GlobalVariables.CircadianLight_Callbacks.handlers[uuid]` лежит функция, **даже если реестр не был создан заранее**.

- [ ] **Step 1: Написать падающий тест** — в конец `CircadianLight/.tests/circadian-logic.test.js`:

```js
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
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `bun run cli run CircadianLight --root ..`
Expected: FAIL — после `delete` реестра `registerCircadianCallback` делает ранний `return` (`if (!gv || !gv.handlers) return;`), handler не появляется.

- [ ] **Step 3: Минимальная правка** — в `CircadianLight/source/Логический.js` заменить в начале `registerCircadianCallback`:

```js
// Регистрация коллбека и обработка событий enable / disable / reset (хендлер получает action, data)
function registerCircadianCallback(source, service, variables, options, isDebug) {
  let gv = GlobalVariables[CIRCADIAN_CALLBACKS_GV];
  if (!gv || !gv.handlers) {
    // Самоинициализация: не зависим от порядка загрузки глобального (фикс рестарта).
    gv = GlobalVariables[CIRCADIAN_CALLBACKS_GV] = { handlers: {} };
  }
  const serviceUUID = service.getUUID();

  gv.handlers[serviceUUID] = function (action, data) {
```

(тело обработчика — без изменений).

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `bun run cli run CircadianLight --root ..`
Expected: PASS — все прежние + новый тест (88 tests).

- [ ] **Step 5: Commit**

```bash
git add "CircadianLight/source/Логический.js" "CircadianLight/.tests/circadian-logic.test.js"
git commit -m "fix(circadian): самоинициализация реестра коллбеков в логическом (фикс рестарта)"
```

---

### Task 2: CircadianLight — `fire` возвращает boolean, автоочистка мёртвых сервисов

**Files:**
- Modify: `CircadianLight/source/Глобальный.js` (константа/инициализация ~строки 453-477 и функция `circadianLightCallbackFire`)
- Test: `CircadianLight/.tests/circadian-global.test.js` (добавить `describe` в конец)

**Interfaces:**
- Consumes: `scenario.call(name, args)`, `variables.global`, `hub.addAccessory`, хелпер файла `makeColorTempLamp(hub,id,on,bright,temp)`.
- Produces:
  - `circadianLightCallbacksInit()` → объект реестра `{handlers}` (создаёт при отсутствии).
  - `isCircadianDeadServiceKey(key: string)` → `boolean` (true, если ключ вида `"aid.sid"` не резолвится в живой сервис).
  - `circadianLightCallbackFire(serviceOrKey, action, data)` → `boolean` (true, если handler вызван); принимает объект-сервис **или** строку-UUID; при мёртвом ключе удаляет handler и возвращает false; при отсутствии handler'а пишет `console.info` и возвращает false.

- [ ] **Step 1: Написать падающие тесты** — в конец `CircadianLight/.tests/circadian-global.test.js`:

```js
// ---------------------------------------------------------------------------
// Спека §4/§3: circadianLightCallbackFire возвращает boolean (решает «тихий
// no-op») и делает автоочистку мёртвых сервисов (ключ "aid.sid" больше не
// резолвится → handler удаляется).
// ---------------------------------------------------------------------------

describe('circadianLightCallbackFire — boolean-результат и автоочистка', () => {
  it('возвращает true, когда handler зарегистрирован (живой сервис)', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    variables.global.CircadianLight_Callbacks.handlers[service.getUUID()] = () => {};

    const result = scenario.call('circadianLightCallbackFire', [service, 'reset', {}]);

    expect(result).toBe(true);
  });

  it('возвращает false, когда handler отсутствует (живой сервис, но не зарегистрирован)', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('circadianLightCallbackFire', [service, 'reset', {}]);

    expect(result).toBe(false);
  });

  it('fire по UUID удалённого сервиса удаляет handler и возвращает false (prune)', ({ scenario, variables }) => {
    variables.global.CircadianLight_Callbacks.handlers['99999.13'] = () => {};

    const result = scenario.call('circadianLightCallbackFire', ['99999.13', 'reset', {}]);

    expect(result).toBe(false);
    expect(variables.global.CircadianLight_Callbacks.handlers['99999.13']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `bun run cli run CircadianLight --root ..`
Expected: FAIL — `circadianLightCallbackFire` сейчас ничего не возвращает (`undefined`), prune отсутствует.

- [ ] **Step 3: Правка** — в `CircadianLight/source/Глобальный.js` заменить блок инициализации и `circadianLightCallbackFire` (строки ~453-477) на:

```js
// Ключ в GlobalVariables для коллбеков циркадного освещения (handlers по UUID сервиса)
var CIRCADIAN_LIGHT_CALLBACKS_GV = "CircadianLight_Callbacks";

// Самоинициализация реестра. Вызывается и здесь (top-level), и на стороне логического.
function circadianLightCallbacksInit() {
    if (!GlobalVariables[CIRCADIAN_LIGHT_CALLBACKS_GV]) {
        GlobalVariables[CIRCADIAN_LIGHT_CALLBACKS_GV] = { handlers: {} };
    }
    return GlobalVariables[CIRCADIAN_LIGHT_CALLBACKS_GV];
}
circadianLightCallbacksInit();

// Ключ вида "aid.sid" больше не резолвится в живой сервис → мёртвый.
function isCircadianDeadServiceKey(key) {
    var p = String(key).split(".");
    if (p.length < 2) return false; // не service-uuid — не трогаем
    var a = Hub.getAccessory(parseInt(p[0], 10));
    return !a || !a.getService(parseInt(p[1], 10));
}

/**
 * Вызвать коллбек циркадного освещения для сервиса.
 * @param {Object|string} service - сервис лампы (Lightbulb) или строка-UUID "aid.sid"
 * @param {string} action - "enable" | "disable" | "reset" | "changeMode"
 * @param {Object} data - дополнительные данные (по умолчанию {})
 * @returns {boolean} true, если handler был вызван
 */
function circadianLightCallbackFire(service, action, data) {
    var gv = circadianLightCallbacksInit();
    var uuid = (service && typeof service.getUUID === "function") ? service.getUUID() : String(service);
    if (isCircadianDeadServiceKey(uuid)) {
        delete gv.handlers[uuid]; // автоочистка мёртвого сервиса
        return false;
    }
    var handler = gv.handlers[uuid];
    if (typeof handler !== "function") {
        console.info("[CircadianLight] нет активного обработчика для " + uuid + " (action: " + action + ")");
        return false;
    }
    try {
        handler(action, data || {});
        return true;
    } catch (err) {
        console.error("[CircadianLight] callback " + uuid + ": " + err.message);
        return false;
    }
}
```

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `bun run cli run CircadianLight --root ..`
Expected: PASS — прежние тесты (включая «Нет handler — нет выброса ошибки») + 3 новых. `info`-лог при промахе не ломает существующие тесты (они не проверяют отсутствие info).

- [ ] **Step 5: Commit**

```bash
git add "CircadianLight/source/Глобальный.js" "CircadianLight/.tests/circadian-global.test.js"
git commit -m "feat(circadian): fire возвращает boolean + автоочистка мёртвых сервисов"
```

---

### Task 3: CircadianLight — `unregister` и `broadcast`

**Files:**
- Modify: `CircadianLight/source/Глобальный.js` (добавить две функции рядом с `circadianLightCallbackFire`)
- Test: `CircadianLight/.tests/circadian-global.test.js` (добавить `describe` в конец)

**Interfaces:**
- Consumes: `circadianLightCallbacksInit()`, `circadianLightCallbackFire(serviceOrKey, action, data)` (из Task 2).
- Produces:
  - `circadianLightCallbackUnregister(serviceOrKey)` → удаляет handler по UUID.
  - `circadianLightCallbackBroadcast(action, data)` → `number` (сколько handler'ов вызвано; внутри использует `fire`, поэтому мёртвые пруна́тся).

- [ ] **Step 1: Написать падающие тесты** — в конец `CircadianLight/.tests/circadian-global.test.js`:

```js
// ---------------------------------------------------------------------------
// Спека §4/§3: явная отписка unregister и широковещательный broadcast.
// ---------------------------------------------------------------------------

describe('circadianLightCallbackUnregister / circadianLightCallbackBroadcast', () => {
  it('unregister убирает handler — последующий fire возвращает false', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    variables.global.CircadianLight_Callbacks.handlers[service.getUUID()] = () => {};

    scenario.call('circadianLightCallbackUnregister', [service]);

    expect(variables.global.CircadianLight_Callbacks.handlers[service.getUUID()]).toBeUndefined();
    expect(scenario.call('circadianLightCallbackFire', [service, 'reset', {}])).toBe(false);
  });

  it('broadcast вызывает все зарегистрированные handler и возвращает их число', ({ hub, scenario, variables }) => {
    const l1 = makeColorTempLamp(hub, 1, true, 100, 400);
    const l2 = makeColorTempLamp(hub, 2, true, 100, 400);
    const s1 = l1.getService(HS.Lightbulb);
    const s2 = l2.getService(HS.Lightbulb);
    const actions = [];
    variables.global.CircadianLight_Callbacks.handlers[s1.getUUID()] = (a) => actions.push(a);
    variables.global.CircadianLight_Callbacks.handlers[s2.getUUID()] = (a) => actions.push(a);

    const n = scenario.call('circadianLightCallbackBroadcast', ['reset', {}]);

    expect(n).toBe(2);
    expect(actions).toHaveLength(2);
    expect(actions[0]).toBe('reset');
  });
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `bun run cli run CircadianLight --root ..`
Expected: FAIL — функции `circadianLightCallbackUnregister` / `circadianLightCallbackBroadcast` не существуют.

- [ ] **Step 3: Правка** — в `CircadianLight/source/Глобальный.js` сразу после `circadianLightCallbackFire` добавить:

```js
// Явная отписка обработчика.
function circadianLightCallbackUnregister(service) {
    var gv = circadianLightCallbacksInit();
    var uuid = (service && typeof service.getUUID === "function") ? service.getUUID() : String(service);
    delete gv.handlers[uuid];
}

// Широковещательный вызов всех обработчиков. Возвращает число успешно вызванных.
function circadianLightCallbackBroadcast(action, data) {
    var gv = circadianLightCallbacksInit();
    var n = 0;
    for (var k in gv.handlers) {
        if (gv.handlers.hasOwnProperty(k) && circadianLightCallbackFire(k, action, data)) n++;
    }
    return n;
}
```

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `bun run cli run CircadianLight --root ..`
Expected: PASS — прежние + 2 новых теста.

- [ ] **Step 5: Commit**

```bash
git add "CircadianLight/source/Глобальный.js" "CircadianLight/.tests/circadian-global.test.js"
git commit -m "feat(circadian): unregister и broadcast для коллбеков"
```

---

### Task 4: CircadianLight — README (запись changelog 7.0 + примечание про коллбеки)

**Files:**
- Modify: `CircadianLight/README.md` (раздел «Взаимодействие с режимом из сценариев» и «История изменений»)

**Interfaces:**
- Consumes: —
- Produces: запись «## 7.0» в «Истории изменений» (нужна для `./publish` — версия из `info.version`).

- [ ] **Step 1: Добавить примечание** — в разделе «#### Временное отключение циркадного режима» после существующего абзаца добавить:

```markdown
> Начиная с 7.0 управление (отключение/включение/сброс/смена режима) работает через коллбеки: команда доставляется логическому сценарию лампы мгновенно (раньше состояние опрашивалось циклом с задержкой до 1 секунды). Если у лампы не активна логика «Циркадное освещение», команда молча игнорируется (обработчика нет).
```

- [ ] **Step 2: Добавить запись changelog** — сразу под строкой `# История изменений:` вставить перед `## 6.0`:

```markdown
## 7.0
- Управление режимом (отключение/включение/сброс/смена режима рассвет-закат) переведено с опроса глобальных переменных циклом на коллбеки — команды применяются мгновенно, без таймера на каждую лампу.
- Реестр коллбеков самоинициализируется с обеих сторон — управление работает сразу после перезагрузки хаба, независимо от порядка загрузки сценариев.
- Автоочистка обработчиков удалённых ламп, явная отписка и широковещательный вызов; функции управления возвращают признак доставки команды.
```

- [ ] **Step 3: Проверка публикацией (генерация без записи)**

Run: `./publish CircadianLight --check`
Expected: проверки проходят (в т.ч. «наличие записи changelog для 7.0»); печатается diff JSON, на диск ничего не пишется.

- [ ] **Step 4: Commit**

```bash
git add "CircadianLight/README.md"
git commit -m "docs(circadian): запись changelog 7.0 и примечание про коллбеки"
```

---

### Task 5: SwitchCallbackControl — переписать в эталонный пример (атомарно)

Контракт `fire` меняется (`(serviceId, state)` → `(key, action, data)`), поэтому README, оба исходника и оба теста меняются одной задачей — иначе промежуточное состояние красное.

**Files:**
- Modify: `SwitchCallbackControl/README.md`
- Modify: `SwitchCallbackControl/source/SwitchCallbackControl.Global.js`
- Modify: `SwitchCallbackControl/source/SwitchCallbackControl.Logic.js`
- Test: `SwitchCallbackControl/.tests/switch-callback-global.test.js` (переписать)
- Test: `SwitchCallbackControl/.tests/switch-callback-logic.test.js` (переписать)

**Interfaces:**
- Produces (Global):
  - `switchCallbackControlFire(key, action, data)` → boolean; принимает строку-ключ; prune мёртвых `"aid.sid"`.
  - `switchCallbackControlBroadcast(action, data)` → number.
  - `switchCallbackControlUnregister(key)`.
- Produces (Logic): `trigger` регистрирует `handlers[serviceUUID] = function(action, data)`, где `action ∈ {"on","off","toggle","set"}`, для `"set"` берётся `data.on`. Самоинициализация реестра.

- [ ] **Step 1: Переписать README** — `SwitchCallbackControl/README.md`:

````markdown
# 🔘 SwitchCallbackControl — эталонный пример коллбеков

Референс-реализация **канонического контракта коллбеков** (см.
`ScenarioTemplate/README.md` → «Коллбеки: управление логическим сценарием в рантайме»).
Логический сценарий на выключателе регистрирует обработчик; любой другой сценарий
(глобальный, логический, блочный) вызывает его по UUID сервиса.

## Контракт

- **Реестр:** `GlobalVariables["SwitchCallbackControl_Callbacks"] = { handlers: {} }`.
- **Обработчик:** `handler(action, data)`, ключ — UUID сервиса `"aid.sid"`.
- **Действия:** `"on"` | `"off"` | `"toggle"` | `"set"` (с `data.on`).

## API (глобальный)

```javascript
switchCallbackControlFire(serviceUUID, action, data)   // → boolean (вызван ли обработчик)
switchCallbackControlBroadcast(action, data)           // → number (сколько вызвано)
switchCallbackControlUnregister(serviceUUID)           // снять обработчик
```

## Пример

```javascript
// включить конкретный выключатель
global.switchCallbackControlFire("12.3", "on");
// переключить все зарегистрированные
global.switchCallbackControlBroadcast("toggle");
// задать явное состояние
global.switchCallbackControlFire("12.3", "set", { on: false });
```
````

- [ ] **Step 2: Переписать тесты глобального** — заменить содержимое `SwitchCallbackControl/.tests/switch-callback-global.test.js`:

```js
// Юнит-тесты глобального SwitchCallbackControl.Global.js — канонический контракт.
// README §"Контракт" и §"API (глобальный)".

describe('Инициализация реестра и экспорт', () => {
  it('GlobalVariables.SwitchCallbackControl_Callbacks с пустым handlers', ({ variables }) => {
    expect(variables.global.SwitchCallbackControl_Callbacks).toBeDefined();
    expect(variables.global.SwitchCallbackControl_Callbacks.handlers).toBeDefined();
  });

  it('экспортирует fire/broadcast/unregister в global', ({ variables }) => {
    expect(typeof variables.global.switchCallbackControlFire).toBe('function');
    expect(typeof variables.global.switchCallbackControlBroadcast).toBe('function');
    expect(typeof variables.global.switchCallbackControlUnregister).toBe('function');
  });
});

// action/data передаются в handler; fire → boolean. Ключи не в форме "aid.sid"
// (prune их не трогает — p.length < 2), поэтому регистрируем на 'a'/'b'.
describe('switchCallbackControlFire(key, action, data)', () => {
  it('вызывает handler по ключу с (action, data) и возвращает true', ({ scenario, variables }) => {
    const calls = [];
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = (action, data) => calls.push([action, data]);

    const result = scenario.call('switchCallbackControlFire', ['a', 'set', { on: true }]);

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('set');
    expect(calls[0][1].on).toBe(true);
  });

  it('несовпадающий ключ — handler не вызван, false', ({ scenario, variables }) => {
    const calls = [];
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = () => calls.push('a');

    const result = scenario.call('switchCallbackControlFire', ['b', 'on', {}]);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('ошибка в handler логируется и возвращает false', ({ scenario, variables, logs }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = () => { throw new Error('boom'); };

    const result = scenario.call('switchCallbackControlFire', ['a', 'on', {}]);

    expect(result).toBe(false);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('prune: ключ "aid.sid" несуществующего сервиса удаляется, false', ({ scenario, variables }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers['99999.1'] = () => {};

    const result = scenario.call('switchCallbackControlFire', ['99999.1', 'on', {}]);

    expect(result).toBe(false);
    expect(variables.global.SwitchCallbackControl_Callbacks.handlers['99999.1']).toBeUndefined();
  });
});

describe('switchCallbackControlBroadcast(action, data)', () => {
  it('вызывает все handler и возвращает их число', ({ scenario, variables }) => {
    const calls = [];
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = (act) => calls.push(act);
    variables.global.SwitchCallbackControl_Callbacks.handlers['b'] = (act) => calls.push(act);

    const n = scenario.call('switchCallbackControlBroadcast', ['toggle', {}]);

    expect(n).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('пустой реестр → 0, ничего не падает', ({ scenario, variables }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers = {};
    const n = scenario.call('switchCallbackControlBroadcast', ['on', {}]);
    expect(n).toBe(0);
  });
});

describe('switchCallbackControlUnregister(key)', () => {
  it('снимает handler — последующий fire возвращает false', ({ scenario, variables }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = () => {};

    scenario.call('switchCallbackControlUnregister', ['a']);

    expect(variables.global.SwitchCallbackControl_Callbacks.handlers['a']).toBeUndefined();
    expect(scenario.call('switchCallbackControlFire', ['a', 'on', {}])).toBe(false);
  });
});
```

- [ ] **Step 3: Переписать тесты логического** — заменить содержимое `SwitchCallbackControl/.tests/switch-callback-logic.test.js`:

```js
// Интеграционные тесты логического SwitchCallbackControl.Logic.js.
// README: handler(action, data), action ∈ {"on","off","toggle","set"}, ключ — UUID сервиса.
// trigger регистрирует handler в GlobalVariables.SwitchCallbackControl_Callbacks.handlers[uuid].

function makeSwitch(hub, id, initialOn) {
  return hub.addAccessory({
    id, name: 'Тестовый выключатель ' + id, room: 'Тест',
    services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: initialOn === true }] }],
  });
}

describe('info-блок', () => {
  it('sourceServices содержит Switch', ({ scenario }) => {
    expect(scenario.info().sourceServices).toContain(HS.Switch);
  });
  it('sourceCharacteristics содержит On', ({ scenario }) => {
    expect(scenario.info().sourceCharacteristics).toContain(HC.On);
  });
  it('onStart=true', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });
});

describe('trigger: самоинициализирующая регистрация handler', () => {
  it('после trigger в handlers появляется функция по UUID сервиса', ({ hub, scenario, variables }) => {
    const sw = makeSwitch(hub, 100, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();

    scenario.run({ source: onChar, value: false, variables: {}, options: {}, context: '' });

    expect(typeof variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]).toBe('function');
  });

  it('регистрирует даже если реестр ещё не создан (рестарт)', ({ hub, scenario, variables }) => {
    delete variables.global.SwitchCallbackControl_Callbacks;
    const sw = makeSwitch(hub, 100, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();

    scenario.run({ source: onChar, value: false, variables: {}, options: {}, context: '' });

    expect(variables.global.SwitchCallbackControl_Callbacks).toBeDefined();
    expect(typeof variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]).toBe('function');
  });
});

describe('handler(action, data): управляет Switch.On', () => {
  function register(hub, scenario, id, on) {
    const sw = makeSwitch(hub, id, on);
    const onChar = sw.char(HS.Switch, HC.On);
    scenario.run({ source: onChar, value: on, variables: {}, options: {}, context: '' });
    return { sw, onChar, uuid: sw.getService(HS.Switch).getUUID() };
  }

  it('action "on" → On=true', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, false);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('on', {});
    expect(onChar.getValue()).toBe(true);
  });

  it('action "off" → On=false', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, true);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('off', {});
    expect(onChar.getValue()).toBe(false);
  });

  it('action "toggle" инвертирует', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, false);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('toggle', {});
    expect(onChar.getValue()).toBe(true);
  });

  it('action "set" c data.on=false → On=false', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, true);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('set', { on: false });
    expect(onChar.getValue()).toBe(false);
  });

  it('если значение уже целевое — setValue не вызывается (нет лишних событий)', ({ hub, scenario, variables }) => {
    const sw = makeSwitch(hub, 100, true);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();
    scenario.run({ source: onChar, value: true, variables: {}, options: {}, context: '' });
    let setCount = 0;
    const origSet = onChar.setValue.bind(onChar);
    onChar.setValue = (v) => { setCount++; return origSet(v); };

    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('on', {}); // уже true
    expect(setCount).toBe(0);
  });
});

describe('Сквозной: fire по UUID → Switch.On', () => {
  it('fire("uuid","on") включает выключатель', ({ hub, scenario, variables }) => {
    const sw = makeSwitch(hub, 100, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();
    scenario.run({ source: onChar, value: false, variables: {}, options: {}, context: '' });

    const result = scenario.call('switchCallbackControlFire', [uuid, 'on', {}]);

    expect(result).toBe(true);
    expect(onChar.getValue()).toBe(true);
  });

  it('broadcast("toggle") переключает все зарегистрированные', ({ hub, scenario }) => {
    const sw1 = makeSwitch(hub, 100, false);
    const sw2 = makeSwitch(hub, 200, false);
    scenario.run({ source: sw1.char(HS.Switch, HC.On), value: false, variables: {}, options: {}, context: '' });
    scenario.run({ source: sw2.char(HS.Switch, HC.On), value: false, variables: {}, options: {}, context: '' });

    scenario.call('switchCallbackControlBroadcast', ['toggle', {}]);

    expect(sw1.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(sw2.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});
```

- [ ] **Step 4: Прогнать — убедиться, что падает** (тесты есть, кода нет)

Run: `bun run cli run SwitchCallbackControl --root ..`
Expected: FAIL — новые тесты ждут `SwitchCallbackControl_Callbacks`, `switchCallbackControlBroadcast`, `(action, data)`, а исходники ещё старые.

- [ ] **Step 5: Переписать глобальный** — заменить содержимое `SwitchCallbackControl/source/SwitchCallbackControl.Global.js`:

```js
/**
 * Эталонный пример канонического контракта коллбеков (см. ScenarioTemplate/README.md).
 * Реестр: GlobalVariables["SwitchCallbackControl_Callbacks"] = { handlers: {} }.
 * Здесь — сторона fire/broadcast/unregister. Регистрация — в логическом.
 */

var SW_CB_GV = "SwitchCallbackControl_Callbacks";

function switchCallbackControlInit() {
  if (!GlobalVariables[SW_CB_GV]) GlobalVariables[SW_CB_GV] = { handlers: {} };
  return GlobalVariables[SW_CB_GV];
}
switchCallbackControlInit();

// Ключ вида "aid.sid" больше не резолвится в живой сервис → мёртвый.
function switchCallbackControlIsDeadKey(key) {
  var p = String(key).split(".");
  if (p.length < 2) return false;
  var a = Hub.getAccessory(parseInt(p[0], 10));
  return !a || !a.getService(parseInt(p[1], 10));
}

// Вызвать один handler по ключу. Вернуть true, если вызвали.
function switchCallbackControlFire(key, action, data) {
  var gv = switchCallbackControlInit();
  var k = String(key);
  if (switchCallbackControlIsDeadKey(k)) { delete gv.handlers[k]; return false; }
  var h = gv.handlers[k];
  if (typeof h !== "function") return false;
  try {
    h(action, data || {});
    return true;
  } catch (err) {
    console.error("[SwitchCallbackControl] " + k + ": " + err.message);
    return false;
  }
}

// Вызвать все handler. Вернуть число вызванных.
function switchCallbackControlBroadcast(action, data) {
  var gv = switchCallbackControlInit();
  var n = 0;
  for (var k in gv.handlers) {
    if (gv.handlers.hasOwnProperty(k) && switchCallbackControlFire(k, action, data)) n++;
  }
  return n;
}

// Снять обработчик.
function switchCallbackControlUnregister(key) {
  var gv = switchCallbackControlInit();
  delete gv.handlers[String(key)];
}

if (typeof global !== "undefined") {
  global.switchCallbackControlFire = switchCallbackControlFire;
  global.switchCallbackControlBroadcast = switchCallbackControlBroadcast;
  global.switchCallbackControlUnregister = switchCallbackControlUnregister;
}
```

- [ ] **Step 6: Переписать логический** — заменить содержимое `SwitchCallbackControl/source/SwitchCallbackControl.Logic.js`:

```js
/**
 * Эталонный пример: логический сценарий регистрирует handler(action, data).
 * action: "on" | "off" | "toggle" | "set" (data.on). Ключ — UUID сервиса.
 */

var SW_CB_GV = "SwitchCallbackControl_Callbacks";
var DEBUG = true;

info = {
  name: "🔘 Тест коллбеков",
  description: "Эталонный пример канонического контракта коллбеков. handler(action, data), ключ — UUID сервиса.",
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On],
  options: {},
  variables: {}
};

function trigger(source, value, variables, options, context) {
  var service = source.getService();
  var sid = service.getUUID();

  // Самоинициализация реестра — не зависим от порядка загрузки глобального.
  var gv = GlobalVariables[SW_CB_GV];
  if (!gv || !gv.handlers) { gv = GlobalVariables[SW_CB_GV] = { handlers: {} }; }

  gv.handlers[sid] = function (action, data) {
    var on = service.getCharacteristic(HC.On);
    var target;
    if (action === "on") target = true;
    else if (action === "off") target = false;
    else if (action === "toggle") target = !on.getValue();
    else if (action === "set") target = !!(data && data.on);
    else return;
    if (on.getValue() !== target) on.setValue(target);
    if (DEBUG) console.info("[SwitchCallbackControl] " + service.getName() + " ← " + action + " ⇒ " + target);
  };
}
```

- [ ] **Step 7: Прогнать — убедиться, что зелено**

Run: `bun run cli run SwitchCallbackControl --root ..`
Expected: PASS — все переписанные тесты зелёные.

- [ ] **Step 8: Commit**

```bash
git add SwitchCallbackControl/README.md \
  SwitchCallbackControl/source/SwitchCallbackControl.Global.js \
  SwitchCallbackControl/source/SwitchCallbackControl.Logic.js \
  SwitchCallbackControl/.tests/switch-callback-global.test.js \
  SwitchCallbackControl/.tests/switch-callback-logic.test.js
git commit -m "refactor(switch-cb): эталонный пример канонического контракта коллбеков"
```

---

### Task 6: ScenarioTemplate — документация канонического паттерна

**Files:**
- Modify: `ScenarioTemplate/README.md` (добавить новую секцию верхнего уровня в конец)

**Interfaces:**
- Consumes: —
- Produces: секция-эталон, на которую ссылаются README сценариев.

- [ ] **Step 1: Добавить секцию** — в конец `ScenarioTemplate/README.md`:

````markdown
## Коллбеки: управление логическим сценарием в рантайме

Паттерн, которым один сценарий (глобальный, логический или блочный) в рантайме
управляет поведением конкретного экземпляра **логического** сценария,
привязанного к устройству (включить/выключить/сбросить/сменить режим), без опроса
глобальных переменных циклом.

**Модель.** Реестр в `GlobalVariables["<Имя>_Callbacks"] = { handlers: {} }`, где
`handlers[key] = function(action, data)`. `action` — строка-команда, `data` —
объект-payload. Ключ по конвенции — UUID сервиса `"aid.sid"` (это включает
автоочистку мёртвых сервисов), но допустима любая строка.

**Раскол ответственности (важно).**
- **Регистрация — inline и самоинициализирующаяся в ЛОГИЧЕСКОМ сценарии.** Он НЕ
  зовёт глобальный ради регистрации: иначе на холодном старте (глобальный ещё не
  загружен) регистрация снова стала бы зависеть от порядка загрузки. Логический
  сам создаёт реестр и пишет handler — это делает работу устойчивой к рестарту.
- **`fire` / `unregister` / `broadcast` — в ГЛОБАЛЬНОМ сценарии.** Их зовут внешние
  сценарии, которые и так зависят от глобального ради прочих функций.

**Эталонный сниппет** (префикс `cb` заменить именем семейства сценария):

```js
var CB_GV = "<Имя>_Callbacks";

function cbInit() {                                    // самоинициализация: и в top-level глобального, и в register
  if (!GlobalVariables[CB_GV]) GlobalVariables[CB_GV] = { handlers: {} };
  return GlobalVariables[CB_GV];
}

// --- сторона ЛОГИКИ (inline, без обращения к global) ---
function cbRegister(key, handler) { cbInit().handlers[String(key)] = handler; } // один на ключ, перезапись
function cbUnregister(key) { delete cbInit().handlers[String(key)]; }

// --- сторона ГЛОБАЛЬНОГО (зовут внешние сценарии) ---
function cbFire(key, action, data) {                  // true, если handler вызван
  var handlers = cbInit().handlers, k = String(key);
  if (isDeadServiceKey(k)) { delete handlers[k]; return false; }   // автоочистка мёртвого сервиса
  var h = handlers[k];
  if (typeof h !== "function") return false;
  try { h(action, data || {}); return true; }
  catch (e) { console.error("[<Имя>] callback " + k + ": " + e.message); return false; }
}

function cbBroadcast(action, data) {                  // число вызванных
  var handlers = cbInit().handlers, n = 0;
  for (var k in handlers) if (handlers.hasOwnProperty(k) && cbFire(k, action, data)) n++;
  return n;
}

function isDeadServiceKey(key) {                       // "aid.sid" больше не резолвится → мёртвый
  var p = String(key).split("."); if (p.length < 2) return false;   // не service-uuid — не трогаем
  var a = Hub.getAccessory(parseInt(p[0], 10));
  return !a || !a.getService(parseInt(p[1], 10));
}
```

**Рабочий эталон:** сценарий `SwitchCallbackControl/` — минимальная реализация
контракта на выключателе. Живое применение — `CircadianLight/`
(`circadianLightCallbackFire/Unregister/Broadcast`, обработчик — действия
`disable/enable/reset/changeMode`).

**Осознанно НЕ входит (YAGNI):** мульти-подписчики на ключ, приоритеты, история
событий, общий runtime-bus между сценариями (каждый сценарий самодостаточен —
критично для независимой установки).
````

- [ ] **Step 2: Проверка** — убедиться, что markdown корректен (заголовок, вложенные fences ``` внутри блока ````):

Run: `grep -n "## Коллбеки" "ScenarioTemplate/README.md"`
Expected: одна строка с новой секцией.

- [ ] **Step 3: Commit**

```bash
git add "ScenarioTemplate/README.md"
git commit -m "docs(template): канонический контракт коллбеков для сценариев"
```

---

### Task 7: Финальная проверка — полный прогон и публикация

**Files:** —

**Interfaces:** —

- [ ] **Step 1: Полный прогон всех тестов**

Run: `bun run cli run --root ..`
Expected: PASS — все сценарии зелёные (CircadianLight ≥ 92 тестов, SwitchCallbackControl переписанные, прочие без регресса).

- [ ] **Step 2: Проверка публикации CircadianLight**

Run: `./publish CircadianLight --check`
Expected: все проверки проходят (синтаксис/Nashorn, метаданные `info`, changelog 7.0, коллизии JSON, дрейф версии, тесты), diff печатается, запись не выполняется.

- [ ] **Step 3: Проверка публикации SwitchCallbackControl**

Run: `./publish SwitchCallbackControl --check --allow-missing-changelog`
Expected: проверки проходят (это эксперимент-эталон; changelog не обязателен).

- [ ] **Step 4: Финальный обзор diff и коммит-хвост (если остались несобранные правки)**

Run: `git status --porcelain`
Expected: чисто (всё закоммичено по задачам 1-6) — либо добавить оставшееся точечным коммитом.

---

## Self-Review

**Spec coverage** (сверка со спекой `2026-07-05-circadian-callbacks-design.md`):
- §3 Контракт (самоинициализация, `handler(action,data)`, `fire`→bool, prune, unregister, broadcast) → Tasks 1-3 (Circadian) + Task 5 (Switch) + Task 6 (документация). ✓
- §4 CircadianLight (self-init логики, fire/prune/bool/unregister/broadcast в глобальном, публичный API и поведение сохранены) → Tasks 1-3. ✓ (поведение `changeMode`/`enable`/`reset` не меняется — тела обработчика не трогаем; 87 прежних тестов остаются зелёными).
- §5 SwitchCallbackControl (убрать Map/`getSvc`, перейти на `action/data`, unregister/broadcast/prune) → Task 5. ✓
- §6 ScenarioTemplate документация → Task 6. ✓
- §7 Тесты (self-init/restart, boolean, prune, unregister, broadcast) → Tasks 1,2,3,5. ✓
- §8 README/версия/changelog 7.0/публикация → Tasks 4,7. ✓

**Placeholder scan:** плейсхолдеров нет — во всех шагах полный код/команды. ✓

**Type consistency:** имена функций согласованы между задачами: `circadianLightCallbacksInit`, `isCircadianDeadServiceKey`, `circadianLightCallbackFire` (Task 2) используются в Task 3 (`Unregister`/`Broadcast`); `switchCallbackControlInit`/`Fire`/`Broadcast`/`Unregister`/`IsDeadKey` согласованы внутри Task 5; ключи реестра `CircadianLight_Callbacks` / `SwitchCallbackControl_Callbacks` едины. ✓

**Behavior-preservation risk:** существующий тест «Нет handler — нет выброса ошибки» и тесты `setCircadianLightDisabled`/`resetCircadianLight`/`enable/disableCircadianLightFor` остаются зелёными (fire по живому сервису с handler'ом → true; без handler'а → false + info, без throw). ✓
