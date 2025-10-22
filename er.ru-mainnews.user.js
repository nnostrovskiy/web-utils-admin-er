// ==UserScript==
// @name         Вставка без форматирования с сохранением абзацев
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Вставляет текст без форматирования по Ctrl+V, сохраняя существующие абзацы и убирая лишние пробелы
// @author       Островский Николай Николаевич, Запорожское региональное отделение Партии «Единая Россия»
// @match        https://admin.er.ru/admin/news/create
// @match        https://admin.er.ru/admin/news/*/edit
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-mainnews.user.js
// @downloadURL  https://raw.githubusercontent.com/nnostrovskiy/web-utils-admin-er/main/er.ru-mainnews.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
        debugMode: true,
        maxWaitTime: 15000,
        checkInterval: 500,
        editorId: 'richtextbody',
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
            // 🎨 ЦВЕТА УВЕДОМЛЕНИЙ
            notificationBackground: '#f8fafc',
            notificationBorder: '#e2e8f0',
            notificationSuccess: '#10b981',
            notificationInfo: '#3b82f6',
            notificationShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
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

    function waitForTinyMCE(editorId, timeout = CONFIG.maxWaitTime) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkEditor = () => {
                const editor = window.tinymce && window.tinymce.get(editorId);
                if (editor) {
                    resolve(editor);
                    return;
                }
                
                if (Date.now() - startTime >= timeout) {
                    reject(new Error(`Редактор TinyMCE не найден: ${editorId}`));
                    return;
                }
                
                setTimeout(checkEditor, CONFIG.checkInterval);
            };
            
            checkEditor();
        });
    }

    // ===== СИСТЕМА ПРОВЕРКИ ОБНОВЛЕНИЙ =====
    function checkForUpdates() {
        logger.info('Проверка обновлений скрипта вставки...');
        // Автоматическая проверка через @updateURL в метаданных
    }

    // ===== ФУНКЦИИ ДЛЯ ОБРАБОТКИ ТЕКСТА =====
    function cleanText(text) {
        return safeExecute(() => {
            if (!text) return '';
            
            let clean = text;
            
            // 🔧 Удаляем HTML теги
            clean = clean.replace(/<[^>]*>/g, '');
            
            // 🔧 Унифицируем переносы строк
            clean = clean.replace(/\r\n/g, '\n');
            clean = clean.replace(/\r/g, '\n');
            
            // 🔧 Разделяем на строки и обрабатываем
            let lines = clean.split('\n');
            lines = lines.map(line => {
                let trimmed = line.trim();
                trimmed = trimmed.replace(/[ \t]+/g, ' '); // Заменяем множественные пробелы
                return trimmed;
            });
            
            // 🔧 Сохраняем структуру абзацев
            let resultLines = [];
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].length > 0) {
                    resultLines.push(lines[i]);
                } else if (i > 0 && i < lines.length - 1 && 
                          lines[i-1].length > 0 && lines[i+1].length > 0) {
                    resultLines.push('');
                }
            }
            
            logger.info('Текст очищен', { 
                originalLength: text.length, 
                cleanedLength: resultLines.join('\n').length,
                linesCount: resultLines.length 
            });
            
            return resultLines.join('\n');
        }, 'Очистка текста', '');
    }

    function formatTextWithParagraphs(text) {
        return safeExecute(() => {
            if (!text) return '';
            
            const lines = text.split('\n').filter(line => line.length > 0);
            if (lines.length === 0) return '';
            
            const formatted = lines.map(line => `<p>${line}</p>`).join('');
            
            logger.info('Текст отформатирован', { 
                linesCount: lines.length,
                formattedLength: formatted.length 
            });
            
            return formatted;
        }, 'Форматирование текста', '');
    }

    // ===== ВИЗУАЛЬНЫЕ УВЕДОМЛЕНИЯ И СТИЛИ =====
    function addVisualStyles() {
        return safeExecute(() => {
            const style = document.createElement('style');
            style.textContent = `
                /* 🎨 СТИЛИ УВЕДОМЛЕНИЙ О ВСТАВКЕ */
                .paste-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    background: ${CONFIG.visualStyles.notificationBackground};
                    border: 1px solid ${CONFIG.visualStyles.notificationBorder};
                    box-shadow: ${CONFIG.visualStyles.notificationShadow};
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: translateX(120%);
                    max-width: 300px;
                }

                .paste-notification.show {
                    transform: translateX(0);
                }

                .paste-notification.success {
                    border-left: 4px solid ${CONFIG.visualStyles.notificationSuccess};
                    background: ${CONFIG.visualStyles.successStateBackground};
                }

                .paste-notification.info {
                    border-left: 4px solid ${CONFIG.visualStyles.notificationInfo};
                    background: ${CONFIG.visualStyles.blueBackground};
                }

                .paste-notification .notification-icon {
                    display: inline-block;
                    margin-right: 8px;
                    font-weight: bold;
                }

                .paste-notification .notification-content {
                    display: flex;
                    align-items: center;
                }

                .paste-notification .notification-stats {
                    font-size: 12px;
                    opacity: 0.8;
                    margin-top: 4px;
                    font-weight: normal;
                }

                /* 🎨 АНИМАЦИИ */
                @keyframes slideInRight {
                    from {
                        transform: translateX(120%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(120%);
                        opacity: 0;
                    }
                }

                .paste-notification.slide-in {
                    animation: slideInRight 0.3s ease-out;
                }

                .paste-notification.slide-out {
                    animation: slideOutRight 0.3s ease-in;
                }
            `;
            document.head.appendChild(style);
            logger.success('Визуальные стили для уведомлений добавлены');
            return style;
        }, 'Добавление визуальных стилей');
    }

    function showPasteNotification(message, type = 'success', duration = 3000) {
        return safeExecute(() => {
            // Удаляем существующие уведомления
            const existingNotifications = document.querySelectorAll('.paste-notification');
            existingNotifications.forEach(notification => notification.remove());
            
            // Создаем новое уведомление
            const notification = document.createElement('div');
            notification.className = `paste-notification ${type} slide-in`;
            notification.innerHTML = `
                <div class="notification-content">
                    <span class="notification-icon">${type === 'success' ? '✅' : 'ℹ️'}</span>
                    ${message}
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Показываем уведомление
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            // Автоматическое скрытие
            setTimeout(() => {
                notification.classList.remove('show');
                notification.classList.add('slide-out');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, duration);
            
            logger.info('Показано уведомление', { message, type, duration });
            return notification;
        }, 'Показ уведомления о вставке');
    }

    // ===== ОСНОВНАЯ ЛОГИКА =====
    function setupPasteHandler() {
        return safeExecute(async () => {
            logger.info('Настройка обработчика вставки без форматирования...');
            
            try {
                const editor = await waitForTinyMCE(CONFIG.editorId);
                logger.success('Редактор TinyMCE найден', editor);
                
                // Обработчик события paste через API TinyMCE
                editor.on('paste', function(e) {
                    safeExecute(() => {
                        if (e.clipboardData) {
                            const pastedText = e.clipboardData.getData('text/plain');
                            if (pastedText) {
                                e.preventDefault();
                                
                                logger.info('Перехвачена вставка через Ctrl+V', { 
                                    textLength: pastedText.length 
                                });
                                
                                // Очищаем текст
                                const clean = cleanText(pastedText);
                                
                                // Форматируем с сохранением абзацев
                                const formattedText = formatTextWithParagraphs(clean);
                                
                                // Вставляем в редактор
                                editor.insertContent(formattedText);
                                
                                // Показываем уведомление
                                const linesCount = clean.split('\n').filter(line => line.length > 0).length;
                                showPasteNotification(
                                    `Текст вставлен без форматирования`,
                                    'success',
                                    2000
                                );
                                
                                logger.success('Текст успешно вставлен', { 
                                    originalLines: pastedText.split('\n').length,
                                    cleanedLines: linesCount,
                                    formatted: formattedText.length > 0 
                                });
                            }
                        }
                    }, 'Обработка вставки текста');
                });
                
                logger.success('✅ Обработчик вставки без форматирования настроен!');
                return true;
                
            } catch (error) {
                logger.error('Ошибка настройки обработчика вставки', error);
                return false;
            }
        }, 'Настройка обработчика вставки');
    }

    // ===== АЛЬТЕРНАТИВНЫЙ ОБРАБОТЧИК ДЛЯ РЕЗЕРВНОГО ВАРИАНТА =====
    function setupFallbackPasteHandler() {
        return safeExecute(() => {
            logger.info('Настройка резервного обработчика вставки...');
            
            document.addEventListener('paste', function(e) {
                const activeElement = document.activeElement;
                const isTinyMCEActive = activeElement.closest('.tox-edit-area') || 
                                       activeElement.closest('.mce-content-body');
                
                if (isTinyMCEActive) {
                    const pastedText = e.clipboardData.getData('text/plain');
                    if (pastedText) {
                        e.preventDefault();
                        
                        const clean = cleanText(pastedText);
                        const formattedText = formatTextWithParagraphs(clean);
                        
                        // Используем execCommand для вставки
                        document.execCommand('insertHTML', false, formattedText);
                        
                        showPasteNotification(
                            `Текст вставлен (резервный метод)`,
                            'info',
                            2000
                        );
                        
                        logger.info('Текст вставлен через резервный метод', {
                            textLength: pastedText.length,
                            cleanedLength: clean.length
                        });
                    }
                }
            });
            
            logger.success('Резервный обработчик вставки настроен');
            return true;
        }, 'Настройка резервного обработчика');
    }

    // ===== УПРАВЛЕНИЕ СОБЫТИЯМИ =====
    function setupEventListeners() {
        logger.info('Настройка дополнительных обработчиков событий...');
        // Дополнительные глобальные обработчики могут быть добавлены здесь
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    async function initialize() {
        logger.info('🚀 Инициализация скрипта вставки без форматирования...');
        
        try {
            // Добавляем визуальные стили
            await safeExecute(addVisualStyles, 'Добавление стилей');
            
            // Настраиваем основной обработчик
            const mainHandlerSuccess = await safeExecute(setupPasteHandler, 'Настройка основного обработчика');
            
            // Если основной обработчик не сработал, настраиваем резервный
            if (!mainHandlerSuccess) {
                logger.warn('Основной обработчик не сработал, настраиваю резервный...');
                await safeExecute(setupFallbackPasteHandler, 'Настройка резервного обработчика');
            }
            
            // Настраиваем дополнительные обработчики
            await safeExecute(setupEventListeners, 'Настройка обработчиков событий');
            
            // Проверяем обновления
            await safeExecute(checkForUpdates, 'Проверка обновлений');
            
            logger.success('✅ Скрипт вставки без форматирования успешно инициализирован!');
            logger.info('📝 Автор: Островский Николай Николаевич, Запорожское региональное отделение Партии «Единая Россия»');
            
        } catch (error) {
            logger.error('Ошибка инициализации скрипта вставки', error);
        }
    }

    // ===== УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ =====
    function cleanup() {
        logger.info('Очистка ресурсов скрипта вставки...');
        // Удаляем все созданные уведомления
        const notifications = document.querySelectorAll('.paste-notification');
        notifications.forEach(notification => notification.remove());
    }

    // ===== ЗАПУСК СКРИПТА =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initialize().catch(error => {
                logger.error('Критическая ошибка при инициализации скрипта вставки', error);
            });
        });
    } else {
        initialize().catch(error => {
            logger.error('Критическая ошибка при инициализации скрипта вставки', error);
        });
    }

    // Очистка при выгрузке страницы
    window.addEventListener('beforeunload', cleanup);


})();
