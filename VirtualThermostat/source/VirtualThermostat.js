let servicesList = getServicesByServiceAndCharacteristicType([HS.Switch, HS.Outlet], [HC.On]);
let sensorsServicesList = getServicesByServiceAndCharacteristicType([HS.TemperatureSensor, HS.Thermostat], [HC.CurrentTemperature]);

// Выносим описание в переменную для использования в info и options
let scenarioDescription = {
    ru: "Позволяет реализовать логику виртуального термостата, указав датчик температуры и реле для нагрева или охлаждения. Сценарий получает и устанавливает температуру в помещении, а также включает и отключает реле нагрева и охлаждения в зависимости от текущей и целевой температуры. Поддерживает целевые режимы: Нагрев, Охлаждение, Автоматический и Выключен. Автоматически управляет скоростью вентилятора (если доступна характеристика C_FanSpeed) на основе разницы между текущей и целевой температурой.",
    en: "Allows you to implement virtual thermostat logic by specifying a temperature sensor and relays for heating or cooling. The scenario receives and sets the temperature in the room, and also turns heating and cooling relays on and off depending on the current and target temperatures. Supports target modes: Heating, Cooling, Automatic and Off. Automatically controls fan speed (if C_FanSpeed characteristic is available) based on the difference between current and target temperature."
};

info = {
    name: "🌡️ Виртуальный термостат",
    description: scenarioDescription.ru,
    version: "3.1",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [HS.Thermostat],
    sourceCharacteristics: [HC.CurrentHeatingCoolingState, HC.TargetHeatingCoolingState, HC.CurrentTemperature, HC.TargetTemperature, HC.HeatingThresholdTemperature, HC.CoolingThresholdTemperature, HC.C_FanSpeed],

    options: {
        desc: {
            name: {
                en: "  DESCRIPTION",
                ru: "  ОПИСАНИЕ"
            },
            desc: scenarioDescription,
            type: "String",
            value: "",
            formType: "status"
        },
        sensor: {
            name: {
                en: "Temperature sensor",
                ru: "Датчик температуры"
            },
            desc: {
                ru: "Выберите датчик температуры, по которому будет работать термостат. Значение температуры с датчика будет использоваться как текущая температура.",
                en: "Select the temperature sensor that the thermostat will use. The temperature value from the sensor will be used as the current temperature."
            },
            type: "String",
            value: "",
            formType: "list",
            values: sensorsServicesList
        },
        heatingRelay: {
            name: {
                en: "Heating relay",
                ru: "Реле нагрева"
            },
            desc: {
                ru: "Выберите реле или выключатель для управления нагревом. Реле будет включаться, когда термостат перейдет в режим нагрева.",
                en: "Select a relay or switch to control heating. The relay will turn on when the thermostat switches to heating mode."
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        heatingRelayInvert: {
            name: {
                en: "    Invert heating relay",
                ru: "    Инвертировать реле нагрева"
            },
            desc: {
                ru: "Инвертирует управление реле нагрева. При включении нагрева реле отключается, при отключении нагрева — включается. Полезно для нормально-замкнутой проводки (например, сервопривод отопления, который открыт при отсутствии напряжения). Инверсия применяется на физическом уровне ко всем режимам, включая поведение при отказе датчика и при отключении термостата.",
                en: "Inverts the heating relay control. When heating turns on the relay turns off, when heating turns off the relay turns on. Useful for normally-closed wiring (for example a heating servo that is open with no power). The inversion is applied at the physical level to all modes, including the sensor failure and thermostat off behaviors."
            },
            type: "Boolean",
            value: false
        },
        coolingRelay: {
            name: {
                en: "Cooling relay",
                ru: "Реле охлаждения"
            },
            desc: {
                ru: "Выберите реле или выключатель для управления охлаждением. Реле будет включаться, когда термостат перейдет в режим охлаждения.",
                en: "Select a relay or switch to control cooling. The relay will turn on when the thermostat switches to cooling mode."
            },
            type: "String",
            value: "",
            formType: "list",
            values: servicesList
        },
        coolingRelayInvert: {
            name: {
                en: "    Invert cooling relay",
                ru: "    Инвертировать реле охлаждения"
            },
            desc: {
                ru: "Инвертирует управление реле охлаждения. При включении охлаждения реле отключается, при отключении охлаждения — включается.",
                en: "Inverts the cooling relay control. When cooling turns on the relay turns off, when cooling turns off the relay turns on."
            },
            type: "Boolean",
            value: false
        },
        thermostatLogic: {
            name: {
                en: "  THERMOSTAT LOGIC",
                ru: "  ЛОГИКА ТЕРМОСТАТА"
            },
            type: "String",
            value: "",
            formType: "status"
        },
        emulateThermostat: {
            name: {
                en: "Emulate plain thermostat",
                ru: "Эмуляция обычного термостата"
            },
            desc: {
                ru: "Если включено, сценарий сам вычисляет Текущий режим термостата (нагревает / охлаждает / выключен) на основе Целевого режима, текущей и целевой температур (для режима Автоматически — Порогов нагрева/охлаждения). В этом случае базовый сценарий 'Обычный термостат' можно не подключать. Целевая влажность не поддерживается.",
                en: "If enabled, the scenario calculates the Current heating/cooling state (heating / cooling / off) itself based on Target state, current and target temperatures (for Auto mode — Heating/Cooling Threshold). In this case the built-in 'Plain thermostat' scenario does not need to be connected. Target humidity is not supported."
            },
            type: "Boolean",
            value: false
        },
        hysteresis: {
            name: {
                en: "Hysteresis (°C)",
                ru: "Гистерезис (°C)"
            },
            desc: {
                ru: "Зона нечувствительности при эмуляции термостата. Нагрев включается, когда температура ниже целевой на гистерезис, и выключается, когда выше целевой на гистерезис. Охлаждение — симметрично. По умолчанию 0.5 °C.",
                en: "Deadband used by the thermostat emulation. Heating turns on when temperature is below target by the hysteresis value and turns off when above target by the same value. Cooling — symmetrically. Default 0.5 °C."
            },
            type: "Double",
            value: 0.5,
            minValue: 0.0,
            maxValue: 5.0,
            minStep: 0.1
        },
        off: {
            name: {
                en: "  THERMOSTAT OFF",
                ru: "  ОТКЛЮЧЕНИЕ ТЕРМОСТАТА"
            },
            type: "String",
            value: "",
            formType: "status"
        },
        offBehavior: {
            name: {
                en: "Thermostat off behavior",
                ru: "Поведение при отключении термостата"
            },
            desc: {
                ru: "Что делать с реле при отключении термостата — когда он не греет и не охлаждает (Целевой режим Выключено, Вентилятор или Осушитель).\nПоведение применяется ОДИН РАЗ при переходе в отключённое состояние. Пока термостат отключён, сценарий больше не управляет этими реле — ими можно управлять вручную или другой логикой. При возврате в активный режим (Нагрев/Охлаждение/Авто) обычное управление реле восстанавливается.\n• 'Отключить все реле' — оба реле физически выключаются (без учёта инверсии). По умолчанию.\n• 'Включить все реле' — оба реле физически включаются (без учёта инверсии).\n• 'Нагрев' — реле нагрева включается, охлаждения выключается (с учётом инверсии).\n• 'Охлаждение' — реле охлаждения включается, нагрева выключается (с учётом инверсии).",
                en: "What to do with the relays when the thermostat turns off — when it is neither heating nor cooling (Target state Off, Fan or Dry).\nThe behavior is applied ONCE when entering the off state. While the thermostat is off the scenario no longer controls these relays — they can be controlled manually or by other logic. When returning to an active mode (Heat/Cool/Auto) normal relay control is restored.\n• 'Turn off all relays' — both relays are physically turned off (inversion ignored). Default.\n• 'Turn on all relays' — both relays are physically turned on (inversion ignored).\n• 'Heat' — heating relay on, cooling relay off (inversion applied).\n• 'Cool' — cooling relay on, heating relay off (inversion applied)."
            },
            type: "Integer",
            value: 0,
            formType: "list",
            values: [
                { value: 0, name: { en: "Turn off all relays", ru: "Отключить все реле" } },
                { value: 1, name: { en: "Turn on all relays", ru: "Включить все реле" } },
                { value: 2, name: { en: "Heat", ru: "Нагрев" } },
                { value: 3, name: { en: "Cool", ru: "Охлаждение" } }
            ]
        },
        failure: {
            name: {
                en: "  SENSOR FAILURE",
                ru: "  ОТКАЗ ДАТЧИКА"
            },
            type: "String",
            value: "",
            formType: "status"
        },
        failureBehavior: {
            name: {
                en: "Sensor failure behavior",
                ru: "Поведение при отказе датчика температуры"
            },
            desc: {
                ru: "Что делать с реле и термостатом, если от датчика температуры не поступали данные дольше заданного времени.\n• 'Отключить все' — перевести термостат в режим Выключен (Целевой режим = 0) и отключить оба реле.\n• 'Нагрев' — Целевой режим не меняется, включается только реле нагрева.\n• 'Охлаждение' — Целевой режим не меняется, включается только реле охлаждения.\n• 'Ничего не делать' — состояние термостата и реле не трогается.\n• 'Включить все' — Целевой режим не меняется, включаются оба реле.\nИнверсия реле (если включена) применяется поверх выбранного поведения. После восстановления данных с датчика управление реле возвращается в обычный режим.",
                en: "What to do with the relay and thermostat if no data has been received from the temperature sensor for longer than the specified time.\n• 'Turn off all' — switch thermostat to Off (Target state = 0) and turn off both relays.\n• 'Heat' — Target state is not changed, only the heating relay is turned on.\n• 'Cool' — Target state is not changed, only the cooling relay is turned on.\n• 'Do nothing' — thermostat and relay state are not touched.\n• 'Turn on all' — Target state is not changed, both relays are turned on.\nRelay inversion (if enabled) is applied on top of the selected behavior. After sensor data is restored, relay control returns to normal mode."
            },
            type: "Integer",
            value: 0,
            formType: "list",
            values: [
                { value: 0, name: { en: "Turn off all", ru: "Отключить все" } },
                { value: 1, name: { en: "Heat", ru: "Нагрев" } },
                { value: 2, name: { en: "Cool", ru: "Охлаждение" } },
                { value: 3, name: { en: "Do nothing", ru: "Ничего не делать" } },
                { value: 4, name: { en: "Turn on all", ru: "Включить все" } }
            ]
        },
        failureTimeout: {
            name: {
                en: "Failure timeout (minutes)",
                ru: "Время до отказа (минуты)"
            },
            desc: {
                ru: "Через сколько минут отсутствия данных с датчика температуры считать его отказавшим. Кратно 15 минутам, минимум 15. По умолчанию 240 (4 часа). Проверка выполняется каждые 15 минут.",
                en: "After how many minutes without data from the temperature sensor consider it failed. Multiple of 15, minimum 15. Default 240 (4 hours). Check is performed every 15 minutes."
            },
            type: "Integer",
            value: 240,
            minValue: 15,
            maxValue: 10080,
            minStep: 15
        },
        fan: {
            name: {
                en: "  FAN",
                ru: "  ВЕНТИЛЯТОР"
            },
            type: "String",
            value: "",
            formType: "status"
        },
        fanTempStep: {
            name: {
                en: "Temperature difference for fan",
                ru: "Разница температур для вентилятора"
            },
            desc: {
                ru: "Шаг разницы температур для изменения скорости вентилятора в градусах Цельсия. При разнице от 0 до установленного шага (например 0.5) - скорость 1 (Тихо), от шага (0.5) до 2×шага (1) - скорость 2 (Медленно) и так далее. Управление вентилятором работает только если термостат поддерживает характеристику Скорость вентилятора (C_FanSpeed).",
                en: "Temperature difference step for changing fan speed in degrees Celsius. From 0 to step (for example 0.5) - speed 1 (Quiet), from step (0.5) to 2×step (1) - speed 2 (Low) and so on. Fan control only works if the thermostat supports the Fan Speed (C_FanSpeed) characteristic."
            },
            type: "Double",
            value: 0.5,
            minValue: 0.1,
            maxValue: 5.0,
            minStep: 0.1
        },
        fanSpeedManualLock: {
            name: {
                en: "Manual fan speed lock",
                ru: "Ручная фиксация скорости вентилятора"
            },
            desc: {
                ru: "Если включено, то при ручном изменении скорости вентилятора она перестаёт меняться. Для повторного включения автоматического режима - установите скорость Авто (0).",
                en: "If enabled, when manually changing the fan speed, it stops changing. To re-enable automatic mode, set the speed to Auto (0)."
            },
            type: "Boolean",
            value: true
        },
        other: {
            name: {
                en: "  OTHER",
                ru: "  ПРОЧЕЕ"
            },
            type: "String",
            value: "",
            formType: "status"
        },
        debug: {
            name: {
                en: "Debug",
                ru: "Отладка"
            },
            desc: {
                ru: "Выводить в лог информационные сообщения о работе сценария (изменения температуры, скорости вентилятора, режима эмуляции и т.п.). Предупреждения и ошибки логируются всегда.",
                en: "Output informational log messages about scenario activity (temperature changes, fan speed, emulation mode etc.). Warnings and errors are always logged."
            },
            type: "Boolean",
            value: false
        }
    },
    variables: {
        lastTemp: undefined,
        lastUpdateTime: undefined,
        subscribed: false,
        subscribe: undefined,
        relaySubscribe: undefined,
        relaySubscribed: false,
        fanSpeedManuallySet: false,
        midnightTask: undefined,
        failureCheckTask: undefined,
        sensorFailed: false,
        // Последний целевой режим, установленный пользователем (не сценарием).
        // При отказе датчика в режиме «Отключить» сценарий сбрасывает TargetHCState в 0,
        // а после восстановления возвращает сюда сохранённое значение.
        lastUserTargetState: undefined,
        // Признак того, что «Поведение при отключении термостата» уже применено.
        // Пока термостат в пассивном режиме (Выключено/Вентилятор/Осушитель), сценарий
        // применяет offBehavior ОДИН раз и больше не трогает реле. Сбрасывается при
        // возврате в активный режим.
        offBehaviorApplied: false
    }
};

function trigger(source, value, variables, options, context) {
    try {
        const characteristicType = source.getType()
        const service = source.getService()

        logDebug(`trigger: характеристика ${characteristicType}, значение ${value}, контекст ${context}`, source, options.debug)

        // Запоминаем последний целевой режим, выставленный пользователем.
        // Self changes (сценарий сам ставит 0 при отказе) фильтруем — иначе запомним 0.
        const userChangedTarget = characteristicType === HC.TargetHeatingCoolingState && !isSelfChangeByContext(context)
        if (userChangedTarget) {
            variables.lastUserTargetState = value
            if (isThermostatActive(value)) {
                if (variables.sensorFailed) {
                    logError(`Датчик температуры отказал. Режим будет сброшен в Выключен. После восстановления данных режим вернётся к ${value}.`, source)
                }
            } else if (variables.sensorFailed) {
                // Пользователь выключил термостат — отслеживание отказа датчика приостанавливаем.
                variables.sensorFailed = false
                logDebug("Термостат выключен пользователем — отслеживание отказа датчика приостановлено", source, options.debug)
            }
        }

        if (characteristicType === HC.C_FanSpeed) {
            handleFanSpeedChange(service, value, variables, options, context)
        } else {
            // Эмуляция обычного термостата: пересчёт CurrentHeatingCoolingState
            if (options.emulateThermostat) {
                computeAndSetCurrentState(service, options)
            }
            // Управление реле: стандартное поведение — реагируем на любое изменение
            // характеристик термостата (целевой режим, текущий режим, температуры, пороги).
            handleHeatingCoolingLogic(source, options, variables)
            updateFanSpeed(service, variables, options)
        }

        // Подписка на датчик температуры
        subscribeToTemperatureSensor(source, service, variables, options, context)
        // Подписка на реле
        subscribeToRelayState(service, variables, options)
        // Проверка отказа датчика
        startFailureCheckCron(service, variables, options)

        // При включении термостата (переход в активный режим) — немедленная проверка датчика,
        // чтобы при его недоступности сразу отправить уведомление, не дожидаясь cron.
        if (userChangedTarget && isThermostatActive(value)) {
            logDebug("Термостат включён — немедленная проверка датчика", source, options.debug)
            checkSensorFailure(service, variables, options)
        }

    } catch (e) {
        logError("Ошибка выполнения задачи: " + e.message);
    }
}

function handleFanSpeedChange(service, value, variables, options, context) {
    const isSelfChange = isSelfChangeByContext(context)
    const fanSpeedChar = service.getCharacteristic(HC.C_FanSpeed)
    if (isSelfChange) {
        logDebug(`Скорость вентилятора изменена самим сценарием — игнорируем`, fanSpeedChar, options.debug)
        return
    }
    if (value == 0) {
        logDebug(`Пользователь поставил Авто (0) — снимаем фиксацию скорости`, fanSpeedChar, options.debug)
        variables.fanSpeedManuallySet = false
        updateFanSpeed(service, variables, options)
        return
    }
    // Пользователь установил конкретную скорость - ставим флаг только если включена ручная фиксация
    if (fanSpeedChar.getMinValue() > 0) {
        logDebug(`У вентилятора нет режима Авто — флаг ручной фиксации не ставим`, fanSpeedChar, options.debug)
        return
    }
    if (options.fanSpeedManualLock == true) {
        logDebug(`Пользователь установил скорость ${value} вручную — фиксируем`, fanSpeedChar, options.debug)
        variables.fanSpeedManuallySet = true
    }
}

function handleHeatingCoolingLogic(source, options, variables) {
    // При отказе датчика управление реле берёт на себя applyFailureBehavior
    if (variables && variables.sensorFailed) {
        logDebug("Управление реле в режиме 'отказ датчика'", source, options.debug)
        applyFailureBehavior(source.getService(), options, source)
        return
    }

    const service = source.getService()

    const currentStateChar = service.getCharacteristic(HC.CurrentHeatingCoolingState)
    const targetStateChar = service.getCharacteristic(HC.TargetHeatingCoolingState)
    const currentState = currentStateChar ? currentStateChar.getValue() : 0
    const targetState = targetStateChar ? targetStateChar.getValue() : 0

    // Выключено / Вентилятор / Осушитель — применяем «Поведение при отключении термостата».
    // Применяем один раз при входе в отключённое состояние, дальше реле не трогаем.
    if (isThermostatOff(targetState)) {
        if (variables && variables.offBehaviorApplied) {
            logDebug(`Термостат отключён (target=${targetState}) — поведение уже применено, реле не трогаем`, source, options.debug)
            return
        }
        logDebug(`Целевой режим ${targetState} (Off/Fan/Dry) — поведение при отключении: ${describeOffBehavior(options.offBehavior)}`, source, options.debug)
        applyOffBehavior(options.offBehavior, options, source)
        if (variables) variables.offBehaviorApplied = true
        return
    }

    // Активный режим — снимаем признак отключения, обычное управление реле восстанавливается
    if (variables) variables.offBehaviorApplied = false

    // Дальше решает CurrentHeatingCoolingState (значения 0/1/2)
    if (currentState == 1) {
        logDebug(`Текущий режим = Нагрев → реле нагрева ON, охлаждения OFF`, source, options.debug)
        setHeatingRelay(true, source, options)
        setCoolingRelay(false, source, options)
        return
    }
    if (currentState == 2) {
        logDebug(`Текущий режим = Охлаждение → реле охлаждения ON, нагрева OFF`, source, options.debug)
        setHeatingRelay(false, source, options)
        setCoolingRelay(true, source, options)
        return
    }
    // currentState == 0 — зона комфорта в активном режиме → оба реле OFF
    logDebug(`Текущий режим = Выключен (target=${targetState}) → оба реле OFF`, source, options.debug)
    setHeatingRelay(false, source, options)
    setCoolingRelay(false, source, options)
}

// Вычисляет CurrentHeatingCoolingState (0/1/2) по целевому режиму и температурам с гистерезисом.
// При эмуляции термостата сам устанавливает значение на характеристику.
// Возвращает новое значение или undefined, если ничего не меняли.
function computeAndSetCurrentState(service, options) {
    const targetStateChar = service.getCharacteristic(HC.TargetHeatingCoolingState)
    const currentStateChar = service.getCharacteristic(HC.CurrentHeatingCoolingState)
    const currentTempChar = service.getCharacteristic(HC.CurrentTemperature)
    if (!targetStateChar || !currentStateChar || !currentTempChar) {
        logDebug("Эмуляция термостата: нет нужных характеристик у термостата, пропуск", currentStateChar || targetStateChar || currentTempChar, options.debug)
        return undefined
    }

    const targetState = targetStateChar.getValue()
    const currentState = currentStateChar.getValue()
    const currentTemp = currentTempChar.getValue()
    if (currentTemp == null) {
        logDebug("Эмуляция термостата: текущая температура null, пропуск", currentTempChar, options.debug)
        return undefined
    }

    const hysteresis = options.hysteresis != null ? options.hysteresis : 0.5
    logDebug(`Эмуляция: target=${targetState}, current=${currentState}, temp=${currentTemp}°C, h=${hysteresis}`, currentStateChar, options.debug)
    const next = decideCurrentState(service, targetState, currentTemp, hysteresis)
    if (next == null) {
        logDebug("Эмуляция термостата: состояние не меняем (мёртвая зона или режим без управления)", currentStateChar, options.debug)
        return undefined
    }
    if (next !== currentState) {
        currentStateChar.setValue(next)
        logDebug(`Эмуляция термостата: текущий режим → ${next}`, currentStateChar, options.debug)
    } else {
        logDebug(`Эмуляция термостата. Текущий режим совпадает с новым`, options.debug)
    }
    return next
}

// Вычисляет следующее значение CurrentHeatingCoolingState по эталонной логике штатного
// сценария «Обычный термостат» (GenericThermostat). Без побочных эффектов.
// Возвращает 0/1/2 — новое значение, либо null — оставить текущее значение без изменений.
// Коды режимов: OFF=0, HEAT=1, COOL=2, AUTO=3, ECO=-3, FAN_ONLY=-1, DRY=-2.
//
// Гистерезис «держится» в самой характеристике: в мёртвой зоне функция возвращает null,
// поэтому текущий режим (нагрев/охлаждение/выкл) сохраняется до выхода из зоны.
function decideCurrentState(service, targetState, currentTemp, hysteresis) {
    // OFF — всегда выключаем
    if (targetState == 0) return 0

    const deadband = hysteresis
    const targetTemp = getCharValue(service, HC.TargetTemperature)

    // COOL — по Целевой температуре. Выключаем при достижении цели, включаем при перегреве на гистерезис.
    if (targetState == 2) {
        if (targetTemp == null) return null
        if (currentTemp <= targetTemp) return 0
        if (currentTemp - targetTemp >= deadband) return 2
        return null // мёртвая зона — состояние не меняем
    }

    // HEAT — симметрично COOL.
    if (targetState == 1) {
        if (targetTemp == null) return null
        if (currentTemp >= targetTemp) return 0
        if (targetTemp - currentTemp >= deadband) return 1
        return null // мёртвая зона — состояние не меняем
    }

    // AUTO — по Порогам охлаждения/нагрева. Если хотя бы одного порога нет — по Целевой температуре.
    if (targetState == 3) {
        const coolThr = getCharValue(service, HC.CoolingThresholdTemperature)
        const heatThr = getCharValue(service, HC.HeatingThresholdTemperature)
        if (coolThr == null || heatThr == null) {
            if (targetTemp == null) return null
            if (currentTemp - targetTemp >= deadband) return 2
            if (targetTemp - currentTemp >= deadband) return 1
            return 0
        }
        if (currentTemp - coolThr >= deadband) return 2
        if (heatThr - currentTemp >= deadband) return 1
        return 0
    }

    // ECO (-3), FAN_ONLY (-1), DRY (-2) и прочие режимы штатная логика не обрабатывает —
    // CurrentHeatingCoolingState остаётся без изменений.
    return null
}

function getCharValue(service, type) {
    const c = service.getCharacteristic(type)
    return c ? c.getValue() : null
}

// Термостат выключен / не управляет климатом (пассивный режим): Выключено / Вентилятор / Осушитель.
function isThermostatOff(targetState) {
    return targetState == 0 || targetState == -1 || targetState == -2
}
// Термостат в активном режиме (греет/охлаждает): Нагрев / Охлаждение / Авто / Эко.
function isThermostatActive(targetState) {
    return !isThermostatOff(targetState)
}

// Выключен ли термостат самим пользователем (для приостановки отслеживания отказа датчика).
// Опираемся на последний выбранный пользователем режим, а не на «живой» Целевой режим:
// при failureBehavior=0 сценарий сам ставит Целевой режим в 0, но это не «пользователь выключил».
// Если пользовательский выбор неизвестен (например, после перезагрузки) — берём текущий режим.
function isThermostatOffByUser(service, variables) {
    let target
    if (variables && variables.lastUserTargetState != null) {
        target = variables.lastUserTargetState
    } else {
        target = getCharValue(service, HC.TargetHeatingCoolingState)
    }
    return isThermostatOff(target)
}

function subscribeToTemperatureSensor(source, service, variables, options, context) {
    const tempSensor = getDevice(options, "sensor")
    if (!tempSensor) {
        return
    }

    const currentTemperatureCharacteristic = service.getCharacteristic(HC.CurrentTemperature)
    const tempSensorSource = tempSensor.getCharacteristic(HC.CurrentTemperature)
    setValueFromSensor(tempSensorSource, variables, options, currentTemperatureCharacteristic)

    if (!variables.subscribe || variables.subscribed != true) {
        showSubscribeMessage(options, context)
        logDebug(`Создаём подписку на изменения датчика (UUID ${options.sensor})`, source, options.debug)
        let subscribe = Hub.subscribeWithCondition("", "", [HS.TemperatureSensor, HS.Thermostat], [HC.CurrentTemperature], function (sensorSource, sensorValue) {
            let sensorService = sensorSource.getService()
            let isSelected = sensorService.getUUID() == options.sensor
            if (isSelected && currentTemperatureCharacteristic) {
                // Свежий callback подписки означает, что датчик жив.
                // Если был отказ — восстанавливаем ДО записи значения, чтобы при последующем
                // handleHeatingCoolingLogic уже работала обычная логика.
                recoverFromSensorFailure(service, variables, options, sensorSource)
                setValueFromSensor(sensorSource, variables, options, currentTemperatureCharacteristic)
            }
        })
        variables.subscribe = subscribe
        variables.subscribed = true
    }
    if (!variables.midnightTask) {
        logDebug("Создаём cron задачу полуночного обновления", source, options.debug)
        variables.midnightTask = Cron.schedule("0 0 0 * * *", function () {
            setValueFromSensor(tempSensorSource, variables, options, currentTemperatureCharacteristic)
            logDebug("Полуночное обновление", source, options.debug)
        });
    }
}

function subscribeToRelayState(service, variables, options) {
    const heatingRelay = getDevice(options, "heatingRelay")
    const coolingRelay = getDevice(options, "coolingRelay")

    // Используем любую характеристику термостата для создания source в callback
    const thermostatSource = service.getCharacteristic(HC.CurrentHeatingCoolingState)

    // Создаем одну подписку на онлайн статус для обоих реле
    if ((heatingRelay || coolingRelay) && (!variables.relaySubscribe || variables.relaySubscribed != true) && thermostatSource) {
        const heatingRelayAccessoryId = getAccessoryIdFromUUID(options.heatingRelay)
        const coolingRelayAccessoryId = getAccessoryIdFromUUID(options.coolingRelay)
        logDebug(`Создаём подписку на онлайн-статус реле (heat=${heatingRelayAccessoryId}, cool=${coolingRelayAccessoryId})`, thermostatSource, options.debug)

        let subscribe = Hub.subscribeWithCondition("", "", [HS.AccessoryInformation], [HC.C_Online], function (onlineSource, onlineValue) {
            if (onlineValue != true) return

            // Получаем идентификатор аксессуара и сравниваем с нашими реле
            const accessoryId = getAccessoryIdFromUUID(onlineSource.getUUID())
            if (accessoryId == heatingRelayAccessoryId || accessoryId == coolingRelayAccessoryId) {
                logDebug(`Реле ${accessoryId} вернулось в сеть — пересчитываем состояние`, thermostatSource, options.debug)
                handleHeatingCoolingLogic(thermostatSource, options, variables)
            }
        })
        variables.relaySubscribe = subscribe
        variables.relaySubscribed = true
    }
}

// Устанавливает реле нагрева в логическое состояние value (с учётом инверсии).
function setHeatingRelay(value, source, options) {
    setRelayValue(getDevice(options, "heatingRelay"), value, source, options.debug, options.heatingRelayInvert === true)
}

// Устанавливает реле охлаждения в логическое состояние value (с учётом инверсии).
function setCoolingRelay(value, source, options) {
    setRelayValue(getDevice(options, "coolingRelay"), value, source, options.debug, options.coolingRelayInvert === true)
}

// value — логическое состояние (нужно ли «включить нагрев/охлаждение»).
// invert=true — записать на реле инвертированное значение (нормально-замкнутая проводка).
function setRelayValue(relay, value, source, debug, invert) {
    if (!relay) return

    try {
        const onChar = relay.getCharacteristic(HC.On)
        const physical = invert === true ? !value : value
        const relayAccessory = relay.getAccessory()
        const status = relayAccessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue() == true
        if (!status)
            logError(`Реле ${getDeviceName(relay)} не в сети`, source)
        const prev = onChar.getValue()
        if (prev !== physical) {
            const invertNote = invert === true ? ` (инверсия, логически ${value})` : ``
            logDebug(`Реле ${getDeviceName(relay)}: ${prev} → ${physical}${invertNote}`, source, debug)
        }
        onChar.setValue(physical)
    } catch (e) {
        logError(`Ошибка при установке значения реле ${getDeviceName(relay)}: ${e.toString()}`, source)
    }
}

function updateFanSpeed(service, variables, options) {
    try {
        const fanSpeedChar = service.getCharacteristic(HC.C_FanSpeed)
        if (!fanSpeedChar) {
            // Termостат не поддерживает C_FanSpeed — debug пропускаем (это норма)
            return
        }

        if (variables.fanSpeedManuallySet) {
            logDebug(`Скорость вентилятора зафиксирована пользователем (fanSpeedManuallySet=true) — пропуск. Поставьте Авто (0), чтобы вернуть автоматический режим.`, fanSpeedChar, options.debug)
            return
        }

        const maxSpeed = fanSpeedChar.getMaxValue()

        // Если термостат выключен, устанавливаем минимальную скорость вентилятора
        const currentStateChar = service.getCharacteristic(HC.CurrentHeatingCoolingState)
        const currentState = currentStateChar ? currentStateChar.getValue() : 0
        if (currentState == 0) {
            const currentSpeed = fanSpeedChar.getValue()
            if (currentSpeed != 1) {
                fanSpeedChar.setValue(1)
                logDebug(`Скорость вентилятора установлена: 1 (текущий режим = Выключен)`, fanSpeedChar, options.debug)
            } else {
                logDebug(`Текущий режим = Выключен → скорость остаётся 1`, fanSpeedChar, options.debug)
            }
            return
        }

        const currentTemp = service.getCharacteristic(HC.CurrentTemperature).getValue()
        const targetTemp = service.getCharacteristic(HC.TargetTemperature).getValue()
        const fanTempStep = options.fanTempStep || 0.5

        if (currentTemp == null || targetTemp == null) {
            logDebug(`Скорость вентилятора: temp/target = ${currentTemp}/${targetTemp} (null) — пропуск`, fanSpeedChar, options.debug)
            return
        }

        const diff = Math.abs(currentTemp - targetTemp)

        // Вычисляем скорость вентилятора на основе разницы температур
        // 0 до step - скорость 1, step до 2*step - 2, 2*step до 3*step - 3, и т.д.
        let speed = 1
        if (diff >= 4 * fanTempStep) {
            speed = 5
        } else if (diff >= 3 * fanTempStep) {
            speed = 4
        } else if (diff >= 2 * fanTempStep) {
            speed = 3
        } else if (diff >= fanTempStep) {
            speed = 2
        }

        // Ограничиваем скорость максимальным значением
        if (speed > maxSpeed) {
            speed = maxSpeed
        }

        const currentSpeed = fanSpeedChar.getValue()
        if (currentSpeed != speed) {
            fanSpeedChar.setValue(speed)
            logDebug(`Скорость вентилятора: ${currentSpeed} → ${speed} (разница ${diff.toFixed(2)}°C, шаг ${fanTempStep})`, fanSpeedChar, options.debug)
        } else {
            logDebug(`Скорость вентилятора остаётся ${speed} (разница ${diff.toFixed(2)}°C, шаг ${fanTempStep})`, fanSpeedChar, options.debug)
        }
    } catch (e) {
        logError("Ошибка обновления скорости вентилятора: " + e.toString())
    }
}

function setValueFromSensor(sensorSource, variables, options, currentTemperatureCharacteristic) {
    try {
        const sensorService = sensorSource.getService()
        const sensorAccessory = sensorService.getAccessory()
        const status = sensorAccessory.getService(HS.AccessoryInformation).getCharacteristic(HC.C_Online).getValue() == true;
        if (!status) {
            logWarn(`Датчик ${getDeviceName(sensorService)} не в сети`, sensorSource)
        }
        const sensorValue = sensorSource.getValue()
        currentTemperatureCharacteristic.setValue(sensorValue)
        if (variables.lastTemp != sensorValue) {
            logDebug(`Значение на термостат установлено: ${sensorValue}°C`, sensorSource, options.debug)
            variables.lastTemp = sensorValue
            variables.lastUpdateTime = Date.now();
        }
    } catch (e) {
        logError(`Не удалось получить температуру с датчика ${options.sensor}: ${e.toString()}`, sensorSource)
    }
}

function showSubscribeMessage(options, context) {
    if (context.toString().indexOf("HUB[OnStart]") >= 0) {
        return
    }
    const sensorService = getDevice(options, "sensor")

    try {
        const accessory = sensorService.getAccessory()
        const accessoryName = accessory.getName()
        const serviceName = sensorService.getName()
        console.message(`Подключен датчик: ${(accessoryName == serviceName ? accessoryName : accessoryName + " " + serviceName)}`)
    } catch (e) {
        // Игнорируем ошибки при выводе сообщения
    }
}

// Описание поведения при отказе датчика для логов
function describeFailureBehavior(behavior) {
    if (behavior == 1) return "включаем реле нагрева"
    if (behavior == 2) return "включаем реле охлаждения"
    if (behavior == 3) return "состояние не меняем"
    if (behavior == 4) return "включаем оба реле"
    return "отключаем термостат и реле"
}

// Применяет состояние реле по выбранному поведению при отказе датчика.
// Целевой режим термостата НЕ трогает.
// 0 — Отключить все: оба реле OFF (с учётом инверсии).
// 1 — Нагрев: реле нагрева ON, охлаждения OFF (с учётом инверсии).
// 2 — Охлаждение: реле нагрева OFF, охлаждения ON (с учётом инверсии).
// 3 — Ничего не делать: реле не трогаем.
// 4 — Включить все: оба реле ON (с учётом инверсии).
function applyRelayBehavior(behavior, options, source) {
    if (behavior == 3) return
    if (behavior == 1) {
        setHeatingRelay(true, source, options)
        setCoolingRelay(false, source, options)
        return
    }
    if (behavior == 2) {
        setHeatingRelay(false, source, options)
        setCoolingRelay(true, source, options)
        return
    }
    if (behavior == 4) {
        setHeatingRelay(true, source, options)
        setCoolingRelay(true, source, options)
        return
    }
    // 0 — Отключить все
    setHeatingRelay(false, source, options)
    setCoolingRelay(false, source, options)
}

// Описание «Поведения при отключении термостата» для логов.
function describeOffBehavior(behavior) {
    if (behavior == 1) return "включить все реле (физически)"
    if (behavior == 2) return "реле нагрева ON, охлаждения OFF"
    if (behavior == 3) return "реле охлаждения ON, нагрева OFF"
    return "отключить все реле (физически)"
}

// Применяет «Поведение при отключении термостата».
// 0 — Отключить все реле: оба реле физически OFF (без учёта инверсии).
// 1 — Включить все реле: оба реле физически ON (без учёта инверсии).
// 2 — Нагрев: реле нагрева ON, охлаждения OFF (с учётом инверсии).
// 3 — Охлаждение: реле нагрева OFF, охлаждения ON (с учётом инверсии).
function applyOffBehavior(behavior, options, source) {
    const heatingRelay = getDevice(options, "heatingRelay")
    const coolingRelay = getDevice(options, "coolingRelay")
    if (behavior == 1) {
        // Включить все реле — физически, без инверсии
        setRelayValue(heatingRelay, true, source, options.debug, false)
        setRelayValue(coolingRelay, true, source, options.debug, false)
        return
    }
    if (behavior == 2) {
        // Нагрев — логически, с учётом инверсии
        setHeatingRelay(true, source, options)
        setCoolingRelay(false, source, options)
        return
    }
    if (behavior == 3) {
        // Охлаждение — логически, с учётом инверсии
        setHeatingRelay(false, source, options)
        setCoolingRelay(true, source, options)
        return
    }
    // 0 — Отключить все реле — физически, без инверсии
    setRelayValue(heatingRelay, false, source, options.debug, false)
    setRelayValue(coolingRelay, false, source, options.debug, false)
}

// Нормализует failureTimeout: минимум 15 мин, кратность 15
function getFailureTimeoutMinutes(options) {
    let minutes = options.failureTimeout != null ? options.failureTimeout : 240
    if (minutes < FAILURE_TIMEOUT_STEP_MIN) minutes = FAILURE_TIMEOUT_STEP_MIN
    minutes = Math.round(minutes / FAILURE_TIMEOUT_STEP_MIN) * FAILURE_TIMEOUT_STEP_MIN
    return minutes
}

// Применяет поведение при отказе датчика (значения см. опцию failureBehavior).
// Отличается от applyRelayBehavior только режимом 0 — «Отключить все»: дополнительно
// переводит термостат в Выключен (TargetHCState=0) как безопасное состояние.
function applyFailureBehavior(service, options, source) {
    const behavior = options.failureBehavior
    if (behavior == 3) {
        logDebug("Отказ датчика: режим 'Ничего не делать' — состояние не меняем", source, options.debug)
        return
    }

    logDebug(`Отказ датчика: ${describeFailureBehavior(behavior)}`, source, options.debug)

    // 0 — Отключить все: дополнительно переводим термостат в OFF (безопасное состояние)
    if (behavior != 1 && behavior != 2 && behavior != 4) {
        const targetChar = service ? service.getCharacteristic(HC.TargetHeatingCoolingState) : null
        if (targetChar && targetChar.getValue() !== 0) {
            targetChar.setValue(0)
        }
    }

    applyRelayBehavior(behavior, options, source)
}

// Восстановление после отказа датчика.
// Сбрасывает флаг sensorFailed и в режиме «Отключить» возвращает Целевой режим, который пользователь
// выбрал последним (до или во время отказа).
function recoverFromSensorFailure(service, variables, options, source) {
    if (!variables.sensorFailed) return
    variables.sensorFailed = false
    logWarn("Датчик температуры восстановлен. Управление реле возвращено в обычный режим.", source)

    // В режиме «Отключить» сценарий ранее сбросил TargetHCState в 0 — восстанавливаем сохранённый.
    if (options.failureBehavior == 0 && variables.lastUserTargetState != null) {
        const targetChar = service ? service.getCharacteristic(HC.TargetHeatingCoolingState) : null
        if (targetChar && targetChar.getValue() !== variables.lastUserTargetState) {
            logWarn(`Восстанавливаем Целевой режим: ${variables.lastUserTargetState}`, source)
            targetChar.setValue(variables.lastUserTargetState)
        }
    }

    // Прогоним обычную логику управления реле (sensorFailed уже false).
    const currentTempChar = service ? service.getCharacteristic(HC.CurrentTemperature) : null
    if (currentTempChar) {
        handleHeatingCoolingLogic(currentTempChar, options, variables)
    }
}

// Проверка состояния датчика. Срабатывает по cron каждые 15 минут.
function checkSensorFailure(service, variables, options) {
    try {
        if (!options.sensor || options.sensor === '') return
        if (!service) return
        const sensorChar = service.getCharacteristic(HC.CurrentTemperature)

        // Термостат выключен пользователем — отказ датчика не отслеживаем: не уведомляем
        // и реле не трогаем. Если ранее был зафиксирован отказ — тихо снимаем флаг.
        if (isThermostatOffByUser(service, variables)) {
            if (variables.sensorFailed) {
                variables.sensorFailed = false
                logDebug("Термостат выключен — отслеживание отказа датчика приостановлено", sensorChar, options.debug)
            }
            return
        }

        const timeoutMs = getFailureTimeoutMinutes(options) * 60 * 1000
        if (!variables.lastUpdateTime) {
            // Если ни одного обновления не было — отсчитываем от запуска
            variables.lastUpdateTime = Date.now()
            logDebug("Проверка датчика: lastUpdateTime неизвестно, инициализируем", sensorChar, options.debug)
            return
        }
        const elapsed = Date.now() - variables.lastUpdateTime
        const elapsedMin = Math.round(elapsed / 60000)
        const timeoutMin = Math.round(timeoutMs / 60000)
        logDebug(`Проверка датчика: с последнего обновления ${elapsedMin} мин (timeout ${timeoutMin} мин)`, sensorChar, options.debug)
        if (elapsed <= timeoutMs) {
            recoverFromSensorFailure(service, variables, options, sensorChar)
            return
        }
        if (!variables.sensorFailed) {
            variables.sensorFailed = true
            const sensorService = getDevice(options, "sensor")
            const sensorName = sensorService ? getDeviceName(sensorService) : options.sensor
            const behaviorText = describeFailureBehavior(options.failureBehavior)
            logError(`Нет показаний от датчика температуры (${sensorName}) уже ${elapsedMin} мин. Отказ датчика: ${behaviorText}`, sensorChar)
        }
        applyFailureBehavior(service, options, sensorChar)
    } catch (e) {
        logError("Ошибка проверки отказа датчика: " + e.toString())
    }
}

// Запускает периодическую проверку отказа датчика (раз в 15 минут).
function startFailureCheckCron(service, variables, options) {
    if (variables.failureCheckTask) return
    logDebug(`Создаём cron 'каждые 15 мин' для проверки отказа датчика (timeout ${getFailureTimeoutMinutes(options)} мин)`, service.getCharacteristic(HC.CurrentTemperature), options.debug)
    variables.failureCheckTask = Cron.schedule("0 */15 * * * *", function () {
        checkSensorFailure(service, variables, options)
    })
}

function getDevice(options, name) {
    if (!options[name] || options[name] === '') {
        return undefined
    }

    try {
        const cdata = options[name].split('.');
        if (cdata.length < 2) {
            return undefined
        }
        const aid = cdata[0];
        const sid = cdata[1];
        const accessory = Hub.getAccessory(aid)
        if (!accessory) {
            return undefined
        }
        const service = accessory.getService(sid)
        if (!service) {
            logError("Выбранное устройство не найдено: " + options[name], undefined)
            return undefined
        }
        return service
    } catch (e) {
        logError("Ошибка при получении устройства: " + e.toString(), undefined)
        return undefined
    }
}

function logWarn(text, source) {
    console.warn(getLogText(text, source));
}
function logError(text, source) {
    console.error(getLogText(text, source));
}
// Отладочный лог. Пишет только если options.debug=true (передаётся третьим аргументом).
// Используем console.info (а не console.log) — в Sprut.Hub это уровень "Информация".
function logDebug(text, source, debug) {
    if (!debug) return
    console.info(getLogText(text, source));
}
function getLogText(text, source) {
    if (source) {
        return `${text} | ${DEBUG_TITLE} ${getDeviceName(source.getService())}`
    } else {
        return `${text} | ${DEBUG_TITLE}`
    }
}

function getDeviceName(service) {
    const acc = service.getAccessory();
    const room = acc.getRoom().getName()
    const accName = acc.getName()
    const sName = service.getName()
    return room + " -> " + (accName === sName ? accName : accName + " " + sName) + " (" + service.getUUID() + ")" + (!service.isVisible() ? ". Скрыт" : "")
}

// подготовка списка характеристик для выбора в настройке логики
function getServicesByServiceAndCharacteristicType(serviceTypes, characteristicTypes) {
    let unsortedServicesList = [];
    Hub.getAccessories().forEach((a) => {
        a.getServices()
            .filter((s) => serviceTypes.indexOf(s.getType()) >= 0)
            .filter((s) => characteristicTypes.some((c) => s.getCharacteristic(c)))
            .forEach((s) => {
                let name = getDeviceName(s);
                unsortedServicesList.push({
                    name: { ru: name, en: name },
                    value: s.getUUID()
                });
            });
    });
    let sortedServicesList = [{ name: { ru: "Не выбрано", en: "Not selected" }, value: '' }];
    unsortedServicesList.sort((a, b) => a.name.ru.localeCompare(b.name.ru)).forEach((s) => sortedServicesList.push(s));
    return sortedServicesList;
}

// Минимальный шаг времени до отказа датчика (минуты). См. опцию failureTimeout.
const FAILURE_TIMEOUT_STEP_MIN = 15
// Константа для отладки
const DEBUG_TITLE = "Виртуальный термостат: ";

function getAccessoryIdFromUUID(uuid) {
    if (!uuid) {
        return undefined
    }
    const parts = uuid.toString().split('.')
    if (parts.length >= 1) {
        return parts[0]
    }
    return undefined
}

function isSelfChangeByContext(context) {
    // Проверяем, что изменение произошло сценарием (self change)
    // Шаблон: 'LOGIC <- C <- LOGIC'
    const elements = context.toString().split(' <- ')
    return elements.length >= 3 &&
        elements[0].startsWith('LOGIC') &&
        elements[1].startsWith('C') &&
        elements[2] === elements[0];
}
