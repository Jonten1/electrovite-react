import '../styles/status-bar.scss';

interface StatusBarProps {
  status: string;
  onLogout: () => void;
}

const StatusBar = ({ status, onLogout }: StatusBarProps) => {
  return (
    <div className='status-bar'>
      <span>{status}</span>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
};

export default StatusBar;
