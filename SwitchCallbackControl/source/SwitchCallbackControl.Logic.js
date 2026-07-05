/**
 * Эталонный пример: логический сценарий регистрирует handler(action, data).
 * action: "on" | "off" | "toggle" | "set" (data.on). Ключ — UUID сервиса.
 */

var SW_CB_GV = "SwitchCallbackControl_Callbacks";
var DEBUG = true;

info = {
  name: "🔘 Тест коллбеков",
  description: "Эталонный пример канонического контракта коллбеков. handler(action, data), ключ — UUID сервиса.",
  version: "1.0",
  author: "@BOOMikru",
  onStart: true,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On],
  options: {},
  variables: {}
};

function trigger(source, value, variables, options, context) {
  var service = source.getService();
  var sid = service.getUUID();

  // Самоинициализация реестра — не зависим от порядка загрузки глобального.
  var gv = GlobalVariables[SW_CB_GV];
  if (!gv || !gv.handlers) { gv = GlobalVariables[SW_CB_GV] = { handlers: {} }; }

  gv.handlers[sid] = function (action, data) {
    var on = service.getCharacteristic(HC.On);
    var target;
    if (action === "on") target = true;
    else if (action === "off") target = false;
    else if (action === "toggle") target = !on.getValue();
    else if (action === "set") target = !!(data && data.on);
    else return;
    if (on.getValue() !== target) on.setValue(target);
    if (DEBUG) console.info("[SwitchCallbackControl] " + service.getName() + " ← " + action + " ⇒ " + target);
  };
}
