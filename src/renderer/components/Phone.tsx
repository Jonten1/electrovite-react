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
        close: () => void;
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
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const initializeJsSIP = () => {
      try {
        const socket = new JsSIP.WebSocketInterface(
          `wss://${credentials.server}/w1/websocket`,
        );

        const instanceId = credentials.username.split('@')[0];

        const configuration = {
          sockets: [socket],
          uri: `sip:${credentials.username}`,
          password: credentials.password,
          register: true,
          register_expires: 10,
          connection_recovery_min_interval: 2,
          connection_recovery_max_interval: 30,
          contact_uri: `sip:${credentials.username};transport=ws;instance-id=${instanceId}`,
          session_timers: false,
          register_retry_delay: 2,
          media: {
            constraints: { audio: true, video: false },
            iceServers: [{ urls: ['stun:stun.46elks.com:3478'] }],
            rtcConfiguration: {
              iceTransportPolicy: 'all',
              bundlePolicy: 'balanced',
              rtcpMuxPolicy: 'require',
              enableDtlsSrtp: true,
              dtlsRole: 'auto',
            },
          },
        };

        const ua = new JsSIP.UA(configuration);

        ua.on('registered', () => {
          console.log('SIP Registration successful');
          setStatus('Registered');
        });

        ua.on('registrationFailed', (error) => {
          console.error('Registration failed:', error);
          setStatus('Registration failed');
        });

        ua.on('newRTCSession', (data) => {
          const session = data.session;
          setSession(session);
          console.log('Session:', session);

          if (session.direction === 'incoming') {
            const number = session.remote_identity.uri.user;

            // Set all incoming call states together
            const setIncomingCallState = (isActive: boolean) => {
              setCallerNumber(isActive ? number : '');
              setIsIncoming(isActive);
              setIsInCall(isActive);
              setStatus(isActive ? `Incoming call from ${number}` : 'Ready');
              setCallStartTime(null);

              // Close notification when call is no longer active
              if (!isActive) {
                window.electron.Notification.close();
              }
            };

            // Initial incoming call state
            setIncomingCallState(true);

            // Set up all session event handlers
            session.on('ended', () => setIncomingCallState(false));
            session.on('failed', () => setIncomingCallState(false));
            session.on('canceled', () => setIncomingCallState(false));

            session.on('accepted', () => {
              setIsIncoming(false);
              setStatus('In call');
              setCallStartTime(new Date());
              window.electron.Notification.close(); // Close notification when call is accepted
            });

            // Show notification
            window.electron.Notification.create('Incoming Call', {
              body: `From ${number}`,
            });
          }
        });

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
  }, [credentials]);

  useEffect(() => {
    // Check if we're running locally or need to use ngrok
    const wsUrl = `${window.electron.env.WS_PROTOCOL}://${window.electron.env.SERVER_URL}/ws`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WebSocket] Connected to:', wsUrl);
      socket.send(
        JSON.stringify({
          type: 'login',
          username: credentials.username,
        }),
      );
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[WebSocket] Received:', data);
      if (data.type === 'onlineUsers') {
        setOnlineUsers(data.users);
      }
      if (data.type === 'callStatus') {
        setStatus(data.status);
      }
      if (data.type === 'reregister') {
        setStatus('Re-registering...');
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      setStatus('WebSocket Error');
    };

    setWs(socket);

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [credentials.username]);

  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'callStatus',
          username: credentials.username,
          inCall: isInCall,
        }),
      );
    }
  }, [isInCall, ws, credentials.username]);

  const sendWebSocketMessage = (message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const handleCall = async () => {
    if (!number) return;
    try {
      const isLocalhost = window.location.hostname === 'localhost';
      const apiHost = isLocalhost
        ? 'http://localhost:5000'
        : 'https://preferably-joint-airedale.ngrok-free.app';

      const response = await fetch(`${apiHost}/make-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: number,
          webrtcNumber: credentials.username.split('@')[0],
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

    console.log(`📞 Attempting to transfer call to ${targetExtension}`);
    setStatus('Initiating transfer...');

    try {
      // Check if target is in onlineUsers first
      const targetUser = `${targetExtension}@voip.46elks.com`;
      if (!onlineUsers.includes(targetUser)) {
        setStatus('Transfer failed: Target user is offline');
        return;
      }

      const transferTarget = `sip:${targetExtension}@voip.46elks.com`;
      console.log('Transfer target:', transferTarget);

      // Set up REFER event handlers before sending the request
      session.on('refer', (data) => {
        console.log('Transfer REFER event:', data);
      });

      const referSubscriber = await session.refer(transferTarget, {
        extraHeaders: [`Referred-By: <sip:${credentials.username}>`],
        replaces: session, // Add this to ensure proper call replacement
      });

      let transferTimeout = setTimeout(() => {
        setStatus('Transfer timed out');
        referSubscriber.terminate();
      }, 10000); // 10 second timeout

      referSubscriber.on('requestSucceeded', () => {
        console.log('Transfer request accepted');
        setStatus('Transfer request accepted');
      });

      referSubscriber.on('notify', (notification) => {
        console.log('Transfer status:', notification);
        const status = notification.status_line.status_code;

        clearTimeout(transferTimeout);

        if (status === 200) {
          setStatus('Transfer successful');
          session.terminate();
          setIsInCall(false);
          setCallStartTime(null);
        } else if (status >= 300) {
          setStatus(`Transfer failed (${status})`);
          console.error('Transfer failed with status:', status);
          // Don't terminate the session on failure
        }
      });

      referSubscriber.on('failed', (response) => {
        clearTimeout(transferTimeout);
        console.error('Transfer failed:', response);
        setStatus('Transfer failed - maintaining current call');

        // Notify the user that transfer failed but call is maintained
        window.electron.Notification.create('Transfer Failed', {
          body: 'The transfer could not be completed. Your call is still connected.',
        });
      });
    } catch (error) {
      console.error('Transfer error:', error);
      setStatus('Transfer failed - maintaining current call');
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
  useEffect(() => {
    if (status === 'Re-registering...' || isInCall) {
      handleReconnect();
    }
  }, [status, isInCall]);
  const handleReconnect = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      setStatus('Re-registering...');

      if (userAgent) {
        // Unregister first
        userAgent.unregister();

        // Then register again
        userAgent.register();

        setStatus('Re-registration successful');
      } else {
        // If no userAgent, initialize a new one
        initializeJsSIP();
      }
    } catch (error) {
      console.error('Re-registration error:', error);
      setStatus('Re-registration failed');
    } finally {
      setIsConnecting(false);
    }
  };
  // reregister every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isInCall) {
        handleReconnect();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [status]);
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
