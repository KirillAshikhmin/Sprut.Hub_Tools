info = {
  name: "Циркадное освещение",
  description: "Устанавливает температуру и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/CircadianLight и в канале https://t.me/smart_sputnik",
  version: "3.0",
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
    }
  }
}

const CIRCADIAN_LIGHT_DEBUG_INFO = false;


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
  const disableName = global.getCircadianLightGlobalVariableForDisable(service)
  if (GlobalVariables[disableName] == true) return;

  const isOn = source.getType() == HC.On
  const isBright = source.getType() == HC.Brightness
  const isTemp = source.getType() == HC.ColorTemperature
  const isHue = source.getType() == HC.Hue
  const isSaturation = source.getType() == HC.Saturation

  if (isOn && value) {
    variables.reset.name = global.getCircadianLightGlobalVariableForReset(source.getService())
    GlobalVariables[variables.reset.name] = false
    variables.reset.task = setInterval(function () {
      let name = variables.reset.name
      if (name == undefined) {
        if (variables.reset.task != undefined) {
          variables.reset.task.clear()
          variables.reset.task = undefined
        }
        if (variables.smoothOn.task != undefined) {
          variables.smoothOn.task.clear()
          variables.smoothOn.task = undefined
        }
      }
      if (GlobalVariables[name] == true) {
        GlobalVariables[name] = false
        reset(variables)
        restartCron(source, variables, options)

        var enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
        var enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2
        const circadianValue = global.getCircadianLight(options.Preset)

        if (enableBrightByWhatChange)
          service.getCharacteristic(HC.Brightness).setValue(circadianValue[1])
        if (enableTempByWhatChange)
          service.getCharacteristic(HC.ColorTemperature).setValue(circadianValue[0])
      }
    }, 500)
  }

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

    if (CIRCADIAN_LIGHT_DEBUG_INFO) {
      if (isBright && variables.changed.bright) console.info("Циркадное освещение. Яркость изменена вручную. Больше меняться автоматически не будет для {}", getName(source))
      if (isTemp && variables.changed.temp) console.info("Циркадное освещение. Температура изменена вручную. Больше меняться автоматически не будет для {}", getName(source))
      if (isHue && variables.changed.hue) console.info("Циркадное освещение. Оттенок изменен вручную. Больше меняться автоматически не будет для {}", getName(source))
      if (isSaturation && variables.changed.sat) console.info("Циркадное освещение. Насыщенность изменена вручную. Больше меняться автоматически не будет для {}", getName(source))
    }

    if (variables.cronTask && variables.changed.bright && (variables.changed.temp || (variables.changed.hue && variables.changed.sat))) {
      if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        console.info("Циркадное освещение. Все параметры, которые могли меняться в циркадном режиме изменены и больше не будут меняться. Останавливаем циркакадный режим для {}", getName(source))
      }
      stop(variables, source)
      return
    }

    if (options.StopCircadionAfterChangeParam && variables.cronTask && (variables.changed.bright || variables.changed.temp || variables.changed.hue || variables.changed.sat)) {
      if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        console.info("Циркадное освещение. Включено свойство 'Останавливать циркадный режим после изменения любого параметра'. Параметр был изменён, циркадный режим остановлен для {}", getName(source))
      }
      stop(variables, source)
      return
    }
  } else {
    variables.compute.enable = !value
    if (value) {

      const brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error("Циркадное освещение. Лампочка {}, не умеет изменять яркость", getName(source))
        return;
      }

      var enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
      var enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

      const circadianValue = global.getCircadianLight(options.Preset)

      if (enableTempByWhatChange && !variables.startParameter.isTurnOnByTemp) {
        service.getCharacteristic(HC.ColorTemperature).setValue(circadianValue[0])
      }

      let brightWhenOff = variables.startParameter.brightWhenOff
      let target = brightWhenOff > 1 ? brightWhenOff : circadianValue[1]
      let br = service.getCharacteristic(HC.Brightness)
      if (!variables.changed.bright && !variables.startParameter.isTurnOnByBright && enableBrightByWhatChange && options.SmoothOn && target > 1) {
        variables.smoothOn.active = true
        let currentBr = 1
        br.setValue(currentBr)
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
              br.setValue(currentBr)
            }, 150)
            variables.smoothOn.task = interval
          }
        }, 300);
      } else {
        br.setValue(target)
      }

      restartCron(source, variables, options)

    } else {
      reset(variables)
      stop(variables, source)
    }
  }
}

function setCircadianValue(service, preset, variables) {
  var dontChangeBright = variables.changed.bright == true;
  var dontChangeTemp = variables.changed.temp == true;
  var dontChangeHue = variables.changed.hue == true;
  var dontChangeSaturate = variables.changed.sat == true;
  global.setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate);
}

function restartCron(source, variables, options) {
  // Отменяем задачу на обновление
  if (variables.cronTask && variables.cronTask != undefined) {
    variables.cronTask.clear()
  }

  // Что изменять? (0 - Яркость и температуру, 1 - только яркость, 2 - только температуру)
  var enableBrightByWhatChange = options.WhatChange == 0 || options.WhatChange == 1
  var enableTempByWhatChange = options.WhatChange == 0 || options.WhatChange == 2

  // Запускаем новую задачу на обновление
  let task = Cron.schedule("0 */5 * * * *", function () {
    var dontChangeBright = variables.changed.bright == true || !enableBrightByWhatChange || variables.smoothOn.active
    var dontChangeTemp = variables.changed.temp == true || !enableTempByWhatChange
    var dontChangeHue = variables.changed.hue == true || !enableTempByWhatChange
    var dontChangeSaturate = variables.changed.sat == true || !enableTempByWhatChange
    global.setCircadianLightForService(source.getService(), options.Preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate);
  });
  variables.cronTask = task;
  if (CIRCADIAN_LIGHT_DEBUG_INFO) {
    console.info("Циркадное освещение. ==== ЗАПУСК ==== Циркадный режим запущен для {}", getName(source))
  }
}

function stop(variables, source) {
  variables.useCompute = true
  // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
  if (variables.cronTask) {
    variables.cronTask.clear()
    variables.cronTask = undefined;
  }
  if (CIRCADIAN_LIGHT_DEBUG_INFO)
    console.info("Циркадное освещение. ==== ОСТАНОВКА ==== Циркадный режим остановлен для {}", getName(source))
}

// Сбрасываем состояние при выключении
function reset(variables) {

  if (variables.reset.task != undefined) {
    variables.reset.task.clear()
    variables.reset.task = undefined
  }
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

