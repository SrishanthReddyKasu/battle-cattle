document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const screens = { login: document.getElementById('screen-login'), menu: document.getElementById('screen-menu'), room: document.getElementById('screen-room'), game: document.getElementById('screen-game') };
    const modalHowTo = document.getElementById('how-to-modal');
    let myName = "", mySecret = "", opponentName = "";

    // Helper for Enter Key
    const onEnter = (input, btn) => {
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') btn.click(); });
    };

    // 1. Navigation
    document.getElementById('btn-proceed').addEventListener('click', () => {
        myName = document.getElementById('username-input').value.trim();
        if (myName) { screens.login.classList.add('hidden'); screens.menu.classList.remove('hidden'); }
    });
    onEnter(document.getElementById('username-input'), document.getElementById('btn-proceed'));

    document.getElementById('btn-how-to').addEventListener('click', () => modalHowTo.classList.remove('hidden'));
    document.getElementById('btn-close-how').addEventListener('click', () => modalHowTo.classList.add('hidden'));

    // 2. Room
    document.getElementById('btn-create').addEventListener('click', () => socket.emit('createRoom', myName));
    document.getElementById('btn-join').addEventListener('click', () => {
        const code = prompt("Enter 4-digit Room Code:");
        if (code) socket.emit('joinRoom', code, myName);
    });

    socket.on('roomCreated', (code) => {
        document.getElementById('code-tag').innerText = code;
        screens.menu.classList.add('hidden'); screens.room.classList.remove('hidden');
    });

    socket.on('playerJoined', (data) => {
        document.getElementById('code-tag').innerText = data.code;
        screens.menu.classList.add('hidden'); screens.room.classList.remove('hidden');
        document.getElementById('room-wait-msg').classList.add('hidden');
        document.getElementById('setup-area').classList.remove('hidden');
        for (let id in data.players) { if (id !== socket.id) opponentName = data.players[id]; }
        document.getElementById('opponent-name-label').innerText = `${opponentName}'s Guesses`;
    });

    // 3. Secret Lock
    const btnLock = document.getElementById('btn-lock');
    const secretInput = document.getElementById('secret-input');
    btnLock.addEventListener('click', () => {
        const val = secretInput.value;
        if (val.length === 4 && new Set(val).size === 4 && !isNaN(val)) {
            mySecret = val;
            socket.emit('lockSecret', val);
            btnLock.disabled = true; secretInput.disabled = true;
            document.getElementById('waiting-msg').innerText = "Locked! Waiting...";
        } else { alert("Need 4 unique digits!"); }
    });
    onEnter(secretInput, btnLock);

    // 4. Battle & Guess
    const btnGuess = document.getElementById('btn-guess');
    const guessInput = document.getElementById('guess-input');
    
    socket.on('startBattle', (firstTurnId) => {
        screens.room.classList.add('hidden'); screens.game.classList.remove('hidden');
        document.getElementById('my-secret-display').innerText = mySecret;
        updateTurn(firstTurnId);
    });

    function updateTurn(activeId) {
        const indicator = document.getElementById('turn-indicator');
        if (socket.id === activeId) { indicator.innerText = `YOUR TURN (${myName})`; btnGuess.disabled = false; }
        else { indicator.innerText = `${opponentName.toUpperCase()}'S TURN`; btnGuess.disabled = true; }
    }

    btnGuess.addEventListener('click', () => {
        const val = guessInput.value;
        if (val.length === 4 && new Set(val).size === 4 && !isNaN(val)) {
            socket.emit('submitGuess', val);
            guessInput.value = "";
        } else { alert("Guess must be 4 unique digits!"); }
    });
    onEnter(guessInput, btnGuess);

    document.getElementById('btn-surrender').addEventListener('click', () => {
        if (confirm("Are you sure you want to surrender?")) socket.emit('surrender');
    });

    socket.on('guessResult', (result, nextTurnId) => {
        const list = result.playerId === socket.id ? document.getElementById('my-guesses-list') : document.getElementById('opponent-guesses-list');
        const p = document.createElement('p');
        p.innerText = `${result.guess}: ${result.bulls}B, ${result.cows}C`;
        list.appendChild(p);
        updateTurn(nextTurnId);
    });

    socket.on('lastChance', (winnerName) => { alert(`${winnerName} got 4 Bulls! One last turn to tie!`); updateTurn(socket.id); });

    socket.on('gameOver', (winnerId, msg) => {
        alert(msg);
        screens.game.classList.add('hidden'); screens.menu.classList.remove('hidden');
        document.getElementById('my-guesses-list').innerHTML = ""; document.getElementById('opponent-guesses-list').innerHTML = "";
        btnLock.disabled = false; secretInput.disabled = false; secretInput.value = "";
        document.getElementById('waiting-msg').innerText = "";
        document.getElementById('room-wait-msg').classList.remove('hidden');
        document.getElementById('setup-area').classList.add('hidden');
    });

    socket.on('errorMsg', (msg) => alert(msg));
});