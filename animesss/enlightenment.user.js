// ==UserScript==
// @name         AnimeSSS Просветление
// @namespace    http://tampermonkey.net/
// @version      1.17
// @description  Помогает познать просветление
// @author       li4i
// @match        *://*.asstars.tv/*
// @match        *://*.astars.club/*
// @match        *://*.asstars.club/*
// @match        *://*.animesss.com/*
// @match        *://*.animesss.tv/*
// @match        *://*.animestars.org/*
// @grant        none
// @homepageURL  https://github.com/NanoProto/tampermonkey
// @supportURL   https://github.com/NanoProto/tampermonkey/issues
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/NanoProto/tampermonkey/main/animesss/enlightenment.user.js
// @updateURL    https://raw.githubusercontent.com/NanoProto/tampermonkey/main/animesss/enlightenment.user.js
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
        // сколько и как долго пробуем
        attempts: {
            maxQuestCheckRetries: 3, // лимит попыток
            retryDelay: 60 * 60 * 1000 // 60 минут между попытками
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
    // =========================================================
    // STATUS ENUMS
    // =========================================================

    const FETCH_STATUS = {
        SUCCESS: 'success',
        AUTH: 'auth',
        BLOCKED: 'blocked',
        ERROR: 'error'
    };

    const QUEST_STATUS = {
        COMPLETED: 'completed',
        ACTIVE: 'active',
        NOT_FOUND: 'not_found',
        BLOCKED: 'blocked',
        ERROR: 'error'
    };

    // =========================================================
    // LOG
    // =========================================================

    const LOG = {
        log: true,
        warn: true,
        error: true
    };

    // =========================================================
    // STATE
    // =========================================================

    const STATE = {
        isRunning: false,
        authFailed: false,

        page: 1,

        button: null,
        notification: null,

        intervals: {
            status: null,
            autoCheck: null
        },

        cache: {
            enlightenment: {
                value: null,
                time: 0
            }
        },

        questCheck: {
            blockedUntilManual: false
        }
    };

    // =========================================================
    // LOGGER
    // =========================================================

    function logger(type, message, data = null) {

        if (!LOG[type]) return;

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

    function normalizeText(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

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

        if (STATE.authFailed) return false;

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

        if (document.getElementById('enlightenment-styles')) return;

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

        if (!STATE.button) return;

        STATE.button.classList.toggle('active', active);
    }

    function createButton() {

        if (STATE.button) return;

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

                stopScript({
                    type: 'auth'
                });
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

        if (!isAuthorized()) {

            return {
                ok: false,
                status: FETCH_STATUS.AUTH
            };
        }

        try {

            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': '*/*'
                }
            });

            if (response.status === 403) {

                return {
                    ok: false,
                    status: FETCH_STATUS.AUTH
                };
            }

            if (response.status === 429) {

                return {
                    ok: false,
                    status: FETCH_STATUS.BLOCKED,
                    message: 'Слишком много запросов'
                };
            }

            if (response.status >= 500) {

                return {
                    ok: false,
                    status: FETCH_STATUS.ERROR,
                    message: `Ошибка сервера (${response.status})`
                };
            }

            if (!response.ok) {

                return {
                    ok: false,
                    status: FETCH_STATUS.ERROR,
                    message: `Ошибка запроса (${response.status})`
                };
            }

            return {
                ok: true,
                response
            };

        } catch (error) {

            return {
                ok: false,
                status: FETCH_STATUS.ERROR,
                error
            };
        }
    }

    // =========================================================
    // STATUS
    // =========================================================
   async function getEnlightenmentStatus(force = false) {

        if (STATE.questCheck.blockedUntilManual) {

            return {
                status: QUEST_STATUS.BLOCKED,
                message: 'Проверка заблокирована'
            };
        }

        const now = Date.now();

        const cache = STATE.cache.enlightenment;

        if (!force && cache.value !== null && now - cache.time < CONFIG.delays.statusCache) {

            return {
                status: cache.value ? QUEST_STATUS.COMPLETED : QUEST_STATUS.ACTIVE
            };
        }

        const profileLink = getProfileLink();

        if (!profileLink) {

            return {
                status: QUEST_STATUS.ERROR,
                message: 'Ссылка профиля не найдена'
            };
        }

        for (let i = 0; i < CONFIG.attempts.maxQuestCheckRetries; i++) {

            const attempt = i + 1;
            const result = await fetchPage(profileLink);

            // логируем только повторные проверки после ошибки
            if (!result.ok) {

                logger('warn', `Ошибка получения профиля (${attempt})`);

                if (attempt < CONFIG.attempts.maxQuestCheckRetries) {

                    logger('log', `Повторная проверка квеста через ${CONFIG.attempts.retryDelay / 1000 / 60} мин (${attempt + 1}/${CONFIG.attempts.maxQuestCheckRetries})`);

                    await sleep(CONFIG.attempts.retryDelay);
                }
                continue;
            }

            if (!result.ok) {

                logger('warn', `Ошибка получения профиля (${attempt})`);

                if (attempt < CONFIG.attempts.maxQuestCheckRetries) {
                    await sleep(CONFIG.attempts.retryDelay);
                }
                continue;
            }

            try {

                const html = await result.response.text();
                const doc = new DOMParser().parseFromString(html,'text/html');
                const items = Array.from(doc.querySelectorAll(CONFIG.selectors.questItem));

                const target = items.find(item => {

                    const titleEl = item.querySelector(CONFIG.selectors.questTitle);
                    if (!titleEl) return false;

                    return normalizeText(titleEl.textContent).includes(normalizeText(CONFIG.questName));
                });

                if (target) {

                    const completed = target.classList.contains('reward-activated');

                    STATE.cache.enlightenment = {
                        value: completed,
                        time: Date.now()
                    };

                    return { status: completed ? QUEST_STATUS.COMPLETED : QUEST_STATUS.ACTIVE };
                }

            } catch (error) {

                logger('error', `Ошибка обработки статуса (${attempt})`, error);
            }

            if (attempt < CONFIG.attempts.maxQuestCheckRetries) {
                await sleep(CONFIG.attempts.retryDelay);
            }
        }

        STATE.questCheck.blockedUntilManual = true;

        return {
            status: QUEST_STATUS.NOT_FOUND,
            message: 'Ошибка обработки квеста'
        };
    }

    // =========================================================
    // SESSION
    // =========================================================

    async function validateSession() {

        const profileLink = getProfileLink();
        if (!profileLink) return false;

        const result = await fetchPage(profileLink);
        if (!result) return false;

        return result.ok;
    }

    // =========================================================
    // PROCESS
    // =========================================================

    async function processPages() {

        while (STATE.isRunning) {

            const pageUrl = `${BASE_URL}/cards/page/${STATE.page}/`;

            // вывод в лог обрабатываемой страницы
            // logger('log', `Обработка страницы ${STATE.page}`);

            const pageResult = await fetchPage(pageUrl);

            if (!pageResult.ok) {
                stopScript({
                    type: pageResult.status,
                    message: pageResult.message
                });

                return;
            }

            try {

                const html = await pageResult.response.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
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

                if (!cardIds.length) {
                    stopScript({
                        type: 'finished'
                    });
                    return;
                }

                for (const cardId of cardIds) {

                    if (!STATE.isRunning) return;

                    // вывод в лог обрабатываемой карты
                    // logger('log', `Карточка ${cardId}`);

                    const urls = [
                        `/cards/users/?id=${cardId}`,
                        `/cards/users/trade/?id=${cardId}`,
                        `/cards/users/need/?id=${cardId}`
                    ];

                    for (const path of urls) {

                        const result = await fetchPage(BASE_URL + path);

                        if (!result.ok || !STATE.isRunning) {

                            stopScript({
                                type: result.status,
                                message: result.message
                            });

                            return;
                        }

                        await sleep(CONFIG.delays.request);
                    }

                    const questResult = await getEnlightenmentStatus();

                    switch (questResult.status) {

                        case QUEST_STATUS.COMPLETED:

                            stopScript({
                                type: 'success'
                            });

                            return;

                        case QUEST_STATUS.NOT_FOUND:
                        case QUEST_STATUS.ERROR:
                        case QUEST_STATUS.BLOCKED:

                            stopScript({
                                type: 'blocked',
                                message: questResult.message
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
        STATE.authFailed = false;

        // сброс блокировки при ручном запуске
        STATE.questCheck.blockedUntilManual = false;

        updateButtonState(true);

        try {

            const validSession = await validateSession();

            if (!validSession) {

                stopScript({
                    type: 'auth'
                });

                return;
            }

            const questResult = await getEnlightenmentStatus(true);

            if (questResult.status === QUEST_STATUS.COMPLETED) {

                stopScript({
                    type: 'completed'
                });
                return;
            }

            if (questResult.status === QUEST_STATUS.NOT_FOUND || questResult.status === QUEST_STATUS.ERROR || questResult.status === QUEST_STATUS.BLOCKED) {

                stopScript({
                    type: 'blocked',
                    message: questResult.message
                });

                return;
            }
            STATE.page = 1;

            logger('log', 'Поиск просветления...');
            showNotification('Поиск просветления...');

            STATE.intervals.status = setInterval(
                async () => {
                    const result = await getEnlightenmentStatus(true);
                    if (!STATE.isRunning || result === null) return;

                    if (result.status === QUEST_STATUS.COMPLETED) {

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

        if (!STATE.isRunning && data.type !== 'auth') return;

        const {
            type = 'manual',
            message = '',
            error = null
        } = data;

        STATE.isRunning = false;

        updateButtonState(false);
        clearIntervals();

        switch (type) {

            case 'success':{
                const text = message || 'Просветление успешно получено';
                logger('log', text);
                showNotification(text);
                break;
            }

            case 'completed': {
                const text = message || 'Просветление уже получено';
                logger('log', text);
                showNotification(text);
                break;
            }

            case 'manual': {
                const text = 'Скрипт остановлен вручную';
                logger('log', text);
                showNotification(text);
                break;
            }

            case 'finished': {
                const text = message || 'Страницы закончились';
                logger('log', text);
                showNotification(text);
                break;
            }

            case 'page_error': {
                const text = message || 'Ошибка загрузки страницы';
                logger('error', text, error || data);
                showNotification(text);
                break;
            }

            case 'blocked': {
                const text = `${message}, возможно сработала защита сайта`;
                logger('warn', text);
                showNotification(text);
                break;
            }

            case 'auth': {
                STATE.authFailed = true;

                const text = 'Необходимо войти в аккаунт';
                logger('warn', text);
                showNotification(text);

                break;
            }

            case 'error': {
                const text = message || 'Скрипт остановлен из-за ошибки';
                logger('error', text, error || data);
                showNotification(text);
                break;
            }

            default: {
                const text = 'Неизвестный тип остановки';
                logger('warn', text, data);
                showNotification(text);
            }
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

        const result = await getEnlightenmentStatus(true);

        if (result.status === QUEST_STATUS.COMPLETED) {

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
            logger('log', 'Запуск автоматической проверки');
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

        STATE.intervals.autoCheck = setInterval(async () => {
                await autoCheck();
                localStorage.setItem(CONFIG.storage.lastCheck, Date.now());
        }, CONFIG.delays.autoCheck);
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
