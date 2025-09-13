// Константы
const CONSTANTS = {
    ONE_DAY_MS: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
    INVALID_VALUE: -100, // Невалидное значение от датчиков Aqara
    HYSTERESIS_FACTOR: 0.75, // Коэффициент гистерезиса (75% от порога точности)
    DEFAULT_PRECISION_THRESHOLD: 0.1, // Порог точности по умолчанию
    MAX_PRECISION_THRESHOLD: 100.0, // Максимальный порог точности
    NOON_HOUR: 12, // Час для ежедневной проверки
    DEBUG_CRON_SCHEDULE: "0 * * * * *", // Каждую минуту при debug
    DAILY_CRON_SCHEDULE: "0 12 * * * *" // Ежедневно в полдень
};

// Выносим название и описание в переменные для использования в info и options
let scenarioName = {
    ru: "🌡️💧 Средняя температура и влажность в комнате или доме",
    en: "🌡️💧 Average temperature and humidity in room or house"
};

let scenarioDescription = {
    ru: "🌡️💧 Универсальный сценарий для создания виртуального датчика с усредненными показаниями\n\n" +
        "📊 ЧТО ДЕЛАЕТ:\n" +
        "• Собирает показания со всех датчиков в выбранной комнате или во всем доме, вычисляет среднее значение и устанавливает его на виртуальный датчик\n" +
        "• Автоматически адаптируется к типу датчика (температура/влажность)\n" +
        "• Фильтрует невалидные данные (оффлайн устройства, значение -100 (устройства Aqara с разряжающейся батарейкой))\n\n" +
         "🔧 ПОДДЕРЖИВАЕМЫЕ СЕРВИСЫ:\n" +
         "• TemperatureSensor (Датчик температуры)\n" +
         "• Thermostat (Термостат)\n" +
         "• HeaterCooler (Обогреватель/охладитель)\n" +
         "• HumiditySensor (Датчик влажности)\n" +
         "• HumidifierDehumidifier (Увлажнитель/осушитель)\n\n" +
        "⚒️ ПРИНЦИП РАБОТЫ:\n" +
        "При запуске:\n" +
        "• Подписка на изменения показаний датчиков\n" +
        "• Сбор, расчет и установка среднего значения\n" +
        "При изменении показаний датчиков:\n" +
        "• Обновление среднего значения с учетом гистерезиса и порога точности для предотвращения скачков\n\n" +
        "Ежечасно:\n" +
        "• Проверка актуальности списка датчиков\n" +
        "• Автоматическое добавление новых устройств\n" +
        "• Удаление несуществующих/перемещенных устройств\n" +
        "• Проверка работоспособности датчиков",
     en: "🌡️💧 Universal scenario for creating a virtual sensor with averaged readings\n\n" +
         "📊 WHAT IT DOES:\n" +
         "• Collects readings from all sensors in the selected room or whole house, calculates average value and sets it to the virtual sensor\n" +
         "• Automatically adapts to sensor type (temperature/humidity)\n" +
         "• Filters invalid data (offline devices, -100 value (Aqara devices with low battery))\n\n" +
         "🔧 SUPPORTED SERVICES:\n" +
         "• TemperatureSensor (Temperature sensor)\n" +
         "• Thermostat (Thermostat)\n" +
         "• HeaterCooler (Heater/cooler)\n" +
         "• HumiditySensor (Humidity sensor)\n" +
         "• HumidifierDehumidifier (Humidifier/dehumidifier)\n\n" +
         "⚒️ WORK PRINCIPLE:\n" +
         "On startup:\n" +
         "• Subscription to sensor reading changes\n" +
         "• Collection, calculation and setting of average value\n" +
         "On sensor reading changes:\n" +
         "• Updating average value with hysteresis and precision threshold to prevent jumps\n\n" +
         "Hourly:\n" +
         "• Checking sensor list relevance\n" +
         "• Automatic addition of new devices\n" +
         "• Removal of non-existent/moved devices\n" +
         "• Checking sensor health"
};

info = {
    name: scenarioName.ru,
    description: scenarioDescription.ru,
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.TemperatureSensor, HS.HumiditySensor],
    sourceCharacteristics: [HC.CurrentTemperature, HC.CurrentRelativeHumidity],

    options: {
        important: {
            name: {
                en: "⚠️ IMPORTANT",
                ru: "⚠️ ВАЖНО"
            },
            desc: {
                ru: "Активируйте сценарий ТОЛЬКО на виртуальных датчиках температуры или влажности!\n\n" +
                    "Данная логика получает показания с датчиков температуры или влажности в выбранной комнате и устанавливает среднее значение устройству, на котором включена логика.\n\n" +
                    "Сначала выберите комнату, " +
                    "настройте точность и список исключений в настройках, а затем активируйте сценарий переключателем 'Активно'.",
                en: "Activate the scenario ONLY on virtual temperature or humidity sensors.\n\n" +
                    "This logic receives readings from temperature or humidity sensors in the selected room and sets the average value to the device on which the logic is enabled.\n\n" +
                    "First select the room " +
                    "and set the precision and excluded devices list in settings, then activate the scenario with the 'Active' switch."
            },
            type: "String",
            value: "",
            formType: "status"
        },
        roomName: {
            name: {
                ru: "🏠 Комната",
                en: "🏠 Room"
            },
            type: "String",
            value: "",
            formType: "list",
            values: getRoomsList(),
            desc: {
                ru: "Выберите комнату, из которой будут браться показания датчиков для расчета среднего значения.\n\n" +
                    "📋 Варианты:\n" +
                    "• 🚪 Комната устройства - используется комната в которой расположено устройство, на котором включена логика\n" +
                    "• 🏠 Весь дом - собирает показания со всех датчиков во всех комнатах дома\n" +
                    "• Конкретная комната - выберите любую комнату из списка",
                en: "Select room for averaging readings.\n\n" +
                    "📋 Options:\n" +
                    "• 🚪 Device room - uses room where the device is located, on which the logic is enabled\n" +
                    "• 🏠 Whole house - collects readings from all sensors in all rooms\n" +
                    "• Specific room - choose any room from the list"
            }
        },
        precisionThreshold: {
            name: {
                ru: "📏 Точность",
                en: "📏 Precision"
            },
            type: "Double",
            value: CONSTANTS.DEFAULT_PRECISION_THRESHOLD,
            minValue: 0.0,
            maxValue: CONSTANTS.MAX_PRECISION_THRESHOLD,
            step: 0.01,
            desc: {
                ru: "Контролирует, как часто будет обновляться среднее значение.\n\n" +
                    "📊 Например при значении 0.5, значение у датчика будет кратно 0.5 (21.5, 22.0, 22.5 и т.д.)\n\n" +
                    "💡 Зачем нужно:\n" +
                    "• Предотвращает частые скачки показаний\n" +
                    "• Уменьшает записи в историю\n",
                en: "Controls how often the average value will be updated.\n\n" +
                    "📊 For example, at a value of 0.5, the value of the sensor will be a multiple of 0.5 (21.5, 22.0, 22.5, etc.)\n\n" +
                    "💡 Why needed:\n" +
                    "• Prevents frequent value jumps\n" +
                    "• Decreases history records\n"
            }
        },
        excludedDevices: {
            name: {
                ru: "🚫 Исключить устройства",
                en: "🚫 Exclude devices"
            },
            type: "String",
            value: "",
            desc: {
                ru: "Устройства, которые НЕ будут участвовать в расчете среднего значения.\n" +
                    "Форматы: ID аксессуара или ID аксессуара.ID сервиса " +
                    "(15, 133.17, 42, 25.13)",
                en: "Devices that will NOT participate in calculating the average value.\n" +
                    "Formats: accessory ID or accessory ID.service ID " +
                    "(15.13, 133.17, 42, 25.13)"
            }
        },
        desc: {
            name: {
                en: "ℹ️ DESCRIPTION",
                ru: "ℹ️ ОПИСАНИЕ"
            },
            desc: scenarioDescription,
            type: "String",
            value: "",
            formType: "status"
        },
        debug: {
            name: {
                ru: "🔧 Режим отладки",
                en: "🔧 Debug mode"
            },
            type: "Boolean",
            value: false,
            desc: {
                ru: "Включить отладочные сообщения в консоль (не рекомендуется включать для повседневного использования)",
                en: "Enable debug messages in console (not recommended to enable for daily use)"
            }
        }
    },

    variables: {
        initialized: false,
        roomName: "",
        characteristicType: null,
        devicesData: {}, // Хранит данные по устройствам: {deviceId: {value, online, lastUpdate}}
        lastAverageValue: null,
        currentRoom: "", // Текущая комната устройства
        noonTask: null // Cron задача для проверки обновлений
    }
};

function trigger(source, value, variables, options, context) {
    try {
        const service = source.getService();
        const accessory = service.getAccessory();
        const characteristicType = source.getType();
        const currentRoom = accessory.getRoom().getName();

        // Определяем комнату
        let targetRoomName = options.roomName;
        if (!targetRoomName || targetRoomName === "") {
            targetRoomName = currentRoom;
        }

        // Проверяем, изменилась ли комната или это первый запуск
        const roomChanged = variables.currentRoom !== currentRoom;
        const firstRun = !variables.initialized;

        if (roomChanged || firstRun) {
            // Валидируем опции
            validateOptions(options);

            // Очищаем данные при смене комнаты
            if (roomChanged && variables.initialized) {
                if (options.debug) {
                    console.info(`Комната изменилась с "${variables.currentRoom}" на "${currentRoom}". Переинициализация...`);
                }
                clearVariables(variables);
            }

            // Определяем тип характеристики (температура или влажность)
            variables.characteristicType = characteristicType;
            variables.roomName = targetRoomName;
            variables.currentRoom = currentRoom;
            variables.currentServiceId = source.getService().getUUID();

            // Проверяем существование комнаты или обрабатываем "Весь дом"
            const rooms = Hub.getRooms();
            let targetRoom = null;

            if (targetRoomName === "__WHOLE_HOUSE__") {
                // Для "Весь дом" используем специальную логику
                targetRoom = "__WHOLE_HOUSE__";
            } else {
                // Ищем комнату по имени
                for (let i = 0; i < rooms.length; i++) {
                    if (rooms[i].getName() === targetRoomName) {
                        targetRoom = rooms[i];
                        break;
                    }
                }

                if (!targetRoom) {
                    console.error(`Комната "${targetRoomName}" не найдена!`);
                    return;
                }
            }

            if (options.debug) {
                const displayName = targetRoomName === "__WHOLE_HOUSE__" ? "Весь дом" : targetRoomName;
                console.info(`Инициализация усреднения ${getCharacteristicName(characteristicType)} для: ${displayName}`);
            }

            // Собираем данные по всем устройствам в комнате
            collectDevicesData(targetRoom, characteristicType, variables, options, source);

            // Подписываемся на изменения характеристик
            subscribeToChanges(characteristicType, variables, source, options);

            // Вычисляем и устанавливаем среднее значение
            calculateAndSetAverage(source, variables, options);

            // Создаем cron задачу для проверки обновлений датчиков
            if (!variables.noonTask) {
                // Ежедневно в полдень, если debug включен - каждую минуту
                const cronSchedule = options.debug ? CONSTANTS.DEBUG_CRON_SCHEDULE : CONSTANTS.DAILY_CRON_SCHEDULE;
                variables.noonTask = Cron.schedule(cronSchedule, function () {
                    checkSensorsUpdates(variables, options);
                });
            }

            variables.initialized = true;
        }

    } catch (e) {
        console.error(`Ошибка инициализации сценария: ${e.message}`);
    }
}

function clearVariables(variables) {
    // Очищаем cron задачу
    if (variables.noonTask) {
        variables.noonTask.clear();
        variables.noonTask = null;
    }

    variables.initialized = false;
    variables.roomName = "";
    variables.characteristicType = null;
    variables.devicesData = {};
    variables.lastAverageValue = null;
    variables.currentRoom = "";
    variables.currentServiceId = null;
}

function isValidData(value, online) {
    return online && value !== CONSTANTS.INVALID_VALUE && value !== null && value !== undefined;
}

function parseExcludedDevices(excludedDevicesString) {
    const excluded = {
        accessories: [], // ID аксессуаров
        services: []     // ID аксессуар.сервис
    };

    if (!excludedDevicesString || excludedDevicesString.trim() === "") {
        return excluded;
    }

    const devices = excludedDevicesString.split(',');

    for (let i = 0; i < devices.length; i++) {
        const device = devices[i].trim();
        if (device.length > 0) {
            if (device.indexOf('.') >= 0) {
                // Формат: аксессуар.сервис
                excluded.services.push(device);
            } else {
                // Формат: аксессуар
                excluded.accessories.push(device);
            }
        }
    }

    return excluded;
}

function isDeviceExcluded(accessoryId, serviceId, excludedDevices) {
    // Проверяем исключение по ID аксессуара
    if (excludedDevices.accessories.indexOf(accessoryId.toString()) >= 0) {
        return true;
    }

    // Проверяем исключение по ID аксессуар.сервис
    const serviceKey = accessoryId + '.' + serviceId;
    if (excludedDevices.services.indexOf(serviceKey) >= 0) {
        return true;
    }

    return false;
}

function collectDevicesData(room, characteristicType, variables, options, source, onlyNew = false) {
    try {
        let roomAccessories = [];
        
        // Если room === "__WHOLE_HOUSE__", используем Hub.getAccessories() для получения всех аксессуаров
        if (room === "__WHOLE_HOUSE__") {
            roomAccessories = Hub.getAccessories();
        } else {
            roomAccessories = room.getAccessories();
        }
        
        if (!onlyNew) {
            variables.devicesData = {};
        }
        const excludedDevices = parseExcludedDevices(options.excludedDevices);
        let newDevices = [];

        roomAccessories.forEach(accessory => {
            // Пропускаем текущее устройство (то, к которому привязан сценарий)
            if (source && accessory.getUUID() === source.getAccessory().getUUID()) {
                return;
            }

            // Проходим по всем сервисам аксессуара в поисках нужной характеристики
            const services = accessory.getServices();
            services.forEach(service => {
                const characteristic = service.getCharacteristic(characteristicType);
                if (characteristic) {
                    // Используем уникальный ключ: service.getUUID() уже содержит "AccessoryId.ServiceId"
                    const deviceKey = service.getUUID();

                    // Если ищем только новые устройства, пропускаем уже существующие
                    if (onlyNew && variables.devicesData[deviceKey]) {
                        return;
                    }

                    // Пропускаем текущий сервис (тот, к которому привязан сценарий)
                    if (variables.currentServiceId && deviceKey === variables.currentServiceId) {
                        return;
                    }

                    const onlineStatus = accessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue();
                    const currentValue = characteristic.getValue();

                    // Проверяем, исключено ли устройство
                    const isExcluded = isDeviceExcluded(accessory.getUUID(), service.getUUID(), excludedDevices);

                    variables.devicesData[deviceKey] = {
                        value: currentValue,
                        online: onlineStatus,
                        lastUpdate: Date.now(),
                        service: service,
                        excluded: isExcluded,
                        accessoryId: accessory.getUUID(),
                        serviceId: service.getUUID().split('.')[1], // Берем только ServiceId без AccessoryId
                        deviceName: accessory.getName(),
                        serviceName: service.getName()
                    };

                    if (onlyNew) {
                        newDevices.push(`${accessory.getName()}(${service.getName()})`);
                    }

                    // Проверяем валидность данных и выводим предупреждения только для неисключенных устройств
                    if (!isValidData(currentValue, onlineStatus) && !isExcluded) {
                        if (options.debug) {
                            if (!onlineStatus) {
                                console.warn(`Устройство ${accessory.getName()} не в сети`);
                            }
                            if (currentValue === CONSTANTS.INVALID_VALUE) {
                                console.warn(`Устройство ${accessory.getName()} передает невалидное значение: ${CONSTANTS.INVALID_VALUE}`);
                            }
                        }
                    }

                    if (isExcluded && options.debug) {
                        console.info(`Устройство ${accessory.getName()} (${service.getName()}) исключено из расчета`);
                    }
                }
            });
        });

        return onlyNew ? newDevices : undefined;
    } catch (e) {
        console.error(`Ошибка в collectDevicesData: ${e.message}`);
        return onlyNew ? [] : undefined;
    }
}

function subscribeToChanges(characteristicType, variables, source, options) {
    // Подписываемся на изменения соответствующей характеристики
    // Выбираем сервисы в зависимости от типа характеристики
    let serviceTypes = [];
    if (characteristicType === HC.CurrentTemperature) {
        serviceTypes = [HS.TemperatureSensor, HS.Thermostat, HS.HeaterCooler];
    } else if (characteristicType === HC.CurrentRelativeHumidity) {
        serviceTypes = [HS.HumiditySensor, HS.Thermostat, HS.HumidifierDehumidifier];
    }
    const characteristics = [characteristicType];

    Hub.subscribeWithCondition("", "", serviceTypes, characteristics, function (sensorSource, sensorValue) {
        try {
            const service = sensorSource.getService();
            if (!service) return;

            const accessory = service.getAccessory();
            if (!accessory) return;

            const deviceKey = service.getUUID();

            // Проверяем, что это устройство из нашей комнаты
            if (variables.devicesData[deviceKey]) {
                const infoService = accessory.getService(HS.AccessoryInformation);
                if (!infoService) return;

                const onlineCharacteristic = infoService.getCharacteristic(HC.C_Online);
                if (!onlineCharacteristic) return;

                const onlineStatus = onlineCharacteristic.getValue();

                // Обновляем данные устройства
                variables.devicesData[deviceKey].value = sensorValue;
                variables.devicesData[deviceKey].online = onlineStatus;
                variables.devicesData[deviceKey].lastUpdate = Date.now();

                // Проверяем валидность данных и выводим предупреждения только для неисключенных устройств
                if (!isValidData(sensorValue, onlineStatus) && !variables.devicesData[deviceKey].excluded) {
                    if (options.debug) {
                        if (!onlineStatus) {
                            console.warn(`Устройство ${accessory.getName()} не в сети`);
                        }
                        if (sensorValue === CONSTANTS.INVALID_VALUE) {
                            console.warn(`Устройство ${accessory.getName()} передает невалидное значение: ${CONSTANTS.INVALID_VALUE}`);
                        }
                    }
                }

                // Пересчитываем среднее значение только если устройство не исключено
                if (!variables.devicesData[deviceKey].excluded) {
                    calculateAndSetAverage(source, variables, options);
                }
            }
        } catch (e) {
            console.error(`Ошибка в подписке на изменения: ${e.message}`);
        }
    });
}

function calculateAndSetAverage(source, variables, options) {
    try {
        let validValues = [];
        let totalValue = 0;
        let validCount = 0;
        let deviceDetails = []; // Детали об устройствах для отчета

        // Собираем валидные значения (исключаем исключенные устройства)
        const deviceKeys = Object.keys(variables.devicesData);
        for (let i = 0; i < deviceKeys.length; i++) {
            const deviceKey = deviceKeys[i];
            const deviceData = variables.devicesData[deviceKey];

            // Учитываем только валидные данные и не исключенные устройства
            if (isValidData(deviceData.value, deviceData.online) && !deviceData.excluded) {
                validValues.push(deviceData.value);
                totalValue += deviceData.value;
                validCount++;

                // Используем уже сохраненные данные из deviceData
                deviceDetails.push({
                    name: deviceData.deviceName,
                    serviceName: deviceData.serviceName,
                    accessoryId: deviceData.accessoryId,
                    value: deviceData.value
                });
            }
        }

        if (validCount > 0) {
            const averageValue = totalValue / validCount;

            // Проверяем на NaN и Infinity
            if (isNaN(averageValue) || !isFinite(averageValue)) {
                console.error(`Некорректное среднее значение: ${averageValue}. Данные: ${JSON.stringify(validValues)}`);
                return;
            }
            const precisionThreshold = options.precisionThreshold || CONSTANTS.DEFAULT_PRECISION_THRESHOLD;

            // Округляем значение до кратного precisionThreshold
            let roundedValue = averageValue;
            if (precisionThreshold > 0) {
                roundedValue = Math.round(averageValue / precisionThreshold) * precisionThreshold;
            }

            // Проверяем, превышает ли изменение порог точности с учетом гистерезиса
            const lastValue = variables.lastAverageValue || 0;

            // Гистерезис: "мертвая зона" для предотвращения скачков туда-сюда
            let valueChanged = false;

            // Мертвая зона: 75% от порога точности вокруг текущего установленного значения
            const hysteresisZone = precisionThreshold * CONSTANTS.HYSTERESIS_FACTOR;
            const lowerBound = lastValue - hysteresisZone;
            const upperBound = lastValue + hysteresisZone;

            if (lastValue === 0) {
                // Первое значение всегда устанавливаем
                valueChanged = true;
            } else {
                // Значение меняется, если округленное значение вышло за границы "мертвой зоны" вокруг текущего значения
                if (averageValue < lowerBound || averageValue > upperBound) {
                    valueChanged = true;
                }
            }

            const charName = getCharacteristicName(variables.characteristicType);
            const deviceList = deviceDetails.map(d => `${d.name} (${d.serviceName}, ${d.accessoryId}): ${d.value.toFixed(2)}`).join(' | ');
            const displayRoomName = variables.roomName === "__WHOLE_HOUSE__" ? "Весь дом" : variables.roomName;

            if (valueChanged) {
                source.setValue(roundedValue);
                variables.lastAverageValue = roundedValue;
                if (options.debug) {
                    console.info(`УСТАНОВЛЕНА. Средняя ${charName}: ${roundedValue.toFixed(2)} (точное: ${averageValue.toFixed(2)}) в "${displayRoomName}" - вышло из мертвой зоны [${lowerBound.toFixed(2)}-${upperBound.toFixed(2)}] вокруг ${lastValue.toFixed(2)} (из ${validCount} устройств: ${deviceList})`);
                }
            } else {
                if (options.debug) {
                    console.info(`ПРОПУСК. Средняя ${charName}: ${roundedValue.toFixed(2)} (точное: ${averageValue.toFixed(2)}) в "${displayRoomName}" - в мертвой зоне [${lowerBound.toFixed(2)}-${upperBound.toFixed(2)}] вокруг ${lastValue.toFixed(2)} (из ${validCount} устройств: ${deviceList})`);
                }
            }
        } else {
            const displayRoomName = variables.roomName === "__WHOLE_HOUSE__" ? "Весь дом" : variables.roomName;
            console.warn(`Нет валидных данных для расчета средней ${getCharacteristicName(variables.characteristicType)} в "${displayRoomName}"`);
        }
    } catch (e) {
        console.error(`Ошибка в calculateAndSetAverage: ${e.message}`);
    }
}

function getCharacteristicName(characteristicType) {
    if (characteristicType === HC.CurrentTemperature) {
        return "температуры";
    } else if (characteristicType === HC.CurrentRelativeHumidity) {
        return "влажности";
    }
    return "?";
}

function checkSensorsUpdates(variables, options) {
    try {
        const oneDayMs = CONSTANTS.ONE_DAY_MS;
        const currentTime = Date.now();
        let hasRecentUpdates = false;
        let offlineDevices = [];
        let invalidDataDevices = [];
        let removedDevices = [];

        // Проверяем, полдень ли сейчас (для вывода предупреждений)
        const now = new Date();
        const isNoon = now.getHours() === CONSTANTS.NOON_HOUR && now.getMinutes() === 0;
        const shouldShowWarnings = options.debug || isNoon;

        const deviceKeys = Object.keys(variables.devicesData);
        for (let i = 0; i < deviceKeys.length; i++) {
            const deviceKey = deviceKeys[i];
            try {
                const deviceData = variables.devicesData[deviceKey];
                if (!deviceData) return;

                const timeSinceUpdate = currentTime - deviceData.lastUpdate;

                // Проверяем существование устройства и сервиса в хабе
                const accessory = Hub.getAccessory(deviceData.accessoryId);
                if (!accessory) {
                    const deviceName = deviceData.deviceName || deviceData.accessoryId;
                    removedDevices.push(`Устройство ${deviceName} (удалено из хаба)`);
                    delete variables.devicesData[deviceKey];
                    return;
                }

                const service = accessory.getService(deviceData.serviceId);
                if (!service) {
                    const deviceName = deviceData.deviceName || deviceData.accessoryId;
                    removedDevices.push(`Сервис ${deviceName}.${deviceData.serviceId} (удален из хаба)`);
                    delete variables.devicesData[deviceKey];
                    return;
                }

                // Проверяем, что устройство все еще в той же комнате (кроме случая "Весь дом")
                if (variables.roomName !== "__WHOLE_HOUSE__") {
                    const deviceRoom = accessory.getRoom();
                    if (!deviceRoom || deviceRoom.getName() !== variables.roomName) {
                        const deviceName = deviceData.deviceName || accessory.getName();
                        removedDevices.push(`Устройство ${deviceName} (перенесено в другую комнату: ${deviceRoom ? deviceRoom.getName() : 'неизвестно'})`);
                        delete variables.devicesData[deviceKey];
                        return;
                    }
                }

                if (timeSinceUpdate < oneDayMs) {
                    hasRecentUpdates = true;
                }

                // Проверяем статус устройств и выводим предупреждения только для неисключенных устройств
                if (!deviceData.excluded) {
                    if (!deviceData.online) {
                        offlineDevices.push(deviceData.deviceName || deviceData.accessoryId);
                    }
                    if (deviceData.value === CONSTANTS.INVALID_VALUE) {
                        invalidDataDevices.push(deviceData.deviceName || deviceData.accessoryId);
                    }
                }
            } catch (e) {
                // Игнорируем ошибки для конкретного устройства
                if (options.debug) {
                    console.warn(`Ошибка при проверке устройства ${deviceKey}: ${e.message}`);
                }
                // Удаляем проблемное устройство из данных
                delete variables.devicesData[deviceKey];
            }
        }

        // Проверяем, не появились ли новые устройства в комнате
        let currentRoom = null;
        if (variables.roomName === "__WHOLE_HOUSE__") {
            currentRoom = "__WHOLE_HOUSE__";
        } else {
            const rooms = Hub.getRooms();
            for (let i = 0; i < rooms.length; i++) {
                if (rooms[i].getName() === variables.roomName) {
                    currentRoom = rooms[i];
                    break;
                }
            }
        }

        if (currentRoom) {
            const newDevices = collectDevicesData(currentRoom, variables.characteristicType, variables, options, null, true);
            if (newDevices.length > 0) {
                console.info(`Новые устройства добавлены в расчет средних значений: ${newDevices.join(', ')}`);
            }
        }

        // Выводим информацию об удаленных устройствах
        if (removedDevices.length > 0) {
            console.info(`Устройства больше не участвуют в расчете средних значений: ${removedDevices.join(', ')}`);
        }

        // Выводим предупреждения о невалидных данных только в полдень или при debug
        if (shouldShowWarnings) {
            if (offlineDevices.length > 0) {
                console.warn(`ВНИМАНИЕ: Устройства не в сети: ${offlineDevices.join(', ')}`);
            }
            if (invalidDataDevices.length > 0) {
                console.warn(`ВНИМАНИЕ: Устройства передают невалидные данные (${CONSTANTS.INVALID_VALUE}): ${invalidDataDevices.join(', ')}`);
            }
        }

        if (!hasRecentUpdates) {
            const charName = getCharacteristicName(variables.characteristicType);
            const displayRoomName = variables.roomName === "__WHOLE_HOUSE__" ? "Весь дом" : variables.roomName;
            console.error(`ВНИМАНИЕ: Нет обновлений от датчиков ${charName} в течение суток или более в "${displayRoomName}"`);
        }
    } catch (e) {
        console.error(`Ошибка в checkSensorsUpdates: ${e.message}`);
    }
}

function validateOptions(options) {
    // Валидация порога точности
    if (options.precisionThreshold === null || options.precisionThreshold === undefined || options.precisionThreshold < 0) {
        console.error("Порог точности не может быть пустым или отрицательным. Установлено значение: 0");
        options.precisionThreshold = 0;
    }

    if (options.precisionThreshold > CONSTANTS.MAX_PRECISION_THRESHOLD) {
        console.warn(`Порог точности слишком велик. Установлено максимальное значение: ${CONSTANTS.MAX_PRECISION_THRESHOLD}`);
        options.precisionThreshold = CONSTANTS.MAX_PRECISION_THRESHOLD;
    }
}

function getRoomsList() {
    let roomsList = [];
    roomsList.push({ name: { ru: "🚪 Комната устройства", en: "🚪 Device room" }, value: "" });
    roomsList.push({ name: { ru: "🏠 Весь дом", en: "🏠 Whole house" }, value: "__WHOLE_HOUSE__" });

    const rooms = Hub.getRooms();
    rooms.forEach(room => {
        roomsList.push({
            name: { ru: room.getName(), en: room.getName() },
            value: room.getName()
        });
    });

    return roomsList;
}
