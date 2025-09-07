// lib/poker/hand-evaluator.ts
// ========================================
// HAND EVALUATION ENGINE - THE HEART OF POKER
// ========================================
// This is where the mathematical beauty of poker shines. We need to:
// 1. Take 5-7 cards and find the best possible 5-card hand
// 2. Rank hands according to poker rules
// 3. Break ties correctly (kickers, high cards, etc.)
// 4. Do it efficiently for real-time gameplay

import { Card, HandRank, HandEvaluation } from './types'
import { rankToValue, sortCards } from './deck'

// ========================================
// MAIN EVALUATION FUNCTION
// ========================================

/**
 * Evaluate the best possible hand from 5-7 cards
 * In Texas Hold'em, players use 2 hole cards + 5 community cards = 7 total
 * We need to find the best 5-card combination
 */
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards to evaluate, got ${cards.length}`)
  }

  if (cards.length === 5) {
    return evaluateFiveCards(cards)
  }

  // Robust 7-card evaluator (works for 6 or 7 cards)
  return evaluateSevenCards(cards)
}

/**
 * Find the best 5-card hand from 6 or 7 cards
 * Uses combinatorial approach - checks all possible 5-card combinations
 */
function findBestHand(cards: Card[]): HandEvaluation {
  const combinations = generateCombinations(cards, 5)
  let bestHand: HandEvaluation | null = null
  
  for (const combination of combinations) {
    const evaluation = evaluateFiveCards(combination)
    
    if (!bestHand || evaluation.value > bestHand.value) {
      bestHand = evaluation
    }
  }
  
  if (!bestHand) {
    throw new Error('Failed to evaluate hand')
  }
  
  return bestHand
}

// ========================================
// SEVEN-CARD (6-7) EVALUATION
// ========================================

function evaluateSevenCards(cards: Card[]): HandEvaluation {
  // Build rank and suit maps
  const bySuit: Record<Card['suit'], Card[]> = {
    hearts: [], diamonds: [], clubs: [], spades: []
  }
  const rankCounts: Record<number, number> = {}
  const rankToCards: Record<number, Card[]> = {}

  for (const c of cards) {
    bySuit[c.suit].push(c)
    const v = rankToValue(c.rank)
    rankCounts[v] = (rankCounts[v] || 0) + 1
    ;(rankToCards[v] ||= []).push(c)
  }

  const uniqueValuesAsc = Object.keys(rankCounts).map(n => parseInt(n, 10)).sort((a,b)=>a-b)
  const uniqueValuesDesc = [...uniqueValuesAsc].sort((a,b)=>b-a)

  // Straight helper (values array should be unique)
  const findStraightHigh = (valuesAsc: number[]): number | null => {
    if (valuesAsc.length < 5) return null
    // Handle wheel A-2-3-4-5
    const withWheel = valuesAsc.includes(14) ? [1, ...valuesAsc] : [...valuesAsc]
    let run = 1
    let bestHigh: number | null = null
    for (let i = 1; i < withWheel.length; i++) {
      if (withWheel[i] === withWheel[i-1] + 1) {
        run++
        if (run >= 5) bestHigh = withWheel[i]
      } else if (withWheel[i] !== withWheel[i-1]) {
        run = 1
      }
    }
    return bestHigh
  }

  // 1) Straight Flush
  let flushSuit: Card['suit'] | null = null
  for (const s of Object.keys(bySuit) as Card['suit'][] ) {
    if (bySuit[s].length >= 5) {
      flushSuit = s
      break
    }
  }
  if (flushSuit) {
    const valsAsc = Array.from(new Set(bySuit[flushSuit].map(c => rankToValue(c.rank)))).sort((a,b)=>a-b)
    const sfHigh = findStraightHigh(valsAsc)
    if (sfHigh) {
      const isRoyal = sfHigh === 14
      const category = isRoyal ? HandRank.ROYAL_FLUSH : HandRank.STRAIGHT_FLUSH
      const rankBase = category * 1_000_000_000
      const encode = (arr: number[], width: number) => arr.slice(0, width).reduce((acc, v) => acc * 15 + v, 0)
      return {
        rank: category,
        value: rankBase + encode([sfHigh], 1),
        description: isRoyal ? 'Royal Flush' : `Straight Flush, ${sfHigh} high`,
        cards: []
      }
    }
  }

  // 2) Four of a kind
  const quad = uniqueValuesDesc.find(v => rankCounts[v] === 4)
  if (quad) {
    const kicker = uniqueValuesDesc.find(v => v !== quad) || 2
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      value: HandRank.FOUR_OF_A_KIND * 1_000_000_000 + (quad * 15 + kicker),
      description: `Four of a Kind, ${quad}s`,
      cards: []
    }
  }

  // 3) Full house (best trips + best pair from remaining)
  const tripsDesc = uniqueValuesDesc.filter(v => rankCounts[v] >= 3)
  const pairsDesc = uniqueValuesDesc.filter(v => rankCounts[v] >= 2)
  if (tripsDesc.length >= 1) {
    const bestTrips = tripsDesc[0]
    const pairCandidates = pairsDesc.filter(v => v !== bestTrips)
    if (pairCandidates.length >= 1) {
      const bestPair = pairCandidates[0]
      return {
        rank: HandRank.FULL_HOUSE,
        value: HandRank.FULL_HOUSE * 1_000_000_000 + (bestTrips * 15 + bestPair),
        description: `Full House, ${bestTrips}s over ${bestPair}s`,
        cards: []
      }
    }
    // Two sets of trips: use second as pair
    if (tripsDesc.length >= 2) {
      const secondTrips = tripsDesc[1]
      return {
        rank: HandRank.FULL_HOUSE,
        value: HandRank.FULL_HOUSE * 1_000_000_000 + (bestTrips * 15 + secondTrips),
        description: `Full House, ${bestTrips}s over ${secondTrips}s`,
        cards: []
      }
    }
  }

  // 4) Flush
  if (flushSuit) {
    const top5 = Array.from(new Set(bySuit[flushSuit].map(c => rankToValue(c.rank)))).sort((a,b)=>b-a).slice(0,5)
    return {
      rank: HandRank.FLUSH,
      value: HandRank.FLUSH * 1_000_000_000 + top5.reduce((acc, v) => acc * 15 + v, 0),
      description: `Flush, ${top5[0]} high`,
      cards: []
    }
  }

  // 5) Straight
  const straightHigh = findStraightHigh(uniqueValuesAsc)
  if (straightHigh) {
    return {
      rank: HandRank.STRAIGHT,
      value: HandRank.STRAIGHT * 1_000_000_000 + straightHigh,
      description: `Straight, ${straightHigh} high`,
      cards: []
    }
  }

  // 6) Three of a kind
  if (tripsDesc.length >= 1) {
    const t = tripsDesc[0]
    const kickers = uniqueValuesDesc.filter(v => v !== t).slice(0,2)
    return {
      rank: HandRank.THREE_OF_A_KIND,
      value: HandRank.THREE_OF_A_KIND * 1_000_000_000 + [t, (kickers[0]||0), (kickers[1]||0)].reduce((acc, v) => acc * 15 + v, 0),
      description: `Three of a Kind, ${t}s`,
      cards: []
    }
  }

  // 7) Two Pair
  if (pairsDesc.length >= 2) {
    const [p1, p2] = pairsDesc.slice(0,2)
    const kicker = uniqueValuesDesc.find(v => v !== p1 && v !== p2) || 0
    return {
      rank: HandRank.TWO_PAIR,
      value: HandRank.TWO_PAIR * 1_000_000_000 + [p1, p2, kicker].reduce((acc, v) => acc * 15 + v, 0),
      description: `Two Pair, ${p1}s and ${p2}s`,
      cards: []
    }
  }

  // 8) One Pair
  if (pairsDesc.length === 1) {
    const p = pairsDesc[0]
    const kickers = uniqueValuesDesc.filter(v => v !== p).slice(0,3)
    return {
      rank: HandRank.PAIR,
      value: HandRank.PAIR * 1_000_000_000 + [p, (kickers[0]||0), (kickers[1]||0), (kickers[2]||0)].reduce((acc, v) => acc * 15 + v, 0),
      description: `Pair of ${p}s`,
      cards: []
    }
  }

  // 9) High Card
  const highs = uniqueValuesDesc.slice(0,5)
  return {
    rank: HandRank.HIGH_CARD,
    value: HandRank.HIGH_CARD * 1_000_000_000 + highs.reduce((acc, v) => acc * 15 + v, 0),
    description: `High Card, ${highs[0]}`,
    cards: []
  }
}

/**
 * Generate all possible combinations of k items from array
 * Mathematical foundation: C(n,k) = n! / (k!(n-k)!)
 */
function generateCombinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > array.length) return []
  
  const result: T[][] = []
  
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current])
      return
    }
    
    for (let i = start; i < array.length; i++) {
      current.push(array[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }
  
  backtrack(0, [])
  return result
}

// ========================================
// FIVE-CARD HAND EVALUATION
// ========================================

/**
 * Evaluate exactly 5 cards and determine hand rank
 * This is the core algorithm that implements poker hand rankings
 */
function evaluateFiveCards(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error(`Expected exactly 5 cards, got ${cards.length}`)
  }
  
  // Sort cards by rank for easier analysis
  const sortedCards = sortCards(cards, true) // Ace high
  
  // Check for each hand type from strongest to weakest
  let evaluation: HandEvaluation | null = null
  
  // Royal Flush: A, K, Q, J, 10 all same suit
  evaluation = checkRoyalFlush(sortedCards)
  if (evaluation) return evaluation
  
  // Straight Flush: 5 consecutive cards, same suit  
  evaluation = checkStraightFlush(sortedCards)
  if (evaluation) return evaluation
  
  // Four of a Kind: 4 cards of same rank
  evaluation = checkFourOfAKind(sortedCards)
  if (evaluation) return evaluation
  
  // Full House: 3 of a kind + pair
  evaluation = checkFullHouse(sortedCards)
  if (evaluation) return evaluation
  
  // Flush: 5 cards same suit (not consecutive)
  evaluation = checkFlush(sortedCards)
  if (evaluation) return evaluation
  
  // Straight: 5 consecutive cards (not same suit)
  evaluation = checkStraight(sortedCards)
  if (evaluation) return evaluation
  
  // Three of a Kind: 3 cards same rank
  evaluation = checkThreeOfAKind(sortedCards)
  if (evaluation) return evaluation
  
  // Two Pair: 2 pairs of different ranks
  evaluation = checkTwoPair(sortedCards)
  if (evaluation) return evaluation
  
  // One Pair: 2 cards same rank
  evaluation = checkOnePair(sortedCards)
  if (evaluation) return evaluation
  
  // High Card: No other hand type
  return checkHighCard(sortedCards)
}

// ========================================
// INDIVIDUAL HAND TYPE CHECKERS
// ========================================

const CATEGORY_BASE = 1_000_000_000
const encode = (arr: number[]): number => arr.reduce((acc, v) => acc * 15 + v, 0)

function checkRoyalFlush(cards: Card[]): HandEvaluation | null {
  const isFlush = cards.every(card => card.suit === cards[0].suit)
  if (!isFlush) return null
  
  const ranksSet = new Set(cards.map(card => card.rank))
  const royalRanks: Card['rank'][] = ['T', 'J', 'Q', 'K', 'A']
  
  const isRoyal = royalRanks.every(r => ranksSet.has(r))
  if (!isRoyal) return null
  
  return {
    rank: HandRank.ROYAL_FLUSH,
    value: HandRank.ROYAL_FLUSH * CATEGORY_BASE + 14,
    description: `Royal Flush in ${cards[0].suit}`,
    cards: [...cards]
  }
}

function checkStraightFlush(cards: Card[]): HandEvaluation | null {
  const isFlush = cards.every(card => card.suit === cards[0].suit)
  if (!isFlush) return null
  
  const straight = checkStraight(cards)
  if (!straight) return null
  
  // Derive high card from straight evaluation
  const straightHigh = straight.value - HandRank.STRAIGHT * CATEGORY_BASE
  
  return {
    rank: HandRank.STRAIGHT_FLUSH,
    value: HandRank.STRAIGHT_FLUSH * CATEGORY_BASE + straightHigh,
    description: straight.description.replace('Straight', 'Straight Flush'),
    cards: [...cards]
  }
}

function checkFourOfAKind(cards: Card[]): HandEvaluation | null {
  const rankCounts = getRankCounts(cards)
  const quadRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 4)
  
  if (!quadRank) return null
  
  const kicker = Object.keys(rankCounts).find(rank => rank !== quadRank)!
  
  return {
    rank: HandRank.FOUR_OF_A_KIND,
    value: HandRank.FOUR_OF_A_KIND * CATEGORY_BASE + encode([
      rankToValue(quadRank as Card['rank']),
      rankToValue(kicker as Card['rank'])
    ]),
    description: `Four of a Kind, ${quadRank}s`,
    cards: [...cards]
  }
}

function checkFullHouse(cards: Card[]): HandEvaluation | null {
  const rankCounts = getRankCounts(cards)
  const tripleRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 3)
  const pairRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 2)
  
  if (!tripleRank || !pairRank) return null
  
  return {
    rank: HandRank.FULL_HOUSE,
    value: HandRank.FULL_HOUSE * CATEGORY_BASE + encode([
      rankToValue(tripleRank as Card['rank']),
      rankToValue(pairRank as Card['rank'])
    ]),
    description: `Full House, ${tripleRank}s over ${pairRank}s`,
    cards: [...cards]
  }
}

function checkFlush(cards: Card[]): HandEvaluation | null {
  const isFlush = cards.every(card => card.suit === cards[0].suit)
  if (!isFlush) return null
  
  // Check if it's a straight (would be straight flush)
  if (checkStraight(cards)) return null
  
  // Value based on all 5 cards (highest to lowest)
  const values = cards.map(card => rankToValue(card.rank)).sort((a, b) => b - a)
  
  return {
    rank: HandRank.FLUSH,
    value: HandRank.FLUSH * CATEGORY_BASE + encode(values),
    description: `Flush, ${cards[cards.length - 1].rank} high`,
    cards: [...cards]
  }
}

function checkStraight(cards: Card[]): HandEvaluation | null {
  const values = cards.map(card => rankToValue(card.rank)).sort((a, b) => a - b)
  
  // Check for regular straight
  let isStraight = true
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) {
      isStraight = false
      break
    }
  }
  
  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      value: HandRank.STRAIGHT * CATEGORY_BASE + values[values.length - 1],
      description: `Straight, ${cards[cards.length - 1].rank} high`,
      cards: [...cards]
    }
  }
  
  // Check for A-2-3-4-5 straight (wheel/bicycle)
  const wheelValues = [1, 2, 3, 4, 5] // Ace low
  const aceLowValues = cards.map(card => card.rank === 'A' ? 1 : rankToValue(card.rank)).sort((a, b) => a - b)
  
  if (JSON.stringify(aceLowValues) === JSON.stringify(wheelValues)) {
    return {
      rank: HandRank.STRAIGHT,
      value: HandRank.STRAIGHT * CATEGORY_BASE + 5, // 5-high straight
      description: 'Straight, 5 high (wheel)',
      cards: [...cards]
    }
  }
  
  return null
}

function checkThreeOfAKind(cards: Card[]): HandEvaluation | null {
  const rankCounts = getRankCounts(cards)
  const tripleRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 3)
  
  if (!tripleRank) return null
  
  const kickers = Object.keys(rankCounts)
    .filter(rank => rank !== tripleRank)
    .map(rank => rankToValue(rank as Card['rank']))
    .sort((a, b) => b - a)
  
  return {
    rank: HandRank.THREE_OF_A_KIND,
    value: HandRank.THREE_OF_A_KIND * CATEGORY_BASE + encode([
      rankToValue(tripleRank as Card['rank']), kickers[0], kickers[1]
    ]),
    description: `Three of a Kind, ${tripleRank}s`,
    cards: [...cards]
  }
}

function checkTwoPair(cards: Card[]): HandEvaluation | null {
  const rankCounts = getRankCounts(cards)
  const pairs = Object.keys(rankCounts).filter(rank => rankCounts[rank] === 2)
  
  if (pairs.length !== 2) return null
  
  const pairValues = pairs.map(rank => rankToValue(rank as Card['rank'])).sort((a, b) => b - a)
  const kicker = Object.keys(rankCounts).find(rank => rankCounts[rank] === 1)!
  
  return {
    rank: HandRank.TWO_PAIR,
    value: HandRank.TWO_PAIR * CATEGORY_BASE + encode([
      pairValues[0], pairValues[1], rankToValue(kicker as Card['rank'])
    ]),
    description: `Two Pair, ${pairs[0]}s and ${pairs[1]}s`,
    cards: [...cards]
  }
}

function checkOnePair(cards: Card[]): HandEvaluation | null {
  const rankCounts = getRankCounts(cards)
  const pairRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 2)
  
  if (!pairRank) return null
  
  const kickers = Object.keys(rankCounts)
    .filter(rank => rank !== pairRank)
    .map(rank => rankToValue(rank as Card['rank']))
    .sort((a, b) => b - a)
  
  return {
    rank: HandRank.PAIR,
    value: HandRank.PAIR * CATEGORY_BASE + encode([
      rankToValue(pairRank as Card['rank']), kickers[0], kickers[1], kickers[2]
    ]),
    description: `Pair of ${pairRank}s`,
    cards: [...cards]
  }
}

function checkHighCard(cards: Card[]): HandEvaluation {
  const values = cards.map(card => rankToValue(card.rank)).sort((a, b) => b - a)
  
  return {
    rank: HandRank.HIGH_CARD,
    value: HandRank.HIGH_CARD * CATEGORY_BASE + encode(values),
    description: `High Card, ${cards[cards.length - 1].rank}`,
    cards: [...cards]
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Count occurrences of each rank
 * Essential for detecting pairs, trips, quads
 */
function getRankCounts(cards: Card[]): Record<string, number> {
  const counts: Record<string, number> = {}
  
  for (const card of cards) {
    counts[card.rank] = (counts[card.rank] || 0) + 1
  }
  
  return counts
}

/**
 * Compare two hand evaluations
 * Returns positive if hand1 > hand2, negative if hand1 < hand2, zero if equal
 */
export function compareHands(hand1: HandEvaluation, hand2: HandEvaluation): number {
  return hand1.value - hand2.value
}

/**
 * Determine winner(s) from multiple hands
 * Returns array of winning hand indices (can be multiple for ties)
 */
export function findWinners(hands: HandEvaluation[]): number[] {
  if (hands.length === 0) return []
  
  const maxValue = Math.max(...hands.map(hand => hand.value))
  return hands
    .map((hand, index) => ({ hand, index }))
    .filter(({ hand }) => hand.value === maxValue)
    .map(({ index }) => index)
}

// ========================================
// TESTING AND VALIDATION
// ========================================

/**
 * Validate that hand evaluation is working correctly
 * Useful for unit tests and debugging
 */
export function validateHandEvaluation(cards: Card[], expectedRank: HandRank): boolean {
  try {
    const evaluation = evaluateHand(cards)
    return evaluation.rank === expectedRank
  } catch {
    return false
  }
}

/**
 * Create a test hand for specific scenarios
 * Helpful for testing edge cases
 */
export function createTestHand(ranks: Card['rank'][], suit: Card['suit'] = 'hearts'): Card[] {
  return ranks.map(rank => ({ rank, suit }))
}

// ========================================
// WHY THIS ALGORITHM MATTERS
// ========================================
/*
1. CORRECTNESS: Implements official poker hand rankings
   - Every possible hand combination is handled
   - Tie-breaking follows standard rules
   - Edge cases like wheel straights are covered

2. PERFORMANCE: Optimized for real-time gameplay
   - Efficient combinatorial generation
   - Fast rank counting with objects
   - Numeric values enable quick comparisons

3. EXTENSIBILITY: Foundation for other poker variants
   - Easy to modify for different hand sizes
   - Clear separation of concerns
   - Well-documented algorithm

4. FAIRNESS: Consistent evaluation across all players
   - Deterministic results
   - No floating-point precision issues
   - Handles all edge cases correctly

5. DEBUGGING: Rich evaluation information
   - Human-readable descriptions
   - Exact numeric values for comparison
   - Clear error messages for invalid inputs

This hand evaluator is the mathematical heart of our poker game!
*/