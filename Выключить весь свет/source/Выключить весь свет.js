var excludeRoomsNames = ["Виртуальная"]; //ID комнат, где не надо выключать свет
var excludeAccessoriesId = [130, 188]; //ID устройств, которые не надо выключать 
var turnOffHidden = false; // Отключать скрытые
var turnOffLightDebug = false; // Активация дополнительного логгирования для отладки

function turnOffLight(excludeRooms, excludeAccessories) {
    var excRooms = []
    var excAccessories = []

    excludeRoomsNames.forEach(function fe(room) { excRooms.push(room) })
    getArrayFromValue(excludeRooms, "string").forEach(function fe(room) { excRooms.push(room) })

    excludeAccessoriesId.forEach(function fe(acc) { excAccessories.push(acc) })
    getArrayFromValue(excludeAccessories, "number").forEach(function fe(acc) { excAccessories.push(acc) })

    if (turnOffLightDebug) log.info("Exclude Rooms " + excRooms.join("- "));
    if (turnOffLightDebug) log.info("Exclude Accessories " + excAccessories.join("- "));
    const rooms = Hub.getRooms().filter(function loopRooms(room) { return excRooms.indexOf(room.getName()) < 0 });

    rooms.forEach(function loopRooms(room) {
        var accessories = room.getAccessories().filter(function loopRooms(accessory) { return excAccessories.indexOf(parseInt(accessory.getUUID())) < 0 });
        accessories.forEach(function loopAccessories(accessory) {
            var status = accessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue();
            if (accessory.getModelId() == "Sprut.hub" || status == false) return

            accessory.getServices().forEach(function loopServices(service) {
                if (service.getType() == HS.Switch || service.getType() == HS.Lightbulb) {
                    var on = service.getCharacteristic(HC.On)
                    if ((service.isVisible() || turnOffHidden) && on.getValue()) {
                        if (turnOffLightDebug) log.info("Room " + room.getName() + ". Accessory " + accessory.getName() + ". Service " + accessory.getUUID() + " " + service.getName());
                        on.setValue(false)
                    }
                }
            })
        })
    })
}

function getArrayFromValue(value, type) {
    var result = [];
    if (Array.isArray(value)) {
        result = value;
    } else if (typeof value === type) {
        result.push(value);
    }
    return result;
}