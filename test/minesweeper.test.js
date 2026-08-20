import assert from 'node:assert/strict';
import test from 'node:test';
import { CELL_STATE, GAME_STATUS, MinesweeperGame } from '../games/minesweeper-engine.js';

test('the first revealed cell is always safe and the mine count is exact', () => {
    const game = new MinesweeperGame(9, 9, 10, () => 0.25);
    game.reveal(40);
    assert.notEqual(game.values[40], -1);
    assert.equal([...game.values].filter(value => value === -1).length, 10);
    assert.equal(game.status === GAME_STATUS.RUNNING || game.status === GAME_STATUS.WON, true);
});

test('flagging is reversible and does not open the cell', () => {
    const game = new MinesweeperGame(9, 9, 10);
    assert.equal(game.toggleFlag(4), true);
    assert.equal(game.states[4], CELL_STATE.FLAGGED);
    assert.equal(game.flaggedCount, 1);
    assert.equal(game.reveal(4), false);
    assert.equal(game.toggleFlag(4), true);
    assert.equal(game.states[4], CELL_STATE.CLOSED);
    assert.equal(game.flaggedCount, 0);
});

test('revealing a mine ends the game', () => {
    const game = new MinesweeperGame(3, 3, 1, () => 0);
    game.reveal(4);
    const mine = [...game.values].findIndex(value => value === -1);
    assert.notEqual(mine, 4);
    game.reveal(mine);
    assert.equal(game.status, GAME_STATUS.LOST);
    assert.equal(game.explodedIndex, mine);
});

test('opening every safe cell wins and flags the remaining mines', () => {
    const game = new MinesweeperGame(3, 3, 1, () => 0);
    game.reveal(0);
    for (let index = 0; index < game.size && game.status !== GAME_STATUS.WON; index += 1) {
        if (game.values[index] !== -1) game.reveal(index);
    }
    assert.equal(game.status, GAME_STATUS.WON);
    assert.equal(game.flaggedCount, 1);
});

test('zero cells flood-open their safe area', () => {
    const game = new MinesweeperGame(5, 5, 1, () => 0);
    game.reveal(0);
    assert.ok(game.openedCount > 1);
    assert.notEqual(game.status, GAME_STATUS.LOST);
});

test('every numbered cell matches its adjacent mine count', () => {
    const game = new MinesweeperGame(9, 9, 10, () => 0.42);
    game.reveal(40);
    for (let index = 0; index < game.size; index += 1) {
        if (game.values[index] === -1) continue;
        const adjacentMines = game.neighborsOf(index).filter(neighbor => game.values[neighbor] === -1).length;
        assert.equal(game.values[index], adjacentMines);
    }
});

test('chording an open number reveals all closed neighbors when flags match', () => {
    const game = new MinesweeperGame(3, 3, 1);
    game.values = Int8Array.from([
        0, 0, 0,
        0, 1, 1,
        0, 1, -1,
    ]);
    game.states[4] = CELL_STATE.OPEN;
    game.states[8] = CELL_STATE.FLAGGED;
    game.minesPlaced = true;
    game.status = GAME_STATUS.RUNNING;
    game.openedCount = 1;
    game.flaggedCount = 1;

    assert.equal(game.chord(4), true);
    assert.equal(game.status, GAME_STATUS.WON);
    assert.equal(game.openedCount, 8);
});

test('chording with a wrong flag explodes the unflagged mine', () => {
    const game = new MinesweeperGame(3, 3, 1);
    game.values = Int8Array.from([
        0, 0, 0,
        0, 1, 1,
        0, 1, -1,
    ]);
    game.states[4] = CELL_STATE.OPEN;
    game.states[0] = CELL_STATE.FLAGGED;
    game.minesPlaced = true;
    game.status = GAME_STATUS.RUNNING;
    game.openedCount = 1;
    game.flaggedCount = 1;

    assert.equal(game.chord(4), true);
    assert.equal(game.status, GAME_STATUS.LOST);
    assert.equal(game.explodedIndex, 8);
    assert.equal(game.states[8], CELL_STATE.OPEN);
});
