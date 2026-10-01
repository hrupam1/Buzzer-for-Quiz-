import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// In-memory data store for MVP
export interface Team {
  id: string;
  roomId: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  joinedAt: number;
  score: number;
}

export interface BuzzEvent {
  id: string;
  roomId: string;
  teamId: string;
  questionNumber: number;
  serverTimestamp: number;
  sequenceNumber: number;
  result: 'winner' | 'late' | 'invalid';
}

export interface Room {
  id: string;
  roomCode: string;
  hostId: string; // socketId of the host
  hostToken: string; // for host reconnection
  status: 'waiting' | 'active' | 'finished';
  currentQuestion: number;
  buzzerActive: boolean;
  winnerTeamId: string | null;
  createdAt: number;
  sequenceCounter: number;
  teams: Record<string, Team>;
  buzzHistory: BuzzEvent[];
}

const rooms: Record<string, Room> = {};
const socketToTeam: Record<string, { roomCode: string, teamId: string }> = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

app.get('/', (req, res) => {
  res.send('Buzzer Server Running');
});

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  // --- HOST EVENTS ---

  socket.on('host:createRoom', (callback) => {
    const roomCode = generateRoomCode();
    const hostToken = uuidv4();
    const roomId = uuidv4();

    rooms[roomCode] = {
      id: roomId,
      roomCode,
      hostId: socket.id,
      hostToken,
      status: 'waiting',
      currentQuestion: 1,
      buzzerActive: false,
      winnerTeamId: null,
      createdAt: Date.now(),
      sequenceCounter: 0,
      teams: {},
      buzzHistory: []
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by host ${socket.id}`);
    callback({ success: true, roomCode, hostToken, room: rooms[roomCode] });
  });

  socket.on('host:reconnect', ({ roomCode, hostToken }, callback) => {
    const room = rooms[roomCode];
    if (room && room.hostToken === hostToken) {
      room.hostId = socket.id;
      socket.join(roomCode);
      callback({ success: true, room });
    } else {
      callback({ success: false, message: 'Invalid room or token' });
    }
  });

  socket.on('host:activateBuzzer', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.buzzerActive = true;
      room.winnerTeamId = null;
      io.to(roomCode).emit('room:stateUpdate', room);
    }
  });

  socket.on('host:lockBuzzer', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.buzzerActive = false;
      io.to(roomCode).emit('room:stateUpdate', room);
    }
  });

  socket.on('host:resetBuzzer', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.buzzerActive = false;
      room.winnerTeamId = null;
      io.to(roomCode).emit('room:stateUpdate', room);
    }
  });

  socket.on('host:nextQuestion', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.currentQuestion += 1;
      room.buzzerActive = false;
      room.winnerTeamId = null;
      io.to(roomCode).emit('room:stateUpdate', room);
    }
  });

  socket.on('host:updateScore', ({ roomCode, teamId, scoreDelta }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id && room.teams[teamId]) {
      room.teams[teamId].score += scoreDelta;
      io.to(roomCode).emit('room:stateUpdate', room);
    }
  });

  socket.on('host:removeTeam', ({ roomCode, teamId }) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id && room.teams[teamId]) {
      const socketId = room.teams[teamId].socketId;
      if (socketId) {
        io.sockets.sockets.get(socketId)?.leave(roomCode);
        io.to(socketId).emit('team:removed');
      }
      delete room.teams[teamId];
      io.to(roomCode).emit('room:stateUpdate', room);
    }
  });

  // --- TEAM EVENTS ---

  socket.on('team:joinRoom', ({ roomCode, teamName, previousTeamId }, callback) => {
    const room = rooms[roomCode];
    if (!room) {
      return callback({ success: false, message: 'Room not found.' });
    }

    let teamId = previousTeamId;
    
    // Reconnection
    if (teamId && room.teams[teamId]) {
      const team = room.teams[teamId]!;
      team.socketId = socket.id;
      team.connected = true;
      socketToTeam[socket.id] = { roomCode, teamId };
      socket.join(roomCode);
      io.to(roomCode).emit('room:stateUpdate', room);
      return callback({ success: true, teamId, room });
    }

    // New Join
    teamId = uuidv4();
    const newTeam: Team = {
      id: teamId,
      roomId: room.id,
      name: teamName,
      socketId: socket.id,
      connected: true,
      joinedAt: Date.now(),
      score: 0
    };

    room.teams[teamId] = newTeam;
    socketToTeam[socket.id] = { roomCode, teamId };
    socket.join(roomCode);
    io.to(roomCode).emit('room:stateUpdate', room);
    callback({ success: true, teamId, room });
  });

  socket.on('team:buzz', ({ roomCode, teamId }, callback) => {
    const room = rooms[roomCode];
    const serverTimestamp = Date.now();

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found' });
      return;
    }

    const team = room.teams[teamId];
    if (!team) {
      if (callback) callback({ success: false, message: 'Team not found in room' });
      return;
    }

    room.sequenceCounter += 1;
    const seq = room.sequenceCounter;

    if (!room.buzzerActive) {
      const event: BuzzEvent = {
        id: uuidv4(),
        roomId: room.id,
        teamId,
        questionNumber: room.currentQuestion,
        serverTimestamp,
        sequenceNumber: seq,
        result: 'invalid'
      };
      room.buzzHistory.push(event);
      if (callback) callback({ success: false, message: 'Buzzer is not active' });
      return;
    }

    // Atomic winner check
    if (room.winnerTeamId === null) {
      room.winnerTeamId = teamId;
      room.buzzerActive = false; // Lock the buzzer

      const event: BuzzEvent = {
        id: uuidv4(),
        roomId: room.id,
        teamId,
        questionNumber: room.currentQuestion,
        serverTimestamp,
        sequenceNumber: seq,
        result: 'winner'
      };
      room.buzzHistory.push(event);

      // Broadcast immediately
      io.to(roomCode).emit('room:stateUpdate', room);
      io.to(roomCode).emit('room:winnerDeclared', { teamId, timestamp: serverTimestamp });
      
      if (callback) callback({ success: true, isWinner: true });
    } else {
      // Late buzz
      const event: BuzzEvent = {
        id: uuidv4(),
        roomId: room.id,
        teamId,
        questionNumber: room.currentQuestion,
        serverTimestamp,
        sequenceNumber: seq,
        result: 'late'
      };
      room.buzzHistory.push(event);
      if (callback) callback({ success: true, isWinner: false });
    }
  });

  // --- DISCONNECT ---

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const teamInfo = socketToTeam[socket.id];
    if (teamInfo) {
      const room = rooms[teamInfo.roomCode];
      if (room && room.teams[teamInfo.teamId]) {
        const team = room.teams[teamInfo.teamId]!;
        team.connected = false;
        team.socketId = null;
        io.to(teamInfo.roomCode).emit('room:stateUpdate', room);
      }
      delete socketToTeam[socket.id];
    } else {
      // Check if host disconnected
      for (const roomCode in rooms) {
        const room = rooms[roomCode];
        if (room && room.hostId === socket.id) {
          // Host disconnected, don't delete room immediately, allow reconnect
          console.log(`Host disconnected from room ${roomCode}`);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
