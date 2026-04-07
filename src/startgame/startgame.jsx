import React from 'react';
import { useNavigate } from 'react-router-dom';

export function StartGame({ onGameSelect, setRole, character }) {
  const navigate = useNavigate();
  const [adventure, setAdventure] = React.useState('');

  async function handleAction(type){
    if (!adventure.trim()) return;

    const gameData = {
      player: localStorage.getItem('userName'),
      character: character,
      name: adventure,
    };

    try {
      if (type === 'create') {
        const response = await fetch('/api/game', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(gameData),
        });

        if (response.ok) {
          localStorage.setItem('gameName', adventure);
          setRole('gm');
          onGameSelect({ name: adventure });
          navigate('/game');
        } else {
          const text = await response.text();
          console.error('Create failed:', text);
        }
      }

      if (type === 'join') {
        const response = await fetch('/api/game/join', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(gameData),
        });

        if (response.ok) {
          const data = await response.json();

          localStorage.setItem('gameName', adventure);
          setRole(data.role);
          onGameSelect({ name: adventure });

          if (data.role === 'gm') {
            navigate('/game');
            return;
          }
          if (data.character) {
            navigate('/game');
          } else {
            navigate('/character');
          }
        }
      }
    } catch (err) {
      console.error(err);
  }
}

  return (
    <main>
      <section>
        <h2>Welcome to adventure!</h2>
        <form onSubmit={(e) =>e.preventDefault()} className="row g-3 align-items-end">
          <div className="col-12 col-md-8">
            <label htmlFor="adventure-name" className="form-label">
              Adventure
            </label>
            <input
              id="adventure-name"
              name="adventure"
              type="text"
              className="form-control"
              placeholder="Enter the game name"
              value={adventure}
              onChange={(e) => setAdventure(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-4 d-flex gap-2">
            <button
              type="button"
              name="action"
              value="first"
              className="btn btn-primary"
              onClick={() => handleAction('join')}
              disabled={!adventure}
            >
              Join
            </button>

            <button
              type="button"
              name="action"
              value="second"
              className="btn btn-outline-secondary"
              onClick={() => handleAction('create')}
              disabled={!adventure}
            >
              Create
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
