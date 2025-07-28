// editor-toolbar.js
// Модуль для панели инструментов редактора

// Toast уведомления
window.showToast = function(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Показываем toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Скрываем и удаляем toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, duration);
};

// --- Управление видимостью кнопок тулбара в зависимости от позиции курсора ---
window.updateToolbarButtonsVisibility = function() {
    const path = window.currentJsonCursorPath || [];
    const addCharBtn = document.getElementById('addCharacteristicBtn');
    const addLinkBtn = document.getElementById('addLinkBtn');
    // Кнопка "Добавить характеристику" только если курсор внутри services/N
    let inService = false;
    if (path && path.length >= 2 && path[0].key === 'services' && typeof path[1].key === 'number') {
        inService = true;
    }
    if (addCharBtn) addCharBtn.style.display = inService ? '' : 'none';
    // Кнопка "Добавить линк" только если курсор внутри services/N/characteristics/M или options/N
    let inCharacteristic = false, inOption = false;
    if (path && path.length >= 4 && path[0].key === 'services' && typeof path[1].key === 'number' && path[2].key === 'characteristics' && typeof path[3].key === 'number') {
        inCharacteristic = true;
    }
    if (path && path.length >= 2 && path[0].key === 'options' && typeof path[1].key === 'number') {
        inOption = true;
    }
    if (addLinkBtn) addLinkBtn.style.display = (inCharacteristic || inOption) ? '' : 'none';
}

window.initEditorToolbar = function() {
    // Создаем панель инструментов
    const toolbar = document.createElement('div');
    toolbar.id = 'editorToolbar';
    toolbar.className = 'editor-toolbar';
    toolbar.innerHTML = `
        <div class="toolbar-section toolbar-row-1">
            <!-- Группа копирования/вставки -->
            <div class="toolbar-group">
                <button id="copyBtn" class="toolbar-btn" title="Копировать (Ctrl+C)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cm-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <rect x="3" y="3" width="13" height="13" rx="2"/>
                    </svg>
                </button>
                <button id="pasteBtn" class="toolbar-btn" title="Вставить (Ctrl+V)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cm-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                      <path d="M8 8h8v8H8z"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                      <line x1="8" y1="16" x2="16" y2="16"/>
                    </svg>
                </button>
            </div>
            
            <div class="toolbar-separator"></div>
            
            <!-- Группа отмены/повтора -->
            <div class="toolbar-group">
                <button id="undoBtn" class="toolbar-btn" title="Отменить (Ctrl+Z)">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 5L3 9L7 13" stroke="var(--cm-foreground)" stroke-width="2"/><path d="M3 9H11C13.2091 9 15 10.7909 15 13" stroke="var(--cm-foreground)" stroke-width="2"/></svg>
                </button>
                <button id="redoBtn" class="toolbar-btn" title="Повторить (Ctrl+Y)">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 5L15 9L11 13" stroke="var(--cm-foreground)" stroke-width="2"/><path d="M15 9H7C4.79086 9 3 10.7909 3 13" stroke="var(--cm-foreground)" stroke-width="2"/></svg>
                </button>
            </div>
            
            <div class="toolbar-separator"></div>
            
            <!-- Группа поиска/замены -->
            <div class="toolbar-group">
                <button id="findBtn" class="toolbar-btn" title="Найти (Ctrl+F)">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="5" stroke="var(--cm-foreground)" stroke-width="2"/><line x1="13" y1="13" x2="16" y2="16" stroke="var(--cm-foreground)" stroke-width="2"/></svg>
                </button>
                <button id="replaceBtn" class="toolbar-btn" title="Заменить (Ctrl+R)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cm-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12A10 10 0 0 1 12 2m0 0v4m0-4h-4"/>
                        <path d="M22 12A10 10 0 0 1 12 22m0 0v-4m0 4h4"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="toolbar-section toolbar-row-2">
            <!-- Контроллер -->
            <label for="controllerSelect" class="toolbar-label">Контроллер:</label>
            <select id="controllerSelect" class="toolbar-select">
                <option value="" selected disabled hidden>не выбрано</option>
                <option value="MQTT">MQTT</option>
                <option value="ZigBee">ZigBee</option>
                <option value="ModBus">ModBus</option>
                <option value="Xiaomi">Xiaomi</option>
                <option value="ZWave">ZWave</option>
            </select>
        </div>
        <div class="toolbar-section toolbar-row-3">
            <!-- Добавление элементов -->
            <span class="toolbar-label">Добавить:</span>
            <button id="addServiceBtn" class="toolbar-btn">Сервис</button>
            <button id="addCharacteristicBtn" class="toolbar-btn">Характеристику</button>
            <button id="addOptionBtn" class="toolbar-btn">Опцию</button>
            <button id="addLinkBtn" class="toolbar-btn">Линк</button>
        </div>
    `;

    // Вставляем панель перед редактором
    const editorContainer = document.getElementById('jsonEditor').parentElement;
    editorContainer.parentElement.insertBefore(toolbar, editorContainer);

    // Обработчики кнопок
    document.getElementById('undoBtn').addEventListener('click', () => {
        window.editor.undo();
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        window.editor.redo();
    });

    document.getElementById('findBtn').addEventListener('click', () => {
        window.editor.execCommand('find');
    });

    document.getElementById('replaceBtn').addEventListener('click', () => {
        window.editor.execCommand('replace');
    });

    // Функции добавления элементов
    document.getElementById('addServiceBtn').addEventListener('click', () => {
        addService();
    });

    document.getElementById('addCharacteristicBtn').addEventListener('click', () => {
        addCharacteristic();
    });

    document.getElementById('addLinkBtn').addEventListener('click', () => {
        addLink();
    });

    document.getElementById('addOptionBtn').addEventListener('click', () => {
        addOption();
    });

    // Обработчики кнопок копирования/вставки
    document.getElementById('copyBtn').addEventListener('click', () => {
        try {
            const selectedText = window.editor.getSelection();
            if (selectedText) {
                // Копируем выделенный текст
                navigator.clipboard.writeText(selectedText);
                window.showToast('Скопировано', 'success');
            } else {
                // Копируем весь текст
                navigator.clipboard.writeText(window.editor.getValue());
                window.showToast('Весь текст скопирован', 'success');
            }
        } catch (e) {
            console.error('Ошибка копирования:', e);
            window.showToast('Ошибка копирования', 'error');
        }
    });
    
    document.getElementById('pasteBtn').addEventListener('click', () => {
        try {
            navigator.clipboard.readText().then(text => {
                if (text) {
                    window.editor.replaceSelection(text);
                    window.showToast('Вставлено', 'success');
                }
            }).catch(e => {
                console.error('Ошибка вставки:', e);
                window.showToast('Ошибка вставки', 'error');
            });
        } catch (e) {
            console.error('Ошибка вставки:', e);
            window.showToast('Ошибка вставки', 'error');
        }
    });
    
    // Восстановить выбранный контроллер из localStorage
    const select = document.getElementById('controllerSelect');
    if (select) {
        const savedController = localStorage.getItem('selectedController');
        if (savedController && Array.from(select.options).some(opt => opt.value === savedController)) {
            select.value = savedController;
        }
        // Сохранять выбор контроллера в localStorage
        select.addEventListener('change', function() {
            localStorage.setItem('selectedController', select.value);
        });
    }

    setTimeout(updateToolbarButtonsVisibility, 0);
    if (window.editor) {
        window.editor.on('cursorActivity', updateToolbarButtonsVisibility);
        window.editor.on('focus', updateToolbarButtonsVisibility);
    }
    
    // Инициализация контекстного меню для панели инструментов
    if (typeof window.setupEditorContextMenu === 'function') {
        window.setupEditorContextMenu();
    }
    
    // Обновляем видимость элементов контекстного меню при изменении позиции курсора
    if (window.editor) {
        window.editor.on('cursorActivity', function() {
            if (typeof updateContextMenuVisibility === 'function' && window.isContextMenuVisible) {
                updateContextMenuVisibility();
            }
        });
    }
};

// Диалог выбора контроллера
window.showControllerSelectDialog = function(onSelect) {
    const controllers = [
        { name: 'MQTT', value: 'MQTT' },
        { name: 'ZigBee', value: 'ZigBee' },
        { name: 'ModBus', value: 'ModBus' },
        { name: 'Xiaomi', value: 'Xiaomi' },
        { name: 'ZWave', value: 'ZWave' }
    ];
    window.showModalSelectDialog({
        title: 'Выберите контроллер',
        items: controllers,
        renderItem: (item) => `<div class='modal-select-item-title'>${item.name}</div>`,
        onSelect: (item) => {
            if (onSelect) onSelect(item.value);
        },
        enableSearch: false
    });
};

// Функция создания пустого шаблона
window.createEmptyTemplate = function() {
    window.showControllerSelectDialog(function(controllerValue) {
        if (!controllerValue) return;
        // Установить выбранный контроллер в select
        const select = document.getElementById('controllerSelect');
        if (select) {
            select.value = controllerValue;
            // Вручную вызвать событие change, если есть обработчики
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        }
        // Создать пустой шаблон
        const emptyTemplate = {
            name: "",
            manufacturer: "",
            model: "",
            manufacturerId: "",
            modelId: "",
            catalogId: 0,
            services: []
        };
        window.editor.setValue(JSON.stringify(emptyTemplate, null, 2));
        window.editor.refresh();
        document.getElementById('errorOutput').textContent = '';
        document.getElementById('correctionOutput').textContent = '';
        document.getElementById('autoFixContainer').innerHTML = '';
    });
};

// --- Функция формирования объекта link по контроллеру и характеристике ---
function buildLinkForCharacteristic(service, characteristicType) {
    const controller = document.getElementById('controllerSelect').value;
    if (!controller || !window.controllerLinkFields || !window.shTypes) return { type: '' };
    const controllerFields = window.controllerLinkFields[controller] || {};
    const requiredFields = controllerFields.required || [];
    const linkObj = {};
    // Найти определение сервиса и характеристики в shTypes
    const serviceDef = window.shTypes.find(s => s.type === service.type);
    let charDef = null;
    if (serviceDef) {
        const allChars = [...(serviceDef.required || []), ...(serviceDef.optional || [])];
        charDef = allChars.find(c => c.type === characteristicType);
    }
    // Если у контроллера есть read/write алиасы, то добавлять только реальные поля из required, если read/write: true
    if (controllerFields.read || controllerFields.write) {
        if (charDef && controllerFields.read && charDef.read) {
            linkObj[controllerFields.read] = "";
        }
        if (charDef && controllerFields.write && charDef.write) {
            linkObj[controllerFields.write] = "";
        }
        // Добавлять остальные required поля, только если они не совпадают с read/write алиасами и не были добавлены выше
        requiredFields.forEach(field => {
            if ((controllerFields.read && charDef && charDef.read && controllerFields.read === field) ||
                (controllerFields.write && charDef && charDef.write && controllerFields.write === field)) {
                // Уже добавлено выше
                return;
            }
            // Если нет charDef (тип не выбран), добавлять все required
            if (!charDef) {
                linkObj[field] = "";
            }
        });
    } else {
        // Нет read/write алиасов — просто все required
        requiredFields.forEach(field => linkObj[field] = "");
    }
    linkObj.type = '';
    return linkObj;
}



// --- Функция для сохранения и восстановления позиции курсора ---
function saveAndRestoreCursorPosition(operation) {
    // Сохраняем текущую позицию курсора
    const currentPos = window.editor.getCursor();
    const currentScroll = window.editor.getScrollInfo();
    
    // Выполняем операцию
    operation();
    
    // Восстанавливаем позицию курсора после небольшой задержки
    setTimeout(() => {
        window.editor.setCursor(currentPos);
        window.editor.scrollTo(currentScroll.left, currentScroll.top);
        window.editor.focus();
    }, 10);
}



// --- Модифицирую addService ---
function addService() {
    try {
        window.showServiceSelectDialog(function(service) {
            saveAndRestoreCursorPosition(() => {
                const json = JSON.parse(window.editor.getValue());
                const path = window.currentJsonCursorPath || [];
                
                // Определяем позицию вставки сервиса
                let insertIndex = json.services ? json.services.length : 0;
                
                // Если курсор находится в сервисе, вставляем после него
                if (path.length >= 2 && path[0].key === 'services' && typeof path[1].key === 'number') {
                    insertIndex = path[1].key + 1;
                }
                
                // Добавляем сервис в нужную позицию
                if (!json.services) json.services = [];
                json.services.splice(insertIndex, 0, service);
                
                window.editor.setValue(JSON.stringify(json, null, 2));
                window.editor.refresh();
                window.showToast('Сервис добавлен', 'success');
            });
        });
    } catch (error) {
        window.showToast('Ошибка при добавлении сервиса: ' + error.message, 'error');
    }
}

// --- Модифицирую addCharacteristic ---
function addCharacteristic() {
    try {
        const jsonText = window.editor.getValue();
        if (!jsonText.trim()) {
            window.showToast('Сначала создайте пустой шаблон', 'warning');
            return;
        }
        const json = JSON.parse(jsonText);
        if (!json.services || json.services.length === 0) {
            window.showToast('Сначала добавьте сервис', 'warning');
            return;
        }
        
        const path = window.currentJsonCursorPath || [];
        let targetServiceIndex = 0;
        let serviceType = null;
        
        // Проверяем, находится ли курсор в сервисе
        if (path.length >= 2 && path[0].key === 'services' && typeof path[1].key === 'number') {
            targetServiceIndex = path[1].key;
            serviceType = path[1].type;
        } else {
            // Если курсор не в сервисе, показываем предупреждение
            window.showToast('Поставьте курсор в сервис для добавления характеристики', 'warning');
            return;
        }
        
        const service = json.services[targetServiceIndex];
        if (!service.characteristics) {
            service.characteristics = [];
        }
        
        let serviceDef = null;
        if (window.shTypes && serviceType) {
            serviceDef = window.shTypes.find(s => s.type === serviceType);
        }
        
        window.showCharacteristicSelectDialog(serviceDef || service, function(selectedChars) {
            if (!Array.isArray(selectedChars) || selectedChars.length === 0) {
                window.showToast('Не выбраны характеристики', 'warning');
                return;
            }
            
            saveAndRestoreCursorPosition(() => {
                // Собираем уже существующие типы характеристик
                const existingTypes = new Set((service.characteristics || []).map(c => c.type));
                
                // Определяем позицию вставки характеристики
                let insertIndex = service.characteristics.length;
                if (path.length >= 4 && path[2].key === 'characteristics' && typeof path[3].key === 'number') {
                    // Если курсор на характеристике, вставляем после неё
                    insertIndex = path[3].key + 1;
                }
                
                // Добавляем только уникальные характеристики
                let added = 0;
                selectedChars.forEach(char => {
                    if (!existingTypes.has(char.type)) {
                        const newChar = {
                            type: char.type || '',
                            link: [buildLinkForCharacteristic(service, char.type || '')]
                        };
                        
                        // Вставляем в нужную позицию
                        service.characteristics.splice(insertIndex, 0, newChar);
                        existingTypes.add(char.type);
                        added++;
                        insertIndex++; // Сдвигаем позицию для следующей характеристики
                    }
                });
                
                window.editor.setValue(JSON.stringify(json, null, 2));
                window.editor.refresh();
                
                if (added > 0) {
                    window.showToast(`Характеристики добавлены в сервис ${targetServiceIndex + 1}`, 'success');
                } else {
                    window.showToast('Все выбранные характеристики уже есть в сервисе', 'warning');
                }
            });
        });
    } catch (error) {
        window.showToast('Ошибка при добавлении характеристики: ' + error.message, 'error');
    }
}

function addLink() {
    try {
        const jsonText = window.editor.getValue();
        if (!jsonText.trim()) {
            window.showToast('Сначала создайте пустой шаблон', 'warning');
            return;
        }
        const json = JSON.parse(jsonText);
        const path = window.currentJsonCursorPath || [];
        let linkAdded = false;
        let targetInfo = '';

        saveAndRestoreCursorPosition(() => {
            // --- Если курсор на link (root > ... > Линк N) ---
            if (path.length >= 6 && path[path.length-2].key === 'link' && typeof path[path.length-1].key === 'number') {
                // Родитель — характеристика или опция
                let parentPath = path.slice(0, path.length-2);
                if (parentPath.length >= 4 && parentPath[0].key === 'services' && typeof parentPath[1].key === 'number' && parentPath[2].key === 'characteristics' && typeof parentPath[3].key === 'number') {
                    const serviceIndex = parentPath[1].key;
                    const characteristicIndex = parentPath[3].key;
                    const characteristic = json.services[serviceIndex].characteristics[characteristicIndex];
                    if (Array.isArray(characteristic.link)) {
                        // Вставляем после текущего линка
                        const currentLinkIndex = path[path.length-1].key;
                        characteristic.link.splice(currentLinkIndex + 1, 0, buildLinkForCharacteristic(json.services[serviceIndex], characteristic.type));
                        linkAdded = true;
                        targetInfo = `к характеристике ${characteristicIndex + 1} сервиса ${serviceIndex + 1}`;
                    }
                } else if (parentPath.length >= 2 && parentPath[0].key === 'options' && typeof parentPath[1].key === 'number') {
                    const optionIndex = parentPath[1].key;
                    const option = json.options[optionIndex];
                    if (Array.isArray(option.link)) {
                        // Вставляем после текущего линка
                        const currentLinkIndex = path[path.length-1].key;
                        option.link.splice(currentLinkIndex + 1, 0, { name: "", type: "" });
                        linkAdded = true;
                        targetInfo = `к опции ${optionIndex + 1}`;
                    }
                }
            }
            // --- Если курсор на характеристике ---
            else if (path.length >= 4 && path[0].key === 'services' && typeof path[1].key === 'number' && path[2].key === 'characteristics' && typeof path[3].key === 'number') {
                const serviceIndex = path[1].key;
                const characteristicIndex = path[3].key;
                const characteristic = json.services[serviceIndex].characteristics[characteristicIndex];
                if (!characteristic.link) {
                    characteristic.link = [buildLinkForCharacteristic(json.services[serviceIndex], characteristic.type)];
                    linkAdded = true;
                    targetInfo = `к характеристике ${characteristicIndex + 1} сервиса ${serviceIndex + 1}`;
                } else if (Array.isArray(characteristic.link)) {
                    characteristic.link.push(buildLinkForCharacteristic(json.services[serviceIndex], characteristic.type));
                    linkAdded = true;
                    targetInfo = `к характеристике ${characteristicIndex + 1} сервиса ${serviceIndex + 1}`;
                } else {
                    // Если link не массив, преобразуем в массив
                    characteristic.link = [characteristic.link, buildLinkForCharacteristic(json.services[serviceIndex], characteristic.type)];
                    linkAdded = true;
                    targetInfo = `к характеристике ${characteristicIndex + 1} сервиса ${serviceIndex + 1}`;
                }
            }
            // --- Если курсор на опции ---
            else if (path.length >= 2 && path[0].key === 'options' && typeof path[1].key === 'number') {
                const optionIndex = path[1].key;
                const option = json.options[optionIndex];
                if (!option.link) {
                    option.link = [{ name: "", type: "" }];
                    linkAdded = true;
                    targetInfo = `к опции ${optionIndex + 1}`;
                } else if (Array.isArray(option.link)) {
                    option.link.push({ name: "", type: "" });
                    linkAdded = true;
                    targetInfo = `к опции ${optionIndex + 1}`;
                } else {
                    // Если link не массив, преобразуем в массив
                    option.link = [option.link, { name: "", type: "" }];
                    linkAdded = true;
                    targetInfo = `к опции ${optionIndex + 1}`;
                }
            }
            
            if (!linkAdded) {
                window.showToast('Для добавления линка выберите характеристику, опцию или сам link', 'warning');
                return;
            }
            
            window.editor.setValue(JSON.stringify(json, null, 2));
            window.editor.refresh();
            window.showToast(`Линк добавлен ${targetInfo}`, 'success');
        });
    } catch (error) {
        window.showToast('Ошибка при добавлении линка: ' + error.message, 'error');
    }
}

// Карта описаний для inputType
const inputTypeDescriptions = {
    'GROUP': 'Группа',
    'FOLDER': 'Папка',
    'BUTTON': 'Кнопка',
    'NUMBER': 'Число',
    'TEXT': 'Текст',
    'PASSWORD': 'Пароль',
    'CHECKBOX': 'Флажок',
    'STATUS': 'Статус',
    'URL': 'URL',
    'INFO': 'Информация',
    'EMAIL': 'Email',
    'HTML': 'HTML',
    'IP_ADDR': 'IP адрес',
    'PINCODE': 'PIN код',
    'QR_CODE': 'QR код',
    'LIST': 'Список'
};

// Диалог выбора inputType для опций
window.showInputTypeSelectDialog = function(onSelect) {
    // Получаем доступные типы из схемы
    const availableTypes = window.allowedInputTypesFromSchema || [];
    
    // Создаем список с описаниями
    const inputTypes = availableTypes.map(type => ({
        name: inputTypeDescriptions[type] || type, // Если нет описания, показываем сам тип
        value: type
    }));
    
    if (inputTypes.length === 0) {
        console.error('Нет доступных типов опций. availableTypes:', availableTypes);
        window.showToast('Нет доступных типов опций', 'warning');
        return;
    }
    
    window.showModalSelectDialog({
        title: 'Выберите тип опции',
        items: inputTypes,
        renderItem: (item) => `<div class='modal-select-item-title'>${item.name}</div><div class='modal-select-item-sub'>${item.value}</div>`,
        onSelect: (item) => {
            if (onSelect) onSelect(item.value);
        },
        enableSearch: true,
        searchFields: ['name', 'value'] // Поиск по обоим полям
    });
};

function addOption() {
    try {
        const jsonText = window.editor.getValue();
        if (!jsonText.trim()) {
            window.showToast('Сначала создайте пустой шаблон', 'warning');
            return;
        }
        const json = JSON.parse(jsonText);
        
        // Инициализируем options если его нет
        if (!json.options) {
            json.options = [];
        }
        
        const path = window.currentJsonCursorPath || [];
        
        // Показываем диалог выбора inputType
        window.showInputTypeSelectDialog(function(selectedInputType) {
            if (!selectedInputType) {
                window.showToast('Тип опции не выбран', 'warning');
                return;
            }
            
            saveAndRestoreCursorPosition(() => {
                // Определяем позицию вставки опции
                let insertIndex = json.options.length;
                if (path.length >= 2 && path[0].key === 'options' && typeof path[1].key === 'number') {
                    // Если курсор на опции, вставляем после неё
                    insertIndex = path[1].key + 1;
                }
                
                            // Получаем выбранный контроллер
            const controller = document.getElementById('controllerSelect').value;
            let linkObj = { type: "" }; // Обязательное поле type
            
            if (controller && window.controllerLinkFields && window.controllerLinkFields[controller]) {
                const controllerFields = window.controllerLinkFields[controller];
                const requiredFields = controllerFields.required || [];
                const readField = controllerFields.read;
                const writeField = controllerFields.write;
                
                // Собираем все уникальные поля
                const allFields = new Set();
                
                // Добавляем required поля
                requiredFields.forEach(field => allFields.add(field));
                
                // Добавляем read/write поля, если они есть
                if (readField) allFields.add(readField);
                if (writeField) allFields.add(writeField);
                
                // Создаем объект линка с пустыми значениями
                allFields.forEach(field => {
                    linkObj[field] = "";
                });
            } else {
                // Если контроллер не выбран или нет полей, создаем базовый линк
                linkObj = { name: "", type: "" };
            }
            
            // Добавляем новую опцию в нужную позицию с выбранным inputType и линком
            const newOption = {
                name: "",
                type: "",
                inputType: selectedInputType,
                link: [linkObj]
            };
            json.options.splice(insertIndex, 0, newOption);
                
                // Обновляем редактор
                window.editor.setValue(JSON.stringify(json, null, 2));
                window.editor.refresh();
                window.showToast('Опция добавлена', 'success');
            });
        });
    } catch (error) {
        window.showToast('Ошибка при добавлении опции: ' + error.message, 'error');
    }
}

// Универсальный модальный диалог выбора
window.showModalSelectDialog = function({
    title = '',
    items = [],
    renderItem = null,
    onSelect = null,
    enableSearch = true,
    multi = false,
    selected = [],
    footerHtml = '',
    onFooterBtn = null,
    searchFields = null
}) {
    const dialog = document.getElementById('modalSelectDialog');
    const titleEl = document.getElementById('modalSelectTitle');
    const closeBtn = document.getElementById('modalSelectCloseBtn');
    const searchInput = document.getElementById('modalSelectSearch');
    const listEl = document.getElementById('modalSelectList');
    const footerEl = document.getElementById('modalSelectFooter');

    let filteredItems = items.slice();
    let selectedSet = new Set(selected);

    function renderList() {
        listEl.innerHTML = '';
        filteredItems.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = 'modal-select-item' + (selectedSet.has(idx) ? ' selected' : '');
            if (renderItem) {
                el.innerHTML = renderItem(item, idx, selectedSet.has(idx));
            } else {
                el.innerHTML = `<div class='modal-select-item-title'>${item.name || ''}</div><div class='modal-select-item-sub'>${item.type || ''}</div>`;
            }
            el.addEventListener('click', () => {
                if (multi) {
                    if (selectedSet.has(idx)) selectedSet.delete(idx); else selectedSet.add(idx);
                    renderList();
                } else {
                    dialog.style.display = 'none';
                    if (onSelect) onSelect(item, idx);
                }
            });
            listEl.appendChild(el);
        });
    }

    function filterList() {
        const q = searchInput.value.trim().toLowerCase();
        filteredItems = items.filter(item => {
            if (searchFields) {
                // Поиск по указанным полям
                return searchFields.some(field => {
                    const value = item[field];
                    return value && value.toLowerCase().includes(q);
                });
            } else {
                // Стандартный поиск по name и type
                return (item.name && item.name.toLowerCase().includes(q)) ||
                       (item.type && item.type.toLowerCase().includes(q));
            }
        });
        renderList();
    }

    titleEl.textContent = title;
    searchInput.value = '';
    searchInput.style.display = enableSearch ? '' : 'none';
    footerEl.innerHTML = footerHtml || '';
    dialog.style.display = 'flex';
    filterList();
    if (enableSearch) searchInput.focus();

    searchInput.oninput = filterList;
    closeBtn.onclick = () => { dialog.style.display = 'none'; };
    footerEl.onclick = (e) => {
        if (onFooterBtn) onFooterBtn(Array.from(selectedSet).map(i => filteredItems[i]), e);
    };

    // Для мультивыбора возвращаем по кнопке в футере
    if (multi && footerHtml) {
        // do nothing, handled by onFooterBtn
    }
};

// Диалог выбора сервиса (сортировка по name)
window.showServiceSelectDialog = function(onServiceAdded) {
    const sorted = (window.shTypes || []).slice().sort((a, b) => {
        if (!a.name) return 1;
        if (!b.name) return -1;
        return a.name.localeCompare(b.name, 'ru', {sensitivity: 'base'});
    });
    window.showModalSelectDialog({
        title: 'Выберите сервис',
        items: sorted,
        renderItem: (item) => `<div class='modal-select-item-title'>${item.name || ''}</div><div class='modal-select-item-sub'>${item.type || ''}</div>`,
        onSelect: (service) => {
            if (!service) return;
            // После выбора сервиса сразу открываем выбор характеристик
            window.showCharacteristicSelectDialog(service, function(selectedChars) {
                if (!Array.isArray(selectedChars) || selectedChars.length === 0) {
                    window.showToast('Не выбраны характеристики', 'warning');
                    return;
                }
                
                // Создаем сервис с выбранными характеристиками
                const characteristics = selectedChars.map(char => ({
                    type: char.type || '',
                    link: [buildLinkForCharacteristic(service, char.type || '')]
                }));
                
                const serviceWithCharacteristics = {
                    name: service.name || '',
                    type: service.type || '',
                    characteristics
                };
                
                // Передаем созданный сервис в callback
                if (typeof onServiceAdded === 'function') onServiceAdded(serviceWithCharacteristics);
            }, true); // showBackButton = true
        }
    });
};

// Диалог выбора характеристик (required/optional, чекбоксы, секции)
window.showCharacteristicSelectDialog = function(service, onDone, showBackButton = false) {
    // Формируем массив характеристик с name и type
    const getCharObj = (t) => (typeof t === 'object' ? t : { type: t });
    const required = (service.required || []).map(getCharObj);
    const optional = (service.optional || []).map(getCharObj);
    // Собираем все типы характеристик, которые уже есть в required/optional
    const usedTypes = new Set([...required, ...optional].map(c => c.type));
    // --- Глобальный список всех уникальных характеристик по type из всех сервисов ---
    let globalAllChars = [];
    if (window.shTypes) {
        const all = [];
        window.shTypes.forEach(s => {
            if (Array.isArray(s.required)) all.push(...s.required.map(getCharObj));
            if (Array.isArray(s.optional)) all.push(...s.optional.map(getCharObj));
        });
        // Уникальные по type
        const seen = new Set();
        globalAllChars = all.filter(c => {
            if (!c.type || seen.has(c.type)) return false;
            seen.add(c.type);
            return true;
        });
    }
    // Остальные характеристики — те, которых нет в required/optional текущего сервиса
    let otherChars = globalAllChars.filter(c => !usedTypes.has(c.type));
    // Сортировка по имени (name, если нет — по type)
    const sortByName = (a, b) => {
        const nameA = (a.name || a.type || '').toLowerCase();
        const nameB = (b.name || b.type || '').toLowerCase();
        return nameA.localeCompare(nameB, 'ru', {sensitivity: 'base'});
    };
    let sortedRequired = required.slice().sort(sortByName);
    let sortedOptional = optional.filter(c => c.type !== 'Name').sort(sortByName);
    otherChars = otherChars.slice().sort(sortByName);
    const allChars = [
        ...sortedRequired.map(c => ({...c, required: true, section: 'required'})),
        ...sortedOptional.map(c => ({...c, required: false, section: 'optional'})),
        ...otherChars.map(c => ({...c, required: false, section: 'other'})),
    ];
    let selected = new Set(sortedRequired.map((c, i) => i));
    // --- UI для секций ---
    let otherSectionId = 'modal-select-char-other-section';
    let otherListId = 'modal-select-char-other-list';
    const listHtml = [
        sortedRequired.length ? `<div class='modal-select-char-section'>Обязательные характеристики</div>` : '',
        ...sortedRequired.map((item, idx) =>
            `<div class='modal-select-char-item'>
                <span class='modal-select-char-title'>${item.name || item.type} <span style='font-size:11px;color:#888;'>(${item.type})</span></span>
                <input type='checkbox' class='modal-select-char-checkbox' data-idx='${idx}' checked />
            </div>`
        ),
        sortedOptional.length ? `<div class='modal-select-char-section'>Опциональные характеристики</div>` : '',
        ...sortedOptional.map((item, idx) =>
            `<div class='modal-select-char-item'>
                <span class='modal-select-char-title'>${item.name || item.type} <span style='font-size:11px;color:#888;'>(${item.type})</span></span>
                <input type='checkbox' class='modal-select-char-checkbox' data-idx='${sortedRequired.length + idx}' />
            </div>`
        ),
        otherChars.length ? `<div class='modal-select-char-section' id='${otherSectionId}' style='cursor:pointer;user-select:none;'>Остальные характеристики <span style='font-size:smaller;color:#888;'>(устройства с нестандартными характеристиками могут не прокидываться в другие системы)</span> <span id='${otherSectionId}-arrow' style='font-size:12px;'>&#9654;</span></div>` : '',
        otherChars.length ? `<div id='${otherListId}' style='display:none;'>` : '',
        ...otherChars.map((item, idx) =>
            `<div class='modal-select-char-item'>
                <span class='modal-select-char-title'>${item.name || item.type} <span style='font-size:11px;color:#888;'>(${item.type})</span></span>
                <input type='checkbox' class='modal-select-char-checkbox' data-idx='${sortedRequired.length + sortedOptional.length + idx}' />
            </div>`
        ),
        otherChars.length ? `</div>` : ''
    ].join('');
    const dialog = document.getElementById('modalSelectDialog');
    const titleEl = document.getElementById('modalSelectTitle');
    const listEl = document.getElementById('modalSelectList');
    const footerEl = document.getElementById('modalSelectFooter');
    const closeBtn = document.getElementById('modalSelectCloseBtn');
    const backBtn = document.getElementById('modalSelectBackBtn');
    const searchContainer = document.getElementById('modalSelectSearch').parentElement;
    // Скрываем поиск для характеристик
    searchContainer.style.display = 'none';
    // Показываем кнопку Назад только если showBackButton === true
    backBtn.style.display = showBackButton ? '' : 'none';
    // В заголовке указываем тип сервиса
    let serviceType = service && service.type ? service.type : '';
    titleEl.textContent = 'Выберите характеристики' + (serviceType ? ` (Сервис: ${serviceType})` : '');
    listEl.innerHTML = listHtml;
    footerEl.innerHTML = `<button id='modalCharDoneBtn' class='toolbar-btn'>Готово</button>`;
    dialog.style.display = 'flex';
    // --- Логика сворачивания/разворачивания секции ---
    if (otherChars.length) {
        const section = document.getElementById(otherSectionId);
        const list = document.getElementById(otherListId);
        const arrow = document.getElementById(otherSectionId+'-arrow');
        if (section && list && arrow) {
            section.addEventListener('click', function() {
                if (list.style.display === 'none') {
                    list.style.display = '';
                    arrow.innerHTML = '&#9660;';
                } else {
                    list.style.display = 'none';
                    arrow.innerHTML = '&#9654;';
                }
            });
        }
    }
    // Обработка чекбоксов и клика по строке
    listEl.querySelectorAll('.modal-select-char-item').forEach((row, i) => {
        const cb = row.querySelector('.modal-select-char-checkbox');
        // Только обязательные включены по умолчанию
        if (i >= sortedRequired.length) cb.checked = false;
        cb.addEventListener('change', function(e) {
            const idx = parseInt(cb.getAttribute('data-idx'), 10);
            if (cb.checked) selected.add(idx); else selected.delete(idx);
        });
        row.addEventListener('click', function(e) {
            if (e.target === cb) return; // не переключать дважды
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });
    });
    // Кнопка Готово
    document.getElementById('modalCharDoneBtn').onclick = function() {
        dialog.style.display = 'none';
        backBtn.style.display = 'none';
        searchContainer.style.display = '';
        // Проверка на уникальность type в выбранных характеристиках
        const result = [];
        const seenTypes = new Set();
        Array.from(selected).sort((a, b) => a - b).forEach(i => {
            const char = allChars[i];
            if (!seenTypes.has(char.type)) {
                result.push(char);
                seenTypes.add(char.type);
            }
        });
        if (onDone) onDone(result);
    };
    // Кнопка Назад
    backBtn.onclick = function() {
        dialog.style.display = 'none';
        backBtn.style.display = 'none';
        searchContainer.style.display = '';
        window.showServiceSelectDialog(function(newService) {
            if (newService) window.showCharacteristicSelectDialog(newService, onDone);
        });
    };
    closeBtn.onclick = () => { dialog.style.display = 'none'; backBtn.style.display = 'none'; searchContainer.style.display = ''; };
};

// --- Закрытие модальных окон по клику вне окна и по Esc ---
(function() {
    const dialog = document.getElementById('modalSelectDialog');
    if (!dialog) return;
    // Клик вне окна
    dialog.addEventListener('mousedown', function(e) {
        if (e.target === dialog) {
            dialog.style.display = 'none';
            const backBtn = document.getElementById('modalSelectBackBtn');
            const searchContainer = document.getElementById('modalSelectSearch').parentElement;
            if (backBtn) backBtn.style.display = 'none';
            if (searchContainer) searchContainer.style.display = '';
        }
    });
    // Esc
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && dialog.style.display === 'flex') {
            dialog.style.display = 'none';
            const backBtn = document.getElementById('modalSelectBackBtn');
            const searchContainer = document.getElementById('modalSelectSearch').parentElement;
            if (backBtn) backBtn.style.display = 'none';
            if (searchContainer) searchContainer.style.display = '';
        }
    });
})();