'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getProgression,
  getAllLecons,
  getExercices,
  getEvaluations,
  resetStorage as resetAllData,
  type SuiviProgression,
  type Lecon,
  type Exercice,
  type Evaluation,
} from '@/lib/storage';
import { getBadgesDebloques, badges, type Badge, sauvegarderBadgesDebloques } from '@/lib/badges';
import { calculerScoresParCritere, calculerScoreGlobal, type ScoresParCritere } from '@/lib/progression';

// ============================================================================
// TYPES
// ============================================================================

interface HistoriqueItem {
  type: 'exercice' | 'evaluation';
  id: string;
  titre: string;
  score: number;
  date: string;
  critere?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const niveauBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
  A1: { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },
  A2: { bg: '#bbf7d0', text: '#16a34a', border: '#4ade80' },
  B1: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
  B2: { bg: '#bfdbfe', text: '#2563eb', border: '#60a5fa' },
  C1: { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
  C2: { bg: '#e9d5ff', text: '#7c3aed', border: '#a78bfa' },
};

const skillColors: Record<string, string> = {
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

export default function ProfilPage() {
  const [progression, setProgression] = useState<SuiviProgression | null>(null);
  const [lecons, setLecons] = useState<Lecon[]>([]);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [scores, setScores] = useState<ScoresParCritere>({
    comprehensionOrale: 0,
    comprehensionEcrite: 0,
    expressionOrale: 0,
    expressionEcrite: 0,
  });
  const [badgesDebloques, setBadgesDebloques] = useState<Badge[]>([]);
  const [historique, setHistorique] = useState<HistoriqueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Charger les données
  useEffect(() => {
    const loadData = () => {
      const prog = getProgression();
      const leconsData = getAllLecons();
      const exs = getExercices();
      const evals = getEvaluations();
      const calcScores = calculerScoresParCritere();
      const unlockedBadges = getBadgesDebloques(prog);

      setProgression(prog);
      setLecons(leconsData);
      setExercices(exs);
      setEvaluations(evals);
      setScores(calcScores);
      setBadgesDebloques(unlockedBadges);
      
      // Construire l'historique
      const hist: HistoriqueItem[] = [];
      
      // Ajouter les évaluations
      evals.forEach(e => {
        if (e.scoreGlobal !== undefined) {
          hist.push({
            type: 'evaluation',
            id: e.id,
            titre: e.critere === 'comprehensionOrale' ? 'Compréhension orale' :
                   e.critere === 'comprehensionEcrite' ? 'Compréhension écrite' :
                   e.critere === 'expressionOrale' ? 'Expression orale' :
                   e.critere === 'expressionEcrite' ? 'Expression écrite' : e.critere,
            score: e.scoreGlobal,
            date: e.dateRealisation,
            critere: e.critere,
          });
        }
      });
      
      // Ajouter les exercices
      exs.forEach(e => {
        if (e.score !== undefined) {
          hist.push({
            type: 'exercice',
            id: e.id,
            titre: e.type === 'qcm' ? 'QCM' :
                   e.type === 'texteATrous' ? 'Texte à trous' :
                   e.type === 'traduction' ? 'Traduction' :
                   e.type === 'production' ? 'Production' : e.type,
            score: e.score,
            date: e.dateRealisation,
            critere: undefined,
          });
        }
      });
      
      // Trier par date (plus récent en premier)
      hist.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistorique(hist);
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Sauvegarder les badges débloqués
  useEffect(() => {
    if (progression) {
      sauvegarderBadgesDebloques(progression);
    }
  }, [progression]);

  // Calculer le score global
  const scoreGlobal = calculerScoreGlobal(scores);

  // Formater une date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Message du streak
  const getStreakMessage = (streak: number | undefined): string => {
    if (!streak || streak === 0) return 'Commencez aujourd\'hui !';
    if (streak >= 1 && streak <= 6) return 'Continuez comme ça !';
    if (streak >= 7 && streak <= 29) return `🔥 ${streak} jours de suite, impressionnant !`;
    return `🏆 ${streak} jours, vous êtes une machine !`;
  };

  // Couleur du score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Couleur de fond du score
  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  // Réinitialiser les données
  const handleResetData = useCallback(() => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes vos données ? Cette action est irréversible.')) {
      resetAllData();
      // Recharger la page pour réinitialiser l'état
      window.location.reload();
    }
    setShowResetConfirm(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3730a3]"></div>
      </div>
    );
  }

  if (!progression) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <p className="text-gray-600">Aucune donnée de progression disponible.</p>
      </div>
    );
  }

  // Couleur du badge de niveau
  const niveauColor = niveauBadgeColors[progression.niveauEstimeCECRL] || niveauBadgeColors.A1;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 page-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* En-tête avec dégradé */}
        <div className="bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] rounded-xl p-6 mb-8 shadow-lg text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Mon Profil
          </h1>
          <p className="text-white/80">
            Suivez votre progression et vos réussites
          </p>
        </div>

      {/* ======================================================================
           CARTES DE STATISTIQUES PRINCIPALES
         ====================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Niveau CECRL */}
        <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            Niveau CECRL
          </h2>
          <div className="flex items-center justify-between mb-4">
            <span
              className={`px-4 py-2 rounded-full border-2 font-bold text-lg animate-scale-in`}
              style={{
                backgroundColor: niveauColor.bg,
                color: niveauColor.text,
                borderColor: niveauColor.border
              }}
            >
              {progression.niveauEstimeCECRL}
            </span>
            {progression.justificationMistral && (
              <span className="tooltip-container">
                <span className="text-gray-400 cursor-help">ℹ️</span>
                <span className="tooltip-text">{progression.justificationMistral}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            Niveau actuel estimé
          </p>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            Streak
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl streak-fire">🔥</span>
            <span className="text-3xl font-bold text-orange-600">
              {progression.streak || 0}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {getStreakMessage(progression.streak)}
          </p>
        </div>

        {/* Score global */}
        <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            Score global
          </h2>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl font-bold text-[#1e1b4b]">
              {Math.round(scoreGlobal)}
            </span>
            <span className="text-gray-500">/100</span>
          </div>
          <p className="text-sm text-gray-600">
            Moyenne des 4 compétences
          </p>
        </div>
      </div>

      {/* ======================================================================
           BARRES DE PROGRESSION PAR COMPÉTENCE
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
        <h2 className="text-lg font-semibold mb-4 text-[#1e1b4b]">
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
                  className={`h-3 rounded-full progress-bar-fill ${skillColors[skill as keyof typeof skillColors] || 'bg-blue-500'}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================================
           BADGES DÉBLOQUÉS
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
        <h2 className="text-lg font-semibold mb-4 text-[#1e1b4b]">
          Badges débloqués ({badgesDebloques.length}/{badges.length})
        </h2>
        
        {badgesDebloques.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun badge débloqué pour le moment.</p>
            <p className="mt-2 text-sm">
              Continuez à progresser pour en débloquer !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {badgesDebloques.map((badge) => (
              <div
                key={badge.id}
                className="bg-gray-50 rounded-lg p-4 text-center badge-animated"
              >
                <span className="text-3xl mb-2 block">{badge.emoji}</span>
                <h3 className="font-semibold text-gray-800">{badge.nom}</h3>
                <p className="text-xs text-gray-600 truncate">{badge.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================================
           HISTORIQUE DES ÉVALUATIONS
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6 card-hover-lift">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-[#1e1b4b]">
            Historique des évaluations
          </h2>
          {historique.length > 0 && (
            <Link
              href="/evaluation"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Faire une nouvelle évaluation →
            </Link>
          )}
        </div>

        {historique.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucune évaluation enregistrée pour le moment.</p>
            <p className="mt-2 text-sm">
              Commencez par faire une évaluation !
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historique.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-600">
                      {index + 1}.
                    </span>
                    <span className="font-medium text-[#1e1b4b]">
                      {item.titre}
                    </span>
                    {item.critere && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${skillColors[item.critere] || 'bg-gray-200'}`}>
                        {skillLabels[item.critere] || item.critere}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDate(item.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBgColor(item.score)} ${getScoreColor(item.score)}`}
                  >
                    {item.score}/100
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================================
           BOUTON DE RÉINITIALISATION
         ====================================================================== */}
      <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl shadow-md p-6 border border-red-200">
        <h2 className="text-lg font-semibold mb-4 text-red-600">
          Réinitialiser mes données
        </h2>
        <p className="text-sm text-red-700 mb-4">
          Cela supprimera toutes vos données locales (progression, exercices, évaluations, badges).
          Cette action est irréversible.
        </p>
        
        {showResetConfirm ? (
          <div className="flex gap-3">
            <button
              onClick={handleResetData}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Confirmer la réinitialisation
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
          >
            Réinitialiser toutes mes données
          </button>
        )}
      </div>

      {/* Lien vers le dashboard */}
      <div className="text-center pt-4">
        <Link
          href="/"
          className="text-sm text-gray-600 hover:text-blue-600 hover:underline"
        >
          ← Retour au Dashboard
        </Link>
      </div>
      </div>
    </div>
  );
}
