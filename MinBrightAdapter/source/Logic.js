let servicesList = [];

info = {
    name: "Адаптер минимальной яркости ламп",
    description: "Служит для конвертации минимального уровня яркости физических ламп\диммеров в 0-100 вирутальной лампы",
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Lightbulb],
    sourceCharacteristics: [HC.Brightness],

    options: {
        lamp: {
            name: {
                en: "Lamp",
                ru: "Выберите лампу/диммер"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        minBright: {
            name: {
                en: "Min brightness",
                ru: "Минимальная яркость"
            },
            desc: {
                en: "Min brightness",
                ru: "Минимальная яркость"
            },
            type: "Integer",
            value: 0,
        }
    }
};

function trigger(source, value, variables, options) {
    try {
        if (options.lamp == "") {
            console.error("Выберите реальный аксессуар лампы/диммера")
            return;
        }
        const cdata = options.lamp.split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        service = Hub.getAccessory(aid).getService(sid)
        if (source.getType() == HC.Brightness) {
            let newValue
            if (value > 0) {
                let range = 100 - options.minBright
                let percent = range / 100.0
                newValue = options.minBright + Math.round(value * percent)
            } else {
                newValue = 0
            }
            service.getCharacteristic(HC.Brightness).setValue(newValue)
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыта" : "")
    return name
}

let servicesListUnsort = [];
// подготовка списка характеристик для выбора в настройке логики
Hub.getAccessories().forEach(function (a) {
    a.getServices().filter(function (s) { return s.getType() == HS.Lightbulb }).forEach(function (s) {
        const c = s.getCharacteristic(HC.Brightness);
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