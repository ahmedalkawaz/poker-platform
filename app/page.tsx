// app/page.tsx
// ========================================
// HOME PAGE - POKER PLATFORM SHOWCASE
// ========================================

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-white mb-16">
          <div className="text-6xl mb-6">🃏</div>
          <h1 className="text-5xl font-bold mb-4">AI Poker Platform</h1>
          <p className="text-xl text-green-200 max-w-2xl mx-auto">
            A professional multiplayer poker game with AI opponents powered by large language models
          </p>
        </div>

        {/* Main demo button */}
        <div className="text-center mb-16">
          <Link href="/poker-demo">
            <button className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-4 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-all duration-200">
              🎮 Play Poker Demo
            </button>
          </Link>
          <p className="text-green-200 mt-4 text-sm">
            Complete poker game with AI opponents - no signup required!
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-white">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-xl font-bold mb-2">AI Opponents</h3>
            <p className="text-green-200">
              Play against intelligent AI opponents with unique personalities and strategies powered by LLMs
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-white">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2">Real-time Multiplayer</h3>
            <p className="text-green-200">
              WebSocket-powered real-time gameplay with instant updates and smooth synchronization
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-white">
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-xl font-bold mb-2">Professional Rules</h3>
            <p className="text-green-200">
              Complete Texas Hold'em implementation with proper pot calculations and side pots
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-white">
            <div className="text-3xl mb-4">💎</div>
            <h3 className="text-xl font-bold mb-2">Beautiful UI</h3>
            <p className="text-green-200">
              Stunning poker table design with smooth animations and responsive controls
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-white">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-xl font-bold mb-2">Fair & Secure</h3>
            <p className="text-green-200">
              Authoritative server validation prevents cheating with cryptographically secure card shuffling
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-white">
            <div className="text-3xl mb-4">📱</div>
            <h3 className="text-xl font-bold mb-2">Cross-Platform</h3>
            <p className="text-green-200">
              Works seamlessly on desktop, tablet, and mobile devices with touch-friendly controls
            </p>
          </div>
        </div>

        {/* Technology showcase */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-6 text-center">Built with Modern Technology</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="font-semibold">Frontend</div>
              <div className="text-green-200 text-sm">
                Next.js<br/>
                React<br/>
                TypeScript<br/>
                Tailwind CSS
              </div>
            </div>
            
            <div>
              <div className="font-semibold">Backend</div>
              <div className="text-green-200 text-sm">
                Node.js<br/>
                Socket.io<br/>
                MongoDB<br/>
                Game Engine
              </div>
            </div>
            
            <div>
              <div className="font-semibold">AI Integration</div>
              <div className="text-green-200 text-sm">
                OpenAI GPT-4<br/>
                Claude API<br/>
                Dynamic Personalities<br/>
                Strategy Adaptation
              </div>
            </div>
            
            <div>
              <div className="font-semibold">Infrastructure</div>
              <div className="text-green-200 text-sm">
                Real-time WebSockets<br/>
                Authoritative Server<br/>
                Anti-cheat Systems<br/>
                Scalable Architecture
              </div>
            </div>
          </div>
        </div>

        {/* Development info */}
        <div className="text-center mt-16 text-green-200">
          <p className="mb-4">
            This is a demonstration of enterprise-level multiplayer game development
          </p>
          <div className="flex justify-center space-x-6 text-sm">
            <span>✅ Complete poker rules engine</span>
            <span>✅ Real-time multiplayer networking</span>
            <span>✅ AI opponent integration</span>
            <span>✅ Professional game UI</span>
          </div>
        </div>
      </div>
    </div>
  )
}