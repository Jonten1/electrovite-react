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
  const [isIncoming, setIsIncoming] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');

  useEffect(() => {
    const initializeSIP = async () => {
      try {
        console.log('Credentials:', credentials); // Debug log

        const [username] = credentials.username.split('@');

        const sipUri = UserAgent.makeURI(
          `sip:${username}@${credentials.server}`,
        );

        if (!sipUri) {
          throw new Error('Failed to create SIP URI');
        }

        const simpleUser = new Web.SimpleUser(
          `wss://${credentials.server}/w1/websocket`,
          {
            aor: sipUri.toString(),
            media: {
              constraints: { audio: true, video: false },
              // Add ICE servers for WebRTC
              iceServers: [
                {
                  urls: ['stun:stun.46elks.com:3478'],
                },
              ],
              // Enable PSTN interop
              rtcConfiguration: {
                iceTransportPolicy: 'all',
                bundlePolicy: 'balanced',
              },
            },
            userAgentOptions: {
              authorizationUsername: username,
              authorizationPassword: credentials.password,
              displayName: username,
              uri: sipUri,
              // Add transport options
              transportOptions: {
                wsServers: [`wss://${credentials.server}/w1/websocket`],
                traceSip: true, // For debugging
              },
            },
          },
        );

        await simpleUser.connect();
        await simpleUser.register();
        setUserAgent(simpleUser);
        setStatus('Ready');

        // Log registration state changes
        simpleUser.delegate = {
          onCallReceived: async (session) => {
            console.log('Incoming call session:', session); // Debug log
            setIsIncoming(true);
            setIsInCall(true);
            // Handle both SIP and PSTN numbers
            const incomingNumber = session.remoteIdentity.uri.user || 'Unknown';
            setCallerNumber(
              incomingNumber.startsWith('+')
                ? incomingNumber
                : `+${incomingNumber}`,
            );
            setStatus(`Incoming call from ${incomingNumber}`);
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

  const handleAnswer = async () => {
    if (!userAgent) return;
    try {
      await userAgent.answer();
      setIsIncoming(false);
      setStatus('In call');
    } catch (error) {
      console.error('Answer error:', error);
      setStatus('Failed to answer');
    }
  };

  const handleReject = async () => {
    if (!userAgent) return;
    try {
      await userAgent.reject();
      setIsIncoming(false);
      setIsInCall(false);
      setStatus('Ready');
    } catch (error) {
      console.error('Reject error:', error);
    }
  };

  return (
    <div className='phone-container'>
      <div className='status-bar'>
        <span>{status}</span>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className='dialer'>
        {isIncoming ? (
          <div className='incoming-call'>
            <p>Incoming call from {callerNumber}</p>
            <div className='call-actions'>
              <button className='answer' onClick={handleAnswer}>
                Answer
              </button>
              <button className='reject' onClick={handleReject}>
                Reject
              </button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Phone;
