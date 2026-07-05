const VERSION = "7.0"

// Константы для ключей режимов
const MODE_SUNRISE = "sunrise";
const MODE_SUNSET = "sunset";

// Константы для улучшения читаемости
const MIN_BRIGHTNESS = 1;
const MAX_BRIGHTNESS = 100;
const MIN_COLOR_TEMPERATURE = 50;
const MAX_COLOR_TEMPERATURE = 400;
const MINUTES_IN_HOUR = 60;
const DEBUG_TITLE = "Циркадное освещение. "

// Константы для временных интервалов (в миллисекундах)
const LAMP_TOGGLE_DELAY_MS = 1000;
const TEMP_CHANGE_DELAY_MS = 1000;
const MINUTES_TO_MS = 60 * 1000;

function getCircadianLight(preset, uuid) {
    const date = new Date()
    const hours = date.getHours() | 0;
    const minute = date.getMinutes() | 0;
    return getCircadianLightForTime(hours, minute, preset, uuid);
}

function getCircadianLightForTime(hours, minute, preset, uuid) {

    function getValueFromPreset(onTimePreset, hours) { let h = (hours | 0) + ""; return (Object.keys(onTimePreset).indexOf(h) >= 0) ? onTimePreset[h] : [50, 100]; }

    const onTimePreset = global.getCircadianPreset(preset)
    const tempAndBright = getValueFromPreset(onTimePreset, hours)
    const nextTempAndBright = hours < 23 ? getValueFromPreset(onTimePreset, hours + 1) : getValueFromPreset(onTimePreset, 0);

    var temp = tempAndBright[0] + ((nextTempAndBright[0] - tempAndBright[0]) / MINUTES_IN_HOUR * minute)
    var bright = tempAndBright[1] + ((nextTempAndBright[1] - tempAndBright[1]) / MINUTES_IN_HOUR * minute)
    temp = Math.round(Math.max(MIN_COLOR_TEMPERATURE, Math.min(MAX_COLOR_TEMPERATURE, temp))) | 0;
    bright = Math.round(Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, bright))) | 0;
    
    // Обрабатываем режимы рассвета/заката перед динамическими параметрами
    if (processMode) {
        const dawnResult = processMode(hours, minute, preset, temp, bright, uuid)
        temp = dawnResult[0]
        bright = dawnResult[1]
    }
    
    if (global.getCircadianLightDynamicParams) {
        return global.getCircadianLightDynamicParams(hours, minute, preset, temp, bright, uuid)
    } else {
        return [temp, bright];
    }
}


function setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, changeTempDelay, isDebug, isDebugAll, notForceTurnOn) {
    const date = new Date()
    const hours = date.getHours() | 0;
    const minute = date.getMinutes() | 0;
    return setCircadianLightForServiceForTime(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, changeTempDelay, isDebug, isDebugAll, hours, minute, notForceTurnOn)
}

function setCircadianLightForServiceForTime(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, changeTempDelay, isDebug, isDebugAll, hours, minute, notForceTurnOn) {

    const debugPrefix = DEBUG_TITLE + getCircadianLightServiceName(service) + " "

    if (service.getType() !== HS.Lightbulb) return false;

    if (notForceTurnOn === true) {
        var onChar = service.getCharacteristic(HC.On);
        if (!onChar || !onChar.getValue()) {
            console.info(debugPrefix + "Лампа выключена, установка циркадных значений пропущена");
            return false;
        }
    }
    const uuid = service.getUUID()

    const tempAndBright = getCircadianLightForTime(hours, minute, preset, uuid);
    const temp = tempAndBright[0];
    const bright = tempAndBright[1];
    let hueAndSaturation = [0, 0]

    if (isDebug && isDebugAll)
        console.info(
            debugPrefix + "Запрос: Температура: {}. Яркость: {}, Не менять яркость: {}, температуру: {}, оттенок: {}, насыщенность: {}",
            temp,
            bright,
            dontChangeBright,
            dontChangeTemp,
            dontChangeHue,
            dontChangeSaturate
        )

    const brightness = service.getCharacteristic(HC.Brightness);
    if (brightness === null) {
        console.warn(debugPrefix + "Лампочка {}, не умеет изменять яркость", getCircadianLightServiceName(service))
        return false;
    }

    const temperature = service.getCharacteristic(HC.ColorTemperature);
    const hue = service.getCharacteristic(HC.Hue);
    const saturation = service.getCharacteristic(HC.Saturation);

    let allowBrightChange = !dontChangeBright
    let allowTemperatureChange = !dontChangeTemp && temperature !== null
    let allowHueChange = !dontChangeHue && hue !== null
    let allowSaturationChange = !dontChangeSaturate && saturation !== null
    let canTemperatureChange = temperature !== null

    if (!canTemperatureChange && (allowHueChange || allowSaturationChange)) {
        hueAndSaturation = getHueAndSaturationFromMired(temp)
    }

    if (!allowBrightChange && !allowTemperatureChange && !allowHueChange && !allowSaturationChange) {
        console.warn(debugPrefix + "Для лампочки {}, запрещено менять все параметры сценарием или свойствами", getCircadianLightServiceName(service))
        return false;
    }

    if (isDebug) {
        var text = debugPrefix + "Установлено: "
        if (allowBrightChange) text += " Яркость " + bright + ";"
        if (canTemperatureChange) {
            if (allowTemperatureChange) text += " Температура " + temp
        }
        else {
            if (allowHueChange || allowSaturationChange) {
                text += " Температура " + temp + " ("
                if (allowHueChange) text += " Оттенок " + hueAndSaturation[0]
                if (allowSaturationChange) text += " Насыщенность " + hueAndSaturation[1]
                text += ")"
            }
        }
        console.info(text)
    }

    if (allowBrightChange)
        brightness.setValue(bright)

    if (allowTemperatureChange || allowHueChange || allowSaturationChange) {
        function changeTemp() {
            if (canTemperatureChange) {
                if (allowTemperatureChange) temperature.setValue(temp)
            } else {
                if (allowHueChange)
                    hue.setValue(hueAndSaturation[0])
                if (allowSaturationChange)
                    saturation.setValue(hueAndSaturation[1])
            }
        }
        if (changeTempDelay) {
            setSafeTimeout(() => {
                changeTemp()
            }, TEMP_CHANGE_DELAY_MS)
        } else {
            changeTemp()
        }
    }
    return true
}

function setCircadianLight(aId, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate) {
    if (!Array.isArray(aId)) {
        aId = [aId];
    }

    for (var i in aId) {
        let accessoryId = aId[i];
        let accessory = Hub.getAccessory(accessoryId);
        if (accessory === null) {
            console.error("Лампочка {} не найдена", accessoryId);
            return;
        }

        let service = accessory.getService(HS.Lightbulb);
        setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, false, false, false)
    }
}

function getHueAndSaturationFromMired(mired) {
    if (mired < 50 || mired > 400) {
        throw new Error("Mired value must be between 50 and 400.");
    }
    var hueAndSat = global.getMiredToHueAndSaturationMap()
    if (mired % 10 === 0) {
        return hueAndSat[mired];
    } else {
        const lowerMired = mired - (mired % 10)
        const lower = hueAndSat[lowerMired]
        const upper = hueAndSat[mired + (10 - (mired % 10))]

        const t = (mired - lowerMired) / 10;
        const hue = Math.round(lower[0] + t * (upper[0] - lower[0])) | 0;
        const saturation = Math.round(lower[1] + t * (upper[1] - lower[1])) | 0;

        return [hue, saturation];
    }
}

function getCircadianLightServiceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыта. " : "")
    return name
}

function getCircadianLightModes() {
    let cList = [];
    if (!global.onTime) {
        return [];
    }
    let onTime = global.onTime;
    let keys = Object.keys(onTime);
    let defaultNames = {
        0: "Дольше яркий",
        1: "Раннее затемнение",
        2: "Всегда полная яркость",
        3: "Режим 3 (Кастомный)",
        4: "Режим 4 (Кастомный)",
        5: "Режим 5 (Кастомный)",
        6: "Режим 6 (Кастомный)",
        7: "Режим 7 (Кастомный)",
        8: "Режим 8 (Кастомный)",
        9: "Режим 9 (Кастомный)",
        10: "Режим 10 (Кастомный)",
    }

    keys.forEach(function (key) {
        let name = onTime[key].name ? onTime[key].name : key.toString() + " (" + defaultNames[key] + ")"
        cList.push({
            name: { ru: name, en: name },
            value: parseInt(key)
        });
    })
    let defaultKeys = Object.keys(defaultNames)
    if (cList.length < defaultKeys.length) {
        for (let i = 0; i < defaultKeys.length; i++) {
            if ((cList.length - 1) < i) {
                let name = defaultNames[i]
                cList.push({
                    name: { ru: name, en: name },
                    value: i
                });
            }
        }
    }
    return cList
}

function toArray(items) {
    if (!Array.isArray(items)) {
        items = [items];
    }
    return items
}

// Функции управления режимами рассвета/заката
function enableModeFor(service, mode, keepOn) {
    if (!service || !mode) {
        console.error("enableModeFor: сервис или режим не указан {} {}", service, mode)
        return false
    }

    if (!GlobalVariables.CIRCADIAN_LIGHT_MODES_CONFIG || !GlobalVariables.CIRCADIAN_LIGHT_MODES_CONFIG[mode]) {
        console.error("enableModeFor: неизвестный режим:", mode)
        return false
    }

    GlobalVariables[getModeGlobalVariable(service)] = mode
    GlobalVariables[getModeStartTimeVariable(service)] = Date.now()
    GlobalVariables[getModeKeepOnVariable(service)] = keepOn === true

    console.info("Циркадное освещение. Включен режим {} для {}",
        GlobalVariables.CIRCADIAN_LIGHT_MODES_CONFIG[mode].name, getCircadianLightServiceName(service))

    circadianLightCallbackFire(service, "changeMode", { mode: mode, keepOn: keepOn === true });
    return true;
}

function disableModeForServices(services) {
    toArray(services).forEach(function (service) {
        const modeVar = getModeGlobalVariable(service);
        const startTimeVar = getModeStartTimeVariable(service);

        if (GlobalVariables[modeVar]) {
            console.info("Циркадное освещение. Отключен режим {} для {}",
                GlobalVariables[modeVar], getCircadianLightServiceName(service));

            GlobalVariables[modeVar] = undefined;
            GlobalVariables[startTimeVar] = undefined;
            circadianLightCallbackFire(service, "reset", {});
        }
    });
}

function getModeStatus(service) {
    const modeVar = getModeGlobalVariable(service)
    return GlobalVariables[modeVar] || null
}

function getModeProgress(service) {
    const mode = getModeStatus(service)
    const cfg = GlobalVariables.CIRCADIAN_LIGHT_MODES_CONFIG
    if (!mode || !cfg || !cfg[mode]) { // M8: не падаем, если конфиг не загружен
        return 0
    }

    const startTime = GlobalVariables[getModeStartTimeVariable(service)]
    if (!startTime) {
        return 0
    }

    const durationMin = cfg[mode].duration
    if (!(durationMin > 0)) { // M6: некорректная длительность → завершено, без деления на 0
        return 1
    }

    const elapsed = Date.now() - startTime
    return Math.min(elapsed / (durationMin * MINUTES_TO_MS), 1.0) // максимум 1.0 (100%)
}

// Функция для более естественной интерполяции (ease-in-out)
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// Функция обработки режимов рассвета/заката
function processMode(hours, minute, preset, temp, bright, serviceUUID) {
    // Если UUID не передан, возвращаем исходные значения
    if (!serviceUUID) {
        return [temp, bright]
    }
    
    // Получаем сервис по UUID
    const uuidParts = serviceUUID.split('.')
    if (uuidParts.length !== 2) {
        return [temp, bright]
    }
    
    const accessory = Hub.getAccessory(parseInt(uuidParts[0]))
    if (!accessory) {
        return [temp, bright]
    }
    
    const service = accessory.getService(parseInt(uuidParts[1]))
    if (!service) {
        return [temp, bright]
    }
    
    const mode = getModeStatus(service)
    if (!mode) {
        return [temp, bright]
    }

    const cfg = GlobalVariables.CIRCADIAN_LIGHT_MODES_CONFIG
    if (!cfg || !cfg[mode]) {
        return [temp, bright]
    }

    // Чистая интерполяция, без side-effect (M2). getModeProgress ограничивает progress ∈ [0,1];
    // при progress=1: рассвет → циркадное значение (плавный стык), закат → держит [400,1] (M1).
    const easedProgress = easeInOutQuad(getModeProgress(service))
    
    let newTemp = temp
    let newBright = bright
    
    if (mode === MODE_SUNRISE) {
        // Рассвет: от 1% яркости и максимально теплого света (400 mired) к целевым значениям
        const startBright = 1
        const startTemp = 400 // максимально теплый
        
        newBright = startBright + (bright - startBright) * easedProgress
        newTemp = startTemp + (temp - startTemp) * easedProgress
        
    } else if (mode === MODE_SUNSET) {
        // Закат: от текущих значений к 1% яркости и максимально теплому свету
        const endBright = 1
        const endTemp = 400 // максимально теплый
        
        newBright = bright + (endBright - bright) * easedProgress
        newTemp = temp + (endTemp - temp) * easedProgress
    }
    
    // Ограничиваем значения
    newBright = Math.max(1, Math.min(100, Math.round(newBright)))
    newTemp = Math.max(50, Math.min(400, Math.round(newTemp)))
    
    return [newTemp, newBright]
}

let inTestMode = false

function setSafeTimeout(callback, delay) {
    if (inTestMode) {
        callback();
    } else {
        return setTimeout(callback, delay);
    }
}

// Примеры использования для тестирования
function runMasterSwitchTests() {
    if (!global.hasUnitTests) { return; }

    try {
        inTestMode = true
        let assert = global.assert; let assertNull = global.assertNull; let assertNotNull = global.assertNotNull; let assertEquals = global.assertEquals; let assertNotEquals = global.assertNotEquals; let assertTrue = global.assertTrue; let assertFalse = global.assertFalse; let assertDefined = global.assertDefined; let assertContains = global.assertContains; let assertEmpty = global.assertEmpty; let assertNotEmpty = global.assertNotEmpty; let assertLength = global.assertLength;

        let lampAccInfo = { id: 1, name: "Лампочка", room: "Тест", model: "", modelId: "", manufacturer: "", manufacturerId: "", serial: "", firmware: "", services: [{ id: 10, type: HS.Lightbulb, name: "Лампочка Температуры", characteristics: [{ id: 11, type: HC.On, value: !0 }, { id: 12, type: HC.Brightness, name: "Яркость", value: 100 }, { id: 13, type: HC.ColorTemperature, name: "Температура", value: 400 }] }, { id: 20, type: HS.Lightbulb, name: "Лампочка Цвет", characteristics: [{ id: 21, type: HC.On, value: !0 }, { id: 22, type: HC.Brightness, name: "Яркость", value: 100 }, { id: 23, type: HC.Saturation, name: "Насыщенность", value: 0 }, { id: 24, type: HC.Hue, name: "Оттенок", value: 0 }] }] };
        let hours = 0
        let minute = 30
        let preset = 99999

        let valuesForTime = getCircadianLightForTime(hours, minute, preset, "1.1")
        assertLength(valuesForTime, 2)
        assertEquals(valuesForTime[0], 300, "Тест 1. Температура не совпадает")
        assertEquals(valuesForTime[1], 60, "Тест 1. Яркость не совпадает")

        let acc = global.createUnitTestFullAccessory(lampAccInfo)
        let serviceTemp = acc.getServices()[0];
        setCircadianLightForServiceForTime(serviceTemp, preset, false, false, false, false, false, false, false, hours, minute, false)
        assertEquals(serviceTemp.getCharacteristic(HC.ColorTemperature).getValue(), 300, "Тест 2. Температура не совпадает")
        assertEquals(serviceTemp.getCharacteristic(HC.Brightness).getValue(), 60, "Тест 2. Яркость не совпадает")

        let serviceHue = acc.getServices()[1];
        setCircadianLightForServiceForTime(serviceHue, preset, false, false, false, false, false, false, false, hours, minute, false)
        assertEquals(serviceHue.getCharacteristic(HC.Saturation).getValue(), 44, "Тест 3. Насыщенность не совпадает")
        assertEquals(serviceHue.getCharacteristic(HC.Hue).getValue(), 32, "Тест 3. Оттенок не совпадает")
        assertEquals(serviceHue.getCharacteristic(HC.Brightness).getValue(), 60, "Тест 3. Яркость не совпадает")
        console.info(DEBUG_TITLE + "Тесты пройдены")
    } finally {
        inTestMode = false
    }
}

function getModeGlobalVariable(service) {
    return "CircadianLight_Mode_" + service.getUUID() + "_active"
}

function getModeStartTimeVariable(service) {
    return "CircadianLight_Mode_" + service.getUUID() + "_startTime"
}

function getModeKeepOnVariable(service) {
    return "CircadianLight_Mode_" + service.getUUID() + "_keepOn"
}

// Держать ли лампу на финальном значении заката до ручного действия.
function getModeKeepOn(service) {
    return GlobalVariables[getModeKeepOnVariable(service)] === true
}

// Чистая очистка состояния режима (без callback — вызывается финализацией в логическом).
function clearModeState(service) {
    GlobalVariables[getModeGlobalVariable(service)] = undefined
    GlobalVariables[getModeStartTimeVariable(service)] = undefined
    GlobalVariables[getModeKeepOnVariable(service)] = undefined
}

// Чистое решение о завершении режима: "none" | "sunrise-complete" | "sunset-off" | "sunset-hold".
function getModeFinalization(service) {
    const mode = getModeStatus(service)
    if (!mode || getModeProgress(service) < 1) {
        return "none"
    }
    if (mode === MODE_SUNRISE) {
        return "sunrise-complete"
    }
    if (mode === MODE_SUNSET) {
        return getModeKeepOn(service) ? "sunset-hold" : "sunset-off"
    }
    return "none"
}

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

// Функции для управления циркадным режимом из своих сценариев (вызывают коллбек)
function resetCircadianLight(service) {
    circadianLightCallbackFire(service, "reset", {});
}

function setCircadianLightDisabled(service, disabled) {
    circadianLightCallbackFire(service, disabled ? "disable" : "enable", {});
}

function setCircadianLightEnabled(service, enabled) {
    circadianLightCallbackFire(service, enabled ? "enable" : "disable", {});
}

function disableCircadianLightFor(services) {
    toArray(services).forEach(function (service) { circadianLightCallbackFire(service, "disable", {}); });
}

function enableCircadianLightFor(services) {
    toArray(services).forEach(function (service) { circadianLightCallbackFire(service, "enable", {}); });
}

function resetCircadianLightFor(services) {
    toArray(services).forEach(function (service) { circadianLightCallbackFire(service, "reset", {}); });
}

// Включить режим рассвета для одной лампы:
// global.enableSunriseModeFor(Hub.getAccessory(99).getService(HS.Lightbulb))
function enableSunriseModeFor(services) {
    toArray(services).forEach(function (service) {  enableModeFor(service, MODE_SUNRISE)})
}

// Включить режим заката для одной лампы:
// global.enableSunsetModeFor(Hub.getAccessory(99).getService(HS.Lightbulb))
function enableSunsetModeFor(services, keepOn) {
    toArray(services).forEach(function (service) { enableModeFor(service, MODE_SUNSET, keepOn) })
}

// Отключить все режимы для лампы:
// global.disableModeFor(Hub.getAccessory(99).getService(HS.Lightbulb))
function disableModeFor(services) {
    disableModeForServices(services)
}


runMasterSwitchTests();
