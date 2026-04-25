import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center text-white">
          {/* Hero Section */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            RandTracker
          </h1>
          <p className="text-xl md:text-2xl mb-4 opacity-90">
            South African Budget & Debt Management
          </p>
          <p className="text-lg mb-12 opacity-80 max-w-2xl mx-auto">
            Take control of your finances with RandTracker. Track transactions in seconds,
            build flexible budgets, and pay off debt faster with our dedicated debt management tools.
          </p>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="opacity-80">Add transactions in under 5 seconds with our numpad-first interface</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="text-xl font-semibold mb-2">Offline First</h3>
              <p className="opacity-80">Works without internet. Your data is always accessible</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-4xl mb-3">💳</div>
              <h3 className="text-xl font-semibold mb-2">Debt Freedom</h3>
              <p className="opacity-80">Track loans, credit cards, and plan your debt payoff strategy</p>
            </div>
          </div>

          {/* Key Features */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-12 text-left">
            <h2 className="text-2xl font-bold mb-6 text-center">Built for South Africans</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  🛒 SA-Relevant Categories
                </h4>
                <p className="text-sm opacity-80">
                  Pre-loaded with local categories: Groceries, Petrol, Airtime & Data,
                  Electricity, Medical Aid, and more
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  💰 ZAR Currency
                </h4>
                <p className="text-sm opacity-80">
                  All amounts in South African Rand with proper formatting and calculations
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  📊 Debt Dashboard
                </h4>
                <p className="text-sm opacity-80">
                  Track loans, credit cards, and store cards with amortisation schedules
                  and payoff strategies
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  📅 Flexible Budgets
                </h4>
                <p className="text-sm opacity-80">
                  Align budgets with your payday, not the calendar month
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Link
              href="/dashboard"
              className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-opacity-90 transition-all transform hover:scale-105"
            >
              Get Started
            </Link>
            <p className="text-sm opacity-70">
              No sign-up required • Works offline • Free to use
            </p>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-white/20">
            <p className="text-sm opacity-60">
              A Progressive Web App for personal finance management
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
