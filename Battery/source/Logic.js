let batteryTypes = ["AA", "AAA", "CR2032", "CR2450", "CR2025", "CR1632", "CR3032", "CR2477", "AG1", "AG3", "ER14250", "2CR5", "18650", "14500", "16340", "CR-P2", "SR44", "3LR12"];
let chargingTypes = ["USB Type-C", "Micro USB", "Mini USB", "Lightning", "5521 12V", "5525 12V", "5521 9V", "5525 9V", "Солнечная панель", "Проприетарное зарядное устройство"]

const dateRegEx = /(\d{2}-\d{2}-\d{4})/
let typesList = [];
let chargingList = [];

info = {
    name: "Отслеживание батарей",
    description: "Позволяет получать уведомления, когда батарея разрядится. в уведомлении будет вся информация, указанная в параметрах. Обновления: https://t.me/smart_sputnik",
    version: "1.0",
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
            values: typesList
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
            values: chargingList
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
    }
}

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
        const charging = service.getCharacteristic(HC.ChargingState).getValue()
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
            date: date
        }

        GlobalVariables["batteryStateScenario"][uuid] = state

        if (lowBattery && !charging) {

            let text = "❗️ Батарея разряжена! "
            text += state.name + " в " + state.room + " (ID: " + state.uuid + ") "
            if (state.placement != "") text += " " + state.placement.trim()
            text += ". Заряд: " + state.level + "%"
            if (state.batteryType != "") text += " Тип: " + state.batteryType + " (" + state.quantity + " шт.)"
            if (state.chargingType != "") text += " Заряжается через: " + state.chargingType + " "
            if (state.comment != "") text += state.comment.trim()
            text += "Дата "+  (state.chargingType != "" ? "зарядки" : "замены батареи")+": " + date.replace("-",".")

            Notify.text(text).send()

            if (global.sendToTelegram !== undefined) {
                let textArray = ["❗️ *Батарея разряжена!*"]
                textArray.push(state.name + " в " + state.room + " (ID: " + state.uuid + ")")
                if (state.placement != "") textArray.push(state.placement.trim())
                textArray.push("")
                textArray.push("Заряд: " + state.level + "%")
                if (state.batteryType != "" && state.batteryType != "-") textArray.push("Тип: " + state.batteryType + " (" + state.quantity + " шт.)")
                if (state.chargingType != "" && state.chargingType != "-") textArray.push("Заряжается через: " + state.chargingType + " ")
                textArray.push("")
                if (state.comment != "") textArray.push(state.comment.trim())
                textArray.push("Дата "+  (state.chargingType != "" ? "зарядки" : "замены батареи")+": " + date.replace("-","."))


                global.sendToTelegram(textArray);
            }

            service.setName("❗️ " + date)
        } else {
            service.setName(date)
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
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

typesList.push({ name: { ru: "Не выбрано", en: "Not selected" }, value: "" });
batteryTypes.forEach(function (b) {
    typesList.push({ name: { ru: b, en: b }, type: "String", value: b });
})
typesList.push({ name: { ru: "Другой", en: "Another" }, value: "Другой" });

chargingList.push({ name: { ru: "Не перезаряжается", en: "Not charging" }, value: "" });
chargingTypes.forEach(function (b) {
    chargingList.push({ name: { ru: b, en: b }, type: "String", value: b });
})
chargingList.push({ name: { ru: "Другой", en: "Another" }, value: "Другой вариант" });