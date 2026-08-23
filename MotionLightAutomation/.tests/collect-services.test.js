// Фокус-тесты утилиты построения списков опций collectServicesByTypes и хелпера
// имени getDeviceName/buildDeviceName (source/MotionLightAutomation.js).
//
// Спецификация — doc-комментарии функций:
//   • сервис попадает в список ПО ТИПУ (характеристики required и не проверяются);
//   • один сервис не дублируется в пределах списка;
//   • результат отсортирован по русскому имени;
//   • первым идёт заголовок "Не выбрано" с пустым value.
// Функции доступны как глобальные через scenario.call(name, [args]).

// Наборы типов — те же, что реально передаёт createOptions().
function pickerTypes() {
  return {
    motion: [HS.MotionSensor, HS.OccupancySensor, HS.ContactSensor],
    manual: [HS.Switch, HS.ContactSensor, HS.StatelessProgrammableSwitch, HS.C_PulseMeter],
    gate: [HS.Switch],
    lux: [HS.LightSensor],
  };
}

function addService(hub, id, name, room, serviceType, charType, charValue) {
  return hub.addAccessory({
    id, name, room,
    services: [{ type: serviceType, characteristics: [{ type: charType, value: charValue }] }],
  });
}

// value'ы реальных элементов списка (без ведущего заголовка "Не выбрано").
function values(list) {
  return list.slice(1).map((o) => o.value);
}

// ---------------------------------------------------------------------------
// Распределение сервисов по спискам — строго по типу сервиса
// ---------------------------------------------------------------------------
describe('collectServicesByTypes — распределение по типам', () => {
  it('motion принимает MotionSensor, OccupancySensor и ContactSensor', ({ hub, scenario }) => {
    const motion = addService(hub, 10, 'Движение', 'Кухня', HS.MotionSensor, HC.MotionDetected, false);
    const occ = addService(hub, 11, 'Присутствие', 'Кухня', HS.OccupancySensor, HC.OccupancyDetected, 0);
    const contact = addService(hub, 12, 'Контакт', 'Кухня', HS.ContactSensor, HC.ContactSensorState, 0);
    const sw = addService(hub, 13, 'Выключатель', 'Кухня', HS.Switch, HC.On, false);

    const motionValues = values(scenario.call('collectServicesByTypes', [pickerTypes()]).motion);

    expect(motionValues).toContain(motion.getService(HS.MotionSensor).getUUID());
    expect(motionValues).toContain(occ.getService(HS.OccupancySensor).getUUID());
    expect(motionValues).toContain(contact.getService(HS.ContactSensor).getUUID());
    expect(motionValues).not.toContain(sw.getService(HS.Switch).getUUID());
  });

  it('manual принимает Switch, ContactSensor, StatelessProgrammableSwitch и C_PulseMeter', ({ hub, scenario }) => {
    const sw = addService(hub, 10, 'Выключатель', 'Кухня', HS.Switch, HC.On, false);
    const contact = addService(hub, 11, 'Контакт', 'Кухня', HS.ContactSensor, HC.ContactSensorState, 0);
    const btn = addService(hub, 12, 'Кнопка', 'Кухня', HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent, 0);
    const pulse = addService(hub, 13, 'Импульс', 'Кухня', HS.C_PulseMeter, HC.C_PulseCount, 0);
    const motion = addService(hub, 14, 'Движение', 'Кухня', HS.MotionSensor, HC.MotionDetected, false);

    const manualValues = values(scenario.call('collectServicesByTypes', [pickerTypes()]).manual);

    expect(manualValues).toContain(sw.getService(HS.Switch).getUUID());
    expect(manualValues).toContain(contact.getService(HS.ContactSensor).getUUID());
    expect(manualValues).toContain(btn.getService(HS.StatelessProgrammableSwitch).getUUID());
    expect(manualValues).toContain(pulse.getService(HS.C_PulseMeter).getUUID());
    expect(manualValues).not.toContain(motion.getService(HS.MotionSensor).getUUID());
  });

  it('gate принимает только Switch, lux — только LightSensor', ({ hub, scenario }) => {
    const sw = addService(hub, 10, 'Выключатель', 'Кухня', HS.Switch, HC.On, false);
    const lux = addService(hub, 11, 'Датчик света', 'Кухня', HS.LightSensor, HC.CurrentAmbientLightLevel, 100);

    const lists = scenario.call('collectServicesByTypes', [pickerTypes()]);

    expect(values(lists.gate)).toEqual([sw.getService(HS.Switch).getUUID()]);
    expect(values(lists.lux)).toEqual([lux.getService(HS.LightSensor).getUUID()]);
  });

  it('сервис общего типа попадает сразу в несколько списков', ({ hub, scenario }) => {
    const contact = addService(hub, 10, 'Контакт', 'Кухня', HS.ContactSensor, HC.ContactSensorState, 0);
    const sw = addService(hub, 11, 'Выключатель', 'Кухня', HS.Switch, HC.On, false);

    const lists = scenario.call('collectServicesByTypes', [pickerTypes()]);
    const contactUuid = contact.getService(HS.ContactSensor).getUUID();
    const swUuid = sw.getService(HS.Switch).getUUID();

    // ContactSensor есть и в motion, и в manual.
    expect(values(lists.motion)).toContain(contactUuid);
    expect(values(lists.manual)).toContain(contactUuid);
    // Switch есть и в manual, и в gate.
    expect(values(lists.manual)).toContain(swUuid);
    expect(values(lists.gate)).toContain(swUuid);
  });

  it('сервис нерелевантного типа (Lightbulb) не попадает ни в один список', ({ hub, scenario }) => {
    const lamp = addService(hub, 10, 'Лампа', 'Кухня', HS.Lightbulb, HC.On, false);

    const lists = scenario.call('collectServicesByTypes', [pickerTypes()]);
    const uuid = lamp.getService(HS.Lightbulb).getUUID();

    for (const key of ['motion', 'manual', 'gate', 'lux']) {
      expect(values(lists[key])).not.toContain(uuid);
    }
  });
});

// ---------------------------------------------------------------------------
// Форма результата: заголовок, value=uuid, дедуп, сортировка
// ---------------------------------------------------------------------------
describe('collectServicesByTypes — форма результата', () => {
  it('каждый список начинается с заголовка "Не выбрано" и пустого value', ({ hub, scenario }) => {
    addService(hub, 10, 'Движение', 'Кухня', HS.MotionSensor, HC.MotionDetected, false);

    const lists = scenario.call('collectServicesByTypes', [pickerTypes()]);

    for (const key of ['motion', 'manual', 'gate', 'lux']) {
      expect(lists[key][0].value).toBe('');
      expect(lists[key][0].name.ru).toBe('Не выбрано');
      expect(lists[key][0].name.en).toBe('Not selected');
    }
  });

  it('value реального элемента равен UUID сервиса', ({ hub, scenario }) => {
    const motion = addService(hub, 10, 'Движение', 'Кухня', HS.MotionSensor, HC.MotionDetected, false);

    const lists = scenario.call('collectServicesByTypes', [pickerTypes()]);

    expect(values(lists.motion)).toEqual([motion.getService(HS.MotionSensor).getUUID()]);
  });

  it('дедуплицирует сервис в пределах списка, если тип указан дважды', ({ hub, scenario }) => {
    const sw = addService(hub, 10, 'Выключатель', 'Кухня', HS.Switch, HC.On, false);

    // Тип Switch указан в списке дважды — сервис должен попасть один раз.
    const lists = scenario.call('collectServicesByTypes', [{ dup: [HS.Switch, HS.Switch] }]);

    expect(values(lists.dup)).toEqual([sw.getService(HS.Switch).getUUID()]);
  });

  it('сортирует элементы по русскому имени', ({ hub, scenario }) => {
    // Комната одна → сортировка по имени аксессуара: "Апельсин" раньше "Яблоко".
    addService(hub, 10, 'Яблоко', 'Кухня', HS.MotionSensor, HC.MotionDetected, false);
    addService(hub, 11, 'Апельсин', 'Кухня', HS.MotionSensor, HC.MotionDetected, false);

    const names = scenario.call('collectServicesByTypes', [pickerTypes()]).motion
      .slice(1)
      .map((o) => o.name.ru);
    const iOrange = names.findIndex((n) => n.indexOf('Апельсин') >= 0);
    const iApple = names.findIndex((n) => n.indexOf('Яблоко') >= 0);

    expect(iOrange).toBeGreaterThan(-1);
    expect(iApple).toBeGreaterThan(iOrange);
  });
});

// ---------------------------------------------------------------------------
// getDeviceName / buildDeviceName
// ---------------------------------------------------------------------------
describe('getDeviceName / buildDeviceName', () => {
  it('имя содержит комнату, имя аксессуара и UUID сервиса', ({ hub, scenario }) => {
    const acc = addService(hub, 10, 'Мой датчик', 'Спальня', HS.MotionSensor, HC.MotionDetected, false);
    const svc = acc.getService(HS.MotionSensor);

    const name = scenario.call('getDeviceName', [svc]);

    expect(name).toContain('Спальня');
    expect(name).toContain('Мой датчик');
    expect(name).toContain(svc.getUUID());
  });

  it('явно переданный accessory даёт тот же результат, что и без него', ({ hub, scenario }) => {
    const acc = addService(hub, 10, 'Датчик', 'Зал', HS.MotionSensor, HC.MotionDetected, false);
    const svc = acc.getService(HS.MotionSensor);

    const withAcc = scenario.call('getDeviceName', [svc, svc.getAccessory()]);
    const withoutAcc = scenario.call('getDeviceName', [svc]);

    expect(withAcc).toBe(withoutAcc);
  });

  it('null-сервис → пустая строка', ({ scenario }) => {
    expect(scenario.call('getDeviceName', [null])).toBe('');
  });
});
