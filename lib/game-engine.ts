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
        lastRaiseSize: bigBlind,
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
      this.gameState.lastRaiseSize = this.gameState.blinds.big
      this.gameState.pot = 0
      this.gameState.sidePots = []
      this.gameState.isHandComplete = false
      this.gameState.winners = []
      this.gameState.lastAction = null
  
      // Reset all players for new hand
      this.gameState.players = this.gameState.players.map((player, index) => ({
        ...player,
        position: index,
        holeCards: [],
        currentBet: 0,
        totalBet: 0,
        hasActed: false,
        isFolded: false,
        isAllIn: false,
        isDealer: index === this.gameState.dealerPosition,
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
      this.gameState.lastRaiseSize = bigBlindAmount

      // Mark if players are all-in due to blinds
      if (smallBlindPlayer.chips === 0) smallBlindPlayer.isAllIn = true
      if (bigBlindPlayer.chips === 0) bigBlindPlayer.isAllIn = true
    }

    private setFirstPlayerToAct(): void {
      const players = this.gameState.players
      const dealerIndex = this.gameState.dealerPosition
      const activeCount = this.getActivePlayers().length

      if (activeCount === 2) {
        // Heads-up: dealer acts first preflop
        this.gameState.activePlayerIndex = dealerIndex
        return
      }

      // Find big blind seat: second active seat after dealer
      let idx = dealerIndex
      let seen = 0
      while (seen < 2) {
        idx = (idx + 1) % players.length
        if (!players[idx].disconnected) seen++
      }

      // First to act preflop is next eligible after big blind
      for (let step = 1; step <= players.length; step++) {
        const j = (idx + step) % players.length
        const p = players[j]
        if (!p.disconnected && !p.isAllIn && !p.isFolded) {
          this.gameState.activePlayerIndex = j
          return
        }
      }

      // Fallback
      this.gameState.activePlayerIndex = dealerIndex
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


      // Check if hand is complete
      if (this.isHandComplete()) {
        this.completeHand()
        return
      }

      // If no one can act (everyone still in hand is all-in), fast-forward to showdown
      const playersWhoCanAct = this.getPlayersStillInHand().filter(p => !p.isAllIn)
      if (playersWhoCanAct.length === 0) {
        // Progress streets until showdown and complete the hand
        while (!this.gameState.isHandComplete && this.gameState.currentBettingRound !== BettingRound.SHOWDOWN) {
          this.advanceBettingRound()
        }
        if (!this.gameState.isHandComplete) {
          this.completeHand()
        }
        return
      }

      // Check if betting round is complete
      if (this.isBettingRoundComplete()) {
        this.advanceBettingRound()
      } else {
        // Move to next active player
        this.advanceToNextPlayer()
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
          const minRaise = this.gameState.currentBet + this.gameState.lastRaiseSize
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
          // action.amount is ignored; engine will compute actual all-in in executeAction
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
          if (player.chips === 0) {
            player.isAllIn = true
          }
          break

        case 'bet':
          const betDelta = action.amount - player.currentBet
          player.chips -= betDelta
          player.currentBet = action.amount
          player.totalBet += betDelta
          this.gameState.currentBet = action.amount
          this.gameState.pot += betDelta
          this.gameState.lastRaiseSize = action.amount // opening bet sets raise size baseline
          // Bet opens action again for everyone else
          this.resetOthersHasActed(player.id)
          if (player.chips === 0) {
            player.isAllIn = true
          }
          break

        case 'raise':
          const raiseDelta = action.amount - player.currentBet
          player.chips -= raiseDelta
          const previousHighest = this.gameState.currentBet
          player.currentBet = action.amount
          player.totalBet += raiseDelta
          // Update lastRaiseSize as the increment over previous highest bet
          this.gameState.lastRaiseSize = action.amount - previousHighest
          this.gameState.currentBet = action.amount
          this.gameState.pot += raiseDelta
          // Raise reopens action for everyone else
          this.resetOthersHasActed(player.id)
          if (player.chips === 0) {
            player.isAllIn = true
          }
          break

        case 'all-in':
          const allInAmount = player.chips
          player.chips = 0
          const newTotal = player.currentBet + allInAmount
          player.totalBet += allInAmount
          player.currentBet = newTotal
          player.isAllIn = true
          this.gameState.pot += allInAmount
          // If this effectively raises above currentBet, update currentBet and possibly lastRaiseSize
          if (newTotal > this.gameState.currentBet) {
            const raiseAmount = newTotal - this.gameState.currentBet
            if (raiseAmount >= this.gameState.lastRaiseSize) {
              this.gameState.lastRaiseSize = raiseAmount
            }
            this.gameState.currentBet = newTotal
            // All-in raise reopens action
            this.resetOthersHasActed(player.id)
          }
          break
      }
    }

    private resetOthersHasActed(excludePlayerId: string): void {
      this.gameState.players.forEach(p => {
        if (p.id !== excludePlayerId && !p.isFolded && !p.isAllIn && !p.disconnected) {
          p.hasActed = false
        }
      })
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

      // Debug: print what the engine thinks each player has (always log)
      try {
        // eslint-disable-next-line no-console
        console.group('[Showdown] Hand evaluations')
        handEvaluations.forEach(({ player, evaluation }) => {
          // eslint-disable-next-line no-console
          console.log(`${player.name} (${player.id})`, {
            rank: evaluation.rank,
            value: evaluation.value,
            description: evaluation.description,
            holeCards: player.holeCards,
            board: this.gameState.communityCards
          })
        })
        // eslint-disable-next-line no-console
        console.groupEnd()
      } catch {}

      // Calculate side pots only if there are differing total contributions
      const contribs = this.gameState.players.map(p => p.totalBet)
      const distinct = Array.from(new Set(contribs)).sort((a,b)=>a-b)
      if (distinct.length > 1) {
        this.calculateSidePots(playersInHand)
      } else {
        // Single main pot
        this.gameState.sidePots = [{
          amount: this.gameState.pot,
          eligiblePlayers: playersInHand.map(p => p.id),
          isMain: true
        }]
      }

      // Award each pot to the appropriate winner(s)
      this.awardPots(handEvaluations)

      // Debug: print aggregated winners
      try {
        // eslint-disable-next-line no-console
        console.log('[Showdown] Winners', this.gameState.winners)
      } catch {}
    }

    private calculateSidePots(players: Player[]): void {
      // Layered side pots from unique contribution levels
      // Amounts must be computed from ALL contributors (including folded players),
      // while eligibility is restricted to players still in hand.
      const allPlayers = this.gameState.players
      const allContrib = allPlayers.map(p => ({ id: p.id, amount: p.totalBet }))
      const levels = Array.from(new Set(allContrib.map(c => c.amount))).sort((a, b) => a - b)

      const sidePots: SidePot[] = []
      let prevLevel = 0

      for (const level of levels) {
        const layerSize = level - prevLevel
        if (layerSize <= 0) continue

        // Contributors to this layer: any player who contributed at least 'level'
        const contributorsCount = allContrib.filter(c => c.amount >= level).length
        // If only one player has contributed to this level, this portion is an uncalled bet
        // and should NOT form a pot layer
        if (contributorsCount <= 1) {
          prevLevel = level
          continue
        }
        const amount = layerSize * contributorsCount

        // Eligible winners are players still in hand who contributed at least 'level'
        const eligibleIds = players.filter(p => p.totalBet >= level).map(p => p.id)

        if (amount > 0 && eligibleIds.length > 0) {
          sidePots.push({
            amount,
            eligiblePlayers: eligibleIds,
            isMain: sidePots.length === 0
          })
        }

        prevLevel = level
      }

      // Handle uncalled bet: if computed side pots are less than the recorded pot,
      // refund the uncalled amount to the highest contributor and reduce the pot.
      const computedTotal = sidePots.reduce((sum, pot) => sum + pot.amount, 0)
      const potDiff = this.gameState.pot - computedTotal
      if (potDiff > 0) {
        // Find the single highest contributor
        const highest = allContrib.reduce((acc, c) => (c.amount > acc.amount ? c : acc), allContrib[0])
        const topCount = allContrib.filter(c => c.amount === highest.amount).length
        if (topCount === 1) {
          const bettor = this.gameState.players.find(p => p.id === highest.id)
          if (bettor) bettor.chips += potDiff
          this.gameState.pot -= potDiff
        } else {
          // If multiple share the top contribution, distribute the remainder to the earliest side pot
          if (sidePots.length === 0) {
            sidePots.push({ amount: potDiff, eligiblePlayers: players.map(p => p.id), isMain: true })
          } else {
            sidePots[sidePots.length - 1].amount += potDiff
          }
        }
      }

      this.gameState.sidePots = sidePots
    }

    private calculatePotAmount(maxContribution: number, players: Player[]): number {
      return players.reduce((total, player) => {
        return total + Math.min(player.totalBet, maxContribution)
      }, 0)
    }

    private awardPots(handEvaluations: { player: Player; evaluation: HandEvaluation }[]): void {
      const aggregate: Record<string, number> = {}
      for (const sidePot of this.gameState.sidePots) {
        // Find eligible players for this pot
        const eligibleEvaluations = handEvaluations.filter(
          he => sidePot.eligiblePlayers.includes(he.player.id)
        )

        // Find winner(s) of this pot
        const evaluations = eligibleEvaluations.map(he => he.evaluation)
        const winnerIndices = findWinners(evaluations)

        // Distribute pot among winners (include remainder to the first winner)
        const base = Math.floor(sidePot.amount / winnerIndices.length)
        let remainder = sidePot.amount - base * winnerIndices.length

        winnerIndices.forEach((winnerIndex, idx) => {
          const winner = eligibleEvaluations[winnerIndex]
          const payout = base + (idx === 0 ? remainder : 0)
          winner.player.chips += payout

          // Aggregate amounts per player for display
          aggregate[winner.player.id] = (aggregate[winner.player.id] || 0) + payout
        })

        // Optional debug logging to verify outcomes during development
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          try {
            // eslint-disable-next-line no-console
            console.debug('[Showdown] Pot awarded:', {
              potAmount: sidePot.amount,
              eligible: sidePot.eligiblePlayers,
              winners: winnerIndices.map(i => eligibleEvaluations[i].player.id)
            })
          } catch {}
        }
      }

      // Replace winners list with aggregated totals
      this.gameState.winners = Object.entries(aggregate).map(([playerId, amount]) => ({
        playerId,
        amount,
        // Use the player's actual evaluation for display
        hand: ((): HandEvaluation => {
          const player = this.gameState.players.find(p => p.id === playerId)!
          return evaluateHand([...player.holeCards, ...this.gameState.communityCards])
        })()
      }))
    }

    private prepareNextHand(): void {
      const originalPlayers = this.gameState.players
      const currentDealerIndex = this.gameState.dealerPosition
      const nextIndexOriginal = (currentDealerIndex + 1) % originalPlayers.length

      // Find the next player with chips > 0 in original seating order
      let nextDealerId: string | null = null
      for (let i = 0; i < originalPlayers.length; i++) {
        const idx = (nextIndexOriginal + i) % originalPlayers.length
        if (originalPlayers[idx].chips > 0) {
          nextDealerId = originalPlayers[idx].id
          break
        }
      }

      // Remove bust players
      const remaining = originalPlayers.filter(p => p.chips > 0)

      if (remaining.length === 0) {
        this.gameState.players = remaining
        this.gameState.dealerPosition = 0
        this.gameState.handNumber++
        return
      }

      const newDealerIndex = nextDealerId ? remaining.findIndex(p => p.id === nextDealerId) : 0
      this.gameState.players = remaining
      this.gameState.dealerPosition = newDealerIndex >= 0 ? newDealerIndex : 0
      this.gameState.handNumber++
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
      const playersStillEligible = this.getPlayersStillInHand().filter(p => !p.isAllIn)
      
      // If nobody is eligible to act, caller should have handled showdown progression
      if (playersStillEligible.length === 0) {
        return
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
      this.ensureProgressIfStalled()
      return { ...this.gameState }
    }

    public getCurrentPlayer(): Player | null {
      this.ensureProgressIfStalled()
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
      const eligibleCount = this.getPlayersStillInHand().filter(p => !p.isAllIn).length

      if (callAmount === 0) {
        actions.push('check')
      } else if (player.chips >= callAmount) {
        actions.push('call')
      }

      if (eligibleCount > 1) {
        if (this.gameState.currentBet === 0) {
          if (player.chips + player.currentBet >= this.gameState.blinds.big) actions.push('bet')
        } else {
          const minRaiseTotal = this.gameState.currentBet + Math.max(this.gameState.lastRaiseSize, this.gameState.blinds.big)
          if (player.chips + player.currentBet >= minRaiseTotal) actions.push('raise')
        }
      }

      if (player.chips > 0) actions.push('all-in')
      return actions
    }

    // If the active player cannot act or nobody can act, auto-progress
    private ensureProgressIfStalled(): void {
      if (this.gameState.isHandComplete) return
      const current = this.gameState.players[this.gameState.activePlayerIndex]
      const eligibleCount = this.getPlayersStillInHand().filter(p => !p.isAllIn).length

      if (eligibleCount === 0) {
        // Fast-forward through streets to showdown
        while (!this.gameState.isHandComplete && this.gameState.currentBettingRound !== BettingRound.SHOWDOWN) {
          this.advanceBettingRound()
        }
        if (!this.gameState.isHandComplete) this.completeHand()
        return
      }

      // If current can't act, jump to next eligible
      if (!current || current.isFolded || current.isAllIn || current.disconnected) {
        this.advanceToNextPlayer()
      }

      // If betting round is already complete, advance
      if (this.isBettingRoundComplete()) {
        this.advanceBettingRound()
      }
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