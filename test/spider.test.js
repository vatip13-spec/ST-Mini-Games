import assert from 'node:assert/strict';
import test from 'node:test';
import { SPIDER_STATUS, SpiderGame } from '../games/spider-engine.js';

test('a new one-suit game deals 54 tableau cards and keeps five stock deals', () => {
    const game = new SpiderGame(() => 0.42);
    assert.deepEqual(game.tableau.map(column => column.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    assert.equal(game.stock.length, 50);
    assert.equal(game.remainingDeals, 5);
    assert.equal(game.tableau.every(column => column.at(-1).faceUp), true);
});

test('a descending face-up sequence can move onto the next rank', () => {
    const game = new SpiderGame(() => 0.2);
    game.tableau = [
        [{ id: 'a', rank: 8, faceUp: true }, { id: 'b', rank: 7, faceUp: true }],
        [{ id: 'c', rank: 9, faceUp: true }],
        [], [], [], [], [], [], [], [],
    ];
    assert.equal(game.move(0, 0, 1), true);
    assert.deepEqual(game.tableau[1].map(card => card.rank), [9, 8, 7]);
});

test('a stock row cannot be dealt while any tableau column is empty', () => {
    const game = new SpiderGame(() => 0.1);
    game.tableau[0] = [];
    assert.equal(game.canDeal(), false);
    assert.equal(game.deal(), false);
    assert.equal(game.stock.length, 50);
});

test('a complete king-to-ace run is removed automatically', () => {
    const game = new SpiderGame(() => 0.3);
    game.tableau = Array.from({ length: 10 }, (_, index) => [{ id: `column-${index}`, rank: 5, faceUp: true }]);
    game.tableau[0] = Array.from({ length: 13 }, (_, index) => ({ id: `run-${index}`, rank: 13 - index, faceUp: true }));
    assert.equal(game.removeCompletedRuns(), true);
    assert.equal(game.tableau[0].length, 0);
    assert.equal(game.completed, 1);
});

test('removing eight runs wins the game', () => {
    const game = new SpiderGame(() => 0.4);
    game.tableau = Array.from({ length: 10 }, () => []);
    game.completed = 7;
    game.tableau[0] = Array.from({ length: 13 }, (_, index) => ({ id: `last-${index}`, rank: 13 - index, faceUp: true }));
    game.removeCompletedRuns();
    assert.equal(game.status, SPIDER_STATUS.WON);
});
