/**
 * themes.ts - Thèmes prédéfinis pour les évaluations et exercices
 * 
 * Ce module fournit une liste de thèmes standardisés pour l'apprentissage
 * de l'allemand, utilisables dans les prompts Mistral.
 */

// ============================================================================
// THÈMES PRÉDÉFINIS
// ============================================================================

export type ThemeOption = typeof predefinedThemes[number];

/**
 * Liste des thèmes prédéfinis pour l'apprentissage de l'allemand
 * Ces thèmes sont utilisés pour générer des exercices et évaluations ciblés
 */
export const predefinedThemes = [
  'Voyage',
  'Famille',
  'Travail',
  'Nourriture',
  'Sport',
  'Culture allemande',
  'Shopping',
  'Santé',
  'Technologie',
  'Nature',
  'Vie quotidienne',
  'Éducation',
  'Transport',
  'Météo',
  'Fêtes et traditions',
  'Loisirs',
  'Économie',
  'Histoire',
  'Art',
  'Musique',
] as const;

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Sélectionne un thème aléatoire parmi les thèmes prédéfinis
 */
export function getRandomTheme(): ThemeOption {
  const randomIndex = Math.floor(Math.random() * predefinedThemes.length);
  return predefinedThemes[randomIndex];
}

/**
 * Vérifie si une chaîne est un thème prédéfini
 */
export function isPredefinedTheme(theme: string): theme is ThemeOption {
  return predefinedThemes.includes(theme as ThemeOption);
}

/**
 * Normalise un thème : si vide ou invalide, retourne un thème par défaut
 */
export function normalizeTheme(theme: string): ThemeOption {
  if (!theme?.trim()) {
    return 'Vie quotidienne';
  }
  
  // Vérifier si le thème existe dans la liste
  const lowerTheme = theme.toLowerCase();
  const lowerPredefined = predefinedThemes.map(t => t.toLowerCase());
  const index = lowerPredefined.indexOf(lowerTheme);
  
  if (index !== -1) {
    return predefinedThemes[index];
  }
  
  // Si ce n'est pas un thème prédéfini, retourner "Autre"
  return 'Vie quotidienne';
}

/**
 * Convertit un thème en contexte pour Mistral
 * Ajoute des détails pour enrichir le prompt
 */
export function themeToContext(theme: string, forExercice: boolean = true): string {
  const themeLower = theme.toLowerCase();
  
  // Contextes spécifiques par thème
  const themeContexts: Record<string, string> = {
    'voyage': forExercice 
      ? 'Contexte : voyage, transport, réservation d\'hôtel, visite de monuments, vocabulaire touristique'
      : 'Sujet : describez votre dernier voyage, vos projets de voyage, ou imaginez un voyage en Allemagne',
    'famille': forExercice
      ? 'Contexte : relations familiales, descriptions physiques, activités en famille, arbres généalogiques'
      : 'Sujet : parlez de votre famille, vos parents, vos frères et sœurs, ou inventez une famille',
    'travail': forExercice
      ? 'Contexte : métiers, lieu de travail, réunions, vocabulaire professionnel, CV'
      : 'Sujet : décrivez votre travail actuel, votre métier idéal, ou une journée de travail typique',
    'nourriture': forExercice
      ? 'Contexte : plats allemands, recettes, restaurants, courses au marché, vocabulaire culinaire'
      : 'Sujet : décrivez votre plat préféré, une recette typique allemande, ou un repas en famille',
    'sport': forExercice
      ? 'Contexte : types de sports, équipements, compétitions, vocabulaire sportif, expression des préférences'
      : 'Sujet : parlez de votre sport préféré, une activité sportive que vous pratiquez, ou les sports populaires en Allemagne',
    'culture allemande': forExercice
      ? 'Contexte : fêtes allemandes, traditions, musique, littérature, histoire, coutumes'
      : 'Sujet : décrivez une fête traditionnelle allemande, une coutume qui vous intéresse, ou comparez la culture allemande à la vôtre',
    'shopping': forExercice
      ? 'Contexte : magasins, prix, négociation, vocabulaire commercial, achats en ligne'
      : 'Sujet : décrivez une expérience d\'achat, votre magasin préféré, ou comment vous faites vos courses',
    'santé': forExercice
      ? 'Contexte : symptômes, rendez-vous chez le médecin, pharmacie, vocabulaire médical, conseils de santé'
      : 'Sujet : parlez d\'une fois où vous étiez malade, vos habitudes pour rester en bonne santé, ou le système de santé en Allemagne',
    'technologie': forExercice
      ? 'Contexte : appareils électroniques, internet, réseaux sociaux, vocabulaire technique'
      : 'Sujet : décrivez votre rapport à la technologie, un appareil que vous utilisez souvent, ou l\'impact de la technologie sur la société',
    'nature': forExercice
      ? 'Contexte : environnement, animaux, plantes, météo, vocabulaire de la nature'
      : 'Sujet : parlez d\'un endroit naturel que vous aimez, la protection de l\'environnement, ou les saisons',
    'vie quotidienne': forExercice
      ? 'Contexte : routine quotidienne, horaires, activités habituelles, vocabulaire du quotidien'
      : 'Sujet : décrivez une journée typique dans votre vie, vos habitudes, ou comment vous organisez votre temps',
  };
  
  return themeContexts[themeLower] || `Contexte : ${theme}`;
}
