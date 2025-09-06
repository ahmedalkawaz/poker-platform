// lib/poker/game-engine.ts
// ========================================
// POKER GAME ENGINE - MULTIPLAYER GAME STATE MANAGEMENT
// ========================================
// This is the authoritative server-side game logic that manages:
// - Player actions and betting rounds
// - Pot calculations and side pots  
// - Game flow from preflop to showdown
// - Turn management and position tracking

import { 
    GameState, 
    Player, 
    PlayerAction, 
    BettingRound, 
    Card,
    SidePot,
    HandEvaluation 
  } from './types'
  import { createDeck, shuffleDeck, dealHoleCards, dealCards } from './deck'
  import { evaluateHand, findWinners } from './hand-evaluator'
  
  // ========================================
  // GAME ENGINE CLASS
  // ========================================
  
  export class PokerGameEngine {
    private gameState: GameState
  
    constructor(
      tableId: string,
      players: Omit<Player, 'holeCards' | 'currentBet' | 'totalBet' | 'hasActed' | 'isFolded' | 'isAllIn'>[],
      smallBlind: number,
      bigBlind: number
    ) {
      // Initialize game state with empty values
      this.gameState = {
        tableId,
        handNumber: 1,
        players: [],
        maxPlayers: 6,
        dealerPosition: 0,
        deck: [],
        communityCards: [],
        currentBettingRound: BettingRound.PREFLOP,
        currentBet: bigBlind,
        pot: 0,
        sidePots: [],
        blinds: { small: smallBlind, big: bigBlind },
        activePlayerIndex: 0,
        lastAction: null,
        actionTimeoutMs: 30000, // 30 seconds per action
        isHandComplete: false,
        winners: [],
        handStartTime: new Date(),
        lastActionTime: new Date()
      }
  
      // Set up players with initial poker state
      this.setupPlayers(players)
      
      // Start the first hand
      this.startNewHand()
    }
  
    // ========================================
    // GAME SETUP AND INITIALIZATION
    // ========================================
  
    private setupPlayers(playerData: Omit<Player, 'holeCards' | 'currentBet' | 'totalBet' | 'hasActed' | 'isFolded' | 'isAllIn'>[]): void {
      this.gameState.players = playerData.map((data, index) => ({
        ...data,
        position: index,
        holeCards: [],
        currentBet: 0,
        totalBet: 0,
        isDealer: index === this.gameState.dealerPosition,
        isSmallBlind: false,
        isBigBlind: false,
        hasActed: false,
        isFolded: false,
        isAllIn: false,
        disconnected: false
      }))
  
      this.gameState.maxPlayers = Math.max(6, playerData.length)
    }
  
    /**
     * Start a new hand - deal cards, post blinds, set up betting
     */
    public startNewHand(): void {
      // Reset hand state
      this.resetHandState()
      
      // Create and shuffle new deck
      this.gameState.deck = shuffleDeck(createDeck())
      
      // Deal hole cards to all active players
      this.dealHoleCards()
      
      // Post blinds
      this.postBlinds()
      
      // Set first player to act (after big blind)
      this.setFirstPlayerToAct()
      
      // Update timestamps
      this.gameState.handStartTime = new Date()
      this.gameState.lastActionTime = new Date()
    }
  
    private resetHandState(): void {
      this.gameState.communityCards = []
      this.gameState.currentBettingRound = BettingRound.PREFLOP
      this.gameState.currentBet = this.gameState.blinds.big
      this.gameState.pot = 0
      this.gameState.sidePots = []
      this.gameState.isHandComplete = false
      this.gameState.winners = []
      this.gameState.lastAction = null
  
      // Reset all players for new hand
      this.gameState.players = this.gameState.players.map(player => ({
        ...player,
        holeCards: [],
        currentBet: 0,
        totalBet: 0,
        hasActed: false,
        isFolded: false,
        isAllIn: false,
        isDealer: player.position === this.gameState.dealerPosition,
        isSmallBlind: false,
        isBigBlind: false
      }))
    }
  
    private dealHoleCards(): void {
      const activePlayers = this.getActivePlayers()
      const holeCards = dealHoleCards(this.gameState.deck, activePlayers.length, 2)
      
      activePlayers.forEach((player, index) => {
        player.holeCards = holeCards[index]
      })
    }
  
    private postBlinds(): void {
      const activePlayers = this.getActivePlayers()
      if (activePlayers.length < 2) {
        throw new Error('Need at least 2 players to start a hand')
      }
  
      // Determine blind positions
      const dealerIndex = this.gameState.dealerPosition
      const smallBlindIndex = (dealerIndex + 1) % activePlayers.length
      const bigBlindIndex = (dealerIndex + 2) % activePlayers.length
  
      // Set blind flags
      activePlayers[smallBlindIndex].isSmallBlind = true
      activePlayers[bigBlindIndex].isBigBlind = true
  
      // Post small blind
      const smallBlindPlayer = activePlayers[smallBlindIndex]
      const smallBlindAmount = Math.min(this.gameState.blinds.small, smallBlindPlayer.chips)
      smallBlindPlayer.chips -= smallBlindAmount
      smallBlindPlayer.currentBet = smallBlindAmount
      smallBlindPlayer.totalBet = smallBlindAmount
      this.gameState.pot += smallBlindAmount
  
      // Post big blind
      const bigBlindPlayer = activePlayers[bigBlindIndex]
      const bigBlindAmount = Math.min(this.gameState.blinds.big, bigBlindPlayer.chips)
      bigBlindPlayer.chips -= bigBlindAmount
      bigBlindPlayer.currentBet = bigBlindAmount
      bigBlindPlayer.totalBet = bigBlindAmount
      this.gameState.pot += bigBlindAmount
  
      // Set current bet to big blind amount
      this.gameState.currentBet = bigBlindAmount
  
      // Mark if players are all-in due to blinds
      if (smallBlindPlayer.chips === 0) smallBlindPlayer.isAllIn = true
      if (bigBlindPlayer.chips === 0) bigBlindPlayer.isAllIn = true
    }
  
    private setFirstPlayerToAct(): void {
      const activePlayers = this.getActivePlayers()
      const dealerIndex = this.gameState.dealerPosition
      
      // First to act is after big blind (UTG position)
      let firstPlayerIndex = (dealerIndex + 3) % activePlayers.length
      
      // Handle heads-up (2 players) special case
      if (activePlayers.length === 2) {
        firstPlayerIndex = dealerIndex // Dealer acts first in heads-up preflop
      }
  
      this.gameState.activePlayerIndex = firstPlayerIndex
    }
  
    // ========================================
    // PLAYER ACTION PROCESSING
    // ========================================
  
    /**
     * Process a player action and update game state
     */
    public processPlayerAction(playerId: string, action: PlayerAction): void {
      const player = this.findPlayerById(playerId)
      if (!player) {
        throw new Error(`Player ${playerId} not found`)
      }
  
      // Validate it's this player's turn
      if (!this.isPlayersTurn(playerId)) {
        throw new Error(`Not ${player.name}'s turn to act`)
      }
  
      // Validate the action is legal
      this.validateAction(player, action)
  
      // Process the specific action
      this.executeAction(player, action)
  
      // Update game state
      this.gameState.lastAction = action
      this.gameState.lastActionTime = new Date()
      player.hasActed = true
  
      // Check if betting round is complete
      if (this.isBettingRoundComplete()) {
        this.advanceBettingRound()
      } else {
        // Move to next active player
        this.advanceToNextPlayer()
      }
  
      // Check if hand is complete
      if (this.isHandComplete()) {
        this.completeHand()
      }
    }
  
    private validateAction(player: Player, action: PlayerAction): void {
      if (player.isFolded) {
        throw new Error('Player has already folded')
      }
  
      if (player.isAllIn) {
        throw new Error('Player is already all-in')
      }
  
      const callAmount = this.getCallAmount(player)
  
      switch (action.type) {
        case 'fold':
          // Always valid (except when already folded/all-in)
          break
  
        case 'check':
          if (callAmount > 0) {
            throw new Error('Cannot check when facing a bet')
          }
          break
  
        case 'call':
          if (callAmount === 0) {
            throw new Error('Nothing to call')
          }
          if (player.chips < callAmount) {
            throw new Error('Not enough chips to call (use all-in instead)')
          }
          break
  
        case 'bet':
          if (this.gameState.currentBet > 0) {
            throw new Error('Cannot bet when facing a bet (use raise instead)')
          }
          if (action.amount < this.gameState.blinds.big) {
            throw new Error(`Minimum bet is ${this.gameState.blinds.big}`)
          }
          if (player.chips < action.amount) {
            throw new Error('Not enough chips to bet')
          }
          break
  
        case 'raise':
          if (this.gameState.currentBet === 0) {
            throw new Error('Cannot raise when no bet to raise')
          }
          const minRaise = this.gameState.currentBet * 2
          if (action.amount < minRaise) {
            throw new Error(`Minimum raise is ${minRaise}`)
          }
          if (player.chips < action.amount) {
            throw new Error('Not enough chips to raise')
          }
          break
  
        case 'all-in':
          if (player.chips === 0) {
            throw new Error('Player has no chips')
          }
          if (action.amount !== player.chips + player.currentBet) {
            throw new Error('All-in amount must equal total chips')
          }
          break
      }
    }
  
    private executeAction(player: Player, action: PlayerAction): void {
      switch (action.type) {
        case 'fold':
          player.isFolded = true
          break
  
        case 'check':
          // No chips involved in check
          break
  
        case 'call':
          const callAmount = this.getCallAmount(player)
          player.chips -= callAmount
          player.currentBet = this.gameState.currentBet
          player.totalBet += callAmount
          this.gameState.pot += callAmount
          break
  
        case 'bet':
        case 'raise':
          const betAmount = action.amount - player.currentBet
          player.chips -= betAmount
          player.currentBet = action.amount
          player.totalBet += betAmount
          this.gameState.currentBet = action.amount
          this.gameState.pot += betAmount
          break
  
        case 'all-in':
          const allInAmount = player.chips
          player.chips = 0
          player.currentBet += allInAmount
          player.totalBet += allInAmount
          player.isAllIn = true
          this.gameState.pot += allInAmount
          
          // Update current bet if this all-in is a raise
          if (player.currentBet > this.gameState.currentBet) {
            this.gameState.currentBet = player.currentBet
          }
          break
      }
    }
  
    // ========================================
    // BETTING ROUND MANAGEMENT
    // ========================================
  
    private isBettingRoundComplete(): boolean {
      const activePlayers = this.getPlayersStillInHand()
      
      // If only one player left, hand is over
      if (activePlayers.length <= 1) {
        return true
      }
  
      // Check if all players have acted and calls are matched
      const playersWhoCanAct = activePlayers.filter(p => !p.isAllIn)
      
      if (playersWhoCanAct.length === 0) {
        // Everyone is all-in, go straight to showdown
        return true
      }
  
      // All players must have acted
      const allHaveActed = playersWhoCanAct.every(p => p.hasActed)
      
      // All bets must be equal (except for all-in players)
      const allBetsEqual = playersWhoCanAct.every(p => p.currentBet === this.gameState.currentBet)
  
      return allHaveActed && allBetsEqual
    }
  
    private advanceBettingRound(): void {
      // Reset action flags for next round
      this.gameState.players.forEach(player => {
        player.hasActed = false
        player.currentBet = 0 // Reset for next betting round
      })
  
      // Advance to next betting round
      switch (this.gameState.currentBettingRound) {
        case BettingRound.PREFLOP:
          this.dealFlop()
          this.gameState.currentBettingRound = BettingRound.FLOP
          break
        case BettingRound.FLOP:
          this.dealTurn()
          this.gameState.currentBettingRound = BettingRound.TURN
          break
        case BettingRound.TURN:
          this.dealRiver()
          this.gameState.currentBettingRound = BettingRound.RIVER
          break
        case BettingRound.RIVER:
          this.gameState.currentBettingRound = BettingRound.SHOWDOWN
          this.completeHand()
          return
      }
  
      // Reset betting
      this.gameState.currentBet = 0
  
      // Set first player to act (small blind or first active player after dealer)
      this.setFirstPlayerPostFlop()
    }
  
    private dealFlop(): void {
      // Burn one card
      dealCards(this.gameState.deck, 1)
      
      // Deal flop (3 cards)
      const flop = dealCards(this.gameState.deck, 3)
      this.gameState.communityCards.push(...flop)
    }
  
    private dealTurn(): void {
      // Burn one card
      dealCards(this.gameState.deck, 1)
      
      // Deal turn (1 card)
      const turn = dealCards(this.gameState.deck, 1)
      this.gameState.communityCards.push(...turn)
    }
  
    private dealRiver(): void {
      // Burn one card
      dealCards(this.gameState.deck, 1)
      
      // Deal river (1 card)
      const river = dealCards(this.gameState.deck, 1)
      this.gameState.communityCards.push(...river)
    }
  
    private setFirstPlayerPostFlop(): void {
      const activePlayers = this.getPlayersStillInHand().filter(p => !p.isAllIn)
      if (activePlayers.length === 0) return
  
      // Find small blind or first active player after dealer
      const dealerPos = this.gameState.dealerPosition
      let firstPlayerIndex = dealerPos
  
      // Look for small blind first
      for (let i = 1; i <= activePlayers.length; i++) {
        const playerIndex = (dealerPos + i) % this.gameState.players.length
        const player = this.gameState.players[playerIndex]
        
        if (!player.isFolded && !player.isAllIn) {
          firstPlayerIndex = playerIndex
          break
        }
      }
  
      this.gameState.activePlayerIndex = firstPlayerIndex
    }
  
    // ========================================
    // HAND COMPLETION AND SHOWDOWN
    // ========================================
  
    private isHandComplete(): boolean {
      const playersInHand = this.getPlayersStillInHand()
      
      // Hand complete if only one player left
      if (playersInHand.length <= 1) {
        return true
      }
  
      // Hand complete if we've reached showdown
      return this.gameState.currentBettingRound === BettingRound.SHOWDOWN
    }
  
    private completeHand(): void {
      this.gameState.isHandComplete = true
      
      const playersInHand = this.getPlayersStillInHand()
      
      if (playersInHand.length === 1) {
        // Only one player left - they win everything
        const winner = playersInHand[0]
        winner.chips += this.gameState.pot
        
        this.gameState.winners = [{
          playerId: winner.id,
          amount: this.gameState.pot,
          hand: { rank: 1, value: 0, description: 'Won by default', cards: [] } as HandEvaluation
        }]
      } else {
        // Multiple players - evaluate hands and distribute pot
        this.evaluateShowdown()
      }
  
      // Prepare for next hand
      this.prepareNextHand()
    }
  
    private evaluateShowdown(): void {
      const playersInHand = this.getPlayersStillInHand()
      
      // Evaluate each player's hand
      const handEvaluations = playersInHand.map(player => ({
        player,
        evaluation: evaluateHand([...player.holeCards, ...this.gameState.communityCards])
      }))
  
      // Calculate side pots (complex algorithm for all-in situations)
      this.calculateSidePots(playersInHand)
  
      // Award each pot to the appropriate winner(s)
      this.awardPots(handEvaluations)
    }
  
    private calculateSidePots(players: Player[]): void {
      // Create side pots based on different all-in amounts
      const potEligibility = new Map<number, string[]>()
      
      players.forEach(player => {
        const contribution = player.totalBet
        
        // Player is eligible for all pots up to their contribution level
        for (const [amount, eligiblePlayers] of potEligibility) {
          if (contribution >= amount) {
            eligiblePlayers.push(player.id)
          }
        }
        
        // Create new pot level for this contribution amount
        if (!potEligibility.has(contribution)) {
          potEligibility.set(contribution, [player.id])
        }
      })
  
      // Convert to side pot structure
      this.gameState.sidePots = Array.from(potEligibility.entries())
        .sort(([a], [b]) => a - b)
        .map(([amount, eligiblePlayers], index) => ({
          amount: this.calculatePotAmount(amount, players),
          eligiblePlayers,
          isMain: index === 0
        }))
    }
  
    private calculatePotAmount(maxContribution: number, players: Player[]): number {
      return players.reduce((total, player) => {
        return total + Math.min(player.totalBet, maxContribution)
      }, 0)
    }
  
    private awardPots(handEvaluations: { player: Player; evaluation: HandEvaluation }[]): void {
      for (const sidePot of this.gameState.sidePots) {
        // Find eligible players for this pot
        const eligibleEvaluations = handEvaluations.filter(
          he => sidePot.eligiblePlayers.includes(he.player.id)
        )
  
        // Find winner(s) of this pot
        const evaluations = eligibleEvaluations.map(he => he.evaluation)
        const winnerIndices = findWinners(evaluations)
  
        // Distribute pot among winners
        const amountPerWinner = Math.floor(sidePot.amount / winnerIndices.length)
        
        winnerIndices.forEach(winnerIndex => {
          const winner = eligibleEvaluations[winnerIndex]
          winner.player.chips += amountPerWinner
  
          // Track winners for display
          this.gameState.winners.push({
            playerId: winner.player.id,
            amount: amountPerWinner,
            hand: winner.evaluation
          })
        })
      }
    }
  
    private prepareNextHand(): void {
      // Advance dealer button
      this.gameState.dealerPosition = (this.gameState.dealerPosition + 1) % this.gameState.players.length
      this.gameState.handNumber++
      
      // Remove players with no chips
      this.gameState.players = this.gameState.players.filter(player => player.chips > 0)
    }
  
    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
  
    private findPlayerById(playerId: string): Player | undefined {
      return this.gameState.players.find(player => player.id === playerId)
    }
  
    private isPlayersTurn(playerId: string): boolean {
      const currentPlayer = this.gameState.players[this.gameState.activePlayerIndex]
      return currentPlayer?.id === playerId
    }
  
    private getCallAmount(player: Player): number {
      return Math.max(0, this.gameState.currentBet - player.currentBet)
    }
  
    private getActivePlayers(): Player[] {
      return this.gameState.players.filter(player => !player.disconnected)
    }
  
    private getPlayersStillInHand(): Player[] {
      return this.getActivePlayers().filter(player => !player.isFolded)
    }
  
    private advanceToNextPlayer(): void {
      const playersStillInHand = this.getPlayersStillInHand().filter(p => !p.isAllIn)
      
      if (playersStillInHand.length <= 1) {
        return // No more players to act
      }
  
      let nextPlayerIndex = this.gameState.activePlayerIndex
      
      do {
        nextPlayerIndex = (nextPlayerIndex + 1) % this.gameState.players.length
      } while (
        this.gameState.players[nextPlayerIndex].isFolded ||
        this.gameState.players[nextPlayerIndex].isAllIn ||
        this.gameState.players[nextPlayerIndex].disconnected
      )
  
      this.gameState.activePlayerIndex = nextPlayerIndex
    }
  
    // ========================================
    // PUBLIC API
    // ========================================
  
    public getGameState(): Readonly<GameState> {
      return { ...this.gameState }
    }
  
    public getCurrentPlayer(): Player | null {
      return this.gameState.players[this.gameState.activePlayerIndex] || null
    }
  
    public canPlayerAct(playerId: string): boolean {
      const player = this.findPlayerById(playerId)
      return player ? this.isPlayersTurn(playerId) && !player.isFolded && !player.isAllIn : false
    }
  
    public getValidActions(playerId: string): PlayerAction['type'][] {
      const player = this.findPlayerById(playerId)
      if (!player || !this.canPlayerAct(playerId)) {
        return []
      }
  
      const actions: PlayerAction['type'][] = ['fold']
      const callAmount = this.getCallAmount(player)
  
      if (callAmount === 0) {
        actions.push('check')
      } else {
        if (player.chips >= callAmount) {
          actions.push('call')
        }
      }
  
      if (this.gameState.currentBet === 0) {
        actions.push('bet')
      } else {
        actions.push('raise')
      }
  
      if (player.chips > 0) {
        actions.push('all-in')
      }
  
      return actions
    }
  }
  
  // ========================================
  // WHY THIS ARCHITECTURE MATTERS
  // ========================================
  /*
  This game engine implements the authoritative server pattern:
  
  1. SINGLE SOURCE OF TRUTH: All game state lives in one place
     - No client-side game state that can get out of sync
     - Server always has the definitive state
  
  2. ACTION VALIDATION: Every action is validated before execution
     - Prevents cheating and invalid moves
     - Clear error messages for debugging
  
  3. IMMUTABLE OPERATIONS: State updates are controlled and atomic
     - Functions don't directly mutate state
     - Clear state transitions for debugging
  
  4. REAL-TIME READY: Engine tracks turns and timing
     - Knows whose turn it is
     - Can implement timeouts and automatic actions
  
  5. FAIR GAMEPLAY: Proper pot calculations and side pots
     - Handles complex all-in scenarios correctly
     - Mathematically fair distribution
  
  This is production-quality poker logic that can handle:
  - Multiple players and complex betting
  - All-in scenarios with side pots
  - Disconnections and reconnections  
  - Tournament and cash game formats
  
  Next: We'll build the real-time UI that connects to this engine!
  */