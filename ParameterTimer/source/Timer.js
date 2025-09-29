// Выносим название и описание в переменные для использования в info и options
let scenarioName = {
  ru: "⏰ Параметр-Таймер",
  en: "⏰ Parameter Timer"
};

let scenarioDescription = {
  ru: "Автоматически отключает Boolean параметр через заданное количество секунд из Integer параметра.\n\nПринцип работы:\n• При включении Boolean (true) запускается таймер на время из Integer\n• При изменении Integer во время работы - таймер перезапускается\n• При изменении Boolean во время работы - таймер останавливается или перезапускается\n• По истечении времени Boolean автоматически отключается (false)",
  en: "Automatically turns off Boolean parameter after specified number of seconds from Integer parameter.\n\nHow it works:\n• When Boolean is turned on (true), timer starts for Integer seconds\n• When Integer changes during operation - timer restarts\n• When Boolean changes during operation - timer stops or restarts\n• After timeout Boolean automatically turns off (false)"
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
  sourceCharacteristics: [HC.C_Boolean, HC.C_Integer],

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
    originalIntegerValue: undefined, // Исходное значение Integer параметра
    originalServiceName: undefined, // Исходное имя сервиса
  }
}

function trigger(source, value, variables, options, context) {
  // Проверяем, не изменили ли мы характеристику сами
  if (isSelfChanged(context)) {
    return;
  }

  let service = source.getService();
  let characteristicType = source.getType();

  // Получаем характеристики один раз и кэшируем
  let booleanChar = service.getCharacteristic(HC.C_Boolean);
  let integerChar = service.getCharacteristic(HC.C_Integer);

  if (!booleanChar || !integerChar) {
    console.error("В сервисе не найдены необходимые характеристики C_Boolean и C_Integer");
    return;
  }

  // Останавливаем текущий таймер, если он запущен
  stopTimer(variables);

  // Проверяем какая характеристика изменилась и выполняем соответствующие действия
  if (characteristicType === HC.C_Boolean) {
    if (value === true) {
      saveOriginalServiceName(service, variables);
      // Boolean включен - запускаем таймер если Integer > 0
      let integerValue = integerChar.getValue();
      if (integerValue > 0) {
        variables.originalIntegerValue = integerValue;
        // Обновляем имя сервиса с обратным отсчётом
        updateServiceName(service, true, variables, options, integerValue);
        startTimer(booleanChar, integerValue, variables, options, service);
      } else {
        // Ошибка: значение Integer <= 0
        console.error(`Параметр-Таймер: нельзя запустить таймер с нулевым или отрицательным значением времени (${integerValue}). Установите значение больше 0.`);
        // Отключаем Boolean обратно
        booleanChar.setValue(false);
      }
    } else {
      // Boolean отключен - восстанавливаем исходные значения
      restoreOriginalValues(variables, integerChar, service, options);
      // Восстанавливаем исходное имя сервиса
      restoreServiceName(service, variables, options);
    }

  } else if (characteristicType === HC.C_Integer) {
    // Всегда сохраняем исходное значение Integer при его изменении
    variables.originalIntegerValue = value;

    // Если есть C_Double, устанавливаем в него то же значение
    let doubleChar = service.getCharacteristic(HC.C_Double);
    if (doubleChar) {
      doubleChar.setValue(value);
    }

    let booleanValue = booleanChar.getValue();
    if (booleanValue === true && value > 0) {
      // Boolean включен и новое значение Integer > 0 - перезапускаем таймер
      // Сразу обновляем имя сервиса с новым временем
      updateServiceName(service, true, variables, options, value);
      startTimer(booleanChar, value, variables, options, service);
    }
  }
}

/**
 * Проверяет, изменилась ли характеристика самим сценарием
 * @param {Object} context - Контекст изменения характеристики
 * @returns {boolean} true если изменение было сделано сценарием
 */
function isSelfChanged(context) {
  let selfChanged = false;
  const elements = context.toString().split(' <- ');
  if (elements.length >= 3 &&
    elements[0].startsWith('LOGIC') &&
    elements[1].startsWith('C') &&
    elements[2] == elements[0]) {
    selfChanged = true;
  }
  return selfChanged;
}

/**
 * Сохраняет исходное имя сервиса
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 */
function saveOriginalServiceName(service, variables) {
  let currentName = service.getName();
  if (currentName && currentName !== null && currentName.trim() !== "") {
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
  if (!options.changeServiceName) {
    return;
  }

  // Проверяем, что у нас есть исходное имя сервиса
  if (!variables.originalServiceName) {
    console.warn("Параметр-Таймер: не удалось получить исходное имя сервиса");
    return;
  }

  if (isActive && remainingSeconds !== undefined) {
    // При активном таймере показываем обратный отсчёт
    let newName = remainingSeconds + " - " + variables.originalServiceName;
    service.setName(newName);
  } else {
    // При выключенном таймере показываем исходное имя
    service.setName(variables.originalServiceName);
  }
}

/**
 * Восстанавливает исходное имя сервиса
 * @param {Service} service - Сервис
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 */
function restoreServiceName(service, variables, options) {
  if (!options.changeServiceName || !variables.originalServiceName) {
    return;
  }

  service.setName(variables.originalServiceName);
  variables.originalServiceName = undefined;
}

/**
 * Останавливает интервал обратного отсчёта
 * @param {Object} variables - Переменные сценария
 */
function stopTimer(variables) {
  if (variables.countdownInterval) {
    clearInterval(variables.countdownInterval);
    variables.countdownInterval = undefined;
    variables.isTimerRunning = false;
  }
}

/**
 * Восстанавливает исходные значения характеристик
 * @param {Object} variables - Переменные сценария
 * @param {Characteristic} integerChar - Integer характеристика
 * @param {Service} service - Сервис
 */
function restoreOriginalValues(variables, integerChar, service, options) {
  // Восстанавливаем исходное значение Integer с задержкой в 1 секунду
  if (variables.originalIntegerValue !== undefined) {
    setTimeout(function () {
      integerChar.setValue(variables.originalIntegerValue);
      
      // Если есть C_Double, устанавливаем в него то же значение
      let doubleChar = service.getCharacteristic(HC.C_Double);
      if (doubleChar) {
        doubleChar.setValue(variables.originalIntegerValue);
      }
      
      variables.originalIntegerValue = undefined;
    }, 1000);
  }
}

/**
 * Функция запуска таймера
 * @param {Characteristic} booleanChar - Boolean характеристика для отключения
 * @param {number} seconds - Количество секунд до отключения
 * @param {Object} variables - Переменные сценария
 * @param {Object} options - Опции сценария
 * @param {Service} service - Сервис
 */
function startTimer(booleanChar, seconds, variables, options, service) {
  // Проверяем корректность значения
  if (typeof seconds !== 'number' || seconds <= 0 || !isFinite(seconds) || seconds > 86400) {
    console.error(`Параметр-Таймер: некорректное значение времени: ${seconds} (допустимо: 1-86400 секунд)`);
    return;
  }

  variables.isTimerRunning = true;

  // Получаем характеристики один раз для оптимизации
  let integerChar = service.getCharacteristic(HC.C_Integer);
  let doubleChar = service.getCharacteristic(HC.C_Double);
  
  // Определяем, какую характеристику использовать для обратного отсчёта
  let useDoubleForCountdown = doubleChar !== null;

  // Запускаем единый интервал обратного отсчёта
  let remainingSeconds = seconds;
  let lastDisplayValue = -1; // Для предотвращения лишних обновлений

  // Сразу обновляем отображение при запуске таймера
  if (useDoubleForCountdown) {
    doubleChar.setValue(remainingSeconds);
  } else {
    integerChar.setValue(remainingSeconds);
  }

  // Обновляем имя сервиса с обратным отсчётом
  updateServiceName(service, true, variables, options, remainingSeconds);
  lastDisplayValue = remainingSeconds;

  variables.countdownInterval = setInterval(function () {
    remainingSeconds--;

    // Обновляем отображение только при изменении значения
    if (remainingSeconds !== lastDisplayValue) {
      // Обновляем значение в соответствующей характеристике
      if (useDoubleForCountdown) {
        doubleChar.setValue(remainingSeconds);
      } else {
        integerChar.setValue(remainingSeconds);
      }

      // Обновляем имя сервиса с обратным отсчётом только если время > 0
      if (remainingSeconds > 0) {
        updateServiceName(service, true, variables, options, remainingSeconds);
      }

      lastDisplayValue = remainingSeconds;
    }

    // Проверяем завершение времени
    if (remainingSeconds <= 0) {
      // Останавливаем интервал
      clearInterval(variables.countdownInterval);
      variables.countdownInterval = undefined;
      variables.isTimerRunning = false;

      // Отключаем Boolean параметр
      booleanChar.setValue(false);

      // Сразу восстанавливаем исходное имя сервиса
      restoreServiceName(service, variables, options);

      // Восстанавливаем исходные значения
      restoreOriginalValues(variables, integerChar, service, options);
    }
  }, 1000);
}

