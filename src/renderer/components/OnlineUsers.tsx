import '../styles/online-users.scss';

interface OnlineUsersProps {
  users: string[];
}

const OnlineUsers = ({ users }: OnlineUsersProps) => {
  return (
    <div className='online-users'>
      <h2>Online Users</h2>
      <ul>
        {users.map((user) => (
          <li key={user}>
            <span className='status-dot'></span>
            {user.split('@')[0]}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OnlineUsers;
