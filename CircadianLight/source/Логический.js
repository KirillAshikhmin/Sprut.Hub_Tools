info = {
  name: "Циркадное освещение",
  description: "Устанавливает температуру и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/CircadianLight и в канале https://t.me/smart_sputnik",
  version: "6.0",
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
        en: "Can change in Perams global scenario",
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
        { value: 3, name: { en: "Restore", ru: "Восстанавить циркадное значение сразу" } }
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
        { value: 2, name: { en: "Restore", ru: "Восстанавить циркадное значение" } }
      ]
    },
    RandomSeconds: {
      name: {
        en: "Random change time",
        ru: "Случайное время изменения"
      },
      desc: {
        en: "By default, the values ​​are set by the hour every 5 minutes. With this parameter, the value will be set to 5 minutes and 0-60 seconds. It is necessary if the script is activated for many lamps, to avoid the error 'The execution queue cannot be more than 5 values'",
        ru: "По умолчанию значения устанавливаются по часам каждые 5 минут. С этим параметром значение будет устанавливаться в 5 минут и 0-59 секунд. Необходимо если сценарий активирован у многих ламп, что бы избежать ошибки 'Очередь на выполнение не может быть больше 5-и значений'"
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
        ru: "Set the color temperature one second after setting the brightness. Необходимо если сценарий активирован у многих ламп, что бы избежать ошибки 'Очередь на выполнение не может быть больше 5-и значений'"
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
    // Задача на восстановление циркады
    reset: {
      name: undefined,
      task: undefined,
    },
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


function trigger(source, value, variables, options, context) {
  const service = source.getService()
  const isOn = source.getType() == HC.On
  const isDebug = options.Debug
  const behavior = options.Behavior

  // Проверка выключения и сброса
  const disableName = global.getCircadianLightGlobalVariableForDisable(service)
  const resetName = global.getCircadianLightGlobalVariableForReset(source.getService())
  variables.reset.name = resetName

  if (isOn) {
    if (value) {
      GlobalVariables[resetName] = false

      variables.reset.task = setInterval(function () {
        // Выключили, останавливаем
        if (GlobalVariables[disableName] == true && variables.disabled != true) {
          debug("==== ОТКЛЮЧЕНИЕ ==== Циркадный режим отключен", source, isDebug)
          variables.disabled = true
          stop(source, variables, options)
          reset(variables)
          return;
        }
        // Включили, возобновляем работу
        if (GlobalVariables[disableName] == false && variables.disabled == true) {
          debug("==== ВКЛЮЧЕНИЕ ==== Циркадный режим включен", source, isDebug)
          variables.disabled = false
          // Включили, надо и перезапустить
          GlobalVariables[resetName] = true
        }

        if (GlobalVariables[resetName] == true) {
          GlobalVariables[resetName] = false
          debug("==== СБРОС ==== Циркадный режим восстановлен", source, isDebug)
          reset(variables)
          if (service.getCharacteristic(HC.On).getValue()) {
            setCircadianValue(source.getService(), variables, options)
            restartCron(source, variables, options)
          }
        }
      }, 1000)
    } else {
      if (variables.reset.task) {
        variables.reset.task.clear()
        variables.reset.task = undefined
      }
    }
  }

  const disabled = GlobalVariables[disableName] == true || variables.runtime.stopped == true
  if (isOn && !value) {
    stop(source, variables, options, disabled)
    reset(variables)

    if (variables.reset.task) {
      variables.reset.task.clear()
      variables.reset.task = undefined
    }
    return
  }

  if (disabled) return

  // Проверка способа включения
  if (isOn && value) {
    if (contain(context, "Lightbulb.Brightness") || variables.changed.bright) {
      debug("Включается через изменение яркости на значение {}", source, isDebug, service.getCharacteristic(HC.Brightness).getValue(), context)
      variables.startParameter.isTurnOnByBright = true
      variables.startParameter.brightAtStart = service.getCharacteristic(HC.Brightness).getValue()
    }
    if (contain(context, "Lightbulb.ColorTemperature") || variables.changed.temp) {
      debug("Включается через изменение температуры на значение {}", source, isDebug, service.getCharacteristic(HC.ColorTemperature).getValue(), context)
      variables.startParameter.isTurnOnByTemp = true
    }
    if (contain(context, "Lightbulb.Saturation")) {
      debug("Включается через изменение насыщенности на значение {}", source, isDebug, service.getCharacteristic(HC.Saturation).getValue(), context)
      variables.startParameter.isTurnOnByTemp = true
      variables.startParameter.isTurnOnBySat = true
    }
    if (contain(context, "Lightbulb.Hue")) {
      debug("Включается через изменение оттенки на значение {}", source, isDebug, service.getCharacteristic(HC.Hue).getValue(), context)
      variables.startParameter.isTurnOnByTemp = true
      variables.startParameter.isTurnOnByHue = true
    }
  }

  const isBright = source.getType() == HC.Brightness
  const isTemp = source.getType() == HC.ColorTemperature
  const isHue = source.getType() == HC.Hue
  const isSaturation = source.getType() == HC.Saturation

  let stopChange = false

  // Проверка изменения параметров. Событие вызывается и при автоматической смене яркости
  if (isBright || isTemp || isHue || isSaturation) {
    let changeReason = getChageReason(context, source.getUUID())
    let linkedCharacteristicType = undefined
    let ignoreFromLinked = options.LinkedBehavior == 1 || changeReason.auto || (options.LinkedBehavior != 2 && variables.lastSetTime && (Date.now() - variables.lastSetTime < 1500))
    if (changeReason.byLinkedLamp) {
      if (ignoreFromLinked) { return; }
      if (changeReason.linkedUUID) {
        if (service.getCharacteristic(HC.On).getValue()) {
          let linkedUUID = changeReason.linkedUUID
          const cdata = linkedUUID.split('.');
          const aid = cdata[0];
          const sid = cdata[1];
          let linkedService = Hub.getAccessory(aid).getService(sid)
          linkedCharacteristicType = linkedService.getCharacteristic(cdata[2]).getType()

          if (options.LinkedBehavior == 2) {
            setCircadianValue(linkedService, variables, options, true, linkedCharacteristicType)
            return
          }
          if (options.LinkedBehavior == 0) {
            stopChange = true
          }
        }
      }
    } else {
      if (behavior == 3) {
        let lastSetTime = variables.lastSetTime
        if (lastSetTime && ((Date.now() - lastSetTime) > 1500) && !changeReason.auto) {
          setCircadianValue(service, variables, options, options.Debug)
        }
        return
      }
    }

    let autoChange = changeReason.auto

    // Если включено "Останавливать автоматическое изменение характеристики"
    if (behavior == 0 || behavior == 1 || stopChange) {
      if (variables.startParameter.isTurnOnByBright) variables.changed.bright = true
      if (variables.startParameter.isTurnOnByTemp) variables.changed.temp = true

      if (!autoChange && isBright && !variables.changed.bright && !variables.smoothOn.active) {
        variables.changed.bright = true
      }

      if (!autoChange && isTemp && !variables.changed.temp) {
        variables.changed.temp = true
      }

      if (!autoChange && isHue && !variables.changed.hue) {
        variables.changed.hue = true
        variables.changed.temp = true
      }

      if (!autoChange && isSaturation && !variables.changed.sat) {
        variables.changed.sat = true
        variables.changed.temp = true
      }
    }

    if (isBright && variables.changed.bright) {
      debug("Яркость изменена вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context)
      variables.runtime.dontChangeBright = true
    }
    if (isTemp && variables.changed.temp) {
      debug("Температура изменена вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context)
      variables.runtime.dontChangeTemp = true
    }
    if (isHue && variables.changed.hue) {
      debug("Оттенок изменен вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context)
      variables.runtime.dontChangeHue = true
      variables.runtime.dontChangeTemp = true
    }
    if (isSaturation && variables.changed.sat && !variables.runtime.dontChangeSat) {
      debug("Насыщенность изменена вручную. Больше меняться автоматически не будет. Значение: {}", source, isDebug, value, context)
      variables.runtime.dontChangeSat = true
      variables.runtime.dontChangeTemp = true
    }

    if (variables.cronTask && variables.changed.bright && (variables.changed.temp || (variables.changed.hue && variables.changed.sat))) {
      debug("Все параметры, которые могли меняться в циркадном режиме изменены и больше не будут меняться. Останавливаем циркакадный режим", source, isDebug)
      stop(source, variables, options)
      variables.runtime.stopped = true
      return
    }

    if (behavior == 1 && variables.cronTask && (variables.changed.bright || variables.changed.temp || variables.changed.hue || variables.changed.sat)) {
      debug("Включено свойство 'Останавливать циркадный режим после изменения любого параметра'. Параметр был изменён, циркадный режим остановлен", source, isDebug)
      stop(source, variables, options)
      variables.runtime.stopped = true
      return
    }
  }

  // Основная логика
  if (isOn) {
    if (value) {
      const brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error(DEBUG_TITLE + "Лампочка не умеет изменять яркость", source, isDebug)
        return;
      }

      let enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
      let enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

      // Начальная установка значения
      let installStartBright = enableBrightByWhatChange && !variables.startParameter.isTurnOnByBright && !variables.changed.bright && !options.SmoothOn
      let installStartTemp = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.changed.temp
      let installStartHue = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.startParameter.isTurnOnByHue && !variables.changed.temp
      let installStartSat = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.startParameter.isTurnOnBySat && !variables.changed.temp

      if (!installStartBright && !installStartTemp) {
        debug("==== НЕ ЗАПУЩЕН ==== Циркадный режим не запущен, так как при включении лампы были изменены яркость и температура", source, isDebug)
        stop(source, variables, options, true)
        reset(variables)
        variables.runtime.stopped = true
        return
      }

      if (installStartBright || installStartTemp || installStartHue || installStartSat) {
        variables.lastSetTime = Date.now();
        let isSet = global.setCircadianLightForService(service, options.Preset, !installStartBright, !installStartTemp, !installStartHue, !installStartSat, options.ChangeTempDelay, isDebug, true);
        if (!isSet) {
          stop(source, variables, options)
          reset(variables)
          variables.runtime.stopped = true
        }
      }

      // Плавное включение
      let brightAtStart = variables.startParameter.brightAtStart
      let brightCharacteristic = service.getCharacteristic(HC.Brightness)
      let smoothTime = options.SmoothOnTime || 0;  // Время плавного включения, по умолчанию 0
      if (!variables.changed.bright && !variables.startParameter.isTurnOnByBright && enableBrightByWhatChange && smoothTime > 0) {
        const circadianValue = global.getCircadianLight(options.Preset, service.getUUID())
        let target = brightAtStart > 0 ? brightAtStart : circadianValue[1]
        if (target > 1) {
          variables.smoothOn.active = true;
          let currentBr = 1;  // Начальная яркость — 1%
          brightCharacteristic.setValue(currentBr);

          let intervalMs = 100;  // Интервал обновления — 100 мс
          let steps = (smoothTime * 1000) / intervalMs;  // Количество шагов
          let increaseBy = (target - currentBr) / steps;  // Шаг увеличения яркости

          let interval = setInterval(function () {
            if (currentBr >= target || !service.getCharacteristic(HC.On).getValue()) {
              clearInterval(interval);
              interval = undefined
              variables.smoothOn.active = false;
              if (currentBr >= target) brightCharacteristic.setValue(target);
            } else {
              currentBr += increaseBy;
              currentBr = Math.min(currentBr, target);
              brightCharacteristic.setValue(Math.round(currentBr));
            }
          }, intervalMs);
          variables.smoothOn.task = interval;
        }
      }
      restartCron(source, variables, options)
    } else {
      stop(source, variables, options)
      reset(variables)

      if (variables.reset.task) {
        variables.reset.task.clear()
        variables.reset.task = undefined
      }
    }
  }
}

function setCircadianValue(service, variables, options, fullDebug, linkedCharacteristicType) {
  var enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
  var enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

  var dontChangeBright = variables.changed.bright == true || !enableBrightByWhatChange || variables.smoothOn.active
  var dontChangeTemp = variables.changed.temp == true || !enableTempByWhatChange
  var dontChangeHue = variables.changed.hue == true || !enableTempByWhatChange
  var dontChangeSaturate = variables.changed.sat == true || !enableTempByWhatChange
  if (linkedCharacteristicType) {
    dontChangeBright = dontChangeBright || linkedCharacteristicType != HC.Brightness
    dontChangeTemp = dontChangeTemp || linkedCharacteristicType != HC.ColorTemperature
    dontChangeHue = dontChangeHue || linkedCharacteristicType != HC.Hue
    dontChangeSaturate = dontChangeSaturate || linkedCharacteristicType != HC.Saturation
    fullDebug = options.Debug
  }
  let isSet = false
  if (!dontChangeBright || !dontChangeTemp || !dontChangeHue || !dontChangeSaturate) {
    variables.lastSetTime = Date.now();
    isSet = global.setCircadianLightForService(service, options.Preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate, options.ChangeTempDelay, options.Debug, fullDebug);
  }

  if (!isSet && !linkedCharacteristicType) {
    stop(service.getCharacteristic(HC.On), variables, options)
    reset(variables)
    variables.runtime.stopped = true
  }
}

function restartCron(source, variables, options) {
  // Отменяем задачу на обновление
  if (variables.cronTask && variables.cronTask != undefined) {
    variables.cronTask.clear()
  }

  const seconds = (options.RandomSeconds ? Math.floor(Math.random() * 59) : 0) | 0;

  // Запускаем новую задачу на обновление
  let task = Cron.schedule(seconds + " */5 * * * *", function () {
    const disableName = global.getCircadianLightGlobalVariableForDisable(source.getService())
    if (GlobalVariables[disableName] == true) {
      variables.disabled = true
      stop(source, variables, options)
      reset(variables)
    }

    setCircadianValue(source.getService(), variables, options)
  });

  variables.cronTask = task;
  debug("==== ЗАПУСК ==== Циркадный режим запущен", source, options.Debug)

  let opts = "Preset: " + options.Preset + ". WhatChange: " + options.WhatChange + ". Behavior: " + options.Behavior + ". SmoothOnTime: " + options.SmoothOnTime + ". RandomSeconds: " + options.RandomSeconds + ". LinkedBehavior: " + options.LinkedBehavior
  debug("СВОЙСТВА: " + opts, source, options.Debug)
}

function stop(source, variables, options, dontShowDebug) {
  // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
  if (variables.cronTask) {
    variables.cronTask.clear()
    variables.cronTask = undefined;
  }
  if (dontShowDebug) return
  debug("==== ОСТАНОВКА ==== Циркадный режим остановлен", source, options.Debug)
}

// Сбрасываем состояние при выключении
function reset(variables) {
  if (variables.smoothOn.task != undefined) {
    variables.smoothOn.task.clear()
    variables.smoothOn.task = undefined
  }
  variables.startParameter.brightAtStart = -1
  variables.startParameter.isTurnOnByBright = false
  variables.startParameter.isTurnOnByTemp = false
  variables.startParameter.isTurnOnByHue = false
  variables.startParameter.isTurnOnBySat = false
  variables.smoothOn.active = false
  variables.changed.bright = false
  variables.changed.temp = false
  variables.changed.hue = false
  variables.changed.sat = false
  variables.runtime.stopped = false
  variables.runtime.dontChangeBright = false
  variables.runtime.dontChangeTemp = false
  variables.runtime.dontChangeHue = false
  variables.runtime.dontChangeSat = false
}

function difference(a, b) {
  return Math.abs(a - b);
}

function contain(source, substring) {
  return source.toString().indexOf(substring) !== -1
}

function getChageReason(context, uuid) {
  let changeReason = {
    auto: false,
    byLinkedLamp: false,
    onStart: false,
    self: false,
    linkedUUID: undefined,
  }

  // Разделяем контекст на элементы по символу '<-'
  const elements = context.toString().split(' <- ')
  // Проверяем, есть ли элементы в массиве
  if (elements.length > 0) {
    let last = elements[elements.length - 1]

    // Условие 0: Последний элемент начинается с 'HUB[OnStart]'
    if (last.startsWith('HUB[OnStart]')) {
      changeReason.auto = true
      changeReason.onStart = true
    }

    if (last.startsWith('CLINK[')) {
      changeReason.auto = true
    }

    // Условие 1: Событие пришло от другого устройства, а далее оно управляет целевым
    let findCurrent = false
    elements.forEach((e) => {
      if (!findCurrent) { if (e.startsWith('C[') && e.startsWith('C[' + uuid)) findCurrent = true }
      else if (e.startsWith('C[') && !e.startsWith('C[' + uuid)) {
        let bulbIndex = e.indexOf("Lightbulb")
        if (bulbIndex > 0) {
          changeReason.linkedUUID = e.substring(2, bulbIndex - 1)
          changeReason.byLinkedLamp = true
        }
      }
    })

    // Условие 2: Первые три элемента соответствуют шаблону 'LOGIC <- C <- LOGIC'
    if (elements.length >= 3 &&
      elements[0].startsWith('LOGIC') &&
      elements[1].startsWith('C') &&
      elements[2] == elements[0]) {
      changeReason.auto = true
      changeReason.self = true
    }
  }
  
  return changeReason;
}

function debug(format, source, isDebug, arg, context) {
  arg = arg == undefined ? "" : arg
  if (isDebug) {
    const prefix = DEBUG_TITLE + global.getCircadianLightServiceName(source.getService()) + " "
    const suffix = context ? ". Контекст: {}" : ""
    console.info(prefix + format + suffix, arg, context)
  }
}

const DEBUG_TITLE = "Циркадное освещение. "