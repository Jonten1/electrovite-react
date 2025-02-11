import { useState, useEffect } from 'react';

interface CallInfoProps {
  callerNumber: string;
  startTime: Date | null;
  onTransfer: (targetExtension: string) => void;
  onlineUsers: string[];
  isMuted: boolean;
  onMuteToggle: () => void;
  onEndCall: () => void;
}

const CallInfo = ({
  callerNumber,
  startTime,
  onTransfer,
  onlineUsers = [],
  isMuted,
  onMuteToggle,
  onEndCall,
}: CallInfoProps) => {
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    if (!startTime) return;

    const timer = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - startTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(
        `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`,
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  const handleTransferClick = () => {
    if (selectedUser) {
      onTransfer(selectedUser.split('@')[0]);
      setShowTransfer(false);
      setSelectedUser('');
    }
  };

  return (
    <div className='call-info'>
      <div className='caller-id'>
        <span className='label'>Caller:</span>
        <span className='number'>{callerNumber || 'Unknown'}</span>
      </div>
      <div className='timer'>
        <span className='label'>Duration:</span>
        <span className='time'>{elapsedTime}</span>
      </div>
      <div className='call-controls'>
        <button
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          onClick={onMuteToggle}
        >
          <i className={`fas fa-microphone${isMuted ? '-slash' : ''}`}></i>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button className='end-call-button' onClick={onEndCall}>
          <i className='fas fa-phone-slash'></i>
          End Call
        </button>
      </div>
      <div className='transfer-controls'>
        <button onClick={() => setShowTransfer(!showTransfer)}>
          Transfer Call
        </button>

        {showTransfer && (
          <div className='transfer-dropdown'>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value=''>Select user...</option>
              {onlineUsers.map((user) => (
                <option key={user} value={user}>
                  {user.split('@')[0]}
                </option>
              ))}
            </select>
            <button onClick={handleTransferClick} disabled={!selectedUser}>
              Transfer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallInfo;
