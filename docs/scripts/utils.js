// utils.js
// Вспомогательные функции, не относящиеся непосредственно к редактору кода

window.changeTheme = function() {
    const themeToggle = document.getElementById('themeToggle');
    let currentTheme = localStorage.getItem('theme');
    
    // Если тема не была установлена пользователем, определяем текущую по системной теме
    if (currentTheme === null) {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        currentTheme = prefersDark ? 'dark' : 'light';
    }
    
    // Переключаем тему между light и dark
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Сохраняем выбор пользователя
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
};

window.applyTheme = function(theme) {
    // Удаляем все классы тем
    document.body.classList.remove('light', 'dark', 'system');
    // Добавляем текущий класс
    document.body.classList.add(theme);
    
    // Обновляем тему CodeMirror
    if (window.editor) {
        window.editor.setOption('theme', theme === 'dark' ? 'dracula' : 'default');
    }
    
    // Обновляем иконку переключателя
    updateThemeToggleIcon(theme);
};

window.updateThemeToggleIcon = function(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const lightIcon = themeToggle.querySelector('.light-icon');
    const darkIcon = themeToggle.querySelector('.dark-icon');
    
    if (theme === 'light') {
        lightIcon.style.display = 'block';
        darkIcon.style.display = 'none';
    } else {
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'block';
    }
};

window.initTheme = function() {
    // Проверяем, была ли тема уже установлена пользователем
    const hasUserSetTheme = localStorage.getItem('theme') !== null;
    
    let themeToApply;
    
    if (hasUserSetTheme) {
        // Если пользователь уже устанавливал тему, используем сохраненную
        themeToApply = localStorage.getItem('theme') || 'light';
    } else {
        // При первом входе определяем системную тему
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeToApply = prefersDark ? 'dark' : 'light';
        // НЕ сохраняем в localStorage, пока пользователь не переключит вручную
    }
    
    applyTheme(themeToApply);
    
    // Добавляем обработчик клика на переключатель
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', changeTheme);
    }
    
    // Слушаем изменения системной темы (только если пользователь не устанавливал тему вручную)
    if (!hasUserSetTheme && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // Проверяем, что пользователь все еще не установил тему вручную
            if (localStorage.getItem('theme') === null) {
                const newTheme = e.matches ? 'dark' : 'light';
                applyTheme(newTheme);
            }
        });
    }
};

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

window.initDragAndDrop = function() {
    window.dropZone = document.getElementById('dropZone');
    window.dragCounter = 0;
    
    // Функция для показа плашки
    const showDropZone = () => {
        window.dropZone.classList.add('active');
    };
    
    // Функция для скрытия плашки
    const hideDropZone = () => {
        window.dragCounter = 0;
        window.dropZone.classList.remove('active');
    };
    
    // Обработчик для обработки файла
    const handleFile = (file) => {
        if (file && file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    let fileContent = e.target.result;
                    fileContent = fileContent.replace(/^\uFEFF/, '');
                    const json = JSON.parse(fileContent);
                    document.getElementById('errorOutput').textContent = '';
                    document.getElementById('correctionOutput').textContent = '';
                    document.getElementById('autoFixContainer').innerHTML = '';
                    window.selectTemplateWithDropdown(json, (selectedTemplate) => {
                        window.editor.setValue(JSON.stringify(selectedTemplate, null, 2));
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
    };
    
    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        window.dragCounter++;
        showDropZone();
    }, true); // capture phase
    
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    }, true); // capture phase
    
    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        window.dragCounter--;
        if (window.dragCounter <= 0) {
            hideDropZone();
        }
    }, true); // capture phase
    
    // Добавляем обработчик для window, чтобы отслеживать когда drag действительно заканчивается
    window.addEventListener('dragleave', (e) => {
        if (e.clientX <= 0 || e.clientY <= 0 || 
            e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            hideDropZone();
        }
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        hideDropZone();
        window.oneClickFixMode = false;
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }, true); // capture phase
    
    // Добавляем обработчики для редактора CodeMirror с capture фазой
    if (window.editor) {
        const editorElement = window.editor.getWrapperElement();
        
        editorElement.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dragCounter++;
            showDropZone();
        }, true); // capture phase
        
        editorElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true); // capture phase
        
        editorElement.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dragCounter--;
            if (window.dragCounter <= 0) {
                hideDropZone();
            }
        }, true); // capture phase
        
        editorElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideDropZone();
            window.oneClickFixMode = false;
            const file = e.dataTransfer.files[0];
            handleFile(file);
        }, true); // capture phase
    }
};

window.detectControllerType = function(template, controllerFields) {
    // Собираем все link-объекты из characteristics и options
    function collectLinks(obj) {
        let links = [];
        if (obj.services && Array.isArray(obj.services)) {
            obj.services.forEach(service => {
                if (service.characteristics && Array.isArray(service.characteristics)) {
                    service.characteristics.forEach(char => {
                        if (char.link) {
                            if (Array.isArray(char.link)) {
                                links.push(...char.link);
                            } else {
                                links.push(char.link);
                            }
                        }
                    });
                }
            });
        }
        if (obj.options && Array.isArray(obj.options)) {
            obj.options.forEach(opt => {
                if (opt.link) {
                    if (Array.isArray(opt.link)) {
                        links.push(...opt.link);
                    } else {
                        links.push(opt.link);
                    }
                }
            });
        }
        return links;
    }
    const links = collectLinks(template);
    if (!links.length) return null;
    // Считаем совпадения по каждому типу
    let bestType = null;
    let bestCount = 0;
    for (const [type, fields] of Object.entries(controllerFields)) {
        const searchFields = fields.search;
        let count = 0;
        links.forEach(link => {
            if (searchFields && searchFields.some(field => link && Object.prototype.hasOwnProperty.call(link, field))) {
                count++;
            }
        });
        if (count > bestCount) {
            bestCount = count;
            bestType = type;
        }
    }
    // Если есть хотя бы одно совпадение — возвращаем bestType
    return bestCount > 0 ? bestType : null;
}; 