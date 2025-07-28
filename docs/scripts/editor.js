// editor.js
// Модуль для инициализации редактора, автокомплита и работы с DOM
// Глобальные функции для использования в index.html и других js-файлах

window.addEventListener('DOMContentLoaded', function () {
    // --- Инициализация CodeMirror ---
    window.editor = CodeMirror.fromTextArea(document.getElementById('jsonEditor'), {
        mode: 'application/json',
        lineNumbers: true,
        indentUnit: 2,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        viewportMargin: Infinity,
        extraKeys: {
            'Ctrl-F': 'find',
            'Cmd-F': 'find',
            'Ctrl-R': 'replace',
            'Cmd-R': 'replace',
            'Ctrl-Z': 'undo',
            'Cmd-Z': 'undo',
            'Ctrl-Y': 'redo',
            'Cmd-Y': 'redo',
            'Ctrl-C': 'copy',
            'Cmd-C': 'copy',
            'Ctrl-V': 'paste',
            'Cmd-V': 'paste',
            'Ctrl-A': 'selectAll',
            'Cmd-A': 'selectAll',
            'Ctrl-Space': 'autocomplete',
            'Escape': function (cm) {
                // Закрываем автокомплит
                cm.execCommand('closeCompletion');
            }
        },
        historyEventDelay: 500,
        showHint: true,
        hintOptions: {
            completeSingle: false,
            alignWithWord: true
        }
    });

    // Восстановление значения из localStorage
    const savedJson = localStorage.getItem('jsonEditorValue');
    if (savedJson !== null) {
        window.editor.setValue(savedJson);
        window.editor.refresh();
    }

    // Сохранять значение при каждом изменении
    window.editor.on('change', function () {
        localStorage.setItem('jsonEditorValue', window.editor.getValue());
    });

    // Автоматический запуск автокомплита при вводе определенных символов
    window.editor.on('keyup', function (cm, event) {
        // Игнорируем навигационные клавиши
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
            event.key === 'Escape' || event.key === 'Tab' ||
            event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta') {
            return;
        }

        // Проверяем, что автокомплит не был только что закрыт
        if (window.autocompleteJustClosed) {
            window.autocompleteJustClosed = false;
            return;
        }

        // Запускаем автокомплит только при вводе определенных символов
        if (event.key && /[a-zA-Z0-9_$]/.test(event.key)) {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const beforeCursor = line.slice(0, cur.ch);

                    // Не запускаем автокомплит если:
        // 1. Курсор в конце строки после запятой
        // 2. Курсор в конце строки после открывающей скобки
        // 3. Курсор в конце строки после двоеточия
        if (!/^\s*[,{\[\s]*$/.test(beforeCursor)) {
            setTimeout(() => {
                cm.execCommand('autocomplete');
            }, 100);
        }
        }

        // Также запускаем автокомплит при вводе кавычек и двоеточия
        if (event.key === '"' || event.key === ':') {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const beforeCursor = line.slice(0, cur.ch);

            if (!/^\s*[,{\[\s]*$/.test(beforeCursor)) {
                setTimeout(() => {
                    cm.execCommand('autocomplete');
                }, 100);
            }
        }
    });

    // Обработка закрытия автокомплита и показ подсказок по Enter
    window.editor.on('keydown', function (cm, event) {
        if (event.key === 'Escape') {
            window.autocompleteJustClosed = true;
        }

        // Показываем подсказки по Enter
        if (event.key === 'Enter') {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const beforeCursor = line.slice(0, cur.ch);

            // Если курсор не в конце строки после запятой/скобки, показываем подсказки
            if (!/^\s*[,{\[\s]*$/.test(beforeCursor)) {
                setTimeout(() => {
                    cm.execCommand('autocomplete');
                }, 50);
            }
        }
    });

    // --- Схема аксессуара и автокомплит ---
    window.schema = {};
    window.allowedInputTypesFromSchema = [];
    window.schemaHintsTree = null;
    window.autocompleteJustClosed = false;

    // --- Сохранение позиции курсора ---
    window.lastCursorPosition = null;
    window.lastCursorPath = null;

    window.buildSchemaHintsTree = function (schema) {
        function walk(def, path = []) {
            let result = {};
            if (def.properties) {
                for (const key in def.properties) {
                    const prop = def.properties[key];

                    // Создаем объект для поля
                    const fieldObj = {
                        type: prop.type,
                        description: prop.description || '',
                        enum: prop.enum || null
                    };

                    // Если это объект с вложенными свойствами
                    if (prop.properties) {
                        fieldObj.properties = walk(prop, path.concat(key));
                    }

                    // Если это массив с items, то добавляем свойства items
                    if (prop.type === 'array' && prop.items) {
                        if (prop.items.properties) {
                            fieldObj.properties = walk(prop.items, path.concat(key));
                        } else if (prop.items.$ref) {
                            // Обрабатываем ссылки на определения
                            const refName = prop.items.$ref.replace('#/$defs/', '');
                            if (schema.$defs && schema.$defs[refName]) {
                                fieldObj.properties = walk(schema.$defs[refName], path.concat(key));
                            }
                        }
                    }

                    // Если есть $ref, то добавляем свойства из определения
                    if (prop.$ref) {
                        const refName = prop.$ref.replace('#/$defs/', '');
                        if (schema.$defs && schema.$defs[refName]) {
                            fieldObj.properties = walk(schema.$defs[refName], path.concat(key));
                        }
                    }

                    result[key] = fieldObj;
                }
            }
            return result;
        }

        // Создаем дерево подсказок из основных свойств схемы
        let result = {};
        if (schema.properties) {
            result = walk(schema);
        }

        // Добавляем определения из $defs как отдельные секции
        if (schema.$defs) {
            for (const defName in schema.$defs) {
                const def = schema.$defs[defName];
                if (def.properties) {
                    result[defName] = walk(def);
                }
            }
        }

        return result;
    };

    window.loadSchema = function (schemaFile) {
        fetch(schemaFile)
            .then(response => response.json())
            .then(data => {
                window.schema = data;
                window.schemaHintsTree = window.buildSchemaHintsTree(data);

                // --- Заполнение allowedInputTypesFromSchema ---
                let inputTypeEnum = [];
                if (
                    data.$defs &&
                    data.$defs.characteristic &&
                    data.$defs.characteristic.properties &&
                    data.$defs.characteristic.properties.inputType &&
                    Array.isArray(data.$defs.characteristic.properties.inputType.enum)
                ) {
                    inputTypeEnum = data.$defs.characteristic.properties.inputType.enum;
                }
                window.allowedInputTypesFromSchema = inputTypeEnum;

                // Важная диагностическая информация
                if (!window.schemaHintsTree) {
                    console.error('Ошибка: Дерево подсказок не создано');
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки схемы:', error);
                document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка загрузки схемы ${schemaFile}: ${error.message}</li></ul>`;
            });
    };
    window.loadSchema('accessory.json');

    // --- Работа с темами ---
    // Перенесено в utils.js

    // --- Загрузка sh_types.json ---
    window.shTypes = [];
    fetch('./sh_types.json')
        .then(response => response.json())
        .then(data => window.shTypes = data.result?.service?.types?.types || [])
        .catch(error => {
            console.error('Ошибка загрузки sh_types.json:', error);
            document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка загрузки sh_types.json: ${error.message}</li></ul>`;
        });

    // --- Выбор шаблона ---
    window.oneClickFixMode = false;
    window.selectedTemplateCallback = null;
    window.controllerLinkFields = null;
    fetch('controller_link_fields.json')
        .then(response => response.json())
        .then(data => window.controllerLinkFields = data)
        .catch(() => window.controllerLinkFields = null);

    function setControllerSelect(type) {
        const select = document.getElementById('controllerSelect');
        if (select && type && select.value !== type) {
            select.value = type;
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        }
    }

    // === АВТОДЕТЕКТ КОНТРОЛЛЕРА ПОСЛЕ ОПРЕДЕЛЕНИЯ ВСЕХ ФУНКЦИЙ ===
    window.selectTemplateWithDropdown = function (json, callback) {
        let templates = [];
        if (Array.isArray(json)) {
            templates = json;
        } else if (
            json && typeof json === 'object' &&
            Object.keys(json).length > 0 &&
            Object.keys(json).every(k => /^\d+$/.test(k))
        ) {
            templates = Object.values(json);
        } else {
            callback(json);
            return;
        }
        if (templates.length <= 1) {
            callback(templates[0]);
            return;
        }
        // Новый модальный диалог выбора шаблона без поиска
        window.showModalSelectDialog({
            title: 'Файл содержит несколько шаблонов. Выберите один:',
            items: templates,
            renderItem: (item, idx) => {
                return `<div class='modal-select-item-title'>${item.name || ''}</div><div class='modal-select-item-sub'>${item.manufacturer || 'без производителя'} / ${item.model || 'без модели'}</div>`;
            },
            onSelect: (item, idx) => {
                callback(item);
                if (window.oneClickFixMode) {
                    window.oneClickFixMode = false;
                    setTimeout(() => window.oneClickFixRun(), 100);
                }
            },
            enableSearch: false
        });
    };

    // === АВТОДЕТЕКТ КОНТРОЛЛЕРА ===
    const origSelectTemplateWithDropdown = window.selectTemplateWithDropdown;
    window.selectTemplateWithDropdown = function (json, callback) {
        origSelectTemplateWithDropdown(json, function (selectedIndexOrObj) {
            let template = selectedIndexOrObj;
            if (typeof selectedIndexOrObj === 'number') {
                let templates = Array.isArray(json) ? json : Object.values(json);
                template = templates[selectedIndexOrObj];
            }
            if (window.controllerLinkFields) {
                const detected = window.detectControllerType(template, window.controllerLinkFields);
                setControllerSelect(detected);
            }
            callback(selectedIndexOrObj);
        });
    };

    // --- Открытие файла ---
    document.getElementById('uploadFile').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    let fileContent = e.target.result;
                    fileContent = fileContent.replace(/^\uFEFF/, '');
                    let parsed = JSON.parse(fileContent);
                    document.getElementById('errorOutput').textContent = '';
                    document.getElementById('correctionOutput').textContent = '';
                    document.getElementById('autoFixContainer').innerHTML = '';
                    window.selectTemplateWithDropdown(parsed, (selectedTemplate) => {
                        window.editor.setValue(JSON.stringify(selectedTemplate, null, 2));
                        window.editor.refresh();
                    });
                } catch (err) {
                    document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка чтения файла: ${err.message}</li></ul>`;
                }
            };
            reader.readAsText(file);
        }
    });

    // --- Drag & Drop ---
    window.initDragAndDrop();

    // --- Инициализация панели инструментов ---
    window.initEditorToolbar();

    // --- Сохранение позиции курсора при изменениях ---
    function updateCursorPathMap() {
        const mapDiv = document.getElementById('cursorPathMap');
        if (!mapDiv) return;
        let value = window.editor.getValue();
        let cursor = window.lastCursorPosition;
        if (!cursor) {
            mapDiv.textContent = 'root';
            window.currentJsonCursorPath = [];
            return;
        }
        let lines = value.split('\n');
        let cursorLine = cursor.line;
        let json;
        try {
            json = JSON.parse(value);
        } catch (e) {
            mapDiv.textContent = 'root';
            window.currentJsonCursorPath = [];
            return;
        }

        function findPath(node, lineStart, lineEnd, path = [], typePath = []) {
            if (Array.isArray(node)) {
                let idx = 0;
                let curLine = lineStart + 1;
                for (const item of node) {
                    let itemStr = JSON.stringify(item, null, 2);
                    let itemLines = itemStr.split('\n').length;
                    let itemLineStart = curLine;
                    let itemLineEnd = curLine + itemLines - 1;
                    if (cursorLine >= itemLineStart && cursorLine <= itemLineEnd) {
                        let sub = findPath(item, itemLineStart, itemLineEnd, path.concat(idx), typePath.concat([{ key: idx, type: getType(item) }]));
                        return sub.length ? sub : typePath.concat([{ key: idx, type: getType(item) }]);
                    }
                    curLine = itemLineEnd + 1;
                    idx++;
                }
            } else if (typeof node === 'object' && node !== null) {
                let keys = Object.keys(node);
                for (const key of keys) {
                    let value = node[key];
                    let keyLine = -1;
                    for (let i = lineStart; i <= lineEnd; i++) {
                        if (lines[i] && lines[i].includes('"' + key + '"')) {
                            keyLine = i;
                            break;
                        }
                    }
                    if (keyLine !== -1) {
                        if (Array.isArray(value)) {
                            let arrStr = JSON.stringify(value, null, 2);
                            let arrLines = arrStr.split('\n').length;
                            let arrLineStart = keyLine + 1;
                            let arrLineEnd = arrLineStart + arrLines - 1;
                            if (cursorLine >= arrLineStart && cursorLine <= arrLineEnd) {
                                let sub = findPath(value, arrLineStart, arrLineEnd, path.concat(key), typePath.concat([{ key, type: 'array' }]));
                                return sub.length ? sub : typePath.concat([{ key, type: 'array' }]);
                            }
                        }
                    }
                }
            }
            return typePath;
        }

        function getType(node) {
            if (Array.isArray(node)) return 'array';
            if (typeof node === 'object' && node !== null) {
                if (node.type) return node.type;
                if (node.name) return node.name;
                return 'object';
            }
            return typeof node;
        }

        let typePath = findPath(json, 0, lines.length - 1, [], []);
        window.currentJsonCursorPath = typePath;
        // Для отображения карты пути оставляем старую логику
        let node = json;
        let result = [];
        let path = typePath.map(p => p.key);
        // root с NAME, MANUFACTURER, MODEL
        let rootName = node && node.name ? node.name : '';
        let rootManuf = (rootName === '') ? (node && node.manufacturer ? node.manufacturer : '') : '';
        let rootModel = (rootName === '') ? (node && node.model ? node.model : '') : '';
        let rootFields = [rootName, rootManuf, rootModel].filter(Boolean).join(' ');
        if (rootFields) {
            result.push(`root (${rootFields})`);
        } else {
            result.push('root');
        }
        for (let i = 0; i < path.length; i++) {
            let key = path[i];
            if (key === 'services' && typeof path[i + 1] === 'number') {
                let idx = path[i + 1];
                node = node.services && node.services[idx];
                let name = node && node.name ? node.name : '';
                let type = node && node.type ? node.type : '';
                let fields = [name, type].filter(Boolean).join('; ');
                if (fields) {
                    result.push(`Сервис ${idx} (${fields})`);
                } else {
                    result.push(`Сервис ${idx}`);
                }
                i++;
            } else if (key === 'characteristics' && typeof path[i + 1] === 'number') {
                let idx = path[i + 1];
                node = node.characteristics && node.characteristics[idx];
                let type = node && node.type ? node.type : '';
                if (type) {
                    result.push(`Характеристика ${idx} (${type})`);
                } else {
                    result.push(`Характеристика ${idx}`);
                }
                i++;
            } else if (key === 'options' && typeof path[i + 1] === 'number') {
                let idx = path[i + 1];
                node = node.options && node.options[idx];
                let name = node && node.name ? node.name : '';
                let type = node && node.type ? node.type : '';
                let fields = [name, type].filter(Boolean).join('; ');
                if (fields) {
                    result.push(`Опция ${idx} (${fields})`);
                } else {
                    result.push(`Опция ${idx}`);
                }
                i++;
            } else if (key === 'link' && typeof path[i + 1] === 'number') {
                let idx = path[i + 1];
                result.push(`Линк ${idx}`);
                i++;
            }
        }
        mapDiv.textContent = result.join(' > ');
    }

    window.editor.on('cursorActivity', function () {
        window.lastCursorPosition = window.editor.getCursor();
        window.lastCursorPath = window.getCurrentJsonPath(window.editor);
        updateCursorPathMap();
        // Обновляем видимость кнопок тулбара
        if (typeof window.updateToolbarButtonsVisibility === 'function') {
            window.updateToolbarButtonsVisibility();
        }
    });

    window.editor.on('focus', function () {
        window.lastCursorPosition = window.editor.getCursor();
        window.lastCursorPath = window.getCurrentJsonPath(window.editor);
        updateCursorPathMap();
        // Обновляем видимость кнопок тулбара
        if (typeof window.updateToolbarButtonsVisibility === 'function') {
            window.updateToolbarButtonsVisibility();
        }
    });

    // --- Форматирование JSON ---
    window.formatFromOneClick = false;
    window.formatJson = function () {
        try {
            const value = window.editor.getValue();
            if (!value.trim()) {
                document.getElementById('errorOutput').innerHTML = `<ul><li>Необходимо сперва открыть файл шаблона</li></ul>`;
                return;
            }
            if (!window.formatFromOneClick) {
                document.getElementById('errorOutput').textContent = '';
                document.getElementById('correctionOutput').textContent = '';
                document.getElementById('autoFixContainer').innerHTML = '';
            }
            const json = JSON.parse(value);
            window.editor.setValue(JSON.stringify(json, null, 2));
            if (!window.formatFromOneClick) {
                document.getElementById('correctionOutput').innerHTML = `<ul><li>Форматирование успешно выполнено</li></ul>`;
            }
            window.editor.refresh();
        } catch (e) {
            document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка форматирования: ${e.message}</li></ul>`;
        }
    };

    // --- Автокомплит ---
    window.getCurrentJsonPath = function (cm) {
        try {
            const pos = cm.getCursor();
            const lines = cm.getValue().split('\n');
            let upto = lines.slice(0, pos.line + 1).join('\n');
            upto = upto.slice(0, upto.length - (lines[pos.line].length - pos.ch));
            let path = [];
            let stack = [];
            let currentKey = '';
            let inString = false;
            let escape = false;
            let arrayIndex = 0;
            let inArray = false;
            let lastKey = '';

            for (let i = 0; i < upto.length; i++) {
                const c = upto[i];
                if (escape) {
                    escape = false;
                    continue;
                }
                if (c === '\\') {
                    escape = true;
                    continue;
                }
                if (c === '"') {
                    inString = !inString;
                    continue;
                }
                if (!inString) {
                    if (c === '{') {
                        stack.push('object');
                        inArray = false;
                        continue;
                    }
                    if (c === '[') {
                        stack.push('array');
                        inArray = true;
                        arrayIndex = 0;
                        continue;
                    }
                    if (c === '}') {
                        if (stack.length > 0 && stack[stack.length - 1] === 'object') {
                            stack.pop();
                            inArray = false;
                            if (stack.length <= 1) {
                                path = [];
                            }
                        }
                        continue;
                    }
                    if (c === ']') {
                        if (stack.length > 0 && stack[stack.length - 1] === 'array') {
                            stack.pop();
                            inArray = stack.length > 0 && stack[stack.length - 1] === 'array';
                        }
                        continue;
                    }
                    if (c === ':') {
                        if (currentKey.trim()) {
                            lastKey = currentKey.trim().replace(/"/g, '');
                            path.push(lastKey);
                            currentKey = '';
                        }
                        continue;
                    }
                    if (c === ',') {
                        if (inArray && stack.length > 0 && stack[stack.length - 1] === 'array') {
                            arrayIndex++;
                        }
                        currentKey = '';
                        continue;
                    }
                }
                if (inString) {
                    currentKey += c;
                }
            }

            if (inArray && stack.length > 0 && stack[stack.length - 1] === 'array') {
                path.push(arrayIndex);
            }

            if (stack.length <= 1) {
                const currentLine = lines[pos.line];
                const beforeCursor = currentLine.slice(0, pos.ch);
                const afterCursor = currentLine.slice(pos.ch);
                if (/^\s*,?\s*$/.test(beforeCursor) && /^\s*$/.test(afterCursor)) {
                    path = [];
                }
            }

            // Отладочная информация
    
            return path;
        } catch (e) {
            console.error('Error in getCurrentJsonPath:', e);
            return [];
        }
    };



    // Новая улучшенная функция для получения подсказок
    window.getHintsForPathImproved = function (path, tree) {
        let node = tree;
        if (path.length === 0) return node;

        for (let i = 0; i < path.length; i++) {
            const p = path[i];

            // Если это индекс массива, пропускаем (но сохраняем контекст)
            if (typeof p === 'number') {
                continue;
            }

            // Специальная обработка для link
            if (p === 'link') {
                if (window.schema && window.schema.$defs && window.schema.$defs.link && window.schema.$defs.link.properties) {
                    node = window.schema.$defs.link.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для services
            if (p === 'services') {
                if (window.schema && window.schema.$defs && window.schema.$defs.service && window.schema.$defs.service.properties) {
                    node = window.schema.$defs.service.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для characteristics
            if (p === 'characteristics') {
                if (window.schema && window.schema.$defs && window.schema.$defs.characteristic && window.schema.$defs.characteristic.properties) {
                    node = window.schema.$defs.characteristic.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для options
            if (p === 'options') {
                if (window.schema && window.schema.$defs && window.schema.$defs.characteristic && window.schema.$defs.characteristic.properties) {
                    node = window.schema.$defs.characteristic.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для init
            if (p === 'init') {
                if (window.schema && window.schema.$defs && window.schema.$defs.init && window.schema.$defs.init.properties) {
                    node = window.schema.$defs.init.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для data
            if (p === 'data') {
                if (window.schema && window.schema.$defs && window.schema.$defs.data && window.schema.$defs.data.properties) {
                    node = window.schema.$defs.data.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для logics
            if (p === 'logics') {
                if (window.schema && window.schema.$defs && window.schema.$defs.logics && window.schema.$defs.logics.properties) {
                    node = window.schema.$defs.logics.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для optional
            if (p === 'optional') {
                if (window.schema && window.schema.$defs && window.schema.$defs.optional && window.schema.$defs.optional.properties) {
                    node = window.schema.$defs.optional.properties;
                    continue; // Продолжаем навигацию
                }
            }

            // Специальная обработка для values
            if (p === 'values') {
                // values - это массив объектов с полями value, name, description
                const valuesSchema = {
                    value: { type: 'string', description: 'Value' },
                    name: { type: 'string', description: 'Name' },
                    description: { type: 'string', description: 'Description' }
                };
                node = valuesSchema;
                continue; // Продолжаем навигацию
            }

            // Специальная обработка для set/get (в link)
            if (p === 'set' || p === 'get') {
                const setGetSchema = {
                    method: { type: 'string', description: 'Method' },
                    param: { type: 'string', description: 'Parameter' }
                };
                node = setGetSchema;
                continue; // Продолжаем навигацию
            }

            // Специальная обработка для values (в characteristic)
            if (p === 'values') {
                // values - это массив объектов с полями value, name, description
                const valuesSchema = {
                    value: { type: 'string', description: 'Value' },
                    name: { type: 'string', description: 'Name' },
                    description: { type: 'string', description: 'Description' }
                };
                node = valuesSchema;
                continue; // Продолжаем навигацию
            }

            // Специальная обработка для map/outMap (в link)
            if (p === 'map' || p === 'outMap') {
                // map/outMap - это объекты с patternProperties
                // Внутри map/outMap можно добавлять любые строковые ключи
                const mapSchema = {
                    // patternProperties - любое поле может быть boolean, number, integer, string, object
                    "*": { type: 'string', description: 'Mapping value' }
                };
                node = mapSchema;
                continue; // Продолжаем навигацию
            }

            // Проверяем, есть ли определение в $defs
            if (window.schema && window.schema.$defs && window.schema.$defs[p] && window.schema.$defs[p].properties) {
                node = window.schema.$defs[p].properties;
                continue; // Продолжаем навигацию
            }

            // Обычная навигация по дереву
            if (node && node[p]) {
                if (node[p].properties) {
                    node = node[p].properties;
                } else if (node[p].type) {
                    // Если это поле с типом, но без properties, это конечный узел
                    // Не прерываем навигацию, продолжаем искать в родительском контексте
                    continue;
                } else {
                    node = node[p];
                }
            } else {
                // Если не найдено в дереве подсказок, попробуем найти в оригинальной схеме
                if (window.schema && window.schema.properties && window.schema.properties[p] && window.schema.properties[p].properties) {
                    node = window.schema.properties[p].properties;
                } else if (window.schema && window.schema.$defs) {
                    // Ищем в $defs
                    for (const defName in window.schema.$defs) {
                        const def = window.schema.$defs[defName];
                        if (def.properties && def.properties[p] && def.properties[p].properties) {
                            node = def.properties[p].properties;
                            break;
                        }
                    }
                }
                break;
            }
        }

        // Если мы не нашли правильный узел или нашли узел с типом, 
        // попробуем найти подходящий контекст в родительских узлах
        if (!node || typeof node === 'string' || (node.type && !node.properties)) {
            // Попробуем найти последний подходящий узел в пути
            let lastValidNode = tree;
            for (let i = 0; i < path.length; i++) {
                const p = path[i];
                if (typeof p === 'number') continue;

                // Проверяем специальные типы объектов
                if (p === 'services' && window.schema && window.schema.$defs && window.schema.$defs.service && window.schema.$defs.service.properties) {
                    lastValidNode = window.schema.$defs.service.properties;
                } else if (p === 'characteristics' && window.schema && window.schema.$defs && window.schema.$defs.characteristic && window.schema.$defs.characteristic.properties) {
                    lastValidNode = window.schema.$defs.characteristic.properties;
                } else if (p === 'options' && window.schema && window.schema.$defs && window.schema.$defs.characteristic && window.schema.$defs.characteristic.properties) {
                    lastValidNode = window.schema.$defs.characteristic.properties;
                } else if (p === 'link' && window.schema && window.schema.$defs && window.schema.$defs.link && window.schema.$defs.link.properties) {
                    lastValidNode = window.schema.$defs.link.properties;
                } else if (p === 'init' && window.schema && window.schema.$defs && window.schema.$defs.init && window.schema.$defs.init.properties) {
                    lastValidNode = window.schema.$defs.init.properties;
                } else if (p === 'data' && window.schema && window.schema.$defs && window.schema.$defs.data && window.schema.$defs.data.properties) {
                    lastValidNode = window.schema.$defs.data.properties;
                } else if (p === 'logics' && window.schema && window.schema.$defs && window.schema.$defs.logics && window.schema.$defs.logics.properties) {
                    lastValidNode = window.schema.$defs.logics.properties;
                } else if (p === 'optional' && window.schema && window.schema.$defs && window.schema.$defs.optional && window.schema.$defs.optional.properties) {
                    lastValidNode = window.schema.$defs.optional.properties;
                } else if (p === 'map' || p === 'outMap') {
                    // Для map/outMap создаем специальную схему с patternProperties
                    lastValidNode = {
                        "*": { type: 'string', description: 'Mapping value' }
                    };
                } else if (lastValidNode && lastValidNode[p] && lastValidNode[p].properties) {
                    lastValidNode = lastValidNode[p].properties;
                }
            }

            node = lastValidNode;
        }

        return node;
    };

    window.customJsonHint = function (cm) {

        if (!window.schemaHintsTree) {
            console.error('Ошибка автокомплита: schemaHintsTree не загружен');
            return;
        }

        // Добавляем стандартные JSON подсказки
        const standardJsonHints = [
            { text: 'true', displayText: 'true (boolean)', hint: function (cm, data, completion) { cm.replaceRange('true', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd }); } },
            { text: 'false', displayText: 'false (boolean)', hint: function (cm, data, completion) { cm.replaceRange('false', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd }); } },
            { text: 'null', displayText: 'null', hint: function (cm, data, completion) { cm.replaceRange('null', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd }); } }
        ];

        const cur = cm.getCursor();
        const token = cm.getTokenAt(cur);
        const path = window.getCurrentJsonPath(cm);
        let currentWord = '';
        let keyStart = cur.ch, keyEnd = cur.ch;
        const line = cm.getLine(cur.line);



        if (token && token.string && token.type === 'string') {
            // Убираем кавычки для получения чистого текста
            currentWord = token.string.replace(/^"|"$/g, '');
            keyStart = token.start;
            keyEnd = token.end;
        } else {
            const before = line.slice(0, cur.ch);
            // Ищем слово перед курсором (включая символы в кавычках)
            const match = before.match(/(["']?[\w$]+["']?)$/);
            if (match) {
                currentWord = match[1].replace(/^["']|["']$/g, '');
                keyStart = cur.ch - match[1].length;
            } else {
                currentWord = '';
                keyStart = cur.ch;
            }
            const after = line.slice(cur.ch);
            const matchAfter = after.match(/^([\w$]*)/);
            if (matchAfter) {
                keyEnd = cur.ch + matchAfter[1].length;
            } else {
                keyEnd = cur.ch;
            }
        }

        let key = null;
        if (path.length > 0) {
            key = path[path.length - 1];
        }

        let node = null;
        node = window.getHintsForPathImproved(path, window.schemaHintsTree);

        function isInValuePosition() {
            const before = line.slice(0, cur.ch);

            // Проверяем, находимся ли мы в ключе (между кавычками)
            if (token && token.type === 'string') {
                // Если мы внутри кавычек, но после двоеточия - это значение
                if (/\:\s*"/.test(before)) {
                    return true;
                }
                // Если мы внутри кавычек, но НЕ после двоеточия - это ключ
                return false;
            }

            // Проверяем различные случаи позиции значения
            if (token && token.state && token.state.lastType === 'colon') return true;
            if (/\:\s*$/.test(before)) return true;
            if (/\:\s+\S/.test(before) && !/\:\s*"/.test(before)) return true;

            // Дополнительные проверки для лучшего определения позиции значения
            if (/\:\s*[^"'\s]/.test(before)) return true;

            return false;
        }

        function isInsideObject() {
            const before = line.slice(0, cur.ch);
            const after = line.slice(cur.ch);

            // Проверяем, находимся ли мы внутри объекта (между { и })
            const beforeBrackets = before.match(/\{/g) || [];
            const beforeClosingBrackets = before.match(/\}/g) || [];
            const afterBrackets = after.match(/\{/g) || [];
            const afterClosingBrackets = after.match(/\}/g) || [];

            const openBrackets = beforeBrackets.length + afterBrackets.length;
            const closeBrackets = beforeClosingBrackets.length + afterClosingBrackets.length;

            // Если открывающих скобок больше закрывающих, мы внутри объекта
            return openBrackets > closeBrackets;
        }

        // Проверяем, что мы получили подсказки
        if (!node) {
            console.error('Ошибка автокомплита: не найдены подсказки для пути:', path);
            return {
                list: [],
                from: CodeMirror.Pos(cur.line, keyStart),
                to: CodeMirror.Pos(cur.line, keyEnd),
                completeSingle: false
            };
        }
        function createValueSuggestions(values, wrapInQuotes = true) {
            return values.map(v => {
                return {
                    text: wrapInQuotes ? `"${v}"` : v,
                    displayText: v,
                    hint: function (cm, data, completion) {
                        cm.replaceRange(wrapInQuotes ? `"${v}"` : v, { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                    }
                };
            });
        }
        if (isInValuePosition() && key && node && node[key]) {
            const field = node[key];

            // Проверяем enum в поле
            if (field.enum && field.enum.length > 0) {
                let enumList = createValueSuggestions(field.enum, true);
                if (currentWord && currentWord.length > 0) {
                    enumList = enumList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
                }
                return {
                    list: enumList,
                    from: CodeMirror.Pos(cur.line, keyStart),
                    to: CodeMirror.Pos(cur.line, keyEnd),
                    completeSingle: false
                };
            }

            // Если enum не найден в поле, попробуем найти в оригинальной схеме
            if (!field.enum && window.schema) {
                let originalField = null;

                // Ищем поле в основной схеме
                if (window.schema.properties && window.schema.properties[key]) {
                    originalField = window.schema.properties[key];
                }

                // Ищем в $defs
                if (!originalField && window.schema.$defs) {
                    for (const defName in window.schema.$defs) {
                        const def = window.schema.$defs[defName];
                        if (def.properties && def.properties[key]) {
                            originalField = def.properties[key];
                            break;
                        }
                    }
                }

                // Ищем в вложенных объектах по пути
                if (!originalField && path.length > 0) {
                    let currentSchema = window.schema;
                    for (let i = 0; i < path.length - 1; i++) {
                        const pathItem = path[i];
                        if (typeof pathItem === 'number') continue;

                        if (currentSchema.properties && currentSchema.properties[pathItem]) {
                            currentSchema = currentSchema.properties[pathItem];
                        } else if (currentSchema.$defs) {
                            for (const defName in currentSchema.$defs) {
                                const def = currentSchema.$defs[defName];
                                if (def.properties && def.properties[pathItem]) {
                                    currentSchema = def.properties[pathItem];
                                    break;
                                }
                            }
                        }
                    }

                    if (currentSchema && currentSchema.properties && currentSchema.properties[key]) {
                        originalField = currentSchema.properties[key];
                    }
                }

                if (originalField && originalField.enum && originalField.enum.length > 0) {
                    let enumList = createValueSuggestions(originalField.enum, true);
                    if (currentWord && currentWord.length > 0) {
                        enumList = enumList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
                    }
                    return {
                        list: enumList,
                        from: CodeMirror.Pos(cur.line, keyStart),
                        to: CodeMirror.Pos(cur.line, keyEnd),
                        completeSingle: false
                    };
                }
            }
            if (field.type === 'boolean') {
                let booleanList = createValueSuggestions(['true', 'false'], false);
                if (currentWord && currentWord.length > 0) {
                    booleanList = booleanList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
                }
                return {
                    list: booleanList,
                    from: CodeMirror.Pos(cur.line, keyStart),
                    to: CodeMirror.Pos(cur.line, keyEnd),
                    completeSingle: false
                };
            }
            if (field.type === 'string' && !field.enum) {
                let stringList = createValueSuggestions([''], true);
                if (currentWord && currentWord.length > 0) {
                    stringList = stringList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
                }
                return {
                    list: stringList,
                    from: CodeMirror.Pos(cur.line, keyStart),
                    to: CodeMirror.Pos(cur.line, keyEnd),
                    completeSingle: false
                };
            }
            if (field.type === 'object') {
                // Создаем подсказки для объектов
                let objectSuggestions = [];

                // Базовая подсказка для пустого объекта
                objectSuggestions.push({
                    text: '{}',
                    displayText: '{} (пустой объект)',
                    hint: function (cm, data, completion) {
                        cm.replaceRange('{}', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                    }
                });

                // Подсказка для объекта с правильным форматированием
                objectSuggestions.push({
                    text: '{\n  \n}',
                    displayText: '{...} (объект с полями)',
                    hint: function (cm, data, completion) {
                        const currentLine = cur.line;
                        const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                        const newIndent = indent + '  ';

                        // Заменяем текущую строку
                        cm.replaceRange('{\n' + newIndent + '\n' + indent + '}',
                            { line: currentLine, ch: keyStart },
                            { line: currentLine, ch: keyEnd });

                        // Устанавливаем курсор внутри объекта для ввода первого поля
                        setTimeout(() => {
                            cm.setCursor({ line: currentLine + 1, ch: newIndent.length });
                        }, 10);
                    }
                });

                // Если у поля есть properties, предлагаем подсказку с полями
                if (field.properties) {
                    const fieldNames = Object.keys(field.properties);
                    if (fieldNames.length > 0) {
                        objectSuggestions.push({
                            text: `{\n}`,
                            displayText: `{fields} (объект)`,
                            hint: function (cm, data, completion) {
                                const currentLine = cur.line;
                                const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                                const newIndent = indent + '  ';

                                const objectContent = fieldNames.slice(0, 3).map(field =>
                                    `${newIndent}"${field}": ""`
                                ).join(',\n');

                                const fullContent = `{\n${objectContent}\n${indent}}`;

                                cm.replaceRange(fullContent,
                                    { line: currentLine, ch: keyStart },
                                    { line: currentLine, ch: keyEnd });

                                // Устанавливаем курсор на первое поле
                                setTimeout(() => {
                                    cm.setCursor({ line: currentLine + 1, ch: newIndent.length + 1 });
                                }, 10);
                            }
                        });
                    }
                }

                // Фильтруем по текущему слову
                if (currentWord && currentWord.length > 0) {
                    objectSuggestions = objectSuggestions.filter(item =>
                        item.displayText.toLowerCase().includes(currentWord.toLowerCase())
                    );
                }

                return {
                    list: objectSuggestions,
                    from: CodeMirror.Pos(cur.line, keyStart),
                    to: CodeMirror.Pos(cur.line, keyEnd),
                    completeSingle: false
                };
            }
            if (field.type === 'array' || (Array.isArray(field.type) && field.type.includes('array'))) {
                // Создаем подсказки для массивов
                let arraySuggestions = [];

                // Базовая подсказка для пустого массива
                arraySuggestions.push({
                    text: '[]',
                    displayText: '[] (пустой массив)',
                    hint: function (cm, data, completion) {
                        cm.replaceRange('[]', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                    }
                });

                // Подсказка для массива с одним пустым объектом (с правильным форматированием)
                arraySuggestions.push({
                    text: '[\n  {}\n]',
                    displayText: '[{}] (массив с объектом)',
                    hint: function (cm, data, completion) {
                        const currentLine = cur.line;
                        const currentCh = cur.ch;
                        const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                        const newIndent = indent + '  ';

                        // Заменяем текущую строку
                        cm.replaceRange('[\n' + newIndent + '{}\n' + indent + ']',
                            { line: currentLine, ch: keyStart },
                            { line: currentLine, ch: keyEnd });

                        // Устанавливаем курсор внутри объекта
                        setTimeout(() => {
                            cm.setCursor({ line: currentLine + 1, ch: newIndent.length + 1 });
                        }, 10);
                    }
                });

                // Если у поля есть items с $ref, предлагаем более специфичную подсказку
                if (field.items && field.items.$ref) {
                    const refPath = field.items.$ref.replace('#/$defs/', '');
                    if (window.schema && window.schema.$defs && window.schema.$defs[refPath]) {
                        const refDef = window.schema.$defs[refPath];
                        if (refDef && refDef.properties) {
                            // Создаем подсказку с полями из $ref
                            const refFields = Object.keys(refDef.properties);
                            if (refFields.length > 0) {
                                arraySuggestions.push({
                                    text: `[\n  {\n}\n]`,
                                    displayText: `[{...}] (массив с ${refPath})`,
                                    hint: function (cm, data, completion) {
                                        const currentLine = cur.line;
                                        const currentCh = cur.ch;
                                        const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                                        const newIndent = indent + '  ';
                                        const fieldIndent = newIndent + '  ';

                                        const objectContent = refFields.slice(0, 3).map(field =>
                                            `${fieldIndent}"${field}": ""`
                                        ).join(',\n');

                                        const fullContent = `[\n${newIndent}{\n${objectContent}\n${newIndent}}\n${indent}]`;

                                        cm.replaceRange(fullContent,
                                            { line: currentLine, ch: keyStart },
                                            { line: currentLine, ch: keyEnd });

                                        // Устанавливаем курсор на первое поле
                                        setTimeout(() => {
                                            cm.setCursor({ line: currentLine + 2, ch: fieldIndent.length + 1 });
                                        }, 10);
                                    }
                                });
                            }
                        }
                    }
                }

                // Фильтруем по текущему слову
                if (currentWord && currentWord.length > 0) {
                    arraySuggestions = arraySuggestions.filter(item =>
                        item.displayText.toLowerCase().includes(currentWord.toLowerCase())
                    );
                }

                return {
                    list: arraySuggestions,
                    from: CodeMirror.Pos(cur.line, keyStart),
                    to: CodeMirror.Pos(cur.line, keyEnd),
                    completeSingle: false
                };
            }
            return {
                list: [],
                from: CodeMirror.Pos(cur.line, keyStart),
                to: CodeMirror.Pos(cur.line, keyEnd),
                completeSingle: false
            };
        }
        const list = [];
        if (node) {
            // Проверяем, находимся ли мы внутри объекта
            const insideObject = isInsideObject();

            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) {
                    if (currentWord && currentWord.length > 0 && !key.toLowerCase().includes(currentWord.toLowerCase())) continue;
                    const item = node[key];

                    // Если мы внутри объекта, показываем только поля этого объекта
                    // Если мы не внутри объекта, показываем все поля текущего уровня
                    if (insideObject && !item.properties) {
                        // Внутри объекта, но у поля нет properties - пропускаем
                        continue;
                    }

                    // Если мы не внутри объекта и это поле с типом array/object, 
                    // добавляем специальные подсказки для значений только для текущего поля
                    if (!insideObject && item && (item.type === 'array' || item.type === 'object')) {
                        // Проверяем, соответствует ли текущее слово названию поля
                        const isCurrentField = currentWord && currentWord.toLowerCase() === key.toLowerCase();

                        if (isCurrentField) {
                            // Добавляем подсказку для значения массива/объекта только для текущего поля
                            const valueSuggestions = [];

                            if (item.type === 'array') {
                                valueSuggestions.push({
                                    text: '[]',
                                    displayText: '[] (пустой массив)',
                                    render: function (el, self, data) {
                                        el.innerHTML = `<span style='font-weight:bold'>[]</span> <span style='color:#888'>пустой массив</span>`;
                                    },
                                    hint: function (cm, data, completion) {
                                        cm.replaceRange('[]', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                                    }
                                });

                                valueSuggestions.push({
                                    text: '[{}]',
                                    displayText: '[{}] (массив с объектом)',
                                    render: function (el, self, data) {
                                        el.innerHTML = `<span style='font-weight:bold'>[{}]</span> <span style='color:#888'>массив с объектом</span>`;
                                    },
                                    hint: function (cm, data, completion) {
                                        const currentLine = cur.line;
                                        const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                                        const newIndent = indent + '  ';
                                        cm.replaceRange('[\n' + newIndent + '{}\n' + indent + ']', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                                        setTimeout(() => {
                                            cm.setCursor({ line: currentLine + 1, ch: newIndent.length + 1 });
                                        }, 10);
                                    }
                                });
                            } else if (item.type === 'object') {
                                valueSuggestions.push({
                                    text: '{}',
                                    displayText: '{} (пустой объект)',
                                    render: function (el, self, data) {
                                        el.innerHTML = `<span style='font-weight:bold'>{}</span> <span style='color:#888'>пустой объект</span>`;
                                    },
                                    hint: function (cm, data, completion) {
                                        cm.replaceRange('{}', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                                    }
                                });

                                valueSuggestions.push({
                                    text: '{...}',
                                    displayText: '{...} (объект с полями)',
                                    render: function (el, self, data) {
                                        el.innerHTML = `<span style='font-weight:bold'>{...}</span> <span style='color:#888'>объект с полями</span>`;
                                    },
                                    hint: function (cm, data, completion) {
                                        const currentLine = cur.line;
                                        const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                                        const newIndent = indent + '  ';
                                        cm.replaceRange('{\n' + newIndent + '\n' + indent + '}', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                                        setTimeout(() => {
                                            cm.setCursor({ line: currentLine + 1, ch: newIndent.length });
                                        }, 10);
                                    }
                                });
                            }

                            // Добавляем подсказки значений в список
                            list.push(...valueSuggestions);
                        }
                    }

                    // Специальная обработка для полей с patternProperties (map, outMap)
                    if (key === '*' && item && item.type === 'string') {
                        // Это поле с patternProperties - предлагаем любые строковые ключи
                        const patternSuggestions = [
                            {
                                text: '"key"',
                                displayText: '"key" (любой ключ)',
                                render: function (el, self, data) {
                                    el.innerHTML = `<span style='font-weight:bold'>"key"</span> <span style='color:#888'>любой строковый ключ</span>`;
                                },
                                hint: function (cm, data, completion) {
                                    cm.replaceRange('"": ', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                                    // Устанавливаем курсор между кавычками
                                    setTimeout(() => {
                                        cm.setCursor({ line: cur.line, ch: cur.ch - 3 });
                                    }, 10);
                                }
                            }
                        ];

                        // Добавляем подсказки patternProperties в список
                        list.push(...patternSuggestions);
                    }

                    let displayText = key;
                    if (item && item.type) displayText += ` (${item.type})`;
                    list.push({
                        text: key,
                        displayText: displayText,
                        render: function (el, self, data) {
                            el.innerHTML = `<span style='font-weight:bold'>${key}</span> <span style='color:#888'>${item && item.type ? item.type : ''}</span> <span style='color:#0a0'>${item && item.enum ? '[' + item.enum.join(', ') + ']' : ''}</span><br><span style='font-size:smaller;color:#888'>${item && item.description ? item.description : ''}</span>`;
                        },
                        hint: function (cm, data, completion) {
                            // Если это поле с типом array, предлагаем значение массива
                            if (item && item.type === 'array') {
                                const currentLine = cur.line;
                                const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                                const newIndent = indent + '  ';

                                // Проверяем, есть ли $ref для items
                                let arrayValue = '[]';
                                if (item.items && item.items.$ref) {
                                    const refPath = item.items.$ref.replace('#/$defs/', '');
                                    if (window.schema && window.schema.$defs && window.schema.$defs[refPath]) {
                                        const refDef = window.schema.$defs[refPath];
                                        if (refDef && refDef.properties) {
                                            const refFields = Object.keys(refDef.properties);
                                            if (refFields.length > 0) {
                                                const objectContent = refFields.slice(0, 3).map(field =>
                                                    `${newIndent}"${field}": ""`
                                                ).join(',\n');

                                                arrayValue = `[\n${newIndent}{\n${objectContent}\n${newIndent}}\n${indent}]`;
                                            }
                                        }
                                    }
                                } else {
                                    // Простой массив с пустым объектом и запятой
                                    arrayValue = `[\n${newIndent}{}\n${indent}],`;
                                }

                                cm.replaceRange('"' + key + '": ' + arrayValue, { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });

                                // Устанавливаем курсор внутри первого объекта массива
                                setTimeout(() => {
                                    if (arrayValue.includes('{\n')) {
                                        cm.setCursor({ line: currentLine + 1, ch: newIndent.length + 1 });
                                    }
                                }, 10);
                            } else if (item && item.type === 'object') {
                                // Если это поле с типом object, предлагаем пустой объект
                                const currentLine = cur.line;
                                const indent = cm.getLine(currentLine).match(/^\s*/)[0];
                                const newIndent = indent + '  ';

                                let objectValue = '{}';
                                
                                // Для поля link добавляем пустой объект без полей
                                if (key === 'link') {
                                    objectValue = '{}';
                                } else if (item.properties) {
                                    const fieldNames = Object.keys(item.properties);
                                    if (fieldNames.length > 0) {
                                        const objectContent = fieldNames.slice(0, 3).map(field =>
                                            `${newIndent}"${field}": ""`
                                        ).join(',\n');

                                        objectValue = `{\n${objectContent}\n${indent}}`;
                                    }
                                } else {
                                    objectValue = `{\n${newIndent}\n${indent}}`;
                                }

                                cm.replaceRange('"' + key + '": ' + objectValue, { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });

                                // Устанавливаем курсор внутри объекта
                                setTimeout(() => {
                                    cm.setCursor({ line: currentLine + 1, ch: newIndent.length });
                                }, 10);
                            } else {
                                // Обычное поле
                                cm.replaceRange('"' + key + '": ', { line: cur.line, ch: keyStart }, { line: cur.line, ch: keyEnd });
                            }
                        }
                    });
                }
            }
        }

        // Объединяем кастомные подсказки со стандартными JSON подсказками
        const combinedList = [...list, ...standardJsonHints];

        // Для CodeMirror 5 нужно возвращать объект с правильной структурой
        return {
            list: combinedList,
            from: CodeMirror.Pos(cur.line, keyStart),
            to: CodeMirror.Pos(cur.line, keyEnd),
            completeSingle: false
        };
    };

    // Регистрируем нашу кастомную функцию автокомплита для JSON
    CodeMirror.registerHelper('hint', 'application/json', window.customJsonHint);
    CodeMirror.registerHelper('hint', 'json', window.customJsonHint);

    // --- Восстановление и применение темы ---
    window.initTheme();

    // --- Инициализация контекстного меню ---
    if (typeof window.initContextMenu === 'function') {
        window.initContextMenu();
    }
    
    if (typeof window.setupEditorContextMenu === 'function') {
        window.setupEditorContextMenu();
    }

}); // <-- Закрываю window.addEventListener('DOMContentLoaded', function() { ... });