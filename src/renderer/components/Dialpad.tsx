import { useState } from 'react';
import '../styles/dialpad.scss';

interface DialpadProps {
  onCall: (number: string) => void;
}

const Dialpad = ({ onCall }: DialpadProps) => {
  const [number, setNumber] = useState('+46769416462');

  const handleKeyPress = (key: string) => {
    setNumber((prev) => prev + key);
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (number) {
      onCall(number);
    }
  };

  return (
    <div className='dialpad-container'>
      <div className='number-display'>
        <input
          type='text'
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder='Enter number'
        />
        {number && (
          <button className='clear-button' onClick={() => setNumber('')}>
            <i className='fas fa-times'></i>
          </button>
        )}
      </div>

      <div className='dialpad'>
        <div className='dialpad-row'>
          <button onClick={() => handleKeyPress('1')}>1</button>
          <button onClick={() => handleKeyPress('2')}>2</button>
          <button onClick={() => handleKeyPress('3')}>3</button>
        </div>
        <div className='dialpad-row'>
          <button onClick={() => handleKeyPress('4')}>4</button>
          <button onClick={() => handleKeyPress('5')}>5</button>
          <button onClick={() => handleKeyPress('6')}>6</button>
        </div>
        <div className='dialpad-row'>
          <button onClick={() => handleKeyPress('7')}>7</button>
          <button onClick={() => handleKeyPress('8')}>8</button>
          <button onClick={() => handleKeyPress('9')}>9</button>
        </div>
        <div className='dialpad-row'>
          <button onClick={() => handleKeyPress('*')}>*</button>
          <button onClick={() => handleKeyPress('0')}>0</button>
          <button onClick={() => handleKeyPress('#')}>#</button>
        </div>
        <div className='dialpad-row'>
          <button className='call-button' onClick={handleCall}>
            <i className='fas fa-phone'></i>
          </button>
          {number && (
            <button className='delete-button' onClick={handleDelete}>
              <i className='fas fa-backspace'></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dialpad;
