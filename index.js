import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { createMinesweeperGame } from './games/minesweeper.js';
import { createSpiderGame } from './games/spider.js';
<<<<<<< HEAD
import { createTerritoryGame } from './games/territory.js';
=======
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241

const MODULE_NAME = 'st_mini_games';

const GAMES = Object.freeze({
    minesweeper: Object.freeze({ label: '지뢰찾기', icon: '💣', description: '초급 · 중급 클래식 지뢰찾기', create: createMinesweeperGame }),
    spider: Object.freeze({ label: '스파이더 카드게임', icon: '🂡', description: '한 무늬로 즐기는 스파이더', create: createSpiderGame }),
<<<<<<< HEAD
    territory: Object.freeze({ label: '땅따먹기', icon: '🛸', description: '선을 이어 80%를 점령하는 아케이드', create: createTerritoryGame }),
=======
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
});

const DEFAULT_COLORS = Object.freeze({
    background: '#c0c0c0',
    panel: '#c0c0c0',
    closed: '#c0c0c0',
    open: '#c0c0c0',
    light: '#ffffff',
    shadow: '#808080',
    dark: '#000000',
    text: '#000000',
    displayBackground: '#000000',
    displayText: '#ff0000',
    flag: '#ff0000',
    mine: '#000000',
    number1: '#0000ff',
    number2: '#008000',
    number3: '#ff0000',
    number4: '#000080',
});

const COLOR_FIELDS = Object.freeze([
    ['background', '창 배경'],
    ['panel', '상단 패널'],
    ['closed', '닫힌 칸'],
    ['open', '열린 칸'],
    ['light', '밝은 테두리'],
    ['shadow', '어두운 테두리'],
    ['dark', '가장 어두운 테두리'],
    ['text', '글자'],
    ['displayBackground', '카운터 배경'],
    ['displayText', '카운터 글자'],
    ['flag', '깃발'],
    ['mine', '지뢰'],
    ['number1', '숫자 1'],
    ['number2', '숫자 2'],
    ['number3', '숫자 3'],
    ['number4', '숫자 4 이상'],
]);

const DEFAULT_SETTINGS = Object.freeze({
    theme: 'classic',
    difficulty: 'beginner',
    showFloatingButton: true,
    floatingPosition: null,
    customThemes: [],
});

const SETTINGS_TEMPLATE = `
<div id="stmg-settings" class="stmg-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🕹️ Mini Games</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
<<<<<<< HEAD
        <div class="inline-drawer-content" style="display: none;">
          <div class="stmg-settings-content">
=======
        <div class="inline-drawer-content">
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
            <label class="checkbox_label" for="stmg-show-floating">
                <input id="stmg-show-floating" type="checkbox">
                <span>플로팅 버튼 표시</span>
            </label>
            <label for="stmg-theme-select">테마</label>
            <select id="stmg-theme-select" class="text_pole"></select>
            <div class="stmg-settings-row">
                <button id="stmg-theme-new" class="menu_button" type="button">새 테마</button>
                <button id="stmg-theme-copy" class="menu_button" type="button">복제</button>
                <button id="stmg-theme-delete" class="menu_button" type="button">삭제</button>
            </div>
            <div id="stmg-custom-editor" hidden>
                <label for="stmg-theme-name">테마 이름</label>
                <input id="stmg-theme-name" class="text_pole" type="text" maxlength="40">
                <div id="stmg-color-grid" class="stmg-color-grid"></div>
            </div>
            <div class="stmg-settings-row">
                <button id="stmg-theme-export" class="menu_button" type="button">테마 내보내기</button>
                <button id="stmg-theme-import" class="menu_button" type="button">테마 불러오기</button>
                <input id="stmg-theme-file" type="file" accept="application/json,.json" hidden>
            </div>
<<<<<<< HEAD
            <small>게임 열기: <code>/minigames</code>, <code>/ms</code>, <code>/spider</code>, <code>/territory</code></small>
          </div>
=======
            <small>게임 열기: <code>/minigames</code>, <code>/ms</code>, <code>/spider</code></small>
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
        </div>
    </div>
</div>`;

let settings;
let initialized = false;
let slashRegistered = false;
let panelOpen = false;
let activeGame = null;
let activeGameKey = null;

function context() {
    return SillyTavern.getContext();
}

function clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function getSettings() {
    const { extensionSettings } = context();
    if (!extensionSettings[MODULE_NAME]) extensionSettings[MODULE_NAME] = clone(DEFAULT_SETTINGS);
    const stored = extensionSettings[MODULE_NAME];
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (!Object.hasOwn(stored, key)) stored[key] = clone(value);
    }
    if (!Array.isArray(stored.customThemes)) stored.customThemes = [];
    if (!['beginner', 'intermediate'].includes(stored.difficulty)) stored.difficulty = 'beginner';
    return stored;
}

function saveSettings() {
    context().saveSettingsDebounced();
}

function makeId() {
    return `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getVisibleViewport() {
    const viewport = window.visualViewport;
    return {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: Math.max(1, viewport?.width ?? window.innerWidth),
        height: Math.max(1, viewport?.height ?? window.innerHeight),
    };
}

function createUi() {
    if (document.getElementById('stmg-root')) return;
    const root = document.createElement('div');
    root.id = 'stmg-root';
    root.dataset.theme = 'classic';
    root.innerHTML = `
        <div id="stmg-floating-button" role="button" tabindex="0" aria-label="미니게임 열기" title="미니게임 열기">🕹️</div>
        <section id="stmg-window" role="dialog" aria-modal="false" aria-label="미니게임" hidden>
            <div class="stmg-titlebar">
                <span aria-hidden="true">🕹️</span>
                <strong id="stmg-title">미니게임</strong>
                <button id="stmg-back" type="button" aria-label="게임 목록" title="게임 목록" hidden>⌂</button>
                <button id="stmg-close" type="button" aria-label="닫기" title="닫기">×</button>
            </div>
            <main id="stmg-content"></main>
        </section>`;
    document.body.append(root);

    const floatingButton = root.querySelector('#stmg-floating-button');
    floatingButton.addEventListener('click', event => {
        if (event.currentTarget.dataset.dragged === 'true') {
            event.currentTarget.dataset.dragged = 'false';
            return;
        }
        togglePanel();
    });
    floatingButton.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        floatingButton.click();
    });
    root.querySelector('#stmg-close').addEventListener('click', closePanel);
    root.querySelector('#stmg-back').addEventListener('click', showLauncher);

    makeFloatingButtonDraggable(floatingButton);
    makeWindowDraggable(root.querySelector('.stmg-titlebar'), root.querySelector('#stmg-window'));

    const handleViewportChange = () => {
        placeFloatingButton();
        keepWindowInViewport();
        activeGame?.resize?.();
    };
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('scroll', handleViewportChange, { passive: true });
<<<<<<< HEAD
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) activeGame?.pause?.();
        else if (panelOpen) activeGame?.resume?.();
    });
=======
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
}

function showLauncher() {
    activeGame?.destroy?.();
    activeGame = null;
    activeGameKey = null;
    const root = document.getElementById('stmg-root');
    const content = document.getElementById('stmg-content');
    root.dataset.view = 'launcher';
    delete root.dataset.game;
    document.getElementById('stmg-title').textContent = '미니게임';
    document.getElementById('stmg-back').hidden = true;
    content.innerHTML = `
        <div class="stmg-launcher">
            <p>플레이할 게임을 선택하세요.</p>
            <div class="stmg-game-list">
                ${Object.entries(GAMES).map(([key, item]) => `
                    <button type="button" class="stmg-game-choice" data-game-choice="${key}">
                        <span aria-hidden="true">${item.icon}</span>
                        <strong>${item.label}</strong>
                        <small>${item.description}</small>
                    </button>`).join('')}
            </div>
        </div>`;
    content.querySelectorAll('[data-game-choice]').forEach(button => {
        button.addEventListener('click', () => startGame(button.dataset.gameChoice));
    });
    keepWindowInViewport();
}

function gameRuntime() {
    return {
        settings,
        saveSettings,
        isVisible: () => panelOpen,
        getAvailableWidth: () => {
            const content = document.getElementById('stmg-content');
            return Math.max(220, content?.clientWidth || getVisibleViewport().width - 12);
        },
        fitWindow: () => window.requestAnimationFrame(centerWindowHorizontally),
        toast: (type, message) => {
            const toaster = context().toastr;
            if (typeof toaster?.[type] === 'function') toaster[type](message);
        },
    };
}

function startGame(key) {
    const definition = GAMES[key];
    if (!definition) return;
    activeGame?.destroy?.();
    activeGameKey = key;
    const root = document.getElementById('stmg-root');
    const content = document.getElementById('stmg-content');
    root.dataset.view = 'game';
    root.dataset.game = key;
    document.getElementById('stmg-title').textContent = definition.label;
    document.getElementById('stmg-back').hidden = false;
    content.replaceChildren();
    activeGame = definition.create(gameRuntime());
    activeGame.mount(content);
    if (!panelOpen) activeGame.pause?.();
    keepWindowInViewport();
}

function openPanel() {
    if (!initialized) {
        void initialize().then(openPanel);
        return;
    }
    if (panelOpen) return;
    panelOpen = true;
    const gameWindow = document.getElementById('stmg-window');
    gameWindow.hidden = false;
    document.getElementById('stmg-floating-button').setAttribute('aria-label', '미니게임 닫기');
    activeGame?.resume?.();
    activeGame?.resize?.();
    window.requestAnimationFrame(keepWindowInViewport);
}

function closePanel() {
    if (!initialized || !panelOpen) return;
    panelOpen = false;
    activeGame?.pause?.();
    document.getElementById('stmg-window').hidden = true;
    document.getElementById('stmg-floating-button').setAttribute('aria-label', '미니게임 열기');
}

function togglePanel() {
    panelOpen ? closePanel() : openPanel();
}

function getFloatingBounds(button) {
    const viewport = getVisibleViewport();
    const rect = button.getBoundingClientRect();
    const width = rect.width || button.offsetWidth || 28;
    const height = rect.height || button.offsetHeight || 28;
    const margin = 8;
    return {
        minLeft: viewport.left + margin,
        minTop: viewport.top + margin,
        maxLeft: Math.max(viewport.left + margin, viewport.left + viewport.width - width - margin),
        maxTop: Math.max(viewport.top + margin, viewport.top + viewport.height - height - margin),
        width,
        height,
    };
}

function makeFloatingButtonDraggable(button) {
    let drag = null;
    button.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const rect = button.getBoundingClientRect();
        drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            moved: false,
        };
        button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true;
        if (!drag.moved) return;
        const bounds = getFloatingBounds(button);
        const left = Math.min(Math.max(bounds.minLeft, event.clientX - drag.offsetX), bounds.maxLeft);
        const top = Math.min(Math.max(bounds.minTop, event.clientY - drag.offsetY), bounds.maxTop);
        setFixedPosition(button, left, top);
    });
    button.addEventListener('pointerup', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.moved) {
            button.dataset.dragged = 'true';
            const rect = button.getBoundingClientRect();
            const bounds = getFloatingBounds(button);
            settings.floatingPosition = {
                x: (rect.left - bounds.minLeft) / Math.max(1, bounds.maxLeft - bounds.minLeft),
                y: (rect.top - bounds.minTop) / Math.max(1, bounds.maxTop - bounds.minTop),
            };
            saveSettings();
        }
        drag = null;
    });
    button.addEventListener('pointercancel', () => { drag = null; });
}

function setFixedPosition(element, left, top) {
    element.style.setProperty('left', `${left}px`, 'important');
    element.style.setProperty('top', `${top}px`, 'important');
    element.style.setProperty('right', 'auto', 'important');
    element.style.setProperty('bottom', 'auto', 'important');
}

function placeFloatingButton() {
    const button = document.getElementById('stmg-floating-button');
    if (!button) return;
    button.hidden = !settings.showFloatingButton;
    button.style.setProperty('display', settings.showFloatingButton ? 'flex' : 'none', 'important');
    button.style.setProperty('visibility', 'visible', 'important');
    button.style.setProperty('opacity', '1', 'important');
    button.style.setProperty('pointer-events', 'auto', 'important');
    if (!settings.showFloatingButton) return;

    const bounds = getFloatingBounds(button);
    const position = settings.floatingPosition;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        const viewport = getVisibleViewport();
        setFixedPosition(button, bounds.maxLeft, Math.min(bounds.maxTop, Math.max(bounds.minTop, viewport.top + viewport.height - bounds.height - 96)));
        return;
    }
    const x = Math.min(1, Math.max(0, position.x));
    const y = Math.min(1, Math.max(0, position.y));
    setFixedPosition(button, bounds.minLeft + x * (bounds.maxLeft - bounds.minLeft), bounds.minTop + y * (bounds.maxTop - bounds.minTop));
}

function makeWindowDraggable(handle, gameWindow) {
    let drag = null;
    handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        const rect = gameWindow.getBoundingClientRect();
        drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
        gameWindow.style.left = `${rect.left}px`;
        gameWindow.style.top = `${rect.top}px`;
        gameWindow.style.transform = 'none';
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const viewport = getVisibleViewport();
        const rect = gameWindow.getBoundingClientRect();
        const left = Math.min(Math.max(viewport.left + 4, event.clientX - drag.offsetX), Math.max(viewport.left + 4, viewport.left + viewport.width - rect.width - 4));
        const top = Math.min(Math.max(viewport.top + 4, event.clientY - drag.offsetY), Math.max(viewport.top + 4, viewport.top + viewport.height - rect.height - 4));
        gameWindow.style.left = `${left}px`;
        gameWindow.style.top = `${top}px`;
    });
    const finish = event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag = null;
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
}

function keepWindowInViewport() {
    const gameWindow = document.getElementById('stmg-window');
    if (!gameWindow || gameWindow.hidden) return;
    const viewport = getVisibleViewport();
    const rect = gameWindow.getBoundingClientRect();
    const maxLeft = Math.max(viewport.left + 4, viewport.left + viewport.width - rect.width - 4);
    const maxTop = Math.max(viewport.top + 4, viewport.top + viewport.height - rect.height - 4);
    gameWindow.style.transform = 'none';
    gameWindow.style.left = `${Math.min(Math.max(viewport.left + 4, rect.left), maxLeft)}px`;
    gameWindow.style.top = `${Math.min(Math.max(viewport.top + 4, rect.top), maxTop)}px`;
}

function centerWindowHorizontally() {
    const gameWindow = document.getElementById('stmg-window');
    if (!gameWindow || gameWindow.hidden) return;
    const viewport = getVisibleViewport();
    const rect = gameWindow.getBoundingClientRect();
    const centeredLeft = viewport.left + Math.max(4, (viewport.width - rect.width) / 2);
    const maxTop = Math.max(viewport.top + 4, viewport.top + viewport.height - rect.height - 4);
    gameWindow.style.transform = 'none';
    gameWindow.style.left = `${centeredLeft}px`;
    gameWindow.style.top = `${Math.min(Math.max(viewport.top + 4, rect.top), maxTop)}px`;
}

function selectedCustomTheme() {
    if (!settings.theme.startsWith('custom:')) return null;
    const id = settings.theme.slice('custom:'.length);
    return settings.customThemes.find(theme => theme.id === id) ?? null;
}

function normalizeColors(colors = {}) {
    const normalized = {};
    for (const key of Object.keys(DEFAULT_COLORS)) {
        const value = colors[key];
        normalized[key] = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_COLORS[key];
    }
    return normalized;
}

function applyTheme() {
    const root = document.getElementById('stmg-root');
    if (!root) return;
    root.dataset.theme = settings.theme === 'inherit' ? 'inherit' : settings.theme === 'classic' ? 'classic' : 'custom';
    for (const key of Object.keys(DEFAULT_COLORS)) root.style.removeProperty(`--stmg-${key}`);
    const custom = selectedCustomTheme();
    if (!custom) return;
    custom.colors = normalizeColors(custom.colors);
    for (const [key, value] of Object.entries(custom.colors)) root.style.setProperty(`--stmg-${key}`, value);
}

function createSettingsUi() {
    if (document.getElementById('stmg-settings')) return;
    const host = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
    if (!host) return;
    host.insertAdjacentHTML('beforeend', SETTINGS_TEMPLATE);
    bindSettingsUi();
    renderSettingsUi();
}

function bindSettingsUi() {
    document.getElementById('stmg-show-floating').addEventListener('change', event => {
        settings.showFloatingButton = event.target.checked;
        saveSettings();
        placeFloatingButton();
    });
    document.getElementById('stmg-theme-select').addEventListener('change', event => {
        settings.theme = event.target.value;
        saveSettings();
        applyTheme();
        renderSettingsUi();
    });
    document.getElementById('stmg-theme-new').addEventListener('click', createCustomTheme);
    document.getElementById('stmg-theme-copy').addEventListener('click', duplicateSelectedTheme);
    document.getElementById('stmg-theme-delete').addEventListener('click', deleteSelectedTheme);
    document.getElementById('stmg-theme-export').addEventListener('click', exportSelectedTheme);
    document.getElementById('stmg-theme-import').addEventListener('click', () => document.getElementById('stmg-theme-file').click());
    document.getElementById('stmg-theme-file').addEventListener('change', importThemeFile);
    document.getElementById('stmg-theme-name').addEventListener('input', event => {
        const theme = selectedCustomTheme();
        if (!theme) return;
        theme.name = event.target.value.slice(0, 40) || '사용자 테마';
        saveSettings();
        renderThemeSelect();
    });

    const colorGrid = document.getElementById('stmg-color-grid');
    for (const [key, label] of COLOR_FIELDS) {
        const wrapper = document.createElement('label');
        wrapper.className = 'stmg-color-field';
        wrapper.innerHTML = `<span>${label}</span><input type="color" data-color-key="${key}">`;
        wrapper.querySelector('input').addEventListener('input', event => {
            const theme = selectedCustomTheme();
            if (!theme) return;
            theme.colors[key] = event.target.value;
            saveSettings();
            applyTheme();
        });
        colorGrid.append(wrapper);
    }
}

function renderThemeSelect() {
    const select = document.getElementById('stmg-theme-select');
    if (!select) return;
    select.replaceChildren();
    select.add(new Option('Windows Classic', 'classic'));
    select.add(new Option('현재 실리태번 테마 따라가기', 'inherit'));
    for (const theme of settings.customThemes) select.add(new Option(theme.name, `custom:${theme.id}`));
    if (![...select.options].some(option => option.value === settings.theme)) settings.theme = 'classic';
    select.value = settings.theme;
}

function renderSettingsUi() {
    const showFloating = document.getElementById('stmg-show-floating');
    if (!showFloating) return;
    showFloating.checked = settings.showFloatingButton;
    renderThemeSelect();
    const theme = selectedCustomTheme();
    document.getElementById('stmg-custom-editor').hidden = !theme;
    document.getElementById('stmg-theme-delete').disabled = !theme;
    document.getElementById('stmg-theme-name').value = theme?.name ?? '';
    document.querySelectorAll('#stmg-color-grid [data-color-key]').forEach(input => {
        input.value = theme?.colors?.[input.dataset.colorKey] ?? DEFAULT_COLORS[input.dataset.colorKey];
    });
}

function createCustomTheme() {
    const theme = { id: makeId(), name: `사용자 테마 ${settings.customThemes.length + 1}`, colors: clone(DEFAULT_COLORS) };
    settings.customThemes.push(theme);
    settings.theme = `custom:${theme.id}`;
    saveSettings();
    applyTheme();
    renderSettingsUi();
}

function duplicateSelectedTheme() {
    const source = selectedCustomTheme();
    const theme = {
        id: makeId(),
        name: source ? `${source.name} 복사본` : 'Windows Classic 복사본',
        colors: normalizeColors(clone(source?.colors ?? DEFAULT_COLORS)),
    };
    settings.customThemes.push(theme);
    settings.theme = `custom:${theme.id}`;
    saveSettings();
    applyTheme();
    renderSettingsUi();
}

function deleteSelectedTheme() {
    const theme = selectedCustomTheme();
    if (!theme || !window.confirm(`“${theme.name}” 테마를 삭제할까요?`)) return;
    settings.customThemes = settings.customThemes.filter(item => item.id !== theme.id);
    settings.theme = 'classic';
    saveSettings();
    applyTheme();
    renderSettingsUi();
}

function exportSelectedTheme() {
    const selected = selectedCustomTheme();
    const payload = {
        format: 'st-mini-games-theme',
        version: 1,
        name: selected?.name ?? 'Windows Classic',
        colors: normalizeColors(selected?.colors ?? DEFAULT_COLORS),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${payload.name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

async function importThemeFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
        const payload = JSON.parse(await file.text());
        const supportedFormat = payload.format === 'st-mini-games-theme' || payload.format === 'st-classic-minesweeper-theme';
        if (!supportedFormat || typeof payload.name !== 'string' || !payload.colors) {
            throw new Error('지원하지 않는 테마 파일입니다.');
        }
        const theme = { id: makeId(), name: payload.name.slice(0, 40) || '불러온 테마', colors: normalizeColors(payload.colors) };
        settings.customThemes.push(theme);
        settings.theme = `custom:${theme.id}`;
        saveSettings();
        applyTheme();
        renderSettingsUi();
        context().toastr?.success?.('미니게임 테마를 불러왔습니다.');
    } catch (error) {
        console.error('[Mini Games] Theme import failed.', error);
        context().toastr?.error?.(error.message || '테마를 불러오지 못했습니다.');
    }
}

function openGameFromCommand(key) {
    void initialize().then(() => {
        if (activeGameKey !== key) startGame(key);
        openPanel();
    });
}

function registerSlashCommand() {
    if (slashRegistered) return;
    slashRegistered = true;

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'minigames',
        aliases: ['mg', 'games', '미니게임'],
        callback: (_namedArgs, unnamedArgs) => {
            const action = String(Array.isArray(unnamedArgs) ? unnamedArgs[0] ?? '' : unnamedArgs ?? '').trim().toLowerCase();
            if (action === 'close' || action === '닫기') closePanel();
            else if (action === 'minesweeper' || action === '지뢰찾기') openGameFromCommand('minesweeper');
            else if (action === 'spider' || action === '스파이더') openGameFromCommand('spider');
<<<<<<< HEAD
            else if (action === 'territory' || action === 'land' || action === '땅따먹기') openGameFromCommand('territory');
=======
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
            else if (action === 'menu' || action === '목록') void initialize().then(() => { showLauncher(); openPanel(); });
            else togglePanel();
            return '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({
<<<<<<< HEAD
            description: 'menu, minesweeper, spider, territory, close 중 하나',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
            enumList: ['menu', 'minesweeper', 'spider', 'territory', 'close'],
        })],
        helpString: '<div>미니게임 창을 열거나 게임을 바로 시작합니다.</div><div><code>/minigames</code>, <code>/mg menu</code>, <code>/mg spider</code>, <code>/mg territory</code></div>',
=======
            description: 'menu, minesweeper, spider, close 중 하나',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
            enumList: ['menu', 'minesweeper', 'spider', 'close'],
        })],
        helpString: '<div>미니게임 창을 열거나 게임을 바로 시작합니다.</div><div><code>/minigames</code>, <code>/mg menu</code>, <code>/mg spider</code></div>',
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'minesweeper',
        aliases: ['ms', '지뢰찾기'],
        callback: () => { openGameFromCommand('minesweeper'); return ''; },
        helpString: '<div>미니게임 확장의 지뢰찾기를 엽니다.</div>',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'spider',
        aliases: ['스파이더'],
        callback: () => { openGameFromCommand('spider'); return ''; },
        helpString: '<div>한 무늬 스파이더 카드게임을 엽니다.</div>',
    }));
<<<<<<< HEAD

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'territory',
        aliases: ['land', '땅따먹기'],
        callback: () => { openGameFromCommand('territory'); return ''; },
        helpString: '<div>선을 이어 영역을 점령하는 땅따먹기를 엽니다.</div>',
    }));
=======
>>>>>>> c1808c1481b038ce458d0a6c265634dc1ec24241
}

async function initialize() {
    if (initialized) return;
    initialized = true;
    settings = getSettings();
    createUi();
    applyTheme();
    placeFloatingButton();
    showLauncher();
    createSettingsUi();
}

export function onActivate() {
    registerSlashCommand();
    const { eventSource, event_types } = context();
    eventSource.on(event_types.APP_READY, () => {
        window.setTimeout(() => void initialize(), 0);
    });
}
