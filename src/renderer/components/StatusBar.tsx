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

        <button
          className='reconnect-button'
          onClick={onReconnect}
          disabled={isConnecting}
        >
          <i className={`fas fa-sync ${isConnecting ? 'fa-spin' : ''}`}></i>
          {isConnecting ? 'Connecting...' : 'Reconnect'}
        </button>
      </div>
      <button className='logout-button' onClick={onLogout}>
        Logout
      </button>
    </div>
  );
};

export default StatusBar;
