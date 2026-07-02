import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

// Police pour le corps de texte (moderne et lisible)
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Police pour les titres (élégant et sérieux)
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Deutsch Lernen - Apprendre l\'allemand',
  description: 'Site web d\'apprentissage de l\'allemand avec exercices personnalisés et suivi de progression CECRL',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${plusJakartaSans.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-[#f8fafc] font-body">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
