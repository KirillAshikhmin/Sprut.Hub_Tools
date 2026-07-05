# 🔘 SwitchCallbackControl — эталонный пример коллбеков

Референс-реализация **канонического контракта коллбеков** (см.
`ScenarioTemplate/README.md` → «Коллбеки: управление логическим сценарием в рантайме»).
Логический сценарий на выключателе регистрирует обработчик; любой другой сценарий
(глобальный, логический, блочный) вызывает его по UUID сервиса.

## Контракт

- **Реестр:** `GlobalVariables["SwitchCallbackControl_Callbacks"] = { handlers: {} }`.
- **Обработчик:** `handler(action, data)`, ключ — UUID сервиса `"aid.sid"`.
- **Действия:** `"on"` | `"off"` | `"toggle"` | `"set"` (с `data.on`).

## API (глобальный)

```javascript
switchCallbackControlFire(serviceUUID, action, data)   // → boolean (вызван ли обработчик)
switchCallbackControlBroadcast(action, data)           // → number (сколько вызвано)
switchCallbackControlUnregister(serviceUUID)           // снять обработчик
```

## Пример

```javascript
// включить конкретный выключатель
global.switchCallbackControlFire("12.3", "on");
// переключить все зарегистрированные
global.switchCallbackControlBroadcast("toggle");
// задать явное состояние
global.switchCallbackControlFire("12.3", "set", { on: false });
```
