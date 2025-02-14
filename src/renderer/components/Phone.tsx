import { useState, useEffect } from 'react';
import JsSIP from 'jssip';
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
  const [userAgent, setUserAgent] = useState<JsSIP.UA | null>(null);
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [isInCall, setIsInCall] = useState(false);
  const [isIncoming, setIsIncoming] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<JsSIP.Session | null>(null);

  useEffect(() => {
    const initializeJsSIP = () => {
      try {
        // Configure socket for multiple connections
        const socket = new JsSIP.WebSocketInterface(
          `wss://${credentials.server}/w1/websocket`,
        );
        const configuration = {
          sockets: [socket],
          uri: `sip:${credentials.username}`,
          password: credentials.password,
          register: true,
          register_expires: 30,
          connection_recovery_min_interval: 2,
          connection_recovery_max_interval: 30,
          contact_uri: `sip:${
            credentials.username
          };transport=ws;instance-id=${Math.random()
            .toString(36)
            .substring(2)}`,
          session_timers: false,
        };

        const ua = new JsSIP.UA(configuration);

        ua.on('newRTCSession', (data) => {
          const session = data.session;
          setSession(session);

          if (session.direction === 'incoming') {
            const number = session.remote_identity.uri.user;
            setCallerNumber(number);
            setIsIncoming(true);
            setIsInCall(true);
            setStatus(`Incoming call from ${number}`);

            session.on('ended', () => {
              setIsInCall(false);
              setIsIncoming(false);
              setStatus('Ready');
              setCallStartTime(null);
            });

            session.on('failed', () => {
              setIsInCall(false);
              setIsIncoming(false);
              setStatus('Ready');
              setCallStartTime(null);
              window.electron.Notification.close();
            });

            session.on('canceled', () => {
              setIsInCall(false);
              setIsIncoming(false);
              setStatus('Ready');
              setCallStartTime(null);
              window.electron.Notification.close();
            });

            session.on('accepted', () => {
              setIsIncoming(false);
              setStatus('In call');
              setCallStartTime(new Date());
            });

            window.electron.Notification.create('Incoming Call', {
              body: `From ${number}`,
            });
          }
        });

        ua.on('registered', () => setStatus('Registered'));
        ua.on('unregistered', () => setStatus('Unregistered'));
        ua.on('registrationFailed', () => setStatus('Registration failed'));

        ua.start();
        setUserAgent(ua);
        setStatus('Connecting...');
      } catch (error) {
        console.error('JsSIP initialization error:', error);
        setStatus('Connection failed');
      }
    };

    initializeJsSIP();

    return () => {
      if (userAgent) {
        userAgent.stop();
      }
    };
  }, [credentials, session]);

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

  const handleHangup = () => {
    if (session) {
      try {
        session.terminate();
        setIsInCall(false);
        setStatus('Ready');
        setCallStartTime(null);
        setIsIncoming(false);
      } catch (error) {
        console.error('Hangup error:', error);
      }
    }
  };

  const handleAnswer = () => {
    if (session) {
      try {
        const options = {
          mediaConstraints: { audio: true, video: false },
        };
        session.answer(options);
        window.electron.Notification.close();
        setIsIncoming(false);
        setStatus('In call');
        setCallStartTime(new Date());
      } catch (error) {
        console.error('Answer error:', error);
        setStatus('Failed to answer');
      }
    }
  };

  const handleReject = () => {
    if (session) {
      try {
        session.terminate({ status_code: 486 }); // Busy Here
        setIsIncoming(false);
        setIsInCall(false);
        setStatus('Ready');
      } catch (error) {
        console.error('Reject error:', error);
      }
    }
  };

  const handleKeyPress = (key: string) => {
    setNumber((prev) => prev + key);
  };

  const handleTransfer = async (targetExtension: string) => {
    if (!session || !callerNumber) {
      console.error('Cannot transfer: no active session or caller number');
      return;
    }

    console.log(`📞 Transferring call to ${targetExtension}`);
    setStatus('Transferring call...');

    try {
      const transferTarget = `sip:${targetExtension}@voip.46elks.com`;

      // Set up REFER event handlers before sending the request
      session.on('refer', (data) => {
        console.log('Transfer REFER event:', data);
      });

      const referSubscriber = await session.refer(transferTarget, {
        extraHeaders: [
          `Referred-By: <sip:${credentials.username}@voip.46elks.com>`,
        ],
      });

      referSubscriber.on('requestSucceeded', () => {
        console.log('Transfer request accepted');
      });

      referSubscriber.on('notify', (notification) => {
        console.log('Transfer status:', notification);
        const status = notification.status_line.status_code;

        if (status === 200) {
          setStatus('Transfer successful');
          // Only terminate our session after transfer is complete
          session.terminate();
        } else if (status >= 300) {
          setStatus('Transfer failed');
          console.error('Transfer failed with status:', status);
        }
      });

      referSubscriber.on('failed', (response) => {
        console.error('Transfer failed:', response);
        setStatus('Transfer failed');
      });
    } catch (error) {
      console.error('Transfer error:', error);
      setStatus('Transfer failed');
    }
  };

  const handleMuteToggle = async () => {
    if (!userAgent || !userAgent.isConnected()) return;

    try {
      const session = userAgent.sessions[0];
      const sessionDescriptionHandler = session.descriptionHandler;

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
        await userAgent.stop();
        setUserAgent(null);
      }

      // Re-initialize JsSIP connection
      const ua = new JsSIP.UA({
        uri: `sip:${credentials.username}`,
        password: credentials.password,
        register: true,
        register_expires: 30,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
        contact_uri: `sip:${
          credentials.username
        };transport=ws;instance-id=${Math.random().toString(36).substring(2)}`,
        session_timers: false,
      });

      ua.on('registered', () => setStatus('Registered'));
      ua.on('unregistered', () => setStatus('Unregistered'));
      ua.on('registrationFailed', () => setStatus('Registration failed'));

      ua.on('newRTCSession', (data) => {
        const session = data.session;

        if (session.direction === 'incoming') {
          const number = session.remote_identity.uri.user;
          setCallerNumber(number);
          setIsIncoming(true);
          setIsInCall(true);
          setStatus(`Incoming call from ${number}`);

          session.on('ended', () => {
            setIsInCall(false);
            setIsIncoming(false);
            setStatus('Ready');
            setCallStartTime(null);
          });

          session.on('failed', () => {
            setIsInCall(false);
            setIsIncoming(false);
            setStatus('Ready');
            setCallStartTime(null);
            window.electron.Notification.close();
          });

          session.on('canceled', () => {
            setIsInCall(false);
            setIsIncoming(false);
            setStatus('Ready');
            setCallStartTime(null);
            window.electron.Notification.close();
          });

          session.on('accepted', () => {
            setIsIncoming(false);
            setStatus('In call');
            setCallStartTime(new Date());
          });

          window.electron.Notification.create('Incoming Call', {
            body: `From ${number}`,
          });
        }
      });

      ua.start();
      setUserAgent(ua);
      setStatus('Connecting...');
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
