/**
 * Мастер-выключатель - отключает все лампы, выключатели и розетки и т.д. в доме
 * 
 * Использование:
 * global.masterSwitch({
 *   // Типы устройств для отключения
 *   lightbulbs: true,                            // Отключать лампочки
 *   switches: true,                              // Отключать выключатели  
 *   outlets: false,                              // Отключать розетки
 *   hidden: false,                               // Отключать скрытые устройства
 *   
 *   // Выбор комнат и исключения
 *   rooms: ["Кухня"],                            // Названия комнат для выключения (если пустой - весь дом)
 *   excludeRooms: ["Коридор", "Двор"],           // Названия комнат, где не надо выключать свет
 *   excludeAccessories: [130, 188.15],           // ID устройств и сервисов, которые не надо выключать
 *   additionalDevices: [200, 300.5],             // ID дополнительных устройств для отключения
 *   
 *   // Настройки выключения
 *   interval: 500,                               // Интервал выключения в миллисекундах
 *   turnOffOrder: [130, 188.15],                 // Порядок выключения устройств. Приоритетные устройства выключаются первыми в указанном порядке. Не указанные устройства выключаются после них
 *   verifyTurnOff: true,                         // Повторять выключение через 5 секунд
 *   delayedDevices: [42, 123.15],                // ID устройств и сервисов для отложенного выключения
 *   delayedTurnOffTime: 5000,                    // Время отложенного выключения в миллисекундах
 *   debug: false                                 // Режим отладки
 * })
 */
function masterSwitch(params) {
    // Типы устройств для отключения
    var lightbulbsDefault = true; // Отключать лампочки
    var switchesDefault = true; // Отключать выключатели
    var outletsDefault = false; // Отключать розетки
    var hiddenDefault = false; // Отключать скрытые устройства
    var roomsDefault = []; // Комнаты для выключения (если пустой - весь дом) (например: ["Кухня", "Гостиная"])
    var excludeRoomsNamesDefault = []; //Названия комнат, где не надо выключать свет (например: ["Коридор", "Двор", "Информер"])
    var excludeAccessoriesIdDefault = []; //ID устройств, которые не надо выключать (например: [130, "188", 200.15, "300.20"])
    var additionalDevicesDefault = []; //ID устройств и сервисов для дополнительного отключения любых типов устройств (например: [130, "188", 200.15, "300.20"])
    var intervalDefault = 0; // Интервал выключения устройств в миллисекундах (0 = одновременно, >0 = по очереди)
    var turnOffOrderDefault = []; // Порядок выключения устройств (приоритетные сначала)
    var verifyTurnOffDefault = true; // Повторять выключение через 5 секунд
    var delayedDevicesDefault = []; // ID устройств и сервисов для отложенного выключения
    var delayedTurnOffTimeDefault = 0; // Время отложенного выключения в миллисекундах
    var debugDefault = false; // Активация дополнительного логгирования для отладки

    // Валидация входных параметров
    if (!params || typeof params !== 'object') {
        console.error("masterSwitch: параметр params должен быть объектом");
        return;
    }
    // Используем переданные параметры или значения по умолчанию
    // Типы устройств для отключения
    var actualLightbulbs = params.lightbulbs !== undefined ? params.lightbulbs : lightbulbsDefault;
    var actualSwitches = params.switches !== undefined ? params.switches : switchesDefault;
    var actualOutlets = params.outlets !== undefined ? params.outlets : outletsDefault;
    var actualHidden = params.hidden !== undefined ? params.hidden : hiddenDefault;
    
    // Выбор комнат и исключения
    var actualRooms = params.rooms !== undefined ? params.rooms : roomsDefault;
    var actualExcludeRooms = params.excludeRooms !== undefined ? params.excludeRooms : [];
    var actualExcludeAccessories = params.excludeAccessories !== undefined ? params.excludeAccessories : [];
    var actualAdditionalDevices = params.additionalDevices !== undefined ? params.additionalDevices : additionalDevicesDefault;
    
    // Настройки выключения
    var actualInterval = params.interval !== undefined ? params.interval : intervalDefault;
    var actualTurnOffOrder = params.turnOffOrder !== undefined ? params.turnOffOrder : turnOffOrderDefault;
    var actualVerifyTurnOff = params.verifyTurnOff !== undefined ? params.verifyTurnOff : verifyTurnOffDefault;
    var actualDelayedDevices = params.delayedDevices !== undefined ? params.delayedDevices : delayedDevicesDefault;
    var actualDelayedTurnOffTime = params.delayedTurnOffTime !== undefined ? params.delayedTurnOffTime : delayedTurnOffTimeDefault;
    var actualDebug = params.debug !== undefined ? params.debug : debugDefault;

    // Валидация интервала выключения
    var interval = parseInt(actualInterval) || 0;
    if (interval < 0) {
        interval = 0;
        if (actualDebug) {
            console.warn("Некорректное значение interval, установлено 0");
        }
    }

    // Валидация времени отложенного выключения
    var delayedTurnOffTime = parseInt(actualDelayedTurnOffTime) || 0;
    if (delayedTurnOffTime < 0) {
        delayedTurnOffTime = 0;
        if (actualDebug) {
            console.warn("Некорректное значение delayedTurnOffTime, установлено 0");
        }
    }

    var excRooms = []
    var excAccessories = []
    var excServices = []

    // Обработка исключений комнат из глобальных настроек
    excludeRoomsNamesDefault.forEach(function fe(room) { excRooms.push(room) })
    // Обработка исключений комнат из параметров функции
    masterSwitchGetArrayFromValue(actualExcludeRooms, "string").forEach(function fe(room) { excRooms.push(room) })

    // Обработка исключений аксессуаров и сервисов из глобальных настроек
    var globalExclusions = masterSwitchParseExclusions(excludeAccessoriesIdDefault);
    excAccessories = excAccessories.concat(globalExclusions.excAccessories);
    excServices = excServices.concat(globalExclusions.excServices);

    // Обработка исключений аксессуаров и сервисов из параметров функции
    var paramExclusions = masterSwitchParseExclusions(actualExcludeAccessories);
    excAccessories = excAccessories.concat(paramExclusions.excAccessories);
    excServices = excServices.concat(paramExclusions.excServices);

    // Обработка отложенных устройств - добавляем их в исключения для основного выключения
    var delayedExclusions = masterSwitchParseExclusions(actualDelayedDevices);
    excAccessories = excAccessories.concat(delayedExclusions.excAccessories);
    excServices = excServices.concat(delayedExclusions.excServices);

    // Парсим дополнительные устройства для отключения
    var additionalDevices = [];
    if (actualAdditionalDevices && actualAdditionalDevices.length > 0) {
        var additionalExclusions = masterSwitchParseExclusions(actualAdditionalDevices);
        additionalDevices = additionalExclusions.excAccessories.concat(additionalExclusions.excServices);
    }


    // Обрабатываем выбранные комнаты
    var targetRooms = [];
    if (actualRooms && actualRooms.length > 0) {
        // Если указаны конкретные комнаты, используем их
        const allRooms = Hub.getRooms();
        
        // Создаем Map для быстрого поиска комнат по имени
        var roomsMap = new Map();
        allRooms.forEach(function(room) {
            roomsMap.set(room.getName(), room);
        });
        
        actualRooms.forEach(function(roomName) {
            var room = roomsMap.get(roomName);
            if (room) {
                targetRooms.push(room);
            } else if (actualDebug) {
                console.warn("Комната '" + roomName + "' не найдена");
            }
        });
    } else {
        // Если комнаты не указаны, используем все комнаты
        targetRooms = Hub.getRooms();
    }

    // Применяем фильтр исключений комнат
    const rooms = targetRooms.filter(function loopRooms(room) { 
        return excRooms.indexOf(room.getName()) < 0; 
    });

    if (actualDebug) console.info("Выбранные комнаты: " + (actualRooms.length > 0 ? actualRooms.join("- ") : "Весь дом"));
    if (actualDebug) console.info("Исключаемые комнаты: " + excRooms.join("- "));
    if (actualDebug) console.info("Исключаемые аксессуары: " + excAccessories.join("- "));
    if (actualDebug) console.info("Исключаемые сервисы: " + excServices.join("- "));
    if (actualDebug) console.info("Дополнительные устройства: " + additionalDevices.join("- "));
    if (actualDebug) console.info("Отложенные устройства: " + actualDelayedDevices.join("- "));
    if (actualDebug) console.info("Время отложенного выключения: " + delayedTurnOffTime + "мс");

    // Собираем все устройства для отключения в массив
    var devicesToTurnOff = [];

    rooms.forEach(function loopRooms(room) {
        var accessories = room.getAccessories().filter(function loopRooms(accessory) { 
            return excAccessories.indexOf(parseInt(accessory.getUUID())) < 0; 
        });
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
                    var serviceId = service.getUUID(); // service.getUUID() уже содержит "accessoryId.serviceId"
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
        if (actualDebug) {
            console.info("Ищем дополнительные устройства: " + additionalDevices.join(", "));
        }
        additionalDevices.forEach(function (deviceId) {
            try {
                var deviceIdStr = deviceId.toString();
                if (actualDebug) {
                    console.info("Обрабатываем устройство: " + deviceIdStr);
                }
                if (deviceIdStr.indexOf('.') !== -1) {
                    // Это конкретный сервис (аксессуар.сервис)
                    var parts = deviceIdStr.split('.');
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
                                serviceId: service.getUUID(), // service.getUUID() уже содержит "accessoryId.serviceId"
                                serviceType: service.getType(),
                                isAdditional: true
                            });
                            if (actualDebug) console.info("Добавлен сервис " + accessoryId + "." + serviceId + " в список выключения");
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
                        if (actualDebug) console.info("Найдено сервисов: " + services.length);
                        services.forEach(function (service) {
                            devicesToTurnOff.push({
                                room: accessory.getRoom(),
                                accessory: accessory,
                                service: service,
                                serviceId: service.getUUID(), // service.getUUID() уже содержит "accessoryId.serviceId"
                                serviceType: service.getType(),
                                isAdditional: true
                            });
                        });
                        if (actualDebug) console.info("Добавлен аксессуар " + accessoryId + " (" + services.length + " сервисов) в список выключения");
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

    // Сортируем устройства по порядку выключения (если задан)
    if (actualTurnOffOrder && actualTurnOffOrder.length > 0 && interval > 0) {
        devicesToTurnOff = sortDevicesByTurnOffOrder(devicesToTurnOff, actualTurnOffOrder, actualDebug);
    }

    // Отключаем устройства
    if (interval > 0) {
        // Последовательное отключение с интервалом
        turnOffDevicesSequentially(devicesToTurnOff, interval, actualDebug, function() {
        // После завершения последовательного выключения запускаем отложенное выключение
        if (delayedTurnOffTime > 0 && actualDelayedDevices.length > 0) {
            scheduleDelayedTurnOff(actualDelayedDevices, delayedTurnOffTime, actualDebug, function() {
                // После завершения отложенного выключения запускаем проверку
                if (actualVerifyTurnOff) {
                    scheduleVerification(devicesToTurnOff, actualInterval, actualDebug);
                }
            });
        } else {
            // Если нет отложенного выключения, сразу запускаем проверку
            if (actualVerifyTurnOff) {
                scheduleVerification(devicesToTurnOff, actualInterval, actualDebug);
            }
        }
        });
    } else {
        // Одновременное отключение
        devicesToTurnOff.forEach(function (device) {
            turnOffDevice(device, actualDebug);
        });
        
        // После одновременного выключения запускаем отложенное выключение
        if (delayedTurnOffTime > 0 && actualDelayedDevices.length > 0) {
            scheduleDelayedTurnOff(actualDelayedDevices, delayedTurnOffTime, actualDebug, function() {
                // После завершения отложенного выключения запускаем проверку
                if (actualVerifyTurnOff) {
                    scheduleVerification(devicesToTurnOff, actualInterval, actualDebug);
                }
            });
        } else {
            // Если нет отложенного выключения, сразу запускаем проверку
            if (actualVerifyTurnOff) {
                scheduleVerification(devicesToTurnOff, actualInterval, actualDebug);
            }
        }
    }

    /**
     * Сортирует устройства по заданному порядку выключения
     * @param {Array} devices - Массив устройств для сортировки
     * @param {Array} turnOffOrder - Массив ID устройств в порядке выключения
     * @param {boolean} debug - Режим отладки
     * @returns {Array} Отсортированный массив устройств
     */
    function sortDevicesByTurnOffOrder(devices, turnOffOrder, debug) {
        if (!turnOffOrder || turnOffOrder.length === 0) {
            return devices;
        }

        var orderedDevices = [];
        var remainingDevices = devices.slice(); // Копия массива

        if (debug) {
            console.info("Сортируем устройства по порядку выключения:", turnOffOrder.join(", "));
        }

        // Сначала добавляем устройства в указанном порядке
        turnOffOrder.forEach(function(orderId) {
            var foundDevices = remainingDevices.filter(function(device) {
                return isDeviceInOrder(device, orderId);
            });

            if (foundDevices.length > 0) {
                orderedDevices = orderedDevices.concat(foundDevices);
                // Удаляем найденные устройства из оставшихся
                foundDevices.forEach(function(device) {
                    var index = remainingDevices.indexOf(device);
                    if (index > -1) {
                        remainingDevices.splice(index, 1);
                    }
                });
            } else if (debug) {
                console.warn("Устройство с ID " + orderId + " не найдено в списке для выключения");
            }
        });

        // Затем добавляем все оставшиеся устройства
        orderedDevices = orderedDevices.concat(remainingDevices);

        if (debug) {
            console.info("Итого устройств в порядке выключения: " + orderedDevices.length + " (было: " + devices.length + ")");
        }

        return orderedDevices;
    }

    /**
     * Проверяет, соответствует ли устройство указанному ID в порядке выключения
     * @param {Object} device - Объект устройства
     * @param {*} orderId - ID для проверки (может быть числом, строкой или дробным числом)
     * @returns {boolean} true если устройство соответствует ID
     */
    function isDeviceInOrder(device, orderId) {
        try {
            var deviceId = device.serviceId;
            var accessoryId = device.accessory.getUUID();

            if (typeof orderId === 'number') {
                if (orderId % 1 === 0) {
                    // Целое число - проверяем аксессуар
                    return parseInt(accessoryId) === orderId;
                } else {
                    // Дробное число - проверяем аксессуар.сервис
                    var parts = orderId.toString().split('.');
                    var orderAccessoryId = parseInt(parts[0]);
                    var orderServiceId = parts[1];
                    return device.service.getUUID() === (orderAccessoryId + "." + orderServiceId);
                }
            } else if (typeof orderId === 'string') {
                if (orderId.indexOf('.') !== -1) {
                    // Строка с точкой - аксессуар.сервис
                    var parts = orderId.split('.');
                    var orderAccessoryId = parseInt(parts[0]);
                    var orderServiceId = parts[1];
                    return device.service.getUUID() === (orderAccessoryId + "." + orderServiceId);
                } else {
                    // Строка без точки - только аксессуар
                    return parseInt(accessoryId) === parseInt(orderId);
                }
            }
        } catch (e) {
            // Игнорируем ошибки
        }
        return false;
    }

    // Общий список характеристик для отключения устройств
    var TURN_OFF_CHARACTERISTICS = [
        { type: HC.On, value: false, name: "On" },
        { type: HC.TargetHeatingCoolingState, value: 0, name: "TargetHeatingCoolingState" }, // Off
        { type: HC.TargetHeaterCoolerState, value: 0, name: "TargetHeaterCoolerState" }, // Off
        { type: HC.TargetAirPurifierState, value: 0, name: "TargetAirPurifierState" }, // Off
        { type: HC.TargetHumidifierDehumidifierState, value: 0, name: "TargetHumidifierDehumidifierState" }, // Off
        { type: HC.TargetDoorState, value: 0, name: "TargetDoorState" }, // Open
        { type: HC.TargetPosition, value: 0, name: "TargetPosition" }, // 0%
        { type: HC.Mute, value: true, name: "Mute" }, // Mute
        { type: HC.Active, value: 0, name: "Active" },
    ];

    /**
     * Отключает сервис, ища первую доступную характеристику для отключения
     * 
     * Поддерживаемые характеристики и сервисы:
     * - HC.On (false) - Switch, Lightbulb, Outlet, FanBasic
     * - HC.TargetHeatingCoolingState (0) - Thermostat
     * - HC.TargetHeaterCoolerState (0) - HeaterCooler
     * - HC.TargetAirPurifierState (0) - AirPurifier
     * - HC.TargetHumidifierDehumidifierState (0) - HumidifierDehumidifier
     * - HC.TargetDoorState (0) - Door
     * - HC.TargetPosition (0) - Door, Faucet, IrrigationSystem, Valve, WindowCovering, Window
     * - HC.Mute (true) - Speaker, Microphone, TelevisionSpeaker
     * - HC.Active (0) - AirPurifier, HeaterCooler, HumidifierDehumidifier, Door, Faucet, IrrigationSystem, Valve, WindowCovering
     * 
     * @param {Service} service - Сервис для отключения
     * @param {boolean} debug - Режим отладки
     */
    function turnOffService(service, debug) {
        var accessory = service.getAccessory();

        // Ищем первую доступную характеристику для отключения
        for (var i = 0; i < TURN_OFF_CHARACTERISTICS.length; i++) {
            var charConfig = TURN_OFF_CHARACTERISTICS[i];
            try {
                var characteristic = service.getCharacteristic(charConfig.type);
                if (characteristic) {
                    var currentValue = characteristic.getValue();
                    if (currentValue !== charConfig.value) {
                        characteristic.setValue(charConfig.value);

                        if (debug) {
                            console.info("Выключено " + charConfig.name + " в " + accessory.getName() + " сервис " + service.getName() + " с " + currentValue + " на " + charConfig.value);
                        }
                    }
                    // Найдена первая доступная характеристика, выходим из цикла
                    return;
                }
            } catch (e) {
                // Игнорируем ошибки для характеристик, которые не поддерживаются сервисом
                if (debug) {
                    console.debug("Характеристика " + charConfig.name + " не поддерживается в сервисе " + service.getName());
                }
            }
        }

        if (debug) {
            console.warn("Не найдено подходящих характеристик для отключения в " + accessory.getName() + " сервис " + service.getName());
        }
    }

    /**
     * Отключает устройства последовательно с заданным интервалом
     * @param {Array} devices - Массив устройств для отключения
     * @param {number} interval - Интервал в миллисекундах
     * @param {boolean} debug - Режим отладки
     * @param {Function} callback - Функция обратного вызова после завершения
     */
    function turnOffDevicesSequentially(devices, interval, debug, callback) {
        if (devices.length === 0) {
            return;
        }

        var currentIndex = 0;

        function turnOffNext() {
            if (currentIndex >= devices.length) {
                if (debug) {
                    console.info("Последовательное выключение завершено. Всего устройств: " + devices.length);
                }
                if (callback) {
                    callback();
                }
                return;
            }

            var device = devices[currentIndex];
            turnOffDevice(device, debug);

            currentIndex++;

            if (currentIndex < devices.length) {
                setTimeout(turnOffNext, interval);
            } else {
                if (debug) {
                    console.info("Последовательное выключение завершено. Всего устройств: " + devices.length);
                }
                if (callback) {
                    callback();
                }
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
    /**
     * Проверяет, включено ли устройство
     * @param {Object} device - Объект устройства
     * @param {boolean} debug - Режим отладки
     * @returns {boolean} true если устройство включено, false если выключено
     */
    function isDeviceOn(device, debug) {
        try {
            if (device.isAdditional) {
                // Для дополнительных устройств проверяем все характеристики
                var service = device.service;
                var hasOnCharacteristic = false;
                var isOn = false;
                
                // Используем общую константу характеристик
                TURN_OFF_CHARACTERISTICS.forEach(function(charConfig) {
                    try {
                        var characteristic = service.getCharacteristic(charConfig.type);
                        if (characteristic) {
                            hasOnCharacteristic = true;
                            var currentValue = characteristic.getValue();
                            if (currentValue !== charConfig.value) {
                                isOn = true;
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки для неподдерживаемых характеристик
                    }
                });
                
                return hasOnCharacteristic && isOn;
            } else {
                // Для обычных устройств проверяем HC.On
                var on = device.service.getCharacteristic(HC.On);
                return on && on.getValue();
            }
        } catch (e) {
            if (debug) {
                console.error("Ошибка проверки устройства: " + device.serviceId + " Ошибка: " + e.message);
            }
            return false;
        }
    }

    /**
     * Планирует повторное выключение через 5 секунд
     * @param {Array} devices - Массив устройств для повторного выключения
     * @param {number} interval - Интервал выключения в миллисекундах
     * @param {boolean} debug - Режим отладки
     */
    function scheduleVerification(devices, interval, debug) {
        if (debug) {
            console.info("Запланировано повторное выключение через 5 секунд");
        }
        
        setTimeout(function() {
            if (debug) {
                console.info("Начинаем повторное выключение устройств");
            }
            
            // Собираем устройства, которые все еще включены
            var stillOnDevices = devices.filter(function(device) {
                return isDeviceOn(device, debug);
            });
            
            // Добавляем отложенные устройства в проверку, если они есть
            if (actualDelayedDevices && actualDelayedDevices.length > 0) {
                var delayedDevicesToCheck = [];
                
                actualDelayedDevices.forEach(function (deviceId) {
                    try {
                        var deviceIdStr = deviceId.toString();
                        if (deviceIdStr.indexOf('.') !== -1) {
                            // Это конкретный сервис (аксессуар.сервис)
                            var parts = deviceIdStr.split('.');
                            var accessoryId = parseInt(parts[0]);
                            var serviceId = parts[1];

                            var accessory = Hub.getAccessory(accessoryId);
                            if (accessory) {
                                var service = accessory.getService(serviceId);
                                if (service) {
                                    delayedDevicesToCheck.push({
                                        room: accessory.getRoom(),
                                        accessory: accessory,
                                        service: service,
                                        serviceId: service.getUUID(),
                                        serviceType: service.getType(),
                                        isDelayed: true
                                    });
                                }
                            }
                        } else {
                            // Это аксессуар целиком
                            var accessoryId = parseInt(deviceId);
                            var accessory = Hub.getAccessory(accessoryId);
                            if (accessory) {
                                var services = accessory.getServices();
                                services.forEach(function (service) {
                                    delayedDevicesToCheck.push({
                                        room: accessory.getRoom(),
                                        accessory: accessory,
                                        service: service,
                                        serviceId: service.getUUID(),
                                        serviceType: service.getType(),
                                        isDelayed: true
                                    });
                                });
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки
                    }
                });
                
                // Добавляем отложенные устройства, которые все еще включены
                var stillOnDelayedDevices = delayedDevicesToCheck.filter(function(device) {
                    return isDeviceOn(device, debug);
                });
                
                stillOnDevices = stillOnDevices.concat(stillOnDelayedDevices);
            }
            
            if (stillOnDevices.length > 0) {
                if (debug) {
                    console.info("Найдено " + stillOnDevices.length + " устройств, которые все еще включены. Повторяем выключение.");
                }
                
                // Повторяем выключение
                if (interval > 0) {
                    turnOffDevicesSequentially(stillOnDevices, interval, debug);
                } else {
                    stillOnDevices.forEach(function (device) {
                        turnOffDevice(device, debug);
                    });
                }
            } else if (debug) {
                console.info("Все устройства успешно выключены. Повторное выключение завершено.");
            }
        }, 5000); // 5 секунд
    }

    /**
     * Планирует отложенное выключение устройств через указанное время
     * @param {Array} delayedDevices - Массив ID устройств для отложенного выключения
     * @param {number} delayTime - Время задержки в миллисекундах
     * @param {boolean} debug - Режим отладки
     * @param {Function} callback - Функция обратного вызова после завершения
     */
    function scheduleDelayedTurnOff(delayedDevices, delayTime, debug, callback) {
        if (debug) {
            console.info("Запланировано отложенное выключение через " + delayTime + "мс для устройств: " + delayedDevices.join(", "));
        }
        
        setTimeout(function() {
            if (debug) {
                console.info("Начинаем отложенное выключение устройств");
            }
            
            // Собираем устройства для отложенного выключения
            var delayedDevicesToTurnOff = [];
            
            delayedDevices.forEach(function (deviceId) {
                try {
                    var deviceIdStr = deviceId.toString();
                    if (debug) {
                        console.info("Обрабатываем отложенное устройство: " + deviceIdStr);
                    }
                    if (deviceIdStr.indexOf('.') !== -1) {
                        // Это конкретный сервис (аксессуар.сервис)
                        var parts = deviceIdStr.split('.');
                        var accessoryId = parseInt(parts[0]);
                        var serviceId = parts[1];

                        var accessory = Hub.getAccessory(accessoryId);
                        if (accessory) {
                            var service = accessory.getService(serviceId);
                            if (service) {
                                delayedDevicesToTurnOff.push({
                                    room: accessory.getRoom(),
                                    accessory: accessory,
                                    service: service,
                                    serviceId: service.getUUID(),
                                    serviceType: service.getType(),
                                    isDelayed: true
                                });
                                if (debug) console.info("Добавлен сервис " + accessoryId + "." + serviceId + " в список отложенного выключения");
                            } else if (debug) {
                                console.warn("Сервис не найден: " + serviceId + " в аксессуаре: " + accessoryId);
                            }
                        } else if (debug) {
                            console.warn("Аксессуар не найден: " + accessoryId);
                        }
                    } else {
                        // Это аксессуар целиком
                        var accessoryId = parseInt(deviceId);
                        var accessory = Hub.getAccessory(accessoryId);
                        if (accessory) {
                            var services = accessory.getServices();
                            if (debug) console.info("Найдено сервисов для отложенного выключения: " + services.length);
                            services.forEach(function (service) {
                                delayedDevicesToTurnOff.push({
                                    room: accessory.getRoom(),
                                    accessory: accessory,
                                    service: service,
                                    serviceId: service.getUUID(),
                                    serviceType: service.getType(),
                                    isDelayed: true
                                });
                            });
                            if (debug) console.info("Добавлен аксессуар " + accessoryId + " (" + services.length + " сервисов) в список отложенного выключения");
                        } else if (debug) {
                            console.warn("Аксессуар не найден: " + accessoryId);
                        }
                    }
                } catch (e) {
                    if (debug) {
                        console.error("Ошибка обработки отложенного устройства: " + deviceId + " Ошибка: " + e.message);
                    }
                }
            });
            
            // Выключаем отложенные устройства
            delayedDevicesToTurnOff.forEach(function (device) {
                turnOffDevice(device, debug);
            });
            
            if (debug) {
                console.info("Отложенное выключение завершено. Всего устройств: " + delayedDevicesToTurnOff.length);
            }
            
            if (callback) {
                callback();
            }
        }, delayTime);
    }
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
function masterSwitchParseExclusions(value) {
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
        var parsed = masterSwitchParseExclusionItem(item);
        if (parsed.accessoryId !== null) {
            excAccessories.push(parsed.accessoryId);
        }
        if (parsed.serviceId !== null) {
            excServices.push(parsed.accessoryId + "." + parsed.serviceId);
        }
    });

    return { excAccessories: excAccessories, excServices: excServices };
}

/**
 * Парсит отдельный элемент исключения
 * @param {*} item - Элемент для парсинга
 * @returns {Object} Объект с accessoryId и serviceId
 */
function masterSwitchParseExclusionItem(item) {
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
            // Строка без точки - только аксессуара
            accessoryId = parseInt(item);
        }
    }

    return { accessoryId: accessoryId, serviceId: serviceId };
}

/**
 * Преобразует значение в массив указанного типа
 * @param {*} value - Значение для преобразования
 * @param {string} type - Ожидаемый тип элементов
 * @returns {Array} Массив элементов
 */
function masterSwitchGetArrayFromValue(value, type) {
    var result = [];
    if (Array.isArray(value)) {
        result = value;
    } else if (typeof value === type) {
        result.push(value);
    }
    return result;
}

/**
 * Функция обратной совместимости для мастер-выключателя
 * @deprecated Используйте masterSwitch() для полной функциональности
 */
function turnOffLight(excludeRooms, excludeAccessories) {
    return masterSwitch({
        excludeRooms: excludeRooms || [],
        excludeAccessories: excludeAccessories || []
    });
}

/**
 * Функция обратной совместимости для мастер-выключателя
 * @deprecated Используйте masterSwitch() для полной функциональности
 */
function turnAllOff(params) {
    return masterSwitch(params);
}

//#############################################################################
//                                    ТЕСТЫ                                   #
//#############################################################################

let isDeveloping = true; // Флаг разработки. Включить что бы тесты выполнялись.

let inTestMode = false;
let originalConsole = console;
let originalSetTimeout = setTimeout;
let originalHub = Hub;
let testLog = [];

// Перехватываем console для тестов
function setupTestConsole() {
    console = {
        info: function(msg) { testLog.push({ level: 'info', message: msg }); },
        warn: function(msg) { testLog.push({ level: 'warn', message: msg }); },
        error: function(msg) { testLog.push({ level: 'error', message: msg }); },
        debug: function(msg) { testLog.push({ level: 'debug', message: msg }); },
        message: originalConsole.message || function(msg) { testLog.push({ level: 'message', message: msg }); }
    };
    
    // Мокаем setTimeout для тестов
    setTimeout = function(callback, delay) {
        if (inTestMode) {
            // В тестах сразу выполняем callback без задержки
            callback();
        } else {
            // В обычном режиме используем оригинальный setTimeout
            originalConsole.info("setTimeout вызван вне тестового режима");
        }
    };
}

function restoreConsole() {
    console = originalConsole;
    setTimeout = originalSetTimeout;
}

function restoreHub() {
    Hub = originalHub;
}

function clearTestLog() {
    testLog = [];
}

// Получение начальных значений переменных
function getDefaultVariables() {
    return {};
}

// Создание тестового выключателя с HC.On
function createTestSwitch() {
    let accessory = global.createUnitTestFullAccessory({
        id: 1,
        name: "Тестовый выключатель",
        room: "Тест",
        services: [{
            id: 10,
            type: HS.AccessoryInformation,
            name: "Информация об аксессуаре",
            characteristics: [{
                id: 11,
                type: HC.C_Online,
                value: true
            }]
        }, {
            id: 12,
            type: HS.Switch,
            name: "Выключатель",
            characteristics: [{
                id: 13,
                type: HC.On,
                value: true
            }]
        }]
    });
    
    
    return accessory;
}

// Создание тестового устройства с HC.Active
function createTestActiveDevice() {
    return global.createUnitTestFullAccessory({
        id: 2,
        name: "Тестовое устройство",
        room: "Тест",
        services: [{
            id: 20,
            type: HS.AccessoryInformation,
            name: "Информация об аксессуаре",
            characteristics: [{
                id: 21,
                type: HC.C_Online,
                value: true
            }]
        }, {
            id: 22,
            type: HS.Fan,
            name: "Вентилятор",
            characteristics: [{
                id: 23,
                type: HC.Active,
                value: 1
            }]
        }]
    });
}

// Создание тестовой лампы
function createTestLightbulb() {
    return global.createUnitTestFullAccessory({
        id: 3,
        name: "Тестовая лампа",
        room: "Гостиная",
        services: [{
            id: 30,
            type: HS.AccessoryInformation,
            name: "Информация об аксессуаре",
            characteristics: [{
                id: 31,
                type: HC.C_Online,
                value: true
            }]
        }, {
            id: 32,
            type: HS.Lightbulb,
            name: "Лампа",
            characteristics: [{
                id: 33,
                type: HC.On,
                value: true
            }]
        }]
    });
}

// Создание тестовой розетки
function createTestOutlet() {
    return global.createUnitTestFullAccessory({
        id: 4,
        name: "Тестовая розетка",
        room: "Кухня",
        services: [{
            id: 40,
            type: HS.AccessoryInformation,
            name: "Информация об аксессуаре",
            characteristics: [{
                id: 41,
                type: HC.C_Online,
                value: true
            }]
        }, {
            id: 42,
            type: HS.Outlet,
            name: "Розетка",
            characteristics: [{
                id: 43,
                type: HC.On,
                value: false
            }]
        }]
    });
}

// Создание тестового очистителя воздуха
function createTestAirPurifier() {
    return global.createUnitTestFullAccessory({
        id: 5,
        name: "Очиститель воздуха",
        room: "Спальня",
        services: [{
            id: 50,
            type: HS.AccessoryInformation,
            name: "Информация об аксессуаре",
            characteristics: [{
                id: 51,
                type: HC.C_Online,
                value: true
            }]
        }, {
            id: 52,
            type: HS.AirPurifier,
            name: "Очиститель",
            characteristics: [{
                id: 53,
                type: HC.Active,
                value: 1
            }, {
                id: 54,
                type: HC.TargetAirPurifierState,
                value: 2
            }]
        }]
    });
}

// Создание тестового термостата
function createTestThermostat() {
    return global.createUnitTestFullAccessory({
        id: 6,
        name: "Термостат",
        room: "Гостиная",
        services: [{
            id: 60,
            type: HS.AccessoryInformation,
            name: "Информация об аксессуаре",
            characteristics: [{
                id: 61,
                type: HC.C_Online,
                value: true
            }]
        }, {
            id: 62,
            type: HS.Thermostat,
            name: "Термостат",
            characteristics: [{
                id: 63,
                type: HC.TargetHeatingCoolingState,
                value: 1
            }]
        }]
    });
}

// Мок Hub для тестов
function setupTestHub() {
    let testRooms = [
        { name: "Тест", accessories: [] },
        { name: "Гостиная", accessories: [] },
        { name: "Кухня", accessories: [] },
        { name: "Спальня", accessories: [] }
    ];

    Hub = {
        getRooms: function() {
            let rooms = [];
            for (let i = 0; i < testRooms.length; i++) {
                (function(room) {
                    rooms.push({
                        getName: function() { return room.name; },
                        getAccessories: function() { return room.accessories; }
                    });
                })(testRooms[i]);
            }
            return rooms;
        },
        getAccessory: function(id) {
            // Поиск аксессуара по ID во всех комнатах
            for (let i = 0; i < testRooms.length; i++) {
                let room = testRooms[i];
                for (let j = 0; j < room.accessories.length; j++) {
                    let acc = room.accessories[j];
                    let uuid = acc.getUUID();
                    if (uuid == id) {
                        return acc;
                    }
                }
            }
            return null;
        }
    };
}

function resetTestState() {
    clearTestLog();
    restoreConsole();
    setupTestHub();
    restoreHub();
}

function resetTestHub() {
    setupTestHub();
}

// Функция для сброса состояния перед каждым тестом
function resetTestEnvironment() {
    // Пересоздаем тестовый Hub с чистыми комнатами
    setupTestHub();
}

// Функция для запуска всех тестов
function runMasterSwitchTests() {
    if (!isDeveloping || !global.hasUnitTests) {
        return;
    }
    console.info("=== НАЧАЛО ТЕСТОВ МАСТЕР-ВЫКЛЮЧАТЕЛЯ ===");

    // Импортируем функции assert для тестов
    let assert = global.assert;
    let assertNull = global.assertNull;
    let assertEquals = global.assertEquals;
    let assertTrue = global.assertTrue;
    let assertFalse = global.assertFalse;
    let assertContains = global.assertContains;
    let assertEmpty = global.assertEmpty;
    let assertNotEmpty = global.assertNotEmpty;
    
    // Создаем обертки для assert функций, которые выбрасывают исключения
    function assertEqualsWithException(actual, expected, message) {
        if (actual !== expected) {
            const msg = `Ожидалось ${expected}, получено ${actual}`;
            const errorMsg = message ? `${message}: ${msg}` : msg;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    try {
        inTestMode = true;
        setupTestConsole();
        setupTestHub();

        console.info("Запуск тестов мастер-выключателя");
        console.info("Всего тестов: 8");

        // Оптимизированные тесты
        console.info("Тест 1: Функции парсинга и валидации");
        try { test1_ParsingAndValidation(assert, assertContains, assertEmpty, assertEquals, assertNull); } catch(e) { console.error("Тест 1 провален: " + e.message); }

        console.info("Тест 2: Базовое выключение устройств");
        try { test2_BasicTurnOff(assertTrue, assertFalse, assertEqualsWithException); } catch(e) { console.error("Тест 2 провален: " + e.message); }

        console.info("Тест 3: Исключения и фильтрация");
        try { test3_ExclusionsAndFiltering(assertTrue, assertFalse, assertContains, assertEmpty); } catch(e) { console.error("Тест 3 провален: " + e.message); }

        console.info("Тест 4: Различные типы устройств и характеристик");
        try { test4_DifferentDeviceTypes(assertEqualsWithException, assertNotEmpty); } catch(e) { console.error("Тест 4 провален: " + e.message); }

        console.info("Тест 5: Последовательное выключение и порядок");
        try { test5_SequentialAndOrder(assertTrue, assertFalse, assertNotEmpty); } catch(e) { console.error("Тест 5 провален: " + e.message); }

        console.info("Тест 6: Отложенное выключение и форматы ID");
        try { test6_DelayedTurnOff(assertTrue, assertFalse); } catch(e) { console.error("Тест 6 провален: " + e.message); }

        console.info("Тест 7: Валидация и граничные случаи");
        try { test7_ValidationAndEdgeCases(assertFalse, assertNotEmpty, assertEmpty); } catch(e) { console.error("Тест 7 провален: " + e.message); }

        console.info("Тест 8: Производительность и граничные случаи");
        try { test8_PerformanceAndEdgeCases(assertTrue, assertNotEmpty); } catch(e) { console.error("Тест 8 провален: " + e.message); }

        console.info("=== ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ ===");

    } finally {
        inTestMode = false;
        
        // Выводим все сообщения тестов в оригинальную консоль
        testLog.forEach(function(log) {
            switch(log.level) {
                case 'info':
                    originalConsole.info(log.message);
                    break;
                case 'warn':
                    originalConsole.warn(log.message);
                    break;
                case 'error':
                    originalConsole.error(log.message);
                    break;
                case 'debug':
                    originalConsole.debug(log.message);
                    break;
                case 'message':
                    if (originalConsole.message) {
                        originalConsole.message(log.message);
                    } else {
                        originalConsole.info(log.message);
                    }
                    break;
                default:
                    originalConsole.info(log.message);
                    break;
            }
        });
        
        // Выводим итоговую статистику
        let totalLogs = testLog.length;
        let errorLogs = testLog.filter(log => log.level === 'error').length;
        let warnLogs = testLog.filter(log => log.level === 'warn').length;
        
        // Подсчитываем неудачные тесты по сообщениям об ошибках
        let failedTestsCount = testLog.filter(log => log.level === 'error' && log.message.indexOf('провален') !== -1).length;
        
        originalConsole.info("Ошибок: " + errorLogs);
        originalConsole.info("Предупреждений: " + warnLogs);
        originalConsole.info("Неудачных тестов: " + failedTestsCount);
        
        if (failedTestsCount === 0) {
            originalConsole.info("✅ Все тесты прошли успешно!");
        } else {
            originalConsole.warn("❌ Обнаружены ошибки в тестах (" + failedTestsCount + " из 25)");
        }
        
        resetTestState();
    }
}

// Тест 1: Функции парсинга и валидации (объединяет тесты 1-5, 11, 16, 19-21, 24)
function test1_ParsingAndValidation(assert, assertContains, assertEmpty, assertEquals, assertNull) {
    console.info("  - Тестируем parseExclusions");
    // Тест с массивом значений
    let result1 = masterSwitchParseExclusions([130, "188", 200.15, "300.20"]);
    assertContains(result1.excAccessories, 130, "parseExclusions: Массив должен содержать ID 130");
    assertContains(result1.excAccessories, 188, "parseExclusions: Массив должен содержать ID 188");
    assertContains(result1.excServices, "200.15", "parseExclusions: Массив должен содержать сервис 200.15");
    assertContains(result1.excServices, "300.20", "parseExclusions: Массив должен содержать сервис 300.20");

    // Тест с одиночным значением
    let result2 = masterSwitchParseExclusions(130);
    assertContains(result2.excAccessories, 130, "parseExclusions: Одиночное значение должно быть добавлено");
    assertEmpty(result2.excServices, "parseExclusions: Одиночное значение не должно создавать сервисы");

    // Тест с null/undefined
    let result3 = masterSwitchParseExclusions(null);
    assertEmpty(result3.excAccessories, "parseExclusions: null должен возвращать пустые массивы");
    assertEmpty(result3.excServices, "parseExclusions: null должен возвращать пустые массивы");

    console.info("  - Тестируем parseExclusionItem");
    // Тест с целым числом
    let result4 = masterSwitchParseExclusionItem(130);
    assertEquals(130, result4.accessoryId, "parseExclusionItem: Целое число должно парситься как accessoryId");
    assertNull(result4.serviceId, "parseExclusionItem: Целое число не должно иметь serviceId");

    // Тест с дробным числом
    let result5 = masterSwitchParseExclusionItem(130.15);
    assertEquals(130, result5.accessoryId, "parseExclusionItem: Дробное число должно парситься корректно");
    assertEquals("15", result5.serviceId, "parseExclusionItem: Дробное число должно иметь serviceId");

    console.info("  - Тестируем getArrayFromValue");
    // Тест с массивом
    let result6 = masterSwitchGetArrayFromValue([1, 2, 3], "number");
    assertEquals(3, result6.length, "getArrayFromValue: Массив должен возвращаться как есть");
    assertEquals(1, result6[0], "getArrayFromValue: Первый элемент должен быть 1");

    // Тест с одиночным значением
    let result7 = masterSwitchGetArrayFromValue("test", "string");
    assertEquals(1, result7.length, "getArrayFromValue: Одиночное значение должно стать массивом");
    assertEquals("test", result7[0], "getArrayFromValue: Значение должно сохраниться");

    console.info("  - Тестируем валидацию параметров");
    clearTestLog();
    
    // Тест с null параметрами
    masterSwitch(null);
    let errorLogs = testLog.filter(log => log.level === 'error');
    assertNotEmpty(errorLogs, "Валидация: Должна быть ошибка при null параметрах");

    clearTestLog();
    
    // Тест с некорректным интервалом
    masterSwitch({
        interval: -100,
        debug: true
    });
    
    let warnLogs = testLog.filter(log => log.level === 'warn');
    assertNotEmpty(warnLogs, "Валидация: Должно быть предупреждение при отрицательном интервале");

    console.info("  - Тестируем форматы ID");
    resetTestEnvironment();
    let acc = createTestSwitch();
    let service = acc.getService(HS.Switch);
    
    // Проверяем, что service.getUUID() возвращает правильный формат
    let serviceUUID = service.getUUID();
    assertEquals(serviceUUID, "1.12", "Форматы ID: service.getUUID() должен возвращать 'accessoryId.serviceId'");
    
    // Проверяем, что accessory.getUUID() возвращает только ID аксессуара
    let accessoryUUID = acc.getUUID();
    assertEquals(accessoryUUID, "1", "Форматы ID: accessory.getUUID() должен возвращать только ID аксессуара");
}

// Тест 2: Базовое выключение устройств (объединяет тесты 4-6, 9, 13, 15)
function test2_BasicTurnOff(assertTrue, assertFalse, assertEqualsWithException) {
    console.info("  - Тестируем простое выключение устройств");
    resetTestEnvironment();
    
    let acc1 = createTestSwitch();
    let acc2 = createTestLightbulb();
    
    // Очищаем собственные комнаты аксессуаров
    acc1.getRoom().getAccessories().splice(0);
    acc2.getRoom().getAccessories().splice(0);
    
    let rooms = Hub.getRooms();
    // Добавляем устройства в комнату "Тест"
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].getName() === "Тест") {
            rooms[i].getAccessories().push(acc1);
            rooms[i].getAccessories().push(acc2);
            acc1.setRoom(rooms[i]);
            acc2.setRoom(rooms[i]);
            break;
        }
    }

    // Проверяем, что устройства включены
    assertTrue(acc1.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Базовое выключение: Выключатель должен быть включен");
    assertTrue(acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Базовое выключение: Лампа должна быть включена");

    clearTestLog();
    masterSwitch({
        lightbulbs: true,
        switches: true,
        outlets: false,
        debug: true
    });

    // Проверяем, что устройства выключились
    let switchValue = acc1.getService(HS.Switch).getCharacteristic(HC.On).getValue();
    let lightValue = acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue();
    
    assertFalse(switchValue, "Базовое выключение: Выключатель должен быть выключен");
    assertFalse(lightValue, "Базовое выключение: Лампа должна быть выключена");

    console.info("  - Тестируем turnOffService");
    resetTestEnvironment();
    
    let acc = createTestAirPurifier();
    
    // Очищаем собственную комнату аксессуара
    acc.getRoom().getAccessories().splice(0);
    
    let rooms2 = Hub.getRooms();
    // Находим комнату "Спальня" и добавляем туда очиститель воздуха
    for (var i = 0; i < rooms2.length; i++) {
        if (rooms2[i].getName() === "Спальня") {
            rooms2[i].getAccessories().push(acc);
            acc.setRoom(rooms2[i]);
            break;
        }
    }
    
    // Включаем устройство
    acc.getService(HS.AirPurifier).getCharacteristic(HC.Active).setValue(1);
    
    clearTestLog();
    
    // Тестируем напрямую вызов masterSwitch с одним устройством
    masterSwitch({
        lightbulbs: false,
        switches: false,
        outlets: false,
        additionalDevices: [5], // ID очистителя воздуха
        debug: true
    });
    
    // Проверяем, что устройство действительно выключилось
    let currentValue = acc.getService(HS.AirPurifier).getCharacteristic(HC.Active).getValue();
    assertEqualsWithException(currentValue, 0, "turnOffService: Очиститель воздуха должен выключиться");
    
    // Проверяем, что найдены логи отладки
    let debugLogs = testLog.filter(log => log.level === 'info');
    assertNotEmpty(debugLogs, "turnOffService: Должны быть логи отладки");

    console.info("  - Тестируем isDeviceOn");
    let acc3 = createTestSwitch();
    let service = acc3.getService(HS.Switch);
    
    // Проверяем, что устройство включено
    assertTrue(service.getCharacteristic(HC.On).getValue(), "isDeviceOn: Включенное устройство должно возвращать true");

    // Выключаем устройство
    service.getCharacteristic(HC.On).setValue(false);
    assertFalse(service.getCharacteristic(HC.On).getValue(), "isDeviceOn: Выключенное устройство должно возвращать false");

    console.info("  - Тестируем дополнительные устройства");
    resetTestEnvironment();
    
    // Создаем аксессуар БЕЗ собственной комнаты
    let acc4 = createTestAirPurifier();
    // Удаляем аксессуар из его собственной комнаты
    acc4.getRoom().getAccessories().splice(0);
    
    let rooms3 = Hub.getRooms();

    // Находим комнату "Спальня" в testRooms и добавляем туда очиститель воздуха
    for (var i = 0; i < rooms3.length; i++) {
        if (rooms3[i].getName() === "Спальня") {
            rooms3[i].getAccessories().push(acc4);
            // Обновляем ссылку на комнату в аксессуаре
            acc4.setRoom(rooms3[i]);
            break;
        }
    }

    // Включаем устройство
    acc4.getService(HS.AirPurifier).getCharacteristic(HC.Active).setValue(1);

    masterSwitch({
        lightbulbs: false,
        switches: false,
        outlets: false,
        additionalDevices: [5], // ID очистителя воздуха
        debug: true
    });

    // Проверяем значение после вызова masterSwitch
    let currentValue2 = acc4.getService(HS.AirPurifier).getCharacteristic(HC.Active).getValue();
    
    // Устройство должно выключиться
    assertEqualsWithException(currentValue2, 0, "Дополнительные устройства: Дополнительное устройство должно выключиться");
}

// Тест 3: Исключения и фильтрация (объединяет тесты 7-8, 17, 22)
function test3_ExclusionsAndFiltering(assertTrue, assertFalse, assertContains, assertEmpty) {
    console.info("  - Тестируем исключения устройств");
    resetTestEnvironment();
    
    let acc1 = createTestSwitch();
    let acc2 = createTestLightbulb();
    
    // Очищаем собственные комнаты аксессуаров
    acc1.getRoom().getAccessories().splice(0);
    acc2.getRoom().getAccessories().splice(0);
    
    let rooms = Hub.getRooms();
    // Добавляем устройства в комнату "Тест"
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].getName() === "Тест") {
            rooms[i].getAccessories().push(acc1);
            rooms[i].getAccessories().push(acc2);
            acc1.setRoom(rooms[i]);
            acc2.setRoom(rooms[i]);
            break;
        }
    }

    // Выключаем с исключением первого устройства
    masterSwitch({
        lightbulbs: true,
        switches: true,
        excludeAccessories: [1], // ID первого аксессуара
        debug: false
    });

    // Первое устройство должно остаться включенным (исключено)
    assertTrue(acc1.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Исключения: Исключенное устройство должно остаться включенным");
    // Второе устройство должно выключиться
    assertFalse(acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Исключения: Неисключенное устройство должно выключиться");
    
    // Включаем обратно для следующего теста
    acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).setValue(true);
    
    // Тест исключения по ID сервиса
    masterSwitch({
        lightbulbs: true,
        switches: true,
        excludeAccessories: ["3.32"], // ID сервиса лампы
        debug: false
    });
    
    // Первое устройство должно выключиться (не исключено)
    assertFalse(acc1.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Исключения: Неисключенный сервис должен выключиться");
    // Второе устройство должно остаться включенным (исключено)
    assertTrue(acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Исключения: Исключенный сервис должен остаться включенным");

    console.info("  - Тестируем выключение по комнатам");
    resetTestEnvironment();
    
    let acc3 = createTestSwitch();
    let acc4 = createTestLightbulb();
    
    // Очищаем собственные комнаты аксессуаров
    acc3.getRoom().getAccessories().splice(0);
    acc4.getRoom().getAccessories().splice(0);
    
    // Добавляем устройства в разные комнаты
    let rooms2 = Hub.getRooms();
    // Находим комнату "Тест" и добавляем туда выключатель
    for (var i = 0; i < rooms2.length; i++) {
        if (rooms2[i].getName() === "Тест") {
            rooms2[i].getAccessories().push(acc3);
            acc3.setRoom(rooms2[i]);
            break;
        }
    }
    // Находим комнату "Гостиная" и добавляем туда лампу
    for (var i = 0; i < rooms2.length; i++) {
        if (rooms2[i].getName() === "Гостиная") {
            rooms2[i].getAccessories().push(acc4);
            acc4.setRoom(rooms2[i]);
            break;
        }
    }

    // Выключаем только в комнате "Гостиная"
    masterSwitch({
        rooms: ["Гостиная"],
        lightbulbs: true,
        switches: true,
        debug: false
    });

    // Устройство в "Тест" должно остаться включенным
    assertTrue(acc3.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Комнаты: Устройство в невыбранной комнате должно остаться включенным");
    // Устройство в "Гостиная" должно выключиться
    assertFalse(acc4.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Комнаты: Устройство в выбранной комнате должно выключиться");

    console.info("  - Тестируем оптимизированный поиск комнат");
    clearTestLog();
    
    // Тестируем поиск несуществующей комнаты
    masterSwitch({
        rooms: ["Несуществующая комната"],
        lightbulbs: true,
        switches: true,
        debug: true
    });
    
    // Проверяем, что есть предупреждение о несуществующей комнате
    let warnLogs = testLog.filter(log => log.level === 'warn' && log.message.indexOf("не найдена") !== -1);
    assertNotEmpty(warnLogs, "Поиск комнат: Должно быть предупреждение о несуществующей комнате");
    
    clearTestLog();
    
    // Тестируем поиск существующей комнаты
    masterSwitch({
        rooms: ["Тест"],
        lightbulbs: true,
        switches: true,
        debug: true
    });
    
    // Проверяем, что нет предупреждений
    let warnLogs2 = testLog.filter(log => log.level === 'warn' && log.message.indexOf("не найдена") !== -1);
    assertEmpty(warnLogs2, "Поиск комнат: Не должно быть предупреждений для существующей комнаты");
}

// Тест 4: Различные типы устройств и характеристик (объединяет тесты 14, 23)
function test4_DifferentDeviceTypes(assertEqualsWithException, assertNotEmpty) {
    console.info("  - Тестируем различные типы устройств");
    resetTestEnvironment();
    
    let airPurifier = createTestAirPurifier();
    let thermostat = createTestThermostat();
    let fan = createTestActiveDevice();
    
    // Очищаем собственные комнаты аксессуаров
    airPurifier.getRoom().getAccessories().splice(0);
    thermostat.getRoom().getAccessories().splice(0);
    fan.getRoom().getAccessories().splice(0);
    
    let rooms = Hub.getRooms();
    
    // Добавляем устройства в разные комнаты
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].getName() === "Спальня") {
            rooms[i].getAccessories().push(airPurifier);
            airPurifier.setRoom(rooms[i]);
        } else if (rooms[i].getName() === "Гостиная") {
            rooms[i].getAccessories().push(thermostat);
            thermostat.setRoom(rooms[i]);
        } else if (rooms[i].getName() === "Тест") {
            rooms[i].getAccessories().push(fan);
            fan.setRoom(rooms[i]);
        }
    }
    
    // Включаем все устройства
    airPurifier.getService(HS.AirPurifier).getCharacteristic(HC.Active).setValue(1);
    airPurifier.getService(HS.AirPurifier).getCharacteristic(HC.TargetAirPurifierState).setValue(2);
    thermostat.getService(HS.Thermostat).getCharacteristic(HC.TargetHeatingCoolingState).setValue(2);
    fan.getService(HS.Fan).getCharacteristic(HC.Active).setValue(1);
    
    // Выключаем через masterSwitch
    masterSwitch({
        lightbulbs: false,
        switches: false,
        outlets: false,
        additionalDevices: [5, 6, 2], // ID всех устройств
        debug: false
    });
    
    // Проверяем, что все устройства выключились
    let airPurifierActive = airPurifier.getService(HS.AirPurifier).getCharacteristic(HC.Active).getValue();
    let airPurifierTarget = airPurifier.getService(HS.AirPurifier).getCharacteristic(HC.TargetAirPurifierState).getValue();
    let thermostatValue = thermostat.getService(HS.Thermostat).getCharacteristic(HC.TargetHeatingCoolingState).getValue();
    let fanValue = fan.getService(HS.Fan).getCharacteristic(HC.Active).getValue();
    
    assertEqualsWithException(airPurifierActive, 0, "Типы устройств: Active очистителя воздуха должен быть 0");
    assertEqualsWithException(airPurifierTarget, 0, "Типы устройств: TargetAirPurifierState должен быть 0");
    assertEqualsWithException(thermostatValue, 0, "Типы устройств: TargetHeatingCoolingState термостата должен быть 0");
    assertEqualsWithException(fanValue, 0, "Типы устройств: Active вентилятора должен быть 0");

    console.info("  - Тестируем отладку и логирование");
    resetTestEnvironment();
    
    let acc = createTestSwitch();
    
    // Очищаем собственную комнату аксессуара
    acc.getRoom().getAccessories().splice(0);
    
    let rooms2 = Hub.getRooms();
    // Находим комнату "Тест" и добавляем туда выключатель
    for (var i = 0; i < rooms2.length; i++) {
        if (rooms2[i].getName() === "Тест") {
            rooms2[i].getAccessories().push(acc);
            acc.setRoom(rooms2[i]);
            break;
        }
    }

    clearTestLog();
    masterSwitch({
        switches: true,
        debug: true
    });

    let infoLogs = testLog.filter(log => log.level === 'info');
    assertNotEmpty(infoLogs, "Отладка: Должны быть информационные логи при включенной отладке");
}

// Тест 5: Последовательное выключение и порядок (объединяет тесты 10, 15, 18)
function test5_SequentialAndOrder(assertTrue, assertFalse, assertNotEmpty) {
    console.info("  - Тестируем последовательное выключение");
    resetTestEnvironment();
    
    let acc1 = createTestSwitch();
    let acc2 = createTestLightbulb();
    
    // Очищаем собственные комнаты аксессуаров
    acc1.getRoom().getAccessories().splice(0);
    acc2.getRoom().getAccessories().splice(0);
    
    let rooms = Hub.getRooms();
    // Находим комнату "Тест" и добавляем туда устройства
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].getName() === "Тест") {
            rooms[i].getAccessories().push(acc1);
            rooms[i].getAccessories().push(acc2);
            acc1.setRoom(rooms[i]);
            acc2.setRoom(rooms[i]);
            break;
        }
    }

    clearTestLog();
    masterSwitch({
        lightbulbs: true,
        switches: true,
        interval: 100, // 100мс интервал
        debug: true
    });

    // Проверяем, что устройства выключились
    assertFalse(acc1.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Последовательное: Первое устройство должно выключиться");
    assertFalse(acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Последовательное: Второе устройство должно выключиться");

    console.info("  - Тестируем порядок выключения");
    resetTestEnvironment();
    
    let acc3 = createTestSwitch();
    let acc4 = createTestLightbulb();
    let acc5 = createTestOutlet();
    
    // Очищаем собственные комнаты аксессуаров
    acc3.getRoom().getAccessories().splice(0);
    acc4.getRoom().getAccessories().splice(0);
    acc5.getRoom().getAccessories().splice(0);
    
    let rooms2 = Hub.getRooms();
    // Добавляем устройства в комнату "Тест"
    for (var i = 0; i < rooms2.length; i++) {
        if (rooms2[i].getName() === "Тест") {
            rooms2[i].getAccessories().push(acc3);
            rooms2[i].getAccessories().push(acc4);
            rooms2[i].getAccessories().push(acc5);
            acc3.setRoom(rooms2[i]);
            acc4.setRoom(rooms2[i]);
            acc5.setRoom(rooms2[i]);
            break;
        }
    }
    
    clearTestLog();
    
    // Тест с порядком выключения
    masterSwitch({
        lightbulbs: true,
        switches: true,
        outlets: true,
        turnOffOrder: [3, 1], // Сначала розетка, потом выключатель
        interval: 50, // Небольшой интервал для тестирования
        debug: true
    });
    
    // Проверяем, что все устройства выключились
    assertFalse(acc3.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Порядок: Выключатель должен выключиться");
    assertFalse(acc4.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Порядок: Лампа должна выключиться");
    assertFalse(acc5.getService(HS.Outlet).getCharacteristic(HC.On).getValue(), "Порядок: Розетка должна выключиться");
    
    // Проверяем, что есть логи о порядке выключения
    let orderLogs = testLog.filter(log => log.message.indexOf("Сортируем устройства по порядку выключения") !== -1);
    assertNotEmpty(orderLogs, "Порядок: Должны быть логи о сортировке по порядку");

    console.info("  - Тестируем повторное выключение");
    resetTestEnvironment();
    
    let acc6 = createTestSwitch();
    
    // Очищаем собственную комнату аксессуара
    acc6.getRoom().getAccessories().splice(0);
    
    let rooms3 = Hub.getRooms();
    
    // Находим комнату "Тест" и добавляем туда устройство
    for (var i = 0; i < rooms3.length; i++) {
        if (rooms3[i].getName() === "Тест") {
            rooms3[i].getAccessories().push(acc6);
            acc6.setRoom(rooms3[i]);
            break;
        }
    }

    clearTestLog();
    masterSwitch({
        switches: true,
        verifyTurnOff: true,
        debug: true
    });

    // Проверяем, что устройство выключилось
    if (acc6.getService(HS.Switch)) {
        assertFalse(acc6.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Повторное: Устройство должно выключиться");
    } else {
        console.error("Тест: getService(HS.Switch) вернул null");
    }

    // Проверяем, что есть логи о планировании повторного выключения
    let infoLogs = testLog.filter(log => log.message.indexOf("Запланировано повторное выключение") !== -1);
    assertNotEmpty(infoLogs, "Повторное: Должен быть лог о планировании повторного выключения");
}

// Тест 6: Отложенное выключение и форматы ID (объединяет тесты 26-27)
function test6_DelayedTurnOff(assertTrue, assertFalse) {
    console.info("  - Тестируем отложенное выключение устройств");
    resetTestEnvironment();
    
    let acc1 = createTestSwitch();
    let acc2 = createTestLightbulb();
    
    // Очищаем собственные комнаты аксессуаров
    acc1.getRoom().getAccessories().splice(0);
    acc2.getRoom().getAccessories().splice(0);
    
    let rooms = Hub.getRooms();
    // Добавляем устройства в комнату "Тест"
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].getName() === "Тест") {
            rooms[i].getAccessories().push(acc1);
            rooms[i].getAccessories().push(acc2);
            acc1.setRoom(rooms[i]);
            acc2.setRoom(rooms[i]);
            break;
        }
    }
    
    clearTestLog();
    
    // Тестируем отложенное выключение
    masterSwitch({
        lightbulbs: true,
        switches: true,
        delayedDevices: [1], // ID первого аксессуара (выключатель)
        delayedTurnOffTime: 100, // 100мс задержка для тестов
        debug: true
    });
    
    // В тестовом режиме setTimeout выполняется сразу, поэтому отложенное устройство должно выключиться
    assertFalse(acc1.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Отложенное: Отложенное устройство должно выключиться в тестовом режиме");
    
    // Второе устройство (лампа) должно выключиться сразу в любом режиме
    assertFalse(acc2.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Отложенное: Неотложенное устройство должно выключиться сразу");

    console.info("  - Тестируем форматы ID в отложенном выключении");
    resetTestEnvironment();
    
    let acc3 = createTestSwitch();
    let acc4 = createTestLightbulb();
    
    // Очищаем собственные комнаты аксессуаров
    acc3.getRoom().getAccessories().splice(0);
    acc4.getRoom().getAccessories().splice(0);
    
    let rooms2 = Hub.getRooms();
    // Добавляем устройства в комнату "Тест"
    for (var i = 0; i < rooms2.length; i++) {
        if (rooms2[i].getName() === "Тест") {
            rooms2[i].getAccessories().push(acc3);
            rooms2[i].getAccessories().push(acc4);
            acc3.setRoom(rooms2[i]);
            acc4.setRoom(rooms2[i]);
            break;
        }
    }
    
    clearTestLog();
    
    // Проверяем форматы ID
    let accessoryId = acc3.getUUID(); // Должно быть "1"
    let serviceId = acc3.getService(HS.Switch).getUUID(); // Должно быть "1.12"
    
    console.info("Форматы ID: accessoryId = " + accessoryId + ", serviceId = " + serviceId);
    
    // Тестируем отложенное выключение с разными форматами ID
    masterSwitch({
        lightbulbs: true,
        switches: true,
        delayedDevices: [1, 3], // ID аксессуаров (выключатель и лампа)
        delayedTurnOffTime: 100, // 100мс задержка для тестов
        debug: true
    });
    
    // Оба устройства должны выключиться в тестовом режиме
    assertFalse(acc3.getService(HS.Switch).getCharacteristic(HC.On).getValue(), "Форматы ID: Выключатель должен выключиться");
    assertFalse(acc4.getService(HS.Lightbulb).getCharacteristic(HC.On).getValue(), "Форматы ID: Лампа должна выключиться");
}

// Тест 7: Валидация и граничные случаи (объединяет тесты 16, 24)
function test7_ValidationAndEdgeCases(assertFalse, assertNotEmpty, assertEmpty) {
    console.info("  - Тестируем обработку ошибок и граничных случаев");
    clearTestLog();
    
    // Тест с пустыми параметрами
    masterSwitch({});
    let errorLogs = testLog.filter(log => log.level === 'error');
    assertEmpty(errorLogs, "Граничные случаи: Не должно быть ошибок с пустыми параметрами");
    
    clearTestLog();
    
    // Тест с некорректными типами данных
    masterSwitch({
        rooms: "не массив",
        excludeRooms: 123,
        excludeAccessories: "не массив",
        additionalDevices: "не массив",
        interval: "не число",
        debug: "не булево"
    });
    
    // Проверяем, что функция не падает с ошибкой
    let errorLogs2 = testLog.filter(log => log.level === 'error');
    assertEmpty(errorLogs2, "Граничные случаи: Функция должна обрабатывать некорректные типы данных");
    
    clearTestLog();
    
    // Тест с отрицательным интервалом
    masterSwitch({
        interval: -100,
        debug: true
    });
    
    let warnLogs = testLog.filter(log => log.level === 'warn' && log.message.indexOf("интервал") !== -1);
    assertNotEmpty(warnLogs, "Граничные случаи: Должно быть предупреждение о некорректном интервале");

    console.info("  - Тестируем валидацию параметров");
    clearTestLog();
    
    // Тест с пустыми массивами
    masterSwitch({
        rooms: [],
        excludeRooms: [],
        excludeAccessories: [],
        additionalDevices: [],
        debug: true
    });
    
    let errorLogs3 = testLog.filter(log => log.level === 'error');
    assertEmpty(errorLogs3, "Валидация: Не должно быть ошибок с пустыми массивами");
}

// Тест 8: Производительность и граничные случаи (объединяет тесты 25)
function test8_PerformanceAndEdgeCases(assertTrue, assertNotEmpty) {
    console.info("  - Тестируем производительность с большим количеством устройств");
    resetTestEnvironment();
    
    // Создаем много тестовых устройств
    let devices = [];
    let rooms = Hub.getRooms();
    let testRoom = null;
    
    // Находим тестовую комнату
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].getName() === "Тест") {
            testRoom = rooms[i];
            break;
        }
    }
    
    if (!testRoom) {
        console.error("test8_PerformanceAndEdgeCases: Не найдена тестовая комната");
        return;
    }
    
    // Создаем 10 устройств
    for (var i = 0; i < 10; i++) {
        let acc = global.createUnitTestFullAccessory({
            id: 100 + i,
            name: "Тестовое устройство " + i,
            room: "Тест",
            services: [{
                id: 1000 + i * 10,
                type: HS.AccessoryInformation,
                name: "Информация об аксессуаре",
                characteristics: [{
                    id: 10000 + i * 100,
                    type: HC.C_Online,
                    value: true
                }]
            }, {
                id: 1001 + i * 10,
                type: HS.Switch,
                name: "Выключатель",
                characteristics: [{
                    id: 10001 + i * 100,
                    type: HC.On,
                    value: true
                }]
            }]
        });
        
        testRoom.getAccessories().push(acc);
        acc.setRoom(testRoom);
        devices.push(acc);
    }
    
    clearTestLog();
    let startTime = Date.now();
    
    // Выключаем все устройства
    masterSwitch({
        rooms: ["Тест"],
        switches: true,
        debug: true
    });
    
    let endTime = Date.now();
    let executionTime = endTime - startTime;
    
    // Проверяем, что все устройства выключились
    let allTurnedOff = devices.every(function(device) {
        return !device.getService(HS.Switch).getCharacteristic(HC.On).getValue();
    });
    
    assertTrue(allTurnedOff, "Производительность: Все устройства должны выключиться");
    
    console.info("test8_PerformanceAndEdgeCases: Время выполнения: " + executionTime + "мс для " + devices.length + " устройств");
    
    // Проверяем, что время выполнения разумное (менее 1 секунды)
    if (executionTime > 1000) {
        console.warn("test8_PerformanceAndEdgeCases: Время выполнения слишком большое: " + executionTime + "мс");
    }

    console.info("  - Тестируем граничные случаи");
    clearTestLog();
    
    // Тест с максимальными значениями
    masterSwitch({
        interval: 60000, // Максимальный интервал
        delayedTurnOffTime: 300000, // Максимальное время отложенного выключения
        debug: true
    });
    
    // Проверяем, что нет ошибок
    let errorLogs = testLog.filter(log => log.level === 'error');
    if (errorLogs.length > 0) {
        console.error("Граничные случаи: Найдены ошибки с максимальными значениями: " + errorLogs.map(log => log.message).join(", "));
    }
}

// Запускаем тесты при загрузке сценария
runMasterSwitchTests();