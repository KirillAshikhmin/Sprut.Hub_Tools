// Кнопка из счётчиков нажатий.
// Логика применяется к кнопке (StatelessProgrammableSwitch). На старте подписывается
// на счётчики импульсов (C_PulseMeter/C_PulseCount) и по инкременту выбранного счётчика
// пишет код события в ProgrammableSwitchEvent: 0=одиночное, 1=двойное, 2=долгое.

// Название сценария с локализацией.
let scenarioName = {
  ru: "🔘 Кнопка из счётчиков нажатий",
  en: "🔘 Button from press counters"
};

// Описание сценария для опции-статуса «ОПИСАНИЕ» в UI.
let scenarioDescription = {
  ru: "Превращает счётчики импульсов кнопочного модуля в событие кнопки.\n\nВыберите счётчик для каждого типа нажатия. Один счётчик нельзя назначить на несколько типов.",
  en: "Turns a button module's pulse counters into a button.\n\nPick a counter for each press type. One counter cannot map to several types."
};

// Список счётчиков для опций (обновляется на старте хаба и при сохранении сценария).
let pulseCounters = getPulseCounters();

info = {
  name: scenarioName.ru,
  description: "Превращает счётчики импульсов (короткие/двойные/долгие нажатия) в событие этой кнопки.",
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.StatelessProgrammableSwitch],
  sourceCharacteristics: [HC.ProgrammableSwitchEvent],

  options: {
    desc: {
      name: { ru: "  ОПИСАНИЕ", en: "  DESCRIPTION" },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },
    singleCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик одиночных нажатий", en: "Single press counter" }
    },
    doubleCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик двойных нажатий", en: "Double press counter" }
    },
    longCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик долгих нажатий", en: "Long press counter" }
    },
    debug: {
      type: "Boolean", value: false,
      name: { ru: "Отладочный лог", en: "Debug log" }
    }
  },

  variables: {
    subscribed: false,
    prev: {}
  }
};

function trigger(source, value, variables, options, context) {
  if (isSelfChanged(context)) return;
  if (hasDuplicateCounters(options)) {
    console.error("Кнопка из счётчиков нажатий: один счётчик выбран для нескольких типов нажатий — исправьте настройки логики. События не отправляются.");
    return;
  }
  setupSubscription(source, variables, options);
}

// Оформляет подписку на счётчики один раз. eventChar — сам источник (ProgrammableSwitchEvent кнопки).
function setupSubscription(anchorSource, variables, options) {
  if (variables.subscribed) return;
  let eventChar = anchorSource;
  if (!variables.prev) variables.prev = {};

  initPrev(variables, options);

  Hub.subscribeWithCondition("", "", [HS.C_PulseMeter], [HC.C_PulseCount],
    function (counterSource, counterValue) {
      handleCounter(counterSource, counterValue, variables, options, eventChar);
    });
  variables.subscribed = true;
}

// Инициализирует базу prev текущими значениями выбранных счётчиков — чтобы первое
// реальное нажатие после старта не было потеряно (колбэк на старте не вызывается).
function initPrev(variables, options) {
  let uuids = [options.singleCounter, options.doubleCounter, options.longCounter];
  uuids.forEach(function (uuid) {
    if (!uuid) return;
    let svc = getServiceByUUID(uuid);
    if (!svc) return;
    let ch = svc.getCharacteristic(HC.C_PulseCount);
    if (!ch) return;
    let n = Number(ch.getValue());
    variables.prev[uuid] = isNaN(n) ? 0 : n;
  });
}

function getServiceByUUID(uuid) {
  let parts = uuid.split(".");
  let acc = Hub.getAccessory(parts[0]);
  return acc ? acc.getService(parts[1]) : null;
}

// Колбэк подписки: детект инкремента и эмиссия события.
function handleCounter(counterSource, value, variables, options, eventChar) {
  let key = counterSource.getService().getUUID();
  let code = resolveEventCode(key, options);
  if (code < 0) {
    logDebug(options, "изменение невыбранного счётчика " + key + " — пропуск");
    return;
  }

  let v = Number(value);
  if (isNaN(v)) return;
  let prev = variables.prev[key];

  if (v === 0) { variables.prev[key] = 0; return; }              // сброс — не нажатие
  if (prev === undefined) { prev = 0; }                          // счётчик впервые виден, сохраняем значение.
  if (v > prev) {                                                // положительный инкремент = нажатие
    variables.prev[key] = v;
    eventChar.setValue(code);
    logDebug(options, "нажатие типа " + code + " (счётчик " + key + ": " + prev + " -> " + v + ")");
    return;
  }
  variables.prev[key] = v;                                        // равно/уменьшилось (не 0) — синхронизация
}

function resolveEventCode(key, options) {
  if (options.singleCounter && key === options.singleCounter) return 0;
  if (options.doubleCounter && key === options.doubleCounter) return 1;
  if (options.longCounter && key === options.longCounter) return 2;
  return -1;
}

// true, если один и тот же непустой счётчик выбран более чем для одного типа.
function hasDuplicateCounters(options) {
  let picked = [];
  let keys = [options.singleCounter, options.doubleCounter, options.longCounter];
  for (let i = 0; i < keys.length; i++) {
    if (!keys[i]) continue;
    if (picked.indexOf(keys[i]) >= 0) return true;
    picked.push(keys[i]);
  }
  return false;
}

// Список сервисов-счётчиков импульсов для выпадающих опций.
function getPulseCounters() {
  let list = [{ name: { ru: "Не выбрано", en: "Not selected" }, value: "" }];
  Hub.getAccessories().forEach(function (a) {
    a.getServices().forEach(function (s) {
      if (s.getType() === HS.C_PulseMeter && s.getCharacteristic(HC.C_PulseCount)) {
        let name = getCounterName(s);
        list.push({ name: { ru: name, en: name }, value: s.getUUID() });
      }
    });
  });
  return list;
}

function getCounterName(service) {
  let acc = service.getAccessory();
  let accName = acc.getName();
  let sName = service.getName();
  let full = (accName === sName) ? accName : (accName + " " + sName);
  return full + " (" + service.getUUID() + ")";
}

// --- Определение self-change (эталон PassthroughSwitch) ---------------------

let CONTEXT_CONSTANTS = { DELIMITER: " <- ", LOGIC_PREFIX: "LOGIC", CHARACTERISTIC_PREFIX: "C", MIN_ELEMENTS: 3 };

function isSelfChanged(context) {
  if (!context) return false;
  let ctx = context.toString();
  let elements = ctx.split(CONTEXT_CONSTANTS.DELIMITER);
  if (isSameLogicEcho(elements)) return true;
  if (hasMultipleLogicInChain(ctx, elements)) return true;
  return false;
}

function isSameLogicEcho(elements) {
  if (elements.length < CONTEXT_CONSTANTS.MIN_ELEMENTS) return false;
  let firstIsLogic = elements[0].indexOf(CONTEXT_CONSTANTS.LOGIC_PREFIX) === 0;
  let secondIsChar = elements[1].indexOf(CONTEXT_CONSTANTS.CHARACTERISTIC_PREFIX) === 0;
  return firstIsLogic && secondIsChar && elements[0] === elements[2];
}

function hasMultipleLogicInChain(contextStr, elements) {
  let lastLogic = null;
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i].indexOf(CONTEXT_CONSTANTS.LOGIC_PREFIX) === 0) { lastLogic = elements[i]; break; }
  }
  if (!lastLogic) return false;
  let prefix = lastLogic.split(" ")[0];
  let count = 0, pos = 0;
  while ((pos = contextStr.indexOf(prefix, pos)) !== -1) { count++; pos += prefix.length; }
  return count >= 2;
}

function logDebug(options, message) {
  if (options && options.debug) console.log("[PulseCounterButton] " + message);
}
