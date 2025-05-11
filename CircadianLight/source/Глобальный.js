const VERSION = "6.0"

// Константы для улучшения читаемости
const MIN_BRIGHTNESS = 1;
const MAX_BRIGHTNESS = 100;
const MIN_COLOR_TEMPERATURE = 50;
const MAX_COLOR_TEMPERATURE = 400;
const MINUTES_IN_HOUR = 60;
const DEBUG_TITLE = "Циркадное освещение. "

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
    if (global.getCircadianLightDynamicParams) {
        return global.getCircadianLightDynamicParams(hours, minute, preset, temp, bright, uuid)
    } else {
        return [temp, bright];
    }
}


function setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, changeTempDelay, isDebug, isDebugAll) {
    const date = new Date()
    const hours = date.getHours() | 0;
    const minute = date.getMinutes() | 0;
    return setCircadianLightForServiceForTime(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, changeTempDelay, isDebug, isDebugAll, hours, minute)
}

function setCircadianLightForServiceForTime(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, changeTempDelay, isDebug, isDebugAll, hours, minute) {

    const debugPrefix = DEBUG_TITLE + getCircadianLightServiceName(service) + " "

    if (service.getType() != HS.Lightbulb) return false;
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
    if (brightness == null) {
        console.warn(debugPrefix + "Лампочка {}, не умеет изменять яркость", getCircadianLightServiceName(service))
        return false;
    }

    const temperature = service.getCharacteristic(HC.ColorTemperature);
    const hue = service.getCharacteristic(HC.Hue);
    const saturation = service.getCharacteristic(HC.Saturation);

    let allowBrightChange = !dontChangeBright
    let allowTemperatureChange = !dontChangeTemp && temperature != null
    let allowHueChange = !dontChangeHue && hue != null
    let allowSaturationChange = !dontChangeSaturate && saturation != null
    let canTemperatureChange = temperature != null

    if (!canTemperatureChange && (allowHueChange || allowSaturationChange)) {
        hueAndSaturation = getHueAndSaturationFromMired(temp)
    }

    if (!allowBrightChange && !allowTemperatureChange && !allowHueChange && !allowSaturationChange) {
        console.warn(debugPrefix + "Для лампочки {}, запрещено менять все параметры сценарием или свойствами", getCircadianLightServiceName(service))
        return false;
    }

    const onCharacteristic = service.getCharacteristic(HC.On);
    onCharacteristic.setValue(true);

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
            }, 1000)
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
        if (accessory == null) {
            console.error("Лампочка {} не найдена", accessoryId);
            return;
        }

        let service = accessory.getService(HS.Lightbulb);
        setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate)
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
    let onTime = global.onTime
    let keys = Object.keys(global.onTime);
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

let inTestMode = false

function setSafeTimeout(callback, delay) {
    if (inTestMode) {
        callback();
    } else {
        return setTimeout(callback, delay);
    }
}

// Примеры использования для тестирования
function runTests() {
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
        setCircadianLightForServiceForTime(serviceTemp, preset, false, false, false, false, false, false, false, hours, minute)
        assertEquals(serviceTemp.getCharacteristic(HC.ColorTemperature).getValue(), 300, "Тест 2. Температура не совпадает")
        assertEquals(serviceTemp.getCharacteristic(HC.Brightness).getValue(), 60, "Тест 2. Яркость не совпадает")

        let serviceHue = acc.getServices()[1];
        setCircadianLightForServiceForTime(serviceHue, preset, false, false, false, false, false, false, false, hours, minute)
        assertEquals(serviceHue.getCharacteristic(HC.Saturation).getValue(), 44, "Тест 3. Насыщенность не совпадает")
        assertEquals(serviceHue.getCharacteristic(HC.Hue).getValue(), 32, "Тест 3. Оттенок не совпадает")
        assertEquals(serviceHue.getCharacteristic(HC.Brightness).getValue(), 60, "Тест 3. Яркость не совпадает")
        console.info(DEBUG_TITLE + "Тесты пройдены")
    } finally {
        inTestMode = false
    }
}

function getCircadianLightGlobalVariableForReset(service) {
    return "CircadianLight_" + service.getUUID() + "_reset"
}

function getCircadianLightGlobalVariableForDisable(service) {
    return "CircadianLight_" + service.getUUID() + "_disabled"
}


// Функции для управления циркадным режимом из своих сценариев
function resetCircadianLight(service) {
    GlobalVariables[getCircadianLightGlobalVariableForReset(service)] = true
}

function setCircadianLightDisabled(service, disabled) {
    GlobalVariables[getCircadianLightGlobalVariableForDisable(service)] = disabled
}

function setCircadianLightEnabled(service, enabled) {
    GlobalVariables[getCircadianLightGlobalVariableForDisable(service)] = !enabled
}

function disableCircadianLightFor(services) {
    toArray(services).forEach(function (service) { GlobalVariables[getCircadianLightGlobalVariableForDisable(service)] = true; })
}

function enableCircadianLightFor(services) {
    toArray(services).forEach(function (service) { GlobalVariables[getCircadianLightGlobalVariableForDisable(service)] = false; })
}

function resetCircadianLightFor(services) {
    toArray(services).forEach(function (service) { GlobalVariables[getCircadianLightGlobalVariableForReset(service)] = true; })
}
runTests();
