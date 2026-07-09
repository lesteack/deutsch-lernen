'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getFlashcardsARevoirCount } from '@/lib/storage';

/**
 * Barre de navigation principale du site
 * Design moderne avec dégradé bleu/violet foncé
 */

export default function Navbar() {
  const pathname = usePathname();
  const [flashcardsToReviewCount, setFlashcardsToReviewCount] = useState<number>(0);

  // Charger le nombre de flashcards à réviser
  useEffect(() => {
    setFlashcardsToReviewCount(getFlashcardsARevoirCount());
  }, []);

  // Déterminer si un lien est actif
  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Lien de navigation avec design amélioré
  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const active = isActive(href);
    
    return (
      <Link
        href={href}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
          ${active
            ? 'text-yellow-400 border-b-4 border-yellow-400 bg-white/10'
            : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
      >
        {children}
      </Link>
    );
  };

  return (
    <nav className="bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Titre */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl font-bold text-white">
              Deutsch Lernen
            </span>
          </Link>

          {/* Liens de navigation - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/lecons">Leçons</NavLink>
            <NavLink href="/flashcards">
              <span className="flex items-center gap-1">
                🃏 Flashcards
                {flashcardsToReviewCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {flashcardsToReviewCount}
                  </span>
                )}
              </span>
            </NavLink>
            <NavLink href="/programme">Programme</NavLink>
            <NavLink href="/exercices">Exercices</NavLink>
            <NavLink href="/evaluation">Évaluation</NavLink>
            <NavLink href="/profil">Profil</NavLink>
          </div>

          {/* Bouton mobile */}
          <div className="md:hidden">
            <MobileMenu flashcardsToReviewCount={flashcardsToReviewCount} />
          </div>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// MENU MOBILE
// ============================================================================

function MobileMenu({ flashcardsToReviewCount }: { flashcardsToReviewCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Bouton hamburger */}
      <button
        onClick={toggleMenu}
        className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10"
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
        <div className="absolute top-16 right-4 left-4 bg-[#1e1b4b] border border-white/20 rounded-xl shadow-lg py-2 z-50">
          <MobileNavLink href="/" pathname={pathname} onClick={() => setIsOpen(false)}>
            Dashboard
          </MobileNavLink>
          <MobileNavLink href="/lecons" pathname={pathname} onClick={() => setIsOpen(false)}>
            Leçons
          </MobileNavLink>
          <MobileNavLink href="/flashcards" pathname={pathname} onClick={() => setIsOpen(false)}>
            <span className="flex items-center gap-1">
              🃏 Flashcards
              {flashcardsToReviewCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ml-1">
                  {flashcardsToReviewCount}
                </span>
              )}
            </span>
          </MobileNavLink>
          <MobileNavLink href="/programme" pathname={pathname} onClick={() => setIsOpen(false)}>
            Programme
          </MobileNavLink>
          <MobileNavLink href="/exercices" pathname={pathname} onClick={() => setIsOpen(false)}>
            Exercices
          </MobileNavLink>
          <MobileNavLink href="/evaluation" pathname={pathname} onClick={() => setIsOpen(false)}>
            Évaluation
          </MobileNavLink>
          <MobileNavLink href="/profil" pathname={pathname} onClick={() => setIsOpen(false)}>
            Profil
          </MobileNavLink>
        </div>
      )}
    </>
  );
}

function MobileNavLink({ href, pathname, onClick, children }: {
  href: string;
  pathname: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = pathname === href || pathname.startsWith(href + '/');
  
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-4 py-2 text-sm font-medium transition-colors duration-200
        ${active
          ? 'text-yellow-400 border-b-4 border-yellow-400 bg-white/10'
          : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
    >
      {children}
    </Link>
  );
}
