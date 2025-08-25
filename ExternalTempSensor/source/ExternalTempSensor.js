let servicesList = [];

// Выносим название и описание в переменные для использования в info и options
let scenarioName = {
    ru: "Внешний датчик температуры для термоголовок Aqara E1, SONOFF TRVZB, Danfoss 014G2463",
    en: "External temperature sensor for thermostats Aqara E1, SONOFF TRVZB, Danfoss 014G2463"
};

let scenarioDescription = {
    ru: "Сценарий астраивает термоголовку и привязывает к ней внешний датчик температуры. Поддерживает Aqara E1, SONOFF TRVZB, Danfoss 014G2463.\nСценарий автоматически определит тип термоголовки и применит соответствующую логику работы.\n\nВАЖНО: Сначала выберите внешний датчик температуры в настройках, затем активируйте сценарий переключателем 'Активно'.",
    en: "Scenario configures the thermostat and binds an external temperature sensor to it. Supports Aqara E1, SONOFF TRVZB, Danfoss 014G2463.\nThe scenario will automatically determine the thermostat type and apply the appropriate logic.\n\nIMPORTANT: First select the external temperature sensor in the settings, then activate the scenario with the 'Active' switch."
};

info = {
    name: scenarioName.ru,
    description: scenarioDescription.ru,
    version: "2.1",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Thermostat],
    sourceCharacteristics: [HC.CurrentHeatingCoolingState],

    options: {
        desc: {
            name: {en: "", ru: ""}, 
            desc: scenarioDescription,
            type: "String",
            value: "",
            formType: "status"
        },
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
        // Проверяем, запустился ли сценарий при старте хаба
        let isHubStartup = context && context.toString().indexOf("HUB[OnStart]")>=0;
        
        let acc = source.getAccessory()
        let modelId = acc.getModelId()
        let manufacturer = acc.getManufacturer()

        // Проверка поддержки термостатов
        let isSupported = false
        let thermostatType = ""
        
        if (modelId == "lumi.airrtc.agl001" && manufacturer == "Aqara") {
            isSupported = true
            thermostatType = "Aqara E1"
        } else if (modelId == "TRVZB" && manufacturer == "SONOFF") {
            isSupported = true
            thermostatType = "SONOFF TRVZB"
        } else if (modelId == "eTRV0101" && manufacturer == "Danfoss") {
            isSupported = true
            thermostatType = "Danfoss eTRV0101"
        }

        if (!isSupported && !emulate) {
            logError(`Поддерживаются только термостаты Aqara E1 (lumi.airrtc.agl001), SONOFF TRVZB, Danfoss 014G2463 (eTRV0101). Текущий: ${manufacturer} ${modelId}`, source, isHubStartup)
            return;
        }
        
        if (options.sensor === "") {
            logError("Выберите внешний датчик. Если уже выбрали - активируйте сценарий заново", source, isHubStartup)
            return;
        }
        
        let externalSwitch = undefined
        let targetTemperature = undefined

        // Поиск сервисов в зависимости от типа термостата
        acc.getServices().forEach(function (service) {
            if (service.getType() == HS.Switch) {
                externalSwitch = service.getCharacteristic(HC.On)
            } else if (service.getType() == HS.C_TemperatureControl) {
                targetTemperature = service.getCharacteristic(HC.TargetTemperature)
            } else if (emulate && service.getType() == HS.Thermostat) {
                targetTemperature = service.getCharacteristic(HC.CurrentTemperature)
            }
        })

        if (!externalSwitch && !emulate) {
            logError("Не обнаружен переключатель [Внешний датчик температуры]", source, isHubStartup)
            return
        }

        if (!targetTemperature && !emulate) {
            logError("Не обнаружен сервис [Температура внешнего датчика]", source, isHubStartup)
            return
        }

        if (!emulate) externalSwitch.setValue(true)
        setValueFromSensor(source, variables, options, targetTemperature, isHubStartup)

        if (!variables.subscribe || variables.subscribed != true) {
            showSubscribeMessage(options.sensor, isHubStartup)
            let subscribe = Hub.subscribeWithCondition("", "", [HS.TemperatureSensor], [HC.CurrentTemperature], function (sensorSource, sensorValue) {
                let service = sensorSource.getService()
                let isSelected = service.getUUID() == options.sensor
                if (isSelected && targetTemperature) {
                    targetTemperature.setValue(sensorValue)
                    if (variables.lastTemp != sensorValue) {
                        logInfo(`Значение на термоголовку ${thermostatType} установлено: ${sensorValue}°C`, source, debug)
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
                setValueFromSensor(source, variables, options, targetTemperature, false)
                logInfo("Полуночное обновление", source, debug)
            });
        }
    } catch (e) {
        let isHubStartup = context && context.toString().includes("HUB[OnStart]");
        logError(`Ошибка установки внешнего датчика температуры: ${e.toString()}`, source, isHubStartup)
    }
}

function setValueFromSensor(source, variables, options, targetTemperature, isHubStartup) {
    try {
        const cdata = options.sensor.split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        let sensorAccessory = Hub.getAccessory(aid)
        if (!sensorAccessory) {
            logError(`Не найден внешний датчик для термоголовки. ID: ${options.sensor}`, source, isHubStartup)
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
            logError(`Не найден внешний датчик для термоголовки. ID: ${options.sensor}`, source, isHubStartup)
            return
        }

        const currentTime = Date.now();
        if (variables.lastUpdateTime && (currentTime - variables.lastUpdateTime > oneDayMs)) {
            logError(`Нет показаний от внешнего датчика (${getDeviceName(sensorService)}) в течении суток или более`, source, isHubStartup);
            return;
        }
    } catch (e) {
        logError(`Не удалось получить температуру с датчика ${options.sensor}: ${e.toString()}`, source, isHubStartup)
    }
}

function showSubscribeMessage(sensor, isHubStartup) {
    const cdata = sensor.split('.');
    const aid = cdata[0];
    const sid = cdata[1];
    const acc = Hub.getAccessory(aid)
    const service = acc.getService(sid)
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    if (isHubStartup) {
        console.info(`Подключен внешний датчик: ${(accName == sName ? accName : accName + " " + sName)}`)
    } else {
        console.message(`Подключен внешний датчик: ${(accName == sName ? accName : accName + " " + sName)}`)
    }
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
function logError(text, source, isHubStartup) {
    if (isHubStartup) {
        logWarn(text, source)
    } else {
        console.error(getLogText(text, source))
    }
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
const DEBUG_TITLE = "ВДТ: ";

//Эмуляция работы на виртуальном термостате. Устанавливает текущую температуру
let emulate = false
