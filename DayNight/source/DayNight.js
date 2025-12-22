// Выносим название и описание в переменные для использования в info
const scenarioName = {
  ru: "🌅 День-Ночь",
  en: "🌅 Day-Night"
};

const scenarioDescription = {
  ru: "Логический сценарий, который автоматически включает и отключает выключатель на основе времени восхода и заката солнца по указанным координатам, или по конкретному времени. Корректно обрабатывает полярный день и полярную ночь.\n\nНе зависит от состояния хаба в момент восхода и заката.\n\nКоординаты можно взять в настройках хаба в разделе Дата и время. Если планируется использовать сценарий на нескольких устрйоствах - координаты можно указать в коде сценария в разделе с константами.",
  en: "Logical scenario that automatically turns on and off a switch based on sunrise and sunset times for specified coordinates, or at specific times. Correctly handles polar day and polar night.\n\nIndependent of the hub state at sunrise and sunset.\n\nCoordinates can be found in hub settings under Date & Time. If you plan to use the scenario on multiple devices, coordinates can be specified in the scenario code in the constants section."
};

// Константы для координат по умолчанию (Москва)
const DEFAULT_COORDINATES = {
  LATITUDE: 55.7558,   // Широта Москвы
  LONGITUDE: 37.6173,  // Долгота Москвы
  ELEVATION: 156       // Высота над уровнем моря в метрах (Москва)
};

info = {
  name: scenarioName.ru,
  description: scenarioDescription.ru,
  version: "1.2",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [
    HS.Switch, HS.Outlet, HS.Fan, HS.FanBasic, HS.Lightbulb,
    HS.Faucet, HS.C_PetFeeder, HS.Valve, HS.HeaterCooler, HS.AirPurifier,
    HS.IrrigationSystem, HS.Television, HS.HumidifierDehumidifier, HS.CameraControl
  ],
  sourceCharacteristics: [HC.On, HC.Active],
  options: {
    desc: {
      name: { en: "", ru: "" },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },
    html: {
      name: { en: "", ru: "" },
      type: "String",
      value: "Обновления и новости: <ul><li><a href='https://t.me/smart_sputnik' target='_blank'>Telegram-канале</a></li><li><a href='https://kirillashikhmin.github.io/sht/' target='_blank'>Cайте автора</a></li><li><a href='https://github.com/KirillAshikhmin/Sprut.Hub_Tools/' target='_blank'>GitHub</a></li></ul>",
      formType: "html"
    },
    latitude: {
      name: {
        en: "Latitude",
        ru: "Широта"
      },
      desc: {
        en: "Geographic latitude in decimal degrees (e.g., 55.7558 for Moscow). Required if fixed time is not specified.",
        ru: "Географическая широта в десятичных градусах (например, 55.7558 для Москвы). Обязательна, если не указано фиксированное время."
      },
      type: "Double",
      value: DEFAULT_COORDINATES.LATITUDE,
      minValue: -90,
      maxValue: 90
    },
    longitude: {
      name: {
        en: "Longitude",
        ru: "Долгота"
      },
      desc: {
        en: "Geographic longitude in decimal degrees (e.g., 37.6173 for Moscow). Required if fixed time is not specified.",
        ru: "Географическая долгота в десятичных градусах (например, 37.6173 для Москвы). Обязательна, если не указано фиксированное время."
      },
      type: "Double",
      value: DEFAULT_COORDINATES.LONGITUDE,
      minValue: -180,
      maxValue: 180,
    },
    elevation: {
      name: {
        en: "Elevation above sea level (meters)",
        ru: "Высота над уровнем моря (метры)"
      },
      desc: {
        en: "Affects the accuracy of sunrise/sunset calculations.",
        ru: "Влияет на точность расчета времени восхода и заката."
      },
      type: "Integer",
      value: DEFAULT_COORDINATES.ELEVATION,
      minValue: 0,
      maxValue: 8848,
      step: 1
    },
    sunriseOffset: {
      name: {
        en: "Before/after sunrise (minutes)",
        ru: "До/после рассвета (минуты)"
      },
      desc: {
        en: "Time offset in minutes from sunrise. Positive value - after sunrise, negative - before sunrise (e.g., 60 = 1 hour after, -60 = 1 hour before)",
        ru: "Смещение времени в минутах от времени восхода. Положительное значение - после восхода, отрицательное - до восхода (например, 60 = через час после восхода, -60 = за час до восхода)"
      },
      type: "Integer",
      value: 0,
      minValue: -1440,
      maxValue: 1440,
      step: 1
    },
    sunsetOffset: {
      name: {
        en: "Before/after sunset (minutes)",
        ru: "До/после заката (минуты)"
      },
      desc: {
        en: "Time offset in minutes from sunset. Positive value - after sunset, negative - before sunset (e.g., 60 = 1 hour after, -60 = 1 hour before)",
        ru: "Смещение времени в минутах от времени заката. Положительное значение - после заката, отрицательное - до заката (например, 60 = через час после заката, -60 = за час до заката)"
      },
      type: "Integer",
      value: 0,
      minValue: -1440,
      maxValue: 1440,
      step: 1
    },
    useCivilTwilight: {
      name: {
        en: "Civil twilight",
        ru: "Гражданские сумерки"
      },
      desc: {
        en: "If enabled, uses civil twilight times instead of sunrise/sunset. Civil twilight occurs when the sun is 6 degrees below the horizon. During this time, in clear weather, most outdoor activities can be performed, and the horizon line is clearly visible.",
        ru: "Если включено, используется время гражданских сумерек вместо времени рассвета/заката. Гражданские сумерки наступают, когда солнце находится на 6 градусов ниже горизонта. В это время при ясной погоде можно выполнять большинство работ, а линия горизонта прослеживается достаточно чётко."
      },
      type: "Boolean",
      value: false
    },
    fixedOnTime: {
      name: {
        en: "Fixed turn on time",
        ru: "Фиксированное время включения"
      },
      desc: {
        en: "Fixed time to turn on the switch (format: HH:MM or H:MM in 24-hour format). If specified, this time will be used instead of sunrise otherwise leave blank.",
        ru: "Фиксированное время включения выключателя (формат: ЧЧ:ММ в 24-часовом формате). Если указано, это время будет использоваться вместо времени восхода иначе оставьте пустым."
      },
      type: "String",
      value: ""
    },
    fixedOffTime: {
      name: {
        en: "Fixed turn off time",
        ru: "Фиксированное время отключения"
      },
      desc: {
        en: "Fixed time to turn off the switch (format: HH:MM or H:MM in 24-hour format). If specified, this time will be used instead of sunset otherwise leave blank.",
        ru: "Фиксированное время отключения выключателя (формат: ЧЧ:ММ в 24-часовом формате). Если указано, это время будет использоваться вместо времени заката иначе оставьте пустым."
      },
      type: "String",
      value: ""
    },
    allowManualControl: {
      name: {
        en: "Allow manual control",
        ru: "Возможность ручного управления"
      },
      desc: {
        en: "If enabled, the device state will only change at sunrise/sunset times (or fixed times) and at hub startup. If disabled, the device will restore day/night state on any change.",
        ru: "Если включено, то состояние устройства будет переключаться только во время рассвета и заката (или в фиксированное), а так же при запуске хаба. Если выключено, то при любом изменении устройство будет восстанавливать состояние день\\ночь."
      },
      type: "Boolean",
      value: false
    },
    changeServiceName: {
      name: {
        en: "Change service name",
        ru: "Менять имя сервиса"
      },
      desc: {
        en: "If enabled, the service name will change to show current state (Day or Night)",
        ru: "Если включено, имя сервиса будет меняться в зависимости от текущего состояния (День или Ночь)"
      },
      type: "Boolean",
      value: false
    },
    invert: {
      name: {
        en: "Invert",
        ru: "Инвертировать"
      },
      desc: {
        en: "If enabled, the switch will be turned off at sunrise time and turned on at sunset time",
        ru: "Если включено, выключатель будет отключаться во время восхода и включаться во время заката"
      },
      type: "Boolean",
      value: false
    }
  },
  variables: {
    initialState: undefined,
    turnOnTask: undefined,  // Cron задача для включения
    turnOffTask: undefined,  // Cron задача для отключения
    lastOnSchedule: undefined,  // Последнее расписание включения (для оптимизации)
    lastOffSchedule: undefined,  // Последнее расписание отключения (для оптимизации)
    polarCronTask: undefined,  // Cron задача для проверки окончания полярного дня/ночи
    lastPolarSchedule: undefined  // Последнее расписание полярной задачи (для оптимизации)
  }
}

// Константы для расчета времени восхода и заката
const SUN_CONSTANTS = {
  ZENITH: 90.833,  // Угол зенита для расчета восхода/заката (стандартный)
  CIVIL_TWILIGHT_ZENITH: 96,  // Угол зенита для расчета гражданских сумерек (90 + 6 градусов)
  MS_PER_MINUTE: 1000 * 60,
  MS_PER_HOUR: 1000 * 60 * 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DEG_TO_RAD: Math.PI / 180,
  RAD_TO_DEG: 180 / Math.PI,
  EARTH_RADIUS_KM: 6371  // Радиус Земли в километрах
};

// Константы для проверки контекста изменений
const CONTEXT_CONSTANTS = {
  DELIMITER: ' <- ',
  LOGIC_PREFIX: 'LOGIC',
  CHARACTERISTIC_PREFIX: 'C',
  MIN_ELEMENTS: 3
};

const DEBUG = false;  // Включить режим отладки
const LOG_PREFIX = scenarioName.ru + ". ";

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ - ТОЧКА ВХОДА
// ============================================================================
function trigger(source, value, variables, options, context) {
  // Проверяем, что изменение сделано не самим сценарием, чтобы избежать циклов
  if (isSelfChanged(context)) {
    return;
  }

  // Проверяем, что источник - это поддерживаемая характеристика
  if (source.getType() !== HC.On && source.getType() !== HC.Active) {
    return;
  }

  const needChangeState = !options.allowManualControl || !variables.initialState
  variables.initialState = true;

  // Если ручное управление разрешено или изменение автоматическое, обновляем состояние и настраиваем cron задачи
  updateDayNightStatus(source, variables, options, needChangeState);
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ СТАТУСА
// ============================================================================


function updateDayNightStatus(source, variables, options, needChangeState) {
  try {
    // Проверяем валидность опций при запуске
    if (!validateOptions(options)) {
      return;
    }

    // Получаем текущее время
    const now = new Date();

    // Проверяем, нужно ли вычислять время восхода/заката
    // Вычисляем, если хотя бы одно время не фиксированное
    const hasFixedOn = hasFixedTimeValue(options.fixedOnTime);
    const hasFixedOff = hasFixedTimeValue(options.fixedOffTime);
    const needSunTimes = !hasFixedOn || !hasFixedOff;

    let sunTimes = null;
    let coordinates = null;
    if (needSunTimes) {
      coordinates = getCoordinates(options);

      if (areCoordinatesValid(coordinates.latitude, coordinates.longitude)) {
        // Вычисляем оба времени сразу (один раз для обоих вызовов getTurnTime)
        sunTimes = calculateSunTimes(now, coordinates.latitude, coordinates.longitude, coordinates.elevation, options.useCivilTwilight);

        // Если полярный день или полярная ночь, устанавливаем соответствующее состояние
        if (sunTimes.status === "polarDay" || sunTimes.status === "polarNight") {
          handlePolarDayNight(source, variables, options, sunTimes.status, needChangeState);
          return;
        }
      }
    }

    // Вычисляем время включения и отключения
    // sunTimes уже вычислен один раз, если необходимо
    const turnOnTime = getTurnTime(now, options, true, sunTimes);
    const turnOffTime = getTurnTime(now, options, false, sunTimes);

    if (!turnOnTime || !turnOffTime) {
      logError("Не удалось вычислить время включения или отключения. Возможно, ошибка расчета.");
      // При ошибке расчета не меняем состояние и не создаем cron задачи
      return;
    }

    // Определяем текущее состояние выключателя
    const shouldBeOn = getCurrentState(now, turnOnTime, turnOffTime, options);

    // Устанавливаем состояние и обновляем имя сервиса
    if (needChangeState === true) setDeviceState(source, options, shouldBeOn);

    // Настраиваем cron задачи
    setupCronTasks(source, variables, options, turnOnTime, turnOffTime);

    // Логирование
    const onTimeStr = formatTime(turnOnTime);
    const offTimeStr = formatTime(turnOffTime);
    logInfo(`Время включения: ${onTimeStr}, отключения: ${offTimeStr}, целевое состояние: ${shouldBeOn ? "включен" : "отключен"}, изменить состояние: ${needChangeState}`);
  } catch (error) {
    logError("Ошибка при обновлении статуса день-ночь: " + error);
  }
}

/**
 * Проверяет, указано ли фиксированное время (не пустая строка)
 * @param {string} timeValue - значение времени из опций
 * @returns {boolean} true если время указано и не пустое
 */
function hasFixedTimeValue(timeValue) {
  return timeValue && timeValue.trim() !== "";
}

/**
 * Проверяет, указано ли фиксированное время (любое из двух)
 * @param {Object} options - опции сценария
 * @returns {boolean} true если указано хотя бы одно фиксированное время
 */
function hasFixedTime(options) {
  return hasFixedTimeValue(options.fixedOnTime) || hasFixedTimeValue(options.fixedOffTime);
}

/**
 * Извлекает координаты из опций
 * @param {Object} options - опции сценария
 * @returns {Object} объект с полями latitude, longitude, elevation
 */
function getCoordinates(options) {
  return {
    latitude: options.latitude,
    longitude: options.longitude,
    elevation: options.elevation !== undefined ? options.elevation : 0
  };
}

/**
 * Проверяет валидность координат
 * @param {number} latitude - широта
 * @param {number} longitude - долгота
 * @returns {boolean} true если координаты валидны
 */
function areCoordinatesValid(latitude, longitude) {
  return isValidCoordinate(latitude, -90, 90, "Широта") && isValidCoordinate(longitude, -180, 180, "Долгота");
}

/**
 * Проверяет валидность опций сценария
 * @param {Object} options - опции сценария
 * @returns {boolean} true если опции валидны
 */
function validateOptions(options) {
  const hasFixed = hasFixedTime(options);
  const hasCoordinates = areCoordinatesValid(options.latitude, options.longitude);

  if (!hasFixed && !hasCoordinates) {
    logError("Необходимо указать либо координаты, либо фиксированное время включения/отключения");
    return false;
  }

  return true;
}

/**
 * Нормализует время относительно текущей даты
 * Если время уже прошло сегодня, возвращает время на сегодня (для корректного определения состояния)
 * Если нужно время для cron задачи, переносит на завтра
 * @param {Date} baseDate - базовая дата
 * @param {Date} targetTime - целевое время
 * @param {boolean} forCron - если true, переносит на завтра если время прошло
 * @returns {Date} нормализованное время
 */
function normalizeTime(baseDate, targetTime, forCron) {
  const result = new Date(targetTime);
  result.setFullYear(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  // Если время уже прошло и это для cron задачи, переносим на завтра
  if (forCron && result.getTime() <= baseDate.getTime()) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Вычисляет время включения или отключения выключателя
 * @param {Date} date - дата для расчета
 * @param {Object} options - опции сценария
 * @param {boolean} isTurnOn - true для включения, false для отключения
 * @param {Object|null} sunTimes - результат calculateSunTimes (должен быть вычислен заранее, если используется время восхода/заката)
 * @returns {Date|null} время включения/отключения или null при ошибке
 */
function getTurnTime(date, options, isTurnOn, sunTimes) {
  const fixedTimeKey = isTurnOn ? 'fixedOnTime' : 'fixedOffTime';
  const offsetKey = isTurnOn ? 'sunriseOffset' : 'sunsetOffset';

  // Если указано фиксированное время, используем его
  if (options[fixedTimeKey] && options[fixedTimeKey].trim() !== "") {
    const fixedTime = parseTimeString(options[fixedTimeKey]);
    if (fixedTime) {
      const result = new Date(date);
      result.setHours(fixedTime.hours, fixedTime.minutes, 0, 0);
      return normalizeTime(date, result, false);
    }
  }

  // Иначе используем время восхода/заката (или гражданских сумерек) с учетом оффсета
  // sunTimes должен быть передан из updateDayNightStatus
  if (!sunTimes) {
    return null;
  }

  if (sunTimes.status !== "normal") {
    return null;
  }

  const sunTime = isTurnOn ? sunTimes.sunrise : sunTimes.sunset;
  if (!sunTime) {
    return null;
  }

  const offset = options[offsetKey] !== undefined ? options[offsetKey] : 0;
  // Добавляем оффсет
  const result = new Date(sunTime.getTime() + offset * SUN_CONSTANTS.MS_PER_MINUTE);
  return normalizeTime(date, result, false);
}


/**
 * Определяет текущее состояние выключателя
 * Использует полное сравнение Date для корректной работы при переходе через полночь
 * @param {Date} now - текущее время
 * @param {Date} turnOnTime - время включения
 * @param {Date} turnOffTime - время отключения
 * @param {Object} options - опции сценария
 * @returns {boolean} true если выключатель должен быть включен
 */
function getCurrentState(now, turnOnTime, turnOffTime, options) {
  // Нормализуем время включения и отключения относительно текущей даты
  const normalizedOnTime = normalizeTime(now, turnOnTime, false);
  const normalizedOffTime = normalizeTime(now, turnOffTime, false);

  // Извлекаем время в минутах от начала дня для сравнения
  const nowMinutes = now.getHours() * SUN_CONSTANTS.MINUTES_PER_HOUR + now.getMinutes();
  const onMinutes = normalizedOnTime.getHours() * SUN_CONSTANTS.MINUTES_PER_HOUR + normalizedOnTime.getMinutes();
  const offMinutes = normalizedOffTime.getHours() * SUN_CONSTANTS.MINUTES_PER_HOUR + normalizedOffTime.getMinutes();

  // Если время включения равно времени отключения, выключатель всегда отключен
  if (onMinutes === offMinutes) {
    return false; // Всегда отключен, независимо от invert
  }

  // Если время включения меньше времени отключения (обычный случай: включение утром, отключение вечером)
  if (onMinutes < offMinutes) {
    return nowMinutes >= onMinutes && nowMinutes < offMinutes;
  }

  // Если время включения больше времени отключения (включение вечером, отключение утром)
  // Это означает, что включение происходит сегодня вечером, а отключение - завтра утром
  // Проверяем: либо текущее время >= времени включения (вечер сегодня), либо < времени отключения (утро завтра)
  return nowMinutes >= onMinutes || nowMinutes < offMinutes;
}

// ============================================================================
// РАСЧЕТ ВРЕМЕНИ ВОСХОДА И ЗАКАТА
// ============================================================================

/**
 * Получает часовой пояс из системы
 * @returns {number} часовой пояс в часах (например, 3 для MSK UTC+3)
 */
function getTimezoneOffset() {
  try {
    // Получаем смещение в минутах и преобразуем в часы
    const offsetMinutes = new Date().getTimezoneOffset();
    // getTimezoneOffset возвращает отрицательное значение для положительных смещений
    // Например, для UTC+3 возвращает -180 минут
    const offsetHours = -offsetMinutes / 60;
    return offsetHours;
  } catch (error) {
    logError("Ошибка при получении часового пояса: " + error);
    // Возвращаем значение по умолчанию для Москвы (UTC+3)
    return 3;
  }
}

/**
 * Вычисляет номер дня в году (от 1 до 365/366)
 * @param {Date} date - дата
 * @returns {number} номер дня в году
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  const msPerDay = SUN_CONSTANTS.MS_PER_HOUR * SUN_CONSTANTS.HOURS_PER_DAY;
  return Math.floor(diffMs / msPerDay);
}

/**
 * Нормализует значение времени (если получилось отрицательное или больше 24, корректируем)
 * @param {number} timeValue - значение времени в часах
 * @returns {number} нормализованное значение времени
 */
function normalizeTimeValue(timeValue) {
  if (timeValue < 0) {
    return timeValue + 24;
  }
  if (timeValue >= 24) {
    return timeValue - 24;
  }
  return timeValue;
}

/**
 * Создает объект Date из нормализованного значения времени
 * @param {Date} baseDate - базовая дата (с установленным временем 00:00:00)
 * @param {number} normalizedTime - нормализованное значение времени в часах
 * @returns {Date} объект Date с установленным временем
 */
function createTimeFromNormalized(baseDate, normalizedTime) {
  const hours = Math.floor(normalizedTime);
  const fractionalHours = normalizedTime - hours;
  const minutes = Math.floor(fractionalHours * 60);
  const fractionalMinutes = fractionalHours * 60 - minutes;
  const seconds = Math.round(fractionalMinutes * 60);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, seconds, 0);
  return result;
}

/**
 * Устанавливает значение устройства с учетом инверсии
 * @param {Object} source - источник события (характеристика)
 * @param {boolean} value - значение для установки
 * @param {boolean} invert - нужно ли инвертировать значение
 * @returns {boolean} true если значение было изменено
 */
function setDeviceValue(source, value, invert) {
  if (invert) value = !value;
  if (source.getType() === HC.On) {
    if (source.getValue() != value) {
      source.setValue(value);
      return true;
    }
  } else if (source.getType() === HC.Active) {
    let newValue = value ? 1 : 0;
    if (source.getValue() != newValue) {
      source.setValue(newValue);
      return true;
    }
  }
  return false;
}

/**
 * Устанавливает состояние устройства с учетом опции invert и обновляет имя сервиса
 * @param {Object} source - источник события (характеристика)
 * @param {Object} options - опции сценария
 * @param {boolean} shouldBeOn - должно ли устройство быть включено
 */
function setDeviceState(source, options, shouldBeOn) {
  setDeviceValue(source, shouldBeOn, options.invert === true);
  updateServiceName(source, options, shouldBeOn);
}

/**
 * Обрабатывает полярный день или полярную ночь
 * @param {Object} source - источник события (характеристика)
 * @param {Object} variables - переменные сценария
 * @param {Object} options - опции сценария
 * @param {string} polarStatus - "polarDay" для полярного дня, "polarNight" для полярной ночи
 */
function handlePolarDayNight(source, variables, options, polarStatus, needChangeState) {
  const isPolarDay = polarStatus === "polarDay";
  // Полярный день - выключатель всегда включен (день)
  // Полярная ночь - выключатель всегда отключен (ночь)
  const shouldBeOn = isPolarDay;

  // Устанавливаем состояние и обновляем имя сервиса
  if (needChangeState === true) setDeviceState(source, options, shouldBeOn);

  // Настраиваем cron задачу на полночь для проверки окончания полярного периода
  const polarSchedule = "0 0 0 * * *";
  variables.polarCronTask = setupSingleCronTask(
    polarSchedule,
    variables.lastPolarSchedule,
    variables.polarCronTask,
    source,
    variables,
    options,
    "проверки окончания полярного дня/ночи"
  );
  variables.lastPolarSchedule = polarSchedule;

  const statusText = isPolarDay ? "день" : "ночь";
  const stateText = shouldBeOn ? "включен (день)" : "отключен (ночь)";
  logInfo("Полярный " + statusText + ": выключатель " + stateText);
}

/**
 * Вычисляет время восхода и заката солнца для указанной даты и координат
 * Использует точный алгоритм с учетом высоты над уровнем моря
 * @param {Date} date - дата
 * @param {number} latitude - широта в градусах
 * @param {number} longitude - долгота в градусах
 * @param {number} elevation - высота над уровнем моря в метрах
 * @param {boolean} useCivilTwilight - использовать гражданские сумерки вместо восхода/заката
 * @returns {Object} объект с полями:
 *   status: "normal" | "polarDay" | "polarNight"
 *   sunrise: Date | null - время восхода/начала гражданских сумерек
 *   sunset: Date | null - время заката/окончания гражданских сумерек
 */
function calculateSunTimes(date, latitude, longitude, elevation, useCivilTwilight) {
  try {
    const rad = SUN_CONSTANTS.DEG_TO_RAD;
    const latRad = latitude * rad;

    // Вычисляем номер дня в году
    const dayOfYear = getDayOfYear(date);

    // Вычисляем деклинацию солнца
    const declination = 23.45 * rad * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);

    // Вычисляем уравнение времени
    const B = 2 * Math.PI * (dayOfYear - 81) / 365;
    const equation = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

    // Вычисляем рефракцию с учетом высоты над уровнем моря
    const refraction = Math.acos(SUN_CONSTANTS.EARTH_RADIUS_KM / (SUN_CONSTANTS.EARTH_RADIUS_KM + elevation / 1000)) * SUN_CONSTANTS.RAD_TO_DEG;

    // Выбираем угол зенита в зависимости от режима
    const zenith = useCivilTwilight ? SUN_CONSTANTS.CIVIL_TWILIGHT_ZENITH : SUN_CONSTANTS.ZENITH;
    
    // Вычисляем часовой угол
    const zenithRad = zenith * rad;
    const cosHourAngle = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(declination)) /
      (Math.cos(latRad) * Math.cos(declination));

    // Проверка на полярный день/ночь
    if (cosHourAngle > 1) {
      return {
        status: "polarNight",
        sunrise: null,
        sunset: null
      };
    }
    if (cosHourAngle < -1) {
      return {
        status: "polarDay",
        sunrise: null,
        sunset: null
      };
    }

    // Вычисляем часовой угол в градусах и вычитаем рефракцию
    const hourAngleRad = Math.acos(cosHourAngle);
    const hourAngle = hourAngleRad * SUN_CONSTANTS.RAD_TO_DEG - refraction;

    // Получаем часовой пояс из системы
    const timezoneOffset = getTimezoneOffset();

    // Вычисляем время восхода в UTC
    const sunriseUTC = 12 - hourAngle / 15 - equation / 60 - (longitude / 15);
    // Вычисляем время заката в UTC
    const sunsetUTC = 12 + hourAngle / 15 - equation / 60 - (longitude / 15);

    // Преобразуем в локальное время
    const sunriseLocal = sunriseUTC + timezoneOffset;
    const sunsetLocal = sunsetUTC + timezoneOffset;

    // Нормализуем время (если получилось отрицательное или больше 24, корректируем)
    const normalizedSunrise = normalizeTimeValue(sunriseLocal);
    const normalizedSunset = normalizeTimeValue(sunsetLocal);

    // Создаем объекты Date с правильным временем
    const baseDate = new Date(date);
    baseDate.setHours(0, 0, 0, 0);
    const sunrise = createTimeFromNormalized(baseDate, normalizedSunrise);
    const sunset = createTimeFromNormalized(baseDate, normalizedSunset);

    return {
      status: "normal",
      sunrise: sunrise,
      sunset: sunset
    };
  } catch (error) {
    logError("Ошибка при расчете времени восхода и заката: " + error);
    return {
      status: "normal",
      sunrise: null,
      sunset: null
    };
  }
}

// ============================================================================
// ПАРСИНГ ВРЕМЕНИ
// ============================================================================

/**
 * Парсит строку времени в формате ЧЧ:ММ или Ч:М
 * @param {string} timeStr - строка времени
 * @returns {Object|null} объект с полями hours и minutes или null при ошибке
 */
function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  const trimmed = timeStr.trim();
  if (trimmed === "") {
    return null;
  }

  // Проверяем формат ЧЧ:ММ или Ч:М
  const timePattern = /^(\d{1,2}):(\d{2})$/;
  const match = trimmed.match(timePattern);

  if (!match) {
    logError("Неверный формат времени: " + trimmed + ". Ожидается формат ЧЧ:ММ");
    return null;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  // Проверяем допустимость значений
  if (hours < 0 || hours >= 24) {
    logError("Часы должны быть в диапазоне 0-23: " + hours);
    return null;
  }

  if (minutes < 0 || minutes >= 60) {
    logError("Минуты должны быть в диапазоне 0-59: " + minutes);
    return null;
  }

  return { hours: hours, minutes: minutes };
}

/**
 * Форматирует время в строку ЧЧ:ММ
 * @param {Date} date - дата/время
 * @returns {string} отформатированная строка
 */
function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hoursStr = hours < 10 ? "0" + hours : hours.toString();
  const minutesStr = minutes < 10 ? "0" + minutes : minutes.toString();
  return hoursStr + ":" + minutesStr;
}

// ============================================================================
// CRON ЗАДАЧИ
// ============================================================================

/**
 * Отменяет cron задачу безопасным способом
 * @param {Object} task - задача для отмены
 */
function cancelCronTask(task) {
  if (task) {
    try {
      task.cancel();
    } catch (error) {
      // Логируем ошибку для отладки, но не прерываем выполнение
      if (DEBUG) {
        logError("Ошибка при отмене cron задачи: " + error);
      }
    }
  }
}

/**
 * Создает cron задачу для включения или отключения
 * @param {string} schedule - строка расписания cron
 * @param {Object} source - источник события (характеристика)
 * @param {Object} variables - переменные сценария
 * @param {Object} options - опции сценария
 * @param {string} taskType - тип задачи для логирования ("включения" или "отключения")
 * @returns {Object|undefined} созданная задача или undefined при ошибке
 */
function createCronTask(schedule, source, variables, options, taskType) {
  if (!schedule) {
    return undefined;
  }

  try {
    const task = Cron.schedule(schedule, function () {
      try {
        updateDayNightStatus(source, variables, options, true);
      } catch (error) {
        logError("Ошибка при выполнении cron задачи " + taskType + ": " + error);
      }
    });
    return task;
  } catch (error) {
    logError("Ошибка при создании cron задачи " + taskType + ": " + error);
    return undefined;
  }
}


/**
 * Настраивает cron задачи для включения и отключения
 * @param {Object} source - источник события (характеристика)
 * @param {Object} variables - переменные сценария
 * @param {Object} options - опции сценария
 * @param {Date} turnOnTime - время включения
 * @param {Date} turnOffTime - время отключения
 */
function setupCronTasks(source, variables, options, turnOnTime, turnOffTime) {
  // Отменяем задачу для полярного дня/ночи, если она была создана
  if (variables.polarCronTask) {
    cancelCronTask(variables.polarCronTask);
    variables.polarCronTask = undefined;
    variables.lastPolarSchedule = undefined;
  }
  // Нормализуем время для cron задач (переносим на завтра, если время уже прошло)
  const now = new Date();
  const onTimeForCron = normalizeTime(now, turnOnTime, true);
  const offTimeForCron = normalizeTime(now, turnOffTime, true);

  // Получаем новые расписания (сравниваем по расписанию cron, а не по времени)
  const onCronSchedule = getCronSchedule(onTimeForCron);
  const offCronSchedule = getCronSchedule(offTimeForCron);

  // Настраиваем задачу включения
  variables.turnOnTask = setupSingleCronTask(
    onCronSchedule,
    variables.lastOnSchedule,
    variables.turnOnTask,
    source,
    variables,
    options,
    "включения"
  );
  variables.lastOnSchedule = onCronSchedule;

  // Настраиваем задачу отключения
  variables.turnOffTask = setupSingleCronTask(
    offCronSchedule,
    variables.lastOffSchedule,
    variables.turnOffTask,
    source,
    variables,
    options,
    "отключения"
  );
  variables.lastOffSchedule = offCronSchedule;

  if (DEBUG) {
    logInfo(`Настроены cron задачи: включение - ${onCronSchedule || "не настроено"}, отключение - ${offCronSchedule || "не настроено"}`);
  }
}

/**
 * Настраивает одну cron задачу (включения или отключения)
 * @param {string|null} newSchedule - новое расписание cron
 * @param {string|null} lastSchedule - последнее расписание для сравнения
 * @param {Object|undefined} currentTask - текущая задача для отмены
 * @param {Object} source - источник события (характеристика)
 * @param {Object} variables - переменные сценария
 * @param {Object} options - опции сценария
 * @param {string} taskType - тип задачи для логирования ("включения" или "отключения")
 * @returns {Object|undefined} новая задача или undefined
 */
function setupSingleCronTask(newSchedule, lastSchedule, currentTask, source, variables, options, taskType) {
  // Отменяем существующую задачу только если расписание изменилось
  if (lastSchedule !== newSchedule) {
    cancelCronTask(currentTask);

    // Создаем новую задачу сразу после отмены старой
    if (newSchedule) {
      return createCronTask(newSchedule, source, variables, options, taskType);
    }
    return undefined;
  }

  // Создаем новую задачу только если её еще нет и расписание не изменилось
  if (newSchedule && !currentTask) {
    return createCronTask(newSchedule, source, variables, options, taskType);
  }

  // Возвращаем текущую задачу, если она уже существует
  return currentTask;
}

/**
 * Преобразует время в формат cron расписания (секунды минуты часы день месяц день_недели)
 * Нормализует время до минут (секунды = 0) для более стабильного расписания
 * @param {Date} date - дата/время
 * @returns {string|null} строка cron расписания или null
 */
function getCronSchedule(date) {
  if (!date) {
    return null;
  }

  // Нормализуем до минут (секунды = 0) для стабильности расписания
  const minutes = date.getMinutes();
  const hours = date.getHours();

  // Формат: секунды минуты часы * * * (каждый день)
  // Секунды всегда 0 для стабильности
  return `0 ${minutes} ${hours} * * *`;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Проверяет валидность координаты
 * @param {*} coordinate - координата для проверки
 * @param {number} min - минимальное допустимое значение
 * @param {number} max - максимальное допустимое значение
 * @param {string} name - название координаты для сообщения об ошибке
 * @returns {boolean} true если координата валидна
 */
function isValidCoordinate(coordinate, min, max, name) {
  // Проверяем на undefined, null, пустую строку
  if (coordinate === undefined || coordinate === null || coordinate === "") {
    return false;
  }

  // Преобразуем в число
  const num = typeof coordinate === 'string' ? parseFloat(coordinate) : Number(coordinate);

  // Проверяем на NaN и валидность числа
  if (isNaN(num) || !isFinite(num)) {
    return false;
  }

  // Проверяем диапазон значений
  if (num < min || num > max) {
    logError(name + " должна быть в диапазоне от " + min + " до " + max + " градусов. Указано: " + num);
    return false;
  }

  return true;
}

/**
 * Обновляет имя сервиса в зависимости от текущего состояния (день/ночь)
 * @param {Object} source - источник события (характеристика)
 * @param {Object} options - опции сценария
 * @param {boolean} shouldBeOn - текущее состояние (день/ночь)
 */
function updateServiceName(source, options, shouldBeOn) {
  // Если опция не включена, ничего не делаем
  if (!options.changeServiceName) {
    return;
  }

  try {
    const service = source.getService();
    if (!service) {
      return;
    }

    // Определяем текущее состояние (день/ночь) и устанавливаем имя
    const stateStr = shouldBeOn ? "День" : "Ночь";
    service.setName(stateStr);
  } catch (error) {
    logError("Ошибка при обновлении имени сервиса: " + error);
  }
}

/**
 * Проверяет, изменилась ли характеристика самим сценарием
 * Формат context: "LOGIC_ID <- C_TYPE <- LOGIC_ID"
 * LOGIC[229_Service 508.13] <- C[508.13.15 Switch.On] <- LOGIC[229_Service 508.13] <- C[508.13.15 Switch.On] <- WEB[Apple Macintosh Chrome [DESKTOP] (локальный) - 192.168.1.121]_1766321287
 * @param {Object} context - Контекст изменения характеристики
 * @returns {boolean} true если изменение было сделано сценарием
 */
function isSelfChanged(context) {
  if (!context) return false;

  const elements = context.toString().split(CONTEXT_CONSTANTS.DELIMITER);

  return elements.length >= CONTEXT_CONSTANTS.MIN_ELEMENTS &&
    elements[0].startsWith(CONTEXT_CONSTANTS.LOGIC_PREFIX) &&
    elements[1].startsWith(CONTEXT_CONSTANTS.CHARACTERISTIC_PREFIX) &&
    elements[2].split('_')[0] === elements[0].split('_')[0];
}
/**
 * Проверяет, сработал ли триггер при запуске хаба
 * @param {Object} context - Контекст изменения характеристики
 * @returns {boolean} true если изменение автоматическое
 */
function isHubStartup(context) {
  if (!context) return false;
  return context && context.toString().indexOf("HUB[OnStart]") >= 0;
}

// ============================================================================
// ФУНКЦИИ ЛОГИРОВАНИЯ
// ============================================================================

/**
 * Логирует информационное сообщение с префиксом сценария
 * @param {string} message - сообщение для логирования
 */
function logInfo(message) {
  console.info(LOG_PREFIX + message);
}

/**
 * Логирует сообщение об ошибке с префиксом сценария
 * @param {string} message - сообщение для логирования
 */
function logError(message) {
  console.error(LOG_PREFIX + message);
}