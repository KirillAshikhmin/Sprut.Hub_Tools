/** Подавление ложных кнопка/импульс сразу после авто-включения по датчику. */
const DEBOUNCE_MANUAL_AFTER_SENSOR_MS = 5000;

/** Сколько слотов датчиков движения / присутствия / касания создаётся в опциях. */
const MAX_MOTION_SLOTS = 3;
/** Сколько слотов ручного ввода (выключатель, кнопка, импульсы) создаётся в опциях. */
const MAX_MANUAL_CONTROL_SLOTS = 3;

const scenarioName = {
    ru: "💡 Автоматизация света по движению",
    en: "💡 Motion-based light automation"
};

const scenarioDescription = {
    ru: "Автоматически включает свет при срабатывании настроенных датчиков движения.\n\n" +
        "Поддерживает автоматический и ручной режимы работы.\n",
    en: "Automatically turns on the light when motion sensors are triggered.\n\n" +
        "Supports automatic and manual modes.\n"
};

info = {
    name: scenarioName.ru,
    description: scenarioDescription.ru,
    version: "1.2",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Lightbulb, HS.Switch],
    sourceCharacteristics: [HC.On],

    options: createOptions(),

    variables: {
        cachedLightService: undefined,
        externalSubscribed: false,
        manualHold: false,
        offTimerId: undefined,
        manualHoldSafetyTimerId: undefined,
        lastSensorAutoOnAt: undefined,
        manualOffLock: false,
        manualOffLockTimerId: undefined
    }
};

function trigger(source, value, variables, options, context) {
    try {
        variables.cachedLightService = source.getService();

        ensureExternalSubscription(variables, options);

        if (isSelfChanged(context)) {
            logInfo("Лампа изменена самим сценарием — пропуск", source, options.debug);
            return;
        }

        logInfo(
            () => "Лампа стала " + (value === true ? "ВКЛ" : "ВЫКЛ") +
                " (ручное удержание: " + (variables.manualHold ? "да" : "нет") +
                ", активность датчиков: " + (computeOccupancyActive(options) ? "есть" : "нет") + ")",
            source,
            options.debug
        );

        if (value === true) {
            releaseManualOffLock(variables, options, source);
            if (options.noAutoOffWhenManualOn === true && !variables.manualHold) {
                variables.manualHold = true;
                logInfo("Лампу включили извне — включаю ручное удержание (опция «не гасить после ручного включения»)", source, options.debug);
            }
            syncOffTimerWhenLightOnWithoutOccupancy(variables, options);
        } else {
            logInfo("Лампу выключили (вручную или извне) — сбрасываю ручное удержание и таймеры выключения", source, options.debug);
            variables.manualHold = false;
            variables.lastSensorAutoOnAt = undefined;
            clearOffTimer(variables, options, source);
            clearManualHoldSafetyTimer(variables, options, source);
            registerManualOff(variables, options, source);
        }
    } catch (e) {
        logError("Ошибка: " + e.message, source);
    }
}

function ensureExternalSubscription(variables, options) {
    if (variables.externalSubscribed) {
        return;
    }
    variables.externalSubscribed = true;

    // Защита от «зависших» подписок. При пересохранении сценария хаб исполняет
    // скрипт заново со свежим variables, но старый колбэк подписки остаётся жив
    // со «старым» variables (где, например, нет актуальной блокировки) и может
    // некорректно управлять светом. Метим каждую подписку «поколением» в общем
    // хранилище global (переживает пересохранение): актуальна только подписка
    // последнего поколения, более старые делают no-op. Если global недоступен —
    // защита просто отключается, поведение как раньше.
    const subGen = nextSubscriptionGeneration(variables);

    logInfo("Старт: подписка на датчики и ручные входы создана" + (subGen ? " (поколение " + subGen.gen + ")" : ""), variables.cachedLightService, options.debug);

    Hub.subscribeWithCondition(
        "",
        "",
        [
            HS.MotionSensor,
            HS.OccupancySensor,
            HS.ContactSensor,
            HS.LightSensor,
            HS.Switch,
            HS.StatelessProgrammableSwitch,
            HS.C_PulseMeter
        ],
        [
            HC.MotionDetected,
            HC.OccupancyDetected,
            HC.ContactSensorState,
            HC.CurrentAmbientLightLevel,
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
// к UUID управляемой лампы. Возвращает { key, gen } или null, если global
// недоступен/не сохраняет значения (тогда защита от зависших подписок отключена).
function nextSubscriptionGeneration(variables) {
    try {
        if (typeof global === "undefined" || global === null || !variables.cachedLightService) {
            return null;
        }
        const key = "MLA_subGen_" + variables.cachedLightService.getUUID();
        const next = (global[key] | 0) + 1;
        global[key] = next;
        if ((global[key] | 0) !== next) {
            return null;
        }
        return { key: key, gen: next };
    } catch (e) {
        return null;
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

    const luxOpt = options.luxSensor;
    if (luxOpt && luxOpt === uuid && ct === HC.CurrentAmbientLightLevel) {
        logInfo(() => "Датчик освещённости изменился (активность датчиков: " + (computeOccupancyActive(options) ? "есть" : "нет") + ")", src, options.debug);
        if (computeOccupancyActive(options)) {
            tryAutoTurnOn(variables, options, src);
        }
        return;
    }

    const gateOpt = options.gateAutoSwitch;
    if (gateOpt && gateOpt === uuid && st === HS.Switch && ct === HC.On) {
        logInfo(() => "Выключатель «Разрешение автоматики» стал " + (val === true ? "ВКЛ" : "ВЫКЛ") + " (активность датчиков: " + (computeOccupancyActive(options) ? "есть" : "нет") + ")", src, options.debug);
        if (computeOccupancyActive(options)) {
            tryAutoTurnOn(variables, options, src);
        }
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
        logInfo("Датчик активности сработал: " + (isSensorActiveValue(st, val) ? "активность" : "нет активности"), src, options.debug);
        applyOccupancyState(variables, options, src);
    }
}

// Обрабатывает событие ручного входа. Возвращает true, если событие относится к
// ручному управлению и обработано; false — если тип события к ручному управлению
// не относится (тогда событие идёт дальше, например в ветку датчиков активности).
function handleManualControlEvent(src, uuid, val, st, ct, variables, options) {
    if (st === HS.Switch && ct === HC.On) {
        if (val === true) {
            logInfo("Ручной выключатель ВКЛ — включаю лампу", src, options.debug);
            manualTurnOn(variables, options, src, true);
        } else if (isAnyManualSwitchOn(options, uuid)) {
            logInfo("Ручной выключатель ВЫКЛ, но другой ручной выключатель ещё ВКЛ — лампа остаётся включённой", src, options.debug);
        } else {
            logInfo("Ручной выключатель ВЫКЛ — выключаю лампу", src, options.debug);
            variables.manualHold = false;
            variables.lastSensorAutoOnAt = undefined;
            clearOffTimer(variables, options, src);
            clearManualHoldSafetyTimer(variables, options, src);
            setLightOn(variables.cachedLightService, false, options, src);
        }
        return true;
    }
    if (st === HS.ContactSensor && ct === HC.ContactSensorState && val === 1) {
        logInfo("Ручной контакт «Открытие» — включаю лампу, если она выключена", src, options.debug);
        manualTurnOnFromContact(variables, options, src);
        return true;
    }
    if (st === HS.StatelessProgrammableSwitch && ct === HC.ProgrammableSwitchEvent && val === 0) {
        logInfo("Ручная кнопка (нажатие) — переключаю лампу", src, options.debug);
        manualToggleFromButtonOrPulse(variables, options, src);
        return true;
    }
    if (st === HS.C_PulseMeter && ct === HC.C_PulseCount && val > 0) {
        logInfo("Ручной импульс — переключаю лампу", src, options.debug);
        manualToggleFromButtonOrPulse(variables, options, src);
        return true;
    }
    return false;
}

// Ручное выключение света при активных датчиках: при включённой опции
// noAutoOnAfterManualOff ставим блокировку повторного авто-включения. Она
// держится до момента, когда свет погас бы сам — все датчики (движение и
// присутствие) неактивны и прошёл таймаут offDelaySeconds (см.
// scheduleManualOffLockRelease). Пока активность есть, блокировка не снимается.
function registerManualOff(variables, options, logSource) {
    if (options.noAutoOnAfterManualOff === true && computeOccupancyActive(options)) {
        variables.manualOffLock = true;
        clearManualOffLockTimer(variables, options, logSource);
        logInfo("Блокировка ручного выключения ВКЛ: автоматика не будет включать свет, пока есть активность датчиков (снимется через " + options.offDelaySeconds + " с после её спада)", logSource, options.debug);
    }
}

// Запускает отсчёт снятия блокировки manualOffLock: по истечении offDelaySeconds
// при условии, что активности всё ещё нет (тот же момент, в который сработал бы
// обычный таймер выключения).
function scheduleManualOffLockRelease(variables, options, logSource) {
    clearManualOffLockTimer(variables, options, logSource);
    if (!variables.manualOffLock) {
        return;
    }
    const sec = options.offDelaySeconds;
    if (sec <= 0) {
        logInfo("Блокировка ручного выключения снята: таймаут выключения 0 с", logSource, options.debug);
        variables.manualOffLock = false;
        return;
    }
    logInfo("Блокировка ручного выключения: активность спала, сниму блокировку через " + sec + " с, если активность не вернётся", logSource, options.debug);
    const lightSvc = variables.cachedLightService;
    variables.manualOffLockTimerId = setTimeout(() => {
        variables.manualOffLockTimerId = undefined;
        if (computeOccupancyActive(options)) {
            logInfo("Блокировка ручного выключения сохраняется: активность вернулась до истечения таймаута", lightSvc, options.debug);
            return;
        }
        variables.manualOffLock = false;
        logInfo("Блокировка ручного выключения снята: свет погас бы сам (активности не было " + sec + " с)", lightSvc, options.debug);
    }, sec * 1000);
}

function clearManualOffLockTimer(variables, options, logSource) {
    if (variables.manualOffLockTimerId) {
        logInfo("Блокировка ручного выключения: отсчёт снятия отменён (активность вернулась)", logSource, options.debug);
        clearTimeout(variables.manualOffLockTimerId);
        variables.manualOffLockTimerId = undefined;
    }
}

// Полное снятие блокировки (при включении света): сбрасывает флаг и таймер.
function releaseManualOffLock(variables, options, logSource) {
    clearManualOffLockTimer(variables, options, logSource);
    variables.manualOffLock = false;
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
        logInfo("Кнопка/импульс проигнорированы (антидребезг: " + DEBOUNCE_MANUAL_AFTER_SENSOR_MS + " мс после включения по датчику)", logSource, options.debug);
        return;
    }
    if (!isLightCurrentlyOn(variables)) {
        logInfo("Переключение вручную: лампа была выключена — включаю", logSource, options.debug);
        manualTurnOn(variables, options, logSource, false);
        return;
    }
    logInfo("Переключение вручную: лампа была включена — выключаю", logSource, options.debug);
    manualTurnOffFromButtonOrPulse(variables, options, logSource);
}

// Контакт как ручной вход работает только на включение: «Открытие» включает
// выключенную лампу, а горящую не гасит, а лишь перезапускает таймер выключения
// (в отличие от кнопки/импульса — без toggle).
function manualTurnOnFromContact(variables, options, logSource) {
    if (shouldSuppressManualButtonOrPulseAfterSensorAuto(variables, options)) {
        logInfo("Контакт проигнорирован (антидребезг: " + DEBOUNCE_MANUAL_AFTER_SENSOR_MS + " мс после включения по датчику)", logSource, options.debug);
        return;
    }
    if (isLightCurrentlyOn(variables)) {
        logInfo("Ручной контакт: лампа уже включена — перезапускаю таймер выключения", logSource, options.debug);
        restartOffTimers(variables, options, logSource);
        return;
    }
    logInfo("Ручной контакт: лампа была выключена — включаю", logSource, options.debug);
    manualTurnOn(variables, options, logSource, false);
}

function manualTurnOffFromButtonOrPulse(variables, options, logSource) {
    clearOffTimer(variables, options, logSource);
    clearManualHoldSafetyTimer(variables, options, logSource);
    variables.lastSensorAutoOnAt = undefined;
    variables.manualHold = false;
    registerManualOff(variables, options, logSource);
    setLightOn(variables.cachedLightService, false, options, logSource);
}

// fromManualSwitch — включение пришло от ручного входа типа «Выключатель».
// Такое включение НЕ активирует режим «ручное удержание»: это самостоятельный
// механизм — пока выключатель в On, свет и так не гасят ни обычный, ни защитный
// таймер (все они проверяют isAnyManualSwitchOn).
function manualTurnOn(variables, options, logSource, fromManualSwitch) {
    clearOffTimer(variables, options, logSource);
    clearManualHoldSafetyTimer(variables, options, logSource);
    variables.lastSensorAutoOnAt = undefined;
    releaseManualOffLock(variables, options, logSource);
    if (fromManualSwitch === true) {
        variables.manualHold = false;
        logInfo("Свет следует за ручным выключателем — таймеры выключения не действуют, пока он в On", logSource, options.debug);
    } else if (options.noAutoOffWhenManualOn === true) {
        variables.manualHold = true;
        logInfo("Ручное удержание ВКЛ: опция «не гасить после ручного включения»", logSource, options.debug);
    } else {
        variables.manualHold = false;
    }
    setLightOn(variables.cachedLightService, true, options, logSource);
    restartOffTimers(variables, options, logSource);
}

// Перепланирует таймер выключения с нуля по текущему состоянию: при активности датчиков
// или ручном выключателе в On таймер не нужен, в режиме удержания идёт защитный таймер,
// иначе — обычный таймер offDelaySeconds.
function restartOffTimers(variables, options, logSource) {
    clearOffTimer(variables, options, logSource);
    clearManualHoldSafetyTimer(variables, options, logSource);
    if (isAnyManualSwitchOn(options) || computeOccupancyActive(options)) {
        return;
    }
    if (variables.manualHold) {
        scheduleManualHoldSafetyTimer(variables, options, logSource);
        return;
    }
    scheduleOffTimer(variables, options, logSource);
}

function applyOccupancyState(variables, options, logSource) {
    if (computeOccupancyActive(options)) {
        logInfo("Активность есть — снимаю таймеры выключения, пробую включить по датчику", logSource, options.debug);
        clearOffTimer(variables, options, logSource);
        clearManualHoldSafetyTimer(variables, options, logSource);
        clearManualOffLockTimer(variables, options, logSource);
        tryAutoTurnOn(variables, options, logSource);
        return;
    }
    logInfo("Активности на датчиках нет — планирую выключение", logSource, options.debug);
    scheduleManualOffLockRelease(variables, options, logSource);
    if (!isLightCurrentlyOn(variables)) {
        return;
    }
    if (!variables.manualHold) {
        scheduleOffTimer(variables, options, logSource);
        return;
    }
    scheduleManualHoldSafetyTimer(variables, options, logSource);
}

function tryAutoTurnOn(variables, options, logSource) {
    if (options.noAutoOnAfterManualOff === true && variables.manualOffLock === true) {
        logInfo("Включение по датчику отклонено: свет выключили вручную, блокировка активна (ждём ухода/таймаут)", logSource, options.debug);
        return;
    }
    if (!isAutoAutomationAllowed(options)) {
        logInfo("Включение по датчику отклонено: автоматика запрещена выключателем «Разрешение автоматики»", logSource, options.debug);
        return;
    }
    if (!isLuxAllowsAutoOn(options)) {
        logInfo(() => "Включение по датчику отклонено: слишком светло (сейчас " + readLux(options) + " лк, порог " + options.maxAmbientLux + " лк)", logSource, options.debug);
        return;
    }
    if (!variables.cachedLightService) {
        logInfo("Включение по датчику отклонено: лампа ещё не определена (ждём первый запуск)", logSource, options.debug);
        return;
    }
    if (isLightCurrentlyOn(variables)) {
        logInfo("Включение по датчику не требуется: лампа уже включена", logSource, options.debug);
        return;
    }
    variables.lastSensorAutoOnAt = Date.now();
    logInfo("Включаю лампу по датчику активности", logSource, options.debug);
    setLightOn(variables.cachedLightService, true, options, logSource);
}

function syncOffTimerWhenLightOnWithoutOccupancy(variables, options) {
    const occ = computeOccupancyActive(options);
    const lightSvc = variables.cachedLightService;
    if (variables.manualHold && !occ) {
        logInfo("Лампа включена и удерживается вручную, датчиков нет — запуск защитного таймаута ручного режима", lightSvc, options.debug);
        scheduleManualHoldSafetyTimer(variables, options, lightSvc);
        return;
    }
    if (variables.manualHold) {
        logInfo("Лампа включена, ручное удержание + активность датчиков — таймеры выключения не нужны", lightSvc, options.debug);
        return;
    }
    if (occ) {
        logInfo("Лампа включена, датчики активны — таймер выключения не нужен", lightSvc, options.debug);
        return;
    }
    logInfo("Лампа включена, датчиков нет — запуск таймера выключения", lightSvc, options.debug);
    scheduleOffTimer(variables, options, lightSvc);
}

function isAutoAutomationAllowed(options) {
    const g = options.gateAutoSwitch;
    if (!g || g === "") {
        return true;
    }
    const svc = getServiceFromListOption(options, "gateAutoSwitch");
    if (!svc) {
        return true;
    }
    const invert = options.gateAutoSwitchInvert === true;
    const gateIsOn = svc.getCharacteristic(HC.On).getValue() === true;
    return invert ? !gateIsOn : gateIsOn;
}

// Ручные входы (выключатели, кнопки, импульсы, контакты) игнорируются целиком,
// если включена опция «Также не реагировать на ручные входы» и выключатель
// «Разрешение автоматики» сейчас запрещает автоматику. Если разрешающий
// выключатель не выбран — блокировки нет.
function isManualInputBlockedByGate(options) {
    return options.gateBlocksManualInputs === true && !isAutoAutomationAllowed(options);
}

// Активное значение датчика активности: движение=true, присутствие=1, контакт «Открыто»=1.
function isSensorActiveValue(serviceType, value) {
    if (serviceType === HS.MotionSensor) {
        return value === true;
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
            if (svc.getCharacteristic(HC.MotionDetected).getValue() === true) {
                return true;
            }
        } else if (t === HS.OccupancySensor) {
            if (svc.getCharacteristic(HC.OccupancyDetected).getValue() === 1) {
                return true;
            }
        } else if (t === HS.ContactSensor) {
            if (svc.getCharacteristic(HC.ContactSensorState).getValue() === 1) {
                return true;
            }
        }
    }
    return false;
}

function readLux(options) {
    const svc = getServiceFromListOption(options, "luxSensor");
    if (!svc) {
        return null;
    }
    return svc.getCharacteristic(HC.CurrentAmbientLightLevel).getValue();
}

function isLuxAllowsAutoOn(options) {
    const lux = readLux(options);
    if (lux === null) {
        return true;
    }
    return lux <= options.maxAmbientLux;
}

// Проверяет, можно ли сейчас выключить свет, и выключает, если можно.
// Используется при offDelaySeconds=0 и в коллбэке offTimer'а.
function tryActuallyTurnOff(variables, options, logSource) {
    if (isAnyManualSwitchOn(options)) {
        logInfo("Выключение отменено: ручной выключатель в On удерживает свет", logSource, options.debug);
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
    logInfo("Выключаю лампу (активности нет)", logSource, options.debug);
    setLightOn(variables.cachedLightService, false, options, logSource);
}

function scheduleOffTimer(variables, options, logSource) {
    clearOffTimer(variables, options, logSource);
    if (isAnyManualSwitchOn(options)) {
        logInfo("Таймер выключения не нужен: ручной выключатель в On удерживает свет", logSource, options.debug);
        return;
    }
    const sec = options.offDelaySeconds;
    if (sec === 0) {
        logInfo("Задержка выключения 0 с — выключаю сразу (если можно)", logSource, options.debug);
        tryActuallyTurnOff(variables, options, logSource);
        return;
    }
    logInfo("Таймер выключения: выключу через " + sec + " с, если активность не вернётся", logSource, options.debug);
    variables.offTimerId = setTimeout(() => {
        variables.offTimerId = undefined;
        logInfo("Таймер выключения сработал", variables.cachedLightService, options.debug);
        tryActuallyTurnOff(variables, options, variables.cachedLightService);
    }, sec * 1000);
}

function clearOffTimer(variables, options, logSource) {
    if (variables.offTimerId) {
        logInfo("Таймер выключения сброшен", logSource, options.debug);
        clearTimeout(variables.offTimerId);
        variables.offTimerId = undefined;
    }
}

function scheduleManualHoldSafetyTimer(variables, options, logSource) {
    clearManualHoldSafetyTimer(variables, options, logSource);
    if (isAnyManualSwitchOn(options)) {
        logInfo("Защитный таймаут ручного режима не нужен: ручной выключатель в On удерживает свет", logSource, options.debug);
        return;
    }
    const sec = options.manualHoldSafetyOffDelayMinutes * 60;
    if (sec <= 0) {
        logInfo("Защитный таймаут ручного режима отключён (0 мин)", logSource, options.debug);
        return;
    }
    logInfo("Защитный таймаут ручного режима: выключу через " + sec + " с, если активности не будет", logSource, options.debug);
    variables.manualHoldSafetyTimerId = setTimeout(() => {
        variables.manualHoldSafetyTimerId = undefined;
        const lightSvc = variables.cachedLightService;
        logInfo("Защитный таймаут ручного режима сработал", lightSvc, options.debug);
        if (isAnyManualSwitchOn(options)) {
            logInfo("Защитный таймаут отменён: ручной выключатель в On", lightSvc, options.debug);
            return;
        }
        if (!variables.manualHold) {
            logInfo("Защитный таймаут отменён: ручное удержание уже снято", lightSvc, options.debug);
            return;
        }
        if (computeOccupancyActive(options)) {
            logInfo("Защитный таймаут отменён: снова появилась активность датчиков", lightSvc, options.debug);
            return;
        }
        variables.manualHold = false;
        variables.lastSensorAutoOnAt = undefined;
        logInfo("Защитный таймаут ручного режима: выключаю лампу", lightSvc, options.debug);
        setLightOn(lightSvc, false, options, lightSvc);
    }, sec * 1000);
}

function clearManualHoldSafetyTimer(variables, options, logSource) {
    if (variables.manualHoldSafetyTimerId) {
        logInfo("Защитный таймаут ручного режима сброшен", logSource, options.debug);
        clearTimeout(variables.manualHoldSafetyTimerId);
        variables.manualHoldSafetyTimerId = undefined;
    }
}

function setLightOn(lightSvc, on, options, logSource) {
    if (!lightSvc) {
        logInfo("Не удалось переключить лампу: привязанный сервис не определён", logSource, options.debug);
        return;
    }
    const ch = lightSvc.getCharacteristic(HC.On);
    ch.setValue(on === true);
    logInfo("Лампа переключена в " + (on === true ? "ВКЛ" : "ВЫКЛ"), ch, options.debug);
}

// Поддерживает ленивые строки: если передана функция, она вызывается только
// когда debug включён. Это спасает горячие пути от лишних вычислений
// (computeOccupancyActive, readLux и т.п.) при выключенной отладке.
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

function isLightCurrentlyOn(variables) {
    const light = variables.cachedLightService;
    if (!light) {
        return false;
    }
    return light.getCharacteristic(HC.On).getValue() === true;
}

function getServiceFromListOption(options, optionKey) {
    if (!options[optionKey] || options[optionKey] === "") {
        return undefined;
    }
    const cdata = options[optionKey].split(".");
    if (cdata.length < 2) {
        return undefined;
    }
    const accessory = Hub.getAccessory(cdata[0]);
    if (!accessory) {
        return undefined;
    }
    return accessory.getService(cdata[1]);
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
        if (svc.getCharacteristic(HC.On).getValue() === true) {
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

function createOptions() {
    const lists = collectServicesByTypes({
        motion: [HS.MotionSensor, HS.OccupancySensor, HS.ContactSensor],
        manual: [HS.Switch, HS.ContactSensor, HS.StatelessProgrammableSwitch, HS.C_PulseMeter],
        gate: [HS.Switch],
        lux: [HS.LightSensor]
    });
    const motionPickerList = lists.motion;
    const manualPickerList = lists.manual;
    const gateList = lists.gate;
    const luxList = lists.lux;

    const options = {};

    options.desc = {
        name: {en: "  DESCRIPTION", ru: "  ОПИСАНИЕ"},
        desc: scenarioDescription,
        type: "String",
        value: "",
        formType: "status"
    };

    options.groupSensors = {
        name: {
            ru: "  ДАТЧИКИ АКТИВНОСТИ",
            en: "  ACTIVITY SENSORS"
        },
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
                ru: "Выберите один датчик: движение, присутствие или касание. Для касания активным считается состояние «Открыто».",
                en: "Select one sensor: motion, occupancy, or contact. For contact, the active state is \"Open\"."
            };
        }
        options["motion" + mi] = motionOpt;
    }

    options.groupManualControl = {
        name: {ru: "  РУЧНЫЕ ВХОДЫ", en: "  MANUAL INPUTS"},
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
                ru: "Устройство для ручного управления светом. Выключатель: лампа повторяет его состояние; пока выключатель в On, авто-выключение по таймауту и защитный таймер не действуют — свет следует за выключателем. Кнопка и импульсы переключают привязанный свет; датчик открытия (контакт) работает только на включение: «Открытие» включает выключенный свет, горящий не гасит, «Закрытие» игнорируется.\nВнимание: не указывайте тут выключатель, на который активируется логика!",
                en: "Device for manual light control. Switch: the bound lamp follows its state; while the switch is On, auto-off and safety timer are disabled — the light follows the switch. Button and pulse toggle the bound output; the contact sensor only turns it on: Open turns the light on if it is off and never turns it off, Close is ignored.\nAttention: do not specify the switch that activates the logic here!"
            };
        }
        options["manualControl" + hi] = manualOpt;
    }

    options.groupLight = {
        name: {ru: "  ОСВЕЩЁННОСТЬ", en: "  LIGHT SENSOR"},
        type: "String",
        value: "",
        formType: "status"
    };

    options.luxSensor = {
        name: {ru: "Датчик освещённости", en: "Light sensor"},
        desc: {
            ru: "Необязательно. Если выбран — при освещённости выше порога автоматическое включение по датчикам не выполняется. Ручное включение не ограничивается.",
            en: "Optional. If set, auto-on by sensors is skipped when ambient light is above the threshold. Manual on is not blocked."
        },
        type: "String",
        value: "",
        formType: "list",
        values: luxList
    };

    options.maxAmbientLux = {
        name: {ru: "Порог освещённости (люкс)", en: "Ambient light threshold (lux)"},
        desc: {
            ru: "При значении датчика освещённости выше этого числа свет не включается автоматически. Если датчик не выбран — опция не используется.",
            en: "If ambient light is above this value, auto-on is blocked. Unused if no light sensor is set."
        },
        type: "Integer",
        value: 50,
        minValue: 0,
        maxValue: 100000,
        step: 1
    };

    options.groupAutomationLimits = {
        name: {ru: "  РАЗРЕШЕНИЕ АВТОМАТИКИ", en: "  ALLOW AUTOMATION"},
        type: "String",
        value: "",
        formType: "status"
    };

    options.gateAutoSwitch = {
        name: {ru: "Разрешение автоматики", en: "Allow automation"},
        desc: {
            ru: "Необязательно. Пока этот выключатель включён, разрешено автоматическое включение по датчикам, иначе только ручное включение. Пример: выключатель «День/Ночь», где «Ночь» = включён = ночная подсветка по движению. Если поле пустое — ограничения нет.",
            en: "Optional. While this switch is ON, auto-on by sensors is allowed; while OFF, only manual on. Example: Day/Night where Night=ON enables motion light. Empty = no gate."
        },
        type: "String",
        value: "",
        formType: "list",
        values: gateList
    };

    options.gateAutoSwitchInvert = {
        name: {ru: "Инвертировать выключатель «Разрешение автоматики»", en: "Invert the \"Allow automation\" switch"},
        desc: {
            ru: "Если включено, логика выключателя «Разрешение автоматики» инвертируется: пока он отключен, разрешено автоматическое включение по датчикам, иначе только ручное включение.",
            en: "If enabled, the logic of the \"Allow automation\" switch is inverted: while the switch is OFF, auto-on by sensors is allowed; otherwise only manual turn-on is allowed."
        },
        type: "Boolean",
        value: false
    };

    options.gateBlocksManualInputs = {
        name: {
            ru: "Также не реагировать на ручные входы",
            en: "Also ignore manual inputs"
        },
        desc: {
            ru: "Работает только вместе с выбранным выключателем «Разрешение автоматики». Если включено, то пока автоматика запрещена, сценарий не реагирует и на ручные входы: выключатели, кнопки, импульсы и датчики открытия — свет по ним не включается и не выключается.",
            en: "Only used together with the selected \"Allow automation\" switch. If enabled, while automation is blocked the scenario also ignores manual inputs — switches, buttons, pulse counters and contact sensors: they neither turn the light on nor off."
        },
        type: "Boolean",
        value: false
    };

    options.groupManualHold = {
        name: {ru: "  РУЧНОЕ УДЕРЖАНИЕ", en: "  MANUAL HOLD"},
        type: "String",
        value: "",
        formType: "status"
    };

    options.noAutoOffWhenManualOn = {
        name: {
            ru: "Не отключать свет автоматически после ручного включения",
            en: "Do not auto-turn off after manual on"
        },
        desc: {
            ru: "Если включено, то при включении света кнопкой/импульсом, а также при внешнем включении лампы (физический выключатель, привязанный к лампе, сцена, голосовая команда) свет не отключается по обычному таймауту — действует только защитный таймер «Задержка выключения после ручного включения».",
            en: "If enabled, when turning the light on with a button/pulse, or when the bound lamp is turned on externally (a physical switch directly wired to the lamp, scene, voice command), the light is not turned off by the regular timeout — only the safety timer «Safety off delay after manual turn-on» is used."
        },
        type: "Boolean",
        value: false
    };

    options.noAutoOnAfterManualOff = {
        name: {
            ru: "Не включать свет автоматически, если его отключили вручную",
            en: "Do not auto-on after manual off"
        },
        desc: {
            ru: "Если включено и свет выключили вручную (кнопкой, импульсом, сценой, голосом или физическим выключателем, привязанным к лампе), пока датчики ещё активны — автоматическое включение по датчикам не выполняется до момента, когда свет погас бы сам: все датчики (движение и присутствие) неактивны и прошёл таймаут «Задержка выключения». Это позволяет принудительно погасить свет, не борясь с автоматикой. Не относится к ручному входу типа «Выключатель» — для него «выключено» это рабочее состояние автоматики.",
            en: "If enabled and the light is turned off manually (button, pulse, scene, voice, or a physical switch wired to the lamp) while sensors are still active, auto-on by sensors is suppressed until the moment the light would have switched off by itself: all sensors (motion and occupancy) inactive and the «Off delay» timeout elapsed. This lets you force the light off without fighting the automation. Does not apply to the stateful manual switch input."
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
            ru: "Если включено, то попытка включить лампу кнопкой/импульсом в течение 5 секунд после авто-включения по датчику игнорируется. Служит в качестве защиты от ложного отключения сразу после авто-включения по датчику.",
            en: "If enabled, an attempt to turn the lamp on with a button/pulse within 5 seconds after sensor auto-on is ignored. This protects against false triggering immediately after sensor auto-on."
        },
        type: "Boolean",
        value: true
    };

    options.groupTimers = {
        name: {ru: "  ТАЙМЕРЫ ВЫКЛЮЧЕНИЯ", en: "  OFF TIMERS"},
        type: "String",
        value: "",
        formType: "status"
    };

    options.offDelaySeconds = {
        name: {ru: "Задержка выключения (с)", en: "Off delay (sec)"},
        desc: {
            ru: "Секунды до выключения после того, как все датчики перестали видеть активность; также после включения привязанного устройства, если датчики ничего не видят. Рекомендуется ставить не менее 30 секунд — этого достаточно, чтобы человек был обнаружен повторно после короткой паузы, и снижает ложные выключения.",
            en: "Seconds until off after all sensors are inactive; also after on of the bound device while sensors show no activity. Recommended at least 30 seconds — enough for a person to be detected again after a short pause and reduces false turn-offs."
        },
        type: "Integer",
        value: 30,
        minValue: 0,
        maxValue: 86400,
        step: 1
    };

    options.manualHoldSafetyOffDelayMinutes = {
        name: {
            ru: "Задержка выключения после ручного включения (мин)",
            en: "Safety off delay after manual turn-on (min)"
        },
        desc: {
            ru: "Защита от постоянно включённого света. Когда включена опция «Не отключать свет автоматически после ручного включения», а движения долго нет, свет всё равно выключается по этому таймеру. Значение 0 отключает защитный таймер. (По умолчанию 240 минут = 4 часа)",
            en: "Prevents permanently ON light. When «Do not auto-turn off after manual on» is enabled and there is no motion for long, light is still turned off by this timer. Set 0 to disable. (Default 240 minutes = 4 hours)"
        },
        type: "Integer",
        value: 240,
        minValue: 0,
        maxValue: 10080,
        step: 1
    };

    options.groupOther = {
        name: {ru: "  ПРОЧЕЕ", en: "  OTHER"},
        type: "String",
        value: "",
        formType: "status"
    };

    options.debug = {
        name: {
            ru: "Режим отладки",
            en: "Debug mode"
        },
        desc: {
            ru: "Включить вывод подробных информационных сообщений о событиях и действиях сценария в лог.",
            en: "Enable detailed informational messages about scenario events and actions in the log."
        },
        type: "Boolean",
        value: false
    };

    return options;
}

const DEBUG_TITLE = "Автоматизация света по движению: ";

const CONTEXT_CONSTANTS = {
    DELIMITER: " <- ",
    LOGIC_PREFIX: "LOGIC",
    CHARACTERISTIC_PREFIX: "C",
    MIN_ELEMENTS: 3
};
