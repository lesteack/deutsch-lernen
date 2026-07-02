'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getProgression,
  getExercices,
  type SuiviProgression,
  type Exercice,
  type NiveauCECRL,
} from '@/lib/storage';
import { calculerScoresParCritere, calculerScoreGlobal } from '@/lib/progression';

// ============================================================================
// COULEURS PAR NIVEAU CECRL
// ============================================================================

const niveauBadgeColors: Record<NiveauCECRL, string> = {
  A1: 'bg-green-100 text-green-800 border-green-200',
  A2: 'bg-green-200 text-green-900 border-green-300',
  B1: 'bg-blue-100 text-blue-800 border-blue-200',
  B2: 'bg-blue-200 text-blue-900 border-blue-300',
  C1: 'bg-purple-100 text-purple-800 border-purple-200',
  C2: 'bg-purple-200 text-purple-900 border-purple-300',
};

// Couleurs pour les compétences
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
  const [scores, setScores] = useState<Record<string, number>>({
    comprehensionOrale: 0,
    comprehensionEcrite: 0,
    expressionOrale: 0,
    expressionEcrite: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Charger les données au montage
  useEffect(() => {
    const loadData = () => {
      const prog = getProgression();
      const exs = getExercices();
      const calcScores = calculerScoresParCritere();
      
      setProgression(prog);
      setExercices(exs);
      setScores(calcScores);
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  // Calculer le score global
  const scoreGlobal = calculerScoreGlobal(scores);

  // Obtenir les 5 derniers exercices
  const dernierExercices = [...exercices]
    .sort((a, b) => new Date(b.dateRealisation).getTime() - new Date(a.dateRealisation).getTime())
    .slice(0, 5);

  // Format de date lisible
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Tableau de bord
        </h1>
        <p className="text-gray-600">
          Suivez votre progression en allemand
        </p>
      </div>

      {/* ======================================================================
           CARTES DE STATISTIQUES PRINCIPALES
         ====================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Niveau CECRL */}
        <div className="bg-white rounded-xl shadow-md p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br opacity-10
            from-blue-100 to-purple-100"></div>
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Niveau CECRL
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-4 py-2 rounded-full border-2 font-bold text-lg
                  ${niveauBadgeColors[progression?.niveauEstimeCECRL || 'A1']}`}
              >
                {progression?.niveauEstimeCECRL || 'A1'}
              </span>
              <span className="text-gray-600">
                Niveau actuel
              </span>
            </div>
            {progression?.justificationMistral && (
              <p className="text-xs text-gray-500 italic truncate">
                {progression.justificationMistral.substring(0, 80)}...
              </p>
            )}
          </div>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-xl shadow-md p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br opacity-10
            from-orange-100 to-red-100"></div>
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Streak
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔥</span>
              <span className="text-3xl font-bold text-orange-600">
                {progression?.streak || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {progression?.streak === 1 
                ? '1 jour consécutif' 
                : `${progression?.streak || 0} jours consécutifs`}
            </p>
          </div>
        </div>

        {/* Score global */}
        <div className="bg-white rounded-xl shadow-md p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br opacity-10
            from-green-100 to-blue-100"></div>
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Score global
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-gray-800">
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
           BARRES DE PROGRESSION PAR COMPÉTENCE
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Progression par compétence
        </h2>
        <div className="space-y-4">
          {Object.entries(scores).map(([skill, score]) => (
            <div key={skill} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {skillLabels[skill] || skill}
                </span>
                <span className="text-gray-500">{score}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${skillColors[skill as keyof typeof skillColors] || 'bg-blue-500'}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================================
           DERNIERS EXERCICES
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Derniers exercices
          </h2>
          {dernierExercices.length > 0 && (
            <Link
              href="/exercices"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Voir tous les exercices →
            </Link>
          )}
        </div>

        {dernierExercices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun exercice effectué pour le moment.</p>
            <p className="mt-2 text-sm">
              Commencez par en générer un !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dernierExercices.map((exercice, index) => (
              <div
                key={exercice.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-600">
                      {index + 1}.
                    </span>
                    <span className="font-medium text-gray-800">
                      {exercice.type === 'qcm' ? 'QCM' : 
                       exercice.type === 'texteATrous' ? 'Texte à trous' :
                       exercice.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDate(exercice.dateRealisation)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium
                      ${exercice.score && exercice.score >= 80 
                        ? 'bg-green-100 text-green-700' 
                        : exercice.score && exercice.score >= 50 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-red-100 text-red-700'}`}
                  >
                    {exercice.score ? `${exercice.score}/100` : 'Non noté'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================================
           BOUTONS D'ACTION PRINCIPAUX
         ====================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/exercices"
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 group-hover:text-blue-700">
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
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 group-hover:text-green-700">
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
           CONSEILS / MOTIVATION
         ====================================================================== */}
      {progression?.streak && progression.streak > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-md p-6 text-white">
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
