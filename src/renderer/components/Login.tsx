import { useState } from 'react';

interface LoginProps {
  onLogin: (credentials: {
    username: string;
    password: string;
    server: string;
  }) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('4600120060');
  const [password, setPassword] = useState('9660A96589A18CC4ED49C5DA63A6C669');
  const [server, setServer] = useState('voip.46elks.com/w1/websocket');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({
      username: username + '@voip.46elks.com',
      password,
      server: 'voip.46elks.com', // Remove /w1/websocket from server for SIP registration
    });
  };

  return (
    <div className='login-container'>
      <form onSubmit={handleSubmit}>
        <h2>WebRTC SIP Login</h2>
        <div className='input-group'>
          <label>Username:</label>
          <input
            type='text'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder='WebRTC Username'
          />
        </div>
        <div className='input-group'>
          <label>Password:</label>
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='WebRTC Password'
          />
        </div>
        <button type='submit'>Connect</button>
      </form>
    </div>
  );
};

export default Login;
