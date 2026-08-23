/**
 * Сценарий "Зима/Лето" для Sprut.Hub
 * 
 * Автоматически управляет выключателем в зависимости от сезона года.
 * 
 * Параметры:
 * - Дата включения: дата начала "зимнего" периода (например: "1.12" или "1 декабря")
 * - Дата выключения: дата окончания "зимнего" периода (например: "1.03" или "1 марта")
 * 
 * Поддерживаемые форматы дат:
 * - Цифровой: 1.12, 01.03, 15.6
 * - Текстовый: 1 декабря, 15 марта, 10 сентября
 * 
 * Примеры использования:
 * - Отопление зимой: включение 1.12, выключение 1.03
 * - Кондиционирование летом: включение 1.06, выключение 1.09
 * - Сезонное освещение: включение 1.11, выключение 28.02
 *
 * Кроме срабатывания по изменению выключателя и по старту хаба сценарий
 * регистрирует Cron-задачу на полночь: смена календарной даты сама по себе
 * trigger не вызывает, без задачи переключение в день границы не произойдёт.
 */

// Название сценария с локализацией.
const scenarioName = {
  ru: "❄️☀️ Зима/Лето",
  en: "❄️☀️ Winter/Summer"
};

// Описание сценария для опции-статуса «ОПИСАНИЕ» в UI.
const scenarioDescription = {
  ru: "Включает и выключает выключатель по календарной дате: внутри заданного периода — включён, вне периода — выключен.\n\n" +
    "Даты задаются без года, в формате «день.месяц» (1.12) или текстом («1 декабря»). " +
    "Период может пересекать конец года: 1.12 – 1.03 означает с 1 декабря по 1 марта включительно.\n\n" +
    "Состояние пересчитывается при изменении выключателя, при старте хаба и каждую полночь, поэтому переключение происходит в сам день границы периода.",
  en: "Turns a switch on and off by calendar date: on inside the configured period, off outside it.\n\n" +
    "Dates are set without a year, as \"day.month\" (1.12) or as text (\"1 december\"). " +
    "The period may cross the end of the year: 1.12 – 1.03 means from december 1 to march 1 inclusive.\n\n" +
    "The state is recalculated when the switch changes, on hub startup and every midnight, so switching happens on the boundary day itself."
};

// Имена сервиса для опции «Менять имя сервиса»
const SEASON_NAMES = {
  WINTER: "Зима",
  SUMMER: "Лето"
};

info = {
  name: scenarioName.ru,
  description: "Автоматическое включение/выключение выключателя в зависимости от указанной даты",
  version: "1.2",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On],
  options: {
    desc: {
      name: { ru: "  ОПИСАНИЕ", en: "  DESCRIPTION" },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },
    startDate: {
      type: "String",
      value: "1.12",
      name: { ru: "Дата включения", en: "Start date" },
      desc: { ru: "Дата включения выключателя (день.месяц или текст, например: 1.12 или 1 декабря)", en: "Date to turn on the switch (day.month or text, e.g.: 1.12 or 1 december)" }
    },
    endDate: {
      type: "String",
      value: "1.03",
      name: { ru: "Дата выключения", en: "End date" }, 
      desc: { ru: "Дата выключения выключателя (день.месяц или текст, например: 1.03 или 1 марта)", en: "Date to turn off the switch (day.month or text, e.g.: 1.03 or 1 march)" }
    },
    changeServiceName: {
      type: "Boolean",
      value: false,
      name: { ru: "Менять имя сервиса", en: "Change service name" },
      desc: {
        ru: "Если включено, имя сервиса будет меняться в зависимости от текущего периода (Зима или Лето)",
        en: "If enabled, the service name will change according to the current period (Winter or Summer)"
      }
    },
    invert: {
      type: "Boolean",
      value: false,
      name: { ru: "Инвертировать", en: "Invert" },
      desc: {
        ru: "Если включено, внутри периода выключатель будет выключаться, а вне периода — включаться",
        en: "If enabled, the switch will be turned off inside the period and turned on outside it"
      }
    }
  },
  variables: {
    midnightTask: undefined,      // Cron-задача ежесуточной проверки даты в полночь
    midnightOptionsKey: undefined // Даты, с которыми была создана задача (для пересоздания при их правке)
  }
}

// Расписание ежесуточной проверки даты: каждую полночь (секунды минуты часы * * *)
const MIDNIGHT_CRON_SCHEDULE = "0 0 0 * * *";

// Словарь названий месяцев на русском языке
const monthNames = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
  'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
  'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
};

function trigger(source, value, variables, options, context) {
  console.info('Сценарий "Зима/Лето" запущен');

  applySeasonState(source, options);

  try {
    setupMidnightTask(source, variables, options);
  } catch (error) {
    console.error('Ошибка при настройке полуночной проверки: {}', error.message);
  }
}

/**
 * Парсит дату из строки в различных форматах
 * @param {string} dateString - строка с датой
 * @returns {object} объект с полями day и month
 */
function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Неверный формат даты');
  }
  
  const trimmedDate = dateString.trim();
  
  // Проверяем формат день.месяц (например: 1.12, 01.03, 15.6)
  const dotFormat = /^(\d{1,2})\.(\d{1,2})$/;
  const dotMatch = trimmedDate.match(dotFormat);
  
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10);
    
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      throw new Error('Неверный формат даты: день должен быть от 1 до 31, месяц от 1 до 12');
    }
    
    return { day: day, month: month };
  }
  
  // Проверяем текстовый формат (например: "1 декабря", "15 марта")
  // `\w` без флага `u` не матчит кириллицу — явный диапазон букв.
  const textFormat = /^(\d{1,2})\s+([а-яёА-ЯЁa-zA-Z]+)$/;
  const textMatch = trimmedDate.match(textFormat);
  
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2].toLowerCase();
    
    if (day < 1 || day > 31) {
      throw new Error('Неверный формат даты: день должен быть от 1 до 31');
    }
    
    const month = monthNames[monthName];
    if (!month) {
      throw new Error('Неверное название месяца: ' + textMatch[2]);
    }
    
    return { day: day, month: month };
  }
  
  throw new Error('Неверный формат даты. Используйте формат "день.месяц" или "день месяц"');
}

/**
 * Проверяет, находится ли текущая дата в диапазоне между startDate и endDate
 * Корректно обрабатывает переход между годами
 * @param {object} currentDate - текущая дата {day, month}
 * @param {object} startDate - дата начала {day, month}
 * @param {object} endDate - дата окончания {day, month}
 * @returns {boolean} true если текущая дата в диапазоне
 */
function isDateInRange(currentDate, startDate, endDate) {
  const currentDayOfYear = getDayOfYear(currentDate.month, currentDate.day);
  const startDayOfYear = getDayOfYear(startDate.month, startDate.day);
  const endDayOfYear = getDayOfYear(endDate.month, endDate.day);
  
  // Если диапазон не пересекает год (например, 1.03 - 30.06)
  if (startDayOfYear <= endDayOfYear) {
    return currentDayOfYear >= startDayOfYear && currentDayOfYear <= endDayOfYear;
  }
  
  // Если диапазон пересекает год (например, 1.12 - 1.03)
  return currentDayOfYear >= startDayOfYear || currentDayOfYear <= endDayOfYear;
}

/**
 * Возвращает номер дня в году для указанного месяца и дня
 * @param {number} month - месяц (1-12)
 * @param {number} day - день (1-31)
 * @returns {number} номер дня в году (1-366)
 */
function getDayOfYear(month, day) {
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 29 для февраля (високосный год)
  
  let dayOfYear = 0;
  for (let i = 1; i < month; i++) {
    dayOfYear += daysInMonth[i - 1];
  }
  dayOfYear += day;
  
  return dayOfYear;
}

/**
 * Получает текущую дату без учета года
 * @returns {object} объект с полями day и month
 */
function getCurrentDate() {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1 // getMonth() возвращает 0-11, нам нужно 1-12
  };
}

/**
 * Возвращает имя периода для имени сервиса.
 * Диапазон, пересекающий конец года (1.12 - 1.03), считается зимним,
 * не пересекающий (1.06 - 1.09) — летним.
 * @param {object} startDate - дата начала {day, month}
 * @param {object} endDate - дата окончания {day, month}
 * @param {boolean} isInRange - находится ли текущая дата внутри периода
 * @returns {string} "Зима" или "Лето"
 */
function getSeasonName(startDate, endDate, isInRange) {
  const crossesYear = getDayOfYear(startDate.month, startDate.day) > getDayOfYear(endDate.month, endDate.day);
  const insideName = crossesYear ? SEASON_NAMES.WINTER : SEASON_NAMES.SUMMER;
  const outsideName = crossesYear ? SEASON_NAMES.SUMMER : SEASON_NAMES.WINTER;
  
  return isInRange ? insideName : outsideName;
}

/**
 * Обновляет имя сервиса, если включена опция "Менять имя сервиса"
 * @param {object} service - сервис выключателя
 * @param {object} options - опции сценария
 * @param {string} seasonName - имя текущего периода
 */
function updateServiceName(service, options, seasonName) {
  if (!options.changeServiceName) {
    return;
  }
  
  try {
    service.setName(seasonName);
  } catch (error) {
    console.error('Ошибка при обновлении имени сервиса: {}', error.message);
  }
}

/**
 * Пересчитывает нужное состояние по текущей дате и приводит выключатель к нему
 * @param {object} source - характеристика, вызвавшая срабатывание
 * @param {object} options - опции сценария
 */
function applySeasonState(source, options) {
  try {
    // Получаем текущую дату
    const currentDate = getCurrentDate();
    console.info('Текущая дата: {}.{}', Math.floor(currentDate.day) | 0, Math.floor(currentDate.month) | 0);
    
    // Парсим даты из опций
    const startDate = parseDate(options.startDate);
    const endDate = parseDate(options.endDate);
    
    console.info('Дата включения: {}.{}', Math.floor(startDate.day) | 0, Math.floor(startDate.month) | 0);
    console.info('Дата выключения: {}.{}', Math.floor(endDate.day) | 0, Math.floor(endDate.month) | 0);
    
    // Проверяем, находится ли текущая дата в диапазоне
    const isInRange = isDateInRange(currentDate, startDate, endDate);
    const seasonName = getSeasonName(startDate, endDate, isInRange);
    
    // Инверсия меняет только записываемое значение, но не сам период
    const shouldBeOn = options.invert === true ? !isInRange : isInRange;
    
    console.info('Текущий период: {}. Выключатель должен быть {}', seasonName, shouldBeOn ? 'включен' : 'выключен');
    
    // Получаем аксессуар источника
    const accessory = source.getAccessory();
    const switchService = accessory.getService(HS.Switch);
    
    if (!switchService) {
      console.error('Сервис Switch не найден в аксессуаре {}', accessory.getName());
      return;
    }
    
    const onCharacteristic = switchService.getCharacteristic(HC.On);
    if (!onCharacteristic) {
      console.error('Характеристика On не найдена в сервисе Switch');
      return;
    }
    
    // Получаем текущее состояние
    const currentState = onCharacteristic.getValue();
    
    // Устанавливаем новое состояние если оно отличается от текущего
    if (currentState !== shouldBeOn) {
      console.info('Изменяем состояние выключателя с {} на {}', 
        currentState ? 'включен' : 'выключен', 
        shouldBeOn ? 'включен' : 'выключен');
      
      onCharacteristic.setValue(shouldBeOn);
    } else {
      console.info('Состояние выключателя уже соответствует требуемому: {}', 
        shouldBeOn ? 'включен' : 'выключен');
    }
    
    updateServiceName(switchService, options, seasonName);
    
  } catch (error) {
    console.error('Ошибка в сценарии "Зима/Лето": {}', error.message);
  }
}

/**
 * Регистрирует Cron-задачу, которая каждую полночь пересчитывает состояние.
 * Без неё наступление даты границы диапазона ничего не запускает: trigger
 * вызывается только по изменению выключателя, старту хаба и сохранению сценария.
 * @param {object} source - характеристика, вызвавшая срабатывание
 * @param {object} variables - переменные сценария
 * @param {object} options - опции сценария
 */
function setupMidnightTask(source, variables, options) {
  const optionsKey = [options.startDate, options.endDate, options.invert, options.changeServiceName].join('|');
  
  // Опции изменили и сценарий пересохранили — задача помнит старые, пересоздаём
  if (variables.midnightTask && variables.midnightOptionsKey !== optionsKey) {
    variables.midnightTask.clear();
    variables.midnightTask = undefined;
  }
  
  if (variables.midnightTask) {
    return;
  }
  
  variables.midnightOptionsKey = optionsKey;
  variables.midnightTask = Cron.schedule(MIDNIGHT_CRON_SCHEDULE, function () {
    console.info('Полуночная проверка даты');
    applySeasonState(source, options);
  });
}
