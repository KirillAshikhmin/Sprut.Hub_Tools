// Выносим название и описание в переменные для использования в info
const scenarioName = {
  ru: "☀️ Солнце в окне",
  en: "☀️ Sun in window"
};

const scenarioDescription = {
  ru: "Логический сценарий, который держит выключатель включённым ровно тогда, когда Солнце светит в указанное окно.\n\nВ настройках указываются координаты дома, направление окна (румбом или точным азимутом) и два порога: минимальная высота Солнца над горизонтом и максимальное отклонение Солнца от направления окна. Положение Солнца считается на текущие дату и время, поэтому результат зимой и летом разный.\n\nФлаг обновляется по таймеру, при запуске хаба и при каждом сохранении сценария. На этом флаге удобно строить закрытие штор, гашение подсветки и уведомления.\n\nКоординаты можно взять в настройках хаба в разделе Дата и время.",
  en: "Logical scenario that keeps a switch on exactly while the Sun shines into the specified window.\n\nOptions are the home coordinates, the window direction (a compass point or an exact azimuth) and two thresholds: the minimum Sun altitude above the horizon and the maximum deviation of the Sun from the window direction. The Sun position is calculated for the current date and time, so the result differs between winter and summer.\n\nThe flag is refreshed by a timer, on hub startup and on every save of the scenario. It is a convenient base for closing blinds, dimming lights and notifications.\n\nCoordinates can be found in hub settings under Date & Time."
};

// Координаты по умолчанию (Москва)
const DEFAULT_COORDINATES = {
  LATITUDE: 55.7558,
  LONGITUDE: 37.6173
};

// Румбы: значение опции — азимут стороны, на которую окно смотрит наружу
const WINDOW_DIRECTIONS = [
  { value: 0, key: "NORTH", name: { ru: "Север (0°)", en: "North (0°)" } },
  { value: 45, key: "NORTH_EAST", name: { ru: "Северо-Восток (45°)", en: "North-East (45°)" } },
  { value: 90, key: "EAST", name: { ru: "Восток (90°)", en: "East (90°)" } },
  { value: 135, key: "SOUTH_EAST", name: { ru: "Юго-Восток (135°)", en: "South-East (135°)" } },
  { value: 180, key: "SOUTH", name: { ru: "Юг (180°)", en: "South (180°)" } },
  { value: 225, key: "SOUTH_WEST", name: { ru: "Юго-Запад (225°)", en: "South-West (225°)" } },
  { value: 270, key: "WEST", name: { ru: "Запад (270°)", en: "West (270°)" } },
  { value: 315, key: "NORTH_WEST", name: { ru: "Северо-Запад (315°)", en: "North-West (315°)" } }
];

// Значение опции "Точный азимут окна", означающее "не задан" — 0 является законным Севером,
// поэтому "пусто" выражается значением вне рабочего диапазона
const AZIMUTH_NOT_SET = -1;

const DEFAULTS = {
  WINDOW_DIRECTION: 180,        // Юг
  MIN_SUN_ALTITUDE: 5,          // градусы
  MAX_AZIMUTH_DEVIATION: 90,    // градусы
  UPDATE_INTERVAL: 1            // минуты
};

info = {
  name: scenarioName.ru,
  description: scenarioDescription.ru,
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.Switch, HS.Outlet, HS.Lightbulb],
  sourceCharacteristics: [HC.On],
  options: {
    desc: {
      name: { ru: "  ОПИСАНИЕ", en: "  DESCRIPTION" },
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
        en: "Geographic latitude in decimal degrees (e.g., 55.7558 for Moscow).",
        ru: "Географическая широта в десятичных градусах (например, 55.7558 для Москвы)."
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
        en: "Geographic longitude in decimal degrees (e.g., 37.6173 for Moscow). East is positive.",
        ru: "Географическая долгота в десятичных градусах (например, 37.6173 для Москвы). Восточная долгота — положительная."
      },
      type: "Double",
      value: DEFAULT_COORDINATES.LONGITUDE,
      minValue: -180,
      maxValue: 180
    },
    windowDirection: {
      name: {
        en: "Window direction",
        ru: "Направление окна"
      },
      desc: {
        en: "The side the window faces outwards. 'West' means the Sun shines into it in the afternoon. Used when the exact azimuth is not set.",
        ru: "Сторона света, на которую окно смотрит наружу. «Запад» значит, что солнце светит в него во второй половине дня. Используется, если не задан точный азимут."
      },
      type: "Integer",
      value: DEFAULTS.WINDOW_DIRECTION,
      formType: "list",
      values: WINDOW_DIRECTIONS
    },
    windowAzimuth: {
      name: {
        en: "Exact window azimuth",
        ru: "Точный азимут окна"
      },
      desc: {
        en: "Exact azimuth the window faces outwards: 0 = North, 90 = East, 180 = South, 270 = West. Any value from 0 to 360 overrides the window direction. Leave -1 to use the direction from the list.",
        ru: "Точный азимут, куда окно смотрит наружу: 0 — Север, 90 — Восток, 180 — Юг, 270 — Запад. Любое значение от 0 до 360 перебивает выбранное направление. Оставьте -1, чтобы использовать направление из списка."
      },
      type: "Double",
      value: AZIMUTH_NOT_SET,
      minValue: AZIMUTH_NOT_SET,
      maxValue: 360
    },
    minSunAltitude: {
      name: {
        en: "Minimum Sun altitude",
        ru: "Минимальная высота солнца"
      },
      desc: {
        en: "Below this altitude above the horizon the Sun is not counted: it is hidden by houses and trees, and at night the flag is always off.",
        ru: "Ниже этой высоты над горизонтом солнце не считается: его закрывают дома и деревья, а ночью флаг снят всегда."
      },
      type: "Double",
      value: DEFAULTS.MIN_SUN_ALTITUDE,
      minValue: 0,
      maxValue: 90
    },
    maxAzimuthDeviation: {
      name: {
        en: "Maximum deviation from window direction",
        ru: "Максимальное отклонение от направления окна"
      },
      desc: {
        en: "How far the Sun may deviate from the window direction and still be counted as shining into it. 90 degrees means the whole half-plane in front of the window.",
        ru: "Насколько далеко солнце может уйти в сторону от направления окна и всё ещё считаться светящим в него. 90 градусов — вся полуплоскость перед окном."
      },
      type: "Double",
      value: DEFAULTS.MAX_AZIMUTH_DEVIATION,
      minValue: 1,
      maxValue: 90
    },
    updateInterval: {
      name: {
        en: "Recalculation interval (minutes)",
        ru: "Интервал пересчёта (минуты)"
      },
      desc: {
        en: "How often the Sun position is recalculated during the day.",
        ru: "Как часто в течение дня пересчитывается положение Солнца."
      },
      type: "Integer",
      value: DEFAULTS.UPDATE_INTERVAL,
      minValue: 1,
      maxValue: 60,
      step: 1
    },
    allowManualControl: {
      name: {
        en: "Allow manual control",
        ru: "Возможность ручного управления"
      },
      desc: {
        en: "If enabled, the scenario changes the state only when the Sun enters or leaves the window (and at hub startup). If disabled, any foreign change is overwritten by the calculated state.",
        ru: "Если включено, сценарий меняет состояние только в момент, когда солнце вошло в окно или вышло из него (а также при запуске хаба). Если выключено, при любом чужом изменении восстанавливается расчётное состояние."
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
        en: "If enabled, the service name switches between 'Солнце в окне' and 'Солнца в окне нет'.",
        ru: "Если включено, имя сервиса переключается между «Солнце в окне» и «Солнца в окне нет»."
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
        en: "If enabled, the switch is off while the Sun shines into the window and on the rest of the time.",
        ru: "Если включено, выключатель отключён, пока солнце светит в окно, и включён всё остальное время."
      },
      type: "Boolean",
      value: false
    }
  },
  variables: {
    initialState: undefined,   // true после первого успешного расчёта в этом экземпляре сценария
    lastState: undefined,      // последнее рассчитанное значение флага "солнце в окне"
    generation: undefined,     // поколение таймеров этого экземпляра
    generationKey: undefined,  // ключ поколения в global (привязан к UUID сервиса)
    timerTask: undefined       // текущая задача пересчёта
  }
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

// Приближение солнечных координат USNO/NOAA: точность по прямому восхождению
// и склонению лучше 0,01° на 1950–2050 гг.
const SUN_FORMULA = {
  MS_PER_DAY: 86400000,
  DAYS_J2000_OFFSET: 10957.5,          // дней от эпохи Unix до J2000.0
  MEAN_ANOMALY_BASE: 357.529,
  MEAN_ANOMALY_RATE: 0.98560028,
  MEAN_LONGITUDE_BASE: 280.459,
  MEAN_LONGITUDE_RATE: 0.98564736,
  EQUATION_CENTER_1: 1.915,
  EQUATION_CENTER_2: 0.020,
  OBLIQUITY_BASE: 23.439,
  OBLIQUITY_RATE: 0.00000036,
  GMST_BASE: 18.697374558,             // звёздное время Гринвича в J2000.0, часы
  GMST_RATE: 24.06570982441908,        // часов звёздного времени за сутки
  DEGREES_PER_HOUR: 15
};

const ANGLE = {
  DEG_TO_RAD: Math.PI / 180,
  RAD_TO_DEG: 180 / Math.PI,
  FULL_CIRCLE: 360,
  HALF_CIRCLE: 180,
  HOURS_PER_DAY: 24
};

const MS_PER_MINUTE = 60000;

// Ключ поколения таймеров в global. Привязан к UUID сервиса, чтобы экземпляры
// на разных окнах не гасили таймеры друг друга.
const GENERATION_KEY_PREFIX = "SIW_gen_";

// Константы для проверки контекста изменений
const CONTEXT_CONSTANTS = {
  DELIMITER: ' <- ',
  LOGIC_PREFIX: 'LOGIC',
  CHARACTERISTIC_PREFIX: 'C',
  MIN_ELEMENTS: 3,
  HUB_STARTUP: 'HUB[OnStart]'
};

const SERVICE_NAMES = {
  IN_WINDOW: "Солнце в окне",
  NOT_IN_WINDOW: "Солнца в окне нет"
};

// Рабочие диапазоны опций, которые проверяются перед расчётом. Имя нужно, чтобы
// в строке ошибки пользователь увидел параметр так же, как он подписан в UI.
const OPTION_LIMITS = {
  LATITUDE: { name: "Широта", min: -90, max: 90 },
  LONGITUDE: { name: "Долгота", min: -180, max: 180 },
  WINDOW_DIRECTION: { name: "Направление окна", values: WINDOW_DIRECTIONS.map(function (item) { return item.value; }) },
  WINDOW_AZIMUTH: { name: "Точный азимут окна", min: 0, max: 360 },
  MIN_ALTITUDE: { name: "Минимальная высота солнца", min: 0, max: 90 },
  MAX_DEVIATION: { name: "Максимальное отклонение от направления окна", min: 1, max: 90 }
};

// Интервал пересчёта не проверяется, а зажимается, поэтому его границы живут
// отдельно от проверяемых параметров и имени для строки ошибки не имеют
const UPDATE_INTERVAL_MINUTES = { MIN: 1, MAX: 60 };

const LOG_PREFIX = scenarioName.ru + ". ";

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ — ТОЧКА ВХОДА
// ============================================================================

/**
 * Точка входа сценария. Вызывается хабом при изменении характеристики,
 * при запуске хаба и при каждом сохранении сценария (onStart: true).
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {*} value - новое значение характеристики
 * @param {Object} variables - состояние экземпляра сценария
 * @param {Object} options - настройки сценария
 * @param {*} context - контекст изменения характеристики
 */
function trigger(source, value, variables, options, context) {
  // Собственную запись не разбираем — иначе сценарий зациклится сам на себе
  if (isSelfChanged(context)) {
    return;
  }

  if (source.getType() !== HC.On) {
    return;
  }

  // Поколение поднимается раньше проверки настроек: пересохранение со сломанными
  // координатами обязано погасить таймер прошлого экземпляра, иначе выключателем
  // продолжат управлять настройки, которых уже нет
  ensureGeneration(source, variables);

  const settings = resolveSettings(options);
  const error = validateSettings(settings);
  if (error) {
    // Характеристику не трогаем и таймер не ставим: снятый флаг означал бы
    // "солнца в окне нет", а правда в том, что сценарий не знает ответа
    logError(error);
    return;
  }

  // При разрешённом ручном управлении расчётное состояние навязывается только
  // на первом расчёте и при запуске хаба; дальше его меняет лишь переход солнца
  const isFirstRun = !variables.initialState;
  const forceWrite = !options.allowManualControl || isFirstRun || isHubStartup(context);
  variables.initialState = true;

  recalculate(source, variables, options, settings, forceWrite);
  scheduleRecalculation(source, variables, options, settings);
}

// ============================================================================
// ПЕРЕСЧЁТ И ПЛАНИРОВЩИК
// ============================================================================

/**
 * Считает положение Солнца на текущий момент и приводит состояние выключателя
 * к расчётному.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {Object} variables - состояние экземпляра сценария
 * @param {Object} options - настройки сценария
 * @param {Object} settings - приведённые к рабочим значениям настройки
 * @param {boolean} forceWrite - записать состояние даже без смены флага
 */
function recalculate(source, variables, options, settings, forceWrite) {
  const sunPosition = calculateSunPosition(new Date(), settings.latitude, settings.longitude);
  const sunIsInWindow = isSunInWindow(sunPosition, settings.windowAzimuth, settings.minAltitude, settings.maxDeviation);

  const stateChanged = variables.lastState !== sunIsInWindow;
  variables.lastState = sunIsInWindow;

  if (stateChanged || forceWrite) {
    applyState(source, options, sunIsInWindow);
  }

  // Без смены состояния в лог не пишем: минутный таймер иначе зальёт журнал
  if (stateChanged) {
    logInfo(describeState(sunIsInWindow, sunPosition, settings));
  }
}

/**
 * Ставит следующий пересчёт. Рекурсивный setTimeout, а не setInterval: так
 * старое поколение гасится само, увидев чужой номер в global.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {Object} variables - состояние экземпляра сценария
 * @param {Object} options - настройки сценария
 * @param {Object} settings - приведённые к рабочим значениям настройки
 */
function scheduleRecalculation(source, variables, options, settings) {
  cancelScheduledRecalculation(variables);

  const generationKey = variables.generationKey;
  const generation = variables.generation;

  variables.timerTask = setTimeout(() => {
    variables.timerTask = undefined;

    // Сценарий пересохранён: этот цикл принадлежит прошлому экземпляру и обязан
    // прекратиться сам — хаб оставил колбэк жить со старым variables
    if (isStaleGeneration(generationKey, generation)) {
      return;
    }

    recalculate(source, variables, options, settings, !options.allowManualControl);
    scheduleRecalculation(source, variables, options, settings);
  }, settings.updateIntervalMs);
}

/**
 * Снимает запланированный пересчёт, если он есть.
 * @param {Object} variables - состояние экземпляра сценария
 */
function cancelScheduledRecalculation(variables) {
  if (!variables.timerTask) {
    return;
  }
  clearTimeout(variables.timerTask);
  variables.timerTask = undefined;
}

// Защита поколениями живёт только в global. Если его нет, сценарий продолжает работу:
// один флаг с лишним таймером лучше, чем отказ считать. Но потеря защиты не должна быть
// молчаливой, а сообщение о ней — повторяться: строка пишется один раз на запуск скрипта,
// иначе минутный таймер зальёт журнал
let generationProtectionReported = false;

/**
 * Сообщает о потере защиты поколениями — один раз на запуск скрипта.
 * @param {string} reason - что именно не получилось
 */
function reportGenerationProtectionLost(reason) {
  if (generationProtectionReported) {
    return;
  }
  generationProtectionReported = true;
  logError("Защита поколениями таймеров недоступна (" + reason + "). Сценарий продолжает " +
    "работу, но после пересохранения рядом с новым таймером может остаться старый — " +
    "помогает перезапуск хаба.");
}

/**
 * Заводит поколение таймеров для этого экземпляра сценария.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {Object} variables - состояние экземпляра сценария
 */
function ensureGeneration(source, variables) {
  if (variables.generation !== undefined) {
    return;
  }
  variables.generationKey = GENERATION_KEY_PREFIX + instanceKey(source);
  variables.generation = nextGeneration(variables.generationKey);
  if (variables.generation === null) {
    reportGenerationProtectionLost("поколение не записалось в global");
  }
}

/**
 * Ключ экземпляра — UUID сервиса, чтобы сценарии на разных окнах не мешали друг другу.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @returns {string} UUID сервиса, либо UUID характеристики, если сервис недоступен
 */
function instanceKey(source) {
  try {
    const service = source.getService();
    if (service) {
      return service.getUUID();
    }
  } catch (e) {
    // Сервис недоступен — ключом станет UUID характеристики
  }
  return source.getUUID();
}

/**
 * Увеличивает счётчик поколений в global.
 * @param {string} key - ключ поколения
 * @returns {number|null} номер поколения, либо null, если global недоступен
 */
function nextGeneration(key) {
  try {
    if (typeof global === "undefined" || global === null) {
      return null;
    }
    const next = (global[key] | 0) + 1;
    global[key] = next;
    if ((global[key] | 0) !== next) {
      return null;
    }
    return next;
  } catch (e) {
    return null;
  }
}

/**
 * Проверяет, не появился ли более новый экземпляр сценария.
 * @param {string} key - ключ поколения
 * @param {number|null} generation - поколение, в котором заведён таймер
 * @returns {boolean} true, если поколение устарело
 */
function isStaleGeneration(key, generation) {
  if (!key || generation === null || generation === undefined) {
    return false;
  }
  try {
    return (global[key] | 0) !== generation;
  } catch (e) {
    reportGenerationProtectionLost("поколение не читается из global");
    return false;
  }
}

// ============================================================================
// АСТРОНОМИЯ — положение Солнца
// ============================================================================

/**
 * Считает высоту и азимут Солнца на заданный момент времени.
 * Расчёт ведётся в UTC: часовой пояс хаба на результат не влияет.
 * Уравнение времени отдельно не считается — оно уже сидит в разнице между
 * звёздным временем Гринвича и прямым восхождением.
 * @param {Date} date - момент времени
 * @param {number} latitude - широта, градусы
 * @param {number} longitude - долгота, градусы (восточная положительна)
 * @returns {Object} { altitude, azimuth } в градусах, азимут 0…360 от Севера по часовой стрелке
 */
function calculateSunPosition(date, latitude, longitude) {
  const days = date.getTime() / SUN_FORMULA.MS_PER_DAY - SUN_FORMULA.DAYS_J2000_OFFSET;

  const meanAnomaly = SUN_FORMULA.MEAN_ANOMALY_BASE + SUN_FORMULA.MEAN_ANOMALY_RATE * days;
  const meanLongitude = SUN_FORMULA.MEAN_LONGITUDE_BASE + SUN_FORMULA.MEAN_LONGITUDE_RATE * days;
  const eclipticLongitude = meanLongitude
    + SUN_FORMULA.EQUATION_CENTER_1 * sinDeg(meanAnomaly)
    + SUN_FORMULA.EQUATION_CENTER_2 * sinDeg(2 * meanAnomaly);
  const obliquity = SUN_FORMULA.OBLIQUITY_BASE - SUN_FORMULA.OBLIQUITY_RATE * days;

  const declination = asinDeg(sinDeg(obliquity) * sinDeg(eclipticLongitude));
  const rightAscension = atan2Deg(cosDeg(obliquity) * sinDeg(eclipticLongitude), cosDeg(eclipticLongitude));

  const siderealHours = positiveModulo(SUN_FORMULA.GMST_BASE + SUN_FORMULA.GMST_RATE * days, ANGLE.HOURS_PER_DAY);
  const hourAngle = toSignedAngle(siderealHours * SUN_FORMULA.DEGREES_PER_HOUR + longitude - rightAscension);

  const altitude = asinDeg(
    sinDeg(latitude) * sinDeg(declination) + cosDeg(latitude) * cosDeg(declination) * cosDeg(hourAngle)
  );

  // На полюсе и в зените знаменатель обращается в ноль. Аргумент acos обрезается:
  // азимут в такой точке смысла не имеет и на решение не влияет — там уже сработал
  // порог высоты
  const cosAzimuth = (sinDeg(declination) - sinDeg(altitude) * sinDeg(latitude)) / (cosDeg(altitude) * cosDeg(latitude));
  let azimuth = acosDeg(cosAzimuth);

  // После истинного полудня часовой угол положителен, а Солнце — в западной половине
  if (hourAngle > 0) {
    azimuth = ANGLE.FULL_CIRCLE - azimuth;
  }

  return { altitude: altitude, azimuth: normalizeAngle(azimuth) };
}

// ============================================================================
// ГЕОМЕТРИЯ ОКНА
// ============================================================================

/**
 * Правило "солнце в окне": Солнце достаточно высоко и достаточно близко
 * к направлению окна.
 * @param {Object} sunPosition - { altitude, azimuth } в градусах
 * @param {number} windowAzimuth - азимут окна наружу, 0…360
 * @param {number} minAltitude - минимальная высота Солнца, градусы
 * @param {number} maxDeviation - максимальное отклонение от направления окна, градусы
 * @returns {boolean} true, если солнце светит в окно
 */
function isSunInWindow(sunPosition, windowAzimuth, minAltitude, maxDeviation) {
  if (sunPosition.altitude < minAltitude) {
    return false;
  }
  return angularDifference(sunPosition.azimuth, windowAzimuth) <= maxDeviation;
}

/**
 * Круговая разность азимутов: окно на 350° и солнце на 10° — это 20°, а не 340°.
 * @param {number} first - первый угол, градусы
 * @param {number} second - второй угол, градусы
 * @returns {number} разность 0…180
 */
function angularDifference(first, second) {
  const shifted = positiveModulo(first - second + ANGLE.FULL_CIRCLE + ANGLE.HALF_CIRCLE, ANGLE.FULL_CIRCLE);
  return Math.abs(shifted - ANGLE.HALF_CIRCLE);
}

// ============================================================================
// НАСТРОЙКИ
// ============================================================================

/**
 * Приводит опции к рабочим значениям: разбирает сентинел -1 у точного азимута
 * и переводит интервал пересчёта в миллисекунды.
 * @param {Object} options - настройки сценария
 * @returns {Object} рабочие настройки
 */
function resolveSettings(options) {
  // Точный азимут — единственная необязательная опция, и любая пустая форма значит
  // одно и то же "не задан": -1, null, undefined, пустая строка, одни пробелы.
  // Ошибка — только непустое значение, которое не разбирается в число, или вне 0…360
  const exactAzimuth = isBlankOption(options.windowAzimuth)
    ? AZIMUTH_NOT_SET
    : toNumber(options.windowAzimuth, NaN);
  // Любое значение, кроме сентинела, считается заданным — включая 0 (законный Север)
  // и заведомо неверное, которое дальше поймает проверка
  const azimuthIsSet = exactAzimuth !== AZIMUTH_NOT_SET;
  // Румб, как координаты и пороги, дефолтом не подменяется: направление, которого нет
  // в списке, должно дойти до проверки и остановить сценарий, а не тихо стать Югом
  const direction = toNumber(options.windowDirection, NaN);
  // Интервал пересчёта, в отличие от порогов, не проверяется, а зажимается:
  // неверный интервал не повод останавливать сценарий целиком
  const interval = clamp(
    Math.round(toNumber(options.updateInterval, DEFAULTS.UPDATE_INTERVAL)),
    UPDATE_INTERVAL_MINUTES.MIN,
    UPDATE_INTERVAL_MINUTES.MAX
  );

  return {
    latitude: toNumber(options.latitude, NaN),
    longitude: toNumber(options.longitude, NaN),
    exactAzimuth: exactAzimuth,
    azimuthIsSet: azimuthIsSet,
    windowDirection: direction,
    windowAzimuth: normalizeAngle(azimuthIsSet ? exactAzimuth : direction),
    // Пороги, как широта и долгота, не подменяются дефолтом: нечисловое значение
    // должно дойти до проверки и остановить сценарий, а не тихо стать другим порогом
    minAltitude: toNumber(options.minSunAltitude, NaN),
    maxDeviation: toNumber(options.maxAzimuthDeviation, NaN),
    updateIntervalMs: interval * MS_PER_MINUTE
  };
}

/**
 * Проверяет рабочие настройки.
 * @param {Object} settings - рабочие настройки
 * @returns {string|null} строка ошибки, либо null, если всё в порядке
 */
function validateSettings(settings) {
  return rangeError(OPTION_LIMITS.LATITUDE, settings.latitude)
    || rangeError(OPTION_LIMITS.LONGITUDE, settings.longitude)
    || listError(OPTION_LIMITS.WINDOW_DIRECTION, settings.windowDirection)
    || (settings.azimuthIsSet ? rangeError(OPTION_LIMITS.WINDOW_AZIMUTH, settings.exactAzimuth) : null)
    || rangeError(OPTION_LIMITS.MIN_ALTITUDE, settings.minAltitude)
    || rangeError(OPTION_LIMITS.MAX_DEVIATION, settings.maxDeviation);
}

/**
 * Строит строку ошибки, если значение выходит за рабочий диапазон.
 * @param {Object} limit - { name, min, max }
 * @param {number} value - проверяемое значение
 * @returns {string|null} строка ошибки, либо null
 */
function rangeError(limit, value) {
  if (isFiniteNumber(value) && value >= limit.min && value <= limit.max) {
    return null;
  }
  return invalidOptionError(limit, value, "Допустимый диапазон " + limit.min + "…" + limit.max);
}

/**
 * Строит строку ошибки, если значение не входит в список допустимых. Румб — список
 * в UI, но пришедшее значение всё равно проверяется: подмена неизвестного румба Югом
 * дала бы молча неверный ответ вместо явной ошибки.
 * @param {Object} limit - { name, values }
 * @param {number} value - проверяемое значение
 * @returns {string|null} строка ошибки, либо null
 */
function listError(limit, value) {
  if (isFiniteNumber(value) && limit.values.indexOf(value) >= 0) {
    return null;
  }
  return invalidOptionError(limit, value, "Допустимые значения: " + limit.values.join(", "));
}

/**
 * Общая часть строки ошибки настройки.
 * @param {Object} limit - { name }
 * @param {*} value - проверяемое значение
 * @param {string} allowed - описание допустимых значений
 * @returns {string} строка ошибки
 */
function invalidOptionError(limit, value, allowed) {
  const shown = isFiniteNumber(value) ? String(value) : "не число";
  return "Неверное значение параметра «" + limit.name + "»: " + shown +
    ". " + allowed +
    ". Сценарий ничего не делает до следующего сохранения или перезапуска хаба.";
}

// ============================================================================
// СОСТОЯНИЕ
// ============================================================================

/**
 * Записывает расчётное состояние в характеристику и обновляет имя сервиса.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {Object} options - настройки сценария
 * @param {boolean} sunIsInWindow - светит ли солнце в окно
 */
function applyState(source, options, sunIsInWindow) {
  setDeviceValue(source, sunIsInWindow, options.invert === true);
  updateServiceName(source, options, sunIsInWindow);
}

/**
 * Устанавливает значение характеристики с учётом инверсии. Одинаковое значение
 * повторно не пишется: иначе каждую минуту в хабе появляется событие изменения.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {boolean} value - значение для установки
 * @param {boolean} invert - нужно ли инвертировать значение
 * @returns {boolean} true, если значение было изменено
 */
function setDeviceValue(source, value, invert) {
  if (invert) value = !value;
  if (source.getType() === HC.On && source.getValue() != value) {
    source.setValue(value);
    return true;
  }
  return false;
}

/**
 * Обновляет имя сервиса по текущему состоянию. Имя отражает положение Солнца,
 * а не значение характеристики: при инверсии оно остаётся правдивым.
 * @param {Object} source - характеристика, на которой висит сценарий
 * @param {Object} options - настройки сценария
 * @param {boolean} sunIsInWindow - светит ли солнце в окно
 */
function updateServiceName(source, options, sunIsInWindow) {
  if (!options.changeServiceName) {
    return;
  }

  try {
    const service = source.getService();
    if (!service) {
      return;
    }
    const name = sunIsInWindow ? SERVICE_NAMES.IN_WINDOW : SERVICE_NAMES.NOT_IN_WINDOW;
    // Одинаковое имя повторно не пишем — тот же принцип, что и для характеристики:
    // при выключенном ручном управлении сюда заходит каждый тик таймера
    if (String(service.getName()) === name) {
      return;
    }
    service.setName(name);
  } catch (error) {
    logError("Ошибка при обновлении имени сервиса: " + error);
  }
}

/**
 * Строит строку журнала о смене состояния.
 * @param {boolean} sunIsInWindow - светит ли солнце в окно
 * @param {Object} sunPosition - { altitude, azimuth } в градусах
 * @param {Object} settings - рабочие настройки
 * @returns {string} строка для журнала
 */
function describeState(sunIsInWindow, sunPosition, settings) {
  const deviation = angularDifference(sunPosition.azimuth, settings.windowAzimuth);
  return (sunIsInWindow ? SERVICE_NAMES.IN_WINDOW : SERVICE_NAMES.NOT_IN_WINDOW) +
    ". Высота " + formatDegrees(sunPosition.altitude) +
    ", азимут " + formatDegrees(sunPosition.azimuth) +
    ", отклонение от окна " + formatDegrees(deviation);
}

// ============================================================================
// УГЛЫ И ЧИСЛА
// ============================================================================

function sinDeg(degrees) {
  return Math.sin(degrees * ANGLE.DEG_TO_RAD);
}

function cosDeg(degrees) {
  return Math.cos(degrees * ANGLE.DEG_TO_RAD);
}

function asinDeg(value) {
  return Math.asin(clampToUnit(value)) * ANGLE.RAD_TO_DEG;
}

function acosDeg(value) {
  return Math.acos(clampToUnit(value)) * ANGLE.RAD_TO_DEG;
}

function atan2Deg(y, x) {
  return Math.atan2(y, x) * ANGLE.RAD_TO_DEG;
}

/**
 * Обрезает аргумент обратной тригонометрии в -1…1. Вырожденная точка (полюс,
 * зенит) даёт 0: азимут там не определён и на решение не влияет.
 */
function clampToUnit(value) {
  if (value !== value) {
    return 0;
  }
  return clamp(value, -1, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Остаток от деления, всегда неотрицательный (штатный % сохраняет знак делимого).
 */
function positiveModulo(value, divisor) {
  const rest = value % divisor;
  return rest < 0 ? rest + divisor : rest;
}

/** Приводит угол к 0…360. */
function normalizeAngle(degrees) {
  return positiveModulo(degrees, ANGLE.FULL_CIRCLE);
}

/** Приводит угол к -180…180. */
function toSignedAngle(degrees) {
  const normalized = normalizeAngle(degrees);
  return normalized > ANGLE.HALF_CIRCLE ? normalized - ANGLE.FULL_CIRCLE : normalized;
}

function isFiniteNumber(value) {
  return typeof value === "number" && isFinite(value);
}

/**
 * Пустое значение опции: значения нет вовсе или строка без видимых символов.
 * @param {*} value - значение опции
 * @returns {boolean} true, если значение считается незаданным
 */
function isBlankOption(value) {
  if (value === undefined || value === null) {
    return true;
  }
  return typeof value === "string" && value.trim().length === 0;
}

/**
 * Приводит значение опции к числу.
 * @param {*} value - значение опции
 * @param {number} fallback - что вернуть, если числа не получилось
 * @returns {number} число, либо fallback
 */
function toNumber(value, fallback) {
  if (isFiniteNumber(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = parseFloat(value);
    if (isFiniteNumber(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function formatDegrees(degrees) {
  return degrees.toFixed(1) + "°";
}

// ============================================================================
// КОНТЕКСТ ИЗМЕНЕНИЯ
// ============================================================================

/**
 * Проверяет, изменил ли характеристику сам сценарий.
 * Формат context: "LOGIC[...] <- C[...] <- LOGIC[...] <- ..."
 * @param {Object} context - контекст изменения характеристики
 * @returns {boolean} true, если изменение сделано этим сценарием
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
 * Проверяет, сработал ли триггер при запуске хаба.
 * @param {Object} context - контекст изменения характеристики
 * @returns {boolean} true, если это старт хаба
 */
function isHubStartup(context) {
  if (!context) return false;
  return context.toString().indexOf(CONTEXT_CONSTANTS.HUB_STARTUP) >= 0;
}

// ============================================================================
// ЛОГИРОВАНИЕ
// ============================================================================

function logInfo(message) {
  console.info(LOG_PREFIX + message);
}

function logError(message) {
  console.error(LOG_PREFIX + message);
}
