let servicesList = [];

info = {
    name: "Отключение циркадного освещения",
    description: "Временно отключает циркадное освещение у выбранных ламп",
    version: "1.0",
    author: "@BOOMikru",
    onStart: false,

    sourceServices: [HS.Switch],
    sourceCharacteristics: [HC.On],

    options: {
        lamp1: {
            name: {
                en: "Lamp 1",
                ru: "Выберите лампу 1"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp1accessoryId: {
            name: {
                en: "Lamp 1 Accessory",
                ru: "   или укажите ID аксессуара лампы 1"
            },
            type: "Integer",
            value: 0,
        },
        lamp1serviceId: {
            name: {
                en: "Lamp 1 Characteristic",
                ru: "   и ID сервиса лампы 1"
            },
            type: "Integer",
            value: 0,
        },
        lamp2: {
            name: {
                en: "Lamp 2",
                ru: "Выберите лампу 2"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp2accessoryId: {
            name: {
                en: "Lamp 2 Accessory",
                ru: "   или укажите ID аксессуара лампы 2"
            },
            type: "Integer",
            value: 0,
        },
        lamp2serviceId: {
            name: {
                en: "Lamp 2 Characteristic",
                ru: "   и ID сервиса лампы 2"
            },
            type: "Integer",
            value: 0,
        },
        lamp3: {
            name: {
                en: "Lamp 3",
                ru: "Выберите лампу 3"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp3accessoryId: {
            name: {
                en: "Lamp 3 Accessory",
                ru: "   или укажите ID аксессуара лампы 3"
            },
            type: "Integer",
            value: 0,
        },
        lamp3serviceId: {
            name: {
                en: "Lamp 3 Characteristic",
                ru: "   и ID сервиса лампы 3"
            },
            type: "Integer",
            value: 0,
        },
        lamp4: {
            name: {
                en: "Lamp 4",
                ru: "Выберите лампу 4"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp4accessoryId: {
            name: {
                en: "Lamp 4 Accessory",
                ru: "   или укажите ID аксессуара лампы 4"
            },
            type: "Integer",
            value: 0,
        },
        lamp4serviceId: {
            name: {
                en: "Lamp 4 Characteristic",
                ru: "   и ID сервиса лампы 4"
            },
            type: "Integer",
            value: 0,
        },
        lamp5: {
            name: {
                en: "Lamp 5",
                ru: "Выберите лампу 5"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp5accessoryId: {
            name: {
                en: "Lamp 5 Accessory",
                ru: "   или укажите ID аксессуара лампы 5"
            },
            type: "Integer",
            value: 0,
        },
        lamp5serviceId: {
            name: {
                en: "Lamp 5 Characteristic",
                ru: "   и ID сервиса лампы 5"
            },
            type: "Integer",
            value: 0,
        },
        lamp6: {
            name: {
                en: "Lamp 6",
                ru: "Выберите лампу 6"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp6accessoryId: {
            name: {
                en: "Lamp 6 Accessory",
                ru: "   или укажите ID аксессуара лампы 6"
            },
            type: "Integer",
            value: 0,
        },
        lamp6serviceId: {
            name: {
                en: "Lamp 6 Characteristic",
                ru: "   и ID сервиса лампы 6"
            },
            type: "Integer",
            value: 0,
        },
        lamp7: {
            name: {
                en: "Lamp 7",
                ru: "Выберите лампу 7"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp7accessoryId: {
            name: {
                en: "Lamp 7 Accessory",
                ru: "   или укажите ID аксессуара лампы 7"
            },
            type: "Integer",
            value: 0,
        },
        lamp7serviceId: {
            name: {
                en: "Lamp 7 Characteristic",
                ru: "   и ID сервиса лампы 7"
            },
            type: "Integer",
            value: 0,
        },
        lamp8: {
            name: {
                en: "Lamp 8",
                ru: "Выберите лампу 8"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp8accessoryId: {
            name: {
                en: "Lamp 8 Accessory",
                ru: "   или укажите ID аксессуара лампы 8"
            },
            type: "Integer",
            value: 0,
        },
        lamp8serviceId: {
            name: {
                en: "Lamp 8 Characteristic",
                ru: "   и ID сервиса лампы 8"
            },
            type: "Integer",
            value: 0,
        },
        lamp9: {
            name: {
                en: "Lamp 9",
                ru: "Выберите лампу 9"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp9accessoryId: {
            name: {
                en: "Lamp 9 Accessory",
                ru: "   или укажите ID аксессуара лампы 9"
            },
            type: "Integer",
            value: 0,
        },
        lamp9serviceId: {
            name: {
                en: "Lamp 9 Characteristic",
                ru: "   и ID сервиса лампы 9"
            },
            type: "Integer",
            value: 0,
        },
        lamp10: {
            name: {
                en: "Lamp 10",
                ru: "Выберите лампу 10"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        lamp10accessoryId: {
            name: {
                en: "Lamp 10 Accessory",
                ru: "   или укажите ID аксессуара лампы 10"
            },
            type: "Integer",
            value: 0,
        },
        lamp10serviceId: {
            name: {
                en: "Lamp 10 Characteristic",
                ru: "   и ID сервиса лампы 10"
            },
            type: "Integer",
            value: 0,
        }
    },

    variables: {
        lampsValiablesList: undefined,

    }
};

function trigger(source, value, variables, options) {
    try {
        const lampsValiablesList = getLampsList(variables, options)
        for (let i = 0; i < lampsValiablesList.length; i++) {
            GlobalVariables[lampsValiablesList[i]] = !value
        }
    } catch (e) {
        log.error("Ошибка выполнения задачи: " + e.message);
    }
}

function getLampsList(variables, options) {
    if (variables.lampsValiablesList && variables.lampsValiablesList.length != 0) {
        return lampsValiablesList.lampsList
    }
    let lampsList = [];

    for (let i = 1; i <= 10; i++) {
        let lamp = getLamp(options, i)
        if (lamp) lampsList.push(lamp)
    }
    if (lampsList.length == 0) {
        log.error("Выберите минимум 1 лампу");
        return undefined;
    }
    let lampsValiablesList = [];
    for (let i = 0; i < lampsList.length; i++) {
        lampsValiablesList.push(global.getCircadianLightGlobalVariableForDisable(lampsList[i]))
    }

    return lampsValiablesList
}

function getLamp(options, i) {
    if (options["lamp" + i] === '' && (options["lamp" + i + "accessoryId"] <= 0 || options["lamp" + i + "serviceId"] <= 0)) {
        return undefined;
    }
    var service
    if (options["lamp" + i] != '') {
        const cdata = options["lamp" + i].split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        service = Hub.getAccessory(aid).getService(sid)
        if (service == null) {
            log.error("Выбранное устройство не найдено {}", options["lamp" + i]);
            return undefined;
        }
    } else {
        let accessory = Hub.getAccessory(options["lamp" + i + "accessoryId"])
        if (accessory == null) {
            log.error("Введённое устройство не найдено {}", options["lamp" + i + "accessoryId"]);
            return undefined;
        }
        service = accessory.getService(options["lamp" + i + "serviceId"])
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
    a.getServices(HS.Lightbulb).forEach(function (s) {
        const c = s.getCharacteristic(HC.Brightness);
        if (!c) return;
        let displayname = global.getCircadianLightServiceName(s)
        servicesListUnsort.push({
            name: { ru: displayname, en: displayname },
            value: s.getUUID()
        });
    })
});

servicesList.push({ name: { ru: "Не выбрано", en: "Not selected", en: "" }, value: '' });
servicesListUnsort.sort(function (a, b) { return a.name.ru.localeCompare(b.name.ru); }).forEach(function (s) { servicesList.push(s) })
