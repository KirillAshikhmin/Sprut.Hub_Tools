// Типы батарей
let batteryTypes = ["AA", "AAA", "CR2032", "CR2450", "CR2025", "CR1632", "CR3032", "CR2477", "AG1", "AG3", "ER14250", "2CR5", "18650", "14500", "16340", "CR-P2", "SR44", "3LR12", "CR17450"];
// Типы зарядки
let chargingTypes = ["USB Type-C", "Micro USB", "Mini USB", "Lightning", "5521 12V", "5525 12V", "5521 9V", "5525 9V", "Солнечная панель", "Проприетарное зарядное устройство"]

// Заполните ниже параметры уведомлений по умолчанию, для того, что бы не указывать их в параметрах для каждого устройства
const DEFAULT_NOTIFICATION_CHANNEL = "Telegram_1"; // Канал уведомлений для отправки уведомлений (например, Telegram_1, Web_1), или пустое поле, что бы уведомления отправлялись по всем каналам
const DEFAULT_NOTIFICATION_CLIENTS = "1"; // Клиенты уведомлений которым будут приходить уведомления (например, 1, 3, 4)
const DEFAULT_SILENT_NOTIFICATION = false; // Использовать тихое уведомление. true - тихие, false - со звуком

info = {
    name: "🔋 Мониторинг батареек",
    description: "Позволяет получать уведомления, когда батарея разрядится. в уведомлении будет вся информация, указанная в параметрах. Обновления: https://t.me/smart_sputnik",
    version: "2.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.BatteryService],
    sourceCharacteristics: [HC.StatusLowBattery, HC.BatteryLevel, HC.ChargingState],

    options: {
        type: {
            name: {
                en: "Battery type",
                ru: "Тип батареи"
            },
            type: "String",
            value: "",
            formType: "list",
            values: getBatteryTypesList()
        },
        quantity: {
            name: {
                en: "Quantity",
                ru: "Количество батарей"
            },
            type: "Integer",
            value: 1
        },
        chargingType: {
            name: {
                en: "Charging type",
                ru: "Тип зарядки"
            },
            type: "String",
            value: "",
            formType: "list",
            values: getChargingTypesList()
        },
        placement: {
            name: {
                en: "Placement",
                ru: "Расположение"
            },
            type: "String",
            value: "",
        },
        comment: {
            name: {
                en: "Comment",
                ru: "Комментарий"
            },
            type: "String",
            value: "",
        },
        specificThreshold: {
            name: {
                en: "Specific threshold",
                ru: "Собственный минимальный уровень заряда"
            },
            desc: {
                en: "Or use BatteryLevel characteristic",
                ru: "Или будет использовано стандартное значение из характеристики Батарея разряжена"
            },
            type: "Boolean",
            value: false
        },
        threshold: {
            name: {
                en: "Threshold",
                ru: "Минимальный заряд для уведомлений"
            },
            type: "Integer",
            value: 20,
            unit: "%"
        },
        changeName: {
            name: {
                en: "Change name to date",
                ru: "Менять имя сервиса на дату замены батареи"
            },
            desc: {
                en: "No replacement date, if disable",
                ru: "Если отключено, то дата замены батареи\зарядки не будет сохраняться и отображаться"
            },
            type: "Boolean",
            value: true
        },
        notificationChannel: {
            name: {
                en: "Notification channel",
                ru: "Канал уведомлений"
            },
            desc: {
                en: "Channel identifier for notifications (e.g., Telegram_1, Web_1), or empty field, to send notifications to all channels",
                ru: "Идентификатор канала уведомлений (например, Telegram_1, Web_1), или пустое поле, что бы уведомления отправлялись по всем каналам"
            },
            type: "String",
            value: DEFAULT_NOTIFICATION_CHANNEL
        },
        notificationClients: {
            name: {
                en: "Notification clients",
                ru: "Клиенты уведомлений"
            },
            desc: {
                en: "Client identifiers separated by commas (e.g., 1, 3, 4)",
                ru: "Идентификаторы клиентов через запятую (например, 1, 3, 4)"
            },
            type: "String",
            value: DEFAULT_NOTIFICATION_CLIENTS
        },
        silentNotification: {
            name: {
                en: "Silent notification",
                ru: "Тихое уведомление"
            },
            desc: {
                en: "Send notification without sound",
                ru: "Отправлять уведомление без звука"
            },
            type: "Boolean",
            value: DEFAULT_SILENT_NOTIFICATION
        },
    },
    variables: {
        notificationSend: false
    }
}

const dateRegEx = /(\d{2}-\d{2}-\d{4})/
function trigger(source, value, variables, options) {
    try {
        if (options.specificThreshold && (options.threshold < 0 || options.threshold > 100)) {
            log.error("Минимальный заряд должен быть в диапазоне от 0 до 100%")
            return
        }

        const service = source.getService()
        const accessory = source.getAccessory()
        const uuid = accessory.getUUID()
        const quantity = options.quantity == undefined ? 1 : options.quantity
        const level = service.getCharacteristic(HC.BatteryLevel).getValue()
        const charging = service.getCharacteristic(HC.ChargingState).getValue() == 1
        let lowBattery = false
        if (options.specificThreshold) {
            lowBattery = level <= options.threshold
        } else {
            lowBattery = service.getCharacteristic(HC.StatusLowBattery).getValue()
        }

        let states = GlobalVariables["batteryStateScenario"]
        if (!states) GlobalVariables["batteryStateScenario"] = []
        let lastState = states ? GlobalVariables["batteryStateScenario"][uuid] : undefined

        let name = service.getName()
        var hasDate = dateRegEx.exec(name)
        let date = hasDate != null ? hasDate[0] : getCurrentDateString()

        if (hasDate && lastState) {
            if (level == 100 && lastState.level < 100) date = getCurrentDateString()
            if (!charging && lastState.charging) date = getCurrentDateString()
        }

        const state = {
            uuid: uuid,
            name: accessory.getName(),
            room: accessory.getRoom().getName(),
            manufacturer: accessory.getManufacturer(),
            model: accessory.getModel(),
            level: level,
            lowBattery: lowBattery,
            charging: charging,
            batteryType: options.type,
            quantity: quantity,
            chargingType: options.chargingType,
            placement: options.placement,
            comment: options.comment,
            date: options.changeName ? date : undefined,
            logicEnabled: true,
            changeName: options.changeName
        }

        GlobalVariables["batteryStateScenario"][uuid] = state


        if (lowBattery && !charging) {

            if (!variables.notificationSend) {
                variables.notificationSend = true
                
                // Формируем сообщение в зависимости от канала
                let message = formatNotificationMessage(state, date, options.notificationChannel)
                
                // Преобразуем строку клиентов в массив
                let clientsArray = []
                if (options.notificationClients && options.notificationClients.trim() !== "") {
                    clientsArray = options.notificationClients.split(',').map(client => client.trim()).filter(client => client !== "")
                }
                
                // Отправляем уведомление через новую функцию
                sendNotification(
                    message,
                    options.notificationChannel,
                    clientsArray,
                    options.silentNotification
                )
            }

            if (options.changeName) service.setName("❗️ " + date)
        }

        if (!lowBattery && !charging) {
            if (options.changeName) service.setName(date)
            variables.notificationSend = false
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}

/**
 * Функция для форматирования сообщения в зависимости от канала
 * @param {Object} state - Объект состояния батареи
 * @param {String} date - Дата замены/зарядки
 * @param {String} channel - Канал уведомлений
 * @returns {String} Отформатированное сообщение
 */
function formatNotificationMessage(state, date, channel) {
    if (channel && channel.startsWith("Telegram")) {
        // Форматирование для Telegram - сразу строка
        let text = "❗️ *Батарея разряжена!*\n"
        text += state.name + " в " + state.room + " (ID: " + state.uuid + ")\n"
        if (state.placement != "") text += state.placement.trim() + "\n"
        text += "\n"
        text += "Заряд: " + state.level + "%\n"
        if (state.batteryType != "" && state.batteryType != "-") text += "Тип: " + state.batteryType + " (" + state.quantity + " шт.)\n"
        if (state.chargingType != "" && state.chargingType != "-") text += "Заряжается через: " + state.chargingType + " \n"
        text += "\n"
        if (state.comment != "") text += state.comment.trim() + "\n"
        text += "Дата " + (state.chargingType != "" ? "зарядки" : "замены батареи") + ": " + date.replaceAll("-", ".")
        
        return text
    } else {
        // Форматирование для других каналов
        let text = "❗️ Батарея разряжена! "
        text += state.name + " в " + state.room + " (ID: " + state.uuid + ") "
        if (state.placement != "") text += " " + state.placement.trim()
        text += ". Заряд: " + state.level + "%"
        if (state.batteryType != "") text += " Тип: " + state.batteryType + " (" + state.quantity + " шт.)"
        if (state.chargingType != "") text += " Заряжается через: " + state.chargingType + " "
        if (state.comment != "") text += state.comment.trim()
        text += "Дата " + (state.chargingType != "" ? "зарядки" : "замены батареи") + ": " + date.replaceAll("-", ".")
        
        return text
    }
}

/**
 * Функция для отправки уведомлений через Notify
 * @param {String} message - Текст сообщения для отправки
 * @param {String} channel - Канал уведомлений (например, "Telegram_1", "Web_1")
 * @param {Array} clients - Массив идентификаторов клиентов
 * @param {Boolean} silent - Флаг тихого режима
 */
function sendNotification(message, channel, clients, silent) {
    try {
        // Проверяем, что если заданы клиенты, то должен быть задан канал
        if (clients && clients.length > 0 && (!channel || channel.trim() === "")) {
            log.error("BatteryMonitoring: Заданы клиенты, но не указан канал уведомлений")
            return
        }

        // Создаем объект уведомления
        let notify = Notify.text(message)
            .debugText("BatteryMonitoring")

        // Устанавливаем тихий режим если нужно
        if (silent) {
            notify = notify.silent(true)
        }

        // Если заданы и канал, и клиенты, то настраиваем адресатов
        if (channel && channel.trim() !== "" && clients && clients.length > 0) {
            // Применяем клиентов по одному, так как spread operator не поддерживается
            clients.forEach(function(client) {
                notify = notify.to(channel, client)
            })
        }

        // Отправляем уведомление
        notify.send()
    } catch (e) {
        log.error("BatteryMonitoring: Ошибка отправки уведомления: " + e.message)
    }
}

function getDeviceName(source) {
    const acc = source.getAccessory();
    const room = acc.getRoom().getName()
    const accName = acc.getName()
    const name = accName + " / " + acc.getUUID() + " (" + room + ")"
    return name
}

// Функция для добавления ведущего нуля, если число меньше 10
function padNumber(num) {
    return num < 10 ? "0" + num : num.toString();
}

function getCurrentDateString() {
    var currentDate = new Date();
    var formattedDate =
        padNumber(currentDate.getDate()) + "-" +
        padNumber(currentDate.getMonth() + 1) + "-" +
        currentDate.getFullYear(); // Формат: дд-мм-гггг
    return formattedDate
}

/**
 * Функция для получения списка типов батарей
 * @returns {Array} Массив объектов с типами батарей для формы
 */
function getBatteryTypesList() {
    let typesList = [];
    typesList.push({ name: { ru: "Не выбрано", en: "Not selected" }, value: "" });
    batteryTypes.forEach(function (b) {
        typesList.push({ name: { ru: b, en: b }, type: "String", value: b });
    })
    typesList.push({ name: { ru: "Другой", en: "Another" }, value: "Другой" });
    return typesList;
}

/**
 * Функция для получения списка типов зарядки
 * @returns {Array} Массив объектов с типами зарядки для формы
 */
function getChargingTypesList() {
    let chargingList = [];
    chargingList.push({ name: { ru: "Не перезаряжается", en: "Not charging" }, value: "" });
    chargingTypes.forEach(function (b) {
        chargingList.push({ name: { ru: b, en: b }, type: "String", value: b });
    })
    chargingList.push({ name: { ru: "Другой", en: "Another" }, value: "Другой вариант" });
    return chargingList;
}