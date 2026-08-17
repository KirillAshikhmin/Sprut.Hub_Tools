// Кодовый замок.
// Логика применяется к целевому устройству (замок, сигнализация, выключатель, ворота).
// На старте подписывается на выбранные кнопки (ProgrammableSwitchEvent) и, когда
// последовательность нажатий совпала с кодом, разблокирует устройство.

// Название сценария с локализацией.
let scenarioName = {
  ru: "🔐 Кодовый замок",
  en: "🔐 Code lock"
};

// Описание сценария для опции-статуса «ОПИСАНИЕ» в UI.
let scenarioDescription = {
  ru: "Разблокирует устройство после ввода кода на кнопках.\n\n" +
    "Код — последовательность нажатий: цифра задаёт кнопку, буква тип нажатия " +
    "(S — одиночное, D — двойное, L — долгое). Пробелы необязательны. " +
    "Цифра без буквы — одиночное нажатие, буква без цифры — кнопка 1.\n\n" +
    "Примеры: 12357, SSDL, 1S 2S 1D 2S.",
  en: "Unlocks the device after a code is entered on buttons.\n\n" +
    "The code is a sequence of presses: a digit selects the button, a letter the press type " +
    "(S — single, D — double, L — long). Spaces are optional. " +
    "A digit without a letter means single press, a letter without a digit means button 1.\n\n" +
    "Examples: 12357, SSDL, 1S 2S 1D 2S."
};

// Список кнопок для опций (обновляется на старте хаба и при сохранении сценария).
let buttonServices = getButtonServices();

info = {
  name: scenarioName.ru,
  description: "Разблокирует замок, снимает охрану или включает выключатель после ввода кода нажатиями на кнопках.",
  version: "1.1",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.LockMechanism, HS.SecuritySystem, HS.Switch, HS.Lightbulb, HS.Outlet, HS.GarageDoorOpener],
  sourceCharacteristics: [HC.LockTargetState, HC.SecuritySystemTargetState, HC.On, HC.TargetDoorState],

  options: {
    desc: {
      name: { ru: "  ОПИСАНИЕ", en: "  DESCRIPTION" },
      desc: scenarioDescription,
      type: "String",
      value: "",
      formType: "status"
    },
    code: {
      type: "String", value: "", maxLength: 128,
      name: { ru: "Код", en: "Code" },
      desc: {
        ru: "Например: 12357 — одиночные нажатия кнопок 1, 2, 3, 5, 7; 1S 2D 3L — одиночное, двойное, долгое.",
        en: "For example: 12357 — single presses of buttons 1, 2, 3, 5, 7; 1S 2D 3L — single, double, long."
      }
    },
    allowExtraPresses: {
      type: "Boolean", value: false,
      name: { ru: "Разрешить произвольные нажатия до и после кода", en: "Allow arbitrary presses before and after the code" },
      desc: {
        ru: "Включено — лишние нажатия до и после кода не мешают. Выключено: без «Кнопки ввода» код должен " +
          "начинать последовательность, а ошибка блокирует ввод до паузы «Задержка на ввод»; " +
          "с «Кнопкой ввода» набранное должно точно совпасть с кодом.",
        en: "On — extra presses before and after the code do not matter. Off: without the enter button the code " +
          "must start the sequence and a mistake blocks input until the entry delay passes; " +
          "with the enter button the collected presses must match the code exactly."
      }
    },
    button1: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 1", en: "Button 1" }
    },
    button2: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 2", en: "Button 2" }
    },
    button3: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 3", en: "Button 3" }
    },
    button4: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 4", en: "Button 4" }
    },
    button5: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 5", en: "Button 5" }
    },
    button6: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 6", en: "Button 6" }
    },
    button7: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 7", en: "Button 7" }
    },
    button8: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 8", en: "Button 8" }
    },
    button9: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 9", en: "Button 9" }
    },
    button0: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка 0", en: "Button 0" }
    },
    enterButton: {
      type: "String", value: "", formType: "list", values: buttonServices,
      name: { ru: "Кнопка ввода", en: "Enter button" },
      desc: {
        ru: "Необязательно. Если выбрана — код проверяется по одиночному нажатию этой кнопки.",
        en: "Optional. If selected, the code is checked on a single press of this button."
      }
    },
    pressTimeout: {
      type: "Integer", value: 10, minValue: 0, maxValue: 300, step: 1,
      name: { ru: "Задержка на ввод, с", en: "Entry delay, s" },
      desc: {
        ru: "Максимальная пауза между нажатиями. Больше паузы — набранное сбрасывается. 0 — без ограничения.",
        en: "Maximum pause between presses. A longer pause resets the input. 0 — no limit."
      }
    },
    restoreDelay: {
      type: "Integer", value: 0, minValue: 0, maxValue: 3600, step: 1,
      name: { ru: "Вернуть прежнее состояние через, с", en: "Restore previous state after, s" },
      desc: {
        ru: "0 — не возвращать. Иначе устройство вернётся в состояние, которое было до ввода кода.",
        en: "0 — do not restore. Otherwise the device returns to the state it had before the code was entered."
      }
    },
    debug: {
      type: "Boolean", value: false,
      name: { ru: "Отладочный лог", en: "Debug log" }
    }
  },

  variables: {
    subscribed: false,
    opts: null,
    code: null,
    buffer: [],
    lastPressAt: 0,
    blocked: false,
    restoreTask: undefined,
    restoreValue: undefined
  }
};

// Типы нажатий в коде. Кириллические С/Д/Л приняты как синонимы: код часто набирают,
// не переключая раскладку.
let PRESS_TYPES = { S: 0, D: 1, L: 2, "С": 0, "Д": 1, "Л": 2 };
let CODE_DIGITS = "1234567890";
let CODE_SEPARATORS = " \t,.-+_";
let DEFAULT_BUTTON = "1";
let MAX_CODE_STEPS = 32;
let MAX_BUFFER = 64;

function trigger(source, value, variables, options, context) {
  if (isSelfChanged(context)) return;

  cancelRestore(variables);                 // ручное вмешательство отменяет автовозврат
  variables.opts = options;
  variables.code = buildCode(options);
  setupSubscription(resolveAnchor(source), variables);
}

// Характеристика, в которую сценарий пишет при верном коде. Определяется типом сервиса, а не тем,
// с какой характеристики пришёл первый trigger: у ворот, например, кроме TargetDoorState бывает
// и LockTargetState, и хаб вызывает trigger отдельно для каждой из них.
function resolveAnchor(source) {
  let service = source.getService();
  let type = anchorCharacteristicType(service.getType());
  if (!type) return source;
  let characteristic = service.getCharacteristic(type);
  return characteristic ? characteristic : source;
}

function anchorCharacteristicType(serviceType) {
  if (serviceType === HS.LockMechanism) return HC.LockTargetState;
  if (serviceType === HS.SecuritySystem) return HC.SecuritySystemTargetState;
  if (serviceType === HS.GarageDoorOpener) return HC.TargetDoorState;
  if (serviceType === HS.Switch || serviceType === HS.Lightbulb || serviceType === HS.Outlet) return HC.On;
  return null;
}

// Оформляет подписку на кнопки один раз. Подписка нужна и при невалидной конфигурации:
// исправленные опции подхватываются сохранением сценария, без перезагрузки хаба.
function setupSubscription(anchor, variables) {
  if (variables.subscribed) return;

  Hub.subscribeWithCondition("", "", [HS.StatelessProgrammableSwitch, HS.Doorbell], [HC.ProgrammableSwitchEvent],
    function (charSource, value) {
      handleButtonEvent(charSource, value, variables, anchor);
    });
  variables.subscribed = true;
}

// --- Разбор и проверка кода ------------------------------------------------

// Возвращает массив шагов [{btn, type}] или null, если конфигурация непригодна.
function buildCode(options) {
  let steps = parseCode(options.code);
  if (!steps) return configError("код пуст или записан неверно: \"" + options.code + "\"");
  if (steps.length > MAX_CODE_STEPS) return configError("в коде больше " + MAX_CODE_STEPS + " нажатий");

  let missing = findMissingButton(steps, options);
  if (missing) return configError("код использует кнопку " + missing + ", но поле «Кнопка " + missing + "» не заполнено");

  let duplicate = findDuplicateButton(options);
  if (duplicate) return configError("одна и та же кнопка выбрана в нескольких полях: " + duplicate);

  if (!options.enterButton && !options.allowExtraPresses && !options.pressTimeout) {
    return configError("при строгом вводе без кнопки ввода нужна задержка на ввод больше нуля, иначе ошибку нельзя будет сбросить");
  }
  return steps;
}

// Посимвольный разбор: цифра открывает новый шаг, буква задаёт тип нажатия.
function parseCode(raw) {
  if (typeof raw !== "string") return null;

  let text = raw.toUpperCase();
  let steps = [];
  let typed = false;                        // тип последнего шага задан явно

  for (let i = 0; i < text.length; i++) {
    let symbol = text.charAt(i);
    if (CODE_SEPARATORS.indexOf(symbol) >= 0) continue;

    if (CODE_DIGITS.indexOf(symbol) >= 0) {
      steps.push({ btn: symbol, type: PRESS_TYPES.S });
      typed = false;
      continue;
    }

    let type = PRESS_TYPES[symbol];
    if (type === undefined) return null;

    if (steps.length === 0) steps.push({ btn: DEFAULT_BUTTON, type: type });
    else if (typed) steps.push({ btn: steps[steps.length - 1].btn, type: type });
    else steps[steps.length - 1].type = type;
    typed = true;
  }
  return steps.length ? steps : null;
}

// Первая кнопка из кода, для которой не заполнено поле опций.
function findMissingButton(steps, options) {
  for (let i = 0; i < steps.length; i++) {
    if (!options["button" + steps[i].btn]) return steps[i].btn;
  }
  return null;
}

// UUID кнопки, выбранной более чем в одном поле (включая кнопку ввода).
function findDuplicateButton(options) {
  let picked = [];
  let fields = [];
  for (let i = 0; i < CODE_DIGITS.length; i++) fields.push(options["button" + CODE_DIGITS.charAt(i)]);
  fields.push(options.enterButton);

  for (let j = 0; j < fields.length; j++) {
    if (!fields[j]) continue;
    if (picked.indexOf(fields[j]) >= 0) return fields[j];
    picked.push(fields[j]);
  }
  return null;
}

// --- Обработка нажатий -----------------------------------------------------

function handleButtonEvent(charSource, value, variables, anchor) {
  let options = variables.opts;
  let code = variables.code;
  if (!options || !code) return;

  let uuid = charSource.getService().getUUID();
  let isEnter = !!options.enterButton && uuid === options.enterButton;
  if (isEnter && Number(value) !== PRESS_TYPES.S) return;   // на кнопке ввода учитываем только одиночное

  let digit = isEnter ? null : findButtonDigit(uuid, options);
  if (!isEnter && digit === null) return;                   // кнопка не из настроек сценария

  applyPressTimeout(variables, options);

  if (isEnter) {
    checkOnEnter(variables, code, anchor);
    return;
  }

  let step = { btn: digit, type: Number(value) };
  logDebug(options, "нажатие " + step.btn + " типа " + step.type);

  if (options.enterButton) collectUntilEnter(variables, step);
  else if (options.allowExtraPresses) checkWindow(variables, code, step, anchor);
  else checkStrict(variables, code, step, anchor);
}

// Пауза больше «Задержки на ввод» сбрасывает набранное и снимает блокировку.
function applyPressTimeout(variables, options) {
  let now = Date.now();
  let gap = variables.lastPressAt ? now - variables.lastPressAt : Infinity;
  variables.lastPressAt = now;              // обновляется и на заблокированных нажатиях

  if (!options.pressTimeout) return;
  if (gap <= options.pressTimeout * 1000) return;

  variables.buffer = [];
  variables.blocked = false;
  logDebug(options, "пауза больше " + options.pressTimeout + " с — ввод сброшен");
}

// Кнопка ввода не выбрана, произвольные нажатия разрешены: сверяем последние N нажатий.
function checkWindow(variables, code, step, anchor) {
  pushToBuffer(variables, step, code.length);
  if (variables.buffer.length < code.length) return;
  if (!sequenceEquals(variables.buffer, code)) return;
  succeed(variables, anchor);
}

// Кнопка ввода не выбрана, строгий ввод: сверяем каждое нажатие по позиции.
function checkStrict(variables, code, step, anchor) {
  if (variables.blocked) return;

  if (!stepEquals(step, code[variables.buffer.length])) {
    variables.blocked = true;
    variables.buffer = [];
    logDebug(variables.opts, "нажатие не совпало с кодом — ввод заблокирован до паузы");
    return;
  }

  variables.buffer.push(step);
  if (variables.buffer.length < code.length) return;
  succeed(variables, anchor);
}

// Кнопка ввода выбрана: копим нажатия до подтверждения.
function collectUntilEnter(variables, step) {
  pushToBuffer(variables, step, MAX_BUFFER);
}

function checkOnEnter(variables, code, anchor) {
  let collected = variables.buffer.length;
  let matched = variables.opts.allowExtraPresses
    ? containsSequence(variables.buffer, code)
    : sequenceEquals(variables.buffer, code);

  variables.buffer = [];
  if (matched) {
    succeed(variables, anchor);
    return;
  }
  if (!collected) {                         // «Ввод» на пустом буфере — не попытка ввода
    logDebug(variables.opts, "нажата кнопка ввода без набранного кода");
    return;
  }
  console.info("Кодовый замок: введён неверный код");
}

// --- Успешный ввод ---------------------------------------------------------

function succeed(variables, anchor) {
  variables.buffer = [];
  variables.blocked = false;

  let target = unlockValue(anchor.getType());
  if (target === undefined) {
    console.error("Кодовый замок: характеристика " + anchor.getType() + " не поддерживается сценарием");
    return;
  }

  if (!variables.restoreTask) variables.restoreValue = anchor.getValue();
  anchor.setValue(target);
  console.info("Кодовый замок: введён верный код, устройство разблокировано");
  scheduleRestore(variables, anchor);
}

// Значение «разблокировать» для характеристики-якоря.
function unlockValue(characteristicType) {
  if (characteristicType === HC.On) return true;
  if (characteristicType === HC.LockTargetState) return 0;                 // Открыто
  if (characteristicType === HC.SecuritySystemTargetState) return 3;       // Выкл.
  if (characteristicType === HC.TargetDoorState) return 0;                 // Открыто
  return undefined;
}

function scheduleRestore(variables, anchor) {
  let delay = variables.opts.restoreDelay;
  if (!delay) return;

  if (variables.restoreTask) clearTimeout(variables.restoreTask);
  logDebug(variables.opts, "автовозврат в состояние " + variables.restoreValue + " запланирован через " + delay + " с");
  variables.restoreTask = setTimeout(function () {
    variables.restoreTask = undefined;
    anchor.setValue(variables.restoreValue);
    logDebug(variables.opts, "автовозврат выполнен: " + variables.restoreValue);
  }, delay * 1000);
}

function cancelRestore(variables) {
  if (!variables.restoreTask) return;
  clearTimeout(variables.restoreTask);
  variables.restoreTask = undefined;
}

// --- Работа с последовательностями -----------------------------------------

function findButtonDigit(uuid, options) {
  for (let i = 0; i < CODE_DIGITS.length; i++) {
    let digit = CODE_DIGITS.charAt(i);
    if (options["button" + digit] && options["button" + digit] === uuid) return digit;
  }
  return null;
}

function pushToBuffer(variables, step, limit) {
  variables.buffer.push(step);
  while (variables.buffer.length > limit) variables.buffer.shift();
}

function stepEquals(step, other) {
  if (!step || !other) return false;
  return step.btn === other.btn && step.type === other.type;
}

function sequenceEquals(steps, code) {
  if (steps.length !== code.length) return false;
  for (let i = 0; i < code.length; i++) {
    if (!stepEquals(steps[i], code[i])) return false;
  }
  return true;
}

// Код как непрерывная подпоследовательность буфера.
function containsSequence(steps, code) {
  for (let start = 0; start + code.length <= steps.length; start++) {
    let matched = true;
    for (let i = 0; i < code.length; i++) {
      if (stepEquals(steps[start + i], code[i])) continue;
      matched = false;
      break;
    }
    if (matched) return true;
  }
  return false;
}

// --- Список кнопок для опций -----------------------------------------------

function getButtonServices() {
  let list = [{ name: { ru: "Не выбрано", en: "Not selected" }, value: "" }];
  let found = [];

  Hub.getAccessories().forEach(function (accessory) {
    accessory.getServices().forEach(function (service) {
      if (service.getType() !== HS.StatelessProgrammableSwitch && service.getType() !== HS.Doorbell) return;
      if (!service.getCharacteristic(HC.ProgrammableSwitchEvent)) return;
      let name = getServiceName(service);
      found.push({ name: { ru: name, en: name }, value: service.getUUID() });
    });
  });

  found.sort(function (a, b) { return a.name.ru.localeCompare(b.name.ru); });
  found.forEach(function (item) { list.push(item); });
  return list;
}

function getServiceName(service) {
  let accessoryName = service.getAccessory().getName();
  let serviceName = service.getName();
  let full = (accessoryName === serviceName) ? accessoryName : (accessoryName + " " + serviceName);
  return full + " (" + service.getUUID() + ")";
}

// --- Определение self-change (эталон PassthroughSwitch) ---------------------

let CONTEXT_CONSTANTS = { DELIMITER: " <- ", LOGIC_PREFIX: "LOGIC", CHARACTERISTIC_PREFIX: "C", MIN_ELEMENTS: 3 };

// Примечание: любая цепочка, которую ловит isSameLogicEcho, содержит префикс LOGIC-сегмента
// дважды, поэтому её ловит и hasMultipleLogicInChain. Первая проверка оставлена для единообразия
// с каноном репозитория (PassthroughSwitch, PulseCounterButton), а не как самостоятельное условие.
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

// --- Логирование -----------------------------------------------------------

function configError(message) {
  console.error("Кодовый замок: " + message + ". Сценарий не реагирует на нажатия.");
  return null;
}

function logDebug(options, message) {
  if (options && options.debug) console.log("[CodeLock] " + message);
}
