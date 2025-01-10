info = {
  name: "Циркадное освещение",
  description: "Циркадное освещение. Устанавливает цвет и яркость лампы в зависимости от времени. Значение берется из глобального сценария",
  version: "1.0",
  author: "@BOOMikru",

  sourceServices: [HS.Lightbulb],
  sourceCharacteristics: [HC.On, HC.Brightness],

  options: {
    DontChangeBright: {
      name: {
        en: "Dont change brightness automatically",
        ru: "Не менять яркость автоматически после ручного изменения"
      },
      type: "Boolean",
      value: "true"
    },
    TurnOnByBrightChange: {
      name: {
        en: "Turn on by bright change",
        ru: "Связь включения и уровня. Для циркадного режима необходимо использовать этот параметр, а стандартную одноимённую логику отключить"
      },
      type: "Boolean",
      value: "true"
    },
    Preset: {
      name: {
        en: "Preset",
        ru: "Режим работы (0 - для спальни, 1 - для санузла, 2 - для кухни (с постоянной максимальной яркостью). Можно добавлять и редактировать в глобальном шаблоне)"
      },
      type: "Integer",
      value: "0"
    }
  },

  variables: {
    //Задача на обновление
    cronTask: undefined,
    // Яркость изменена вручную
    brightChanged: false,
    // Лампа включена изменением яркости
    turnOnByBright: false,
  }
}


function trigger(source, value, variables, options) {
  let isLampOn = source.getService().getCharacteristic(HC.On).getValue()
  let isBright = source.getType() == HC.Brightness

  // Изменили яркость
  if (isBright) {
    variables.turnOnByBright = !isLampOn
    // Связь включения и уровня
    if (options.TurnOnByBrightChange)
      source.getService().getCharacteristic(HC.On).setValue(true);

    // Если включено "Не менять яркость", и ещё не меняли
    if (options.DontChangeBright && !variables.brightChanged) {
      if (variables.turnOnByBright) {
        variables.brightChanged = true
      } else {
        // событие вызывается и при автоматической смене яркости
        let circadianBright = global.getCircadianLight(options.Preset)[1]
        let changed = circadianBright != value
        variables.brightChanged = changed
      }
    }
  } else {
    // Включили или выключили
    if (value) {

      let brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error("Лампочка {}, не умеет изменять яркость", source.getAccessory())
        return;
      }

      // не менять яркость, если поменяли вручную
      var dontChangeBright = variables.brightChanged == true;
      global.setCircadianLightForService(source.getService(), options.Preset, dontChangeBright);

      // Отменяем задачу на обновление
      if (variables.cronTask && variables.cronTask != undefined) {
        variables.cronTask.clear()
      }

      // Запускаем новую задачу на обновление
      let task = Cron.schedule("0 */5 * * * *", function () {
        dontChangeBright = variables.brightChanged == true;
        global.setCircadianLightForService(source.getService(), options.Preset, dontChangeBright);
      });
      variables.cronTask = task;

    } else {
      // Выключили лампу. Отменяем задачу на циркаду и сбрасываем параметры
      if (variables.cronTask) {
        variables.cronTask.clear()
        variables.cronTask = undefined;
      }
      variables.brightChanged = false
      variables.turnOnByBright = false
    }
  }
}