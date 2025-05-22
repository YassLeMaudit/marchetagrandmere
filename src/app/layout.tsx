import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alberthon Vocal',
  description: 'Application de conversation vocale avec IA',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
} 