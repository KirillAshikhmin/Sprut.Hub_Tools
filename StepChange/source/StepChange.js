let characteristicsList = [];
let servicesList = [];

const directionOptions = [
    { value: 0, name: { en: "Increase and decrease", ru: "Увеличивать и уменьшать" } },
    { value: 1, name: { en: "Increase", ru: "Увеличивать" } },
    { value: 2, name: { en: "Decrease", ru: "Уменьшать" } }
];

info = {
    name: "📈 Пошаговое изменение характеристики по кнопке или датчику касания",
    description: "Изменяет выбранную характеристику устройства по нажатию на кнопку или в цикле, пока кнопка зажата",
    version: "2.0",
    author: "@BOOMikru Special thx to @dshtolin",
    onStart: false,

    sourceServices: [HS.ContactSensor, HS.StatelessProgrammableSwitch],
    sourceCharacteristics: [HC.ContactSensorState, HC.ProgrammableSwitchEvent],

    options: {
        // Общие параметры
        characteristic: {
            name: { en: "Characteristic", ru: "Выберите устройство" },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        accessoryId: {
            name: { en: "   Characteristic", ru: "   или укажите ID аксессуара" },
            type: "Integer",
            value: 0
        },
        serviceId: {
            name: { en: "   Characteristic", ru: "   и ID сервиса" },
            type: "Integer",
            value: 0
        },
        notification: {
            name: { en: "Send notifications on change", ru: "Отправлять уведомления при изменениях" },
            desc: { en: "System and to Telegram", ru: "Системные уведомления и в Telegram" },
            type: "Boolean",
            value: false
        },
        debug: {
            name: { en: "Debug mode", ru: "Режим отладки" },
            desc: { en: "Enable debug logs", ru: "Включить отладочные логи" },
            type: "Boolean",
            value: false
        },
        singlePressTurn: {
            name: { en: "Turn on/off with single press", ru: "Включать/выключать при одиночном нажатии" },
            desc: { en: "Toggles the device power state", ru: "Переключает состояние питания устройства (вкл/выкл)" },
            type: "Boolean",
            value: false
        },
        singlePressStopAuto: {
            name: { en: "Stop auto change on single press", ru: "При одиночном нажатии останавливать автоматическое изменение" },
            desc: { en: "If enabled, single press stops auto change without turning on/off.\nApplies only to button-triggered changes.", ru: "Если включено, то одиночное нажатие останавливает автоматическое изменение характеристики без включения/выключения.\nРаспространяется только на изменения запущенные кнопками" },
            type: "Boolean",
            value: true
        },

        // Одиночное нажатие кнопки (🖱️)
        singlePressOn: {
            name: { en: "🖱️ Single press enabled", ru: "🖱️ Обрабатывать одиночное нажатие" },
            desc: { en: "Does not work if 'Turn on/off with single press' is enabled", ru: "Не работает, если включено 'Включать/выключать при одиночном нажатии'" },
            type: "Boolean",
            value: false
        },
        singlePressWhatChange: {
            name: { en: "   What change", ru: "   Что изменять" },
            type: "Integer",
            value: -1,
            formType: "list",
            values: characteristicsList
        },
        singlePressDirection: {
            name: { en: "   Change direction", ru: "   Направление изменения" },
            type: "Integer",
            value: 0,
            formType: "list",
            values: directionOptions
        },
        singlePressToggleDirection: {
            name: { en: "   Toggle direction on each trigger", ru: "   Менять направление изменения при каждом срабатывании" },
            desc: { en: "If enabled, direction switches with each press", ru: "Если включено, направление будет меняться при каждом нажатии" },
            type: "Boolean",
            value: false
        },
        singlePressIntervalTime: {
            name: { en: "   Interval time (ms)", ru: "   Время интервала (мс)" },
            desc: { en: "If greater than 0, enables automatic characteristic change", ru: "При значении больше 0 активируется автоматическое изменение характеристики" },
            type: "Integer",
            value: 0
        },
        singlePressStep: {
            name: { en: "   Step", ru: "   Шаг изменения" },
            type: "Double",
            value: 10
        },
        singlePressZero: {
            name: { en: "   To zero", ru: "   Не уменьшать до 0" },
            desc: { en: "For some characteristics zero value equals turn off", ru: "В некоторых характеристиках значение 0 приводит к выключению устройства (напр. яркость у ламп). Данная настройка ставит минимальное значение 1, вместо 0." },
            type: "Boolean",
            value: false
        },
        singlePressCustomLimits: {
            name: { en: "   Custom limits", ru: "   Собственные ограничения" },
            desc: { en: "Example: 18.5 - 27 or -40 - -0.7", ru: "Пример: 18.5 - 27 или -40 - -0.7. Укажите диапазон через тире (можно с пробелами), поддерживаются дробные и отрицательные числа с точкой или запятой." },
            type: "String",
            value: ""
        },
        singlePressCustomSteps: {
            name: { en: "   Custom steps", ru: "   Собственные шаги" },
            desc: { en: "Example: 1;7;16;35", ru: "Через точку с запятой. Например: 1;7;16;35. Можно вводить дробные значения через точку (25.5). Если установлено - настройка 'Шаг' не используется" },
            type: "String",
            value: ""
        },

        // Двойное нажатие кнопки (🖱️🖱️)
        doublePressOn: {
            name: { en: "🖱️🖱️ Double press enabled", ru: "🖱️🖱️ Обрабатывать двойное нажатие" },
            type: "Boolean",
            value: false
        },
        doublePressWhatChange: {
            name: { en: "   What change", ru: "   Что изменять" },
            type: "Integer",
            value: -1,
            formType: "list",
            values: characteristicsList
        },
        doublePressDirection: {
            name: { en: "   Change direction", ru: "   Направление изменения" },
            type: "Integer",
            value: 0,
            formType: "list",
            values: directionOptions
        },
        doublePressToggleDirection: {
            name: { en: "   Toggle direction on each trigger", ru: "   Менять направление изменения при каждом срабатывании" },
            desc: { en: "If enabled, direction switches with each press", ru: "Если включено, направление будет меняться при каждом нажатии" },
            type: "Boolean",
            value: false
        },
        doublePressIntervalTime: {
            name: { en: "   Interval time (ms)", ru: "   Время интервала (мс)" },
            desc: { en: "If greater than 0, enables automatic characteristic change", ru: "При значении больше 0 активируется автоматическое изменение характеристики" },
            type: "Integer",
            value: 0
        },
        doublePressStep: {
            name: { en: "   Step", ru: "   Шаг изменения" },
            type: "Double",
            value: 0
        },
        doublePressZero: {
            name: { en: "   To zero", ru: "   Не уменьшать до 0" },
            desc: { en: "For some characteristics zero value equals turn off", ru: "В некоторых характеристиках значение 0 приводит к выключению устройства (напр. яркость у ламп). Данная настройка ставит минимальное значение 1, вместо 0." },
            type: "Boolean",
            value: false
        },
        doublePressCustomLimits: {
            name: { en: "   Custom limits", ru: "   Собственные ограничения" },
            desc: { en: "Example: 18.5 - 27 or -40 - -0.7", ru: "Пример: 18.5 - 27 или -40 - -0.7. Укажите диапазон через тире (можно с пробелами), поддерживаются дробные и отрицательные числа с точкой или запятой." },
            type: "String",
            value: ""
        },
        doublePressCustomSteps: {
            name: { en: "   Custom steps", ru: "   Собственные шаги" },
            desc: { en: "Example: 1;7;16;35", ru: "Через точку с запятой. Например: 1;7;16;35. Можно вводить дробные значения через точку (25.5). Если установлено - настройка 'Шаг' не используется" },
            type: "String",
            value: ""
        },

        // Долгое нажатие кнопки (🖱️⏳)
        longPressOn: {
            name: { en: "🖱️⏳ Long press enabled", ru: "🖱️⏳ Обрабатывать долгое нажатие" },
            type: "Boolean",
            value: false
        },
        longPressWhatChange: {
            name: { en: "   What change", ru: "   Что изменять" },
            type: "Integer",
            value: -1,
            formType: "list",
            values: characteristicsList
        },
        longPressDirection: {
            name: { en: "   Change direction", ru: "   Направление изменения" },
            type: "Integer",
            value: 0,
            formType: "list",
            values: directionOptions
        },
        longPressToggleDirection: {
            name: { en: "   Toggle direction on each trigger", ru: "   Менять направление изменения при каждом срабатывании" },
            desc: { en: "If enabled, direction switches with each press", ru: "Если включено, направление будет меняться при каждом нажатии" },
            type: "Boolean",
            value: false
        },
        longPressIntervalTime: {
            name: { en: "   Interval time (ms)", ru: "   Время интервала (мс)" },
            desc: { en: "If greater than 0, enables automatic characteristic change", ru: "При значении больше 0 активируется автоматическое изменение характеристики" },
            type: "Integer",
            value: 0
        },
        longPressStep: {
            name: { en: "   Step", ru: "   Шаг изменения" },
            type: "Double",
            value: 0
        },
        longPressZero: {
            name: { en: "   To zero", ru: "   Не уменьшать до 0" },
            desc: { en: "For some characteristics zero value equals turn off", ru: "В некоторых характеристиках значение 0 приводит к выключению устройства (напр. яркость у ламп). Данная настройка ставит минимальное значение 1, вместо 0." },
            type: "Boolean",
            value: false
        },
        longPressCustomLimits: {
            name: { en: "   Custom limits", ru: "   Собственные ограничения" },
            desc: { en: "Example: 18.5 - 27 or -40 - -0.7", ru: "Пример: 18.5 - 27 или -40 - -0.7. Укажите диапазон через тире (можно с пробелами), поддерживаются дробные и отрицательные числа с точкой или запятой." },
            type: "String",
            value: ""
        },
        longPressCustomSteps: {
            name: { en: "   Custom steps", ru: "   Собственные шаги" },
            desc: { en: "Example: 1;7;16;35", ru: "Через точку с запятой. Например: 1;7;16;35. Можно вводить дробные значения через точку (25.5). Если установлено - настройка 'Шаг' не используется" },
            type: "String",
            value: ""
        },

        // Датчик касания (👆)
        contactSensorOn: {
            name: { en: "👆 Contact sensor enabled", ru: "👆 Обрабатывать датчик касания" },
            type: "Boolean",
            value: false
        },
        contactSensorWhatChange: {
            name: { en: "   What change", ru: "   Что изменять" },
            type: "Integer",
            value: -1,
            formType: "list",
            values: characteristicsList
        },
        contactSensorDirection: {
            name: { en: "   Change direction", ru: "   Направление изменения" },
            type: "Integer",
            value: 0,
            formType: "list",
            values: directionOptions
        },
        contactSensorToggleDirection: {
            name: { en: "   Toggle direction on each trigger", ru: "   Менять направление изменения при каждом срабатывании" },
            desc: { en: "If enabled, direction switches with each sensor trigger", ru: "Если включено, направление будет меняться при каждом срабатывании датчика" },
            type: "Boolean",
            value: false
        },
        contactSensorIntervalTime: {
            name: { en: "   Interval time (ms)", ru: "   Время интервала (мс)" },
            type: "Integer",
            value: 500
        },
        contactSensorStep: {
            name: { en: "   Step", ru: "   Шаг изменения" },
            type: "Double",
            value: 10
        },
        contactSensorZero: {
            name: { en: "   To zero", ru: "   Не уменьшать до 0" },
            desc: { en: "For some characteristics zero value equals turn off", ru: "В некоторых характеристиках значение 0 приводит к выключению устройства (напр. яркость у ламп). Данная настройка ставит минимальное значение 1, вместо 0." },
            type: "Boolean",
            value: false
        },
        contactSensorCustomLimits: {
            name: { en: "   Custom limits", ru: "   Собственные ограничения" },
            desc: { en: "Example: 18.5 - 27 or -40 - -0.7", ru: "Пример: 18.5 - 27 или -40 - -0.7. Укажите диапазон через тире (можно с пробелами), поддерживаются дробные и отрицательные числа с точкой или запятой." },
            type: "String",
            value: ""
        },
        contactSensorCustomSteps: {
            name: { en: "   Custom steps", ru: "   Собственные шаги" },
            desc: { en: "Example: 1;7;16;35", ru: "Через точку с запятой. Например: 1;7;16;35. Можно вводить дробные значения через точку (25.5). Если установлено - настройка 'Шаг' не используется" },
            type: "String",
            value: ""
        },
        contactSensorDelay: {
            name: { en: "   Delay time (ms)", ru: "   Время задержки (мс)" },
            desc: { en: "Delay before starting changes, set to 0 to disable delay", ru: "Задержка перед началом изменений, установите 0 для отключения задержки" },
            type: "Integer",
            value: 500
        }
    },

    variables: {
        delayTimer: undefined,
        buttonInterval: undefined,
        contactSensorInterval: undefined,
        singlePressIncreaseDirection: undefined,
        doublePressIncreaseDirection: undefined,
        longPressIncreaseDirection: undefined,
        contactSensorIncreaseDirection: undefined,
        lastLimitTime: undefined
    }
};
let inTestMode = false

function trigger(source, value, variables, options) {
    try {
        let service;
        let variableKey = "StepChange_" + source.getService().getUUID()
        let variableUUID = GlobalVariables[variableKey]
        if (variableUUID && variableKey.length >= 14) {
            let serviceFromVariable = getServiceByUUID(variableUUID)
            if (serviceFromVariable) {
                service = serviceFromVariable
            } else {
                return
            }
        }
        if (service == undefined || service == null) {
            if (options.characteristic !== '') {
                let serviceFromVariable = getServiceByUUID(options.characteristic)
                if (serviceFromVariable) {
                    service = serviceFromVariable
                } else {
                    return
                }
            } else {
                let accessory = Hub.getAccessory(options.accessoryId);
                if (accessory == null) {
                    log.error("Введённое устройство не найдено");
                    return;
                }
                service = accessory.getService(options.serviceId);
                if (service == null) {
                    log.error("Введённый сервис не найден у аксессуара {} {}", accessory.getName(), accessory.getUUID());
                    return;
                }
            }
        }

        const notification = options.notification;
        const isButton = source.getType() === HC.ProgrammableSwitchEvent;
        const isContactSensor = source.getType() === HC.ContactSensorState;

        if (isButton) {
            if (value === 0 && options.singlePressStopAuto && variables.buttonInterval) {
                debug("Одиночное нажатие: остановка автоматического изменения", source, options);
                clearInterval(variables.buttonInterval);
                variables.buttonInterval = undefined;
                return;
            }

            if (value === 0 && options.singlePressTurn) {
                const currentTime = Date.now();
                if (variables.lastLimitTime && (currentTime - variables.lastLimitTime < 3000)) {
                    debug("Одиночное нажатие проигнорировано: прошло менее 1 секунды после достижения лимита", source, options);
                    variables.lastLimitTime = currentTime - 10000;
                    return;
                }
                debug("Одиночное нажатие: переключение состояния устройства", source, options);
                const onCharacteristic = service.getCharacteristic(HC.On);
                const activeCharacteristic = service.getCharacteristic(HC.Active);
                let isOn = (onCharacteristic && onCharacteristic.getValue()) || (activeCharacteristic && activeCharacteristic.getValue() === 1);
                setDevicePowerState(service, !isOn, source, options);
                return;
            }

            let pressType, whatChange, step, customSteps, intervalTime, direction, enabled, increaseDirectionVar, zero, customLimitsStr, toggleDirection;
            if (value === 0 && options.singlePressOn) {
                pressType = "Одиночное";
                whatChange = options.singlePressWhatChange;
                step = options.singlePressStep;
                customSteps = parseCustomSteps(options.singlePressCustomSteps);
                intervalTime = options.singlePressIntervalTime;
                direction = options.singlePressDirection;
                enabled = options.singlePressOn;
                increaseDirectionVar = "singlePressIncreaseDirection";
                zero = options.singlePressZero;
                customLimitsStr = options.singlePressCustomLimits;
                toggleDirection = options.singlePressToggleDirection;
            } else if (value === 1 && options.doublePressOn) {
                pressType = "Двойное";
                whatChange = options.doublePressWhatChange;
                step = options.doublePressStep;
                customSteps = parseCustomSteps(options.doublePressCustomSteps);
                intervalTime = options.doublePressIntervalTime;
                direction = options.doublePressDirection;
                enabled = options.doublePressOn;
                increaseDirectionVar = "doublePressIncreaseDirection";
                zero = options.doublePressZero;
                customLimitsStr = options.doublePressCustomLimits;
                toggleDirection = options.doublePressToggleDirection;
            } else if (value === 2 && options.longPressOn) {
                pressType = "Долгое";
                whatChange = options.longPressWhatChange;
                step = options.longPressStep;
                customSteps = parseCustomSteps(options.longPressCustomSteps);
                intervalTime = options.longPressIntervalTime;
                direction = options.longPressDirection;
                enabled = options.longPressOn;
                increaseDirectionVar = "longPressIncreaseDirection";
                zero = options.longPressZero;
                customLimitsStr = options.longPressCustomLimits;
                toggleDirection = options.longPressToggleDirection;
            } else {
                debug(`Событие кнопки с value=${value} не обработано`, source, options);
                return;
            }

            if (enabled) {
                if (whatChange < 0) {
                    log.error(`Не выбрана характеристика для ${pressType} нажатия`);
                    return;
                }
                const characteristic = getCharacteristicByValue(whatChange);
                if (!characteristic) {
                    log.error(`Характеристика для ${pressType} нажатия не найдена`);
                    return;
                }
                const characteristicType = characteristic.type;
                const serviceCharacteristic = service.getCharacteristic(characteristicType);
                if (!serviceCharacteristic) {
                    log.error(`Характеристика ${characteristicType} не найдена у ${getDeviceName(service)} для ${pressType} нажатия`);
                    return;
                }

                let defaultMin = characteristic.min;
                let defaultMax = characteristic.max;
                const customLimits = parseCustomLimits(customLimitsStr);
                const characteristicMin = customLimits ? customLimits.min : (defaultMin === 0 && zero ? 1 : defaultMin);
                const characteristicMax = customLimits ? customLimits.max : defaultMax;
                const middleValue = (characteristicMax - characteristicMin) / 2;

                let currentValue = serviceCharacteristic.getValue();

                if (step > 0 || customSteps) {
                    let increase = getIsIncrease(direction, currentValue, middleValue, variables, increaseDirectionVar);
                    let nextValue = getNextValue(currentValue, characteristicMin, characteristicMax, step, customSteps, increase);
                    debug(`Изменение характеристики ${characteristic.name.ru} с ${currentValue} на ${nextValue.value} (увеличение: ${increase}) для ${pressType} нажатия`, source, options);
                    setValueAndSendNotify(serviceCharacteristic, characteristic, nextValue.value, notification, source, options);

                    if (nextValue.isLimit) {
                        variables[increaseDirectionVar] = !increase;
                        debug(`Достигнут предел: ${nextValue.value}, направление изменено на ${variables[increaseDirectionVar]} для ${pressType} нажатия`, source, options);
                    } else if (toggleDirection) {
                        variables[increaseDirectionVar] = !increase;
                        debug(`Направление изменено на ${variables[increaseDirectionVar] ? "увеличение" : "уменьшение"} для ${pressType} нажатия`, source, options);
                    }

                    if (intervalTime > 0 && !variables.contactSensorInterval) {
                        if (variables.buttonInterval) {
                            debug(`Остановка предыдущего интервала для ${pressType} нажатия`, source, options);
                            clearInterval(variables.buttonInterval);
                            variables.buttonInterval = undefined;
                        } else {
                            debug(`Запуск интервала для ${pressType} нажатия с периодом ${intervalTime} мс`, source, options);
                            variables.buttonInterval = setInterval(function () {
                                let currentValue = serviceCharacteristic.getValue();
                                let nextValue = getNextValue(currentValue, characteristicMin, characteristicMax, step, customSteps, increase);
                                debug(`Интервал: изменение ${characteristic.name.ru} на ${nextValue.value}`, source, options);
                                setValueAndSendNotify(serviceCharacteristic, characteristic, nextValue.value, notification, source, options);
                                if (nextValue.isLimit) {
                                    variables[increaseDirectionVar] = !increase;
                                    debug(`Интервал: достигнут предел ${nextValue.value}, остановка`, source, options);
                                    clearInterval(variables.buttonInterval);
                                    variables.buttonInterval = undefined;
                                    variables.lastLimitTime = Date.now();
                                }
                            }, intervalTime);
                        }
                    }
                }
            }
        }

        if (isContactSensor && options.contactSensorOn) {
            const whatChange = options.contactSensorWhatChange;
            if (whatChange < 0) {
                log.error("Не выбрана характеристика для датчика касания");
                return;
            }
            const characteristic = getCharacteristicByValue(whatChange);
            if (!characteristic) {
                log.error("Характеристика для датчика касания не найдена");
                return;
            }
            const characteristicType = characteristic.type;
            const serviceCharacteristic = service.getCharacteristic(characteristicType);
            if (!serviceCharacteristic) {
                log.error(`Характеристика ${characteristicType} не найдена у ${getDeviceName(service)} для датчика касания`);
                return;
            }

            let defaultMin = characteristic.min;
            let defaultMax = characteristic.max;
            const customLimits = parseCustomLimits(options.contactSensorCustomLimits);
            const characteristicMin = customLimits ? customLimits.min : (defaultMin === 0 && options.contactSensorZero ? 1 : defaultMin);
            const characteristicMax = customLimits ? customLimits.max : defaultMax;
            const middleValue = (characteristicMax - characteristicMin) / 2;

            const step = options.contactSensorStep;
            const customSteps = parseCustomSteps(options.contactSensorCustomSteps);
            const intervalTime = options.contactSensorIntervalTime;
            const direction = options.contactSensorDirection;
            const delay = options.contactSensorDelay;
            const toggleDirection = options.contactSensorToggleDirection;

            if (value === 1) {
                debug("Датчик касания открыт", source, options);
                if (variables.delayTimer) {
                    debug("Остановка предыдущего таймера датчика касания", source, options);
                    clearTimeout(variables.delayTimer);
                    variables.delayTimer = undefined;
                }

                const startInterval = function () {
                    variables.delayTimer = undefined;
                    let currentValue = serviceCharacteristic.getValue();
                    let increase = getIsIncrease(direction, currentValue, middleValue, variables, "contactSensorIncreaseDirection");
                    let nextValue = getNextValue(currentValue, characteristicMin, characteristicMax, step, customSteps, increase);
                    debug(`Начальное изменение ${characteristic.name.ru} на ${nextValue.value} для датчика касания`, source, options);
                    setValueAndSendNotify(serviceCharacteristic, characteristic, nextValue.value, notification, source, options);

                    if (nextValue.isLimit) {
                        variables.contactSensorIncreaseDirection = !increase;
                        debug(`Достигнут предел: ${nextValue.value}, направление изменено на ${variables.contactSensorIncreaseDirection} для датчика касания`, source, options);
                    } else if (toggleDirection) {
                        variables.contactSensorIncreaseDirection = !increase;
                        debug(`Направление изменено на ${variables.contactSensorIncreaseDirection ? "увеличение" : "уменьшение"} для датчика касания`, source, options);
                    }

                    debug(`Запуск интервала датчика касания с периодом ${intervalTime} мс`, source, options);
                    variables.contactSensorInterval = setInterval(function () {
                        let currentValue = serviceCharacteristic.getValue();
                        let nextValue = getNextValue(currentValue, characteristicMin, characteristicMax, step, customSteps, increase);
                        debug(`Интервал датчика: изменение ${characteristic.name.ru} на ${nextValue.value}`, source, options);
                        setValueAndSendNotify(serviceCharacteristic, characteristic, nextValue.value, notification, source, options);
                        if (nextValue.isLimit) {
                            variables.contactSensorIncreaseDirection = !increase;
                            debug(`Интервал датчика: достигнут предел ${nextValue.value}, остановка`, source, options);
                            clearInterval(variables.contactSensorInterval);
                            variables.contactSensorInterval = undefined;
                            variables.lastLimitTime = Date.now();
                        }
                    }, intervalTime);
                };

                if (delay > 0) {
                    debug(`Запуск таймера задержки ${delay} мс перед изменением`, source, options);
                    variables.delayTimer = setTimeout(startInterval, delay);
                } else {
                    debug("Задержка отключена (0 мс), немедленный запуск интервала", source, options);
                    startInterval();
                }
            } else {
                debug("Датчик касания закрыт", source, options);
                if (variables.delayTimer) {
                    debug("Остановка таймера датчика касания", source, options);
                    clearTimeout(variables.delayTimer);
                    variables.delayTimer = undefined;
                }
                if (variables.contactSensorInterval) {
                    debug("Остановка интервала датчика касания", source, options);
                    clearInterval(variables.contactSensorInterval);
                    variables.contactSensorInterval = undefined;
                }
            }
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}

function getServiceByUUID(uuid) {
    let uuidParts = uuid.split('.');
    const aid = uuidParts[0];
    const sid = uuidParts[1];
    service = getAccessoryById(aid).getService(sid);
    if (service == null) {
        log.error("Выбранное устройство не найдено");
        return null;
    }
    return service
}

function getAccessoryById(id) {
    if (inTestMode) return createAccessory(id)
    return Hub.getAccessory(id)
}

function debug(text, source, options) {
    if (options.debug) {
        console.info(`${DEBUG_TITLE} ${getDeviceName(source.getService())} ${text}`);
    }
}

function parseCustomLimits(customLimitsStr) {
    if (!customLimitsStr || customLimitsStr.trim() === "") return null;

    const parts = customLimitsStr.split(/\s*-\s*/);
    if (parts.length !== 2) {
        log.error(`Некорректный формат CustomLimits: ${customLimitsStr}. Ожидается 'min - max'`);
        return null;
    }

    const min = parseFloat(parts[0].replace(",", "."));
    const max = parseFloat(parts[1].replace(",", "."));

    if (isNaN(min) || isNaN(max)) {
        log.error(`Некорректные числа в CustomLimits: ${customLimitsStr}`);
        return null;
    }
    if (min >= max) {
        log.error(`Минимальное значение (${min}) должно быть меньше максимального (${max}) в CustomLimits: ${customLimitsStr}`);
        return null;
    }

    return { min, max };
}

function setDevicePowerState(service, value, source, options) {
    const onCharacteristic = service.getCharacteristic(HC.On);
    const activeCharacteristic = service.getCharacteristic(HC.Active);
    if (onCharacteristic) {
        onCharacteristic.setValue(value);
        debug(`Установлено значение On: ${value} для устройства ${getDeviceName(service)}`, source, options);
    }
    if (activeCharacteristic) {
        activeCharacteristic.setValue(value ? 1 : 0);
        debug(`Установлено значение Active: ${value ? 1 : 0} для устройства ${getDeviceName(service)}`, source, options);
    }
}

function setValueAndSendNotify(serviceCharacteristic, characteristic, value, notification, source, options) {
    serviceCharacteristic.setValue(value);
    debug(`Установлено значение ${value} для характеристики ${characteristic.name.ru} устройства ${getDeviceName(serviceCharacteristic.getService())}`, source, options);
    if (notification) {
        const text = "Установлено: " + characteristic.name.ru + " у " + getDeviceName(serviceCharacteristic.getService());
        Notify.text(value + " " + text).send();
        if (global.sendToTelegram !== undefined) {
            global.sendToTelegram(["*" + value + "*", text]);
        }
    }
}

function parseCustomSteps(customSteps) {
    if (customSteps === '') return null;
    let itemsStr = customSteps.trim().replace(" ", "").replace(",", ".").split(";");
    let items = [];
    itemsStr.forEach(function (i) { let value = parseFloat(i); if (!isNaN(value)) items.push(value); });
    if (items.length <= 1) return null;
    return items.sort(function (a, b) { return a - b; });
}

function getNextValue(current, min, max, step, customSteps, increase) {
    let newValue;
    if (customSteps != null) {
        newValue = fromCustomSteps(current, customSteps, increase);
    } else {
        newValue = increase ? current + step : current - step;
    }
    newValue = Math.min(Math.max(newValue, min), max);
    let isLimit = (!increase && newValue === min) || (increase && newValue === max);
    return { value: newValue, isLimit: isLimit };
}

function bisectLeft(arr, value) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < value) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

function fromCustomSteps(current, customSteps, increase) {
    if (customSteps.length === 0) return current;
    const index = bisectLeft(customSteps, current);
    if (index < customSteps.length && customSteps[index] === current) {
        return increase ?
            (index + 1 < customSteps.length ? customSteps[index + 1] : customSteps[index]) :
            (index - 1 >= 0 ? customSteps[index - 1] : customSteps[index]);
    } else {
        return increase ?
            (index < customSteps.length ? customSteps[index] : customSteps[customSteps.length - 1]) :
            (index > 0 ? customSteps[index - 1] : customSteps[0]);
    }
}

function getIsIncrease(direction, currentValue, middleValue, variables, increaseDirectionVar) {
    let increase;
    if (direction === 1) {
        increase = true;
    } else if (direction === 2) {
        increase = false;
    } else {
        if (variables[increaseDirectionVar] === true) increase = true;
        else if (variables[increaseDirectionVar] === false) increase = false;
        else {
            increase = currentValue < middleValue;
            variables[increaseDirectionVar] = increase;
        }
    }
    return increase;
}

function getCharacteristicByValue(value) {
    var target;
    characteristicsList.forEach(function (c) {
        if (c.value == value) {
            target = c;
            return target;
        }
    });
    return target;
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName();
    const accName = acc.getName();
    const sName = service.getName();
    return room + " -> " + (accName === sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")";
}

// Инициализация characteristicsList
characteristicsList.push({ name: { ru: "Не выбрано", en: "Not selected" }, value: -1 });
characteristicsList.push({ name: { ru: "Яркость", en: "Brightness" }, value: 0, type: HC.Brightness, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Цветовая температура", en: "Color Temperature" }, value: 1, type: HC.ColorTemperature, min: 50, max: 400 });
characteristicsList.push({ name: { ru: "Насыщенность", en: "Saturation" }, value: 2, type: HC.Saturation, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Оттенок", en: "Hue" }, value: 3, type: HC.Hue, min: 0, max: 360 });
characteristicsList.push({ name: { ru: "Целевая позиция", en: "Target Position" }, value: 4, type: HC.TargetPosition, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Целевая температура", en: "Target Temperature" }, value: 5, type: HC.TargetTemperature, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Целевая влажность", en: "Target Relative Humidity" }, value: 6, type: HC.TargetRelativeHumidity, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Порог нагрева", en: "Heating Threshold Temperature" }, value: 7, type: HC.HeatingThresholdTemperature, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Порог охлаждения", en: "Cooling Threshold Temperature" }, value: 8, type: HC.CoolingThresholdTemperature, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Скорость вентилятора (%)", en: "Rotation Speed (%)" }, value: 9, type: HC.RotationSpeed, min: 0, max: 100 });
characteristicsList.push({ name: { ru: "Скорость вентилятора (Шаг)", en: "Fan Speed (Step)" }, value: 10, type: HC.C_FanSpeed, min: 0, max: 5 });
characteristicsList.push({ name: { ru: "Громкость", en: "Volume" }, value: 11, type: HC.Volume, min: 0, max: 100 });

let characteristicsToFound = characteristicsList.map(c => c.type);

// Инициализация servicesList
servicesList.push({ name: { ru: "Не выбрано", en: "Not selected" }, value: '' });
let servicesListUnsort = [];
Hub.getAccessories().forEach(function (a) {
    a.getServices().forEach(function (s) {
        let found = false;
        s.getCharacteristics().forEach(function (c) {
            if (found || characteristicsToFound.indexOf(c.getType()) < 0) return;
            const displayname = getDeviceName(s);
            servicesListUnsort.push({ name: { ru: displayname, en: displayname }, value: s.getUUID() });
            found = true;
        });
    });
});
servicesListUnsort.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach(s => servicesList.push(s));

// Константа для отладки
const DEBUG_TITLE = "📈 Пошаговое изменение. ";