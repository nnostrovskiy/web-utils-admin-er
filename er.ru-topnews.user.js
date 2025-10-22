// ==UserScript==
// @name         Улучшенный переключатель активности новости
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Делает переключатель активности новости более понятным с пояснениями и улучшенной визуализацией
// @author       Островский Николай Николаевич, Запорожское региональное отделение Партии «Единая Россия»
// @match        https://admin.er.ru/admin/news/create
// @match        https://admin.er.ru/admin/news/*/edit
// @grant        none
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
        checkInterval: 500,
        toggleSelector: 'input[name="active"][class*="toggleswitch"]',
        visualStyles: {
            // 🎨 ЦВЕТОВАЯ СХЕМА ИЗ ПРИМЕРА
            primaryBlue: '#3b82f6',
            primaryBlueDark: '#1d4ed8',
            primaryBlueLight: '#60a5fa',
            blueBackground: '#f0f9ff',
            blueFocusBackground: '#e1f5fe',
            blueBorder: '#3b82f6',
            blueFocusBorder: '#0288d1',
            successBackground: '#d4edda',
            successBorder: '#28a745',
            indicatorGradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            successStateBackground: '#ecfdf5',
            successStateBorder: '#10b981',
            // 🎨 ЦВЕТА СЧЕТЧИКА СИМВОЛОВ
            counterNormal: '#3b82f6',
            counterWarning: '#f59e0b',
            counterExceeded: '#ef4444',
            inputFocusBorder: '#3b82f6',
            inputFocusShadow: 'rgba(59, 130, 246, 0.3)',
            warningBorder: '#f59e0b',
            exceededBorder: '#ef4444',
            exceededBackground: '#fef2f2'
        }
    };

    // ===== СИСТЕМА ЛОГИРОВАНИЯ =====
    const logger = {
        info: (message, data = null) => {
            if (CONFIG.debugMode) {
                console.log(`ℹ️ ${message}`, data || '');
            }
        },
        success: (message, data = null) => {
            if (CONFIG.debugMode) {
                console.log(`✅ ${message}`, data || '');
            }
        },
        error: (message, error = null) => {
            if (CONFIG.debugMode) {
                console.error(`❌ ${message}`, error || '');
            }
        },
        warn: (message, data = null) => {
            if (CONFIG.debugMode) {
                console.warn(`⚠️ ${message}`, data || '');
            }
        }
    };

    // ===== УТИЛИТЫ ОБРАБОТКИ ОШИБОК =====
    function safeExecute(operation, operationName, fallback = null) {
        try {
            return operation();
        } catch (error) {
            logger.error(`Ошибка в операции: ${operationName}`, error);
            return fallback;
        }
    }

    // ===== СИСТЕМА ОЖИДАНИЯ ЭЛЕМЕНТОВ =====
    function waitForElement(selector, timeout = CONFIG.maxWaitTime) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }
                
                if (Date.now() - startTime >= timeout) {
                    reject(new Error(`Элемент не найден: ${selector}`));
                    return;
                }
                
                setTimeout(checkElement, CONFIG.checkInterval);
            };
            
            checkElement();
        });
    }

    // ===== СИСТЕМА ПРОВЕРКИ ОБНОВЛЕНИЙ =====
    function checkForUpdates() {
        logger.info('Проверка обновлений...');
        // Автоматическая проверка через @updateURL в метаданных
    }

    // ===== ВИЗУАЛЬНЫЕ ИНДИКАТОРЫ И СТИЛИ =====
    function addVisualStyles() {
        return safeExecute(() => {
            const style = document.createElement('style');
            style.textContent = `
                /* 🎨 СТИЛИ ПЕРЕКЛЮЧАТЕЛЯ АКТИВНОСТИ */
                input[name="active"][class*="toggleswitch"] + .toggle .toggle-on {
                    background: ${CONFIG.visualStyles.indicatorGradient} !important;
                    color: white !important;
                    font-weight: bold !important;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
                }

                input[name="active"][class*="toggleswitch"] + .toggle .toggle-off {
                    background: #6b7280 !important;
                    color: white !important;
                    font-weight: bold !important;
                }

                input[name="active"][class*="toggleswitch"] + .toggle .toggle-handle {
                    background: white !important;
                    border: 2px solid #e5e7eb !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                    transition: all 0.3s ease !important;
                }

                input[name="active"][class*="toggleswitch"]:checked + .toggle .toggle-handle {
                    border-color: ${CONFIG.visualStyles.primaryBlue} !important;
                    box-shadow: 0 2px 8px ${CONFIG.visualStyles.inputFocusShadow} !important;
                }

                /* 🎨 СТИЛИ ПОЯСНЯЮЩЕГО БЛОКА */
                .activity-explanation {
                    margin-top: 12px !important;
                    padding: 12px 16px !important;
                    border-radius: 8px !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    border-left: 4px solid !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
                }

                .activity-explanation.active {
                    background: ${CONFIG.visualStyles.successStateBackground} !important;
                    border-left-color: ${CONFIG.visualStyles.successStateBorder} !important;
                    color: #065f46 !important;
                }

                .activity-explanation.inactive {
                    background: ${CONFIG.visualStyles.exceededBackground} !important;
                    border-left-color: ${CONFIG.visualStyles.exceededBorder} !important;
                    color: #7f1d1d !important;
                }

                .activity-explanation .status-icon {
                    display: inline-block;
                    margin-right: 8px;
                    font-weight: bold;
                }

                .activity-explanation .hint {
                    font-size: 12px !important;
                    margin-top: 6px !important;
                    opacity: 0.8 !important;
                    font-weight: normal !important;
                }

                /* 🎨 АНИМАЦИИ */
                @keyframes pulseSuccess {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }

                .activity-explanation.active.pulse {
                    animation: pulseSuccess 2s infinite;
                }
            `;
            document.head.appendChild(style);
            logger.success('Визуальные стили добавлены');
            return style;
        }, 'Добавление визуальных стилей');
    }

    // ===== ОСНОВНАЯ ЛОГИКА =====
    function enhanceActivityToggle() {
        return safeExecute(() => {
            logger.info('Поиск переключателя активности...');

            const checkToggle = setInterval(function() {
                const toggleSwitch = document.querySelector(CONFIG.toggleSelector);
                
                if (toggleSwitch) {
                    logger.success('Переключатель активности найден', toggleSwitch);
                    clearInterval(checkToggle);
                    setupToggleEnhancements(toggleSwitch);
                }
            }, CONFIG.checkInterval);

            // Останавливаем проверку через максимальное время ожидания
            setTimeout(() => {
                clearInterval(checkToggle);
                logger.warn('Поиск переключателя завершен по таймауту');
            }, CONFIG.maxWaitTime);

            return true;
        }, 'Улучшение переключателя активности');
    }

    function setupToggleEnhancements(toggleSwitch) {
        return safeExecute(() => {
            const toggleContainer = toggleSwitch.closest('.form-group');
            
            if (!toggleContainer) {
                logger.error('Контейнер переключателя не найден');
                return false;
            }

            // Создаем поясняющий блок
            const explanation = createExplanationElement();
            
            // Функция обновления состояния
            const updateExplanation = createUpdateHandler(toggleSwitch, explanation);
            
            // Настраиваем отслеживание изменений
            setupChangeTracking(toggleSwitch, updateExplanation);
            
            // Вставляем пояснение в DOM
            insertExplanationElement(toggleContainer, explanation, toggleSwitch);
            
            // Улучшаем визуальное отображение переключателя
            enhanceToggleAppearance(toggleContainer);
            
            // Инициализируем начальное состояние
            updateExplanation();
            
            logger.success('Улучшения переключателя применены');
            return true;
        }, 'Настройка улучшений переключателя');
    }

    function createExplanationElement() {
        const explanation = document.createElement('div');
        explanation.className = 'activity-explanation';
        explanation.setAttribute('data-enhanced', 'true');
        return explanation;
    }

    function createUpdateHandler(toggleSwitch, explanation) {
        return function() {
            const isActive = toggleSwitch.checked;
            
            if (isActive) {
                explanation.className = 'activity-explanation active pulse';
                explanation.innerHTML = `
                    <span class="status-icon">✅</span>
                    <strong>Новость ОТОБРАЖАЕТСЯ на сайте</strong>
                    <div class="hint">Пользователи видят эту новость в ленте и могут ее читать</div>
                `;
            } else {
                explanation.className = 'activity-explanation inactive';
                explanation.innerHTML = `
                    <span class="status-icon">❌</span>
                    <strong>Новость СКРЫТА с сайта</strong>
                    <div class="hint">Пользователи не видят эту новость в ленте</div>
                `;
            }
        };
    }

    function setupChangeTracking(toggleSwitch, updateHandler) {
        // Обработчик события change
        toggleSwitch.addEventListener('change', updateHandler);
        
        // Обработчик события click для мгновенного обновления
        toggleSwitch.addEventListener('click', updateHandler);
        
        // MutationObserver для отслеживания изменений в DOM
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'checked' || mutation.attributeName === 'class')) {
                    setTimeout(updateHandler, 10);
                }
            });
        });
        
        observer.observe(toggleSwitch, {
            attributes: true,
            attributeFilter: ['checked', 'class']
        });
        
        // Отслеживаем изменения в родительском элементе (для bootstrap-toggle)
        const toggleParent = toggleSwitch.closest('.toggle');
        if (toggleParent) {
            const parentObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes') {
                        setTimeout(updateHandler, 10);
                    }
                });
            });
            
            parentObserver.observe(toggleParent, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    function insertExplanationElement(container, explanation, toggleSwitch) {
        const toggleWidget = container.querySelector('.toggle');
        if (toggleWidget) {
            toggleWidget.parentNode.insertBefore(explanation, toggleWidget.nextSibling);
        } else {
            container.appendChild(explanation);
        }
    }

    function enhanceToggleAppearance(container) {
        setTimeout(() => {
            const toggleBtn = container.querySelector('.toggle-group');
            if (toggleBtn) {
                const onLabel = toggleBtn.querySelector('.toggle-on');
                const offLabel = toggleBtn.querySelector('.toggle-off');
                
                if (onLabel) {
                    onLabel.textContent = 'АКТИВНА';
                    onLabel.style.fontWeight = 'bold';
                    onLabel.style.fontSize = '11px';
                    onLabel.style.padding = '0 10px';
                    onLabel.style.letterSpacing = '0.5px';
                }
                
                if (offLabel) {
                    offLabel.textContent = 'СКРЫТА';
                    offLabel.style.fontWeight = 'bold';
                    offLabel.style.fontSize = '11px';
                    offLabel.style.padding = '0 10px';
                    offLabel.style.letterSpacing = '0.5px';
                }
            }
        }, 100);
    }

    // ===== УПРАВЛЕНИЕ СОБЫТИЯМИ =====
    function setupEventListeners() {
        logger.info('Настройка обработчиков событий...');
        // Дополнительные глобальные обработчики могут быть добавлены здесь
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    async function initialize() {
        logger.info('🚀 Инициализация улучшенного переключателя активности...');
        
        try {
            // Добавляем визуальные стили
            await safeExecute(addVisualStyles, 'Добавление стилей');
            
            // Настраиваем обработчики событий
            await safeExecute(setupEventListeners, 'Настройка обработчиков событий');
            
            // Запускаем основную функциональность
            await safeExecute(enhanceActivityToggle, 'Улучшение переключателя активности');
            
            // Проверяем обновления
            await safeExecute(checkForUpdates, 'Проверка обновлений');
            
            logger.success('✅ Скрипт успешно инициализирован!');
            logger.info('📝 Автор: Островский Николай Николаевич, Запорожское региональное отделение Партии «Единая Россия»');
            
        } catch (error) {
            logger.error('Ошибка инициализации скрипта', error);
        }
    }

    // ===== УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ =====
    function cleanup() {
        logger.info('Очистка ресурсов...');
        // Здесь может быть добавлена логика очистки при необходимости
    }

    // ===== ЗАПУСК СКРИПТА =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initialize().catch(error => {
                logger.error('Критическая ошибка при инициализации', error);
            });
        });
    } else {
        initialize().catch(error => {
            logger.error('Критическая ошибка при инициализации', error);
        });
    }

    // Очистка при выгрузке страницы
    window.addEventListener('beforeunload', cleanup);

})();
