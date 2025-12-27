// Константы
const DEBUG_TITLE = "ВДТ: "; // Константа для отладки
const HEATING_STATE = 1; // Состояние нагрева
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // Сутки в миллисекундах
const HALF_HOUR_MS = 30 * 60 * 1000; // 30 минут в миллисекундах
const TEMP_CHANGE_STEP = 0.1; // Шаг изменения температуры в градусах
const TEMP_CHANGE_DELAY_MS = 10000; // Задержка перед восстановлением температуры (10 секунд)

// Поддерживаемые термостаты
const SUPPORTED_THERMOSTATS = {
    AQARA_E1: { modelId: "lumi.airrtc.agl001", manufacturer: "Aqara", name: "Aqara E1" },
    SONOFF_TRVZB: { modelId: "TRVZB", manufacturer: "SONOFF", name: "SONOFF TRVZB" },
    DANFOSS: { modelId: "eTRV0101", manufacturer: "Danfoss", name: "Danfoss eTRV0101" }
};

// Получает список названий поддерживаемых термостатов
function getSupportedThermostatsList() {
    return Object.keys(SUPPORTED_THERMOSTATS).map((key) => SUPPORTED_THERMOSTATS[key].name).join(", ");
}

// Выносим название и описание в переменные для использования в info и options
let scenarioName = {
    ru: "Внешний датчик температуры для термоголовок " + getSupportedThermostatsList(),
    en: "External temperature sensor for thermostats " + getSupportedThermostatsList()
};

let scenarioDescription = {
    ru: "Сценарий настраивает термоголовку и привязывает к ней внешний датчик температуры. Поддерживает " + getSupportedThermostatsList() + ".\nСценарий автоматически определит тип термоголовки и применит соответствующую логику работы.\n\nВАЖНО: Сначала выберите внешний датчик температуры в настройках, затем активируйте сценарий переключателем 'Активно'.",
    en: "Scenario configures the thermostat and binds an external temperature sensor to it. Supports " + getSupportedThermostatsList() + ".\nThe scenario will automatically determine the thermostat type and apply the appropriate logic.\n\nIMPORTANT: First select the external temperature sensor in the settings, then activate the scenario with the 'Active' switch."
};

info = {
    name: scenarioName.ru,
    description: scenarioDescription.ru,
    version: "2.2",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Thermostat],
    sourceCharacteristics: [HC.CurrentHeatingCoolingState],

    options: {
        desc: {
            name: { en: "", ru: "" },
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
            values: getServicesByServiceAndCharacteristicType([HS.TemperatureSensor, HS.Thermostat], [HC.CurrentTemperature])
        },
        changeTempPeriodically: {
            name: {
                en: "Change temperature value every hour",
                ru: "Менять значения температуры каждый час"
            },
            desc: {
                en: "For thermostats not to switch to internal sensor. Changes temperature only if last update was more than 30 minutes ago. (Recommended for Sonoff)",
                ru: "Для того, что бы термоголовка не переключалась на внутренний датчик. Меняет температуру только если последнее обновление было более полу часа назад. (Рекомендуется для Sonoff)"
            },
            type: "Boolean",
            value: false
        }
    },

    variables: {
        lastTemp: undefined,
        lastUpdateTime: undefined,
        subscribed: false,
        subscribe: undefined,
        tempChangeTask: undefined,
        tempChangeTimeoutId: undefined,
        midnightTask: undefined,
    }
}

function trigger(source, value, variables, options, context) {
    // Проверяем, запустился ли сценарий при старте хаба
    const isHubStartup = context && context.toString().indexOf("HUB[OnStart]") >= 0;

    try {
        let acc = source.getAccessory()
        let modelId = acc.getModelId()
        let manufacturer = acc.getManufacturer()

        // Проверка поддержки термостатов
        let thermostatType = "";
        for (let key in SUPPORTED_THERMOSTATS) {
            const thermostat = SUPPORTED_THERMOSTATS[key];
            if (modelId === thermostat.modelId && manufacturer === thermostat.manufacturer) {
                thermostatType = thermostat.name;
                break;
            }
        }

        if (!thermostatType && !emulate) {
            logError(`Поддерживаются только термостаты ${getSupportedThermostatsList()}. Текущий: ${manufacturer} ${modelId}`, source, isHubStartup)
            return;
        }

        if (options.sensor === "") {
            logError("Выберите внешний датчик. Если уже выбрали - активируйте сценарий заново", source, isHubStartup)
            return;
        }

        let externalSwitch = undefined
        let targetTemperature = undefined
        let currentHeatingCoolingState = undefined

        // Поиск сервисов в зависимости от типа термостата
        acc.getServices().forEach(function (service) {
            if (service.getType() === HS.Switch && !externalSwitch) {
                externalSwitch = service.getCharacteristic(HC.On)
            } else if (service.getType() === HS.C_TemperatureControl && !targetTemperature) {
                targetTemperature = service.getCharacteristic(HC.TargetTemperature)
            } else if (service.getType() === HS.Thermostat && !currentHeatingCoolingState) {
                currentHeatingCoolingState = service.getCharacteristic(HC.CurrentHeatingCoolingState)
            }
        })

        if (!externalSwitch) {
            logError("Не обнаружен переключатель [Внешний датчик температуры]", source, isHubStartup)
            return
        }

        if (!targetTemperature) {
            logError("Не обнаружен сервис [Температура внешнего датчика]", source, isHubStartup)
            return
        }

        externalSwitch.setValue(true);

        setValueFromSensor(source, variables, options, targetTemperature, isHubStartup);
        setupSensorSubscription(source, variables, options, targetTemperature, thermostatType, acc, isHubStartup);
        setupPeriodicTempChange(source, variables, options, targetTemperature, currentHeatingCoolingState);
    } catch (e) {
        logError(`Ошибка установки внешнего датчика температуры: ${e.toString()}`, source, isHubStartup)
    }
}

// Настраивает подписку на изменения внешнего датчика температуры и создает задачу полуночного обновления
function setupSensorSubscription(source, variables, options, targetTemperature, thermostatType, acc, isHubStartup) {
    if (!variables.subscribe || !variables.subscribed) {
        showSubscribeMessage(options.sensor, isHubStartup);
        let subscribe = Hub.subscribeWithCondition("", "", [HS.TemperatureSensor], [HC.CurrentTemperature], function (sensorSource, sensorValue) {
            let service = sensorSource.getService();
            let isSelected = service.getUUID() === options.sensor;
            if (isSelected && targetTemperature) {
                targetTemperature.setValue(sensorValue);
                if (variables.lastTemp != sensorValue) {
                    logInfo(`Значение на термоголовку ${thermostatType} установлено: ${sensorValue}°C`, source, debug);
                    variables.lastUpdateTime = Date.now();
                    variables.lastTemp = sensorValue;
                }
            }
        }, acc);
        variables.subscribe = subscribe;
        variables.subscribed = true;
    }
    if (!variables.midnightTask) {
        variables.midnightTask = Cron.schedule("0 0 0 * * *", function () {
            setValueFromSensor(source, variables, options, targetTemperature, false);
            logInfo("Полуночное обновление", source, debug);
        });
    }
}

// Настраивает периодическое изменение температуры каждый час для предотвращения переключения термоголовки на внутренний датчик
function setupPeriodicTempChange(source, variables, options, targetTemperature, currentHeatingCoolingState) {
    if (options.changeTempPeriodically) {
        if (!variables.tempChangeTask) {
            variables.tempChangeTask = Cron.schedule("0 0 * * * *", function () {
                // Проверяем, что последнее обновление было более часа назад
                const currentTime = Date.now();
                if (variables.lastUpdateTime) {
                    if (currentTime - variables.lastUpdateTime > ONE_DAY_MS) {
                        logWarn("Периодическое изменение температуры пропущено: нет обновлений от датчика более суток", source);
                        return;
                    }
                    if (currentTime - variables.lastUpdateTime <= HALF_HOUR_MS) {
                        logInfo("Периодическое изменение температуры пропущено: последнее обновление было менее 30 минут назад", source, debug);
                        return;
                    }
                }

                // Получаем текущее состояние нагрева из термостата
                let currentState = currentHeatingCoolingState.getValue();
                let currentTemp = targetTemperature.getValue();

                // Определяем направление изменения
                let tempChange = TEMP_CHANGE_STEP;
                if (currentState === HEATING_STATE) {
                    // Нагрев - уменьшаем температуру
                    tempChange = -TEMP_CHANGE_STEP;
                }
                // Иначе увеличиваем (tempChange уже TEMP_CHANGE_STEP)

                // Устанавливаем измененное значение
                let newTemp = currentTemp + tempChange;
                targetTemperature.setValue(newTemp);
                logInfo(`Временное изменение температуры: ${newTemp.toFixed(1)}°C (${tempChange > 0 ? '+' : ''}${tempChange}°C)`, source, debug);

                // Через 10 секунд устанавливаем реальное значение
                // Очищаем предыдущий таймаут, если он еще не выполнился
                if (variables.tempChangeTimeoutId) {
                    clearTimeout(variables.tempChangeTimeoutId);
                }
                variables.tempChangeTimeoutId = setTimeout(function () {
                    // Проверяем, что опция все еще включена
                    if (options.changeTempPeriodically && targetTemperature) {
                        setValueFromSensor(source, variables, options, targetTemperature, false);
                    }
                    variables.tempChangeTimeoutId = undefined;
                }, TEMP_CHANGE_DELAY_MS);
            });
        }
    } else {
        // Отключаем задачу, если опция выключена
        if (variables.tempChangeTask) {
            variables.tempChangeTask.clear();
            variables.tempChangeTask = undefined;
        }
        // Очищаем активный таймер
        if (variables.tempChangeTimeoutId) {
            clearTimeout(variables.tempChangeTimeoutId);
            variables.tempChangeTimeoutId = undefined;
        }
    }
}

// Парсит идентификатор датчика и возвращает объект с aid и sid
function parseSensorId(sensorId) {
    const cdata = sensorId.split('.');
    return {
        aid: cdata[0],
        sid: cdata[1]
    };
}

// Получает значение температуры из внешнего датчика и устанавливает его на термоголовку с валидацией
function setValueFromSensor(source, variables, options, targetTemperature, isHubStartup) {
    try {
        const sensorData = parseSensorId(options.sensor);
        const aid = sensorData.aid;
        const sid = sensorData.sid;
        let sensorAccessory = Hub.getAccessory(aid);
        if (!sensorAccessory) {
            logError(`Не найден внешний датчик для термоголовки. ID: ${options.sensor}`, source, isHubStartup);
            return;
        }
        let sensorService = sensorAccessory.getService(sid);
        if (!sensorService) {
            logError(`Не найден внешний датчик для термоголовки. ID: ${options.sensor}`, source, isHubStartup);
            return;
        }

        // Проверяем статус онлайн перед использованием
        const infoService = sensorAccessory.getService(HS.AccessoryInformation);
        if (infoService) {
            const onlineChar = infoService.getCharacteristic(HC.C_Online);
            if (!onlineChar || onlineChar.getValue() !== true) {
                logWarn(`Датчик ${getDeviceName(sensorService)} не в сети`, source);
            }
        }

        // Получаем значение температуры
        const tempChar = sensorService.getCharacteristic(HC.CurrentTemperature);
        if (!tempChar) {
            logError(`Характеристика CurrentTemperature не найдена в датчике ${getDeviceName(sensorService)}`, source, isHubStartup);
            return;
        }

        let sensorValue = tempChar.getValue();

        // Валидация значения температуры
        if (sensorValue === null || sensorValue === undefined || isNaN(sensorValue)) {
            logError(`Невалидное значение температуры от датчика ${getDeviceName(sensorService)}: ${sensorValue}`, source, isHubStartup);
            return;
        }

        // Проверка на разумные пределы (-50 до 100 градусов)
        if (sensorValue < -50 || sensorValue > 100) {
            logWarn(`Подозрительное значение температуры от датчика ${getDeviceName(sensorService)}: ${sensorValue}°C`, source);
        }

        targetTemperature.setValue(sensorValue);
        logInfo(`Значение на термоголовку установлено: ${sensorValue}°C`, source, debug);
        if (variables.lastTemp !== sensorValue) {
            variables.lastTemp = sensorValue;
            variables.lastUpdateTime = Date.now();
        }

        // Проверка на сутки без обновлений
        const currentTime = Date.now();
        if (variables.lastUpdateTime && (currentTime - variables.lastUpdateTime > ONE_DAY_MS)) {
            logError(`Нет показаний от внешнего датчика (${getDeviceName(sensorService)}) в течении суток или более`, source, isHubStartup);
            return;
        }
    } catch (e) {
        logError(`Не удалось получить температуру с датчика ${options.sensor}: ${e.toString()}`, source, isHubStartup);
    }
}

function showSubscribeMessage(sensor, isHubStartup) {
    try {
        const sensorData = parseSensorId(sensor);
        const aid = sensorData.aid;
        const sid = sensorData.sid;
        const acc = Hub.getAccessory(aid);
        if (!acc) {
            console.warn(`Не удалось найти аксессуар для датчика: ${aid}`);
            return;
        }
        const service = acc.getService(sid);
        if (!service) {
            console.warn(`Не удалось найти сервис для датчика: ${sid}`);
            return;
        }
        const accName = service.getAccessory().getName();
        const sName = service.getName();
        const displayName = accName === sName ? accName : accName + " " + sName;
        if (isHubStartup) {
            console.info(`Подключен внешний датчик: ${displayName}`);
        } else {
            console.message(`Подключен внешний датчик: ${displayName}`);
        }
    } catch (e) {
        console.warn(`Ошибка при отображении сообщения о подписке: ${e.toString()}`);
    }
}

// Вспомогательные функции
function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName();
    const accName = acc.getName();
    const sName = service.getName();
    const name = room + " -> " + (accName === sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрытый" : "");
    return name;
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
    try {
        return `${text} | ${DEBUG_TITLE} ${getDeviceName(source.getService())}`
    } catch (e) {
        return `${text} | ${DEBUG_TITLE}`
    }
}

function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicTypes) {
    let unsortedServicesList = [];
    Hub.getAccessories().forEach((a) => {
        a.getServices()
            .filter((s) => serviceTypes.indexOf(s.getType()) >= 0)
            .filter((s) => characteristicTypes.some((c) => s.getCharacteristic(c)))
            .forEach((s) => {
                let name = getDeviceName(s);
                unsortedServicesList.push({
                    name: { ru: name, en: name },
                    value: s.getUUID()
                });
            });
    });
    let sortedServicesList = [{ name: { ru: "Не выбрано", en: "Not selected" }, value: '' }];
    unsortedServicesList.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach((s) => sortedServicesList.push(s));
    return sortedServicesList;
}

//Эмуляция работы на виртуальном термостате. Устанавливает текущую температуру
let emulate = false

// Вывод в лог информационные сообщения о работе сценария
let debug = true