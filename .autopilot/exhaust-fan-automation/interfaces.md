# Границы и правила проекта

Файл читается каждым исполнителем ДО того, как он напишет первую строку.
Первая часть — правила проекта, вторая — границы, решённые в спецификации.

## Правила проекта

- **Репозиторий** — коллекция сценариев Sprut.Hub. Корень: `/Users/asihminkirill/GitHub/Sprut.Hub_Tools`.
  Обязательно прочитать `CLAUDE.md` в корне — это правила репозитория, они главнее привычек.
- **Среда исполнения — Nashorn.** Только ES5 плюс: стрелочные функции, шаблонные строки,
  `const`/`let`, `Map`/`Set`, `for...of`. **Запрещено**: классы, `import`/`export`,
  деструктуризация, промисы, `async`/`await`, spread/rest, `Object.assign`.
  Java-методы нельзя вызывать через `.apply`/`.call` — массив передаётся прямо в varargs.
  Проверка синтаксиса настоящим Nashorn: `/opt/homebrew/opt/openjdk@11/bin/jjs -scripting --language=es6 -c <файл>`.
- **Эталон** — `MotionLightAutomation/` (source, README, .tests, publish.json). Структура,
  стиль, приёмы (подписки, поколения подписок, `collectServicesByTypes`, логирование)
  берутся оттуда. Эталон **не изменять**.
- **Язык** — README и комментарии в коде по-русски. `name`/`desc` опций — `{ru, en}`.
- **Тесты**: `cd ScenarioSimulator && bun run cli run ExhaustFanAutomation --root ..`
  Полный прогон перед коммитом: `bun run cli run --root ..`
- **Публикация**: `./publish ExhaustFanAutomation` из корня репозитория.
  `.json` в папке сценария **генерируется**, руками не править.
- **Не трогать**: чужие папки сценариев, `ScenarioSimulator/`, `ScenarioTemplate/`,
  `hub_sources/`, `.autopilot/`. Рабочее дерево грязное — чужие незакоммиченные правки
  не откатывать и не коммитить.
- **Недостающая зависимость — это `BLOCKED`**, а не повод что-то ставить.

## Границы, решённые в спецификации

Сценарий — один файл `ExhaustFanAutomation/source/ExhaustFanAutomation.js`: Nashorn не знает
модулей. «Модули» ниже — группы функций внутри файла.

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `info` + `createOptions()` | метаданными и списком опций | `info`, `createOptions()` | сборку списков устройств `collectServicesByTypes` |
| `output` | записью в привязанный сервис | `readFanOn(svc)`, `writeFanOn(svc, on, options, src)`, `applyFanSpeed(svc, options, src)` | выбор `On`/`Active`, наличие `RotationSpeed` |
| `presence` | накоплением присутствия | `computeOccupancyActive(options)`, `onOccupancyChanged(variables, options, src)` | три таймера и семантику «с допуском» |
| `humidity` | влажностью и порогами | `readHumidity(uuid)`, `computeEffectiveTarget(options)`, `isHumiditySatisfied(options)`, `isHumidityHigh(options)` | контрольный датчик, клампинг, деградацию при мёртвом датчике |
| `decide` | решением вкл/выкл | `tryAutoTurnOn(...)`, `tryAutoTurnOff(...)` | порядок проверок, паузу, минимальное время, блокировки |
| `timers` | таймерами | `armOffTimer`, `clearOffTimer`, `armMaxRunTimer`, `clearMaxRunTimer`, `armCooldown` | идентификаторы в `variables` |
| `manual` | ручными входами и «рубильником» | `isAutomationAllowed(options)`, `handleManualControlEvent(...)` | типы входов и антидребезг |
| `notify` | записью о недосушке в журнал | `logDryTimeoutMessage(options, src, humidity, target)` | формирование текста и состав фактов |
| `log` | отладкой | `logInfo`, `logError` | префикс и ленивые сообщения |

**Шов для тестов ровно один** — DSL ScenarioSimulator: `scenario.info()` и
`scenario.run({source, value, variables, options, context})` плюс виртуальные устройства
пресета. Внутренние функции напрямую не тестируются. Исключение — `collectServicesByTypes`
(в эталоне покрыта отдельным файлом, здесь так же).

**Имена опций — контракт между таском 01 и таском 02.** Они зафиксированы в `spec.md` §10
и меняться не могут: тесты пишутся от спецификации, не от кода.

## Что построили таски

### Из таска 02 — тесты и пресет

- `.tests/config.json` — `name: "ExhaustFanAutomation"`, `logic: ["../source/ExhaustFanAutomation.js"]`,
  `tests: ["*.test.js"]`, `strictMode: "off"`, `isolation: "per-test"`.
- `.tests/SPEC.md` — поведенческая спецификация, разделы §1…§19; §17 «Открытые вопросы»,
  §18 «Неспецифицированные зоны», §19 «Соглашения стенда». Тесты ссылаются на номера разделов.
- `.tests/blackbox-logic.test.js` — 106 тестов от SPEC.md.
- `.tests/preset.json` — аксессуары: 100 вытяжка (`FanBasic` + `RotationSpeed`, `target: true`),
  101 присутствие, 102 движение, 103 контакт, 104 влажность санузла, 105 контрольная влажность,
  106 настенный выключатель, 107 кнопка, 108 рубильник. Все опции §10 с дефолтами (плюс группы-заголовки), без `time`.
- Команда прогона: `cd ScenarioSimulator && bun run cli run ExhaustFanAutomation --root ..`
- После ремонта добавлен `.tests/collect-services.test.js` —
  `scenario.call('collectServicesByTypes', [{motion, humidity, manual, gate}])`; имена групп
  задаёт сам тест, каждый список = заголовок с `value: ""` + элементы `"<acc>.<svc>"`,
  отсортированные по русскому имени, без дублей. `preset.json` — ровно дефолты §10.

### Из таска 01 — исходник сценария

Файл: `ExhaustFanAutomation/source/ExhaustFanAutomation.js` (~1800 строк, единственный).

- `info`: name «💨 Автоматизация вытяжки по присутствию и влажности», `version "1.0"`,
  `author "@BOOMikru"`, `onStart: true`,
  `sourceServices: [HS.Switch, HS.FanBasic, HS.Fan]`, `sourceCharacteristics: [HC.On, HC.Active]`.
- Опции — ровно имена `spec.md` §10, плюс группы-заголовки `groupSensors`, `groupHumidity`,
  `groupSpeed`, `groupManualControl`, `groupAutomationLimits`, `groupManualHold`,
  `groupTimers`, `groupNotify`, `groupOther`.
- `variables`: `cachedFanService`, `externalSubscribed`, `manualHold`, `lastSensorAutoOnAt`,
  `offTimerId`, `offPending`, `runStartedAt`, `maxRunTimerId`, `presenceSinceAt`,
  `onDelayTimerId`, `presenceResetTimerId`, `autoOnLock`, `autoOnLockSilent`,
  `autoOnLockTimerId`, `cooldownUntil`.
- Ключ поколений подписок в `global`: `"EFA_subGen_" + uuid`.
- `collectServicesByTypes({список: [HS...]})` — как в эталоне.
- Проверка Nashorn: `jjs -scripting --language=es6 -co <файл>` (флага `-c` у jjs нет).
- После ремонта: `variables.subGen` = `{ key, gen }` текущего поколения; **все** `setTimeout`
  идут через `scheduleGuardedTimeout(variables, delayMs, callback)` — колбэк устаревшего
  поколения делает no-op, как устаревшая подписка. Стартовый вызов `trigger` отличается
  по `!variables.externalSubscribed` и идёт в отдельную ветку `handleScenarioStart`.
  Все поля сеанса гасятся в `endRun`.
- После таска 04: `setFanOn(variables, options, logSource, on, runOrigin)` и
  `beginRun(variables, options, logSource, runOrigin)` — новый последний параметр
  (`RUN_BY_SENSOR|MANUAL|MANUAL_SWITCH|EXTERNAL|RESTART`, имеет смысл только при включении).
  `variables.subGen` = `{key, gen, timersKey}`; новое поле `variables.cooldownTimerId`;
  новый ключ `global["EFA_timers_" + uuid]` — список задач текущего поколения, которые
  снимаются при смене поколения. По истечении паузы сценарий сам зовёт `tryAutoTurnOn`.

### Из таска 03 — README и публикация

- `ExhaustFanAutomation/README.md` — документация по образцу эталона, три примера настройки.
- `ExhaustFanAutomation/publish.json` — `files[0] = {source: "source/ExhaustFanAutomation.js",
  type: "LOGIC", json: "ExhaustFanAutomation.json", primary: true}`. Поля `archive` нет —
  конвенция репозитория: `archive` ставят только многофайловые пакеты (Battery, CircadianLight,
  TurnOffAllLight), все однофайловые LOGIC, включая эталон, его не ставят.
- `ExhaustFanAutomation/ExhaustFanAutomation.json` — генерируется `./publish`, руками не править.
- Публикация: `./publish ExhaustFanAutomation` (сначала `--check`).
