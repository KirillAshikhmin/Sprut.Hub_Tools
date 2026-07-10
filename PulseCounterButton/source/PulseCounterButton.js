// Кнопка из счётчиков нажатий.
// Логика применяется к кнопке (StatelessProgrammableSwitch). На старте подписывается
// на счётчики импульсов (C_PulseMeter/C_PulseCount) и по инкременту выбранного счётчика
// пишет код события в ProgrammableSwitchEvent: 0=одиночное, 1=двойное, 2=долгое.

// Список счётчиков для опций (обновляется на старте хаба и при сохранении сценария).
let pulseCounters = getPulseCounters();

info = {
  name: "Кнопка из счётчиков нажатий",
  description: "Превращает счётчики импульсов (короткие/двойные/долгие нажатия) в событие HomeKit-кнопки ProgrammableSwitchEvent того же устройства.",
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.StatelessProgrammableSwitch],
  sourceCharacteristics: [HC.ProgrammableSwitchEvent],

  options: {
    singleCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик одиночных нажатий", en: "Single press counter" },
      desc: { ru: "Счётчик импульсов, соответствующий одиночному нажатию", en: "Pulse counter for single press" }
    },
    doubleCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик двойных нажатий", en: "Double press counter" },
      desc: { ru: "Счётчик импульсов, соответствующий двойному нажатию", en: "Pulse counter for double press" }
    },
    longCounter: {
      type: "String", value: "", formType: "list", values: pulseCounters,
      name: { ru: "Счётчик долгих нажатий", en: "Long press counter" },
      desc: { ru: "Счётчик импульсов, соответствующий долгому нажатию", en: "Pulse counter for long press" }
    },
    debug: {
      type: "Boolean", value: false,
      name: { ru: "Отладочный лог", en: "Debug log" },
      desc: { ru: "Подробный вывод в консоль сценария", en: "Verbose console output" }
    }
  },

  variables: {
    subscribed: false,
    subscription: undefined,
    prev: {}
  }
};

function trigger(source, value, variables, options, context) {
  setupSubscription(source, variables, options);
}

// Оформляет подписку на счётчики один раз. eventChar — сам источник (ProgrammableSwitchEvent кнопки).
function setupSubscription(anchorSource, variables, options) {
  if (variables.subscribed) return;
  let eventChar = anchorSource;
  if (!variables.prev) variables.prev = {};

  initPrev(variables, options);

  variables.subscription = Hub.subscribeWithCondition("", "", [HS.C_PulseMeter], [HC.C_PulseCount],
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
  if (prev === undefined) { variables.prev[key] = v; return; }   // счётчик впервые виден — не нажатие
  if (v > prev) {                                                 // положительный инкремент = нажатие
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

function logDebug(options, message) {
  if (options && options.debug) console.log("[PulseCounterButton] " + message);
}
