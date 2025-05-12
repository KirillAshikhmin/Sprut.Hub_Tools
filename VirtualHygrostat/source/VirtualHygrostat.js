let servicesList = getServicesByServiceAndCharacteristicType([HS.Switch, HS.Outlet, HS.HumidifierDehumidifier], [HC.On, HC.Active]);
let sensorsServicesList = getServicesByServiceAndCharacteristicType([HS.HumiditySensor, HS.HumidifierDehumidifier], [HC.CurrentRelativeHumidity]);

info = {
    name: "💧 Виртуальный гигростат",
    description: "Позволяет реализовать логику виртуального увлажнителя осушителя (гигростата), указав датчик влажности и реле для увлажения или осушения",
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.HumidifierDehumidifier],
    sourceCharacteristics: [HC.CurrentHumidifierDehumidifierState, HC.TargetHumidifierDehumidifierState],

    options: {
        sensor: {
            name: {
                en: "Hudimity sensor",
                ru: "Датчик влажности"
            },
            type: "String",
            value: "",
            formType: "list",
            values: sensorsServicesList
        },
        heatingRelay: {
            name: {
                en: "Humidification relay",
                ru: "Реле увлажнения"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        coolingRelay: {
            name: {
                en: "Drying relay",
                ru: "Реле осушения"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        }
    }
};

// Вывод в лог информационные сообщения о работе сценария
let debug = true

function trigger(source, value, variables, options) {
    try {
        const tempSensor = getDevice(options, "sensor")
        const heatingRelay = getDevice(options, "heatingRelay")
        const coolingRelay = getDevice(options, "coolingRelay")

        const currentState = source.getService().getCharacteristic(HC.CurrentHumidifierDehumidifierState).getValue()
        const targetState = source.getService().getCharacteristic(HC.TargetHumidifierDehumidifierState).getValue()

        // Выключено
        if (targetState == 0 || currentState == 0 || currentState == 1) {
            setDeviceValue(heatingRelay, false)
            setDeviceValue(coolingRelay, false)
        }
        // Увлажнение
        if ((targetState == 1 || targetState == 0) && currentState == 2) {
            setDeviceValue(heatingRelay, true)
            setDeviceValue(coolingRelay, false)
        }
        // Осушение
        if ((targetState == 2 || targetState == 0) && currentState == 3) {
            setDeviceValue(heatingRelay, false)
            setDeviceValue(coolingRelay, true)
        }

        if (tempSensor) {

            let acc = source.getAccessory()
            let currentHudimity = source.getService().getCharacteristic(HC.CurrentRelativeHumidity)

            setValueFromSensor(source, variables, options, currentHudimity)

            if (!variables.subscribe || variables.subscribed != true) {
                showSubscribeMessage(options.sensor)
                let subscribe = Hub.subscribeWithCondition("", "", [HS.HumiditySensor, HS.HumidifierDehumidifier], [HC.CurrentRelativeHumidity], function (sensorSource, sensorValue) {
                    let service = sensorSource.getService()
                    let isSelected = service.getUUID() == options.sensor
                    if (isSelected && currentHudimity) {
                        currentHudimity.setValue(sensorValue)
                        if (variables.lastTemp != sensorValue) {
                            logInfo(`Значение на гигростат установлено: ${sensorValue}%`, source, debug)
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
                    setValueFromSensor(source, variables, options, currentHudimity)
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
            let sensorValue = sensorService.getCharacteristic(HC.CurrentRelativeHumidity).getValue()
            targetTemperature.setValue(sensorValue)
            if (variables.lastTemp != sensorValue) {
                logInfo(`Значение на гигростат установлено: ${sensorValue}%`, source, debug)
                variables.lastTemp = sensorValue
                variables.lastUpdateTime = Date.now();
            }

        } else {
            logError(`Не найден датчик для гигростата. ID: ${options.sensor}`, source)
            return
        }

        const currentTime = Date.now();
        if (variables.lastUpdateTime && (currentTime - variables.lastUpdateTime > oneDayMs)) {
            logError(`Нет показаний от датчика влажности (${getDeviceName(sensorService)}) в течении суток или более`, source);
            return;
        }
    } catch (e) {
        logError(`Не удалось получить влажность с датчика ${options.sensor}: ${e.toString()}`, source)
    }
}

function setDeviceValue(service, value, invert) {
    if (!service) return
    if (invert) value = !value;
    let on = service.getCharacteristic(HC.On)
    let active = service.getCharacteristic(HC.Active)
    if (on) {
        on.setValue(value);
        return
    }
    if (active) {
        let newValue = value ? 1 : 0
        active.setValue(newValue);
        return
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
        const acc = Hub.getAccessory(aid);
        if (!acc) {
            logError("Выбранное устройство не найдено {}", options[name]);
            return undefined;
        }
        service = acc.getService(sid)
        if (!service) {
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
function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicTypes) {
    let sortedServicesList = []
    let unsortedServicesList = []
    Hub.getAccessories().forEach((a) => {
        a.getServices().filter((s) => serviceTypes.indexOf(s.getType()) >= 0).forEach((s) => {
            let characteristic = undefined
            characteristicTypes.forEach(c => {
                if (!characteristic) {
                    let chr = s.getCharacteristic(c);
                    if (chr) characteristic = chr
                }
            })
            if (characteristic) {
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
const DEBUG_TITLE = "Виртуальный гигростат: ";
