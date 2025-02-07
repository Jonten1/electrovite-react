import { useState } from 'react';
import Login from './Login';
import Phone from './Phone';

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

  return (
    <div className='app'>
      {credentials ? (
        <Phone credentials={credentials} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
