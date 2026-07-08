'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getProgression,
  getExercices,
  getAllLecons,
  getEvaluations,
  getProgramme,
  determineBlocEnCours,
  calculerProgressionGlobale,
  type SuiviProgression,
  type Exercice,
  type Lecon,
  type Evaluation,
  type NiveauCECRL,
  type ProgrammeBloc,
} from '@/lib/storage';
import { calculerScoresParCritere, calculerScoreGlobal, type ScoresParCritere } from '@/lib/progression';
import { getBadgesDebloques, sauvegarderBadgesDebloques, badges, type Badge } from '@/lib/badges';

// ============================================================================
// COULEURS - Design moderne et motivant
// ============================================================================

// Couleurs principales
const colors = {
  primary: '#1e1b4b',      // Bleu très foncé pour les titres
  text: '#1e293b',         // Texte principal (quasi-noir)
  bgLight: '#f8fafc',      // Fond très clair
  bgCard: 'white',         // Fond des cartes
};

// Badges de niveau CECRL
const niveauBadgeColors: Record<NiveauCECRL, { bg: string; text: string; border: string }> = {
  A1: { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },  // Vert clair
  A2: { bg: '#bbf7d0', text: '#16a34a', border: '#4ade80' },
  B1: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },  // Bleu clair
  B2: { bg: '#bfdbfe', text: '#2563eb', border: '#60a5fa' },
  C1: { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },  // Violet clair
  C2: { bg: '#e9d5ff', text: '#7c3aed', border: '#a78bfa' },
};

// Couleurs des compétences
const skillColors = {
  comprehensionOrale: 'bg-orange-500',
  comprehensionEcrite: 'bg-blue-500',
  expressionOrale: 'bg-green-500',
  expressionEcrite: 'bg-purple-500',
};

const skillLabels: Record<string, string> = {
  comprehensionOrale: 'Compréhension orale',
  comprehensionEcrite: 'Compréhension écrite',
  expressionOrale: 'Expression orale',
  expressionEcrite: 'Expression écrite',
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function DashboardPage() {
  const [progression, setProgression] = useState<SuiviProgression | null>(null);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [lecons, setLecons] = useState<Lecon[]>([]);
  const [programme, setProgramme] = useState<ProgrammeBloc[]>([]);
  const [blocEnCours, setBlocEnCours] = useState<ProgrammeBloc | null>(null);
  const [progressionPourcentage, setProgressionPourcentage] = useState<number>(0);
  const [scores, setScores] = useState<ScoresParCritere>({
    comprehensionOrale: 0,
    comprehensionEcrite: 0,
    expressionOrale: 0,
    expressionEcrite: 0,
  });
  const [badgesDebloques, setBadgesDebloques] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOfficialEvaluationPrompt, setShowOfficialEvaluationPrompt] = useState(false);

  // Vérifier si une évaluation officielle est nécessaire
  useEffect(() => {
    if (progression) {
      // Vérifier si niveauOfficielCECRL existe et si la date est récente
      const hasRecentOfficialEvaluation = progression.niveauOfficielCECRL && 
                                         progression.dateEvaluationOfficielle &&
                                         new Date(progression.dateEvaluationOfficielle) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Afficher la suggestion si pas d'évaluation officielle ou si elle a plus de 7 jours
      setShowOfficialEvaluationPrompt(!hasRecentOfficialEvaluation);
    }
  }, [progression]);

  // Charger les données au montage
  useEffect(() => {
    const loadData = () => {
      const prog = getProgression();
      const exs = getExercices();
      const evals = getEvaluations();
      const leconsData = getAllLecons();
      const programmeData = getProgramme();
      const calcScores = calculerScoresParCritere();
      const unlockedBadges = getBadgesDebloques(prog);
      
      setProgression(prog);
      setExercices(exs);
      setEvaluations(evals);
      setLecons(leconsData);
      setProgramme(programmeData);
      setScores(calcScores);
      setBadgesDebloques(unlockedBadges);
      sauvegarderBadgesDebloques(prog);
      
      // Calculer la progression dans le programme
      if (prog) {
        const pct = calculerProgressionGlobale(prog.niveauEstimeCECRL);
        setProgressionPourcentage(pct);
        const currentBloc = determineBlocEnCours(prog.niveauEstimeCECRL);
        setBlocEnCours(currentBloc);
      }
      
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  // Calculer le score global
  const scoreGlobal = calculerScoreGlobal(scores);

  // Message du streak
  const getStreakMessage = useCallback((streak: number | undefined): string => {
    if (!streak || streak === 0) return 'Commencez aujourd\'hui !';
    if (streak >= 1 && streak <= 6) return 'Continuez comme ça !';
    if (streak >= 7 && streak <= 29) return `🔥 ${streak} jours de suite, impressionnant !`;
    return `🏆 ${streak} jours, vous êtes une machine !`;
  }, []);

  // Obtenir les 5 derniers exercices/évaluations
  const dernierExercices = [...evaluations, ...exercices]
    .filter(item => 'scoreGlobal' in item ? item.scoreGlobal !== undefined : item.score !== undefined)
    .sort((a, b) => {
      const dateA = new Date(a.dateRealisation).getTime();
      const dateB = new Date(b.dateRealisation).getTime();
      return dateB - dateA;
    })
    .slice(0, 5);

  // Trouver la leçon la plus ancienne non testée
  const getProchaineLeconSuggeree = useCallback((): Lecon | null => {
    if (lecons.length === 0) return null;
    
    // Filtrer les leçons qui n'ont pas encore été utilisées dans une évaluation
    const leconsNonTestees = lecons.filter(lecon => {
      // Vérifier si cette leçon a été utilisée dans une évaluation
      return !evaluations.some(evalItem => 
        evalItem.sequenceCible?.includes(lecon.titre) ||
        evalItem.sequenceCible?.includes(lecon.id)
      );
    });
    
    if (leconsNonTestees.length === 0) {
      // Si toutes les leçons ont été testées, retourner la plus ancienne
      const sortedLecons = [...lecons].sort((a, b) => 
        new Date(a.dateAjout).getTime() - new Date(b.dateAjout).getTime()
      );
      return sortedLecons[0] ?? null;
    }
    
    // Retourner la leçon non testée la plus ancienne
    const sortedNonTestees = [...leconsNonTestees].sort((a, b) => 
      new Date(a.dateAjout).getTime() - new Date(b.dateAjout).getTime()
    );
    return sortedNonTestees[0] ?? null;
  }, [lecons, evaluations]);

  // Format de date lisible
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Couleur du score
  const getScoreColor = useCallback((score: number | undefined): string => {
    if (score === undefined) return 'bg-gray-100 text-gray-700';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Couleur du badge de niveau
  const niveauColor = progression?.niveauEstimeCECRL 
    ? niveauBadgeColors[progression.niveauEstimeCECRL] 
    : niveauBadgeColors.A1;

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* En-tête */}
      <div className="text-center">
        <h1 className="text-3xl font-bold" style={{ color: colors.primary }}>
          Tableau de bord
        </h1>
        <p className="text-gray-600 mt-2">
          Suivez votre progression en allemand
        </p>
      </div>

      {/* ======================================================================
           CARTES DE STATISTIQUES PRINCIPALES
         ====================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Niveau CECRL */}
        <div className="bg-white rounded-xl shadow-md p-6 relative overflow-hidden card-hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br opacity-10 from-blue-100 to-purple-100"></div>
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Niveau CECRL
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-4 py-2 rounded-full border-2 font-bold text-lg animate-scale-in tooltip-container`}
                style={{
                  backgroundColor: niveauColor.bg,
                  color: niveauColor.text,
                  borderColor: niveauColor.border
                }}
              >
                {progression?.niveauEstimeCECRL || 'A1'}
                {progression?.justificationMistral && (
                  <span className="tooltip-text max-w-xs">{progression.justificationMistral}</span>
                )}
              </span>
              <span className="text-gray-600">
                Niveau actuel
              </span>
            </div>
            <p className="text-xs text-gray-500 italic">
              Estimé via Mistral
            </p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-xl shadow-md p-6 relative overflow-hidden card-hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br opacity-10 from-orange-100 to-red-100"></div>
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Streak
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl streak-fire">🔥</span>
              <span className="text-3xl font-bold text-orange-600">
                {progression?.streak || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {getStreakMessage(progression?.streak)}
            </p>
          </div>
        </div>

        {/* Score global */}
        <div className="bg-white rounded-xl shadow-md p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br opacity-10 from-green-100 to-blue-100"></div>
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Score global
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold" style={{ color: colors.primary }}>
                {scoreGlobal}
              </span>
              <span className="text-gray-500">/100</span>
            </div>
            <p className="text-sm text-gray-600">
              Moyenne des 4 compétences
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================================
           MA PROGRESSION DANS LE PROGRAMME
         ====================================================================== */}
      {programme.length > 0 && progression && (
        <div className="bg-gradient-to-r from-[#3730a3] to-[#6366f1] rounded-xl shadow-md p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">
                Ma progression dans le programme
              </h2>
              <p className="text-sm opacity-90">
                {blocEnCours 
                  ? `Bloc ${blocEnCours.numero} en cours : ${blocEnCours.titre}`
                  : `Prêt à commencer le Bloc 1`
                }
              </p>
              <p className="text-sm opacity-75 mt-1">
                Prochain jalon : {blocEnCours?.sections.jalon || programme[0]?.sections.jalon}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{progressionPourcentage}%</div>
                <div className="text-xs opacity-75">Complet</div>
              </div>
              <Link
                href="/programme"
                className="px-4 py-2 bg-white text-indigo-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Voir mon programme →
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressionPourcentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
           BARRES DE PROGRESSION PAR COMPÉTENCE
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
        <h2 className="text-lg font-semibold mb-4" style={{ color: colors.primary }}>
          Progression par compétence
        </h2>
        <div className="space-y-4">
          {Object.entries(scores).map(([skill, score]) => (
            <div key={skill} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {skillLabels[skill] || skill}
                </span>
                <span className="text-gray-500">{Math.round(score)}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full progress-bar-fill transition-all duration-1000 ${skillColors[skill as keyof typeof skillColors] || 'bg-blue-500'}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================================
           PROCHAIN EXERCICE SUGGÉRÉ
         ====================================================================== */}
      {lecons.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold" style={{ color: colors.primary }}>
              Prochain exercice suggéré
            </h2>
            <Link
              href="/exercices"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Voir tous les exercices →
            </Link>
          </div>
          
          {(() => {
            const prochaineLecon = getProchaineLeconSuggeree();
            if (!prochaineLecon) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <p>Toutes les leçons ont été testées !</p>
                  <p className="mt-2 text-sm">
                    Félicitations, vous avez couvert tout votre contenu.
                  </p>
                </div>
              );
            }
            
            return (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-xl text-white">📖</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{prochaineLecon.titre}</h3>
                    <p className="text-sm text-gray-600">{prochaineLecon.type}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ajoutée le {formatDate(prochaineLecon.dateAjout)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/exercices?lecon=${encodeURIComponent(prochaineLecon.id)}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium btn-pulse"
                  >
                    Commencer
                  </Link>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ======================================================================
           DERNIERS RÉSULTATS
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold" style={{ color: colors.primary }}>
            Derniers résultats
          </h2>
          {dernierExercices.length > 0 && (
            <Link
              href="/evaluation"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Faire une nouvelle évaluation →
            </Link>
          )}
        </div>

        {dernierExercices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun résultat enregistré pour le moment.</p>
            <p className="mt-2 text-sm">
              Commencez par faire un exercice ou une évaluation !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dernierExercices.map((item, index) => {
              // Extraire le score et la date
              const score = 'scoreGlobal' in item ? item.scoreGlobal : 'score' in item ? item.score : 0;
              const date = item.dateRealisation;
              const type = 'critere' in item ? item.critere : 'type' in item ? item.type : 'exercice';
              const titre = 'critere' in item ? 
                (type === 'comprehensionOrale' ? 'Compréhension orale' :
                 type === 'comprehensionEcrite' ? 'Compréhension écrite' :
                 type === 'expressionOrale' ? 'Expression orale' :
                 type === 'expressionEcrite' ? 'Expression écrite' : type) :
                (type === 'qcm' ? 'QCM' :
                 type === 'texteATrous' ? 'Texte à trous' :
                 type === 'traduction' ? 'Traduction' :
                 type === 'production' ? 'Production' : type);
              
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-600">
                        {index + 1}.
                      </span>
                      <span className="font-medium" style={{ color: colors.primary }}>
                        {titre}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                            <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(score)}`}
                    >
                      {score !== undefined ? `${Math.round(score)}/100` : 'Non noté'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================================
           BOUTONS D'ACTION PRINCIPAUX
         ====================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/exercices"
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group card-hover-lift"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[#3730a3] to-[#6366f1] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-2xl text-white">📝</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 group-hover:text-[#3730a3]">
                Générer un exercice
              </h3>
              <p className="text-sm text-gray-600">
                Créez un QCM ou un texte à trous à partir de vos leçons
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/evaluation"
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group card-hover-lift"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[#3730a3] to-[#6366f1] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-2xl text-white">🎯</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 group-hover:text-[#3730a3]">
                S'évaluer
              </h3>
              <p className="text-sm text-gray-600">
                Testez vos compétences avec une évaluation complète
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ======================================================================
           BADGES DÉBLOQUÉS (aperçu)
         ====================================================================== */}
      {badgesDebloques.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold" style={{ color: colors.primary }}>
              Vos badges ({badgesDebloques.length}/{badges.length})
            </h2>
            <Link
              href="/profil"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Voir tous les badges →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {badgesDebloques.slice(0, 4).map((badge) => (
              <div
                key={badge.id}
                className="bg-gray-50 rounded-lg p-4 text-center badge-animated"
              >
                <span className="text-3xl mb-2 block">{badge.emoji}</span>
                <h3 className="font-semibold text-gray-800 text-sm">{badge.nom}</h3>
                <p className="text-xs text-gray-600 truncate">{badge.description}</p>
              </div>
            ))}
            {badgesDebloques.length > 4 && (
              <div className="bg-gray-50 rounded-lg p-4 text-center flex items-center justify-center">
                <span className="text-2xl">+{badgesDebloques.length - 4}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================
           MOTIVATION
         ====================================================================== */}
      {progression?.streak && progression.streak > 0 && (
        <div className="bg-gradient-to-r from-[#3730a3] to-[#6366f1] rounded-xl shadow-md p-6 text-white">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="font-semibold text-lg">
                Continuez comme ça !
              </h3>
              <p className="text-sm opacity-90">
                Vous avez une série de {progression.streak} jour{progression.streak > 1 ? 's' : ''} 
                d'apprentissage. Ne lâchez rien !
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
