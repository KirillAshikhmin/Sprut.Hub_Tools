info = {
  name: "Циркадное освещение",
  description: "Устанавливает цвет и яркость лампы в зависимости от времени суток. Значения берутся из глобального сценария. Изменить значения внутри режимов и добавить свои можно там же. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/Циркадное%20освещение",
  version: "1.0",
  author: "@BOOMikru",
  onStart: false,

  sourceServices: [HS.Lightbulb],
  sourceCharacteristics: [HC.On, HC.Brightness],

  options: {
    DontChangeBright: {
      name: {
        en: "Dont change brightness automatically",
        ru: "Не менять яркость автоматически после ручного изменения. Сбрасывается при выключении лампы"
      },
      type: "Boolean",
      value: "true"
    },
    Preset: {
      name: {
        en: "Preset",
        ru: "Режим работы (0 - для спальни, 1 - для санузла, 2 - для кухни)"
      },
      type: "Integer",
      value: "0"
    }
  },

  variables: {
    //Задача на обновление
    cronTask: undefined,
    // Яркость изменена вручную
    brightChanged: false
  }
}


function trigger(source, value, variables, options) {
  let isBright = source.getType() == HC.Brightness
  // Изменили яркость
  if (isBright) {
    // Если включено "Не менять яркость", и ещё не меняли
    if (options.DontChangeBright && !variables.brightChanged) {
     // событие вызывается и при автоматической смене яркости
        let circadianBright = global.getCircadianLight(options.Preset)[1]
        let changed = circadianBright != value
        variables.brightChanged = changed
        console.info("Проверка яркости circadianBright {}, value {}, changed {}", circadianBright, value, changed)
    }
  } else {
    // Включили или выключили
    if (value) {

      let brightness = source.getService().getCharacteristic(HC.Brightness);
      if (brightness == null) {
        console.error("Лампочка {}, не умеет изменять яркость", source.getAccessory())
        return;
      }

      setTimeout(function () {
        var dontChangeBright = variables.brightChanged == true;
        global.setCircadianLightForService(source.getService(), options.Preset, dontChangeBright);
      }, 100)
      

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
    }
  }
}