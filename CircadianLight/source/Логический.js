info = {
  name: "Циркадное освещение",
  description: "Устанавливает температуру и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/CircadianLight и в канале https://t.me/smart_sputnik",
  version: "7.0",
  author: "@BOOMikru",

  active: true,
  onStart: true,
  sync: false,

  sourceServices: [HS.Lightbulb],
  sourceCharacteristics: [HC.On, HC.Brightness, HC.ColorTemperature, HC.Hue, HC.Saturation],

  options: {
    Preset: {
      name: {
        en: "Preset",
        ru: "Режим работы"
      },
      desc: {
        en: "Can change in Params global scenario",
        ru: "Изменить или добавить режим можно в глобальном сценарии 'Циркадное освещение. Глобальный. Параметры'"
      },
      type: "Integer",
      value: 0,
      formType: "list",
      values: global.getCircadianLightModes()
    },
    WhatChange: {
      name: {
        en: "What сhange",
        ru: "Что изменять"
      },
      type: "Integer",
      value: 0,
      formType: "list",
      values: [
        { value: 0, name: { en: "Brightness and temperature", ru: "Яркость и цветовую температуру" } },
        { value: 1, name: { en: "Brightness", ru: "Только яркость" } },
        { value: 2, name: { en: "Temperature", ru: "Только цветовую температуру" } }
      ]
    },
    Behavior: {
      name: {
        en: "Behavior characteristic changes",
        ru: "Поведение при изменении характеристики (яркости или температуры)"
      },
      type: "Integer",
      value: 0,
      formType: "list",
      values: [
        { value: 0, name: { en: "StopChar", ru: "Останавливать автоматическое изменение характеристики" } },
        { value: 1, name: { en: "StopCircade", ru: "Останавливать циркадный режим" } },
        { value: 2, name: { en: "Ignore", ru: "Игнорировать (в каждые 5 минут по часам будет восстанавливаться)" } },
        { value: 3, name: { en: "Restore", ru: "Восстановить циркадное значение сразу" } }
      ]
    },
    SmoothOnTime: {
      name: {
        en: "Smooth on time (seconds)",
        ru: "Время плавного включения (секунды)"
      },
      desc: {
        en: "Time in seconds for smooth brightness transition when turning on. Set to 0 to disable. It is better to use the lamp's built-in setting if available.",
        ru: "Время в секундах для плавного изменения яркости при включении. Установите 0 для отключения. Лучше использовать встроенную настройку лампы, если она доступна. Не использовать, если к этой лампе привязаны другие"
      },
      type: "Integer",
      value: 0,
    },
    LinkedBehavior: {
      name: {
        en: "Behavior linked lamp",
        ru: "Поведение при изменении характеристики у связанной лампы"
      },
      desc: {
        en: "For example, when the circadian mode is activated in a chandelier that consists of 5 smart lamps. Not use if no has linked lamps",
        ru: "Например когда циркадный режим активируется у люстры, которая состоит из 5 умных ламп. Не используется, если нет связанных ламп."
      },
      type: "Integer",
      value: 0,
      formType: "list",
      values: [
        { value: 0, name: { en: "Stop", ru: "Останавливать автоматическое изменение характеристики" } },
        { value: 1, name: { en: "Ignore", ru: "Игнорировать" } },
        { value: 2, name: { en: "Restore", ru: "Восстановить циркадное значение" } }
      ]
    },
    RandomSeconds: {
      name: {
        en: "Random change time",
        ru: "Случайное время изменения"
      },
      desc: {
        en: "By default, the values ​​are set by the hour every 5 minutes. With this parameter, the value will be set to 5 minutes and 0-60 seconds. It is necessary if the script is activated for many lamps, to avoid the error 'The execution queue cannot be more than 5 values'",
        ru: "По умолчанию значения устанавливаются по часам каждые 5 минут. С этим параметром значение будет устанавливаться в 5 минут и 0-59 секунд. Необходимо если сценарий активирован у многих ламп, чтобы избежать ошибки 'Очередь на выполнение не может быть больше 5-и значений'"
      },
      type: "Boolean",
      value: false
    },
    ChangeTempDelay: {
      name: {
        en: "Change temp after bright",
        ru: "Менять температуру после яркости"
      },
      desc: {
        en: "Set color temperature after one second  It is necessary if the script is activated for many lamps, to avoid the error 'The execution queue cannot be more than 5 values'",
        ru: "Устанавливать цветовую температуру через одну секунду после установки яркости. Необходимо если сценарий активирован у многих ламп, чтобы избежать ошибки 'Очередь на выполнение не может быть больше 5-и значений'"
      },
      type: "Boolean",
      value: false
    },
    Debug: {
      name: {
        en: "Debug",
        ru: "Отладка"
      },
      type: "Boolean",
      value: false
    }
  },

  variables: {
    // Параметры запуска
    startParameter: {
      brightAtStart: -1,
      isTurnOnByBright: false,
      isTurnOnByTemp: false,
      isTurnOnByHue: false,
      isTurnOnBySat: false
    },
    // Параметры плавного включения
    smoothOn: {
      target: 1,
      active: false,
      task: undefined,
    },
    // Задача на обновление значения циркады
    cronTask: undefined,
    // Изменение параметров
    changed: {
      // Яркость изменена вручную
      bright: false,
      // Температура изменена вручную
      temp: false,
      // Оттенок изменен вручную
      hue: false,
      // Насыщенность изменена вручную
      sat: false,
    },
    disabled: false,
    runtime: {
      stopped: false,
      dontChangeBright: false,
      dontChangeTemp: false,
      dontChangeHue: false,
      dontChangeSat: false,
    }
  }
}

// Константы для временных интервалов (в миллисекундах)
const LAMP_TOGGLE_DELAY_MS = 1000;
const LINKED_LAMP_THRESHOLD_MS = 1500;
const SMOOTH_BRIGHTNESS_INTERVAL_MS = 100;
const DEBUG_TITLE = "Циркадное освещение. ";
const CIRCADIAN_CALLBACKS_GV = "CircadianLight_Callbacks";


function trigger(source, value, variables, options, context) {
  const service = source.getService();
  const isOn = source.getType() === HC.On;
  const isDebug = options.Debug;

  registerCircadianCallback(source, service, variables, options, isDebug);

  if (isOn && !value) {
    handleLampTurnOff(source, variables, options);
    return;
  }

  const disabled = variables.disabled === true || variables.runtime.stopped === true;
  if (disabled) return;

  // Проверка способа включения
  if (isOn && value) {
    detectTurnOnMethod(source, service, context, variables, isDebug);
  }

  const isBright = source.getType() === HC.Brightness;
  const isTemp = source.getType() === HC.ColorTemperature;
  const isHue = source.getType() === HC.Hue;
  const isSaturation = source.getType() === HC.Saturation;
  if (isBright || isTemp || isHue || isSaturation) {
    const shouldReturn = handleCharacteristicChange(source, service, value, context, variables, options, isDebug);
    if (shouldReturn) return;
  }

  if (isOn) {
    if (value) {
      runCircadianOnLampTurnOn(source, service, variables, options, isDebug);
    } else {
      stop(source, variables, options);
      reset(variables);
    }
  }
}

/**
 * По строке linkedUUID (формат "aid.sid.cid") возвращает { service, characteristic } или null при ошибке.
 */
function getLinkedServiceAndCharacteristic(linkedUUID) {
  if (!linkedUUID) return null;
  const uuidParts = linkedUUID.split(".");
  if (uuidParts.length < 3) {
    console.error(DEBUG_TITLE + "Некорректный UUID связанной лампы: {}", linkedUUID);
    return null;
  }
  const aid = uuidParts[0];
  const sid = uuidParts[1];
  const cid = uuidParts[2];
  const linkedAccessory = Hub.getAccessory(aid);
  if (!linkedAccessory) {
    console.error(DEBUG_TITLE + "Аксессуар {} не найден", aid);
    return null;
  }
  const linkedService = linkedAccessory.getService(sid);
  if (!linkedService) {
    console.error(DEBUG_TITLE + "Сервис {} не найден у аксессуара {}", sid, aid);
    return null;
  }
  const linkedCharacteristic = linkedService.getCharacteristic(cid);
  if (!linkedCharacteristic) {
    console.error(DEBUG_TITLE + "Характеристика {} не найдена у сервиса {}.{}", cid, aid, sid);
    return null;
  }
  return { service: linkedService, characteristic: linkedCharacteristic };
}

/**
 * Обработка изменения яркости/температуры/оттенка/насыщенности.
 * Возвращает true, если trigger должен завершиться (return).
 */
function handleCharacteristicChange(source, service, value, context, variables, options, isDebug) {
  const changeReason = getChangeReason(context, source.getUUID());
  const behavior = options.Behavior;
  const ignoreFromLinked = options.LinkedBehavior === 1 || changeReason.auto ||
    (options.LinkedBehavior !== 2 && variables.lastSetTime && (Date.now() - variables.lastSetTime < LINKED_LAMP_THRESHOLD_MS));

  if (changeReason.byLinkedLamp) {
    if (ignoreFromLinked) return true;
    if (!changeReason.linkedUUID || !isLampOn(service)) return false;
    const linked = getLinkedServiceAndCharacteristic(changeReason.linkedUUID);
    if (!linked) return true;
    const linkedCharType = linked.characteristic.getType();
    if (options.LinkedBehavior === 2) {
      setCircadianValue(linked.service, variables, options, true, linkedCharType);
      return true;
    }
    if (options.LinkedBehavior === 0) {
      applyManualChangeFlags(source, changeReason, variables, options, isDebug, true);
      setRuntimeDontChangeAndMaybeStop(source, variables, options, isDebug, value, context);
      return false;
    }
    return false;
  }

  if (behavior === 3) {
    const lastSetTime = variables.lastSetTime;
    if (lastSetTime && ((Date.now() - lastSetTime) > LINKED_LAMP_THRESHOLD_MS) && !changeReason.auto) {
      setCircadianValue(service, variables, options, options.Debug);
    }
    debug("Значение изменилось. Восстанавливаем.", source, isDebug, value, context);
    return true;
  }

  applyManualChangeFlags(source, changeReason, variables, options, isDebug, false);
  setRuntimeDontChangeAndMaybeStop(source, variables, options, isDebug, value, context);
  return checkStopCircadianAfterManualChange(source, variables, options, isDebug, behavior);
}

/** Выставляет variables.changed.* в зависимости от контекста и поведения. */
function applyManualChangeFlags(source, changeReason, variables, options, isDebug, stopChange) {
  const behavior = options.Behavior;
  const isBright = source.getType() === HC.Brightness;
  const isTemp = source.getType() === HC.ColorTemperature;
  const isHue = source.getType() === HC.Hue;
  const isSaturation = source.getType() === HC.Saturation;
  const autoChange = changeReason.auto;
  if (behavior !== 0 && behavior !== 1 && !stopChange) return;

  if (variables.startParameter.isTurnOnByBright) variables.changed.bright = true;
  if (variables.startParameter.isTurnOnByTemp) variables.changed.temp = true;
  if (!autoChange && isBright && !variables.changed.bright && !variables.smoothOn.active) variables.changed.bright = true;
  if (!autoChange && isTemp && !variables.changed.temp) variables.changed.temp = true;
  if (!autoChange && isHue && !variables.changed.hue) { variables.changed.hue = true; variables.changed.temp = true; }
  if (!autoChange && isSaturation && !variables.changed.sat) { variables.changed.sat = true; variables.changed.temp = true; }
}

/** Выставляет runtime.dontChange* и пишет в лог при ручном изменении. */
function setRuntimeDontChangeAndMaybeStop(source, variables, options, isDebug, value, context) {
  const isBright = source.getType() === HC.Brightness;
  const isTemp = source.getType() === HC.ColorTemperature;
  const isHue = source.getType() === HC.Hue;
  const isSaturation = source.getType() === HC.Saturation;
  if (isBright && variables.changed.bright) {
    debug("Яркость изменена вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context);
    variables.runtime.dontChangeBright = true;
  }
  if (isTemp && variables.changed.temp) {
    debug("Температура изменена вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context);
    variables.runtime.dontChangeTemp = true;
  }
  if (isHue && variables.changed.hue) {
    debug("Оттенок изменен вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context);
    variables.runtime.dontChangeHue = true;
    variables.runtime.dontChangeTemp = true;
  }
  if (isSaturation && variables.changed.sat && !variables.runtime.dontChangeSat) {
    debug("Насыщенность изменена вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context);
    variables.runtime.dontChangeSat = true;
    variables.runtime.dontChangeTemp = true;
  }
}

/** Проверяет, нужно ли остановить циркаду после ручного изменения. Возвращает true, если trigger должен завершиться. */
function checkStopCircadianAfterManualChange(source, variables, options, isDebug, behavior) {
  if (variables.cronTask && variables.changed.bright && (variables.changed.temp || (variables.changed.hue && variables.changed.sat))) {
    debug("Все параметры, которые могли меняться в циркадном режиме изменены и больше не будут меняться. Останавливаем циркадный режим", source, isDebug);
    stop(source, variables, options);
    variables.runtime.stopped = true;
    return true;
  }
  if (behavior === 1 && variables.cronTask && (variables.changed.bright || variables.changed.temp || variables.changed.hue || variables.changed.sat)) {
    debug("Включено свойство 'Останавливать циркадный режим после изменения любого параметра'. Параметр был изменён, циркадный режим остановлен", source, isDebug);
    stop(source, variables, options);
    variables.runtime.stopped = true;
    return true;
  }
  return false;
}

/**
 * Логика при включении лампы: начальная установка циркады, плавное включение, запуск cron.
 */
function runCircadianOnLampTurnOn(source, service, variables, options, isDebug) {
  const brightness = source.getService().getCharacteristic(HC.Brightness);
  if (brightness === null) {
    console.error(DEBUG_TITLE + "Лампочка не умеет изменять яркость", source, isDebug);
    return;
  }
  const enableBrightByWhatChange = options.WhatChange === 0 || options.WhatChange === 1;
  const enableTempByWhatChange = options.WhatChange === 0 || options.WhatChange === 2;
  const installStartBright = enableBrightByWhatChange && !variables.startParameter.isTurnOnByBright && !variables.changed.bright && !options.SmoothOnTime;
  const installStartTemp = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.changed.temp;
  const installStartHue = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.startParameter.isTurnOnByHue && !variables.changed.temp;
  const installStartSat = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.startParameter.isTurnOnBySat && !variables.changed.temp;

  if (!installStartBright && !installStartTemp) {
    debug("==== НЕ ЗАПУЩЕН ==== Циркадный режим не запущен, так как при включении лампы были изменены яркость и температура", source, isDebug);
    stop(source, variables, options, true);
    reset(variables);
    variables.runtime.stopped = true;
    return;
  }

  if (installStartBright || installStartTemp || installStartHue || installStartSat) {
    variables.lastSetTime = Date.now();
    const isSet = global.setCircadianLightForService(service, options.Preset, !installStartBright, !installStartTemp, !installStartHue, !installStartSat, options.ChangeTempDelay, isDebug, true, true);
    if (!isSet) {
      stop(source, variables, options);
      reset(variables);
      variables.runtime.stopped = true;
    }
  }

  const brightCharacteristic = service.getCharacteristic(HC.Brightness);
  const smoothTime = options.SmoothOnTime || 0;
  if (!variables.changed.bright && !variables.startParameter.isTurnOnByBright && enableBrightByWhatChange && smoothTime > 0) {
    const circadianValue = global.getCircadianLight(options.Preset, service.getUUID());
    const brightAtStart = variables.startParameter.brightAtStart;
    const target = brightAtStart > 0 ? brightAtStart : circadianValue[1];
    if (target > 1) {
      variables.smoothOn.active = true;
      let currentBr = 1;
      brightCharacteristic.setValue(currentBr);
      const steps = (smoothTime * 1000) / SMOOTH_BRIGHTNESS_INTERVAL_MS;
      const increaseBy = (target - currentBr) / steps;
      const interval = setInterval(function () {
        try {
          if (currentBr >= target || !service.getCharacteristic(HC.On).getValue()) {
            clearInterval(interval);
            variables.smoothOn.task = undefined;
            variables.smoothOn.active = false;
            if (currentBr >= target) brightCharacteristic.setValue(target);
          } else {
            currentBr += increaseBy;
            currentBr = Math.min(currentBr, target);
            brightCharacteristic.setValue(Math.round(currentBr));
          }
        } catch (error) {
          console.error("Циркадное освещение. Ошибка в smooth on task:", error);
          clearInterval(interval);
          variables.smoothOn.active = false;
          variables.smoothOn.task = undefined;
        }
      }, SMOOTH_BRIGHTNESS_INTERVAL_MS);
      variables.smoothOn.task = interval;
    }
  }
  restartCron(source, variables, options);
}

// Регистрация коллбека и обработка событий enable / disable / reset (хендлер получает action, data)
function registerCircadianCallback(source, service, variables, options, isDebug) {
  let gv = GlobalVariables[CIRCADIAN_CALLBACKS_GV];
  if (!gv || !gv.handlers) {
    // Самоинициализация: не зависим от порядка загрузки глобального (фикс рестарта).
    gv = GlobalVariables[CIRCADIAN_CALLBACKS_GV] = { handlers: {} };
  }
  const serviceUUID = service.getUUID();

  gv.handlers[serviceUUID] = function (action, data) {
    if (!data) data = {};
    if (action === "disable") {
      debug("==== ОТКЛЮЧЕНИЕ ==== Циркадный режим отключен", source, isDebug);
      variables.disabled = true;
      stop(source, variables, options);
      reset(variables);
      return;
    }
    if (action === "enable") {
      debug("==== ВКЛЮЧЕНИЕ ==== Циркадный режим включен", source, isDebug);
      variables.disabled = false;
      reset(variables);
      if (isLampOn(service)) {
        setCircadianValue(service, variables, options);
        restartCron(source, variables, options);
      }
      return;
    }
    if (action === "reset") {
      debug("==== СБРОС ==== Циркадный режим восстановлен", source, isDebug);
      reset(variables);
      if (isLampOn(service)) {
        setCircadianValue(service, variables, options);
        restartCron(source, variables, options);
      }
      return;
    }
    if (action === "changeMode") {
      if (isLampOn(service)) {
        setCircadianValue(service, variables, options);
        restartCron(source, variables, options);
      } else {
        const onChar = service.getCharacteristic(HC.On);
        if (onChar) onChar.setValue(true);
      }
    }
  };
}

// Обработка выключения лампы
function handleLampTurnOff(source, variables, options) {
  const disabled = variables.disabled === true || variables.runtime.stopped === true;
  stop(source, variables, options, disabled);
  reset(variables);
}

// Определение способа включения лампы

function detectTurnOnMethod(source, service, context, variables, isDebug) {
  if (contain(context, "Lightbulb.Brightness") || variables.changed.bright) {
    debug("Включается через изменение яркости на значение {}", source, isDebug, service.getCharacteristic(HC.Brightness).getValue(), context);
    variables.startParameter.isTurnOnByBright = true;
    variables.startParameter.brightAtStart = service.getCharacteristic(HC.Brightness).getValue();
  }
  if (contain(context, "Lightbulb.ColorTemperature") || variables.changed.temp) {
    debug("Включается через изменение температуры на значение {}", source, isDebug, service.getCharacteristic(HC.ColorTemperature).getValue(), context);
    variables.startParameter.isTurnOnByTemp = true;
  }
  if (contain(context, "Lightbulb.Saturation")) {
    debug("Включается через изменение насыщенности на значение {}", source, isDebug, service.getCharacteristic(HC.Saturation).getValue(), context);
    variables.startParameter.isTurnOnByTemp = true;
    variables.startParameter.isTurnOnBySat = true;
  }
  if (contain(context, "Lightbulb.Hue")) {
    debug("Включается через изменение оттенка на значение {}", source, isDebug, service.getCharacteristic(HC.Hue).getValue(), context);
    variables.startParameter.isTurnOnByTemp = true;
    variables.startParameter.isTurnOnByHue = true;
  }
}


function setCircadianValue(service, variables, options, fullDebug, linkedCharacteristicType) {
  let enableBrightByWhatChange = options.WhatChange === 0 || options.WhatChange === 1;
  let enableTempByWhatChange = options.WhatChange === 0 || options.WhatChange === 2;
  let dontChangeBright = variables.changed.bright === true || !enableBrightByWhatChange || variables.smoothOn.active;
  let dontChangeTemp = variables.changed.temp === true || !enableTempByWhatChange;
  let dontChangeHue = variables.changed.hue === true || !enableTempByWhatChange;
  let dontChangeSaturate = variables.changed.sat === true || !enableTempByWhatChange;
  if (linkedCharacteristicType) {
    dontChangeBright = dontChangeBright || linkedCharacteristicType !== HC.Brightness;
    dontChangeTemp = dontChangeTemp || linkedCharacteristicType !== HC.ColorTemperature;
    dontChangeHue = dontChangeHue || linkedCharacteristicType !== HC.Hue;
    dontChangeSaturate = dontChangeSaturate || linkedCharacteristicType !== HC.Saturation;
    fullDebug = options.Debug;
  }
  let isSet = false;
  if (!dontChangeBright || !dontChangeTemp || !dontChangeHue || !dontChangeSaturate) {
    variables.lastSetTime = Date.now();
    isSet = global.setCircadianLightForService(service, options.Preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, options.ChangeTempDelay, options.Debug, fullDebug, true);
  }
  if (!isSet && !linkedCharacteristicType) {
    stop(service.getCharacteristic(HC.On), variables, options);
    reset(variables);
    variables.runtime.stopped = true;
  }
}

function restartCron(source, variables, options) {
  if (variables.cronTask) {
    variables.cronTask.clear();
  }

  const seconds = (options.RandomSeconds ? Math.floor(Math.random() * 59) : 0) | 0;
  const task = Cron.schedule(seconds + " */5 * * * *", function () {
    if (variables.disabled) return;
    setCircadianValue(source.getService(), variables, options);
  });
  variables.cronTask = task;
  debug("==== ЗАПУСК ==== Циркадный режим запущен", source, options.Debug);
  const opts = "Preset: " + options.Preset + ". WhatChange: " + options.WhatChange + ". Behavior: " + options.Behavior + ". SmoothOnTime: " + options.SmoothOnTime + ". RandomSeconds: " + options.RandomSeconds + ". LinkedBehavior: " + options.LinkedBehavior;
  debug("СВОЙСТВА: " + opts, source, options.Debug);
}

function stop(source, variables, options, dontShowDebug) {
  // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
  if (variables.cronTask) {
    variables.cronTask.clear();
    variables.cronTask = undefined;
  }
  if (dontShowDebug) return;
  debug("==== ОСТАНОВКА ==== Циркадный режим остановлен", source, options.Debug);
}

// Сбрасываем состояние при выключении
function reset(variables) {
  if (variables.smoothOn.task !== undefined) {
    clearInterval(variables.smoothOn.task);
    variables.smoothOn.task = undefined;
  }
  variables.startParameter.brightAtStart = -1;
  variables.startParameter.isTurnOnByBright = false;
  variables.startParameter.isTurnOnByTemp = false;
  variables.startParameter.isTurnOnByHue = false;
  variables.startParameter.isTurnOnBySat = false;
  variables.smoothOn.active = false;
  variables.changed.bright = false;
  variables.changed.temp = false;
  variables.changed.hue = false;
  variables.changed.sat = false;
  variables.runtime.stopped = false;
  variables.runtime.dontChangeBright = false;
  variables.runtime.dontChangeTemp = false;
  variables.runtime.dontChangeHue = false;
  variables.runtime.dontChangeSat = false;
}

function contain(source, substring) {
  return source.toString().indexOf(substring) !== -1;
}

function isLampOn(service) {
  const onChar = service.getCharacteristic(HC.On);
  return onChar && onChar.getValue();
}

function getChangeReason(context, uuid) {
  const changeReason = {
    auto: false,
    onStart: false,
    self: false,
    byLinkedLamp: false,
    linkedUUID: undefined,
  };
  const elements = context.toString().split(" <- ");
  if (elements.length > 0) {
    const lastElement = elements[elements.length - 1];
    if (lastElement.startsWith("HUB[OnStart]")) {
      changeReason.auto = true;
      changeReason.onStart = true;
    }
    if (elements.length >= 3 &&
      lastElement.startsWith("CLINK[") &&
      elements[elements.length - 2].startsWith("C[" + uuid)) {
      changeReason.auto = true;
    }
    let findCurrent = false;
    elements.forEach(function (element) {
      if (!findCurrent && element.startsWith("C[" + uuid)) {
        findCurrent = true;
      } else if (findCurrent && element.startsWith("C[") && !element.startsWith("C[" + uuid)) {
        const bulbIndex = element.indexOf("Lightbulb");
        if (bulbIndex > 0) {
          changeReason.linkedUUID = element.substring(2, bulbIndex - 1);
          changeReason.byLinkedLamp = true;
        }
      }
    });
    if (elements.length >= 3 &&
      elements[0].startsWith("LOGIC") &&
      elements[1].startsWith("C") &&
      elements[2].split("_")[0] === elements[0].split("_")[0]) {
      changeReason.auto = true;
      changeReason.self = true;
    }
  }
  return changeReason;
}

function debug(format, source, isDebug, arg, context) {
  const argVal = arg === undefined ? "" : arg;
  if (isDebug) {
    const prefix = DEBUG_TITLE + global.getCircadianLightServiceName(source.getService()) + " ";
    const suffix = context ? ". Контекст: {}" : "";
    console.info(prefix + format + suffix, argVal, context);
  }
}