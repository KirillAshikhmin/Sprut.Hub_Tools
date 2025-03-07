const blackListAccessories = [];
const whiteListAccessories = [];

function getBatteriesInfo(fullInfo, blackList, whiteList) {

    let states = GlobalVariables["batteryStateScenario"]
    if (!states) GlobalVariables["batteryStateScenario"] = []

    let black = blackListAccessories
    let white = whiteListAccessories
    if (Array.isArray(blackList)) { blackList.forEach(function (i) { black.push(i) }) } else if (blackList != undefined && blackList.length > 0) black.push(blackList)
    if (Array.isArray(whiteList)) { whiteList.forEach(function (i) { white.push(i) }) } else if (whiteList != undefined && whiteList.length > 0) white.push(whiteList)

    let withLowBattery = []
    let normalBattery = []
    let withoutLogic = []
    let batteries = {};
    Hub.getAccessories().forEach(function (accessory) {
        const uuid = accessory.getUUID()
        if (white.length > 0 && white.indexOf(uuid) < 0) return
        if (black.indexOf(uuid) >= 0) return
        let service = accessory.getService(HS.BatteryService)
        if (service == null) return
        let state = GlobalVariables["batteryStateScenario"][uuid]
        if (state == undefined) {
            const level = service.getCharacteristic(HC.BatteryLevel).getValue()
            const charging = service.getCharacteristic(HC.ChargingState).getValue() == 1
            const lowBattery = service.getCharacteristic(HC.StatusLowBattery).getValue()

            state = {
                uuid: uuid,
                name: accessory.getName(),
                room: accessory.getRoom().getName(),
                manufacturer: accessory.getManufacturer(),
                model: accessory.getModel(),
                level: level,
                lowBattery: lowBattery,
                charging: charging,
                logicEnabled: false
            }
        } else {
            state.logicEnabled = true
        }

        if (state.lowBattery) withLowBattery.push(state)
        else normalBattery.push(state)
        if (state.logicEnabled != true) withoutLogic.push(state)
        if (state.lowBattery && state.batteryType != undefined && state.batteryType != "") {
            let count = batteries[state.batteryType]
            if (count == undefined) count = state.quantity
            else count += state.quantity
            batteries[state.batteryType] = count
        }

    })
    GlobalVariables.batteriesForChange = batteries

    withLowBattery = withLowBattery.sort(function (a, b) { return a.room.localeCompare(b.room); })
    normalBattery = normalBattery.sort(function (a, b) { return a.room.localeCompare(b.room); })
    withoutLogic = withoutLogic.sort(function (a, b) { return a.room.localeCompare(b.room); })

    let hasWithLowBattery = withLowBattery.length > 0
    if (global.sendToTelegram !== undefined) {
        let textArray = ["*🔋 Состояние батарей:*"]
        if (hasWithLowBattery > 0) {
            textArray.push("❗️ *Разряжены:*")
            withLowBattery.forEach(function (state) {
                formatStateToTg(textArray, state)
            })

            let batKeys = Object.keys(batteries)
            if (batKeys.length > 0) {
                textArray.push("🔋  *Необходимо для замены:*")
                batKeys.forEach(function (type) {
                    textArray.push(type + " " + batteries[type] + " шт.")
                })
            }
        } else {
            if (!fullInfo) textArray.push("Все батареи заряжены")
        }
        if (fullInfo) {
            if (normalBattery.length > 0 && withoutLogic.length > 0 && hasWithLowBattery) {
                textArray.push("")
                textArray.push("####################################")
                textArray.push("")
            }
            if (normalBattery.length > 0) {
                textArray.push("👌 *В норме:*")
                normalBattery.forEach(function (state) {
                    formatStateToTg(textArray, state, true)
                })
            }

            if (withoutLogic.length > 0) {
                textArray.push("")
                textArray.push("🫵 *Устройства без активированной логики:*")
                withoutLogic.forEach(function (state) {
                    formatStateToTg(textArray, state, true, true)
                })
            }
        }
        global.sendToTelegram(textArray);
    }
    {
        let text = ""
        if (withLowBattery.length > 0) {

            text += "🔋❗️ Разряжённые батареи: "
            withLowBattery.forEach(function (state) {
                text += formatStateToInfo(state)
            })

            let batKeys = Object.keys(batteries)
            if (batKeys.length > 0) {
                text += "🔋 Необходимо для замены: "
                batKeys.forEach(function (type) {
                    text += type + " " + batteries[type] + " шт. "
                })
            }
        }
        if (text == "") text = "Все батареи заряжены"
        Notify.text(text).send()
    }
}

function formatStateToInfo(state) {
    return state.room + " -> " + state.name +
        (state.placement != "" && state.placement != undefined ? ". " + state.placement.trim() : "") + " (ID: " + state.uuid + ")" +
        " " + state.level + "% | "
}

function formatStateToTg(textArray, state, compact, noShowLevel) {
    if (compact == true) {
        textArray.push(
            state.room + " -> " + state.name +
            (state.placement != "" && state.placement != undefined ? ". " + state.placement.trim() : "") + " (ID: " + state.uuid + ")" +
            (!noShowLevel ? (" *" + state.level + "%*") : "")
        )
    } else {
        textArray.push(state.room + " -> " + state.name + " (ID: " + state.uuid + ")")
        if (state.placement != undefined && state.placement != "") textArray.push(state.placement.trim())
        textArray.push("Заряд: " + state.level + "%")
        if (state.batteryType != undefined && state.batteryType != "" && state.batteryType != "-") textArray.push("Тип: " + state.batteryType + " (" + state.quantity + " шт.)")
        if (state.chargingType != undefined && state.chargingType != "" && state.chargingType != "-") textArray.push("Заряжается через: " + state.chargingType + " ")
        if (state.comment != undefined && state.comment != "") textArray.push(state.comment.trim())
        if (state.date != undefined) textArray.push("Дата " + (state.chargingType != "" ? "зарядки" : "замены батареи") + ": " + state.date.replaceAll("-", "."))
        if (state.logicEnabled != true) textArray.push("Логика не активирована")
        textArray.push("")
    }
}