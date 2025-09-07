'use client'
// app/poker-demo/page.tsx
// ========================================
// COMPLETE POKER DEMO - UI + GAME ENGINE INTEGRATION
// ========================================
// This page demonstrates our complete poker system:
// - Visual poker table with beautiful UI
// - Connected to our real game engine
// - Interactive betting controls
// - Real poker gameplay

import { useState, useEffect, useRef } from 'react'
import { PokerGameEngine } from '@/lib/game-engine'
import { GameState, PlayerAction } from '@/lib/types'
import { PokerTable } from '@/components/PokerTable'

export default function PokerDemoPage() {
  const [gameEngine, setGameEngine] = useState<PokerGameEngine | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('alice')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const aiScheduledRef = useRef(false)

  // Initialize the game when component mounts
  useEffect(() => {
    try {
      // Create 4 demo players
      const players = [
        {
          id: 'alice',
          name: 'Alice',
          chips: 1000,
          position: 0,
          isDealer: false,
          isSmallBlind: false,     // ← Added missing property
          isBigBlind: false,       // ← Added missing property
          isAI: false,
          disconnected: false
        },
        {
          id: 'bob', 
          name: 'Bob',
          chips: 1500,
          position: 1,
          isDealer: false,
          isSmallBlind: false,     // ← Added missing property
          isBigBlind: false,       // ← Added missing property
          isAI: true,
          disconnected: false
        },
        {
          id: 'charlie',
          name: 'Charlie',
          chips: 800,
          position: 2,
          isDealer: false,
          isSmallBlind: false,     // ← Added missing property
          isBigBlind: false,       // ← Added missing property
          isAI: true,
          disconnected: false
        },
        {
          id: 'diana',
          name: 'Diana',
          chips: 1200,
          position: 3,
          isDealer: false,
          isSmallBlind: false,     // ← Added missing property
          isBigBlind: false,       // ← Added missing property
          isAI: true,
          disconnected: false
        }
      ]

      // Create game engine with $5/$10 blinds
      const engine = new PokerGameEngine('demo-table', players, 5, 10)
      
      setGameEngine(engine)
      setGameState(engine.getGameState())
      setIsLoading(false)
      
      console.log('🎮 Poker game initialized!')
      console.log('Game State:', engine.getGameState())
      
    } catch (err) {
      console.error('Error initializing game:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
    }
  }, [])

  // Auto-trigger AI whenever the active player is an AI
  useEffect(() => {
    if (!gameEngine || !gameState) return
    const current = gameEngine.getCurrentPlayer()
    if (current?.isAI && !gameState.isHandComplete && !aiScheduledRef.current) {
      aiScheduledRef.current = true
      setTimeout(() => {
        simulateAIActions()
      }, 300)
    }
  }, [gameEngine, gameState?.activePlayerIndex, gameState?.currentBettingRound])

  // Handle player actions
  const handlePlayerAction = (action: PlayerAction) => {
    if (!gameEngine) {
      console.error('Game engine not initialized')
      return
    }

    try {
      // Defensive: ensure it's actually this player's turn
      if (!gameEngine.canPlayerAct(currentPlayerId)) {
        console.warn('Ignoring action: not current player turn')
        return
      }
      console.log(`🎯 Player ${currentPlayerId} action:`, action)
      
      // Process the action through our game engine
      gameEngine.processPlayerAction(currentPlayerId, action)
      
      // Update the UI with new game state
      const newGameState = gameEngine.getGameState()
      setGameState(newGameState)
      
      console.log('✅ Action processed successfully')
      console.log('New Game State:', newGameState)
      
      // AI will be scheduled by effect when it's an AI's turn
      
    } catch (err) {
      console.error('❌ Error processing action:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // Simple AI simulation for demonstration
  const simulateAIActions = () => {
    if (!gameEngine) return

    const state = gameEngine.getGameState()
    const currentPlayer = gameEngine.getCurrentPlayer()
    
    // Only act if it's an AI player's turn
    if (!currentPlayer || !currentPlayer.isAI || state.isHandComplete) {
      aiScheduledRef.current = false
      return
    }

    // Ensure the engine considers this player eligible to act now
    if (!gameEngine.canPlayerAct(currentPlayer.id)) {
      aiScheduledRef.current = false
      return
    }

    console.log(`🤖 AI ${currentPlayer.name} is thinking...`)

    // Simple AI logic for demo (real AI would be much more sophisticated)
    const validActions = gameEngine.getValidActions(currentPlayer.id)
    if (!validActions || validActions.length === 0) {
      aiScheduledRef.current = false
      return
    }
    let aiAction: PlayerAction

    // Basic AI strategy:
    // - 30% chance to fold if facing a bet
    // - 40% chance to call
    // - 20% chance to raise
    // - 10% chance to go all-in (if desperate)
    
    const random = Math.random()
    const callAmount = Math.max(0, state.currentBet - currentPlayer.currentBet)
    
    if (validActions.includes('check')) {
      // If can check, sometimes be aggressive. Use bet only if no outstanding bet; otherwise raise.
      if (random < 0.7) {
        aiAction = { type: 'check' }
      } else {
        if (state.currentBet === 0 && validActions.includes('bet')) {
          const openBet = Math.max(state.blinds.big * 2, state.blinds.big)
          aiAction = { type: 'bet', amount: Math.min(currentPlayer.currentBet + currentPlayer.chips, openBet) }
        } else if (validActions.includes('raise')) {
          const minRaiseTotal = state.currentBet + Math.max(state.lastRaiseSize, state.blinds.big)
          const target = Math.min(currentPlayer.currentBet + currentPlayer.chips, Math.max(minRaiseTotal, state.currentBet * 2))
          if (target >= minRaiseTotal) {
            aiAction = { type: 'raise', amount: target }
          } else {
            aiAction = { type: 'check' }
          }
        } else {
          aiAction = { type: 'check' }
        }
      }
    } else if (validActions.includes('call') && callAmount > 0) {
      if (random < 0.3) {
        aiAction = { type: 'fold' }
      } else if (random < 0.8) {
        aiAction = { type: 'call' }
      } else {
        // Sometimes raise
        const minRaiseTotal = state.currentBet + Math.max(state.lastRaiseSize, state.blinds.big)
        const target = Math.min(currentPlayer.currentBet + currentPlayer.chips, Math.max(minRaiseTotal, state.currentBet * 2))
        if (currentPlayer.currentBet + currentPlayer.chips >= minRaiseTotal) {
          aiAction = { type: 'raise', amount: target }
        } else {
          aiAction = { type: 'call' }
        }
      }
    } else {
      // Fallback to fold
      aiAction = { type: 'fold' }
    }

    console.log(`🤖 AI ${currentPlayer.name} decides to:`, aiAction)

    // Process AI action after a delay; re-validate turn
    setTimeout(() => {
      try {
        const stillCurrent = gameEngine.getCurrentPlayer()
        if (!stillCurrent || stillCurrent.id !== currentPlayer.id) {
          aiScheduledRef.current = false
          return
        }
        gameEngine.processPlayerAction(currentPlayer.id, aiAction)
        const newGameState = gameEngine.getGameState()
        setGameState(newGameState)
      } catch (err) {
        console.error('AI action failed:', err)
      } finally {
        aiScheduledRef.current = false
      }
    }, 2000)
  }

  // Handle joining game (for demo purposes)
  const handleJoinGame = () => {
    console.log('Join game clicked (demo functionality)')
  }

  // Handle leaving game
  const handleLeaveGame = () => {
    console.log('Leave game clicked (demo functionality)')
  }

  // Player switching for demo
  const switchPlayer = (playerId: string) => {
    setCurrentPlayerId(playerId)
    console.log(`👤 Switched to viewing as: ${playerId}`)
  }

  // Reset game
  const resetGame = () => {
    setError(null)
    setIsLoading(true)
    // Trigger re-initialization
    window.location.reload()
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-4">🃏</div>
          <div className="text-xl">Shuffling cards...</div>
          <div className="text-sm text-green-200 mt-2">Initializing poker game</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-800 to-red-900 flex items-center justify-center">
        <div className="text-white text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl mb-4">Game Error</div>
          <div className="text-sm bg-red-700 p-4 rounded mb-4">{error}</div>
          <button 
            onClick={resetGame}
            className="bg-white text-red-800 px-6 py-2 rounded font-medium hover:bg-gray-100"
          >
            Reset Game
          </button>
        </div>
      </div>
    )
  }

  // Main game interface
  if (!gameState) {
    return <div>No game state available</div>
  }

  return (
    <div className="min-h-screen">
      {/* Demo controls header */}
      <div className="bg-gray-800 text-white p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">🃏 Poker Demo</h1>
            <p className="text-sm text-gray-300">Complete poker game with AI opponents</p>
          </div>
          
          {/* Player switcher */}
          <div className="flex items-center space-x-4">
            <span className="text-sm">View as:</span>
            {gameState.players.map(player => (
              <button
                key={player.id}
                onClick={() => switchPlayer(player.id)}
                className={`px-3 py-1 rounded text-sm ${
                  currentPlayerId === player.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
          
          {/* Game controls */}
          <div className="flex space-x-2">
            <button
              onClick={resetGame}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
            >
              Reset Game
            </button>
          </div>
        </div>
      </div>

      {/* Main poker table */}
      <PokerTable
        gameState={gameState}
        currentPlayerId={currentPlayerId}
        onPlayerAction={handlePlayerAction}
      />

      {/* Debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded max-w-sm text-xs">
          <h4 className="font-bold mb-2">Debug Info</h4>
          <div className="space-y-1">
            <div>Current Player: {currentPlayerId}</div>
            <div>Active Player: {gameState.players[gameState.activePlayerIndex]?.name}</div>
            <div>Betting Round: {gameState.currentBettingRound}</div>
            <div>Current Bet: ${gameState.currentBet}</div>
            <div>Pot: ${gameState.pot}</div>
            <div>Hand Complete: {gameState.isHandComplete ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ========================================
// COMPONENT FEATURES DEMONSTRATED
// ========================================
/*
This demo page showcases:

1. COMPLETE INTEGRATION: UI + Game Engine
   - Visual poker table connected to real game logic
   - Player actions trigger actual game state changes
   - Real-time UI updates based on game state

2. INTERACTIVE GAMEPLAY: Fully playable poker
   - Click betting controls to make moves
   - See cards dealt and community cards revealed
   - Watch pot grow and players fold/bet/raise

3. AI SIMULATION: Automated opponents
   - Simple AI logic for demonstration
   - AI players make decisions automatically
   - Realistic game flow with multiple players

4. DEVELOPER EXPERIENCE: Easy to understand
   - Clear console logging for all actions
   - Debug information panel
   - Error handling and recovery

5. REAL-TIME FEATURES: Immediate feedback
   - Instant UI updates after actions
   - Visual indicators for current turn
   - Game state synchronization

To test the demo:
1. Visit /poker-demo in your browser
2. Use the "View as" buttons to switch between players
3. Make betting decisions when it's your turn
4. Watch AI players make automatic decisions
5. See the complete poker hand play out

This demonstrates a fully functional poker game!
*/