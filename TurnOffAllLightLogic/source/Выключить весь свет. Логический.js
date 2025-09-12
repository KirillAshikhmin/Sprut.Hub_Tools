// Выносим название и описание в переменные для использования в info и options
let scenarioName = {
    ru: "🔌 Выключить весь свет",
    en: "🔌 Turn off all lights"
};

let scenarioDescription = {
    ru: "Логический сценарий для отключения всех ламп, выключателей и розеток в доме при включении выключателя или нажатии кнопки.\n\nОСНОВНЫЕ ФУНКЦИИ:\n• Автоматическое отключение всех светильников при срабатывании триггера\n• Гибкое управление типами устройств (лампочки, выключатели, розетки)\n• Поддержка исключений комнат и устройств\n• Дополнительное отключение любых устройств по ID\n• Настройка через опции сценария\n• Поддержка отключения скрытых устройств\n• Подробное логирование для отладки\n\nПОДДЕРЖИВАЕМЫЕ СЕРВИСЫ:\n• Switch (Выключатель) - настраивается отдельно\n• Lightbulb (Лампочка) - настраивается отдельно\n• Outlet (Розетка) - настраивается отдельно\n• Любые другие устройства через поле 'Выключить так же'\n\nТРИГГЕРЫ СРАБАТЫВАНИЯ:\n• Включение выключателя (Switch, On = true)\n• Нажатие кнопки (StatelessProgrammableSwitch, ProgrammableSwitchEvent = 0)",
    en: "Logical scenario for turning off all lights, switches and outlets in the house when a switch is turned on or a button is pressed.\n\nMAIN FEATURES:\n• Automatic turning off all lights when trigger is activated\n• Flexible control of device types (lightbulbs, switches, outlets)\n• Support for room and device exceptions\n• Additional turning off any devices by ID\n• Configuration through scenario options\n• Support for turning off hidden devices\n• Detailed logging for debugging\n\nSUPPORTED SERVICES:\n• Switch (Switch) - configurable separately\n• Lightbulb (Lightbulb) - configurable separately\n• Outlet (Outlet) - configurable separately\n• Any other devices via 'Turn off additional' field\n\nTRIGGERS:\n• Switch turn on (Switch, On = true)\n• Button press (StatelessProgrammableSwitch, ProgrammableSwitchEvent = 0)"
};

/*
 * info - Обязательное поле, описывающее сценарий.
 * Считывается хабом в момент загрузки или сохранения сценария.
 * В коде обращаться к этому объекту запрещено, считать данные с него тоже не получится.
 * Необходимо использовать только значения, которые приходят в функции compute или trigger.
 */
info = { 
  name: scenarioName.ru, // Название сценария
  description: scenarioDescription.ru, // Описание функционала сценария
  version: "1.0", // Номер версии сценария
  author: "@BOOMikru", // Автор сценария
  onStart: false, // Не запускать при старте хаба
  sourceServices: [HS.Switch, HS.StatelessProgrammableSwitch], // Список устройств, на изменение характеристик которых будет реагировать сценарий
  sourceCharacteristics: [HC.On, HC.ProgrammableSwitchEvent], // Список характеристик, на изменение которых будет реагировать сценарий

  // Опции для сценария. Отображаются в интерфейсе хаба в настройках логики для каждого устройства. 
  // У каждого устройства опции индивидуальные.
  options: {
    // Отключать лампочки
    turnOffLightbulbs: { 
      type: "Boolean", 
      value: true,
      name: { ru: "Отключать лампочки", en: "Turn off lightbulbs" }, 
      desc: { ru: "Отключать лампочки", en: "Turn off lightbulbs" } 
    },

    // Отключать выключатели
    turnOffSwitches: { 
      type: "Boolean", 
      value: true,
      name: { ru: "Отключать выключатели", en: "Turn off switches" }, 
      desc: { ru: "Отключать выключатели", en: "Turn off switches" } 
    },

    // Отключать розетки
    turnOffOutlets: { 
      type: "Boolean", 
      value: false,
      name: { ru: "Отключать розетки", en: "Turn off outlets" }, 
      desc: { ru: "Отключать розетки", en: "Turn off outlets" } 
    },

    // Отключать скрытые устройства
    turnOffHidden: { 
      type: "Boolean", 
      value: false,
      name: { ru: "Отключать скрытые", en: "Turn off hidden" }, 
      desc: { ru: "Отключать скрытые устройства", en: "Turn off hidden devices" } 
    },

    // Исключения комнат
    excludeRoomsNames: { 
      type: "String", 
      value: "",
      maxLength: 500,
      name: { ru: "Комнаты исключения", en: "Exclude rooms" }, 
      desc: { ru: "Названия комнат через запятую, где не надо выключать свет", en: "Room names separated by commas where lights should not be turned off" } 
    },

    // Исключения аксессуаров и сервисов
    excludeAccessoriesId: { 
      type: "String", 
      value: "",
      maxLength: 500,
      name: { ru: "Устройства исключения", en: "Exclude accessories" }, 
      desc: { ru: "ID устройств и/или сервисов через запятую, которые не будут отключаться (130, 188.15, \"200.13\")", en: "Device and service IDs separated by commas, which will not be turned off (130, 188.15, \"200.13\")" } 
    },

    // Дополнительные устройства для отключения
    turnOffAdditionalDevices: { 
      type: "String", 
      value: "",
      maxLength: 500,
      name: { ru: "Выключить так же", en: "Turn off additional" }, 
      desc: { ru: "ID устройств и сервисов через запятую для отключения любых типов устройств (130, 188.15, \"200.13\"). Поддерживаемые сервисы: Выключатель, Лампочка, Розетка, Вентилятор, Очиститель воздуха, Нагреватель, Увлажнитель, Термостат, Дверь, Кран, Полив, Кран, Штора, Динамик, Микрофон, ТВ динамик и т.д.", en: "Device and service IDs separated by commas to turn off any type of devices (130, 188.15, \"200.13\"). Supported services: Switch, Lightbulb, Outlet, FanBasic, AirPurifier, HeaterCooler, HumidifierDehumidifier, Thermostat, Door, Faucet, IrrigationSystem, Valve, WindowCovering, Speaker, Microphone, TelevisionSpeaker, etc." } 
    },

    // Отладка
    turnOffLightDebug: { 
      type: "Boolean", 
      value: false,
      name: { ru: "Отладка", en: "Debug" }, 
      desc: { ru: "Активация дополнительного логгирования для отладки", en: "Enable additional logging for debugging" } 
    }
  },

  variables: {
    // Переменные для хранения состояния (при необходимости)
  }
}

/**
 * Коллбек функция, которая вызывается при изменении характеристики, на которую подписан сценарий.
 * Вызывается после выполнения функции compute и фактической установки значения в хабе.
 * Работает ассинхронно.
 * Является главной функцией и точкой входа в сценарии.
 * @param {Characteristic} source - Характеристика, изменение значения которой вызвало вызов функции
 * @param {*} value - Новое значение характеристики
 * @param {Object} variables - Объект с переменными сценария из поля variables блока info. Значения доступны только в рамках этого сценария, можно писать и читать, сбрасываются при перезагрузке хаба.
 * @param {Object} options - Объект с опциями сценария из поля options блока info. Только для чтения.
 * @param {Object} context - Контекст изменения характеристики. Содержит информацию о том, что вызвало вызов функции
 */
function trigger(source, value, variables, options, context) {
  let service = source.getService(); // Получение сервиса, к которому привязана характеристика
  let accessory = service.getAccessory(); // Получение аксессуара
  let serviceType = service.getType(); // Получение типа сервиса
  let characteristicType = source.getType(); // Получение типа характеристики

  // Проверяем, что это включение выключателя или нажатие кнопки
  let shouldTrigger = false;
  
  if (serviceType === HS.Switch && characteristicType === HC.On && value === true) {
    shouldTrigger = true;
  } else if (serviceType === HS.StatelessProgrammableSwitch && characteristicType === HC.ProgrammableSwitchEvent && value === 0) {
    shouldTrigger = true;
  }

  if (!shouldTrigger) {
    return;
  }

  if (options.turnOffLightDebug) {
    console.info("TurnOffAllLight Logic triggered by:", accessory.getName(), "Service:", serviceType, "Characteristic:", characteristicType, "Value:", value);
  }

  // Выполняем отключение света
  turnOffLightLogic(options, variables);
}

/**
 * Основная функция отключения света с логикой из глобального сценария
 * @param {Object} options - Опции сценария
 * @param {Object} variables - Переменные сценария
 */
function turnOffLightLogic(options, variables) {
  var excRooms = []
  var excAccessories = []
  var excServices = []

  // Парсим исключения комнат
  if (options.excludeRoomsNames && options.excludeRoomsNames.trim()) {
    excRooms = options.excludeRoomsNames.split(',').map(function(room) { 
      return room.trim(); 
    });
  }

  // Парсим исключения аксессуаров и сервисов
  if (options.excludeAccessoriesId && options.excludeAccessoriesId.trim()) {
    var exclusions = parseExclusionsFromString(options.excludeAccessoriesId);
    excAccessories = exclusions.excAccessories;
    excServices = exclusions.excServices;
  }

  // Парсим дополнительные устройства для отключения
  var additionalDevices = [];
  if (options.turnOffAdditionalDevices && options.turnOffAdditionalDevices.trim()) {
    var additionalExclusions = parseExclusionsFromString(options.turnOffAdditionalDevices);
    additionalDevices = additionalExclusions.excAccessories.concat(additionalExclusions.excServices);
  }

  if (options.turnOffLightDebug) {
    console.info("Exclude Rooms:", excRooms.join("-"));
    console.info("Exclude Accessories:", excAccessories.join("-"));
    console.info("Exclude Services:", excServices.join("-"));
    console.info("Additional Devices:", additionalDevices.join("-"));
  }
  
  const rooms = Hub.getRooms().filter(function(room) { 
    return excRooms.indexOf(room.getName()) < 0; 
  });

  rooms.forEach(function(room) {
    var accessories = room.getAccessories().filter(function(accessory) { 
      return excAccessories.indexOf(parseInt(accessory.getUUID())) < 0; 
    });
    
    accessories.forEach(function(accessory) {
      var status = accessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue();
      if (accessory.getModelId() == "Sprut.hub" || status == false) return

      accessory.getServices().forEach(function(service) {
        var serviceType = service.getType();
        var shouldProcess = false;
        
        // Проверяем тип сервиса и соответствующие опции
        if (serviceType == HS.Lightbulb && options.turnOffLightbulbs) {
          shouldProcess = true;
        } else if (serviceType == HS.Switch && options.turnOffSwitches) {
          shouldProcess = true;
        } else if (serviceType == HS.Outlet && options.turnOffOutlets) {
          shouldProcess = true;
        }
        
        if (shouldProcess) {
          // Проверяем, не исключен ли конкретный сервис
          var serviceId = accessory.getUUID() + "." + service.getUUID();
          if (excServices.indexOf(serviceId) >= 0) {
            if (options.turnOffLightDebug) {
              console.info("Service", serviceId, "is excluded");
            }
            return;
          }
          
          var on = service.getCharacteristic(HC.On)
          if ((service.isVisible() || options.turnOffHidden) && on.getValue()) {
            if (options.turnOffLightDebug) {
              console.info("Room:", room.getName(), "Accessory:", accessory.getName(), "Service:", serviceId, service.getName(), "(Type:", serviceType + ")");
            }
            on.setValue(false)
          }
        }
      })
    })
  })

  // Обрабатываем дополнительные устройства для отключения
  if (additionalDevices.length > 0) {
    turnOffAdditionalDevices(additionalDevices, options);
  }
}

/**
 * Парсит строку с идентификаторами исключений в различных форматах
 * Поддерживает:
 * - Целые числа: 130, 188
 * - Строки: "130", "188"
 * - Дробные числа: 130.13, "130.13" (аксессуар.сервис)
 * - Массивы: 130, "188", 200.15, "300.20"
 * @param {string} value - Строка для парсинга
 * @returns {Object} Объект с массивами excAccessories и excServices
 */
function parseExclusionsFromString(value) {
  var excAccessories = [];
  var excServices = [];
  
  if (!value || !value.trim()) {
    return { excAccessories: excAccessories, excServices: excServices };
  }
  
  // Разделяем по запятым и очищаем от пробелов
  var items = value.split(',').map(function(item) { 
    return item.trim(); 
  });
  
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
 * @param {string} item - Элемент для парсинга
 * @returns {Object} Объект с accessoryId и serviceId
 */
function parseExclusionItem(item) {
  var accessoryId = null;
  var serviceId = null;
  
  // Убираем кавычки если есть
  item = item.replace(/^["']|["']$/g, '');
  
  if (item.includes('.')) {
    // Строка с точкой - аксессуар.сервис
    var parts = item.split('.');
    accessoryId = parseInt(parts[0]);
    serviceId = parts[1] ? parts[1] : null;
  } else {
    // Строка без точки - только аксессуар
    accessoryId = parseInt(item);
  }
  
  return { accessoryId: accessoryId, serviceId: serviceId };
}

/**
 * Отключает дополнительные устройства по их идентификаторам
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
 * @param {Object} options - Опции сценария
 */
function turnOffAdditionalDevices(additionalDevices, options) {
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
            turnOffService(service, options);
          } else if (options.turnOffLightDebug) {
            console.warn("Service not found:", serviceId, "in accessory:", accessoryId);
          }
        } else if (options.turnOffLightDebug) {
          console.warn("Accessory not found:", accessoryId);
        }
      } else {
        // Это аксессуар целиком
        var accessoryId = parseInt(deviceId);
        var accessory = Hub.getAccessory(accessoryId);
        if (accessory) {
          var services = accessory.getServices();
          services.forEach(function(service) {
            turnOffService(service, options);
          });
        } else if (options.turnOffLightDebug) {
          console.warn("Accessory not found:", accessoryId);
        }
      }
    } catch (e) {
      if (options.turnOffLightDebug) {
        console.error("Error processing device:", deviceId, "Error:", e.message);
      }
    }
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
 * @param {Object} options - Опции сценария
 */
function turnOffService(service, options) {
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
          
          if (options.turnOffLightDebug) {
            console.info("Turned off", charConfig.name, "in", accessory.getName(), "service", service.getName(), "from", currentValue, "to", charConfig.value);
          }
        }
      }
    } catch (e) {
      // Игнорируем ошибки для характеристик, которые не поддерживаются сервисом
      if (options.turnOffLightDebug) {
        console.debug("Characteristic", charConfig.name, "not supported in service", service.getName());
      }
    }
  });

  if (options.turnOffLightDebug && turnedOffCount > 0) {
    console.info("Turned off", turnedOffCount, "characteristics in", accessory.getName(), "service", service.getName());
  }
}

