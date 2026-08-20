import { CELL_STATE, GAME_STATUS, MinesweeperGame } from './minesweeper-engine.js';

const DIFFICULTIES = Object.freeze({
    beginner: Object.freeze({ label: '초급', rows: 9, columns: 9, mines: 10 }),
    intermediate: Object.freeze({ label: '중급', rows: 16, columns: 16, mines: 40 }),
});

export function createMinesweeperGame(runtime) {
    let host;
    let game;
    let difficultyKey = runtime.settings.difficulty && DIFFICULTIES[runtime.settings.difficulty]
        ? runtime.settings.difficulty
        : 'beginner';
    let inputMode = 'reveal';
    let timerInterval = null;
    let elapsedMs = 0;
    let timerStartedAt = null;
    let longPressTimer = null;
    let longPressTriggered = false;
    let suppressClickUntil = 0;
    let lastPointerType = 'mouse';
    let mouseChordActive = false;

    function mount(container) {
        host = container;
        host.innerHTML = `
            <div class="stmg-ms-menubar" role="toolbar" aria-label="난이도 선택">
                <button type="button" data-difficulty="beginner">초급</button>
                <button type="button" data-difficulty="intermediate">중급</button>
            </div>
            <div class="stmg-ms-frame">
                <div class="stmg-ms-statusbar">
                    <output class="stmg-counter" data-ms-mines aria-label="남은 지뢰">010</output>
                    <button class="stmg-ms-face" data-ms-new type="button" aria-label="새 게임" title="새 게임">🙂</button>
                    <output class="stmg-counter" data-ms-timer aria-label="경과 시간">000</output>
                </div>
                <div class="stmg-ms-board-wrap">
                    <div class="stmg-ms-board" role="grid" aria-label="지뢰찾기 게임판"></div>
                </div>
                <div class="stmg-ms-touch-controls" aria-label="모바일 조작 모드">
                    <button type="button" data-input-mode="reveal" aria-pressed="true">칸 열기</button>
                    <button type="button" data-input-mode="flag" aria-pressed="false">깃발</button>
                </div>
                <p class="stmg-ms-help">짧게: 칸 열기 · 길게: 깃발 · 열린 숫자 다시 누르기: 주변 열기</p>
            </div>`;

        host.querySelector('[data-ms-new]').addEventListener('click', requestNewGame);
        host.querySelectorAll('[data-difficulty]').forEach(button => {
            button.addEventListener('click', () => requestNewGame(button.dataset.difficulty));
        });
        host.querySelectorAll('[data-input-mode]').forEach(button => {
            button.addEventListener('click', () => setInputMode(button.dataset.inputMode));
        });

        const board = host.querySelector('.stmg-ms-board');
        board.addEventListener('click', handleBoardClick);
        board.addEventListener('contextmenu', handleBoardContextMenu);
        board.addEventListener('mousedown', handleBoardMouseDown);
        board.addEventListener('pointerdown', handleBoardPointerDown);
        board.addEventListener('pointerup', cancelLongPress);
        board.addEventListener('pointercancel', cancelLongPress);
        board.addEventListener('pointerleave', cancelLongPress);
        window.addEventListener('mouseup', handleWindowMouseUp);

        startNewGame(difficultyKey);
    }

    function requestNewGame(nextDifficulty = difficultyKey) {
        const label = DIFFICULTIES[nextDifficulty]?.label ?? DIFFICULTIES.beginner.label;
        if (!window.confirm(`${label} 지뢰찾기를 새로 시작할까요?\n현재 게임은 사라집니다.`)) return;
        startNewGame(nextDifficulty);
    }

    function startNewGame(nextDifficulty = 'beginner') {
        const difficulty = DIFFICULTIES[nextDifficulty] ?? DIFFICULTIES.beginner;
        difficultyKey = DIFFICULTIES[nextDifficulty] ? nextDifficulty : 'beginner';
        runtime.settings.difficulty = difficultyKey;
        runtime.saveSettings();
        const gameWindow = host.closest('#stmg-window');
        if (gameWindow) gameWindow.dataset.msDifficulty = difficultyKey;
        elapsedMs = 0;
        timerStartedAt = null;
        stopTimerInterval();
        game = new MinesweeperGame(difficulty.rows, difficulty.columns, difficulty.mines);
        buildBoard();
        resize();
        renderAll();
        runtime.fitWindow?.();
    }

    function buildBoard() {
        const board = host.querySelector('.stmg-ms-board');
        const fragment = document.createDocumentFragment();
        board.replaceChildren();
        board.style.setProperty('--stmg-ms-columns', String(game.columns));

        for (let index = 0; index < game.size; index += 1) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'stmg-ms-cell';
            cell.dataset.index = String(index);
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('aria-label', '닫힌 칸');
            fragment.append(cell);
        }
        board.append(fragment);
    }

    function resize() {
        if (!host || !game) return;
        const board = host.querySelector('.stmg-ms-board');
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
        const compact = viewportWidth <= 700;
        const narrowViewport = viewportWidth <= 700;
        let size;

        if (game.columns === 16 && narrowViewport) {
            const frame = host.querySelector('.stmg-ms-frame');
            const boardWrap = host.querySelector('.stmg-ms-board-wrap');
            const frameStyle = window.getComputedStyle(frame);
            const wrapStyle = window.getComputedStyle(boardWrap);
            const horizontalChrome = (Number.parseFloat(frameStyle.paddingLeft) || 0)
                + (Number.parseFloat(frameStyle.paddingRight) || 0)
                + (Number.parseFloat(wrapStyle.borderLeftWidth) || 0)
                + (Number.parseFloat(wrapStyle.borderRightWidth) || 0);
            const usableWidth = Math.max(256, frame.clientWidth - horizontalChrome);
            const maximum = viewportWidth <= 480 ? 30 : 24;
            size = Math.max(16, Math.min(maximum, usableWidth / game.columns));
        } else {
            size = compact
                ? (game.columns === 9 ? 26 : 21)
                : (game.columns === 9 ? 30 : 24);
        }
        board.style.setProperty('--stmg-ms-cell-size', `${size}px`);
    }

    function beginTimerIfNeeded() {
        if (game.status !== GAME_STATUS.RUNNING || timerStartedAt !== null || !runtime.isVisible()) return;
        timerStartedAt = Date.now();
        startTimerInterval();
    }

    function pause() {
        if (timerStartedAt !== null) {
            elapsedMs += Date.now() - timerStartedAt;
            timerStartedAt = null;
        }
        stopTimerInterval();
        renderTimer();
    }

    function resume() {
        if (game?.status !== GAME_STATUS.RUNNING || timerStartedAt !== null) return;
        timerStartedAt = Date.now();
        startTimerInterval();
    }

    function finishTimer() {
        pause();
    }

    function startTimerInterval() {
        if (timerInterval !== null) return;
        timerInterval = window.setInterval(renderTimer, 250);
    }

    function stopTimerInterval() {
        if (timerInterval === null) return;
        window.clearInterval(timerInterval);
        timerInterval = null;
    }

    function currentElapsedSeconds() {
        const live = timerStartedAt === null ? 0 : Date.now() - timerStartedAt;
        return Math.min(999, Math.floor((elapsedMs + live) / 1000));
    }

    function formatCounter(value) {
        const clamped = Math.max(-99, Math.min(999, value));
        return clamped < 0 ? `-${String(Math.abs(clamped)).padStart(2, '0')}` : String(clamped).padStart(3, '0');
    }

    function cellFromEvent(event) {
        return event.target.closest('.stmg-ms-cell');
    }

    function handleBoardClick(event) {
        const cell = cellFromEvent(event);
        if (!cell || Date.now() < suppressClickUntil) return;
        const index = Number(cell.dataset.index);
        const isOpenNumber = game.states[index] === CELL_STATE.OPEN && game.values[index] > 0;

        if (isOpenNumber) {
            if (lastPointerType !== 'mouse' || event.detail === 0) performChord(index);
            return;
        }

        if (inputMode === 'flag') performFlag(index);
        else performReveal(index);
    }

    function handleBoardContextMenu(event) {
        const cell = cellFromEvent(event);
        if (!cell) return;
        event.preventDefault();
        if (Date.now() < suppressClickUntil) return;
        performFlag(Number(cell.dataset.index));
    }

    function handleBoardMouseDown(event) {
        if (event.buttons !== 3 || mouseChordActive) return;
        const cell = cellFromEvent(event);
        if (!cell) return;
        const index = Number(cell.dataset.index);
        if (game.states[index] !== CELL_STATE.OPEN || game.values[index] <= 0) return;

        event.preventDefault();
        mouseChordActive = true;
        suppressClickUntil = Date.now() + 800;
        performChord(index);
    }

    function handleWindowMouseUp(event) {
        if ((event.buttons & 3) !== 3) mouseChordActive = false;
    }

    function handleBoardPointerDown(event) {
        lastPointerType = event.pointerType || 'mouse';
        if (event.pointerType === 'mouse' || event.button !== 0) return;
        const cell = cellFromEvent(event);
        if (!cell) return;
        longPressTriggered = false;
        const index = Number(cell.dataset.index);
        longPressTimer = window.setTimeout(() => {
            longPressTriggered = true;
            suppressClickUntil = Date.now() + 700;
            performFlag(index);
            navigator.vibrate?.(20);
        }, 480);
    }

    function cancelLongPress() {
        if (longPressTimer !== null) window.clearTimeout(longPressTimer);
        longPressTimer = null;
        if (longPressTriggered) suppressClickUntil = Date.now() + 700;
    }

    function performReveal(index) {
        const before = game.status;
        if (!game.reveal(index)) return;
        if (before === GAME_STATUS.READY && game.status === GAME_STATUS.RUNNING) beginTimerIfNeeded();
        if (game.status === GAME_STATUS.WON || game.status === GAME_STATUS.LOST) finishTimer();
        renderAll();
    }

    function performChord(index) {
        if (!game.chord(index)) return;
        if (game.status === GAME_STATUS.WON || game.status === GAME_STATUS.LOST) finishTimer();
        renderAll();
    }

    function performFlag(index) {
        if (!game.toggleFlag(index)) return;
        renderAll();
    }

    function setInputMode(mode) {
        inputMode = mode === 'flag' ? 'flag' : 'reveal';
        host.querySelectorAll('[data-input-mode]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.inputMode === inputMode));
        });
    }

    function renderAll() {
        if (!game) return;
        renderBoard();
        host.querySelector('[data-ms-mines]').textContent = formatCounter(game.mineCount - game.flaggedCount);
        renderTimer();
        renderFace();
        host.querySelectorAll('[data-difficulty]').forEach(button => {
            button.classList.toggle('is-active', button.dataset.difficulty === difficultyKey);
        });
    }

    function renderBoard() {
        host.querySelectorAll('.stmg-ms-cell').forEach((cell, index) => {
            const state = game.states[index];
            const value = game.values[index];
            const isMine = value === -1;
            cell.className = 'stmg-ms-cell';
            cell.textContent = '';

            if (game.status === GAME_STATUS.LOST && state === CELL_STATE.FLAGGED && !isMine) {
                cell.classList.add('is-open', 'is-wrong-flag');
                cell.textContent = '×';
                cell.setAttribute('aria-label', '잘못 표시한 깃발');
            } else if (state === CELL_STATE.FLAGGED) {
                cell.classList.add('is-flagged');
                cell.textContent = '⚑';
                cell.setAttribute('aria-label', '깃발이 꽂힌 칸');
            } else if (state === CELL_STATE.OPEN) {
                cell.classList.add('is-open');
                if (isMine) {
                    cell.classList.add(index === game.explodedIndex ? 'is-exploded' : 'is-mine');
                    cell.textContent = '✹';
                    cell.setAttribute('aria-label', index === game.explodedIndex ? '폭발한 지뢰' : '지뢰');
                } else if (value > 0) {
                    cell.classList.add(`number-${Math.min(value, 4)}`);
                    cell.textContent = String(value);
                    cell.setAttribute('aria-label', `주변 지뢰 ${value}개`);
                } else {
                    cell.setAttribute('aria-label', '빈 칸');
                }
            } else if (game.status === GAME_STATUS.LOST && isMine) {
                cell.classList.add('is-open', 'is-mine');
                cell.textContent = '✹';
                cell.setAttribute('aria-label', '지뢰');
            } else {
                cell.setAttribute('aria-label', '닫힌 칸');
            }
        });
    }

    function renderTimer() {
        const timer = host?.querySelector('[data-ms-timer]');
        if (timer) timer.textContent = formatCounter(currentElapsedSeconds());
    }

    function renderFace() {
        const face = host.querySelector('[data-ms-new]');
        face.textContent = game.status === GAME_STATUS.WON ? '😎' : game.status === GAME_STATUS.LOST ? '😵' : '🙂';
    }

    function destroy() {
        pause();
        cancelLongPress();
        window.removeEventListener('mouseup', handleWindowMouseUp);
        if (host) host.replaceChildren();
        host = null;
        game = null;
    }

    return { mount, pause, resume, resize, destroy };
}
