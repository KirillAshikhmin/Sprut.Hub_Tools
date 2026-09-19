// Фокус-тесты утилиты построения списков опций collectServicesByTypes.
//
// Единственное исключение из «шва» (SPEC.md §19 / interfaces.md): функция общая
// с эталоном MotionLightAutomation и там покрыта отдельным файлом — здесь так же.
// Исходник сценария не открывался: контракт функции взят из спецификации эталона.
//
// Контракт:
//   • на вход — объект «имя списка → массив типов сервисов», на выход — объект
//     с ТЕМИ ЖЕ ключами (имена списков задаёт вызывающий, поэтому тест не угадывает
//     имена групп самого сценария, а передаёт свои);
//   • сервис попадает в список ПО ТИПУ сервиса;
//   • один сервис не дублируется в пределах списка;
//   • первым элементом идёт заголовок «не выбрано» с пустым value;
//   • дальше элементы отсортированы по отображаемому русскому имени.

function typesRequest() {
  return {
    motion: [HS.MotionSensor, HS.OccupancySensor, HS.ContactSensor],
    humidity: [HS.HumiditySensor],
    manual: [HS.Switch, HS.ContactSensor, HS.StatelessProgrammableSwitch, HS.C_PulseMeter],
    gate: [HS.Switch],
  };
}

function addService(hub, id, name, room, serviceType, charType, charValue) {
  return hub.addAccessory({
    id: id, name: name, room: room,
    services: [{ type: serviceType, characteristics: [{ type: charType, value: charValue }] }],
  });
}

function collect(scenario) {
  return scenario.call('collectServicesByTypes', [typesRequest()]);
}

// value'ы реальных элементов списка (без ведущего заголовка).
function values(list) {
  return list.slice(1).map((o) => o.value);
}

// Отображаемое имя элемента: { ru, en } либо строка.
function label(entry) {
  const name = entry.name;
  if (name && typeof name === 'object') return String(name.ru);
  return String(name);
}

// Порядок элементов списка сверяется с ЯВНО выписанными именами фикстуры:
// ожидаемое значение берётся не из кода под тестом.
function expectOrder(list, expectedNames) {
  const labels = list.slice(1).map(label);
  expect(labels).toHaveLength(expectedNames.length);
  for (let i = 0; i < expectedNames.length; i += 1) {
    expect(labels[i]).toContain(expectedNames[i]);
  }
}

function house(hub) {
  return {
    motion: addService(hub, 10, 'Ясли движение', 'Санузел', HS.MotionSensor, HC.MotionDetected, false),
    occupancy: addService(hub, 11, 'Присутствие', 'Санузел', HS.OccupancySensor, HC.OccupancyDetected, 0),
    contact: addService(hub, 12, 'Бдверь', 'Санузел', HS.ContactSensor, HC.ContactSensorState, 0),
    humidity: addService(hub, 13, 'Абажур влажности', 'Санузел', HS.HumiditySensor, HC.CurrentRelativeHumidity, 50),
    sw: addService(hub, 14, 'Выключатель', 'Санузел', HS.Switch, HC.On, false),
    button: addService(hub, 15, 'Кнопка', 'Санузел', HS.StatelessProgrammableSwitch, HC.ProgrammableSwitchEvent, 0),
    pulse: addService(hub, 16, 'Импульсы', 'Санузел', HS.C_PulseMeter, HC.C_PulseCount, 0),
  };
}

describe('collectServicesByTypes — распределение по типам', () => {
  it('в список попадают ровно сервисы запрошенных типов', ({ hub, scenario }) => {
    const h = house(hub);
    const lists = collect(scenario);
    const motion = values(lists.motion);

    expect(motion).toContain(h.motion.getService(HS.MotionSensor).getUUID());
    expect(motion).toContain(h.occupancy.getService(HS.OccupancySensor).getUUID());
    expect(motion).toContain(h.contact.getService(HS.ContactSensor).getUUID());
    expect(motion).not.toContain(h.humidity.getService(HS.HumiditySensor).getUUID());
    expect(motion).not.toContain(h.sw.getService(HS.Switch).getUUID());
  });

  it('список датчиков влажности содержит только HumiditySensor', ({ hub, scenario }) => {
    const h = house(hub);
    const humidity = values(collect(scenario).humidity);

    expect(humidity).toContain(h.humidity.getService(HS.HumiditySensor).getUUID());
    expect(humidity).not.toContain(h.motion.getService(HS.MotionSensor).getUUID());
    expect(humidity).toHaveLength(1);
  });

  it('список ручных входов содержит Switch, ContactSensor, кнопку и счётчик импульсов', ({ hub, scenario }) => {
    const h = house(hub);
    const manual = values(collect(scenario).manual);

    expect(manual).toContain(h.sw.getService(HS.Switch).getUUID());
    expect(manual).toContain(h.contact.getService(HS.ContactSensor).getUUID());
    expect(manual).toContain(h.button.getService(HS.StatelessProgrammableSwitch).getUUID());
    expect(manual).toContain(h.pulse.getService(HS.C_PulseMeter).getUUID());
    expect(manual).not.toContain(h.motion.getService(HS.MotionSensor).getUUID());
  });

  it('список рубильника содержит только выключатели', ({ hub, scenario }) => {
    const h = house(hub);
    const gate = values(collect(scenario).gate);

    expect(gate).toContain(h.sw.getService(HS.Switch).getUUID());
    expect(gate).not.toContain(h.button.getService(HS.StatelessProgrammableSwitch).getUUID());
    expect(gate).toHaveLength(1);
  });

  it('пустой хаб — в списке остаётся только заголовок', ({ scenario }) => {
    const lists = collect(scenario);
    expect(values(lists.motion)).toHaveLength(0);
    expect(lists.motion).toHaveLength(1);
  });
});

describe('collectServicesByTypes — форма списка', () => {
  it('первый элемент — заголовок с пустым value', ({ hub, scenario }) => {
    house(hub);
    const lists = collect(scenario);

    expect(lists.motion[0].value).toBe('');
    expect(label(lists.motion[0]).length).toBeGreaterThan(0);
  });

  it('один и тот же сервис не дублируется в пределах списка', ({ hub, scenario }) => {
    const h = house(hub);
    // Тип ContactSensor указан в ОДНОМ списке запроса дважды — сервис обязан
    // попасть в результат один раз. Без дубля в запросе дублировать нечего,
    // и утверждение проходило бы и у реализации вовсе без дедупликации.
    const dup = values(scenario.call('collectServicesByTypes', [{
      dup: [HS.Switch, HS.ContactSensor, HS.StatelessProgrammableSwitch, HS.ContactSensor],
    }]).dup);
    const uuid = h.contact.getService(HS.ContactSensor).getUUID();
    let count = 0;
    for (const value of dup) if (value === uuid) count += 1;

    expect(count).toBe(1);
    expect(dup).toHaveLength(3);   // выключатель, контакт, кнопка — по одному разу
  });

  it('элементы отсортированы по отображаемому русскому имени', ({ hub, scenario }) => {
    house(hub);
    const lists = collect(scenario);

    // Ожидаемый порядок выписан по русскому алфавиту от имён фикстуры, а не пересчитан
    // тем же сравнением, что и в коде: иначе утверждение «отсортировано так же, как
    // сортирует код» верно при любой сортировке. Все устройства в одной комнате
    // «Санузел», поэтому порядок задают имена аксессуаров.
    expectOrder(lists.manual, ['Бдверь', 'Выключатель', 'Импульсы', 'Кнопка']);
    expectOrder(lists.motion, ['Бдверь', 'Присутствие', 'Ясли движение']);
  });

  it('у каждого элемента есть value вида "<аксессуар>.<сервис>"', ({ hub, scenario }) => {
    house(hub);
    const motion = values(collect(scenario).motion);

    expect(motion.length).toBeGreaterThan(0);
    for (const value of motion) expect(/^\d+\.\d+$/.test(String(value))).toBe(true);
  });
});
