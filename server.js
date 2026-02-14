const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', (username) => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomCode] = { 
            playerIds: [socket.id], 
            names: { [socket.id]: username },
            secrets: {}, // Secrets stored by socket.id
            p1Finished: false 
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
    });

    socket.on('joinRoom', (roomCode, username) => {
        const room = rooms[roomCode];
        if (room && room.playerIds.length < 2) {
            socket.join(roomCode);
            room.playerIds.push(socket.id);
            room.names[socket.id] = username;
            io.to(roomCode).emit('playerJoined', {
                code: roomCode,
                players: room.names
            });
        } else {
            socket.emit('errorMsg', 'Room full or invalid.');
        }
    });

    socket.on('lockSecret', (secret) => {
        // Find which room this specific socket is in
        const roomCode = Array.from(socket.rooms).find(r => r.length === 4);
        const room = rooms[roomCode];
        
        if (room) {
            // CRITICAL: Only lock the secret for THIS socket ID
            room.secrets[socket.id] = secret;
            
            // Check if BOTH players in THIS specific room have locked
            const lockedCount = Object.keys(room.secrets).length;
            if (lockedCount === 2) {
                io.to(roomCode).emit('startBattle', room.playerIds[0]);
            }
        }
    });

    socket.on('submitGuess', (guess) => {
        const roomCode = Array.from(socket.rooms).find(r => r.length === 4);
        const room = rooms[roomCode];
        if (!room) return;

        const opponentId = room.playerIds.find(id => id !== socket.id);
        const opponentSecret = room.secrets[opponentId];
        
        let bulls = 0, cows = 0;
        const secretArr = opponentSecret.split('');
        guess.split('').forEach((char, i) => {
            if (char === secretArr[i]) bulls++;
            else if (secretArr.includes(char)) cows++;
        });

        const isP1 = (socket.id === room.playerIds[0]);
        const result = { guess, bulls, cows, playerId: socket.id };

        if (bulls === 4) {
            if (isP1) {
                room.p1Finished = true;
                socket.emit('guessResult', result, opponentId);
                io.to(opponentId).emit('lastChance', room.names[socket.id]);
            } else {
                if (room.p1Finished) io.to(roomCode).emit('gameOver', 'draw', 'It is a DRAW!');
                else io.to(roomCode).emit('gameOver', socket.id, `${room.names[socket.id]} WINS!`);
            }
        } else {
            if (!isP1 && room.p1Finished) {
                io.to(roomCode).emit('gameOver', room.playerIds[0], `${room.names[room.playerIds[0]]} WINS!`);
            } else {
                io.to(roomCode).emit('guessResult', result, opponentId);
            }
        }
    });

    socket.on('surrender', () => {
        const roomCode = Array.from(socket.rooms).find(r => r.length === 4);
        const room = rooms[roomCode];
        if (room) {
            const opponentId = room.playerIds.find(id => id !== socket.id);
            io.to(roomCode).emit('gameOver', opponentId, `${room.names[socket.id]} surrendered! ${room.names[opponentId]} WINS!`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));