// lib/types.ts
// ========================================
// POKER GAME TYPES - FUNDAMENTAL CONCEPTS
// ========================================

// Basic playing card
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K'
}

// Hand rankings in poker (from weakest to strongest)
export enum HandRank {
  HIGH_CARD = 1,
  PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10
}

// Evaluated hand result
export interface HandEvaluation {
  rank: HandRank
  value: number
  description: string
  cards: Card[]
}

// Player actions available during betting rounds
export type PlayerAction = 
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'all-in'; amount: number }

// Player state during a hand
export interface Player {
  id: string
  name: string
  chips: number
  holeCards: Card[]
  currentBet: number
  totalBet: number
  position: number
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  hasActed: boolean
  isFolded: boolean
  isAllIn: boolean
  isAI: boolean
  disconnected: boolean
}

// Betting rounds in Texas Hold'em
export enum BettingRound {
  PREFLOP = 'preflop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river',
  SHOWDOWN = 'showdown'
}

// Side pot for all-in situations
export interface SidePot {
  amount: number
  eligiblePlayers: string[]
  isMain: boolean
}

// Complete game state
export interface GameState {
  tableId: string
  handNumber: number
  players: Player[]
  maxPlayers: number
  dealerPosition: number
  deck: Card[]
  communityCards: Card[]
  currentBettingRound: BettingRound
  currentBet: number
  pot: number
  sidePots: SidePot[]
  blinds: {
    small: number
    big: number
  }
  activePlayerIndex: number
  lastAction: PlayerAction | null
  actionTimeoutMs: number
  isHandComplete: boolean
  winners: {
    playerId: string
    amount: number
    hand: HandEvaluation
  }[]
  handStartTime: Date
  lastActionTime: Date
}

// Type guards for runtime validation
export const isValidCard = (card: any): card is Card => {
  return (
    typeof card === 'object' &&
    ['hearts', 'diamonds', 'clubs', 'spades'].includes(card.suit) &&
    ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'].includes(card.rank)
  )
}

export const isValidAction = (action: any): action is PlayerAction => {
  if (typeof action !== 'object' || !action.type) return false
  
  switch (action.type) {
    case 'fold':
    case 'check':
    case 'call':
      return true
    case 'bet':
    case 'raise':
    case 'all-in':
      return typeof action.amount === 'number' && action.amount > 0
    default:
      return false
  }
}