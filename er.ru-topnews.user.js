// ==UserScript==
// @name         Автоматическая установка даты ТОП новости (Оптимизированная)
// @namespace    https://github.com/nnostrovskiy/web-utils-admin-er
// @version      1.2.7
// @description  Автоматически устанавливает дату деактивации ТОП новости на неделю вперед. Улучшенная версия с обработкой ошибок и оптимизацией производительности.
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
// @updateURL    https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-topnews.user.js
// @downloadURL  https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-topnews.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
        debugMode: true,
        maxWaitTime: 15000,
        pollInterval: 500,
        updateCheckInterval: 60, // 24 часа в миллисекундах
        githubRawUrl: 'https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-topnews.user.js',
        lastCheckKey: 'lastUpdateCheck_v3',
        ignoreUpdateKey: 'ignoreUpdateVersion_v3',
        dateOffsetDays: 7
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
            return operation();
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
            
            const existingElement = document.querySelector(selector);
            if (existingElement) {
                resolve(existingElement);
                return;
            }

            const observer = new MutationObserver(function(mutations) {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
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
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else {
                    reject(new Error(`Таймаут ожидания элемента: ${selector}`));
                }
            }, timeout);
        });
    }

    // ===== УЛУЧШЕННАЯ СИСТЕМА ОБНОВЛЕНИЙ =====
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
            
            // Проверяем не чаще чем раз в сутки
            if (now - lastCheck < CONFIG.updateCheckInterval) {
                logger.info('Проверка обновлений пропущена (еще не прошло 24 часа)');
                return;
            }
            
            logger.log('Проверка обновлений скрипта...');
            GM_setValue(CONFIG.lastCheckKey, now);
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: CONFIG.githubRawUrl + '?t=' + Date.now(), // Добавляем timestamp для избежания кеширования
                timeout: 10000,
                onload: function(response) {
                    if (response.status !== 200) {
                        logger.warn('Ошибка HTTP при проверке обновлений:', response.status);
                        return;
                    }
                    
                    try {
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
                    } catch (parseError) {
                        logger.error('Ошибка парсинга ответа:', parseError);
                    }
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
            
            // Более информативное уведомление
            const notificationDetails = 
                `Текущая версия: ${currentVersion}\n` +
                `Доступна версия: ${latestVersion}\n\n` +
                `Что нового:\n` +
                `• Исправлена система обновлений\n` +
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
                // Fallback для браузеров без GM_notification
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
            // Открываем страницу установки в том же окне
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

    function showSuccessIndicator() {
        safeExecute(() => {
            const topEndInput = document.querySelector('input[name="top_end_date"]');
            if (topEndInput) {
                topEndInput.style.backgroundColor = '#d4edda';
                topEndInput.style.borderColor = '#28a745';
                
                setTimeout(() => {
                    topEndInput.style.backgroundColor = '';
                    topEndInput.style.borderColor = '';
                }, 2000);
            }
        }, 'showSuccessIndicator');
    }

    // ===== УПРАВЛЕНИЕ СОБЫТИЯМИ И НАБЛЮДАТЕЛЯМИ =====
    function setupEventListeners() {
        return safeExecute(() => {
            const startDateInput = document.querySelector('input[name="start_date"]');
            if (!startDateInput) {
                logger.warn('Поле даты публикации не найдено для настройки слушателей');
                return false;
            }

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

            logger.info('✅ Слушатели событий настроены');
            return true;
        }, 'setupEventListeners', false);
    }

    // ===== ВИЗУАЛЬНЫЕ УЛУЧШЕНИЯ =====
    function addVisualIndicators() {
        return safeExecute(() => {
            const style = document.createElement('style');
            style.id = 'top-news-auto-date-styles';
            style.textContent = `
                input[name="top_end_date"] {
                    background-color: #f0f9ff !important;
                    border: 2px solid #3b82f6 !important;
                    position: relative;
                    transition: all 0.3s ease;
                }
                input[name="top_end_date"]:focus {
                    background-color: #e1f5fe !important;
                    border-color: #0288d1 !important;
                }
                .auto-date-indicator {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
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
                    border-color: #10b981 !important;
                    background-color: #ecfdf5 !important;
                }
            `;
            document.head.appendChild(style);

            const addIndicator = () => {
                const topEndInput = document.querySelector('input[name="top_end_date"]');
                if (topEndInput && !topEndInput.parentNode.querySelector('.auto-date-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'auto-date-indicator';
                    indicator.textContent = 'авто';
                    indicator.title = 'Дата установлена автоматически';
                    
                    topEndInput.parentNode.style.position = 'relative';
                    topEndInput.parentNode.appendChild(indicator);
                    
                    topEndInput.classList.add('auto-date-success');
                    
                    logger.log('✅ Визуальный индикатор добавлен');
                }
            };

            setTimeout(addIndicator, 500);
            
            const indicatorObserver = new MutationObserver(addIndicator);
            indicatorObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            window._topNewsObservers = window._topNewsObservers || [];
            window._topNewsObservers.push(indicatorObserver);

            return true;
        }, 'addVisualIndicators', false);
    }

    // ===== ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ =====
    async function initialize() {
        logger.info('🚀 Инициализация скрипта автоматической установки даты ТОП новости...');

        try {
            await Promise.race([
                waitForElement('input[name="start_date"]'),
                waitForElement('input[name="top_end_date"]')
            ]);

            logger.log('✅ Обязательные поля найдены');

            setupEventListeners();
            addVisualIndicators();
            
            setTimeout(setTopEndDate, 1000);

        } catch (error) {
            logger.error('Ошибка инициализации:', error);
            
            const backupCheck = setInterval(() => {
                const startDateInput = document.querySelector('input[name="start_date"]');
                const topEndDateInput = document.querySelector('input[name="top_end_date"]');
                
                if (startDateInput && topEndDateInput) {
                    clearInterval(backupCheck);
                    logger.log('✅ Поля найдены через резервную проверку');
                    setupEventListeners();
                    addVisualIndicators();
                    setTopEndDate();
                }
            }, 1000);

            setTimeout(() => clearInterval(backupCheck), CONFIG.maxWaitTime);
        }
    }

    // ===== УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ =====
    function cleanup() {
        logger.log('🧹 Очистка ресурсов скрипта...');
        
        if (window._topNewsObservers) {
            window._topNewsObservers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (e) {}
            });
            window._topNewsObservers = [];
        }
        
        const styles = document.getElementById('top-news-auto-date-styles');
        if (styles) {
            styles.remove();
        }
        
        const indicators = document.querySelectorAll('.auto-date-indicator');
        indicators.forEach(indicator => indicator.remove());
        
        logger.log('✅ Очистка завершена');
    }

    // ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
    if (typeof GM_unload === 'function') {
        GM_unload(cleanup);
    }
    
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    const globalObserver = new MutationObserver(debounce(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1 && node.querySelector) {
                        if (node.querySelector('input[name="start_date"]')) {
                            logger.log('🔄 Обнаружены динамически добавленные поля дат');
                            setTimeout(() => {
                                setupEventListeners();
                                setTopEndDate();
                            }, 500);
                        }
                    }
                });
            }
        });
    }, 500));

    // ===== ЗАПУСК СКРИПТА =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            logger.log('📄 DOM загружен, запуск инициализации...');
            globalObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            initialize();
            
            // Откладываем проверку обновлений чтобы не мешать основной работе
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

})();





