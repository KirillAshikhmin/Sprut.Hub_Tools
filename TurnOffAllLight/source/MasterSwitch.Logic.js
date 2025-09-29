// Выносим название и описание в переменные для использования в info и options
let scenarioName = {
  ru: "Мастер-выключатель",
  en: "Master switch"
};

let scenarioDescription = {
  ru: "Логический сценарий для реализации мастер-выключателя. При запуске сценария отключаются все устройства в доме или выбранной комнате. Работает в паре с глобальным сценарием, который так же должен быть установлен. Поддерживает различные типы устройств: лампы, выключатели, розетки, вентиляторы, очистители воздуха, термостаты и другие. Имеет функции отложенного выключения, последовательного выключения с настраиваемым интервалом, исключения устройств и комнат, а также повторную проверку выключения.",
  en: "Logical scenario for implementing a master switch. When triggered, turns off all devices in the house or selected room. Works in conjunction with the global scenario, which must be installed in the system. Supports various device types: lightbulbs, switches, outlets, fans, air purifiers, thermostats and others. Includes delayed turn-off, sequential turn-off with configurable intervals, device and room exclusions, and turn-off verification."
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
  sourceServices: [HS.Switch, HS.StatelessProgrammableSwitch, HS.C_PulseMeter, HS.ContactSensor], // Список устройств, на изменение характеристик которых будет реагировать сценарий
  sourceCharacteristics: [HC.On, HC.ProgrammableSwitchEvent, HC.C_PulseCount, HC.ContactSensorState], // Список характеристик, на изменение которых будет реагировать сценарий

  // Опции для сценария. Отображаются в интерфейсе хаба в настройках логики для каждого устройства. 
  // У каждого устройства опции индивидуальные.
  options: {
    desc: {
      name: {
        en: "DESCRIPTION",
        ru: "ОПИСАНИЕ"
      },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },

    // Реагировать на одиночное нажатие кнопки
    singlePress: {
      type: "Boolean",
      value: false,
      name: { ru: "Одиночное нажатие", en: "Single press" },
      desc: { ru: "Реагировать на одиночное нажатие кнопки", en: "React to single button press" }
    },

    // Реагировать на двойное нажатие кнопки
    doublePress: {
      type: "Boolean",
      value: false,
      name: { ru: "Двойное нажатие", en: "Double press" },
      desc: { ru: "Реагировать на двойное нажатие кнопки", en: "React to double button press" }
    },

    // Реагировать на долгое нажатие кнопки
    longPress: {
      type: "Boolean",
      value: false,
      name: { ru: "Долгое нажатие", en: "Long press" },
      desc: { ru: "Реагировать на долгое нажатие кнопки", en: "React to long button press" }
    },

    // Отключать лампочки
    lightbulbs: {
      type: "Boolean",
      value: true,
      name: { ru: "Отключать лампочки", en: "Turn off lightbulbs" }
    },

    // Отключать выключатели
    switches: {
      type: "Boolean",
      value: true,
      name: { ru: "Отключать выключатели", en: "Turn off switches" }
    },

    // Отключать розетки
    outlets: {
      type: "Boolean",
      value: false,
      name: { ru: "Отключать розетки", en: "Turn off outlets" }
    },

    // Отключать скрытые устройства
    hidden: {
      type: "Boolean",
      value: false,
      name: { ru: "Отключать скрытые устройства", en: "Turn off hidden devices" }
    },

    // Выбор комнаты для выключения
    roomName: {
      type: "String",
      value: "",
      formType: "list",
      values: getRoomsList(),
      name: { ru: "🏠 Комната", en: "🏠 Room" },
      desc: { ru: "Выберите комнату для выключения устройств.", en: "Select room for turning off devices." }
    },

    // Исключения комнат
    excludeRoomsNames: {
      type: "String",
      value: "",
      maxLength: 500,
      name: { ru: "Комнаты исключения", en: "Exclude rooms" },
      desc: { ru: "Названия комнат через запятую, где не надо выключать устройства", en: "Room names separated by commas where devices should not be turned off" }
    },

    // Исключения аксессуаров и сервисов
    excludeAccessoriesId: {
      type: "String",
      value: "",
      maxLength: 500,
      name: { ru: "Устройства исключения", en: "Exclude accessories" },
      desc: { ru: "ID устройств и/или сервисов через запятую, которые не будут отключаться. Формат: (130, 188.15, \"200.13\")", en: "Device and service IDs separated by commas, which will not be turned off. Format: (130, 188.15, \"200.13\")" }
    },

    // Дополнительные устройства для отключения
    additionalDevices: {
      type: "String",
      value: "",
      maxLength: 500,
      name: { ru: "Выключить так же", en: "Turn off additional" },
      desc: { ru: "ID устройств и сервисов через запятую для отключения любых типов устройств. Поддерживаемые сервисы: Выключатель, Лампочка, Розетка, Вентилятор, Очиститель воздуха, Нагреватель, Увлажнитель, Термостат, Дверь, Кран, Полив, Штора, Динамик, Микрофон, ТВ динамик и т.д. Формат: (130, 188.15, \"200.13\")", en: "Device and service IDs separated by commas to turn off any type of devices (130, 188.15, \"200.13\"). Supported services: Switch, Lightbulb, Outlet, FanBasic, AirPurifier, HeaterCooler, HumidifierDehumidifier, Thermostat, Door, Faucet, IrrigationSystem, Valve, WindowCovering, Speaker, Microphone, TelevisionSpeaker, etc." }
    },

    // Интервал выключения устройств
    interval: {
      type: "Integer",
      value: 0,
      minValue: 0,
      maxValue: 60000,
      step: 100,
      name: { ru: "Выключать по очереди", en: "Turn off sequentially" },
      desc: { ru: "Интервал выключения устройств в миллисекундах (0 = одновременно, >0 = по очереди с указанной задержкой)", en: "Device turn-off interval in milliseconds (0 = simultaneously, >0 = sequentially with specified delay)" }
    },

    // Порядок выключения
    turnOffOrder: {
      type: "String",
      value: "",
      maxLength: 500,
      name: { ru: "Порядок выключения", en: "Turn off order" },
      desc: { ru: "ID устройств и сервисов через запятую в порядке выключения. Приоритетные устройства выключаются первыми в указанном порядке. Не указанные устройства выключаются после них. Формат: (130, 188.15, \"200.13\")", en: "Device and service IDs separated by commas in turn-off order (42, 123.15, \"200.13\"). Priority devices are turned off first in the specified order. Unspecified devices are turned off after them." }
    },

    // Повторять выключение
    verifyTurnOff: {
      type: "Boolean",
      value: true,
      name: { ru: "Повторять выключение", en: "Repeat turn off" },
      desc: { ru: "Повторять выключение через 5 секунд при необходимости", en: "Repeat turn off after 5 seconds if necessary" }
    },

    // Не отключать сразу
    delayedDevices: {
      type: "String",
      value: "",
      maxLength: 500,
      name: { ru: "Не отключать сразу", en: "Delayed turn off" },
      desc: { ru: "ID аксессуаров и сервисов через запятую, которые не выключаются сразу, а через указанное время. Например свет в коридоре. Формат: (130, 188.15, \"200.13\")", en: "Device and service IDs separated by commas that will not be turned off immediately, but after specified time. For example, corridor lights. Format: (130, 188.15, \"200.13\")" }
    },

    // Отключить через
    delayedTurnOffTime: {
      type: "Integer",
      value: 0,
      minValue: 0,
      maxValue: 300000,
      step: 1000,
      name: { ru: "Отключить через (мс)", en: "Turn off after (ms)" },
      desc: { ru: "Время в миллисекундах, через которое выключить устройства из поля выше (0 = не использовать отложенное выключение)", en: "Time in milliseconds after which to turn off devices from the field above (0 = do not use delayed turn off)" }
    },

    // Отладка
    debug: {
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


function trigger(source, value, variables, options, context) {
  let service = source.getService(); // Получение сервиса, к которому привязана характеристика
  let accessory = service.getAccessory(); // Получение аксессуара
  let serviceType = service.getType(); // Получение типа сервиса
  let characteristicType = source.getType(); // Получение типа характеристики

  // Проверяем, что это включение выключателя, нажатие кнопки, счётчик импульсов или датчик касания
  let shouldTrigger = false;

  if (serviceType === HS.Switch && characteristicType === HC.On && value === true) {
    shouldTrigger = true;
  } else if (serviceType === HS.StatelessProgrammableSwitch && characteristicType === HC.ProgrammableSwitchEvent) {
    // Проверяем тип нажатия кнопки и соответствующие опции
    if (value === 0 && options.singlePress) {
      shouldTrigger = true; // Одиночное нажатие
    } else if (value === 1 && options.doublePress) {
      shouldTrigger = true; // Двойное нажатие
    } else if (value === 2 && options.longPress) {
      shouldTrigger = true; // Долгое нажатие
    }
  } else if (serviceType === HS.C_PulseMeter && characteristicType === HC.C_PulseCount && value > 0) {
    shouldTrigger = true; // Счётчик импульсов
  } else if (serviceType === HS.ContactSensor && characteristicType === HC.ContactSensorState && value === 1) {
    shouldTrigger = true; // Датчик касания
  }

  if (!shouldTrigger) {
    return;
  }

  if (options.debug) {
    console.info("Мастер-выключатель сработал от:", accessory.getName(), "Сервис:", serviceType, "Характеристика:", characteristicType, "Значение:", value);
  }

  // Преобразуем строки в массивы для передачи в глобальный сценарий
  var excRooms = parseStringToArray(options.excludeRoomsNames);
  var excAccessories = parseStringToArray(options.excludeAccessoriesId);
  var additionalDevices = parseStringToArray(options.additionalDevices);
  var turnOffOrder = parseStringToArray(options.turnOffOrder);
  var delayedDevices = parseStringToArray(options.delayedDevices);

  // Обрабатываем выбранную комнату
  var selectedRooms = [];
  if (options.roomName && typeof options.roomName === 'string' && options.roomName.trim()) {
    selectedRooms = [options.roomName.trim()];
  }

  // Валидация параметров
  if (options.interval && (typeof options.interval !== 'number' || options.interval < 0 || options.interval > 60000)) {
    console.warn("Мастер-выключатель: некорректный интервал, используется значение по умолчанию (0)");
    options.interval = 0;
  }

  // Валидация времени отложенного выключения
  if (options.delayedTurnOffTime && (typeof options.delayedTurnOffTime !== 'number' || options.delayedTurnOffTime < 0 || options.delayedTurnOffTime > 300000)) {
    console.warn("Мастер-выключатель: некорректное время отложенного выключения, используется значение по умолчанию (0)");
    options.delayedTurnOffTime = 0;
  }

  if (options.debug) {
    console.info("Выбранная комната:", selectedRooms.length > 0 ? selectedRooms.join("-") : "Весь дом");
    console.info("Исключаемые комнаты:", excRooms.join("-"));
    console.info("Исключаемые устройства:", excAccessories.join("-"));
    console.info("Дополнительные устройства:", additionalDevices.join("-"));
    console.info("Порядок выключения:", turnOffOrder.join("-"));
    console.info("Отложенные устройства:", delayedDevices.join("-"));
    console.info("Время отложенного выключения:", options.delayedTurnOffTime + "мс");
  }

  // Вызываем глобальный сценарий с обработанными параметрами
  try {
    if (typeof global.masterSwitch !== 'function') {
      console.error("Мастер-выключатель: глобальная функция masterSwitch не найдена");
      return;
    }

    global.masterSwitch({
      rooms: selectedRooms,
      excludeRooms: excRooms,
      excludeAccessories: excAccessories,
      additionalDevices: additionalDevices,
      lightbulbs: options.lightbulbs,
      switches: options.switches,
      outlets: options.outlets,
      hidden: options.hidden,
      interval: options.interval,
      turnOffOrder: turnOffOrder,
      verifyTurnOff: options.verifyTurnOff,
      delayedDevices: delayedDevices,
      delayedTurnOffTime: options.delayedTurnOffTime,
      debug: options.debug
    });
  } catch (error) {
    console.error("Мастер-выключатель: ошибка при вызове глобальной функции:", error.message);
    if (options.debug) {
      console.error("Детали ошибки:", error);
    }
  }
}

/**
 * Парсит строку в массив, удаляя пустые элементы и дубликаты
 * @param {string} str - Строка для парсинга
 * @returns {Array} Массив элементов
 */
function parseStringToArray(str) {
  if (!str || typeof str !== 'string' || !str.trim()) {
    return [];
  }

  var items = str.split(',').map(function (item) {
    return item.trim();
  }).filter(function (item) {
    return item.length > 0; // Удаляем пустые элементы
  });

  // Удаляем дубликаты
  return items.filter(function (item, index) {
    return items.indexOf(item) === index;
  });
}

function getRoomsList() {
  let roomsList = [];
  roomsList.push({ name: { ru: "🏠 Весь дом", en: "🏠 Whole house" }, value: "" });

  const rooms = Hub.getRooms();
  rooms.forEach(room => {
    roomsList.push({
      name: { ru: room.getName(), en: room.getName() },
      value: room.getName()
    });
  });

  return roomsList;
}
