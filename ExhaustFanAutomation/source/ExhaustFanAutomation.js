/** Подавление ложных кнопка/импульс/контакт сразу после авто-включения по датчику. */
const DEBOUNCE_MANUAL_AFTER_SENSOR_MS = 5000;

/** Сколько слотов датчиков движения / присутствия / открытия создаётся в опциях. */
const MAX_MOTION_SLOTS = 3;
/** Сколько слотов ручного ввода (выключатель, кнопка, импульсы, контакт) создаётся в опциях. */
const MAX_MANUAL_CONTROL_SLOTS = 3;

/** Влажность выше 100 % не бывает — потолок для рабочего порога по контрольному датчику. */
const MAX_HUMIDITY_PERCENT = 100;

const SECOND_MS = 1000;
const MINUTE_MS = 60000;

// Таймер накопления присутствия может сработать на доли миллисекунды раньше
// расчётного момента. Без допуска такое срабатывание молча потеряло бы включение:
// повторной попытки до следующего события датчика не будет.
const PRESENCE_READY_TOLERANCE_MS = 50;

/** Причины блокировки авто-включения (см. §7 и §8 спецификации). */
const LOCK_MANUAL_OFF = "manualOff";
const LOCK_MAX_RUN = "maxRun";

// Откуда пришло включение вытяжки. От этого зависят «ручное удержание» (§7) и
// окно антидребезга ручных входов; остальные поля сеанса одинаковы для любого
// включения. Разбирает эти значения beginRun — и больше никто.
const RUN_BY_SENSOR = "sensor";
const RUN_BY_MANUAL = "manual";
const RUN_BY_MANUAL_SWITCH = "manualSwitch";
const RUN_BY_EXTERNAL = "external";
const RUN_BY_RESTART = "restart";

/** Ключи общего хранилища global: счётчик поколений и задачи текущего поколения. */
const SUB_GEN_KEY_PREFIX = "EFA_subGen_";
const TIMERS_KEY_PREFIX = "EFA_timers_";

// Значения по умолчанию заданы один раз: их же берут опции в UI и подстановка
// при отсутствии значения в options (частично заполненные опции не должны
// превращать таймеры в NaN).
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
        cooldownTimerId: undefined
    }
};

function trigger(source, value, variables, options, context) {
    try {
        variables.cachedFanService = source.getService();

        // Первый вызов после загрузки или пересохранения сценария — это запуск
        // (onStart: true), а не событие от устройства: хаб отдельного признака не
        // даёт, но подписка на этот момент ещё не создана. Отличать обязательно:
        // у стартового вызова нет ни «включили вручную», ни «выключили вручную»,
        // поэтому ни удержание, ни блокировка авто-включения по нему не ставятся.
        const isScenarioStart = !variables.externalSubscribed;

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

// Запуск хаба или пересохранение сценария (R25i, §9). Состояние восстанавливается
// по фактическому положению вещей: включённая вытяжка получает новый сеанс работы
// (реальное время включения хабу неизвестно) и таймер выключения, если активности
// нет; выключенная — начинает накопление присутствия, если активность есть.
function handleScenarioStart(variables, options, logSource, on) {
    if (on) {
        beginRun(variables, options, logSource, RUN_BY_RESTART);
        syncOffTimerWhenFanOnWithoutOccupancy(variables, options, logSource);
        return;
    }
    startPresenceAccumulationIfActive(variables, options, logSource);
}

// Вытяжку включили извне (приложение, сцена, физический выключатель на самой
// вытяжке) — либо хаб перезапустился при уже включённой вытяжке. Реальное время
// включения хабу неизвестно, поэтому сеанс работы начинается заново.
function handleFanTurnedOnExternally(variables, options, logSource) {
    releaseAutoOnLock(variables, options, logSource);
    beginRun(variables, options, logSource, RUN_BY_EXTERNAL);
    syncOffTimerWhenFanOnWithoutOccupancy(variables, options, logSource);
}

function handleFanTurnedOffExternally(variables, options, logSource) {
    logInfo("Вытяжку выключили (вручную или извне) — сбрасываю ручное удержание и таймеры", logSource, options.debug);
    clearOffTimer(variables, options, logSource);
    endRun(variables, options, logSource);
    registerManualOff(variables, options, logSource);
    // Перезапуск хаба при выключенной вытяжке и активных датчиках: накопление
    // присутствия должно начаться сразу, иначе первое включение ждало бы
    // следующего события датчика.
    startPresenceAccumulationIfActive(variables, options, logSource);
}

function syncOffTimerWhenFanOnWithoutOccupancy(variables, options, logSource) {
    if (isAnyManualSwitchOn(options)) {
        logInfo("Вытяжка включена, ручной выключатель в On — таймер выключения не нужен", logSource, options.debug);
        return;
    }
    if (computeOccupancyActive(options)) {
        logInfo("Вытяжка включена, датчики активны — таймер выключения не нужен", logSource, options.debug);
        return;
    }
    if (variables.manualHold) {
        logInfo("Вытяжка включена и удерживается вручную — гасит только предельный таймер", logSource, options.debug);
        return;
    }
    logInfo("Вытяжка включена, активности нет — запуск таймера выключения", logSource, options.debug);
    armOffTimer(variables, options, logSource);
}

// ----------------------------------------------------------------------------
// Подписка на внешние устройства
// ----------------------------------------------------------------------------

function ensureExternalSubscription(variables, options) {
    if (variables.externalSubscribed) {
        return;
    }
    variables.externalSubscribed = true;

    // Защита от «зависших» подписок. При пересохранении сценария хаб исполняет
    // скрипт заново со свежим variables, но старый колбэк подписки остаётся жив
    // со «старым» variables и может некорректно управлять вытяжкой. Метим каждую
    // подписку «поколением» в общем хранилище global (переживает пересохранение):
    // актуальна только подписка последнего поколения, более старые делают no-op.
    // Если global недоступен — защита просто отключается.
    const subGen = nextSubscriptionGeneration(variables);
    // Поколение нужно не только подписке: таймеры прошлого поколения тоже живы
    // (предельный — до недели) и через старый variables писали бы в вытяжку.
    // Их уже снял nextSubscriptionGeneration; здесь поколение запоминается,
    // чтобы под ним заводились задачи текущего экземпляра сценария.
    variables.subGen = subGen;

    logInfo("Старт: подписка на датчики и ручные входы создана" + (subGen ? " (поколение " + subGen.gen + ")" : ""), variables.cachedFanService, options.debug);

    Hub.subscribeWithCondition(
        "",
        "",
        [
            HS.MotionSensor,
            HS.OccupancySensor,
            HS.ContactSensor,
            HS.HumiditySensor,
            HS.Switch,
            HS.StatelessProgrammableSwitch,
            HS.C_PulseMeter
        ],
        [
            HC.MotionDetected,
            HC.OccupancyDetected,
            HC.ContactSensorState,
            HC.CurrentRelativeHumidity,
            HC.On,
            HC.ProgrammableSwitchEvent,
            HC.C_PulseCount
        ],
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

// Увеличивает счётчик «поколения» подписки в общем хранилище global, привязанный
// к UUID управляемой вытяжки, и снимает задачи прошлых поколений. Возвращает
// { key, gen, timersKey } или null, если global недоступен/не сохраняет значения
// (тогда защита от зависших подписок и таймеров отключена).
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

// Таймеры прошлого экземпляра сценария снимаются, а не просто игнорируются при
// срабатывании: иначе колбэк дожил бы до своего срока, а у предельного таймера
// это до недели. Список задач лежит в global, а не в variables: у нового
// экземпляра variables свежие, и дотянуться до старых задач больше нечем.
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

// Единственная точка, где сценарий заводит таймер. Задача попадает в список
// текущего поколения, чтобы следующий экземпляр сценария её снял; проверка
// поколения в колбэке остаётся страховкой на случай, когда global недоступен
// и снимать задачи некому.
function scheduleGuardedTimeout(variables, delayMs, callback) {
    const subGen = variables.subGen;
    let task = setTimeout(() => {
        forgetTimerTask(subGen, task);
        if (isStaleSubscription(subGen)) {
            return;
        }
        callback();
    }, delayMs);
    rememberTimerTask(subGen, task);
    return task;
}

// Единственная точка, где сценарий снимает таймер: снятая задача должна уйти
// и из списка поколения, иначе он растёт до перезагрузки хаба.
function cancelGuardedTimeout(variables, task) {
    if (!task) {
        return;
    }
    clearTimeout(task);
    forgetTimerTask(variables.subGen, task);
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

    if (isManualControlOption(options, uuid)) {
        if (isManualInputBlockedByGate(options)) {
            logInfo("Ручной вход проигнорирован: выключатель «Разрешение автоматики» запрещает автоматику (опция «Также не реагировать на ручные входы»)", src, options.debug);
        } else if (handleManualControlEvent(src, uuid, val, st, ct, variables, options)) {
            return;
        }
    }

    if (isMotionSlotOption(options, uuid)) {
        logInfo("Датчик активности сработал: " + (isSensorActiveValue(st, val, options) ? "активность" : "нет активности"), src, options.debug);
        onOccupancyChanged(variables, options, src);
    }
}

// ----------------------------------------------------------------------------
// Ручные входы и «рубильник» автоматики (§7)
// ----------------------------------------------------------------------------

// Обрабатывает событие ручного входа. Возвращает true, если событие относится к
// ручному управлению и обработано; false — если тип события к ручному управлению
// не относится (тогда событие идёт дальше, например в ветку датчиков активности).
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

// fromManualSwitch — включение пришло от ручного входа типа «Выключатель».
// Чем два вида ручного включения различаются для сеанса — см. beginRun.
function manualTurnOn(variables, options, logSource, fromManualSwitch) {
    clearOffTimer(variables, options, logSource);
    releaseAutoOnLock(variables, options, logSource);

    setFanOn(variables, options, logSource, true, fromManualSwitch === true ? RUN_BY_MANUAL_SWITCH : RUN_BY_MANUAL);

    if (isAnyManualSwitchOn(options)) {
        return;
    }
    if (!computeOccupancyActive(options) && !variables.manualHold) {
        armOffTimer(variables, options, logSource);
    }
}

// fromManualSwitch — выключение пришло от ручного входа типа «Выключатель».
// Для него Off — штатное состояние автоматики, а не «выключили вручную»,
// поэтому блокировка авто-включения не ставится (§7).
function manualTurnOff(variables, options, logSource, fromManualSwitch) {
    clearOffTimer(variables, options, logSource);
    if (fromManualSwitch !== true) {
        registerManualOff(variables, options, logSource);
    }
    setFanOn(variables, options, logSource, false);
}

// Ручное выключение, пока ещё есть повод работать (активность датчиков или
// высокая влажность): при включённой опции ставим блокировку авто-включения.
// Она держится до момента, когда вытяжка погасла бы сама.
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

// Ручные входы (выключатели, кнопки, импульсы, контакты) игнорируются целиком,
// если включена опция «Также не реагировать на ручные входы» и выключатель
// «Разрешение автоматики» сейчас запрещает автоматику. Если разрешающий
// выключатель не выбран — блокировки нет.
function isManualInputBlockedByGate(options) {
    return options.gateBlocksManualInputs === true && !isAutomationAllowed(options);
}

// ----------------------------------------------------------------------------
// Присутствие (§2, §3)
// ----------------------------------------------------------------------------

// Активное значение датчика активности: движение = true, присутствие = 1,
// контакт «Открыто» = 1 (или «Закрыто» = 0 при инверсии, G06).
function isSensorActiveValue(serviceType, value, options) {
    if (serviceType === HS.MotionSensor) {
        return value === true;
    }
    if (serviceType === HS.ContactSensor) {
        return value === (options.contactInverted === true ? 0 : 1);
    }
    return value === 1;
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
        const t = svc.getType();
        if (t === HS.MotionSensor) {
            if (readCharacteristicValue(svc, HC.MotionDetected) === true) {
                return true;
            }
        } else if (t === HS.OccupancySensor) {
            if (readCharacteristicValue(svc, HC.OccupancyDetected) === 1) {
                return true;
            }
        } else if (t === HS.ContactSensor) {
            if (isSensorActiveValue(t, readCharacteristicValue(svc, HC.ContactSensorState), options)) {
                return true;
            }
        }
    }
    return false;
}

function onOccupancyChanged(variables, options, logSource) {
    if (computeOccupancyActive(options)) {
        clearOffTimer(variables, options, logSource);
        clearPresenceResetTimer(variables, options, logSource);
        clearAutoOnLockTimer(variables, options, logSource);
        startPresenceAccumulationIfActive(variables, options, logSource);
        tryAutoTurnOn(variables, options, logSource);
        return;
    }

    logInfo("Активности на датчиках нет", logSource, options.debug);
    armPresenceResetTimer(variables, options, logSource);
    scheduleAutoOnLockRelease(variables, options, logSource);

    if (!isFanCurrentlyOn(variables)) {
        return;
    }
    if (variables.manualHold) {
        logInfo("Активности нет, но включено ручное удержание — гасит только предельный таймер", logSource, options.debug);
        return;
    }
    armOffTimer(variables, options, logSource);
}

function startPresenceAccumulationIfActive(variables, options, logSource) {
    if (variables.presenceSinceAt !== undefined && variables.presenceSinceAt !== null) {
        return;
    }
    if (!computeOccupancyActive(options)) {
        return;
    }
    variables.presenceSinceAt = Date.now();
    logInfo("Начинаю накопление присутствия", logSource, options.debug);
    armOnDelayTimer(variables, options, logSource);
}

// Присутствие «набралось»: текущая сессия присутствия длится дольше «Задержки
// включения». При нулевой задержке набирается сразу, с первой же активности.
function isPresenceReady(variables, options) {
    const since = variables.presenceSinceAt;
    if (since === undefined || since === null) {
        return false;
    }
    const needMs = numberOption(options, "onDelaySeconds", DEFAULT_ON_DELAY_SECONDS) * SECOND_MS;
    if (needMs <= 0) {
        return true;
    }
    return Date.now() - since >= needMs - PRESENCE_READY_TOLERANCE_MS;
}

function armOnDelayTimer(variables, options, logSource) {
    clearOnDelayTimer(variables, options, logSource);
    const sec = numberOption(options, "onDelaySeconds", DEFAULT_ON_DELAY_SECONDS);
    if (sec <= 0) {
        // Накопление не нужно: включение проверяется тут же, в onOccupancyChanged.
        return;
    }
    logInfo("Накопление присутствия: попробую включить через " + sec + " с, если присутствие не прервётся", logSource, options.debug);
    variables.onDelayTimerId = scheduleGuardedTimeout(variables, sec * SECOND_MS, () => {
        variables.onDelayTimerId = undefined;
        logInfo("Присутствие набрано — пробую включить вытяжку", variables.cachedFanService, options.debug);
        tryAutoTurnOn(variables, options, variables.cachedFanService);
    });
}

function clearOnDelayTimer(variables, options, logSource) {
    if (variables.onDelayTimerId) {
        logInfo("Таймер накопления присутствия сброшен", logSource, options.debug);
        cancelGuardedTimeout(variables, variables.onDelayTimerId);
        variables.onDelayTimerId = undefined;
    }
}

// Сессия присутствия сбрасывается не сразу: короткий провал импульсного PIR не
// должен обнулять отсчёт. Сброс наступает, только если активности нет дольше
// «Задержки выключения» (R03.1, R03.2).
function armPresenceResetTimer(variables, options, logSource) {
    if (variables.presenceSinceAt === undefined || variables.presenceSinceAt === null) {
        return;
    }
    clearPresenceResetTimer(variables, options, logSource);
    const sec = numberOption(options, "offDelaySeconds", DEFAULT_OFF_DELAY_SECONDS);
    if (sec <= 0) {
        resetPresenceSession(variables, options, logSource);
        return;
    }
    variables.presenceResetTimerId = scheduleGuardedTimeout(variables, sec * SECOND_MS, () => {
        variables.presenceResetTimerId = undefined;
        if (computeOccupancyActive(options)) {
            return;
        }
        resetPresenceSession(variables, options, variables.cachedFanService);
    });
}

function clearPresenceResetTimer(variables, options, logSource) {
    if (variables.presenceResetTimerId) {
        cancelGuardedTimeout(variables, variables.presenceResetTimerId);
        variables.presenceResetTimerId = undefined;
        logInfo("Сброс накопления присутствия отменён: активность вернулась", logSource, options.debug);
    }
}

function resetPresenceSession(variables, options, logSource) {
    variables.presenceSinceAt = undefined;
    clearOnDelayTimer(variables, options, logSource);
    logInfo("Накопление присутствия обнулено: активности не было " + numberOption(options, "offDelaySeconds", DEFAULT_OFF_DELAY_SECONDS) + " с", logSource, options.debug);
}

// ----------------------------------------------------------------------------
// Влажность (§4)
// ----------------------------------------------------------------------------

// Значение датчика влажности по UUID сервиса или undefined: сервис не выбран,
// не найден, характеристики нет или значение не число.
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

// «Высокая влажность» — одно понятие и для включения по влажности (G01),
// и для форсажа (G02).
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
    if (options.humiditySensor && options.humiditySensor === serviceUuid) {
        return true;
    }
    return !!(options.referenceHumiditySensor && options.referenceHumiditySensor === serviceUuid);
}

// ----------------------------------------------------------------------------
// Решение: включить / выключить (§5, §8)
// ----------------------------------------------------------------------------

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

    const byPresence = isPresenceReady(variables, options);
    const byHumidity = options.humidityStartsFan === true && isHumidityHigh(options);
    if (!byPresence && !byHumidity) {
        logInfo("Авто-включение отклонено: присутствие ещё не набралось и высокой влажности нет", logSource, options.debug);
        return;
    }

    logInfo(byPresence ? "Включаю вытяжку: присутствие набрано" : "Включаю вытяжку: высокая влажность", logSource, options.debug);
    setFanOn(variables, options, logSource, true, RUN_BY_SENSOR);

    // Включение без активности датчиков (по влажности или на остатке сессии):
    // таймер выключения заводится сразу, иначе гасить будет нечему.
    if (!computeOccupancyActive(options)) {
        armOffTimer(variables, options, logSource);
    }
}

// silenceReached — тишина по датчикам уже набрана (сработал таймер выключения).
// В этом случае несработавшее условие по влажности запоминается в offPending:
// следующее событие датчика влажности переоценит выключение.
function tryAutoTurnOff(variables, options, logSource, silenceReached) {
    if (!isFanCurrentlyOn(variables)) {
        return;
    }
    if (isAnyManualSwitchOn(options)) {
        logInfo("Выключение отменено: ручной выключатель в On удерживает вытяжку", logSource, options.debug);
        return;
    }
    if (variables.manualHold) {
        logInfo("Выключение отменено: активно ручное удержание", logSource, options.debug);
        return;
    }
    if (computeOccupancyActive(options)) {
        logInfo("Выключение отменено: снова появилась активность датчиков", logSource, options.debug);
        return;
    }

    const remainMs = minRunRemainingMs(variables, options);
    if (remainMs > 0) {
        logInfo("Выключение отложено: минимальное время работы ещё не вышло (осталось " + Math.ceil(remainMs / SECOND_MS) + " с)", logSource, options.debug);
        armOffTimerAfter(variables, options, logSource, remainMs);
        return;
    }

    if (!isHumiditySatisfied(options)) {
        variables.offPending = silenceReached === true;
        logInfo(() => "Выключение отложено: влажность " + readHumidity(options.humiditySensor) +
            " % выше рабочего порога " + computeEffectiveTarget(options) + " %", logSource, options.debug);
        return;
    }

    logInfo("Выключаю вытяжку: активности нет, влажность в норме", logSource, options.debug);
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

// ----------------------------------------------------------------------------
// Таймеры (§8)
// ----------------------------------------------------------------------------

function armOffTimer(variables, options, logSource) {
    clearOffTimer(variables, options, logSource);
    if (isAnyManualSwitchOn(options)) {
        logInfo("Таймер выключения не нужен: ручной выключатель в On удерживает вытяжку", logSource, options.debug);
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
    variables.offTimerId = scheduleGuardedTimeout(variables, delayMs, () => {
        variables.offTimerId = undefined;
        logInfo("Таймер выключения сработал", variables.cachedFanService, options.debug);
        tryAutoTurnOff(variables, options, variables.cachedFanService, true);
    });
}

function clearOffTimer(variables, options, logSource) {
    variables.offPending = false;
    if (variables.offTimerId) {
        logInfo("Таймер выключения сброшен", logSource, options.debug);
        cancelGuardedTimeout(variables, variables.offTimerId);
        variables.offTimerId = undefined;
    }
}

// Предельный таймер заводится при ЛЮБОМ включении вытяжки: по присутствию,
// по влажности и ручном (R24i).
function armMaxRunTimer(variables, options, logSource) {
    clearMaxRunTimer(variables, options, logSource);
    const minutes = numberOption(options, "maxRunMinutes", DEFAULT_MAX_RUN_MINUTES);
    if (minutes <= 0) {
        logInfo("Предельное время работы отключено (0 мин)", logSource, options.debug);
        return;
    }
    logInfo("Предельное время работы: выключу через " + minutes + " мин в любом случае", logSource, options.debug);
    variables.maxRunTimerId = scheduleGuardedTimeout(variables, minutes * MINUTE_MS, () => {
        variables.maxRunTimerId = undefined;
        onMaxRunReached(variables, options, variables.cachedFanService);
    });
}

function clearMaxRunTimer(variables, options, logSource) {
    if (variables.maxRunTimerId) {
        logInfo("Предельный таймер сброшен", logSource, options.debug);
        cancelGuardedTimeout(variables, variables.maxRunTimerId);
        variables.maxRunTimerId = undefined;
    }
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

// Пауза (G05) не отключает автоматику до следующего события датчика: смысл
// паузы — переждать и продолжить. Поэтому её окончание — такой же повод
// проверить включение, как событие датчика; сам повод (набранное присутствие
// или высокая влажность) проверит tryAutoTurnOn. Блокировка после предельного
// таймера (§8) этим не затрагивается: она снимается своим путём.
function armCooldown(variables, options, logSource) {
    clearCooldownTimer(variables, options, logSource);
    const minutes = numberOption(options, "cooldownMinutes", DEFAULT_COOLDOWN_MINUTES);
    if (minutes <= 0) {
        return;
    }
    variables.cooldownUntil = Date.now() + minutes * MINUTE_MS;
    logInfo("Пауза перед повторным включением: " + minutes + " мин", logSource, options.debug);
    variables.cooldownTimerId = scheduleGuardedTimeout(variables, minutes * MINUTE_MS, () => {
        variables.cooldownTimerId = undefined;
        logInfo("Пауза истекла — проверяю, есть ли повод включить вытяжку", variables.cachedFanService, options.debug);
        tryAutoTurnOn(variables, options, variables.cachedFanService);
    });
}

function clearCooldownTimer(variables, options, logSource) {
    if (variables.cooldownTimerId) {
        logInfo("Отсчёт паузы перед повторным включением сброшен", logSource, options.debug);
        cancelGuardedTimeout(variables, variables.cooldownTimerId);
        variables.cooldownTimerId = undefined;
    }
}

function isCooldownActive(variables) {
    const until = variables.cooldownUntil;
    if (until === undefined || until === null) {
        return false;
    }
    return Date.now() < until;
}

// ----------------------------------------------------------------------------
// Блокировка авто-включения (§7 «выключили вручную», §8 «предельное время»)
//
// Обе блокировки снимаются в один и тот же момент — «вытяжка погасла бы сама»:
// активности нет дольше «Задержки выключения» И влажность в норме. Поэтому
// механизм один на двоих, различаются только причина и текст в логе.
// ----------------------------------------------------------------------------

function setAutoOnLock(variables, options, reason, logSource) {
    clearAutoOnLockTimer(variables, options, logSource);
    variables.autoOnLock = reason;
    variables.autoOnLockSilent = false;
    logInfo(reason === LOCK_MAX_RUN
        ? "Блокировка авто-включения ВКЛ: сработало предельное время работы"
        : "Блокировка авто-включения ВКЛ: вытяжку выключили вручную", logSource, options.debug);
}

// Полное снятие блокировки — при любом включении вытяжки.
function releaseAutoOnLock(variables, options, logSource) {
    clearAutoOnLockTimer(variables, options, logSource);
    if (variables.autoOnLock) {
        logInfo("Блокировка авто-включения снята: вытяжку включили", logSource, options.debug);
    }
    variables.autoOnLock = undefined;
}

function clearAutoOnLockTimer(variables, options, logSource) {
    variables.autoOnLockSilent = false;
    if (variables.autoOnLockTimerId) {
        logInfo("Блокировка авто-включения: отсчёт снятия отменён", logSource, options.debug);
        cancelGuardedTimeout(variables, variables.autoOnLockTimerId);
        variables.autoOnLockTimerId = undefined;
    }
}

// Активность спала — запускаем отсчёт «тишины». Когда он истечёт, блокировка
// снимется, если к тому моменту и влажность будет в норме.
function scheduleAutoOnLockRelease(variables, options, logSource) {
    if (!variables.autoOnLock) {
        return;
    }
    clearAutoOnLockTimer(variables, options, logSource);
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
    variables.autoOnLockTimerId = scheduleGuardedTimeout(variables, sec * SECOND_MS, () => {
        variables.autoOnLockTimerId = undefined;
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

// ----------------------------------------------------------------------------
// Привязанный сервис: чтение, запись, скорость (§1, §6)
// ----------------------------------------------------------------------------

// Значение характеристики состояния приходит либо Boolean (On), либо 0/1 (Active).
function normalizeOnValue(value) {
    return value === true || value === 1;
}

// Характеристика состояния вытяжки: On у Switch и FanBasic, Active у Fan.
// Выбирается по тому, какая характеристика есть у сервиса.
function getFanStateCharacteristic(svc) {
    if (!svc) {
        return undefined;
    }
    const on = getCharacteristicSafe(svc, HC.On);
    if (on) {
        return on;
    }
    return getCharacteristicSafe(svc, HC.Active);
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

// Единственная точка переключения вытяжки: пишет характеристику и ведёт учёт
// сеанса работы (время старта, предельный таймер, скорость).
// runOrigin имеет смысл только при включении — см. beginRun.
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

// Начало сеанса работы. Все поля сеанса выставляются здесь и больше нигде:
// вызывающим достаточно сказать, откуда пришло включение (RUN_BY_*).
function beginRun(variables, options, logSource, runOrigin) {
    applyManualHoldForRun(variables, options, logSource, runOrigin);
    // Окно антидребезга ручных входов (§7) открывает только авто-включение по
    // датчику, а закрывает только конец сеанса (endRun). Оно отсчитывается от
    // момента включения, поэтому событие, которое вытяжку не переключило
    // (ручной выключатель в On на уже включённой вытяжке), его не трогает.
    if (runOrigin === RUN_BY_SENSOR) {
        variables.lastSensorAutoOnAt = Date.now();
    }
    variables.runStartedAt = Date.now();
    variables.offPending = false;
    armMaxRunTimer(variables, options, logSource);
    applyFanSpeed(variables.cachedFanService, options, logSource);
}

// Конец сеанса работы. Зеркало beginRun: все поля сеанса гасятся здесь и
// больше нигде, включая «ручное удержание» — оно живёт ровно один сеанс.
function endRun(variables, options, logSource) {
    variables.manualHold = false;
    variables.runStartedAt = undefined;
    variables.offPending = false;
    // Окно антидребезга закрывается вместе с сеансом: у выключенной вытяжки
    // глотать нажатие кнопки не за чем — включать её заново никто не мешает.
    variables.lastSensorAutoOnAt = undefined;
    clearMaxRunTimer(variables, options, logSource);
}

// «Ручное удержание» (§7) поднимает только то включение, которое хаб видит как
// ручное, и только при включённой опции. Перезапуск хаба состояние удержания
// не меняет: что было до перезапуска, сценарию неизвестно.
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
// Скорость никогда не пишется при выключенной вытяжке.
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

// ----------------------------------------------------------------------------
// Уведомление о недосушенной комнате (G03)
// ----------------------------------------------------------------------------

function notifyIfStillHumid(options, logSource) {
    if (options.notifyOnDryTimeout !== true) {
        return;
    }
    if (!options.humiditySensor || options.humiditySensor === "") {
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
    sendDryTimeoutNotification(options, logSource, humidity, target);
}

// Каналы и клиенты — списки через запятую. Клиенты передаются в Notify.to
// массивом одним аргументом: Nashorn разворачивает JS-массив в varargs,
// а .apply на Java-методе не работает.
function sendDryTimeoutNotification(options, logSource, humidity, target) {
    try {
        const channels = toIdList(options.notifyChannels);
        const clients = toIdList(options.notifyClients);
        if (clients.length > 0 && channels.length === 0) {
            logError("Заданы клиенты уведомлений, но не указан канал", logSource);
            return;
        }
        const message = "💨 Вытяжка отработала предельное время " +
            numberOption(options, "maxRunMinutes", DEFAULT_MAX_RUN_MINUTES) + " мин, но влажность " +
            humidity + " % так и не опустилась до " + target + " %" +
            (resolveDeviceName(logSource) ? " (" + resolveDeviceName(logSource) + ")" : "");

        let notify = Notify.text(message).debugText(DEBUG_TITLE);
        for (let i = 0; i < channels.length; i++) {
            notify = notify.to(channels[i], clients);
        }
        notify.send();
        logInfo("Уведомление о недосушенной комнате отправлено", logSource, options.debug);
    } catch (e) {
        logError("Ошибка отправки уведомления: " + e.message, logSource);
    }
}

function toIdList(value) {
    if (value === undefined || value === null) {
        return [];
    }
    const items = Array.isArray(value) ? value : String(value).split(",");
    const out = [];
    for (let i = 0; i < items.length; i++) {
        const item = String(items[i]).trim();
        if (item !== "") {
            out.push(item);
        }
    }
    return out;
}

// ----------------------------------------------------------------------------
// Лог
// ----------------------------------------------------------------------------

// Поддерживает ленивые строки: если передана функция, она вызывается только
// когда debug включён. Это спасает горячие пути от лишних вычислений
// (computeOccupancyActive, readHumidity и т.п.) при выключенной отладке.
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

// source может быть характеристикой (есть getService) или сервисом (берём напрямую).
function resolveDeviceName(source) {
    if (!source) {
        return "";
    }
    try {
        const service = typeof source.getService === "function" ? source.getService() : source;
        return getDeviceName(service);
    } catch (e) {
        return "";
    }
}

// ----------------------------------------------------------------------------
// Доступ к устройствам и опциям
// ----------------------------------------------------------------------------

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

// Числовая опция с подстановкой значения по умолчанию: пустое или нечисловое
// значение не должно превращать таймеры и пороги в NaN.
function numberOption(options, optionKey, fallback) {
    const raw = options[optionKey];
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }
    const num = Number(raw);
    return isNaN(num) ? fallback : num;
}

function isMotionSlotOption(options, serviceUuid) {
    for (let i = 1; i <= MAX_MOTION_SLOTS; i++) {
        const v = options["motion" + i];
        if (v && v !== "" && v === serviceUuid) {
            return true;
        }
    }
    return false;
}

function isManualControlOption(options, serviceUuid) {
    for (let i = 1; i <= MAX_MANUAL_CONTROL_SLOTS; i++) {
        const v = options["manualControl" + i];
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

// accessory можно передать явно, чтобы не звать service.getAccessory() повторно
// (в горячем цикле аксессуар уже на руках). Без него — берём из сервиса.
function getDeviceName(service, accessory) {
    if (!service) {
        return "";
    }
    const acc = accessory || service.getAccessory();
    return buildDeviceName(acc.getRoom().getName(), acc.getName(), service.getName(), service.getUUID());
}

// Формат отображаемого имени в одном месте: "Комната -> Имя [Сервис] (uuid)".
// Если имя сервиса совпадает с именем аксессуара — сервис не дублируем.
function buildDeviceName(roomName, accName, serviceName, uuid) {
    const label = accName === serviceName ? accName : accName + " " + serviceName;
    return roomName + " -> " + label + " (" + uuid + ")";
}

// Компаратор опций по русскому имени. Вынесен наверх, чтобы не создавать
// функцию в цикле (память).
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

// ----------------------------------------------------------------------------
// Опции (§10)
// ----------------------------------------------------------------------------

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

    options.groupSensors = {
        name: {ru: "  ДАТЧИКИ АКТИВНОСТИ", en: "  ACTIVITY SENSORS"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupHumidity = {
        name: {ru: "  ВЛАЖНОСТЬ", en: "  HUMIDITY"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupSpeed = {
        name: {ru: "  СКОРОСТЬ", en: "  SPEED"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupManualControl = {
        name: {ru: "  РУЧНЫЕ ВХОДЫ", en: "  MANUAL INPUTS"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupAutomationLimits = {
        name: {ru: "  РАЗРЕШЕНИЕ АВТОМАТИКИ", en: "  ALLOW AUTOMATION"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupManualHold = {
        name: {ru: "  РУЧНОЕ УДЕРЖАНИЕ", en: "  MANUAL HOLD"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupTimers = {
        name: {ru: "  ТАЙМЕРЫ", en: "  TIMERS"},
        type: "String",
        value: "",
        formType: "status"
    };

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

    options.groupNotify = {
        name: {ru: "  УВЕДОМЛЕНИЯ", en: "  NOTIFICATIONS"},
        type: "String",
        value: "",
        formType: "status"
    };

    options.notifyOnDryTimeout = {
        name: {ru: "Уведомлять, если комната не высохла за предельное время", en: "Notify if the room is not dry within the maximum run time"},
        desc: {
            ru: "Если включено, при срабатывании предельного времени работы и влажности выше рабочего порога отправляется уведомление в указанные каналы.",
            en: "If enabled, a notification is sent to the selected channels when the maximum run time expires while humidity is still above the working threshold."
        },
        type: "Boolean",
        value: false
    };

    options.notifyChannels = {
        name: {ru: "Каналы уведомлений", en: "Notification channels"},
        desc: {
            ru: "Идентификаторы каналов через запятую, например «Telegram_1, Web_1». Если пусто, уведомление уходит каналом по умолчанию.",
            en: "Channel identifiers separated by commas, e.g. \"Telegram_1, Web_1\". If empty, the default channel is used."
        },
        type: "String",
        value: ""
    };

    options.notifyClients = {
        name: {ru: "Клиенты уведомлений", en: "Notification clients"},
        desc: {
            ru: "Идентификаторы клиентов через запятую; применяются к каждому каналу. Если клиенты указаны, а канал нет — в лог пишется ошибка и уведомление не отправляется.",
            en: "Client identifiers separated by commas; applied to every channel. If clients are set but no channel is, an error is logged and nothing is sent."
        },
        type: "String",
        value: ""
    };

    options.groupOther = {
        name: {ru: "  ПРОЧЕЕ", en: "  OTHER"},
        type: "String",
        value: "",
        formType: "status"
    };

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
