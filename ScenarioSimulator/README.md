# ScenarioSimulator

Эмулятор среды **Sprut.Hub** и тест-раннер для сценариев из этого репозитория.

Позволяет писать и прогонять тесты сценариев **вне хаба** — на macOS/Linux/Windows, в CI и через веб-интерфейс. Сами сценарии остаются чистыми: тесты переезжают в подпапку `.tests/` рядом с кодом.

## Содержание

1. [Зачем это](#зачем-это)
2. [Установка](#установка)
3. [Быстрый старт](#быстрый-старт)
4. [Структура `.tests/` сценария](#структура-tests-сценария)
5. [Формат `config.json`](#формат-configjson)
6. [DSL тестов](#dsl-тестов)
   - [Юнит-тесты глобальных функций](#юнит-тесты-глобальных-функций)
   - [Интеграционные тесты логических сценариев](#интеграционные-тесты-логических-сценариев)
   - [Смесь глобальных и логических](#смесь-глобальных-и-логических)
7. [Контекст теста — полное API](#контекст-теста--полное-api)
8. [CLI-команды](#cli-команды)
9. [Публикация сценария (`publish`)](#публикация-сценария-publish)
10. [Веб-интерфейс](#веб-интерфейс)
11. [Эмулируемый API хаба](#эмулируемый-api-хаба)
12. [AST-валидатор](#ast-валидатор)
13. [Архитектура](#архитектура)
14. [Ограничения](#ограничения-и-заметки)
15. [Verification](#verification)

---

## Зачем это

Раньше тесты сценариев Sprut.Hub жили **внутри сценария** (см. `UnitTest/source/UnitTests.js` и блок `runMasterSwitchTests` в `TurnOffAllLight/source/MasterSwitch.js`):

- 1700+ строк прод-кода смешано с тестами под флагом `isDeveloping`.
- Прогон только при сохранении сценария в хабе — нет CI, нет watch, нет быстрого фидбэка.
- Каждое падение требует залезть в хаб и смотреть UI-логи.

ScenarioSimulator решает это: тесты — отдельные файлы, движок эмулирует **весь** API хаба (Hub, Accessory, Service, Characteristic, Cron, таймеры, подписки, Notify, HttpClient, Mail, SSH), сценарий загружается в изолированный `node:vm`, время виртуальное и контролируется тестом.

## Установка

Нужен **Bun** (1.1+) или Node.js 22+.

```bash
cd ScenarioSimulator
bun install
bun run generate    # генерирует HC/HS/charMetadata из ScenarioTemplate/spruthub.js и sh_types.json
```

## Быстрый старт

```bash
# Запуск всех сценариев, у которых есть .tests/
bun run cli run --root ..

# Конкретный сценарий
bun run cli run TurnOffAllLight --root ..

# Фильтр по имени теста
bun run cli run MotionLightAutomation --grep "lux" --root ..

# Веб-интерфейс на http://localhost:5173
bun run cli serve --port 5173 --root ..
```

Создать структуру `.tests/` для нового сценария:

```bash
bun run cli init MyScenario --root ..
```

## Структура `.tests/` сценария

```
MotionLightAutomation/
  source/MotionLightAutomation.js           # код сценария — не меняется
  .tests/
    config.json                             # конфиг
    motion-light.test.js                    # тесты
    fixtures/                               # опционально: JSON-фикстуры
```

`.tests/` — скрытая папка (точка в начале), поэтому файловые менеджеры её прячут, а экспорт сценария в Sprut.Hub её не подхватит.

## Формат `config.json`

```jsonc
{
  "$schema": "../../ScenarioSimulator/schemas/config.schema.json",
  "name": "MotionLightAutomation",
  "scenario": {
    "globals": [],                                    // глобальные сценарии (порядок важен)
    "logic":   ["../source/MotionLightAutomation.js"] // логические сценарии
  },
  "tests": ["*.test.js"],                             // glob внутри .tests/
  "fixtures": { "accessories": "fixtures/house.json" },
  "execution": {
    "timeoutMs": 5000,
    "strictMode": "off",        // off | es5 | es5+  (Nashorn-набор)
    "encoding": "utf-8",
    "isolation": "per-test"     // per-file | per-test — пересоздавать хаб для каждого теста
  }
}
```

**Порядок `globals` критичен.** Файлы грузятся последовательно в общий vm-контекст. Для `CircadianLight` это `Параметры → Конвертер → Глобальный`.

**`strictMode`**:
- `off` — AST-валидатор отключён, любые ES2020 фичи допустимы (полезно если код сценария уже использует `const` верхнего уровня и т.п. — Nashorn такое поддерживает).
- `es5+` — Nashorn-набор: блокируются `class`, `import/export`, `async/await`, деструктуризация, `?.`-цепочки, `...spread`. Разрешены стрелочные функции, `let/const`, `for...of`, шаблонные строки, `Map`/`Set`.

## DSL тестов

Синтаксис в стиле Vitest/Mocha. Тесты пишутся **без `import`** — `describe`, `it`, `expect`, `HC`, `HS` доступны как глобальные имена (как принято в Mocha/Jest).

Доступные конструкции:

- `describe(name, fn)`, вложенный
- `it(name, fn)` (alias `test`), `it.skip`, `it.only`, `it.todo`
- `beforeAll(fn)`, `beforeEach(fn)`, `afterEach(fn)`, `afterAll(fn)`
- `expect(value)` — матчеры см. ниже

### Юнит-тесты глобальных функций

Подходят для проверки чистых утилит из глобального сценария (парсеры, валидаторы, расчёты). Для них не нужно создавать аксессуары — достаточно достать функцию из vm-контекста и вызвать напрямую.

Пример из `TurnOffAllLight/.tests/master-switch.test.js`:

```js
describe('TurnOffAllLight — parseAccessoriesToObject', () => {
  let fns;
  beforeEach(({ scenario, hub }) => {
    hub.addRoom({ name: 'Тест' });
    // Достаём объект с внутренними функциями глобального сценария
    fns = scenario.call('masterSwitchFunctionsFactory', []);
  });

  it('агрегирует сервисы одного аксессуара', () => {
    const r = fns.parseAccessoriesToObject([130.13, 130.15]);
    expect(r['130'].size).toBe(2);
  });

  it('null → пустой объект', () => {
    expect(Object.keys(fns.parseAccessoriesToObject(null)).length).toBe(0);
  });
});
```

Способы достать функцию сценария:
- `scenario.call(name, args)` — вызвать с аргументами, вернуть результат.
- `scenario.global(name)` — получить ссылку на функцию из контекста.
- `scenario.info()` — прочитать мета-блок `info` (например, `sourceCharacteristics`).

### Интеграционные тесты логических сценариев

Здесь симулятор создаёт **полное окружение**: комнаты, аксессуары, сервисы, характеристики; вызывает `trigger()` сценария, манипулирует характеристиками через `setValue()` — подписки сценария срабатывают как в реальном хабе; продвигает виртуальное время через `time.advance()`.

Пример из `MotionLightAutomation/.tests/motion-light.test.js`:

```js
describe('MotionLightAutomation — авто-включение по датчику', () => {
  it('датчик движения включает лампу', (ctx) => {
    const { hub, scenario } = ctx;

    // 1. Создаём окружение
    const lamp = hub.addAccessory({
      id: 10, name: 'Лампа', room: 'Кухня',
      services: [{
        type: HS.Lightbulb,
        characteristics: [{ type: HC.On, value: false }],
      }],
    });
    const motion = hub.addAccessory({
      id: 20, name: 'Датчик движения', room: 'Кухня',
      services: [{
        type: HS.MotionSensor,
        characteristics: [{ type: HC.MotionDetected, value: false }],
      }],
    });

    // 2. Готовим опции и начальные variables (как делает хаб при загрузке сценария)
    const lampOnChar = lamp.char(HS.Lightbulb, HC.On);
    const motionService = motion.getService(HS.MotionSensor);
    const options = {
      motion1: motionService.getUUID(),
      offDelaySeconds: 30,
      maxAmbientLux: 50,
      ignoreManualWithin5sAfterSensorOn: true,
      gateAutoSwitchInvert: false,
      noAutoOffWhenManualOn: false,
      manualHoldSafetyOffDelayMinutes: 240,
    };
    const vars = {
      cachedLightService: undefined,
      externalSubscribed: false,
      manualHold: false,
    };

    // 3. Вызываем trigger() — сценарий создаст подписку на датчик
    scenario.run({ source: lampOnChar, value: false, variables: vars, options });
    expect(lampOnChar.getValue()).toBe(false);

    // 4. Триггерим датчик — SubscriptionManager симулятора синхронно вызывает handler
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);

    // 5. Проверяем, что лампа включилась
    expect(lampOnChar.getValue()).toBe(true);
  });

  it('после потери движения лампа гаснет через offDelaySeconds', (ctx) => {
    // ... те же шаги создания окружения ...
    scenario.run({ source: lampOnChar, value: false, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(true);
    scenario.run({ source: lampOnChar, value: true, variables: vars, options });
    motion.char(HS.MotionSensor, HC.MotionDetected).setValue(false);

    ctx.time.advance('29s');
    expect(lampOnChar.getValue()).toBe(true);
    ctx.time.advance('1s');
    expect(lampOnChar.getValue()).toBe(false);
  });
});
```

Что важно понимать:

1. **`scenario.run({ source, value, variables, options, context })`** вызывает `trigger(source, value, variables, options, context)` сценария. `source` обычно — характеристика привязанного устройства, через которое сценарий "увидел" событие. Получают её через `lamp.char(HS.Lightbulb, HC.On)`.

2. **`scenario.compute(...)`** — аналогично для `compute()` функции (если сценарий её определяет — обычно нет).

3. **Подписки сценария** через `Hub.subscribeWithCondition(...)` создаются при первом `scenario.run(...)`. После этого любой `setValue()` на характеристике, попадающей под фильтр, **синхронно** вызывает handler сценария — это симулирует реальное поведение хаба.

4. **`variables`** — это **тот же объект**, который сценарий мутирует. После `scenario.run(...)` можно читать `vars.manualHold`, `vars.lastSensorAutoOnAt` и т.д. Если хотите изолированный test — создавайте свежий объект.

5. **Время** — виртуальное. `setTimeout(fn, 5000)` зарегистрирует таймер в `TimeController`, но **никогда не сработает сам**. Тест должен явно продвинуть время через `ctx.time.advance('5s')` или `ctx.time.runAllTimers()`.

6. **`setValueSilent(v)`** на характеристике — устанавливает значение, **не** триггеря подписки. Полезно для начальной настройки фикстур, когда не нужно симулировать событие.

### Смесь глобальных и логических

Когда логический сценарий использует функции из глобального (например, `Battery/Logic.js` вызывает `global.batteryReport()` из `Battery/Global.js`), просто указываем оба файла в config — они загрузятся в общий vm-контекст:

```jsonc
{
  "scenario": {
    "globals": ["../source/Global.js"],
    "logic":   ["../source/Logic.js"]
  }
}
```

`GlobalVariables` и `global` — общий объект для всех сценариев в тесте; функции глобального сценария доступны логическому через `global.foo()` так же как в реальном хабе.

### Матчеры `expect`

`.toBe`, `.toEqual`, `.toBeTruthy`/`Falsy`, `.toBeNull`/`Defined`/`Undefined`, `.toContain`, `.toHaveLength`, `.toBeGreaterThan(OrEqual)`, `.toBeLessThan(OrEqual)`, `.toThrow`, `.toMatchObject`, префикс `.not`.

## Контекст теста — полное API

Хук и `it`-функция получают первым параметром `ctx`:

```js
it('...', ({ hub, scenario, time, logs, notify, http, mail, ssh, cron, sun, variables, HC, HS }) => { ... });
```

### `hub` — управление аксессуарами и комнатами

```js
hub.addRoom({ name: 'Кухня' });                               // или { id: 7, name: 'Кухня' }
hub.addAccessory({
  id: 42,
  name: 'Лампа',
  room: 'Кухня',
  services: [{
    type: HS.Lightbulb,
    characteristics: [
      { type: HC.On, value: false },
      { type: HC.Brightness, value: 100 },
    ],
  }],
});

hub.acc(42);                                                  // AccessoryMock + .char(hs, hc) шорткат
hub.acc(42).char(HS.Lightbulb, HC.On).getValue();             // CharacteristicMock
hub.acc(42).char(HS.Lightbulb, HC.On).setValue(true);         // триггерит подписки
hub.acc(42).getService(HS.Lightbulb).getUUID();               // "42.13"

hub.raw;                                                      // прямой HubMock для setCharacteristicValue(aid, cid, v)
```

### `scenario` — вызов trigger/compute и доступ к функциям сценария

```js
scenario.run({ source, value, variables, options, context });        // trigger()
scenario.compute({ source, value, variables, options, context });    // compute()
scenario.call('globalFn', [arg1, arg2]);                             // глобальная функция → результат
scenario.global('parseAccessoriesToObject');                         // достать функцию как значение
scenario.info();                                                     // прочитать info-блок (sourceServices, sourceCharacteristics, ...)
```

### `time` — виртуальное время

```js
time.now();                       // текущее ms
time.tick(1000);                  // продвинуть на 1 сек, выполнить все попадающие таймеры
time.advance('5m');               // 'ms' | 's' | 'm' | 'h'
time.set('2024-06-21T06:00:00Z'); // абсолютная установка
time.runAllTimers();              // выполнить все pending таймеры (защита от бесконечных setInterval)
time.pendingCount();              // сколько таймеров висит
```

### `logs` — захват `console.*` сценария

```js
logs.all();                     // массив LogEntry
logs.byLevel('error');
logs.containing('не найдена');
logs.tail(20);
logs.clear();
```

### `notify` — `Notify.text(...).send()`

```js
notify.sent;                    // массив { text, args, recipients, silent, debugText?, image? }
notify.reset();
```

### `http` — `HttpClient`

```js
http.mock.onGet('https://api.example.com/x', { status: 200, body: '{"ok":true}' });
http.mock.onPost(/\/login$/, { status: 401, body: 'denied' });
http.mock.onMethodUrl('PUT', '/devices/42', { status: 204 });
http.mock.default({ status: 200, body: 'OK' });

http.requests;                  // история запросов HttpRequestRecord[]
http.reset();
```

### `mail` — `Mail.send()`

```js
mail.sent;                      // MailRecord[]
mail.reset();
```

### `ssh` — `SSHSession.execute/request`

```js
ssh.mock.onCommand(/reboot/, 'ok');
ssh.mock.onCommand('uptime', 'up 5 days');
ssh.mock.default('');

ssh.calls;                      // SSHCall[] (host, command, kind, result)
ssh.reset();
```

### `cron`

```js
cron.listScheduled();           // активные задачи: { id, kind: 'cron'|'sunrise'|'sunset', spec, nextAtMs }
cron.tickNow();                 // принудительно сработать первую активную задачу
```

### `sun` — расчёт sunrise/sunset

```js
sun.setSunrise('05:30');        // по умолчанию 06:00
sun.setSunset('21:00');         // по умолчанию 18:00
```

### `variables`

```js
variables.global;               // == GlobalVariables в сценарии
variables.local;                // == LocalVariables
variables.resetGlobal();
variables.resetLocal();
```

### `HC`, `HS`

Сгенерированные const-объекты из `ScenarioTemplate/spruthub.js`. Все 263 характеристики и 94 сервиса доступны напрямую: `HC.On`, `HS.MotionSensor`, и т.д.

## CLI-команды

```bash
# Запуск тестов
scenario-sim run [scenario...]                # все или указанные сценарии
scenario-sim run MyScenario --grep "delayed"  # фильтр по полному имени теста
scenario-sim run --bail                       # остановиться после первой ошибки
scenario-sim run --reporter junit-xml --output reports/junit.xml
scenario-sim run --reporter json --silent
scenario-sim run --mirror-console             # дублировать console сценария в stdout

# Просмотр
scenario-sim list                              # дерево сценарий → файл → describe → it
scenario-sim list --json                       # машиночитаемый вывод

# Скелет нового сценария
scenario-sim init MyScenario [--force]         # создаёт .tests/config.json + sample.test.js

# Только AST-валидация (без vm)
scenario-sim validate [scenario...]

# Watch
scenario-sim watch [scenario...]               # перезапуск при изменении source/ или .tests/

# Миграция старых runXxxTests внутри сценариев
scenario-sim migrate <scenario> [--output migrated.test.js] [--force]

# Подготовка к публикации (генерация JSON + все проверки + архив)
scenario-sim publish <scenario> [--check] [--init] [--no-tests] [--allow-missing-changelog]

# Веб-интерфейс
scenario-sim serve --port 5173
```

Опция `--root <dir>` указывает корень репозитория со сценариями. По умолчанию `process.cwd()`.

При запуске из `ScenarioSimulator/` корень — родительская папка:

```bash
bun run cli run TurnOffAllLight --root ..
```

### Репортеры

| Имя | Назначение |
|---|---|
| `pretty` | По умолчанию, цветной TTY, список тестов, captured logs при падении |
| `json` | JSON-массив всех `RunEvent` — для интеграций |
| `junit-xml` | Стандартный JUnit XML для CI (GitLab, Jenkins, GitHub Actions) |
| `tap` | TAP 14 для древних CI |
| `dot` | Минималистичный `.F.S` |

Можно комбинировать: `--reporter pretty --reporter junit-xml --output reports/j.xml`.

## Публикация сценария (`publish`)

Готовит сценарий к публикации: генерирует `.json`-экспорт (для импорта в хаб) из `source/*.js`, прогоняет все проверки и (опционально) собирает zip. **Источник правды — `source/*.js`**, а `.json` генерируются командой (это разворачивает прежнее правило «не редактировать экспорт из UI»).

```bash
# Из корня репозитория (алиас ./publish сам подставляет --root):
./publish VirtualThermostat                  # полный прогон: проверки → генерация JSON → тесты → архив
./publish CircadianLight --check             # только проверки + diff, без записи (синоним --dry-run)
./publish <Имя> --init                        # создать publish.json (если отсутствует) и выйти
./publish <Имя> --no-tests                    # пропустить прогон тестов симулятора
./publish <Имя> --allow-missing-changelog     # отсутствие записи в changelog → предупреждение, не ошибка

# То же из папки симулятора:
bun run cli publish VirtualThermostat --root ..
```

**Модель «сначала все проверки, потом решение».** Команда НЕ прерывается на первой ошибке: выполняются все проверки, результаты собираются. Есть хотя бы одна ошибка — печатается весь список, **на диск ничего не пишется** (код возврата ≠ 0). Ошибок нет — генерируются `.json`, при отсутствии создаётся `publish.json`, собирается архив (код 0). Предупреждения (⚠️) не блокируют.

### Проверки

| Проверка | Уровень | Что ловит |
|---|---|---|
| Синтаксис + неподдерживаемые конструкции | ошибка | ParseError и запрещённые в Nashorn узлы (переиспользуется [AST-валидатор](#ast-валидатор), mode `es5+`) |
| Метаданные `info` | ошибка | у LOGIC есть `name`/`description`/`version`; читаются «по коду» — литералы, `IDENT.ru`, конкатенация строк, константы |
| Changelog | ошибка¹ | в README «История изменений» есть запись под текущую версию |
| Коллизии | ошибка | два исходника пишут в один JSON |
| Сироты | ⚠️ | JSON в папке без привязки в манифесте (возможно, устарел) |
| Дрейф версии | ⚠️ | код изменился, а версию не подняли |
| Тесты | ошибка | прогон тестов сценария (эквивалент `run`); отключается `--no-tests` |

¹ `--allow-missing-changelog` понижает до предупреждения.

### Манифест `publish.json`

Лежит в корне папки сценария, описывает соответствие `source/*.js` → выходной JSON и метаданные глобальных сценариев (у них нет `info`). Если файла нет — **создаётся автоматически** при первом прогоне (проверьте результат; для первого раза удобен `--check`). Полная схема — [`schemas/publish.schema.json`](schemas/publish.schema.json).

```jsonc
{
  "archive": "CircadianLight.zip",         // опц.: имя zip ИЛИ true (=> <Папка>.zip)
  "files": [
    { "source": "source/Логический.js", "primary": true },   // основной LOGIC — его версия идёт в changelog
    { "source": "source/Глобальный.js",
      "json": "Циркадное освещение. Глобальный.json",
      "name": "Циркадное освещение. Глобальный",             // для GLOBAL: имя (у него нет info)
      "archive": true }                                      // включить в zip
  ]
}
```

- **Тип** определяется по содержимому: `info` + `trigger`/`compute` → LOGIC; `update()` без `info` → TEMPLATE; иначе GLOBAL.
- **Имя выходного JSON** (`json`) по умолчанию `<Имя папки>.json`; для многофайловых пакетов указывается явно.
- **Версия для changelog** — из `info.version` логического файла (при нескольких — из помеченного `primary`; при разных версиях без `primary` — ошибка); `publish.json`→`version` — запасной вариант для чисто глобальных папок.
- Для GLOBAL/TEMPLATE `name`/`desc` берутся из манифеста → существующего JSON → имени папки; `onStart` у них не эмитится. Для LOGIC `active`/`sync` при отсутствии в `info` сохраняются из существующего JSON (состояние деплоя).

## Веб-интерфейс

Веб-UI поднимается одной командой и сразу видит все сценарии в корне репозитория — никаких отдельных сборок или dev-серверов.

### Запуск

```bash
cd ScenarioSimulator
bun install                          # один раз, если ещё не делал
bun run generate                     # один раз, генерирует HC/HS/charMetadata
bun run cli serve --port 5173 --root ..
```

Затем открой в браузере: **http://localhost:5173**

Опции `serve`:

| Флаг | Назначение | По умолчанию |
|---|---|---|
| `--port <N>` | TCP-порт сервера | `5173` |
| `--root <dir>` | Корень репозитория со сценариями (где лежат `MotionLightAutomation/`, `Battery/` и т.д.) | `process.cwd()` |

Запуск без CLI — напрямую через сервер:

```bash
bun run packages/cli/bin/scenario-sim.ts serve --port 5173 --root ..
# или
bun run --cwd packages/web src/server.ts
```

Никакого build-step нет: Preact и `htm` подгружаются с CDN (`esm.sh`), HTML/CSS/JS статически отдаются Hono. Любая правка `packages/web/public/*` подхватывается перезагрузкой страницы.

### Что есть в UI

- **Слева** — дерево `сценарий → файл → describe → it` с чекбоксами и индикаторами статуса (зелёный — passed, красный — failed, жёлтый — skipped, мигающий синий — running).
- **Сверху** — фильтр `--grep` (regex по полному имени теста), кнопки **Run all** / **Run selected**, индикатор `SSE ●/○` (подключён или нет).
- **В центре** — переключаемые табы:
  - **Logs** — live-стрим `console.log/info/warn/error` из сценария + кратко падения тестов;
  - **Results** — таблица всех тестов с длительностью.
- **Справа** — детали выбранного теста: error-сообщение, stack, captured logs из сценария за последние 20 строк.
- **Внизу центра** — счётчик `passed / failed / skipped`.

Прогресс прогона стримится через **SSE** (`text/event-stream`). Закрытие вкладки или таймаут вызывает авто-reconnect (стандартное поведение EventSource).

### REST/SSE API

Можно использовать веб-сервер как backend для собственных интеграций (Grafana, CI-плагины, IDE):

```
GET  /api/scenarios                    → список сценариев и тестов (дерево describe/it)
GET  /api/scenarios/:id                → детали одного сценария
GET  /api/scenarios/:id/source         → исходники .js сценария (для просмотра)
POST /api/scenarios/:id/validate       → запустить только AST-валидатор, без vm
POST /api/runs                         → запустить прогон.
                                          Body: { scenarioId?, scenarioIds?, grep?, bail? }
                                          → { runId: string }
GET  /api/runs                         → список запусков (id, status, scenarios, startedAt)
GET  /api/runs/:id                     → текущее состояние + все накопленные события
GET  /api/runs/:id/stream              → SSE-стрим RunEvent (text/event-stream)
```

Пример: запустить TurnOffAllLight через curl и получить runId:

```bash
curl -s -X POST http://localhost:5173/api/runs \
     -H 'Content-Type: application/json' \
     -d '{"scenarioIds": ["TurnOffAllLight"]}'
# {"runId":"329d3499-2166-4be2-a1ef-87fdb75487ff"}
```

Стрим событий:

```bash
curl -N http://localhost:5173/api/runs/329d3499-.../stream
```

### Хостинг на сервере

Сервер стейтлесс — runs хранятся в памяти процесса, при рестарте теряются. Для production-сценария:

- Запускать через `pm2`/`systemd`/Docker, прокидывая `--port` и `--root`.
- Если репозиторий лежит на хост-машине — пробросить через volume в контейнер.
- Для аутентификации поставить reverse-proxy (nginx/Caddy) с basic-auth.

### Минимальный Dockerfile

```dockerfile
FROM oven/bun:1.3
WORKDIR /app
COPY ScenarioSimulator /app/ScenarioSimulator
COPY . /repo
WORKDIR /app/ScenarioSimulator
RUN bun install && bun run generate
EXPOSE 5173
CMD ["bun", "run", "cli", "serve", "--port", "5173", "--root", "/repo"]
```

## Эмулируемый API хаба

Полное соответствие интерфейсам из `ScenarioTemplate/spruthub.js`:

- **`Hub`** — `getAccessory`, `getAccessories`, `getCharacteristic(Value)`, `setCharacteristicValue`, `toggleCharacteristicValue`, `getRooms`, `subscribe`, `subscribeWithCondition` (с фильтром по HS/HC и условием `>`, `<`, `=`, `!=`, `>=`, `<=`, пустая строка = любое значение).
- **`Accessory`, `Service`, `Characteristic`, `Room`** — все методы.
- **`Cron`** — `schedule(spec, handler)` через `cron-parser` (6-полевой формат с секундами), `sunrise(spec, offset, handler)`, `sunset(spec, offset, handler)` — sunrise/sunset с фиксированным временем (настраивается через `sun.setSunrise/setSunset`).
- **Таймеры** — `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `clear` — виртуальные, продвигаются через `time.tick/advance/runAllTimers`.
- **`Notify`** — fluent: `Notify.text(...).image(...).silent(...).to(...).debugText(...).send()` → пишет в `notify.sent`.
- **`HttpClient`** — `GET/POST/PUT/HEAD/DELETE/OPTIONS/PATCH` с fluent `.header/.queryString/.path/.body/.timeout/.send()` → ответы скриптуются через `http.mock`.
- **`Mail`** — fluent build, `.send()` пишет в `mail.sent`.
- **`SSH`/`SSHSession`** — fluent build → `connect()` → `execute(cmd)`/`request(cmd)`. Команды скриптуются через `ssh.mock`.
- **`Utils`** — `uuid()` (детерминированный по seed).
- **`UtilsNet`** — `wakeOnLan`, `getMacAddress`, `ping` (заглушки, настраиваются опциями).
- **`GlobalVariables`/`LocalVariables`/`global`** — обычные объекты, сбрасываются между тестами при `isolation: per-test`.
- **`Date.now()`/`new Date()` без аргументов** — возвращают виртуальное время.

## AST-валидатор

Перед `vm.Script.runInContext` сценарий парсится через `acorn` и проверяется на конструкции, которые **не работают в Nashorn**:

| Запрещено | Причина |
|---|---|
| `class`, `extends` | Nashorn (Java 8) не поддерживает |
| `import`/`export` | модулей нет |
| `async`/`await` | нет промисов |
| `function*` (генераторы) | нет |
| `const { a } = b`, `function f({a})`, `[a, b] = c` | деструктуризация |
| `a?.b`, `a?.()` | optional chaining |
| `[...arr]`, `f(...args)`, `function f(...rest)` | spread/rest |
| `yield`, `new.target` | нет |

Разрешено: стрелочные функции, `let`/`const`, шаблонные строки (`` `${x}` ``), `for...of`, `Map`, `Set`, классические `function` объявления.

При нарушении тест падает на этапе валидации с указанием `line:col:nodeType:message` — до vm.

Настраивается в `config.json` → `execution.strictMode`: `off` (без проверки), `es5` или `es5+` (полный набор).

## Архитектура

Bun-monorepo внутри `ScenarioSimulator/`:

```
packages/
  core/          @scenario-simulator/core — эмулятор API + Sandbox + Validator + DSL + Runner + Reporters
    src/
      runtime/   Sandbox.ts, Validator.ts, ContextBuilder.ts
      mocks/     HubMock, AccessoryMock, ServiceMock, CharacteristicMock, RoomMock,
                 NotifyMock, HttpClientMock, MailMock, SSHMock, UtilsMock, ConsoleMock, TaskMock
      time/      TimeController, TimerScheduler, CronScheduler, SunCalculator, DateProxy
      subscriptions/  SubscriptionManager, MatchEngine
      state/     AccessoryRegistry, FixtureLoader, VariableScope, IdAllocator
      metadata/  CharMetadataRegistry, ValueCoercer
      capture/   LogCapture, NotifyCapture, HttpRecorder, MailRecorder, SSHRecorder
      matchers/  HttpMatcher, SSHMatcher
      config/    ConfigLoader, schema.ts (zod)
      dsl/       Collector, expect, types
      runner/    Runner, Executor, TestRunFactory, TestRunContext, TestFileLoader, TestFileFinder
      reporters/ pretty, json, junitXml, tap, dot
      migration/ Migrator
      generated/ HC.ts, HS.ts, charMetadata.ts   ← bun run generate

  cli/           @scenario-simulator/cli — citty + commands
    bin/scenario-sim.ts
    src/commands/  run, list, init, validate, watch, migrate, serve

  web/           @scenario-simulator/web — Hono + Preact SPA
    src/server.ts, routes/{scenarios, run}, runs/RunRegistry
    public/{index.html, app.js, app.css}    ← без bundler, esm.sh CDN
```

## Ограничения и заметки

- **Sandbox через `node:vm`** — это V8, не Nashorn. AST-валидатор отлавливает большинство ES6+ конструкций, но не всю семантику Nashorn (например, специфика `Java.type`). Если сценарий пишется только под этот инструмент — `strictMode: "off"`.
- **`const`/`let`/`function` верхнего уровня** автоматически проброшены через `globalThis` после исполнения, чтобы тесты и другие сценарии могли к ним обращаться (эмуляция шаринга глобалов в Sprut.Hub).
- **`info` блок** сценария — только метаданные. В сценарий через `trigger`/`compute` опции передаются явно (это поведение хаба).
- **Cron** — `cron-parser` (6-полевой формат с секундами). `sunrise/sunset` — стаб с фиксированным временем, его можно сдвигать через `sun.setSunrise/setSunset`.
- **Реентерабельность подписок** — `SubscriptionManager` ограничен глубиной 50 (защита от бесконечных циклов).

## Verification

```bash
cd ScenarioSimulator
bun install && bun run generate

# Юнит-тесты глобального сценария TurnOffAllLight
bun run cli run TurnOffAllLight --root ..

# Интеграционные тесты логического сценария MotionLightAutomation
bun run cli run MotionLightAutomation --root ..

# Всё вместе
bun run cli run --root ..

# JUnit для CI
bun run cli run --reporter junit-xml --output /tmp/junit.xml --root ..

# Web-смок
bun run cli serve --port 5173 --root ..
```

Ожидаемый результат на текущей конфигурации репозитория:
- `TurnOffAllLight` — 7 тестов (юнит для функций `masterSwitchFunctionsFactory`).
- `MotionLightAutomation` — 10 тестов (интеграционные: датчик/lux/gate/wall/manualHold/safetyTimer/info).
- Все 17 проходят за ~100 мс.
