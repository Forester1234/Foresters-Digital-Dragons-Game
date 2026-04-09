const { WebSocketServer, WebSocket } = require('ws');

let socketServer;

function peerProxy(httpServer) {
  // Create a websocket object
  socketServer = new WebSocketServer({ server: httpServer });

  socketServer.on('connection', (socket) => {
    socket.isAlive = true;

    // Forward messages to everyone except the sender
    socket.on('message', function message(data) {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (msg.type === 'join') {
        socket.game = msg.game;
        return;
      }
      socket.game = msg.game;
      socketServer.clients.forEach((client) => {
        if (
          client !== socket && 
          client.readyState === WebSocket.OPEN &&
          client.game === msg.game
        ) {
          client.send(data);
        }
      });
    });

    // Respond to pong messages by marking the connection alive
    socket.on('pong', () => {
      socket.isAlive = true;
    });
  });

  // Periodically send out a ping message to make sure clients are alive
  setInterval(() => {
    socketServer.clients.forEach(function each(client) {
      if (client.isAlive === false) return client.terminate();

      client.isAlive = false;
      client.ping();
    });
  }, 10000);
}

function broadcastToGame(gameName, message) {
  console.log(`Broadcasting to game ${gameName}:`, message);
  socketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.game === gameName) {
      client.send(JSON.stringify(message));
    }
  });
}

module.exports = { peerProxy, broadcastToGame };
