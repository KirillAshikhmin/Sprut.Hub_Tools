info = {
  name: "Циркадное освещение 3",
  description: "Устанавливает температуру и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/CircadianLight и в канале https://t.me/smart_sputnik",
  version: "3.1",
  author: "@BOOMikru",

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
        ru: "Режим работы (0 - Дольше яркий, 1 - Раннее затемнение, 2 - Всегда полная яркость)"
      },
      type: "Integer",
      value: 0
    },
    WhatChange: {
      name: {
        en: "What сhange",
        ru: "Что изменять? (0 - Яркость и температуру, 1 - только яркость, 2 - только температуру)"
      },
      type: "Integer",
      value: 0,
      //   values: [
      //     {
      //       "value": "0",
      //       "name": "Яркость и цветовую температуру"
      //     },
      //     {
      //       "value": "1",
      //       "name": "Только яркость"
      //     },
      //     {
      //       "value": "2",
      //       "name": "Только цветовую температуру"
      //     }
      //   ]
    },
    SmoothOn: {
      name: {
        en: "Smooth on",
        ru: "Плавное изменение яркости при включении (Экспериментально)"
      },
      type: "Boolean",
      value: false
    }
  },

  variables: {
    // Параметры запуска
    startParameter: {
      brightWhenOff: -1,
      tempWhenOff: -1,
      isTurnOnByBright: false,
      isTurnOnByTemp: false,
      turnOnByParamaterDate: null,
    },
    // Отслеживание параметров в функции compute
    compute: {
      enable: true,
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

const CIRCADIAN_LIGHT_DEBUG = true;
const DEBUG_TITLE = "Циркадное освещение. "


function compute(source, value, variables, options) {
  const service = source.getService()
  const disableName = global.getCircadianLightGlobalVariableForDisable(service)
  if (GlobalVariables[disableName] == true) return value;

  if (!variables.compute.enable) return value
  var on = source.getService().getCharacteristic(HC.On).getValue()

  const isOn = source.getType() == HC.On
  const isBright = source.getType() == HC.Brightness
  const isTemp = source.getType() == HC.ColorTemperature
  const isHue = source.getType() == HC.Hue
  const isSaturation = source.getType() == HC.Saturation

  if (!on) {
    if (isBright) {
      variables.startParameter.turnOnByParamaterDate = Date.now()
      variables.startParameter.brightWhenOff = value
    }
    if (isTemp || isHue || isSaturation) {
      variables.startParameter.turnOnByParamaterDate = Date.now()
      variables.startParameter.tempWhenOff = true
    }
  }

  if (isOn && value) {
    if (Date.now() - variables.startParameter.turnOnByParamaterDate <= 100) {
      if (variables.startParameter.brightWhenOff > 0) {
        variables.startParameter.isTurnOnByBright = true
      }
      if (variables.startParameter.tempWhenOff > 0) {
        variables.startParameter.isTurnOnByTemp = true
      }
    }
  }
  return value
}


function trigger(source, value, variables, options) {
  const service = source.getService()
  const isOn = source.getType() == HC.On
  const disableName = global.getCircadianLightGlobalVariableForDisable(service)
  const resetName = global.getCircadianLightGlobalVariableForReset(source.getService())
  variables.reset.name = resetName
  if (isOn && value) {
    GlobalVariables[resetName] = false

    variables.reset.task = setInterval(function () {
      // Выключили, останавливаем
      if (GlobalVariables[disableName] == true && variables.disabled != true) {
        if (CIRCADIAN_LIGHT_DEBUG)
          console.info(DEBUG_TITLE + "==== ОТКЛЮЧЕНИЕ ==== Циркадный режим отключен для {}", getName(source))
        variables.disabled = true
        reset(variables)
        stop(source, variables)
        return;
      }
      // Включили, возобновляем работу
      if (GlobalVariables[disableName] == false && variables.disabled == true) {
        if (CIRCADIAN_LIGHT_DEBUG)
          console.info(DEBUG_TITLE + "==== ВКЛЮЧЕНИЕ ==== Циркадный режим включен для {}", getName(source))
        variables.disabled = false
        // Включили, надо и перезапустить
        GlobalVariables[resetName] = true
      }
      console.info("check reset")

      if (GlobalVariables[resetName] == true) {
        GlobalVariables[resetName] = false
        reset(variables)
        setCircadianValue(source.getService(), variables, options)
        restartCron(source, variables, options)
      }
    }, 1000)
  }


  if (isOn && !value) {
    if (variables.reset.task != undefined) {
      variables.reset.task.clear()
      variables.reset.task = undefined
    }
    // check disabled

  }


  if (GlobalVariables[disableName] == true) return;

  const isBright = source.getType() == HC.Brightness
  const isTemp = source.getType() == HC.ColorTemperature
  const isHue = source.getType() == HC.Hue
  const isSaturation = source.getType() == HC.Saturation



  // событие вызывается и при автоматической смене яркости
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

    if (CIRCADIAN_LIGHT_DEBUG) {
      if (isBright && variables.changed.bright) console.info(DEBUG_TITLE + "Яркость изменена вручную. Больше меняться автоматически не будет для {}", getName(source))
      if (isTemp && variables.changed.temp) console.info(DEBUG_TITLE + "Температура изменена вручную. Больше меняться автоматически не будет для {}", getName(source))
      if (isHue && variables.changed.hue) console.info(DEBUG_TITLE + "Оттенок изменен вручную. Больше меняться автоматически не будет для {}", getName(source))
      if (isSaturation && variables.changed.sat) console.info(DEBUG_TITLE + "Насыщенность изменена вручную. Больше меняться автоматически не будет для {}", getName(source))
    }

    if (variables.cronTask && variables.changed.bright && (variables.changed.temp || (variables.changed.hue && variables.changed.sat))) {
      if (CIRCADIAN_LIGHT_DEBUG)
        console.info(DEBUG_TITLE + "Все параметры, которые могли меняться в циркадном режиме изменены и больше не будут меняться. Останавливаем циркакадный режим для {}", getName(source))
      stop(source, variables)
      return
    }

    if (options.StopCircadionAfterChangeParam && variables.cronTask && (variables.changed.bright || variables.changed.temp || variables.changed.hue || variables.changed.sat)) {
      if (CIRCADIAN_LIGHT_DEBUG)
        console.info(DEBUG_TITLE + "Включено свойство 'Останавливать циркадный режим после изменения любого параметра'. Параметр был изменён, циркадный режим остановлен для {}", getName(source))
      stop(source, variables)
      return
    }
  } else {
    variables.compute.enable = !value
    if (value) {

      const brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error(DEBUG_TITLE + "Лампочка {}, не умеет изменять яркость", getName(source))
        return;
      }

      var enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
      var enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

      const circadianValue = global.getCircadianLight(options.Preset)

      if (enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp) {
        global.setCircadianLightForService(service, options.Preset, true, false, false, false);
      }

      let brightWhenOff = variables.startParameter.brightWhenOff
      let target = brightWhenOff > 1 ? brightWhenOff : circadianValue[1]
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
      } else {
        brightCharacteristic.setValue(target)
      }

      restartCron(source, variables, options)

    } else {
      reset(variables)
      stop(source, variables)

      if (variables.reset.task != undefined) {
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
      stop(source, variables)
      reset(variables)
    }

    setCircadianValue(source.getService(), variables, options)
  });

  variables.cronTask = task;
  if (CIRCADIAN_LIGHT_DEBUG)
    console.info(DEBUG_TITLE + "==== ЗАПУСК ==== Циркадный режим запущен для {}", getName(source))
}

function stop(source, variables) {
  variables.useCompute = true
  // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
  if (variables.cronTask) {
    variables.cronTask.clear()
    variables.cronTask = undefined;
  }
  if (CIRCADIAN_LIGHT_DEBUG)
    console.info(DEBUG_TITLE + "==== ОСТАНОВКА ==== Циркадный режим остановлен для {}", getName(source))
}

// Сбрасываем состояние при выключении
function reset(variables) {
  if (variables.smoothOn.task != undefined) {
    variables.smoothOn.task.clear()
    variables.smoothOn.task = undefined
  }
  variables.startParameter.brightWhenOff = -1
  variables.startParameter.tempWhenOff = -1
  variables.startParameter.isTurnOnByBright = false
  variables.startParameter.isTurnOnByTemp = false
  variables.startParameter.turnOnByParamaterDate = null
  variables.smoothOn.active = false
  variables.changed.bright = false
  variables.changed.temp = false
  variables.changed.hue = false
  variables.changed.sat = false
}

function difference(a, b) {
  return Math.abs(a - b);
}

function getName(source) {
  return global.getCircadianLightServiceName(source.getService())
}