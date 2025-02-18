import { useState } from 'react';
import '../styles/login.scss';

interface LoginProps {
  onLogin: (credentials: {
    username: string;
    password: string;
    server: string;
  }) => void;
}

declare global {
  interface Window {
    electron: {
      env: {
        USERNAME: string;
        PASSWORD: string;
        SERVER_URL: string;
        WS_PROTOCOL: string;
      };
    };
  }
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState(window.electron.env.USERNAME);
  const [password, setPassword] = useState(window.electron.env.PASSWORD);
  const [server] = useState('voip.46elks.com');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({
      username: username + '@voip.46elks.com',
      password,
      server,
    });
  };

  return (
    <div className='login-wrapper'>
      <div className='login-container'>
        <div className='login-header'>
          <h1>46elks WebPhone</h1>
          <p>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className='login-form'>
          <div className='form-group'>
            <label htmlFor='username'>Username</label>
            <input
              id='username'
              type='text'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder='Enter your username'
            />
          </div>
          <div className='form-group'>
            <label htmlFor='password'>Password</label>
            <input
              id='password'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Enter your password'
            />
          </div>
          <button type='submit' className='login-button'>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
