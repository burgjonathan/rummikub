import { Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import { MediaProvider } from './context/MediaContext';
import ConnectionStatus from './components/ConnectionStatus';
import Lobby from './components/Lobby';
import Game from './components/Game';

function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <MediaProvider>
          <ConnectionStatus />
          <div className="min-h-screen">
            <Routes>
              <Route path="/" element={<Lobby />} />
              <Route path="/join/:code" element={<Lobby />} />
              <Route path="/game" element={<Game />} />
            </Routes>
          </div>
        </MediaProvider>
      </GameProvider>
    </SocketProvider>
  );
}

export default App;
