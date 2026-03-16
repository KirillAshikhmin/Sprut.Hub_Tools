const REQUIRED_PARAM_CHARS = [HC.C_Integer, HC.C_Long, HC.C_Double, HC.C_Boolean];
let servicesList = getServicesByServiceAndCharacteristicType([HS.C_Option], REQUIRED_PARAM_CHARS);

let scenarioDescription = {
  ru: "Подсчитывает время работы и/или простоя устройства в указанные виртуальные сервисы типа Параметры. Можно указать один или два параметра.\n\n" +
    "Характеристики Параметра:\n" +
    "• Целое число — время работы/простоя в секундах.\n" +
    "• Строка (опционально) — времени текстом («2 часа 30 минут»).\n" +
    "• Логическое значение — сброс: включить → счётчик обнуляется.",
  en: "Counts device runtime and/or downtime in specified Parameter services. You can specify one or two Parameters.\n\n" +
    "Parameter characteristics:\n" +
    "• Integer — runtime/downtime in seconds.\n" +
    "• String (optional) — time in text («2 hours 30 minutes»).\n" +
    "• Boolean — reset: set to true → counter is zeroed."
};

info = {
  name: "⏱ Счётчик времени работы устройства",
  description: scenarioDescription.ru,
  version: "0.1",
  author: "@BOOMikru",
  onStart: true,

  sourceServices: [
    HS.Lightbulb,
    HS.Switch,
    HS.Television,
    HS.ContactSensor,
    HS.Fan,
    HS.FanBasic,
    HS.Valve,
    HS.Faucet,
    HS.AirPurifier,
    HS.Outlet,
    HS.HumidifierDehumidifier
  ],
  sourceCharacteristics: [HC.On, HC.Active],

  options: {
    desc: {
      name: { ru: "ОПИСАНИЕ", en: "DESCRIPTION" },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },
    runtimeParameter: {
      name: { ru: "Параметр наработки", en: "Runtime parameter" },
      desc: { ru: "Когда устройство включено", en: "When device is on" },
      type: "String",
      value: "",
      formType: "list",
      values: servicesList
    },
    downtimeParameter: {
      name: { ru: "Параметр простоя", en: "Downtime parameter" },
      desc: { ru: "Когда устройство выключено", en: "When device is off" },
      type: "String",
      value: "",
      formType: "list",
      values: servicesList
    }
  },

  variables: {
    intervalTask: undefined,
    parameterSubscribe: undefined
  }
};

const INTERVAL_MS = 30000;
const DEBUG_TITLE = "Счётчик времени работы: ";
const MS_MIN_VALID_TIMESTAMP = 1000000000000;

const getParamLabel = (isRuntime) => isRuntime ? "наработки" : "простоя";

function validateParamCharacteristics(paramService) {
  if (!paramService.getCharacteristic(HC.C_Integer)) return "Целое число";
  if (!paramService.getCharacteristic(HC.C_Long)) return "Длинное целое число";
  if (!paramService.getCharacteristic(HC.C_Double)) return "Дробное число";
  if (!paramService.getCharacteristic(HC.C_Boolean)) return "Логическое значение";
  return null;
}

function trigger(source, value, variables, options, context) {
  const runtimeParam = getService(options, "runtimeParameter");
  const downtimeParam = getService(options, "downtimeParameter");

  if (!runtimeParam && !downtimeParam) {
    console.error(DEBUG_TITLE + "Не выбраны параметры наработки и/или простоя");
    return;
  }

  if (runtimeParam && downtimeParam && options.runtimeParameter === options.downtimeParameter) {
    console.error(DEBUG_TITLE + "Параметры наработки и простоя должны быть разными");
    return;
  }

  const errors = [];
  if (runtimeParam) {
    const missing = validateParamCharacteristics(runtimeParam);
    if (missing) errors.push("наработки: " + missing);
  }
  if (downtimeParam) {
    const missing = validateParamCharacteristics(downtimeParam);
    if (missing) errors.push("простоя: " + missing);
  }
  if (errors.length) {
    console.error(DEBUG_TITLE + "Отсутствуют характеристики — " + errors.join("; "));
    return;
  }

  const isDeviceOn = (source.getType() === HC.On && value === true) || (source.getType() === HC.Active && value === 1);

  setupParameterSubscription(variables, options);

  if (isDeviceOn) {
    stopTimer(variables, downtimeParam);
    if (runtimeParam) startTimer(variables, runtimeParam);
  } else {
    stopTimer(variables, runtimeParam);
    if (downtimeParam) startTimer(variables, downtimeParam);
  }
}

function startTimer(variables, paramService) {
  const integerChar = paramService.getCharacteristic(HC.C_Integer);
  const doubleChar = paramService.getCharacteristic(HC.C_Double);
  const currentTotal = Number(integerChar.getValue());
  doubleChar.setValue(isNaN(currentTotal) || currentTotal < 0 ? 0 : currentTotal);

  const startTime = Date.now();
  const startTimeLongChar = paramService.getCharacteristic(HC.C_Long);
  startTimeLongChar.setValue(startTime);

  const updateFn = () => {
    const startTimeFromChar = startTimeLongChar.getValue();
    if (!isValidTimestamp(startTimeFromChar)) return;
    const totalSeconds = parseStoredSeconds(paramService) + (Date.now() - startTimeFromChar) / 1000;
    updateParameterService(paramService, totalSeconds);
  };

  updateFn();
  variables.intervalTask = setInterval(updateFn, INTERVAL_MS);
}

function stopTimer(variables, paramService) {
  if (variables.intervalTask) {
    clearInterval(variables.intervalTask);
    variables.intervalTask = undefined;
  }
  if (!paramService) return;
  const startTimeLongChar = paramService.getCharacteristic(HC.C_Long);
  const startTime = startTimeLongChar.getValue();
  startTimeLongChar.setValue(0);
  let totalSeconds = 0;
  if (isValidTimestamp(startTime)) {
    totalSeconds = parseStoredSeconds(paramService) + (Date.now() - startTime) / 1000;
  }
  updateParameterService(paramService, totalSeconds);
  const doubleChar = paramService.getCharacteristic(HC.C_Double);
  doubleChar.setValue(0);
}

function updateParameterService(service, totalSeconds) {
  const integerChar = service.getCharacteristic(HC.C_Integer);
  integerChar.setValue(Math.floor(totalSeconds));
  const stringChar = service.getCharacteristic(HC.C_String);
  if (stringChar) stringChar.setValue(formatRuntime(totalSeconds));
}

function isDeviceOn(service) {
  const onChar = service.getCharacteristic(HC.On);
  const activeChar = service.getCharacteristic(HC.Active);
  return (onChar && onChar.getValue() === true) || (activeChar && activeChar.getValue() === 1);
}

function setupParameterSubscription(variables, options) {
  if (variables.parameterSubscribe || (!options.runtimeParameter && !options.downtimeParameter)) {
    return;
  }

  variables.parameterSubscribe = Hub.subscribeWithCondition("", "", [HS.C_Option], [HC.C_Boolean], (boolSource, boolValue) => {
    if (boolValue !== true) return;
    const runtimeParamUuid = options.runtimeParameter;
    const downtimeParamUuid = options.downtimeParameter;
    const parameterServiceUuid = boolSource.getService().getUUID();
    if (parameterServiceUuid !== runtimeParamUuid && parameterServiceUuid !== downtimeParamUuid) return;
    if (parameterServiceUuid === runtimeParamUuid) handleParamReset(getServiceByUuid(runtimeParamUuid));
    if (parameterServiceUuid === downtimeParamUuid) handleParamReset(getServiceByUuid(downtimeParamUuid));
    boolSource.setValue(false);
  });
}

function handleParamReset(paramService) {
  const startTimeLongChar = paramService.getCharacteristic(HC.C_Long);
  startTimeLongChar.setValue(Date.now());
  const doubleChar = paramService.getCharacteristic(HC.C_Double);
  doubleChar.setValue(0);
  updateParameterService(paramService, 0);
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================

function parseStoredSeconds(paramService) {
  if (!paramService) return 0;
  const doubleChar = paramService.getCharacteristic(HC.C_Double);
  const val = Number(doubleChar ? doubleChar.getValue() : undefined);
  if (isNaN(val) || val < 0) return 0;
  return val;
}

function isValidTimestamp(ms) {
  return ms > MS_MIN_VALID_TIMESTAMP;
}

function getPluralForm(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 1;
  return 2;
}

const HOURS = ["час", "часа", "часов"];
const MINUTES = ["минута", "минуты", "минут"];

function formatRuntime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours < 1) {
    return minutes + " " + MINUTES[getPluralForm(minutes)];
  }
  if (minutes === 0) {
    return hours + " " + HOURS[getPluralForm(hours)];
  }
  return hours + " " + HOURS[getPluralForm(hours)] + " " + minutes + " " + MINUTES[getPluralForm(minutes)];
}

function getService(options, name) {
  const uuid = options[name];
  if (uuid === "" || !uuid) return undefined;
  return getServiceByUuid(uuid);
}

function getServiceByUuid(uuid) {
  if (!uuid) return undefined;
  try {
    const parts = String(uuid).split(".");
    if (parts.length >= 2) {
      const aid = parseInt(parts[0], 10);
      const sid = parseInt(parts[1], 10);
      const accessory = Hub.getAccessory(aid);
      if (accessory) {
        return accessory.getService(sid);
      }
    }
  } catch (e) {
    console.error(DEBUG_TITLE + "Ошибка получения устройства по uuid " + uuid + ": " + e.toString());
  }
  return undefined;
}

function getDeviceName(service) {
  if (!service) return "Unknown";
  try {
    const acc = service.getAccessory();
    const accName = acc.getName();
    const sName = service.getName();
    return acc.getRoom().getName() + " -> " + (accName === sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыт" : "");
  } catch (e) {
    return "Unknown";
  }
}

function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicTypes) {
  const unsorted = [];
  Hub.getAccessories().forEach((a) => {
    a.getServices()
      .filter((s) => serviceTypes.indexOf(s.getType()) >= 0)
      .filter((s) => characteristicTypes.every((c) => s.getCharacteristic(c)))
      .forEach((s) => {
        unsorted.push({ name: { ru: getDeviceName(s), en: getDeviceName(s) }, value: s.getUUID() });
      });
  });
  const sorted = [{ name: { ru: "Не выбрано", en: "Not selected" }, value: "" }];
  unsorted.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach((s) => sorted.push(s));
  return sorted;
}
