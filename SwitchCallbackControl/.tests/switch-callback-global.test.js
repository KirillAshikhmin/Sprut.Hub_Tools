// Юнит-тесты глобального SwitchCallbackControl.Global.js — канонический контракт.
// README §"Контракт" и §"API (глобальный)".

describe('Инициализация реестра и экспорт', () => {
  it('GlobalVariables.SwitchCallbackControl_Callbacks с пустым handlers', ({ variables }) => {
    expect(variables.global.SwitchCallbackControl_Callbacks).toBeDefined();
    expect(variables.global.SwitchCallbackControl_Callbacks.handlers).toBeDefined();
  });

  it('экспортирует fire/broadcast/unregister в global', ({ variables }) => {
    expect(typeof variables.global.switchCallbackControlFire).toBe('function');
    expect(typeof variables.global.switchCallbackControlBroadcast).toBe('function');
    expect(typeof variables.global.switchCallbackControlUnregister).toBe('function');
  });
});

// action/data передаются в handler; fire → boolean. Ключи не в форме "aid.sid"
// (prune их не трогает — p.length < 2), поэтому регистрируем на 'a'/'b'.
describe('switchCallbackControlFire(key, action, data)', () => {
  it('вызывает handler по ключу с (action, data) и возвращает true', ({ scenario, variables }) => {
    const calls = [];
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = (action, data) => calls.push([action, data]);

    const result = scenario.call('switchCallbackControlFire', ['a', 'set', { on: true }]);

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('set');
    expect(calls[0][1].on).toBe(true);
  });

  it('несовпадающий ключ — handler не вызван, false', ({ scenario, variables }) => {
    const calls = [];
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = () => calls.push('a');

    const result = scenario.call('switchCallbackControlFire', ['b', 'on', {}]);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('ошибка в handler логируется и возвращает false', ({ scenario, variables, logs }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = () => { throw new Error('boom'); };

    const result = scenario.call('switchCallbackControlFire', ['a', 'on', {}]);

    expect(result).toBe(false);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });

  it('prune: ключ "aid.sid" несуществующего сервиса удаляется, false', ({ scenario, variables }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers['99999.1'] = () => {};

    const result = scenario.call('switchCallbackControlFire', ['99999.1', 'on', {}]);

    expect(result).toBe(false);
    expect(variables.global.SwitchCallbackControl_Callbacks.handlers['99999.1']).toBeUndefined();
  });
});

describe('switchCallbackControlBroadcast(action, data)', () => {
  it('вызывает все handler и возвращает их число', ({ scenario, variables }) => {
    const calls = [];
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = (act) => calls.push(act);
    variables.global.SwitchCallbackControl_Callbacks.handlers['b'] = (act) => calls.push(act);

    const n = scenario.call('switchCallbackControlBroadcast', ['toggle', {}]);

    expect(n).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('пустой реестр → 0, ничего не падает', ({ scenario, variables }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers = {};
    const n = scenario.call('switchCallbackControlBroadcast', ['on', {}]);
    expect(n).toBe(0);
  });
});

describe('switchCallbackControlUnregister(key)', () => {
  it('снимает handler — последующий fire возвращает false', ({ scenario, variables }) => {
    variables.global.SwitchCallbackControl_Callbacks.handlers['a'] = () => {};

    scenario.call('switchCallbackControlUnregister', ['a']);

    expect(variables.global.SwitchCallbackControl_Callbacks.handlers['a']).toBeUndefined();
    expect(scenario.call('switchCallbackControlFire', ['a', 'on', {}])).toBe(false);
  });
});
