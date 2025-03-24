info = {
  name: "Планировщик расширенный",
  description: "Включает выключатель в заданное время в указанные дни месяца и/или дни недели. Обновления в канале https://t.me/smart_sputnik",
  version: "1.0",
  author: "@BOOMikru",
  active: true,
  onStart: true,
  sync: false,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On],

  options: {
    Time: {
      name: {
        en: "Time (HH:MM)",
        ru: "Время (ЧЧ:ММ)"
      },
      desc: {
        en: "Time to turn on in 24-hour format. Restart the script via 'Active' toggle after changing.",
        ru: "Время включения в 24-часовом формате.\nПосле изменения времени перезапустите сценарий через переключатель 'Активно'."
      },
      type: "String",
      value: "00:00"
    },
    DaysOfMonth: {
      name: {
        en: "Days of month",
        ru: "Дни месяца"
      },
      desc: {
        en: "Days of the month to activate (e.g., '1' or '15; 30'). Leave empty to ignore.",
        ru: "Числа месяца для включения (например, '1' или '15; 30').\nОставьте пустым, чтобы игнорировать."
      },
      type: "String",
      value: ""
    },
    ActiveMonths: {
      name: {
        en: "Active months",
        ru: "Активные месяцы"
      },
      desc: {
        en: "Months when the switch should activate (e.g., '1' or '1, 6; 12'). Default is all months.",
        ru: "Месяцы, когда выключатель должен включаться (например, '1' или '1, 6; 12').\nПо умолчанию все месяцы."
      },
      type: "String",
      value: "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12"
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
    AutoTurnOff: {
      name: {
        en: "Turn off automatically",
        ru: "Автоматически выключать"
      },
      desc: {
        en: "If enabled, the switch turns off 1 second after being turned on.",
        ru: "Если включено, выключатель выключается через 1 секунду после включения."
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
        en: "Time to turn off in 24-hour format. Restart the script via 'Active' toggle after changing.",
        ru: "Время отключения в 24-часовом формате.\nПосле изменения времени перезапустите сценарий через переключатель 'Активно'."
      },
      type: "String",
      value: "00:00"
    }
  },
  variables: {
    cronTask: undefined, // Задача для включения в указанное время
    midnightTask: undefined, // Задача для выключения в указанное время
    prevTime: undefined // Предыдущее значение options.Time
  }
}

function trigger(source, value, variables, options, context) {
  // Проверяем, изменилось ли время в настройках
  if (variables.prevTime !== options.Time) {
    if (variables.cronTask) {
      variables.cronTask.clear();
      variables.cronTask = undefined;
    }
    if (variables.midnightTask) {
      variables.midnightTask.clear();
      variables.midnightTask = undefined;
    }
    variables.prevTime = options.Time; // Сохраняем новое значение времени
  }

  // Если задачи уже запущены, ничего не делаем
  if (variables.cronTask) return;

  // Валидация времени включения
  var time = options.Time || ""; // Если undefined, используем пустую строку
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

  // Валидация времени отключения
  var turnOffTime = options.TurnOffTime || ""; // Если undefined, используем пустую строку
  var turnOffHours, turnOffMinutes;
  var turnOffTimeMatch = turnOffTime.match(/^(\d{1,2}):(\d{1,2})$/); // Поддержка без ведущего нуля
  if (turnOffTimeMatch) {
    turnOffHours = parseInt(turnOffTimeMatch[1], 10);
    turnOffMinutes = parseInt(turnOffTimeMatch[2], 10);
    if (turnOffHours < 0 || turnOffHours > 23 || turnOffMinutes < 0 || turnOffMinutes > 59) {
      console.warn("Некорректное время отключения \"" + turnOffTime + "\" (часы: 0-23, минуты: 0-59), используется \"00:00\"");
      turnOffHours = 0;
      turnOffMinutes = 0;
    }
  } else {
    console.warn("Некорректный формат времени отключения \"" + turnOffTime + "\", ожидается ЧЧ:ММ, используется \"00:00\"");
    turnOffHours = 0;
    turnOffMinutes = 0;
  }
  var turnOffHoursStr = turnOffHours < 10 ? "0" + turnOffHours : "" + turnOffHours;
  var turnOffMinutesStr = turnOffMinutes < 10 ? "0" + turnOffMinutes : "" + turnOffMinutes;
  turnOffTime = turnOffHoursStr + ":" + turnOffMinutesStr; // Формат "ЧЧ:ММ"

  // Валидация дней месяца
  var daysOfMonth = options.DaysOfMonth.replace(/\s/g, "").split(/[,;]/).map(Number).filter(function(num) { return num; });
  daysOfMonth = daysOfMonth.filter(function(day) {
    if (day >= 1 && day <= 31) {
      return true;
    } else {
      console.warn("Некорректное число месяца \"" + day + "\" (допустимы: 1-31), будет проигнорировано");
      return false;
    }
  });

  // Валидация активных месяцев
  var activeMonths = options.ActiveMonths.replace(/\s/g, "").split(/[,;]/).map(Number).filter(function(num) { return num; });
  activeMonths = activeMonths.filter(function(month) {
    if (month >= 1 && month <= 12) {
      return true;
    } else {
      console.warn("Некорректное значение месяца \"" + month + "\" (допустимы: 1-12), будет проигнорировано");
      return false;
    }
  });
  if (activeMonths.length === 0) {
    console.warn("Нет валидных месяцев в \"" + options.ActiveMonths + "\", используются все месяцы (1-12)");
    activeMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  // Парсим дни недели
  var daysOfWeek = [
    options.Sunday, options.Monday, options.Tuesday, options.Wednesday,
    options.Thursday, options.Friday, options.Saturday
  ];

  // Основная задача: включение в указанное время
  variables.cronTask = Cron.schedule("0 " + minutesStr + " " + hoursStr + " * * *", function() {
    var now = new Date();
    var month = now.getMonth() + 1; // getMonth() возвращает 0-11, добавляем 1 для 1-12
    var dayOfMonth = now.getDate();
    var dayOfWeek = now.getDay(); // 0 - воскресенье, 1 - понедельник, ..., 6 - суббота

    var isMonthMatch = activeMonths.indexOf(month) !== -1;
    var isDayOfMonthMatch = daysOfMonth.length > 0 && daysOfMonth.indexOf(dayOfMonth) !== -1;
    var isDayOfWeekMatch = daysOfWeek[dayOfWeek];

    if (isMonthMatch && (isDayOfMonthMatch || isDayOfWeekMatch)) {
      source.setValue(true);
      console.info("Выключатель включён в " + time + " для месяца " + month + ", дня " + dayOfMonth + ", дня недели " + dayOfWeek);
      
      // Если включена опция автоматического выключения
      if (options.AutoTurnOff) {
        setTimeout(function() {
          source.setValue(false);
          console.info("Выключатель автоматически выключен через 1 секунду в " + time);
        }, 1000); // 1 секунда = 1000 мс
      }
    } else {
      source.setValue(false);
      console.info("Выключатель выключен в " + time + " - условия не совпадают (месяц: " + month + ", день: " + dayOfMonth + ", день недели: " + dayOfWeek + ")");
    }
  });

  // Задача на отключение: выключение в указанное время, если оно не совпадает с временем включения
  if (time !== turnOffTime) {
    variables.midnightTask = Cron.schedule("0 " + turnOffMinutesStr + " " + turnOffHoursStr + " * * *", function() {
      source.setValue(false);
      console.info("Выключатель выключен в " + turnOffTime);
    });
  } else {
    console.info("Время отключения (" + turnOffTime + ") совпадает с временем включения, задача на отключение не запущена");
  }

  console.info("Задачи Cron запущены для включения в указанные даты и время.");
}