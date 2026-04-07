const { MongoClient } = require('mongodb');
const config = require('./dbConfig.json');

const url = `mongodb+srv://${config.userName}:${config.password}@${config.hostname}`;
const client = new MongoClient(url);
const db = client.db('startup');
const userCollection = db.collection('user');
const gameCollection = db.collection('games');

(async function testConnection() {
  try {
    await client.connect();
    await db.command({ ping: 1 });
    console.log(`Connect to database`);
  } catch (ex) {
    console.log(`Unable to connect to database with ${url} because ${ex.message}`);
    process.exit(1);
  }
})();

// USERS
function getUser(email) {
  return userCollection.findOne({ email });
}

function getUserByToken(token) {
  return userCollection.findOne({ token });
}

async function addUser(user) {
  await userCollection.insertOne(user);
}

async function updateUser(user) {
  await userCollection.updateOne({ email: user.email }, { $set: user });
}

async function removeUserToken(user) {
  await userCollection.updateOne({ email: user.email }, { $unset: { token: '' } });
}

// GAMES
async function addGame(game) {
  await gameCollection.insertOne(game);
}

async function updateGame(game) {
  await gameCollection.updateOne({ id: game.id }, { $set: game }, { upsert: true });
}

function getGame(id) {
  return gameCollection.findOne({ id });
}

function getAllGames() {
  return gameCollection.find({}).toArray();
}

module.exports = {
  getUser,
  getUserByToken,
  addUser,
  updateUser,
  removeUserToken,
  addGame,
  updateGame,
  getGame,
  getAllGames,
};
