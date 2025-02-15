info = {
  name: "Циркадное освещение",
  description: "Устанавливает температуру и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/CircadianLight и в канале https://t.me/smart_sputnik",
  version: "4.2",
  author: "@BOOMikru",

  active: true,
  onStart: true,
  sync: false,

  sourceServices: [HS.Lightbulb],
  sourceCharacteristics: [HC.On, HC.Brightness, HC.ColorTemperature, HC.Hue, HC.Saturation],

  options: {
    DontChangeParam: {
      name: {
        en: "Dont change parameter automatically",
        ru: "Не менять определённый параметр автоматически после его ручного изменения. Сбрасывается при выключении лампы"
      },
      type: "Boolean",
      value: true
    },
    StopCircadionAfterChangeParam: {
      name: {
        en: "Stop circadion after change param",
        ru: "Останавливать циркадный режим после изменения любого из параметров. Работает только совместно с выключенной настройкой выше"
      },
      type: "Boolean",
      value: false
    },
    Preset: {
      name: {
        en: "Preset",
        ru: "Режим работы"
      },
      type: "Integer",
      value: 0,
      formType: "list",
      values: global.getCircadianLightModes()
    },
    WhatChange: {
      name: {
        en: "What сhange",
        ru: "Что изменять?"
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
    SmoothOn: {
      name: {
        en: "Smooth on",
        ru: "Плавное изменение яркости при включении (Экспериментально)"
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
    disabled: false
  }
}


function trigger(source, value, variables, options, context) {
  const service = source.getService()
  const isOn = source.getType() == HC.On
  const isDebug = options.Debug

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
          debug("==== ОТКЛЮЧЕНИЕ ==== Циркадный режим отключен для {}", source, isDebug)
          variables.disabled = true
          reset(variables)
          stop(source, variables, options)
          return;
        }
        // Включили, возобновляем работу
        if (GlobalVariables[disableName] == false && variables.disabled == true) {
          debug("==== ВКЛЮЧЕНИЕ ==== Циркадный режим включен для {}", source, isDebug)
          variables.disabled = false
          // Включили, надо и перезапустить
          GlobalVariables[resetName] = true
        }

        if (GlobalVariables[resetName] == true) {
          GlobalVariables[resetName] = false
          debug("==== СБРОС ==== Циркадный режим восстановлен для {}", source, isDebug)
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

  if (GlobalVariables[disableName] == true) return

  // Проверка способа включения
  if (isOn && value) {
    if (contain(context, "Lightbulb.Brightness")) {
      debug("Включается через изменение яркости. {}", source, isDebug)
      variables.startParameter.isTurnOnByBright = true
      variables.startParameter.brightAtStart = service.getCharacteristic(HC.Brightness).getValue()
    } else if (contain(context, "Lightbulb.ColorTemperature")) {
      debug("Включается через изменение температуры. {}", source, isDebug)
      variables.startParameter.isTurnOnByTemp = true
    } else if (contain(context, "Lightbulb.Saturation")) {
      debug("Включается через изменение насыщенности. {}", source, isDebug)
      variables.startParameter.isTurnOnByTemp = true
      variables.startParameter.isTurnOnBySat = true
    } else if (contain(context, "Lightbulb.Hue")) {
      debug("Включается через изменение оттенки. {}", source, isDebug)
      variables.startParameter.isTurnOnByTemp = true
      variables.startParameter.isTurnOnByHue = true
    }
  }


  const isBright = source.getType() == HC.Brightness
  const isTemp = source.getType() == HC.ColorTemperature
  const isHue = source.getType() == HC.Hue
  const isSaturation = source.getType() == HC.Saturation

  // Проверка изменения параметров. Событие вызывается и при автоматической смене яркости
  if (isBright || isTemp || isHue || isSaturation) {

    // Если включено "Не менять яркость", и ещё не меняли
    if (options.DontChangeParam) {

      if (variables.startParameter.isTurnOnByBright) variables.changed.bright = true
      if (variables.startParameter.isTurnOnByTemp) variables.changed.temp = true

      if (isBright && !variables.changed.bright && !variables.smoothOn.active) {
        let circadianBright = global.getCircadianLight(options.Preset)[1]
        let changed = difference(circadianBright, value) > 1
        variables.changed.bright = changed
      }

      if (isTemp && !variables.changed.temp) {
        let circadianTemp = global.getCircadianLight(options.Preset)[0]
        let changed = difference(circadianTemp, value) > 1
        variables.changed.temp = changed
      }

      if (isHue && !variables.changed.hue) {
        let circadianTemp = global.getCircadianLight(options.Preset)[0]
        let hueAndSat = global.getHueAndSaturationFromMired(circadianTemp)
        let changed = difference(hueAndSat[0], value) > 1
        variables.changed.hue = changed
        if (changed) {
          variables.changed.temp = true
        }
      }

      if (isSaturation && !variables.changed.sat) {
        let circadianTemp = global.getCircadianLight(options.Preset)[0]
        let hueAndSat = global.getHueAndSaturationFromMired(circadianTemp)
        let changed = difference(hueAndSat[1], value) > 1
        variables.changed.sat = changed
        if (changed) {
          variables.changed.temp = true
        }
      }
    }

    if (isBright && variables.changed.bright) debug("Яркость изменена вручную. Больше меняться автоматически не будет для {}", source, isDebug, context)
    if (isTemp && variables.changed.temp) debug("Температура изменена вручную. Больше меняться автоматически не будет для {}", source, isDebug, context)
    if (isHue && variables.changed.hue) debug("Оттенок изменен вручную. Больше меняться автоматически не будет для {}", source, isDebug, context)
    if (isSaturation && variables.changed.sat) debug("Насыщенность изменена вручную. Больше меняться автоматически не будет для {}", source, isDebug, context)

    if (variables.cronTask && variables.changed.bright && (variables.changed.temp || (variables.changed.hue && variables.changed.sat))) {
      debug("Все параметры, которые могли меняться в циркадном режиме изменены и больше не будут меняться. Останавливаем циркакадный режим для {}", source, isDebug)
      stop(source, variables, options)
      return
    }

    if (options.StopCircadionAfterChangeParam && variables.cronTask && (variables.changed.bright || variables.changed.temp || variables.changed.hue || variables.changed.sat)) {
      debug("Включено свойство 'Останавливать циркадный режим после изменения любого параметра'. Параметр был изменён, циркадный режим остановлен для {}", source, isDebug)
      stop(source, variables, options)
      return
    }
  }

  // Основная логика
  if (isOn) {
    if (value) {
      const brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error(DEBUG_TITLE + "Лампочка {}, не умеет изменять яркость", source, isDebug)
        return;
      }

      let enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
      let enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

      const circadianValue = global.getCircadianLight(options.Preset)

      // Начальная установка значения
      let installStartBright = enableBrightByWhatChange && !variables.startParameter.isTurnOnByBright && !variables.changed.bright && !options.SmoothOn
      let installStartTemp = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.changed.temp
      let installStartHue = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.startParameter.isTurnOnByHue && !variables.changed.temp
      let installStartSat = enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp && !variables.startParameter.isTurnOnBySat && !variables.changed.temp

      if (installStartBright || installStartTemp || installStartHue || installStartSat) {
        global.setCircadianLightForService(service, options.Preset, !installStartBright, !installStartTemp, !installStartHue, !installStartSat);
      }

      // Плавное включение
      let brightAtStart = variables.startParameter.brightAtStart
      let target = brightAtStart > 0 ? brightAtStart : circadianValue[1]
      let brightCharacteristic = service.getCharacteristic(HC.Brightness)
      if (!variables.changed.bright && !variables.startParameter.isTurnOnByBright && enableBrightByWhatChange && options.SmoothOn && target > 1) {
        variables.smoothOn.active = true
        let currentBr = 1
        brightCharacteristic.setValue(currentBr)
        let increaseBy = (target / 15) | 0
        setTimeout(function () {
          if (service.getCharacteristic(HC.On).getValue()) {
            let interval = setInterval(function () {
              if (currentBr >= target) {
                interval.clear()
                interval = undefined
                variables.smoothOn.active = false
              }
              currentBr = Math.min(currentBr + increaseBy, target)
              brightCharacteristic.setValue(currentBr)
            }, 150)
            variables.smoothOn.task = interval
          }
        }, 300);
      }

      restartCron(source, variables, options)
    } else {
      reset(variables)
      stop(source, variables, options)

      if (variables.reset.task) {
        variables.reset.task.clear()
        variables.reset.task = undefined
      }
    }
  }
}

function setCircadianValue(service, variables, options) {
  var enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
  var enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

  var dontChangeBright = variables.changed.bright == true || !enableBrightByWhatChange || variables.smoothOn.active
  var dontChangeTemp = variables.changed.temp == true || !enableTempByWhatChange
  var dontChangeHue = variables.changed.hue == true || !enableTempByWhatChange
  var dontChangeSaturate = variables.changed.sat == true || !enableTempByWhatChange

  global.setCircadianLightForService(service, options.Preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate);
}

function restartCron(source, variables, options) {
  // Отменяем задачу на обновление
  if (variables.cronTask && variables.cronTask != undefined) {
    variables.cronTask.clear()
  }

  // Запускаем новую задачу на обновление
  let task = Cron.schedule("0 */5 * * * *", function () {
    const disableName = global.getCircadianLightGlobalVariableForDisable(source.getService())
    if (GlobalVariables[disableName] == true) {
      stop(source, variables, options)
      reset(variables)
    }

    setCircadianValue(source.getService(), variables, options)
  });

  variables.cronTask = task;
  debug("==== ЗАПУСК ==== Циркадный режим запущен для {}", source, options.Debug)
}

function stop(source, variables, options) {
  // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
  if (variables.cronTask) {
    variables.cronTask.clear()
    variables.cronTask = undefined;
  }
  debug("==== ОСТАНОВКА ==== Циркадный режим остановлен для {}", source, options.Debug)
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
}

function difference(a, b) {
  return Math.abs(a - b);
}

function contain(source, substring) {
  return source.toString().indexOf(substring) !== -1
}

function debug(format, source, isDebug, context) {
  if (isDebug) {
    console.info(DEBUG_TITLE + format, global.getCircadianLightServiceName(source.getService()))
    if (context)
      console.info("{} Контекст изменения: {}", DEBUG_TITLE, context)
  }
}

const DEBUG_TITLE = "Циркадное освещение. "