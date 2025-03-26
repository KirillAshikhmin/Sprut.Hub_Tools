info = {
  name: "📅 Планировщик расширенный",
  description: "Включает выключатель в заданное время в указанные дни месяца и/или дни недели. Обновления в канале https://t.me/smart_sputnik",
  version: "1.2",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [
    HS.Switch, HS.Outlet, HS.Fan, HS.FanBasic, HS.Lightbulb,
    HS.Faucet, HS.C_PetFeeder, HS.Valve, HS.HeaterCooler, HS.AirPurifier,
    HS.IrrigationSystem, HS.Television, HS.HumidifierDehumidifier, HS.CameraControl
  ],
  sourceCharacteristics: [HC.On, HC.Active],

  options: {
    DaysOfMonth: {
      name: {
        en: "Days of month",
        ru: "Дни месяца"
      },
      desc: {
        en: "Days of the month to activate (e.g., '1', '15, 30' or '1-5').\nActivation occurs on selected weekdays and specified days. If neither days nor weekdays are set, no activation happens.",
        ru: "Числа месяца для включения (например, '1', '15, 30' или '1-5').\nВключение происходит по выбранным дням недели и указанным числам. Если не указать числа и дни недели, включение не произойдёт."
      },
      type: "String",
      value: ""
    },
    Monday: {
      name: {
        en: "Every Monday",
        ru: "Каждый понедельник"
      },
      type: "Boolean",
      value: false
    },
    Tuesday: {
      name: {
        en: "Every Tuesday",
        ru: "Каждый вторник"
      },
      type: "Boolean",
      value: false
    },
    Wednesday: {
      name: {
        en: "Every Wednesday",
        ru: "Каждую среду"
      },
      type: "Boolean",
      value: false
    },
    Thursday: {
      name: {
        en: "Every Thursday",
        ru: "Каждый четверг"
      },
      type: "Boolean",
      value: false
    },
    Friday: {
      name: {
        en: "Every Friday",
        ru: "Каждую пятницу"
      },
      type: "Boolean",
      value: false
    },
    Saturday: {
      name: {
        en: "Every Saturday",
        ru: "Каждую субботу"
      },
      type: "Boolean",
      value: false
    },
    Sunday: {
      name: {
        en: "Every Sunday",
        ru: "Каждое воскресенье"
      },
      type: "Boolean",
      value: false
    },
    ActiveMonths: {
      name: {
        en: "Active months",
        ru: "Активные месяцы"
      },
      desc: {
        en: "Months when the device should activate (e.g., '1', '1, 6, 12' or '6-8').\nBy default every month.",
        ru: "Месяцы, когда устройство должно включаться (например, '1', '1, 6, 12' или '6-8').\nПо умолчанию каждый месяц."
      },
      type: "String",
      value: ""
    },
    Time: {
      name: {
        en: "Time (HH:MM)",
        ru: "Время (ЧЧ:ММ)"
      },
      desc: {
        en: "Time when activation occurs. Midnight by default.\nTime to turn on in 24-hour format. Restart the script via 'Active' toggle after changing.",
        ru: "Время, в которое произойдёт включение. По умолчанию в полночь.\nПосле изменения времени перезапустите сценарий через переключатель 'Активно'."
      },
      type: "String",
      value: "00:00"
    },
    DontTurnOff: {
      name: {
        en: "Don't turn off automatically",
        ru: "Не отключать автоматически"
      },
      desc: {
        en: "If enabled, the device will only turn on without automatic turning off.",
        ru: "Если включено, устройство будет только включаться без автоматического отключения."
      },
      type: "Boolean",
      value: false
    },
    TurnOffTime: {
      name: {
        en: "Turn off time (HH:MM)",
        ru: "Время отключения (ЧЧ:ММ)"
      },
      desc: {
        en: "Time to turn off the switch. Midnight by default.\nIf turn-on and turn-off times match, it may not turn off if the next day meets the conditions.\nWill not turn off if 'Don't turn off' is enabled.",
        ru: "Время отключения выключателя. По умолчанию полночь.\nЕсли время включения и отключения совпадает, то может не отключиться, если следующий день подходит под условия.\nНе отключится, если включено 'Не отключать'."
      },
      type: "String",
      value: "00:00"
    },
    TurnOffDelay: {
      name: {
        en: "Turn off delay (seconds)",
        ru: "Выключить через (секунды)"
      },
      desc: {
        en: "Delay in seconds before turning off after activation. Set to 0 to disable automatic turn-off.\nWill not turn off if 'Don't turn off' is enabled.",
        ru: "После включения автоматически отключится через указанное количество секунд. Установите 0, чтобы отключить автоматическое отключение.\nНе отключится, если включено 'Не отключать'."
      },
      type: "Integer",
      value: 0
    },
    Invert: {
      name: {
        en: "Invert",
        ru: "Инвертировать значение"
      },
      desc: {
        en: "Instead of turning on it will turn off, and instead of turning off it will turn on",
        ru: "Вместо включения будет отключаться, а вместо отключения - включаться"
      },
      type: "Boolean",
      value: false
    }
  },
  variables: {
    cronTask: undefined, // Задача для включения в указанное время
    midnightTask: undefined, // Задача для отключения в указанное время или в полночь
    prevTime: undefined, // Предыдущее значение options.Time
    prevTurnOffTime: undefined // Предыдущее значение options.TurnOffTime
  }
}

function trigger(source, value, variables, options, context) {
  // Проверяем, изменилось ли время включения или отключения в настройках
  if (variables.prevTime !== options.Time || variables.prevTurnOffTime !== options.TurnOffTime) {
    if (variables.cronTask) {
      variables.cronTask.clear();
      variables.cronTask = undefined;
    }
    if (variables.midnightTask) {
      variables.midnightTask.clear();
      variables.midnightTask = undefined;
    }
    variables.prevTime = options.Time; // Сохраняем новое значение времени включения
    variables.prevTurnOffTime = options.TurnOffTime; // Сохраняем новое значение времени отключения
  }

  // Если задачи уже запущены, ничего не делаем
  if (variables.cronTask) return;

  let timeObj = perseTime(options.Time)
  let time = timeObj.time
  let hoursStr = timeObj.hoursStr
  let minutesStr = timeObj.minutesStr

  let timeOffObj = perseTime(options.TurnOffTime)
  let turnOffTime = timeOffObj.time
  let turnOffHoursStr = timeOffObj.hoursStr
  let turnOffMinutesStr = timeOffObj.minutesStr

  // Валидация дней месяца с поддержкой диапазонов
  var daysOfMonth = parseRange(options.DaysOfMonth);
  daysOfMonth = daysOfMonth.filter(function (day) {
    if (day >= 1 && day <= 31) {
      return true;
    } else {
      console.warn("Некорректное число месяца \"" + day + "\" (допустимы: 1-31), будет проигнорировано");
      return false;
    }
  });

  // Валидация активных месяцев с поддержкой диапазонов
  var activeMonths = parseRange(options.ActiveMonths);
  activeMonths = activeMonths.filter(function (month) {
    if (month >= 1 && month <= 12) {
      return true;
    } else {
      console.warn("Некорректное значение месяца \"" + month + "\" (допустимы: 1-12), будет проигнорировано");
      return false;
    }
  });
  if (activeMonths.length === 0) {
    //console.warn("Нет валидных месяцев в \"" + options.ActiveMonths + "\", используются все месяцы (1-12)");
    activeMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  // Парсим дни недели
  var daysOfWeek = [
    options.Sunday, options.Monday, options.Tuesday, options.Wednesday,
    options.Thursday, options.Friday, options.Saturday
  ];

  let setNewValue = function () {
    let now = new Date();
    let month = now.getMonth() + 1; // getMonth() возвращает 0-11, добавляем 1 для 1-12
    let dayOfMonth = now.getDate();
    let dayOfWeek = now.getDay(); // 0 - воскресенье, 1 - понедельник, ..., 6 - суббота

    let isMonthMatch = activeMonths.indexOf(month) !== -1;
    let isDayOfMonthMatch = daysOfMonth.length > 0 && daysOfMonth.indexOf(dayOfMonth) !== -1;
    let isDayOfWeekMatch = daysOfWeek[dayOfWeek];

    // Если указаны только месяцы, но нет ни дней месяца, ни дней недели, включение не происходит
    if (isMonthMatch && (isDayOfMonthMatch || isDayOfWeekMatch)) {
      setDeviceValue(source, true, options.Invert);
      //console.info("Устройство включено в " + time + " для месяца " + month + ", дня " + dayOfMonth + ", дня недели " + dayOfWeek);

      // Автоматическое отключение с учётом TurnOffDelay, если не DontTurnOff и TurnOffDelay > 0
      if (options.TurnOffDelay > 0 && !options.DontTurnOff) {
        setTimeout(function () {
          setDeviceValue(source, false, options.Invert);
         // console.info("Устройство автоматически отключено через " + options.TurnOffDelay + " секунд в " + time);
        }, options.TurnOffDelay * 1000);
      }
    } else if (!options.DontTurnOff) {
      setDeviceValue(source, false, options.Invert);
      //console.info("Устройство отключено в " + time + " - условия не совпадают (месяц: " + month + ", день: " + dayOfMonth + ", день недели " + dayOfWeek + ")");
    }
  }

  //console.info("Крон планировщика знапущен на {}", "0 " + minutesStr + " " + hoursStr + " * * *")
  // Основная задача: включение в указанное время
  variables.cronTask = Cron.schedule("0 " + minutesStr + " " + hoursStr + " * * *", setNewValue);

  // Задача на отключение: используем TurnOffTime, если указано, иначе полночь (если не DontTurnOff)
  if (!options.DontTurnOff && time != turnOffTime) {
    var offSchedule = (turnOffTime === "00:00" && options.TurnOffTime === "") ? "0 0 0 * * *" : "0 " + turnOffMinutesStr + " " + turnOffHoursStr + " * * *";
    //console.info("Крон планировщика на выкл знапущен на {}", offSchedule)
    variables.midnightTask = Cron.schedule(offSchedule, function () {
      setDeviceValue(source, false, options.Invert);
     // console.info("Устройство отключено в " + turnOffTime);
    });
  } else {
    //console.info("Крон планировщика на выкл НЕ знапущен")
  }
}

function setDeviceValue(source, value, invert) {
  var isOnCharacteristic = source.getType() == HC.On;
  var isActiveCharacteristic = source.getType() == HC.Active;
  if (invert) value = !value
  if (isOnCharacteristic) {
    source.setValue(value);
  } else if (isActiveCharacteristic) {
    source.setValue(value ? 1 : 0);
  }
}

function parseRange(str) {
  var result = [];
  if (!str) return result; // Если строка пустая, возвращаем пустой массив
  str.replace(/\s/g, "").split(/[,;]/).forEach(function (part) {
    var range = part.split('-');
    if (range.length === 2) {
      var start = parseInt(range[0], 10);
      var end = parseInt(range[1], 10);
      if (start && end && start <= end) {
        for (var i = start; i <= end; i++) result.push(i);
      }
    } else {
      var num = parseInt(part, 10);
      if (num) result.push(num);
    }
  });
  return result.filter(function (num) { return num; });
}

function perseTime(str) {
  // Валидация времени включения (Time)
  var time = str || ""; // Если undefined, используем пустую строку
  var hours, minutes;
  var timeMatch = time.match(/^(\d{1,2}):(\d{1,2})$/); // Поддержка без ведущего нуля (например, "5:30")
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.warn("Некорректное время \"" + time + "\" (часы: 0-23, минуты: 0-59), используется \"00:00\"");
      hours = 0;
      minutes = 0;
    }
  } else {
    console.warn("Некорректный формат времени \"" + time + "\", ожидается ЧЧ:ММ, используется \"00:00\"");
    hours = 0;
    minutes = 0;
  }
  var hoursStr = hours < 10 ? "0" + hours : "" + hours;
  var minutesStr = minutes < 10 ? "0" + minutes : "" + minutes;
  time = hoursStr + ":" + minutesStr; // Формат "ЧЧ:ММ"
  return {
    time: time,
    hoursStr: hoursStr,
    minutesStr: minutesStr
  }
}