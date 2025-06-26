function applyCorrections(jsonToCorrect, schema) {
    const newJson = JSON.parse(JSON.stringify(jsonToCorrect)); // Глубокая копия
    const corrections = [];

    // Преобразование topicSearch в modelId
    let topicSearchValue = null;
    function findAndRemoveTopicSearch(obj) {
        let removed = false;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (key === 'topicSearch') {
                    const value = Array.isArray(obj[key]) ? obj[key][0] : obj[key];
                    if (!topicSearchValue && value) { // Сохраняем только первое найденное непустое значение
                        topicSearchValue = value;
                    }
                    delete obj[key];
                    removed = true;
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    if (findAndRemoveTopicSearch(obj[key])) {
                        removed = true;
                    }
                }
            }
        }
        return removed;
    }

    if (findAndRemoveTopicSearch(newJson)) {
        if (topicSearchValue) {
            newJson.modelId = topicSearchValue;
            corrections.push(`Значение topicSearch перенесено в modelId и все его вхождения удалены.`);
        } else {
            corrections.push(`Пустое поле topicSearch удалено из шаблона.`);
        }
    }

    // --- Замена разделителей и переименование ключей ---
    let renameCorrectionAdded = false;
    let separatorCorrectionAdded = false;

    const renameMap = {
        mapOut: 'outMap',
        mapIn: 'map',
        inMap: 'map',
        funcOut: 'outFunc',
        func: 'inFunc',
        funcIn: 'inFunc'
    };

    function processRecursively(obj) {
        if (!obj || typeof obj !== 'object') {
            return;
        }
        if (Array.isArray(obj)) {
            obj.forEach(processRecursively);
            return;
        }

        // Переименование ключей
        const currentKeys = Object.keys(obj);
        let renamedInThisObject = false;
        for (const oldKey of currentKeys) {
            if (renameMap.hasOwnProperty(oldKey)) {
                const newKey = renameMap[oldKey];
                if (!obj.hasOwnProperty(newKey)) { // чтобы не затереть существующий ключ
                   obj[newKey] = obj[oldKey];
                }
                delete obj[oldKey];
                renamedInThisObject = true;
            }
        }

        if (renamedInThisObject && !renameCorrectionAdded) {
            corrections.push('Выполнено переименование полей (mapOut->outMap, inMap/mapIn->map, funcOut->outFunc, func/funcIn->inFunc)');
            renameCorrectionAdded = true;
        }

        // Обход всех ключей для дальнейшей обработки
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                // Замена разделителей
                if (key === 'validValues' && typeof value === 'string' && value.includes(';')) {
                    obj[key] = value.replace(/;/g, ',');
                    separatorCorrectionAdded = true;
                }
                if ((key === 'map' || key === 'outMap') && typeof value === 'string' && value.includes(',')) {
                    obj[key] = value.replace(/,/g, ';');
                    separatorCorrectionAdded = true;
                }

                // Рекурсивный вызов для вложенных объектов
                processRecursively(value);
            }
        }
    }

    processRecursively(newJson);
    
    if (separatorCorrectionAdded) {
        corrections.push("Произведена замена разделителей: в `validValues` (`;` на `,`), в `map`/`outMap` (`,` на `;`).");
    }

    // Исправление template
    if (typeof newJson.template === 'string') {
        newJson.template = [newJson.template];
        corrections.push(`Поле template преобразовано в массив`);
    }

    // Исправление manufacturerId и modelId
    if (typeof newJson.manufacturerId === 'string' && newJson.manufacturerId.startsWith('(') && newJson.manufacturerId.endsWith(')')) {
        newJson.manufacturerId = newJson.manufacturerId.slice(1, -1);
        corrections.push(`Удалены скобки из manufacturerId`);
    }
    if (typeof newJson.modelId === 'string' && newJson.modelId.startsWith('(') && newJson.modelId.endsWith(')')) {
        newJson.modelId = newJson.modelId.slice(1, -1);
        corrections.push(`Удалены скобки из modelId`);
    }

    // Исправление link в characteristics
    if (newJson.services && Array.isArray(newJson.services)) {
        newJson.services.forEach((service, serviceIndex) => {
            if (service.characteristics && Array.isArray(service.characteristics)) {
                service.characteristics.forEach(characteristic => {
                    if (characteristic.type === 'Float') {
                        characteristic.type = 'Double';
                        const serviceName = service.name ? ` сервиса "${service.name}"` : '';
                        corrections.push(`Характеристика ${characteristic.type || ''}${serviceName}: Тип Float заменён на Double`);
                    }
                    if (characteristic.link && !Array.isArray(characteristic.link)) {
                        characteristic.link = [characteristic.link];
                        const serviceName = service.name ? ` сервиса "${service.name}"` : '';
                        corrections.push(`Поле link в характеристике ${characteristic.type || ''}${serviceName} преобразовано в массив`);
                    }
                });
            }
        });
    }

    // Исправление link и типа в options
    if (newJson.options && Array.isArray(newJson.options)) {
        newJson.options.forEach(option => {
            // 1. Переименование input -> inputType
            if (option.hasOwnProperty('input')) {
                option.inputType = option.input;
                delete option.input;
                corrections.push(`В опции ${option.name || ''} поле input переименовано в inputType`);
            }
            // 2. Замена значения inputType на допустимое из схемы (заглушка, т.к. нет доступа к allowedInputTypesFromSchema)
            // if (option.hasOwnProperty('inputType') && typeof option.inputType === 'string' && Array.isArray(allowedInputTypesFromSchema)) {
            //     const found = allowedInputTypesFromSchema.find(v => v.toLowerCase() === option.inputType.toLowerCase());
            //     if (found && found !== option.inputType) {
            //         corrections.push(`В опции ${option.name || ''} значение inputType заменено с "${option.inputType}" на "${found}"`);
            //         option.inputType = found;
            //     }
            // }
            if (option.type === 'Float') {
                option.type = 'Double';
                corrections.push(`Опция ${option.name || ''}: Тип Float заменён на Double`);
            }
            if (option.link && !Array.isArray(option.link)) {
                option.link = [option.link];
                corrections.push(`Поле link в опции "${option.name || ''}" преобразовано в массив`);
            }
        });
    }

    // Исправление link в init
    let initLinkCorrectionAdded = false;
    if (newJson.init && Array.isArray(newJson.init)) {
        newJson.init.forEach((initCmd) => {
            if (initCmd.link && !Array.isArray(initCmd.link)) {
                initCmd.link = [initCmd.link];
                if (!initLinkCorrectionAdded) {
                    corrections.push(`Поле link в командах инициализации (init) преобразовано в массив`);
                    initLinkCorrectionAdded = true;
                }
            }
        });
    }

    // Reorder keys for better readability before displaying
    let keyOrder = [];
    if (schema && schema.properties) {
        keyOrder = Object.keys(schema.properties);
    }
    const orderedJson = {};
    const remainingKeys = { ...newJson };
    for (const key of keyOrder) {
        if (Object.prototype.hasOwnProperty.call(newJson, key)) {
            orderedJson[key] = newJson[key];
            delete remainingKeys[key];
        }
    }
    Object.assign(orderedJson, remainingKeys);
    return { finalJson: orderedJson, corrections };
} 