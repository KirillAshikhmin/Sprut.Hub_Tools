// context-menu.js
// Модуль для контекстного меню редактора

// Глобальные переменные
let contextMenu = null;
let isContextMenuVisible = false;

    // Инициализация контекстного меню
window.initContextMenu = function() {
    contextMenu = document.getElementById('contextMenu');
    
    if (!contextMenu) {
        console.error('Ошибка контекстного меню: элемент contextMenu не найден');
        return;
    }
    
    // Обработчики событий для контекстного меню
    setupContextMenuEventListeners();
    
    // Обработчики для скрытия меню
    setupContextMenuHideListeners();
    
    // Инициализируем видимость элементов
    updateContextMenuVisibility();
};

// Настройка обработчиков событий для контекстного меню
function setupContextMenuEventListeners() {
    // Обработчик клика по элементам меню
    contextMenu.addEventListener('click', function(e) {
        const menuItem = e.target.closest('.context-menu-item');
        if (!menuItem) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const action = menuItem.getAttribute('data-action');
        if (action) {
            executeContextMenuAction(action);
        }
        
        hideContextMenu();
    });
    
    // Предотвращение всплытия событий
    contextMenu.addEventListener('mousedown', function(e) {
        e.stopPropagation();
    });
    
    contextMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// Настройка обработчиков для скрытия контекстного меню
function setupContextMenuHideListeners() {
    // Скрытие по клику вне меню
    document.addEventListener('click', function(e) {
        if (isContextMenuVisible && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    // Скрытие по нажатию Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isContextMenuVisible) {
            hideContextMenu();
        }
    });
    
    // Скрытие при прокрутке
    document.addEventListener('scroll', function() {
        if (isContextMenuVisible) {
            hideContextMenu();
        }
    });
}

// Показать контекстное меню
window.showContextMenu = function(x, y, event) {
    if (!contextMenu || !window.editor) return;
    
    // Предотвращаем стандартное контекстное меню браузера
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Позиционируем меню
    positionContextMenu(x, y);
    
    // Показываем меню
    isContextMenuVisible = true;
    
    // Фокус на редактор для корректной работы горячих клавиш
    setTimeout(() => {
        window.editor.focus();
    }, 10);
};

// Скрыть контекстное меню
function hideContextMenu() {
    if (!contextMenu) return;
    
    contextMenu.style.display = 'none';
    isContextMenuVisible = false;
}

// Позиционирование контекстного меню
function positionContextMenu(x, y) {
    if (!contextMenu) return;
    
    // Сначала показываем меню, чтобы получить его размеры
    contextMenu.style.display = 'block';
    contextMenu.style.visibility = 'hidden';
    
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Корректируем позицию, чтобы меню не выходило за границы экрана
    let adjustedX = x;
    let adjustedY = y;
    
    // Проверяем правую границу
    if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 10;
    }
    
    // Проверяем нижнюю границу
    if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 10;
    }
    
    // Проверяем левую границу
    if (adjustedX < 10) {
        adjustedX = 10;
    }
    
    // Проверяем верхнюю границу
    if (adjustedY < 10) {
        adjustedY = 10;
    }
    
    // Дополнительная проверка для мобильных устройств
    if (window.innerWidth <= 768) {
        // На мобильных устройствах центрируем меню по горизонтали
        adjustedX = Math.max(10, (viewportWidth - menuRect.width) / 2);
    }
    
    contextMenu.style.left = adjustedX + 'px';
    contextMenu.style.top = adjustedY + 'px';
    contextMenu.style.visibility = 'visible';
}

// Выполнение действий контекстного меню
function executeContextMenuAction(action) {
    if (!window.editor) return;
    
    switch (action) {
        case 'selectAll':
            window.editor.execCommand('selectAll');
            break;
            
        case 'copy':
            try {
                const selectedText = window.editor.getSelection();
                if (selectedText) {
                    navigator.clipboard.writeText(selectedText);
                    window.showToast('Скопировано', 'success');
                } else {
                    // Если ничего не выделено, копируем весь текст
                    navigator.clipboard.writeText(window.editor.getValue());
                    window.showToast('Весь текст скопирован', 'success');
                }
            } catch (e) {
                window.showToast('Ошибка копирования', 'error');
            }
            break;
            
        case 'paste':
            navigator.clipboard.readText().then(text => {
                window.editor.replaceSelection(text);
                window.showToast('Вставлено', 'success');
            }).catch(e => {
                window.showToast('Ошибка вставки', 'error');
            });
            break;
            
        case 'undo':
            window.editor.undo();
            break;
            
        case 'redo':
            window.editor.redo();
            break;
            
        case 'find':
            window.editor.execCommand('find');
            break;
            
        case 'replace':
            window.editor.execCommand('replace');
            break;
            
                    case 'addService':
                if (typeof addService === 'function') {
                    addService();
                } else {
                    console.error('Ошибка контекстного меню: функция addService не найдена');
                }
                break;
            
                    case 'addCharacteristic':
                if (typeof addCharacteristic === 'function') {
                    addCharacteristic();
                } else {
                    console.error('Ошибка контекстного меню: функция addCharacteristic не найдена');
                }
                break;
            
                    case 'addOption':
                if (typeof addOption === 'function') {
                    addOption();
                } else {
                    console.error('Ошибка контекстного меню: функция addOption не найдена');
                }
                break;
            
                    case 'addLink':
                if (typeof addLink === 'function') {
                    addLink();
                } else {
                    console.error('Ошибка контекстного меню: функция addLink не найдена');
                }
                break;
            
                    case 'fixRequirements':
                if (typeof correctJson === 'function') {
                    correctJson();
                } else {
                    console.error('Ошибка контекстного меню: функция correctJson не найдена');
                }
                break;
            
                    case 'validate':
                if (typeof validateJson === 'function') {
                    validateJson();
                } else {
                    console.error('Ошибка контекстного меню: функция validateJson не найдена');
                }
                break;
            
                    case 'format':
                if (typeof formatJson === 'function') {
                    formatJson();
                } else {
                    console.error('Ошибка контекстного меню: функция formatJson не найдена');
                }
                break;
            
        default:
            console.error('Ошибка контекстного меню: неизвестное действие:', action);
            break;
    }
}

// Настройка контекстного меню для редактора CodeMirror
window.setupEditorContextMenu = function() {
    if (!window.editor) return;
    
    // Обработчик правого клика в редакторе
    window.editor.getWrapperElement().addEventListener('contextmenu', function(e) {
        // Получаем координаты клика
        const rect = window.editor.getWrapperElement().getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // Обновляем видимость элементов меню в зависимости от позиции курсора
        updateContextMenuVisibility();
        
        // Показываем контекстное меню
        window.showContextMenu(x, y, e);
    });
    
    // Добавляем поддержку горячих клавиш для контекстного меню
    setupContextMenuHotkeys();
};

// Обновление видимости элементов контекстного меню
function updateContextMenuVisibility() {
    if (!contextMenu) return;
    
    const path = window.currentJsonCursorPath || [];
    
    // Элементы для добавления объектов
    const addCharItem = contextMenu.querySelector('[data-action="addCharacteristic"]');
    const addLinkItem = contextMenu.querySelector('[data-action="addLink"]');
    
    // Кнопка "Добавить характеристику" только если курсор внутри services/N
    let inService = false;
    if (path && path.length >= 2 && path[0].key === 'services' && typeof path[1].key === 'number') {
        inService = true;
    }
    if (addCharItem) addCharItem.style.display = inService ? '' : 'none';
    
    // Кнопка "Добавить линк" только если курсор внутри services/N/characteristics/M или options/N
    let inCharacteristic = false, inOption = false;
    if (path && path.length >= 4 && path[0].key === 'services' && typeof path[1].key === 'number' && path[2].key === 'characteristics' && typeof path[3].key === 'number') {
        inCharacteristic = true;
    }
    if (path && path.length >= 2 && path[0].key === 'options' && typeof path[1].key === 'number') {
        inOption = true;
    }
    if (addLinkItem) addLinkItem.style.display = (inCharacteristic || inOption) ? '' : 'none';
}

// Настройка горячих клавиш для контекстного меню
function setupContextMenuHotkeys() {
    document.addEventListener('keydown', function(e) {
        // Проверяем, что редактор в фокусе
        if (!window.editor || !window.editor.hasFocus()) return;
        
        // Проверяем комбинации клавиш
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'a':
                    e.preventDefault();
                    executeContextMenuAction('selectAll');
                    break;
                case 'c':
                    e.preventDefault();
                    executeContextMenuAction('copy');
                    break;
                case 'v':
                    e.preventDefault();
                    executeContextMenuAction('paste');
                    break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        executeContextMenuAction('redo');
                    } else {
                        executeContextMenuAction('undo');
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    executeContextMenuAction('redo');
                    break;
                case 'f':
                    e.preventDefault();
                    executeContextMenuAction('find');
                    break;
                case 'r':
                    e.preventDefault();
                    executeContextMenuAction('replace');
                    break;
            }
        }
    });
}

// Экспорт функций для глобального использования
window.hideContextMenu = hideContextMenu;
window.updateContextMenuVisibility = updateContextMenuVisibility; 