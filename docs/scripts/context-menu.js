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
        if (contextMenu && contextMenu.style.display !== 'none' && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    // Скрытие по нажатию Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && contextMenu && contextMenu.style.display !== 'none') {
            hideContextMenu();
        }
    });
}

// Позиционирование контекстного меню
function positionContextMenu(x, y) {
    if (!contextMenu) return;
    
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Корректируем позицию, чтобы меню не выходило за границы экрана
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 10;
    }
    
    if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 10;
    }
    
    // Убеждаемся, что меню не выходит за левую и верхнюю границы
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);
    
    contextMenu.style.left = adjustedX + 'px';
    contextMenu.style.top = adjustedY + 'px';
}

// Показать контекстное меню
window.showContextMenu = function(x, y, event) {
    if (!contextMenu || !window.editor) {
        console.error('showContextMenu: contextMenu или editor не найдены');
        return;
    }
    
    // Предотвращаем стандартное контекстное меню браузера
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Показываем меню
    contextMenu.style.display = 'block';
    isContextMenuVisible = true;
    
    // Позиционируем меню
    positionContextMenu(x, y);
    
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
            break;
            
        case 'paste':
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
            }
            break;
            
        case 'addCharacteristic':
            if (typeof addCharacteristic === 'function') {
                addCharacteristic();
            }
            break;
            
        case 'addOption':
            if (typeof addOption === 'function') {
                addOption();
            }
            break;
            
        case 'addLink':
            if (typeof addLink === 'function') {
                addLink();
            }
            break;
            
        case 'fixRequirements':
            if (typeof correctJson === 'function') {
                correctJson();
            }
            break;
            
        case 'validate':
            if (typeof validateJson === 'function') {
                validateJson();
            }
            break;
            
        case 'format':
            if (typeof formatJson === 'function') {
                formatJson();
            }
            break;
    }
}

// Настройка контекстного меню для редактора
window.setupEditorContextMenu = function() {
    if (!window.editor) {
        console.error('setupEditorContextMenu: editor не найден');
        return;
    }
    
    // Обработчик правого клика на редакторе
    window.editor.getWrapperElement().addEventListener('contextmenu', function(e) {
        
        // Получаем координаты клика
        const x = e.clientX;
        const y = e.clientY;
        
        // Обновляем видимость элементов меню в зависимости от позиции курсора
        updateContextMenuVisibility();
        
        // Показываем контекстное меню
        window.showContextMenu(x, y, e);
    });
};

// Обновление видимости элементов контекстного меню
function updateContextMenuVisibility() {
    if (!contextMenu) return;
    
    const path = window.currentJsonCursorPath || [];
    
    // Кнопка "Добавить характеристику" только если курсор внутри services/N
    let inService = false;
    if (path && path.length >= 2 && path[0].key === 'services' && typeof path[1].key === 'number') {
        inService = true;
    }
    
    const addCharItem = contextMenu.querySelector('[data-action="addCharacteristic"]');
    if (addCharItem) {
        addCharItem.style.display = inService ? '' : 'none';
    }
    
    // Кнопка "Добавить линк" только если курсор внутри services/N/characteristics/M или options/N
    let inCharacteristic = false, inOption = false;
    if (path && path.length >= 4 && path[0].key === 'services' && typeof path[1].key === 'number' && path[2].key === 'characteristics' && typeof path[3].key === 'number') {
        inCharacteristic = true;
    }
    if (path && path.length >= 2 && path[0].key === 'options' && typeof path[1].key === 'number') {
        inOption = true;
    }
    
    const addLinkItem = contextMenu.querySelector('[data-action="addLink"]');
    if (addLinkItem) {
        addLinkItem.style.display = (inCharacteristic || inOption) ? '' : 'none';
    }
}

// Экспорт функций для глобального использования
window.hideContextMenu = hideContextMenu;
window.updateContextMenuVisibility = updateContextMenuVisibility; 