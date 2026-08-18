export const SPIDER_STATUS = Object.freeze({
    RUNNING: 'running',
    WON: 'won',
});

export class SpiderGame {
    constructor(random = Math.random) {
        this.random = random;
        this.reset();
    }

    reset() {
        const deck = this.createDeck();
        this.shuffle(deck);

        this.tableau = Array.from({ length: 10 }, () => []);
        this.completed = 0;
        this.moves = 0;
        this.status = SPIDER_STATUS.RUNNING;
        this.history = [];

        for (let column = 0; column < 10; column += 1) {
            const count = column < 4 ? 6 : 5;
            for (let index = 0; index < count; index += 1) {
                const card = deck.shift();
                card.faceUp = index === count - 1;
                this.tableau[column].push(card);
            }
        }

        this.stock = deck;
    }

    createDeck() {
        const deck = [];
        let id = 0;
        for (let set = 0; set < 8; set += 1) {
            for (let rank = 1; rank <= 13; rank += 1) {
                deck.push({ id: `spider-${id}`, rank, faceUp: false });
                id += 1;
            }
        }
        return deck;
    }

    shuffle(deck) {
        for (let index = deck.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(this.random() * (index + 1));
            [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
        }
    }

    isMovableSequence(columnIndex, cardIndex) {
        const column = this.tableau[columnIndex];
        if (!column || cardIndex < 0 || cardIndex >= column.length || !column[cardIndex].faceUp) return false;

        for (let index = cardIndex; index < column.length - 1; index += 1) {
            if (!column[index + 1].faceUp || column[index].rank !== column[index + 1].rank + 1) return false;
        }
        return true;
    }

    canMove(sourceColumn, cardIndex, targetColumn) {
        if (this.status === SPIDER_STATUS.WON || sourceColumn === targetColumn) return false;
        if (!this.isMovableSequence(sourceColumn, cardIndex)) return false;

        const target = this.tableau[targetColumn];
        if (!target) return false;
        if (target.length === 0) return true;

        const movingCard = this.tableau[sourceColumn][cardIndex];
        const targetCard = target[target.length - 1];
        return targetCard.faceUp && targetCard.rank === movingCard.rank + 1;
    }

    move(sourceColumn, cardIndex, targetColumn) {
        if (!this.canMove(sourceColumn, cardIndex, targetColumn)) return false;

        this.history.push(this.createSnapshot());
        const movingCards = this.tableau[sourceColumn].splice(cardIndex);
        this.tableau[targetColumn].push(...movingCards);
        this.flipExposedCard(sourceColumn);
        this.moves += 1;
        this.removeCompletedRuns();
        return true;
    }

    canDeal() {
        return this.status !== SPIDER_STATUS.WON
            && this.stock.length >= 10
            && this.tableau.every(column => column.length > 0);
    }

    deal() {
        if (!this.canDeal()) return false;

        this.history.push(this.createSnapshot());
        const cards = this.stock.splice(0, 10);
        cards.forEach((card, column) => {
            card.faceUp = true;
            this.tableau[column].push(card);
        });
        this.moves += 1;
        this.removeCompletedRuns();
        return true;
    }

    createSnapshot() {
        return {
            tableau: this.tableau.map(column => column.map(card => ({ ...card }))),
            stock: this.stock.map(card => ({ ...card })),
            completed: this.completed,
            moves: this.moves,
            status: this.status,
        };
    }

    undo() {
        const snapshot = this.history.pop();
        if (!snapshot) return false;

        this.tableau = snapshot.tableau.map(column => column.map(card => ({ ...card })));
        this.stock = snapshot.stock.map(card => ({ ...card }));
        this.completed = snapshot.completed;
        this.moves = snapshot.moves;
        this.status = snapshot.status;
        return true;
    }

    getHint() {
        if (this.status === SPIDER_STATUS.WON) return null;
        const candidates = [];

        for (let sourceColumn = 0; sourceColumn < this.tableau.length; sourceColumn += 1) {
            const source = this.tableau[sourceColumn];
            for (let cardIndex = 0; cardIndex < source.length; cardIndex += 1) {
                if (!this.isMovableSequence(sourceColumn, cardIndex)) continue;

                for (let targetColumn = 0; targetColumn < this.tableau.length; targetColumn += 1) {
                    if (!this.canMove(sourceColumn, cardIndex, targetColumn)) continue;
                    const target = this.tableau[targetColumn];
                    if (target.length === 0 && cardIndex === 0) continue;

                    const moving = source.slice(cardIndex);
                    let score = moving.length;
                    if (source[cardIndex - 1] && !source[cardIndex - 1].faceUp) score += 1000;
                    if (target.length > 0) score += 100;
                    else score -= 20;
                    if (this.wouldCompleteRun(target, moving)) score += 2000;

                    candidates.push({ type: 'move', sourceColumn, cardIndex, targetColumn, score });
                }
            }
        }

        if (candidates.length > 0) {
            candidates.sort((left, right) => right.score - left.score);
            const { score: _score, ...hint } = candidates[0];
            return hint;
        }
        if (this.canDeal()) return { type: 'deal' };
        return null;
    }

    wouldCompleteRun(target, moving) {
        const combined = target.concat(moving);
        if (combined.length < 13) return false;
        return combined.slice(-13).every((card, index) => card.faceUp && card.rank === 13 - index);
    }

    flipExposedCard(columnIndex) {
        const column = this.tableau[columnIndex];
        const card = column?.[column.length - 1];
        if (card) card.faceUp = true;
    }

    removeCompletedRuns() {
        let removedAny = false;
        let foundRun = true;

        while (foundRun) {
            foundRun = false;
            for (let columnIndex = 0; columnIndex < this.tableau.length; columnIndex += 1) {
                const column = this.tableau[columnIndex];
                if (column.length < 13) continue;
                const run = column.slice(-13);
                const complete = run.every((card, index) => card.faceUp && card.rank === 13 - index);
                if (!complete) continue;

                column.splice(-13);
                this.completed += 1;
                this.flipExposedCard(columnIndex);
                removedAny = true;
                foundRun = true;
            }
        }

        if (this.completed === 8) this.status = SPIDER_STATUS.WON;
        return removedAny;
    }

    get remainingDeals() {
        return Math.floor(this.stock.length / 10);
    }

    get canUndo() {
        return this.history.length > 0;
    }
}
