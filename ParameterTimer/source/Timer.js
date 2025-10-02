// Выносим название и описание в переменные для использования в info и options
const scenarioName = {
  ru: "⏰ Параметр-Таймер",
  en: "⏰ Parameter Timer"
};

const scenarioDescription = {
  ru: "Параметр-таймер служит как настраиваемая альтернатива стандартной задержке в сценариях, но интервал можно задавать через интерфейс устройства.\n\nПринцип работы:\nПользователь устанавливает в Дробном значении количество секунд (можно дробное), включает логическое значение и начинается обратный отсчёт. По истечении времени логическое значение отключается.\nТак же рекомендую в настройках устройства - Виртуальное устройство - Дробное значение установить минимальное, максимальное значения и шаг, для того, что бы время можно было выставлять ползунком.\n\nПрименение в сценариях:\nТам, где надо запустить задержку - устанавливаем Логическое значение - да.\nНиже добавляем блок Если (Всё сразу) Целое значение = 0 (триггер) и Логическое значение = Нет (убрать триггер), Тогда - действие, которое надо выполнить после задержки.",
  en: "Parameter-timer serves as a configurable alternative to standard delay in scenarios, but the interval can be set through the device interface.\n\nHow it works:\nUser sets the number of seconds (can be fractional) in Double value, enables logical value and countdown begins. After the time expires, the logical value is disabled.\nIt is also recommended to set minimum, maximum values and step in device settings - Virtual device - Double value, so that time can be set with a slider.\n\nApplication in scenarios:\nWhere you need to start a delay - set Logical value - yes.\nBelow add a block If (All at once) Integer value = 0 (trigger) and Logical value = No (remove trigger), Then - the action to be performed after the delay."
};

/*
 * info - Обязательное поле, описывающее сценарий.
 * Считывается хабом в момент загрузки или сохранения сценария.
 * В коде обращаться к этому объекту запрещено, считать данные с него тоже не получится.
 * Необходимо использовать только значения, которые приходят в функции compute или trigger.
 */
info = {
  name: scenarioName.ru,
  description: scenarioDescription.ru,
  version: "1.0",
  author: "@BOOMikru",
  sourceServices: [HS.C_Option],
  sourceCharacteristics: [HC.C_Boolean, HC.C_Double],

  options: {
    desc: {
      name: { en: "", ru: "" },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },
    changeServiceName: {
      name: {
        en: "Change service name",
        ru: "Менять имя сервиса"
      },
      desc: {
        en: "Show countdown in service name when timer is active",
        ru: "Показывать обратный отсчёт в имени сервиса при активном таймере"
      },
      type: "Boolean",
      value: false
    }
  },

  variables: {
    isTimerRunning: false, // Флаг работы таймера
    countdownInterval: undefined, // ID интервала обратного отсчёта
    countdownTimeout: undefined, // ID таймаута для дробной части
    originalDoubleValue: undefined, // Исходное значение Double параметра
    originalServiceName: undefined, // Исходное имя сервиса
  }
}

// Константы
const TIMER_CONSTANTS = {
  MAX_TIMER_SECONDS: 86400, // 24 часа
  RESTORE_DELAY_MS: 1000,
  TIMER_INTERVAL_MS: 1000,
  FRACTIONAL_MULTIPLIER: 1000, // для конвертации в миллисекунды
  MIN_DISPLAY_VALUE: -1 // для lastDisplayValue
};

// Константы для проверки контекста изменений
const CONTEXT_CONSTANTS = {
  DELIMITER: ' <- ',
  LOGIC_PREFIX: 'LOGIC',
  CHARACTERISTIC_PREFIX: 'C',
  MIN_ELEMENTS: 3
};

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ - ТОЧКА ВХОДА
// ============================================================================

function trigger(source, value, variables, options, context) {
  if (isSelfChanged(context)) return;

  const service = source.getService();
  const characteristics = getRequiredCharacteristics(service);
  if (!characteristics) return;

  // Останавливаем текущий таймер
  stopTimer(variables);

  // Создаём контекст таймера со всеми необходимыми объектами
  const timerContext = createTimerContext(service, characteristics);

  // Обрабатываем изменения в зависимости от типа характеристики
  const characteristicType = source.getType();

  if (characteristicType === HC.C_Boolean) {
    handleBooleanChange(value, timerContext, variables, options);
  } else if (characteristicType === HC.C_Double) {
    handleDoubleChange(value, timerContext, variables, options);
  }
}

// ============================================================================
// ОСНОВНЫЕ ОБРАБОТЧИКИ СОБЫТИЙ - БИЗНЕС-ЛОГИКА
// ============================================================================

/**
 * Обрабатывает изменение Boolean характеристики
 * @param {boolean} value - Новое значение Boolean характеристики
 * @param {Object} context - Контекст таймера
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function handleBooleanChange(value, context, variables, options) {
  if (value === true) {
    saveOriginalServiceName(context.service, variables);
    const doubleValue = context.doubleChar.getValue();

    if (doubleValue > 0) {
      variables.originalDoubleValue = doubleValue;
      const integerSeconds = getIntegerFromDouble(doubleValue);
      updateServiceNameWithCountdown(context.service, variables, options, integerSeconds);
      startTimer(context, doubleValue, variables, options);
    } else {
      console.error(`Параметр-Таймер: нельзя запустить таймер с нулевым или отрицательным значением времени (${doubleValue}). Установите значение больше 0.`);
      context.booleanChar.setValue(false);
    }
  } else {
    restoreOriginalValues(variables, context.integerChar, context.doubleChar);
    restoreServiceName(context.service, variables, options);
  }
}

/**
 * Обрабатывает изменение Double характеристики
 * @param {number} value - Новое значение Double характеристики
 * @param {Object} context - Контекст таймера
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function handleDoubleChange(value, context, variables, options) {
  variables.originalDoubleValue = value;
  setIntegerFromDouble(context.integerChar, value);

  const booleanValue = context.booleanChar.getValue();
  if (booleanValue === true && value > 0) {
    const integerSeconds = getIntegerFromDouble(value);
    updateServiceNameWithCountdown(context.service, variables, options, integerSeconds);
    startTimer(context, value, variables, options);
  }
}

// ============================================================================
// УПРАВЛЕНИЕ ТАЙМЕРОМ - ОСНОВНАЯ ЛОГИКА
// ============================================================================

/**
 * Функция запуска таймера
 * @param {Object} context - Контекст таймера
 * @param {number} seconds - Количество секунд до отключения (может быть дробным)
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function startTimer(context, seconds, variables, options) {
  if (!isValidTimerValue(seconds)) return;

  variables.isTimerRunning = true;
  const intervalId = createCountdownTimer(context, seconds, variables, options);

  // Если нет дробной части, сохраняем ID интервала
  if (intervalId !== undefined) {
    variables.countdownInterval = intervalId;
  }
  // Если есть дробная часть, intervalId будет установлен в setTimeout внутри createCountdownTimer
}

/**
 * Создает и запускает интервал обратного отсчёта
 * @param {Object} context - Контекст таймера
 * @param {number} seconds - Количество секунд
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @returns {number|undefined} ID интервала или undefined
 */
function createCountdownTimer(context, seconds, variables, options) {
  initializeCountdown(context.integerChar, context.service, variables, options, seconds);

  const fractionalPart = seconds - getIntegerFromDouble(seconds);

  if (fractionalPart > 0) {
    startFractionalTimer(context, seconds, fractionalPart, variables, options);
    return undefined; // Возвращаем undefined, так как реальный interval будет создан в setTimeout
  } else {
    return startRegularTimer(context, seconds, variables, options);
  }
}

/**
 * Запускает таймер с дробной частью
 * @param {Object} context - Контекст таймера
 * @param {number} seconds - Общее количество секунд
 * @param {number} fractionalPart - Дробная часть в секундах
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function startFractionalTimer(context, seconds, fractionalPart, variables, options) {
  const fractionalMs = Math.round(fractionalPart * TIMER_CONSTANTS.FRACTIONAL_MULTIPLIER);
  const remainingSeconds = seconds - fractionalPart;

  variables.countdownTimeout = setTimeout(() => {
    const countdownFunction = createCountdownFunction(context, remainingSeconds, variables, options);
    variables.countdownInterval = setInterval(countdownFunction, TIMER_CONSTANTS.TIMER_INTERVAL_MS);
  }, fractionalMs);
}

/**
 * Запускает обычный таймер без дробной части
 * @param {Object} context - Контекст таймера
 * @param {number} seconds - Количество секунд
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @returns {number} ID интервала
 */
function startRegularTimer(context, seconds, variables, options) {
  const countdownFunction = createCountdownFunction(context, seconds, variables, options);
  return setInterval(countdownFunction, TIMER_CONSTANTS.TIMER_INTERVAL_MS);
}

/**
 * Создает функцию обратного отсчёта каждую секунду
 * @param {Object} context - Контекст таймера
 * @param {number} initialSeconds - Начальное количество секунд
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @returns {Function} Функция обратного отсчёта
 */
function createCountdownFunction(context, initialSeconds, variables, options) {
  let remainingSeconds = initialSeconds; // Создаем локальную копию
  let lastDisplayValue = TIMER_CONSTANTS.MIN_DISPLAY_VALUE;

  return () => {
    remainingSeconds -= 1; // Уменьшаем на 1 секунду

    lastDisplayValue = updateCountdownDisplay(context.integerChar, context.service, variables, options, remainingSeconds, lastDisplayValue);

    if (remainingSeconds <= 0) {
      finishTimer(context, variables, options);
    }
  };
}

/**
 * Завершает работу таймера
 * @param {Object} context - Контекст таймера
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function finishTimer(context, variables, options) {
  stopTimer(variables);

  context.booleanChar.setValue(false);
  restoreServiceName(context.service, variables, options);
  restoreOriginalValues(variables, context.integerChar, context.doubleChar);
}

/**
 * Останавливает интервал обратного отсчёта
 * @param {Object} variables - Переменные сценария
 */
function stopTimer(variables) {
  if (variables.countdownInterval) {
    clearInterval(variables.countdownInterval);
    variables.countdownInterval = undefined;
  }

  if (variables.countdownTimeout) {
    clearTimeout(variables.countdownTimeout);
    variables.countdownTimeout = undefined;
  }

  variables.isTimerRunning = false;
}

// ============================================================================
// ОТОБРАЖЕНИЕ И UI - РАБОТА С ИНТЕРФЕЙСОМ
// ============================================================================

/**
 * Инициализирует отображение обратного отсчёта
 * @param {Characteristic} integerChar - Integer характеристика
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @param {number} seconds - Количество секунд
 */
function initializeCountdown(integerChar, service, variables, options, seconds) {
  const integerSeconds = getIntegerFromDouble(seconds);
  integerChar.setValue(integerSeconds);
  updateServiceNameWithCountdown(service, variables, options, integerSeconds);
}

/**
 * Обновляет отображение обратного отсчёта
 * @param {Characteristic} integerChar - Integer характеристика
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @param {number} remainingSeconds - Оставшиеся секунды
 * @param {number} lastDisplayValue - Последнее отображаемое значение
 * @returns {number} Новое значение lastDisplayValue
 */
function updateCountdownDisplay(integerChar, service, variables, options, remainingSeconds, lastDisplayValue) {
  const currentIntegerSeconds = getIntegerFromDouble(remainingSeconds);

  if (currentIntegerSeconds === lastDisplayValue) {
    return lastDisplayValue;
  }

  integerChar.setValue(currentIntegerSeconds);

  if (currentIntegerSeconds > 0) {
    updateServiceNameWithCountdown(service, variables, options, currentIntegerSeconds);
  }

  return currentIntegerSeconds;
}

/**
 * Сохраняет исходное имя сервиса
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 */
function saveOriginalServiceName(service, variables) {
  const currentName = service.getName();
  const trimmedName = currentName ? currentName.trim() : '';

  if (trimmedName) {
    variables.originalServiceName = currentName;
  }
}

/**
 * Обновляет имя сервиса с префиксом состояния
 * @param {Service} service - Сервис
 * @param {boolean} isActive - Активен ли таймер
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @param {number} remainingSeconds - Оставшиеся секунды (опционально)
 */
function updateServiceName(service, isActive, variables, options, remainingSeconds) {
  if (!options.changeServiceName || !variables.originalServiceName) {
    return;
  }

  const newName = isActive && remainingSeconds !== undefined
    ? `${remainingSeconds} - ${variables.originalServiceName}`
    : variables.originalServiceName;

  service.setName(newName);
}

/**
 * Обновляет имя сервиса с обратным отсчётом
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @param {number} seconds - Оставшиеся секунды
 */
function updateServiceNameWithCountdown(service, variables, options, seconds) {
  updateServiceName(service, true, variables, options, seconds);
}

/**
 * Восстанавливает исходное имя сервиса
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function restoreServiceName(service, variables, options) {
  if (!options.changeServiceName || !variables.originalServiceName) return;

  service.setName(variables.originalServiceName);
  variables.originalServiceName = undefined;
}

/**
 * Восстанавливает исходные значения характеристик
 * @param {Object} variables - Переменные сценария
 * @param {Characteristic} integerChar - Integer характеристика
 * @param {Characteristic} doubleChar - Double характеристика
 */
function restoreOriginalValues(variables, integerChar, doubleChar) {
  if (variables.originalDoubleValue === undefined) return;

  setTimeout(() => {
    doubleChar.setValue(variables.originalDoubleValue);
    setIntegerFromDouble(integerChar, variables.originalDoubleValue);
    variables.originalDoubleValue = undefined;
  }, TIMER_CONSTANTS.RESTORE_DELAY_MS);
}

// ============================================================================
// ПРОВЕРКИ И ВАЛИДАЦИЯ
// ============================================================================

/**
 * Проверяет, изменилась ли характеристика самим сценарием
 * Формат context: "LOGIC_ID <- C_TYPE <- LOGIC_ID"
 * @param {Object} context - Контекст изменения характеристики
 * @returns {boolean} true если изменение было сделано сценарием
 */
function isSelfChanged(context) {
  const elements = context.toString().split(CONTEXT_CONSTANTS.DELIMITER);
  return elements.length >= CONTEXT_CONSTANTS.MIN_ELEMENTS &&
    elements[0].startsWith(CONTEXT_CONSTANTS.LOGIC_PREFIX) &&
    elements[1].startsWith(CONTEXT_CONSTANTS.CHARACTERISTIC_PREFIX) &&
    elements[2] === elements[0];
}

/**
 * Проверяет корректность значения таймера
 * @param {number} seconds - Количество секунд
 * @returns {boolean} true если значение корректно
 */
function isValidTimerValue(seconds) {
  if (typeof seconds !== 'number') {
    console.error(`Параметр-Таймер: ожидается число, получено: ${typeof seconds}`);
    return false;
  }

  if (!isFinite(seconds)) {
    console.error(`Параметр-Таймер: значение должно быть конечным числом: ${seconds}`);
    return false;
  }

  if (seconds <= 0) {
    console.error(`Параметр-Таймер: значение должно быть больше 0: ${seconds}`);
    return false;
  }

  if (seconds > TIMER_CONSTANTS.MAX_TIMER_SECONDS) {
    console.error(`Параметр-Таймер: значение превышает максимум: ${seconds} > ${TIMER_CONSTANTS.MAX_TIMER_SECONDS}`);
    return false;
  }

  return true;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ - УТИЛИТЫ
// ============================================================================

/**
 * Получает все необходимые характеристики из сервиса
 * @param {Service} service - Сервис
 * @returns {Object|null} Объект с характеристиками или null при ошибке
 */
function getRequiredCharacteristics(service) {
  const booleanChar = service.getCharacteristic(HC.C_Boolean);
  const integerChar = service.getCharacteristic(HC.C_Integer);
  const doubleChar = service.getCharacteristic(HC.C_Double);

  if (!booleanChar || !integerChar || !doubleChar) {
    console.error("Параметр-Таймер: В сервисе не найдены все необходимые характеристики Логическое значение (C_Boolean), Целое значение (C_Integer) и Дробное значение (C_Double)");
    return null;
  }

  return { booleanChar, integerChar, doubleChar };
}

/**
 * Создаёт контекст таймера со всеми необходимыми объектами
 * @param {Service} service - Сервис
 * @param {Object} characteristics - Объект с характеристиками
 * @returns {Object} Контекст таймера
 */
function createTimerContext(service, characteristics) {
  return {
    service: service,
    booleanChar: characteristics.booleanChar,
    integerChar: characteristics.integerChar,
    doubleChar: characteristics.doubleChar
  };
}

/**
 * Получает целое значение из дробного
 * @param {number} doubleValue - Дробное значение
 * @returns {number} Целое значение
 */
function getIntegerFromDouble(doubleValue) {
  return Math.floor(doubleValue);
}

/**
 * Устанавливает целое значение из дробного
 * @param {Characteristic} integerChar - Integer характеристика
 * @param {number} doubleValue - Дробное значение
 */
function setIntegerFromDouble(integerChar, doubleValue) {
  integerChar.setValue(getIntegerFromDouble(doubleValue));
}
