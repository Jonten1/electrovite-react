import { useState } from 'react';

interface LoginProps {
  onLogin: (credentials: {
    username: string;
    password: string;
    server: string;
  }) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ username, password, server });
  };

  return (
    <div className='login-container'>
      <form onSubmit={handleSubmit}>
        <h2>SIP Login</h2>
        <div className='input-group'>
          <label>Username:</label>
          <input
            type='text'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder='SIP Username'
          />
        </div>
        <div className='input-group'>
          <label>Password:</label>
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='SIP Password'
          />
        </div>
        <div className='input-group'>
          <label>SIP Server:</label>
          <input
            type='text'
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder='e.g., voip.46elks.com'
          />
        </div>
        <button type='submit'>Login</button>
      </form>
    </div>
  );
};

export default Login;
