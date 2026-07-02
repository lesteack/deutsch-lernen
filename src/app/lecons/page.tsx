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

type TabType = 'grammaire' | 'vocabulaire' | 'autre';

const tabLabels: Record<TabType, string> = {
  grammaire: 'Grammaire',
  vocabulaire: 'Vocabulaire',
  autre: 'Autre',
};

const tabColors: Record<TabType, string> = {
  grammaire: 'text-purple-600 border-purple-600',
  vocabulaire: 'text-blue-600 border-blue-600',
  autre: 'text-gray-600 border-gray-600',
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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Mes leçons</h1>
          <p className="text-gray-600 mt-1">
            Gérez et consultez vos leçons importées
          </p>
        </div>
        <Link
          href="/lecons/import"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          + Importer un PDF
        </Link>
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
      <div className="bg-white rounded-xl shadow-md p-2">
        <div className="flex gap-1">
          {(Object.keys(tabLabels) as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === tab
                  ? `bg-${tabColors[tab].split('-')[1]} text-white`
                  : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================================
           LISTE DES LEÇONS
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {tabLabels[activeTab]} ({filteredLecons.length} leçon{filteredLecons.length !== 1 ? 's' : ''})
          </h2>
        </div>

        {filteredLecons.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucune leçon de type "{tabLabels[activeTab]}" importée.</p>
            <p className="mt-2 text-sm">
              Importez un PDF pour commencer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLecons.map((lecon) => (
              <div
                key={lecon.id}
                className={`border border-gray-200 rounded-lg p-4 cursor-pointer transition-colors
                  ${selectedLecon?.id === lecon.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                onClick={() => handleSelectLecon(lecon)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-600">
                        {lecon.type === 'grammaire' && '📚'}
                        {lecon.type === 'vocabulaire' && '📖'}
                        {lecon.type === 'autre' && '📋'}
                      </span>
                      <h3 className="font-medium text-gray-800">{lecon.titre}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {lecon.contenuTexte.substring(0, 100)}...
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lecon.notionsCles.slice(0, 3).map((notion, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {notion}
                        </span>
                      ))}
                      {lecon.notionsCles.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          +{lecon.notionsCles.length - 3} autres
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Pour supprimer, il faudrait connaître manuelId et chapitreId
                      // On va juste afficher un message pour l'instant
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
                    <h4 className="font-medium text-gray-700 mb-2">Détails</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3">
                      {lecon.contenuTexte}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-2">
            Pas encore de leçons ?
          </h3>
          <p className="text-blue-700 text-sm mb-4">
            Importez vos manuels PDF pour commencer à créer des exercices.
            Vos leçons seront automatiquement classées par type.
          </p>
          <Link
            href="/lecons/import"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Importer un PDF maintenant →
          </Link>
        </div>
      )}
    </div>
  );
}
