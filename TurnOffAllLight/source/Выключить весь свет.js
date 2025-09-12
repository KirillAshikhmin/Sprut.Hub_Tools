function turnOffLight(excludeRooms, excludeAccessories) {
var excludeRoomsNames = ["Виртуальная"]; //ID комнат, где не надо выключать свет
var excludeAccessoriesId = [130, 188]; //ID устройств, которые не надо выключать 
var turnOffHidden = false; // Отключать скрытые
var turnOffOutlets = false; // Отключать розетки
var turnOffAdditionalDevices = []; //ID устройств и сервисов для дополнительного отключения любых типов устройств
var turnOffLightDebug = false; // Активация дополнительного логгирования для отладки


    var excRooms = []
    var excAccessories = []
    var excServices = []

    // Обработка исключений комнат
    excludeRoomsNames.forEach(function fe(room) { excRooms.push(room) })
    getArrayFromValue(excludeRooms, "string").forEach(function fe(room) { excRooms.push(room) })

    // Обработка исключений аксессуаров и сервисов из глобальных настроек
    var globalExclusions = parseExclusions(excludeAccessoriesId);
    excAccessories = excAccessories.concat(globalExclusions.excAccessories);
    excServices = excServices.concat(globalExclusions.excServices);

    // Обработка исключений аксессуаров и сервисов из параметров функции
    var paramExclusions = parseExclusions(excludeAccessories);
    excAccessories = excAccessories.concat(paramExclusions.excAccessories);
    excServices = excServices.concat(paramExclusions.excServices);

    // Парсим дополнительные устройства для отключения
    var additionalDevices = [];
    if (turnOffAdditionalDevices && turnOffAdditionalDevices.length > 0) {
        var additionalExclusions = parseExclusions(turnOffAdditionalDevices);
        additionalDevices = additionalExclusions.excAccessories.concat(additionalExclusions.excServices);
    }

    if (turnOffLightDebug) log.info("Exclude Rooms " + excRooms.join("- "));
    if (turnOffLightDebug) log.info("Exclude Accessories " + excAccessories.join("- "));
    if (turnOffLightDebug) log.info("Exclude Services " + excServices.join("- "));
    if (turnOffLightDebug) log.info("Additional Devices " + additionalDevices.join("- "));
    
    const rooms = Hub.getRooms().filter(function loopRooms(room) { return excRooms.indexOf(room.getName()) < 0 });

    rooms.forEach(function loopRooms(room) {
        var accessories = room.getAccessories().filter(function loopRooms(accessory) { return excAccessories.indexOf(parseInt(accessory.getUUID())) < 0 });
        accessories.forEach(function loopAccessories(accessory) {
            var status = accessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue();
            if (accessory.getModelId() == "Sprut.hub" || status == false) return

            accessory.getServices().forEach(function loopServices(service) {
                var serviceType = service.getType();
                var shouldProcess = false;
                
                // Проверяем тип сервиса
                if (serviceType == HS.Switch || serviceType == HS.Lightbulb) {
                    shouldProcess = true;
                } else if (serviceType == HS.Outlet && turnOffOutlets) {
                    shouldProcess = true;
                }
                
                if (shouldProcess) {
                    // Проверяем, не исключен ли конкретный сервис
                    var serviceId = accessory.getUUID() + "." + service.getUUID();
                    if (excServices.indexOf(serviceId) >= 0) {
                        if (turnOffLightDebug) log.info("Service " + serviceId + " is excluded");
                        return;
                    }
                    
                    var on = service.getCharacteristic(HC.On)
                    if ((service.isVisible() || turnOffHidden) && on.getValue()) {
                        if (turnOffLightDebug) log.info("Room " + room.getName() + ". Accessory " + accessory.getName() + ". Service " + serviceId + " " + service.getName() + " (Type: " + serviceType + ")");
                        on.setValue(false)
                    }
                }
            })
        })
    })

    // Обрабатываем дополнительные устройства для отключения
    if (additionalDevices.length > 0) {
        turnOffAdditionalDevicesGlobal(additionalDevices);
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
    
    items.forEach(function(item) {
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
        if (Number.isInteger(item)) {
            // Целое число - только аксессуар
            accessoryId = item;
        } else {
            // Дробное число - аксессуар.сервис
            var parts = item.toString().split('.');
            accessoryId = parseInt(parts[0]);
            serviceId = parts[1] ? parts[1] : null;
        }
    } else if (typeof item === 'string') {
        if (item.includes('.')) {
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

/**
 * Отключает дополнительные устройства по их идентификаторам (глобальная версия)
 * 
 * Поддерживаемые типы сервисов:
 * - Switch (Выключатель)
 * - Lightbulb (Лампочка)
 * - Outlet (Розетка)
 * - FanBasic (Вентилятор простой)
 * - AirPurifier (Очиститель воздуха)
 * - HeaterCooler (Нагреватель охладитель)
 * - HumidifierDehumidifier (Увлажнитель осушитель)
 * - Thermostat (Термостат)
 * - Door (Дверь)
 * - Faucet (Водопроводный кран)
 * - IrrigationSystem (Система полива)
 * - Valve (Кран)
 * - WindowCovering (Штора)
 * - Speaker (Динамик)
 * - Microphone (Микрофон)
 * - TelevisionSpeaker (Телевизионный динамик)
 * 
 * @param {Array} additionalDevices - Массив идентификаторов устройств и сервисов
 */
function turnOffAdditionalDevicesGlobal(additionalDevices) {
    additionalDevices.forEach(function(deviceId) {
        try {
            if (deviceId.includes('.')) {
                // Это конкретный сервис (аксессуар.сервис)
                var parts = deviceId.split('.');
                var accessoryId = parseInt(parts[0]);
                var serviceId = parts[1];
                
                var accessory = Hub.getAccessory(accessoryId);
                if (accessory) {
                    var service = accessory.getService(serviceId);
                    if (service) {
                        turnOffServiceGlobal(service);
                    } else if (turnOffLightDebug) {
                        log.warn("Service not found: " + serviceId + " in accessory: " + accessoryId);
                    }
                } else if (turnOffLightDebug) {
                    log.warn("Accessory not found: " + accessoryId);
                }
            } else {
                // Это аксессуар целиком
                var accessoryId = parseInt(deviceId);
                var accessory = Hub.getAccessory(accessoryId);
                if (accessory) {
                    var services = accessory.getServices();
                    services.forEach(function(service) {
                        turnOffServiceGlobal(service);
                    });
                } else if (turnOffLightDebug) {
                    log.warn("Accessory not found: " + accessoryId);
                }
            }
        } catch (e) {
            if (turnOffLightDebug) {
                log.error("Error processing device: " + deviceId + " Error: " + e.message);
            }
        }
    });
}

/**
 * Отключает сервис, ища все характеристики для отключения (глобальная версия)
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
 */
function turnOffServiceGlobal(service) {
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
    
    turnOffCharacteristics.forEach(function(charConfig) {
        try {
            var characteristic = service.getCharacteristic(charConfig.type);
            if (characteristic) {
                var currentValue = characteristic.getValue();
                if (currentValue !== charConfig.value) {
                    characteristic.setValue(charConfig.value);
                    turnedOffCount++;
                    
                    if (turnOffLightDebug) {
                        log.info("Turned off " + charConfig.name + " in " + accessory.getName() + " service " + service.getName() + " from " + currentValue + " to " + charConfig.value);
                    }
                }
            }
        } catch (e) {
            // Игнорируем ошибки для характеристик, которые не поддерживаются сервисом
            if (turnOffLightDebug) {
                log.debug("Characteristic " + charConfig.name + " not supported in service " + service.getName());
            }
        }
    });

    if (turnOffLightDebug && turnedOffCount > 0) {
        log.info("Turned off " + turnedOffCount + " characteristics in " + accessory.getName() + " service " + service.getName());
    }
}