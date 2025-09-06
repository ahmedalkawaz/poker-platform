// components/index.ts
// ========================================
// COMPONENT INDEX - ORGANIZED EXPORTS
// ========================================

// UI Components
export { 
    PlayingCard, 
    HandDisplay, 
    CommunityCards, 
    AnimatedCard,
    CardShowcase 
  } from './PlayingCard'
  
  // Game Components  
  export {
    BettingControls,
    BettingHistory,
    PotDisplay,
    ActionTimer
  } from './BettingControls'
  
  export { PokerTable } from './PokerTable'
  
  // Component organization for easy imports:
  // import { PlayingCard, PokerTable, BettingControls } from '@/components'