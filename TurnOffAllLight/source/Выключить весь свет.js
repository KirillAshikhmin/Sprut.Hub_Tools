/**
 * Отключает все лампы, выключатели и розетки и т.д. в доме
 * 
 * Использование:
 * global.turnAllOff({
 *   excludeRooms: ["Коридор", "Двор"],           // Названия комнат, где не надо выключать свет
 *   excludeAccessories: [130, 188.15],           // ID устройств и сервисов, которые не надо выключать
 *   additionalDevices: [200, 300.5],             // ID дополнительных устройств для отключения
 *   lightbulbs: true,                            // Отключать лампочки
 *   switches: true,                              // Отключать выключатели  
 *   outlets: false,                              // Отключать розетки
 *   hidden: false,                               // Отключать скрытые устройства
 *   interval: 500,                               // Интервал выключения в миллисекундах
 *   debug: false                                 // Режим отладки
 * })
 */
function turnAllOff(params) {
    var excludeRoomsNames = []; //ID комнат, где не надо выключать свет (например: ["Коридор", "Двор", "Информер"])
    var excludeAccessoriesId = []; //ID устройств, которые не надо выключать (например: [130, "188", 200.15, "300.20"])
    var additionalDevicesDefault = []; //ID устройств и сервисов для дополнительного отключения любых типов устройств (например: [130, "188", 200.15, "300.20"])
    var hiddenDefault = false; // Отключать скрытые
    var outletsDefault = false; // Отключать розетки
    var lightbulbsDefault = true; // Отключать лампочки
    var switchesDefault = true; // Отключать выключатели
    var intervalDefault = 0; // Интервал выключения устройств в миллисекундах (0 = одновременно, >0 = по очереди)
    var debugDefault = false; // Активация дополнительного логгирования для отладки

    // Валидация входных параметров
    if (!params || typeof params !== 'object') {
        console.error("turnAllOff: параметр params должен быть объектом");
        return;
    }
    // Используем переданные параметры или значения по умолчанию
    var actualAdditionalDevices = params.additionalDevices !== undefined ? params.additionalDevices : additionalDevicesDefault;
    var actualLightbulbs = params.lightbulbs !== undefined ? params.lightbulbs : lightbulbsDefault;
    var actualSwitches = params.switches !== undefined ? params.switches : switchesDefault;
    var actualOutlets = params.outlets !== undefined ? params.outlets : outletsDefault;
    var actualHidden = params.hidden !== undefined ? params.hidden : hiddenDefault;
    var actualInterval = params.interval !== undefined ? params.interval : intervalDefault;
    var actualDebug = params.debug !== undefined ? params.debug : debugDefault;

    // Валидация интервала выключения
    var interval = parseInt(actualInterval) || 0;
    if (interval < 0) {
        interval = 0;
        if (actualDebug) {
            console.warn("Некорректное значение interval, установлено 0");
        }
    }

    var excRooms = []
    var excAccessories = []
    var excServices = []

    // Обработка исключений комнат
    excludeRoomsNames.forEach(function fe(room) { excRooms.push(room) })
    getArrayFromValue(params.excludeRooms, "string").forEach(function fe(room) { excRooms.push(room) })

    // Обработка исключений аксессуаров и сервисов из глобальных настроек
    var globalExclusions = parseExclusions(excludeAccessoriesId);
    excAccessories = excAccessories.concat(globalExclusions.excAccessories);
    excServices = excServices.concat(globalExclusions.excServices);

    // Обработка исключений аксессуаров и сервисов из параметров функции
    var paramExclusions = parseExclusions(params.excludeAccessories);
    excAccessories = excAccessories.concat(paramExclusions.excAccessories);
    excServices = excServices.concat(paramExclusions.excServices);

    // Парсим дополнительные устройства для отключения
    var additionalDevices = [];
    if (actualAdditionalDevices && actualAdditionalDevices.length > 0) {
        var additionalExclusions = parseExclusions(actualAdditionalDevices);
        additionalDevices = additionalExclusions.excAccessories.concat(additionalExclusions.excServices);
    }

    /**
     * Парсит идентификаторы исключений в различных форматах
     * Поддерживает:
     * - Целые числа: 130, "130"
     * - Дробные числа: 130.13, "130.13" (аксессуар.сервис)
     * - Массивы с любыми из вышеперечисленных форматов
     * @param {*} value - Значение для парсинга
     * @returns {Object} Объект с массивами excAccessories и excServices
     */
    function parseExclusions(value) {
        var excAccessories = [];
        var excServices = [];

        if (!value) {
            return { excAccessories: excAccessories, excServices: excServices };
        }

        var items = [];
        if (Array.isArray(value)) {
            items = value;
        } else {
            items.push(value);
        }

        items.forEach(function (item) {
            var parsed = parseExclusionItem(item);
            if (parsed.accessoryId !== null) {
                excAccessories.push(parsed.accessoryId);
            }
            if (parsed.serviceId !== null) {
                excServices.push(parsed.serviceId);
            }
        });

        return { excAccessories: excAccessories, excServices: excServices };
    }

    /**
     * Парсит отдельный элемент исключения
     * @param {*} item - Элемент для парсинга
     * @returns {Object} Объект с accessoryId и serviceId
     */
    function parseExclusionItem(item) {
        var accessoryId = null;
        var serviceId = null;

        if (typeof item === 'number') {
            if (item % 1 === 0) {
                // Целое число - только аксессуар
                accessoryId = item;
            } else {
                // Дробное число - аксессуар.сервис
                var parts = item.toString().split('.');
                accessoryId = parseInt(parts[0]);
                serviceId = parts[1] ? parts[1] : null;
            }
        } else if (typeof item === 'string') {
            if (item.indexOf('.') !== -1) {
                // Строка с точкой - аксессуар.сервис
                var parts = item.split('.');
                accessoryId = parseInt(parts[0]);
                serviceId = parts[1] ? parts[1] : null;
            } else {
                // Строка без точки - только аксессуар
                accessoryId = parseInt(item);
            }
        }

        return { accessoryId: accessoryId, serviceId: serviceId };
    }

    function getArrayFromValue(value, type) {
        var result = [];
        if (Array.isArray(value)) {
            result = value;
        } else if (typeof value === type) {
            result.push(value);
        }
        return result;
    }

    if (actualDebug) console.info("Исключаемые комнаты: " + excRooms.join("- "));
    if (actualDebug) console.info("Исключаемые аксессуары: " + excAccessories.join("- "));
    if (actualDebug) console.info("Исключаемые сервисы: " + excServices.join("- "));
    if (actualDebug) console.info("Дополнительные устройства: " + additionalDevices.join("- "));

    const rooms = Hub.getRooms().filter(function loopRooms(room) { return excRooms.indexOf(room.getName()) < 0 });

    // Собираем все устройства для отключения в массив
    var devicesToTurnOff = [];

    rooms.forEach(function loopRooms(room) {
        var accessories = room.getAccessories().filter(function loopRooms(accessory) { return excAccessories.indexOf(parseInt(accessory.getUUID())) < 0 });
        accessories.forEach(function loopAccessories(accessory) {
            // Оптимизация: кэшируем проверки для каждого аксессуара
            var modelId = accessory.getModelId();
            if (modelId == "Sprut.hub") return;
            
            var status = accessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue();
            if (status == false) return;

            accessory.getServices().forEach(function loopServices(service) {
                var serviceType = service.getType();
                var shouldProcess = false;

                // Проверяем тип сервиса и соответствующие опции
                if (serviceType == HS.Lightbulb && actualLightbulbs) {
                    shouldProcess = true;
                } else if (serviceType == HS.Switch && actualSwitches) {
                    shouldProcess = true;
                } else if (serviceType == HS.Outlet && actualOutlets) {
                    shouldProcess = true;
                }

                if (shouldProcess) {
                    // Проверяем, не исключен ли конкретный сервис
                    var serviceId = accessory.getUUID() + "." + service.getUUID();
                    if (excServices.indexOf(serviceId) >= 0) {
                        if (actualDebug) console.info("Сервис " + serviceId + " исключен");
                        return;
                    }

                    // Оптимизация: проверяем видимость и состояние в одном условии
                    if (!service.isVisible() && !actualHidden) return;
                    
                    var on = service.getCharacteristic(HC.On);
                    if (!on || !on.getValue()) return;
                    
                    devicesToTurnOff.push({
                        room: room,
                        accessory: accessory,
                        service: service,
                        serviceId: serviceId,
                        serviceType: serviceType
                    });
                }
            });
        });
    });

    // Добавляем дополнительные устройства в список
    if (additionalDevices.length > 0) {
        additionalDevices.forEach(function (deviceId) {
            try {
                if (deviceId.indexOf('.') !== -1) {
                    // Это конкретный сервис (аксессуар.сервис)
                    var parts = deviceId.split('.');
                    var accessoryId = parseInt(parts[0]);
                    var serviceId = parts[1];

                    var accessory = Hub.getAccessory(accessoryId);
                    if (accessory) {
                        var service = accessory.getService(serviceId);
                        if (service) {
                            devicesToTurnOff.push({
                                room: accessory.getRoom(),
                                accessory: accessory,
                                service: service,
                                serviceId: accessoryId + "." + serviceId,
                                serviceType: service.getType(),
                                isAdditional: true
                            });
                        } else if (actualDebug) {
                            console.warn("Сервис не найден: " + serviceId + " в аксессуаре: " + accessoryId);
                        }
                    } else if (actualDebug) {
                        console.warn("Аксессуар не найден: " + accessoryId);
                    }
                } else {
                    // Это аксессуар целиком
                    var accessoryId = parseInt(deviceId);
                    var accessory = Hub.getAccessory(accessoryId);
                    if (accessory) {
                        var services = accessory.getServices();
                        services.forEach(function (service) {
                            devicesToTurnOff.push({
                                room: accessory.getRoom(),
                                accessory: accessory,
                                service: service,
                                serviceId: accessoryId + "." + service.getUUID(),
                                serviceType: service.getType(),
                                isAdditional: true
                            });
                        });
                    } else if (actualDebug) {
                        console.warn("Аксессуар не найден: " + accessoryId);
                    }
                }
            } catch (e) {
                if (actualDebug) {
                    console.error("Ошибка обработки устройства: " + deviceId + " Ошибка: " + e.message);
                }
            }
        });
    }

    // Отключаем устройства
    if (interval > 0) {
        // Последовательное отключение с интервалом
        turnOffDevicesSequentially(devicesToTurnOff, interval, actualDebug);
    } else {
        // Одновременное отключение
        devicesToTurnOff.forEach(function (device) {
            turnOffDevice(device, actualDebug);
        });
    }

    /**
     * Отключает сервис, ища все характеристики для отключения
     * 
     * Поддерживаемые характеристики и сервисы:
     * - HC.On (false) - Switch, Lightbulb, Outlet, FanBasic
     * - HC.Active (0) - AirPurifier, HeaterCooler, HumidifierDehumidifier, Door, Faucet, IrrigationSystem, Valve, WindowCovering
     * - HC.TargetHeatingCoolingState (0) - Thermostat
     * - HC.TargetHeaterCoolerState (0) - HeaterCooler
     * - HC.TargetAirPurifierState (0) - AirPurifier
     * - HC.TargetHumidifierDehumidifierState (0) - HumidifierDehumidifier
     * - HC.TargetDoorState (0) - Door
     * - HC.TargetPosition (0) - Door, Faucet, IrrigationSystem, Valve, WindowCovering
     * - HC.Mute (true) - Speaker, Microphone, TelevisionSpeaker
     * 
     * @param {Service} service - Сервис для отключения
     * @param {boolean} debug - Режим отладки
     */
    function turnOffService(service, debug) {
        var accessory = service.getAccessory();

        // Список характеристик для отключения с их значениями
        var turnOffCharacteristics = [
            { type: HC.On, value: false, name: "On" },
            { type: HC.Active, value: 0, name: "Active" },
            { type: HC.TargetHeatingCoolingState, value: 0, name: "TargetHeatingCoolingState" }, // Off
            { type: HC.TargetHeaterCoolerState, value: 0, name: "TargetHeaterCoolerState" }, // Off
            { type: HC.TargetAirPurifierState, value: 0, name: "TargetAirPurifierState" }, // Off
            { type: HC.TargetHumidifierDehumidifierState, value: 0, name: "TargetHumidifierDehumidifierState" }, // Off
            { type: HC.TargetDoorState, value: 0, name: "TargetDoorState" }, // Open
            { type: HC.TargetPosition, value: 0, name: "TargetPosition" }, // 0%
            { type: HC.Mute, value: true, name: "Mute" }, // Mute
        ];

        var turnedOffCount = 0;

        turnOffCharacteristics.forEach(function (charConfig) {
            try {
                var characteristic = service.getCharacteristic(charConfig.type);
                if (characteristic) {
                    var currentValue = characteristic.getValue();
                    if (currentValue !== charConfig.value) {
                        characteristic.setValue(charConfig.value);
                        turnedOffCount++;

                        if (debug) {
                            console.info("Выключено " + charConfig.name + " в " + accessory.getName() + " сервис " + service.getName() + " с " + currentValue + " на " + charConfig.value);
                        }
                    }
                }
            } catch (e) {
                // Игнорируем ошибки для характеристик, которые не поддерживаются сервисом
                if (debug) {
                    console.debug("Характеристика " + charConfig.name + " не поддерживается в сервисе " + service.getName());
                }
            }
        });

        if (debug && turnedOffCount > 0) {
            console.info("Выключено " + turnedOffCount + " характеристик в " + accessory.getName() + " сервис " + service.getName());
        }
    }

    /**
     * Отключает устройства последовательно с заданным интервалом
     * @param {Array} devices - Массив устройств для отключения
     * @param {number} interval - Интервал в миллисекундах
     * @param {boolean} debug - Режим отладки
     */
    function turnOffDevicesSequentially(devices, interval, debug) {
        if (devices.length === 0) {
            return;
        }

        var currentIndex = 0;

        function turnOffNext() {
            if (currentIndex >= devices.length) {
                if (debug) {
                    console.info("Последовательное выключение завершено. Всего устройств: " + devices.length);
                }
                return;
            }

            var device = devices[currentIndex];
            turnOffDevice(device, debug);

            currentIndex++;

            if (currentIndex < devices.length) {
                setTimeout(turnOffNext, interval);
            } else if (debug) {
                console.info("Последовательное выключение завершено. Всего устройств: " + devices.length);
            }
        }

        if (debug) {
            console.info("Начинаем последовательное выключение с интервалом: " + interval + " мс. Всего устройств: " + devices.length);
        }

        // Начинаем отключение
        turnOffNext();
    }

    /**
     * Отключает одно устройство
     * @param {Object} device - Объект устройства с информацией о комнате, аксессуаре и сервисе
     * @param {boolean} debug - Режим отладки
     */
    function turnOffDevice(device, debug) {
        try {
            if (device.isAdditional) {
                // Для дополнительных устройств используем универсальную функцию
                turnOffService(device.service, debug);
            } else {
                // Для обычных устройств (лампы, выключатели, розетки)
                var on = device.service.getCharacteristic(HC.On);
                if (on && on.getValue()) {
                    on.setValue(false);

                    if (debug) {
                        console.info("Выключено: " + device.room.getName() + " - " + device.accessory.getName() + " - " + device.service.getName() + " (Тип: " + device.serviceType + ")");
                    }
                }
            }
        } catch (e) {
            if (debug) {
                console.error("Ошибка выключения устройства: " + device.serviceId + " Ошибка: " + e.message);
            }
        }
    }
}

/**
 * Функция обратной совместимости для отключения всех ламп, выключателей и розеток
 * @deprecated Используйте turnAllOff() для полной функциональности
 */
function turnOffLight(excludeRooms, excludeAccessories) {
    return turnAllOff({
        excludeRooms: excludeRooms || [],
        excludeAccessories: excludeAccessories || []
    });
}