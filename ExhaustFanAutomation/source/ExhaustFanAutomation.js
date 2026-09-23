/** Подавление ложных кнопка/импульс/контакт сразу после авто-включения по датчику. */
const DEBOUNCE_MANUAL_AFTER_SENSOR_MS = 5000;

/** Сколько слотов датчиков движения / присутствия / открытия создаётся в опциях. */
const MAX_MOTION_SLOTS = 3;
/** Сколько слотов ручного ввода (выключатель, кнопка, импульсы, контакт) создаётся в опциях. */
const MAX_MANUAL_CONTROL_SLOTS = 3;

/** Влажность выше 100 % не бывает — потолок для рабочего порога по контрольному датчику. */
const MAX_HUMIDITY_PERCENT = 100;

// Что считать активностью — одна карта на все места, где это нужно знать:
// опрос текущего состояния, разбор события и фильтр подписки.
const OCCUPANCY_SENSOR_KINDS = [
    {service: HS.MotionSensor, characteristic: HC.MotionDetected, activeValue: true},
    {service: HS.OccupancySensor, characteristic: HC.OccupancyDetected, activeValue: 1},
    {service: HS.ContactSensor, characteristic: HC.ContactSensorState, activeValue: 1}
];

const SECOND_MS = 1000;
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;

// Таймеры сценария: поле в variables и текст в лог при снятии. Завести и снять
// таймер можно только по дескриптору отсюда — имя поля никогда не пишется строкой
// на месте вызова: опечатку в нём не поймали бы ни тесты, ни jjs, а от поля
// onDelay зависит решение «присутствие набрано».
const TIMER_ON_DELAY = {field: "onDelayTimerId", clearedText: "Таймер накопления присутствия сброшен"};
const TIMER_PRESENCE_RESET = {field: "presenceResetTimerId", clearedText: "Сброс накопления присутствия отменён: активность вернулась"};
const TIMER_OFF = {field: "offTimerId", clearedText: "Таймер выключения сброшен"};
const TIMER_MAX_RUN = {field: "maxRunTimerId", clearedText: "Предельный таймер сброшен"};
const TIMER_COOLDOWN = {field: "cooldownTimerId", clearedText: "Отсчёт паузы перед повторным включением сброшен"};
const TIMER_AIRING = {field: "airingTimerId", clearedText: "Таймер проветривания сброшен"};
const TIMER_AIRING_INTERVAL = {field: "airingIntervalTimerId", clearedText: "Отсчёт до периодической вентиляции сброшен"};
const TIMER_AUTO_ON_LOCK = {field: "autoOnLockTimerId", clearedText: "Блокировка авто-включения: отсчёт снятия отменён"};

/** Причины блокировки авто-включения (см. §7 и §8 спецификации). */
const LOCK_MANUAL_OFF = "manualOff";
const LOCK_MAX_RUN = "maxRun";

// Откуда пришло включение: от этого зависят «ручное удержание» (§7) и окно
// антидребезга ручных входов. Разбирает эти значения beginRun — и больше никто.
const RUN_BY_SENSOR = "sensor";
const RUN_BY_MANUAL = "manual";
const RUN_BY_MANUAL_SWITCH = "manualSwitch";
const RUN_BY_EXTERNAL = "external";
const RUN_BY_RESTART = "restart";

// Зачем сценарий включает вытяжку. Проветривание — ОДИН сеанс с двумя поводами
// (§11 и §12): повод различает только тексты в логе, правила выхода у них общие,
// поэтому он и хранится полем, а не вторым набором флагов и таймеров.
const AIRING_AFTER_VISIT = "airingAfterVisit";
const AIRING_PERIODIC = "airingPeriodic";
const ON_BY_PRESENCE = "presence";
const ON_BY_HUMIDITY = "humidity";

/** Ключи общего хранилища global: счётчик поколений и задачи текущего поколения. */
const SUB_GEN_KEY_PREFIX = "EFA_subGen_";
const TIMERS_KEY_PREFIX = "EFA_timers_";

// Значения по умолчанию заданы один раз: их берут и опции в UI, и подстановка
// при пустом значении в options (иначе таймеры и пороги превращались бы в NaN).
const DEFAULT_TARGET_HUMIDITY = 60;
const DEFAULT_REFERENCE_DELTA = 5;
const DEFAULT_HUMIDITY_HIGH_DELTA = 10;
const DEFAULT_NORMAL_SPEED = 50;
const DEFAULT_BOOST_SPEED = 100;
const DEFAULT_ON_DELAY_SECONDS = 120;
const DEFAULT_OFF_DELAY_SECONDS = 300;
const DEFAULT_MIN_RUN_MINUTES = 0;
const DEFAULT_COOLDOWN_MINUTES = 0;
const DEFAULT_MAX_RUN_MINUTES = 180;
const DEFAULT_AIRING_MINUTES = 5;
const DEFAULT_AIRING_INTERVAL_HOURS = 0;

const scenarioName = {
    ru: "💨 Автоматизация вытяжки по присутствию и влажности",
    en: "💨 Presence- and humidity-based exhaust fan automation"
};

const scenarioDescription = {
    ru: "Включает вытяжку, когда присутствие в комнате продержалось дольше заданного времени.\n\n" +
        "Выключает после ухода — но не раньше, чем влажность опустится до рабочего порога.\n\n" +
        "Поддерживает контрольный датчик влажности в сухой комнате, предельное время работы, " +
        "ручные входы и «рубильник» автоматики.\n",
    en: "Turns the exhaust fan on when presence in the room lasts longer than the configured delay.\n\n" +
        "Turns it off after the room is empty — but not before humidity drops to the working threshold.\n\n" +
        "Supports a reference humidity sensor in a dry room, a maximum run time, manual inputs " +
        "and an automation gate switch.\n"
};

info = {
    name: scenarioName.ru,
    description: scenarioDescription.ru,
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Switch, HS.FanBasic, HS.Fan],
    sourceCharacteristics: [HC.On, HC.Active],

    options: createOptions(),

    variables: {
        cachedFanService: undefined,
        scenarioStarted: false,
        externalSubscribed: false,
        subGen: undefined,

        manualHold: false,
        lastSensorAutoOnAt: undefined,

        offTimerId: undefined,
        offPending: false,

        runStartedAt: undefined,
        maxRunTimerId: undefined,

        presenceSinceAt: undefined,
        onDelayTimerId: undefined,
        presenceResetTimerId: undefined,

        autoOnLock: undefined,
        autoOnLockSilent: false,
        autoOnLockTimerId: undefined,

        cooldownUntil: undefined,
        cooldownTimerId: undefined,

        airingRequestedReason: undefined,
        airingRunReason: undefined,
        airingTimerId: undefined,
        airingIntervalTimerId: undefined
    }
};

function trigger(source, value, variables, options, context) {
    try {
        variables.cachedFanService = source.getService();

        const isScenarioStart = consumeScenarioStartFlag(variables);

        ensureExternalSubscription(variables, options);

        if (isSelfChanged(context)) {
            logInfo("Вытяжка изменена самим сценарием — пропуск", source, options.debug);
            return;
        }

        const on = normalizeOnValue(value);

        logInfo(
            () => (isScenarioStart ? "Запуск сценария: вытяжка " : "Вытяжка стала ") + (on ? "ВКЛ" : "ВЫКЛ") +
                " (ручное удержание: " + (variables.manualHold ? "да" : "нет") +
                ", активность датчиков: " + (computeOccupancyActive(options) ? "есть" : "нет") + ")",
            source,
            options.debug
        );

        if (isScenarioStart) {
            handleScenarioStart(variables, options, source, on);
        } else if (on) {
            handleFanTurnedOnExternally(variables, options, source);
        } else {
            handleFanTurnedOffExternally(variables, options, source);
        }
    } catch (e) {
        logError("Ошибка: " + e.message, source);
    }
}

// Запуск сценария (onStart: true) отличать обязательно: у него нет ни «включили
// вручную», ни «выключили вручную», поэтому ни удержание, ни блокировка по нему
// не ставятся. Отдельного признака хаб не даёт — сценарий метит запуск сам,
// собственным полем variables; метку ставит и обработчик подписки, чтобы событие,
// пришедшее раньше стартового вызова, за запуск не сошло.
function consumeScenarioStartFlag(variables) {
    const isStart = variables.scenarioStarted !== true;
    variables.scenarioStarted = true;
    return isStart;
}

// Запуск хаба или пересохранение сценария (R25i, §9): состояние восстанавливается
// по фактическому положению вещей. Реальное время включения хабу неизвестно,
// поэтому включённая вытяжка получает новый сеанс работы.
function handleScenarioStart(variables, options, logSource, on) {
    if (on) {
        beginRun(variables, options, logSource, RUN_BY_RESTART);
        // Режим «Не включать при присутствии» (§11.1): вытяжка не работает,
        // пока человек в помещении, — в том числе и после перезапуска хаба.
        if (isNoRunWhilePresent(options) && computeOccupancyActive(options)) {
            startPresenceAccumulationIfActive(variables, options, logSource);
            turnOffBecausePresent(variables, options, logSource);
            return;
        }
        armOffTimer(variables, options, logSource);
        return;
    }
    startPresenceAccumulationIfActive(variables, options, logSource);
    // Перезапуск хаба обнуляет отсчёт периодической вентиляции (§12.6): variables
    // его не переживают, поэтому первое проветривание случится через «Интервал»
    // после старта. Включённая вытяжка отсчёта не ведёт — он пойдёт от её выключения.
    armAiringIntervalTimer(variables, options, logSource);
}

// Вытяжку включили извне (приложение, сцена, выключатель на самой вытяжке):
// реальное время включения неизвестно, поэтому сеанс работы начинается заново.
function handleFanTurnedOnExternally(variables, options, logSource) {
    releaseAutoOnLock(variables, options, logSource);
    beginRun(variables, options, logSource, RUN_BY_EXTERNAL);
    armOffTimer(variables, options, logSource);
}

function handleFanTurnedOffExternally(variables, options, logSource) {
    logInfo("Вытяжку выключили (вручную или извне) — сбрасываю ручное удержание и таймеры", logSource, options.debug);
    clearOffTimer(variables, options, logSource);
    endRun(variables, options, logSource);
    registerManualOff(variables, options, logSource);
    // Накопление присутствия начинается сразу, иначе первое включение ждало бы
    // следующего события датчика.
    startPresenceAccumulationIfActive(variables, options, logSource);
}

// --- Подписка на внешние устройства -----------------------------------------

function ensureExternalSubscription(variables, options) {
    if (variables.externalSubscribed) {
        return;
    }
    variables.externalSubscribed = true;

    // Защита от «зависших» подписок и таймеров: при пересохранении сценария хаб
    // исполняет скрипт заново со свежим variables, но колбэки прошлого экземпляра
    // живы со старым (предельный таймер — до недели) и продолжают управлять
    // вытяжкой. Поэтому экземпляр метится «поколением» в global (переживает
    // пересохранение): актуально последнее, старые делают no-op. Нет global —
    // нет и защиты.
    const subGen = nextSubscriptionGeneration(variables);
    // В variables поколение кладётся затем, чтобы под ним заводились задачи
    // текущего экземпляра сценария, — не только ради этой подписки.
    variables.subGen = subGen;

    logInfo("Старт: подписка на датчики и ручные входы создана" + (subGen ? " (поколение " + subGen.gen + ")" : ""), variables.cachedFanService, options.debug);

    // Типы датчиков активности берутся из общей карты, а не перечисляются заново.
    const serviceTypes = [HS.HumiditySensor, HS.Switch, HS.StatelessProgrammableSwitch, HS.C_PulseMeter];
    const characteristicTypes = [HC.CurrentRelativeHumidity, HC.On, HC.ProgrammableSwitchEvent, HC.C_PulseCount];
    for (let i = 0; i < OCCUPANCY_SENSOR_KINDS.length; i++) {
        serviceTypes.push(OCCUPANCY_SENSOR_KINDS[i].service);
        characteristicTypes.push(OCCUPANCY_SENSOR_KINDS[i].characteristic);
    }

    Hub.subscribeWithCondition(
        "",
        "",
        serviceTypes,
        characteristicTypes,
        (extSource, extValue) => {
            try {
                if (isStaleSubscription(subGen)) {
                    return;
                }
                handleExternalCharacteristicEvent(extSource, extValue, variables, options);
            } catch (err) {
                logError("Внешняя подписка: " + err.message, extSource);
            }
        }
    );
}

// Увеличивает счётчик поколений в global (ключ привязан к UUID вытяжки) и снимает
// задачи прошлых поколений. null — global недоступен или не сохраняет значения.
function nextSubscriptionGeneration(variables) {
    try {
        if (typeof global === "undefined" || global === null || !variables.cachedFanService) {
            return null;
        }
        const uuid = variables.cachedFanService.getUUID();
        const key = SUB_GEN_KEY_PREFIX + uuid;
        const next = (global[key] | 0) + 1;
        global[key] = next;
        if ((global[key] | 0) !== next) {
            return null;
        }
        const timersKey = TIMERS_KEY_PREFIX + uuid;
        cancelTimersOfPreviousGenerations(timersKey);
        return {key: key, gen: next, timersKey: timersKey};
    } catch (e) {
        return null;
    }
}

// Таймеры прошлого экземпляра снимаются, а не просто игнорируются при
// срабатывании: иначе колбэк дожил бы до своего срока — до недели у предельного.
// Список задач лежит в global: у нового экземпляра variables свежие, и дотянуться
// до старых задач больше нечем.
function cancelTimersOfPreviousGenerations(timersKey) {
    const pending = global[timersKey];
    global[timersKey] = [];
    if (!pending || typeof pending.length !== "number") {
        return;
    }
    for (let i = 0; i < pending.length; i++) {
        try {
            clearTimeout(pending[i]);
        } catch (e) {
            // Задача уже отработала — снимать нечего.
        }
    }
}

// Единственная точка, где сценарий заводит таймер: задача ложится в поле
// variables (оттуда её снимает cancelGuardedTimeout) и в список поколения, чтобы
// следующий экземпляр сценария её снял. Проверка поколения в колбэке — страховка
// на случай, когда global недоступен и снимать задачи некому.
function scheduleGuardedTimeout(variables, timer, delayMs, callback) {
    const subGen = variables.subGen;
    let task = setTimeout(() => {
        forgetTimerTask(subGen, task);
        variables[timer.field] = undefined;
        if (isStaleSubscription(subGen)) {
            return;
        }
        callback();
    }, delayMs);
    variables[timer.field] = task;
    rememberTimerTask(subGen, task);
}

// Единственная точка, где сценарий снимает таймер. Задача уходит и из списка
// поколения, иначе он растёт до перезагрузки хаба.
function cancelGuardedTimeout(variables, options, logSource, timer) {
    const task = variables[timer.field];
    if (!task) {
        return;
    }
    variables[timer.field] = undefined;
    clearTimeout(task);
    forgetTimerTask(variables.subGen, task);
    logInfo(timer.clearedText, logSource, options.debug);
}

function rememberTimerTask(subGen, task) {
    if (!subGen || !task) {
        return;
    }
    try {
        const pending = global[subGen.timersKey];
        if (pending && typeof pending.push === "function") {
            pending.push(task);
            return;
        }
        global[subGen.timersKey] = [task];
    } catch (e) {
        // global недоступен — защита от зависших таймеров просто не работает.
    }
}

function forgetTimerTask(subGen, task) {
    if (!subGen || !task) {
        return;
    }
    try {
        const pending = global[subGen.timersKey];
        if (!pending || typeof pending.indexOf !== "function") {
            return;
        }
        const at = pending.indexOf(task);
        if (at >= 0) {
            pending.splice(at, 1);
        }
    } catch (e) {
        // global недоступен — список задач поколения вести негде.
    }
}

// true, если эта подписка устарела — появилась более новая (сценарий пересохранён).
function isStaleSubscription(subGen) {
    if (!subGen) {
        return false;
    }
    try {
        return (global[subGen.key] | 0) !== subGen.gen;
    } catch (e) {
        return false;
    }
}

function handleExternalCharacteristicEvent(src, val, variables, options) {
    // Сценарий уже работает: следующий trigger — событие, а не запуск.
    variables.scenarioStarted = true;

    const svc = src.getService();
    if (!svc) {
        return;
    }
    const uuid = svc.getUUID();
    const st = svc.getType();
    const ct = src.getType();

    // Событие любого из двух датчиков влажности — комнатного и контрольного —
    // переоценивает рабочий порог, выключение и скорость (§4).
    if (ct === HC.CurrentRelativeHumidity && isHumidityOption(options, uuid)) {
        logInfo(() => "Датчик влажности изменился: " + val + " % (рабочий порог " + computeEffectiveTarget(options) + " %)", src, options.debug);
        onHumidityChanged(variables, options, src);
        return;
    }

    const gateOpt = options.gateAutoSwitch;
    if (gateOpt && gateOpt === uuid && st === HS.Switch && ct === HC.On) {
        logInfo(() => "Выключатель «Разрешение автоматики» стал " + (val === true ? "ВКЛ" : "ВЫКЛ") +
            " (активность датчиков: " + (computeOccupancyActive(options) ? "есть" : "нет") + ")", src, options.debug);
        tryAutoTurnOn(variables, options, src);
        return;
    }

    if (isSlotOption(options, "manualControl", MAX_MANUAL_CONTROL_SLOTS, uuid)) {
        if (isManualInputBlockedByGate(options)) {
            logInfo("Ручной вход проигнорирован: выключатель «Разрешение автоматики» запрещает автоматику (опция «Также не реагировать на ручные входы»)", src, options.debug);
        } else if (handleManualControlEvent(src, uuid, val, st, ct, variables, options)) {
            return;
        }
    }

    if (isSlotOption(options, "motion", MAX_MOTION_SLOTS, uuid)) {
        logInfo("Датчик активности сработал: " + (isSensorActiveValue(st, val, options) ? "активность" : "нет активности"), src, options.debug);
        onOccupancyChanged(variables, options, src);
    }
}

// --- Ручные входы и «рубильник» автоматики (§7) -----------------------------

// Возвращает true, если событие обработано как ручное; false — если тип события
// к ручному управлению не относится и должен идти дальше, в ветку датчиков.
function handleManualControlEvent(src, uuid, val, st, ct, variables, options) {
    if (st === HS.Switch && ct === HC.On) {
        if (val === true) {
            logInfo("Ручной выключатель ВКЛ — включаю вытяжку", src, options.debug);
            manualTurnOn(variables, options, src, true);
        } else if (isAnyManualSwitchOn(options, uuid)) {
            logInfo("Ручной выключатель ВЫКЛ, но другой ручной выключатель ещё ВКЛ — вытяжка остаётся включённой", src, options.debug);
        } else {
            logInfo("Ручной выключатель ВЫКЛ — выключаю вытяжку", src, options.debug);
            manualTurnOff(variables, options, src, true);
        }
        return true;
    }
    if (st === HS.ContactSensor && ct === HC.ContactSensorState && val === 1) {
        logInfo("Ручной контакт «Открытие» — переключаю вытяжку", src, options.debug);
        manualToggleFromButtonOrPulse(variables, options, src);
        return true;
    }
    if (st === HS.StatelessProgrammableSwitch && ct === HC.ProgrammableSwitchEvent && val === 0) {
        logInfo("Ручная кнопка (одиночное нажатие) — переключаю вытяжку", src, options.debug);
        manualToggleFromButtonOrPulse(variables, options, src);
        return true;
    }
    if (st === HS.C_PulseMeter && ct === HC.C_PulseCount && val > 0) {
        logInfo("Ручной импульс — переключаю вытяжку", src, options.debug);
        manualToggleFromButtonOrPulse(variables, options, src);
        return true;
    }
    return false;
}

function shouldSuppressManualButtonOrPulseAfterSensorAuto(variables, options) {
    if (options.ignoreManualWithin5sAfterSensorOn === false) {
        return false;
    }
    const t = variables.lastSensorAutoOnAt;
    if (t === undefined || t === null) {
        return false;
    }
    return Date.now() - t < DEBOUNCE_MANUAL_AFTER_SENSOR_MS;
}

function manualToggleFromButtonOrPulse(variables, options, logSource) {
    if (shouldSuppressManualButtonOrPulseAfterSensorAuto(variables, options)) {
        logInfo("Кнопка/импульс/контакт проигнорированы (антидребезг: " + DEBOUNCE_MANUAL_AFTER_SENSOR_MS + " мс после включения по датчику)", logSource, options.debug);
        return;
    }
    if (!isFanCurrentlyOn(variables)) {
        logInfo("Переключение вручную: вытяжка была выключена — включаю", logSource, options.debug);
        manualTurnOn(variables, options, logSource, false);
        return;
    }
    logInfo("Переключение вручную: вытяжка была включена — выключаю", logSource, options.debug);
    manualTurnOff(variables, options, logSource);
}

// fromManualSwitch — включение пришло от ручного входа типа «Выключатель»;
// чем это отличается для сеанса, разбирает beginRun.
function manualTurnOn(variables, options, logSource, fromManualSwitch) {
    clearOffTimer(variables, options, logSource);
    releaseAutoOnLock(variables, options, logSource);

    setFanOn(variables, options, logSource, true, fromManualSwitch === true ? RUN_BY_MANUAL_SWITCH : RUN_BY_MANUAL);
    armOffTimer(variables, options, logSource);
}

// Для ручного входа типа «Выключатель» Off — штатное состояние автоматики,
// а не «выключили вручную»: блокировка авто-включения не ставится (§7).
function manualTurnOff(variables, options, logSource, fromManualSwitch) {
    clearOffTimer(variables, options, logSource);
    if (fromManualSwitch !== true) {
        registerManualOff(variables, options, logSource);
    }
    setFanOn(variables, options, logSource, false);
}

// Выключили вручную, пока повод работать ещё есть (активность или высокая
// влажность) — блокировка держится до момента, когда вытяжка погасла бы сама.
function registerManualOff(variables, options, logSource) {
    if (options.noAutoOnAfterManualOff !== true) {
        return;
    }
    if (!computeOccupancyActive(options) && isHumiditySatisfied(options)) {
        return;
    }
    setAutoOnLock(variables, options, LOCK_MANUAL_OFF, logSource);
    scheduleAutoOnLockRelease(variables, options, logSource);
}

function isAutomationAllowed(options) {
    const g = options.gateAutoSwitch;
    if (!g || g === "") {
        return true;
    }
    const svc = getServiceFromListOption(options, "gateAutoSwitch");
    if (!svc) {
        return true;
    }
    const ch = getCharacteristicSafe(svc, HC.On);
    if (!ch) {
        return true;
    }
    const gateIsOn = ch.getValue() === true;
    return options.gateAutoSwitchInvert === true ? !gateIsOn : gateIsOn;
}

// Ручные входы игнорируются целиком, только если опция включена И «Разрешение
// автоматики» сейчас запрещает автоматику. Выключатель не выбран — запрета нет.
function isManualInputBlockedByGate(options) {
    return options.gateBlocksManualInputs === true && !isAutomationAllowed(options);
}

// --- Присутствие (§2, §3) ---------------------------------------------------

function occupancySensorKind(serviceType) {
    for (let i = 0; i < OCCUPANCY_SENSOR_KINDS.length; i++) {
        if (OCCUPANCY_SENSOR_KINDS[i].service === serviceType) {
            return OCCUPANCY_SENSOR_KINDS[i];
        }
    }
    return undefined;
}

// Инверсия переворачивает только датчик открытия: занятым считается «Закрыто» (G06).
function isSensorActiveValue(serviceType, value, options) {
    const kind = occupancySensorKind(serviceType);
    if (!kind) {
        return false;
    }
    if (serviceType === HS.ContactSensor && options.contactInverted === true) {
        return value === 0;
    }
    return value === kind.activeValue;
}

function computeOccupancyActive(options) {
    for (let i = 1; i <= MAX_MOTION_SLOTS; i++) {
        const key = "motion" + i;
        if (!options[key] || options[key] === "") {
            continue;
        }
        const svc = getServiceFromListOption(options, key);
        if (!svc) {
            continue;
        }
        const kind = occupancySensorKind(svc.getType());
        if (!kind) {
            continue;
        }
        if (isSensorActiveValue(kind.service, readCharacteristicValue(svc, kind.characteristic), options)) {
            return true;
        }
    }
    return false;
}

function onOccupancyChanged(variables, options, logSource) {
    if (computeOccupancyActive(options)) {
        clearOffTimer(variables, options, logSource);
        cancelGuardedTimeout(variables, options, logSource, TIMER_PRESENCE_RESET);
        restartAutoOnLockSilence(variables, options, logSource);
        startPresenceAccumulationIfActive(variables, options, logSource);
        // Инверсия смысла присутствия (§11): активность — не повод включить,
        // а повод выключить. Накопление при этом всё равно идёт: им решается,
        // засчитан ли визит и полагается ли за него проветривание.
        if (isNoRunWhilePresent(options)) {
            turnOffBecausePresent(variables, options, logSource);
            return;
        }
        tryAutoTurnOn(variables, options, logSource);
        return;
    }

    logInfo("Активности на датчиках нет", logSource, options.debug);
    armPresenceResetTimer(variables, options, logSource);
    scheduleAutoOnLockRelease(variables, options, logSource);

    if (isFanCurrentlyOn(variables)) {
        armOffTimer(variables, options, logSource);
    }
}

function hasPresenceSession(variables) {
    return variables.presenceSinceAt !== undefined && variables.presenceSinceAt !== null;
}

function startPresenceAccumulationIfActive(variables, options, logSource) {
    if (hasPresenceSession(variables)) {
        return;
    }
    if (!computeOccupancyActive(options)) {
        return;
    }
    variables.presenceSinceAt = Date.now();
    logInfo("Начинаю накопление присутствия", logSource, options.debug);
    armOnDelayTimer(variables, options, logSource);
}

// Присутствие «набралось»: сессия идёт, а таймер накопления уже отработал — или
// не заводился вовсе при нулевой «Задержке включения». Факт набранного присутствия
// держит один только таймер: второго счёта времени нет, и расходиться нечему.
function isPresenceReady(variables) {
    return hasPresenceSession(variables) && !variables[TIMER_ON_DELAY.field];
}

function armOnDelayTimer(variables, options, logSource) {
    cancelGuardedTimeout(variables, options, logSource, TIMER_ON_DELAY);
    const sec = numberOption(options, "onDelaySeconds", DEFAULT_ON_DELAY_SECONDS);
    if (sec <= 0) {
        // Накопление не нужно: включение проверяется тут же, в onOccupancyChanged.
        return;
    }
    logInfo("Накопление присутствия: попробую включить через " + sec + " с, если присутствие не прервётся", logSource, options.debug);
    scheduleGuardedTimeout(variables, TIMER_ON_DELAY, sec * SECOND_MS, () => {
        logInfo("Присутствие набрано — пробую включить вытяжку", variables.cachedFanService, options.debug);
        tryAutoTurnOn(variables, options, variables.cachedFanService);
    });
}

// Сессия присутствия сбрасывается не сразу: короткий провал импульсного PIR не
// должен обнулять отсчёт. Сброс наступает, только если активности нет дольше
// «Задержки выключения» (R03.1, R03.2).
function armPresenceResetTimer(variables, options, logSource) {
    if (!hasPresenceSession(variables)) {
        return;
    }
    cancelGuardedTimeout(variables, options, logSource, TIMER_PRESENCE_RESET);
    const sec = numberOption(options, "offDelaySeconds", DEFAULT_OFF_DELAY_SECONDS);
    if (sec <= 0) {
        resetPresenceSession(variables, options, logSource);
        return;
    }
    scheduleGuardedTimeout(variables, TIMER_PRESENCE_RESET, sec * SECOND_MS, () => {
        if (computeOccupancyActive(options)) {
            return;
        }
        resetPresenceSession(variables, options, variables.cachedFanService);
    });
}

function resetPresenceSession(variables, options, logSource) {
    // Момент, когда уход человека подтверждён «Задержкой выключения», и заодно
    // последний момент, когда ещё видно, был ли визит засчитан (§11.2, §11.3).
    const visitCounted = isPresenceReady(variables);
    variables.presenceSinceAt = undefined;
    cancelGuardedTimeout(variables, options, logSource, TIMER_ON_DELAY);
    logInfo("Накопление присутствия обнулено: активности не было " + numberOption(options, "offDelaySeconds", DEFAULT_OFF_DELAY_SECONDS) + " с", logSource, options.debug);
    requestAiringAfterVisit(variables, options, logSource, visitCounted);
}

// --- Режим «Не включать при присутствии» (§11) -------------------------------
// Инверсия логики присутствия: пока человек в помещении, вытяжка молчит, а
// проветривание полагается за уже закончившийся визит. Весь режим живёт за одним
// этим флагом — при выключенной опции ни одна ветка ниже не работает.

function isNoRunWhilePresent(options) {
    return options.noRunWhilePresent === true;
}

// Человек ушёл и уход подтверждён — просим проветрить. Право на проветривание
// даёт только визит, который продержался «Задержку включения» (§11.3); «Время
// проветривания» 0 мин означает, что режим сводится к запрету включаться (§11.7).
function requestAiringAfterVisit(variables, options, logSource, visitCounted) {
    if (!isNoRunWhilePresent(options)) {
        return;
    }
    if (!visitCounted) {
        logInfo("Проветривания после ухода не будет: присутствие не продержалось «Задержку включения»", logSource, options.debug);
        return;
    }
    if (airingRunMinutes(options) <= 0) {
        logInfo("Проветривания после ухода не будет: «Время проветривания» 0 мин", logSource, options.debug);
        return;
    }
    variables.airingRequestedReason = AIRING_AFTER_VISIT;
    logInfo("Человек ушёл — пробую включить проветривание", logSource, options.debug);
    tryAutoTurnOn(variables, options, logSource);
}

// Присутствие вернулось: вытяжка гаснет немедленно — и это сильнее влажности
// и минимального времени работы (§11.1, §11.4). Ручные входы запрет не
// отменяет: он наложен на автоматику, а не на человека (§11.8).
function turnOffBecausePresent(variables, options, logSource) {
    // §11.11: пока «рубильник» запрещает автоматику, режим не делает ничего —
    // ни проветривания, ни принудительного выключения. Иначе вышло бы несимметрично:
    // включить вытяжку сценарий не может, а выключить может. В §7 запрет тоже
    // действует только на новые включения и работающую вытяжку не гасит.
    if (!isAutomationAllowed(options)) {
        logInfo("Режим «Не включать при присутствии» не действует: автоматика запрещена выключателем «Разрешение автоматики»", logSource, options.debug);
        return;
    }
    // Проветривание за прошлый визит больше не нужно: за новый визит будет новое.
    clearAiringRequestOf(variables, AIRING_AFTER_VISIT);
    if (!isFanCurrentlyOn(variables)) {
        return;
    }
    const hold = manualHoldReason(variables, options);
    if (hold) {
        logInfo("Присутствие есть, но вытяжка остаётся включённой: " + hold, logSource, options.debug);
        return;
    }
    logInfo("Присутствие есть — выключаю вытяжку (режим «Не включать при присутствии»)", logSource, options.debug);
    clearOffTimer(variables, options, logSource);
    // Паузу это выключение не заводит (§12.10a2): она защищает от дёрганья на
    // границе порога, а здесь цикл ровно один. Иначе пауза заблокировала бы
    // проветривание за тот самый визит, ради которого режим и нужен.
    setFanOn(variables, options, logSource, false);
}

// --- Проветривание: один сеанс, два повода (§11, §12) -----------------------
// «Включить на «Время проветривания» и выключить» — это один сеанс. Поводов у
// него два: визит закончился (§11.2) и настал срок периодического проветривания
// (§12). Повод лежит в variables.airingRunReason и решает только одно — какими
// словами это назвать в логе. Всё остальное — длительность, безразличие к
// влажности, выход, когда выключить не дали — у обоих поводов общее, ровно потому
// что это один механизм, а не два похожих.

// «Время проветривания» — одно понятие на оба повода: пользователь просил один
// параметр «сколько проветривать», поэтому второй опции на то же самое нет.
function airingRunMinutes(options) {
    return numberOption(options, "airingMinutes", DEFAULT_AIRING_MINUTES);
}

function isAiringReason(reason) {
    return reason === AIRING_AFTER_VISIT || reason === AIRING_PERIODIC;
}

function airingReasonText(reason) {
    return reason === AIRING_AFTER_VISIT ? "проветривание после ухода человека" : "периодическая вентиляция";
}

// true, пока идёт проветривание: его временем распоряжается таймер проветривания,
// а не обычный таймер выключения, и влажность его не продлевает и не обрывает
// (§11.5, §12.8).
function isAiringRunActive(variables) {
    return isAiringReason(variables.airingRunReason);
}

// Единственное место, где гаснет просьба проветрить, каким бы поводом она ни была
// вызвана: её съедает любой начатый сеанс (beginRun).
function clearAiringRequest(variables) {
    variables.airingRequestedReason = undefined;
}

// Снять просьбу, только если она именно этого повода. Вернувшееся присутствие
// отменяет проветривание за визит (§11.1), а периодическое не трогает: при
// человеке оно и так не включится (§12.2), и терять его незачем.
function clearAiringRequestOf(variables, reason) {
    if (variables.airingRequestedReason !== reason) {
        return;
    }
    clearAiringRequest(variables);
}

// Начало сеанса: повод ставится до записи характеристики — от него зависит, кто
// ведёт время этого сеанса, таймер проветривания или таймер выключения.
function startAiringRun(variables, options, logSource, reason) {
    logInfo("Включаю вытяжку: " + airingReasonText(reason), logSource, options.debug);
    variables.airingRunReason = reason;
    setFanOn(variables, options, logSource, true, RUN_BY_SENSOR);
    armAiringRunTimer(variables, options, logSource, reason);
}

// Проветривание длится ровно «Время проветривания». Предельное время работы и
// ручные входы действуют как везде.
function armAiringRunTimer(variables, options, logSource, reason) {
    cancelGuardedTimeout(variables, options, logSource, TIMER_AIRING);
    const minutes = airingRunMinutes(options);
    logInfo("Выключу через " + minutes + " мин — идёт " + airingReasonText(reason), logSource, options.debug);
    scheduleGuardedTimeout(variables, TIMER_AIRING, minutes * MINUTE_MS, () => {
        logInfo("Время проветривания истекло (" + airingReasonText(reason) + ")", variables.cachedFanService, options.debug);
        tryAutoTurnOff(variables, options, variables.cachedFanService, true);
        if (!isFanCurrentlyOn(variables) || variables[TIMER_OFF.field]) {
            // Вытяжка погасла — или выключение сдвинуто «Минимальным временем
            // работы», и доведёт его уже заведённый таймер выключения (§11.12, §12.4).
            return;
        }
        // Выключить не дали: вернулась активность датчиков. Сеанс перестаёт
        // быть проветриванием и дальше живёт по обычным правилам — его закончит
        // обычный таймер выключения, когда активность снова спадёт. Ручное
        // удержание сюда не относится: под ним по §7 бессилен и обычный таймер.
        variables.airingRunReason = undefined;
        armOffTimer(variables, options, variables.cachedFanService);
    });
}

// --- Периодическое проветривание: отсчёт до срока (§12) ---------------------
// Вытяжка давно не работала, активности на датчиках нет — проветрить самой.
// Отсчёт идёт от момента, когда вытяжка последний раз выключилась, и любая её
// работа начинает отсчёт заново (§12.1). «Интервал» 0 ч — механизма нет вовсе:
// таймер не заводится ни при каком событии, и сценарий ведёт себя ровно так же,
// как до появления опции (§12.7).

function armAiringIntervalTimer(variables, options, logSource) {
    cancelGuardedTimeout(variables, options, logSource, TIMER_AIRING_INTERVAL);
    const hours = numberOption(options, "airingIntervalHours", DEFAULT_AIRING_INTERVAL_HOURS);
    if (hours <= 0) {
        return;
    }
    if (airingRunMinutes(options) <= 0) {
        // Проветривать нечего: длительность берётся из «Времени проветривания».
        return;
    }
    logInfo("Периодическое проветривание: проветрю через " + hours + " ч, если вытяжка не заработает раньше", logSource, options.debug);
    scheduleGuardedTimeout(variables, TIMER_AIRING_INTERVAL, hours * HOUR_MS, () => {
        onAiringIntervalReached(variables, options, variables.cachedFanService);
    });
}

// Срок пришёл. Активность датчиков — повода нет (§12.2): случай пропускается,
// а отсчёт начинается заново, чтобы следующая попытка была через «Интервал».
function onAiringIntervalReached(variables, options, logSource) {
    if (isFanCurrentlyOn(variables)) {
        // Вытяжка работает — отсчёт всё равно пойдёт заново от её выключения.
        return;
    }
    if (computeOccupancyActive(options)) {
        logInfo("Периодическое проветривание пропущено: датчики видят активность", logSource, options.debug);
        armAiringIntervalTimer(variables, options, logSource);
        return;
    }
    // Как и проветривание за визит, это может начаться не сразу: паузу,
    // «рубильник» и блокировки проверяет tryAutoTurnOn, а просьба остаётся в силе
    // до ближайшего повода проверить включение — например до конца паузы (§12.4).
    // Просьба хранит один повод: если проветривание за визит уже было запрошено,
    // эта запись его затирает. Наблюдаемой разницы нет — сеанс той же длительности,
    // меняется только текст в логе (§12.10b).
    variables.airingRequestedReason = AIRING_PERIODIC;
    logInfo("Настал срок периодического проветривания — пробую включить вытяжку", logSource, options.debug);
    tryAutoTurnOn(variables, options, logSource);
}

// --- Влажность (§4) ---------------------------------------------------------

// undefined — сервис не выбран, не найден или значение не число.
function readHumidity(uuid) {
    if (!uuid || uuid === "") {
        return undefined;
    }
    const svc = getServiceByUuid(uuid);
    if (!svc) {
        return undefined;
    }
    const raw = readCharacteristicValue(svc, HC.CurrentRelativeHumidity);
    if (raw === undefined || raw === null || raw === "") {
        return undefined;
    }
    const num = Number(raw);
    return isNaN(num) ? undefined : num;
}

// Рабочий порог влажности (R13, R14). Контрольный датчик стоит в сухой комнате и
// задаёт достижимый минимум: пока в «сухой» комнате не суше целевой влажности,
// гнаться за целевой бессмысленно — порог поднимается до «контрольный + надбавка».
function computeEffectiveTarget(options) {
    const target = numberOption(options, "targetHumidity", DEFAULT_TARGET_HUMIDITY);
    const ref = readHumidity(options.referenceHumiditySensor);
    if (ref === undefined || ref < target) {
        return target;
    }
    return Math.min(MAX_HUMIDITY_PERCENT, ref + numberOption(options, "referenceDelta", DEFAULT_REFERENCE_DELTA));
}

// Условие по влажности для выключения. Датчик не выбран или не читается —
// условие считается выполненным: иначе мёртвый датчик держал бы вытяжку
// до предельного таймера каждый раз (R28i).
function isHumiditySatisfied(options) {
    if (!options.humiditySensor || options.humiditySensor === "") {
        return true;
    }
    const humidity = readHumidity(options.humiditySensor);
    if (humidity === undefined) {
        logInfo("Датчик влажности не читается — условие по влажности считаю выполненным", undefined, options.debug);
        return true;
    }
    return humidity <= computeEffectiveTarget(options);
}

// «Высокая влажность» — одно понятие и для включения (G01), и для форсажа (G02).
function isHumidityHigh(options) {
    const humidity = readHumidity(options.humiditySensor);
    if (humidity === undefined) {
        return false;
    }
    return humidity >= computeEffectiveTarget(options) + numberOption(options, "humidityHighDelta", DEFAULT_HUMIDITY_HIGH_DELTA);
}

function onHumidityChanged(variables, options, logSource) {
    applyFanSpeed(variables.cachedFanService, options, logSource);
    tryReleaseAutoOnLock(variables, options, logSource);

    if (!isFanCurrentlyOn(variables)) {
        tryAutoTurnOn(variables, options, logSource);
        return;
    }
    // Тишина уже набрана, выключение ждало только влажности — переоцениваем.
    if (variables.offPending === true) {
        tryAutoTurnOff(variables, options, logSource, true);
    }
}

function isHumidityOption(options, serviceUuid) {
    return !!serviceUuid &&
        (options.humiditySensor === serviceUuid || options.referenceHumiditySensor === serviceUuid);
}

// --- Решение: включить / выключить (§5, §8) ---------------------------------

function tryAutoTurnOn(variables, options, logSource) {
    if (!variables.cachedFanService) {
        logInfo("Авто-включение отклонено: вытяжка ещё не определена (ждём первый запуск)", logSource, options.debug);
        return;
    }
    if (!isAutomationAllowed(options)) {
        logInfo("Авто-включение отклонено: автоматика запрещена выключателем «Разрешение автоматики»", logSource, options.debug);
        return;
    }
    if (isFanCurrentlyOn(variables)) {
        logInfo("Авто-включение не требуется: вытяжка уже включена", logSource, options.debug);
        return;
    }
    if (isCooldownActive(variables)) {
        logInfo("Авто-включение отклонено: идёт пауза после авто-выключения", logSource, options.debug);
        return;
    }
    if (variables.autoOnLock === LOCK_MANUAL_OFF && options.noAutoOnAfterManualOff === true) {
        logInfo("Авто-включение отклонено: вытяжку выключили вручную, блокировка активна", logSource, options.debug);
        return;
    }
    if (variables.autoOnLock === LOCK_MAX_RUN) {
        logInfo("Авто-включение отклонено: сработало предельное время работы, блокировка активна", logSource, options.debug);
        return;
    }

    // Условие 7 (§5): запрет режима «Не включать при присутствии» отменяет любой
    // повод — и присутствие, и влажность. Он сильнее влажности намеренно.
    const noRunWhilePresentMode = isNoRunWhilePresent(options);
    if (noRunWhilePresentMode && computeOccupancyActive(options)) {
        logInfo("Авто-включение отклонено: в помещении есть присутствие (режим «Не включать при присутствии»)", logSource, options.debug);
        return;
    }

    const reason = chooseTurnOnReason(variables, options);
    if (!reason) {
        logInfo(noRunWhilePresentMode
            ? "Авто-включение отклонено: проветривание не нужно и высокой влажности нет"
            : "Авто-включение отклонено: присутствие ещё не набралось и высокой влажности нет", logSource, options.debug);
        return;
    }

    if (isAiringReason(reason)) {
        startAiringRun(variables, options, logSource, reason);
        return;
    }

    logInfo(reason === ON_BY_PRESENCE ? "Включаю вытяжку: присутствие набрано" : "Включаю вытяжку: высокая влажность", logSource, options.debug);
    setFanOn(variables, options, logSource, true, RUN_BY_SENSOR);
    // Включение без активности датчиков (по влажности или на остатке сессии):
    // таймер выключения нужен сразу, иначе гасить будет нечему.
    armOffTimer(variables, options, logSource);
}

// Единственное место, где решается, зачем включать вытяжку: поводы перечислены
// по убыванию силы, первый подошедший выигрывает, пустая строка — повода нет.
// Проветривание за визит сильнее влажности намеренно (§11.13), а периодическое —
// самый слабый повод: при активности датчиков его нет вовсе (§12.2), а настоящий
// повод ведёт сеанс своими правилами. Отсчёт до следующего периодического
// проветривания всё равно пойдёт заново от выключения вытяжки (§12.1).
function chooseTurnOnReason(variables, options) {
    const requested = variables.airingRequestedReason;
    const airingAllowed = isAiringReason(requested) && airingRunMinutes(options) > 0;
    // В режиме §11 набранное присутствие поводом не является: поводом становится
    // закончившийся визит, за который полагается проветривание (§11.2).
    if (airingAllowed && requested === AIRING_AFTER_VISIT && isNoRunWhilePresent(options)) {
        return AIRING_AFTER_VISIT;
    }
    if (!isNoRunWhilePresent(options) && isPresenceReady(variables)) {
        return ON_BY_PRESENCE;
    }
    if (options.humidityStartsFan === true && isHumidityHigh(options)) {
        return ON_BY_HUMIDITY;
    }
    if (airingAllowed && requested === AIRING_PERIODIC && !computeOccupancyActive(options)) {
        return AIRING_PERIODIC;
    }
    return "";
}

// silenceReached — тишина по датчикам уже набрана (сработал таймер выключения).
// В этом случае несработавшее условие по влажности запоминается в offPending:
// следующее событие датчика влажности переоценит выключение.
function tryAutoTurnOff(variables, options, logSource, silenceReached) {
    if (!isFanCurrentlyOn(variables)) {
        return;
    }
    const hold = fanHoldReason(variables, options);
    if (hold) {
        logInfo("Выключение отменено: " + hold, logSource, options.debug);
        return;
    }

    const remainMs = minRunRemainingMs(variables, options);
    if (remainMs > 0) {
        logInfo("Выключение отложено: минимальное время работы ещё не вышло (осталось " + Math.ceil(remainMs / SECOND_MS) + " с)", logSource, options.debug);
        armOffTimerAfter(variables, options, logSource, remainMs);
        return;
    }

    // Проветривание влажность не заканчивает и не продлевает (§11.5, §12.8):
    // его время отмерено «Временем проветривания», и переоценивать тут нечего.
    if (!isAiringRunActive(variables) && !isHumiditySatisfied(options)) {
        variables.offPending = silenceReached === true;
        logInfo(() => "Выключение отложено: влажность " + readHumidity(options.humiditySensor) +
            " % выше рабочего порога " + computeEffectiveTarget(options) + " %", logSource, options.debug);
        return;
    }

    logInfo(isAiringRunActive(variables)
        ? "Выключаю вытяжку: проветривание закончено"
        : "Выключаю вытяжку: активности нет, влажность в норме", logSource, options.debug);
    setFanOn(variables, options, logSource, false);
    armCooldown(variables, options, logSource);
}

function minRunRemainingMs(variables, options) {
    const minutes = numberOption(options, "minRunMinutes", DEFAULT_MIN_RUN_MINUTES);
    if (minutes <= 0) {
        return 0;
    }
    const startedAt = variables.runStartedAt;
    if (startedAt === undefined || startedAt === null) {
        return 0;
    }
    const needMs = minutes * MINUTE_MS;
    const elapsed = Date.now() - startedAt;
    return elapsed >= needMs ? 0 : needMs - elapsed;
}

// --- Таймеры (§8) -----------------------------------------------------------

// Единственное место, где решается, держат ли вытяжку включённой: и «нужен ли
// таймер выключения», и «можно ли выключать сейчас» — один и тот же вопрос.
// Возвращает причину или "" — если не держат.
function fanHoldReason(variables, options) {
    if (isAnyManualSwitchOn(options)) {
        return "ручной выключатель в On";
    }
    if (computeOccupancyActive(options)) {
        return "датчики видят активность";
    }
    return manualHoldReason(variables, options);
}

// Та же причина, но без датчиков: в режиме «Не включать при присутствии»
// активность как раз и есть повод выключить, а ручное — по-прежнему держит.
function manualHoldReason(variables, options) {
    if (isAnyManualSwitchOn(options)) {
        return "ручной выключатель в On";
    }
    if (variables.manualHold) {
        return "активно ручное удержание";
    }
    return "";
}

// Заводит таймер выключения, если вытяжку ничто не удерживает включённой.
function armOffTimer(variables, options, logSource) {
    // Временем проветривания распоряжается его собственный таймер (§11.2, §12.3):
    // иначе событие «активности нет» переписало бы его «Задержкой выключения».
    if (isAiringRunActive(variables)) {
        logInfo("Идёт проветривание — временем работы распоряжается его собственный таймер", logSource, options.debug);
        return;
    }
    clearOffTimer(variables, options, logSource);
    const hold = fanHoldReason(variables, options);
    if (hold) {
        logInfo("Таймер выключения не нужен: " + hold, logSource, options.debug);
        return;
    }
    const sec = numberOption(options, "offDelaySeconds", DEFAULT_OFF_DELAY_SECONDS);
    if (sec <= 0) {
        logInfo("Задержка выключения 0 с — проверяю выключение сразу", logSource, options.debug);
        tryAutoTurnOff(variables, options, logSource, true);
        return;
    }
    logInfo("Таймер выключения: выключу через " + sec + " с, если активность не вернётся", logSource, options.debug);
    armOffTimerAfter(variables, options, logSource, sec * SECOND_MS);
}

function armOffTimerAfter(variables, options, logSource, delayMs) {
    clearOffTimer(variables, options, logSource);
    scheduleGuardedTimeout(variables, TIMER_OFF, delayMs, () => {
        logInfo("Таймер выключения сработал", variables.cachedFanService, options.debug);
        tryAutoTurnOff(variables, options, variables.cachedFanService, true);
    });
}

function clearOffTimer(variables, options, logSource) {
    variables.offPending = false;
    cancelGuardedTimeout(variables, options, logSource, TIMER_OFF);
}

// Заводится при ЛЮБОМ включении: по присутствию, по влажности и ручном (R24i).
function armMaxRunTimer(variables, options, logSource) {
    cancelGuardedTimeout(variables, options, logSource, TIMER_MAX_RUN);
    const minutes = numberOption(options, "maxRunMinutes", DEFAULT_MAX_RUN_MINUTES);
    if (minutes <= 0) {
        logInfo("Предельное время работы отключено (0 мин)", logSource, options.debug);
        return;
    }
    logInfo("Предельное время работы: выключу через " + minutes + " мин в любом случае", logSource, options.debug);
    scheduleGuardedTimeout(variables, TIMER_MAX_RUN, minutes * MINUTE_MS, () => {
        onMaxRunReached(variables, options, variables.cachedFanService);
    });
}

// Предел не проверяет ни влажность, ни присутствие, ни минимальное время.
// Единственное исключение — ручной выключатель в On.
function onMaxRunReached(variables, options, logSource) {
    if (!isFanCurrentlyOn(variables)) {
        return;
    }
    if (isAnyManualSwitchOn(options)) {
        logInfo("Предельное время истекло, но ручной выключатель в On — вытяжка остаётся включённой", logSource, options.debug);
        return;
    }
    logInfo("Предельное время работы истекло — выключаю вытяжку", logSource, options.debug);
    notifyIfStillHumid(options, logSource);

    clearOffTimer(variables, options, logSource);
    setAutoOnLock(variables, options, LOCK_MAX_RUN, logSource);
    setFanOn(variables, options, logSource, false);
    scheduleAutoOnLockRelease(variables, options, logSource);
}

// Смысл паузы (G05) — переждать и продолжить, поэтому её окончание такой же повод
// проверить включение, как событие датчика: сам повод проверит tryAutoTurnOn.
// Блокировка после предельного таймера (§8) снимается своим путём.
function armCooldown(variables, options, logSource) {
    cancelGuardedTimeout(variables, options, logSource, TIMER_COOLDOWN);
    const minutes = numberOption(options, "cooldownMinutes", DEFAULT_COOLDOWN_MINUTES);
    if (minutes <= 0) {
        return;
    }
    variables.cooldownUntil = Date.now() + minutes * MINUTE_MS;
    logInfo("Пауза перед повторным включением: " + minutes + " мин", logSource, options.debug);
    scheduleGuardedTimeout(variables, TIMER_COOLDOWN, minutes * MINUTE_MS, () => {
        logInfo("Пауза истекла — проверяю, есть ли повод включить вытяжку", variables.cachedFanService, options.debug);
        tryAutoTurnOn(variables, options, variables.cachedFanService);
    });
}

function isCooldownActive(variables) {
    const until = variables.cooldownUntil;
    return until !== undefined && until !== null && Date.now() < until;
}

// --- Блокировка авто-включения (§7 «выключили вручную», §8 «предельное время»)
// Обе блокировки снимаются в один и тот же момент — «вытяжка погасла бы сама»:
// активности нет дольше «Задержки выключения» И влажность в норме. Механизм
// один на двоих, различаются только причина и текст в логе.

function setAutoOnLock(variables, options, reason, logSource) {
    restartAutoOnLockSilence(variables, options, logSource);
    variables.autoOnLock = reason;
    logInfo(reason === LOCK_MAX_RUN
        ? "Блокировка авто-включения ВКЛ: сработало предельное время работы"
        : "Блокировка авто-включения ВКЛ: вытяжку выключили вручную", logSource, options.debug);
}

// Полное снятие блокировки — при любом включении вытяжки.
function releaseAutoOnLock(variables, options, logSource) {
    restartAutoOnLockSilence(variables, options, logSource);
    if (variables.autoOnLock) {
        logInfo("Блокировка авто-включения снята: вытяжку включили", logSource, options.debug);
    }
    variables.autoOnLock = undefined;
}

// Отсчёт «тишины» начинается заново: снимается и таймер, и уже набранный признак
// тишины — иначе следующая проверка сняла бы блокировку по старой тишине.
function restartAutoOnLockSilence(variables, options, logSource) {
    variables.autoOnLockSilent = false;
    cancelGuardedTimeout(variables, options, logSource, TIMER_AUTO_ON_LOCK);
}

// Активность спала — пошёл отсчёт «тишины»: по нему блокировка снимется, если
// к тому моменту и влажность будет в норме.
function scheduleAutoOnLockRelease(variables, options, logSource) {
    if (!variables.autoOnLock) {
        return;
    }
    restartAutoOnLockSilence(variables, options, logSource);
    if (computeOccupancyActive(options)) {
        logInfo("Блокировка авто-включения держится: активность датчиков есть", logSource, options.debug);
        return;
    }
    const sec = numberOption(options, "offDelaySeconds", DEFAULT_OFF_DELAY_SECONDS);
    if (sec <= 0) {
        variables.autoOnLockSilent = true;
        tryReleaseAutoOnLock(variables, options, logSource);
        return;
    }
    logInfo("Блокировка авто-включения: активность спала, проверю снятие через " + sec + " с", logSource, options.debug);
    scheduleGuardedTimeout(variables, TIMER_AUTO_ON_LOCK, sec * SECOND_MS, () => {
        if (computeOccupancyActive(options)) {
            logInfo("Блокировка авто-включения сохраняется: активность вернулась до истечения таймаута", variables.cachedFanService, options.debug);
            return;
        }
        variables.autoOnLockSilent = true;
        tryReleaseAutoOnLock(variables, options, variables.cachedFanService);
    });
}

function tryReleaseAutoOnLock(variables, options, logSource) {
    if (!variables.autoOnLock) {
        return;
    }
    if (variables.autoOnLockSilent !== true) {
        return;
    }
    if (computeOccupancyActive(options)) {
        return;
    }
    if (!isHumiditySatisfied(options)) {
        logInfo("Блокировка авто-включения сохраняется: влажность ещё выше рабочего порога", logSource, options.debug);
        return;
    }
    variables.autoOnLock = undefined;
    variables.autoOnLockSilent = false;
    logInfo("Блокировка авто-включения снята: вытяжка погасла бы сама", logSource, options.debug);
}

// --- Привязанный сервис: чтение, запись, скорость (§1, §6) ------------------

// Значение характеристики состояния приходит либо Boolean (On), либо 0/1 (Active).
function normalizeOnValue(value) {
    return value === true || value === 1;
}

// Состояние вытяжки: On у Switch и FanBasic, Active у Fan.
function getFanStateCharacteristic(svc) {
    return getCharacteristicSafe(svc, HC.On) || getCharacteristicSafe(svc, HC.Active);
}

function readFanOn(svc) {
    const ch = getFanStateCharacteristic(svc);
    if (!ch) {
        return false;
    }
    return normalizeOnValue(ch.getValue());
}

function writeFanOn(svc, on, options, logSource) {
    if (!svc) {
        logInfo("Не удалось переключить вытяжку: привязанный сервис не определён", logSource, options.debug);
        return false;
    }
    const ch = getFanStateCharacteristic(svc);
    if (!ch) {
        logInfo("Не удалось переключить вытяжку: у сервиса нет ни «Включено», ни «Активно»", logSource, options.debug);
        return false;
    }
    ch.setValue(ch.getType() === HC.Active ? (on === true ? 1 : 0) : on === true);
    logInfo("Вытяжка переключена в " + (on === true ? "ВКЛ" : "ВЫКЛ"), ch, options.debug);
    return true;
}

function isFanCurrentlyOn(variables) {
    return readFanOn(variables.cachedFanService);
}

// Единственная точка переключения вытяжки: пишет характеристику и ведёт сеанс
// работы. runOrigin имеет смысл только при включении — см. beginRun.
function setFanOn(variables, options, logSource, on, runOrigin) {
    if (!writeFanOn(variables.cachedFanService, on, options, logSource)) {
        return false;
    }
    if (on === true) {
        beginRun(variables, options, logSource, runOrigin);
    } else {
        endRun(variables, options, logSource);
    }
    return true;
}

// Все поля сеанса выставляются здесь и больше нигде: вызывающему достаточно
// сказать, откуда пришло включение (RUN_BY_*).
function beginRun(variables, options, logSource, runOrigin) {
    applyManualHoldForRun(variables, options, logSource, runOrigin);
    // Окно антидребезга (§7) открывает только авто-включение по датчику и
    // закрывает только endRun: событие, которое вытяжку не переключило, его
    // не трогает.
    if (runOrigin === RUN_BY_SENSOR) {
        variables.lastSensorAutoOnAt = Date.now();
    }
    variables.runStartedAt = Date.now();
    variables.offPending = false;
    // Любая работа обнуляет отсчёт периодической вентиляции (§12.1): пока вытяжка
    // работает, отсчёта нет — он пойдёт заново от её выключения, в endRun.
    clearAiringRequest(variables);
    cancelGuardedTimeout(variables, options, logSource, TIMER_AIRING_INTERVAL);
    armMaxRunTimer(variables, options, logSource);
    applyFanSpeed(variables.cachedFanService, options, logSource);
}

// Зеркало beginRun: поля сеанса гасятся здесь и больше нигде, включая «ручное
// удержание» — оно живёт ровно один сеанс.
function endRun(variables, options, logSource) {
    variables.manualHold = false;
    variables.runStartedAt = undefined;
    variables.offPending = false;
    // У выключенной вытяжки глотать нажатие кнопки не за чем.
    variables.lastSensorAutoOnAt = undefined;
    variables.airingRunReason = undefined;
    cancelGuardedTimeout(variables, options, logSource, TIMER_MAX_RUN);
    cancelGuardedTimeout(variables, options, logSource, TIMER_AIRING);
    // Вытяжка погасла — с этого момента идёт отсчёт до периодической вентиляции (§12.1).
    armAiringIntervalTimer(variables, options, logSource);
}

// «Ручное удержание» (§7) поднимает только включение, которое хаб видит как
// ручное, и только при включённой опции. Перезапуск хаба удержание не меняет:
// что было до него, сценарию неизвестно.
function applyManualHoldForRun(variables, options, logSource, runOrigin) {
    if (runOrigin === RUN_BY_RESTART) {
        return;
    }
    if (runOrigin === RUN_BY_EXTERNAL) {
        if (options.noAutoOffWhenManualOn === true && !variables.manualHold) {
            variables.manualHold = true;
            logInfo("Вытяжку включили извне — включаю ручное удержание (опция «не выключать после ручного включения»)", logSource, options.debug);
        }
        return;
    }
    if (runOrigin === RUN_BY_MANUAL && options.noAutoOffWhenManualOn === true) {
        variables.manualHold = true;
        logInfo("Ручное удержание ВКЛ: опция «не выключать после ручного включения»", logSource, options.debug);
        return;
    }
    if (runOrigin === RUN_BY_MANUAL_SWITCH) {
        // Пока выключатель в On, вытяжку и так не гасят ни таймер выключения,
        // ни предельный таймер: все они проверяют isAnyManualSwitchOn.
        logInfo("Вытяжка следует за ручным выключателем — таймеры выключения не действуют, пока он в On", logSource, options.debug);
    }
    variables.manualHold = false;
}

// Форсаж (G02): пока влажность высокая — скорость форсажа, иначе обычная.
// При выключенной вытяжке скорость не пишется никогда.
function applyFanSpeed(svc, options, logSource) {
    if (options.boostEnabled !== true) {
        return;
    }
    if (!svc) {
        return;
    }
    const ch = getCharacteristicSafe(svc, HC.RotationSpeed);
    if (!ch) {
        logInfo("Форсаж не применён: у привязанного сервиса нет характеристики «Скорость вращения»", logSource, options.debug);
        return;
    }
    if (!readFanOn(svc)) {
        return;
    }
    const high = isHumidityHigh(options);
    const speed = high
        ? numberOption(options, "boostSpeed", DEFAULT_BOOST_SPEED)
        : numberOption(options, "normalSpeed", DEFAULT_NORMAL_SPEED);
    ch.setValue(speed);
    logInfo("Скорость вытяжки: " + speed + " % (" + (high ? "форсаж, влажность высокая" : "обычная") + ")", logSource, options.debug);
}

// --- Уведомление о недосушенной комнате: запись в журнал хаба (G03) ----------

function notifyIfStillHumid(options, logSource) {
    if (options.notifyOnDryTimeout !== true || !options.humiditySensor) {
        return;
    }
    const humidity = readHumidity(options.humiditySensor);
    if (humidity === undefined) {
        return;
    }
    const target = computeEffectiveTarget(options);
    if (humidity <= target) {
        return;
    }
    logDryTimeoutMessage(options, logSource, humidity, target);
}

// Никакой доставки нет: сообщение пишется в журнал хаба через log.message —
// отдельным уровнем, не зависящим от «Режима отладки». Формат один, потому что
// каналов, клиентов и тихого режима у журнала не бывает.
// Порог в тексте — рабочий (computeEffectiveTarget), а не значение опции
// «Целевая влажность»: при контрольном датчике они расходятся.
// Место записано той же формой, что и в логе: одно правило склейки на оба.
function logDryTimeoutMessage(options, logSource, humidity, target) {
    try {
        const minutes = numberOption(options, "maxRunMinutes", DEFAULT_MAX_RUN_MINUTES);
        const device = resolveDeviceName(logSource);
        log.message("💨 Вытяжка отработала предельное время " + minutes + " мин, но влажность " +
            humidity + " % так и не опустилась до рабочего порога " + target + " %" +
            (device ? " (" + device + ")" : ""));
        logInfo("Запись о недосушенной комнате добавлена в журнал", logSource, options.debug);
    } catch (e) {
        logError("Ошибка записи о недосушенной комнате в журнал: " + e.message, logSource);
    }
}

// --- Лог --------------------------------------------------------------------

// Ленивые строки: функция вызывается, только когда debug включён — иначе горячие
// пути платили бы за computeOccupancyActive и readHumidity ради выключенного лога.
function logInfo(textOrFn, source, show) {
    if (!show) {
        return;
    }
    const text = typeof textOrFn === "function" ? textOrFn() : textOrFn;
    console.info(getLogText(text, source));
}

function logError(text, source) {
    console.error(getLogText(text, source));
}

function getLogText(text, source) {
    const device = resolveDeviceName(source);
    return device ? (text + " | " + DEBUG_TITLE + device) : (text + " | " + DEBUG_TITLE);
}

// Единственное место, где source (характеристика с getService или сам сервис)
// разбирается на имя устройства. Имя — украшение лога и записи о недосушке,
// поэтому неудачный разбор гасится в пустую строку: из-за него ничего не теряем.
function resolveDeviceName(source) {
    if (!source) {
        return "";
    }
    try {
        const service = typeof source.getService === "function" ? source.getService() : source;
        const accessory = service.getAccessory();
        return buildDeviceName(accessory.getRoom().getName(), accessory.getName(),
            service.getName(), service.getUUID());
    } catch (e) {
        return "";
    }
}

// --- Доступ к устройствам и опциям ------------------------------------------

function getCharacteristicSafe(svc, characteristicType) {
    if (!svc) {
        return undefined;
    }
    try {
        return svc.getCharacteristic(characteristicType) || undefined;
    } catch (e) {
        return undefined;
    }
}

function readCharacteristicValue(svc, characteristicType) {
    const ch = getCharacteristicSafe(svc, characteristicType);
    return ch ? ch.getValue() : undefined;
}

// UUID сервиса — "аксессуар.сервис".
function getServiceByUuid(serviceUuid) {
    if (!serviceUuid || serviceUuid === "") {
        return undefined;
    }
    const cdata = String(serviceUuid).split(".");
    if (cdata.length < 2) {
        return undefined;
    }
    const accessory = Hub.getAccessory(cdata[0]);
    if (!accessory) {
        return undefined;
    }
    return accessory.getService(cdata[1]);
}

function getServiceFromListOption(options, optionKey) {
    return getServiceByUuid(options[optionKey]);
}

// Пустое или нечисловое значение опции не должно превращать таймеры в NaN.
function numberOption(options, optionKey, fallback) {
    const raw = options[optionKey];
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }
    const num = Number(raw);
    return isNaN(num) ? fallback : num;
}

// Выбран ли этот сервис в одном из слотов опции («motion», «manualControl»).
function isSlotOption(options, prefix, slots, serviceUuid) {
    for (let i = 1; i <= slots; i++) {
        const v = options[prefix + i];
        if (v && v !== "" && v === serviceUuid) {
            return true;
        }
    }
    return false;
}

function isAnyManualSwitchOn(options, excludeUuid) {
    for (let i = 1; i <= MAX_MANUAL_CONTROL_SLOTS; i++) {
        const key = "manualControl" + i;
        const v = options[key];
        if (!v || v === "") {
            continue;
        }
        if (excludeUuid && v === excludeUuid) {
            continue;
        }
        const svc = getServiceFromListOption(options, key);
        if (!svc) {
            continue;
        }
        if (svc.getType() !== HS.Switch) {
            continue;
        }
        if (readCharacteristicValue(svc, HC.On) === true) {
            return true;
        }
    }
    return false;
}

function isSelfChanged(context) {
    if (!context) {
        return false;
    }
    const elements = context.toString().split(CONTEXT_CONSTANTS.DELIMITER);
    return elements.length >= CONTEXT_CONSTANTS.MIN_ELEMENTS &&
        elements[0].startsWith(CONTEXT_CONSTANTS.LOGIC_PREFIX) &&
        elements[1].startsWith(CONTEXT_CONSTANTS.CHARACTERISTIC_PREFIX) &&
        elements[2] === elements[0];
}

// "Комната -> Имя Сервис (uuid)"; совпадающее имя сервиса не дублируется.
// Одно правило склейки на лог и на список устройств в опциях.
function buildDeviceName(roomName, accName, serviceName, uuid) {
    const label = accName === serviceName ? accName : accName + " " + serviceName;
    return roomName + " -> " + label + " (" + uuid + ")";
}

// Вынесен наверх, чтобы не создавать функцию в цикле (память).
function compareOptionByRuName(a, b) {
    return a.name.ru.localeCompare(b.name.ru);
}

// Собирает несколько списков сервисов за ОДИН проход по аксессуарам хаба.
// `typesByList` — { имя_списка: [HS.Тип, ...] }. Сервис попадает в список, если
// его тип входит в набор этого списка. Характеристики не проверяем: нужные
// характеристики обязательны (required) для своих типов сервисов, поэтому наличие
// типа гарантирует наличие характеристики.
// Возвращает { имя_списка: [{ name: {ru,en}, value }, ...] } с заголовком "Не выбрано".
//
// Оптимизировано под память: функция обходит ВСЕ сервисы ВСЕХ аксессуаров хаба,
// поэтому в горячем цикле нет ни обёрток характеристик (getCharacteristic), ни
// замыканий (forEach/some). Поиск списков по типу — O(1) через Map.
function collectServicesByTypes(typesByList) {
    const listNames = Object.keys(typesByList);

    // Обратный индекс «тип сервиса -> имена списков». Map, т.к. ключ — значение
    // HS.* (сравнивается по идентичности с тем, что вернёт getType()).
    const listsForType = new Map();
    for (let li = 0; li < listNames.length; li++) {
        const types = typesByList[listNames[li]];
        for (let ti = 0; ti < types.length; ti++) {
            const bucket = listsForType.get(types[ti]);
            if (bucket) {
                bucket.push(listNames[li]);
            } else {
                listsForType.set(types[ti], [listNames[li]]);
            }
        }
    }

    const collected = {};
    const seen = {};
    for (let n = 0; n < listNames.length; n++) {
        collected[listNames[n]] = [];
        seen[listNames[n]] = {};
    }

    const accessories = Hub.getAccessories();
    for (let ai = 0; ai < accessories.length; ai++) {
        const accessory = accessories[ai];
        const services = accessory.getServices();
        // Комната и имя аксессуара одни на все его сервисы — считаем лениво один раз.
        let roomName = "";
        let accName = "";
        let accResolved = false;
        for (let si = 0; si < services.length; si++) {
            const svc = services[si];
            const lists = listsForType.get(svc.getType());
            if (!lists) {
                continue;
            }
            const uuid = svc.getUUID();
            let dname = null;
            for (let k = 0; k < lists.length; k++) {
                const ln = lists[k];
                if (seen[ln][uuid]) {
                    continue;
                }
                seen[ln][uuid] = true;
                if (dname === null) {
                    if (!accResolved) {
                        roomName = accessory.getRoom().getName();
                        accName = accessory.getName();
                        accResolved = true;
                    }
                    dname = buildDeviceName(roomName, accName, svc.getName(), uuid);
                }
                collected[ln].push({name: {ru: dname, en: dname}, value: uuid});
            }
        }
    }

    const out = {};
    for (let oi = 0; oi < listNames.length; oi++) {
        const nm = listNames[oi];
        collected[nm].sort(compareOptionByRuName);
        const sorted = [{name: {ru: "Не выбрано", en: "Not selected"}, value: ""}];
        for (let p = 0; p < collected[nm].length; p++) {
            sorted.push(collected[nm][p]);
        }
        out[nm] = sorted;
    }
    return out;
}

// --- Опции (§10) ------------------------------------------------------------

// Заголовок группы в UI — строка-статус без собственного значения.
function optionGroupHeader(ru, en) {
    return {name: {ru: ru, en: en}, type: "String", value: "", formType: "status"};
}

function createOptions() {
    const lists = collectServicesByTypes({
        motion: [HS.MotionSensor, HS.OccupancySensor, HS.ContactSensor],
        manual: [HS.Switch, HS.ContactSensor, HS.StatelessProgrammableSwitch, HS.C_PulseMeter],
        gate: [HS.Switch],
        humidity: [HS.HumiditySensor]
    });
    const motionPickerList = lists.motion;
    const manualPickerList = lists.manual;
    const gateList = lists.gate;
    const humidityList = lists.humidity;

    const options = {};

    options.desc = {
        name: {ru: "  ОПИСАНИЕ", en: "  DESCRIPTION"},
        desc: scenarioDescription,
        type: "String",
        value: "",
        formType: "status"
    };

    options.groupSensors = optionGroupHeader("  ДАТЧИКИ АКТИВНОСТИ", "  ACTIVITY SENSORS");

    for (let mi = 1; mi <= MAX_MOTION_SLOTS; mi++) {
        const motionOpt = {
            name: {
                ru: "Датчик движения или присутствия " + mi,
                en: "Motion or occupancy sensor " + mi
            },
            type: "String",
            value: "",
            formType: "list",
            values: motionPickerList
        };
        if (mi === 1) {
            motionOpt.desc = {
                ru: "Выберите один датчик: движение, присутствие или открытие. Для датчика открытия активным считается состояние «Открыто» (можно инвертировать ниже). Если не выбран ни один датчик, сценарий работает только по влажности и ручным входам.",
                en: "Select one sensor: motion, occupancy or contact. For a contact sensor the active state is \"Open\" (can be inverted below). With no sensor selected the scenario works by humidity and manual inputs only."
            };
        }
        options["motion" + mi] = motionOpt;
    }

    options.contactInverted = {
        name: {ru: "Инвертировать датчик открытия", en: "Invert contact sensor"},
        desc: {
            ru: "Если включено, для датчиков открытия из списка выше занятым считается состояние «Закрыто». Нужно для туалета без датчика движения: закрытая дверь = внутри человек.",
            en: "If enabled, the contact sensors selected above are treated as occupied while \"Closed\". Useful for a toilet without a motion sensor: a closed door means someone is inside."
        },
        type: "Boolean",
        value: false
    };

    options.groupHumidity = optionGroupHeader("  ВЛАЖНОСТЬ", "  HUMIDITY");

    options.humiditySensor = {
        name: {ru: "Датчик влажности", en: "Humidity sensor"},
        desc: {
            ru: "Необязательно. Если выбран — после ухода человека вытяжка выключается не раньше, чем влажность опустится до рабочего порога. Если поле пустое, работает чистая логика по присутствию.",
            en: "Optional. If set, after the room is empty the fan stays on until humidity drops to the working threshold. Empty = pure presence logic."
        },
        type: "String",
        value: "",
        formType: "list",
        values: humidityList
    };

    options.targetHumidity = {
        name: {ru: "Целевая влажность (%)", en: "Target humidity (%)"},
        desc: {
            ru: "Влажность, до которой нужно досушить комнату. Пока значение датчика выше рабочего порога, вытяжка не выключается по таймеру присутствия.",
            en: "Humidity the room should be dried to. While the sensor reads above the working threshold, the presence timer does not switch the fan off."
        },
        type: "Integer",
        value: DEFAULT_TARGET_HUMIDITY,
        minValue: 0,
        maxValue: 100,
        step: 1
    };

    options.referenceHumiditySensor = {
        name: {ru: "Контрольный датчик влажности", en: "Reference humidity sensor"},
        desc: {
            ru: "Необязательно. Датчик в сухой комнате (коридор, спальня). Если на нём влажность равна или выше целевой, гнаться за целевой бессмысленно: рабочий порог поднимается до «контрольный + надбавка». Иначе рабочий порог равен целевой влажности.",
            en: "Optional. A sensor in a dry room (hallway, bedroom). If it reads at or above the target, chasing the target makes no sense: the working threshold becomes \"reference + delta\". Otherwise the working threshold equals the target humidity."
        },
        type: "String",
        value: "",
        formType: "list",
        values: humidityList
    };

    options.referenceDelta = {
        name: {ru: "Надбавка к контрольному датчику (%)", en: "Reference sensor delta (%)"},
        desc: {
            ru: "На сколько процентов рабочий порог выше показаний контрольного датчика, когда тот сам не суше целевой влажности. Результат ограничен 100 %.",
            en: "How many percent above the reference sensor the working threshold is set when the reference is not drier than the target. The result is capped at 100%."
        },
        type: "Integer",
        value: DEFAULT_REFERENCE_DELTA,
        minValue: 0,
        maxValue: 50,
        step: 1
    };

    options.humidityHighDelta = {
        name: {ru: "Запас над целевой для «высокой влажности» (%)", en: "Delta above target for \"high humidity\" (%)"},
        desc: {
            ru: "Влажность считается высокой, когда она не ниже «рабочий порог + этот запас». Высокая влажность включает вытяжку (если разрешено ниже) и переводит её на скорость форсажа.",
            en: "Humidity counts as high when it is at or above \"working threshold + this delta\". High humidity turns the fan on (if allowed below) and switches it to boost speed."
        },
        type: "Integer",
        value: DEFAULT_HUMIDITY_HIGH_DELTA,
        minValue: 0,
        maxValue: 50,
        step: 1
    };

    options.humidityStartsFan = {
        name: {ru: "Включать по влажности без присутствия", en: "Turn on by humidity without presence"},
        desc: {
            ru: "Если включено, вытяжка включается от высокой влажности, даже когда датчики присутствия никого не видят (душ, пар). Выключение остаётся прежним: тишина по датчикам плюс влажность в норме.",
            en: "If enabled, the fan starts on high humidity even when the presence sensors see nobody (shower, steam). Turning off is unchanged: sensor silence plus humidity back to normal."
        },
        type: "Boolean",
        value: false
    };

    options.groupSpeed = optionGroupHeader("  СКОРОСТЬ", "  SPEED");

    options.boostEnabled = {
        name: {ru: "Форсаж при высокой влажности", en: "Boost on high humidity"},
        desc: {
            ru: "Если включено и у вытяжки есть характеристика «Скорость вращения», при высокой влажности пишется скорость форсажа, иначе обычная. Если характеристики нет, опция не действует.",
            en: "If enabled and the fan has a Rotation Speed characteristic, boost speed is written while humidity is high, otherwise the normal speed. Without that characteristic the option does nothing."
        },
        type: "Boolean",
        value: false
    };

    options.normalSpeed = {
        name: {ru: "Обычная скорость (%)", en: "Normal speed (%)"},
        desc: {
            ru: "Скорость вытяжки, когда влажность не высокая. Используется только при включённом форсаже.",
            en: "Fan speed while humidity is not high. Used only when boost is enabled."
        },
        type: "Integer",
        value: DEFAULT_NORMAL_SPEED,
        minValue: 1,
        maxValue: 100,
        step: 1
    };

    options.boostSpeed = {
        name: {ru: "Скорость форсажа (%)", en: "Boost speed (%)"},
        desc: {
            ru: "Скорость вытяжки, пока влажность высокая. Используется только при включённом форсаже.",
            en: "Fan speed while humidity is high. Used only when boost is enabled."
        },
        type: "Integer",
        value: DEFAULT_BOOST_SPEED,
        minValue: 1,
        maxValue: 100,
        step: 1
    };

    options.groupManualControl = optionGroupHeader("  РУЧНЫЕ ВХОДЫ", "  MANUAL INPUTS");

    for (let hi = 1; hi <= MAX_MANUAL_CONTROL_SLOTS; hi++) {
        const manualOpt = {
            name: {
                ru: "Выключатель " + hi,
                en: "Switch " + hi
            },
            type: "String",
            value: "",
            formType: "list",
            values: manualPickerList
        };
        if (hi === 1) {
            manualOpt.desc = {
                ru: "Устройство для ручного управления вытяжкой. Выключатель: вытяжка повторяет его состояние; пока выключатель в On, не действуют ни таймер выключения, ни минимальное время, ни предельный таймер. Кнопка, импульсы и датчик открытия переключают вытяжку; контакт реагирует только на «Открытие», «Закрытие» игнорируется.\nВнимание: не указывайте тут выключатель, на который активируется логика!",
                en: "Device for manual fan control. Switch: the fan follows its state; while the switch is On, neither the off timer, nor the minimum run time, nor the maximum run timer apply. Button, pulse counter and contact sensor toggle the fan; the contact reacts only on Open, Close is ignored.\nAttention: do not specify the switch that activates the logic here!"
            };
        }
        options["manualControl" + hi] = manualOpt;
    }

    options.groupAutomationLimits = optionGroupHeader("  РАЗРЕШЕНИЕ АВТОМАТИКИ", "  ALLOW AUTOMATION");

    options.gateAutoSwitch = {
        name: {ru: "Разрешение автоматики", en: "Allow automation"},
        desc: {
            ru: "Необязательно. Пока этот выключатель включён, разрешено автоматическое включение, иначе только ручное. Уже работающая вытяжка при запрете не гасится, таймеры продолжают работать. Если поле пустое — ограничения нет.",
            en: "Optional. While this switch is ON, automatic turn-on is allowed; while OFF, only manual. A fan that is already running is not switched off by the gate, and the timers keep running. Empty = no gate."
        },
        type: "String",
        value: "",
        formType: "list",
        values: gateList
    };

    options.gateAutoSwitchInvert = {
        name: {ru: "Инвертировать выключатель «Разрешение автоматики»", en: "Invert the \"Allow automation\" switch"},
        desc: {
            ru: "Если включено, логика выключателя «Разрешение автоматики» инвертируется: пока он отключён, автоматика разрешена, иначе только ручное включение.",
            en: "If enabled, the logic of the \"Allow automation\" switch is inverted: while it is OFF, automation is allowed; otherwise only manual turn-on."
        },
        type: "Boolean",
        value: false
    };

    options.gateBlocksManualInputs = {
        name: {ru: "Также не реагировать на ручные входы", en: "Also ignore manual inputs"},
        desc: {
            ru: "Работает только вместе с выбранным выключателем «Разрешение автоматики». Если включено, то пока автоматика запрещена, сценарий не реагирует и на ручные входы: выключатели, кнопки, импульсы и датчики открытия — вытяжка по ним не включается и не выключается.",
            en: "Only used together with the selected \"Allow automation\" switch. If enabled, while automation is blocked the scenario also ignores manual inputs — switches, buttons, pulse counters and contact sensors: they neither turn the fan on nor off."
        },
        type: "Boolean",
        value: false
    };

    options.groupManualHold = optionGroupHeader("  РУЧНОЕ УДЕРЖАНИЕ", "  MANUAL HOLD");

    options.noAutoOffWhenManualOn = {
        name: {
            ru: "Не отключать вытяжку автоматически после ручного включения",
            en: "Do not auto-turn off after manual on"
        },
        desc: {
            ru: "Если включено, то при включении вытяжки кнопкой, импульсом, контактом или извне (приложение, сцена, голос) она не выключается по обычному таймеру — остаётся только предельное время непрерывной работы. Удержание снимается при любом выключении вытяжки.",
            en: "If enabled, a fan turned on by a button, pulse, contact or externally (app, scene, voice) is not switched off by the regular timer — only the maximum run time applies. The hold is released whenever the fan goes off."
        },
        type: "Boolean",
        value: false
    };

    options.noAutoOnAfterManualOff = {
        name: {
            ru: "Не включать вытяжку автоматически, если её отключили вручную",
            en: "Do not auto-on after manual off"
        },
        desc: {
            ru: "Если включено и вытяжку выключили вручную или извне, пока ещё есть повод работать (активность датчиков или высокая влажность), автоматическое включение не выполняется до момента, когда вытяжка погасла бы сама: активности нет дольше «Задержки выключения» и влажность в норме. Не относится к ручному входу типа «Выключатель».",
            en: "If enabled and the fan is switched off manually or externally while there is still a reason to run (sensor activity or high humidity), auto-on is suppressed until the moment the fan would have switched off by itself: no activity for longer than the off delay and humidity back to normal. Does not apply to the stateful manual switch input."
        },
        type: "Boolean",
        value: false
    };

    options.ignoreManualWithin5sAfterSensorOn = {
        name: {
            ru: "Игнорировать кнопку/импульс 5 секунд после включения по датчику",
            en: "Ignore button/pulse for 5s after sensor auto-on"
        },
        desc: {
            ru: "Если включено, то события кнопки, импульса и контакта в течение 5 секунд после авто-включения игнорируются. Защита от ложного отключения сразу после включения по датчику. Ручной выключатель продолжает работать.",
            en: "If enabled, button, pulse and contact events within 5 seconds after an automatic turn-on are ignored. Protects against a false switch-off right after the sensor auto-on. The stateful manual switch keeps working."
        },
        type: "Boolean",
        value: true
    };

    options.groupTimers = optionGroupHeader("  ТАЙМЕРЫ", "  TIMERS");

    options.onDelaySeconds = {
        name: {ru: "Задержка включения (с)", en: "On delay (sec)"},
        desc: {
            ru: "Сколько секунд присутствие должно продержаться, прежде чем включить вытяжку. Короткий провал активности отсчёт не обнуляет: он начинается заново, только если активности не было дольше «Задержки выключения». Значение 0 — включение с первой же активности.",
            en: "How many seconds presence must last before the fan is turned on. A short gap does not reset the countdown: it restarts only after there was no activity for longer than the off delay. 0 means turning on at the very first activity."
        },
        type: "Integer",
        value: DEFAULT_ON_DELAY_SECONDS,
        minValue: 0,
        maxValue: 86400,
        step: 1
    };

    options.offDelaySeconds = {
        name: {ru: "Задержка выключения (с)", en: "Off delay (sec)"},
        desc: {
            ru: "Секунды до выключения после того, как все датчики перестали видеть активность. Если выбран датчик влажности, вытяжка всё равно продолжит работать, пока влажность выше рабочего порога.",
            en: "Seconds until the fan is switched off after all sensors stopped seeing activity. With a humidity sensor selected, the fan keeps running while humidity is above the working threshold."
        },
        type: "Integer",
        value: DEFAULT_OFF_DELAY_SECONDS,
        minValue: 0,
        maxValue: 86400,
        step: 1
    };

    options.minRunMinutes = {
        name: {ru: "Минимальное время работы (мин)", en: "Minimum run time (min)"},
        desc: {
            ru: "Раньше этого срока автоматическое выключение не выполняется — защита от щелчков реле на «зашёл-вышел». Значение 0 отключает проверку.",
            en: "Automatic switch-off does not happen before this time has passed — protects the relay from short in-and-out cycles. 0 disables the check."
        },
        type: "Integer",
        value: DEFAULT_MIN_RUN_MINUTES,
        minValue: 0,
        maxValue: 1440,
        step: 1
    };

    options.cooldownMinutes = {
        name: {ru: "Пауза перед повторным включением (мин)", en: "Cooldown before restart (min)"},
        desc: {
            ru: "После автоматического выключения автоматическое включение не выполняется в течение этого времени — защита от «вкл-выкл-вкл» на границе порога. Ручное включение работает всегда. Значение 0 отключает паузу.",
            en: "After an automatic switch-off, automatic turn-on is suppressed for this time — protects against on-off-on cycling at the threshold. Manual turn-on always works. 0 disables the pause."
        },
        type: "Integer",
        value: DEFAULT_COOLDOWN_MINUTES,
        minValue: 0,
        maxValue: 1440,
        step: 1
    };

    options.maxRunMinutes = {
        name: {ru: "Максимальное время непрерывной работы (мин)", en: "Maximum continuous run time (min)"},
        desc: {
            ru: "Верхний предел для любого включения: по присутствию, по влажности и ручного. По его истечении вытяжка выключается, не проверяя влажность, присутствие и минимальное время, и не включается автоматически, пока повод не исчезнет сам. Единственное исключение — ручной выключатель в On. Значение 0 отключает предел.",
            en: "An upper limit for any run: by presence, by humidity and manual. When it expires the fan is switched off without checking humidity, presence or the minimum run time, and it is not turned on automatically until the reason disappears by itself. The only exception is a manual switch in On. 0 disables the limit."
        },
        type: "Integer",
        value: DEFAULT_MAX_RUN_MINUTES,
        minValue: 0,
        maxValue: 10080,
        step: 1
    };

    options.groupPresenceMode = optionGroupHeader("  РЕЖИМ ПРИСУТСТВИЯ", "  PRESENCE MODE");

    options.noRunWhilePresent = {
        name: {ru: "Не включать при присутствии", en: "Do not run while someone is present"},
        desc: {
            ru: "Инвертирует смысл присутствия: пока датчики видят человека, вытяжка выключена, а работающая — гаснет сразу, даже если влажность высокая. После ухода (подтверждённого «Задержкой выключения») вытяжка включается на «Время проветривания», чтобы почистить воздух. Визит засчитывается, только если присутствие продержалось «Задержку включения». Ручные входы работают как обычно.",
            en: "Inverts the meaning of presence: while the sensors see a person the fan stays off, and a running fan is switched off at once, even with high humidity. After the person leaves (confirmed by the off delay) the fan runs for the airing time to clear the air. A visit counts only if presence lasted longer than the on delay. Manual inputs keep working as usual."
        },
        type: "Boolean",
        value: false
    };

    options.airingMinutes = {
        name: {ru: "Время проветривания (мин)", en: "Airing time (min)"},
        desc: {
            ru: "Сколько минут вытяжка проветривает помещение. Это время используют оба повода: проветривание после ухода человека в режиме «Не включать при присутствии» и «Интервал периодической вентиляции». Влажность его не продлевает и не сокращает; в режиме «Не включать при присутствии» вернувшееся присутствие выключает вытяжку сразу, не дожидаясь минимального времени работы. Значение 0 — проветривания нет ни по одному поводу: режим «Не включать при присутствии» сводится к запрету включаться при человеке, а периодическая вентиляция не запускается.",
            en: "How many minutes the fan ventilates the room. Both reasons use this time: the airing after the person leaves in «Do not run while someone is present» mode, and the periodic airing interval. Humidity neither extends nor shortens it; in «Do not run while someone is present» mode returning presence switches the fan off at once, without waiting for the minimum run time. 0 means no airing for either reason: the mode is then only a ban on running while someone is present, and periodic airing never starts."
        },
        type: "Integer",
        value: DEFAULT_AIRING_MINUTES,
        minValue: 0,
        maxValue: 1440,
        step: 1
    };

    options.groupPeriodicAiring = optionGroupHeader("  ПЕРИОДИЧЕСКАЯ ВЕНТИЛЯЦИЯ", "  PERIODIC AIRING");

    options.airingIntervalHours = {
        name: {ru: "Интервал периодической вентиляции (ч)", en: "Periodic airing interval (hours)"},
        desc: {
            ru: "Если вытяжка не работала столько часов подряд и датчики активности молчат, сценарий сам проветривает помещение «Время проветривания» минут. Отсчёт идёт от момента, когда вытяжка последний раз выключилась: любая работа — по присутствию, по влажности, ручная, проветривание после ухода — начинает его заново; перезапуск хаба тоже. Как любое авто-включение, вентиляция подчиняется «Разрешению автоматики», паузе перед повторным включением и пределам времени работы. Значение 0 — выключено; рекомендованное значение — 6.",
            en: "If the fan has not run for this many hours in a row and the activity sensors are quiet, the scenario ventilates the room by itself for the airing time. The countdown starts from the moment the fan was last switched off: any run — by presence, by humidity, manual or an airing — restarts it, and so does a hub restart. Like any automatic turn-on, airing obeys the automation gate, the cooldown before restart and the run time limits. 0 disables it; the recommended value is 6."
        },
        type: "Integer",
        value: DEFAULT_AIRING_INTERVAL_HOURS,
        minValue: 0,
        maxValue: 168,
        step: 1
    };

    options.groupNotify = optionGroupHeader("  УВЕДОМЛЕНИЯ", "  NOTIFICATIONS");

    options.notifyOnDryTimeout = {
        name: {ru: "Уведомлять, если комната не высохла за предельное время", en: "Notify if the room is not dry within the maximum run time"},
        desc: {
            ru: "Если включено, при срабатывании предельного времени работы и влажности выше рабочего порога сообщение об этом пишется в журнал хаба.",
            en: "If enabled, a message is written to the hub log when the maximum run time expires while humidity is still above the working threshold."
        },
        type: "Boolean",
        value: false
    };

    options.groupOther = optionGroupHeader("  ПРОЧЕЕ", "  OTHER");

    options.debug = {
        name: {ru: "Режим отладки", en: "Debug mode"},
        desc: {
            ru: "Включить вывод подробных информационных сообщений о событиях и действиях сценария в лог.",
            en: "Enable detailed informational messages about scenario events and actions in the log."
        },
        type: "Boolean",
        value: false
    };

    return options;
}

const DEBUG_TITLE = "Автоматизация вытяжки: ";

const CONTEXT_CONSTANTS = {
    DELIMITER: " <- ",
    LOGIC_PREFIX: "LOGIC",
    CHARACTERISTIC_PREFIX: "C",
    MIN_ELEMENTS: 3
};
