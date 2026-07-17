import Converter from '@/components/Converter';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  return (
    <main className="flex-1">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Bengali Converter
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Unicode ↔ Bijoy (SutonnyMJ)
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 px-4 py-8">
        <Converter />
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Free &amp; open-source Bengali text converter. All processing happens in your browser.
        </div>
      </footer>
    </main>
  );
}
