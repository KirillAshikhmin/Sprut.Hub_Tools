// Интеграционные тесты логического SwitchCallbackControl.Logic.js.
// README: handler(action, data), action ∈ {"on","off","toggle","set"}, ключ — UUID сервиса.
// trigger регистрирует handler в GlobalVariables.SwitchCallbackControl_Callbacks.handlers[uuid].

function makeSwitch(hub, id, initialOn) {
  return hub.addAccessory({
    id, name: 'Тестовый выключатель ' + id, room: 'Тест',
    services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: initialOn === true }] }],
  });
}

describe('info-блок', () => {
  it('sourceServices содержит Switch', ({ scenario }) => {
    expect(scenario.info().sourceServices).toContain(HS.Switch);
  });
  it('sourceCharacteristics содержит On', ({ scenario }) => {
    expect(scenario.info().sourceCharacteristics).toContain(HC.On);
  });
  it('onStart=true', ({ scenario }) => {
    expect(scenario.info().onStart).toBe(true);
  });
});

describe('trigger: самоинициализирующая регистрация handler', () => {
  it('после trigger в handlers появляется функция по UUID сервиса', ({ hub, scenario, variables }) => {
    const sw = makeSwitch(hub, 100, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();

    scenario.run({ source: onChar, value: false, variables: {}, options: {}, context: '' });

    expect(typeof variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]).toBe('function');
  });

  it('регистрирует даже если реестр ещё не создан (рестарт)', ({ hub, scenario, variables }) => {
    delete variables.global.SwitchCallbackControl_Callbacks;
    const sw = makeSwitch(hub, 100, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();

    scenario.run({ source: onChar, value: false, variables: {}, options: {}, context: '' });

    expect(variables.global.SwitchCallbackControl_Callbacks).toBeDefined();
    expect(typeof variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]).toBe('function');
  });
});

describe('handler(action, data): управляет Switch.On', () => {
  function register(hub, scenario, id, on) {
    const sw = makeSwitch(hub, id, on);
    const onChar = sw.char(HS.Switch, HC.On);
    scenario.run({ source: onChar, value: on, variables: {}, options: {}, context: '' });
    return { sw, onChar, uuid: sw.getService(HS.Switch).getUUID() };
  }

  it('action "on" → On=true', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, false);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('on', {});
    expect(onChar.getValue()).toBe(true);
  });

  it('action "off" → On=false', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, true);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('off', {});
    expect(onChar.getValue()).toBe(false);
  });

  it('action "toggle" инвертирует', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, false);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('toggle', {});
    expect(onChar.getValue()).toBe(true);
  });

  it('action "set" c data.on=false → On=false', ({ hub, scenario, variables }) => {
    const { onChar, uuid } = register(hub, scenario, 100, true);
    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('set', { on: false });
    expect(onChar.getValue()).toBe(false);
  });

  it('если значение уже целевое — setValue не вызывается (нет лишних событий)', ({ hub, scenario, variables }) => {
    const sw = makeSwitch(hub, 100, true);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();
    scenario.run({ source: onChar, value: true, variables: {}, options: {}, context: '' });
    let setCount = 0;
    const origSet = onChar.setValue.bind(onChar);
    onChar.setValue = (v) => { setCount++; return origSet(v); };

    variables.global.SwitchCallbackControl_Callbacks.handlers[uuid]('on', {}); // уже true
    expect(setCount).toBe(0);
  });
});

describe('Сквозной: fire по UUID → Switch.On', () => {
  it('fire("uuid","on") включает выключатель', ({ hub, scenario, variables }) => {
    const sw = makeSwitch(hub, 100, false);
    const onChar = sw.char(HS.Switch, HC.On);
    const uuid = sw.getService(HS.Switch).getUUID();
    scenario.run({ source: onChar, value: false, variables: {}, options: {}, context: '' });

    const result = scenario.call('switchCallbackControlFire', [uuid, 'on', {}]);

    expect(result).toBe(true);
    expect(onChar.getValue()).toBe(true);
  });

  it('broadcast("toggle") переключает все зарегистрированные', ({ hub, scenario }) => {
    const sw1 = makeSwitch(hub, 100, false);
    const sw2 = makeSwitch(hub, 200, false);
    scenario.run({ source: sw1.char(HS.Switch, HC.On), value: false, variables: {}, options: {}, context: '' });
    scenario.run({ source: sw2.char(HS.Switch, HC.On), value: false, variables: {}, options: {}, context: '' });

    scenario.call('switchCallbackControlBroadcast', ['toggle', {}]);

    expect(sw1.char(HS.Switch, HC.On).getValue()).toBe(true);
    expect(sw2.char(HS.Switch, HC.On).getValue()).toBe(true);
  });
});
