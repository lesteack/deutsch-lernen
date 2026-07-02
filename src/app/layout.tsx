import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
      className={`${inter.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
