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

  const handleLogin = (creds: {
    username: string;
    password: string;
    server: string;
  }) => {
    setCredentials(creds);
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
