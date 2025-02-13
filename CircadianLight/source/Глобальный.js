// Константы для улучшения читаемости
const MIN_BRIGHTNESS = 1;
const MAX_BRIGHTNESS = 100;
const MIN_COLOR_TEMPERATURE = 50;
const MAX_COLOR_TEMPERATURE = 400;
const MINUTES_IN_HOUR = 60;

const CIRCADIAN_LIGHT_DEBUG = false;
const CIRCADIAN_LIGHT_DEBUG_INFO = false;

function getCircadianLight(preset) {
    const date = new Date()
    const hours = date.getHours() | 0;
    const minute = date.getMinutes() | 0;

    const onTimePreset = global.getCircadianPreset(preset)
    const tempAndBright = onTimePreset[hours]
    const nextTempAndBright = hours < 23 ? onTimePreset[hours + 1] : onTimePreset[0];

    var temp = tempAndBright[0] + ((nextTempAndBright[0] - tempAndBright[0]) / MINUTES_IN_HOUR * minute)
    var bright = tempAndBright[1] + ((nextTempAndBright[1] - tempAndBright[1]) / MINUTES_IN_HOUR * minute)
    temp = Math.round(Math.max(MIN_COLOR_TEMPERATURE, Math.min(MAX_COLOR_TEMPERATURE, temp))) | 0;
    bright = Math.round(Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, bright))) | 0;
    //if (CIRCADIAN_LIGHT_DEBUG) console.info("Циркадное освещение. Получение. Время {}:{}. Режим {}. Температура {} и яркость {}", hours, minute, preset, temp, bright)
    return [temp, bright];
}

function setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate) {


    if (service.getType() != HS.Lightbulb) return;

    const tempAndBright = getCircadianLight(preset);
    const temp = tempAndBright[0];
    const bright = tempAndBright[1];
    let hueAndSaturation = [0, 0]

    if (CIRCADIAN_LIGHT_DEBUG_INFO)
        console.info(
            "Циркадное освещение.  Режим: {}. Температура: {}. Яркость: {}, Не менять: яркость: {}, температуру: {}, оттенок: {}, насыщенность: {}. {}",
            preset,
            temp,
            bright,
            dontChangeBright,
            dontChangeTemp,
            dontChangeHue,
            dontChangeSaturate,
            getCircadianLightServiceName(service)
        )

    let allowTemperatureChange = !dontChangeTemp
    let allowHueChange = !dontChangeHue
    let allowSaturationChange = !dontChangeSaturate
    let allowBrightChange = !dontChangeBright

    const brightness = service.getCharacteristic(HC.Brightness);
    if (brightness == null) {
        console.warn("Циркадное освещение. Лампочка {}, не умеет изменять яркость", getCircadianLightServiceName(service))
        return;
    }

    const temperature = service.getCharacteristic(HC.ColorTemperature);
    if (temperature == null) {
        allowTemperatureChange = false
    }

    const hue = service.getCharacteristic(HC.Hue);
    const saturation = service.getCharacteristic(HC.Saturation);
    if (hue == null || saturation == null) {
        allowHueChange = hue != null
        allowSaturationChange = saturation != null
    } else {
        hueAndSaturation = getHueAndSaturationFromMired(temp)
    }

    if (!allowBrightChange && !allowTemperatureChange && !allowHueChange && !allowSaturationChange) {
        console.warn("Циркадное освещение. Для лампочки {}, запрещено менять все параметры сценарием или свойствами", getCircadianLightServiceName(service))
        return
    }

    const bulb = service.getCharacteristic(HC.On);
    bulb.setValue(true);

    if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        const name = getCircadianLightServiceName(service)

        var text = "Циркадное освещение. Установлено: "
        if (allowTemperatureChange) text += " Температура " + temp + ";"
        if (allowBrightChange) text += " Яркость " + bright + ";"
        else {
            if (allowHueChange) text += " Оттенок " + hueAndSaturation[0] + ";"
            if (allowSaturationChange) text += " Насыщенность " + hueAndSaturation[1] + ";"
        }
        text += " " + name
        console.info(text)
    }

    if (allowTemperatureChange && temperature.getValue() != temp)
        temperature.setValue(temp);
    else {
        if (allowHueChange && hue.getValue() != hueAndSaturation[0])
            hue.setValue(hueAndSaturation[0])
        if (allowSaturationChange && saturation.getValue() != hueAndSaturation[1])
            saturation.setValue(hueAndSaturation[1])
    }

    if (allowBrightChange && brightness.getValue() != bright)
        brightness.setValue(bright)
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
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " ("+service.getUUID()+")"
    return name
}

function getCircadianLightModes() {
    let cList = [];
    let onTime = global.onTime
    let keys = Object.keys(global.onTime);
    let defaultNames = {0: "Дольше яркий", 1: "Раннее затемнение", 2: "Всегда полная яркость"}

    keys.forEach(function (key) {
        let name = onTime[key].name ? onTime[key].name : key.toString() + " ("+defaultNames[key]+")"
        cList.push({
            name: { ru: name, en: name },
            value: parseInt(key)
        });
    })
    return cList
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

function disableCircadianLightFor(service) {
    GlobalVariables[getCircadianLightGlobalVariableForDisable(service)] = true
}

function enableCircadianLightFor(service) {
    GlobalVariables[getCircadianLightGlobalVariableForDisable(service)] = false
}

function resetCircadianLightFor(service) {
    GlobalVariables[getCircadianLightGlobalVariableForReset(service)] = true
}
