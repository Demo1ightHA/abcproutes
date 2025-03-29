// ==UserScript==
// @name         ABCP Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Улучшения панели выбора филиалов и цвета
// @author       Demo1ightHA
// @match        https://cp.abcp.ru/distributor/*/routes/*/view
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/Demo1ightHA/abcp-enhancer/raw/main/abcp-enhancer.user.js
// @updateURL    https://github.com/Demo1ightHA/abcp-enhancer/raw/main/abcp-enhancer.user.js
// ==/UserScript==



(function () {
    'use strict';

    const TEXT_TO_WAIT_FOR = 'Цвет в рабочее время (hex)';
    const MAX_WAIT_TIME = 10000; // 10 секунд

    // Проверка текущего URL
    function isMatchingPage() {
        return /^https:\/\/cp\.abcp\.ru\/distributor\/\d+\/routes\/\d+\/view$/.test(location.href);
    }

    // Проверка: есть ли уже текст на странице
    function checkTextImmediately(text) {
        return document.body.textContent.includes(text);
    }

    // Ожидание появления текста с таймером
    function waitForText(text, callback, timeout = 10000) {
        if (checkTextImmediately(text)) {
            console.log(`🟢 Текст "${text}" уже есть на странице`);
            callback();
            return;
        }

        const startTime = Date.now();

        const observer = new MutationObserver((mutations, obs) => {
            if (checkTextImmediately(text)) {
                console.log(`🔵 Текст "${text}" появился в DOM`);
                obs.disconnect();
                callback();
            } else if (Date.now() - startTime > timeout) {
                console.warn(`⏰ Ожидание текста "${text}" истекло (${timeout / 1000} секунд)`);
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Функция для работы с филиалами
    function setupBranchPanel() {
        (async function () {
            const inputWrapper = document.querySelector('.bp3-tag-input-values');
            if (!inputWrapper) return alert('Не найден контейнер поля ввода');

            const input = inputWrapper.querySelector('input');
            if (!input) return alert('Не найден input');

            input.focus();
            input.click();

            async function waitForMenu(selector, timeout = 5000) {
                return new Promise((resolve, reject) => {
                    const interval = 100;
                    let waited = 0;
                    const check = () => {
                        const el = document.querySelector(selector);
                        if (el) return resolve(el);
                        waited += interval;
                        if (waited >= timeout) return reject('Список филиалов не найден');
                        setTimeout(check, interval);
                    };
                    check();
                });
            }

            let menu;
            try {
                menu = await waitForMenu('.bp3-portal .bp3-menu');
            } catch (e) {
                return alert(e);
            }

            const branches = [...menu.querySelectorAll('li')];
            if (!branches.length) return alert('Филиалы не найдены');

            document.getElementById('branch-floating-panel')?.remove();

            const inputContainer = document.querySelector('._3qV641uBQryaQmC1 > .bp3-popover-wrapper');
            if (inputContainer) {
                let parent = inputContainer.parentNode;
                while (parent && parent !== document.body) {
                    parent.style.width = '100%';
                    parent.style.maxWidth = 'none';
                    parent.style.flex = '1 1 100%';
                    parent = parent.parentNode;
                }
            }

            const panel = document.createElement('div');
            panel.id = 'branch-floating-panel';
            panel.style.width = '100%';
            panel.style.maxWidth = 'none';
            panel.style.background = '#fff';
            panel.style.border = '1px solid #ddd';
            panel.style.padding = '15px';
            panel.style.borderRadius = '4px';
            panel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            panel.style.display = 'flex';
            panel.style.flexWrap = 'wrap';
            panel.style.gap = '20px';
            panel.style.marginTop = '5px';
            panel.style.boxSizing = 'border-box';

            const groups = {
                'Магазин': [],
                'Доставка': [],
                'Склад': [],
                'Самовывоз': [],
                'Прочее': []
            };

            branches.forEach(branch => {
                let label = branch.textContent.trim();
                const originalLabel = label;

                label = label
                    .replace(/^blank\d*-?/i, '')
                    .replace(/\bblank\b/i, '')
                    .trim();

                let groupKey = 'Прочее';
                if (/магазин/i.test(label)) groupKey = 'Магазин';
                else if (/доставка/i.test(label)) groupKey = 'Доставка';
                else if (/склад/i.test(label)) groupKey = 'Склад';
                else if (/самовывоз/i.test(label)) groupKey = 'Самовывоз';

                groups[groupKey].push({ label, originalLabel });
            });

            const buttonsPerRow = 8;
            const buttonWidth = `calc(${100 / buttonsPerRow}% - 9px)`;
            const savedStates = JSON.parse(localStorage.getItem('branchPanelStates') || '{}');

            const renderButtons = list => list.map(({ label, originalLabel }) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                btn.style.padding = '8px 6px';
                btn.style.border = '1px solid #e1e1e1';
                btn.style.borderRadius = '4px';
                btn.style.cursor = 'pointer';
                btn.style.background = '#f8f8f8';
                btn.style.flex = `0 1 ${buttonWidth}`;
                btn.style.minWidth = '120px';
                btn.style.whiteSpace = 'normal';
                btn.style.textOverflow = 'clip';
                btn.style.textAlign = 'center';
                btn.style.boxSizing = 'border-box';
                btn.style.fontSize = '14px';
                btn.style.color = '#333';
                btn.style.transition = 'all 0.2s ease';
                btn.title = label;

                btn.addEventListener('mouseenter', () => {
                    btn.style.background = '#eee';
                    btn.style.borderColor = '#ccc';
                    btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                });

                btn.addEventListener('mouseleave', () => {
                    btn.style.background = '#f8f8f8';
                    btn.style.borderColor = '#e1e1e1';
                    btn.style.boxShadow = 'none';
                });

                btn.addEventListener('click', async () => {
                    const exists = Array.from(inputWrapper.querySelectorAll('.bp3-tag'))
                        .some(el => el.textContent.includes(originalLabel));
                    if (exists) return;

                    input.focus();
                    input.click();

                    const waitForMenu = () => new Promise((resolve, reject) => {
                        const timeout = 3000;
                        const interval = 100;
                        let elapsed = 0;
                        const check = () => {
                            const list = document.querySelectorAll('.bp3-menu .bp3-menu-item');
                            if (list.length > 0) return resolve(list);
                            elapsed += interval;
                            if (elapsed >= timeout) reject('Выпадающее меню не найдено');
                            else setTimeout(check, interval);
                        };
                        check();
                    });

                    let items;
                    try {
                        items = await waitForMenu();
                    } catch (e) {
                        return alert(e);
                    }

                    const targetItem = Array.from(items).find(item =>
                        item.textContent.trim() === originalLabel.trim()
                    );

                    if (!targetItem) {
                        alert(`Не удалось найти филиал в выпадающем списке: ${originalLabel}`);
                        return;
                    }

                    targetItem.click();
                });

                return btn;
            });

            for (const groupName in groups) {
                if (groups[groupName].length === 0) continue;

                const groupWrapper = document.createElement('div');
                groupWrapper.style.flex = '1 1 100%';
                groupWrapper.style.minWidth = '400px';
                groupWrapper.style.boxSizing = 'border-box';
                groupWrapper.style.border = '1px solid #eee';
                groupWrapper.style.borderRadius = '6px';
                groupWrapper.style.padding = '10px';

                const title = document.createElement('div');
                title.style.display = 'flex';
                title.style.alignItems = 'center';
                title.style.fontWeight = 'bold';
                title.style.fontSize = '16px';
                title.style.cursor = 'pointer';
                title.style.marginBottom = '10px';
                title.textContent = groupName;

                const toggleIcon = document.createElement('span');
                toggleIcon.style.marginLeft = '5px';
                title.appendChild(toggleIcon);

                const buttonContainer = document.createElement('div');
                buttonContainer.style.flexWrap = 'wrap';
                buttonContainer.style.gap = '10px';

                const isOpen = savedStates[groupName] ?? (groupName === 'Магазин');
                buttonContainer.style.display = isOpen ? 'flex' : 'none';
                toggleIcon.textContent = isOpen ? ' 🔽' : ' ▶️';

                title.addEventListener('click', () => {
                    const visible = buttonContainer.style.display === 'flex';
                    buttonContainer.style.display = visible ? 'none' : 'flex';
                    toggleIcon.textContent = visible ? ' ▶️' : ' 🔽';
                    savedStates[groupName] = !visible;
                    localStorage.setItem('branchPanelStates', JSON.stringify(savedStates));
                });

                const items = groups[groupName];

                if (groupName === 'Магазин') {
                    const spb = items.filter(b => /СПБ/i.test(b.label));
                    const lo = items.filter(b => /(^|[^А-Я])ЛО([^А-Я]|$)/i.test(b.label));
                    const rest = items.filter(b => !spb.includes(b) && !lo.includes(b));

                    if (spb.length) {
                        const sub = document.createElement('div');
                        sub.textContent = 'Санкт-Петербург';
                        sub.style.width = '100%';
                        sub.style.fontWeight = 'bold';
                        sub.style.margin = '5px 0';
                        buttonContainer.appendChild(sub);
                        renderButtons(spb).forEach(btn => buttonContainer.appendChild(btn));
                    }

                    if (lo.length) {
                        const sub = document.createElement('div');
                        sub.textContent = 'Ленинградская область';
                        sub.style.width = '100%';
                        sub.style.fontWeight = 'bold';
                        sub.style.margin = '10px 0 5px';
                        buttonContainer.appendChild(sub);
                        renderButtons(lo).forEach(btn => buttonContainer.appendChild(btn));
                    }

                    if (rest.length) {
                        const sub = document.createElement('div');
                        sub.textContent = 'Остальные магазины';
                        sub.style.width = '100%';
                        sub.style.fontWeight = 'bold';
                        sub.style.margin = '10px 0 5px';
                        buttonContainer.appendChild(sub);
                        renderButtons(rest).forEach(btn => buttonContainer.appendChild(btn));
                    }
                } else {
                    const lo = items.filter(b => /(^|[^А-Я])ЛО([^А-Я]|$)/i.test(b.label));
                    const rest = items.filter(b => !lo.includes(b));

                    if (lo.length) {
                        const sub = document.createElement('div');
                        sub.textContent = 'Ленинградская область';
                        sub.style.width = '100%';
                        sub.style.fontWeight = 'bold';
                        sub.style.margin = '5px 0';
                        buttonContainer.appendChild(sub);
                        renderButtons(lo).forEach(btn => buttonContainer.appendChild(btn));
                    }

                    if (rest.length) {
                        const sub = document.createElement('div');
                        sub.textContent = 'Остальные';
                        sub.style.width = '100%';
                        sub.style.fontWeight = 'bold';
                        sub.style.margin = '10px 0 5px';
                        buttonContainer.appendChild(sub);
                        renderButtons(rest).forEach(btn => buttonContainer.appendChild(btn));
                    }
                }

                groupWrapper.appendChild(title);
                groupWrapper.appendChild(buttonContainer);
                panel.appendChild(groupWrapper);
            }

            if (inputContainer) {
                inputContainer.parentNode.insertBefore(panel, inputContainer.nextSibling);
            } else {
                inputWrapper.parentNode.insertBefore(panel, inputWrapper.nextSibling);
            }

            // Добавляем кнопку "Очистить всё"
            const clearButton = document.createElement('button');
            clearButton.textContent = 'Очистить всё';
            clearButton.style.marginTop = '15px';
            clearButton.style.padding = '6px 12px';
            clearButton.style.border = '1px solid #d33';
            clearButton.style.background = '#fff';
            clearButton.style.color = '#d33';
            clearButton.style.borderRadius = '4px';
            clearButton.style.cursor = 'pointer';
            clearButton.style.alignSelf = 'flex-start';
            clearButton.style.fontSize = '14px';
            clearButton.style.transition = 'all 0.2s ease';

            clearButton.addEventListener('mouseenter', () => {
                clearButton.style.background = '#fee';
            });
            clearButton.addEventListener('mouseleave', () => {
                clearButton.style.background = '#fff';
            });
            clearButton.addEventListener('click', () => {
                const tags = inputWrapper.querySelectorAll('.bp3-tag');
                tags.forEach(tag => tag.remove());
                input.value = '';
            });

            inputWrapper.parentNode.insertBefore(clearButton, inputWrapper.nextSibling);
        })();
    }

    // Функция для работы с цветом
    function setupColorToggle() {
        function collapse(overlay) {
            overlay.style.setProperty('display', 'none', 'important');
            console.log('❌ Блок выбора цвета скрыт');
        }

        function expand(overlay) {
            overlay.style.setProperty('display', '', 'important');
            console.log('✅ Блок выбора цвета показан');
        }

        function insertToggleButton(overlay, container) {
            const btn = document.createElement('button');
            btn.textContent = 'Показать / Скрыть выбор цвета';

            Object.assign(btn.style, {
                marginTop: '8px',
                padding: '5px 14px',
                backgroundColor: '#007bff',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: 'fit-content',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.3s ease',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
            });

            btn.onmouseenter = () => {
                btn.style.backgroundColor = '#0056b3';
            };
            btn.onmouseleave = () => {
                btn.style.backgroundColor = '#007bff';
            };

            let collapsed = true;
            collapse(overlay);

            btn.addEventListener('click', () => {
                if (collapsed) expand(overlay);
                else collapse(overlay);
                collapsed = !collapsed;
            });

            container.appendChild(btn);
            console.log('✅ Кнопка вставлена рядом с color input');
        }

        function waitForElements() {
            const overlay = document.querySelector('._2JbGmpDVVm0q6jws');
            const inputContainer = document.querySelector('.X_YbAeaCz-4q0ZkA')?.closest('._3HlTmoXqUTT5UelY');

            if (overlay && inputContainer) {
                insertToggleButton(overlay, inputContainer);
                return true;
            }

            return false;
        }

        const interval = setInterval(() => {
            if (waitForElements()) {
                clearInterval(interval);
            } else {
                console.log('⏳ Ожидание появления блока выбора цвета...');
            }
        }, 500);
    }

    // Основной запуск скрипта
    function runLogic() {
        waitForText(TEXT_TO_WAIT_FOR, () => {
            console.log('🎉 Текст "Цвет в рабочее время (hex)" найден!');
            setupBranchPanel();
            setupColorToggle();
        }, MAX_WAIT_TIME);
    }

    // Обработка изменения URL (для SPA)
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (isMatchingPage()) {
                console.log('🔄 Обнаружена навигация на нужную страницу, перезапуск логики');
                runLogic();
            }
        }
    }, 1000);

    // Первый запуск
    if (isMatchingPage()) {
        runLogic();
    }
})();