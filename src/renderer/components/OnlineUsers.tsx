import '../styles/online-users.scss';

interface OnlineUsersProps {
  users: string[];
  onUserClick?: (user: string) => void;
}

const OnlineUsers = ({ users, onUserClick }: OnlineUsersProps) => {
  return (
    <div className='online-users'>
      <h2>Online Users ({users.length})</h2>
      {users.length === 0 ? (
        <p className='no-users'>No other users online</p>
      ) : (
        <ul>
          {users.map((user) => (
            <li
              key={user}
              onClick={() => onUserClick?.(user)}
              className={onUserClick ? 'clickable' : ''}
            >
              <span className='status-dot'></span>
              {user.split('@')[0]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OnlineUsers;
