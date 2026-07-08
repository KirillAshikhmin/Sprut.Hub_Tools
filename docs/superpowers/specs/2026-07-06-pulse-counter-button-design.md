# Кнопка из счётчиков нажатий (`PulseCounterButton`)

**Дата:** 2026-07-06
**Статус:** дизайн согласован (ревизия 2 — подписочная архитектура), ожидает ревизии спеки

## 1. Цель и контекст

Некоторые модули ввода (например, на базе Wirenboard/MQTT) не отдают события кнопки напрямую, а публикуют нажатия **счётчиками импульсов**: у каждого физического входа три отдельных счётчика — «коротких», «длинных» и «двойных» нажатий. При нажатии соответствующий счётчик увеличивается на 1.

Сценарий превращает эти счётчики в стандартное HomeKit-событие кнопки. Он **применяется к кнопке** (`StatelessProgrammableSwitch`) того же устройства, при старте оформляет подписку на счётчики импульсов, а в колбэке подписки по инкременту счётчика определяет тип нажатия и записывает соответствующий код в характеристику `ProgrammableSwitchEvent`. Дальше к этой стандартной кнопке штатными средствами хаба привязываются любые сцены.

### 1.1. Устройство-источник

Три сервиса `C_PulseMeter` (по одному на тип нажатия), у каждого — одна характеристика `C_PulseCount`:

| Сервис (имя из шаблона)  | Тип сервиса    | Характеристика | Тип нажатия |
|--------------------------|----------------|----------------|-------------|
| Счётчик коротких нажатий | `C_PulseMeter` | `C_PulseCount` | одиночное   |
| Счётчик двойных нажатий  | `C_PulseMeter` | `C_PulseCount` | двойное     |
| Счётчик длинных нажатий  | `C_PulseMeter` | `C_PulseCount` | долгое      |

Все три сервиса **одного типа** и различаются только именем/топиком, поэтому по типу их не отличить — соответствие «счётчик → тип нажатия» задаёт пользователь в опциях (см. §4).

### 1.2. Целевые типы (подтверждено по `sh_types.json`)

- Сервис `HS.StatelessProgrammableSwitch` («Кнопка»), required-характеристика `HC.ProgrammableSwitchEvent`, формат `Integer`, `validValues`:
  - `0` = `SINGLE_PRESS` (Одиночное)
  - `1` = `DOUBLE_PRESS` (Двойное)
  - `2` = `LONG_PRESS` (Долгое)
- Сервис `HS.C_PulseMeter` («Счётчик импульсов»), required-характеристика `HC.C_PulseCount`, формат `Double`, `minValue:0`, `minStep:1`.

`ProgrammableSwitchEvent` помечена `write:false` для HAP, но внутренняя запись из сценария через `setValue` — штатный механизм Sprut.Hub.

## 2. Архитектура: якорь + подписка (канонический паттерн репозитория)

Ключевое решение (образец — `ExternalTempSensor`): сценарий **привязывается к целевому устройству** (кнопке), а на источники (счётчики) подписывается программно.

- **Якорь.** `sourceServices: [HS.StatelessProgrammableSwitch]`, `sourceCharacteristics: [HC.ProgrammableSwitchEvent]`. При `onStart:true` `trigger` вызывается на старте хаба и при каждом сохранении сценария — это точка, где оформляется подписка.
- **Подписка.** В `trigger` через `Hub.subscribeWithCondition("", "", [HS.C_PulseMeter], [HC.C_PulseCount], handler)` подписываемся на изменения счётчиков. Вся конвертация «инкремент → событие» живёт в `handler`. Подписка оформляется один раз — защита флагом `variables.subscribed` (как `ExternalTempSensor`).
- **Защита от self-change.** `trigger` подписан на `ProgrammableSwitchEvent`, а сценарий сам в неё пишет — значит собственная запись вызовет `trigger` повторно (эхо). Первой строкой `trigger` стоит `if (isSelfChanged(context)) return;` (см. §6). Флаг `subscribed` даёт вторую линию защиты от повторной подписки.

Чистый **логический** сценарий, без глобальной части.

```
PulseCounterButton/
  README.md
  source/PulseCounterButton.js          # логический сценарий (единственный файл кода)
  .tests/config.json                    # logic-only
  .tests/pulse-counter-button.test.js   # тесты от спецификации
  .tests/preset.json                    # фикстура для ручной проверки в веб-UI
  publish.json                          # создаётся `./publish PulseCounterButton --init`
  PulseCounterButton.json               # экспорт, генерируется `./publish` — вручную не трогаем
```

## 3. Блок `info`

```js
info = {
  name: "Кнопка из счётчиков нажатий",
  description: "Превращает счётчики импульсов (короткие/двойные/долгие нажатия) в событие HomeKit-кнопки ProgrammableSwitchEvent того же устройства.",
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.StatelessProgrammableSwitch],
  sourceCharacteristics: [HC.ProgrammableSwitchEvent],
  options: { /* см. §4 */ },
  variables: {
    subscribed: false,       // подписка на счётчики уже оформлена
    subscription: undefined, // Task подписки
    prev: {}                 // UUID сервиса-счётчика → последнее известное значение
  }
}
```

## 4. Опции

Три опции-списка (`formType:"list"`) «тип нажатия → счётчик» + отладка. Списки наполняет helper `getPulseCounters()` (аналог шаблонного `getServicesByServiceAndCharacteristicType([HS.C_PulseMeter],[HC.C_PulseCount])`); первый пункт — «Не выбрано» (`value:""`). Значение опции — **UUID сервиса** (`"acc.svc"`).

| Опция           | Тип                          | Назначение                              |
|-----------------|------------------------------|-----------------------------------------|
| `singleCounter` | список `C_PulseMeter`        | счётчик одиночных нажатий → событие `0`  |
| `doubleCounter` | список `C_PulseMeter`        | счётчик двойных нажатий → событие `1`    |
| `longCounter`   | список `C_PulseMeter`        | счётчик долгих нажатий → событие `2`     |
| `debug`         | `Boolean`, по умолч. `false` | подробный лог в консоль сценария         |

Невыбранный тип (`""`) просто не обрабатывается.

## 5. Логика

### 5.1. `trigger(source, value, variables, options, context)`

```
if (isSelfChanged(context)) return;                    // эхо нашей же записи в кнопку — §6
if (hasDuplicateCounters(options)) {                   // ошибка конфигурации — §7
  console.error("Кнопка из счётчиков нажатий: один счётчик выбран для нескольких типов — исправьте настройки. События не отправляются.");
  return;
}
setupSubscription(source, variables, options);         // идемпотентно (флаг subscribed)
```

### 5.2. `setupSubscription(anchorSource, variables, options)`

```
if (variables.subscribed) return;
eventChar = anchorSource;   // source триггера и есть ProgrammableSwitchEvent кнопки

initPrev(variables, options);                          // §5.3 — до подписки
variables.subscription = Hub.subscribeWithCondition(
  "", "", [HS.C_PulseMeter], [HC.C_PulseCount],
  function (counterSource, counterValue) {
    handleCounter(counterSource, counterValue, variables, options, eventChar);
  });
variables.subscribed = true;
```

`eventChar`, `variables`, `options` захватываются в замыкание колбэка (как `ExternalTempSensor`).

### 5.3. `initPrev(variables, options)` — инициализация базы без событий

Так как якорь — кнопка, а не счётчики, колбэк на старте **не** вызывается; чтобы не потерять первое нажатие после старта, читаем текущие значения выбранных счётчиков напрямую:

```
for uuid in [singleCounter, doubleCounter, longCounter] (непустые):
  svc = Hub.getAccessory(uuid.split('.')[0]).getService(uuid.split('.')[1])   // как ExternalTempSensor
  n = Number(svc.getCharacteristic(HC.C_PulseCount).getValue())
  variables.prev[uuid] = isNaN(n) ? 0 : n
```

### 5.4. `handleCounter(counterSource, value, variables, options, eventChar)` — колбэк

```
key  = counterSource.getService().getUUID()
code = resolveEventCode(key, options)         // 0/1/2, либо -1 если счётчик не выбран
if (code < 0) return                           // чужой/невыбранный счётчик (при debug — лог)

v    = Number(value)
prev = variables.prev[key]

if v === 0            → variables.prev[key] = 0;  return   // СБРОС (перезапуск устройства) — не нажатие
if prev === undefined → variables.prev[key] = v;  return   // счётчик впервые виден — не нажатие
if v > prev          → variables.prev[key] = v;  eventChar.setValue(code)   // положительный инкремент = одно нажатие
else                 → variables.prev[key] = v            // равно/уменьшилось (не 0) — синхронизируем, без события
```

`resolveEventCode`: `key === singleCounter → 0`, `=== doubleCounter → 1`, `=== longCounter → 2`, иначе `-1`. Одно событие на положительный инкремент, независимо от величины скачка.

## 6. Определение self-change (эталон `PassthroughSwitch`)

Формат `context`: цепочка `"LOGIC[id] <- C[uuid тип] <- LOGIC[id] <- …"`, разделитель `" <- "`.

```
const CONTEXT = { DELIMITER: " <- ", LOGIC_PREFIX: "LOGIC", CHARACTERISTIC_PREFIX: "C", MIN_ELEMENTS: 3 };

isSelfChanged(context):
  if (!context) return false
  elements = context.toString().split(CONTEXT.DELIMITER)
  return isSameLogicEcho(elements) || hasMultipleLogicInChain(context.toString(), elements)

isSameLogicEcho(elements):        // LOGIC <- C <- тот же LOGIC
  elements.length >= 3 && elements[0].startsWith("LOGIC") && elements[1].startsWith("C") && elements[0] === elements[2]

hasMultipleLogicInChain(str, elements):  // один и тот же LOGIC-префикс встречается в цепочке ≥2 раз
  найти последний элемент с префиксом "LOGIC", взять его LOGIC[id]-токен, посчитать вхождения в строке; >=2 → self
```

`HUB[OnStart]` — **не** self: старт хаба должен пройти дальше и оформить подписку. Отдельная проверка старта не требуется (флаг `subscribed` делает `setupSubscription` идемпотентным).

## 7. Ошибка конфигурации: один счётчик на несколько типов

Выбор одного счётчика для двух/трёх типов — **некорректная конфигурация**. В начале `trigger` (после self-check) `hasDuplicateCounters(options)` сравнивает непустые `singleCounter`/`doubleCounter`/`longCounter`; при совпадении — `console.error(...)` и `return` **до** оформления подписки. Подписка не создаётся, события не отправляются. Так как `onStart:true`, ошибка всплывает в логе сразу при сохранении сценария с неверной настройкой.

## 8. Краевые случаи

| Ситуация                                         | Поведение                                                             |
|--------------------------------------------------|----------------------------------------------------------------------|
| Старт хаба / сохранение                          | `trigger` оформляет подписку (идемпотентно); `initPrev` наполняет базу |
| Собственная запись в кнопку (эхо)                | `isSelfChanged` → ранний `return`, повторной подписки нет            |
| Первое нажатие после старта                      | `prev` уже инициализирован в `initPrev` → инкремент даёт событие      |
| Сброс счётчика в `0` (перезапуск устройства)     | игнор, `prev` синхронизируется в `0`, события нет                    |
| Скачок счётчика на `+2`                           | одно событие на положительный инкремент                             |
| Значение равно предыдущему / уменьшилось (не 0)   | `prev` синхронизируется, события нет                                 |
| Счётчик впервые виден в колбэке (`prev` пуст)     | запоминаем значение, события нет                                     |
| Счётчик не выбран / чужой сервис                  | тихий `return` (при `debug` — лог)                                   |
| Один счётчик на 2+ типа                           | ошибка конфигурации: `console.error` + `return`, подписки нет (§7)   |

## 9. Тесты (`.tests/pulse-counter-button.test.js`)

Тесты — **от этой спецификации**. Модель прогона: `scenario.run({source: <ProgrammableSwitchEvent кнопки>, value, variables, options, context})` оформляет подписку; затем `setValue` на характеристике счётчика доезжает до колбэка через `HubMock`/`SubscriptionManager`. Так как `ProgrammableSwitchEvent` — `eventLike` (каждая запись = событие), эмиссии считаются независимой тестовой подпиской на кнопку (`hub.subscribeWithCondition('','',[HS.StatelessProgrammableSwitch],[HC.ProgrammableSwitchEvent], cb)`), а не по итоговому значению. Каждый счётчик — отдельный аксессуар, его UUID — `counterAcc.getService(HS.C_PulseMeter).getUUID()`.

- **Оформление подписки в `trigger`**
  - после `trigger` (onStart) изменение выбранного счётчика `+1` → на кнопке появляется соответствующий код
- **Определение типа нажатия**
  - инкремент `singleCounter` → `ProgrammableSwitchEvent == 0`; `doubleCounter` → `1`; `longCounter` → `2`
- **Игнор сброса (0)**
  - `prev` ненулевой, приходит `0` → события нет, `prev == 0`; следующий `0 → 1` → событие
- **Инициализация базы (первое нажатие не теряется)**
  - счётчик стартует со значения `5` (задано до `trigger`); первый инкремент до `6` → событие; повторный приход `5` (равно инициализированному) → события нет
- **Детект инкремента**
  - `prev=5,value=6`→событие; `=5,=5`→нет; `=5,=4`(уменьшение,не 0)→нет,`prev=4`; скачок `=5,=8`→одно событие
- **self-change**
  - `trigger` с self-`context` (`LOGIC[x] <- C[..] <- LOGIC[x]`) до подписки → подписка не оформлена → изменение счётчика события не даёт
  - self-`context` после штатной подписки → не ломает: одиночный инкремент по-прежнему даёт ровно одно событие
- **Ошибка конфигурации: дубликат счётчика**
  - `singleCounter == doubleCounter` → `logs.byLevel('error')` непуст, подписка не оформлена, событий нет
- **Невыбранный / чужой счётчик**
  - изменение счётчика, не совпавшего ни с одной опцией → события нет

## 10. `.tests/preset.json`

Один аксессуар `target:true` — кнопочный модуль (его характеристика `ProgrammableSwitchEvent` — якорь `trigger`):

- `AccessoryInformation` (`C_Online: true`)
- 3× `C_PulseMeter` с именами «Счётчик коротких/двойных/длинных нажатий», каждый `C_PulseCount: 0`
- `StatelessProgrammableSwitch` («Кнопка»), `ProgrammableSwitchEvent: 0` (нейтральное стартовое значение для UI)

Опции `singleCounter/doubleCounter/longCounter` — пустые (`""`): в веб-UI пользователь выбирает счётчики и переактивирует сценарий; `debug:true`. Описание preset поясняет порядок.

## 11. `.tests/config.json`

```json
{
  "$schema": "../../ScenarioSimulator/schemas/config.schema.json",
  "name": "PulseCounterButton",
  "scenario": { "globals": [], "logic": ["../source/PulseCounterButton.js"] },
  "tests": ["*.test.js"],
  "execution": { "timeoutMs": 5000, "strictMode": "off", "encoding": "utf-8", "isolation": "per-test" }
}
```

## 12. README (обязательные разделы по CLAUDE.md)

- Назначение и поведение (счётчики → событие кнопки; якорь на кнопке, подписка на счётчики).
- Опции: `singleCounter`, `doubleCounter`, `longCounter`, `debug`.
- Переменные: `subscribed`, `subscription`, `prev` (сбрасываются при рестарте хаба; `trigger` на `onStart` восстанавливает).
- Настройка в UI: устройство должно иметь сервис `StatelessProgrammableSwitch`; логика применяется к кнопке; выбрать три счётчика в опциях; **после смены счётчиков сохранить/переактивировать сценарий** (колбэк держит опции на момент подписки — см. §14); привязать сцены к кнопке.
- Ограничения и замечания: событийная характеристика (§14); сброс в 0 игнорируется; дубликат счётчика — ошибка; берётся первый `StatelessProgrammableSwitch` аксессуара.
- История изменений: запись для версии `1.0` (нужна для `./publish`).

## 13. Публикация

`publish.json` — `./publish PulseCounterButton --init`, затем `./publish PulseCounterButton`. Версия changelog — из `info.version` (`1.0`).

## 14. Риски и замечания

- **Опции в замыкании колбэка.** Колбэк захватывает `options` на момент подписки. После смены счётчиков нужно сохранить/переактивировать сценарий, чтобы подписка переоформилась (та же модель, что у `ExternalTempSensor`: «активируйте сценарий заново»). Флаг `subscribed` сбрасывается при рестарте хаба; при простом сохранении надёжнее переактивировать.
- **Глобальность подписки.** `subscribeWithCondition` по типам `C_PulseMeter/C_PulseCount` ловит счётчики всего хаба; фильтрация — по выбранным UUID в колбэке (как фильтр по `options.sensor` в `ExternalTempSensor`).
- **Событийная характеристика.** `ProgrammableSwitchEvent` помечена `eventLike` и в хабе, и в эмуляторе: повторная запись того же кода (`0 → 0`) — новое событие, а не дубликат. Цикла с self-эхо нет благодаря `isSelfChanged` (§6); тесты считают число эмиссий подпиской на кнопку (§9). Сброс характеристики между событиями не нужен.
- **Несколько кнопок на аксессуаре.** Берём первый `StatelessProgrammableSwitch`. Многокнопочные устройства (`ServiceLabelIndex`) — вне рамок v1.

## 15. Вне рамок (YAGNI)

- Выбор целевой кнопки в опциях — кнопка на том же аксессуаре, находится через якорь.
- Настраиваемое число событий на скачок счётчика — всегда одно.
- Глобальная часть сценария.
- Поддержка `ServiceLabelIndex` / нескольких кнопок на устройстве.
