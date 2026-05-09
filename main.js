// Audio Context for Sound Effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playSound = (type) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'place-x') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'place-o') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(500, now + 0.1);
        osc.frequency.setValueAtTime(600, now + 0.2);
        osc.frequency.setValueAtTime(800, now + 0.3);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'draw') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.5);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
};

// UI Elements
const menuContainer = document.getElementById('menu-container');
const gameContainer = document.getElementById('game-container');
const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const backBtn = document.getElementById('btn-back');
const menuStatus = document.getElementById('menu-status');
const roomDisplay = document.getElementById('room-display');
const roomIdDisplay = document.getElementById('room-id-display');

// Menu Buttons
const btnLocal = document.getElementById('btn-local');
const btnAi = document.getElementById('btn-ai');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const roomInput = document.getElementById('room-input');

// Game State
let gameState = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameActive = false;
let gameMode = 'local'; // 'local', 'ai', 'online'
let myPlayerSymbol = 'X'; // For online mode and AI mode
let isMyTurn = true; // Determines if the local user can click

// PeerJS Networking
let peer = null;
let conn = null;

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// Switch to Game View
const showGame = (mode) => {
    playSound('click');
    gameMode = mode;
    menuContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    if (mode === 'online') {
        roomDisplay.classList.remove('hidden');
        resetBtn.classList.add('hidden'); // Disable local restart in online mode
    } else {
        roomDisplay.classList.add('hidden');
        resetBtn.classList.remove('hidden');
        if (mode === 'ai') {
            myPlayerSymbol = 'X'; // Player is always X against AI for simplicity
            isMyTurn = true;
        } else {
            isMyTurn = true; // Both can play in local
        }
    }
    handleRestartGame();
};

// Switch to Menu View
const showMenu = () => {
    playSound('click');
    gameContainer.classList.add('hidden');
    menuContainer.classList.remove('hidden');
    menuStatus.innerText = '';
    
    // Cleanup PeerJS
    if (conn) { conn.close(); conn = null; }
    if (peer) { peer.destroy(); peer = null; }
};

// Start Local Game
btnLocal.addEventListener('click', () => { showGame('local'); });

// Start AI Game
btnAi.addEventListener('click', () => { showGame('ai'); });

// --- PeerJS Online Logic ---
const initializePeer = (onReady) => {
    menuStatus.innerText = 'Connecting to server...';
    peer = new Peer();
    peer.on('open', (id) => {
        menuStatus.innerText = `Connected! ID: ${id}`;
        onReady(id);
    });
    peer.on('error', (err) => {
        menuStatus.innerText = 'Connection error: ' + err.type;
        console.error(err);
    });
};

const setupConnection = (connection) => {
    conn = connection;
    conn.on('open', () => {
        menuStatus.innerText = 'Opponent connected!';
        setTimeout(() => {
            showGame('online');
            updateOnlineStatus();
        }, 1000);
    });
    conn.on('data', (data) => {
        if (data.type === 'move') {
            handleMove(data.index, currentPlayer);
        } else if (data.type === 'restart') {
            handleRestartGame(true);
        }
    });
    conn.on('close', () => {
        alert('Opponent disconnected.');
        showMenu();
    });
};

btnCreateRoom.addEventListener('click', () => {
    playSound('click');
    initializePeer((id) => {
        menuStatus.innerText = `Room ID: ${id}. Waiting for opponent...`;
        roomIdDisplay.innerText = id;
        myPlayerSymbol = 'X'; // Creator is X
        isMyTurn = true; // X goes first
        
        peer.on('connection', (connection) => {
            setupConnection(connection);
        });
    });
});

btnJoinRoom.addEventListener('click', () => {
    playSound('click');
    const roomId = roomInput.value.trim();
    if (!roomId) {
        menuStatus.innerText = 'Please enter a Room ID.';
        return;
    }
    initializePeer((id) => {
        menuStatus.innerText = 'Joining room...';
        roomIdDisplay.innerText = roomId;
        myPlayerSymbol = 'O'; // Joiner is O
        isMyTurn = false; // O goes second
        
        const connection = peer.connect(roomId);
        setupConnection(connection);
    });
});

// --- Core Game Logic ---
const handleCellClick = (e) => {
    if (!gameActive || !isMyTurn) return;
    
    const clickedCell = e.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

    if (gameState[clickedCellIndex] !== "") return;

    if (gameMode === 'online') {
        conn.send({ type: 'move', index: clickedCellIndex });
    }

    handleMove(clickedCellIndex, currentPlayer);
};

const handleMove = (index, player) => {
    if (!gameActive) return;

    gameState[index] = player;
    const cell = cells[index];
    cell.innerText = player;
    cell.classList.add(player.toLowerCase());
    
    playSound(player === 'X' ? 'place-x' : 'place-o');

    if (checkWinResult()) return;

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    
    if (gameMode === 'online') {
        isMyTurn = currentPlayer === myPlayerSymbol;
        updateOnlineStatus();
    } else if (gameMode === 'ai') {
        isMyTurn = currentPlayer === myPlayerSymbol;
        statusText.innerHTML = `Player <span class="player-${currentPlayer.toLowerCase()}">${currentPlayer}</span>'s Turn`;
        if (!isMyTurn && gameActive) {
            setTimeout(makeAIMove, 500); // Small delay for AI
        }
    } else {
        // Local mode
        statusText.innerHTML = `Player <span class="player-${currentPlayer.toLowerCase()}">${currentPlayer}</span>'s Turn`;
    }
};

const updateOnlineStatus = () => {
    if (isMyTurn) {
        statusText.innerHTML = `Your Turn (<span class="player-${myPlayerSymbol.toLowerCase()}">${myPlayerSymbol}</span>)`;
    } else {
        statusText.innerHTML = `Opponent's Turn...`;
    }
};

const checkWinResult = () => {
    let roundWon = false;
    let winningCells = [];

    for (let i = 0; i < 8; i++) {
        const winCondition = winningConditions[i];
        let a = gameState[winCondition[0]];
        let b = gameState[winCondition[1]];
        let c = gameState[winCondition[2]];

        if (a === "" || b === "" || c === "") continue;
        if (a === b && b === c) {
            roundWon = true;
            winningCells = winCondition;
            break;
        }
    }

    if (roundWon) {
        playSound('win');
        if (gameMode === 'online') {
            statusText.innerHTML = currentPlayer === myPlayerSymbol ? "You Win! 🎉" : "Opponent Wins 😔";
        } else {
            statusText.innerHTML = `Player <span class="player-${currentPlayer.toLowerCase()}">${currentPlayer}</span> Wins! 🎉`;
        }
        gameActive = false;
        winningCells.forEach(i => cells[i].classList.add('win-highlight'));
        return true;
    }

    if (!gameState.includes("")) {
        playSound('draw');
        statusText.innerHTML = "Game ended in a Draw!";
        gameActive = false;
        return true;
    }
    
    return false;
};

const handleRestartGame = (fromNetwork = false) => {
    playSound('click');
    gameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    
    if (gameMode === 'online') {
        isMyTurn = myPlayerSymbol === 'X';
        updateOnlineStatus();
        if (!fromNetwork && conn) {
            conn.send({ type: 'restart' });
        }
    } else if (gameMode === 'ai') {
        isMyTurn = true;
        statusText.innerHTML = `Player <span class="player-x">X</span>'s Turn`;
    } else {
        isMyTurn = true;
        statusText.innerHTML = `Player <span class="player-x">X</span>'s Turn`;
    }
    
    cells.forEach(cell => {
        cell.innerText = "";
        cell.classList.remove('x', 'o', 'win-highlight');
    });
};

// --- AI Logic (Minimax) ---
const makeAIMove = () => {
    let bestScore = -Infinity;
    let bestMove;
    let aiSymbol = myPlayerSymbol === 'X' ? 'O' : 'X';
    let humanSymbol = myPlayerSymbol;

    for (let i = 0; i < 9; i++) {
        if (gameState[i] === "") {
            gameState[i] = aiSymbol;
            let score = minimax(gameState, 0, false, aiSymbol, humanSymbol);
            gameState[i] = "";
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    
    if (bestMove !== undefined) {
        handleMove(bestMove, aiSymbol);
    }
};

const minimax = (board, depth, isMaximizing, aiSymbol, humanSymbol) => {
    let result = checkWinnerForMinimax(board);
    if (result === aiSymbol) return 10 - depth;
    if (result === humanSymbol) return depth - 10;
    if (result === 'tie') return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === "") {
                board[i] = aiSymbol;
                let score = minimax(board, depth + 1, false, aiSymbol, humanSymbol);
                board[i] = "";
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === "") {
                board[i] = humanSymbol;
                let score = minimax(board, depth + 1, true, aiSymbol, humanSymbol);
                board[i] = "";
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
};

const checkWinnerForMinimax = (board) => {
    for (let i = 0; i < 8; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    if (!board.includes("")) return 'tie';
    return null;
};

// Event Listeners
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetBtn.addEventListener('click', () => handleRestartGame(false));
backBtn.addEventListener('click', showMenu);
