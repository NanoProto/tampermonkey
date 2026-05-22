// ==UserScript==
// @name         AnimeSSS UI улучшения
// @namespace    asstars.tv
// @version      0.2
// @description  UI улучшения + фильтр мусора
// @author       li4i
// @match        *://*.asstars.tv/*
// @match        *://*.astars.club/*
// @match        *://*.asstars.club/*
// @match        *://*.animesss.com/*
// @match        *://*.animesss.tv/*
// @match        *://*.animestars.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/li4i/tampermonkey/main/animesss/improvements.user.js
// @updateURL    https://raw.githubusercontent.com/li4i/tampermonkey/main/animesss/improvements.user.js
// ==/UserScript==

(function () {
    'use strict';

    let settingsModal = null;

    // =========================================================
    // STORAGE
    // =========================================================
    const STORAGE_KEY = "UI_MODULES_V2";

    function loadState() {
        return GM_getValue(STORAGE_KEY, {
            headerMenu: false,
            inventoryExpand: false,
            tradeModalWide: false
        });
    }
    function saveState(state) {GM_setValue(STORAGE_KEY, state);}

    let state = loadState();
    // =========================================================
    // AUTH
    // =========================================================
    function isAuthorized() {
        return Boolean(
            document.querySelector('a[href*="/user/"]') &&
            document.querySelector('a[href*="logout"]')
        );
    }
    // =========================================================
    // PROFILE
    // =========================================================
    function getProfileName() {

        const profileLink = document.querySelector('a[href^="/user/"]');

        if (!profileLink) {
            return null;
        }

        const match = profileLink.pathname.match(/^\/user\/([^/]+)/);

        return match ? match[1] : null;
    }
    // =========================================================
    // 1. HEADER MENU CONFIG
    // =========================================================
    const HEADER_MENU_LINKS = [
        {
            href: "/cards/",
            icon: "fal fa-database",
            text: "База"
        },
        {
            href: "/trades/",
            icon: "fal fa-exchange-alt",
            text: "Трейды",
            auth: true
        },
        {
            href: () => {
                const name = getProfileName();
                return name ? `/user/cards/?name=${name}` : '';
            },
            icon: "fal fa-layer-group",
            text: "Карты",
            auth: true
        },
        {
            href: "/cards/pack/",
            icon: "fal fa-box-open",
            text: "Паки",
            auth: true
        },
        {
            href: "/promo_codes/",
            icon: "fal fa-gift",
            text: "Промо",
            auth: true
        }
    ];
    // =========================================================
    // 1. HEADER MENU RENDER
    // =========================================================
    function buildHeaderMenu() {

        const authorized = isAuthorized();

        return HEADER_MENU_LINKS.filter(item => !item.auth || authorized).map(item => {

            const href = typeof item.href === "function" ? item.href() : item.href;
            return `<a href="${href}"><i class="${item.icon}"></i><span>${item.text}</span></a>`;

        }).join('');
    }
    // =========================================================
    // 1. HEADER MENU STYLES
    // =========================================================
    function injectStylesHeaderMenu() {

        if (document.getElementById("style-header-menu")) { return; }

        const style = document.createElement("style");
        style.id = "style-header-menu";
        style.textContent = `
            @media screen and (max-width: 950px) {
                #header-bookmarks {top: 110px !important;}
            }
            #header-bookmarks {
                position: fixed; top: 65px; left: 0; right: 0; z-index: 28; margin: 0 auto; max-width: calc(var(--max-width, 1285px) - 50px); width: calc(100% - 24px); pointer-events: none; padding: 2px 12px;
                display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px 8px; border-radius: 0px 0px 8px 8px;
                background:linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%);
            }
            #header-bookmarks a {
                pointer-events: auto; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14);
                background-color: rgba(0,0,0,0.12); color: rgb(232,232,232) !important; text-decoration: none; transition: background-color 0.2s, border-color 0.2s;
            }
            #header-bookmarks a:hover {background-color: #f06102; border: 1px solid #f06102;}
            #header-bookmarks a i {font-size: 14px; opacity: 0.95;}
        `;

        (document.head || document.documentElement).appendChild(style);
    }
    function removeStylesHeaderMenu() {document.getElementById("style-header-menu")?.remove();}
    // =========================================================
    // 1. HEADER MENU
    // =========================================================
    function enableHeaderMenu() {

        const exists = document.getElementById("header-bookmarks");
        if (exists) exists.remove(); // гарантируем чистое состояние

        const header = document.querySelector("header.header");
        if (!header) return;

        if (!document.getElementById("style-header-menu")) {
            injectStylesHeaderMenu();
        }

        //const rect = header.getBoundingClientRect();
        const el = document.createElement("div");
        //el.style.top = `${rect.bottom}px`;
        el.id = "header-bookmarks";
        el.innerHTML = buildHeaderMenu();

        header.insertAdjacentElement("afterend", el);
    }
    function disableHeaderMenu() {
        document.getElementById("header-bookmarks")?.remove();
        removeStylesHeaderMenu();
    }
    // =========================================================
    // 2. STYLE MODULES (CSS PATCHES)
    // =========================================================
    const STYLE_REGISTRY = {
        inventoryExpand: `
            .remelt__inventory {max-height: none !important;}
            .card-inventory-container .card-stars-list {max-height: none; none !important;}
            .tabs__content .tabs__page--active .trade__inventory {overflow-y: unset !important; min-height: 200px !important; max-height: none !important;}
        `,
        tradeModalWide: `
            /* затемнить фон */
            .as-backdrop {position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 9998;}
            /* окна трейда */
            .ui-dialog[aria-describedby="trade-card-modal"] {position:fixed !important;top:50% !important; left:50% !important; transform:translate(-50%,-50%) !important; width:750px !important; max-height: none !important; margin:0 !important; z-index: 9999 !important;}
            .ui-dialog[aria-describedby="trade-card-modal"] .ui-dialog-content {height: auto !important;}
            .ui-dialog[aria-describedby="trade-card-modal"] .ui-dialog-content .trade__main-divider {margin: 20px -16px !important;}
            .ui-dialog[aria-describedby="trade-card-modal"] .ui-dialog-content .trade__header,
            .ui-dialog[aria-describedby="trade-card-modal"] .ui-dialog-content .trade__main{padding: 5px !important;}
            .ui-dialog[aria-describedby="trade-card-modal"] .ui-dialog-content .trade__main-user{padding-left: 5px !important; margin-bottom: 5px !important;}
            .ui-dialog[aria-describedby="trade-card-modal"] .ui-dialog-titlebar {cursor: default;}
        `
    };

    // расширители
    function enableStyle(name) {
        const id = `style-${name}`;
        if (document.getElementById(id)) return;

        const style = document.createElement("style");
        style.id = id;
        style.textContent = STYLE_REGISTRY[name];

        document.head.appendChild(style);
    }
    function disableStyle(name) {document.getElementById(`style-${name}`)?.remove();}
    // модальное окно
    function enableTradeBackdrop() {
        if (document.querySelector(".as-backdrop")) return;

        const el = document.createElement("div");
        el.className = "as-backdrop";

        document.body.appendChild(el);
    }
    function disableTradeBackdrop() {document.querySelector(".as-backdrop")?.remove();}
    // =========================================================
    // MODULE CONTROL
    // =========================================================
    const MODULES = {
        headerMenu: {
            enabled: false,
            enable: enableHeaderMenu,
            disable: disableHeaderMenu
        },
        inventoryExpand: {
            enabled: false,
            enable: () => enableStyle("inventoryExpand"),
            disable: () => disableStyle("inventoryExpand")
        },
        tradeModalWide: {
            enabled: false,
            enable: () => enableStyle("tradeModalWide"),
            disable: () => disableStyle("tradeModalWide")
        }
    };

    function setModule(name, value) {
        const mod = MODULES[name];
        if (!mod) return;

        if (value && !mod.enabled) {
            mod.enable();
            mod.enabled = true;
        }

        if (!value && mod.enabled) {
            mod.disable();
            mod.enabled = false;
        }

        state[name] = Boolean(mod.enabled);
        saveState(state);
    }
    function applyInitialState() {
        state = loadState();

        for (const key in MODULES) {
            MODULES[key].enabled = state[key];

            if (state[key]) {
                MODULES[key].enable();
            }
        }
    }
    // =========================================================
    // GLOBAL STYLES
    // =========================================================
    function injectGlobalStyles() {

        GM_addStyle(`

        /* =====================================================
           THEME VARIABLES
        ===================================================== */

        body {
            --as-modal-bg: #ffffff;
            --as-modal-text: #222222;
            --as-modal-border: #d7d7d7;
            --as-modal-row-bg: #f5f5f5;
            --as-switch-bg: #c7c7c7;
            --as-backdrop: rgba(0,0,0,0.55);
        }

        body[data-theme="dark"] {
            --as-modal-bg: #1e1f22;
            --as-modal-text: #dddddd;
            --as-modal-border: #333333;
            --as-modal-row-bg: #2a2c31;
            --as-switch-bg: #444444;
            --as-backdrop: rgba(0,0,0,0.72);
        }

        /* =====================================================
           MODAL
        ===================================================== */
        .backdrop {position: fixed; inset: 0; background: var(--as-backdrop); z-index: 9998;}

        .modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            background: var(--as-modal-bg);
            color: var(--as-modal-text);
            border: 1px solid var(--as-modal-border);
            border-radius: 8px;
            z-index: 9999;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        }

        .modal-header {display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--as-modal-border);}
        .modal-body {display: flex; flex-direction: column; gap: 12px; padding: 15px;}

        .row {display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; background: var(--as-modal-row-bg);}

        /* =====================================================
           SWITCH
        ===================================================== */

        .switch {position: relative; width: 40px; height: 20px; background: var(--as-switch-bg); border-radius: 20px; cursor: pointer; transition: background 0.2s;}
        .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; background: #ffffff; border-radius: 50%; transition: transform 0.2s;}

        .modal input {display: none;}
        .modal input:checked + .switch {background: #43b581;}
        .modal input:checked + .switch::after {transform: translateX(20px);}

        /* =====================================================
           BUTTONS
        ===================================================== */

        .save-btn {margin-top: 6px; padding: 10px; border: none; border-radius: 8px; background: #43b581; color: #ffffff; cursor: pointer; font-weight: 600; transition: opacity 0.2s;}
        .save-btn:hover {opacity: 0.9;}

        .close_btn {color: var(--tt); background-color: var(--bg-2); border: none; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1.9em; transition: background-color 0.2s; }
        .close_btn:hover {color: #fff; background-color: #f06102; border-color: #f06102;}
    `);
    }
    // =========================================================
    // SETTINGS MODAL
    // =========================================================
    function createSettingsModal() {
        const wrap = document.createElement("div");
        wrap.id = "settings-wrap";
        wrap.style.display = "none";
        wrap.innerHTML = `
            <div class="backdrop"></div>
            <div class="modal">
                <div class="modal-header">
                    <span>Настройки</span>
                    <button class="close_btn">×</button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <span>Верхнее меню</span>
                        <label><input type="checkbox" data-module="headerMenu"><div class="switch"></div></label>
                    </div>
                    <div class="row">
                        <span>Расширить инвентарь</span>
                        <label><input type="checkbox" data-module="inventoryExpand"><div class="switch"></div></label>
                    </div>
                    <div class="row">
                        <span>Широкое окно трейда</span>
                        <label><input type="checkbox" data-module="tradeModalWide"><div class="switch"></div></label>
                    </div>
                    <button class="save-btn">Сохранить</button>
                </div>
            </div>
        `;

        const close = () => wrap.style.display = "none";

        wrap.querySelector(".close_btn").onclick = close;
        wrap.querySelector(".backdrop").onclick = close;

        wrap.querySelector(".save-btn").onclick = () => {
            wrap.querySelectorAll("input[type=checkbox]").forEach(cb => {
                setModule(cb.dataset.module, cb.checked);
            });

            close();
        };

        return wrap;
    }

    function openSettingsModal() {
        if (!settingsModal) {
            settingsModal = createSettingsModal();
            document.body.appendChild(settingsModal);
        }

        // синхронизация чекбоксов
        settingsModal.querySelectorAll("input").forEach(cb => {
            const key = cb.dataset.module;
            cb.checked = !!state[key];
        });

        settingsModal.style.display = "block";
    }
    // =========================================================
    // INIT
    // =========================================================
    function watchTradeModal() {
        const observer = new MutationObserver(() => {
            const modal = document.querySelector('.ui-dialog[aria-describedby="trade-card-modal"]');
            const backdrop = document.querySelector('.as-backdrop');

            if (modal && !backdrop) {
                const el = document.createElement("div");
                el.className = "as-backdrop";
                document.body.appendChild(el);
            }

            if (!modal && backdrop) {
                backdrop.remove();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function init() {
        injectGlobalStyles();
        applyInitialState();

        if (state.tradeModalWide) {
            watchTradeModal();
        }

        GM_registerMenuCommand("Настройки", openSettingsModal);
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
