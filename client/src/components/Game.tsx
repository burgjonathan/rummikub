import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Tile, Meld } from 'shared';
import { nanoid } from 'nanoid';
import { useGame } from '../context/GameContext';
import GameBoard from './GameBoard';
import PlayerHand from './PlayerHand';
import PlayerList from './PlayerList';
import { TileComponent } from './Tile';

export default function Game() {
  const navigate = useNavigate();
  const {
    gameState,
    myTiles,
    isMyTurn,
    playerId,
    room,
    playTiles,
    drawTile,
    undoTurn,
    leaveRoom,
    error,
  } = useGame();

  // Local state for manipulation during a turn
  const [localBoard, setLocalBoard] = useState<Meld[]>([]);
  const [localHand, setLocalHand] = useState<Tile[]>([]);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const [activeTile, setActiveTile] = useState<Tile | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync local state with game state
  useEffect(() => {
    if (gameState) {
      setLocalBoard(JSON.parse(JSON.stringify(gameState.board)));
    }
  }, [gameState?.board]);

  useEffect(() => {
    setLocalHand([...myTiles]);
  }, [myTiles]);

  // Navigate back to lobby if not in a game
  useEffect(() => {
    if (!gameState && !room) {
      navigate('/');
    }
  }, [gameState, room, navigate]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tile = active.data.current?.tile as Tile | undefined;
    if (tile) {
      setActiveTile(tile);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTile(null);

    if (!over || !isMyTurn) return;

    const draggedTile = active.data.current?.tile as Tile | undefined;
    if (!draggedTile) return;

    const targetType = over.data.current?.type;

    // Find where the tile is coming from
    const fromHand = localHand.some((t) => t.id === draggedTile.id);
    const fromMeld = localBoard.find((m) => m.tiles.some((t) => t.id === draggedTile.id));

    if (targetType === 'board') {
      // Dropping on the board creates a new meld with just this tile
      // or if selected tiles exist, create a meld with all selected tiles
      const tilesToPlace = selectedTileIds.size > 0
        ? [...selectedTileIds].map((id) => {
            const inHand = localHand.find((t) => t.id === id);
            if (inHand) return inHand;
            for (const meld of localBoard) {
              const inMeld = meld.tiles.find((t) => t.id === id);
              if (inMeld) return inMeld;
            }
            return null;
          }).filter(Boolean) as Tile[]
        : [draggedTile];

      // Remove tiles from their sources
      let newHand = localHand.filter((t) => !tilesToPlace.some((pt) => pt.id === t.id));
      let newBoard = localBoard.map((meld) => ({
        ...meld,
        tiles: meld.tiles.filter((t) => !tilesToPlace.some((pt) => pt.id === t.id)),
      })).filter((meld) => meld.tiles.length > 0);

      // Create new meld
      const newMeld: Meld = {
        id: nanoid(8),
        tiles: tilesToPlace,
      };

      setLocalHand(newHand);
      setLocalBoard([...newBoard, newMeld]);
      setSelectedTileIds(new Set());
    } else if (targetType === 'meld') {
      const targetMeldId = over.data.current?.meldId;
      if (!targetMeldId) return;

      // Moving tile to an existing meld
      if (fromHand) {
        setLocalHand(localHand.filter((t) => t.id !== draggedTile.id));
        setLocalBoard(
          localBoard.map((meld) =>
            meld.id === targetMeldId
              ? { ...meld, tiles: [...meld.tiles, draggedTile] }
              : meld
          )
        );
      } else if (fromMeld && fromMeld.id !== targetMeldId) {
        // Moving between melds
        setLocalBoard(
          localBoard
            .map((meld) => {
              if (meld.id === fromMeld.id) {
                return { ...meld, tiles: meld.tiles.filter((t) => t.id !== draggedTile.id) };
              }
              if (meld.id === targetMeldId) {
                return { ...meld, tiles: [...meld.tiles, draggedTile] };
              }
              return meld;
            })
            .filter((meld) => meld.tiles.length > 0)
        );
      }
    } else if (targetType === 'hand') {
      // Moving tile back to hand
      if (fromMeld) {
        setLocalBoard(
          localBoard
            .map((meld) =>
              meld.id === fromMeld.id
                ? { ...meld, tiles: meld.tiles.filter((t) => t.id !== draggedTile.id) }
                : meld
            )
            .filter((meld) => meld.tiles.length > 0)
        );
        setLocalHand([...localHand, draggedTile]);
      }
    }
  };

  const handleTileSelect = useCallback((tileId: string) => {
    if (!isMyTurn) return;
    
    setSelectedTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(tileId)) {
        next.delete(tileId);
      } else {
        next.add(tileId);
      }
      return next;
    });
  }, [isMyTurn]);

  const handlePlayTiles = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    
    try {
      await playTiles(localBoard);
      setSelectedTileIds(new Set());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to play tiles');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrawTile = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    
    try {
      await drawTile();
      setSelectedTileIds(new Set());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to draw tile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async () => {
    setLocalError(null);
    
    try {
      await undoTurn();
      setSelectedTileIds(new Set());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to undo');
    }
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the game?')) {
      leaveRoom();
      navigate('/');
    }
  };

  // Check if any tiles have been played this turn
  const hasPlayedTiles = localHand.length < myTiles.length;

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  // Game over screen
  if (gameState.winner) {
    const winner = gameState.players.find((p) => p.id === gameState.winner);
    const isWinner = gameState.winner === playerId;
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-4">
            {isWinner ? '🎉 You Win!' : 'Game Over'}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {isWinner
              ? 'Congratulations! You played all your tiles!'
              : `${winner?.name} wins!`}
          </p>
          <button
            onClick={() => {
              leaveRoom();
              navigate('/');
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Rummikub</h1>
          <div className="flex items-center gap-4">
            {isMyTurn && (
              <span className="bg-emerald-500 text-white px-4 py-2 rounded-full font-semibold animate-pulse">
                Your Turn!
              </span>
            )}
            <button
              onClick={handleLeave}
              className="text-white/60 hover:text-white transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>

        {/* Error display */}
        {(localError || error) && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg">
            {localError || error}
          </div>
        )}

        {/* Main game area */}
        <div className="flex gap-4 flex-1">
          {/* Left sidebar - players */}
          <div className="w-64 shrink-0">
            <PlayerList
              players={gameState.players}
              currentPlayerId={gameState.currentPlayerId}
              myPlayerId={playerId}
            />
          </div>

          {/* Game board */}
          <div className="flex-1 flex flex-col gap-4">
            <GameBoard
              melds={localBoard}
              selectedTileIds={selectedTileIds}
              onTileSelect={handleTileSelect}
              poolCount={gameState.pool}
            />

            {/* Action buttons */}
            {isMyTurn && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handlePlayTiles}
                  disabled={isSubmitting || !hasPlayedTiles}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Playing...' : 'End Turn'}
                </button>
                <button
                  onClick={handleDrawTile}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Draw Tile
                </button>
                <button
                  onClick={handleUndo}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Player's hand */}
        <PlayerHand
          tiles={localHand}
          selectedTileIds={selectedTileIds}
          onTileSelect={handleTileSelect}
          isMyTurn={isMyTurn}
        />
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTile && <TileComponent tile={activeTile} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
