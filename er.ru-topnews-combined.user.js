// ==UserScript==
// @name         Комбинированный скрипт: Установка даты ТОП и ограничение символов
// @namespace    https://github.com/nnostrovskiy/web-utils-admin-er
// @version      1.0.0
// @description  Автоматически устанавливает дату деактивации ТОП новости на неделю вперед и ограничивает ввод до 90 символов в поле "Заголовок для топ новости" с отображением счетчика. Улучшенная версия с обработкой ошибок и оптимизацией производительности.
// @author       Островский Николай Николаевич, Запорожское региональное отделение Партии «Единая Россия»
// @match        https://admin.er.ru/admin/news/create
// @match        https://admin.er.ru/admin/news/*/edit
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_log
// @grant        GM_unload
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-topnews-combined.user.js
// @downloadURL  https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-topnews-combined.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
        debugMode: true,
        maxWaitTime: 15000,
        pollInterval: 500,
        updateCheckInterval: 86400000, // 24 часа в миллисекундах
        githubRawUrl: 'https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-topnews-combined.user.js',
        lastCheckKey: 'lastUpdateCheck_combined_v1',
        ignoreUpdateKey: 'ignoreUpdateVersion_combined_v1',
        dateOffsetDays: 7,
        maxTitleLength: 90,
        visualStyles: {
            // Стили для системы дат
            successBackground: '#d4edda',
            successBorder: '#28a745',
            inputBackground: '#f0f9ff',
            inputBorder: '#3b82f6',
            focusBackground: '#e1f5fe',
            focusBorder: '#0288d1',
            indicatorGradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            successStateBackground: '#ecfdf5',
            successStateBorder: '#10b981',
            
            // Стили для счетчика символов
            counterNormal: '#4caf50',
            counterWarning: '#ff9800',
            counterExceeded: '#ff0000',
            inputFocusBorder: '#4caf50',
            inputFocusShadow: 'rgba(76, 175, 80, 0.3)',
            warningBorder: '#ff9800',
            exceededBorder: '#ff0000',
            exceededBackground: '#ffe6e6'
        }
    };

    // ===== СИСТЕМА ЛОГИРОВАНИЯ =====
    const logger = {
        log: function(...args) {
            if (CONFIG.debugMode) {
                console.log('📝 ТОП-Новости:', ...args);
            }
        },
        error: function(...args) {
            console.error('❌ ТОП-Новости:', ...args);
        },
        warn: function(...args) {
            console.warn('⚠️ ТОП-Новости:', ...args);
        },
        info: function(...args) {
            if (CONFIG.debugMode) {
                console.info('ℹ️ ТОП-Новости:', ...args);
            }
        }
    };

    // ===== УТИЛИТЫ ОБРАБОТКИ ОШИБОК =====
    function safeExecute(operation, operationName, fallback = null) {
        try {
            const result = operation();
            logger.log(`✅ ${operationName} выполнена успешно`);
            return result;
        } catch (error) {
            logger.error(`Ошибка в ${operationName}:`, error);
            return fallback;
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ===== СИСТЕМА ОЖИДАНИЯ ЭЛЕМЕНТОВ =====
    function waitForElement(selector, timeout = CONFIG.maxWaitTime) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return true;
                }
                return false;
            };

            if (checkElement()) return;

            const observer = new MutationObserver(() => {
                if (checkElement()) {
                    observer.disconnect();
                } else if (Date.now() - startTime > timeout) {
                    observer.disconnect();
                    reject(new Error(`Элемент ${selector} не найден за ${timeout}мс`));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                if (!checkElement()) {
                    reject(new Error(`Таймаут ожидания элемента: ${selector}`));
                }
            }, timeout);
        });
    }

    // ===== СИСТЕМА ПРОВЕРКИ ОБНОВЛЕНИЙ =====
    function compareVersions(a, b) {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal > bVal) return 1;
            if (aVal < bVal) return -1;
        }
        return 0;
    }

    function checkForUpdates() {
        return safeExecute(() => {
            const lastCheck = GM_getValue(CONFIG.lastCheckKey, 0);
            const now = Date.now();
            
            if (now - lastCheck < CONFIG.updateCheckInterval) {
                logger.info('Проверка обновлений пропущена (еще не прошло 24 часа)');
                return;
            }
            
            logger.log('Проверка обновлений скрипта...');
            GM_setValue(CONFIG.lastCheckKey, now);
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: CONFIG.githubRawUrl + '?t=' + Date.now(),
                timeout: 10000,
                onload: function(response) {
                    safeExecute(() => {
                        if (response.status !== 200) {
                            logger.warn('Ошибка HTTP при проверке обновлений:', response.status);
                            return;
                        }
                        
                        const scriptContent = response.responseText;
                        const versionMatch = scriptContent.match(/@version\s+([\d.]+)/);
                        
                        if (!versionMatch) {
                            logger.warn('Версия не найдена в файле');
                            return;
                        }
                        
                        const latestVersion = versionMatch[1];
                        const currentVersion = GM_info.script.version;
                        
                        logger.log(`Версии: текущая ${currentVersion}, доступная ${latestVersion}`);
                        
                        if (compareVersions(latestVersion, currentVersion) > 0) {
                            showUpdateNotification(currentVersion, latestVersion);
                        } else {
                            logger.log('Обновлений не найдено');
                        }
                    }, 'Обработка ответа обновления');
                },
                onerror: function(error) {
                    logger.error('Ошибка сети при проверке обновлений:', error);
                },
                ontimeout: function() {
                    logger.warn('Таймаут при проверке обновлений');
                }
            });
        }, 'checkForUpdates');
    }

    function showUpdateNotification(currentVersion, latestVersion) {
        safeExecute(() => {
            const ignoredVersion = GM_getValue(CONFIG.ignoreUpdateKey, '');
            if (ignoredVersion === latestVersion) {
                logger.log('Обновление проигнорировано пользователем:', latestVersion);
                return;
            }
            
            const notificationDetails = 
                `Текущая версия: ${currentVersion}\n` +
                `Доступна версия: ${latestVersion}\n\n` +
                `Что нового:\n` +
                `• Объединены функции установки даты и ограничения символов\n` +
                `• Улучшена стабильность работы\n` +
                `• Оптимизирована производительность`;
            
            if (typeof GM_notification === 'function') {
                GM_notification({
                    title: 'Доступно обновление скрипта! 🚀',
                    text: `Версия ${latestVersion} доступна для установки`,
                    image: 'https://github.com/favicon.ico',
                    timeout: 10000,
                    onclick: function() {
                        handleUpdateConfirmation(currentVersion, latestVersion, notificationDetails);
                    }
                });
            } else {
                handleUpdateConfirmation(currentVersion, latestVersion, notificationDetails);
            }
        }, 'showUpdateNotification');
    }

    function handleUpdateConfirmation(currentVersion, latestVersion, details) {
        const userChoice = confirm(
            'ДОСТУПНО ОБНОВЛЕНИЕ СКРИПТА!\n\n' +
            details + '\n\n' +
            'ВАЖНО: Скрипт не может обновиться автоматически.\n\n' +
            'Чтобы установить обновление:\n' +
            '1. Нажмите OK чтобы открыть страницу установки\n' +
            '2. На открывшейся странице нажмите "Обновить"\n' +
            '3. Подтвердите установку\n\n' +
            'Нажмите OK чтобы продолжить или Отмена чтобы проигнорировать это обновление.'
        );
        
        if (userChoice) {
            window.location.href = CONFIG.githubRawUrl;
        } else {
            GM_setValue(CONFIG.ignoreUpdateKey, latestVersion);
            logger.log('Пользователь проигнорировал обновление:', latestVersion);
        }
    }

    // ===== ОСНОВНАЯ ЛОГИКА УСТАНОВКИ ДАТЫ =====
    let lastProcessedDate = '';

    function calculateEndDate(startDateValue) {
        return safeExecute(() => {
            if (!startDateValue || typeof startDateValue !== 'string') {
                throw new Error('Неверный формат даты публикации');
            }

            if (startDateValue === lastProcessedDate) {
                return null;
            }

            const [datePart, timePart = '00:00'] = startDateValue.split(' ');
            const [day, month, year] = datePart.split('.').map(Number);
            
            if (!day || !month || !year || day > 31 || month > 12 || year < 2000) {
                throw new Error(`Неверный формат даты: ${startDateValue}`);
            }

            const startDate = new Date(year, month - 1, day);
            
            if (isNaN(startDate.getTime())) {
                throw new Error(`Неверная дата: ${startDateValue}`);
            }

            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + CONFIG.dateOffsetDays);
            
            const formattedEndDate =
                `${String(endDate.getDate()).padStart(2, '0')}.` +
                `${String(endDate.getMonth() + 1).padStart(2, '0')}.` +
                `${endDate.getFullYear()} ${timePart}`;

            lastProcessedDate = startDateValue;

            logger.log(`Рассчитана дата: ${startDateValue} → ${formattedEndDate}`);
            return formattedEndDate;
        }, 'calculateEndDate', null);
    }

    function setTopEndDate() {
        return safeExecute(() => {
            logger.log('Попытка установки даты ТОП новости...');
            
            const startDateInput = document.querySelector('input[name="start_date"]');
            const topEndDateInput = document.querySelector('input[name="top_end_date"]');

            if (!startDateInput || !topEndDateInput) {
                logger.warn('Не все обязательные поля найдены');
                return false;
            }

            const startDateValue = startDateInput.value.trim();
            if (!startDateValue) {
                logger.log('Дата публикации пустая - ожидание ввода');
                return false;
            }

            const formattedEndDate = calculateEndDate(startDateValue);
            if (!formattedEndDate) {
                return true;
            }

            if (topEndDateInput.value !== formattedEndDate) {
                topEndDateInput.value = formattedEndDate;
                
                const events = ['change', 'input', 'blur'];
                events.forEach(eventType => {
                    topEndDateInput.dispatchEvent(new Event(eventType, { 
                        bubbles: true, 
                        cancelable: true 
                    }));
                });
                
                logger.info('✅ Дата деактивации ТОП новости установлена:', formattedEndDate);
                showSuccessIndicator();
                return true;
            } else {
                logger.log('Дата уже установлена правильно');
                return true;
            }
        }, 'setTopEndDate', false);
    }

    // ===== СИСТЕМА ОГРАНИЧЕНИЯ СИМВОЛОВ =====
    function setupCharCounter() {
        return safeExecute(() => {
            const titleTopInput = document.querySelector('input[name="title_top"]');
            if (!titleTopInput) {
                logger.warn('Поле "Заголовок для топ новости" не найдено');
                return false;
            }

            logger.log('Настройка ограничителя символов для поля заголовка ТОП...');

            // Проверяем, не добавлен ли уже счетчик
            if (titleTopInput.parentNode.querySelector('.char-counter')) {
                logger.log('Счетчик символов уже настроен');
                return true;
            }

            // Создаем элемент счетчика
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.style.cssText = `
                font-size: 12px;
                color: ${CONFIG.visualStyles.counterNormal};
                text-align: right;
                margin-top: 5px;
                margin-bottom: 10px;
                font-weight: bold;
                transition: color 0.3s ease;
            `;

            // Вставляем счетчик после поля ввода
            titleTopInput.parentNode.insertBefore(counter, titleTopInput.nextSibling);

            // Функция обновления счетчика
            function updateCounter() {
                const currentLength = titleTopInput.value.length;
                const remaining = CONFIG.maxTitleLength - currentLength;

                if (remaining < 0) {
                    // Превышение лимита
                    counter.style.color = CONFIG.visualStyles.counterExceeded;
                    counter.textContent = `Превышено на ${Math.abs(remaining)} символов (максимум: ${CONFIG.maxTitleLength})`;
                    
                    // Визуальное оформление поля при превышении
                    titleTopInput.classList.add('char-limit-exceeded');
                    titleTopInput.classList.remove('char-limit-warning');
                    
                    // Обрезаем текст если превышен лимит
                    if (currentLength > CONFIG.maxTitleLength) {
                        titleTopInput.value = titleTopInput.value.substring(0, CONFIG.maxTitleLength);
                        // Рекурсивно вызываем для обновления счетчика
                        setTimeout(updateCounter, 0);
                    }
                } else if (remaining <= 10) {
                    // Предупреждение (осталось 10 символов или меньше)
                    counter.style.color = CONFIG.visualStyles.counterWarning;
                    counter.textContent = `Осталось символов: ${remaining}/${CONFIG.maxTitleLength}`;
                    
                    titleTopInput.classList.add('char-limit-warning');
                    titleTopInput.classList.remove('char-limit-exceeded');
                } else {
                    // Нормальное состояние
                    counter.style.color = CONFIG.visualStyles.counterNormal;
                    counter.textContent = `Осталось символов: ${remaining}/${CONFIG.maxTitleLength}`;
                    
                    titleTopInput.classList.remove('char-limit-warning', 'char-limit-exceeded');
                }
            }

            // Устанавливаем атрибут maxlength
            titleTopInput.setAttribute('maxlength', CONFIG.maxTitleLength);

            // Добавляем обработчики событий
            const debouncedUpdate = debounce(updateCounter, 100);
            
            const events = ['input', 'change', 'keyup', 'focus', 'blur'];
            events.forEach(eventType => {
                titleTopInput.addEventListener(eventType, debouncedUpdate, {
                    passive: true,
                    capture: false
                });
            });

            titleTopInput.addEventListener('paste', function(e) {
                setTimeout(debouncedUpdate, 10);
            });

            // Наблюдаем за изменениями значения
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        debouncedUpdate();
                    }
                });
            });

            observer.observe(titleTopInput, {
                attributes: true,
                attributeFilter: ['value']
            });

            // Сохраняем наблюдатель для последующей очистки
            window._topNewsObservers = window._topNewsObservers || [];
            window._topNewsObservers.push(observer);

            // Инициализируем счетчик
            updateCounter();

            logger.info('✅ Ограничитель символов настроен');
            return true;
        }, 'setupCharCounter', false);
    }

    // ===== ВИЗУАЛЬНЫЕ ИНДИКАТОРЫ И СТИЛИ =====
    function showSuccessIndicator() {
        safeExecute(() => {
            const topEndInput = document.querySelector('input[name="top_end_date"]');
            if (topEndInput) {
                // Сохранение оригинальных визуальных стилей
                topEndInput.style.backgroundColor = CONFIG.visualStyles.successBackground;
                topEndInput.style.borderColor = CONFIG.visualStyles.successBorder;
                
                setTimeout(() => {
                    topEndInput.style.backgroundColor = '';
                    topEndInput.style.borderColor = '';
                }, 2000);
            }
        }, 'showSuccessIndicator');
    }

    function addVisualStyles() {
        return safeExecute(() => {
            const style = document.createElement('style');
            style.id = 'top-news-combined-styles';
            
            // Сохранение всех оригинальных CSS стилей и цветов для обеих систем
            style.textContent = `
                /* Стили для системы установки даты */
                input[name="top_end_date"] {
                    background-color: ${CONFIG.visualStyles.inputBackground} !important;
                    border: 2px solid ${CONFIG.visualStyles.inputBorder} !important;
                    position: relative;
                    transition: all 0.3s ease;
                }
                input[name="top_end_date"]:focus {
                    background-color: ${CONFIG.visualStyles.focusBackground} !important;
                    border-color: ${CONFIG.visualStyles.focusBorder} !important;
                }
                .auto-date-indicator {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: ${CONFIG.visualStyles.indicatorGradient};
                    color: white;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                    pointer-events: none;
                    z-index: 1000;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .auto-date-success {
                    border-color: ${CONFIG.visualStyles.successStateBorder} !important;
                    background-color: ${CONFIG.visualStyles.successStateBackground} !important;
                }

                /* Стили для системы ограничения символов */
                input[name="title_top"] {
                    border-width: 2px !important;
                    transition: border-color 0.3s ease, background-color 0.3s ease !important;
                }
                input[name="title_top"]:focus {
                    border-color: ${CONFIG.visualStyles.inputFocusBorder} !important;
                    box-shadow: 0 0 5px ${CONFIG.visualStyles.inputFocusShadow} !important;
                }
                .char-limit-warning {
                    border-color: ${CONFIG.visualStyles.warningBorder} !important;
                }
                .char-limit-exceeded {
                    border-color: ${CONFIG.visualStyles.exceededBorder} !important;
                    background-color: ${CONFIG.visualStyles.exceededBackground} !important;
                }
            `;
            
            document.head.appendChild(style);

            // Добавляем индикатор для поля даты
            const addDateIndicator = () => {
                const topEndInput = document.querySelector('input[name="top_end_date"]');
                if (topEndInput && !topEndInput.parentNode.querySelector('.auto-date-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'auto-date-indicator';
                    indicator.textContent = 'авто';
                    indicator.title = 'Дата установлена автоматически';
                    
                    topEndInput.parentNode.style.position = 'relative';
                    topEndInput.parentNode.appendChild(indicator);
                    
                    topEndInput.classList.add('auto-date-success');
                    
                    logger.log('✅ Визуальный индикатор для даты добавлен');
                }
            };

            setTimeout(addDateIndicator, 500);
            
            const indicatorObserver = new MutationObserver(addDateIndicator);
            indicatorObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            window._topNewsObservers = window._topNewsObservers || [];
            window._topNewsObservers.push(indicatorObserver);

            return true;
        }, 'addVisualStyles', false);
    }

    // ===== УПРАВЛЕНИЕ СОБЫТИЯМИ И НАБЛЮДАТЕЛЯМИ =====
    function setupEventListeners() {
        return safeExecute(() => {
            let listenersSetup = false;

            // Настройка слушателей для системы дат
            const startDateInput = document.querySelector('input[name="start_date"]');
            if (startDateInput) {
                logger.log('Настройка слушателей событий для поля даты публикации...');

                const debouncedDateHandler = debounce(() => {
                    setTimeout(setTopEndDate, 100);
                }, 500);

                const events = ['change', 'input', 'blur'];
                events.forEach(eventType => {
                    startDateInput.addEventListener(eventType, debouncedDateHandler, {
                        passive: true,
                        capture: false
                    });
                });

                const attributeObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'value' || mutation.attributeName === 'data-value')) {
                            debouncedDateHandler();
                        }
                    });
                });

                attributeObserver.observe(startDateInput, {
                    attributes: true,
                    attributeFilter: ['value', 'data-value']
                });

                window._topNewsObservers = window._topNewsObservers || [];
                window._topNewsObservers.push(attributeObserver);
                listenersSetup = true;
            }

            // Настройка системы ограничения символов
            if (setupCharCounter()) {
                listenersSetup = true;
            }

            if (listenersSetup) {
                logger.info('✅ Все слушатели событий настроены');
                return true;
            } else {
                logger.warn('Не все слушатели событий удалось настроить');
                return false;
            }
        }, 'setupEventListeners', false);
    }

    // ===== ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ =====
    async function initialize() {
        logger.info('🚀 Инициализация комбинированного скрипта ТОП новостей...');

        try {
            // Ожидаем появления всех необходимых полей
            await Promise.race([
                waitForElement('input[name="start_date"]'),
                waitForElement('input[name="top_end_date"]'),
                waitForElement('input[name="title_top"]')
            ]);

            logger.log('✅ Обязательные поля найдены');

            // Настраиваем все системы
            setupEventListeners();
            addVisualStyles();
            
            // Запускаем начальную установку даты
            setTimeout(setTopEndDate, 1000);

        } catch (error) {
            logger.error('Ошибка инициализации:', error);
            
            // Резервный механизм поиска полей
            const backupCheck = setInterval(() => {
                const hasRequiredFields = 
                    document.querySelector('input[name="start_date"]') &&
                    document.querySelector('input[name="top_end_date"]') &&
                    document.querySelector('input[name="title_top"]');
                
                if (hasRequiredFields) {
                    clearInterval(backupCheck);
                    logger.log('✅ Поля найдены через резервную проверку');
                    setupEventListeners();
                    addVisualStyles();
                    setTopEndDate();
                }
            }, 1000);

            setTimeout(() => {
                clearInterval(backupCheck);
                logger.log('Резервная проверка завершена');
            }, CONFIG.maxWaitTime);
        }
    }

    // ===== УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ =====
    function cleanup() {
        logger.log('🧹 Очистка ресурсов скрипта...');
        
        // Очистка наблюдателей
        if (window._topNewsObservers) {
            window._topNewsObservers.forEach(observer => {
                safeExecute(() => observer.disconnect(), 'Отключение наблюдателя');
            });
            window._topNewsObservers = [];
        }
        
        // Удаление стилей
        const styles = document.getElementById('top-news-combined-styles');
        if (styles) {
            safeExecute(() => styles.remove(), 'Удаление стилей');
        }
        
        // Удаление визуальных индикаторов
        const indicators = document.querySelectorAll('.auto-date-indicator, .char-counter');
        indicators.forEach(indicator => {
            safeExecute(() => indicator.remove(), 'Удаление индикатора');
        });
        
        // Сброс классов стилей
        const styledInputs = document.querySelectorAll('.auto-date-success, .char-limit-warning, .char-limit-exceeded');
        styledInputs.forEach(input => {
            input.classList.remove('auto-date-success', 'char-limit-warning', 'char-limit-exceeded');
        });
        
        logger.log('✅ Очистка завершена');
    }

    // ===== ОБРАБОТЧИКИ СОБЫТИЙ ЖИЗНЕННОГО ЦИКЛА =====
    if (typeof GM_unload === 'function') {
        GM_unload(cleanup);
    }
    
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    // Глобальный наблюдатель для динамического контента
    const globalObserver = new MutationObserver(debounce(function(mutations) {
        safeExecute(() => {
            let foundNewFields = false;
            
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1 && node.querySelector) {
                            if (node.querySelector('input[name="start_date"]') || 
                                node.querySelector('input[name="title_top"]')) {
                                foundNewFields = true;
                            }
                        }
                    });
                }
            });
            
            if (foundNewFields) {
                logger.log('🔄 Обнаружены динамически добавленные поля');
                setTimeout(() => {
                    setupEventListeners();
                    setTopEndDate();
                }, 500);
            }
        }, 'Обработка мутаций DOM');
    }, 500));

    // ===== ЗАПУСК СКРИПТА =====
    function startScript() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                logger.log('📄 DOM загружен, запуск инициализации...');
                globalObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                initialize();
                
                // Отложенная проверка обновлений
                setTimeout(checkForUpdates, 10000);
            });
        } else {
            logger.log('📄 DOM уже загружен, запуск инициализации...');
            globalObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            initialize();
            
            setTimeout(checkForUpdates, 10000);
        }

        window.addEventListener('load', function() {
            logger.log('🎯 Страница полностью загружена, финальная проверка...');
            setTimeout(() => {
                setTopEndDate();
            }, 2000);
        });
    }

    // Запуск основной функции
    startScript();

})();