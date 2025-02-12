import { useState } from 'react';
import Login from './Login';
import Phone from './Phone';

const App = () => {
  const [credentials, setCredentials] = useState<null | {
    username: string;
    password: string;
    server: string;
  }>(null);

  const handleLogin = async (creds: {
    username: string;
    password: string;
    server: string;
  }) => {
    try {
      const response = await fetch(window.electron.env.API_URL + '/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
        }),
      });

      if (response.ok) {
        setCredentials(creds);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => {
    setCredentials(null);
  };

  return credentials ? (
    <Phone credentials={credentials} onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
};

export default App;
