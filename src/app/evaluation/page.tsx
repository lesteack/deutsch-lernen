'use client';

import { useState } from 'react';

/**
 * Page d'évaluation avec 5 onglets
 * Le contenu sera développé à l'étape 9 de la roadmap
 */

type EvaluationTab = 'comprehensionOrale' | 'comprehensionEcrite' | 'expressionEcrite' | 'expressionOrale' | 'testGlobal';

const tabs: { id: EvaluationTab; label: string; icon: string; description: string }[] = [
  {
    id: 'comprehensionOrale',
    label: 'Compréhension orale',
    icon: '🎧',
    description: 'Écoutez des textes en allemand et répondez à des questions',
  },
  {
    id: 'comprehensionEcrite',
    label: 'Compréhension écrite',
    icon: '📖',
    description: 'Lisez des textes et répondez à des questions de compréhension',
  },
  {
    id: 'expressionEcrite',
    label: 'Expression écrite',
    icon: '✍️',
    description: 'Rédigez des textes qui seront corrigés par Mistral',
  },
  {
    id: 'expressionOrale',
    label: 'Expression orale',
    icon: '🎤',
    description: 'Parlez et obtenez une transcription et une correction',
  },
  {
    id: 'testGlobal',
    label: 'Test global',
    icon: '🏆',
    description: 'Évaluez toutes vos compétences et obtenez un niveau CECRL précis',
  },
];

const tabColors: Record<EvaluationTab, string> = {
  comprehensionOrale: 'orange',
  comprehensionEcrite: 'blue',
  expressionEcrite: 'purple',
  expressionOrale: 'green',
  testGlobal: 'red',
};

export default function EvaluationPage() {
  const [activeTab, setActiveTab] = useState<EvaluationTab>('comprehensionOrale');

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Évaluation
        </h1>
        <p className="text-gray-600">
          Testez et améliorez vos compétences en allemand
        </p>
      </div>

      {/* Onglets de navigation */}
      <div className="bg-white rounded-xl shadow-md p-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2
                ${activeTab === tab.id
                  ? `bg-${tabColors[tab.id]}-100 text-${tabColors[tab.id]}-700`
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <div className="text-6xl mb-4">{tabs.find(t => t.id === activeTab)?.icon}</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {tabs.find(t => t.id === activeTab)?.label}
        </h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {tabs.find(t => t.id === activeTab)?.description}
        </p>
        <p className="text-sm text-gray-500">
          Ce contenu sera développé à l'étape 9 de la roadmap
        </p>
      </div>

      {/* Aperçu des fonctionnalités à venir */}
      <div className="bg-gray-50 rounded-xl shadow-md p-6">
        <h3 className="font-semibold text-gray-800 mb-4">
          Fonctionnalités à venir :
        </h3>
        <ul className="space-y-2 text-gray-600">
          <li className="flex items-center gap-2">
            <span>🎧</span>
            <span>Écoute avec synthèse vocale (Web Speech API)</span>
          </li>
          <li className="flex items-center gap-2">
            <span>✍️</span>
            <span>Correction détaillée par Mistral</span>
          </li>
          <li className="flex items-center gap-2">
            <span>🎤</span>
            <span>Reconnaissance vocale (SpeechRecognition API)</span>
          </li>
          <li className="flex items-center gap-2">
            <span>🏆</span>
            <span>Estimation de niveau CECRL basée sur les scores</span>
          </li>
          <li className="flex items-center gap-2">
            <span>📊</span>
            <span>Historique des évaluations par compétence</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
