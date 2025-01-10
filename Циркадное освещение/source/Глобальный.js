// [Режим, [Час, [Температура, Яркость]]]
var onTime = [
    [0, //Спальня. Долго держится большая яркость, температура света утром холоднеет медленее
        [0, [400, 60]],
        [1, [400, 60]],
        [2, [400, 60]],
        [3, [400, 30]],
        [4, [400, 30]],
        [5, [400, 30]],
        [6, [400, 70]],
        [7, [350, 100]],
        [8, [300, 100]],
        [9, [250, 100]],
        [10, [150, 100]],
        [11, [100, 100]],
        [12, [50, 100]],
        [13, [50, 100]],
        [14, [50, 100]],
        [15, [50, 100]],
        [16, [100, 100]],
        [17, [150, 100]],
        [18, [200, 100]],
        [19, [250, 100]],
        [20, [300, 90]],
        [21, [350, 60]],
        [22, [400, 60]],
        [23, [400, 60]]
    ],
    [1, // Санузел. Яркость вечером уменьшается раньше, утром включается холодный свет
        [0, [400, 20]],
        [1, [400, 20]],
        [2, [400, 10]],
        [3, [400, 10]],
        [4, [400, 10]],
        [5, [400, 10]],
        [6, [150, 70]],
        [7, [100, 100]],
        [8, [50, 100]],
        [9, [50, 100]],
        [10, [50, 100]],
        [11, [50, 100]],
        [12, [50, 100]],
        [13, [50, 100]],
        [14, [50, 100]],
        [15, [50, 100]],
        [16, [100, 100]],
        [17, [150, 100]],
        [18, [200, 100]],
        [19, [250, 100]],
        [20, [300, 90]],
        [21, [350, 60]],
        [22, [400, 40]],
        [23, [400, 30]]
    ],
    [2, // Кухня. С постоянной максимальной яркостью. утром включается холодный свет
        [0, [400, 100]],
        [1, [400, 100]],
        [2, [400, 100]],
        [3, [400, 100]],
        [4, [400, 100]],
        [5, [400, 100]],
        [6, [300, 100]],
        [7, [150, 100]],
        [8, [50, 100]],
        [9, [50, 100]],
        [10, [50, 100]],
        [11, [50, 100]],
        [12, [50, 100]],
        [13, [50, 100]],
        [14, [50, 100]],
        [15, [50, 100]],
        [16, [100, 100]],
        [17, [150, 100]],
        [18, [200, 100]],
        [19, [250, 100]],
        [20, [300, 100]],
        [21, [350, 100]],
        [22, [400, 100]],
        [23, [400, 100]]
    ]
]

// Константы для улучшения читаемости
const MIN_BRIGHTNESS = 1;
const MAX_BRIGHTNESS = 100;
const MIN_COLOR_TEMPERATURE = 50;
const MAX_COLOR_TEMPERATURE = 400;
const MINUTES_IN_HOUR = 60;

const DEBUG = false;
const DEBUG_INFO = false;

function getCircadianLight(preset) {
    var date = new Date()
    var hours = date.getHours();
    var minute = date.getMinutes();

    var onTimePreset = onTime[0]
    if (preset) {
        preset = Number(preset)
        if (!isNaN(preset) && preset in onTime) {
            onTimePreset = onTime[preset]
        }
    }

    var tempAndBright = onTimePreset[hours + 1][1]
    var nextTempAndBright = hours < 23 ? onTimePreset[hours + 2][1] : onTimePreset[hours + 1][1];

    var temp = Math.round(tempAndBright[0] + ((nextTempAndBright[0] - tempAndBright[0]) / MINUTES_IN_HOUR * minute))
    var bright = Math.round(tempAndBright[1] + ((nextTempAndBright[1] - tempAndBright[1]) / MINUTES_IN_HOUR * minute))
    if (DEBUG) console.info("Циркадное освещение. Получение. Время {}:{}. Режим {}. Температура {} и яркость {}", hours, minute, preset, temp, bright)
    temp = Math.max(MIN_COLOR_TEMPERATURE, Math.min(MAX_COLOR_TEMPERATURE, temp));
    bright = Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, bright));
    return [temp, bright];
}


function setCircadianLightForService(service, preset, dontChangeBright) {

    if (DEBUG) console.info("Циркадное освещение. Сервис {}. Режим: {}, Не менять яркость: {}", service.getType(), preset, dontChangeBright)

    if (service.getType() != HS.Lightbulb) return;

    var tempAndBright = getCircadianLight(preset);
    let temp = tempAndBright[0];
    let bright = tempAndBright[1];

    let allowTemperatureChange = true
    let allowBrightChange = !dontChangeBright

    let brightness = service.getCharacteristic(HC.Brightness);
    if (brightness == null) {
        console.warn("Циркадное освещение. Лампочка {}, не умеет изменять яркость", source.getAccessory())
        return;
    }

    let temperature = service.getCharacteristic(HC.ColorTemperature);
    if (temperature == null) {
        allowTemperatureChange = false
    }

    let bulb = service.getCharacteristic(HC.On);
    bulb.setValue(true);

    if (DEBUG_INFO) {
        let accName = service.getAccessory().getName()
        let sName = service.getName()
        let name = accName == sName ? accName : accName + " " + sName
        if (allowBrightChange && allowTemperatureChange)
            console.info("Циркадное освещение. Установлена температура {} и яркость {} для {}", temp, bright, name)
        else if (allowBrightChange)
            console.info("Циркадное освещение. Установлена яркость {} для {}", bright, name)
        else if (allowTemperatureChange)
            console.info("Циркадное освещение. Установлена температура {} для {}", temp, name)
        else
            console.info("Циркадное освещение. Температура и яркость не изменены для {}", name)
    }

    if (allowTemperatureChange)
        temperature.setValue(temp);
    if (allowBrightChange)
        brightness.setValue(bright)
}

function setCircadianLight(aId, preset, dontChangeBright) {
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
        setCircadianLightForService(service, preset, dontChangeBright)
    }
}