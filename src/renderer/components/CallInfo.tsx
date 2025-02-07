import { useState, useEffect } from 'react';

interface CallInfoProps {
  callerNumber: string;
  startTime: Date | null;
}

const CallInfo = ({ callerNumber, startTime }: CallInfoProps) => {
  const [elapsedTime, setElapsedTime] = useState('00:00');

  console.log('CallInfo props:', { callerNumber, startTime }); // Debug props

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
    </div>
  );
};

export default CallInfo;
