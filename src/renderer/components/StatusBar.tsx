import '../styles/status-bar.scss';

interface StatusBarProps {
  status: string;
  onLogout: () => void;
  onReconnect: () => void;
  isConnecting: boolean;
}

const StatusBar = ({
  status,
  onLogout,
  onReconnect,
  isConnecting,
}: StatusBarProps) => {
  return (
    <div className='status-bar'>
      <div className='status-section'>
        <span className='status-text'>{status}</span>
      </div>
      <button className='logout-button' onClick={onLogout}>
        Logout
      </button>
    </div>
  );
};

export default StatusBar;
