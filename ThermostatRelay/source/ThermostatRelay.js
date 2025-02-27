let servicesList = [];

info = {
    name: "Реле для термостата",
    description: "Позволяет устанавливать реле охлаждения и нагрева для вирутального термостата",
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Thermostat],
    sourceCharacteristics: [HC.CurrentHeatingCoolingState, HC.TargetHeatingCoolingState],

    options: {
        heatingRelay: {
            name: {
                en: "Heating relay",
                ru: "Выберите реле для нагрева"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        heatingRelayAccessoryId: {
            name: {
                en: "Heating relay Accessory",
                ru: "   или укажите ID аксессуара"
            },
            type: "Integer",
            value: 0,
        },
        heatingRelayServiceId: {
            name: {
                en: "Heating relay Characteristic",
                ru: "   и ID сервиса"
            },
            type: "Integer",
            value: 0,
        },
        coolingRelay: {
            name: {
                en: "Cooling relay",
                ru: "Выберите реле для охлаждения"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        coolingRelayAccessoryId: {
            name: {
                en: "Lamp 2 Accessory",
                ru: "   или укажите ID аксессуара"
            },
            type: "Integer",
            value: 0,
        },
        coolingRelayServiceId: {
            name: {
                en: "Lamp 2 Characteristic",
                ru: "   и ID сервиса"
            },
            type: "Integer",
            value: 0,
        }
    }
};

function trigger(source, value, variables, options) {
    try {
        const heatingRelay = getDevice(options, "heatingRelay")
        const coolingRelay = getDevice(options, "coolingRelay")

        const currentState = source.getService().getCharacteristic(HC.CurrentHeatingCoolingState).getValue()
        const targetState = source.getService().getCharacteristic(HC.TargetHeatingCoolingState).getValue()

        //Выключено
        if (targetState == 0 || currentState == 0) {
            if (heatingRelay) heatingRelay.getCharacteristic(HC.On).setValue(false)
            if (coolingRelay) coolingRelay.getCharacteristic(HC.On).setValue(false)
        }
        // Нагрев
        if ((targetState == 1 || targetState == 3) && currentState == 1) {
            if (heatingRelay) heatingRelay.getCharacteristic(HC.On).setValue(true)
            if (coolingRelay) coolingRelay.getCharacteristic(HC.On).setValue(false)
        }
        // Охлаждение
        if ((targetState == 2 || targetState == 3) && currentState == 2) {
            if (heatingRelay) heatingRelay.getCharacteristic(HC.On).setValue(false)
            if (coolingRelay) coolingRelay.getCharacteristic(HC.On).setValue(true)
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}


function getDevice(options, type) {
    if (options[type] === '' && (options[type + "AccessoryId"] <= 0 || options[type + "ServiceId"] <= 0)) {
        return undefined;
    }
    var service
    if (options[type] != '') {
        const cdata = options[type].split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        service = Hub.getAccessory(aid).getService(sid)
        if (service == null) {
            log.error("Выбранное устройство не найдено {}", options[type]);
            return undefined;
        }
    } else {
        let accessory = Hub.getAccessory(options[type + "AccessoryId"])
        if (accessory == null) {
            log.error("Введённое устройство не найдено {}", options[type + "AccessoryId"]);
            return undefined;
        }
        service = accessory.getService(options[type + "ServiceId"])
        if (service == null) {
            log.error("Введённый сервис не найден у аксессуара {} {}", accessory.getName(), accessory.getUUID());
            return undefined;
        }
    }
    return service
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")"
    return name
}

let servicesListUnsort = [];
servicesListUnsort
// подготовка списка характеристик для выбора в настройке логики
Hub.getAccessories().forEach(function (a) {
    a.getServices(HS.Switch).forEach(function (s) {
        const c = s.getCharacteristic(HC.On);
        if (!c) return;
        let displayname = getDeviceName(s)
        servicesListUnsort.push({
            name: { ru: displayname, en: displayname },
            value: s.getUUID()
        });
    })
});

servicesList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: '' });
servicesListUnsort.sort(function (a, b) { return a.name.ru.localeCompare(b.name.ru); }).forEach(function (s) { servicesList.push(s) })
