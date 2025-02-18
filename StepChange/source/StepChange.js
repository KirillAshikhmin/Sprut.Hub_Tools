let characteristicsList = [];
let servicesList = [];

info = {
    name: "Пошаговое изменение характеристики по кнопке или датчику касания",
    description: "Изменяет выбранную характеристику устройства по нажатию на кнопку или в цикле, пока кнопка зажата",
    version: "1.0",
    author: "@BOOMikru Special thx to @dshtolin",
    onStart: false,

    sourceServices: [HS.ContactSensor, HS.StatelessProgrammableSwitch],
    sourceCharacteristics: [HC.ContactSensorState, HC.ProgrammableSwitchEvent],

    options: {
        step: {
            name: {
                en: "Step",
                ru: "Шаг изменения"
            },
            type: "Double", // Изменено на Integer
            value: 10 // Значение по умолчанию для шага
        },
        intervalTime: {
            name: {
                en: "Interval Time (milliseconds)",
                ru: "Время интервала (миллисекунды)"
            },
            desc: {
                en: "For contact sensor",
                ru: "Для датчика касания"
            },
            type: "Integer", // Изменено на Integer
            value: 500 // Значение по умолчанию для времени интервала
        },
        delay: {
            name: {
                en: "Delay Time (milliseconds)",
                ru: "Время задержки перед изменением (миллисекунды)"
            },
            desc: {
                en: "For contact sensor",
                ru: "Для датчика касания"
            },
            type: "Integer", // Изменено на Integer
            value: 500 // Значение по умолчанию для времени интервала
        },
        whatChange: {
            name: {
                en: "What сhange",
                ru: "Что изменять"
            },
            type: "Integer",
            value: -1,
            formType: "list",
            values: characteristicsList
        },
        characteristic: {
            name: {
                en: "Characteristic",
                ru: "Выберите устройство"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        accessoryId: {
            name: {
                en: "Characteristic",
                ru: "   или укажите ID аксессуара"
            },
            type: "Integer",
            value: 0,
        },
        serviceId: {
            name: {
                en: "Characteristic",
                ru: "   и ID сервиса"
            },
            type: "Integer",
            value: 0,
        },
        direction: {
            name: {
                en: "Change direction",
                ru: "Направление изменения"
            },
            type: "Integer",
            value: 0,
            formType: "list",
            values: [
                { value: 0, name: { en: "Increase and decrease", ru: "Увеличивать и уменьшать" } },
                { value: 1, name: { en: "Increase", ru: "Увеличивать" } },
                { value: 2, name: { en: "Decrease", ru: "Уменьшать" } }
            ]
        },
        zero: {
            name: {
                en: "To zero",
                ru: "Не уменьшать до 0"
            },
            desc: {
                en: "For some characrestics zero value equal to turn off",
                ru: "В некоторых характеристиках значение 0 приводит к выключению устройства (напр. яркость у ламп). Данная настройка ставит минимальное значение 1, то есть не до полного отключения."
            },
            type: "Boolean", // Изменено на Integer
            value: true // Значение по умолчанию для времени интервала
        },
        customLimits: {
            name: {
                en: "Custom limits",
                ru: "Собственные ограничения"
            },
            desc: {
                en: "example: 18-24 for temperature",
                ru: "Например установить от 18 до 24 градусов при изменении температуры"
            },
            type: "Boolean", // Изменено на Integer
            value: false // Значение по умолчанию для времени интервала
        },
        min: {
            name: {
                en: "minimum",
                ru: "   ↓ минимальное значение"
            },
            type: "Double",
            value: 0,
        },
        max: {
            name: {
                en: "maximum",
                ru: "   ↑ максимальное значение"
            },
            type: "Double",
            value: 0,
        },
        customSteps: {
            name: {
                en: "Custom steps",
                ru: "Собственные шаги"
            },
            desc: {
                en: "example: 1;7;16;35",
                ru: "Через точку с запятой. Например: 1;7;16;35. Можно вводить дробные значения через точку (25.5). Если установлено - шастройка 'Шаг' не используется"
            },
            type: "String",
            value: "",
        },
        notification: {
            name: {
                en: "Send notification",
                ru: "Отправлять уведомление"
            },
            desc: {
                en: "System and to telegram",
                ru: "Cистемные уведомления и в telegram"
            },
            type: "Boolean", // Изменено на Integer
            value: false // Значение по умолчанию для времени интервала
        },
    },

    variables: {
        delayTimer: undefined,
        interval: undefined,
        increseDirection: undefined
    }
};

function trigger(source, value, variables, options) {
    try {
        if (options.whatChange < 0) {
            log.error("Необходимо выбрать характеристику для изменения");
            return;
        }
        if (options.characteristic === '' && (options.accessoryId <= 0 || options.serviceId <= 0)) {
            log.error("Необходимо выбрать аксессуар для изменения яркости через виртуальную логику");
            return;
        }
        var service
        if (options.characteristic != '') {
            const cdata = options.characteristic.split('.');
            const aid = cdata[0];
            const sid = cdata[1];
            service = Hub.getAccessory(aid).getService(sid)
            if (service == null) {
                log.error("Выбранное устройство не найдено");
                return;
            }
        } else {
            let accessory = Hub.getAccessory(options.accessoryId)
            if (accessory == null) {
                log.error("Введённое устройство не найдено");
                return;
            }
            service = accessory.getService(options.serviceId)
            if (service == null) {
                log.error("Введённый сервис не найден у аксессуара {} {}", accessory.getName(), accessory.getUUID());
                return;
            }
        }

        const characteristic = getCharacteristicByValue(options.whatChange)
        if (!characteristic) {
            log.error("Выбранная характеристика не найдена");
            return;
        }
        const characteristicType = characteristic.type
        const serviceCharacteristic = service.getCharacteristic(characteristicType);
        if (!serviceCharacteristic) {
            log.error("Характеристика {} не найдена у {}", characteristicType, getDeviceName(service));
            return;
        }

        let defaultMin = characteristic.min
        let defaultMax = characteristic.max
        const notification = options.notification
        const step = options.step
        const intervalTime = options.intervalTime
        const delay = options.delay
        const direction = options.direction
        const zero = options.zero
        const customLimits = options.customLimits
        const min = options.min
        const max = options.max
        const customSteps = parseCustomSteps(options.customSteps)
        if (options.customSteps != '') {
            if (customSteps == null) {
                log.error("неверно указаны собственные шаги. Убедитесь что введено более 2 значений через точку с запятой. Текущее значение: {}", options.customSteps);
                return;
            }
            defaultMin = customSteps[0]
            defaultMax = customSteps[customSteps.length - 1]
        }

        const characteristicMin = customLimits ? Math.max(defaultMin, min) : (defaultMin == 0 && zero ? 1 : defaultMin)
        const characteristicMax = customLimits ? Math.min(defaultMax, max) : defaultMax

        const middleValue = (characteristicMax - characteristicMin) / 2

        if (variables.interval) {
            clearInterval(variables.interval);
            variables.interval = undefined;
        }
        if (variables.delayTimer) {
            clearInterval(variables.delayTimer);
            variables.delayTimer = undefined;
        }

        const isButton = source.getType() == HC.ProgrammableSwitchEvent

        // Одиночное нажатие кнопки
        if (isButton && value == 0) {
            let currentValue = serviceCharacteristic.getValue();
            var increase = getIsIncrease(direction, currentValue, middleValue, variables)
            let nextValue = getNextValue(currentValue, characteristicMin, characteristicMax, step, customSteps, increase)
            setValueAndSendNotify(serviceCharacteristic, characteristic, nextValue.value, notification)
            if (nextValue.isLimit) {
                variables.increseDirection = !increase
            }
        } else {
            // Датчик касания открыт
            if (value === 1) {
                variables.delayTimer = setTimeout(function () {
                    variables.delayTimer = undefined
                    var currentValue = serviceCharacteristic.getValue();
                    var increase = getIsIncrease(direction, currentValue, middleValue, variables)
                    variables.interval = setInterval(function () {
                        let nextValue = getNextValue(serviceCharacteristic.getValue(), characteristicMin, characteristicMax, step, customSteps, increase)
                        setValueAndSendNotify(serviceCharacteristic, characteristic, nextValue.value, notification)
                        // Останавливаем интервал, если значение достигло предела (0 или 100)
                        if (nextValue.isLimit) {
                            variables.increseDirection = !increase
                            clearInterval(variables.interval);
                            variables.interval = undefined;
                        }
                    }, intervalTime); // Используем время интервала из options
                }, delay)
            }
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}

function setValueAndSendNotify(serviceCharacteristic, characteristic, value, notification) {
    serviceCharacteristic.setValue(value)
    if (notification) {
        const text = "Установлено: " + characteristic.name.ru + " у " + getDeviceName(serviceCharacteristic.getService())
        Notify.text(value + " " + text).send()
        if (global.sendToTelegram !== undefined)
            global.sendToTelegram(["*"+value+"*", text]);
    }
}

function parseCustomSteps(customSteps) {
    if (customSteps === '') return null
    let itemsStr = customSteps.trim().replace(" ", "").replace(",", ".").split(";")
    let items = []
    itemsStr.forEach(function (i) { let value = parseFloat(i); if (!isNaN(value)) items.push(value) })
    if (itemsStr.length <= 1) return null
    let sorted = items.sort(function (a, b) { return a - b; })
    return sorted
}

function getNextValue(current, min, max, step, customSteps, increase) {
    var newValue

    if (customSteps != null) {
        newValue = fromCustomSteps(current, customSteps, increase)
    } else {
        if (increase) {
            newValue = current + step, max;
        } else {
            newValue = current - step, min;
        }
    }
    newValue = Math.min(Math.max(newValue, min), max);
    let isLimit = (!increase && newValue === min) || (increase && newValue === max)
    return { value: newValue, isLimit: isLimit }
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
    if (customSteps.length === 0) return null;
    const index = bisectLeft(customSteps, current);
    // Случай, когда элемент найден в массиве
    if (index < customSteps.length && customSteps[index] === current) {
        if (increase) {
            return (index + 1 < customSteps.length) ? customSteps[index + 1] : customSteps[index];
        } else {
            return (index - 1 >= 0) ? customSteps[index - 1] : customSteps[index];
        }
    }
    // Элемент не найден
    else {
        if (increase) {
            return ((index + 1) < customSteps.length) ? customSteps[index + 1] : customSteps[customSteps.length - 1];
        } else {
            return (index > 0) ? customSteps[index - 1] : customSteps[0];
        }
    }
}

function getIsIncrease(direction, currentValue, middleValue, variables) {
    let increase
    if (direction == 1) {
        increase = true
    } else if (direction == 2) {
        increase = false
    } else {
        if (variables.increseDirection === true) increase = true
        else if (variables.increseDirection === false) increase = false
        else {
            increase = direction == 0 ? (currentValue < middleValue) : (direction == 1 ? true : false)
            variables.increseDirection = increase
        }
    }
    return increase
}

function getCharacteristicByValue(value) {
    var target
    characteristicsList.forEach(function (c) {
        if (c.value == value) {
            target = c
            return target
        }
    })
    return target
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")"
    return name
}

// тип сервиса и его тип характеристики, значение которой будем менять
characteristicsList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: -1 });
characteristicsList.push({ name: { ru: "Яркость", en: "" }, value: 0, type: HC.Brightness, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Цветовая температура", en: "" }, value: 1, type: HC.ColorTemperature, min = 50, max = 400 });
characteristicsList.push({ name: { ru: "Насыщенность", en: "" }, value: 2, type: HC.Saturation, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Оттенок", en: "" }, value: 3, type: HC.Hue, min = 0, max = 360 });
characteristicsList.push({ name: { ru: "Целевая позиция", en: "" }, value: 4, type: HC.TargetPosition, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Целевая температура", en: "" }, value: 5, type: HC.TargetTemperature, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Целевая влажность", en: "" }, value: 6, type: HC.TargetRelativeHumidity, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Порог нагрева", en: "" }, value: 7, type: HC.HeatingThresholdTemperature, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Порог охлаждения", en: "" }, value: 8, type: HC.CoolingThresholdTemperature, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Скорость вентилятора (%)", en: "" }, value: 9, type: HC.RotationSpeed, min = 0, max = 100 });
characteristicsList.push({ name: { ru: "Скорость вентилятора (Шаг)", en: "" }, value: 10, type: HC.C_FanSpeed, min = 0, max = 5 });
characteristicsList.push({ name: { ru: "Громкость", en: "" }, value: 11, type: HC.Volume, min = 0, max = 100 });

let characteriscticsToFound = [];
characteristicsList.forEach(function (c) {
    characteriscticsToFound.push(c.type)
})

let servicesListUnsort = [];
servicesList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: '' });
// подготовка списка характеристик для выбора в настройке логики
var found = false
Hub.getAccessories().forEach(function (a) {
    a.getServices().forEach(function (s) {
        found = false
        s.getCharacteristics().forEach(function (c) {
            if (found == true || characteriscticsToFound.indexOf(c.getType()) < 0) return;

            const displayname = getDeviceName(s);
            servicesListUnsort.push({
                name: { ru: displayname, en: displayname },
                value: s.getUUID()
            });
            found = true
        })
    })
});
servicesListUnsort.sort(function (a, b) { return a.name.ru.localeCompare(b.name.ru); }).forEach(function (s) { servicesList.push(s) })
