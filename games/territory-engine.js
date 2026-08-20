export const TERRITORY_CELL = Object.freeze({
    EMPTY: 0,
    LAND: 1,
    TRAIL: 2,
});

export const TERRITORY_STATUS = Object.freeze({
    RUNNING: 'running',
    STAGE_CLEAR: 'stage-clear',
    GAME_OVER: 'game-over',
});

export const TERRITORY_DIRECTIONS = Object.freeze({
    up: Object.freeze({ x: 0, y: -1 }),
    down: Object.freeze({ x: 0, y: 1 }),
    left: Object.freeze({ x: -1, y: 0 }),
    right: Object.freeze({ x: 1, y: 0 }),
});

function isOpposite(first, second) {
    if (!first || !second) return false;
    const a = TERRITORY_DIRECTIONS[first];
    const b = TERRITORY_DIRECTIONS[second];
    return a.x + b.x === 0 && a.y + b.y === 0;
}

export class TerritoryGame {
    constructor(options = {}) {
        this.rows = options.rows ?? 30;
        this.columns = options.columns ?? 40;
        this.targetRatio = options.targetRatio ?? 0.8;
        this.initialLives = options.lives ?? 3;
        this.random = options.random ?? Math.random;

        if (!Number.isInteger(this.rows) || !Number.isInteger(this.columns) || this.rows < 8 || this.columns < 8) {
            throw new RangeError('The territory board must be at least 8 by 8 cells.');
        }
        if (!(this.targetRatio > 0 && this.targetRatio <= 1)) {
            throw new RangeError('The target ratio must be greater than 0 and no more than 1.');
        }

        this.newGame();
    }

    get size() {
        return this.rows * this.columns;
    }

    get interiorSize() {
        return (this.rows - 2) * (this.columns - 2);
    }

    get captureRatio() {
        let captured = 0;
        for (let row = 1; row < this.rows - 1; row += 1) {
            for (let column = 1; column < this.columns - 1; column += 1) {
                if (this.cells[this.index(column, row)] === TERRITORY_CELL.LAND) captured += 1;
            }
        }
        return captured / this.interiorSize;
    }

    get capturePercent() {
        return Math.min(100, Math.floor(this.captureRatio * 100));
    }

    index(column, row) {
        return row * this.columns + column;
    }

    coordinates(index) {
        return { x: index % this.columns, y: Math.floor(index / this.columns) };
    }

    isInside(column, row) {
        return column >= 0 && column < this.columns && row >= 0 && row < this.rows;
    }

    cellAt(column, row) {
        if (!this.isInside(column, row)) return TERRITORY_CELL.LAND;
        return this.cells[this.index(column, row)];
    }

    newGame() {
        this.stage = 1;
        this.lives = this.initialLives;
        this.score = 0;
        this.resetStage();
    }

    resetStage() {
        this.cells = new Uint8Array(this.size);
        for (let column = 0; column < this.columns; column += 1) {
            this.cells[this.index(column, 0)] = TERRITORY_CELL.LAND;
            this.cells[this.index(column, this.rows - 1)] = TERRITORY_CELL.LAND;
        }
        for (let row = 0; row < this.rows; row += 1) {
            this.cells[this.index(0, row)] = TERRITORY_CELL.LAND;
            this.cells[this.index(this.columns - 1, row)] = TERRITORY_CELL.LAND;
        }

        this.player = { x: Math.floor(this.columns / 2), y: this.rows - 1 };
        this.direction = null;
        this.pendingDirection = null;
        this.armed = false;
        this.drawing = false;
        this.trail = new Set();
        this.status = TERRITORY_STATUS.RUNNING;
        this.respawnTicks = 0;
        this.ticks = 0;
        this.spawnEnemies();
    }

    spawnEnemies() {
        const count = Math.min(5, 1 + Math.floor((this.stage - 1) / 2));
        this.enemies = [];
        for (let index = 0; index < count; index += 1) {
            const x = 2 + this.random() * Math.max(1, this.columns - 5);
            const y = 2 + this.random() * Math.max(1, this.rows - 5);
            const angle = this.random() * Math.PI * 2;
            const speed = Math.min(0.32, 0.16 + this.stage * 0.012 + index * 0.008);
            this.enemies.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 0.38 + this.random() * 0.12,
                hue: Math.floor(this.random() * 360),
            });
        }
    }

    setDirection(direction) {
        if (!TERRITORY_DIRECTIONS[direction] || this.status !== TERRITORY_STATUS.RUNNING) return false;
        const current = this.pendingDirection ?? this.direction;
        if (this.drawing && isOpposite(current, direction)) return false;
        this.pendingDirection = direction;
        return true;
    }

    toggleArmed() {
        if (this.status !== TERRITORY_STATUS.RUNNING || this.drawing) return false;
        if (this.cellAt(this.player.x, this.player.y) !== TERRITORY_CELL.LAND) return false;
        this.armed = !this.armed;
        return true;
    }

    tick() {
        if (this.status !== TERRITORY_STATUS.RUNNING) return false;
        this.ticks += 1;
        if (this.respawnTicks > 0) {
            this.respawnTicks -= 1;
            return true;
        }
        this.stepPlayer();
        if (this.status !== TERRITORY_STATUS.RUNNING) return true;
        this.stepEnemies();
        return true;
    }

    stepPlayer() {
        if (this.pendingDirection) {
            if (!this.drawing || !isOpposite(this.direction, this.pendingDirection)) {
                this.direction = this.pendingDirection;
            }
            this.pendingDirection = null;
        }
        if (!this.direction) return false;

        const vector = TERRITORY_DIRECTIONS[this.direction];
        const nextX = this.player.x + vector.x;
        const nextY = this.player.y + vector.y;
        if (!this.isInside(nextX, nextY)) return false;

        const nextIndex = this.index(nextX, nextY);
        const nextCell = this.cells[nextIndex];

        if (this.drawing) {
            if (nextCell === TERRITORY_CELL.TRAIL || this.enemyOccupiesCell(nextX, nextY)) {
                this.loseLife();
                return true;
            }
            this.player.x = nextX;
            this.player.y = nextY;
            if (nextCell === TERRITORY_CELL.LAND) {
                this.drawing = false;
                this.armed = false;
                this.completeCapture();
            } else {
                this.cells[nextIndex] = TERRITORY_CELL.TRAIL;
                this.trail.add(nextIndex);
            }
            return true;
        }

        if (nextCell === TERRITORY_CELL.LAND) {
            this.player.x = nextX;
            this.player.y = nextY;
            return true;
        }

        if (nextCell === TERRITORY_CELL.EMPTY && this.armed) {
            if (this.enemyOccupiesCell(nextX, nextY)) {
                this.loseLife();
                return true;
            }
            this.player.x = nextX;
            this.player.y = nextY;
            this.drawing = true;
            this.cells[nextIndex] = TERRITORY_CELL.TRAIL;
            this.trail.add(nextIndex);
            return true;
        }

        return false;
    }

    enemyOccupiesCell(column, row) {
        return this.enemies.some(enemy => Math.floor(enemy.x) === column && Math.floor(enemy.y) === row);
    }

    stepEnemies() {
        for (const enemy of this.enemies) {
            const distance = Math.max(Math.abs(enemy.vx), Math.abs(enemy.vy));
            const segments = Math.max(1, Math.ceil(distance / 0.08));
            for (let segment = 0; segment < segments; segment += 1) {
                const stepX = enemy.vx / segments;
                const stepY = enemy.vy / segments;
                const nextX = enemy.x + stepX;
                const nextY = enemy.y + stepY;

                if (this.isEnemyBlocked(nextX, enemy.y)) enemy.vx *= -1;
                else enemy.x = nextX;
                if (this.isEnemyBlocked(enemy.x, nextY)) enemy.vy *= -1;
                else enemy.y = nextY;

                const cell = this.cellAt(Math.floor(enemy.x), Math.floor(enemy.y));
                if (cell === TERRITORY_CELL.TRAIL) {
                    this.loseLife();
                    return;
                }
            }
        }
    }

    isEnemyBlocked(x, y) {
        const column = Math.floor(x);
        const row = Math.floor(y);
        return !this.isInside(column, row) || this.cellAt(column, row) === TERRITORY_CELL.LAND;
    }

    completeCapture() {
        const before = this.captureRatio;
        for (const index of this.trail) this.cells[index] = TERRITORY_CELL.LAND;
        this.trail.clear();

        const reachable = new Uint8Array(this.size);
        const queue = [];
        for (const enemy of this.enemies) {
            const column = Math.floor(enemy.x);
            const row = Math.floor(enemy.y);
            const index = this.index(column, row);
            if (this.cells[index] === TERRITORY_CELL.EMPTY && !reachable[index]) {
                reachable[index] = 1;
                queue.push(index);
            }
        }

        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const index = queue[cursor];
            const { x, y } = this.coordinates(index);
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            for (const [nextX, nextY] of neighbors) {
                if (!this.isInside(nextX, nextY)) continue;
                const nextIndex = this.index(nextX, nextY);
                if (reachable[nextIndex] || this.cells[nextIndex] !== TERRITORY_CELL.EMPTY) continue;
                reachable[nextIndex] = 1;
                queue.push(nextIndex);
            }
        }

        for (let row = 1; row < this.rows - 1; row += 1) {
            for (let column = 1; column < this.columns - 1; column += 1) {
                const index = this.index(column, row);
                if (this.cells[index] === TERRITORY_CELL.EMPTY && !reachable[index]) {
                    this.cells[index] = TERRITORY_CELL.LAND;
                }
            }
        }

        const gained = Math.max(0, Math.round((this.captureRatio - before) * this.interiorSize));
        this.score += gained * 10 * this.stage;
        if (this.captureRatio >= this.targetRatio) {
            this.status = TERRITORY_STATUS.STAGE_CLEAR;
            this.score += 1000 * this.stage;
            this.direction = null;
        }
    }

    loseLife() {
        if (this.status !== TERRITORY_STATUS.RUNNING || this.respawnTicks > 0) return false;
        this.lives -= 1;
        for (const index of this.trail) this.cells[index] = TERRITORY_CELL.EMPTY;
        this.trail.clear();
        this.drawing = false;
        this.armed = false;
        this.direction = null;
        this.pendingDirection = null;
        this.player = { x: Math.floor(this.columns / 2), y: this.rows - 1 };
        if (this.lives <= 0) {
            this.status = TERRITORY_STATUS.GAME_OVER;
        } else {
            this.respawnTicks = 18;
        }
        return true;
    }

    nextStage() {
        if (this.status !== TERRITORY_STATUS.STAGE_CLEAR) return false;
        this.stage += 1;
        this.lives = Math.min(5, this.lives + 1);
        this.resetStage();
        return true;
    }
}
