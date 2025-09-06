// lib/poker/deck.ts
// ========================================
// DECK OPERATIONS - CARD GAME FUNDAMENTALS
// ========================================
// This file handles all deck-related operations: creation, shuffling, dealing.
// Understanding random number generation and shuffling algorithms is crucial
// for fair gameplay and preventing predictable patterns.

import { Card } from './types'

// ========================================
// DECK CREATION
// ========================================

/**
 * Creates a standard 52-card deck
 * This is the foundation of any poker game
 */
export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
  const ranks: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
  
  const deck: Card[] = []
  
  // Nested loops create all 52 combinations
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank })
    }
  }
  
  return deck
}

// ========================================
// SHUFFLING ALGORITHMS
// ========================================

/**
 * Fisher-Yates shuffle algorithm - the gold standard for card shuffling
 * This algorithm ensures every possible permutation is equally likely
 * 
 * Why not just use array.sort(() => Math.random() - 0.5)?
 * That approach has bias and doesn't produce truly random shuffles!
 */
export function shuffleDeck(deck: Card[]): Card[] {
  // Create a copy to avoid mutating the original
  const shuffled = [...deck]
  
  // Fisher-Yates shuffle: iterate from end to beginning
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Pick random element from remaining unshuffled portion
    const j = Math.floor(Math.random() * (i + 1))
    
    // Swap elements at positions i and j
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}

/**
 * Cryptographically secure shuffle for high-stakes games
 * Uses crypto.getRandomValues() instead of Math.random()
 * Prevents potential manipulation of Math.random() seed
 */
export function shuffleDeckSecure(deck: Card[]): Card[] {
  const shuffled = [...deck]
  
  // Create typed array for crypto random values
  const randomBytes = new Uint32Array(deck.length)
  
  // Fill with cryptographically secure random values
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    window.crypto.getRandomValues(randomBytes)
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    // Node.js environment (newer versions)
    globalThis.crypto.getRandomValues(randomBytes)
  } else {
    // Fallback to Math.random (not cryptographically secure)
    console.warn('Cryptographically secure random not available, falling back to Math.random')
    return shuffleDeck(deck)
  }
  
  // Apply Fisher-Yates with secure random values
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomBytes[shuffled.length - 1 - i] % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}

// ========================================
// CARD UTILITIES
// ========================================

/**
 * Convert card rank to numeric value for comparisons
 * Ace handling is context-dependent in poker
 */
export function rankToValue(rank: Card['rank'], aceHigh: boolean = true): number {
  switch (rank) {
    case 'A': return aceHigh ? 14 : 1
    case 'K': return 13
    case 'Q': return 12
    case 'J': return 11
    case 'T': return 10
    default: return parseInt(rank, 10)
  }
}

/**
 * Convert card to human-readable string
 * Useful for logging, debugging, and UI display
 */
export function cardToString(card: Card): string {
  const suitSymbols = {
    hearts: '♥️',
    diamonds: '♦️',
    clubs: '♣️',
    spades: '♠️'
  }
  
  const rankNames: Record<Card['rank'], string> = {
    'A': 'Ace',
    'K': 'King', 
    'Q': 'Queen',
    'J': 'Jack',
    'T': '10',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9'
  }
  
  const rankDisplay = rankNames[card.rank]
  return `${rankDisplay} of ${card.suit} ${suitSymbols[card.suit]}`
}

/**
 * Short card notation for compact display
 * Examples: "AH", "KS", "TD"
 */
export function cardToShortString(card: Card): string {
  const suitLetters = {
    hearts: 'H',
    diamonds: 'D', 
    clubs: 'C',
    spades: 'S'
  }
  
  return `${card.rank}${suitLetters[card.suit]}`
}

/**
 * Compare two cards for sorting
 * Returns negative if card1 < card2, positive if card1 > card2, zero if equal
 */
export function compareCards(card1: Card, card2: Card, aceHigh: boolean = true): number {
  const value1 = rankToValue(card1.rank, aceHigh)
  const value2 = rankToValue(card2.rank, aceHigh)
  
  if (value1 !== value2) {
    return value1 - value2
  }
  
  // Same rank, compare suits (arbitrary order for consistency)
  const suitOrder = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 }
  return suitOrder[card1.suit] - suitOrder[card2.suit]
}

/**
 * Sort cards by rank (and suit as tiebreaker)
 */
export function sortCards(cards: Card[], aceHigh: boolean = true): Card[] {
  return [...cards].sort((a, b) => compareCards(a, b, aceHigh))
}

// ========================================
// DEALING OPERATIONS
// ========================================

/**
 * Deal cards from the top of the deck
 * Mutates the deck by removing dealt cards
 */
export function dealCards(deck: Card[], count: number): Card[] {
  if (deck.length < count) {
    throw new Error(`Cannot deal ${count} cards, only ${deck.length} remaining`)
  }
  
  // splice() removes and returns elements from array
  return deck.splice(0, count)
}

/**
 * Deal hole cards to multiple players
 * In poker, cards are dealt one at a time to each player in turn
 */
export function dealHoleCards(deck: Card[], playerCount: number, cardsPerPlayer: number = 2): Card[][] {
  const totalCards = playerCount * cardsPerPlayer
  
  if (deck.length < totalCards) {
    throw new Error(`Cannot deal ${totalCards} cards to ${playerCount} players`)
  }
  
  const playerHands: Card[][] = Array(playerCount).fill(null).map(() => [])
  
  // Deal one card at a time to each player (standard poker dealing)
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let player = 0; player < playerCount; player++) {
      const card = dealCards(deck, 1)[0]
      playerHands[player].push(card)
    }
  }
  
  return playerHands
}

/**
 * Deal community cards (flop, turn, river)
 * In casino poker, one card is burned before each community card round
 */
export function dealCommunityCards(deck: Card[], burnCard: boolean = true): {
  flop: Card[]
  turn: Card | null
  river: Card | null
  remainingDeck: Card[]
} {
  const workingDeck = [...deck]
  
  // Burn one card if specified (casino standard)
  if (burnCard && workingDeck.length > 0) {
    workingDeck.shift() // Remove and discard top card
  }
  
  // Deal flop (3 cards)
  const flop = dealCards(workingDeck, 3)
  
  // Prepare for turn and river (but don't deal yet)
  return {
    flop,
    turn: null,
    river: null,
    remainingDeck: workingDeck
  }
}

/**
 * Deal the turn card (4th community card)
 */
export function dealTurn(deck: Card[], burnCard: boolean = true): Card {
  if (burnCard && deck.length > 0) {
    deck.shift() // Burn card
  }
  
  const cards = dealCards(deck, 1)
  if (cards.length === 0) {
    throw new Error('No cards available to deal turn')
  }
  return cards[0]
}

/**
 * Deal the river card (5th community card)
 */
export function dealRiver(deck: Card[], burnCard: boolean = true): Card {
  if (burnCard && deck.length > 0) {
    deck.shift() // Burn card
  }
  
  const cards = dealCards(deck, 1)
  if (cards.length === 0) {
    throw new Error('No cards available to deal river')
  }
  return cards[0]
}

// ========================================
// DECK VALIDATION
// ========================================

/**
 * Validate that a deck contains exactly 52 unique cards
 * Useful for testing and anti-cheat measures
 */
export function validateDeck(deck: Card[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check deck size
  if (deck.length !== 52) {
    errors.push(`Deck has ${deck.length} cards, expected 52`)
  }
  
  // Check for duplicates
  const cardStrings = deck.map(cardToShortString)
  const uniqueCards = new Set(cardStrings)
  
  if (uniqueCards.size !== deck.length) {
    errors.push(`Deck contains duplicate cards`)
  }
  
  // Check that all required cards are present
  const standardDeck = createDeck()
  const standardCardStrings = new Set(standardDeck.map(cardToShortString))
  
  for (const cardString of cardStrings) {
    if (!standardCardStrings.has(cardString)) {
      errors.push(`Invalid card: ${cardString}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ========================================
// WHY THESE OPERATIONS MATTER
// ========================================
/*
1. FAIRNESS: Proper shuffling ensures no player has an advantage
   - Fisher-Yates guarantees uniform distribution
   - Cryptographic security prevents manipulation

2. GAME INTEGRITY: Dealing follows real poker procedures
   - Cards dealt one at a time (like real dealers)
   - Burn cards prevent card counting
   - Validation catches deck manipulation

3. PERFORMANCE: Efficient operations for real-time gameplay
   - No unnecessary array copies
   - Fast card comparisons for sorting
   - Minimal memory allocation

4. DEBUGGING: String representations help development
   - Easy to log game states
   - Human-readable error messages
   - Visual verification of card operations

5. EXTENSIBILITY: Foundation for other card games
   - Blackjack, Bridge, etc. can reuse these utilities
   - Easy to modify for different deck sizes
   - Clean separation of concerns

Next: We'll build hand evaluation using these deck operations!
*/