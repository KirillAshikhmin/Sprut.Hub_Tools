# Границы и правила сборки `SunInWindow`

## Правила проекта, которые не выводятся из кода

- **Движок — Nashorn, ES5 + точечный ES6.** Разрешены стрелочные функции, шаблонные
  строки, `const`/`let`, `Map`/`Set`, `for...of`. **Запрещены** классы, `import`/`export`,
  деструктуризация, промисы, `async`/`await`, spread/rest, `Object.assign`.
- **Проверка синтаксиса настоящим Nashorn** (компиляция без запуска):
  `/opt/homebrew/opt/openjdk@11/bin/jjs -scripting --language=es6 -co <файл>`.
  Флага `-c` у `jjs` нет.
- **Java-методы в Nashorn нельзя вызывать через `.apply`/`.call`** — массив передаётся
  прямо в varargs.
- **Тесты:** `cd ScenarioSimulator && bun run cli run SunInWindow --root ..`.
  Полный прогон перед коммитом: `bun run cli run --root ..`.
- **Публикация:** `./publish SunInWindow` из корня репозитория. `.json` сценария
  **генерируется**, вручную не редактируется.
- **Язык.** README и комментарии в коде — русские. `name`/`desc` в опциях — `{ru, en}`.
- **Эталон структуры** — `DayNight/`. Эталон подписок, логирования и защиты таймеров
  поколениями — `MotionLightAutomation/` и `ExhaustFanAutomation/`. Сами эталоны не править.
- **Ничего вне папки `SunInWindow/`** не трогать. В репозитории есть незакоммиченные
  изменения от других работ — они не наши.
- **Недостающая зависимость — это `BLOCKED`,** а не повод её ставить.

## Границы, решённые в спецификации

Деление внутри одного файла `SunInWindow/source/SunInWindow.js`: функции верхнего уровня,
чистые там, где могут быть чистыми (астрономия и геометрия не трогают ни хаб, ни
`variables`).

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Астрономия | положением Солнца на момент времени | `calculateSunPosition(date, latitude, longitude) -> {altitude, azimuth}` | юлианскую дату, склонение, прямое восхождение, часовой угол |
| Геометрия окна | правилом «солнце в окне» | `isSunInWindow(sunPosition, windowAzimuth, minAltitude, maxDeviation) -> boolean` | нормализацию углов и круговую разность азимутов |
| Настройки | приведением опций к рабочим значениям | `resolveSettings(options) -> settings`, `validateSettings(settings) -> null \| "ошибка"` | сентинел −1 и соответствие румба градусам |
| Состояние | записью флага и имени сервиса | `applyState(source, options, sunIsInWindow)` | инверсию, сравнение с текущим значением, переименование |
| Планировщик | периодическим пересчётом | `scheduleRecalculation(source, variables, options)` | поколения таймеров в `global["SIW_gen_" + uuid]` и отмену старых |

## Шов для тестов — ровно один

`scenario.run({source, value, variables, options, context})` плюс виртуальное время
симулятора (`time.set('2026-06-21T09:00:00Z')`, `time.advance('5m')`,
`time.runAllTimers()`).

Всё поведение, включая формулу, проверяется снаружи: ставим дату, координаты и направление
окна — смотрим значение характеристики. **Внутренние функции тестами не дёргаются** — иначе
тест начнёт повторять реализацию вместо спецификации.

## Что построено (заполняется по мере сборки)

## Из таска 01 — сценарий

- Файл: `SunInWindow/source/SunInWindow.js`. `info`: name «☀️ Свет в окне», version 1.0,
  author @BOOMikru, `onStart: true`, `sourceServices: [HS.Switch, HS.Outlet, HS.Lightbulb]`,
  `sourceCharacteristics: [HC.On]` (после таска 04). `compute` не реализован — только `trigger`.
- Опции (после `desc`/`html`): `latitude`, `longitude`, `windowDirection` (list 0/45/…/315,
  деф. 180), `windowAzimuth` (−1…360, деф. −1; любая пустая форма = не задан, D02), `minSunAltitude` (0…90, деф. 5),
  `maxAzimuthDeviation` (1…90, деф. 90), `updateInterval` (1…60, деф. 1),
  `allowManualControl`, `changeServiceName`, `invert`.
- `variables`: `initialState`, `lastState`, `generation`, `generationKey`, `timerTask`.
- Сигнатуры: `calculateSunPosition(date, latitude, longitude) -> {altitude, azimuth}` ·
  `isSunInWindow(sunPosition, windowAzimuth, minAltitude, maxDeviation) -> boolean` ·
  `resolveSettings(options) -> {latitude, longitude, exactAzimuth, azimuthIsSet, windowAzimuth,
  minAltitude, maxDeviation, updateIntervalMs}` · `validateSettings(settings) -> null|string` ·
  `applyState(source, options, sunIsInWindow)` · `isBlankOption(value) -> boolean` ·
  `scheduleRecalculation(source, variables, options, settings)`.
- Поколения таймеров: `global["SIW_gen_" + UUID сервиса]`.
- Префикс лога: `"☀️ Свет в окне. "`. Имена сервиса: «Солнце в окне» / «Солнца в окне нет».
- Проверяемые параметры — `OPTION_LIMITS {LATITUDE, LONGITUDE, WINDOW_AZIMUTH, MIN_ALTITUDE,
  MAX_DEVIATION}`; интервал пересчёта не проверяется, а зажимается по `UPDATE_INTERVAL_MINUTES`.
- Текст ошибки валидации: «Неверное значение параметра «Имя»: X. Допустимый диапазон a…b.
  Сценарий ничего не делает до следующего сохранения или перезапуска хаба.»
- Файлы стенда: `SunInWindow/.tests/config.json`, `SunInWindow/.tests/preset.json`,
  `SunInWindow/.tests/smoke.test.js` (8 тестов, смоук — не покрытие).

## Из таска 02 — спецификация поведения и покрытие

- `SunInWindow/.tests/SPEC.md` (406 строк) — поведенческая спецификация, §1…§18:
  §1 состав · §2 триггеры и `onStart` · §3 таблица всех десяти опций · §4 астрономия
  (§4.1 система отсчёта и допуск 0,5°, §4.2 уравнение времени, §4.3 опоры О1–О4 и D01,
  §4.4 проверенные моменты) · §5 правило «солнце в окне» и круговая разность ·
  §6 румбы, приоритет точного азимута, сентинел −1 · §7 два порога · §8 сезонность (G01) ·
  §9 полярный день и ночь · §10 запись и `invert` · §11 имя сервиса · §12 ручное управление ·
  §13 таймер, зажим интервала, поколения, несколько окон · §14 невалидные настройки ·
  §15 логирование · §16 вне рамок · §17 неспецифицированные зоны · §18 соглашения стенда.
- `SunInWindow/.tests/blackbox-logic.test.js` (1238 строк, 33 describe / 139 it) — покрытие
  от SPEC.md, каждый `it` со ссылкой на раздел. Прогон сценария: 149 passed.
- `scenario.info()` — второй законный шов; наблюдаемые поля перечислены в §18.1 SPEC.md.
- §18.8: чужая строка `context` проверяется (тесты подают `'WEB[admin]_123'`, `'APP[iphone]'`),
  своя — нет: идентификатор экземпляра снаружи неизвестен.
- §17.3 (после перенумерации в таске 04; ранее §17.5): точное равенство на границе порога
  недостижимо подбором момента времени, проверяются значения с запасом ≥0,5°.

## Из таска 03 — README и пакет

- `SunInWindow/README.md` (34 КБ): Важные замечания · Зачем это нужно · Пошаговая инструкция
  (3 шага) · Параметры (сводная таблица, разбор всех десяти опций, «Два порога вместе») ·
  Примеры использования (4, включая шторы при жаре и блики на экране) · Как это работает
  (точность, журнал, таблица «что происходит при неверных настройках») · Известные
  ограничения (8) · Чего сценарий не делает (10 строк) · История изменений 1.0.
- `SunInWindow/publish.json` — однофайловый LOGIC-пакет: `source/SunInWindow.js` →
  `SunInWindow.json`, `primary: true`, поле `archive` не ставится.
- `SunInWindow/SunInWindow.json` — **генерируется** командой `./publish SunInWindow`,
  руками не редактируется.

## Из таска 04 — закрытие находок ревью

- `HC.Active` убран из `info.sourceCharacteristics` и из веток кода: у `Switch`, `Outlet`
  и `Lightbulb` такой характеристики нет.
- `windowDirection` валидируется списком восьми румбов: значение вне списка даёт строку
  ошибки с именем параметра и полный останов, как у остальных проверяемых параметров.
- Потеря защиты поколениями при недоступном `global` пишет одну строку `error` за запуск
  (`reportGenerationProtectionLost`); решение «продолжать работу» не менялось.
- Перехватчик записи в тестах один — `spyCalls(target, method)`, аргументы уходят через
  `apply` без потерь.
- `SPEC.md` §17 перенумерован: прежние §17.2 и §17.3 убраны (правило D02 и валидация румба
  их специфицировали), §17.4…§17.9 стали §17.2…§17.7.
