'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import {
  getAllLecons,
  getManuels,
  deleteLecon,
  updateLecon,
  type Lecon,
  type ExerciceType,
  type FicheRevision,
  type Manuel,
  type Chapitre,
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

// Type pour une leçon avec ses références
interface LeconWithRef extends Lecon {
  manuelId: string;
  chapitreId: string;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function LeconsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('grammaire');
  const [lecons, setLecons] = useState<LeconWithRef[]>([]);
  const [filteredLecons, setFilteredLecons] = useState<LeconWithRef[]>([]);
  const [selectedLecon, setSelectedLecon] = useState<LeconWithRef | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const [isGeneratingFiche, setIsGeneratingFiche] = useState(false);
  
  // States pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leconToDelete, setLeconToDelete] = useState<LeconWithRef | null>(null);
  const [selectedLecons, setSelectedLecons] = useState<Set<string>>(new Set());
  
  // Toast
  const { showToast, ToastContainer } = useToast();

  // Charger les leçons avec leurs références au montage
  useEffect(() => {
    const loadLeconsWithRefs = () => {
      const allManuels = getManuels();
      const leconsWithRefs: LeconWithRef[] = [];
      
      for (const manuel of allManuels) {
        for (const chapitre of manuel.chapitres) {
          for (const lecon of chapitre.lecons) {
            leconsWithRefs.push({
              ...lecon,
              manuelId: manuel.id,
              chapitreId: chapitre.id,
            });
          }
        }
      }
      
      setLecons(leconsWithRefs);
      filterLeconsByTab(leconsWithRefs, activeTab);
      setIsLoading(false);
    };
    
    loadLeconsWithRefs();
  }, []);

  // Filtrer les leçons par onglet
  const filterLeconsByTab = (allLecons: LeconWithRef[], tab: TabType) => {
    const filtered = allLecons.filter(lecon => lecon.type === tab);
    setFilteredLecons(filtered);
  };

  // Changer d'onglet
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    filterLeconsByTab(lecons, tab);
    setSelectedLecon(null);
    setSelectedLecons(new Set());
  };

  // Sélectionner une leçon
  const handleSelectLecon = (lecon: LeconWithRef) => {
    setSelectedLecon(lecon);
    setShowFullContent(false);
  };

  // Toggle sélection pour suppression multiple
  const toggleLeconSelection = (leconId: string) => {
    setSelectedLecons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leconId)) {
        newSet.delete(leconId);
      } else {
        newSet.add(leconId);
      }
      return newSet;
    });
  };

  // Sélectionner/désélectionner toutes les leçons filtrées
  const toggleSelectAll = () => {
    if (selectedLecons.size === filteredLecons.length && filteredLecons.length > 0) {
      setSelectedLecons(new Set());
    } else {
      setSelectedLecons(new Set(filteredLecons.map(l => l.id)));
    }
  };

  // Ouvrir modal de confirmation de suppression
  const openDeleteModal = (lecon: LeconWithRef | null) => {
    setLeconToDelete(lecon);
    setShowDeleteModal(true);
  };

  // Fermer modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setLeconToDelete(null);
  };

  // Supprimer une ou plusieurs leçons
  const confirmDelete = () => {
    if (!leconToDelete && selectedLecons.size === 0) {
      closeDeleteModal();
      return;
    }

    // Suppression simple (une leçon)
    if (leconToDelete) {
      deleteLecon(leconToDelete.manuelId, leconToDelete.chapitreId, leconToDelete.id);
      showToast(`Leçon supprimée`, 'success');
      refreshLecons();
      closeDeleteModal();
      return;
    }

    // Suppression multiple
    if (selectedLecons.size > 0) {
      selectedLecons.forEach(leconId => {
        const lecon = lecons.find(l => l.id === leconId);
        if (lecon) {
          deleteLecon(lecon.manuelId, lecon.chapitreId, lecon.id);
        }
      });
      
      const count = selectedLecons.size;
      const message = count === 1 
        ? `Leçon supprimée`
        : `${count} leçons supprimées`;
      showToast(message, 'success');
      
      refreshLecons();
      setSelectedLecons(new Set());
      closeDeleteModal();
    }
  };

  // Rafraîchir la liste des leçons
  const refreshLecons = () => {
    const allManuels = getManuels();
    const leconsWithRefs: LeconWithRef[] = [];
    
    for (const manuel of allManuels) {
      for (const chapitre of manuel.chapitres) {
        for (const lecon of chapitre.lecons) {
          leconsWithRefs.push({
            ...lecon,
            manuelId: manuel.id,
            chapitreId: chapitre.id,
          });
        }
      }
    }
    
    setLecons(leconsWithRefs);
    filterLeconsByTab(leconsWithRefs, activeTab);
    
    // Si la leçon sélectionnée a été supprimée
    if (selectedLecon && !leconsWithRefs.some(l => l.id === selectedLecon.id)) {
      setSelectedLecon(null);
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

  /**
   * Génère une fiche de révision via Mistral et met à jour la leçon
   */
  const generateAndSaveFicheRevision = useCallback(async (lecon: LeconWithRef) => {
    if (!lecon?.contenuTexte) return null;

    setIsGeneratingFiche(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Crée une fiche de révision complète et structurée basée sur le contenu suivant :

---
Contenu de la leçon:
${lecon.contenuTexte.substring(0, 2000)}
Type: ${lecon.type}
Titre: ${lecon.titre}
---

Crée une fiche de révision en JSON avec la structure exacte suivante :

{
  "titre": "Titre de la fiche de révision",
  "resume": "Résumé en 3-4 phrases en français de la notion principale",
  "pointsCles": [
    "Point clé 1",
    "Point clé 2",
    "Point clé 3"
  ],
  "regles": [
    {
      "regle": "Nom de la règle grammaticale ou concept",
      "explication": "Explication courte en français",
      "exemple": "Beispielsatz auf Deutsch (en allemand)"
    }
  ],
  "vocabulaireImportant": [
    {
      "mot": "das Verb",
      "traduction": "le verbe",
      "exemple": "Exemple de phrase en allemand utilisant ce mot"
    }
  ],
  "astuce": "Conseil mnémotechnique ou astuce pour retenir, en français"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON valide, sans texte supplémentaire, sans commentaires.
Si le contenu ne contient pas d'informations grammaticales, adapte la structure (regles peut être vide).
Le vocabulaire doit être pertinent et utile pour l'apprentissage.`;

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
        throw new Error(errorData.error || 'Erreur lors de la génération de la fiche');
      }

      const data = await response.json();
      
      // Validation de la réponse
      if (!data.titre || !data.resume || !data.pointsCles) {
        throw new Error('Fiche de révision invalide');
      }

      // Retourner la fiche de révision pour qu'elle soit utilisée par le composant
      return {
        titre: String(data.titre),
        resume: String(data.resume),
        pointsCles: Array.isArray(data.pointsCles) ? data.pointsCles.map(String) : [],
        regles: Array.isArray(data.regles) ? data.regles.map((r: any) => ({
          regle: String(r.regle || ''),
          explication: String(r.explication || ''),
          exemple: String(r.exemple || ''),
        })) : [],
        vocabulaireImportant: Array.isArray(data.vocabulaireImportant) ? data.vocabulaireImportant.map((v: any) => ({
          mot: String(v.mot || ''),
          traduction: String(v.traduction || ''),
          exemple: String(v.exemple || ''),
        })) : [],
        astuce: String(data.astuce || ''),
        dateGeneration: new Date().toISOString(),
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer la fiche de révision : ${errorMessage}`);
      return null;
    } finally {
      setIsGeneratingFiche(false);
    }
  }, []);

  // Nombre de leçons sélectionnées
  const selectedCount = selectedLecons.size;
  const hasSelection = selectedCount > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      {/* Toast Container */}
      <ToastContainer />
      
      {/* Modal de confirmation de suppression */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title={leconToDelete ? 'Supprimer cette leçon ?' : `Supprimer ${selectedCount} leçon${selectedCount > 1 ? 's' : ''} ?`}
      >
        {leconToDelete ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Cette action supprimera définitivement <strong>&quot;{leconToDelete.titre}&quot;</strong> 
              ainsi que sa fiche de révision. Les exercices associés resteront dans l'historique.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-medium text-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Cette action supprimera définitivement {selectedCount} leçon{selectedCount > 1 ? 's' : ''} 
              ainsi que leurs fiches de révision. Les exercices associés resteront dans l'historique.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-medium text-sm"
              >
                Supprimer la sélection
              </button>
            </div>
          </div>
        )}
      </Modal>

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

        {/* Bouton de suppression multiple (visible quand sélection active) */}
        {hasSelection && (
          <div className="mb-4">
            <button
              onClick={() => openDeleteModal(null)}
              className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-medium text-sm flex items-center gap-2 shadow-md"
            >
              <span>🗑️</span>
              Supprimer la sélection ({selectedCount})
            </button>
          </div>
        )}

        {/* ======================================================================
             LISTE DES LEÇONS
           ====================================================================== */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-[#1e293b]">
              {tabLabels[activeTab]} ({filteredLecons.length} leçon{filteredLecons.length !== 1 ? 's' : ''})
            </h2>
            {/* Bouton sélectionner tout */}
            {filteredLecons.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-all duration-200"
              >
                {selectedCount === filteredLecons.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}
          </div>

          {filteredLecons.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-[#1e293b] text-lg mb-2">Aucune leçon de type "{tabLabels[activeTab]}" importée.</p>
              <p className="text-gray-600 text-sm mb-6">
                Importez un PDF pour commencer. Chaque PDF devient une leçon complète.
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
              {filteredLecons.map((lecon) => {
                const isSelected = selectedLecons.has(lecon.id);
                
                return (
                  <div
                    key={lecon.id}
                    className={`bg-white border-l-4 rounded-xl p-5 shadow-sm transition-all duration-200 ${cardBorderColors[lecon.type as TabType]} ${isSelected ? 'ring-2 ring-[#3730a3]' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {/* Case à cocher (visible au hover ou sélection active) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLeconSelection(lecon.id);
                            }}
                            className={`p-2 rounded-lg transition-all duration-200 ${isSelected ? 'bg-[#3730a3] text-white' : 'bg-white border border-gray-300 text-gray-400 hover:border-[#3730a3] hover:bg-[#3730a3]/10'}`}
                            aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                          >
                            {isSelected ? '✓' : ''}
                          </button>
                          
                          <span className="text-2xl">
                            {lecon.type === 'grammaire' && '📚'}
                            {lecon.type === 'vocabulaire' && '📖'}
                            {lecon.type === 'conjugaison' && '🔄'}
                            {lecon.type === 'autre' && '📋'}
                          </span>
                          <h3 className="font-semibold text-[#1e293b] text-lg">{lecon.titre}</h3>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${lecon.type === 'grammaire' ? 'bg-blue-100 text-blue-800' : lecon.type === 'vocabulaire' ? 'bg-green-100 text-green-800' : lecon.type === 'conjugaison' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>
                            {lecon.type}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">
                          {lecon.contenuTexte.substring(0, 100)}...
                        </p>
                        <p className="text-xs text-gray-500">
                          Ajoutée le {formatDate(lecon.dateAjout)}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {/* Bouton de suppression */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(lecon);
                          }}
                          className="p-2 text-red-400 hover:text-red-600 opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-red-50"
                          aria-label={`Supprimer ${lecon.titre}`}
                          title="Supprimer cette leçon"
                        >
                          🗑️
                        </button>
                        
                        <button
                          onClick={() => handleSelectLecon(lecon)}
                          className="px-4 py-2 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium text-sm"
                        >
                          Voir le détail
                        </button>
                      </div>
                    </div>

                    {/* Détails (si sélectionnée) */}
                    {selectedLecon?.id === lecon.id && (
                      <div className="mt-4 bg-white border border-gray-200 rounded-xl p-6 animate-fade-in">
                        {/* Aperçu du contenu */}
                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-[#1e293b] flex items-center gap-2">
                              <span>📄</span> Contenu du cours
                            </h4>
                            <button
                              onClick={() => setShowFullContent(!showFullContent)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-all duration-200"
                            >
                              {showFullContent ? 'Réduire' : 'Voir tout'}
                            </button>
                          </div>
                          <div className="bg-[#f8fafc] p-4 rounded-lg max-h-[300px] overflow-y-auto border border-gray-200">
                            <pre className="text-sm whitespace-pre-wrap font-sans">{lecon.contenuTexte}</pre>
                          </div>
                        </div>

                        {/* Fiche de révision */}
                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-[#1e293b] flex items-center gap-2">
                              <span>📚</span> Fiche de révision
                            </h4>
                            {!lecon.ficheRevision && (
                              <button
                                onClick={async () => {
                                  const newFiche = await generateAndSaveFicheRevision(lecon);
                                  if (newFiche) {
                                    updateLecon(lecon.manuelId, lecon.chapitreId, lecon.id, { ficheRevision: newFiche });
                                    refreshLecons();
                                    handleSelectLecon({ ...lecon, ficheRevision: newFiche });
                                  }
                                }}
                                disabled={isGeneratingFiche}
                                className="px-4 py-2 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isGeneratingFiche ? (
                                  <span className="flex items-center gap-2">
                                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                    Génération en cours...
                                  </span>
                                ) : (
                                  'Générer la fiche de révision'
                                )}
                              </button>
                            )}
                            {lecon.ficheRevision && (
                              <button
                                onClick={async () => {
                                  const newFiche = await generateAndSaveFicheRevision(lecon);
                                  if (newFiche) {
                                    updateLecon(lecon.manuelId, lecon.chapitreId, lecon.id, { ficheRevision: newFiche });
                                    refreshLecons();
                                  }
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium text-sm"
                              >
                                Régénérer
                              </button>
                            )}
                          </div>

                          {lecon.ficheRevision && (
                            <div className="space-y-4">
                              {/* Résumé */}
                              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                <h5 className="font-medium text-blue-800 mb-2">Résumé</h5>
                                <p className="text-blue-700 text-sm">{lecon.ficheRevision.resume}</p>
                              </div>

                              {/* Points clés */}
                              {lecon.ficheRevision.pointsCles.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                  <h5 className="font-medium text-[#1e293b] mb-3">🎯 Points clés</h5>
                                  <ul className="space-y-2">
                                    {lecon.ficheRevision.pointsCles.map((point, index) => (
                                      <li key={index} className="flex items-start gap-2 text-sm">
                                        <span className="text-green-500 mt-1">✓</span>
                                        <span className="text-gray-700">{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Règles */}
                              {lecon.ficheRevision.regles.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                  <h5 className="font-medium text-[#1e293b] mb-3">📖 Règles</h5>
                                  <div className="space-y-3">
                                    {lecon.ficheRevision.regles.map((regle, index) => (
                                      <div key={index} className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                        <h6 className="font-medium text-yellow-800 mb-1">{regle.regle}</h6>
                                        <p className="text-yellow-700 text-sm mb-1">{regle.explication}</p>
                                        {regle.exemple && (
                                          <p className="text-yellow-600 text-sm italic">Ex: {regle.exemple}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Vocabulaire */}
                              {lecon.ficheRevision.vocabulaireImportant.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                  <h5 className="font-medium text-[#1e293b] mb-3">💬 Vocabulaire important</h5>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-200">
                                          <th className="text-left py-2 font-medium text-gray-600">Mot</th>
                                          <th className="text-left py-2 font-medium text-gray-600">Traduction</th>
                                          <th className="text-left py-2 font-medium text-gray-600">Exemple</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lecon.ficheRevision.vocabulaireImportant.map((vocab, index) => (
                                          <tr key={index} className="border-b border-gray-100">
                                            <td className="py-2 text-gray-700">{vocab.mot}</td>
                                            <td className="py-2 text-gray-700">{vocab.traduction}</td>
                                            <td className="py-2 text-gray-600 italic">{vocab.exemple}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Astuce */}
                              {lecon.ficheRevision.astuce && (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                  <h5 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                                    <span>🧠</span> Astuce
                                  </h5>
                                  <p className="text-orange-700 text-sm">{lecon.ficheRevision.astuce}</p>
                                </div>
                              )}

                              {/* Bouton pour faire un exercice */}
                              <div className="pt-4">
                                <Link
                                  href={`/exercices?leconId=${lecon.id}`}
                                  className="w-full block text-center px-6 py-3 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium"
                                >
                                  Faire un exercice sur cette leçon
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
