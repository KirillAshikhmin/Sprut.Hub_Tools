let servicesList = [];

info = {
    name: "Внешний датчик температуры для термоголовки Aqara E1",
    description: "Настраивает термоголовку и привязывает к ней внешний датчик температуры",
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Thermostat],
    sourceCharacteristics: [HC.CurrentHeatingCoolingState],

    options: {
        sensor: {
            name: {
                en: "Temperature sensor",
                ru: "Датчик температуры"
            },
            desc: {
                en: "External temperature sensor",
                ru: "Внешний датчик температуры для привязки"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        }
    },

    variables: {
        lastTemp: undefined,
        lastUpdateTime: undefined,
        subscribed: false,
        subscribe: undefined,
    }
}

// Вывод в лог информационные сообщения о работе сценария
let debug = false

function trigger(source, value, variables, options, context) {
    try {
        let acc = source.getAccessory()
        let modelId = acc.getModelId()

        if (modelId != "lumi.airrtc.agl001" && !emulate) {
            logError("Поддерживаются только термоголовки Aqara E1 (SRTS-A01 ID:lumi.airrtc.agl001)", source)
            return;
        }
        if (options.sensor === "") {
            logError("Выберите внешний датчик. Если уже выбрали - активируйте сценарий заново", source)
            return;
        }
        let externalSwitch = undefined
        let targetTemperature = undefined

        acc.getServices().forEach(function (service) {
            if (service.getType() == HS.Switch && service.getName() == "Внешний датчик температуры") {
                externalSwitch = service.getCharacteristic(HC.On)
            } else if (service.getType() == HS.C_TemperatureControl && service.getName() == "Температура внешнего датчика") {
                targetTemperature = service.getCharacteristic(HC.TargetTemperature)
            } else if (emulate && service.getType() == HS.Thermostat) {
                targetTemperature = service.getCharacteristic(HC.CurrentTemperature)
            }
        })

        if (!externalSwitch && !emulate) {
            logError("Не обнаружен переключатель [Внешний датчик температуры]", source)
            return
        }

        if (!targetTemperature && !emulate) {
            logError("Не обнаружен сервис [Температура внешнего датчика]", source)
            return
        }

        if (!emulate) externalSwitch.setValue(true)
        setValueFromSensor(source, variables, options, targetTemperature)

        if (!variables.subscribe || variables.subscribed != true) {
            showSubscribeMessage(options.sensor)
            let subscribe = Hub.subscribeWithCondition("", "", [HS.TemperatureSensor], [HC.CurrentTemperature], function (sensorSource, sensorValue) {
                let service = sensorSource.getService()
                let isSelected = service.getUUID() == options.sensor
                if (isSelected && targetTemperature) {
                    targetTemperature.setValue(sensorValue)
                    if (variables.lastTemp != sensorValue) {
                        logInfo(`Значение на термоголовку установлено: ${sensorValue}°C`, source, debug)
                        variables.lastUpdateTime = Date.now();
                        variables.lastTemp = sensorValue
                    }
                }
            }, acc)
            variables.subscribe = subscribe
            variables.subscribed = true
        }
        if (!variables.midnightTask) {
            variables.midnightTask = Cron.schedule("0 0 0 * * *", function () {
                setValueFromSensor(source, variables, options, targetTemperature)
                logInfo("Полуночное обновление", source, debug)
            });
        }
    } catch (e) {
        logError(`Ошибка установки внешнего датчки температуры: ${e.toString()}`, source)
    }
}

function setValueFromSensor(source, variables, options, targetTemperature) {
    try {
        const cdata = options.sensor.split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        let sensorAccessory = Hub.getAccessory(aid)
        if (!sensorAccessory) {
            logError(`Не найден внешний датчик для термоголовки. ID: ${options.sensor}`, source)
            return
        }
        let sensorService = sensorAccessory.getService(sid)
        if (sensorService) {

            const status = sensorAccessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue() == true;
            if (!status) {
                logWarn(`Датчик ${getDeviceName(sensorService)} не в сети`, source)
            }
            let sensorValue = sensorService.getCharacteristic(HC.CurrentTemperature).getValue()
            targetTemperature.setValue(sensorValue)
            if (variables.lastTemp != sensorValue) {
                logInfo(`Значение на термоголовку установлено: ${sensorValue}°C`, source, debug)
                variables.lastTemp = sensorValue
                variables.lastUpdateTime = Date.now();
            }

        } else {
            logError(`Не найден внешний датчик для термоголовки. ID: ${options.sensor}`, source)
            return
        }

        const currentTime = Date.now();
        if (variables.lastUpdateTime && (currentTime - variables.lastUpdateTime > oneDayMs)) {
            logError(`Нет показаний от внешнего датчика (${getDeviceName(sensorService)}) в течении суток или более`, source);
            return;
        }
    } catch (e) {
        logError(`Не удалось получить температуру с датчика ${options.sensor}: ${e.toString()}`, source)
    }
}

function showSubscribeMessage(sensor) {
    const cdata = sensor.split('.');
    const aid = cdata[0];
    const sid = cdata[1];
    const acc = Hub.getAccessory(aid)
    const service = acc.getService(sid)
    const accName = service.getAccessory().getName()
    const sName = service.getName()

    console.message(`Подключен внешний датчик: ${(accName == sName ? accName : accName + " " + sName)}`)
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыт" : "")
    return name
}

function logInfo(text, source, show) {
    if (show) console.info(getLogText(text, source));
}
function logWarn(text, source) {
    console.warn(getLogText(text, source));
}
function logError(text, source) {
    console.error(getLogText(text, source));
}
function getLogText(text, source) {
    return `${text} | ${DEBUG_TITLE} ${getDeviceName(source.getService())}`
}

let servicesListUnsort = [];
Hub.getAccessories().forEach(function (a) {
    a.getServices().filter(function (s) { return s.getType() == HS.TemperatureSensor }).forEach(function (s) {
        const c = s.getCharacteristic(HC.CurrentTemperature);
        if (!c) return;
        let displayname = getDeviceName(s)
        servicesListUnsort.push({
            name: { ru: displayname, en: displayname },
            value: s.getUUID()
        });
    })
});

servicesList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: '' });
servicesListUnsort.sort(function (a, b) { return a.name.ru.localeCompare(b.name.ru); }).forEach(function (s) { servicesList.push(s) })

// Сутки
const oneDayMs = 23 * 59 * 60 * 1000
// Константа для отладки
const DEBUG_TITLE = "ВДТ. Термоголовка: ";

//Эмуляция работы на виртуальном термостате. Устанавливает текущую температуру
let emulate = false
