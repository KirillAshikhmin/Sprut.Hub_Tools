info = {
  name: "📅 Планировщик расширенный",
  description: "Включает выключатель в заданное время в указанные дни месяца и/или дни недели. Обновления в канале https://t.me/smart_sputnik",
  version: "2.1",
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
    DaysOfMonthOn: { type: "String", value: "1-31", name: { ru: "  Дни месяца (вкл)", en: "  Days of month (turn on)" }, desc: { ru: "Числа месяца для включения (например, '1', '15, 30' или '1-5').\nТакже поддерживаются специальные значения:\n- 'последний' - последний день месяца\n- 'первый' - первый день месяца\n- 'чётные' - чётные числа\n- 'нечётные' - нечётные числа\n- 'последний-N' - N-й день с конца месяца\n- Названия дней недели (например, 'понедельник', 'вторник', 'среда' и т.д. или сокращённо 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс')\nВключение происходит по выбранным дням недели и указанным числам.", en: "Days of the month to turn on (e.g., '1', '15, 30' or '1-5').\nSpecial values are also supported:\n- 'last' - last day of the month\n- 'first' - first day of the month\n- 'even' - even days\n- 'odd' - odd days\n- 'last-N' - Nth day from the end of the month\n- Weekday names (e.g., 'monday', 'tuesday', 'wednesday', etc.)\nActivation occurs on selected weekdays and specified days." } },
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
    DaysOfMonthOff: { type: "String", value: "1-31", name: { ru: "  Дни месяца (откл)", en: "  Days of month (turn off)" }, desc: { ru: "Числа месяца для отключения. Поддерживает те же форматы значений, что и поле 'Дни месяца (вкл)'.\nОтключение происходит по выбранным дням недели и указанным числам.", en: "Days of the month to turn off. Supports the same value formats as 'Days of month (turn on)' field.\nDeactivation occurs on selected weekdays and specified days." } },
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
};

function trigger(source, value, variables, options, context) {
  try {
    let needRestoreTargetState = false;
    // Поддержание текущего состояния при ручном изменении
    if (options.MaintainState && !isAutomaticChange(context)) {
      needRestoreTargetState = true;
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
      let daysOfMonthOn = parseRange(options.DaysOfMonthOn) || [];
      let activeMonthsOn = parseRange(options.ActiveMonthsOn, true) || [];
      let daysOfWeekOn = [
        options.SundayOn, options.MondayOn, options.TuesdayOn, options.WednesdayOn,
        options.ThursdayOn, options.FridayOn, options.SaturdayOn
      ];

      timesOn.forEach(time => {
        let timeOnObj = parseTime(time);
        if (timeOnObj.time === "00:00" && time !== "00:00") {
          return;
        }
        let hoursOnStr = timeOnObj.hoursStr;
        let minutesOnStr = timeOnObj.minutesStr;

        let task = Cron.schedule(`0 ${minutesOnStr} ${hoursOnStr} * * *`, () => {
          let now = new Date();
          let month = now.getMonth() + 1;
          let dayOfWeek = now.getDay();

          let isMonthMatch = activeMonthsOn.indexOf(month) !== -1;
          let isDayOfMonthMatch = daysOfMonthOn.some(day => isDayMatch(day, now));
          let isDayOfWeekMatch = daysOfWeekOn[dayOfWeek];

          if (isMonthMatch && (isDayOfMonthMatch || isDayOfWeekMatch)) {
            if (setDeviceValue(source, true, options.Invert)) {
              sendNotification(source, options.SendNotifications, "включено");
            }
            if (options.TurnOffDelay > 0 && !options.ScheduleOff) {
              setTimeout(() => {
                if (setDeviceValue(source, false, options.Invert)) {
                  sendNotification(source, options.SendNotifications, `отключено через ${options.TurnOffDelay} сек`);
                }
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
      let daysOfMonthOff = parseRange(options.DaysOfMonthOff) || [];
      let activeMonthsOff = parseRange(options.ActiveMonthsOff, true) || [];
      let daysOfWeekOff = [
        options.SundayOff, options.MondayOff, options.TuesdayOff, options.WednesdayOff,
        options.ThursdayOff, options.FridayOff, options.SaturdayOff
      ];

      timesOff.forEach(time => {
        let timeOffObj = parseTime(time);
        if (timeOffObj.time === "00:00" && time !== "00:00") {
          return;
        }
        let hoursOffStr = timeOffObj.hoursStr;
        let minutesOffStr = timeOffObj.minutesStr;

        let task = Cron.schedule(`0 ${minutesOffStr} ${hoursOffStr} * * *`, () => {
          let now = new Date();
          let month = now.getMonth() + 1;
          let dayOfWeek = now.getDay();

          let isMonthMatch = activeMonthsOff.indexOf(month) !== -1;
          let isDayOfMonthMatch = daysOfMonthOff.some(day => isDayMatch(day, now));
          let isDayOfWeekMatch = daysOfWeekOff[dayOfWeek];

          if (isMonthMatch && (isDayOfMonthMatch || isDayOfWeekMatch)) {
            if (setDeviceValue(source, false, options.Invert)) {
              sendNotification(source, options.SendNotifications, "отключено");
            }
          }
        });
        variables.cronTasksOff.push(task);
      });
    }

    // Устанавливаем текущее состояние, если параметры изменились
    if (hasChanges) {
      let now = new Date();
      let currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

      let timesOn = options.TimeOn.split(',').map(t => {
        let parsed = parseTime(t.trim());
        let minutes = parseInt(parsed.hoursStr) * 60 + parseInt(parsed.minutesStr);
        return minutes;
      });

      let timesOff = options.TimeOff.split(',').map(t => {
        let parsed = parseTime(t.trim());
        let minutes = parseInt(parsed.hoursStr) * 60 + parseInt(parsed.minutesStr);
        return minutes;
      });

      let daysOfMonthOn = parseRange(options.DaysOfMonthOn) || [];
      let activeMonthsOn = parseRange(options.ActiveMonthsOn, true) || [];
      let daysOfWeekOn = [
        options.SundayOn, options.MondayOn, options.TuesdayOn, options.WednesdayOn,
        options.ThursdayOn, options.FridayOn, options.SaturdayOn
      ];

      let daysOfMonthOff = parseRange(options.DaysOfMonthOff) || [];
      let activeMonthsOff = parseRange(options.ActiveMonthsOff, true) || [];
      let daysOfWeekOff = [
        options.SundayOff, options.MondayOff, options.TuesdayOff, options.WednesdayOff,
        options.ThursdayOff, options.FridayOff, options.SaturdayOff
      ];

      let nowMonth = now.getMonth() + 1;
      let nowDayOfWeek = now.getDay();

      // Проверяем, активен ли день для включения или отключения
      let isOnDayActive = options.ScheduleOn && activeMonthsOn.indexOf(nowMonth) !== -1 &&
        (daysOfMonthOn.some(day => isDayMatch(day, now)) || daysOfWeekOn[nowDayOfWeek]);
      let isOffDayActive = options.ScheduleOff && activeMonthsOff.indexOf(nowMonth) !== -1 &&
        (daysOfMonthOff.some(day => isDayMatch(day, now)) || daysOfWeekOff[nowDayOfWeek]);

      if (isOnDayActive || isOffDayActive) {
        let events = [];

        // Добавляем события включения
        if (isOnDayActive) {
          timesOn.forEach(time => {
            events.push({ time: time, type: 'on' });
          });
        }

        // Добавляем события выключения
        if (isOffDayActive) {
          timesOff.forEach(time => {
            events.push({ time: time, type: 'off' });
          });
        }

        // Сортируем события по времени
        events.sort((a, b) => a.time - b.time);

        // Находим последнее событие до текущего времени
        let lastEvent = null;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].time <= currentTimeMinutes) {
            lastEvent = events[i];
            break;
          }
        }

        // Если нашли событие, применяем его
        if (lastEvent !== null) {
          let shouldBeOn = (lastEvent.type === 'on');
          if (setDeviceValue(source, shouldBeOn, options.Invert)) {
            sendNotification(source, options.SendNotifications, shouldBeOn ? "включено" : "отключено");
          }
        }
      }
    }

  } catch (e) {
    console.error("Ошибка расширенном планировщике: " + e.stack);
  }
}

function getDeviceName(service) {
  const acc = service.getAccessory();
  const room = acc.getRoom().getName();
  const accName = acc.getName();
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
      return true;
    }
  } else if (source.getType() === HC.Active) {
    let newValue = value ? 1 : 0;
    if (source.getValue() != newValue) {
      source.setValue(newValue);
      return true;
    }
  }
  return false;
}

function isDayMatch(day, currentDate) {
  if (!day) return false;

  const dayOfMonth = currentDate.getDate();
  const dayOfWeek = currentDate.getDay();
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  // Проверка на числовое значение
  const numDay = parseInt(day, 10);
  if (!isNaN(numDay)) {
    return numDay === dayOfMonth;
  }

  // Специальные значения
  switch (day) {
    case 'last':
      return dayOfMonth === lastDayOfMonth;
    case 'first':
      return dayOfMonth === 1;
  }

  // Проверка last-N
  if (day.startsWith('last-')) {
    const n = parseInt(day.split('-')[1], 10);
    if (!isNaN(n)) {
      return dayOfMonth === (lastDayOfMonth - n);
    }
  }

  // Проверка дня недели
  if (typeof day === 'string' && day.startsWith('weekday-')) {
    const weekday = parseInt(day.split('-')[1], 10);
    return weekday === dayOfWeek;
  }

  return false;
}

function parseRange(str, isMonth = false) {
  // Проверяем входные данные
  if (!str || typeof str !== 'string') {
    return [];
  }

  // Приводим к нижнему регистру и убираем пробелы
  str = str.toLowerCase().trim();

  // Специальные значения для дней недели: синонимы для каждого weekday-N
  const weekdays = {
    'weekday-0': ['sunday', 'воскресенье', 'вс', 'sun'],
    'weekday-1': ['monday', 'понедельник', 'пн', 'mon'],
    'weekday-2': ['tuesday', 'вторник', 'вт', 'tue'],
    'weekday-3': ['wednesday', 'среда', 'ср', 'wed'],
    'weekday-4': ['thursday', 'четверг', 'чт', 'thu'],
    'weekday-5': ['friday', 'пятница', 'пт', 'fri'],
    'weekday-6': ['saturday', 'суббота', 'сб', 'sat']
  };

  // Проверяем дни недели (только если не месяц)
  if (!isMonth) {
    var weekdayKeys = Object.keys(weekdays);
    for (var i = 0; i < weekdayKeys.length; i++) {
      var weekday = weekdayKeys[i];
      var synonyms = weekdays[weekday];
      if (synonyms.indexOf(str) !== -1) {
        return [weekday];
      }
    }
  }

  // Проверяем другие специальные значения (только если не месяц)
  if (!isMonth) {
    if (str === 'last' || str === 'последний') {
      return ['last'];
    }
    if (str === 'first' || str === 'первый') {
      return [1];
    }
    if (str === 'even' || str === 'чётные' || str === 'четные') {
      let result = [];
      for (let i = 2; i <= 30; i += 2) {
        result.push(i);
      }
      return result;
    }
    if (str === 'odd' || str === 'нечётные' || str === 'нечетные') {
      let result = [];
      for (let i = 1; i <= 31; i += 2) {
        result.push(i);
      }
      return result;
    }

    // Проверяем формат last-N
    const lastNMatch = str.match(/^(last|последний)-(\d+)$/);
    if (lastNMatch) {
      const n = parseInt(lastNMatch[2], 10);
      if (!isNaN(n) && n > 0 && n < 31) {
        return ['last-' + n];
      }
      return [];
    }
  }

  // Разбиваем строку по запятым и очищаем от пробелы
  const parts = str.split(',').map(p => p.trim()).filter(p => p !== '');

  if (parts.length === 0) {
    return [];
  }

  const result = [];
  const maxValue = isMonth ? 12 : 31;

  const addUniqueValue = value => {
    if (result.indexOf(value) === -1) {
      result.push(value);
    }
  };

  for (let part of parts) {
    // Проверяем диапазон (например, "1-5")
    if (part.indexOf('-') !== -1) {
      var rangeParts = part.split('-').map(n => parseInt(n, 10));
      var start = rangeParts[0];
      var end = rangeParts[1];

      // Проверяем валидность диапазона
      if (!isNaN(start) && !isNaN(end) && start > 0 && end <= maxValue && start <= end) {
        for (let i = start; i <= end; i++) {
          addUniqueValue(i);
        }
      }
    } else {
      // Обрабатываем одиночные числа
      const num = parseInt(part, 10);
      if (!isNaN(num) && num > 0 && num <= maxValue) {
        addUniqueValue(num);
      }
    }
  }

  result.sort((a, b) => a - b);
  return result;
}

function parseTime(str) {
  var time = str || "00:00";
  var hours, minutes;

  // Проверяем на множественные времена
  if (time.indexOf(',') !== -1) {
    // Разбиваем и обрабатываем каждое время отдельно
    let times = time.split(',').map(t => t.trim());
    let validTimes = times.map(t => parseTime(t));
    // Если какое-то время невалидно, возвращаем 00:00
    if (validTimes.some(t => t.time === "00:00")) {
      if (!inTestMode) {
        console.warn("Некорректный формат в списке времен: {}", time);
      }
      return { time: "00:00", hoursStr: "00", minutesStr: "00" };
    }
    // Возвращаем объект времени для текущего обрабатываемого времени
    return validTimes[times.indexOf(str.trim())] || validTimes[0];
  }

  // Проверяем на недопустимые символы
  if (time.match(/[^0-9:]/)) {
    if (!inTestMode) {
      console.warn("Обнаружены недопустимые символы во времени: {}", time);
    }
    return { time: "00:00", hoursStr: "00", minutesStr: "00" };
  }

  // Обрабатываем форматы X:X и XX:XX
  var timeMatch = time.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!timeMatch) {
    if (!inTestMode) {
      console.warn("Некорректный формат времени: {}", time);
    }
    return { time: "00:00", hoursStr: "00", minutesStr: "00" };
  }

  hours = parseInt(timeMatch[1], 10);
  minutes = parseInt(timeMatch[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    if (!inTestMode) {
      console.warn("Некорректное время: {}. Часы должны быть от 0 до 23, минуты от 0 до 59", time);
    }
    return { time: "00:00", hoursStr: "00", minutesStr: "00" };
  }

  // Форматируем с ведущими нулями
  var hoursStr = hours < 10 ? "0" + hours : "" + hours;
  var minutesStr = minutes < 10 ? "0" + minutes : "" + minutes;
  return {
    time: hoursStr + ":" + minutesStr,
    hoursStr: hoursStr,
    minutesStr: minutesStr
  };
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

//#############################################################################
//                                    ТЕСТЫ                                   #
//#############################################################################

let isDeveloping = true; // Флаг разработки. Включить что бы тесты выполнялись.

let inTestMode = false;
let testCronCallbacks = [];
let originalDate = Date;
let mockDate = null;

let assert = global.assert; let assertNull = global.assertNull; let assertNotNull = global.assertNotNull; let assertEquals = global.assertEquals; let assertNotEquals = global.assertNotEquals; let assertTrue = global.assertTrue; let assertFalse = global.assertFalse; let assertDefined = global.assertDefined; let assertContains = global.assertContains; let assertEmpty = global.assertEmpty; let assertNotEmpty = global.assertNotEmpty; let assertLength = global.assertLength;

function clearTestCronCallbacks() {
  testCronCallbacks = [];
}

function runTestCronCallbacks() {
  const now = new Date();
  testCronCallbacks.forEach(task => {
    if (shouldRunCron(task.pattern, now)) {
      task.callback();
    }
  });
}

function shouldRunCron(pattern, now) {
  const fields = pattern.trim().split(/\s+/);
  if (fields.length !== 6) {
    console.warn("Неверный формат Cron-выражения:", pattern);
    return false;
  }

  const second = fields[0];
  const minute = fields[1];
  const hour = fields[2];
  const dayOfMonth = fields[3];
  const month = fields[4];
  const dayOfWeek = fields[5];

  const currentSecond = now.getSeconds();
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  const currentDayOfMonth = now.getDate();
  const currentMonth = now.getMonth() + 1; // Месяцы в JS с 0
  const currentDayOfWeek = now.getDay();    // 0 - воскресенье, 6 - суббота

  const matchField = (field, value) => {
    if (field === '*') return true;
    const values = field.split(',').map(v => parseInt(v, 10));
    return values.some(v => !isNaN(v) && v === value);
  };

  return (
    matchField(second, currentSecond) &&
    matchField(minute, currentMinute) &&
    matchField(hour, currentHour) &&
    (dayOfMonth === '*' || matchField(dayOfMonth, currentDayOfMonth)) &&
    (month === '*' || matchField(month, currentMonth)) &&
    (dayOfWeek === '*' || matchField(dayOfWeek, currentDayOfWeek))
  );
}

function setMockDate(date) {
  mockDate = date;
  let DateProxy = function () {
    if (arguments.length === 0) {
      return new originalDate(mockDate.getTime());
    }
    return new (Function.prototype.bind.apply(originalDate, [null].concat(Array.prototype.slice.call(arguments))));
  };

  // Копируем все статические свойства
  Object.getOwnPropertyNames(originalDate).forEach(prop => {
    DateProxy[prop] = originalDate[prop];
  });

  // Устанавливаем прототип
  DateProxy.prototype = Object.create(originalDate.prototype);
  DateProxy.prototype.constructor = DateProxy;

  // Переопределяем методы прототипа
  let methods = [
    'getTime', 'getDate', 'getDay', 'getFullYear', 'getHours',
    'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds',
    'getYear', 'toDateString', 'toISOString', 'toJSON',
    'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString',
    'toString', 'toTimeString', 'toUTCString', 'valueOf'
  ];

  methods.forEach(method => {
    DateProxy.prototype[method] = function () {
      return mockDate[method].apply(mockDate, arguments);
    };
  });

  // Переопределяем now()
  DateProxy.now = () => mockDate.getTime();

  // Заменяем глобальный Date
  Date = DateProxy;
}

function restoreDate() {
  Date = originalDate;
  mockDate = null;
}

const OriginalCron = Cron;
Cron = {
  schedule: (pattern, callback) => {
    if (inTestMode) {
      testCronCallbacks.push({ pattern: pattern, callback: callback });
      return {
        clear: () => {
          testCronCallbacks = testCronCallbacks.filter(
            task => task.callback !== callback
          );
        }
      };
    }
    return OriginalCron.schedule(pattern, callback);
  }
};

function resetTestState() {
  clearTestCronCallbacks();
  restoreDate();
}

// Функция для запуска всех тестов
function runTests() {
  if (!isDeveloping || !global.hasUnitTests) {
    return;
  }

  try {
    inTestMode = true;

    console.info("Запуск тестов планировщика");

    // Интеграционные тесты планировщика
    console.info("Тест 1: Включение по расписанию");
    test1_ScheduledTurnOn();

    console.info("Тест 2: Отключение по расписанию");
    test2_ScheduledTurnOff();

    console.info("Тест 3: Множественные времена");
    test3_MultipleTimes();

    console.info("Тест 4: Последний день месяца");
    test4_LastDayOfMonth();

    console.info("Тест 5: Last-N дней");
    test5_LastNDays();

    console.info("Тест 6: Четные дни");
    test6_EvenDays();

    console.info("Тест 7: Нечетные дни");
    test7_OddDays();

    console.info("Тест 8: Дни недели");
    test8_Weekdays();

    console.info("Тест 9: Работа с HC.Active");
    test9_ActiveCharacteristic();

    console.info("Тест 10: Комбинация дней недели и чисел");
    test10_WeekdaysAndDays();

    // Unit тесты для функций парсинга
    console.info("Тест 11: Функция parseTime");
    test11_ParseTime();

    console.info("Тест 12: Функция parseRange");
    test12_ParseRange();

    console.info("Тест 13: Функция isDayMatch");
    test13_IsDayMatch();
  } finally {
    inTestMode = false;
    resetTestState();
  }
}

// Получение начальных значений переменных планировщика
function getDefaultVariables() {
  return {
    cronTasksOn: [],
    cronTasksOff: [],
    prevTimeOn: undefined,
    prevTimeOff: undefined
  };
}

// Создание тестового выключателя с HC.On
function createTestSwitch() {
  return global.createUnitTestFullAccessory({
    id: 1,
    name: "Тестовый выключатель",
    room: "Тест",
    services: [{
      id: 10,
      type: HS.Switch,
      name: "Выключатель",
      characteristics: [{
        id: 11,
        type: HC.On,
        value: false
      }]
    }]
  });
}

// Создание тестового устройства с HC.Active
function createTestActiveDevice() {
  return global.createUnitTestFullAccessory({
    id: 2,
    name: "Тестовое устройство",
    room: "Тест",
    services: [{
      id: 20,
      type: HS.Fan,
      name: "Вентилятор",
      characteristics: [{
        id: 21,
        type: HC.Active,
        value: 0
      }]
    }]
  });
}

// Базовые опции для тестов
function getDefaultOptions() {
  return {
    ScheduleOn: false,
    DaysOfMonthOn: "",
    MondayOn: false,
    TuesdayOn: false,
    WednesdayOn: false,
    ThursdayOn: false,
    FridayOn: false,
    SaturdayOn: false,
    SundayOn: false,
    TimeOn: "",
    ActiveMonthsOn: "1-12",
    ScheduleOff: false,
    DaysOfMonthOff: "",
    MondayOff: false,
    TuesdayOff: false,
    WednesdayOff: false,
    ThursdayOff: false,
    FridayOff: false,
    SaturdayOff: false,
    SundayOff: false,
    TimeOff: "",
    ActiveMonthsOff: "1-12",
    SendNotifications: false,
    Invert: false,
    TurnOffDelay: 0,
    MaintainState: false
  };
}

// Тест 1: Включение по расписанию
function test1_ScheduledTurnOn() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "1";
  options.TimeOn = "12:00";
  options.ActiveMonthsOn = "1-12"; // Явно указываем все месяцы

  let mockDate = new Date(2024, 0, 1, 12, 0);
  setMockDate(mockDate);

  // Проверяем значения до trigger
  let activeMonths = parseRange(options.ActiveMonthsOn, true);
  assertTrue(activeMonths.indexOf(1) !== -1, "test1_ScheduledTurnOn: Январь должен быть в списке активных месяцев");

  let daysOfMonth = parseRange(options.DaysOfMonthOn);
  assertTrue(daysOfMonth.indexOf(1) !== -1, "test1_ScheduledTurnOn: 1-е число должно быть в списке дней");

  trigger(source, true, variables, options, "LOGIC");

  // Проверяем значения после trigger
  let now = new Date();
  let nowMonth = now.getMonth() + 1;
  let nowDay = now.getDate();

  // Проверяем, что текущий месяц и день соответствуют ожидаемым
  assertEquals(1, nowMonth, "test1_ScheduledTurnOn: Текущий месяц должен быть январь (1)");
  assertEquals(1, nowDay, "test1_ScheduledTurnOn: Текущий день должен быть 1-е число");

  runTestCronCallbacks();
  assertTrue(source.getValue(), "test1_ScheduledTurnOn: Выключатель должен быть включен в 12:00");
}

// Тест 2: Отключение по расписанию
function test2_ScheduledTurnOff() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  source.setValue(true);
  let options = getDefaultOptions();
  options.ScheduleOff = true;
  options.DaysOfMonthOff = "1";
  options.TimeOff = "15:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 15, 0));
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test2_ScheduledTurnOff: Выключатель должен быть выключен в 15:00");
}

// Тест 3: Множественные времена
function test3_MultipleTimes() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.ScheduleOff = true;
  options.DaysOfMonthOn = "1";
  options.DaysOfMonthOff = "1";
  options.TimeOn = "09:00, 15:00, 21:00";
  options.TimeOff = "12:00, 18:00, 23:00";
  options.ActiveMonthsOn = "1-12";
  options.ActiveMonthsOff = "1-12";

  // Начальная инициализация
  source.setValue(false);

  // Проверяем включение в 9:00
  let date9am = new Date(2024, 0, 1, 9, 0);
  setMockDate(date9am);
  trigger(source, false, variables, options, "LOGIC");
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test3_MultipleTimes: Выключатель должен быть включен в 9:00");

  // Проверяем выключение в 12:00
  let date12pm = new Date(2024, 0, 1, 12, 0);
  setMockDate(date12pm);
  trigger(source, source.getValue(), variables, options, "LOGIC");
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test3_MultipleTimes: Выключатель должен быть выключен в 12:00");

  // Проверяем включение в 15:00
  let date3pm = new Date(2024, 0, 1, 15, 0);
  setMockDate(date3pm);
  trigger(source, source.getValue(), variables, options, "LOGIC");
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test3_MultipleTimes: Выключатель должен быть включен в 15:00");

  // Проверяем выключение в 18:00
  let date6pm = new Date(2024, 0, 1, 18, 0);
  setMockDate(date6pm);
  trigger(source, source.getValue(), variables, options, "LOGIC");
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test3_MultipleTimes: Выключатель должен быть выключен в 18:00");

  // Проверяем включение в 21:00
  let date9pm = new Date(2024, 0, 1, 21, 0);
  setMockDate(date9pm);
  trigger(source, source.getValue(), variables, options, "LOGIC");
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test3_MultipleTimes: Выключатель должен быть включен в 21:00");

  // Проверяем выключение в 23:00
  let date11pm = new Date(2024, 0, 1, 23, 0);
  setMockDate(date11pm);
  trigger(source, source.getValue(), variables, options, "LOGIC");
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test3_MultipleTimes: Выключатель должен быть выключен в 23:00");
}

// Тест 4: Последний день месяца
function test4_LastDayOfMonth() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "last";
  options.TimeOn = "15:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 31, 15, 0));
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test4_LastDayOfMonth: Должно включиться в последний день месяца");
}

// Тест 5: Last-N дней
function test5_LastNDays() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "last-2";
  options.TimeOn = "15:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 29, 15, 0));
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test5_LastNDays: Должно включиться за 2 дня до конца месяца");
}

// Тест 6: Четные дни
function test6_EvenDays() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "even";
  options.TimeOn = "15:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 2, 15, 0));
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test6_EvenDays: Должно включиться в четный день");
}

// Тест 7: Нечетные дни
function test7_OddDays() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "odd";
  options.TimeOn = "15:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 3, 15, 0));
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test7_OddDays: Должно включиться в нечетный день");
}

// Тест 8: Дни недели
function test8_Weekdays() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.MondayOn = true;
  options.TimeOn = "15:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 15, 0)); // 1 января 2024 - понедельник
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test8_Weekdays: Должно включиться в понедельник");
}

// Тест 9: Работа с HC.Active
function test9_ActiveCharacteristic() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestActiveDevice();
  let source = acc.getService(HS.Fan).getCharacteristic(HC.Active);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "1";
  options.TimeOn = "12:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 12, 0));
  runTestCronCallbacks();
  assertEquals(1, source.getValue(), "test9_ActiveCharacteristic: Устройство должно быть активировано (значение 1)");

  resetTestState();
  variables = getDefaultVariables();
  options = getDefaultOptions();
  options.ScheduleOff = true;
  options.DaysOfMonthOff = "1";
  options.TimeOff = "13:00";

  source.setValue(1);
  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 13, 0));
  runTestCronCallbacks();
  assertEquals(0, source.getValue(), "test9_ActiveCharacteristic: Устройство должно быть деактивировано (значение 0)");
}

// Тест 10: Комбинация дней недели и чисел
function test10_WeekdaysAndDays() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "1,15";
  options.MondayOn = true;
  options.TimeOn = "15:00";

  setMockDate(new Date(2024, 0, 1, 15, 0));
  trigger(source, true, variables, options, "LOGIC");

  runTestCronCallbacks();
  assertTrue(source.getValue(), "test10_WeekdaysAndDays: Должно включиться 1- го числа");

  variables = getDefaultVariables();
  source.setValue(false);
  setMockDate(new Date(2024, 0, 8, 15, 0));
  trigger(source, true, variables, options, "LOGIC");
  runTestCronCallbacks();
  assertTrue(source.getValue(), "test10_WeekdaysAndDays: Должно включиться в понедельник");
}

// Тест 11: Невалидные форматы
function test11_InvalidFormats() {
  resetTestState();
  let variables = getDefaultVariables();
  let acc = createTestSwitch();
  let source = acc.getService(HS.Switch).getCharacteristic(HC.On);

  // Тест невалидного времени
  let options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "1";
  options.TimeOn = "25:00"; // Невалидное время

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 0, 0));
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test11_InvalidFormats: Планировщик не должен включаться при невалидном времени");

  // Тест невалидного дня месяца
  resetTestState();
  variables = getDefaultVariables();
  options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "32"; // Невалидный день
  options.TimeOn = "12:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 12, 0));
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test11_InvalidFormats: Планировщик не должен включаться при невалидном дне месяца");

  // Тест невалидного формата last-N
  resetTestState();
  variables = getDefaultVariables();
  options = getDefaultOptions();
  options.ScheduleOn = true;
  options.DaysOfMonthOn = "last-32"; // Невалидный формат last-N
  options.TimeOn = "12:00";

  trigger(source, true, variables, options, "LOGIC");
  setMockDate(new Date(2024, 0, 1, 12, 0));
  runTestCronCallbacks();
  assertFalse(source.getValue(), "test11_InvalidFormats: Планировщик не должен включаться при невалидном формате last-N");
}

// Unit тест для parseTime
function test11_ParseTime() {
  // Валидные форматы
  let validTimes = [
    { input: "0:0", expected: { time: "00:00", hoursStr: "00", minutesStr: "00" } },
    { input: "9:5", expected: { time: "09:05", hoursStr: "09", minutesStr: "05" } },
    { input: "23:59", expected: { time: "23:59", hoursStr: "23", minutesStr: "59" } },
    { input: "12:00", expected: { time: "12:00", hoursStr: "12", minutesStr: "00" } },
    { input: "9:00, 15:30, 18:45", expected: { time: "09:00", hoursStr: "09", minutesStr: "00" } }
  ];

  validTimes.forEach(test => {
    let result = parseTime(test.input);
    assertEquals(test.expected.time, result.time, `test11_ParseTime: Время "${test.input}" должно быть преобразовано в "${test.expected.time}"`);
    assertEquals(test.expected.hoursStr, result.hoursStr, `test11_ParseTime: Часы для "${test.input}" должны быть "${test.expected.hoursStr}"`);
    assertEquals(test.expected.minutesStr, result.minutesStr, `test11_ParseTime: Минуты для "${test.input}" должны быть "${test.expected.minutesStr}"`);
  });

  // Невалидные форматы
  let invalidTimes = [
    "24:00",    // Часы больше 23
    "12:60",    // Минуты больше 59
    "12:12:12", // Лишние двоеточия
    "abc",      // Нечисловой формат
    "12.00",    // Неверный разделитель
    "-1:00",    // Отрицательные значения
    "12:",      // Неполный формат
    ":30",      // Неполный формат
    "",         // Пустая строка
    "  "        // Только пробелы
  ];

  invalidTimes.forEach(time => {
    let result = parseTime(time);
    assertEquals("00:00", result.time, `test11_ParseTime: Невалидное время "${time}" должно быть преобразовано в "00:00"`);
    assertEquals("00", result.hoursStr, `test11_ParseTime: Невалидное время "${time}" должно иметь часы "00"`);
    assertEquals("00", result.minutesStr, `test11_ParseTime: Невалидное время "${time}" должно иметь минуты "00"`);
  });
}

// Unit тест для parseRange
function test12_ParseRange() {
  // Тест для месяцев
  let monthRanges = [
    { input: "1-12", expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], isMonth: true },
    { input: "1,6,12", expected: [1, 6, 12], isMonth: true },
    { input: "13", expected: [], isMonth: true },  // Невалидный месяц
    { input: "0", expected: [], isMonth: true },   // Невалидный месяц
    { input: "1-13", expected: [], isMonth: true } // Невалидный диапазон
  ];

  monthRanges.forEach(test => {
    let result = parseRange(test.input, test.isMonth);
    assertLength(test.expected, result.length, `test12_ParseRange: Диапазон месяцев "${test.input}" должен содержать ${test.expected.length} элементов`);
    test.expected.forEach((value, index) => {
      assertEquals(value, result[index], `test12_ParseRange: Месяц ${index} диапазона "${test.input}" должен быть ${value}`);
    });
  });

  // Тест для дней
  let validRanges = [
    { input: "1", expected: [1] },
    { input: "1-5", expected: [1, 2, 3, 4, 5] },
    { input: "1,15,30", expected: [1, 15, 30] },
    { input: "last", expected: ["last"] },
    { input: "последний", expected: ["last"] },
    { input: "first", expected: [1] },
    { input: "первый", expected: [1] },
    { input: "last-2", expected: ["last-2"] },
    { input: "последний-2", expected: ["last-2"] },
    { input: "even", expected: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
    { input: "чётные", expected: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
    { input: "odd", expected: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31] },
    { input: "нечётные", expected: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31] },
    { input: "monday", expected: ["weekday-1"] },
    { input: "понедельник", expected: ["weekday-1"] },
    { input: "sunday", expected: ["weekday-0"] },
    { input: "воскресенье", expected: ["weekday-0"] },
    // Тестируем обработку запятых
    { input: "1,,2", expected: [1, 2] },
    { input: "1,2,", expected: [1, 2] },
    { input: ",1,2", expected: [1, 2] },
    { input: "1.5", expected: [1] }
  ];

  validRanges.forEach(test => {
    let result = parseRange(test.input);
    assertLength(test.expected, result.length, `test12_ParseRange: Диапазон "${test.input}" должен содержать ${test.expected.length} элементов`);
    test.expected.forEach((value, index) => {
      assertEquals(value, result[index], `test12_ParseRange: Элемент ${index} диапазона "${test.input}" должен быть ${value}`);
    });
  });

  // Невалидные форматы, которые должны вернуть пустой массив
  let invalidRanges = [
    "32",           // День больше 31
    "0",            // День меньше 1
    "1-32",         // Конец диапазона больше 31
    "5-1",          // Обратный диапазон
    "abc",          // Нечисловой формат
    "last-32",      // Невалидный last-N
    "last-0",       // Невалидный last-N
    "invalid-day"   // Неверный день недели
  ];

  invalidRanges.forEach(range => {
    let result = parseRange(range);
    assertEmpty(result, `test12_ParseRange: Невалидный диапазон "${range}" должен вернуть пустой массив`);
  });
}

// Unit тест для isDayMatch
function test13_IsDayMatch() {
  // Тестовые даты
  let january31 = new Date(2024, 0, 31); // Последний день января
  let january29 = new Date(2024, 0, 29); // За 2 дня до конца января
  let january15 = new Date(2024, 0, 15); // Середина месяца
  let monday = new Date(2024, 0, 1);     // Понедельник
  let sunday = new Date(2024, 0, 7);     // Воскресенье

  // Проверка последнего дня
  assertTrue(isDayMatch('last', january31), "test13_IsDayMatch: 31 января должен быть последним днем");
  assertFalse(isDayMatch('last', january15), "test13_IsDayMatch: 15 января не должен быть последним днем");

  // Проверка last-N
  assertTrue(isDayMatch('last-2', january29), "test13_IsDayMatch: 29 января должно быть за 2 дня до конца");
  assertFalse(isDayMatch('last-2', january31), "test13_IsDayMatch: 31 января не должно быть за 2 дня до конца");

  // Проверка дней недели
  assertTrue(isDayMatch('weekday-1', monday), "test13_IsDayMatch: 1 января 2024 должен быть понедельником");
  assertTrue(isDayMatch('weekday-0', sunday), "test13_IsDayMatch: 7 января 2024 должен быть воскресеньем");
  assertFalse(isDayMatch('weekday-1', sunday), "test13_IsDayMatch: 7 января 2024 не должен быть понедельником");

  // Проверка обычных дней
  assertTrue(isDayMatch('15', january15), "test13_IsDayMatch: Должно совпадать с 15 числом");
  assertFalse(isDayMatch('16', january15), "test13_IsDayMatch: Не должно совпадать с 16 числом");

  // Проверка невалидных значений
  assertFalse(isDayMatch('invalid', january15), "test13_IsDayMatch: Невалидное значение должно вернуть false");
  assertFalse(isDayMatch('32', january15), "test13_IsDayMatch: День больше 31 должен вернуть false");
  assertFalse(isDayMatch('0', january15), "test13_IsDayMatch: День меньше 1 должен вернуть false");
  assertFalse(isDayMatch('weekday-7', january15), "test13_IsDayMatch: Невалидный день недели должен вернуть false");
}

// Запускаем тесты при загрузке сценария
runTests();