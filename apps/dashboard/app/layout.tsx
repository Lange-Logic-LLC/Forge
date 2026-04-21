import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Forge — Build Dashboard',
  description: 'Multi-tenant build platform for iOS and Android',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
