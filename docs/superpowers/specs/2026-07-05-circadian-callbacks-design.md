# Канонический контракт коллбеков + укрепление CircadianLight

- **Дата:** 2026-07-05
- **Статус:** дизайн на согласовании
- **Область:** `ScenarioTemplate/`, `CircadianLight/`, `SwitchCallbackControl/`

## 1. Контекст и проблема

Нужен механизм, которым один сценарий (глобальный, логический или блочный) в
рантайме управляет поведением конкретного экземпляра **логического** сценария,
привязанного к устройству — включить/выключить/сбросить/сменить режим.

Историческая реализация в CircadianLight (в HEAD): логический сценарий на каждую
включённую лампу заводил `setInterval(fn, 1000)`, который **раз в секунду
опрашивал** `GlobalVariables[disableName]` и `GlobalVariables[resetName]`;
дополнительно 5-минутный Cron туда же заглядывал. Выключатель «Отключение
циркадного освещения» просто писал эти `GlobalVariables`. Это и есть «бесконечный
цикл, мониторящий глобальные переменные»: пул-модель с задержкой до 1 c, по
таймеру на каждое устройство, тяжело диагностируемая.

**Важный факт о текущем состоянии рабочего дерева:** миграция на коллбеки уже
выполнена (не закоммичена). Busy-loop `setInterval(...,1000)` и поле
`variables.reset` удалены; `setInterval` остался только для плавного включения
(самозавершается) и Cron раз в 5 минут. Все тесты зелёные
(CircadianLight 87/87, SwitchCallbackControl 29/29). То есть цель этой работы —
**не «мигрировать с нуля», а укрепить и канонизировать** уже введённый
callback-механизм и оформить его как переиспользуемый паттерн.

### Что уже есть

- **CircadianLight (боевой):** реестр `GlobalVariables["CircadianLight_Callbacks"]
  = { handlers: {} }`; логический регистрирует `handlers[uuid] = fn(action, data)`
  (`registerCircadianCallback`); глобальный вызывает
  `circadianLightCallbackFire(service, action, data)`. Действия:
  `disable | enable | reset | changeMode`. Публичные обёртки:
  `resetCircadianLight`, `setCircadianLightDisabled/Enabled`,
  `disable/enable/resetCircadianLightFor`, `enableSunrise/SunsetModeFor`,
  `disableModeFor`.
- **SwitchCallbackControl (эксперимент):** тот же реестр, но handler `fn(state)`
  (голый boolean) и два конфликтующих «режима» — Shared (push через аргумент) и
  Map (pull из `GlobalVariables.switchControlState`), плюс мёртвая функция
  `getSvc`.

### Слабые места (устраняются этой работой)

1. **Хрупкая инициализация на рестарте.** `registerCircadianCallback` молча
   выходит, если глобальный реестр ещё не создан
   (`if (!gv || !gv.handlers) return`). На холодном старте хаба, если
   `onStart`-триггер логического отработает раньше top-level кода глобального,
   handler не зарегистрируется — и внешние `disable/enable/reset/changeMode`
   **молча ничего не делают** до ручного переключения лампы.
2. **Тихий no-op при отсутствии handler'а** — даже без debug-лога; нельзя
   отличить «команда доставлена» от «доставлять некому».
3. **Нет отписки и очистки** «мёртвых» handler'ов удалённых сервисов (живут до
   перезагрузки хаба).
4. **Двусмысленный эксперимент** (Map-режим, `state` вместо `action/data`,
   мёртвый код) — не годится как эталон.

## 2. Цели и не-цели

**Цели**
- Единый **канонический контракт коллбеков**, задокументированный в
  `ScenarioTemplate/`, пригодный для любых будущих сценариев.
- Укрепить CircadianLight по контракту: устранить хрупкий рестарт, добавить
  boolean-результат + debug-при-промахе, `unregister`, автоочистку мёртвых
  сервисов, опциональный `broadcast`.
- Причесать SwitchCallbackControl в **эталонный рабочий пример** контракта.
- Сохранить весь публичный API и поведение CircadianLight (контракт README) и
  зелёные тесты.

**Не-цели (YAGNI)**
- Общий runtime-«bus» между сценариями (каждый сценарий самодостаточен —
  критично для независимой установки с маркетплейса: нет внешней зависимости,
  которую можно забыть поставить).
- Мульти-подписчики на один ключ, приоритеты, очередь/история событий.
- Переработка системы режимов рассвета/заката: их состояние живёт в
  `GlobalVariables["CircadianLight_Mode_<uuid>_active" | "_startTime"]`, а
  `processMode` перечитывает его на каждом 5-минутном тике Cron. Это расчёт по
  времени, а не busy-loop — **не трогаем**.

## 3. Канонический контракт коллбеков (согласовано)

### Модель данных
Реестр в `GlobalVariables["<Имя>_Callbacks"] = { handlers: {} }`, где
`handlers[key] = function(action, data)`. Ключ по конвенции — UUID сервиса
`"aid.sid"` (это включает автоочистку), но допустима любая строка.

### Сигнатура обработчика
`handler(action, data)` — `action` строка-команда, `data` объект-payload
(по умолчанию `{}`). Зрелая форма (не голый boolean).

### Раскол ответственности (ключевое архитектурное решение)
- **Регистрация — inline и самодостаточна в ЛОГИЧЕСКОМ сценарии.** Логический
  НЕ вызывает глобальный для регистрации: иначе на холодном старте (глобальный
  ещё не загружен) регистрация снова стала бы хрупкой. Логический сам создаёт
  реестр и пишет handler. Регистрация обязана быть без внешних зависимостей.
- **Fire / Unregister / Broadcast — в ГЛОБАЛЬНОМ сценарии.** Их вызывают внешние
  сценарии, которые и так зависят от глобального ради прочих функций.

### Эталонная реализация (копипаст-сниппет для ScenarioTemplate)

```js
var CB_GV = "<Имя>_Callbacks";

// Самоинициализация. Вызывать И в top-level глобального, И внутри register (логика).
// Делает регистрацию независимой от порядка загрузки сценариев (фикс рестарта).
function cbInit() {
  if (!GlobalVariables[CB_GV]) GlobalVariables[CB_GV] = { handlers: {} };
  return GlobalVariables[CB_GV];
}

// --- сторона ЛОГИКИ (inline, без обращения к global) ---
function cbRegister(key, handler) { cbInit().handlers[String(key)] = handler; }   // один на ключ, перезапись
function cbUnregister(key) { delete cbInit().handlers[String(key)]; }             // явная отписка

// --- сторона ГЛОБАЛЬНОГО (зовут внешние сценарии) ---
function cbFire(key, action, data) {                 // true, если handler вызван
  var handlers = cbInit().handlers, k = String(key);
  if (isDeadServiceKey(k)) { delete handlers[k]; return false; }   // автоочистка мёртвого сервиса
  var h = handlers[k];
  if (typeof h !== "function") { /* debug: нет обработчика для k */ return false; }
  try { h(action, data || {}); return true; }
  catch (e) { console.error("[<Имя>] callback " + k + ": " + e.message); return false; }
}

function cbBroadcast(action, data) {                 // число вызванных handler'ов
  var handlers = cbInit().handlers, n = 0;
  for (var k in handlers) if (handlers.hasOwnProperty(k) && cbFire(k, action, data)) n++;
  return n;
}

function isDeadServiceKey(key) {                      // "aid.sid" больше не резолвится → мёртвый
  var p = key.split("."); if (p.length < 2) return false;   // не service-uuid — не трогаем
  var a = Hub.getAccessory(parseInt(p[0], 10));
  return !a || !a.getService(parseInt(p[1], 10));
}
```

Свойства: самоинициализация с обеих сторон · один handler на ключ · `fire`
возвращает boolean + debug при промахе · автоочистка мёртвых сервисов и явный
`unregister` · изоляция ошибок try/catch. Ограничения Nashorn соблюдены (только
ES5 + разрешённое подмножество ES6; `const/let/arrow` допустимы, но сниппет
намеренно на `var`/`function` для максимальной наглядности и переносимости).

## 4. §2 — CircadianLight принимает контракт

### `source/Логический.js`
- `registerCircadianCallback`: заменить `if (!gv || !gv.handlers) return;` на
  самоинициализацию:
  ```js
  var gv = GlobalVariables[CIRCADIAN_CALLBACKS_GV];
  if (!gv || !gv.handlers) { gv = GlobalVariables[CIRCADIAN_CALLBACKS_GV] = { handlers: {} }; }
  ```
  Далее — как сейчас: `gv.handlers[serviceUUID] = function (action, data) { ... }`.
  Регистрация остаётся в начале `trigger` (до ранних `return`), значит `onStart`
  перерегистрирует handler после рестарта хаба.
- Логика сама `unregister` не вызывает (у логического нет события «меня
  деактивировали»); очистку мёртвых сервисов делает `fire`.
- Обработчик уже принимает `(action, data)` и покрывает `disable/enable/reset/
  changeMode` — сигнатуру не трогаем.

### `source/Глобальный.js`
- `circadianLightCallbackFire(service, action, data)` (эргономичная обёртка,
  принимает **сервис**) → внутри резолвит `uuid`, добавляем:
  - prune мёртвого сервиса,
  - `return true/false`,
  - `console.info` (только при `Debug`) при промахе.
- Добавить `circadianLightCallbackBroadcast(action, data)` (число вызванных) и
  `circadianLightCallbackUnregister(serviceOrKey)`.
- Top-level самоинициализация реестра остаётся.
- **Публичный API сохранить дословно** — имена
  `resetCircadianLight`, `setCircadianLightDisabled/Enabled`,
  `disable/enable/resetCircadianLightFor`, `enableSunrise/SunsetModeFor`,
  `disableModeFor` не меняются (контракт README).
- Поведение сохранить: `changeMode` включает лампу, если выключена;
  `enable`/`reset` действуют только на включённой лампе.

## 5. §3 — SwitchCallbackControl → эталонный пример

- `source/SwitchCallbackControl.Logic.js`: удалить мёртвый `getSvc`; handler
  перевести с `fn(state)` на канонический `fn(action, data)` (напр. `action`
  `"on" | "off" | "set"` с `data.on`); регистрацию оставить самоинициализирующей.
- `source/SwitchCallbackControl.Global.js`: удалить Map-режим и чтение
  `switchControlState`; ввести канон:
  - `switchCallbackControlFire(key, action, data)` → boolean (+ prune, + debug),
  - `switchCallbackControlBroadcast(action, data)` → count (заменяет прежний
    «Fire() без аргументов» и `switchCallbackControlUpdateAll`),
  - `switchCallbackControlUnregister(key)`.
- `.tests/*.test.js`: переписать 29 тестов под новый контракт (порядок по
  CLAUDE.md: README → тесты → код), добавить кейсы prune/unregister/broadcast/
  самоинициализации.
- `README.md`: переписать как эталонное описание канонического паттерна.

## 6. §4 — Документация паттерна в ScenarioTemplate

- Новая секция в `ScenarioTemplate/README.md` — «Коллбеки: управление логическим
  сценарием в рантайме»: модель данных, раскол «register-в-логике /
  fire-в-глобальном» и **почему** (независимость от порядка загрузки; внешние
  вызыватели зависят от глобального), конвенция ключа = UUID сервиса (включает
  prune), сигнатура `handler(action, data)`, ссылка на SwitchCallbackControl как
  рабочий эталон.
- Копипаст-сниппет (раздел 3 этого документа) поместить в README-секцию; при
  желании продублировать файлом `ScenarioTemplate/snippets/callbacks.js`
  (решается на этапе плана).

## 7. §5 — Тестирование

Тесты пишутся ОТ СПЕЦИФИКАЦИИ (README/этот документ), каждый `describe` — раздел,
каждый `it` — утверждение (CLAUDE.md).

**CircadianLight — логический (`circadian-logic.test.js`):** добавить
- самоинициализация: удалить `variables.global.CircadianLight_Callbacks`, вызвать
  `trigger` → handler зарегистрирован (реестр создан логическим без глобального);
- существующие handler-тесты (`disable/enable/reset`) остаются зелёными.

**CircadianLight — глобальный (`circadian-global.test.js`):** добавить
- `circadianLightCallbackFire` возвращает `true`, когда handler есть; `false` —
  когда нет;
- prune: fire по UUID удалённого сервиса удаляет запись и возвращает `false`;
- `circadianLightCallbackUnregister` убирает handler (последующий fire → `false`);
- `circadianLightCallbackBroadcast` вызывает все handler'ы и возвращает их число.

**SwitchCallbackControl:** переписать под канон (register/fire/unregister/
broadcast, `action/data`, prune, самоинициализация).

Прогон: `bun run cli run <Name> --root ..` после каждой правки; полный
`bun run cli run --root ..` перед завершением.

## 8. README, версия, changelog, публикация

- **CircadianLight README:** секция «Взаимодействие с режимом из сценариев» —
  публичные имена без изменений; добавить упоминание, что управление идёт через
  коллбеки (мгновенно, без опроса до 1 c) и, при экспонировании,
  `broadcast`/`unregister`.
- **Версия и changelog:** логический `info.version = "7.0"`, глобальный
  `VERSION = "7.0"`, но в README «История изменений» максимум 6.0 — запись 7.0
  отсутствует. Добавить запись 7.0, покрывающую переход polling→коллбеки и это
  укрепление (самоинициализация/prune/unregister/broadcast/boolean-результат).
  Публикация проверяет наличие записи для версии из `info.version`.
  **Решение:** оформляем единой записью 7.0 — версия ещё не отражена в changelog
  (де-факто нерелизнута), поэтому переход на коллбеки и это укрепление логично
  описать одним пунктом 7.0, без дробления на 7.1.
- **Публикация:** финальная проверка `./publish CircadianLight --check` и
  `./publish SwitchCallbackControl --check` (генерирует diff JSON без записи);
  `preset.json` у обоих уже есть.

## 9. Риски и их снятие

- **Регрессия публичного контракта CircadianLight** → имена/поведение не меняем;
  87 тестов остаются зелёными как страховка.
- **Порядок загрузки на рестарте** → самоинициализация с обеих сторон делает
  регистрацию и fire независимыми от порядка.
- **Nashorn/ES5** → сниппет и правки в разрешённом подмножестве; проверка
  публикацией (детект неподдерживаемых конструкций).
- **Ключ не в форме `aid.sid`** → `isDeadServiceKey` не трогает такой ключ
  (prune только для распознаваемых UUID сервиса).

## 10. Вне области

Система режимов рассвета/заката (`processMode` + `GlobalVariables[..._Mode_..]`),
плавное включение, логика ручных изменений/связанных ламп, конвертер температуры
в цвет — не меняются.
