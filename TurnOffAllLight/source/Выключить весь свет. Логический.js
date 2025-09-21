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
    lightbulbs: {
      type: "Boolean",
      value: true,
      name: { ru: "Отключать лампочки", en: "Turn off lightbulbs" },
      desc: { ru: "Отключать лампочки", en: "Turn off lightbulbs" }
    },

    // Отключать выключатели
    switches: {
      type: "Boolean",
      value: true,
      name: { ru: "Отключать выключатели", en: "Turn off switches" },
      desc: { ru: "Отключать выключатели", en: "Turn off switches" }
    },

    // Отключать розетки
    outlets: {
      type: "Boolean",
      value: false,
      name: { ru: "Отключать розетки", en: "Turn off outlets" },
      desc: { ru: "Отключать розетки", en: "Turn off outlets" }
    },

    // Отключать скрытые устройства
    hidden: {
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
    additionalDevices: {
      type: "String",
      value: "",
      maxLength: 500,
      name: { ru: "Выключить так же", en: "Turn off additional" },
      desc: { ru: "ID устройств и сервисов через запятую для отключения любых типов устройств (130, 188.15, \"200.13\"). Поддерживаемые сервисы: Выключатель, Лампочка, Розетка, Вентилятор, Очиститель воздуха, Нагреватель, Увлажнитель, Термостат, Дверь, Кран, Полив, Кран, Штора, Динамик, Микрофон, ТВ динамик и т.д.", en: "Device and service IDs separated by commas to turn off any type of devices (130, 188.15, \"200.13\"). Supported services: Switch, Lightbulb, Outlet, FanBasic, AirPurifier, HeaterCooler, HumidifierDehumidifier, Thermostat, Door, Faucet, IrrigationSystem, Valve, WindowCovering, Speaker, Microphone, TelevisionSpeaker, etc." }
    },

    // Интервал выключения устройств
    interval: {
      type: "Integer",
      value: 0,
      minValue: 0,
      maxValue: 60000,
      step: 100,
      name: { ru: "Выключать по очереди", en: "Turn off sequentially" },
      desc: { ru: "Интервал выключения устройств в миллисекундах (0 = одновременно, >0 = по очереди с задержкой)", en: "Device turn-off interval in milliseconds (0 = simultaneously, >0 = sequentially with delay)" }
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

  if (options.debug) {
    console.info("Логика выключения света сработала от:", accessory.getName(), "Сервис:", serviceType, "Характеристика:", characteristicType, "Значение:", value);
  }

  // Преобразуем строки в массивы для передачи в глобальный сценарий
  var excRooms = [];
  if (options.excludeRoomsNames && options.excludeRoomsNames.trim()) {
    excRooms = options.excludeRoomsNames.split(',').map(function (room) {
      return room.trim();
    });
  }

  var excAccessories = [];
  if (options.excludeAccessoriesId && options.excludeAccessoriesId.trim()) {
    excAccessories = options.excludeAccessoriesId.split(',').map(function (item) {
      return item.trim();
    });
  }

  var additionalDevices = [];
  if (options.additionalDevices && options.additionalDevices.trim()) {
    additionalDevices = options.additionalDevices.split(',').map(function (item) {
      return item.trim();
    });
  }

  if (options.debug) {
    console.info("Исключаемые комнаты:", excRooms.join("-"));
    console.info("Исключаемые устройства:", excAccessories.join("-"));
    console.info("Дополнительные устройства:", additionalDevices.join("-"));
  }

  // Вызываем глобальный сценарий с обработанными параметрами
  global.turnAllOff({
    excludeRooms: excRooms,
    excludeAccessories: excAccessories,
    additionalDevices: additionalDevices,
    lightbulbs: options.lightbulbs,
    switches: options.switches,
    outlets: options.outlets,
    hidden: options.hidden,
    interval: options.interval,
    debug: options.debug
  });
}
