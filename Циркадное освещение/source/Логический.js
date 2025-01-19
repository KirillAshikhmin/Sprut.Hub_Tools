info = {
  name: "Циркадное освещение",
  description: "Устанавливает температуру и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/Циркадное%20освещение",
  version: "2.2",
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
      value: "true"
    },
    StopCircadionAfterChangeParam: {
      name: {
        en: "Stop circadion after change param",
        ru: "Останавливать циркадный режим после изменения любого из параметров. Работает только совместно с выключенной настройкой выше"
      },
      type: "Boolean",
      value: "false"
    },
    Preset: {
      name: {
        en: "Preset",
        ru: "Режим работы (0 - Дольше яркий, 1 - Раннее затемнение, 2 - Всегда полная яркость)"
      },
      type: "Integer",
      value: "0"
    }
  },

  variables: {
    // Задача на обновление
    cronTask: undefined,
    // Яркость изменена вручную
    brightChanged: false,
    // Температура изменена вручную
    tempChanged: false,
    // Оттенок изменен вручную
    hueChanged: false,
    // Насыщенность изменена вручную
    satChanged: false
  }
}

const CIRCADIAN_LIGHT_DEBUG_INFO = false;


function trigger(source, value, variables, options) {

  const isBright = source.getType() == HC.Brightness
  const isTemp = source.getType() == HC.ColorTemperature
  const isHue = source.getType() == HC.Hue
  const isSaturation = source.getType() == HC.Saturation

  // событие вызывается и при автоматической смене яркости
  if (isBright || isTemp || isHue || isSaturation) {

    // Если включено "Не менять яркость", и ещё не меняли
    if (options.DontChangeParam) {

      if (isBright && !variables.brightChanged) {
        let circadianBright = global.getCircadianLight(options.Preset)[1]
        let changed = difference(circadianBright, value) > 1
        variables.brightChanged = changed
      }

      if (isTemp && !variables.tempChanged) {
        let circadianTemp = global.getCircadianLight(options.Preset)[0]
        let changed = difference(circadianTemp, value) > 1
        variables.tempChanged = changed
      }

      if (isHue && !variables.hueChanged) {
        let circadianTemp = global.getCircadianLight(options.Preset)[0]
        let hueAndSat = global.getHueAndSaturationFromMired(circadianTemp)
        let changed = difference(hueAndSat[0], value) > 1
        variables.hueChanged = changed
        if (changed)
          variables.tempChanged = true
      }

      if (isSaturation && !variables.satChanged) {
        let circadianTemp = global.getCircadianLight(options.Preset)[0]
        let hueAndSat = global.getHueAndSaturationFromMired(circadianTemp)
        let changed = difference(hueAndSat[1], value) > 1
        variables.satChanged = changed
        if (changed)
          variables.tempChanged = true
      }
    }

    if (CIRCADIAN_LIGHT_DEBUG_INFO) {
      if (isBright && variables.brightChanged) console.info("Циркадное освещение. Яркость изменена вручную. Больше меняться автоматически не будет для {}", source.getAccessory())
      if (isTemp && variables.tempChanged) console.info("Циркадное освещение. Температура изменена вручную. Больше меняться автоматически не будет для {}", source.getAccessory())
      if (isHue && variables.hueChanged) console.info("Циркадное освещение. Оттенок изменен вручную. Больше меняться автоматически не будет для {}", source.getAccessory())
      if (isSaturation && variables.satChanged) console.info("Циркадное освещение. Насыщенность изменена вручную. Больше меняться автоматически не будет для {}", source.getAccessory())
    }

    if (variables.cronTask && variables.brightChanged && (variables.tempChanged || (variables.hueChanged && variables.satChanged))) {
      if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        console.info("Циркадное освещение. Все параметры, которые могли меняться в циркадном режиме изменены и больше не будут меняться. Останавливаем циркакадный режим для {}", source.getAccessory())
      }
      stop(variables, source.getAccessory())
      return
    }

    if (options.StopCircadionAfterChangeParam && variables.cronTask && (variables.brightChanged || variables.tempChanged || variables.hueChanged || variables.satChanged)) {
      if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        console.info("Циркадное освещение. Включено свойство 'Останавливать циркадный режим после изменения любого параметра'. Параметр был изменён, циркадный режим остановлен для {}", source.getAccessory())
      }
      stop(variables)
      return
    }
  } else {
    // Включили или выключили
    if (value) {

      const brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error("Циркадное освещение. Лампочка {}, не умеет изменять яркость", source.getAccessory())
        return;
      }

      // Устанавливаем начальные значения циркадного режима с задержкой, что бы успела отработать логика связи уровня и включения
      setTimeout(function () {
        var dontChangeBright = variables.brightChanged == true;
        var dontChangeTemp = variables.tempChanged == true;
        var dontChangeHue = variables.hueChanged == true;
        var dontChangeSaturate = variables.satChanged == true;

        global.setCircadianLightForService(source.getService(), options.Preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate);
      }, 100)


      // Отменяем задачу на обновление
      if (variables.cronTask && variables.cronTask != undefined) {
        variables.cronTask.clear()
      }

      // Запускаем новую задачу на обновление
      let task = Cron.schedule("*/30 * * * * *", function () {
        var dontChangeBright = variables.brightChanged == true;
        var dontChangeTemp = variables.tempChanged == true;
        var dontChangeHue = variables.hueChanged == true;
        var dontChangeSaturate = variables.satChanged == true;
        global.setCircadianLightForService(source.getService(), options.Preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate);
      });
      variables.cronTask = task;
      if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        console.info("Циркадное освещение. ==== ЗАПУСК ==== Устройство включено. Циркадный режим запущен для {}", source.getAccessory())
      }
    } else {
      if (CIRCADIAN_LIGHT_DEBUG_INFO) {
        console.info("Циркадное освещение. Устройство выключно {}", source.getAccessory())
      }
      stop(variables, source.getAccessory())

      // Сбрасываем состояние при выключении
      variables.brightChanged = false
      variables.tempChanged = false
      variables.hueChanged = false
      variables.satChanged = false
    }
  }
}

function setCircadianValue(service, preset, variables) {
  var dontChangeBright = variables.brightChanged == true;
  var dontChangeTemp = variables.tempChanged == true;
  var dontChangeHue = variables.hueChanged == true;
  var dontChangeSaturate = variables.satChanged == true;
  global.setCircadianLightForService(service, preset, dontChangeBright, dontChangeTemp, dontChangeHue, dontChangeSaturate);
}

function stop(variables, accessory) {
  // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
  if (variables.cronTask) {
    variables.cronTask.clear()
    variables.cronTask = undefined;
  }
  console.info("Циркадное освещение. ==== ОСТАНОВКА ==== Циркадный режим остановлен для {}", accessory)
}

function difference(a, b) {
  return Math.abs(a - b);
}