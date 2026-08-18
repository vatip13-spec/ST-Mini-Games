export const GAME_STATUS = Object.freeze({
    READY: 'ready',
    RUNNING: 'running',
    WON: 'won',
    LOST: 'lost',
});

export const CELL_STATE = Object.freeze({
    CLOSED: 0,
    OPEN: 1,
    FLAGGED: 2,
});

export class MinesweeperGame {
    constructor(rows, columns, mineCount, random = Math.random) {
        if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
            throw new TypeError('Rows and columns must be positive integers.');
        }
        if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount >= rows * columns) {
            throw new RangeError('Mine count must fit inside the board.');
        }

        this.rows = rows;
        this.columns = columns;
        this.mineCount = mineCount;
        this.random = random;
        this.reset();
    }

    reset() {
        const size = this.rows * this.columns;
        this.values = new Int8Array(size);
        this.states = new Uint8Array(size);
        this.status = GAME_STATUS.READY;
        this.explodedIndex = -1;
        this.openedCount = 0;
        this.flaggedCount = 0;
        this.minesPlaced = false;
    }

    get size() {
        return this.rows * this.columns;
    }

    isValidIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < this.size;
    }

    neighborsOf(index) {
        const row = Math.floor(index / this.columns);
        const column = index % this.columns;
        const neighbors = [];

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
            for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
                if (rowOffset === 0 && columnOffset === 0) continue;
                const neighborRow = row + rowOffset;
                const neighborColumn = column + columnOffset;
                if (neighborRow < 0 || neighborRow >= this.rows || neighborColumn < 0 || neighborColumn >= this.columns) continue;
                neighbors.push(neighborRow * this.columns + neighborColumn);
            }
        }

        return neighbors;
    }

    placeMines(firstIndex) {
        if (this.minesPlaced) return;

        const candidates = [];
        for (let index = 0; index < this.size; index += 1) {
            if (index !== firstIndex) candidates.push(index);
        }

        for (let index = candidates.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(this.random() * (index + 1));
            [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
        }

        for (const mineIndex of candidates.slice(0, this.mineCount)) {
            this.values[mineIndex] = -1;
        }

        for (let index = 0; index < this.size; index += 1) {
            if (this.values[index] === -1) continue;
            this.values[index] = this.neighborsOf(index).filter(neighbor => this.values[neighbor] === -1).length;
        }

        this.minesPlaced = true;
    }

    toggleFlag(index) {
        if (!this.isValidIndex(index) || this.status === GAME_STATUS.WON || this.status === GAME_STATUS.LOST) return false;
        if (this.states[index] === CELL_STATE.OPEN) return false;

        if (this.states[index] === CELL_STATE.FLAGGED) {
            this.states[index] = CELL_STATE.CLOSED;
            this.flaggedCount -= 1;
        } else {
            this.states[index] = CELL_STATE.FLAGGED;
            this.flaggedCount += 1;
        }
        return true;
    }

    reveal(index) {
        if (!this.isValidIndex(index) || this.status === GAME_STATUS.WON || this.status === GAME_STATUS.LOST) return false;

        if (this.states[index] === CELL_STATE.FLAGGED) return false;
        if (this.states[index] === CELL_STATE.OPEN) return this.chord(index);

        if (!this.minesPlaced) {
            this.placeMines(index);
            this.status = GAME_STATUS.RUNNING;
        }

        if (this.values[index] === -1) {
            this.states[index] = CELL_STATE.OPEN;
            this.explodedIndex = index;
            this.status = GAME_STATUS.LOST;
            return true;
        }

        this.openArea(index);
        this.checkWin();
        return true;
    }

    openArea(startIndex) {
        const queue = [startIndex];
        const queued = new Set(queue);

        while (queue.length > 0) {
            const index = queue.shift();
            if (this.states[index] !== CELL_STATE.CLOSED || this.values[index] === -1) continue;

            this.states[index] = CELL_STATE.OPEN;
            this.openedCount += 1;

            if (this.values[index] !== 0) continue;
            for (const neighbor of this.neighborsOf(index)) {
                if (this.states[neighbor] === CELL_STATE.CLOSED && this.values[neighbor] !== -1 && !queued.has(neighbor)) {
                    queue.push(neighbor);
                    queued.add(neighbor);
                }
            }
        }
    }

    chord(index) {
        if (this.states[index] !== CELL_STATE.OPEN || this.values[index] <= 0) return false;
        const neighbors = this.neighborsOf(index);
        const adjacentFlags = neighbors.filter(neighbor => this.states[neighbor] === CELL_STATE.FLAGGED).length;
        if (adjacentFlags !== this.values[index]) return false;

        let changed = false;
        for (const neighbor of neighbors) {
            if (this.states[neighbor] !== CELL_STATE.CLOSED) continue;
            changed = true;
            if (this.values[neighbor] === -1) {
                this.states[neighbor] = CELL_STATE.OPEN;
                this.explodedIndex = neighbor;
                this.status = GAME_STATUS.LOST;
                return true;
            }
            this.openArea(neighbor);
        }

        this.checkWin();
        return changed;
    }

    checkWin() {
        if (this.openedCount !== this.size - this.mineCount) return false;
        this.status = GAME_STATUS.WON;
        for (let index = 0; index < this.size; index += 1) {
            if (this.values[index] === -1 && this.states[index] === CELL_STATE.CLOSED) {
                this.states[index] = CELL_STATE.FLAGGED;
            }
        }
        this.flaggedCount = this.mineCount;
        return true;
    }
}
