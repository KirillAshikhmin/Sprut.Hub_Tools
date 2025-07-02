// editor.js
// Модуль для инициализации редактора, автокомплита и работы с DOM
// Глобальные функции для использования в index.html и других js-файлах

window.addEventListener('DOMContentLoaded', function() {
// --- Инициализация CodeMirror ---
window.editor = CodeMirror.fromTextArea(document.getElementById('jsonEditor'), {
    mode: 'application/json',
    lineNumbers: true,
    indentUnit: 2,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    viewportMargin: Infinity
});

// --- Схема аксессуара и автокомплит ---
window.schema = {};
window.allowedInputTypesFromSchema = [];
window.schemaHintsTree = null;

window.buildSchemaHintsTree = function(schema) {
    function walk(def, path = []) {
        let result = {};
        if (def.properties) {
            for (const key in def.properties) {
                const prop = def.properties[key];
                result[key] = {
                    type: prop.type,
                    description: prop.description || '',
                    enum: prop.enum || null,
                    properties: prop.properties ? walk(prop, path.concat(key)) : null
                };
            }
        }
        return result;
    }
    let tree = {};
    if (schema.properties) {
        tree = walk(schema);
    }
    return tree;
};

window.loadSchema = function(schemaFile) {
    fetch(schemaFile)
        .then(response => response.json())
        .then(data => {
            window.schema = data;
            window.schemaHintsTree = window.buildSchemaHintsTree(data);

            // --- Заполнение allowedInputTypesFromSchema ---
            let inputTypeEnum = [];
            if (
                data.definitions &&
                data.definitions.characteristic &&
                data.definitions.characteristic.properties &&
                data.definitions.characteristic.properties.inputType &&
                Array.isArray(data.definitions.characteristic.properties.inputType.enum)
            ) {
                inputTypeEnum = data.definitions.characteristic.properties.inputType.enum;
            }
            window.allowedInputTypesFromSchema = inputTypeEnum;
            console.log('allowedInputTypesFromSchema:', window.allowedInputTypesFromSchema);
        })
        .catch(error => {
            console.error('Ошибка загрузки схемы:', error);
            document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка загрузки схемы ${schemaFile}: ${error.message}</li></ul>`;
        });
};
window.loadSchema('accessory_full_optimized.json');

// --- Работа с темами ---
window.changeTheme = function() {
    const themeSelect = document.getElementById('themeSelect');
    const theme = themeSelect.value;
    let effectiveTheme = theme;
    if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.body.className = effectiveTheme;
    localStorage.setItem('theme', theme);
    window.editor.setOption('theme', effectiveTheme === 'dark' ? 'dracula' : 'default');
};
const savedTheme = localStorage.getItem('theme') || 'system';
document.getElementById('themeSelect').value = savedTheme;
window.changeTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.getElementById('themeSelect').value === 'system') {
        window.changeTheme();
    }
});

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
window.selectTemplateWithDropdown = function(json, callback) {
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
    const select = document.getElementById('templateSelect');
    select.innerHTML = '';
    templates.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = `Name: ${template.name || ''}, Manufacturer: ${template.manufacturer || 'без производителя'}, Model: ${template.model || 'без модели'}`;
        select.appendChild(option);
    });
    window.selectedTemplateCallback = (selectedIndex) => {
        callback(selectedIndex);
        if (window.oneClickFixMode) {
            window.oneClickFixMode = false;
            setTimeout(() => window.oneClickFixRun(), 100);
        }
    };
    document.getElementById('templateDialog').style.display = 'block';
};
window.confirmTemplateSelection = function() {
    const select = document.getElementById('templateSelect');
    const selectedIndex = parseInt(select.value);
    document.getElementById('templateDialog').style.display = 'none';
    if (window.selectedTemplateCallback) {
        window.selectedTemplateCallback(selectedIndex);
    }
};

// --- Загрузка файла ---
document.getElementById('uploadFile').addEventListener('change', function(event) {
    window.oneClickFixMode = false;
    const file = event.target.files[0];
    if (file) {
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
                if (
                    (Array.isArray(parsed) && parsed.length > 1) ||
                    (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 1 && Object.keys(parsed).every(k => /^\d+$/.test(k)))
                ) {
                    window.selectTemplateWithDropdown(parsed, (selectedIndex) => {
                        let templates = Array.isArray(parsed) ? parsed : Object.values(parsed);
                        const selectedTemplate = templates[selectedIndex];
                        window.editor.setValue(JSON.stringify(selectedTemplate, null, 2));
                        window.editor.refresh();
                    });
                } else {
                    const template = Array.isArray(parsed) ? parsed[0] : parsed;
                    window.editor.setValue(JSON.stringify(template, null, 2));
                    window.editor.refresh();
                }
            } catch (err) {
                document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка чтения файла: ${err.message}</li></ul>`;
            }
        };
        reader.readAsText(file);
    }
});

// --- Drag & Drop ---
window.dropZone = document.getElementById('dropZone');
window.dragCounter = 0;
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    window.dragCounter++;
    window.dropZone.classList.add('active');
});
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});
document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    window.dragCounter--;
    if (window.dragCounter === 0) {
        window.dropZone.classList.remove('active');
    }
});
document.addEventListener('drop', (e) => {
    e.preventDefault();
    window.dragCounter = 0;
    window.dropZone.classList.remove('active');
    window.oneClickFixMode = false;
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                let fileContent = e.target.result;
                fileContent = fileContent.replace(/^\uFEFF/, '');
                const json = JSON.parse(fileContent);
                window.selectTemplateWithDropdown(json, (selectedIndex) => {
                    const selectedTemplate = Array.isArray(json) ? json[selectedIndex] : json;
                    window.editor.setValue(JSON.stringify(selectedTemplate, null, 2));
                    document.getElementById('errorOutput').textContent = '';
                    document.getElementById('correctionOutput').textContent = '';
                    document.getElementById('autoFixContainer').innerHTML = '';
                    window.editor.refresh();
                });
            } catch (e) {
                document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка синтаксиса JSON: ${e.message}</li></ul>`;
            }
        };
        reader.readAsText(file);
    } else {
        document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка: Перетащите файл в формате JSON</li></ul>`;
    }
});

// --- Форматирование JSON ---
window.formatFromOneClick = false;
window.formatJson = function() {
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
window.getCurrentJsonPath = function(cm) {
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
            if (escape) { escape = false; continue; }
            if (c === '\\') { escape = true; continue; }
            if (c === '"') { inString = !inString; continue; }
            if (!inString) {
                if (c === '{') { stack.push('object'); inArray = false; continue; }
                if (c === '[') { stack.push('array'); inArray = true; arrayIndex = 0; continue; }
                if (c === '}') { if (stack.length > 0 && stack[stack.length - 1] === 'object') { stack.pop(); inArray = false; if (stack.length <= 1) { path = []; } } continue; }
                if (c === ']') { if (stack.length > 0 && stack[stack.length - 1] === 'array') { stack.pop(); inArray = stack.length > 0 && stack[stack.length - 1] === 'array'; } continue; }
                if (c === ':') { if (currentKey.trim()) { lastKey = currentKey.trim().replace(/"/g, ''); path.push(lastKey); currentKey = ''; } continue; }
                if (c === ',') { if (inArray && stack.length > 0 && stack[stack.length - 1] === 'array') { arrayIndex++; } currentKey = ''; continue; }
            }
            if (inString) { currentKey += c; }
        }
        if (inArray && stack.length > 0 && stack[stack.length - 1] === 'array') { path.push(arrayIndex); }
        if (stack.length <= 1) {
            const currentLine = lines[pos.line];
            const beforeCursor = currentLine.slice(0, pos.ch);
            const afterCursor = currentLine.slice(pos.ch);
            if (/^\s*,?\s*$/.test(beforeCursor) && /^\s*$/.test(afterCursor)) { path = []; }
        }
        return path;
    } catch (e) { console.error('Error in getCurrentJsonPath:', e); return []; }
};

window.getHintsForPath = function(path, tree) {
    let node = tree;
    if (path.length === 0) return node;
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        if (typeof p === 'number') continue;
        if (p === 'link') {
            if (window.schema && window.schema.definitions && window.schema.definitions.link && window.schema.definitions.link.properties) {
                node = window.schema.definitions.link.properties;
                break;
            }
        }
        if (p === 'characteristics') {
            if (window.schema && window.schema.definitions && window.schema.definitions.characteristic && window.schema.definitions.characteristic.properties) {
                node = window.schema.definitions.characteristic.properties;
                break;
            }
        }
        if (p === 'options') {
            if (window.schema && window.schema.definitions && window.schema.definitions.characteristic && window.schema.definitions.characteristic.properties) {
                node = window.schema.definitions.characteristic.properties;
            }
        }
        if (node && node[p]) {
            if (node[p].properties) {
                node = node[p].properties;
            } else {
                node = node[p];
            }
        } else {
            break;
        }
    }
    return node;
};

CodeMirror.registerHelper('hint', 'json', function(cm) {
    if (!window.schemaHintsTree) return;
    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);
    const path = window.getCurrentJsonPath(cm);
    let currentWord = '';
    let keyStart = cur.ch, keyEnd = cur.ch;
    const line = cm.getLine(cur.line);
    if (token && token.string && token.type === 'string') {
        currentWord = token.string.replace(/^"|"$/g, '');
        keyStart = token.start;
        keyEnd = token.end;
    } else {
        const before = line.slice(0, cur.ch);
        const match = before.match(/([\w$]+)$/);
        if (match) {
            currentWord = match[1];
            keyStart = cur.ch - currentWord.length;
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
    node = window.getHintsForPath(path, window.schemaHintsTree);
    function isInValuePosition() {
        const before = line.slice(0, cur.ch);
        if (token && token.state && token.state.lastType === 'colon') return true;
        if (token && token.type === 'string') return true;
        if (/\:\s*$/.test(before)) return true;
        if (/\:\s*"/.test(before) && token && token.type === 'string') return true;
        if (/\:\s+\S/.test(before) && !/\:\s*"/.test(before)) return true;
        return false;
    }
    function createValueSuggestions(values, wrapInQuotes = true) {
        return values.map(v => {
            return {
                text: wrapInQuotes ? `"${v}"` : v,
                displayText: v,
                hint: function(cm, data, completion) {
                    cm.replaceRange(wrapInQuotes ? `"${v}"` : v, {line: cur.line, ch: keyStart}, {line: cur.line, ch: keyEnd});
                }
            };
        });
    }
    if (isInValuePosition() && key && node && node[key]) {
        const field = node[key];
        if (field.enum && field.enum.length > 0) {
            let enumList = createValueSuggestions(field.enum, true);
            if (currentWord && currentWord.length > 0) {
                enumList = enumList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
            }
            return {
                list: enumList,
                from: keyStart,
                to: keyEnd,
                completeSingle: false
            };
        }
        if (field.type === 'boolean') {
            let booleanList = createValueSuggestions(['true', 'false'], false);
            if (currentWord && currentWord.length > 0) {
                booleanList = booleanList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
            }
            return {
                list: booleanList,
                from: keyStart,
                to: keyEnd,
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
                from: keyStart,
                to: keyEnd,
                completeSingle: false
            };
        }
        if (field.type === 'object') {
            let objectList = createValueSuggestions(['{}'], false);
            if (currentWord && currentWord.length > 0) {
                objectList = objectList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
            }
            return {
                list: objectList,
                from: keyStart,
                to: keyEnd,
                completeSingle: false
            };
        }
        if (field.type === 'array' || (Array.isArray(field.type) && field.type.includes('array'))) {
            let arrayList = createValueSuggestions(['[]'], false);
            if (currentWord && currentWord.length > 0) {
                arrayList = arrayList.filter(item => item.displayText.toLowerCase().includes(currentWord.toLowerCase()));
            }
            return {
                list: arrayList,
                from: keyStart,
                to: keyEnd,
                completeSingle: false
            };
        }
        return { list: [], from: keyStart, to: keyEnd, completeSingle: false };
    }
    const list = [];
    if (node) {
        for (const key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key)) {
                if (currentWord && currentWord.length > 0 && !key.toLowerCase().includes(currentWord.toLowerCase())) continue;
                const item = node[key];
                let displayText = key;
                if (item && item.type) displayText += ` (${item.type})`;
                if (item && item.enum) displayText += ` [${item.enum.join(', ')}]`;
                list.push({
                    text: key,
                    displayText: displayText,
                    render: function(el, self, data) {
                        el.innerHTML = `<span style='font-weight:bold'>${key}</span> <span style='color:#888'>${item && item.type ? item.type : ''}</span> <span style='color:#0a0'>${item && item.enum ? '['+item.enum.join(', ')+']' : ''}</span><br><span style='font-size:smaller;color:#888'>${item && item.description ? item.description : ''}</span>`;
                    },
                    hint: function(cm, data, completion) {
                        cm.replaceRange('"' + key + '": ', {line: cur.line, ch: keyStart}, {line: cur.line, ch: keyEnd});
                    }
                });
            }
        }
    }
    list.sort((a, b) => a.text.localeCompare(b.text));
    let from = keyStart;
    let to = keyEnd;
    return {
        list: list,
        from,
        to,
        completeSingle: false
    };
});

window.editor.on('inputRead', function(cm, change) {
    if (change.text[0] && /[\w\{\[\:"]/.test(change.text[0])) {
        cm.showHint({completeSingle: false});
    }
    if (change.text[0] === ' ') {
        const cur = cm.getCursor();
        const line = cm.getLine(cur.line);
        const before = line.slice(0, cur.ch);
        if (/\:\s*$/.test(before)) {
            setTimeout(() => cm.showHint({completeSingle: false}), 10);
        }
    }
});

// --- Скачивание JSON ---
window.downloadTemplate = function() {
    try {
        const json = JSON.parse(window.editor.getValue());
        if (Array.isArray(json)) {
            document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка: Введите один шаблон (объект JSON), а не массив</li></ul>`;
            return;
        }
        const manufacturer = (json.manufacturer || 'unknown').replace(/\s+/g, '_');
        const model = (json.model || 'unknown').replace(/\s+/g, '_');
        const filename = `${manufacturer}_${model}.json`;
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        document.getElementById('errorOutput').innerHTML = `<ul><li>Ошибка скачивания: ${e.message}</li></ul>`;
    }
};

// --- Восстановление состояния чекбокса oneClickOpenFileCheckbox ---
(function() {
    const openFileCheckbox = document.getElementById('oneClickOpenFileCheckbox');
    openFileCheckbox.checked = localStorage.getItem('oneClickOpenFileCheckbox') === 'true';
    openFileCheckbox.addEventListener('change', function() {
        localStorage.setItem('oneClickOpenFileCheckbox', openFileCheckbox.checked);
    });
})();
}); 