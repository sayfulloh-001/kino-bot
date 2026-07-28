/**
 * Tic-Tac-Toe (X/O) Game Controller.
 * Features arcade synthesized sounds, smart minimax AI, and score tracking.
 */

export class TicTacToe {
    constructor(uiManager) {
        this.ui = uiManager;
        this.board = Array(9).fill('');
        this.currentPlayer = 'X'; // Player is always X, O is AI or Friend
        this.isGameActive = true;
        this.mode = 'ai'; // 'ai' or 'friend'
        
        this.scores = {
            X: 0,
            O: 0,
            draws: 0
        };

        // Cache elements
        this.cells = document.querySelectorAll('.xo-cell');
        this.statusText = document.getElementById('xo-status-text');
        this.scoreX = document.getElementById('xo-score-x');
        this.scoreO = document.getElementById('xo-score-o');
        this.scoreDraws = document.getElementById('xo-score-draws');
        this.oLabel = document.getElementById('xo-o-label');
        
        this.winningConditions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        this.initListeners();
    }

    initListeners() {
        // Cells click handler
        this.cells.forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e.target));
        });

        // Mode toggles
        const btnAI = document.getElementById('xo-mode-ai');
        const btnFriend = document.getElementById('xo-mode-friend');

        btnAI.addEventListener('click', () => {
            this.setMode('ai');
            btnAI.classList.add('active');
            btnFriend.classList.remove('active');
        });

        btnFriend.addEventListener('click', () => {
            this.setMode('friend');
            btnFriend.classList.add('active');
            btnAI.classList.remove('active');
        });

        // Reset actions
        document.getElementById('xo-restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('xo-reset-scores-btn').addEventListener('click', () => this.resetScores());
    }

    setMode(mode) {
        this.playSynthSound('click');
        this.mode = mode;
        this.oLabel.textContent = mode === 'ai' ? 'Kompyuter (O)' : 'O\'yinchi (O)';
        this.resetScores();
    }

    handleCellClick(cell) {
        const clickedCellIndex = parseInt(cell.getAttribute('data-index'));

        if (this.board[clickedCellIndex] !== '' || !this.isGameActive) {
            return;
        }

        // Make move
        this.makeMove(clickedCellIndex, this.currentPlayer);

        // Check result
        if (this.checkResult()) return;

        // Next turn
        if (this.mode === 'ai') {
            this.currentPlayer = 'O';
            this.statusText.textContent = 'Kompyuter navbati (O)...';
            this.isGameActive = false; // Freeze user clicks during AI thinking
            
            setTimeout(() => {
                this.makeAIMove();
            }, 600);
        } else {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            this.statusText.textContent = `O'yinchi ${this.currentPlayer} navbati`;
        }
    }

    makeMove(index, player) {
        this.board[index] = player;
        const cell = this.cells[index];
        cell.textContent = player;
        cell.classList.add(player.toLowerCase());
        
        this.playSynthSound(player.toLowerCase());
    }

    makeAIMove() {
        if (!this.isGameActive && this.board.includes('')) {
            this.isGameActive = true; // Unfreeze
            
            // Smart probability (80% minimax, 20% random to make it beatable and fun)
            let bestMove;
            if (Math.random() < 0.2) {
                bestMove = this.getRandomMove();
            } else {
                bestMove = this.getBestMove();
            }

            if (bestMove !== undefined && bestMove !== null) {
                this.makeMove(bestMove, 'O');
                
                if (this.checkResult()) return;
                
                this.currentPlayer = 'X';
                this.statusText.textContent = 'Sizning navbatingiz (X)';
            }
        }
    }

    getRandomMove() {
        const available = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') available.push(i);
        }
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    getBestMove() {
        let bestVal = -1000;
        let bestMove = null;

        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = 'O';
                let moveVal = this.minimax(this.board, 0, false);
                this.board[i] = '';

                if (moveVal > bestVal) {
                    bestMove = i;
                    bestVal = moveVal;
                }
            }
        }
        return bestMove;
    }

    minimax(board, depth, isMax) {
        let score = this.evaluateBoard(board);

        // If O (Maximizer) won
        if (score === 10) return score - depth;

        // If X (Minimizer) won
        if (score === -10) return score + depth;

        // If draw
        if (!board.includes('')) return 0;

        if (isMax) {
            let best = -1000;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'O';
                    best = Math.max(best, this.minimax(board, depth + 1, false));
                    board[i] = '';
                }
            }
            return best;
        } else {
            let best = 1000;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'X';
                    best = Math.min(best, this.minimax(board, depth + 1, true));
                    board[i] = '';
                }
            }
            return best;
        }
    }

    evaluateBoard(board) {
        // Checking for Rows for X or O victory.
        for (let row = 0; row < 8; row++) {
            const cond = this.winningConditions[row];
            if (board[cond[0]] === board[cond[1]] && board[cond[1]] === board[cond[2]]) {
                if (board[cond[0]] === 'O') return +10;
                else if (board[cond[0]] === 'X') return -10;
            }
        }
        return 0;
    }

    checkResult() {
        let roundWon = false;
        let winCond = null;

        for (let i = 0; i < 8; i++) {
            const winCondition = this.winningConditions[i];
            let a = this.board[winCondition[0]];
            let b = this.board[winCondition[1]];
            let c = this.board[winCondition[2]];
            
            if (a === '' || b === '' || c === '') {
                continue;
            }
            if (a === b && b === c) {
                roundWon = true;
                winCond = winCondition;
                break;
            }
        }

        if (roundWon) {
            this.isGameActive = false;
            
            // Highlight winning cells
            winCond.forEach(index => {
                this.cells[index].classList.add('win-cell');
            });

            if (this.currentPlayer === 'X') {
                this.statusText.textContent = this.mode === 'ai' ? 'Tabriklaymiz! Siz yutdingiz! 🎉' : 'X g\'alaba qozondi! 🎉';
                this.scores.X++;
                this.playSynthSound('win');
            } else {
                this.statusText.textContent = this.mode === 'ai' ? 'Kompyuter yutdi! 🤖' : 'O g\'alaba qozondi! 🎉';
                this.scores.O++;
                this.playSynthSound(this.mode === 'ai' ? 'lose' : 'win');
            }
            this.updateScoreboard();
            return true;
        }

        // Draw check
        let roundDraw = !this.board.includes('');
        if (roundDraw) {
            this.isGameActive = false;
            this.statusText.textContent = 'Durang bo\'ldi! 🤝';
            this.scores.draws++;
            this.updateScoreboard();
            this.playSynthSound('draw');
            return true;
        }

        return false;
    }

    updateScoreboard() {
        this.scoreX.textContent = this.scores.X;
        this.scoreO.textContent = this.scores.O;
        this.scoreDraws.textContent = this.scores.draws;
    }

    restartGame() {
        this.playSynthSound('click');
        this.board = Array(9).fill('');
        this.isGameActive = true;
        this.currentPlayer = 'X';
        this.statusText.textContent = 'Sizning navbatingiz (X)';
        
        this.cells.forEach(cell => {
            cell.textContent = '';
            cell.className = 'xo-cell';
        });
    }

    resetScores() {
        this.playSynthSound('click');
        this.scores = { X: 0, O: 0, draws: 0 };
        this.updateScoreboard();
        this.restartGame();
    }

    /**
     * Synthesize audio effects live using the Web Audio API.
     */
    playSynthSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            if (type === 'click') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(300, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'x') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'o') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'win') {
                const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 chord
                freqs.forEach((f, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(f, now + idx * 0.06);
                    gain.gain.setValueAtTime(0.06, now + idx * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now + idx * 0.06);
                    osc.stop(now + 0.5);
                });
            } else if (type === 'lose') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(80, now + 0.4);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            } else if (type === 'draw') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(330, now);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.18);
                
                setTimeout(() => {
                    const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
                    const osc2 = ctx2.createOscillator();
                    const gain2 = ctx2.createGain();
                    osc2.connect(gain2);
                    gain2.connect(ctx2.destination);
                    osc2.type = 'triangle';
                    osc2.frequency.setValueAtTime(330, ctx2.currentTime);
                    gain2.gain.setValueAtTime(0.06, ctx2.currentTime);
                    gain2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.18);
                    osc2.start(ctx2.currentTime);
                    osc2.stop(ctx2.currentTime + 0.18);
                }, 160);
            }
        } catch (e) {
            console.error("Audio error:", e);
        }
    }
}
