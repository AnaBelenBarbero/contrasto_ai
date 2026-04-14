import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Is Going Just Great — Incident Tracker",
  description:
    "A running timeline of AI harm events, layoffs, regulatory actions, and model failures. " +
    "",
  openGraph: {
    title: "AI Is Going Just Great. AI Incident and Layoff Tracker",
    description:
      "Track AI harm, layoffs, regulatory fines, and model failures in real time.",
    type: "website",
  },
};

/**
 * Inline script injected into <head> before any CSS or React hydration.
 * Reads the persisted theme preference and applies the `dark` class to <html>
 * synchronously, preventing any flash of unstyled content (FOUC).
 * Default is light — the class is only added when the user has explicitly
 * chosen dark mode.
 */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('ai_tracker_theme');
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // No className="dark" here — theme is controlled by the inline script
    // and the ThemeToggle client component at runtime.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* FOUC prevention: must run before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
        {children}
      </body>
    </html>
  );
}
