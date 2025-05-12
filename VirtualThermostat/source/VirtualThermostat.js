let servicesList = getServicesByServiceAndCharacteristicType([HS.Switch, HS.Outlet], HC.On);
let sensorsServicesList = getServicesByServiceAndCharacteristicType([HS.TemperatureSensor, HS.Thermostat], HC.CurrentTemperature);

info = {
    name: "🌡️ Виртуальный термостат",
    description: "Позволяет реализовать логику виртуального термостата, указав датчик температуры и реле для нагрева или охлаждения",
    version: "2.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Thermostat],
    sourceCharacteristics: [HC.CurrentHeatingCoolingState, HC.TargetHeatingCoolingState],

    options: {
        sensor: {
            name: {
                en: "Temperature sensor",
                ru: "Датчик температуры"
            },
            type: "String",
            value: "",
            formType: "list",
            values: sensorsServicesList
        },
        heatingRelay: {
            name: {
                en: "Heating relay",
                ru: "Реле нагрева"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        coolingRelay: {
            name: {
                en: "Cooling relay",
                ru: "Реле охлаждения"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        }
    }
};

// Вывод в лог информационные сообщения о работе сценария
let debug = false

function trigger(source, value, variables, options) {
    try {
        const tempSensor = getDevice(options, "sensor")
        const heatingRelay = getDevice(options, "heatingRelay")
        const coolingRelay = getDevice(options, "coolingRelay")

        const currentState = source.getService().getCharacteristic(HC.CurrentHeatingCoolingState).getValue()
        const targetState = source.getService().getCharacteristic(HC.TargetHeatingCoolingState).getValue()

        //Выключено
        if (targetState == 0 || currentState == 0) {
            if (heatingRelay) heatingRelay.getCharacteristic(HC.On).setValue(false)
            if (coolingRelay) coolingRelay.getCharacteristic(HC.On).setValue(false)
        }
        // Нагрев
        if ((targetState == 1 || targetState == 3) && currentState == 1) {
            if (heatingRelay) heatingRelay.getCharacteristic(HC.On).setValue(true)
            if (coolingRelay) coolingRelay.getCharacteristic(HC.On).setValue(false)
        }
        // Охлаждение
        if ((targetState == 2 || targetState == 3) && currentState == 2) {
            if (heatingRelay) heatingRelay.getCharacteristic(HC.On).setValue(false)
            if (coolingRelay) coolingRelay.getCharacteristic(HC.On).setValue(true)
        }

        if (tempSensor) {

            let acc = source.getAccessory()
            let currentTemperature = source.getService().getCharacteristic(HC.CurrentTemperature)

            setValueFromSensor(source, variables, options, currentTemperature)

            if (!variables.subscribe || variables.subscribed != true) {
                showSubscribeMessage(options.sensor)
                let subscribe = Hub.subscribeWithCondition("", "", [HS.TemperatureSensor, HS.Thermostat], [HC.CurrentTemperature], function (sensorSource, sensorValue) {
                    let service = sensorSource.getService()
                    let isSelected = service.getUUID() == options.sensor
                    if (isSelected && currentTemperature) {
                        currentTemperature.setValue(sensorValue)
                        if (variables.lastTemp != sensorValue) {
                            logInfo(`Значение на термостат установлено: ${sensorValue}°C`, source, debug)
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
                    setValueFromSensor(source, variables, options, currentTemperature)
                    logInfo("Полуночное обновление", source, debug)
                });
            }
        }

    } catch (e) {
        logError("Ошибка выполнения задачи: " + e.message);
    }
}

function setValueFromSensor(source, variables, options, targetTemperature) {
    try {
        let sensorService = getDevice(options, "sensor")
        if (sensorService) {

            let sensorAccessory = sensorService.getAccessory()
            const status = sensorAccessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue() == true;
            if (!status) {
                logWarn(`Датчик ${getDeviceName(sensorService)} не в сети`, source)
            }
            let sensorValue = sensorService.getCharacteristic(HC.CurrentTemperature).getValue()
            targetTemperature.setValue(sensorValue)
            if (variables.lastTemp != sensorValue) {
                logInfo(`Значение на термостат установлено: ${sensorValue}°C`, source, debug)
                variables.lastTemp = sensorValue
                variables.lastUpdateTime = Date.now();
            }

        } else {
            logError(`Не найден внешний датчик для термостата. ID: ${options.sensor}`, source)
            return
        }

        const currentTime = Date.now();
        if (variables.lastUpdateTime && (currentTime - variables.lastUpdateTime > oneDayMs)) {
            logError(`Нет показаний от датчика температуры (${getDeviceName(sensorService)}) в течении суток или более`, source);
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

    console.message(`Подключен датчик: ${(accName == sName ? accName : accName + " " + sName)}`)
}

function getDevice(options, name) {
    if (options[name] === '') { return undefined; }
    var service
    if (options[name] != '') {
        const cdata = options[name].split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        service = Hub.getAccessory(aid).getService(sid)
        if (service == null) {
            logError("Выбранное устройство не найдено {}", options[name]);
            return undefined;
        } else {
            return service
        }
    }
    return undefined
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

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыт" : "")
    return name
}

// подготовка списка характеристик для выбора в настройке логики
function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicType) {
    let sortedServicesList = []
    let unsortedServicesList = []
    Hub.getAccessories().forEach((a) => {
        a.getServices().filter((s) => serviceTypes.indexOf(s.getType()) >= 0).forEach((s) => {
            const c = s.getCharacteristic(characteristicType);
            if (c) {
                let displayname = getDeviceName(s)
                //console.info("Service: {}", displayname);
                unsortedServicesList.push({
                    name: { ru: displayname, en: displayname },
                    value: s.getUUID()
                });
            }
        })
    });
    sortedServicesList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: '' })
    unsortedServicesList.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach((s) => sortedServicesList.push(s))
    return sortedServicesList
}

// Сутки
const oneDayMs = 23 * 59 * 60 * 1000
// Константа для отладки
const DEBUG_TITLE = "Виртуальный термостат: ";
