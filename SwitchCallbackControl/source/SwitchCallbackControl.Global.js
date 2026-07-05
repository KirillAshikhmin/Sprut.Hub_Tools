/**
 * Эталонный пример канонического контракта коллбеков (см. ScenarioTemplate/README.md).
 * Реестр: GlobalVariables["SwitchCallbackControl_Callbacks"] = { handlers: {} }.
 * Здесь — сторона fire/broadcast/unregister. Регистрация — в логическом.
 */

var SW_CB_GV = "SwitchCallbackControl_Callbacks";

function switchCallbackControlInit() {
  if (!GlobalVariables[SW_CB_GV]) GlobalVariables[SW_CB_GV] = { handlers: {} };
  return GlobalVariables[SW_CB_GV];
}
switchCallbackControlInit();

// Ключ вида "aid.sid" больше не резолвится в живой сервис → мёртвый.
function switchCallbackControlIsDeadKey(key) {
  var p = String(key).split(".");
  if (p.length < 2) return false;
  var a = Hub.getAccessory(parseInt(p[0], 10));
  return !a || !a.getService(parseInt(p[1], 10));
}

// Вызвать один handler по ключу. Вернуть true, если вызвали.
function switchCallbackControlFire(key, action, data) {
  var gv = switchCallbackControlInit();
  var k = String(key);
  if (switchCallbackControlIsDeadKey(k)) { delete gv.handlers[k]; return false; }
  var h = gv.handlers[k];
  if (typeof h !== "function") return false;
  try {
    h(action, data || {});
    return true;
  } catch (err) {
    console.error("[SwitchCallbackControl] " + k + ": " + err.message);
    return false;
  }
}

// Вызвать все handler. Вернуть число вызванных.
function switchCallbackControlBroadcast(action, data) {
  var gv = switchCallbackControlInit();
  var n = 0;
  for (var k in gv.handlers) {
    if (gv.handlers.hasOwnProperty(k) && switchCallbackControlFire(k, action, data)) n++;
  }
  return n;
}

// Снять обработчик.
function switchCallbackControlUnregister(key) {
  var gv = switchCallbackControlInit();
  delete gv.handlers[String(key)];
}

if (typeof global !== "undefined") {
  global.switchCallbackControlFire = switchCallbackControlFire;
  global.switchCallbackControlBroadcast = switchCallbackControlBroadcast;
  global.switchCallbackControlUnregister = switchCallbackControlUnregister;
}
