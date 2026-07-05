// Юнит-тесты глобальных функций сценария "Циркадное освещение".
// README §"Описание сценариев — Глобальный сценарий" и §"Динамические режимы".
//
// Глобальный сценарий состоит из трёх файлов (в порядке загрузки):
//   1. "Глобальный. Параметры.js" — режимы (onTime), miredToHueAndSaturation, getCircadianPreset, getMiredToHueAndSaturationMap, getCircadianLightDynamicParams
//   2. "Конвертер температуры в цвет.js" — логический, перезаписывает info/trigger (загружен как глобальный по требованию)
//   3. "Глобальный.js" — основная логика: getCircadianLight, getCircadianLightForTime, setCircadianLightForService(ForTime), getHueAndSaturationFromMired, режимы Sunrise/Sunset
//
// Поскольку Конвертер тоже определяет info/trigger, эти значения перезаписываются Логическим.js
// при загрузке последнего. Но top-level функции Конвертера здесь не интересны — здесь
// тестируется только глобальная часть.

// ---------------------------------------------------------------------------
// README §"Получить значение температуры и яркости для текущего часа и минуты:
//   let tempAndBright = global.getCircadianLight(preset);"
// Результат — массив [температура, яркость].
// ---------------------------------------------------------------------------

describe('getCircadianLight(preset) — текущее время', () => {
  it('возвращает массив [temp, bright]', ({ scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const result = scenario.call('getCircadianLight', [0, '1.1']);
    expect(Array.isArray(result)).toBeTruthy();
    expect(result).toHaveLength(2);
  });

  it('preset=0 в полдень: температура≈50, яркость≈100 (по таблице "Дольше яркий")', ({ scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    const result = scenario.call('getCircadianLight', [0, '1.1']);
    // Согласно onTime[0][12] = [50, 100]
    expect(result[0]).toBe(50);
    expect(result[1]).toBe(100);
  });

  it('temp в пределах [50, 400]', ({ scenario, time }) => {
    time.set('2024-06-21T03:00:00Z');
    const result = scenario.call('getCircadianLight', [0, '1.1']);
    expect(result[0]).toBeGreaterThanOrEqual(50);
    expect(result[0]).toBeLessThanOrEqual(400);
  });

  it('bright в пределах [1, 100]', ({ scenario, time }) => {
    time.set('2024-06-21T03:00:00Z');
    const result = scenario.call('getCircadianLight', [0, '1.1']);
    expect(result[1]).toBeGreaterThanOrEqual(1);
    expect(result[1]).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// getCircadianLightForTime(hours, minute, preset, uuid):
// интерполяция между часом и часом+1.
// ---------------------------------------------------------------------------

describe('getCircadianLightForTime — интерполяция значений', () => {
  it('hours=0, minute=0, preset=0 → [400, 60]', ({ scenario }) => {
    // onTime[0][0] = [400, 60]
    const result = scenario.call('getCircadianLightForTime', [0, 0, 0, '1.1']);
    expect(result[0]).toBe(400);
    expect(result[1]).toBe(60);
  });

  it('hours=0, minute=30, preset=0 → интерполяция между [400,60] и [400,60] = [400, 60]', ({ scenario }) => {
    const result = scenario.call('getCircadianLightForTime', [0, 30, 0, '1.1']);
    expect(result[0]).toBe(400);
    expect(result[1]).toBe(60);
  });

  it('hours=12, minute=0, preset=0 → [50, 100]', ({ scenario }) => {
    const result = scenario.call('getCircadianLightForTime', [12, 0, 0, '1.1']);
    expect(result[0]).toBe(50);
    expect(result[1]).toBe(100);
  });

  it('hours=6, minute=30, preset=0 → интерполяция между [400,70] (6ч) и [350,100] (7ч)', ({ scenario }) => {
    // На 30-й минуте 6 часа значение находится посередине между [400, 70] и [350, 100]
    // temp = 400 + (350-400)/60*30 = 375
    // bright = 70 + (100-70)/60*30 = 85
    const result = scenario.call('getCircadianLightForTime', [6, 30, 0, '1.1']);
    expect(result[0]).toBe(375);
    expect(result[1]).toBe(85);
  });

  it('hours=23, minute=30 — корректная интерполяция к 0 часу (нет резкого скачка)', ({ scenario }) => {
    // README §"Истории изменений 4.0": Исправлена проблема с некорректным расчётом
    // температуры в промежутке с 23 до 00 часов
    // onTime[0][23] = [400, 60], onTime[0][0] = [400, 60]
    const result = scenario.call('getCircadianLightForTime', [23, 30, 0, '1.1']);
    expect(result[0]).toBe(400);
    expect(result[1]).toBe(60);
  });

  it('несуществующий preset → fallback на onTime[0]', ({ scenario }) => {
    // getCircadianPreset возвращает onTime[0], если ключ не найден
    const result = scenario.call('getCircadianLightForTime', [12, 0, 99999, '1.1']);
    expect(result[0]).toBe(50);  // onTime[0][12] = [50,100]
    expect(result[1]).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// README §"Динамические режимы": getCircadianLightDynamicParams(hours, minute, preset, temp, bright, serviceUUID)
// По умолчанию возвращает [temp, bright]. Может быть переопределена для preset=10000.
// ---------------------------------------------------------------------------

describe('getCircadianLightDynamicParams — динамические режимы', () => {
  it('обычный preset: возвращает temp/bright без изменений', ({ scenario }) => {
    const result = scenario.call('getCircadianLightDynamicParams', [10, 0, 0, 200, 80, '1.1']);
    expect(result[0]).toBe(200);
    expect(result[1]).toBe(80);
  });

  it('preset=10000 (демо динамического): temp = 50 + hours*15', ({ scenario }) => {
    const result = scenario.call('getCircadianLightDynamicParams', [10, 0, 10000, 200, 80, '1.1']);
    expect(result[0]).toBe(200);  // 50 + 10*15 = 200
  });

  it('preset=10000: bright = floor(minute * 1.69)', ({ scenario }) => {
    const result = scenario.call('getCircadianLightDynamicParams', [10, 30, 10000, 200, 80, '1.1']);
    // minute=30 → bright = (30*1.69)|0 = 50
    expect(result[1]).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// README §"global.getHueAndSaturationFromMired(temp)":
// "возвращает массив [оттенок, насыщенность] для указанной температуры в майредах (50-400)"
// ---------------------------------------------------------------------------

describe('getHueAndSaturationFromMired — конвертация mired→hue/sat', () => {
  it('точное значение из таблицы: mired=50 → [210, 30]', ({ scenario }) => {
    const result = scenario.call('getHueAndSaturationFromMired', [50]);
    expect(result[0]).toBe(210);
    expect(result[1]).toBe(30);
  });

  it('точное значение: mired=400 → [30, 80]', ({ scenario }) => {
    const result = scenario.call('getHueAndSaturationFromMired', [400]);
    expect(result[0]).toBe(30);
    expect(result[1]).toBe(80);
  });

  it('mired=300 (точное значение) → [32, 44]', ({ scenario }) => {
    const result = scenario.call('getHueAndSaturationFromMired', [300]);
    expect(result[0]).toBe(32);
    expect(result[1]).toBe(44);
  });

  it('промежуточное значение mired=55: интерполяция между 50 и 60', ({ scenario }) => {
    // 50→[210, 30], 60→[205, 28]
    // t = 0.5 → hue = 207.5, sat = 29
    const result = scenario.call('getHueAndSaturationFromMired', [55]);
    expect(result[0]).toBeGreaterThanOrEqual(205);
    expect(result[0]).toBeLessThanOrEqual(210);
    expect(result[1]).toBeGreaterThanOrEqual(28);
    expect(result[1]).toBeLessThanOrEqual(30);
  });

  it('mired < 50 — бросает Error', ({ scenario }) => {
    expect(() => scenario.call('getHueAndSaturationFromMired', [49])).toThrow();
  });

  it('mired > 400 — бросает Error', ({ scenario }) => {
    expect(() => scenario.call('getHueAndSaturationFromMired', [401])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getCircadianPreset(preset) — получение режима из onTime
// ---------------------------------------------------------------------------

describe('getCircadianPreset — выбор режима', () => {
  it('preset=0 → onTime[0] (Дольше яркий)', ({ scenario }) => {
    const preset = scenario.call('getCircadianPreset', [0]);
    expect(preset.name).toBe('Дольше яркий');
  });

  it('preset=1 → onTime[1] (Раннее затемнение)', ({ scenario }) => {
    const preset = scenario.call('getCircadianPreset', [1]);
    expect(preset.name).toBe('Раннее затемнение');
  });

  it('preset=2 → onTime[2] (Всегда полная яркость)', ({ scenario }) => {
    const preset = scenario.call('getCircadianPreset', [2]);
    expect(preset.name).toBe('Всегда полная яркость');
  });

  it('несуществующий preset → fallback на onTime[0]', ({ scenario }) => {
    const preset = scenario.call('getCircadianPreset', [99999]);
    expect(preset.name).toBe('Дольше яркий');
  });

  it('NaN или undefined → fallback на onTime[0]', ({ scenario }) => {
    const preset = scenario.call('getCircadianPreset', ['abc']);
    expect(preset.name).toBe('Дольше яркий');
  });
});

// ---------------------------------------------------------------------------
// README §"Установить для одной лампочки: global.setCircadianLight(99)"
// и §"setCircadianLightForService(service, ...)" — главная функция глобального.
// ---------------------------------------------------------------------------

function makeColorTempLamp(hub, id, on, bright, temp) {
  return hub.addAccessory({
    id, name: 'Лампа', room: 'Тест',
    services: [{
      type: HS.Lightbulb,
      characteristics: [
        { type: HC.On, value: on === true },
        { type: HC.Brightness, value: bright === undefined ? 100 : bright },
        { type: HC.ColorTemperature, value: temp === undefined ? 400 : temp },
      ],
    }],
  });
}

function makeHueSatLamp(hub, id, on) {
  return hub.addAccessory({
    id, name: 'Лампа RGB', room: 'Тест',
    services: [{
      type: HS.Lightbulb,
      characteristics: [
        { type: HC.On, value: on === true },
        { type: HC.Brightness, value: 100 },
        { type: HC.Hue, value: 0 },
        { type: HC.Saturation, value: 0 },
      ],
    }],
  });
}

describe('setCircadianLightForServiceForTime — изменение характеристик лампы', () => {
  it('лампа с ColorTemperature: яркость и температура устанавливаются', ({ hub, scenario }) => {
    // Тест на основе встроенного теста в Глобальный.js:
    // hours=0, minute=30 → temp=300, bright=60 для preset=99999 (→ onTime[0])
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('setCircadianLightForServiceForTime',
      [service, 99999, false, false, false, false, false, false, false, 0, 30, false]);

    expect(result).toBe(true);
    expect(service.getCharacteristic(HC.Brightness).getValue()).toBe(60);
    // С учётом интерполяции 0→1 ч: [400,60] → [400,60] вершина 0 и 1 одинаковые в onTime[0]
    // hours=0, minute=30 → temp = 400 + (400-400)/60*30 = 400
    expect(service.getCharacteristic(HC.ColorTemperature).getValue()).toBe(400);
  });

  it('лампа без ColorTemperature (только Hue/Saturation): устанавливаются hue и sat', ({ hub, scenario }) => {
    const lamp = makeHueSatLamp(hub, 1, true);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('setCircadianLightForServiceForTime',
      [service, 0, false, false, false, false, false, false, false, 12, 0, false]);

    expect(result).toBe(true);
    // hours=12, minute=0, preset=0 → temp=50, bright=100
    // mired=50 → [210, 30]
    expect(service.getCharacteristic(HC.Hue).getValue()).toBe(210);
    expect(service.getCharacteristic(HC.Saturation).getValue()).toBe(30);
    expect(service.getCharacteristic(HC.Brightness).getValue()).toBe(100);
  });

  it('лампа без яркости — warn + return false', ({ hub, scenario, logs }) => {
    const lamp = hub.addAccessory({
      id: 1, name: 'Лампа без яркости', room: 'Тест',
      services: [{
        type: HS.Lightbulb,
        characteristics: [{ type: HC.On, value: true }],
      }],
    });
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('setCircadianLightForServiceForTime',
      [service, 0, false, false, false, false, false, false, false, 12, 0, false]);

    expect(result).toBe(false);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });

  it('dontChangeBright=true — яркость не меняется', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 50, 400);
    const service = lamp.getService(HS.Lightbulb);

    scenario.call('setCircadianLightForServiceForTime',
      [service, 0, true, false, false, false, false, false, false, 12, 0, false]);

    // Яркость не должна измениться
    expect(service.getCharacteristic(HC.Brightness).getValue()).toBe(50);
    // Температура изменяется
    expect(service.getCharacteristic(HC.ColorTemperature).getValue()).toBe(50);
  });

  it('dontChangeTemp=true — температура не меняется', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 50, 400);
    const service = lamp.getService(HS.Lightbulb);

    scenario.call('setCircadianLightForServiceForTime',
      [service, 0, false, true, false, false, false, false, false, 12, 0, false]);

    // Температура не должна измениться (осталась 400)
    expect(service.getCharacteristic(HC.ColorTemperature).getValue()).toBe(400);
    // Яркость изменяется
    expect(service.getCharacteristic(HC.Brightness).getValue()).toBe(100);
  });

  it('notForceTurnOn=true и лампа выключена → return false без изменений', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 1, false, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('setCircadianLightForServiceForTime',
      [service, 0, false, false, false, false, false, false, false, 12, 0, true]);

    expect(result).toBe(false);
    // Значения не должны измениться
    expect(service.getCharacteristic(HC.Brightness).getValue()).toBe(100);
    expect(service.getCharacteristic(HC.ColorTemperature).getValue()).toBe(400);
  });

  it('сервис не Lightbulb → return false', ({ hub, scenario }) => {
    const sw = hub.addAccessory({
      id: 1, name: 'Выкл', room: 'Тест',
      services: [{ type: HS.Switch, characteristics: [{ type: HC.On, value: true }] }],
    });
    const service = sw.getService(HS.Switch);

    const result = scenario.call('setCircadianLightForServiceForTime',
      [service, 0, false, false, false, false, false, false, false, 12, 0, false]);

    expect(result).toBe(false);
  });

  it('запрещено всё → warn + return false', ({ hub, scenario, logs }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 50, 400);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('setCircadianLightForServiceForTime',
      [service, 0, true, true, true, true, false, false, false, 12, 0, false]);

    expect(result).toBe(false);
    expect(logs.byLevel('warn').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// setCircadianLight(aId, preset, ...) — высокоуровневая функция, README §"Установить для одной лампочки".
// Принимает id одного аксессуара или массив id.
// ---------------------------------------------------------------------------

describe('setCircadianLight(aId, preset, ...) — README пример', () => {
  it('один id: global.setCircadianLight(99)', ({ hub, scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');  // hours=12, preset=0 → [50,100]
    makeColorTempLamp(hub, 99, true, 100, 400);

    scenario.call('setCircadianLight', [99, 0, false, false, false, false]);

    expect(hub.acc(99).char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
    expect(hub.acc(99).char(HS.Lightbulb, HC.Brightness).getValue()).toBe(100);
  });

  it('массив id: global.setCircadianLight([97,98,99])', ({ hub, scenario, time }) => {
    time.set('2024-06-21T12:00:00Z');
    makeColorTempLamp(hub, 97, true, 100, 400);
    makeColorTempLamp(hub, 98, true, 100, 400);
    makeColorTempLamp(hub, 99, true, 100, 400);

    scenario.call('setCircadianLight', [[97, 98, 99], 0, false, false, false, false]);

    expect(hub.acc(97).char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
    expect(hub.acc(98).char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
    expect(hub.acc(99).char(HS.Lightbulb, HC.ColorTemperature).getValue()).toBe(50);
  });

  it('несуществующий id → error лог', ({ hub, scenario, logs }) => {
    scenario.call('setCircadianLight', [99999, 0, false, false, false, false]);
    expect(logs.byLevel('error').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// README §"Временное отключение циркадного режима" и §"Перезапуск циркадного режима"
// global.setCircadianLightDisabled(service, disabled), global.resetCircadianLight(service)
// Эти функции вызывают коллбек в GlobalVariables.CircadianLight_Callbacks.handlers[uuid].
// ---------------------------------------------------------------------------

describe('Callbacks API: setCircadianLightDisabled / resetCircadianLight', () => {
  it('GlobalVariables.CircadianLight_Callbacks инициализирован', ({ variables }) => {
    expect(variables.global.CircadianLight_Callbacks).toBeDefined();
    expect(variables.global.CircadianLight_Callbacks.handlers).toBeDefined();
  });

  it('setCircadianLightDisabled(service, true) → вызов handler с "disable"', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    const uuid = service.getUUID();
    const calls = [];
    variables.global.CircadianLight_Callbacks.handlers[uuid] = (action, data) => {
      calls.push([action, data]);
    };

    scenario.call('setCircadianLightDisabled', [service, true]);

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('disable');
  });

  it('setCircadianLightDisabled(service, false) → "enable"', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    const calls = [];
    variables.global.CircadianLight_Callbacks.handlers[service.getUUID()] = (action) => calls.push(action);

    scenario.call('setCircadianLightDisabled', [service, false]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('enable');
  });

  it('resetCircadianLight(service) → "reset"', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    const calls = [];
    variables.global.CircadianLight_Callbacks.handlers[service.getUUID()] = (action) => calls.push(action);

    scenario.call('resetCircadianLight', [service]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('reset');
  });

  it('enableCircadianLightFor(services) и disableCircadianLightFor(services) для массива', ({ hub, scenario, variables }) => {
    const l1 = makeColorTempLamp(hub, 1, true, 100, 400);
    const l2 = makeColorTempLamp(hub, 2, true, 100, 400);
    const s1 = l1.getService(HS.Lightbulb);
    const s2 = l2.getService(HS.Lightbulb);
    const actions = [];
    variables.global.CircadianLight_Callbacks.handlers[s1.getUUID()] = (a) => actions.push(['1', a]);
    variables.global.CircadianLight_Callbacks.handlers[s2.getUUID()] = (a) => actions.push(['2', a]);

    scenario.call('disableCircadianLightFor', [[s1, s2]]);
    expect(actions).toHaveLength(2);
    expect(actions[0][1]).toBe('disable');
    expect(actions[1][1]).toBe('disable');

    scenario.call('enableCircadianLightFor', [[s1, s2]]);
    expect(actions).toHaveLength(4);
    expect(actions[2][1]).toBe('enable');
  });

  it('Нет handler — нет выброса ошибки', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    // handler не зарегистрирован
    scenario.call('setCircadianLightDisabled', [service, true]);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// README §"История изменений 5.0": "Добавлены кастомные режимы — имя подгрузится после
// перезагрузки хаба\обновления логического сценария".
// getCircadianLightModes() возвращает список режимов для UI.
// ---------------------------------------------------------------------------

describe('getCircadianLightModes — список режимов для UI', () => {
  it('возвращает массив', ({ scenario }) => {
    const list = scenario.call('getCircadianLightModes', []);
    expect(Array.isArray(list)).toBeTruthy();
  });

  it('содержит как минимум базовые 3 пресета (0,1,2)', ({ scenario }) => {
    const list = scenario.call('getCircadianLightModes', []);
    const values = list.map((x) => x.value);
    expect(values).toContain(0);
    expect(values).toContain(1);
    expect(values).toContain(2);
  });

  it('каждый элемент имеет name (с ru/en) и value', ({ scenario }) => {
    const list = scenario.call('getCircadianLightModes', []);
    expect(list[0].name).toBeDefined();
    expect(list[0].name.ru).toBeDefined();
    expect(list[0].name.en).toBeDefined();
    expect(typeof list[0].value).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// README §"История изменений 6.0+" — режимы рассвета/заката.
// Документация уже неявная, но API:
//   global.enableSunriseModeFor(service)  → mode = "sunrise"
//   global.enableSunsetModeFor(service)   → mode = "sunset"
//   global.disableModeFor(service)        → отключает любой режим
// ---------------------------------------------------------------------------

describe('Sunrise/Sunset режимы', () => {
  it('enableSunriseModeFor → state mode = "sunrise"', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 99, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    scenario.call('enableSunriseModeFor', [service]);

    const modeVar = 'CircadianLight_Mode_' + service.getUUID() + '_active';
    expect(variables.global[modeVar]).toBe('sunrise');
  });

  it('enableSunsetModeFor → state mode = "sunset"', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 99, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    scenario.call('enableSunsetModeFor', [service]);

    const modeVar = 'CircadianLight_Mode_' + service.getUUID() + '_active';
    expect(variables.global[modeVar]).toBe('sunset');
  });

  it('disableModeFor → state mode сбрасывается', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 99, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    scenario.call('enableSunriseModeFor', [service]);
    scenario.call('disableModeFor', [service]);

    const modeVar = 'CircadianLight_Mode_' + service.getUUID() + '_active';
    expect(variables.global[modeVar]).toBeUndefined();
  });

  it('processMode без активного режима → возвращает [temp, bright] без изменений', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 99, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('processMode', [12, 0, 0, 100, 80, service.getUUID()]);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(80);
  });

  it('processMode без UUID → возвращает [temp, bright] без изменений', ({ scenario }) => {
    const result = scenario.call('processMode', [12, 0, 0, 100, 80, null]);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// VERSION константа (нужна для логирования и отладки)
// ---------------------------------------------------------------------------

describe('VERSION', () => {
  it('константа VERSION определена', ({ scenario }) => {
    const v = scenario.global('VERSION');
    expect(v).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Спека §4/§3: circadianLightCallbackFire возвращает boolean (решает «тихий
// no-op») и делает автоочистку мёртвых сервисов (ключ "aid.sid" больше не
// резолвится → handler удаляется).
// ---------------------------------------------------------------------------

describe('circadianLightCallbackFire — boolean-результат и автоочистка', () => {
  it('возвращает true, когда handler зарегистрирован (живой сервис)', ({ hub, scenario, variables }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);
    variables.global.CircadianLight_Callbacks.handlers[service.getUUID()] = () => {};

    const result = scenario.call('circadianLightCallbackFire', [service, 'reset', {}]);

    expect(result).toBe(true);
  });

  it('возвращает false, когда handler отсутствует (живой сервис, но не зарегистрирован)', ({ hub, scenario }) => {
    const lamp = makeColorTempLamp(hub, 1, true, 100, 400);
    const service = lamp.getService(HS.Lightbulb);

    const result = scenario.call('circadianLightCallbackFire', [service, 'reset', {}]);

    expect(result).toBe(false);
  });

  it('fire по UUID удалённого сервиса удаляет handler и возвращает false (prune)', ({ scenario, variables }) => {
    variables.global.CircadianLight_Callbacks.handlers['99999.13'] = () => {};

    const result = scenario.call('circadianLightCallbackFire', ['99999.13', 'reset', {}]);

    expect(result).toBe(false);
    expect(variables.global.CircadianLight_Callbacks.handlers['99999.13']).toBeUndefined();
  });
});
