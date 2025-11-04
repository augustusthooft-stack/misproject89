// Blackjack game (frontend only)
// Model: single deck(s) shuffled, basic actions: bet, deal, hit, stand, double, split (single split).
// Author: ChatGPT — demo implementation

(() => {
    // DOM elements
    const balanceEl = document.getElementById('balance');
    const betInput = document.getElementById('bet-amount');
    const dealBtn = document.getElementById('deal-btn');
    const hitBtn = document.getElementById('hit-btn');
    const standBtn = document.getElementById('stand-btn');
    const doubleBtn = document.getElementById('double-btn');
    const splitBtn = document.getElementById('split-btn');
    const newRoundBtn = document.getElementById('new-round-btn');
    const messages = document.getElementById('messages');

    const dealerCardsEl = document.getElementById('dealer-cards');
    const dealerValueEl = document.getElementById('dealer-value');

    const playerCardsEls = [
        document.getElementById('player-cards-0'),
        document.getElementById('player-cards-1')
    ];
    const playerValueEls = [
        document.getElementById('player-value-0'),
        document.getElementById('player-value-1')
    ];
    const handBlocks = [
        document.getElementById('hand-0-block'),
        document.getElementById('hand-1-block')
    ];

    const chipButtons = document.querySelectorAll('.chip');

    // Game state
    let balance = 1000;
    let bet = 10;
    let deck = [];
    let dealer = { cards: [] };
    let playerHands = []; // array of hands: { cards: [], bet, finished, doubled }
    let currentHandIndex = 0;
    let roundActive = false;
    let deckCount = 6; // 6 decks for fuller play (optional)
    
    // Utilities: create deck
    const SUITS = ['♠','♥','♦','♣'];
    const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

    function createDeck(decks = 6) {
        const d = [];
        for (let k = 0; k < decks; k++) {
            for (const s of SUITS) {
                for (const r of RANKS) {
                    d.push({ suit: s, rank: r });
                }
            }
        }
        return d;
    }

    function shuffle(a) {
        // Fisher-Yates
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
    }

    function resetDeckIfNeeded() {
        if (deck.length < 52) {
            deck = createDeck(deckCount);
            shuffle(deck);
        }
    }

    function drawCard() {
        resetDeckIfNeeded();
        return deck.pop();
    }

    function cardValue(card) {
        const r = card.rank;
        if (r === 'A') return 11;
        if (['K','Q','J'].includes(r)) return 10;
        return parseInt(r, 10);
    }

    function evaluateHand(cards) {
        // returns {value: bestValue <=21 ? bestValue : minValue, soft: boolean}
        let total = 0;
        let aces = 0;
        for (const c of cards) {
            if (c.rank === 'A') aces++;
            total += cardValue(c);
        }
        // reduce aces from 11 to 1 as needed
        while (total > 21 && aces > 0) {
            total -= 10;
            aces -= 1;
        }
        const soft = cards.some(c => c.rank === 'A') && total <= 21 && cards.some(c => cardValue(c) === 11);
        return { value: total, soft: soft };
    }

    function isBlackjack(cards) {
        return cards.length === 2 && evaluateHand(cards).value === 21;
    }

    // UI helpers
    function renderCard(card, faceDown=false) {
        const el = document.createElement('div');
        el.className = 'card' + (faceDown ? ' face-down' : '');
        if (faceDown) {
            el.innerHTML = `<div class="top">?</div><div class="center">?</div><div class="bottom">?</div>`;
            return el;
        }
        const color = (card.suit === '♥' || card.suit === '♦') ? 'red' : 'black';
        el.style.color = color === 'red' ? '#b71c1c' : '#111';
        el.innerHTML = `<div class="top">${card.rank}${card.suit}</div><div class="center">${card.suit}</div><div class="bottom">${card.rank}${card.suit}</div>`;
        return el;
    }

    function flashMessage(txt, timeout = 3000) {
        messages.textContent = txt;
        if (timeout) setTimeout(()=>{ if (messages.textContent === txt) messages.textContent = ''; }, timeout);
    }

    function updateBalanceUI() {
        balanceEl.textContent = balance.toFixed(2).replace(/\.00$/, '');
    }

    function clearTable() {
        dealerCardsEl.innerHTML = '';
        dealerValueEl.textContent = '';
        for (let i=0;i<2;i++){
            playerCardsEls[i].innerHTML = '';
            playerValueEls[i].textContent = '';
            handBlocks[i].classList.add('hidden');
        }
    }

    // Buttons state
    function enableActionButtons() {
        hitBtn.disabled = false;
        standBtn.disabled = false;
        doubleBtn.disabled = false;
        // split only when first two cards are pair and balance allows
        if (playerHands.length === 1 && playerHands[0].cards.length === 2) {
            const a = playerHands[0].cards[0].rank, b = playerHands[0].cards[1].rank;
            const canSplit = (a === b) && (balance >= playerHands[0].bet);
            splitBtn.disabled = !canSplit;
        } else {
            splitBtn.disabled = true;
        }
    }

    function disableActionButtons() {
        hitBtn.disabled = true;
        standBtn.disabled = true;
        doubleBtn.disabled = true;
        splitBtn.disabled = true;
    }

    // Game flow
    function startDeal() {
        bet = Math.max(1, Math.floor(Number(betInput.value) || 1));
        if (bet > balance) {
            flashMessage('Bet exceeds balance');
            return;
        }
        // subtract bet immediately (keeps simple)
        balance -= bet;
        updateBalanceUI();

        // prepare state
        deck = deck.length ? deck : createDeck(deckCount);
        shuffle(deck);
        dealer = { cards: [] };
        playerHands = [];
        playerHands.push({ cards: [], bet: bet, finished: false, doubled: false });
        currentHandIndex = 0;
        roundActive = true;

        clearTable();

        // initial draw
        // player 2 cards
        playerHands[0].cards.push(drawCard());
        playerHands[0].cards.push(drawCard());
        // dealer 2 cards (one face down)
        dealer.cards.push(drawCard());
        dealer.cards.push(drawCard());

        // render
        renderAll();

        // check for immediate blackjacks
        const playerBJ = isBlackjack(playerHands[0].cards);
        const dealerBJ = isBlackjack(dealer.cards);
        disableActionButtons();
        if (playerBJ || dealerBJ) {
            // reveal dealer and settle
            revealDealer();
            setTimeout(()=> {
                settleRoundImmediate(playerBJ, dealerBJ);
            }, 700);
        } else {
            enableActionButtons();
            // double allowed only now (first two cards)
            doubleBtn.disabled = !(balance >= bet);
            // split button enabled check handled in enableActionButtons
            flashMessage('Your move');
        }

        dealBtn.disabled = true;
        newRoundBtn.disabled = true;
    }

    function revealDealer() {
        dealerCardsEl.innerHTML = '';
        for (const c of dealer.cards) {
            const el = renderCard(c, false);
            dealerCardsEl.appendChild(el);
            // small reveal animation
            requestAnimationFrame(()=>el.classList.add('reveal'));
        }
        const val = evaluateHand(dealer.cards);
        dealerValueEl.textContent = `Value: ${val.value}` + (val.soft ? ' (soft)' : '');
    }

    function renderAll() {
        // dealer: show first card and keep second face down until reveal
        dealerCardsEl.innerHTML = '';
        for (let i=0;i<dealer.cards.length;i++) {
            const faceDown = (i === 1 && roundActive && !isBlackjack(dealer.cards));
            const el = renderCard(dealer.cards[i], faceDown);
            dealerCardsEl.appendChild(el);
            if (!faceDown) requestAnimationFrame(()=>el.classList.add('reveal'));
        }
        if (!roundActive) {
            const val = evaluateHand(dealer.cards);
            dealerValueEl.textContent = `Value: ${val.value}` + (val.soft ? ' (soft)' : '');
        } else {
            // show visible value (only first card)
            const first = [dealer.cards[0]];
            const v = evaluateHand(first);
            dealerValueEl.textContent = `Showing: ${v.value}`;
        }

        // player hands
        for (let i=0;i<playerHands.length;i++) {
            const hb = playerHands[i];
            handBlocks[i].classList.remove('hidden');
            playerCardsEls[i].innerHTML = '';
            for (const c of hb.cards) {
                const el = renderCard(c, false);
                playerCardsEls[i].appendChild(el);
                requestAnimationFrame(()=>el.classList.add('reveal'));
            }
            const val = evaluateHand(hb.cards);
            playerValueEls[i].textContent = `Value: ${val.value}` + (val.soft ? ' (soft)' : '') + (hb.doubled ? ' — Doubled' : '');
        }
    }

    function settleRoundImmediate(playerBJ, dealerBJ) {
        revealDealer();
        let resultText = '';
        if (playerBJ && dealerBJ) {
            // push
            resultText = 'Both have Blackjack — Push. Bet returned.';
            balance += bet;
        } else if (playerBJ) {
            resultText = 'Blackjack! You win 3:2.';
            balance += bet + (bet * 1.5); // bet already removed, add original bet + 1.5*bet
        } else if (dealerBJ) {
            resultText = 'Dealer has Blackjack. You lose.';
            // nothing to add
        }
        updateBalanceUI();
        roundActive = false;
        disableActionButtons();
        dealBtn.disabled = false;
        newRoundBtn.disabled = false;
        flashMessage(resultText, 6000);
    }

    function playerHit() {
        const hand = playerHands[currentHandIndex];
        if (!hand || hand.finished) return;
        hand.cards.push(drawCard());
        renderAll();

        const v = evaluateHand(hand.cards).value;
        if (v > 21) {
            hand.finished = true;
            flashMessage(`Busted on hand ${currentHandIndex+1}`);
            nextHandOrDealer();
        } else {
            // still playable; double no longer allowed after hit
            doubleBtn.disabled = true;
        }
    }

    function playerStand() {
        const hand = playerHands[currentHandIndex];
        hand.finished = true;
        nextHandOrDealer();
    }

    function playerDouble() {
        const hand = playerHands[currentHandIndex];
        if (hand.cards.length !== 2) return;
        if (balance < hand.bet) {
            flashMessage('Insufficient balance to double.');
            return;
        }
        // deduct additional bet
        balance -= hand.bet;
        updateBalanceUI();
        hand.bet *= 2;
        hand.doubled = true;
        // player gets exactly one card then stands
        hand.cards.push(drawCard());
        renderAll();
        const v = evaluateHand(hand.cards).value;
        if (v > 21) {
            hand.finished = true;
            flashMessage('Busted after double.');
        } else {
            hand.finished = true;
        }
        nextHandOrDealer();
    }

    function playerSplit() {
        // only allowed on first hand, first two cards equal rank
        const hand = playerHands[0];
        if (!hand || hand.cards.length !== 2) return;
        const a = hand.cards[0].rank, b = hand.cards[1].rank;
        if (a !== b) {
            flashMessage('Cannot split: ranks differ.');
            return;
        }
        if (balance < hand.bet) {
            flashMessage('Insufficient balance to split.');
            return;
        }
        // perform split
        balance -= hand.bet;
        updateBalanceUI();
        const newHand = { cards: [ hand.cards.pop() ], bet: hand.bet, finished: false, doubled: false };
        // each hand gets another card
        hand.cards.push(drawCard());
        newHand.cards.push(drawCard());
        playerHands.push(newHand);
        renderAll();
        flashMessage('Split performed — play Hand 1 first.');
        // ensure buttons reflect new state
        enableActionButtons();
    }

    function nextHandOrDealer() {
        // move to next unfinished hand, or let dealer play
        const next = playerHands.findIndex((h, idx) => !h.finished && idx > currentHandIndex);
        if (next !== -1) {
            currentHandIndex = next;
            flashMessage(`Now playing Hand ${currentHandIndex+1}`);
            // allow actions again for this hand (but disable double if not allowed)
            enableActionButtons();
            doubleBtn.disabled = !(playerHands[currentHandIndex].cards.length === 2 && balance >= playerHands[currentHandIndex].bet);
            return;
        }
        // check if any other unhandeled hand prior to current index
        const nextAll = playerHands.findIndex(h => !h.finished);
        if (nextAll !== -1) {
            currentHandIndex = nextAll;
            flashMessage(`Now playing Hand ${currentHandIndex+1}`);
            enableActionButtons();
            doubleBtn.disabled = !(playerHands[currentHandIndex].cards.length === 2 && balance >= playerHands[currentHandIndex].bet);
            return;
        }

        // all player hands finished -> dealer's turn
        disableActionButtons();
        playDealer();
    }

    function playDealer() {
        revealDealer();
        // Dealer hits until 17 or more. Dealer stands on soft 17 (configurable).
        let dEval = evaluateHand(dealer.cards);
        const playLoop = () => {
            dEval = evaluateHand(dealer.cards);
            // stop when value >=17 (if soft and equals 17, we stand per rule)
            if (dEval.value < 17) {
                dealer.cards.push(drawCard());
                renderAll();
                setTimeout(playLoop, 700);
            } else {
                // done
                settleAllHands();
            }
        };
        setTimeout(playLoop, 700);
    }

    function settleAllHands() {
        const dealerEval = evaluateHand(dealer.cards);
        const dealerVal = dealerEval.value;
        const dealerBust = dealerVal > 21;
        let resultMsg = [];
        for (let i=0;i<playerHands.length;i++) {
            const h = playerHands[i];
            const hv = evaluateHand(h.cards).value;
            // blackjack check only valid if original hand of 2 cards and not after split (some rules vary)
            const playerBJ = isBlackjack(h.cards);
            if (playerBJ && h.cards.length === 2) {
                // Blackjack pays 3:2 unless dealer also blackjack handled earlier
                if (isBlackjack(dealer.cards)) {
                    // push
                    balance += h.bet;
                    resultMsg.push(`Hand ${i+1}: Push (both blackjack).`);
                } else {
                    balance += h.bet + (h.bet * 1.5);
                    resultMsg.push(`Hand ${i+1}: Blackjack! Win 3:2.`);
                }
                continue;
            }

            if (hv > 21) {
                resultMsg.push(`Hand ${i+1}: Busted — Lose $${h.bet}.`);
                // nothing added
                continue;
            }

            if (dealerBust) {
                balance += h.bet * 2;
                resultMsg.push(`Hand ${i+1}: Dealer busted — You win $${h.bet}.`);
                continue;
            }

            if (hv > dealerVal) {
                balance += h.bet * 2;
                resultMsg.push(`Hand ${i+1}: Win $${h.bet}.`);
            } else if (hv === dealerVal) {
                balance += h.bet; // push
                resultMsg.push(`Hand ${i+1}: Push.`);
            } else {
                resultMsg.push(`Hand ${i+1}: Lose $${h.bet}.`);
            }
        }

        updateBalanceUI();
        roundActive = false;
        dealBtn.disabled = false;
        newRoundBtn.disabled = false;
        disableActionButtons();
        revealDealer();
        flashMessage(resultMsg.join(' | '), 8000);
    }

    // Event wiring
    dealBtn.addEventListener('click', () => {
        startDeal();
    });

    hitBtn.addEventListener('click', () => {
        playerHit();
    });

    standBtn.addEventListener('click', () => {
        playerStand();
    });

    doubleBtn.addEventListener('click', () => {
        playerDouble();
    });

    splitBtn.addEventListener('click', () => {
        playerSplit();
    });

    newRoundBtn.addEventListener('click', () => {
        // reset basic UI but keep balance
        clearTable();
        playerHands = [];
        dealer = { cards: [] };
        roundActive = false;
        dealBtn.disabled = false;
        newRoundBtn.disabled = true;
        disableActionButtons();
        messages.textContent = '';
    });

    // chips quick set
    chipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const v = Number(btn.dataset.value);
            betInput.value = Math.max(1, Number(betInput.value || 0) + v);
        });
    });

    // Keep UI in sync
    function initUI() {
        updateBalanceUI();
        clearTable();
        disableActionButtons();
        newRoundBtn.disabled = true;
    }

    // Safety: prevent negative bets
    betInput.addEventListener('input', () => {
        if (Number(betInput.value) < 1) betInput.value = 1;
    });

    // initialize deck
    deck = createDeck(deckCount);
    shuffle(deck);
    initUI();

})();