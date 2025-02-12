import { useState, useEffect } from 'react';
import Login from './Login';
import Phone from './Phone';
import StatusBar from './StatusBar';

const App = () => {
  const [credentials, setCredentials] = useState<null | {
    username: string;
    password: string;
    server: string;
  }>(null);

  useEffect(() => {
    const savedCredentials = localStorage.getItem('credentials');
    if (savedCredentials) {
      const creds = JSON.parse(savedCredentials);
      // Make login request to backend with saved credentials
      fetch(window.electron.env.API_URL + '/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
        }),
        credentials: 'include', // Important for session cookie
      })
        .then((res) => {
          if (res.ok) {
            setCredentials(creds);
          } else {
            localStorage.removeItem('credentials');
          }
        })
        .catch((error) => {
          console.error('Login error:', error);
          localStorage.removeItem('credentials');
        });
    }
  }, []);

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
        credentials: 'include',
      });

      if (response.ok) {
        localStorage.setItem('credentials', JSON.stringify(creds));
        setCredentials(creds);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(window.electron.env.API_URL + '/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      localStorage.removeItem('credentials');
      setCredentials(null);
    }
  };

  return credentials ? (
    <Phone credentials={credentials} onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
};

export default App;
