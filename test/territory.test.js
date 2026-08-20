import assert from 'node:assert/strict';
import test from 'node:test';
import {
    TERRITORY_CELL,
    TERRITORY_STATUS,
    TerritoryGame,
} from '../games/territory-engine.js';

function stationaryEnemy(x, y) {
    return { x, y, vx: 0, vy: 0, radius: 0.4, hue: 0 };
}

test('a new territory board starts with a safe outer border', () => {
    const game = new TerritoryGame({ rows: 10, columns: 12, random: () => 0.5 });
    for (let column = 0; column < game.columns; column += 1) {
        assert.equal(game.cellAt(column, 0), TERRITORY_CELL.LAND);
        assert.equal(game.cellAt(column, game.rows - 1), TERRITORY_CELL.LAND);
    }
    assert.equal(game.cellAt(1, 1), TERRITORY_CELL.EMPTY);
    assert.equal(game.capturePercent, 0);
});

test('the player cannot leave safe land until drawing is armed', () => {
    const game = new TerritoryGame({ rows: 8, columns: 8, random: () => 0.5 });
    game.enemies = [stationaryEnemy(1.5, 1.5)];
    game.setDirection('up');
    game.tick();
    assert.deepEqual(game.player, { x: 4, y: 7 });
    assert.equal(game.drawing, false);

    game.toggleArmed();
    game.tick();
    assert.deepEqual(game.player, { x: 4, y: 6 });
    assert.equal(game.drawing, true);
    assert.equal(game.cellAt(4, 6), TERRITORY_CELL.TRAIL);
});

test('closing a trail fills only the region without an enemy', () => {
    const game = new TerritoryGame({ rows: 8, columns: 8, random: () => 0.5, targetRatio: 0.99 });
    game.enemies = [stationaryEnemy(1.5, 3.5)];
    game.toggleArmed();
    game.setDirection('up');
    for (let step = 0; step < 7; step += 1) game.tick();

    assert.equal(game.drawing, false);
    assert.equal(game.cellAt(1, 3), TERRITORY_CELL.EMPTY);
    assert.equal(game.cellAt(6, 3), TERRITORY_CELL.LAND);
    assert.ok(game.captureRatio > 0.3);
});

test('an enemy touching an active trail costs one life and clears the trail', () => {
    const game = new TerritoryGame({ rows: 8, columns: 8, random: () => 0.5 });
    const trailIndex = game.index(4, 5);
    game.cells[trailIndex] = TERRITORY_CELL.TRAIL;
    game.trail.add(trailIndex);
    game.drawing = true;
    game.player = { x: 4, y: 5 };
    game.enemies = [stationaryEnemy(4.2, 5.2)];

    game.tick();
    assert.equal(game.lives, 2);
    assert.equal(game.cellAt(4, 5), TERRITORY_CELL.EMPTY);
    assert.equal(game.drawing, false);
});

test('crossing the active trail costs one life', () => {
    const game = new TerritoryGame({ rows: 8, columns: 8, random: () => 0.5 });
    game.enemies = [stationaryEnemy(1.5, 1.5)];
    game.player = { x: 4, y: 4 };
    game.direction = 'left';
    game.drawing = true;
    const trailIndex = game.index(3, 4);
    game.cells[trailIndex] = TERRITORY_CELL.TRAIL;
    game.trail.add(trailIndex);

    game.tick();
    assert.equal(game.lives, 2);
    assert.deepEqual(game.player, { x: 4, y: 7 });
});

test('reaching the target clears the stage and the next stage preserves progress', () => {
    const game = new TerritoryGame({ rows: 8, columns: 8, random: () => 0.5, targetRatio: 0.3 });
    game.enemies = [stationaryEnemy(1.5, 3.5)];
    game.toggleArmed();
    game.setDirection('up');
    for (let step = 0; step < 7; step += 1) game.tick();

    assert.equal(game.status, TERRITORY_STATUS.STAGE_CLEAR);
    const score = game.score;
    assert.equal(game.nextStage(), true);
    assert.equal(game.stage, 2);
    assert.equal(game.status, TERRITORY_STATUS.RUNNING);
    assert.ok(game.score >= score);
});
