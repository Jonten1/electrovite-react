import '../styles/status-bar.scss';

interface StatusBarProps {
  status: string;
  onLogout: () => void;
  onReconnect: () => void;
  isConnecting: boolean;
}

const StatusBar = ({ status, onLogout }: StatusBarProps) => {
  return (
    <div className='status-bar'>
      <div className='status-section'>
        <span className='status-text'>{status ? 'Connected' : 'Offline'}</span>
        <div className={`status-indicator ${status ? 'online' : 'offline'}`} />
      </div>
      <button className='logout-button' onClick={onLogout}>
        Logout
      </button>
    </div>
  );
};

export default StatusBar;
