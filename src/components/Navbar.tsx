'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * Barre de navigation principale du site
 * Affiche les liens vers toutes les pages principales
 */

export default function Navbar() {
  const pathname = usePathname();

  // Déterminer si un lien est actif
  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Lien de navigation
  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const active = isActive(href);
    
    return (
      <Link
        href={href}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${active
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
      >
        {children}
      </Link>
    );
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Titre */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Deutsch Lernen
            </span>
          </Link>

          {/* Liens de navigation - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/lecons">Leçons</NavLink>
            <NavLink href="/exercices">Exercices</NavLink>
            <NavLink href="/evaluation">Évaluation</NavLink>
          </div>

          {/* Bouton mobile */}
          <div className="md:hidden">
            <MobileMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// MENU MOBILE
// ============================================================================

function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Bouton hamburger */}
      <button
        onClick={toggleMenu}
        className="p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Ouvrir le menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute top-16 right-4 left-4 bg-white border border-gray-200 rounded-md shadow-lg py-2 z-50">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
          >
            Dashboard
          </Link>
          <Link
            href="/lecons"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
          >
            Leçons
          </Link>
          <Link
            href="/exercices"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
          >
            Exercices
          </Link>
          <Link
            href="/evaluation"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
          >
            Évaluation
          </Link>
        </div>
      )}
    </>
  );
}
