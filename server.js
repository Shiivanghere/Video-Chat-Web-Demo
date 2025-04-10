const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingSocket = null;

io.on('connection', socket => {
  if (waitingSocket) {
    const peer = waitingSocket;
    waitingSocket = null;

    socket.peer = peer;
    peer.peer = socket;

    socket.emit('peer-found');
    peer.emit('peer-found');
  } else {
    waitingSocket = socket;
  }

  socket.on('signal', data => {
    if (socket.peer) {
      socket.peer.emit('signal', data);
    }
  });

  socket.on('disconnect', () => {
    if (waitingSocket === socket) {
      waitingSocket = null;
    }
    if (socket.peer) {
      socket.peer.emit('peer-disconnected');
      socket.peer.peer = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
