// ==UserScript==
// @name         Автоматическая установка даты ТОП новости
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Автоматически устанавливает дату деактивации ТОП новости на неделю вперед
// @author       Островский Николай Николаевич, Запорожское региональное отделение Партии «Единая Россия»
// @match        https://admin.er.ru/admin/news/create
// @match        https://admin.er.ru/admin/news/*/edit
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/yourusername/your-repo/main/script-name.user.js
// @downloadURL  https://raw.githubusercontent.com/yourusername/your-repo/main/script-name.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурация обновлений
    const UPDATE_CONFIG = {
        checkInterval: 24 * 60 * 60 * 1000, // Проверять каждые 24 часа
        githubUrl: 'https://raw.githubusercontent.com/yourusername/your-repo/main/script-name.user.js',
        lastCheckKey: 'lastUpdateCheck',
        ignoreUpdateKey: 'ignoreUpdateVersion'
    };

    // Функция для проверки обновлений
    function checkForUpdates() {
        const lastCheck = GM_getValue(UPDATE_CONFIG.lastCheckKey, 0);
        const now = Date.now();
        
        // Проверяем не чаще чем раз в заданный интервал
        if (now - lastCheck < UPDATE_CONFIG.checkInterval) {
            return;
        }
        
        console.log('Проверка обновлений скрипта...');
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: UPDATE_CONFIG.githubUrl + '?t=' + now,
            onload: function(response) {
                GM_setValue(UPDATE_CONFIG.lastCheckKey, now);
                
                // Извлекаем версию из удаленного скрипта
                const versionMatch = response.responseText.match(/@version\s+([\d.]+)/);
                if (!versionMatch) return;
                
                const latestVersion = versionMatch[1];
                const currentVersion = GM_info.script.version;
                
                console.log('Текущая версия:', currentVersion, 'Доступная версия:', latestVersion);
                
                if (compareVersions(latestVersion, currentVersion) > 0) {
                    showUpdateNotification(currentVersion, latestVersion);
                }
            },
            onerror: function(error) {
                console.error('Ошибка при проверке обновлений:', error);
            }
        });
    }

    // Функция сравнения версий
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

    // Показать уведомление об обновлении
    function showUpdateNotification(currentVersion, latestVersion) {
        // Проверяем, не проигнорировано ли это обновление
        const ignoredVersion = GM_getValue(UPDATE_CONFIG.ignoreUpdateKey, '');
        if (ignoredVersion === latestVersion) {
            return;
        }
        
        GM_notification({
            title: 'Доступно обновление скрипта!',
            text: `Текущая версия: ${currentVersion}\nНовая версия: ${latestVersion}\n\nНажмите для установки обновления.`,
            image: 'https://github.com/favicon.ico',
            timeout: 10000,
            onclick: function() {
                const install = confirm(
                    `Доступна новая версия скрипта (${latestVersion})!\n\n` +
                    `Текущая версия: ${currentVersion}\n\n` +
                    'Хотите установить обновление?\n\n' +
                    'Нажмите OK для установки или Отмена, чтобы проигнорировать это обновление.'
                );
                
                if (install) {
                    // Открываем страницу с сырым скриптом для установки
                    window.open(UPDATE_CONFIG.githubUrl, '_blank');
                } else {
                    // Запоминаем, что пользователь проигнорировал это обновление
                    GM_setValue(UPDATE_CONFIG.ignoreUpdateKey, latestVersion);
                }
            }
        });
    }

    // Основная функция установки даты (ваш существующий код)
    function setTopEndDate() {
        console.log('Попытка установки даты ТОП новости...');
        
        const startDateInput = document.querySelector('input[name="start_date"]') ||
                              document.querySelector('input[data-date-format]');
        const topEndDateInput = document.querySelector('input[name="top_end_date"]');
        
        console.log('Найдены поля:', {
            startDate: startDateInput,
            topEndDate: topEndDateInput
        });

        if (!startDateInput || !topEndDateInput) {
            console.log('Не все поля найдены. Повторная попытка через 2 секунды...');
            setTimeout(setTopEndDate, 2000);
            return;
        }

        const startDateValue = startDateInput.value;
        console.log('Текущая дата публикации:', startDateValue);

        if (!startDateValue) {
            console.log('Дата публикации пустая. Ожидание ввода...');
            return;
        }

        try {
            const [datePart, timePart] = startDateValue.split(' ');
            const [day, month, year] = datePart.split('.');
            
            const startDate = new Date(year, month - 1, day);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            
            const formattedEndDate =
                `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${endDate.getFullYear()} ${timePart || '00:00'}`;
            
            console.log('Устанавливаемая дата деактивации:', formattedEndDate);
            
            topEndDateInput.value = formattedEndDate;
            
            const events = ['change', 'input', 'blur', 'keyup'];
            events.forEach(eventType => {
                topEndDateInput.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            console.log('✅ Дата деактивации ТОП новости успешно установлена!');
        } catch (error) {
            console.error('❌ Ошибка при установке даты:', error);
        }
    }

    // Остальные ваши функции остаются без изменений
    function setupObservers() {
        const startDateInput = document.querySelector('input[name="start_date"]');
        if (startDateInput) {
            console.log('Найден элемент даты публикации, настраиваю наблюдатели...');
            
            const events = ['change', 'input', 'keyup', 'blur', 'paste'];
            events.forEach(eventType => {
                startDateInput.addEventListener(eventType, function() {
                    setTimeout(setTopEndDate, 100);
                });
            });
            
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        setTimeout(setTopEndDate, 100);
                    }
                });
            });
            
            observer.observe(startDateInput, {
                attributes: true,
                attributeFilter: ['value', 'data-value']
            });
            
            setTimeout(setTopEndDate, 1000);
        } else {
            console.log('Элемент даты публикации не найден. Повторная попытка через 1 секунду...');
            setTimeout(setupObservers, 1000);
        }
    }

    function waitForFields() {
        console.log('Ожидание загрузки полей формы...');
        const checkFields = setInterval(function() {
            const startDateInput = document.querySelector('input[name="start_date"]');
            const topEndDateInput = document.querySelector('input[name="top_end_date"]');
            if (startDateInput && topEndDateInput) {
                console.log('✅ Все поля найдены!');
                clearInterval(checkFields);
                setupObservers();
            }
        }, 500);
        
        setTimeout(() => clearInterval(checkFields), 10000);
    }

    function addVisualIndicators() {
        const style = document.createElement('style');
        style.textContent = `
            input[name="top_end_date"] {
                background-color: #e8f5e8 !important;
                border: 2px solid #4caf50 !important;
                position: relative;
            }
            .auto-date-indicator {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: #4caf50;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            const topEndInput = document.querySelector('input[name="top_end_date"]');
            if (topEndInput) {
                const indicator = document.createElement('div');
                indicator.className = 'auto-date-indicator';
                indicator.textContent = 'авто';
                topEndInput.parentNode.style.position = 'relative';
                topEndInput.parentNode.appendChild(indicator);
            }
        }, 2000);
    }

    // Запускаем основной функционал
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM загружен, запускаю скрипт...');
            waitForFields();
            addVisualIndicators();
        });
    } else {
        console.log('DOM уже загружен, запускаю скрипт...');
        waitForFields();
        addVisualIndicators();
    }

    // Глобальный наблюдатель для динамического контента
    const globalObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        if (node.querySelector && node.querySelector('input[name="start_date"]')) {
                            console.log('Обнаружены динамически добавленные поля дат');
                            setTimeout(setupObservers, 500);
                        }
                    }
                });
            }
        });
    });

    globalObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener('load', function() {
        console.log('Страница полностью загружена, принудительная установка даты...');
        setTimeout(setTopEndDate, 2000);
        
        // Запускаем проверку обновлений после полной загрузки страницы
        setTimeout(checkForUpdates, 5000);
    });

    console.log('Скрипт автоматической установки даты ТОП новости активирован!');

})();