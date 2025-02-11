import { useState, useEffect } from 'react';
import { UserAgent, Web } from 'sip.js';
import '../styles/phone.scss';
import CallInfo from './CallInfo';
import OnlineUsers from './OnlineUsers';
import StatusBar from './StatusBar';

interface PhoneProps {
  credentials: {
    username: string;
    password: string;
    server: string;
  };
  onLogout: () => void;
}

declare global {
  interface Window {
    electron: {
      Notification: {
        create: (title: string, options: NotificationOptions) => Notification;
      };
      focusWindow: () => void;
      SIP: {
        getStatus: (credentials: any) => Promise<any>;
      };
    };
  }
}

const Phone = ({ credentials, onLogout }: PhoneProps) => {
  const [userAgent, setUserAgent] = useState<Web.SimpleUser | null>(null);
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [isInCall, setIsInCall] = useState(false);
  const [isIncoming, setIsIncoming] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

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
          onCallReceived: async () => {
            if (!simpleUser.session) return;

            const formattedNumber =
              simpleUser.session?.remoteIdentity?.uri?.user || 'Unknown';

            // Create system notification
            window.electron.Notification.create('Incoming Call', {
              body: `From ${formattedNumber}`,
            });

            setIsIncoming(true);
            setIsInCall(true);
            setCallerNumber(formattedNumber);
            setStatus(`Incoming call from ${formattedNumber}`);
            setCallStartTime(null);
          },
          onCallHangup: () => {
            window.electron.Notification.close();
            setIsIncoming(false);
            setIsInCall(false);
            setStatus('Ready');
            setCallStartTime(null);
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
          onRefer: async (referral) => {
            try {
              setStatus('Receiving transfer...');
              await referral.accept();
              setIsInCall(true);
              setCallStartTime(new Date());

              // Get the transferred number
              const transferredNumber = referral.referTo?.normal?.user;
              if (transferredNumber) {
                setCallerNumber(transferredNumber);
              }

              setStatus('Call transferred successfully');
            } catch (error) {
              console.error('Transfer receive error:', error);
              setStatus('Transfer failed');
            }
          },
          onReferred: () => {
            setStatus('Call being transferred...');
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

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const response = await fetch('http://localhost:5000/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: credentials.username,
          }),
        });

        const data = await response.json();
        setOnlineUsers(data.activeUsers);
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };

    const heartbeatInterval = setInterval(sendHeartbeat, 10000);
    sendHeartbeat();

    return () => clearInterval(heartbeatInterval);
  }, [credentials]);

  const handleCall = async () => {
    if (!number) return;
    try {
      const response = await fetch('http://localhost:5000/make-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: number,
          webrtcNumber: credentials.username.split('@')[0], // This gets the '4600120060' part
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }

      setIsInCall(true);
      setStatus('Calling...');
      setCallStartTime(new Date());
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
      window.electron.Notification.close();
      setIsIncoming(false);
      setStatus('In call');
      setCallStartTime(new Date());
    } catch (error) {
      console.error('Answer error:', error);
      setStatus('Failed to answer');
    }
  };

  const handleReject = async () => {
    if (!userAgent) return;
    try {
      await userAgent.hangup();
      setIsIncoming(false);
      setIsInCall(false);
      setStatus('Ready');
    } catch (error) {
      console.error('Reject error:', error);
    }
  };

  const handleKeyPress = (key: string) => {
    setNumber((prev) => prev + key);
  };

  const handleTransfer = async (targetExtension: string) => {
    if (!userAgent || !userAgent.isConnected()) return;

    try {
      const target = UserAgent.makeURI(`4600120059@voip.46elks.com}`);
      console.log('Target:', target);
      if (!target) {
        throw new Error('Failed to create target URI');
      }

      if (userAgent.session) {
        await userAgent.session.refer(target);
        setStatus('Transferring call...');

        setTimeout(() => {
          setIsInCall(false);
          setStatus('Call transferred');
        }, 1000);
      }
    } catch (error) {
      console.error('Transfer error:', error);
      setStatus('Transfer failed');
    }
  };

  const handleMuteToggle = async () => {
    if (!userAgent || !userAgent.session) return;

    try {
      const session = userAgent.session;
      const sessionDescriptionHandler = session.sessionDescriptionHandler;

      if (sessionDescriptionHandler && 'mute' in sessionDescriptionHandler) {
        if (isMuted) {
          await sessionDescriptionHandler.unmute();
        } else {
          await sessionDescriptionHandler.mute();
        }
        setIsMuted(!isMuted);
      }
    } catch (error) {
      console.error('Mute toggle error:', error);
    }
  };

  const handleReconnect = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      setStatus('Reconnecting...');

      if (userAgent) {
        await userAgent.disconnect();
        setUserAgent(null);
      }

      // Re-initialize SIP connection
      const [username] = credentials.username.split('@');
      const sipUri = UserAgent.makeURI(`sip:${username}@${credentials.server}`);

      if (!sipUri) {
        throw new Error('Failed to create SIP URI');
      }

      const simpleUser = new Web.SimpleUser(
        `wss://${credentials.server}/w1/websocket`,
        {
          aor: sipUri.toString(),
          media: {
            constraints: { audio: true, video: false },
            iceServers: [
              {
                urls: ['stun:stun.46elks.com:3478'],
              },
            ],
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
            transportOptions: {
              wsServers: [`wss://${credentials.server}/w1/websocket`],
              traceSip: true,
            },
          },
        },
      );

      await simpleUser.connect();
      await simpleUser.register();
      setUserAgent(simpleUser);
      setStatus('Ready');
    } catch (error) {
      console.error('Reconnection error:', error);
      setStatus('Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className='app-container'>
      <OnlineUsers
        users={onlineUsers}
        onUserClick={(user) => {
          if (isInCall) {
            handleTransfer(user.split('@')[0]);
          }
        }}
      />
      <div className='phone-container'>
        <StatusBar
          status={status}
          onLogout={onLogout}
          onReconnect={handleReconnect}
          isConnecting={isConnecting}
        />
        {isIncoming ? (
          <div className='incoming-call'>
            <p>Incoming call from {callerNumber}</p>
            <div className='call-actions'>
              <button className='answer' onClick={handleAnswer}>
                <i className='fas fa-phone'></i>
              </button>
              <button className='reject' onClick={handleReject}>
                <i className='fas fa-phone-slash'></i>
              </button>
            </div>
          </div>
        ) : isInCall ? (
          <CallInfo
            callerNumber={callerNumber}
            startTime={callStartTime}
            onTransfer={handleTransfer}
            onlineUsers={onlineUsers}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
            onEndCall={handleHangup}
          />
        ) : (
          <div className='ready-state'>
            <div>
              <p>Ready to receive calls</p>
              <div className='status'>{status}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Phone;
