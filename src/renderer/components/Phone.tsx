import { useState, useEffect } from 'react';
import { UserAgent, Web } from 'sip.js';
import '../styles/phone.scss';
import CallInfo from './CallInfo';

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
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

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
          onCallReceived: async (invitation: any) => {
            console.log('Full invitation:', invitation);

            // Get the From header from the incoming INVITE message
            const fromUri =
              invitation?.incomingInviteRequest?.message?.from?.uri?.raw;
            console.log('From URI:', fromUri);

            // Try different paths to get the number
            let phoneNumber = 'Unknown';

            if (invitation?.incomingInviteRequest?.message?.from?.uri?.user) {
              phoneNumber =
                invitation.incomingInviteRequest.message.from.uri.user;
            } else if (invitation?.request?.from?.uri?.user) {
              phoneNumber = invitation.request.from.uri.user;
            } else if (
              invitation?.message?.headers?.From?.[0]?.parsed?.uri?.user
            ) {
              phoneNumber = invitation.message.headers.From[0].parsed.uri.user;
            }

            console.log('Extracted phone:', phoneNumber);

            setIsIncoming(true);
            setIsInCall(true);

            // Format the number (remove + if present)
            const formattedNumber = phoneNumber.replace(/^\+/, '');

            setCallerNumber(formattedNumber);
            setStatus(`Incoming call from ${formattedNumber}`);
            setCallStartTime(null);
          },
          onCallHangup: () => {
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
        {isInCall && (
          <>
            {console.log('Rendering CallInfo with:', {
              // Debug render
              callerNumber,
              isIncoming,
              number,
              startTime: callStartTime,
            })}
            <CallInfo
              callerNumber={isIncoming ? callerNumber : number}
              startTime={callStartTime}
            />
          </>
        )}
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
            <div className='call-actions'>
              {isInCall ? (
                <button className='hangup' onClick={handleHangup}>
                  Hang up
                </button>
              ) : (
                <button
                  className='call'
                  onClick={handleCall}
                  disabled={!number}
                >
                  Call
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Phone;
