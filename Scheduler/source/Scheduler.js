info = {
  name: "📅 Планировщик расширенный",
  description: "Включает выключатель в заданное время в указанные дни месяца и/или дни недели. Обновления в канале https://t.me/smart_sputnik",
  version: "2.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [
    HS.Switch, HS.Outlet, HS.Fan, HS.FanBasic, HS.Lightbulb,
    HS.Faucet, HS.C_PetFeeder, HS.Valve, HS.HeaterCooler, HS.AirPurifier,
    HS.IrrigationSystem, HS.Television, HS.HumidifierDehumidifier, HS.CameraControl
  ],
  sourceCharacteristics: [HC.On, HC.Active],

  options: {
    ScheduleOn: { type: "Boolean", value: true, name: { ru: "Включать по планировщику", en: "Schedule turn on" }, desc: { ru: "Если включено, устройство будет включаться по расписанию.", en: "If enabled, the device will turn on according to the schedule." } },
    DaysOfMonthOn: { type: "String", value: "1-31", name: { ru: "  Дни месяца (вкл)", en: "  Days of month (turn on)" }, desc: { ru: "Числа месяца для включения (например, '1', '15, 30' или '1-5').\nВключение происходит по выбранным дням недели и указанным числам.", en: "Days of the month to turn on (e.g., '1', '15, 30' or '1-5').\nActivation occurs on selected weekdays and specified days." } },
    MondayOn: { type: "Boolean", value: false, name: { ru: "  Каждый понедельник (вкл)", en: "  Every Monday (turn on)" }, desc: { ru: "", en: "" } },
    TuesdayOn: { type: "Boolean", value: false, name: { ru: "  Каждый вторник (вкл)", en: "  Every Tuesday (turn on)" }, desc: { ru: "", en: "" } },
    WednesdayOn: { type: "Boolean", value: false, name: { ru: "  Каждую среду (вкл)", en: "  Every Wednesday (turn on)" }, desc: { ru: "", en: "" } },
    ThursdayOn: { type: "Boolean", value: false, name: { ru: "  Каждый четверг (вкл)", en: "  Every Thursday (turn on)" }, desc: { ru: "", en: "" } },
    FridayOn: { type: "Boolean", value: false, name: { ru: "  Каждую пятницу (вкл)", en: "  Every Friday (turn on)" }, desc: { ru: "", en: "" } },
    SaturdayOn: { type: "Boolean", value: false, name: { ru: "  Каждую субботу (вкл)", en: "  Every Saturday (turn on)" }, desc: { ru: "", en: "" } },
    SundayOn: { type: "Boolean", value: false, name: { ru: "  Каждое воскресенье (вкл)", en: "  Every Sunday (turn on)" }, desc: { ru: "", en: "" } },
    ActiveMonthsOn: { type: "String", value: "1-12", name: { ru: "  Активные месяцы (вкл)", en: "  Active months (turn on)" }, desc: { ru: "Месяцы, когда устройство должно включаться (например, '1', '1, 6, 12' или '6-8').\nПо умолчанию каждый месяц.", en: "Months when the device should turn on (e.g., '1', '1, 6, 12' or '6-8').\nBy default every month." } },
    TimeOn: { type: "String", value: "00:00", name: { ru: "  Время (ЧЧ:ММ) (вкл)", en: "  Time (HH:MM) (turn on)" }, desc: { ru: "Время, в которое произойдёт включение (например, '08:00, 12:00, 18:00').\nМожно указать несколько значений через запятую. Перезапустите сценарий через 'Активно' после изменения.", en: "Times when turn on occurs (e.g., '08:00, 12:00, 18:00').\nMultiple times can be separated by commas. Restart the script via 'Active' toggle after changing." } },
    ScheduleOff: { type: "Boolean", value: true, name: { ru: "Отключать по планировщику", en: "Schedule turn off" }, desc: { ru: "Если включено, устройство будет отключаться по расписанию.", en: "If enabled, the device will turn off according to the schedule." } },
    DaysOfMonthOff: { type: "String", value: "1-31", name: { ru: "  Дни месяца (откл)", en: "  Days of month (turn off)" }, desc: { ru: "Числа месяца для отключения (например, '1', '15, 30' или '1-5').\nОтключение происходит по выбранным дням недели и указанным числам.", en: "Days of the month to turn off (e.g., '1', '15, 30' or '1-5').\nDeactivation occurs on selected weekdays and specified days." } },
    MondayOff: { type: "Boolean", value: false, name: { ru: "  Каждый понедельник (откл)", en: "  Every Monday (turn off)" }, desc: { ru: "", en: "" } },
    TuesdayOff: { type: "Boolean", value: false, name: { ru: "  Каждый вторник (откл)", en: "  Every Tuesday (turn off)" }, desc: { ru: "", en: "" } },
    WednesdayOff: { type: "Boolean", value: false, name: { ru: "  Каждую среду (откл)", en: "  Every Wednesday (turn off)" }, desc: { ru: "", en: "" } },
    ThursdayOff: { type: "Boolean", value: false, name: { ru: "  Каждый четверг (откл)", en: "  Every Thursday (turn off)" }, desc: { ru: "", en: "" } },
    FridayOff: { type: "Boolean", value: false, name: { ru: "  Каждую пятницу (откл)", en: "  Every Friday (turn off)" }, desc: { ru: "", en: "" } },
    SaturdayOff: { type: "Boolean", value: false, name: { ru: "  Каждую субботу (откл)", en: "  Every Saturday (turn off)" }, desc: { ru: "", en: "" } },
    SundayOff: { type: "Boolean", value: false, name: { ru: "  Каждое воскресенье (откл)", en: "  Every Sunday (turn off)" }, desc: { ru: "", en: "" } },
    ActiveMonthsOff: { type: "String", value: "1-12", name: { ru: "  Активные месяцы (откл)", en: "  Active months (turn off)" }, desc: { ru: "Месяцы, когда устройство должно отключаться (например, '1', '1, 6, 12' или '6-8').\nПо умолчанию каждый месяц.", en: "Months when the device should turn off (e.g., '1', '1, 6, 12' or '6-8').\nBy default every month." } },
    TimeOff: { type: "String", value: "00:00", name: { ru: "  Время (ЧЧ:ММ) (откл)", en: "  Time (HH:MM) (turn off)" }, desc: { ru: "Время, в которое произойдёт отключение (например, '09:00, 13:00, 19:00').\nМожно указать несколько значений через запятую. Перезапустите сценарий через 'Активно' после изменения.", en: "Times when turn off occurs (e.g., '09:00, 13:00, 19:00').\nMultiple times can be separated by commas. Restart the script via 'Active' toggle after changing." } },
    Invert: { type: "Boolean", value: false, name: { ru: "Инвертировать значение", en: "Invert" }, desc: { ru: "Вместо включения будет отключаться, а вместо отключения - включаться", en: "Instead of turning on it will turn off, and instead of turning off it will turn on" } },
    TurnOffDelay: { type: "Integer", value: 0, name: { ru: "Выключить через (секунды)", en: "Turn off delay (seconds)" }, desc: { ru: "После включения автоматически отключится через указанное количество секунд. Установите 0, чтобы не отключать автоматически.\nНе работает, если включено 'Отключать по планировщику'.", en: "Delay in seconds before turning off after activation. Set to 0 to disable automatic turn-off.\nDoes not work if 'Schedule turn off' is enabled." } },
    SendNotifications: { type: "Boolean", value: false, name: { ru: "Отправлять уведомления", en: "Send notifications" }, desc: { ru: "Если включено, отправляет уведомление в Telegram и систему при каждом включении/отключении.", en: "If enabled, sends a Telegram and system notification on each turn on/off." } },
    MaintainState: { type: "Boolean", value: false, name: { ru: "Поддерживать состояние", en: "Maintain state" }, desc: { ru: "Если включено, устройство будет восстанавливать нужное состояние при его изменении вручную или другим сценарием или мостом, пока не сработает расписание.", en: "If enabled, the device will follow the current state upon manual change until the schedule triggers." } }
  },
  variables: {
    cronTasksOn: [], // Массив задач для включения (несколько интервалов)
    cronTasksOff: [], // Массив задач для отключения (несколько интервалов)
    prevTimeOn: undefined, // Предыдущая строка параметров включения
    prevTimeOff: undefined // Предыдущая строка параметров отключения
  }
}

function trigger(source, value, variables, options, context) {
  let needRestoreTargetState = false
  // Поддержание текущего состояния при ручном изменении
  if (options.MaintainState && !isAutomaticChange(context)) {
    needRestoreTargetState = true
    sendNotification(source, options.SendNotifications, "Восстанавливаем состояние после ручного изменения");
  }

  // Собираем строки из всех параметров включения и отключения
  let currentTimeOn = `${options.TimeOn}|${options.DaysOfMonthOn}|${options.ActiveMonthsOn}|${options.SundayOn}|${options.MondayOn}|${options.TuesdayOn}|${options.WednesdayOn}|${options.ThursdayOn}|${options.FridayOn}|${options.SaturdayOn}`;
  let currentTimeOff = `${options.TimeOff}|${options.DaysOfMonthOff}|${options.ActiveMonthsOff}|${options.SundayOff}|${options.MondayOff}|${options.TuesdayOff}|${options.WednesdayOff}|${options.ThursdayOff}|${options.FridayOff}|${options.SaturdayOff}`;

  // Проверяем, изменились ли параметры
  let hasChanges = needRestoreTargetState || (variables.prevTimeOn !== currentTimeOn || variables.prevTimeOff !== currentTimeOff);
  if (hasChanges) {
    // Очищаем все существующие задачи
    variables.cronTasksOn.forEach(task => task.clear());
    variables.cronTasksOn = [];
    variables.cronTasksOff.forEach(task => task.clear());
    variables.cronTasksOff = [];
    variables.prevTimeOn = currentTimeOn;
    variables.prevTimeOff = currentTimeOff;
  }

  // Создаём задачи для включения
  if (options.ScheduleOn && variables.cronTasksOn.length === 0) {
    let timesOn = options.TimeOn.split(',').map(t => t.trim());
    let daysOfMonthOn = parseRange(options.DaysOfMonthOn);
    let activeMonthsOn = parseRange(options.ActiveMonthsOn);
    let daysOfWeekOn = [
      options.SundayOn, options.MondayOn, options.TuesdayOn, options.WednesdayOn,
      options.ThursdayOn, options.FridayOn, options.SaturdayOn
    ];

    timesOn.forEach(time => {
      let timeOnObj = parseTime(time);
      let hoursOnStr = timeOnObj.hoursStr;
      let minutesOnStr = timeOnObj.minutesStr;

      let task = Cron.schedule(`0 ${minutesOnStr} ${hoursOnStr} * * *`, function () {
        let now = new Date();
        let month = now.getMonth() + 1;
        let dayOfMonth = now.getDate();
        let dayOfWeek = now.getDay();

        let isMonthMatch = activeMonthsOn.indexOf(month) !== -1;
        let isDayOfMonthMatch = daysOfMonthOn.indexOf(dayOfMonth) !== -1;
        let isDayOfWeekMatch = daysOfWeekOn[dayOfWeek];

        if (isMonthMatch && (isDayOfMonthMatch || isDayOfWeekMatch)) {
          if (setDeviceValue(source, true, options.Invert))
            sendNotification(source, options.SendNotifications, "включено");
          if (options.TurnOffDelay > 0 && !options.ScheduleOff) {
            setTimeout(function () {
              if (setDeviceValue(source, false, options.Invert))
                sendNotification(source, options.SendNotifications, `отключено через ${options.TurnOffDelay} сек`);
            }, options.TurnOffDelay * 1000);
          }
        }
      });
      variables.cronTasksOn.push(task);
    });
  }

  // Создаём задачи для отключения
  if (options.ScheduleOff && variables.cronTasksOff.length === 0) {
    let timesOff = options.TimeOff.split(',').map(t => t.trim());
    let daysOfMonthOff = parseRange(options.DaysOfMonthOff);
    let activeMonthsOff = parseRange(options.ActiveMonthsOff);
    let daysOfWeekOff = [
      options.SundayOff, options.MondayOff, options.TuesdayOff, options.WednesdayOff,
      options.ThursdayOff, options.FridayOff, options.SaturdayOff
    ];

    timesOff.forEach(time => {
      let timeOffObj = parseTime(time);
      let hoursOffStr = timeOffObj.hoursStr;
      let minutesOffStr = timeOffObj.minutesStr;

      let task = Cron.schedule(`0 ${minutesOffStr} ${hoursOffStr} * * *`, function () {
        let now = new Date();
        let month = now.getMonth() + 1;
        let dayOfMonth = now.getDate();
        let dayOfWeek = now.getDay();

        let isMonthMatch = activeMonthsOff.indexOf(month) !== -1;
        let isDayOfMonthMatch = daysOfMonthOff.indexOf(dayOfMonth) !== -1;
        let isDayOfWeekMatch = daysOfWeekOff[dayOfWeek];

        if (isMonthMatch && (isDayOfMonthMatch || isDayOfWeekMatch)) {
          if (setDeviceValue(source, false, options.Invert))
            sendNotification(source, options.SendNotifications, "отключено");
        }
      });
      variables.cronTasksOff.push(task);
    });
  }

  // Устанавливаем текущее состояние, если параметры изменились
  if (hasChanges) {
    let now = new Date();
    let currentTimeMinutes = now.getHours() * 60 + now.getMinutes(); // Текущее время в минутах с полуночи
    let timesOn = options.TimeOn.split(',').map(t => parseTime(t.trim())).map(t => parseInt(t.hoursStr) * 60 + parseInt(t.minutesStr));
    let timesOff = options.TimeOff.split(',').map(t => parseTime(t.trim())).map(t => parseInt(t.hoursStr) * 60 + parseInt(t.minutesStr));

    let daysOfMonthOn = parseRange(options.DaysOfMonthOn);
    let activeMonthsOn = parseRange(options.ActiveMonthsOn);
    let daysOfWeekOn = [
      options.SundayOn, options.MondayOn, options.TuesdayOn, options.WednesdayOn,
      options.ThursdayOn, options.FridayOn, options.SaturdayOn
    ];
    let daysOfMonthOff = parseRange(options.DaysOfMonthOff);
    let activeMonthsOff = parseRange(options.ActiveMonthsOff);
    let daysOfWeekOff = [
      options.SundayOff, options.MondayOff, options.TuesdayOff, options.WednesdayOff,
      options.ThursdayOff, options.FridayOff, options.SaturdayOff
    ];

    let nowMonth = now.getMonth() + 1;
    let nowDayOfMonth = now.getDate();
    let nowDayOfWeek = now.getDay();

    let isOnMonthMatch = activeMonthsOn.indexOf(nowMonth) !== -1;
    let isOnDayOfMonthMatch = daysOfMonthOn.indexOf(nowDayOfMonth) !== -1;
    let isOnDayOfWeekMatch = daysOfWeekOn[nowDayOfWeek];
    let isOffMonthMatch = activeMonthsOff.indexOf(nowMonth) !== -1;
    let isOffDayOfMonthMatch = daysOfMonthOff.indexOf(nowDayOfMonth) !== -1;
    let isOffDayOfWeekMatch = daysOfWeekOff[nowDayOfWeek];

    // Проверяем, активен ли день для включения или отключения
    let isOnDayActive = options.ScheduleOn && isOnMonthMatch && (isOnDayOfMonthMatch || isOnDayOfWeekMatch);
    let isOffDayActive = options.ScheduleOff && isOffMonthMatch && (isOffDayOfMonthMatch || isOffDayOfWeekMatch);

    if (isOnDayActive || isOffDayActive) {
      // Собираем все времена включения и отключения с учётом перехода через сутки
      let events = [];
      timesOn.forEach(time => events.push({ time: time, type: 'on' }));
      timesOff.forEach(time => events.push({ time: time, type: 'off' }));

      // Сортируем события по времени
      events.sort((a, b) => a.time - b.time);

      // Определяем текущее состояние
      let shouldBeOn = false;
      let lastEventTime = -1;

      for (let event of events) {
        if (event.time <= currentTimeMinutes && event.time > lastEventTime) {
          shouldBeOn = (event.type === 'on' && isOnDayActive) || (shouldBeOn && !(event.type === 'off' && isOffDayActive));
          lastEventTime = event.time;
        }
      }

      // Если последнее событие "включение" произошло вчера, а "отключение" ещё не было сегодня
      if (!shouldBeOn && isOnDayActive && timesOn.some(t => t > timesOff[timesOff.length - 1])) {
        let prevDay = new Date(now);
        prevDay.setDate(now.getDate() - 1);
        let prevDayOfWeek = prevDay.getDay();
        let prevDayOfMonth = prevDay.getDate();
        let isPrevOnDayMatch = activeMonthsOn.indexOf(nowMonth) !== -1 && (daysOfMonthOn.indexOf(prevDayOfMonth) !== -1 || daysOfWeekOn[prevDayOfWeek]);
        if (isPrevOnDayMatch) {
          let lastOnTimeYesterday = timesOn.filter(t => t > timesOff[timesOff.length - 1]).sort().pop();
          if (lastOnTimeYesterday && currentTimeMinutes < timesOff[0]) {
            shouldBeOn = true;
          }
        }
      }

      // Устанавливаем состояние, только если изменение автоматическое
      if (shouldBeOn !== undefined) {
        if (setDeviceValue(source, shouldBeOn, options.Invert))
          sendNotification(source, options.SendNotifications, shouldBeOn ? "включено" : "отключено");
      }
    }
  }
}

function getDeviceName(service) {
  const acc = service.getAccessory();
  const room = acc.getRoom().getName();
  const accName = service.getAccessory().getName();
  const sName = service.getName();
  const name = (accName == sName ? accName : accName + " " + sName) + " (ID:" + service.getUUID() + ", комната: " + room + ")";
  return name;
}

function sendNotification(source, enabled, msg) {
  if (enabled) {
    let service = source.getService();
    let deviceName = getDeviceName(service);
    let fullMsg = `${deviceName} ${msg}`;
    console.message(fullMsg);
    if (global.sendToTelegram !== undefined) {
      global.sendToTelegram(fullMsg);
    }
  }
}

function setDeviceValue(source, value, invert) {
  if (invert) value = !value;
  if (source.getType() === HC.On) {
    if (source.getValue() != value) {
      source.setValue(value);
      return true
    }
  } else if (source.getType() === HC.Active) {
    let newValue = value ? 1 : 0
    if (source.getValue() != newValue) {
      source.setValue(newValue);
      return true
    }
  }
  return false
}

function parseRange(str) {
  var result = [];
  if (!str) return result;
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

function parseTime(str) {
  var time = str || "00:00";
  var hours, minutes;
  var timeMatch = time.match(/^(\d{1,2}):(\d{1,2})$/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.warn("Некорректное время \"" + time + "\", используется \"00:00\"");
      hours = 0;
      minutes = 0;
    }
  } else {
    console.warn("Некорректный формат времени \"" + time + "\", используется \"00:00\"");
    hours = 0;
    minutes = 0;
  }
  var hoursStr = hours < 10 ? "0" + hours : "" + hours;
  var minutesStr = minutes < 10 ? "0" + minutes : "" + minutes;
  time = hoursStr + ":" + minutesStr;
  return {
    time: time,
    hoursStr: hoursStr,
    minutesStr: minutesStr
  }
}

function isAutomaticChange(context) {
  // Разделяем контекст на элементы по символу '<-'
  const elements = context.toString().split(' <- ');
  // Проверяем, есть ли элементы в массиве
  if (elements.length === 0) {
    return false;
  }
  let last = elements[elements.length - 1];

  // Условие 1: Последний элемент начинается с 'CLINK' или 'HUB[OnStart]'
  if (last.startsWith('CLINK') || last.startsWith('HUB[OnStart]')) {
    return true;
  }

  // Условие 2: Первые три элемента соответствуют шаблону 'LOGIC <- C <- LOGIC'
  if (elements.length >= 3 &&
    elements[0].startsWith('LOGIC') &&
    elements[1].startsWith('C') &&
    elements[2].startsWith('LOGIC')) {
    return true;
  }

  // Если условия не выполнены, изменение ручное
  return false;
}