// Использование:
// Создать виртуальное устройство с Датчиком температуры и с Датчиком влажности. Запомнить ид аксессуара.
// Создать блочный сценарий, который или при изменении датчиком или просто планировщиковв каждую, например, минуту,
// вызывать блок кода с вызовом
// global.averageRoomSensors(ROOM_NAME, ACCESSORY_ID);
// Где ROOM_NAME - название комнаты в кавычках (например: "Спальня")
// ACCESSORY_ID - ИД виртуального аксессуара (например: 42)

// Функция для сбора и усреднения показаний датчиков температуры и влажности в одной комнате
function averageRoomSensors(roomName, averageDeviceId) {
  // Переменные для хранения сумм показаний и количества датчиков
  let tempSum = 0;
  let humSum = 0;
  let tempSensorCount = 0;
  let humSensorCount = 0;

  // Получение всех комнат
  const rooms = Hub.getRooms();

  // Итерация по комнатам
  rooms.forEach(function loopRooms(room) {
    // Проверка соответствия имени комнаты
    if (room.getName() === roomName) {
      // Получение аксессуаров в комнате
      const roomAccessories = room.getAccessories();

      // Фильтрация аксессуаров и сбор данных
      roomAccessories.filter(function loop(accessory) {
        // Проверка статуса аксессуара (онлайн и не виртуальный)
        const status = accessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue() == true;
        return status && accessory.getUUID() !== averageDeviceId;
      }).forEach(function loop(accessory) {
        // Получение сервисов температуры и влажности
        const tempService = accessory.getService(HS.TemperatureSensor);
        const humService = accessory.getService(HS.HumiditySensor);

        // Обработка сервиса температуры
        if (tempService) {
          const tempCharacteristic = tempService.getCharacteristic(HC.CurrentTemperature);
          tempSensorCount++;
          tempSum += tempCharacteristic.getValue();
        }

        // Обработка сервиса влажности
        if (humService) {
          const humCharacteristic = humService.getCharacteristic(HC.CurrentRelativeHumidity);
          humSensorCount++;
          humSum += humCharacteristic.getValue();
        }
      });
    }
  });

  // Вычисление средних значений температуры и влажности
  const avgTemp = tempSensorCount > 0 ? tempSum / tempSensorCount : 0;
  const avgHum = humSensorCount > 0 ? humSum / humSensorCount : 0;

  // Обновление значений виртуального устройства
  Hub.setCharacteristicValue(averageDeviceId, 15, avgTemp); // Установка значения температуры
  Hub.setCharacteristicValue(averageDeviceId, 18, avgHum); // Установка значения влажности
}