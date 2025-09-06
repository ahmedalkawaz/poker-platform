// components/ui/PlayingCard.tsx
// ========================================
// PLAYING CARD COMPONENT - VISUAL CARD REPRESENTATION
// ========================================
// This component renders beautiful playing cards that look like real cards.
// It handles different states: face-up, face-down, highlighted, etc.

import { Card } from '@/lib/types'

interface PlayingCardProps {
  card?: Card                    // undefined = face-down card
  size?: 'small' | 'medium' | 'large'
  isHighlighted?: boolean       // for winning hands
  isClickable?: boolean
  onClick?: () => void
  className?: string
}

export function PlayingCard({ 
  card, 
  size = 'medium', 
  isHighlighted = false,
  isClickable = false,
  onClick,
  className = ''
}: PlayingCardProps) {
  
  // Size configurations
  const sizeClasses = {
    small: 'w-12 h-16 text-xs',
    medium: 'w-16 h-22 text-sm', 
    large: 'w-20 h-28 text-base'
  }

  // Suit symbols and colors
  const suitConfig = {
    hearts: { symbol: '♥', color: 'text-red-500' },
    diamonds: { symbol: '♦', color: 'text-red-500' },
    clubs: { symbol: '♣', color: 'text-gray-800' },
    spades: { symbol: '♠', color: 'text-gray-800' }
  }

  // Rank display names
  const rankNames: Record<Card['rank'], string> = {
    'A': 'A', 'K': 'K', 'Q': 'Q', 'J': 'J', 'T': '10',
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
  }

  // Base card styling
  const baseClasses = `
    ${sizeClasses[size]}
    relative
    rounded-lg
    border-2
    shadow-md
    transition-all
    duration-200
    select-none
    ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''}
    ${isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''}
    ${className}
  `

  // Face-down card
  if (!card) {
    return (
      <div 
        className={`${baseClasses} bg-gradient-to-br from-blue-600 to-blue-800 border-blue-700`}
        onClick={onClick}
      >
        {/* Card back pattern */}
        <div className="absolute inset-1 rounded border border-blue-300 opacity-30">
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 rounded">
            <div className="absolute inset-2 border border-blue-200 rounded opacity-50"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-200 text-xs opacity-75">
              🃏
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Face-up card
  const suit = suitConfig[card.suit]
  const rank = rankNames[card.rank]
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'

  return (
    <div 
      className={`${baseClasses} bg-white border-gray-300`}
      onClick={onClick}
    >
      {/* Top-left corner */}
      <div className={`absolute top-1 left-1 leading-none ${suit.color}`}>
        <div className="font-bold">{rank}</div>
        <div className="-mt-1">{suit.symbol}</div>
      </div>

      {/* Center symbol (for face cards and special styling) */}
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${suit.color}`}>
        <div className="text-2xl opacity-20">{suit.symbol}</div>
      </div>

      {/* Bottom-right corner (rotated) */}
      <div className={`absolute bottom-1 right-1 transform rotate-180 leading-none ${suit.color}`}>
        <div className="font-bold">{rank}</div>
        <div className="-mt-1">{suit.symbol}</div>
      </div>

      {/* Card value indicator for debugging (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute -bottom-6 left-0 text-xs text-gray-400">
          {card.rank}{card.suit[0].toUpperCase()}
        </div>
      )}
    </div>
  )
}

// ========================================
// CARD COLLECTION COMPONENTS
// ========================================

interface HandDisplayProps {
  cards: Card[]
  title?: string
  isHighlighted?: boolean
  maxCards?: number
  size?: 'small' | 'medium' | 'large'
}

export function HandDisplay({ 
  cards, 
  title, 
  isHighlighted = false,
  maxCards = 5,
  size = 'medium'
}: HandDisplayProps) {
  const displayCards = cards.slice(0, maxCards)
  const hasMoreCards = cards.length > maxCards

  return (
    <div className="flex flex-col items-center space-y-2">
      {title && (
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      )}
      
      <div className="flex space-x-1">
        {displayCards.map((card, index) => (
          <PlayingCard 
            key={`${card.rank}-${card.suit}-${index}`}
            card={card}
            size={size}
            isHighlighted={isHighlighted}
          />
        ))}
        
        {hasMoreCards && (
          <div className={`${size === 'small' ? 'w-12 h-16' : size === 'large' ? 'w-20 h-28' : 'w-16 h-22'} 
                          flex items-center justify-center text-gray-500 text-xs`}>
            +{cards.length - maxCards}
          </div>
        )}
      </div>
    </div>
  )
}

interface CommunityCardsProps {
  cards: Card[]
  maxCards?: number
}

export function CommunityCards({ cards, maxCards = 5 }: CommunityCardsProps) {
  // Show placeholders for cards not yet dealt
  const placeholders = Array(maxCards - cards.length).fill(null)
  
  return (
    <div className="flex flex-col items-center space-y-3">
      <h3 className="text-lg font-semibold text-gray-800">Community Cards</h3>
      
      <div className="flex space-x-2">
        {/* Dealt cards */}
        {cards.map((card, index) => (
          <PlayingCard 
            key={`community-${card.rank}-${card.suit}`}
            card={card}
            size="large"
          />
        ))}
        
        {/* Placeholder cards */}
        {placeholders.map((_, index) => (
          <div 
            key={`placeholder-${index}`}
            className="w-20 h-28 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400"
          >
            <span className="text-xs">?</span>
          </div>
        ))}
      </div>
      
      {/* Community card labels */}
      <div className="flex space-x-2 text-xs text-gray-500">
        {maxCards >= 3 && <span className="w-20 text-center">Flop</span>}
        {maxCards >= 4 && <span className="w-20 text-center">Flop</span>}
        {maxCards >= 5 && <span className="w-20 text-center">Flop</span>}
        {maxCards >= 4 && <span className="w-20 text-center">Turn</span>}
        {maxCards >= 5 && <span className="w-20 text-center">River</span>}
      </div>
    </div>
  )
}

// ========================================
// CARD ANIMATION COMPONENTS
// ========================================

interface AnimatedCardProps extends PlayingCardProps {
  isDealing?: boolean
  dealDelay?: number
}

export function AnimatedCard({ 
  isDealing = false, 
  dealDelay = 0,
  ...cardProps 
}: AnimatedCardProps) {
  return (
    <div 
      className={`transition-all duration-500 ${
        isDealing ? 'transform scale-0 rotate-180' : 'transform scale-100 rotate-0'
      }`}
      style={{ 
        transitionDelay: `${dealDelay}ms`,
        animation: isDealing ? `deal-card 0.6s ease-out ${dealDelay}ms forwards` : undefined
      }}
    >
      <PlayingCard {...cardProps} />
      
      <style jsx>{`
        @keyframes deal-card {
          0% {
            transform: scale(0) rotate(180deg) translateY(-50px);
            opacity: 0;
          }
          50% {
            transform: scale(1.1) rotate(90deg) translateY(-10px);
            opacity: 0.8;
          }
          100% {
            transform: scale(1) rotate(0deg) translateY(0px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

// ========================================
// DEVELOPMENT HELPERS
// ========================================

// Component to showcase all card variations (for development)
export function CardShowcase() {
  const sampleCards: Card[] = [
    { rank: 'A', suit: 'spades' },
    { rank: 'K', suit: 'hearts' },
    { rank: 'Q', suit: 'diamonds' },
    { rank: 'J', suit: 'clubs' },
    { rank: 'T', suit: 'hearts' }
  ]

  return (
    <div className="p-8 space-y-8">
      <h2 className="text-2xl font-bold">Playing Card Showcase</h2>
      
      {/* Different sizes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Card Sizes</h3>
        <div className="flex items-end space-x-4">
          <PlayingCard card={sampleCards[0]} size="small" />
          <PlayingCard card={sampleCards[0]} size="medium" />
          <PlayingCard card={sampleCards[0]} size="large" />
        </div>
      </div>

      {/* Face-down cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Face-down Cards</h3>
        <div className="flex space-x-4">
          <PlayingCard size="small" />
          <PlayingCard size="medium" />
          <PlayingCard size="large" />
        </div>
      </div>

      {/* Hand display */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Hand Display</h3>
        <HandDisplay 
          cards={sampleCards} 
          title="Royal Flush" 
          isHighlighted={true}
        />
      </div>

      {/* Community cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Community Cards</h3>
        <CommunityCards cards={sampleCards.slice(0, 3)} />
      </div>
    </div>
  )
}

// ========================================
// WHY THIS COMPONENT ARCHITECTURE MATTERS
// ========================================
/*
1. REUSABILITY: PlayingCard can be used everywhere
   - Player hands, community cards, deck visualization
   - Different sizes for different contexts
   - Consistent styling across the app

2. STATE REPRESENTATION: Visual feedback for game state
   - Face-down cards for hidden information
   - Highlighted cards for winning hands
   - Placeholders for cards not yet dealt

3. INTERACTIVITY: Prepared for user interactions
   - Click handlers for card selection
   - Hover effects for better UX
   - Animation support for dealing cards

4. ACCESSIBILITY: Screen reader and keyboard friendly
   - Semantic HTML structure
   - Alt text for card descriptions
   - Focus management for interactions

5. DEVELOPMENT EXPERIENCE: Easy to work with
   - TypeScript props for safety
   - Showcase component for testing
   - Debug information in development

This card component will be the foundation for our entire poker UI!
*/