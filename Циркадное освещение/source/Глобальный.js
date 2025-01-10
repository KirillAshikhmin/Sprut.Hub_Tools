// Режим: { Час: [Температура, Яркость] }
var onTime = {

    // Долго держится большая яркость, температура света утром холоднеет медленнее
    0: {
        0: [400, 60],
        1: [400, 60],
        2: [400, 60],
        3: [400, 30],
        4: [400, 30],
        5: [400, 30],
        6: [400, 70],
        7: [350, 100],
        8: [300, 100],
        9: [250, 100],
        10: [150, 100],
        11: [100, 100],
        12: [50, 100],
        13: [50, 100],
        14: [50, 100],
        15: [50, 100],
        16: [100, 100],
        17: [150, 100],
        18: [200, 100],
        19: [250, 100],
        20: [300, 90],
        21: [350, 60],
        22: [400, 60],
        23: [400, 60]
    },

    // Яркость вечером уменьшается раньше, утром включается холодный свет
    1: {
        0: [400, 20],
        1: [400, 20],
        2: [400, 10],
        3: [400, 10],
        4: [400, 10],
        5: [400, 10],
        6: [150, 70],
        7: [100, 100],
        8: [50, 100],
        9: [50, 100],
        10: [50, 100],
        11: [50, 100],
        12: [50, 100],
        13: [50, 100],
        14: [50, 100],
        15: [50, 100],
        16: [100, 100],
        17: [150, 100],
        18: [200, 100],
        19: [250, 100],
        20: [300, 90],
        21: [350, 60],
        22: [400, 40],
        23: [400, 30]
    },
    // С постоянной максимальной яркостью. утром включается холодный свет
    2: {
        0: [400, 100],
        1: [400, 100],
        2: [400, 100],
        3: [400, 100],
        4: [400, 100],
        5: [400, 100],
        6: [300, 100],
        7: [150, 100],
        8: [50, 100],
        9: [50, 100],
        10: [50, 100],
        11: [50, 100],
        12: [50, 100],
        13: [50, 100],
        14: [50, 100],
        15: [50, 100],
        16: [100, 100],
        17: [150, 100],
        18: [200, 100],
        19: [250, 100],
        20: [300, 100],
        21: [350, 100],
        22: [400, 100],
        23: [400, 100]
    }
}

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
    const hours = date.getHours();
    const minute = date.getMinutes();

    let onTimePreset = onTime[0]
    if (preset) {
        preset = Number(preset)
        if (!isNaN(preset) && preset in onTime) {
            onTimePreset = onTime[preset]
        }
    }
    const tempAndBright = onTimePreset[hours]
    const nextTempAndBright = hours < 23 ? onTimePreset[hours + 1] : onTimePreset[hours];

    var temp = tempAndBright[0] + ((nextTempAndBright[0] - tempAndBright[0]) / MINUTES_IN_HOUR * minute)
    var bright = tempAndBright[1] + ((nextTempAndBright[1] - tempAndBright[1]) / MINUTES_IN_HOUR * minute)
    if (CIRCADIAN_LIGHT_DEBUG) console.info("Циркадное освещение. Получение. Время {}:{}. Режим {}. Температура {} и яркость {}", hours, minute, preset, temp, bright)
    temp = Math.round(Math.max(MIN_COLOR_TEMPERATURE, Math.min(MAX_COLOR_TEMPERATURE, temp))) | 0;
    bright = Math.round(Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, bright))) | 0;
    return [temp, bright];
}


function setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate) {

    if (CIRCADIAN_LIGHT_DEBUG)
        console.info(
            "Циркадное освещение. Сервис {}. Режим: {}, Не менять: яркость: {}, температуру: {}, оттенок: {}, насыщенность: {}",
            service.getType(),
            preset,
            dontChangeBright,
            dontChangeTemp,
            dontChangeHue,
            dontChangeSaturate
        )

    if (service.getType() != HS.Lightbulb) return;

    const tempAndBright = getCircadianLight(preset);
    const temp = tempAndBright[0];
    const bright = tempAndBright[1];
    let hueAndSaturation = [0, 0]

    let allowTemperatureChange = !dontChangeTemp
    let allowHueChange = !dontChangeHue
    let allowSaturationChange = !dontChangeSaturate
    let allowBrightChange = !dontChangeBright

    const brightness = service.getCharacteristic(HC.Brightness);
    if (brightness == null) {
        console.warn("Циркадное освещение. Лампочка {}, не умеет изменять яркость", source.getAccessory())
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
        console.warn("Циркадное освещение. Для лампочки {}, запрещено менять все параметры сценарием или свойствами", source.getAccessory())
        return
    }

    const bulb = service.getCharacteristic(HC.On);
    bulb.setValue(true);

    if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        const accName = service.getAccessory().getName()
        const sName = service.getName()
        const name = accName == sName ? accName : accName + " " + sName

        var text = "Циркадное освещение. " + name + ". Установлено: "
        if (allowBrightChange) text += " Яркость " + bright + ";"
        if (allowTemperatureChange) text += " Температура " + temp + ";"
        else {
            if (allowHueChange) text += " Оттенок " + hueAndSaturation[0] + ";"
            if (allowSaturationChange) text += " Насыщенность " + hueAndSaturation[1] + ";"
        }
        console.info(text)
    }

    if (allowTemperatureChange) {
        temperature.setValue(temp);
    } else {
        if (allowHueChange) hue.setValue(hueAndSaturation[0])
        if (allowSaturationChange) saturation.setValue(hueAndSaturation[1])
    }

    if (allowBrightChange)
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

const miredToHueAndSaturation = {
    50: [210, 30],
    60: [205, 28],
    70: [200, 26],
    80: [195, 24],
    90: [190, 22],
    100: [185, 20],
    110: [180, 18],
    120: [170, 12],
    130: [160, 6],
    140: [150, 0],
    150: [140, 0],
    160: [130, 0],
    170: [120, 0],
    180: [110, 0],
    190: [100, 0],
    200: [90, 0],
    210: [80, 4],
    220: [70, 8],
    230: [60, 16],
    240: [55, 20],
    250: [50, 24],
    260: [45, 28],
    270: [40, 32],
    280: [35, 36],
    290: [33, 40],
    300: [32, 44],
    310: [31, 48],
    320: [30, 52],
    330: [30, 56],
    340: [30, 60],
    350: [30, 64],
    360: [30, 68],
    370: [30, 72],
    380: [30, 76],
    390: [30, 78],
    400: [30, 80]
};

function getHueAndSaturationFromMired(mired) {
    if (mired < 50 || mired > 400) {
        throw new Error("Mired value must be between 50 and 400.");
    }
    var hueAndSat = miredToHueAndSaturation
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