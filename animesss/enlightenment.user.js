// ==UserScript==
// @name         Animesss Просветление
// @namespace    http://tampermonkey.net/
// @version      1.11
// @description  Помогает познать просветление
// @author       li4i
// @match        *://*.animesss.com/*
// @match        *://*.animesss.tv/*
// @match        *://*.animestars.org/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // CONFIG
    // =========================================================

    const BASE_URL = location.origin;

    const CONFIG = {
        delays: {
            request: 1000,
            betweenPages: 500,
            statusCheck: 60000,
            autoCheck: 6 * 60 * 60 * 1000,
            statusCache: 30000
        },

        selectors: {
            headerMenu: '.header__group-menu2',
            profileLink: 'a[href*="/user/"]',
            logoutButton: 'a[href*="logout"]',

            cardsContainer: '.anime-cards',
            cardItem: '.anime-cards__item',

            questItem: '.daily-quests-list__item',
            questTitle: '.daily-quests-list__title'
        },

        storage: {
            lastCheck: 'enlightenment_last_check'
        },

        questName: 'Познать просветление'
    };

    const LOG = {
        log: true,
        warn: true,
        error: true
    };

    const STATE = {
        isRunning: false,
        authFailed: false,

        page: 1,

        intervals: {
            status: null,
            autoCheck: null
        },

        button: null,
        notification: null,

        cache: {
            enlightenment: {
                value: null,
                time: 0
            }
        }
    };

    // =========================================================
    // LOGGER
    // =========================================================

    function logger(type, message, data = null) {

        if (!LOG[type]) { return; }
        const prefix = '[Просветление]';

        if (data !== null) {
            console[type](`${prefix} ${message}`, data);
        } else {
            console[type](`${prefix} ${message}`);
        }
    }

    // =========================================================
    // HELPERS
    // =========================================================

    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function clearIntervals() {

        Object.keys(STATE.intervals).forEach(key => {

            if (STATE.intervals[key]) {
                clearInterval(STATE.intervals[key]);
                STATE.intervals[key] = null;
            }
        });
    }

    function getProfileLink() {
        const element = document.querySelector(CONFIG.selectors.profileLink);
        return element?.href || null;
    }

    // =========================================================
    // WAIT ELEMENT
    // =========================================================

    function waitForElement(selector) {

        return new Promise(resolve => {

            const existing = document.querySelector(selector);

            if (existing) {
                resolve(existing);
                return;
            }

            const observer = new MutationObserver(() => {

                const element = document.querySelector(selector);

                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // =========================================================
    // AUTH
    // =========================================================

    function isAuthorized() {

        if (STATE.authFailed) {
            return false;
        }

        const userHash =
              typeof window.dle_login_hash !== 'undefined' &&
              window.dle_login_hash &&
              window.dle_login_hash !== '';

        const hasProfileLink = Boolean(document.querySelector(CONFIG.selectors.profileLink));
        const hasLogoutButton = Boolean(document.querySelector(CONFIG.selectors.logoutButton));

        return Boolean(userHash && hasProfileLink && hasLogoutButton);
    }

    function stopAuth() {

        STATE.authFailed = true;

        stopScript({
            type: 'auth'
        });

        return false;
    }

    // =========================================================
    // STYLES
    // =========================================================

    function createStyles() {

        if (document.getElementById('enlightenment-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'enlightenment-styles';
        style.textContent = `
            .enlightenment-btn {
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 40px;
                height: 40px;
                background: var(--bg-btn-dark);
                box-shadow: var(--bsh-btn-dark);
                border-radius: 50%;
                transition: .3s;
                cursor: pointer;
            }

            .enlightenment-btn span {
                width: 42px;
                height: 42px;
                background-image: url(/prosvetleniya.png);
                background-size: 80%;
                background-repeat: no-repeat;
                background-position: center;
                filter: grayscale(100%);
                transition: .3s;
            }

            .enlightenment-btn:hover {background-color: #28a745;}
            .enlightenment-btn.active span {filter: grayscale(0%);}

            .enlightenment-notification {
                position: fixed;
                top: 68px;
                right: 26px;
                padding: 10px 14px;
                background: rgba(0,0,0,.85);
                color: #fff;
                border-radius: 8px;
                font-size: 14px;
                z-index: 999999;
                box-shadow: 0 0 10px rgba(0,0,0,.5);
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================
    // NOTIFICATION
    // =========================================================

    function showNotification(message) {

        if (!STATE.notification) {

            STATE.notification = document.createElement('div');
            STATE.notification.className = 'enlightenment-notification';

            document.body.appendChild(STATE.notification);
        }

        STATE.notification.textContent = message;

        clearTimeout(STATE.notification.hideTimeout);

        STATE.notification.hideTimeout = setTimeout(() => {
            STATE.notification?.remove();
            STATE.notification = null;
        }, 5000);
    }

    // =========================================================
    // BUTTON
    // =========================================================

    function updateButtonState(active) {

        if (!STATE.button) {
            return;
        }

        STATE.button.classList.toggle('active', active);
    }

    function createButton() {

        if (STATE.button) {
            return;
        }

        const target = document.querySelector(CONFIG.selectors.headerMenu);

        if (!target) {
            logger('error', 'Не найден контейнер кнопки');
            return;
        }

        STATE.button = document.createElement('div');
        STATE.button.className = 'enlightenment-btn';

        const icon = document.createElement('span');

        STATE.button.appendChild(icon);

        target.parentNode.insertBefore(STATE.button, target);

        STATE.button.addEventListener('click', async () => {

            if (!isAuthorized()) {
                logger('warn', 'Попытка запуска без авторизации');
                showNotification('Необходимо войти в аккаунт');
                return;
            }

            if (STATE.isRunning) {

                stopScript({
                    type: 'manual'
                });

                return;
            }

            await startScript();
        });
    }

    // =========================================================
    // FETCH
    // =========================================================

    async function fetchPage(url) {

        if (!isAuthorized()) { return stopAuth(); }

        try {

            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': '*/*'
                }
            });

            if (response.status === 403) { return stopAuth(); }

            if (response.status === 429) {

                stopScript({
                    type: 'blocked',
                    message: 'Слишком много запросов'
                });
                return false;
            }

            if (response.status >= 500) {

                stopScript({
                    type: 'page_error',
                    message: `Ошибка сервера (${response.status})`
                });
                return false;
            }

            if (!response.ok) {

                logger('warn', `Ошибка запроса ${response.status}`, {url});
                return false;
            }
            return response;

        } catch (error) {

            stopScript({
                type: 'error',
                error
            });
            return false;
        }
    }

    // =========================================================
    // STATUS
    // =========================================================

    async function getEnlightenmentStatus(force = false) {

        const now = Date.now();
        const cache = STATE.cache.enlightenment;

        if (!force && cache.value !== null && now - cache.time < CONFIG.delays.statusCache) {
            return cache.value;
        }

        const profileLink = getProfileLink();

        if (!profileLink) { return false; }

        const response = await fetchPage(profileLink);

        if (!response) {
            return null;
        }

        try {

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const questItems = doc.querySelectorAll(CONFIG.selectors.questItem);
            const targetQuest = Array.from(questItems).find(item => {
                const title = item.querySelector(CONFIG.selectors.questTitle);
                return title?.textContent.includes(CONFIG.questName);
            });

            if (!targetQuest) {
                logger('warn', 'Квест не найден');
                return null;
            }

            const result = targetQuest.classList.contains('reward-activated');

            STATE.cache.enlightenment = {
                value: result,
                time: now
            };

            return result;

        } catch (error) {
            logger('error', 'Ошибка проверки статуса', error);
            return null;
        }
    }

    // =========================================================
    // SESSION
    // =========================================================

    async function validateSession() {

        const profileLink = getProfileLink();
        const response = await fetchPage(profileLink);

        if (!profileLink) { return false; }
        if (!response) { return false; }
        return true;
    }

    // =========================================================
    // PROCESS
    // =========================================================

    async function processPages() {

        while (STATE.isRunning) {

            const pageUrl = `${BASE_URL}/cards/page/${STATE.page}/`;

            // вывод в лог обрабатываемой страницы
            // logger('log', `Обработка страницы ${STATE.page}`);

            const response = await fetchPage(pageUrl);

            if (!response) { return; }

            try {

                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const cardsContainer = doc.querySelector(CONFIG.selectors.cardsContainer);

                if (!cardsContainer) {

                    stopScript({
                        type: 'blocked',
                        message: 'Контейнер карточек не найден'
                    });

                    return;
                }

                const cards = doc.querySelectorAll(CONFIG.selectors.cardItem);
                const cardIds = Array.from(cards).map(card => card.getAttribute('data-id')).filter(Boolean);

                if (cardIds.length === 0) {
                    stopScript({
                        type: 'finished'
                    });
                    return;
                }

                for (const cardId of cardIds) {

                    if (!STATE.isRunning) { return; }

                    // вывод в лог обрабатываемой карты
                    // logger('log', `Карточка ${cardId}`);

                    const urls = [
                        `/cards/users/?id=${cardId}/`,
                        `/cards/users/trade/?id=${cardId}/`,
                        `/cards/users/need/?id=${cardId}/`
                    ];

                    for (const path of urls) {
                        const success = await fetchPage(BASE_URL + path);
                        if (!success || !STATE.isRunning) { return; }
                        await sleep(CONFIG.delays.request);
                    }

                    const status = await getEnlightenmentStatus();

                    if (status === true) {
                        stopScript({
                            type: 'success'
                        });
                        return;
                    }
                }

                STATE.page++;
                await sleep(CONFIG.delays.betweenPages);

            } catch (error) {
                stopScript({
                    type: 'error',
                    error
                });
                return;
            }
        }
    }

    // =========================================================
    // START
    // =========================================================

    async function startScript() {

        if (STATE.isRunning) {
            logger('warn', 'Скрипт уже запущен');
            return;
        }

        if (!isAuthorized()) {
            showNotification('Требуется авторизация');
            return;
        }

        if (STATE.authFailed) {
            logger('warn', 'Скрипт заблокирован');
            return;
        }

        STATE.isRunning = true;

        updateButtonState(true);

        try {

            const validSession = await validateSession();

            if (!validSession) {
                stopAuth();
                return;
            }

            const currentStatus = await getEnlightenmentStatus(true);

            if (currentStatus === true) {
                stopScript({
                    type: 'success',
                    message: 'Просветление уже получено'
                });
                return;
            }

            STATE.page = 1;

            logger('log', 'Поиск просветления...');
            showNotification('Поиск просветления...');

            STATE.intervals.status = setInterval(
                async () => {
                    const status = await getEnlightenmentStatus(true);

                    if (status === true) {
                        stopScript({
                            type: 'success'
                        });
                    }
                },
                CONFIG.delays.statusCheck
            );

            await processPages();

        } catch (error) {

            stopScript({
                type: 'error',
                error
            });
        }
    }

    // =========================================================
    // STOP
    // =========================================================

    function stopScript(data = {}) {

        const {
            type = 'manual',
            message = '',
            error = null
        } = data;

        STATE.isRunning = false;

        updateButtonState(false);
        clearIntervals();

        switch (type) {

            case 'success':
                logger('log', message || 'Просветление получено');
                showNotification('Просветление получено!');
                break;

            case 'manual':
                logger('log', 'Скрипт остановлен вручную');
                showNotification('Скрипт остановлен');
                break;

            case 'finished':
                logger('log', message || 'Страницы закончились');
                showNotification('Страницы закончились');
                break;

            case 'page_error':
                logger('error', message || 'Ошибка страницы', data);
                showNotification('Ошибка загрузки страницы');
                break;

            case 'blocked':
                logger('warn', message || 'Сработала защита сайта');
                showNotification('Возможно сработала защита сайта');
                break;

            case 'auth':
                logger('warn', 'Требуется авторизация');
                showNotification('Требуется авторизация');
                break;

            case 'error':
                logger('error', message || 'Неизвестная ошибка', error || data);
                showNotification('Скрипт остановлен из-за ошибки');
                break;

            default: logger('warn', 'Неизвестный тип остановки', data);
        }
    }

    // =========================================================
    // AUTO CHECK
    // =========================================================

    async function autoCheck() {

        if (!isAuthorized()) {
            logger('warn', 'Автопроверка остановлена');
            return;
        }

        STATE.authFailed = false;

        const status = await getEnlightenmentStatus(true);

        if (status === true) {

            logger('log', 'Просветление уже выполнено');

            if (STATE.isRunning) {
                stopScript({
                    type: 'success'
                });
            }

            return;
        }

        logger('log', 'Задание активно');

        if (!STATE.isRunning) {
            await startScript();
        }
    }

    function startGlobalChecker() {

        const lastCheck = Number(localStorage.getItem(CONFIG.storage.lastCheck)) || 0;
        const now = Date.now();

        if (now - lastCheck > CONFIG.delays.autoCheck) {
            autoCheck();
            localStorage.setItem(CONFIG.storage.lastCheck, now);
        }

        STATE.intervals.autoCheck = setInterval(
            async () => {
                await autoCheck();
                localStorage.setItem(CONFIG.storage.lastCheck, Date.now());
            },
            CONFIG.delays.autoCheck
        );
    }

    // =========================================================
    // INIT
    // =========================================================

    (async () => {
        await waitForElement(CONFIG.selectors.headerMenu);

        createStyles();
        createButton();

        if (isAuthorized()) {
            startGlobalChecker();
        }
    })();

    // =========================================================
})();
