import React from 'react';

import Button from 'react-bootstrap/Button';
import { MessageDialog } from './messageDialog';

export function Unauthenticated(props) {
  const [userName, setUserName] = React.useState(props.userName || '');
  const [password, setPassword] = React.useState('');
  const [displayError, setDisplayError] = React.useState(null);

  async function loginUser() {
    if (!userName || !password) {
      setDisplayError('Please enter a name and password.');
      return;
    }
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: userName, password: password }),
        headers: { 'content-type': 'application/json' },
      });

      if (response.ok) {
        localStorage.setItem('userName', userName);
        props.onLogin(userName);
      } else {
        const body = await response.json();
        setDisplayError(body.message || 'Login failed');
      }
    } catch (err) {
      setDisplayError('Login error');
    }
  }

  async function createUser() {
    if (!userName || !password) {
      setDisplayError('Please enter a name and password.');
      return;
    }
    try {
      const response = await fetch('/api/auth/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: userName, password: password }),
      });

      if (response.ok) {
        localStorage.setItem('userName', userName);
        props.onLogin(userName);
      } else {
        setDisplayError('Create account failed');
      }
    } catch {
      setDisplayError('Error creating account');
    }
  }

  return (
    <main>
        <section>
            <h2>Login or Create Account</h2>
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">
                  Player Name
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="form-control"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-center gap-2">
                <Button
                  type="button"
                  name="action"
                  value="first"
                  onClick={() => loginUser()}
                  disabled={!userName || !password}
                >
                  Login
                </Button>
                <Button
                  type="button"
                  name="action"
                  value="second"
                  onClick={() => createUser()}
                  disabled={!userName || !password}
                >
                  Create
                </Button>
              </div>
            </form>
        </section>

        <MessageDialog message={displayError} onHide={() => setDisplayError(null)} />
    </main>
  );
}
