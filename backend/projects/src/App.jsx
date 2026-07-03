import { useState } from 'react';
import './App.css';
function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <header className="header">
        <h1>Welcome to Zicon-IDE</h1>
        <p>Edit <code>src/App.jsx</code> and save to see changes!</p>
        <p style={{marginTop:'10px',color:'#4EC9B0',fontSize:'0.8rem'}}>
          Hardhat Extension ready for Smart Contracts
        </p>
      </header>
      <div className="card">
        <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      </div>
    </div>
  );
}
export default App;