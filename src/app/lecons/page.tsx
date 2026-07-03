'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAllLecons,
  getManuels,
  deleteLecon,
  type Lecon,
  type ExerciceType,
} from '@/lib/storage';

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'grammaire' | 'vocabulaire' | 'conjugaison' | 'autre';

const tabLabels: Record<TabType, string> = {
  grammaire: 'Grammaire',
  vocabulaire: 'Vocabulaire',
  conjugaison: 'Conjugaison',
  autre: 'Autre',
};

// Couleurs des bordures pour les cartes de leçons
const cardBorderColors: Record<TabType, string> = {
  grammaire: 'border-blue-400',
  vocabulaire: 'border-green-400',
  conjugaison: 'border-orange-400',
  autre: 'border-purple-400',
};

// Couleurs des onglets actifs
const tabColors: Record<TabType, string> = {
  grammaire: 'bg-blue-600 text-white',
  vocabulaire: 'bg-green-600 text-white',
  conjugaison: 'bg-orange-600 text-white',
  autre: 'bg-purple-600 text-white',
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function LeconsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('grammaire');
  const [lecons, setLecons] = useState<Lecon[]>([]);
  const [filteredLecons, setFilteredLecons] = useState<Lecon[]>([]);
  const [selectedLecon, setSelectedLecon] = useState<Lecon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les leçons au montage
  useEffect(() => {
    const allLecons = getAllLecons();
    setLecons(allLecons);
    filterLeconsByTab(allLecons, activeTab);
    setIsLoading(false);
  }, []);

  // Filtrer les leçons par onglet
  const filterLeconsByTab = (allLecons: Lecon[], tab: TabType) => {
    const filtered = allLecons.filter(lecon => lecon.type === tab);
    setFilteredLecons(filtered);
  };

  // Changer d'onglet
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    filterLeconsByTab(lecons, tab);
    setSelectedLecon(null);
  };

  // Sélectionner une leçon
  const handleSelectLecon = (lecon: Lecon) => {
    setSelectedLecon(selectedLecon?.id === lecon.id ? null : lecon);
  };

  // Supprimer une leçon
  const handleDeleteLecon = (leconId: string, manuelId: string, chapitreId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette leçon ?')) {
      try {
        deleteLecon(manuelId, chapitreId, leconId);
        const updatedLecons = getAllLecons();
        setLecons(updatedLecons);
        filterLeconsByTab(updatedLecons, activeTab);
        if (selectedLecon?.id === leconId) {
          setSelectedLecon(null);
        }
      } catch (err) {
        setError('Impossible de supprimer la leçon');
      }
    }
  };

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
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* En-tête avec dégradé */}
        <div className="bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Mes leçons</h1>
              <p className="text-white/80 mt-2">
                Gérez et consultez vos leçons importées
              </p>
            </div>
            <Link
              href="/lecons/import"
              className="px-6 py-3 bg-yellow-400 text-black rounded-xl hover:bg-yellow-500 transition-all duration-200 font-bold shadow-md"
            >
              + Importer un PDF
            </Link>
          </div>
        </div>

      {/* Affichage des erreurs */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* ======================================================================
           ONGLETS DE FILTRAGE
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-2 mb-8">
        <div className="flex gap-1">
          {(Object.keys(tabLabels) as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${activeTab === tab
                  ? `${tabColors[tab]} border-b-4 border-yellow-400`
                  : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================================
           LISTE DES LEÇONS
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-[#1e293b]">
            {tabLabels[activeTab]} ({filteredLecons.length} leçon{filteredLecons.length !== 1 ? 's' : ''})
          </h2>
        </div>

        {filteredLecons.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-[#1e293b] text-lg mb-2">Aucune leçon de type "{tabLabels[activeTab]}" importée.</p>
            <p className="text-gray-600 text-sm mb-6">
              Importez un PDF pour commencer.
            </p>
            <Link
              href="/lecons/import"
              className="inline-block px-6 py-3 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium"
            >
              Importer un PDF maintenant
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLecons.map((lecon) => (
              <div
                key={lecon.id}
                className={`bg-white border-l-4 rounded-xl p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md
                  ${cardBorderColors[lecon.type as TabType]} ${selectedLecon?.id === lecon.id ? 'bg-[#f8fafc]' : ''}`}
                onClick={() => handleSelectLecon(lecon)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {lecon.type === 'grammaire' && '📚'}
                        {lecon.type === 'vocabulaire' && '📖'}
                        {lecon.type === 'conjugaison' && '🔄'}
                        {lecon.type === 'autre' && '📋'}
                      </span>
                      <h3 className="font-semibold text-[#1e293b] text-lg">{lecon.titre}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">
                      {lecon.contenuTexte.substring(0, 150)}...
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lecon.notionsCles.slice(0, 3).map((notion, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {notion}
                        </span>
                      ))}
                      {lecon.notionsCles.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          +{lecon.notionsCles.length - 3} autres
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setError('La suppression sera implémentée dans une prochaine version');
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Supprimer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Détails (si sélectionnée) */}
                {selectedLecon?.id === lecon.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in">
                    <h4 className="font-medium text-[#1e293b] mb-2">Détails</h4>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap mb-4">
                      {lecon.contenuTexte}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {lecon.notionsCles.map((notion, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {notion}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Ajoutée le {formatDate(lecon.dateAjout)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================================
           INFOS SUR L'IMPORT
         ====================================================================== */}
      {lecons.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">📖</div>
          <h3 className="font-semibold text-[#1e293b] text-xl mb-2">
            Pas encore de leçons ?
          </h3>
          <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
            Importez vos manuels PDF pour commencer à créer des exercices.
            Vos leçons seront automatiquement classées par type.
          </p>
          <Link
            href="/lecons/import"
            className="inline-block px-6 py-3 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium"
          >
            Importer un PDF maintenant
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
