/**
 * progression.ts - Logique de suivi de progression et estimation CECRL
 * 
 * Ce module fournit les fonctions pour calculer les scores agrégés par compétence,
 * estimer le niveau CECRL de l'utilisateur, et mettre à jour la progression globale.
 * 
 * Aucune dépendance UI - couche logique pure, testable indépendamment.
 */

import {
  getExercices,
  getEvaluations,
  getProgression,
  setProgression,
  updateNiveauCECRL,
  updateStreak,
  type SuiviProgression,
  type NiveauCECRL,
  type CritereEvaluation,
  type Exercice,
  type Evaluation,
} from './storage';

// ============================================================================
// TYPES
// ============================================================================

/** Scores agrégés par critère */
export interface ScoresParCritere {
  comprehensionOrale: number;
  comprehensionEcrite: number;
  expressionOrale: number;
  expressionEcrite: number;
}

/** Résultat de l'estimation CECRL */
export interface EstimationCECRL {
  niveau: NiveauCECRL;
  justification: string;
}

// ============================================================================
// MAPPING EXERCICE → CRITÈRE
// ============================================================================

/**
 * Mappe un type d'exercice à un ou plusieurs critères CECRL
 * Hypothèses :
 * - QCM et texte à trous → comprehensionEcrite (compréhension écrite)
 * - Traduction → contribution égale à comprehensionEcrite et expressionEcrite
 * - Production → expressionEcrite (expression écrite)
 */
function getCritereFromExerciceType(type: string): CritereEvaluation[] {
  switch (type) {
    case 'qcm':
    case 'texteATrous':
      // Exercices de compréhension écrite
      return ['comprehensionEcrite'];
    case 'traduction':
      // La traduction implique à la fois comprendre et s'exprimer
      return ['comprehensionEcrite', 'expressionEcrite'];
    case 'production':
      // Production écrite
      return ['expressionEcrite'];
    default:
      // Par défaut, on associe à la compréhension écrite
      return ['comprehensionEcrite'];
  }
}

// ============================================================================
// 1. CALCULER LES SCORES PAR CRITÈRE
// ============================================================================

/**
 * Calcule les scores moyens par critère CECRL
 * 
 * Lit tous les exercices et évaluations dans localStorage
 * Pour chaque critère, prend les 10 derniers items (par date) avec un score
 * Retourne la moyenne des scores pour chaque critère
 * 
 * @returns Objet avec les 4 critères et leurs scores moyens (0-100)
 */
export function calculerScoresParCritere(): ScoresParCritere {
  // Initialiser avec des scores neutres
  const result: ScoresParCritere = {
    comprehensionOrale: 0,
    comprehensionEcrite: 0,
    expressionOrale: 0,
    expressionEcrite: 0,
  };

  // Récupérer toutes les données
  const exercices = getExercices();
  const evaluations = getEvaluations();

  // Collecter tous les items avec score et date, groupés par critère
  const itemsParCritere: Record<CritereEvaluation, Array<{ score: number; date: string }>> = {
    comprehensionOrale: [],
    comprehensionEcrite: [],
    expressionOrale: [],
    expressionEcrite: [],
  };

  // Traiter les évaluations (ont déjà un critère)
  for (const evalItem of evaluations) {
    if (evalItem.scoreGlobal === undefined || evalItem.scoreGlobal === null) continue;
    
    const score = Math.max(0, Math.min(100, evalItem.scoreGlobal));
    itemsParCritere[evalItem.critere].push({
      score,
      date: evalItem.dateRealisation,
    });
  }

  // Traiter les exercices (mapper le type à un critère)
  for (const exercice of exercices) {
    if (exercice.score === undefined || exercice.score === null) continue;
    
    const score = Math.max(0, Math.min(100, exercice.score));
    const criteres = getCritereFromExerciceType(exercice.type);
    
    for (const critere of criteres) {
      itemsParCritere[critere].push({
        score,
        date: exercice.dateRealisation,
      });
    }
  }

  // Pour chaque critère, trier par date (plus récent d'abord) et prendre les 10 derniers
  for (const critere of Object.keys(itemsParCritere) as CritereEvaluation[]) {
    const items = itemsParCritere[critere];
    
    if (items.length === 0) {
      result[critere] = 0;
      continue;
    }

    // Trier par date (plus récent en premier)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Prendre les 10 derniers
    const last10 = items.slice(0, 10);
    
    // Calculer la moyenne
    const average = last10.reduce((sum, item) => sum + item.score, 0) / last10.length;
    
    result[critere] = Math.round(average * 100) / 100; // Arrondir à 2 décimales
  }

  return result;
}

// ============================================================================
// 2. ESTIMER LE NIVEAU CECRL
// ============================================================================

/**
 * Estime le niveau CECRL basé sur les scores par critère
 * 
 * Appelle l'API Mistral avec les scores agrégés et demande une estimation
 * argumentée. Sauvegarde le résultat via updateNiveauCECRL.
 * 
 * @param scores - Les scores par critère à utiliser pour l'estimation
 * @returns Promise avec { niveau, justification }
 */
export async function estimerNiveauCECRL(scores?: ScoresParCritere): Promise<EstimationCECRL> {
  // Utiliser les scores actuels si non fournis
  const scoresToUse = scores || calculerScoresParCritere();

  // Construire le prompt pour Mistral
  const prompt = `Tu es un expert en évaluation linguistique selon le CECRL (Cadre Européen Commun de Référence pour les Langues).

Voici les scores moyens (sur 100) d'un apprenant en allemand pour chaque compétence :
- Compréhension orale: ${scoresToUse.comprehensionOrale}/100
- Compréhension écrite: ${scoresToUse.comprehensionEcrite}/100
- Expression orale: ${scoresToUse.expressionOrale}/100
- Expression écrite: ${scoresToUse.expressionEcrite}/100

Estime son niveau CECRL global (A1, A2, B1, B2, C1, ou C2) en te basant UNIQUEMENT sur ces scores.
Fournis une justification détaillée en français expliquant ton estimation.

Réponds avec un JSON valide :
{
  "niveau": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "justification": "explication détaillée en français"
}`;

  try {
    // Appeler l'API Mistral
    const response = await fetch('/api/mistral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        responseFormat: 'json_object',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur API Mistral');
    }

    // Parser la réponse
    const data = await response.json();
    
    // Valider la structure
    if (!data.niveau || !data.justification) {
      throw new Error('Réponse Mistral invalide : champs manquants');
    }

    const niveau = data.niveau as NiveauCECRL;
    const justification = data.justification as string;

    // Valider le niveau
    const validNiveaux: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    if (!validNiveaux.includes(niveau)) {
      throw new Error(`Niveau invalide : ${niveau}`);
    }

    // Sauvegarder dans localStorage
    updateNiveauCECRL(niveau, justification);

    return { niveau, justification };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[estimerNiveauCECRL] Erreur:', errorMessage);
    
    // Retourner une estimation par défaut en cas d'erreur
    // (ne pas sauvegarder dans ce cas)
    return {
      niveau: 'A1',
      justification: `Estimation par défaut (A1) - Erreur lors de l'appel à Mistral: ${errorMessage}`,
    };
  }
}

// ============================================================================
// 3. METTRE À JOUR LA PROGRESSION
// ============================================================================

/**
 * Met à jour toute la progression de l'utilisateur
 * 
 * - Calcule les scores par critère via calculerScoresParCritere()
 * - Estime le niveau CECRL via estimerNiveauCECRL()
 * - Met à jour le streak via updateStreak()
 * - Retourne le SuiviProgression complet mis à jour
 * 
 * @returns Promise avec le SuiviProgression mis à jour
 */
export async function mettreAJourProgression(): Promise<SuiviProgression> {
  // Étape 1 : Calculer les scores par critère
  const scores = calculerScoresParCritere();

  // Étape 2 : Estimer le niveau CECRL
  const estimation = await estimerNiveauCECRL(scores);

  // Étape 3 : Mettre à jour le streak
  const progressionActuelle = getProgression();
  const progressionMiseAJour = updateStreak(progressionActuelle);

  // Étape 4 : Mettre à jour avec le nouveau niveau et justification
  const progressionFinale: SuiviProgression = {
    ...progressionMiseAJour,
    niveauEstimeCECRL: estimation.niveau,
    justificationMistral: estimation.justification,
  };

  // Sauvegarder la progression
  setProgression(progressionFinale);

  return progressionFinale;
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Calcule le score global moyen à partir des scores par critère
 * 
 * @param scores - Les scores par critère
 * @returns Score global moyen (0-100)
 */
export function calculerScoreGlobal(scores: ScoresParCritere): number {
  const allScores = Object.values(scores);
  const average = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  return Math.round(average * 100) / 100;
}

/**
 * Détermine le niveau CECRL approximatif à partir d'un score global
 * (pour fallback si l'API Mistral n'est pas disponible)
 * 
 * @param score - Score global (0-100)
 * @returns Niveau CECRL approximatif
 */
export function niveauFromScore(score: number): NiveauCECRL {
  if (score >= 90) return 'C2';
  if (score >= 75) return 'C1';
  if (score >= 60) return 'B2';
  if (score >= 45) return 'B1';
  if (score >= 30) return 'A2';
  return 'A1';
}
