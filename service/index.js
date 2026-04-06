const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const express = require('express');
const uuid = require('uuid');
const app = express();
const db = require('./database.js');
const { peerProxy } = require('./peerProxy.js');

const authCookieName = 'token';

// Fill in new saved elements
const fs = require('fs');
const path = require('path');

// The service port. In production the front-end code is statically hosted by the service on the same port.
const port = process.argv.length > 2 ? process.argv[2] : 4000;

// JSON body parsing using built-in middleware
app.use(express.json());

// Use the cookie parser middleware for tracking authentication tokens
app.use(cookieParser());

// Serve up the front-end static content hosting
app.use(express.static('public'));

// Router for service endpoints
var apiRouter = express.Router();
app.use(`/api`, apiRouter);

// CreateAuth a new user
apiRouter.post('/auth/create', async (req, res) => {
  if (await findUser('email', req.body.email)) {
    res.status(409).send({ msg: 'Existing user' });
  } else {
    const user = await createUser(req.body.email, req.body.password);

    setAuthCookie(res, user.token);
    res.send({ email: user.email });
  }
});

// GetAuth login an existing user
apiRouter.post('/auth/login', async (req, res) => {
  const user = await findUser('email', req.body.email);
  if (user) {
    if (await bcrypt.compare(req.body.password, user.password)) {
      user.token = uuid.v4();
      setAuthCookie(res, user.token);
      res.send({ email: user.email });
      return;
    }
  }
  res.status(401).send({ msg: 'Unauthorized' });
});

// DeleteAuth logout a user
apiRouter.delete('/auth/logout', async (req, res) => {
  const user = await findUser('token', req.cookies[authCookieName]);
  if (user) {
    delete user.token;
    db.updateUser(user);
  }
  res.clearCookie(authCookieName);
  res.status(204).end();
});

// Middleware to verify that the user is authorized to call an endpoint
const verifyAuth = async (req, res, next) => {
  const user = await findUser('token', req.cookies[authCookieName]);
  if (user) {
    next();
  } else {
    res.status(401).send({ msg: 'Unauthorized' });
  }
};

apiRouter.post('/game', verifyAuth, async (req, res) => {
  const gmName = req.body.player;

  const game = {
    id: uuid.v4(),
    name: req.body.name,
    gm: gmName,
    players: [],
    monsters: [],
    mapImage: '/forest-map.png',
    messages: [],
    created: new Date(),
  };

  await db.addGame(game);
  res.send(game);
});

apiRouter.post('/game/join', verifyAuth, async (req, res) => {
  const game = await db.getGame(req.body.name);

  if (!game) {
    return res.status(404).send({ msg: 'Game not found' });
  }

  const playerName = req.body.player;
  if (game.gm === playerName) {
    return res.send({ ...game, role: 'gm' });
  }

  let player = game.players.find(p => p.playerName === playerName);

  if (player) {
    if (req.body.character) {
      player.character = req.body.character;
      await db.updateGame(game);
    }

    return res.send({
      ...game,
      role: 'player',
      character: player.character
    });
  }

  player = {
    playerName,
    role: 'player',
    character: req.body.character || null,
  };

  game.players.push(player);
  await db.updateGame(game);

  res.send({
    ...game,
    role: 'player',
    character: player.character
  });
});

apiRouter.post('/game/state', verifyAuth, async (req, res) => {
  const { name, players, monsters, mapImage, messages } = req.body;

  const game = await db.getGame(name);
  if (!game) return res.status(404).send({ msg: 'Game not found' });

  if (players) game.players = players;
  if (monsters) game.monsters = monsters;
  if (mapImage) game.mapImage = mapImage;
  if (messages) game.messages = messages.slice(-20);

  await db.updateGame(game);
  res.send(game);
});

apiRouter.get('/game/state/:name', verifyAuth, async (req, res) => {
  const game = await db.getGame(req.params.name);
  if (!game) return res.status(404).send({ msg: 'Game not found' });

  res.send({
    players: game.players,
    monsters: game.monsters,
    mapImage: game.mapImage,
    messages: game.messages,
  });
});

// Fill in new endpoints

apiRouter.get('/games', verifyAuth, async (_req, res) => {
  const allGames = await db.getAllGames();
  res.send(allGames);
});

// Default error handler
app.use(function (err, req, res, next) {
  res.status(500).send({ type: err.name, message: err.message });
});

// Return the application's default page if the path is unknown
app.use((_req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

async function createUser(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  const token = uuid.v4();
  const user = {email: email, password: passwordHash, token: token,};
  await db.addUser(user);
  return user;
}

async function findUser(field, value) {
  if (!value) return null;
  if (field === 'email') {return db.getUser(value);}
  if (field === 'token') {return db.getUserByToken(value);}
  return db.getUser(field, value);
}

// setAuthCookie in the HTTP response
function setAuthCookie(res, authToken) {
  res.cookie(authCookieName, authToken, {
    maxAge: 1000 * 60 * 60 * 24 * 365,
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
  });
}

const httpService = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

peerProxy(httpService);
