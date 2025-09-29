let servicesList = getServicesByServiceAndCharacteristicType([HS.Switch, HS.Outlet], HC.On);

info = {
    name: "🪟 Виртуальное окно/штора",
    description: "Позволяет реализовать логику управления окном или шторой с двунаправленным мотором, используя два реле для открытия и закрытия",
    version: "1.0",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Window, HS.WindowCovering],
    sourceCharacteristics: [HC.PositionState],

    options: {
        openRelay: {
            name: {
                en: "Open relay",
                ru: "Реле открытия"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        closeRelay: {
            name: {
                en: "Close relay",
                ru: "Реле закрытия"
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        delayMs: {
            name: {
                en: "Delay between switching (ms)",
                ru: "Задержка между переключениями (мс)"
            },
            type: "Integer",
            value: 100,
            minValue: 0,
            maxValue: 1000,
            step: 10,
            desc: {
                en: "Delay between turning off one relay and turning on another. If your relay has interlock protection, you can set 0",
                ru: "Задержка между выключением одного реле и включением другого. Если у используемого реле есть интерлок, то можно установить 0"
            }
        }
    }
};

// Вывод в лог информационные сообщения о работе сценария
let debug = false

function trigger(source, value, variables, options) {
    try {
        const openRelay = getDevice(options, "openRelay")
        const closeRelay = getDevice(options, "closeRelay")
        const delayMs = options.delayMs || 100

        if (!openRelay && !closeRelay) {
            logError("Не выбрано ни одного реле для управления", source)
            return
        }

        const positionState = source.getValue()
        
        logInfo(`Состояние позиции изменено: ${getPositionStateName(positionState)}`, source, debug)

        // Обработка состояний позиции
        switch (positionState) {
            case 0: // Закрывается
                switchToRelay(openRelay, closeRelay, delayMs, source, "закрытия")
                break
            case 1: // Открывается
                switchToRelay(closeRelay, openRelay, delayMs, source, "открытия")
                break
            case 2: // Остановлено
                stopAllRelays(openRelay, closeRelay, source)
                break
            default:
                logWarn(`Неизвестное состояние позиции: ${positionState}`, source)
                stopAllRelays(openRelay, closeRelay, source)
        }

    } catch (e) {
        logError("Ошибка выполнения задачи: " + e.message);
    }
}

function switchToRelay(currentRelay, targetRelay, delayMs, source, action) {
    try {
        // Сначала выключаем текущее реле (если оно включено)
        if (currentRelay && currentRelay.getCharacteristic(HC.On).getValue()) {
            currentRelay.getCharacteristic(HC.On).setValue(false)
            logInfo(`Выключено реле ${getDeviceName(currentRelay)}`, source, debug)
            
            // Через указанную задержку включаем целевое реле
            if (targetRelay) {
                setTimeout(() => {
                    targetRelay.getCharacteristic(HC.On).setValue(true)
                    logInfo(`Включено реле ${action}: ${getDeviceName(targetRelay)}`, source, debug)
                }, delayMs)
            }
        } else {
            // Если текущее реле не было включено, сразу включаем целевое
            if (targetRelay) {
                targetRelay.getCharacteristic(HC.On).setValue(true)
                logInfo(`Включено реле ${action}: ${getDeviceName(targetRelay)}`, source, debug)
            }
        }
    } catch (e) {
        logError(`Ошибка переключения реле: ${e.message}`, source)
    }
}

function stopAllRelays(openRelay, closeRelay, source) {
    try {
        if (openRelay && openRelay.getCharacteristic(HC.On).getValue()) {
            openRelay.getCharacteristic(HC.On).setValue(false)
            logInfo(`Выключено реле открытия: ${getDeviceName(openRelay)}`, source, debug)
        }
        
        if (closeRelay && closeRelay.getCharacteristic(HC.On).getValue()) {
            closeRelay.getCharacteristic(HC.On).setValue(false)
            logInfo(`Выключено реле закрытия: ${getDeviceName(closeRelay)}`, source, debug)
        }
    } catch (e) {
        logError(`Ошибка остановки реле: ${e.message}`, source)
    }
}

function getPositionStateName(state) {
    switch (state) {
        case 0: return "Закрывается"
        case 1: return "Открывается"
        case 2: return "Остановлено"
        default: return `Неизвестно (${state})`
    }
}

function getDevice(options, name) {
    if (options[name] === '') { return undefined; }
    var service
    if (options[name] != '') {
        const cdata = options[name].split('.');
        const aid = cdata[0];
        const sid = cdata[1];
        service = Hub.getAccessory(aid).getService(sid)
        if (service == null) {
            logError("Выбранное устройство не найдено {}", options[name]);
            return undefined;
        } else {
            return service
        }
    }
    return undefined
}

function logInfo(text, source, show) {
    if (show) console.info(getLogText(text, source));
}
function logWarn(text, source) {
    console.warn(getLogText(text, source));
}
function logError(text, source) {
    console.error(getLogText(text, source));
}
function getLogText(text, source) {
    return `${text} | ${DEBUG_TITLE} ${getDeviceName(source.getService())}`
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = service.getAccessory().getName()
    const sName = service.getName()
    const name = room + " -> " + (accName == sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыт" : "")
    return name
}

// подготовка списка характеристик для выбора в настройке логики
function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicType) {
    let sortedServicesList = []
    let unsortedServicesList = []
    Hub.getAccessories().forEach((a) => {
        a.getServices().filter((s) => serviceTypes.indexOf(s.getType()) >= 0).forEach((s) => {
            const c = s.getCharacteristic(characteristicType);
            if (c) {
                let displayname = getDeviceName(s)
                unsortedServicesList.push({
                    name: { ru: displayname, en: displayname },
                    value: s.getUUID()
                });
            }
        })
    });
    sortedServicesList.push({ name: { ru: "Не выбрано", en: "Not selected" }, value: '' })
    unsortedServicesList.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach((s) => sortedServicesList.push(s))
    return sortedServicesList
}

// Константа для отладки
const DEBUG_TITLE = "Виртуальное окно/штора: ";
