// ==UserScript==
// @name         AnimeSSS UI улучшения
// @namespace    http://tampermonkey.net/
// @version      0.04
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
// @homepageURL  https://github.com/li4i/tampermonkey
// @supportURL   https://github.com/li4i/tampermonkey/issues
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
    const STORAGE_KEY = "UI_MODULES_V0.04";
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
        return document.querySelector('.lgn__name span')?.textContent?.trim() || null;
    }

    function getProfileLink() {
        const name = getProfileName();
        return name ? `${location.origin}/user/${name}` : null;
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
            href: () => getProfileLink(),
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
            /* окна трейда */
            .ui-dialog[aria-describedby="trade-card-modal"] {position:fixed !important;top:50% !important; left:50% !important; transform:translate(-50%,-50%) !important; width:750px !important; max-height: none !important; margin:0 !important; z-index: 997 !important;}
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
    function updateBackdropState() {

        const hasModal = document.querySelector(
            '.ui-dialog[aria-describedby="trade-card-modal"], ' +
            '.ui-dialog[aria-describedby="card-modal"], ' +
            '.settingsModuleModalUI[aria-describedby="settingsModuleModalUI-modal"]'
        );

        document.body.classList.toggle("as-modal-open", !!hasModal);
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
           GLOBAL BACKDROP
        ===================================================== */
        .settingsModalUI {
            position: fixed;
            inset: 0;
            z-index: 998;

            display: flex;
            align-items: center;
            justify-content: center;
        }
        body.as-modal-open {position: relative;}
        body.as-modal-open::after {
            content: "";
            position: fixed;
            inset: 0;
            background: var(--as-backdrop);
            z-index: 996;
        }

        .wrapper-container .sect__content #dle-content {padding-bottom: 30px;}
        .wrapper-container .sect__content .speedbar {border-radius: 12px !important; margin: auto !important; padding: 30px var(--indent) !important;}
        /* =====================================================
           MODAL
        ===================================================== */

        .settingsModuleModalUI {
            width: 420px;
            background: var(--as-modal-bg);
            color: var(--as-modal-text);
            border: 1px solid var(--as-modal-border);
            border-radius: 8px;

            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        }

        .settingsModuleModalUI .modal-header {display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--as-modal-border);}
        .settingsModuleModalUI .modal-body {display: flex; flex-direction: column; gap: 12px; padding: 15px;}

        .settingsModuleModalUI .row {display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; background: var(--as-modal-row-bg); content: unset;}
        .settingsModuleModalUI .row span {width: 100%;}

        /* =====================================================
           SWITCH
        ===================================================== */

        .settingsModuleModalUI .switch {position: relative; display: block; width: 40px; height: 20px; background: var(--as-switch-bg); border-radius: 20px; cursor: pointer; transition: background 0.2s;}
        .settingsModuleModalUI .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; background: #ffffff; border-radius: 50%; transition: transform 0.2s;}

        .settingsModuleModalUI input {display: none;}
        .settingsModuleModalUI input:checked + .switch {background: #43b581;}
        .settingsModuleModalUI input:checked + .switch::after {transform: translateX(20px);}

        /* =====================================================
           BUTTONS
        ===================================================== */

        .settingsModuleModalUI .save-btn {margin-top: 6px; padding: 10px; border: none; border-radius: 8px; background: #43b581; color: #ffffff; cursor: pointer; font-weight: 600; transition: opacity 0.2s;}
        .settingsModuleModalUI .save-btn:hover {opacity: 0.9;}

        .settingsModuleModalUI .close_btn {color: var(--tt); background-color: var(--bg-2); border: none; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1.9em; transition: background-color 0.2s; }
        .settingsModuleModalUI .close_btn:hover {color: #fff; background-color: #f06102; border-color: #f06102;}
      `);
    }
    // =========================================================
    // SETTINGS MODAL
    // =========================================================
    function createSettingsModal() {

        const wrap = document.createElement("div");
        wrap.className = "settingsModalUI";

        const modal = document.createElement("div");
        modal.className = "settingsModuleModalUI";
        modal.setAttribute("aria-describedby", "settingsModuleModalUI-modal");

        modal.innerHTML = `
        <div class="modal-header">
            <span>Настройки</span><button class="close_btn">×</button>
        </div>

        <div class="modal-body">
            <div class="row">
                <span>Верхнее меню</span><label><input type="checkbox" data-module="headerMenu"><div class="switch"></div></label>
            </div>

            <div class="row">
                <span>Расширить инвентарь</span><label><input type="checkbox" data-module="inventoryExpand"><div class="switch"></div></label>
            </div>

            <div class="row">
                <span>Широкое окно трейда</span><label><input type="checkbox" data-module="tradeModalWide"><div class="switch"></div></label>
            </div>

            <button class="save-btn">Сохранить</button>
        </div>
        `;

        wrap.appendChild(modal);

        const onKey = (e) => {
            if (e.key === "Escape") close();
        };

        document.addEventListener("keydown", onKey);

        const close = () => {
            document.body.classList.remove("as-modal-open");
            wrap.remove();
            settingsModal = null;
        };

        // КЛИК ПО ФОНУ
        wrap.addEventListener("click", (e) => {
            if (e.target === wrap) close();
        });

        modal.querySelector(".close_btn").onclick = close;

        modal.querySelector(".save-btn").onclick = () => {
            modal.querySelectorAll("input[type=checkbox]").forEach(cb => {
                setModule(cb.dataset.module, cb.checked);
            });

            close();
        };

        return wrap;
    }

    function openSettingsModal() {
        if (settingsModal) return;

        settingsModal = createSettingsModal();
        document.body.appendChild(settingsModal);

        document.body.classList.add("as-modal-open");

        settingsModal.querySelectorAll("input").forEach(cb => {
            cb.checked = !!state[cb.dataset.module];
        });
    }
    // =========================================================
    // INIT
    // =========================================================
    function startGlobalModalObserver() {
        const observer = new MutationObserver(() => {
            updateBackdropState();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
        updateBackdropState();
    }

    function init() {
        injectGlobalStyles();
        applyInitialState();

        startGlobalModalObserver();

        GM_registerMenuCommand("Настройки", openSettingsModal);
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
