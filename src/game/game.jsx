import React from 'react';
import './game.css';
import forestMap from '/forest-map.png';

export function Game({ role, character, selectedGame }) {
  const [socket, setSocket] = React.useState(null);

  const [players, setPlayers] = React.useState([]);
  const [spellUses, setSpellUses] = React.useState(character?.magicStat || 0);
  const [selectedTarget, setSelectedTarget] = React.useState('');
  const [selectedSpellTargets, setSelectedSpellTargets] = React.useState([]);

  const [selectedMonster, setSelectedMonster] = React.useState('');

  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const chatRef = React.useRef(null);
  const [mapImage, setMapImage] = React.useState(forestMap);
  const [mapInput, setMapInput] = React.useState('');

  const [monsters, setMonsters] = React.useState([]);
  const [monsterName, setMonsterName] = React.useState('');
  const [monsterHP, setMonsterHP] = React.useState('');
  const [monsterAttack, setMonsterAttack] = React.useState('');

  const [isFetched, setIsFetched] = React.useState(false);

  React.useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      ws.send(JSON.stringify({
      type: 'join',
      game: selectedGame.name
    }));
    };

    ws.onmessage = async (event) => {
      let msg;

      try {
        if (typeof event.data === 'string') {
          msg = JSON.parse(event.data);
        } else {
          msg = JSON.parse(await event.data.text());
        }
        console.log(msg.type);
      } catch (err) {
        console.error('Bad message: ', err);
        return;
      }

      console.log(msg.type);

      if (role === 'gm') {
        if (msg.type === 'attack') {
          handleAttackFromPlayer(msg);
        }

        if (msg.type === 'spell') {
          handleSpellFromPlayer(msg);
        }
      }

      if (msg.type === 'state') {
        setPlayers(msg.players || []);
        setMonsters(msg.monsters || []);
        setMapImage(msg.mapImage || forestMap);
      }

      if (msg.type === 'chat') {
        setMessages(prev => [...prev.slice(-19), msg]);
      }
    };
    
    setSocket(ws);

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
    };
  }, [selectedGame]);

  React.useEffect(() => {
    async function fetchGameState() {
      const response = await fetch(`/api/game/state/${selectedGame.name}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const state = await response.json();
        setPlayers(state.players || []);
        setMonsters(state.monsters || []);
        setMapImage(state.mapImage || forestMap);
        setMessages(state.messages || []);
      }

      setIsFetched(true);
    }
    fetchGameState();
  }, [selectedGame]);

  React.useEffect(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    if (role !== 'gm') return;

    socket.send(JSON.stringify({
      type: 'state',
      game: selectedGame.name,
      players,
      monsters,
      mapImage,
    }));
  }, [players, monsters, mapImage, socket, role]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!isFetched) return;

      fetch('/api/game/state', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: selectedGame.name,
          players,
          monsters,
          mapImage,
          messages: messages.slice(-20),
        }),
      }).catch(err => console.error('Save failed', err));
    }, 5000);
    return () => clearInterval(interval);
  }, [players, monsters, mapImage, messages]);

  React.useEffect(() => {
    if (character?.magicStat) setSpellUses(character.magicStat);
  }, [character]);

  React.useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function getWeapon(skill) {
    const weapons = [
      { name: 'Punch', dice: 1 },
      { name: 'Dagger', dice: 2 },
      { name: 'Longsword', dice: 3 },
      { name: 'Halberd', dice: 4 },
    ];
    return weapons[skill] || weapons[0];
  }

  function getSpell(magic) {
    const spells = [
      null,
      { name: 'Spark', dice: 2 },
      { name: 'Fire Bolt', dice: 3 },
      { name: 'Fireball', dice: 4 },
    ];
    return spells[magic];
  }

  function rollDice(diceStr) {
    let total = 0;

    const match = diceStr.trim().match(/(\d+)d(\d+)(\+(\d+))?/);
    if (!match) return 0;

    const dice = Number(match[1]);
    const sides = Number(match[2]);
    const bonus = match[4] ? Number(match[4]) : 0;

    for (let i = 0; i < dice; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }

    return total + bonus;
  }

  function handlePlayerAttack(weapon) {
    if (!socket) return;

    socket.send(JSON.stringify({
      type: 'attack',
      game: selectedGame.name,
      attacker: character.name,
      targetIndex: Number(selectedTarget),
      weapon
    }));

    setSelectedTarget('');
  }

  function handleAttackFromPlayer(msg) {
    const { targetIndex, weapon, attacker } = msg;

    const damage = rollDice(`${weapon.dice}d6`);

    setMonsters(prev => {
      const updated = prev
        .map((m,i) => {
          if (i !== targetIndex) return m;

          const newHP = Math.max(0, m.hp - damage);
          return { ...m, hp: newHP };
        })
        .filter(m => m.hp > 0);

        const targetMonster = prev[targetIndex];
        const died = targetMonster && (targetMonster.hp - damage) <= 0;

        if (socket) {
          socket.send(JSON.stringify({
            type: 'state',
            game: selectedGame.name,
            players,
            monsters: updated,
            mapImage,
          }));
        }

        if (socket) {
          const newMessage = {
            sender: attacker,
            text: `${weapon.name} hits ${targetMonster.name} for ${damage} damage!`,
            type: 'chat',
            game: selectedGame.name
          };
          setMessages(prev => [...prev.slice(-19), newMessage]);
          socket.send(JSON.stringify(newMessage));
        }

        if (died && socket) {
          const newMessage = {
            sender: 'System',
            text: `${targetMonster.name} has been defeated!`,
            type: 'chat',
            game: selectedGame.name
          };
          setMessages(prev => [...prev.slice(-19), newMessage]);
          socket.send(JSON.stringify(newMessage));
        }

      return updated;
    });
  }

  function handleSpellCast(spell) {
    if (spellUses <= 0) return;
    if (!socket) return;

    socket.send(JSON.stringify({
      type: 'spell',
      game: selectedGame.name,
      caster: character.name,
      targets: selectedSpellTargets,
      spell
    }));

    setSelectedSpellTargets([]);
  }

  function handleSpellFromPlayer(msg) {
    const { targets, spell, caster } = msg;

    setMonsters(prev => {
      let updated = [...prev];

      targets.forEach(index => {
        const monster = updated[index];
        if (!monster) return;

        const damage = rollDice(`${spell.dice}d6`);
        const newHP = Math.max(0, monster.hp - damage);

        if (socket) {
          const newMessage = {
            sender: caster,
            text: `${spell.name} hits ${monster.name} for ${damage} damage!`,
            type: 'chat',
            game: selectedGame.name
          };
          setMessages(prev => [...prev.slice(-19), newMessage]);
          socket.send(JSON.stringify(newMessage));
        }

        updated[index] = { ...monster, hp: newHP };
      });

      updated = updated.filter(m => m.hp > 0);

      targets.forEach(index => {
        const monster = prev[index];
        if (!monster) return;
        if (monster.hp > 0 && updated.every(u => u.name !== monster.name && socket)) {
          const newMessage = {
            sender: 'System',
            text: `${monster.name} has been defeated!`,
            type: 'chat',
            game: selectedGame.name
          };
          setMessages(prev => [...prev.slice(-19), newMessage]);
          socket.send(JSON.stringify(newMessage));
        }
      });

      if (socket) {
        socket.send(JSON.stringify({
          type: 'state',
          game: selectedGame.name,
          players,
          monsters: updated,
          mapImage,
        }));
      }

      return updated;
    });
  }

  function handleMonsterAttack() {
    if (selectedTarget === '' || selectedMonster === '') return;

    const monsterIndex = Number(selectedMonster);
    const targetIndex = Number(selectedTarget);

    const monster = monsters[monsterIndex];
    const targetPlayer = players[targetIndex];

    if (!monster || !targetPlayer) return;

    const damage = rollDice(monster.attack);
    const newHP = Math.max(0, targetPlayer.character.currentHP - damage);

    setPlayers(prev =>
      prev.map((p, i) =>
        i === targetIndex 
          ? {
            ...p,
            character: {
              ...p.character,
              currentHP: Math.max(0, p.character.currentHP - damage),
            }
          }
        : p
      )
    );

    if (socket) {
      const newMessage = {
        sender: monster.name,
        text: `${monster.name} attacks ${targetPlayer.character?.name || targetPlayer.playerName} for ${damage} damage!`,
        type: 'chat',
        game: selectedGame.name
      };
      setMessages(prev => [...prev.slice(-19), newMessage]);
      socket.send(JSON.stringify(newMessage));
    }

    if (newHP <= 0) {
      const newMessage = {
        sender: 'System',
        text: `${targetPlayer.character?.name || targetPlayer.playerName} has been defeated!`,
        type: 'chat',
        game: selectedGame.name
      };
      setMessages(prev => [...prev.slice(-19), newMessage]);
      socket.send(JSON.stringify(newMessage));
    }

    if (socket) {
      socket.send(JSON.stringify({
        type: 'state',
        game: selectedGame.name,
        players,
        monsters,
        mapImage,
      }));
    }

    setSelectedTarget('');
    setSelectedMonster('');
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const senderName =
      role === 'gm'
        ? 'GM'
        : character?.name || 'Player';

    const newMessage = {
      sender: senderName,
      text: input.trim(),
      type: 'chat',
      game: selectedGame.name
    };
    setMessages(prev => [...prev.slice(-19), newMessage]);
    socket.send(JSON.stringify(newMessage));

    await fetch('/api/game/state', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: selectedGame.name,
        messages: [...messages, newMessage]
      })
    });

    setInput('');
  }

  async function getRandomMonsterName() {
    try {
      const res = await fetch('https://api.open5e.com/monsters/');
      const data = await res.json();
      const monsters = data.results;
      const randomMonster = monsters[Math.floor(Math.random() * monsters.length)];
      setMonsterName(randomMonster.name);
    } catch (err) {
      console.error(err);
      alert('Could not fetch monster name');
    }
  }


  const weapon = character ? getWeapon(character.skillStat) : null;
  const spell = character ? getSpell(character.magicStat) : null;


  return (
    <main>
      <div className="container">
        <h2 className="mb-3">
          {selectedGame?.name} — {role === 'gm' ? 'Game Master' : 'Adventurer'}
        </h2>

        <div className="row g-4">

          {/* Column 1: Party */}
          <aside className="col-lg-4">
            <section className="framed">
              <h2>Party</h2>

              {role === 'gm' && players.map((p, i) => (
                <div key={i} className="party-member">
                  {p.character ? (
                    <>
                      <div>HP: {p.character.currentHP} / {p.character.maxHP}</div>
                      <div>Skill: {p.character.skillStat}</div>
                      <div>Magic: {p.character.magicStat}</div>
                    </>
                  ) : (
                    <div><em>No character yet</em></div>
                  )}
                </div>
              ))}
              
              {role === 'player' && character && (
                <div className="party-member">
                  <strong>{character.name}</strong>
                  <div>
                    HP: {character.currentHP} / {character.maxHP}
                  </div>
                  <div>
                    Skill: {character.skillStat}
                  </div>
                  {weapon && (
                    <div>
                      ⚔ Attack: {weapon.name} ({weapon.dice}d6)

                      {monsters.length > 0 && (
                        <>
                          <select
                            className="form-select form-select-sm my-1"
                            value={selectedTarget}
                            onChange={(e) => setSelectedTarget(e.target.value)}
                          >
                            <option value="">Choose target</option>
                            {monsters.map((m, i) => (
                              <option key={i} value={i}>
                                {m.name} (HP: {m.hp})
                              </option>
                            ))}
                          </select>

                          <button
                            name="action"
                            value="first"
                            disabled={!selectedTarget}
                            onClick={() => handlePlayerAttack(weapon)}
                          >
                            Use
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div>
                    Magic: {character.magicStat}
                  </div>

                  {spell && (
                    <div className="mt-2">
                      🔮 Spell: {spell.name} ({spell.dice}d6)
                      <span className="ms-2">
                        Uses: {spellUses} / {character.magicStat}
                      </span>

                      <div className="spell-targets mt-1">
                        {monsters.map((m, i) => (
                          <label key={i} className="d-block">
                            <input
                              type="checkbox"
                              value={i}
                              checked={selectedSpellTargets.includes(i)}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                if (selectedSpellTargets.includes(value)) {
                                  setSelectedSpellTargets(prev => prev.filter(v => v !== value));
                                } else if (selectedSpellTargets.length < 2) {
                                  setSelectedSpellTargets(prev => [...prev, value]);
                                }
                              }}
                            />
                            <span>{m.name} (HP: {m.hp})</span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <button
                          name="action"
                          value="first"
                          disabled={spellUses <= 0 || selectedSpellTargets.length === 0}
                          onClick={() => handleSpellCast(spell)}
                        >
                          Cast
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {role === 'gm' && (
                <div className="party-member">
                  <em>Waiting for players to join...</em>
                </div>
              )}
            </section>
          </aside>

          {/* Column 2: Adventure Area */}
          <div className="col-lg-8">
            <section className="framed">
              <img
                src={mapImage}
                onError={() => setMapImage(forestMap)}
                alt="adventure map"
                className="img-fluid rounded adventure-map"
              />
            </section>
            {role === 'gm' && (
              <section className="mt-3 framed">
                <h4>Change Map</h4>
                <form
                  className="d-flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!mapInput.trim()) return;
                    setMapImage(mapInput.trim());
                    setMapInput('');
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Paste image URL"
                    value={mapInput}
                    onChange={(e) => setMapInput(e.target.value)}
                  />
                  <button 
                    type="submit"
                    name="action"
                    value="first"
                  >
                    Update
                  </button>
                </form>
              </section>
            )}

            {role === 'gm' && (
              <section className="mt-3 framed">
                <h4>Create Monster</h4>
                <form
                  className="row g-2 align-items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!monsterName || !monsterHP || !monsterAttack) return;

                    setMonsters((prev) => [
                      ...prev,
                      {
                        name: monsterName,
                        hp: Number(monsterHP),
                        attack: monsterAttack,
                      },
                    ]);

                    setMonsterName('');
                    setMonsterHP('');
                    setMonsterAttack('');
                  }}
                >
                  <div className="col-4">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={monsterName}
                      onChange={(e) => setMonsterName(e.target.value)}
                      placeholder="Monster Name"
                    />
                    <button
                      type="button"
                      name="action"
                      value="second"
                      onClick={getRandomMonsterName}
                    >
                      Random
                    </button>
                  </div>
                  <div className="col-4">
                    <label className="form-label">HP</label>
                    <input
                      type="number"
                      className="form-control"
                      value={monsterHP}
                      onChange={(e) => setMonsterHP(e.target.value)}
                      placeholder="Health"
                      min="1"
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label">Attack</label>
                    <input
                      type="text"
                      className="form-control"
                      value={monsterAttack}
                      onChange={(e) => setMonsterAttack(e.target.value)}
                      placeholder="3d6"
                    />
                  </div>
                  <div className="col-12">
                    <button 
                      type="submit"
                      name="action"
                      value="first"
                    >
                      Add Monster
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="framed mt-3">
              <h3>Monsters</h3>
              {monsters.length === 0 ? (
                <p>No monsters yet.</p>
              ) : (
                <ul className="list-group">
                  {monsters.map((m, i) => (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                      <span>
                        <strong>{m.name}</strong> — HP: {m.hp} — Attack: {m.attack}
                      </span>
                      {role === 'gm' && (
                        <button
                          type="button"
                          name="action"
                          value="second"
                          onClick={() =>
                            setMonsters(monsters.filter((_, index) => index !== i))
                          }
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {role === 'gm' && (
              <section className="mt-3 framed">
                <h4>Attack Player</h4>
                <div className="d-flex gap-2 align-items-end">
                  <select
                    className="form-select"
                    value={selectedMonster}
                    onChange={(e) => setSelectedMonster(e.target.value)}
                  >
                    <option value="">Choose monster</option>
                    {monsters.map((m, i) => (
                      <option key={i} value={i}>{m.name}</option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                  >
                    <option value="">Choose player</option>
                    {players.map((p, i) => (
                      <option key={i} value={i}>{p.character?.name || p.playerName}</option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    name="action"
                    value="first"
                    onClick={handleMonsterAttack}
                    disabled={selectedTarget === '' || selectedMonster === ''}
                  >
                    Attack Player
                  </button>
                </div>
              </section>
            )}


            <section className="mt-3 framed">
              <h3>Party Actions</h3>

              <div
                ref={chatRef}
                className="chat-box mb-2"
              >
                <ul className="list-unstyled mb-0">
                  {messages.map((msg, index) => (
                    <li key={index}>
                      <strong>{msg.sender}:</strong> {msg.text}
                    </li>
                  ))}
                </ul>
              </div>

              <form 
                className="d-flex gap-2"
                onSubmit={handleSend}
              >
                <input
                  type="text"
                  className="form-control"
                  placeholder="Talk to your party"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  name="action"
                  value="first"
                >
                  Send
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
