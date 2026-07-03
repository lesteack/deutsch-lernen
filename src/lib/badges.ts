/**
 * badges.ts - Système de badges motivants
 * 
 * Ce module définit les badges que l'utilisateur peut débloquer
 * en fonction de sa progression dans l'apprentissage de l'allemand.
 * 
 * Chaque badge a une condition qui est évaluée sur l'objet de progression.
 */

import { type SuiviProgression, type NiveauCECRL } from './storage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Badge de réussite
 */
export interface Badge {
  id: string;
  nom: string;
  description: string;
  emoji: string;
  condition: (progression: SuiviProgression) => boolean;
}

/**
 * Badge débloqué avec date
 */
export interface BadgeDebloque {
  badge: Badge;
  dateDeblocage: string;
}

// ============================================================================
// LISTE DES BADGES
// ============================================================================

/**
 * Liste de tous les badges disponibles
 */
export const badges: Badge[] = [
  {
    id: 'premier_pas',
    nom: 'Premier pas',
    description: 'Vous avez complété votre premier exercice',
    emoji: '🎯',
    condition: (progression) => {
      // A au moins un exercice ou une évaluation
      return (progression.historiqueScores?.length || 0) > 0;
    },
  },
  {
    id: 'sur_la_lancee',
    nom: 'Sur la lancée',
    description: '7 jours de suite d\'apprentissage',
    emoji: '🔥',
    condition: (progression) => {
      return (progression.streak || 0) >= 7;
    },
  },
  {
    id: 'regularite',
    nom: 'Régularité',
    description: '30 jours de suite d\'apprentissage',
    emoji: '💎',
    condition: (progression) => {
      return (progression.streak || 0) >= 30;
    },
  },
  {
    id: 'lecteur_assidu',
    nom: 'Lecteur assidu',
    description: '10 leçons importées dans votre bibliothèque',
    emoji: '📚',
    condition: (progression) => {
      // On vérifie le nombre de leçons importées
      // Comme nous n'avons pas directement accès aux leçons ici,
      // on utilise une estimation basée sur le nombre d'exercices
      // ou on pourrait étendre l'interface SuiviProgression
      // Pour l'instant, on utilise le nombre total d'exercices comme proxy
      return (progression.historiqueScores?.length || 0) >= 10;
    },
  },
  {
    id: 'excellence',
    nom: 'Excellence',
    description: 'Obtenez un score supérieur à 90 sur un exercice',
    emoji: '⭐',
    condition: (progression) => {
      return progression.historiqueScores?.some(score => score.score > 90) ?? false;
    },
  },
  {
    id: 'niveau_b1',
    nom: 'Niveau B1',
    description: 'Atteignez le niveau B1 ou supérieur',
    emoji: '🏆',
    condition: (progression) => {
      const niveauOrder: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = niveauOrder.indexOf(progression.niveauEstimeCECRL);
      const b1Index = niveauOrder.indexOf('B1');
      return currentIndex >= b1Index;
    },
  },
  {
    id: 'bilingue_en_herbe',
    nom: 'Bilingue en herbe',
    description: 'Atteignez le niveau C1 ou supérieur',
    emoji: '🎓',
    condition: (progression) => {
      const niveauOrder: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = niveauOrder.indexOf(progression.niveauEstimeCECRL);
      const c1Index = niveauOrder.indexOf('C1');
      return currentIndex >= c1Index;
    },
  },
];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Vérifie si un badge est débloqué
 */
export function estBadgeDebloque(badge: Badge, progression: SuiviProgression): boolean {
  return badge.condition(progression);
}

/**
 * Récupère tous les badges débloqués par l'utilisateur
 */
export function getBadgesDebloques(progression: SuiviProgression): Badge[] {
  return badges.filter(badge => estBadgeDebloque(badge, progression));
}

/**
 * Récupère tous les badges non débloqués
 */
export function getBadgesNonDebloques(progression: SuiviProgression): Badge[] {
  return badges.filter(badge => !estBadgeDebloque(badge, progression));
}

/**
 * Récupère un badge par son ID
 */
export function getBadgeParId(id: string): Badge | undefined {
  return badges.find(badge => badge.id === id);
}

/**
 * Vérifie si un nouveau badge a été débloqué
 * (utile pour déclencher une animation)
 */
export function checkNouveauxBadges(
  progressionActuelle: SuiviProgression,
  ancientBadges: Badge[]
): Badge[] {
  const badgesActuels = getBadgesDebloques(progressionActuelle);
  return badgesActuels.filter(
    badgeActuel => !ancientBadges.some(b => b.id === badgeActuel.id)
  );
}

/**
 * Sauvegarde les badges débloqués dans localStorage
 * (optionnel : pour persister la date de déblocage)
 */
export function sauvegarderBadgesDebloques(progression: SuiviProgression): void {
  const badgesDebloques = getBadgesDebloques(progression);
  const badgesDebloquesData = badgesDebloques.map(badge => ({
    badgeId: badge.id,
    dateDeblocage: new Date().toISOString(),
  }));
  
  try {
    localStorage.setItem('badgesDebloques', JSON.stringify(badgesDebloquesData));
  } catch (e) {
    console.warn('Impossible de sauvegarder les badges:', e);
  }
}

/**
 * Récupère les badges débloqués depuis localStorage
 */
export function getBadgesDebloquesSauvegardes(): { badgeId: string; dateDeblocage: string }[] {
  try {
    const data = localStorage.getItem('badgesDebloques');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}
