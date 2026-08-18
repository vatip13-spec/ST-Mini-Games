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

        const cards = this.stock.splice(0, 10);
        cards.forEach((card, column) => {
            card.faceUp = true;
            this.tableau[column].push(card);
        });
        this.moves += 1;
        this.removeCompletedRuns();
        return true;
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
}
