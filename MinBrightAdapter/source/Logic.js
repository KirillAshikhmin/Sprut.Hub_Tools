let servicesList = getServicesByServiceAndCharacteristicType([HS.Lightbulb], [HC.Brightness, HC.ColorTemperature, HC.Hue, HC.Saturation]);

info = {
    name: "💡 Универсальный адаптер ламп",
    description: "Служит для конвертации всех характеристик физических ламп/диммеров (яркость, температура, оттенок, насыщенность, включение) в настраиваемые диапазоны виртуальной лампы",
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Lightbulb],
    sourceCharacteristics: [HC.Brightness, HC.ColorTemperature, HC.Hue, HC.Saturation, HC.On],

    options: {
        lamp: {
            name: {
                en: "Lamp",
                ru: "Выберите лампу/диммер"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        feedback: {
            name: { en: "Feedback", ru: "Обратная связь" },
            desc: {
                en: "When enabled, mirrors changes from the selected lamp back to this lamp (On, Brightness, ColorTemperature, Hue, Saturation) using inverse mapping within configured ranges.",
                ru: "При включении отражает изменения выбранной лампы на текущую (Вкл, Яркость, Температура, Оттенок, Насыщенность), пересчитывая значения обратной формулой с учётом заданных диапазонов."
            },
            type: "Boolean",
            value: false
        },
        minBright: {
            name: { en: "Brightness Min", ru: "Яркость Минимальная" },
            type: "Integer",
            value: 0,
            minValue: 0,
            maxValue: 100,
        },
        maxBright: {
            name: { en: "Brightness Max", ru: "Яркость Максимальная" },
            type: "Integer",
            value: 100,
            minValue: 0,
            maxValue: 100,
        },
        minTemp: {
            name: { en: "Temperature Min", ru: "Температура Минимальная" },
            type: "Integer",
            value: 50,
            minValue: 50,
            maxValue: 400,
        },
        maxTemp: {
            name: { en: "Temperature Max", ru: "Температура Максимальная" },
            type: "Integer",
            value: 400,
            minValue: 50,
            maxValue: 400,
        },
        minHue: {
            name: { en: "Hue Min", ru: "Оттенок Минимальный" },
            type: "Integer",
            value: 0,
            minValue: 0,
            maxValue: 360,
        },
        maxHue: {
            name: { en: "Hue Max", ru: "Оттенок Максимальный" },
            type: "Integer",
            value: 360,
            minValue: 0,
            maxValue: 360,
        },
        minSaturation: {
            name: { en: "Saturation Min", ru: "Насыщенность Минимальная" },
            type: "Integer",
            value: 0,
            minValue: 0,
            maxValue: 100,
        },
        maxSaturation: {
            name: { en: "Saturation Max", ru: "Насыщенность Максимальная" },
            type: "Integer",
            value: 100,
            minValue: 0,
            maxValue: 100,
        }
    },
    variables: {
        subscribed: false,
        subscribe: undefined,
        lastSetTime: undefined,
        subscribedUUID: undefined
    }
};

const debug = false

function trigger(source, value, variables, options, context) {
    try {
        // Валидация введённых значений
        let hasError = false;
        if (options.minBright < 0 || options.minBright > 100) { console.error("Минимальная яркость должна быть в диапазоне 0-100"); hasError = true; }
        if (options.maxBright < 0 || options.maxBright > 100) { console.error("Максимальная яркость должна быть в диапазоне 0-100"); hasError = true; }
        if (options.minBright >= options.maxBright) { console.error("Минимальная яркость должна быть меньше максимальной"); hasError = true; }
        if (options.minTemp < 50 || options.minTemp > 400) { console.error("Минимальная температура должна быть в диапазоне 50-400"); hasError = true; }
        if (options.maxTemp < 50 || options.maxTemp > 400) { console.error("Максимальная температура должна быть в диапазоне 50-400"); hasError = true; }
        if (options.minTemp >= options.maxTemp) { console.error("Минимальная температура должна быть меньше максимальной"); hasError = true; }
        if (options.minHue < 0 || options.minHue > 360) { console.error("Минимальный оттенок должен быть в диапазоне 0-360"); hasError = true; }
        if (options.maxHue < 0 || options.maxHue > 360) { console.error("Максимальный оттенок должен быть в диапазоне 0-360"); hasError = true; }
        if (options.minHue >= options.maxHue) { console.error("Минимальный оттенок должен быть меньше максимального"); hasError = true; }
        if (options.minSaturation < 0 || options.minSaturation > 100) { console.error("Минимальная насыщенность должна быть в диапазоне 0-100"); hasError = true; }
        if (options.maxSaturation < 0 || options.maxSaturation > 100) { console.error("Максимальная насыщенность должна быть в диапазоне 0-100"); hasError = true; }
        if (options.minSaturation >= options.maxSaturation) { console.error("Минимальная насыщенность должна быть меньше максимальной"); hasError = true; }
        if (options.lamp == "") { console.error("Выберите реальный аксессуар лампы/диммера"); hasError = true; }

        // Если обратная связь выключена или лампа не выбрана, снимем подписку, если она была
        if (!options.feedback || options.lamp == "") {
            if (variables.subscribe) { try { variables.subscribe.clear(); } catch (e) {} }
            variables.subscribe = undefined
            variables.subscribed = false
            variables.subscribedUUID = undefined
        }

        if (hasError) return;
        
        const cdata = options.lamp.split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        service = Hub.getAccessory(aid).getService(sid)

        // Подписка на изменения у выбранной лампы для обратной связи
        if (options.feedback) {
            // Если уже есть подписка на другую лампу — снимем её
            if (variables.subscribe && variables.subscribedUUID && variables.subscribedUUID != options.lamp) {
                try { variables.subscribe.clear(); } catch (e) {}
                variables.subscribe = undefined
                variables.subscribed = false
                variables.subscribedUUID = undefined
            }

            if (!variables.subscribe || variables.subscribed != true) {
                let subscribe = Hub.subscribeWithCondition("", "", [HS.Lightbulb], [HC.On, HC.Brightness, HC.ColorTemperature, HC.Hue, HC.Saturation], function (sensorSource, sensorValue) {
                    try {
                        let sensorService = sensorSource.getService()
                        if (!sensorService || sensorService.getUUID() != options.lamp) return;

                        // Игнорируем событие, если оно вызвано недавней установкой значения этим сценарием
                        if (variables.lastSetTime && (Date.now() - variables.lastSetTime) < 100) return;

                        let targetService = source.getService()
                        let chrType = sensorSource.getType()
                        let mappedValue = undefined

                        if (chrType == HC.On) {
                            let chr = targetService.getCharacteristic(HC.On)
                            if (chr) {
                                let currentBool = chr.getValue() === true
                                let mappedBool = sensorValue === true
                                if (currentBool != mappedBool) {
                                    chr.setValue(mappedBool)
                                }
                            }
                            return;
                        }

                        if (chrType == HC.Brightness) {
                            let minV = options.minBright
                            let maxV = options.maxBright
                            let outRange = Math.max(0, maxV - minV)
                            if (sensorValue <= 0) mappedValue = 0; else {
                                let normalized = outRange > 0 ? (sensorValue - minV) / outRange : 0
                                normalized = Math.max(0, Math.min(1, normalized))
                                mappedValue = Math.round(normalized * 100)
                            }
                            mappedValue = Math.max(0, Math.min(100, mappedValue))
                            let chr = targetService.getCharacteristic(HC.Brightness)
                            if (chr) {
                                let current = chr.getValue()
                                if (current != mappedValue) { chr.setValue(mappedValue) }
                            }
                            return;
                        }

                        if (chrType == HC.ColorTemperature) {
                            let minV = options.minTemp
                            let maxV = options.maxTemp
                            let outRange = Math.max(1, maxV - minV)
                            let normalized = (sensorValue - minV) / outRange
                            normalized = Math.max(0, Math.min(1, normalized))
                            let inputRange = 400 - 50
                            mappedValue = 50 + Math.round(normalized * inputRange)
                            mappedValue = Math.max(50, Math.min(400, mappedValue))
                            let chr = targetService.getCharacteristic(HC.ColorTemperature)
                            if (chr) {
                                let current = chr.getValue()
                                if (current != mappedValue) { chr.setValue(mappedValue) }
                            }
                            return;
                        }

                        if (chrType == HC.Hue) {
                            let minV = options.minHue
                            let maxV = options.maxHue
                            let outRange = Math.max(1, maxV - minV)
                            let normalized = (sensorValue - minV) / outRange
                            normalized = Math.max(0, Math.min(1, normalized))
                            mappedValue = Math.round(normalized * 360)
                            mappedValue = Math.max(0, Math.min(360, mappedValue))
                            let chr = targetService.getCharacteristic(HC.Hue)
                            if (chr) {
                                let current = chr.getValue()
                                if (current != mappedValue) { chr.setValue(mappedValue) }
                            }
                            return;
                        }

                        if (chrType == HC.Saturation) {
                            let minV = options.minSaturation
                            let maxV = options.maxSaturation
                            let outRange = Math.max(1, maxV - minV)
                            let normalized = (sensorValue - minV) / outRange
                            normalized = Math.max(0, Math.min(1, normalized))
                            mappedValue = Math.round(normalized * 100)
                            mappedValue = Math.max(0, Math.min(100, mappedValue))
                            let chr = targetService.getCharacteristic(HC.Saturation)
                            if (chr) {
                                let current = chr.getValue()
                                if (current != mappedValue) { chr.setValue(mappedValue) }
                            }
                            return;
                        }
                    } catch (e2) {
                        console.error("Ошибка обратной связи: " + e2.toString())
                    }
                }, source.getAccessory())
                variables.subscribe = subscribe
                variables.subscribed = true
                variables.subscribedUUID = options.lamp
            }
        }
        
        // Если событие вызвано самим сценарием (логикой), определим по context и не будем пересчитывать повторно
        if (isSelfTrigger(context)) return;

        if (source.getType() == HC.Brightness) {
            let newValue
            if (value > 0) {
                // Логика для яркости: конвертируем 0-100 в minBright-maxBright
                let range = options.maxBright - options.minBright
                let percent = value / 100.0
                newValue = options.minBright + Math.round(range * percent)
            } else {
                newValue = 0
            }
            if (debug) console.log(`Яркость: ${value} → ${newValue}`)
            variables.lastSetTime = Date.now();
            service.getCharacteristic(HC.Brightness).setValue(newValue)
        } else if (source.getType() == HC.ColorTemperature) {
            let newValue
            if (value > 0) {
                let inputRange = 400 - 50
                let outputRange = options.maxTemp - options.minTemp
                let normalizedValue = (value - 50) / inputRange
                newValue = options.minTemp + Math.round(outputRange * normalizedValue)
            } else {
                newValue = options.minTemp
            }
            if (debug) console.log(`Температура: ${value} → ${newValue}`)
            variables.lastSetTime = Date.now();
            service.getCharacteristic(HC.ColorTemperature).setValue(newValue)
        } else if (source.getType() == HC.Hue) {
            let newValue
            if (value > 0) {
                let inputRange = 360 - 0
                let outputRange = options.maxHue - options.minHue
                let normalizedValue = value / inputRange
                newValue = options.minHue + Math.round(outputRange * normalizedValue)
            } else {
                newValue = options.minHue
            }
            if (debug) console.log(`Оттенок: ${value} → ${newValue}`)
            variables.lastSetTime = Date.now();
            service.getCharacteristic(HC.Hue).setValue(newValue)
        } else if (source.getType() == HC.Saturation) {
            let newValue
            if (value > 0) {
                let outputRange = options.maxSaturation - options.minSaturation
                let normalizedValue = value / 100.0
                newValue = options.minSaturation + Math.round(outputRange * normalizedValue)
            } else {
                newValue = options.minSaturation
            }
            if (debug) console.log(`Насыщенность: ${value} → ${newValue}`)
            variables.lastSetTime = Date.now();
            service.getCharacteristic(HC.Saturation).setValue(newValue)
        } else if (source.getType() == HC.On) {
            // Прямая передача состояния включения/выключения
            if (debug) console.log(`Включение: ${value} → ${value}`)
            variables.lastSetTime = Date.now();
            service.getCharacteristic(HC.On).setValue(value)
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}

function isSelfTrigger(context) {
    try {
        if (!context) return false;
        const text = context.toString();
        // Паттерн, аналогичный сценарию циркады: 'LOGIC <- C <- LOGIC' обозначает самопричину
        const elements = text.split(' <- ');
        if (elements.length >= 3 && elements[0].startsWith('LOGIC') && elements[1].startsWith('C') && elements[2] == elements[0]) {
            return true;
        }
        // Игнорировать события от запуска хаба
        if (elements.length > 0 && elements[elements.length - 1].startsWith('HUB[OnStart]')) {
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыта" : "")
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