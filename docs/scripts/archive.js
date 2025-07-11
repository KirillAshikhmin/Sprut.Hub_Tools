// archive.js
// Модуль для работы с архивами ZIP и TAR.GZ и пакетной обработки шаблонов
// Глобальные функции для использования в index.html и других js-файлах

window.processTemplateFiles = async function(fileEntries, getFileContent, archiveName, saveFileCallback, statusEl) {
    let totalFiles = fileEntries.length;
    let processedFiles = 0;
    let totalTemplates = 0;
    let changedTemplates = 0;
    let errorFiles = 0;
    const errorLog = [];
    const changelogArr = [];
    const templatePairs = [];
    for (const {relativePath} of fileEntries) {
        statusEl.innerHTML = `<ul><li>Обработано ${processedFiles} файлов из ${totalFiles}. Обрабатывается: ${relativePath}</li></ul>`;
        if (relativePath.endsWith('.json')) {
            try {
                let content = await getFileContent(relativePath);
                if (typeof content === 'string') {
                    content = content.replace(/^ FF/, '').replace(/^ FEFF/, '');
                } else if (content instanceof Uint8Array) {
                    content = new TextDecoder('utf-8').decode(content).replace(/^ FEFF/, '').replace(/^ FF/, '');
                }
                let parsed;
                try {
                    parsed = JSON.parse(content);
                } catch (e) {
                    errorLog.push(`${relativePath}\nОшибка чтения JSON: ${e.message}\n\n`);
                    saveFileCallback(relativePath, content);
                    errorFiles++;
                    processedFiles++;
                    continue;
                }
                let templates = [];
                if (Array.isArray(parsed)) {
                    templates = parsed;
                } else if (
                    parsed && typeof parsed === 'object' &&
                    Object.keys(parsed).length > 0 &&
                    Object.keys(parsed).every(k => /^\d+$/.test(k))
                ) {
                    templates = Object.values(parsed);
                } else {
                    templates = [parsed];
                }
                const isMulti = templates.length > 1;
                if (templates.length > 1) {
                    statusEl.innerHTML += `<ul><li>${relativePath}: Файл содержал несколько шаблонов, разбит на ${templates.length} файла.</li></ul>`;
                }
                for (let i = 0; i < templates.length; i++) {
                    let t = templates[i];
                    let manufacturer = t.manufacturerId || t.manufacturer || '';
                    let model = t.modelId || t.model || '';
                    let fileName = relativePath.replace(/\.json$/i, isMulti ? `_${i+1}.json` : `.json`);
                    if (typeof manufacturer === 'string' && typeof model === 'string') {
                        manufacturer.split('|').forEach(manu => {
                            model.split('|').forEach(mod => {
                                templatePairs.push({ manufacturer: manu.trim(), model: mod.trim(), file: '/' + fileName });
                            });
                        });
                    }
                    let result, corrections = [];
                    try {
                        ({finalJson: result, corrections} = window.applyCorrections(t, window.schema, window.allowedInputTypesFromSchema));
                    } catch (e) {
                        errorLog.push(`${relativePath}\nОшибка исправления: ${e.message}\n\n`);
                        saveFileCallback(relativePath, content);
                        errorFiles++;
                        continue;
                    }
                    let errors = [];
                    try {
                        const ajv = new Ajv({ allErrors: true, logger: false });
                        const validate = ajv.compile(window.schema);
                        const valid = validate(result);
                        if (!valid && validate.errors) {
                            errors = validate.errors.map(e => window.translateAjvError(e, result, content).message);
                        }
                    } catch (e) {
                        errors.push('Ошибка AJV: ' + e.message);
                    }
                    if (errors.length > 0) {
                        errorLog.push(`${relativePath}\n${errors.join('\n')}\n\n`);
                        errorFiles++;
                    }
                    let outName = fileName;
                    saveFileCallback(outName, JSON.stringify(result, null, 2));
                    totalTemplates++;
                    if (corrections.length > 0) changedTemplates++;
                    changelogArr.push({ file: outName, changes: corrections.length > 0 ? corrections : ["Изменений не внесено"] });
                }
                processedFiles++;
                continue;
            } catch (e) {
                errorLog.push(`${relativePath}\nОшибка: ${e.message}\n\n`);
                let content = await getFileContent(relativePath);
                saveFileCallback(relativePath, content);
                errorFiles++;
            }
        } else {
            let content = await getFileContent(relativePath);
            saveFileCallback(relativePath, content);
        }
        processedFiles++;
    }
    const pairMap = {};
    const duplicates = [];
    templatePairs.forEach(({manufacturer, model, file}) => {
        if (!manufacturer || !model) return;
        const key = manufacturer + '||' + model;
        if (!pairMap[key]) pairMap[key] = [];
        pairMap[key].push(file);
    });
    Object.entries(pairMap).forEach(([key, files]) => {
        if (files.length > 1) {
            const [manufacturer, model] = key.split('||');
            files.forEach(file => {
                duplicates.push({manufacturer, model, file});
            });
        }
    });
    if (duplicates.length > 0) {
        errorFiles += new Set(duplicates.map(d => d.manufacturer + '||' + d.model)).size;
        let msg = '<b>Есть дублирующиеся шаблоны:</b><br>' + duplicates.map(d => `${d.manufacturer} &nbsp; ${d.model} &nbsp; ${d.file}`).join('<br>');
        document.getElementById('errorOutput').innerHTML = msg;
        errorLog.unshift('ВНИМАНИЕ! Найдены дублирующиеся шаблоны:\n' + duplicates.map(d => `${d.manufacturer}\t${d.model}\t${d.file}`).join('\n') + '\n');
    }
    if (errorLog.length > 0) {
        saveFileCallback('error.txt', errorLog.join('\n\n'));
    }
    let totalChanges = 0;
    const changedFiles = [];
    const unchangedFiles = [];
    for (const entry of changelogArr) {
        if (entry.changes && entry.changes[0] !== "Изменений не внесено") {
            totalChanges += entry.changes.length;
            changedFiles.push(entry);
        } else {
            unchangedFiles.push(entry.file);
        }
    }
    let changelogTxt = '';
    changelogTxt += `Всего шаблонов: ${totalTemplates}\n`;
    changelogTxt += `Изменено: ${changedTemplates} (изменений: ${totalChanges})\n`;
    changelogTxt += `Шаблонов с ошибками: ${errorFiles} (смотрите файл error.txt)\n\n`;
    if (duplicates.length > 0) {
        changelogTxt += 'ВНИМАНИЕ: Найдены дублирующиеся шаблоны!\n';
    }
    if (changedFiles.length === 0) {
        changelogTxt += 'Нет изменений\n';
    } else {
        for (const entry of changedFiles) {
            changelogTxt += `${entry.file}\n`;
            for (const change of entry.changes) {
                changelogTxt += `  ${change}\n`;
            }
            changelogTxt += '\n';
        }
    }
    if (unchangedFiles.length > 0) {
        changelogTxt += 'Файлы без изменений:\n';
        for (const file of unchangedFiles) {
            changelogTxt += `${file}\n`;
        }
    }
    saveFileCallback('changelog.txt', changelogTxt);
    return { totalTemplates, changedTemplates, errorFiles, totalChanges };
};

window.processZipArchive = async function(file) {
    const statusEl = document.getElementById('correctionOutput');
    statusEl.innerHTML = '<ul><li>Распаковка архива...</li></ul>';
    const zip = await JSZip.loadAsync(file);
    const fileEntries = [];
    zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && !relativePath.startsWith('__MACOSX/')) fileEntries.push({relativePath, zipEntry});
    });
    const newZip = new JSZip();
    const getFileContent = async (relativePath) => {
        const entry = fileEntries.find(e => e.relativePath === relativePath).zipEntry;
        return await entry.async('string');
    };
    const saveFileCallback = (name, content) => {
        if (typeof content === 'string') {
            newZip.file(name, content);
        } else {
            newZip.file(name, content);
        }
    };
    const archiveName = file.name.replace(/\.(zip|tar\.gz)$/i, '');
    const { totalTemplates, changedTemplates, errorFiles, totalChanges } = await window.processTemplateFiles(fileEntries, getFileContent, archiveName, saveFileCallback, statusEl);
    statusEl.innerHTML = `<ul><li>Архив обработан. Скачивание...</li></ul>`;
    const blob = await newZip.generateAsync({type: 'blob'});
    const outName = `fix_${archiveName}.zip`;
    saveAs(blob, outName);
    statusEl.innerHTML = `<ul><li>Готово! Архив скачан.</li></ul>`;
    statusEl.innerHTML += `<ul>` +
        `<li>Всего шаблонов: ${totalTemplates}</li>` +
        `<li>Изменено: ${changedTemplates} (изменений: ${totalChanges})</li>` +
        `<li>Шаблонов с ошибками: ${errorFiles} (смотрите файл error.txt)</li>` +
        `</ul>`;
};

window.processTarGzArchive = async function(file) {
    const statusEl = document.getElementById('correctionOutput');
    statusEl.innerHTML = '<ul><li>Распаковка архива .tar.gz...</li></ul>';
    await new Promise(r => setTimeout(r, 10));
    const arrayBuffer = await file.arrayBuffer();
    let tarUint8 = [];
    await new Promise((resolve, reject) => {
        const inflator = new pako.Inflate();
        inflator.onData = chunk => tarUint8.push(...chunk);
        inflator.onEnd = status => {
            if (status === 0) resolve();
            else reject(new Error('pako: ошибка распаковки'));
        };
        inflator.push(new Uint8Array(arrayBuffer), true);
    });
    statusEl.innerHTML += '<ul><li>Распаковка tar...</li></ul>';
    await new Promise(r => setTimeout(r, 10));
    let entries = {};
    const files = await untar(Uint8Array.from(tarUint8).buffer);
    files.forEach(file => {
        entries[file.name] = new Uint8Array(file.buffer);
    });
    const fileEntries = Object.keys(entries).map(name => ({relativePath: name}));
    const newZip = new JSZip();
    const getFileContent = async (relativePath) => entries[relativePath];
    const saveFileCallback = (name, content) => {
        if (typeof content === 'string') {
            newZip.file(name, content);
        } else {
            newZip.file(name, content);
        }
    };
    const archiveName = file.name.replace(/\.(zip|tar\.gz)$/i, '');
    const { totalTemplates, changedTemplates, errorFiles, totalChanges } = await window.processTemplateFiles(fileEntries, getFileContent, archiveName, saveFileCallback, statusEl);
    statusEl.innerHTML = `<ul><li>Архив обработан. Скачивание...</li></ul>`;
    const blob = await newZip.generateAsync({type: 'blob'});
    const outName = `fix_${archiveName}.zip`;
    saveAs(blob, outName);
    statusEl.innerHTML = `<ul><li>Готово! Архив скачан.</li></ul>`;
    statusEl.innerHTML += `<ul>` +
        `<li>Всего шаблонов: ${totalTemplates}</li>` +
        `<li>Изменено: ${changedTemplates} (изменений: ${totalChanges})</li>` +
        `<li>Шаблонов с ошибками: ${errorFiles} (смотрите файл error.txt)</li>` +
        `</ul>`;
};

// ... Здесь будет весь соответствующий код ... 