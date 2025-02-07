import { useState, useEffect } from 'react';
import Login from './Login';
import Phone from './Phone';

const App = () => {
  const [credentials, setCredentials] = useState<null | {
    username: string;
    password: string;
    server: string;
  }>(null);

  useEffect(() => {
    fetch('http://localhost:5000/numbers')
      .then((res) => res.json())
      .then((data) => console.log(data))
      .catch((error) => console.error('Error fetching numbers:', error));
  }, []);

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
