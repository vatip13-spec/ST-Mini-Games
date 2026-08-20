import { SPIDER_STATUS, SpiderGame } from './spider-engine.js';

const RANK_LABELS = Object.freeze({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' });

export function createSpiderGame(runtime) {
    let host;
    let game;
    let selected = null;
    let pointer = null;
    let dragGhost = null;
    let cardMetrics = { width: 42, height: 60, faceOffset: 18, downOffset: 9, gap: 3 };
    let timerInterval = null;
    let elapsedMs = 0;
    let timerStartedAt = null;
    let gameStarted = false;
    let hintState = null;
    let hintTimer = null;

    function mount(container) {
        host = container;
        host.innerHTML = `
            <div class="stmg-spider-toolbar">
                <div class="stmg-spider-stats">
                    <div class="stmg-spider-stat"><span>완성</span><strong data-spider-completed>0 / 8</strong></div>
                    <div class="stmg-spider-stat"><span>이동</span><strong data-spider-moves>0</strong></div>
                    <div class="stmg-spider-stat"><span>시간</span><strong data-spider-timer>00:00</strong></div>
                </div>
                <div class="stmg-spider-actions">
                    <button type="button" data-spider-undo>↶ 되돌리기</button>
                    <button type="button" data-spider-hint>💡 힌트</button>
                    <button type="button" data-spider-new>새 게임</button>
                </div>
            </div>
            <div class="stmg-spider-board-wrap">
                <div class="stmg-spider-board" aria-label="스파이더 카드게임 판"></div>
            </div>
            <div class="stmg-spider-footer">
                <button class="stmg-spider-stock" type="button" data-spider-deal aria-label="다음 카드 열 장 놓기">
                    <span class="stmg-spider-stock-card">♠</span>
                    <strong data-spider-deals>5회</strong>
                </button>
                <div class="stmg-spider-foundations" aria-label="완성된 카드 묶음"></div>
            </div>
            <p class="stmg-spider-help">내림차순 묶음을 드래그하거나, 카드와 이동할 열을 차례로 누르세요.</p>
            <div class="stmg-spider-win" hidden>
                <strong>축하합니다!</strong>
                <span>카드 여덟 묶음을 모두 완성했습니다.</span>
            </div>`;

        host.querySelector('[data-spider-new]').addEventListener('click', requestNewGame);
        host.querySelector('[data-spider-undo]').addEventListener('click', undoMove);
        host.querySelector('[data-spider-hint]').addEventListener('click', showHint);
        host.querySelector('[data-spider-deal]').addEventListener('click', dealStock);

        const board = host.querySelector('.stmg-spider-board');
        board.addEventListener('pointerdown', handlePointerDown);
        board.addEventListener('pointermove', handlePointerMove);
        board.addEventListener('pointerup', handlePointerUp);
        board.addEventListener('pointercancel', cancelPointer);

        startNewGame();
    }

    function requestNewGame() {
        if (!window.confirm('스파이더 카드게임을 새로 시작할까요?\n현재 게임은 사라집니다.')) return;
        startNewGame();
    }

    function startNewGame() {
        cancelPointer();
        clearHint();
        game = new SpiderGame();
        selected = null;
        elapsedMs = 0;
        timerStartedAt = null;
        gameStarted = false;
        stopTimerInterval();
        resize();
        renderAll();
    }

    function rankLabel(rank) {
        return RANK_LABELS[rank] ?? String(rank);
    }

    function createCardElement(card, columnIndex, cardIndex, ghost = false) {
        const element = document.createElement(ghost ? 'div' : 'button');
        if (!ghost) element.type = 'button';
        element.className = `stmg-spider-card ${card.faceUp ? 'is-face-up' : 'is-face-down'}`;
        element.dataset.column = String(columnIndex);
        element.dataset.cardIndex = String(cardIndex);
        element.dataset.cardId = card.id;
        if (card.faceUp) {
            const label = rankLabel(card.rank);
            element.innerHTML = `<span class="stmg-card-corner"><b>${label}</b><i>♠</i></span><span class="stmg-card-suit">♠</span>`;
            element.setAttribute('aria-label', `스페이드 ${label}`);
        } else {
            element.innerHTML = '<span class="stmg-card-back-mark">♠</span>';
            element.setAttribute('aria-label', '뒤집힌 카드');
        }
        return element;
    }

    function renderAll() {
        if (!host || !game) return;
        renderBoard();
        host.querySelector('[data-spider-completed]').textContent = `${game.completed} / 8`;
        host.querySelector('[data-spider-moves]').textContent = String(game.moves);
        host.querySelector('[data-spider-deals]').textContent = `${game.remainingDeals}회`;
        host.querySelector('[data-spider-undo]').disabled = !game.canUndo;
        host.querySelector('[data-spider-hint]').disabled = game.status === SPIDER_STATUS.WON;
        const dealButton = host.querySelector('[data-spider-deal]');
        dealButton.disabled = game.stock.length < 10 || game.status === SPIDER_STATUS.WON;
        dealButton.classList.toggle('is-hint', hintState?.type === 'deal');
        dealButton.title = game.tableau.some(column => column.length === 0)
            ? '빈 열을 채운 뒤 카드를 나눌 수 있습니다.'
            : '다음 카드 열 장 놓기';
        renderFoundations();
        renderTimer();
        host.querySelector('.stmg-spider-win').hidden = game.status !== SPIDER_STATUS.WON;
    }

    function renderBoard() {
        const board = host.querySelector('.stmg-spider-board');
        const fragment = document.createDocumentFragment();

        game.tableau.forEach((column, columnIndex) => {
            const columnElement = document.createElement('div');
            columnElement.className = 'stmg-spider-column';
            columnElement.dataset.spiderColumn = String(columnIndex);
            columnElement.setAttribute('aria-label', `${columnIndex + 1}번 열`);

            column.forEach((card, cardIndex) => {
                const cardElement = createCardElement(card, columnIndex, cardIndex);
                if (cardIndex > 0) {
                    const previous = column[cardIndex - 1];
                    const offset = previous.faceUp ? cardMetrics.faceOffset : cardMetrics.downOffset;
                    cardElement.style.marginTop = `${-(cardMetrics.height - offset)}px`;
                }
                if (selected?.column === columnIndex && cardIndex >= selected.index) {
                    cardElement.classList.add('is-selected');
                }
                if (hintState?.type === 'move' && hintState.sourceColumn === columnIndex && cardIndex >= hintState.cardIndex) {
                    cardElement.classList.add('is-hint-source');
                }
                if (hintState?.type === 'move'
                    && hintState.targetColumn === columnIndex
                    && cardIndex === column.length - 1) {
                    cardElement.classList.add('is-hint-target');
                }
                columnElement.append(cardElement);
            });

            if (hintState?.type === 'move' && hintState.targetColumn === columnIndex && column.length === 0) {
                columnElement.classList.add('is-hint-target');
            }

            fragment.append(columnElement);
        });

        board.replaceChildren(fragment);
    }

    function renderFoundations() {
        const foundations = host.querySelector('.stmg-spider-foundations');
        foundations.replaceChildren();
        for (let index = 0; index < 8; index += 1) {
            const slot = document.createElement('span');
            slot.className = `stmg-spider-foundation ${index < game.completed ? 'is-complete' : ''}`;
            slot.textContent = index < game.completed ? 'K♠' : '';
            foundations.append(slot);
        }
    }

    function resize() {
        if (!host) return;
        const available = Math.max(220, Math.min(runtime.getAvailableWidth() - 20, 720));
        const gap = available <= 420 ? 2 : 4;
        const width = Math.max(20, Math.min(58, Math.floor((available - 12 - gap * 9) / 10)));
        const height = Math.round(width * 1.42);
        cardMetrics = {
            width,
            height,
            faceOffset: Math.max(13, Math.round(width * 0.42)),
            downOffset: Math.max(7, Math.round(width * 0.2)),
            gap,
        };
        host.style.setProperty('--stmg-card-width', `${width}px`);
        host.style.setProperty('--stmg-card-height', `${height}px`);
        host.style.setProperty('--stmg-card-gap', `${gap}px`);
        host.style.setProperty('--stmg-card-font', `${Math.max(10, Math.round(width * 0.3))}px`);
        renderBoard();
    }

    function handlePointerDown(event) {
        if (event.button !== 0 || game.status === SPIDER_STATUS.WON) return;
        clearHint();
        const board = host.querySelector('.stmg-spider-board');
        const card = event.target.closest('.stmg-spider-card');
        const columnElement = event.target.closest('.stmg-spider-column');
        if (!columnElement) return;

        const column = Number(columnElement.dataset.spiderColumn);
        const cardIndex = card ? Number(card.dataset.cardIndex) : game.tableau[column].length;
        const canDrag = Boolean(card && game.isMovableSequence(column, cardIndex));
        const rect = card?.getBoundingClientRect();
        pointer = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            column,
            cardIndex,
            canDrag,
            dragging: false,
            offsetX: rect ? event.clientX - rect.left : 0,
            offsetY: rect ? event.clientY - rect.top : 0,
        };
        board.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event) {
        if (!pointer || pointer.id !== event.pointerId || !pointer.canDrag) return;
        if (!pointer.dragging && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) {
            startDragging(event);
        }
        if (!pointer.dragging) return;
        event.preventDefault();
        positionDragGhost(event.clientX, event.clientY);
    }

    function startDragging(event) {
        pointer.dragging = true;
        lockPageScroll();
        const cards = game.tableau[pointer.column].slice(pointer.cardIndex);
        dragGhost = document.createElement('div');
        dragGhost.className = 'stmg-spider-drag-ghost';
        cards.forEach((card, index) => {
            const element = createCardElement(card, pointer.column, pointer.cardIndex + index, true);
            if (index > 0) element.style.marginTop = `${-(cardMetrics.height - cardMetrics.faceOffset)}px`;
            dragGhost.append(element);
        });
        document.body.append(dragGhost);
        positionDragGhost(event.clientX, event.clientY);
    }

    function positionDragGhost(clientX, clientY) {
        if (!dragGhost) return;
        dragGhost.style.left = `${clientX - pointer.offsetX}px`;
        dragGhost.style.top = `${clientY - pointer.offsetY}px`;
        dragGhost.style.setProperty('--stmg-card-width', `${cardMetrics.width}px`);
        dragGhost.style.setProperty('--stmg-card-height', `${cardMetrics.height}px`);
        dragGhost.style.setProperty('--stmg-card-font', `${Math.max(10, Math.round(cardMetrics.width * 0.3))}px`);
    }

    function handlePointerUp(event) {
        if (!pointer || pointer.id !== event.pointerId) return;
        const current = pointer;
        if (current.dragging) {
            const targetColumn = columnAtPoint(event.clientX, event.clientY);
            const wasWon = game.status === SPIDER_STATUS.WON;
            if (targetColumn !== null && game.move(current.column, current.cardIndex, targetColumn)) {
                afterSuccessfulMove(wasWon);
            }
        } else {
            handleTap(current.column, current.cardIndex);
        }
        cancelPointer();
        renderAll();
    }

    function handleTap(column, cardIndex) {
        if (selected && game.canMove(selected.column, selected.index, column)) {
            const wasWon = game.status === SPIDER_STATUS.WON;
            game.move(selected.column, selected.index, column);
            selected = null;
            afterSuccessfulMove(wasWon);
            return;
        }

        if (cardIndex < game.tableau[column].length && game.isMovableSequence(column, cardIndex)) {
            selected = { column, index: cardIndex };
        } else {
            selected = null;
        }
    }

    function columnAtPoint(clientX, clientY) {
        const element = document.elementFromPoint(clientX, clientY);
        const column = element?.closest?.('.stmg-spider-column');
        if (!column || !host.contains(column)) return null;
        return Number(column.dataset.spiderColumn);
    }

    function dealStock() {
        clearHint();
        if (game.tableau.some(column => column.length === 0)) {
            runtime.toast('warning', '빈 열을 먼저 채워야 카드를 나눌 수 있습니다.');
            return;
        }
        const wasWon = game.status === SPIDER_STATUS.WON;
        if (!game.deal()) return;
        selected = null;
        afterSuccessfulMove(wasWon);
        renderAll();
    }

    function undoMove() {
        clearHint();
        cancelPointer();
        const wasWon = game.status === SPIDER_STATUS.WON;
        if (!game.undo()) return;
        selected = null;
        if (wasWon && game.status !== SPIDER_STATUS.WON && gameStarted) resume();
        renderAll();
    }

    function showHint() {
        clearHint();
        const hint = game.getHint();
        if (!hint) {
            runtime.toast('warning', '지금 가능한 이동이 없습니다. 되돌리기를 사용해 보세요.');
            return;
        }

        hintState = hint;
        if (hint.type === 'deal') {
            runtime.toast('info', '카드 더미를 눌러 새 카드를 나눠보세요.');
        } else {
            const card = game.tableau[hint.sourceColumn][hint.cardIndex];
            runtime.toast('info', `${hint.sourceColumn + 1}열의 ${rankLabel(card.rank)}♠부터 ${hint.targetColumn + 1}열로 옮길 수 있습니다.`);
        }
        renderAll();
        hintTimer = window.setTimeout(() => {
            hintTimer = null;
            hintState = null;
            renderAll();
        }, 3200);
    }

    function clearHint() {
        if (hintTimer !== null) window.clearTimeout(hintTimer);
        hintTimer = null;
        hintState = null;
        if (!host) return;
        host.querySelectorAll('.is-hint-source, .is-hint-target, .is-hint').forEach(element => {
            element.classList.remove('is-hint-source', 'is-hint-target', 'is-hint');
        });
    }

    function afterSuccessfulMove(wasWon) {
        beginTimer();
        if (!wasWon && game.status === SPIDER_STATUS.WON) {
            pause();
            runtime.toast('success', '스파이더 카드게임을 완성했습니다!');
        }
    }

    function beginTimer() {
        gameStarted = true;
        if (!runtime.isVisible() || timerStartedAt !== null || game.status === SPIDER_STATUS.WON) return;
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
        cancelPointer();
    }

    function resume() {
        if (!gameStarted || game?.status === SPIDER_STATUS.WON || timerStartedAt !== null) return;
        timerStartedAt = Date.now();
        startTimerInterval();
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

    function renderTimer() {
        const target = host?.querySelector('[data-spider-timer]');
        if (!target) return;
        const live = timerStartedAt === null ? 0 : Date.now() - timerStartedAt;
        const seconds = Math.floor((elapsedMs + live) / 1000);
        const minutes = Math.floor(seconds / 60);
        target.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function preventTouchScroll(event) {
        event.preventDefault();
    }

    function lockPageScroll() {
        document.documentElement.classList.add('stmg-card-drag-active');
        document.body.classList.add('stmg-card-drag-active');
        window.addEventListener('touchmove', preventTouchScroll, { passive: false });
    }

    function unlockPageScroll() {
        document.documentElement.classList.remove('stmg-card-drag-active');
        document.body.classList.remove('stmg-card-drag-active');
        window.removeEventListener('touchmove', preventTouchScroll);
    }

    function cancelPointer() {
        dragGhost?.remove();
        dragGhost = null;
        pointer = null;
        unlockPageScroll();
    }

    function destroy() {
        pause();
        clearHint();
        if (host) host.replaceChildren();
        host = null;
        game = null;
        selected = null;
    }

    return { mount, pause, resume, resize, destroy };
}
