# Rummikub Multiplayer

A real-time multiplayer Rummikub game built with React, Node.js, and Socket.io.

## Features

- Create private game rooms with unique 6-character codes
- Share invite links to play with friends (e.g., `/join/ABC123`)
- Real-time gameplay with WebSocket communication
- Drag-and-drop tile manipulation
- Full Rummikub rule validation (runs, groups, initial 30-point meld)
- Support for 2-4 players
- Automatic reconnection handling

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, @dnd-kit
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Build**: npm workspaces (monorepo)

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+

### Installation

```bash
# Install dependencies
npm install

# Start development servers (client + server)
npm run dev
```

The client runs on http://localhost:5173 and the server on http://localhost:3001.

### Building for Production

```bash
npm run build
npm run start
```

## How to Play

1. **Create a game**: Enter your name and click "Create Game"
2. **Invite friends**: Share the room code or invite link
3. **Start the game**: Host clicks "Start Game" when everyone has joined
4. **On your turn**:
   - Drag tiles from your hand to the board to create melds
   - Click tiles to select multiple, then drag to board
   - Rearrange existing melds by dragging tiles between them
   - Click "End Turn" when done, or "Draw Tile" to skip
5. **Win**: First player to use all tiles wins!

## Game Rules

- **106 tiles**: Numbers 1-13 in 4 colors (red, blue, yellow, black) x 2 sets + 2 jokers
- **Starting hand**: Each player receives 14 tiles
- **Initial meld**: Your first play must total at least 30 points
- **Valid melds**:
  - **Runs**: 3+ consecutive numbers of the same color (e.g., Red 4-5-6)
  - **Groups**: 3-4 tiles of the same number in different colors (e.g., Blue 7, Red 7, Yellow 7)
- **Jokers**: Can substitute any tile in a meld
- **Draw**: If you can't play, draw a tile and end your turn
- **Winning**: First player to play all their tiles wins!

## Project Structure

```
rummikub/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components (Lobby, Game, Tile, etc.)
│   │   ├── context/        # React contexts (Socket, Game)
│   │   └── ...
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── game/           # Game logic (Tile, Pool, MeldValidator)
│   │   ├── rooms/          # Room management
│   │   └── websocket/      # Socket.io handlers
├── shared/                 # Shared TypeScript types
└── package.json            # Monorepo root
```

## Development

```bash
# Run only the server
npm run dev -w server

# Run only the client
npm run dev -w client

# Type check
npm run build -w shared
```

## License

MIT
