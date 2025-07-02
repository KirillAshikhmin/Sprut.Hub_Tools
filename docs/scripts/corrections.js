// corrections.js
// Модуль только для исправления шаблонов (applyCorrections, correctJson, oneClickFix, oneClickFixRun)
// Глобальные функции для использования в index.html и других js-файлах

// ... Здесь будет только логика applyCorrections ...

// --- CodeMirror и редактор ---
// (сюда переносится инициализация редактора, функции работы с темой, загрузкой файлов, drag&drop и т.д.)

// --- Схема аксессуара и автокомплит ---
// (сюда переносится buildSchemaHintsTree, loadSchema, getCurrentJsonPath, getHintsForPath, автокомплит CodeMirror)

// --- Валидация, подсветка ошибок, исправления ---
// (сюда переносится validateServiceAndCharacteristics, translateAjvError, autoFixJson, validateJson, validateJsonInternal, applyCorrections, correctJson, oneClickFix, oneClickFixRun, formatJson, highlightErrorLine, clearErrorHighlights)

// --- Архивы и пакетная обработка ---
// (сюда переносится processTemplateFiles, processZipArchive, processTarGzArchive)

// --- Экспортируемые функции ---
// (экспортируются applyCorrections, validateServiceAndCharacteristics и другие нужные функции)

window.applyCorrections = function(jsonToCorrect, schema, allowedInputTypesFromSchema) {
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

    // --- Вспомогательная функция для обработки link ---
    function fixLinkType(link, context, corrections) {
        if (!Array.isArray(link)) return;
        link.forEach((l, idx) => {
            if (l && typeof l === 'object') {
                if (l.type === 'Float') {
                    l.type = 'Double';
                    corrections.push(`В link${context ? ' ' + context : ''} №${idx + 1}: Тип Float заменён на Double`);
                }
                // Рекурсивно обрабатываем вложенные объекты внутри link
                Object.keys(l).forEach(key => {
                    if (typeof l[key] === 'object' && l[key] !== null) {
                        fixLinkType(Array.isArray(l[key]) ? l[key] : [l[key]], context, corrections);
                    }
                });
            }
        });
    }

    // Исправление link в characteristics
    if (newJson.services && Array.isArray(newJson.services)) {
        newJson.services.forEach((service, serviceIndex) => {
            if (service.characteristics && Array.isArray(service.characteristics)) {
                service.characteristics.forEach(characteristic => {
                    if (characteristic.link && !Array.isArray(characteristic.link)) {
                        characteristic.link = [characteristic.link];
                        const serviceName = service.name ? ` сервиса "${service.name}"` : '';
                        corrections.push(`Поле link в характеристике ${characteristic.type || ''}${serviceName} преобразовано в массив`);
                    }
                    // Исправление типа внутри link
                    if (characteristic.link) {
                        fixLinkType(characteristic.link, `характеристики ${characteristic.type || ''}`, corrections);
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
            // 2. Замена значения inputType на допустимое из схемы (без учета регистра)
            if (option.hasOwnProperty('inputType') && typeof option.inputType === 'string' && Array.isArray(allowedInputTypesFromSchema)) {
                const found = allowedInputTypesFromSchema.find(v => v.toLowerCase() === option.inputType.toLowerCase());
                if (found && found !== option.inputType) {
                    corrections.push(`В опции ${option.name || ''} значение inputType заменено с "${option.inputType}" на "${found}"`);
                    option.inputType = found;
                }
            }
            // Удаление init: false
            if (option.hasOwnProperty('init') && option.init === false) {
                delete option.init;
                corrections.push(`В опции ${option.name || ''} поле init: false удалено`);
            }
            if (option.link && !Array.isArray(option.link)) {
                option.link = [option.link];
                corrections.push(`Поле link в опции "${option.name || ''}" преобразовано в массив`);
            }
            // Исправление типа внутри link
            if (option.link) {
                fixLinkType(option.link, `опции ${option.name || ''}`, corrections);
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
};

window.correctJson = function() {
    try {
        const value = window.editor.getValue();
        if (!value.trim()) {
            document.getElementById('errorOutput').innerHTML = `<ul><li>Необходимо сперва открыть файл шаблона</li></ul>`;
            return;
        }
        document.getElementById('errorOutput').textContent = '';
        document.getElementById('correctionOutput').textContent = '';
        document.getElementById('autoFixContainer').innerHTML = '';
        let json = JSON.parse(value);
        window.oneClickFixMode = false;
        window.selectTemplateWithDropdown(json, (selectedIndex) => {
            let templates = Array.isArray(json) ? json : (json && typeof json === 'object' && Object.keys(json).every(k => /^\d+$/.test(k))) ? Object.values(json) : [json];
            const selectedTemplate = templates[selectedIndex] !== undefined ? templates[selectedIndex] : templates[0];
            const { finalJson, corrections } = window.applyCorrections(selectedTemplate, window.schema, window.allowedInputTypesFromSchema);
            window.editor.setValue(JSON.stringify(finalJson, null, 2));
            document.getElementById('correctionOutput').innerHTML = corrections.length > 0
                ? `<ul>${corrections.map(c => `<li>${c}</li>`).join('')}</ul>`
                : '<ul><li>Исправления не требовались</li></ul>';
            window.clearErrorHighlights();
            window.editor.refresh();
        });
    } catch (e) {
        document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка исправления: ${e.message}</li></ul>`;
    }
};

window.oneClickFix = async function() {
    const openFileFirst = document.getElementById('oneClickOpenFileCheckbox').checked;
    if (openFileFirst) {
        const fileInput = document.getElementById('autoFixFileInput');
        fileInput.accept = '.json,.zip,application/gzip,application/x-gzip,application/x-tar,.gz,.tar.gz';
        fileInput.onchange = async function(event) {
            const file = event.target.files[0];
            event.target.value = '';
            if (file) {
                if (file.name.endsWith('.zip')) {
                    await window.processZipArchive(file);
                    return;
                }
                if (file.name.endsWith('.tar.gz')) {
                    await window.processTarGzArchive(file);
                    return;
                }
                const reader = new FileReader();
                reader.onload = async function(e) {
                    try {
                        let fileContent = e.target.result;
                        fileContent = fileContent.replace(/^\uFEFF/, '');
                        let parsed;
                        try {
                            parsed = JSON.parse(fileContent);
                        } catch (err) {
                            document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка чтения файла: ${err.message}</li></ul>`;
                            return;
                        }
                        document.getElementById('errorOutput').textContent = '';
                        document.getElementById('correctionOutput').textContent = '';
                        document.getElementById('autoFixContainer').innerHTML = '';
                        if (Array.isArray(parsed) && parsed.length > 1) {
                            window.oneClickFixMode = true;
                            window.selectTemplateWithDropdown(parsed, (selectedIndex) => {
                                const selectedTemplate = parsed[selectedIndex];
                                window.editor.setValue(JSON.stringify(selectedTemplate, null, 2));
                                window.editor.refresh();
                            });
                        } else {
                            const template = Array.isArray(parsed) ? parsed[0] : parsed;
                            window.editor.setValue(JSON.stringify(template, null, 2));
                            window.editor.refresh();
                            await window.oneClickFixRun();
                        }
                    } catch (err) {
                        document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка чтения файла: ${err.message}</li></ul>`;
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
        return;
    }
    await window.oneClickFixRun();
};

window.oneClickFixRun = async function() {
    const btn = document.querySelector('button[onclick="oneClickFix()"]');
    btn.disabled = true;
    btn.textContent = 'Выполняется...';
    document.getElementById('correctionOutput').innerHTML = '<ul><li>Запущен фикс в 1 клик...</li></ul>';
    try {
        const json = JSON.parse(window.editor.getValue());
        if (Array.isArray(json)) {
            document.getElementById('errorOutput').innerHTML = `<ul><li>"Фикс в 1 клик" не работает с файлами, содержащими несколько шаблонов. Пожалуйста, выберите и загрузите один шаблон в редактор.</li></ul>`;
            return;
        }
        const { finalJson, corrections } = window.applyCorrections(json, window.schema, window.allowedInputTypesFromSchema);
        window.editor.setValue(JSON.stringify(finalJson, null, 2));
        if (corrections.length > 0) {
            document.getElementById('correctionOutput').innerHTML += `<ul>${corrections.map(c => `<li>${c}</li>`).join('')}</ul>`;
        } else {
            document.getElementById('correctionOutput').innerHTML += '<ul><li>Исправления не требовались.</li></ul>';
        }
        await new Promise(r => setTimeout(r, 50));
        window.validateJson(true);
        let hasErrors = document.getElementById('errorOutput').innerHTML.trim() !== '';
        if (!hasErrors) {
            document.getElementById('correctionOutput').innerHTML += '<ul><li>Скачивание...</li></ul>';
            window.formatFromOneClick = true;
            window.formatJson();
            window.formatFromOneClick = false;
            window.downloadTemplate();
            return;
        }
        document.getElementById('correctionOutput').innerHTML += '<ul><li>Найдены ошибки, попытка автоматического исправления...</li></ul>';
        window.autoFixJson(false);
        await new Promise(r => setTimeout(r, 200));
        hasErrors = document.getElementById('errorOutput').innerHTML.trim() !== '';
        if (!hasErrors) {
            document.getElementById('correctionOutput').innerHTML += '<ul><li>Авто-исправление успешно! Скачивание...</li></ul>';
            window.formatFromOneClick = true;
            window.formatJson();
            window.formatFromOneClick = false;
            window.downloadTemplate();
        } else {
            document.getElementById('correctionOutput').innerHTML += '<ul><li>Не удалось исправить все ошибки автоматически. Пожалуйста, исправьте их вручную.</li></ul>';
        }
    } catch (e) {
        document.getElementById('errorOutput').innerHTML = `<ul><li>Произошла ошибка в процессе "Фикс в 1 клик": ${e.message}</li></ul>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Фикс в 1 клик';
    }
};

// --- Валидация сервисов и характеристик ---
function validateServiceAndCharacteristics(json, errors, warnings, jsonStr, shTypes) {
    if (json.services && Array.isArray(json.services)) {
        json.services.forEach((service, serviceIndex) => {
            if (!service.type) {
                errors.push(`Сервис ${serviceIndex + 1}: Отсутствует поле type`);
                return;
            }
            const serviceDef = shTypes.find(t => t.type === service.type);
            if (!serviceDef) {
                errors.push(`Сервис ${service.type}: Тип сервиса не найден`);
                return;
            }
            if (!service.characteristics || !Array.isArray(service.characteristics)) {
                errors.push(`Сервис ${service.type}: Отсутствует или некорректно поле characteristics`);
                return;
            }
            service.characteristics.forEach((char, charIndex) => {
                if (!char.type) {
                    errors.push(`Сервис ${service.type}, характеристика ${charIndex + 1}: Отсутствует поле type`);
                    return;
                }
                const supportedCharacteristics = [
                    ...(serviceDef.required || []),
                    ...(serviceDef.optional || [])
                ];
                const charDef = supportedCharacteristics.find(c => c.type === char.type);
                if (!charDef) {
                    warnings.push(`Сервис ${service.type}: Характеристика ${char.type} не поддерживается`);
                }
            });
        });
    }
}

// --- Экспортируемые функции ---
if (typeof module !== 'undefined') {
    module.exports = {
        applyCorrections,
        validateServiceAndCharacteristics
    };
} 