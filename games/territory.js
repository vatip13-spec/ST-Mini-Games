import {
    TERRITORY_CELL,
    TERRITORY_DIRECTIONS,
    TERRITORY_STATUS,
    TerritoryGame,
} from './territory-engine.js';

const TICK_MS = 68;
const COUNTDOWN_MS = 2100;
const STAGE_CLEAR_MS = 1500;

const KEY_DIRECTIONS = Object.freeze({
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    W: 'up',
    s: 'down',
    S: 'down',
    a: 'left',
    A: 'left',
    d: 'right',
    D: 'right',
});

export function createTerritoryGame(runtime) {
    let host;
    let game;
    let canvas;
    let drawingContext;
    let animationFrame = null;
    let lastFrameTime = 0;
    let accumulator = 0;
    let mode = 'paused';
    let countdownRemaining = COUNTDOWN_MS;
    let stageTransitionRemaining = STAGE_CLEAR_MS;
    let swipe = null;
    let resizeObserver = null;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let previousLives = 3;

    function mount(container) {
        host = container;
        host.innerHTML = `
            <div class="stmg-territory-toolbar">
                <div class="stmg-territory-stat"><span>스테이지</span><strong data-territory-stage>1</strong></div>
                <div class="stmg-territory-stat"><span>점령</span><strong data-territory-percent>0 / 80%</strong></div>
                <div class="stmg-territory-stat"><span>목숨</span><strong data-territory-lives>♥♥♥</strong></div>
                <div class="stmg-territory-stat"><span>점수</span><strong data-territory-score>0</strong></div>
                <button type="button" data-territory-new>새 게임</button>
            </div>
            <div class="stmg-territory-board-wrap">
                <canvas class="stmg-territory-canvas" aria-label="땅따먹기 게임판"></canvas>
                <div class="stmg-territory-overlay" data-territory-overlay hidden aria-live="polite"></div>
            </div>
            <div class="stmg-territory-controls" aria-label="모바일 땅따먹기 조작">
                <div class="stmg-territory-dpad">
                    <button type="button" data-territory-direction="up" aria-label="위">▲</button>
                    <button type="button" data-territory-direction="left" aria-label="왼쪽">◀</button>
                    <button type="button" data-territory-direction="down" aria-label="아래">▼</button>
                    <button type="button" data-territory-direction="right" aria-label="오른쪽">▶</button>
                </div>
                <button class="stmg-territory-draw" type="button" data-territory-draw>⚡ 선 긋기</button>
            </div>
            <p class="stmg-territory-help">
                <span class="stmg-territory-help-pc">방향키/WASD: 이동 · 스페이스바: 선 긋기</span>
                <span class="stmg-territory-help-mobile">스와이프 또는 방향 버튼: 이동 · 선 긋기 버튼: 출격</span>
            </p>`;

        canvas = host.querySelector('.stmg-territory-canvas');
        drawingContext = canvas.getContext('2d');
        host.querySelector('[data-territory-new]').addEventListener('click', requestNewGame);
        host.querySelector('[data-territory-draw]').addEventListener('click', toggleDrawing);
        host.querySelectorAll('[data-territory-direction]').forEach(button => {
            button.addEventListener('pointerdown', event => {
                event.preventDefault();
                setDirection(button.dataset.territoryDirection, true);
            });
        });

        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', finishPointer);
        canvas.addEventListener('pointercancel', finishPointer);
        window.addEventListener('keydown', handleKeyDown);

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host.querySelector('.stmg-territory-board-wrap'));
        startNewGame();
    }

    function requestNewGame() {
        if (!window.confirm('땅따먹기를 새로 시작할까요?\n현재 게임은 사라집니다.')) return;
        startNewGame();
    }

    function startNewGame() {
        stopLoop();
        game = new TerritoryGame();
        previousLives = game.lives;
        accumulator = 0;
        stageTransitionRemaining = STAGE_CLEAR_MS;
        resize();
        if (runtime.isVisible()) beginCountdown();
        else mode = 'paused';
        renderAll();
        runtime.fitWindow?.();
    }

    function handleKeyDown(event) {
        if (!host || !runtime.isVisible()) return;
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (['input', 'textarea', 'select', 'button'].includes(activeTag)) return;
        const direction = KEY_DIRECTIONS[event.key];
        if (direction) {
            event.preventDefault();
            setDirection(direction);
            return;
        }
        if ((event.code === 'Space' || event.key === ' ') && !event.repeat) {
            event.preventDefault();
            toggleDrawing();
        }
    }

    function setDirection(direction, vibrate = false) {
        if (mode !== 'playing' || !game?.setDirection(direction)) return false;
        if (vibrate) navigator.vibrate?.(8);
        return true;
    }

    function toggleDrawing() {
        if (mode !== 'playing' || !game) return;
        if (game.drawing) {
            runtime.toast('info', '선을 안전지대까지 이어주세요.');
            return;
        }
        if (!game.toggleArmed()) return;
        navigator.vibrate?.(12);
        renderControls();
    }

    function handlePointerDown(event) {
        if (event.button !== 0 || mode !== 'playing') return;
        swipe = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
        };
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    function handlePointerMove(event) {
        if (!swipe || swipe.id !== event.pointerId || mode !== 'playing') return;
        const deltaX = event.clientX - swipe.x;
        const deltaY = event.clientY - swipe.y;
        if (Math.hypot(deltaX, deltaY) < 22) return;
        const direction = Math.abs(deltaX) > Math.abs(deltaY)
            ? (deltaX < 0 ? 'left' : 'right')
            : (deltaY < 0 ? 'up' : 'down');
        if (setDirection(direction, true)) swipe.moved = true;
        swipe.x = event.clientX;
        swipe.y = event.clientY;
        event.preventDefault();
    }

    function finishPointer(event) {
        if (!swipe || swipe.id !== event.pointerId) return;
        swipe = null;
    }

    function beginCountdown() {
        if (!game || game.status !== TERRITORY_STATUS.RUNNING) return;
        mode = 'countdown';
        countdownRemaining = COUNTDOWN_MS;
        accumulator = 0;
        startLoop();
    }

    function startLoop() {
        if (animationFrame !== null || !host || mode === 'paused' || mode === 'game-over') return;
        lastFrameTime = performance.now();
        animationFrame = window.requestAnimationFrame(frame);
    }

    function stopLoop() {
        if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    function frame(now) {
        animationFrame = null;
        if (!host) return;
        const delta = Math.min(100, Math.max(0, now - lastFrameTime));
        lastFrameTime = now;

        if (mode === 'countdown') {
            countdownRemaining -= delta;
            if (countdownRemaining <= 0) {
                countdownRemaining = 0;
                mode = 'playing';
            }
        } else if (mode === 'playing') {
            accumulator += delta;
            while (accumulator >= TICK_MS && mode === 'playing') {
                accumulator -= TICK_MS;
                game.tick();
                handleGameStatus();
            }
        } else if (mode === 'stage-clear') {
            stageTransitionRemaining -= delta;
            if (stageTransitionRemaining <= 0) {
                game.nextStage();
                previousLives = game.lives;
                stageTransitionRemaining = STAGE_CLEAR_MS;
                beginCountdown();
            }
        }

        renderAll();
        if (mode !== 'paused' && mode !== 'game-over' && animationFrame === null) {
            animationFrame = window.requestAnimationFrame(frame);
        }
    }

    function handleGameStatus() {
        if (game.lives < previousLives) {
            navigator.vibrate?.([45, 35, 45]);
            previousLives = game.lives;
        }
        if (game.status === TERRITORY_STATUS.STAGE_CLEAR) {
            mode = 'stage-clear';
            stageTransitionRemaining = STAGE_CLEAR_MS;
            runtime.toast('success', `스테이지 ${game.stage} 클리어!`);
        } else if (game.status === TERRITORY_STATUS.GAME_OVER) {
            mode = 'game-over';
            runtime.toast('error', '게임 오버! 새 게임으로 다시 도전해 보세요.');
        }
    }

    function pause() {
        if (!game || mode === 'paused' || mode === 'game-over') return;
        mode = 'paused';
        swipe = null;
        stopLoop();
        renderAll();
    }

    function resume() {
        if (!game || game.status === TERRITORY_STATUS.GAME_OVER) return;
        if (game.status === TERRITORY_STATUS.STAGE_CLEAR) {
            mode = 'stage-clear';
            startLoop();
        } else {
            beginCountdown();
        }
        renderAll();
    }

    function resize() {
        if (!host || !canvas || !drawingContext) return;
        const wrap = host.querySelector('.stmg-territory-board-wrap');
        const available = Math.max(240, Math.min(640, wrap.clientWidth || runtime.getAvailableWidth() - 10));
        const width = Math.floor(available);
        const height = Math.floor(width * game.rows / game.columns);
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        canvasWidth = width;
        canvasHeight = height;
        renderCanvas();
    }

    function renderAll() {
        if (!host || !game) return;
        host.querySelector('[data-territory-stage]').textContent = String(game.stage);
        host.querySelector('[data-territory-percent]').textContent = `${game.capturePercent} / ${Math.round(game.targetRatio * 100)}%`;
        host.querySelector('[data-territory-lives]').textContent = `${'♥'.repeat(game.lives)}${'♡'.repeat(Math.max(0, game.initialLives - game.lives))}`;
        host.querySelector('[data-territory-score]').textContent = game.score.toLocaleString('ko-KR');
        renderControls();
        renderOverlay();
        renderCanvas();
    }

    function renderControls() {
        const button = host?.querySelector('[data-territory-draw]');
        if (!button || !game) return;
        button.classList.toggle('is-armed', game.armed && !game.drawing);
        button.classList.toggle('is-drawing', game.drawing);
        button.disabled = mode !== 'playing' || game.drawing;
        button.textContent = game.drawing ? '✦ 선 긋는 중' : game.armed ? '⚡ 출격 준비!' : '⚡ 선 긋기';
        host.querySelectorAll('[data-territory-direction]').forEach(control => {
            control.disabled = mode !== 'playing';
            control.classList.toggle('is-active', game.direction === control.dataset.territoryDirection);
        });
    }

    function renderOverlay() {
        const overlay = host?.querySelector('[data-territory-overlay]');
        if (!overlay || !game) return;
        let content = '';
        if (mode === 'paused') content = '<strong>일시정지</strong><span>창을 다시 열면 이어서 시작합니다.</span>';
        else if (mode === 'countdown') content = `<strong>${Math.max(1, Math.ceil(countdownRemaining / 700))}</strong><span>준비하세요!</span>`;
        else if (mode === 'stage-clear') content = `<strong>STAGE ${game.stage} CLEAR!</strong><span>${game.capturePercent}% 점령</span>`;
        else if (mode === 'game-over') content = `<strong>GAME OVER</strong><span>점수 ${game.score.toLocaleString('ko-KR')}</span>`;
        overlay.hidden = !content;
        overlay.innerHTML = content;
    }

    function renderCanvas() {
        if (!drawingContext || !game) return;
        const context = drawingContext;
        const cellWidth = canvasWidth / game.columns;
        const cellHeight = canvasHeight / game.rows;
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = '#06101b';
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        for (let row = 0; row < game.rows; row += 1) {
            for (let column = 0; column < game.columns; column += 1) {
                const state = game.cellAt(column, row);
                const x = column * cellWidth;
                const y = row * cellHeight;
                if (state === TERRITORY_CELL.LAND) {
                    context.fillStyle = (column + row) % 2 ? '#176789' : '#1c7394';
                    context.fillRect(x, y, Math.ceil(cellWidth), Math.ceil(cellHeight));
                    context.fillStyle = 'rgb(92 216 236 / 20%)';
                    context.fillRect(x, y, Math.ceil(cellWidth), Math.max(1, cellHeight * 0.14));
                } else if (state === TERRITORY_CELL.TRAIL) {
                    context.fillStyle = '#ffe76a';
                    context.fillRect(x, y, Math.ceil(cellWidth), Math.ceil(cellHeight));
                } else if (((column * 17 + row * 29) % 97) < 2) {
                    context.fillStyle = 'rgb(113 182 217 / 28%)';
                    context.fillRect(x + cellWidth * 0.45, y + cellHeight * 0.45, 1, 1);
                }
            }
        }

        for (const enemy of game.enemies) drawEnemy(context, enemy, cellWidth, cellHeight);
        drawPlayer(context, cellWidth, cellHeight);

        context.strokeStyle = 'rgb(79 216 239 / 38%)';
        context.lineWidth = 1;
        context.strokeRect(0.5, 0.5, canvasWidth - 1, canvasHeight - 1);
    }

    function drawEnemy(context, enemy, cellWidth, cellHeight) {
        const x = (enemy.x + 0.5) * cellWidth;
        const y = (enemy.y + 0.5) * cellHeight;
        const radius = Math.max(4, Math.min(cellWidth, cellHeight) * (0.55 + enemy.radius));
        context.save();
        context.translate(x, y);
        context.rotate((game.ticks * 0.08 + enemy.hue) % (Math.PI * 2));
        context.strokeStyle = `hsl(${enemy.hue} 92% 68%)`;
        context.fillStyle = `hsl(${enemy.hue} 82% 48%)`;
        context.lineWidth = Math.max(1, radius * 0.18);
        for (let spoke = 0; spoke < 6; spoke += 1) {
            context.rotate(Math.PI / 3);
            context.beginPath();
            context.moveTo(radius * 0.55, 0);
            context.lineTo(radius * 1.25, 0);
            context.stroke();
        }
        context.beginPath();
        context.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#fff7c7';
        context.beginPath();
        context.arc(-radius * 0.16, -radius * 0.16, radius * 0.18, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function drawPlayer(context, cellWidth, cellHeight) {
        const x = (game.player.x + 0.5) * cellWidth;
        const y = (game.player.y + 0.5) * cellHeight;
        const radius = Math.max(3, Math.min(cellWidth, cellHeight) * 0.48);
        const direction = TERRITORY_DIRECTIONS[game.direction] ?? { x: 0, y: -1 };
        const angle = Math.atan2(direction.y, direction.x);
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.fillStyle = game.drawing ? '#fff16a' : game.armed ? '#ffae36' : '#f4fbff';
        context.strokeStyle = '#082838';
        context.lineWidth = Math.max(1, radius * 0.2);
        context.beginPath();
        context.moveTo(radius * 1.25, 0);
        context.lineTo(-radius * 0.9, radius * 0.8);
        context.lineTo(-radius * 0.55, 0);
        context.lineTo(-radius * 0.9, -radius * 0.8);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
    }

    function destroy() {
        pause();
        stopLoop();
        resizeObserver?.disconnect();
        resizeObserver = null;
        window.removeEventListener('keydown', handleKeyDown);
        if (host) host.replaceChildren();
        host = null;
        game = null;
        canvas = null;
        drawingContext = null;
    }

    return { mount, pause, resume, resize, destroy };
}
