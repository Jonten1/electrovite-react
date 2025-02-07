import { useState, useEffect } from 'react';
import { UserAgent, Web, URI } from 'sip.js';

interface PhoneProps {
  credentials: {
    username: string;
    password: string;
    server: string;
  };
  onLogout: () => void;
}

const Phone = ({ credentials, onLogout }: PhoneProps) => {
  const [userAgent, setUserAgent] = useState<Web.SimpleUser | null>(null);
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [isInCall, setIsInCall] = useState(false);

  useEffect(() => {
    const initializeSIP = async () => {
      try {
        const uri = `sip:${credentials.username}@${credentials.server}`;
        const wsServer = `wss://${credentials.server}:443/ws`;

        const simpleUser = new Web.SimpleUser(wsServer, {
          aor: uri,
          userAgentOptions: {
            authorizationUsername: credentials.username,
            authorizationPassword: credentials.password,
            displayName: credentials.username,
            uri: new URI(uri),
          },
        });

        await simpleUser.connect();
        await simpleUser.register();
        setUserAgent(simpleUser);
        setStatus('Ready');

        // Handle incoming calls
        simpleUser.delegate = {
          onCallReceived: async () => {
            setIsInCall(true);
            setStatus('Incoming call...');
            // Auto answer for testing - remove in production
            await simpleUser.answer();
          },
          onCallHangup: () => {
            setIsInCall(false);
            setStatus('Ready');
          },
          onRegistered: () => {
            setStatus('Registered');
          },
          onUnregistered: () => {
            setStatus('Unregistered');
          },
          onServerConnect: () => {
            setStatus('Connected to server');
          },
          onServerDisconnect: () => {
            setStatus('Disconnected from server');
          },
        };
      } catch (error) {
        console.error('SIP initialization error:', error);
        setStatus('Connection failed');
      }
    };

    initializeSIP();

    // Cleanup on unmount
    return () => {
      if (userAgent) {
        userAgent.disconnect();
      }
    };
  }, [credentials]);

  const handleCall = async () => {
    if (!userAgent || !number) return;
    try {
      await userAgent.call(`sip:${number}@${credentials.server}`);
      setIsInCall(true);
      setStatus('Calling...');
    } catch (error) {
      console.error('Call error:', error);
      setStatus('Call failed');
    }
  };

  const handleHangup = async () => {
    if (!userAgent) return;
    try {
      await userAgent.hangup();
      setIsInCall(false);
      setStatus('Ready');
    } catch (error) {
      console.error('Hangup error:', error);
    }
  };

  return (
    <div className='phone-container'>
      <div className='status-bar'>
        <span>{status}</span>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className='dialer'>
        <input
          type='tel'
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder='Enter phone number'
          disabled={isInCall}
        />

        {isInCall ? (
          <button className='hangup' onClick={handleHangup}>
            Hang up
          </button>
        ) : (
          <button className='call' onClick={handleCall} disabled={!number}>
            Call
          </button>
        )}
      </div>
    </div>
  );
};

export default Phone;
