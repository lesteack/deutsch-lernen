/**
 * storage.ts - Couche de données pour localStorage
 * 
 * Ce module fournit une abstraction pour stocker et récupérer les données
 * de l'application dans localStorage. Toutes les données sont stockées
 * en JSON et structurées selon le modèle défini.
 * 
 * Aucune dépendance UI - couche de données pure et testable indépendamment.
 */

// ============================================================================
// TYPES / INTERFACES
// ============================================================================

/** Type pour la fiche de révision */
export interface FicheRevision {
  titre: string;
  resume: string;
  pointsCles: string[];
  regles: Array<{
    regle: string;
    explication: string;
    exemple: string;
  }>;
  vocabulaireImportant: Array<{
    mot: string;
    traduction: string;
    exemple: string;
  }>;
  astuce: string;
  dateGeneration: string;
}

/** Type pour une leçon */
export interface Lecon {
  id: string;
  titre: string;
  type: 'grammaire' | 'vocabulaire' | 'conjugaison' | 'autre';
  contenuTexte: string;
  notionsCles: string[];
  dateAjout: string;
  ficheRevision?: FicheRevision;
}

/** Type pour un chapitre */
export interface Chapitre {
  id: string;
  titre: string;
  ordre: number;
  lecons: Lecon[];
}

/** Type pour un manuel */
export interface Manuel {
  id: string;
  titre: string;
  editeur: string;
  dateImport: string;
  chapitres: Chapitre[];
}

/** Type pour les exercices */
export type ExerciceType = 'qcm' | 'texteATrous' | 'traduction' | 'production' | 'questionsOuvertes' | 'remiseEnOrdre' | 'conjugaison' | 'completionDialogue' | 'association' | 'dictee' | 'genre' | 'genre_texte' | 'identifier_fonction' | 'choisir_determinant' | 'tableau_declinaison';

export interface Exercice {
  id: string;
  type: ExerciceType;
  leconsAssociees: string[]; // array d'ids de Lecon
  contenuJSON: Record<string, unknown>; // question, choix, réponse attendue
  reponseUtilisateur?: unknown;
  correction?: string; // texte généré par Mistral
  score?: number; // 0-100
  dateRealisation: string;
}

/** Type pour les critères d'évaluation */
export type CritereEvaluation = 
  | 'comprehensionOrale'
  | 'comprehensionEcrite'
  | 'expressionOrale'
  | 'expressionEcrite';

/** Type pour la portée d'évaluation */
export type PorteeEvaluation = 'sequence' | 'global';

/** Type pour une évaluation */
export interface Evaluation {
  id: string;
  critere: CritereEvaluation;
  portee: PorteeEvaluation;
  sequenceCible?: string; // optionnel, id de Chapitre/Lecon
  scoreGlobal: number; // 0-100
  dateRealisation: string;
}

/** Type pour un texte support */
export type TexteSupportType = 'audio' | 'ecrit';

export interface TexteSupport {
  id: string;
  titre: string;
  type: TexteSupportType;
  contenu: string; // texte brut
  niveauCECRL?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  notionsCles: string[];
}

/** Type pour le niveau CECRL */
export type NiveauCECRL = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** Type pour le statut d'un bloc de programme */
export type BlocStatut = 'non_commence' | 'en_cours' | 'termine';

/** Type pour les compétences d'un bloc */
export interface BlocCompetences {
  lecture: string;
  ecoute: string;
  ecriture: string;
  oral: string;
}

/** Type pour une section d'un bloc de programme */
export interface BlocSections {
  grammaire: string[];
  vocabulaire: string[];
  competences: BlocCompetences;
  jalon: string;
}

/** Type pour un bloc de programme B1→C1 */
export interface ProgrammeBloc {
  id: string;
  numero: 1 | 2 | 3;
  titre: string;
  objectif: string;
  moisDebut: number;
  moisFin: number;
  statut: BlocStatut;
  sections: BlocSections;
}

/** Type pour une entrée d'historique de score */
export interface HistoriqueScore {
  critere: CritereEvaluation;
  score: number;
  date: string;
}

/** Type pour le suivi de progression */
export interface SuiviProgression {
  historiqueScores: HistoriqueScore[];
  niveauEstimeCECRL: NiveauCECRL;
  justificationMistral: string; // texte explicatif généré par Mistral
  streak: number; // nombre de jours consécutifs d'utilisation
  dernierAcces: string;
}

// ============================================================================
// CONSTANTES - Clés localStorage
// ============================================================================

const STORAGE_KEYS = {
  MANUELS: 'manuels',
  EXERCICES: 'exercices',
  EVALUATIONS: 'evaluations',
  TEXTES_SUPPORT: 'textesSupport',
  PROGRESSION: 'progression',
  PROGRAMME: 'programme',
} as const;

// ============================================================================
// PROGRAMME B1→C1
// ============================================================================

/** Bloc 1 - Consolidation B1 → B2 */
const bloc1: ProgrammeBloc = {
  id: 'bloc-1',
  numero: 1,
  titre: 'Consolidation B1 → B2',
  objectif: 'Maîtriser les bases grammaticales et élargir le vocabulaire pour atteindre le niveau B2',
  moisDebut: 1,
  moisFin: 3,
  statut: 'non_commence',
  sections: {
    grammaire: [
      'Révision complète des cas (Nominativ/Akkusativ/Dativ/Genitiv) et prépositions associées (Wechselpräpositionen inclus)',
      'Déclinaison de l\'adjectif (épithète, avec/sans article, comparatif/superlatif)',
      'Verbes à particule séparable/inséparable, verbes de position (stehen/stellen, liegen/legen...)',
      'Konjunktiv II (présent et passé) : hypothèses, souhaits, politesse',
      'Passiv (Vorgangspassiv et Zustandspassiv), passif avec modaux',
      'Subordonnées : weil/da, obwohl, während, nachdem, bevor, sodass, damit/um...zu',
      'Relativsätze (pronoms relatifs, avec préposition, was/wo)',
      'Verbes à régime prépositionnel (warten auf, sich freuen über...) + pronoms adverbiaux (worauf, womit...)',
      'Infinitiv mit/ohne zu',
    ],
    vocabulaire: [
      'Vie quotidienne, logement, démarches administratives',
      'Travail et formation (CV, entretien, monde professionnel)',
      'Santé et corps',
      'Environnement et société (bases)',
      'Expressions idiomatiques courantes',
    ],
    competences: {
      lecture: 'Comprendre des textes descriptifs et narratifs sur des sujets familiers',
      ecoute: 'Comprendre les points principaux d\'une conversation sur des sujets concrets',
      ecriture: 'Rédiger des textes simples et cohérents sur des sujets familiers',
      oral: 'Participer à une conversation sur des sujets de la vie quotidienne',
    },
    jalon: 'Tenir une conversation fluide sur des sujets concrets et rédiger un texte structuré de 150-200 mots sans erreur de cas majeure.',
  },
};

/** Bloc 2 - B2 confirmé → entrée en C1 */
const bloc2: ProgrammeBloc = {
  id: 'bloc-2',
  numero: 2,
  titre: 'B2 confirmé → entrée en C1',
  objectif: 'Approfondir la grammaire avancée et aborder des thèmes complexes',
  moisDebut: 4,
  moisFin: 6,
  statut: 'non_commence',
  sections: {
    grammaire: [
      'Konjunktiv I et discours indirect',
      'Nominalisation des verbes (Nominalstil)',
      'Partizip I / Partizip II comme adjectifs et constructions participiales étendues',
      'Funktionsverbgefüge (zur Verfügung stellen, in Anspruch nehmen...)',
      'Connecteurs logiques avancés : dennoch, folglich, allerdings, dementsprechend',
      'Doppelte Konjunktionen (sowohl...als auch, weder...noch, je...desto)',
      'Génitif élargi et prépositions avec génitif (aufgrund, trotz, während, innerhalb)',
      'Rection verbale approfondie',
    ],
    vocabulaire: [
      'Économie, politique, actualité',
      'Culture, médias, réseaux sociaux',
      'Éducation et système scolaire germanophone',
      'Débats de société (numérique, écologie, migration)',
      'Expressions figurées et registre soutenu',
    ],
    competences: {
      lecture: 'Lire des articles de presse et comprendre les nuances',
      ecoute: 'Comprendre des discours et débats sur des sujets d\'actualité',
      ecriture: 'Rédiger des textes argumentatifs structurés',
      oral: 'Exprimer son opinion de manière nuancée sur des sujets variés',
    },
    jalon: 'Comprendre un journal télévisé sans sous-titres, rédiger une Erörterung de 300 mots, reformuler au style indirect.',
  },
};

/** Bloc 3 - Vers le C1 maîtrisé */
const bloc3: ProgrammeBloc = {
  id: 'bloc-3',
  numero: 3,
  titre: 'Vers le C1 maîtrisé',
  objectif: 'Atteindre un niveau autonome et précis dans l\'expression',
  moisDebut: 7,
  moisFin: 9,
  statut: 'non_commence',
  sections: {
    grammaire: [
      'Particules modales et nuances (ja, doch, halt, eben, ruhig, schon, mal)',
      'Style nominal et verbal avancé, variation stylistique',
      'Constructions complexes enchâssées',
      'Konjunktiv dans la nuance rhétorique',
      'Verbes et locutions idiomatiques par registre',
      'Cohésion textuelle avancée',
    ],
    vocabulaire: [
      'Sciences, technologie, philosophie',
      'Littérature et analyse de texte',
      'Langue professionnelle/académique',
      'Nuances culturelles germanophones, humour, ironie',
      'Idiomatique avancée et proverbes',
    ],
    competences: {
      lecture: 'Analyser des textes littéraires et techniques complexes',
      ecoute: 'Comprendre des conférences et discussions spécialisées',
      ecriture: 'Rédiger des textes élaboés avec un style adapté',
      oral: 'S\'exprimer avec spontanéité et précision sur des sujets abstraits',
    },
    jalon: 'Niveau C1 opérationnel — comprendre du contenu authentique non adapté, s\'exprimer avec spontanéité et précision sur des sujets abstraits.',
  },
};

/** Programme B1→C1 complet */
export const programmeB1C1: ProgrammeBloc[] = [bloc1, bloc2, bloc3];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Génère un ID unique
 * Utilise crypto.randomUUID si disponible, sinon timestamp + random
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback pour les environnements sans crypto.randomUUID
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Formate une date en ISO 8601 (YYYY-MM-DDTHH:mm:ss)
 * @param date - Date à formater (défaut: maintenant)
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('.')[0];
}

/**
 * Parse une date ISO 8601 en objet Date
 * @param dateString - Chaîne de date ISO 8601
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Calcule le streak (nombre de jours consécutifs d'utilisation)
 * à partir d'un tableau de dates
 * @param dates - Tableau de chaînes de dates ISO 8601
 */
export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  // Trier les dates par ordre croissant
  const sortedDates = [...dates]
    .map(d => new Date(d).getTime())
    .sort((a, b) => a - b);

  let streak = 1;
  let currentDate = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const nextDate = sortedDates[i];
    // Vérifier si la date suivante est exactement 1 jour après
    const diff = nextDate - currentDate;
    if (diff === 86400000) { // 24 * 60 * 60 * 1000 = 1 jour en ms
      streak++;
      currentDate = nextDate;
    } else if (diff > 86400000) {
      // Si on a un écart de plus d'un jour, on réinitialise
      break;
    }
    // Si diff < 86400000, on a plusieurs accès le même jour, on ignore
  }

  return streak;
}

/**
 * Vérifie si deux dates sont le même jour (sans tenir compte de l'heure)
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Met à jour le streak dans le suivi de progression
 * @param progression - L'objet de progression à mettre à jour
 * @param newDate - La nouvelle date d'accès (défaut: maintenant)
 */
export function updateStreak(progression: SuiviProgression, newDate: Date = new Date()): SuiviProgression {
  const lastAccess = progression.dernierAcces ? new Date(progression.dernierAcces) : null;
  
  // Récupérer toutes les dates d'accès uniques (depuis les scores et le dernier accès)
  const allDates: Date[] = [];
  
  // Ajouter les dates de l'historique
  progression.historiqueScores.forEach(score => {
    const scoreDate = new Date(score.date);
    if (!allDates.some(d => isSameDay(d, scoreDate))) {
      allDates.push(scoreDate);
    }
  });
  
  // Ajouter le dernier accès s'il existe
  if (lastAccess) {
    if (!allDates.some(d => isSameDay(d, lastAccess))) {
      allDates.push(lastAccess);
    }
  }
  
  // Ajouter la nouvelle date
  allDates.push(newDate);
  
  // Trier et calculer le streak
  allDates.sort((a, b) => a.getTime() - b.getTime());
  
  let streak = 1;
  for (let i = allDates.length - 1; i > 0; i--) {
    const diff = allDates[i].getTime() - allDates[i - 1].getTime();
    if (diff === 86400000) {
      streak++;
    } else if (diff > 86400000) {
      break;
    }
  }
  
  return {
    ...progression,
    streak,
    dernierAcces: formatDate(newDate),
  };
}

// ============================================================================
// FONCTIONS DE BASE POUR LOCALSTORAGE
// ============================================================================

/**
 * Récupère une valeur depuis localStorage
 * @param key - Clé de stockage
 */
function getStorageItem<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    // côté serveur (SSR), localStorage n'est pas disponible
    return null;
  }
  
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

/**
 * Stocke une valeur dans localStorage
 * @param key - Clé de stockage
 * @param value - Valeur à stocker
 */
function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    // côté serveur (SSR), on ne fait rien
    return;
  }
  
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Erreur lors de l'écriture dans localStorage pour la clé ${key}:`, error);
    throw new Error(`Impossible de sauvegarder les données: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Supprime une clé de localStorage
 * @param key - Clé à supprimer
 */
function deleteStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  window.localStorage.removeItem(key);
}

// ============================================================================
// FONCTIONS D'INITIALISATION
// ============================================================================

/**
 * Initialise les clés de localStorage si elles n'existent pas
 * Crée des tableaux/objets vides pour chaque collection
 */
export function initStorage(): void {
  const keys = Object.values(STORAGE_KEYS);
  
  for (const key of keys) {
    if (getStorageItem(key) === null) {
      // Créer une valeur vide selon le type
      const emptyValue = key === STORAGE_KEYS.PROGRESSION 
        ? createEmptyProgression()
        : [];
      setStorageItem(key, emptyValue);
    }
  }
}

/**
 * Crée un objet SuiviProgression vide
 */
export function createEmptyProgression(): SuiviProgression {
  return {
    historiqueScores: [],
    niveauEstimeCECRL: 'A1',
    justificationMistral: '',
    streak: 0,
    dernierAcces: '',
  };
}

/**
 * Réinitialise complètement le stockage
 * ⚠️ Attention : supprime toutes les données utilisateur
 */
export function resetStorage(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    deleteStorageItem(key);
  });
  initStorage();
}

// ============================================================================
// MANUELS
// ============================================================================

/** Récupère tous les manuels */
export function getManuels(): Manuel[] {
  return getStorageItem<Manuel[]>(STORAGE_KEYS.MANUELS) || [];
}

/** Stocke tous les manuels */
export function setManuels(manuels: Manuel[]): void {
  setStorageItem(STORAGE_KEYS.MANUELS, manuels);
}

/** Ajoute un manuel */
export function addManuel(manuel: Omit<Manuel, 'id'>): Manuel {
  const manuels = getManuels();
  const newManuel: Manuel = {
    ...manuel,
    id: generateId(),
    dateImport: formatDate(),
  };
  manuels.push(newManuel);
  setManuels(manuels);
  return newManuel;
}

/** Met à jour un manuel */
export function updateManuel(id: string, updates: Partial<Manuel>): Manuel | null {
  const manuels = getManuels();
  const index = manuels.findIndex(m => m.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...manuels[index], ...updates };
  manuels[index] = updated;
  setManuels(manuels);
  return updated;
}

/** Supprime un manuel par ID */
export function deleteManuel(id: string): boolean {
  const manuels = getManuels();
  const newManuels = manuels.filter(m => m.id !== id);
  
  if (newManuels.length === manuels.length) {
    return false; // rien supprimé
  }
  
  setManuels(newManuels);
  return true;
}

/** Récupère un manuel par ID */
export function getManuelById(id: string): Manuel | null {
  return getManuels().find(m => m.id === id) || null;
}

// ============================================================================
// CHAPITRES
// ============================================================================

/** Récupère un chapitre par ID dans un manuel */
export function getChapitreById(manuelId: string, chapitreId: string): Chapitre | null {
  const manuel = getManuelById(manuelId);
  if (!manuel) return null;
  return manuel.chapitres.find(c => c.id === chapitreId) || null;
}

/** Ajoute un chapitre à un manuel */
export function addChapitre(manuelId: string, chapitre: Omit<Chapitre, 'id'>): Chapitre | null {
  const manuels = getManuels();
  const manuelIndex = manuels.findIndex(m => m.id === manuelId);
  
  if (manuelIndex === -1) return null;
  
  const newChapitre: Chapitre = {
    ...chapitre,
    id: generateId(),
    lecons: [],
  };
  
  manuels[manuelIndex].chapitres.push(newChapitre);
  setManuels(manuels);
  return newChapitre;
}

/** Met à jour un chapitre */
export function updateChapitre(manuelId: string, chapitreId: string, updates: Partial<Chapitre>): Chapitre | null {
  const manuels = getManuels();
  const manuelIndex = manuels.findIndex(m => m.id === manuelId);
  
  if (manuelIndex === -1) return null;
  
  const chapitreIndex = manuels[manuelIndex].chapitres.findIndex(c => c.id === chapitreId);
  if (chapitreIndex === -1) return null;
  
  const updated = { ...manuels[manuelIndex].chapitres[chapitreIndex], ...updates };
  manuels[manuelIndex].chapitres[chapitreIndex] = updated;
  setManuels(manuels);
  return updated;
}

/** Supprime un chapitre d'un manuel */
export function deleteChapitre(manuelId: string, chapitreId: string): boolean {
  const manuels = getManuels();
  const manuelIndex = manuels.findIndex(m => m.id === manuelId);
  
  if (manuelIndex === -1) return false;
  
  const oldLength = manuels[manuelIndex].chapitres.length;
  manuels[manuelIndex].chapitres = manuels[manuelIndex].chapitres.filter(c => c.id !== chapitreId);
  
  if (manuels[manuelIndex].chapitres.length === oldLength) {
    return false;
  }
  
  setManuels(manuels);
  return true;
}

// ============================================================================
// LEÇONS
// ============================================================================

/** Récupère une leçon par ID dans un chapitre */
export function getLeconById(manuelId: string, chapitreId: string, leconId: string): Lecon | null {
  const chapitre = getChapitreById(manuelId, chapitreId);
  if (!chapitre) return null;
  return chapitre.lecons.find(l => l.id === leconId) || null;
}

/** Ajoute une leçon à un chapitre */
export function addLecon(manuelId: string, chapitreId: string, lecon: Omit<Lecon, 'id' | 'dateAjout'>): Lecon | null {
  const manuels = getManuels();
  const manuelIndex = manuels.findIndex(m => m.id === manuelId);
  
  if (manuelIndex === -1) return null;
  
  const chapitreIndex = manuels[manuelIndex].chapitres.findIndex(c => c.id === chapitreId);
  if (chapitreIndex === -1) return null;
  
  const newLecon: Lecon = {
    ...lecon,
    id: generateId(),
    dateAjout: formatDate(),
  };
  
  manuels[manuelIndex].chapitres[chapitreIndex].lecons.push(newLecon);
  setManuels(manuels);
  return newLecon;
}

/** Met à jour une leçon */
export function updateLecon(manuelId: string, chapitreId: string, leconId: string, updates: Partial<Lecon>): Lecon | null {
  const manuels = getManuels();
  const manuelIndex = manuels.findIndex(m => m.id === manuelId);
  
  if (manuelIndex === -1) return null;
  
  const chapitreIndex = manuels[manuelIndex].chapitres.findIndex(c => c.id === chapitreId);
  if (chapitreIndex === -1) return null;
  
  const leconIndex = manuels[manuelIndex].chapitres[chapitreIndex].lecons.findIndex(l => l.id === leconId);
  if (leconIndex === -1) return null;
  
  const updated = { ...manuels[manuelIndex].chapitres[chapitreIndex].lecons[leconIndex], ...updates };
  manuels[manuelIndex].chapitres[chapitreIndex].lecons[leconIndex] = updated;
  setManuels(manuels);
  return updated;
}

/** Supprime une leçon d'un chapitre avec suppression en cascade
 * Si le chapitre devient vide → supprimer le chapitre
 * Si le manuel devient vide → supprimer le manuel
 */
export function deleteLecon(manuelId: string, chapitreId: string, leconId: string): {
  success: boolean;
  deletedManuelId?: string;
  deletedChapitreId?: string;
} {
  const manuels = getManuels();
  const manuelIndex = manuels.findIndex(m => m.id === manuelId);
  
  if (manuelIndex === -1) return { success: false };
  
  const chapitreIndex = manuels[manuelIndex].chapitres.findIndex(c => c.id === chapitreId);
  if (chapitreIndex === -1) return { success: false };
  
  const oldLength = manuels[manuelIndex].chapitres[chapitreIndex].lecons.length;
  manuels[manuelIndex].chapitres[chapitreIndex].lecons = 
    manuels[manuelIndex].chapitres[chapitreIndex].lecons.filter(l => l.id !== leconId);
  
  if (manuels[manuelIndex].chapitres[chapitreIndex].lecons.length === oldLength) {
    return { success: false };
  }
  
  // Vérifier si le chapitre est maintenant vide
  const chapitre = manuels[manuelIndex].chapitres[chapitreIndex];
  const deletedChapitreId = chapitre.lecons.length === 0 ? chapitre.id : undefined;
  
  if (deletedChapitreId) {
    // Supprimer le chapitre
    manuels[manuelIndex].chapitres = manuels[manuelIndex].chapitres.filter(c => c.id !== chapitreId);
    
    // Vérifier si le manuel est maintenant vide
    const deletedManuelId = manuels[manuelIndex].chapitres.length === 0 ? manuels[manuelIndex].id : undefined;
    
    if (deletedManuelId) {
      // Supprimer le manuel
      manuels.splice(manuelIndex, 1);
    }
    
    setManuels(manuels);
    return { 
      success: true, 
      deletedManuelId: deletedChapitreId ? deletedManuelId : undefined,
      deletedChapitreId 
    };
  }
  
  setManuels(manuels);
  return { success: true };
}

/** Récupère toutes les leçons de tous les manuels */
export function getAllLecons(): Lecon[] {
  const manuels = getManuels();
  const allLecons: Lecon[] = [];
  
  for (const manuel of manuels) {
    for (const chapitre of manuel.chapitres) {
      allLecons.push(...chapitre.lecons);
    }
  }
  
  return allLecons;
}

// ============================================================================
// EXERCICES
// ============================================================================

/** Récupère tous les exercices */
export function getExercices(): Exercice[] {
  return getStorageItem<Exercice[]>(STORAGE_KEYS.EXERCICES) || [];
}

/** Stocke tous les exercices */
export function setExercices(exercices: Exercice[]): void {
  setStorageItem(STORAGE_KEYS.EXERCICES, exercices);
}

/** Ajoute un exercice */
export function addExercice(exercice: Omit<Exercice, 'id' | 'dateRealisation'>): Exercice {
  const exercices = getExercices();
  const newExercice: Exercice = {
    ...exercice,
    id: generateId(),
    dateRealisation: formatDate(),
  };
  exercices.push(newExercice);
  setExercices(exercices);
  return newExercice;
}

/** Met à jour un exercice */
export function updateExercice(id: string, updates: Partial<Exercice>): Exercice | null {
  const exercices = getExercices();
  const index = exercices.findIndex(e => e.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...exercices[index], ...updates };
  exercices[index] = updated;
  setExercices(exercices);
  return updated;
}

/** Supprime un exercice par ID */
export function deleteExercice(id: string): boolean {
  const exercices = getExercices();
  const newExercices = exercices.filter(e => e.id !== id);
  
  if (newExercices.length === exercices.length) {
    return false;
  }
  
  setExercices(newExercices);
  return true;
}

/** Récupère un exercice par ID */
export function getExerciceById(id: string): Exercice | null {
  return getExercices().find(e => e.id === id) || null;
}

/** Récupère les exercices associés à une ou plusieurs leçons */
export function getExercicesByLeconIds(leconIds: string[]): Exercice[] {
  return getExercices().filter(e => 
    e.leconsAssociees.some(id => leconIds.includes(id))
  );
}

// ============================================================================
// EVALUATIONS
// ============================================================================

/** Récupère toutes les évaluations */
export function getEvaluations(): Evaluation[] {
  return getStorageItem<Evaluation[]>(STORAGE_KEYS.EVALUATIONS) || [];
}

/** Stocke toutes les évaluations */
export function setEvaluations(evaluations: Evaluation[]): void {
  setStorageItem(STORAGE_KEYS.EVALUATIONS, evaluations);
}

/** Ajoute une évaluation */
export function addEvaluation(evaluation: Omit<Evaluation, 'id' | 'dateRealisation'>): Evaluation {
  const evaluations = getEvaluations();
  const newEvaluation: Evaluation = {
    ...evaluation,
    id: generateId(),
    dateRealisation: formatDate(),
  };
  evaluations.push(newEvaluation);
  setEvaluations(evaluations);
  return newEvaluation;
}

/** Met à jour une évaluation */
export function updateEvaluation(id: string, updates: Partial<Evaluation>): Evaluation | null {
  const evaluations = getEvaluations();
  const index = evaluations.findIndex(e => e.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...evaluations[index], ...updates };
  evaluations[index] = updated;
  setEvaluations(evaluations);
  return updated;
}

/** Supprime une évaluation par ID */
export function deleteEvaluation(id: string): boolean {
  const evaluations = getEvaluations();
  const newEvaluations = evaluations.filter(e => e.id !== id);
  
  if (newEvaluations.length === evaluations.length) {
    return false;
  }
  
  setEvaluations(newEvaluations);
  return true;
}

/** Récupère une évaluation par ID */
export function getEvaluationById(id: string): Evaluation | null {
  return getEvaluations().find(e => e.id === id) || null;
}

// ============================================================================
// TEXTES SUPPORT
// ============================================================================

/** Récupère tous les textes support */
export function getTextesSupport(): TexteSupport[] {
  return getStorageItem<TexteSupport[]>(STORAGE_KEYS.TEXTES_SUPPORT) || [];
}

/** Stocke tous les textes support */
export function setTextesSupport(textes: TexteSupport[]): void {
  setStorageItem(STORAGE_KEYS.TEXTES_SUPPORT, textes);
}

/** Ajoute un texte support */
export function addTexteSupport(texte: Omit<TexteSupport, 'id'>): TexteSupport {
  const textes = getTextesSupport();
  const newTexte: TexteSupport = {
    ...texte,
    id: generateId(),
  };
  textes.push(newTexte);
  setTextesSupport(textes);
  return newTexte;
}

/** Met à jour un texte support */
export function updateTexteSupport(id: string, updates: Partial<TexteSupport>): TexteSupport | null {
  const textes = getTextesSupport();
  const index = textes.findIndex(t => t.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...textes[index], ...updates };
  textes[index] = updated;
  setTextesSupport(textes);
  return updated;
}

/** Supprime un texte support par ID */
export function deleteTexteSupport(id: string): boolean {
  const textes = getTextesSupport();
  const newTextes = textes.filter(t => t.id !== id);
  
  if (newTextes.length === textes.length) {
    return false;
  }
  
  setTextesSupport(newTextes);
  return true;
}

/** Récupère un texte support par ID */
export function getTexteSupportById(id: string): TexteSupport | null {
  return getTextesSupport().find(t => t.id === id) || null;
}

// ============================================================================
// PROGRESSION
// ============================================================================

/** Récupère la progression */
export function getProgression(): SuiviProgression {
  return getStorageItem<SuiviProgression>(STORAGE_KEYS.PROGRESSION) || createEmptyProgression();
}

/** Stocke la progression */
export function setProgression(progression: SuiviProgression): void {
  setStorageItem(STORAGE_KEYS.PROGRESSION, progression);
}

/** Met à jour la progression avec une nouvelle entrée d'historique */
export function addHistoriqueScore(critere: CritereEvaluation, score: number): SuiviProgression {
  const progression = getProgression();
  
  const newHistorique: HistoriqueScore = {
    critere,
    score,
    date: formatDate(),
  };
  
  // Mettre à jour le streak
  const updatedProgression = updateStreak(progression);
  
  updatedProgression.historiqueScores.push(newHistorique);
  setProgression(updatedProgression);
  
  return updatedProgression;
}

/** Met à jour le niveau CECRL estimé */
export function updateNiveauCECRL(niveau: NiveauCECRL, justification: string): SuiviProgression {
  const progression = getProgression();
  const updated = {
    ...progression,
    niveauEstimeCECRL: niveau,
    justificationMistral: justification,
  };
  setProgression(updated);
  return updated;
}

// ============================================================================
// PROGRAMME
// ============================================================================

/** Récupère le programme B1→C1 (toujours le même, non stocké en localStorage) */
export function getProgramme(): ProgrammeBloc[] {
  return programmeB1C1;
}

/** Récupère un bloc par son ID */
export function getBlocById(id: string): ProgrammeBloc | null {
  return programmeB1C1.find(b => b.id === id) || null;
}

/** Récupère un bloc par son numéro */
export function getBlocByNumero(numero: 1 | 2 | 3): ProgrammeBloc | null {
  return programmeB1C1.find(b => b.numero === numero) || null;
}

/** Calcule la progression globale en pourcentage (0-100) basée sur le niveau CECRL */
export function calculerProgressionGlobale(niveau: NiveauCECRL): number {
  const progressionMap: Record<NiveauCECRL, number> = {
    A1: 0,
    A2: 0,
    B1: 10,
    B2: 50,
    C1: 100,
    C2: 100,
  };
  return progressionMap[niveau] || 0;
}

/** Détermine quel bloc est en cours basé sur le niveau CECRL */
export function determineBlocEnCours(niveau: NiveauCECRL): ProgrammeBloc | null {
  const progressionMap: Record<NiveauCECRL, number> = {
    A1: 0,
    A2: 0,
    B1: 1,
    B2: 2,
    C1: 3,
    C2: 3,
  };
  
  const blocNum = progressionMap[niveau];
  if (blocNum === 0) return null;
  
  return programmeB1C1.find(b => b.numero === blocNum) || null;
}

/** Met à jour le statut d'un bloc */
export function updateBlocStatut(id: string, statut: BlocStatut): ProgrammeBloc[] {
  // Note: comme le programme est statique, on retourne une nouvelle copie avec le statut mis à jour
  // En pratique, le statut sera géré en mémoire ou dans un state global
  return programmeB1C1.map(bloc => 
    bloc.id === id ? { ...bloc, statut } : bloc
  );
}

// ============================================================================
// EXPORT DES CONSTANTES
// ============================================================================

export { STORAGE_KEYS };
