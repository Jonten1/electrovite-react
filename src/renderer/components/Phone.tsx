import { useState, useEffect, useRef } from 'react';
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
  const userAgentRef = useRef<JsSIP.UA | null>(null);
  const [session, setSession] = useState<JsSIP.RTCSession | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const [isInCall, setIsInCall] = useState(false);
  const [isIncoming, setIsIncoming] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [registeredTime, setRegisteredTime] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (uptime % 10 === 0) {
      console.log(`Component uptime: ${uptime}s`);
      if (registeredTime) {
        const registeredSeconds = Math.floor(
          (Date.now() - registeredTime.getTime()) / 1000,
        );
        console.log(`Registered time: ${registeredSeconds}s`);
      }
    }
  }, [uptime, registeredTime]);
  const sendPing = () => {
    fetch(window.electron.env.API_URL + '/ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: credentials.username }),
    });
  };
  useEffect(() => {
    const initializeSIP = () => {
      try {
        JsSIP.debug.enable('JsSIP:*');

        const socket = new JsSIP.WebSocketInterface(
          `wss://${credentials.server}/w1/websocket`,
        );

        const configuration = {
          sockets: [socket],
          uri: `sip:${credentials.username}`,
          password: credentials.password,
          realm: credentials.server,
          display_name: credentials.username.split('@')[0],
        };

        const ua = new JsSIP.UA(configuration);
        setUserAgent(ua);
        userAgentRef.current = ua;

        ua.on('registered', () => {
          setStatus('Ready');
          setRegisteredTime(new Date());
          sendPing();
        });

        ua.on('unregistered', () => {
          setStatus('Unregistered');
        });

        ua.on('registrationFailed', (error) => {
          console.error('Registration failed:', error);
          setStatus('Registration failed');
        });

        ua.on('newRTCSession', ({ session: newSession }) => {
          setSession(newSession);
          console.log(newSession);

          if (newSession.direction === 'incoming') {
            const number = newSession.remote_identity.uri.user;
            setCallerNumber(number);
            setIsIncoming(true);
            setIsInCall(true);
            setStatus(`Incoming call from ${number}`);

            window.electron.Notification.create('Incoming Call', {
              body: `From ${number}`,
            });
          }

          newSession.on('ended', () => {
            setIsInCall(false);
            setIsIncoming(false);
            setCallerNumber('');
            setStatus('Ready');
            setCallStartTime(null);
            setSession(null);
            window.electron.Notification.close();

            // Send reregister request via WebSocket when call ends
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              console.log('📞 Sending reregister request after call end');
              wsRef.current.send(
                JSON.stringify({
                  type: 'reregister',
                  from: credentials.username,
                  action: 'call_ended',
                }),
              );
            }
          });

          newSession.on('failed', () => {
            setIsInCall(false);
            setIsIncoming(false);
            setCallerNumber('');
            setStatus('Ready');
            setCallStartTime(null);
            setSession(null);
            window.electron.Notification.close();
          });

          newSession.on('accepted', () => {
            setIsIncoming(false);
            setStatus('In call');
            setCallStartTime(new Date());
          });
        });

        ua.start();
        return ua;
      } catch (error) {
        console.error('SIP initialization error:', error);
        setStatus('Connection failed');
        return null;
      }
    };

    const ua = initializeSIP();

    return () => {
      if (ua) {
        ua.stop();
      }
    };
  }, [credentials]);

  useEffect(() => {
    // Connect to WebSocket server using the API_URL from env
    const wsUrl = window.electron.env.API_URL.replace(
      'http://',
      'ws://',
    ).replace('https://', 'wss://');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected successfully');

      // Send initial register message
      ws.send(
        JSON.stringify({
          type: 'register',
          username: credentials.username,
        }),
      );

      // Send test message
      ws.send(
        JSON.stringify({
          type: 'test',
          message: 'I am alive!',
        }),
      );
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 Received WebSocket message:', data);

      if (data.type === 'userList') {
        console.log('📋 Received updated user list:', data.users);
        setOnlineUsers(
          data.users.filter((user) => user !== credentials.username),
        );
      }

      if (data.type === 'reregister') {
        console.log(`📞 Reregistering request from ${data.from}`);
        console.log('Current userAgent:', userAgentRef.current);

        if (!isInCall && userAgentRef.current) {
          try {
            await userAgentRef.current.unregister();
            console.log('Unregistered successfully');

            setTimeout(() => {
              if (userAgentRef.current) {
                userAgentRef.current.register();
                console.log('Reregistering...');
              }
            }, 1000);
          } catch (error) {
            console.error('Error during reregistration:', error);
          }
        } else {
          console.log(
            isInCall
              ? 'Skipping reregistration - active call in progress'
              : 'Skipping reregistration - no userAgent available',
          );
        }
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [credentials]);

  useEffect(() => {
    // Set up heartbeat interval
    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('💓 Sending heartbeat');
        wsRef.current.send(
          JSON.stringify({
            type: 'heartbeat',
            from: credentials.username,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }, 60000); // Send heartbeat every minute

    // Cleanup interval on component unmount
    return () => clearInterval(heartbeatInterval);
  }, [credentials.username]);

  const handleAnswer = () => {
    if (session) {
      const options = {
        mediaConstraints: { audio: true, video: false },
      };
      session.answer(options);
      window.electron.Notification.close();
    }
  };

  const handleReject = () => {
    if (session) {
      session.terminate();
      setSession(null);
      window.electron.Notification.close();
    }
  };

  const handleHangup = () => {
    if (session) {
      session.terminate();
      setSession(null);
    }
  };

  const handleMuteToggle = () => {
    if (session) {
      const audioTracks = session.connection
        .getLocalStreams()[0]
        .getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleReconnect = () => {
    if (!userAgent) {
      console.error('Cannot reconnect: userAgent is null');
      return;
    }

    try {
      userAgent.stop();
      userAgent.start();
      setStatus('Reconnecting...');
    } catch (error) {
      console.error('Reconnect error:', error);
      setStatus('Reconnect failed');
    }
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
