'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getFlashcards,
  getFlashcardsARevoir,
  getFlashcardsARevoirCount,
  getFlashcardsByLecon,
  addFlashcard,
  updateFlashcard,
  deleteFlashcard,
  calculerProchaineRevision,
  getAllLecons,
  type Flashcard,
  type Lecon,
  type ResultatRevision,
} from '@/lib/storage';
import Modal from '@/components/Modal';

// ============================================================================
// CSS POUR L'ANIMATION FLIP 3D
// ============================================================================

const FlipCardStyles = () => (
  <style jsx global>{`
    @keyframes flip {
      0% { transform: rotateY(0); }
      100% { transform: rotateY(180deg); }
    }
    
    .animate-flip {
      animation: flip 0.6s ease-in-out;
    }
    
    .perspective-1000 {
      perspective: 1000px;
    }
    
    .preserve-3d {
      transform-style: preserve-3d;
    }
    
    .backface-hidden {
      backface-visibility: hidden;
    }
    
    .rotate-y-180 {
      transform: rotateY(180deg);
    }
  `}</style>
);

// ============================================================================
// TYPES
// ============================================================================

type ViewType = 'dashboard' | 'revision' | 'add';

interface RevisionStats {
  facile: number;
  bien: number;
  difficile: number;
  raté: number;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function FlashcardsPage() {
  // État de la vue
  const [view, setView] = useState<ViewType>('dashboard');
  
  // Données
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsARevoir, setFlashcardsARevoir] = useState<Flashcard[]>([]);
  const [lecons, setLecons] = useState<Lecon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // État pour la session de révision
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revisionStats, setRevisionStats] = useState<RevisionStats>({
    facile: 0,
    bien: 0,
    difficile: 0,
    raté: 0,
  });
  const [sessionFinished, setSessionFinished] = useState(false);
  const [prochaineRevisionDate, setProchaineRevisionDate] = useState<string>('');

  // État pour l'ajout manuel
  const [newFlashcard, setNewFlashcard] = useState<Partial<Omit<Flashcard, 'id' | 'prochaineRevision' | 'intervalleJours' | 'facilite' | 'nombreRevisions' | 'dernierResultat'>>>({
    motAllemand: '',
    article: undefined,
    traductionFrancais: '',
    exemple: undefined,
    traductionExemple: undefined,
    leconId: '',
    leconTitre: '',
    niveau: 0,
  });
  const [isGeneratingExample, setIsGeneratingExample] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // État UI
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [flashcardToDelete, setFlashcardToDelete] = useState<Flashcard | null>(null);

  // ==========================================================================
  // CHARGEMENT INITIAL
  // ==========================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      const allFlashcards = getFlashcards();
      const flashcardsToReview = getFlashcardsARevoir();
      const allLecons = getAllLecons();
      
      setFlashcards(allFlashcards);
      setFlashcardsARevoir(flashcardsToReview);
      setLecons(allLecons);
      setIsLoading(false);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      setIsLoading(false);
    }
  }, []);

  // ==========================================================================
  // FONCTIONS POUR LA RÉVISION
  // ==========================================================================

  const handleRevisionResult = useCallback((resultat: ResultatRevision) => {
    if (flashcardsARevoir.length === 0 || currentFlashcardIndex >= flashcardsARevoir.length) return;

    const currentFlashcard = flashcardsARevoir[currentFlashcardIndex];
    
    // Mettre à jour les stats
    setRevisionStats(prev => {
      const newStats = { ...prev };
      newStats[resultat] = (newStats[resultat as keyof RevisionStats] || 0) + 1;
      return newStats;
    });

    // Calculer la prochaine révision
    const updatedFlashcard = calculerProchaineRevision(currentFlashcard, resultat);
    updateFlashcard(currentFlashcard.id, updatedFlashcard);

    // Mettre à jour la date de prochaine révision pour l'UI
    const dateProchaine = new Date(updatedFlashcard.prochaineRevision);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    setProchaineRevisionDate(dateProchaine.toLocaleDateString('fr-FR', options));

    // Passer à la carte suivante
    const nextIndex = currentFlashcardIndex + 1;
    if (nextIndex < flashcardsARevoir.length) {
      setCurrentFlashcardIndex(nextIndex);
      setShowAnswer(false);
    } else {
      // Fin de la session
      setSessionFinished(true);
    }

    // Recharger les données pour la prochaine itération
    setFlashcardsARevoir(getFlashcardsARevoir());
    setFlashcards(getFlashcards());
  }, [currentFlashcardIndex, flashcardsARevoir]);

  const startRevisionSession = useCallback(() => {
    const cardsToReview = getFlashcardsARevoir();
    if (cardsToReview.length === 0) {
      setError('Aucune carte à réviser aujourd\'hui !');
      return;
    }
    
    setFlashcardsARevoir(cardsToReview);
    setCurrentFlashcardIndex(0);
    setShowAnswer(false);
    setSessionFinished(false);
    setRevisionStats({ facile: 0, bien: 0, difficile: 0, raté: 0 });
    setView('revision');
  }, []);

  const startFullRevision = useCallback(() => {
    const allCards = getFlashcards();
    if (allCards.length === 0) {
      setError('Aucune flashcard disponible !');
      return;
    }
    
    setFlashcardsARevoir(allCards);
    setCurrentFlashcardIndex(0);
    setShowAnswer(false);
    setSessionFinished(false);
    setRevisionStats({ facile: 0, bien: 0, difficile: 0, raté: 0 });
    setView('revision');
  }, []);

  const resetRevisionSession = useCallback(() => {
    setView('dashboard');
    loadData();
  }, [loadData]);

  // ==========================================================================
  // FONCTIONS POUR L'AJOUT MANUEL
  // ==========================================================================

  const handleGenerateExample = useCallback(async () => {
    if (!newFlashcard.motAllemand) {
      setError('Veuillez d\'abord entrer un mot en allemand');
      return;
    }

    setIsGeneratingExample(true);
    setError(null);

    try {
      const prompt = `Génère une courte phrase exemple en allemand utilisant le mot "${newFlashcard.motAllemand}" et donne sa traduction en français.`;

      const response = await fetch('/api/mistral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          responseFormat: 'text',
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération de l\'exemple');
      }

      const data = await response.text();
      // Parser la réponse (format attendu: "Phrase en allemand. - Traduction en français.")
      const lines = data.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        setNewFlashcard(prev => ({
          ...prev,
          exemple: lines[0].trim(),
          traductionExemple: lines[1].trim(),
        }));
      } else if (lines.length === 1) {
        // Essayer de séparer par " - "
        const parts = lines[0].split(' - ');
        if (parts.length >= 2) {
          setNewFlashcard(prev => ({
            ...prev,
            exemple: parts[0].trim(),
            traductionExemple: parts.slice(1).join(' - ').trim(),
          }));
        }
      }

    } catch (err) {
      setError('Impossible de générer un exemple');
    } finally {
      setIsGeneratingExample(false);
    }
  }, [newFlashcard.motAllemand]);

  const handleAddFlashcard = useCallback(async () => {
    if (!newFlashcard.motAllemand || !newFlashcard.traductionFrancais) {
      setError('Veuillez remplir au moins le mot en allemand et sa traduction');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const lecon = lecons.find(l => l.id === newFlashcard.leconId);
      const leconTitre = lecon?.titre || newFlashcard.leconTitre || 'Autre';
      
      addFlashcard({
        motAllemand: newFlashcard.motAllemand || '',
        article: newFlashcard.article,
        traductionFrancais: newFlashcard.traductionFrancais || '',
        exemple: newFlashcard.exemple,
        traductionExemple: newFlashcard.traductionExemple,
        leconId: newFlashcard.leconId || '',
        leconTitre,
        niveau: newFlashcard.niveau || 0,
      });

      // Réinitialiser le formulaire
      setNewFlashcard({
        motAllemand: '',
        article: '',
        traductionFrancais: '',
        exemple: '',
        traductionExemple: '',
        leconId: '',
        leconTitre: '',
      });

      setView('dashboard');
      loadData();
      setError('✅ Flashcard ajoutée avec succès !');

    } catch (err) {
      setError('Impossible d\'ajouter la flashcard');
    } finally {
      setIsAdding(false);
    }
  }, [newFlashcard, lecons, loadData]);

  const handleDeleteFlashcard = useCallback((flashcard: Flashcard) => {
    setFlashcardToDelete(flashcard);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteFlashcard = useCallback(() => {
    if (flashcardToDelete) {
      deleteFlashcard(flashcardToDelete.id);
      setShowDeleteModal(false);
      setFlashcardToDelete(null);
      loadData();
    }
  }, [flashcardToDelete, loadData]);

  // ==========================================================================
  // STATISTIQUES
  // ==========================================================================

  const getFlashcardsByNiveau = useCallback(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    flashcards.forEach(f => {
      counts[f.niveau] = (counts[f.niveau] || 0) + 1;
    });
    return counts;
  }, [flashcards]);

  const getProgressPercentage = useCallback(() => {
    if (flashcards.length === 0) return 0;
    const mastered = flashcards.filter(f => f.niveau >= 3).length;
    return Math.round((mastered / flashcards.length) * 100);
  }, [flashcards]);

  const getFlashcardsByLeconCount = useCallback(() => {
    const counts: Record<string, number> = {};
    flashcards.forEach(f => {
      counts[f.leconId] = (counts[f.leconId] || 0) + 1;
    });
    return counts;
  }, [flashcards]);

  // ==========================================================================
  // RENDU
  // ==========================================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-white text-xl">Chargement des flashcards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] p-6">
      <FlipCardStyles />
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">🃏 Flashcards</h1>
              <p className="text-gray-400">Maîtrisez votre vocabulaire allemand avec la répétition espacée</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors duration-200"
            >
              ← Retour au dashboard
            </Link>
          </div>

          {/* Navigation entre les vues */}
          <div className="bg-white/10 backdrop-blur rounded-xl p-2 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setView('dashboard');
                  loadData();
                }}
                className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                  view === 'dashboard'
                    ? 'bg-[#3730a3] text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                📊 Tableau de bord
              </button>
              <button
                onClick={startRevisionSession}
                className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                  view === 'revision'
                    ? 'bg-[#3730a3] text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
                disabled={flashcardsARevoir.length === 0}
              >
                📖 Réviser maintenant ({flashcardsARevoir.length})
              </button>
              <button
                onClick={startFullRevision}
                className="px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium text-gray-300 hover:bg-white/10"
                disabled={flashcards.length === 0}
              >
                🔄 Tout réviser
              </button>
              <button
                onClick={() => setView('add')}
                className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                  view === 'add'
                    ? 'bg-[#3730a3] text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                ➕ Ajouter une carte
              </button>
            </div>
          </div>

          {/* Affichage des erreurs */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-4 text-red-300 hover:text-red-200"
              >
                ×
              </button>
            </div>
          )}

          {/* ================================================================
               VUE A — TABLEAU DE BORD
          ================================================================ */}
          {view === 'dashboard' && (
            <DashboardView
              flashcards={flashcards}
              flashcardsARevoirCount={flashcardsARevoir.length}
              lecons={lecons}
              getFlashcardsByNiveau={getFlashcardsByNiveau}
              getProgressPercentage={getProgressPercentage}
              getFlashcardsByLeconCount={getFlashcardsByLeconCount}
              onStartRevision={startRevisionSession}
              onAddFlashcard={() => setView('add')}
              onDeleteFlashcard={handleDeleteFlashcard}
            />
          )}

          {/* ================================================================
               VUE B — SESSION DE RÉVISION
          ================================================================ */}
          {view === 'revision' && !sessionFinished && flashcardsARevoir.length > 0 && (
            <RevisionView
              flashcard={flashcardsARevoir[currentFlashcardIndex]}
              showAnswer={showAnswer}
              currentIndex={currentFlashcardIndex}
              totalCount={flashcardsARevoir.length}
              prochaineRevisionDate={prochaineRevisionDate}
              onShowAnswer={() => setShowAnswer(true)}
              onHideAnswer={() => setShowAnswer(false)}
              onResult={handleRevisionResult}
            />
          )}

          {/* Fin de session de révision */}
          {view === 'revision' && sessionFinished && (
            <div className="bg-white/10 backdrop-blur rounded-xl p-8 text-center">
              <h2 className="text-2xl font-bold text-green-400 mb-6">✅ Session de révision terminée !</h2>
              
              <div className="flex justify-center gap-8 mb-8">
                <div className="text-center">
                  <div className="text-4xl mb-2">🌟</div>
                  <div className="text-xl font-bold text-yellow-400">{revisionStats.facile}</div>
                  <div className="text-gray-400 text-sm">Facile</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">👍</div>
                  <div className="text-xl font-bold text-blue-400">{revisionStats.bien}</div>
                  <div className="text-gray-400 text-sm">Bien</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">😓</div>
                  <div className="text-xl font-bold text-orange-400">{revisionStats.difficile}</div>
                  <div className="text-gray-400 text-sm">Difficile</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">❌</div>
                  <div className="text-xl font-bold text-red-400">{revisionStats.raté}</div>
                  <div className="text-gray-400 text-sm">Raté</div>
                </div>
              </div>

              {getFlashcardsARevoir().length > 0 ? (
                <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg mb-6">
                  Il reste {getFlashcardsARevoir().length} carte(s) à réviser aujourd'hui
                </div>
              ) : (
                <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6">
                  ✅ Toutes les cartes ont été révisées !
                </div>
              )}

              <button
                onClick={resetRevisionSession}
                className="px-6 py-3 bg-[#3730a3] hover:bg-[#4f46e5] text-white rounded-xl transition-colors duration-200 font-medium"
              >
                Retour au tableau de bord
              </button>
            </div>
          )}

          {/* ================================================================
               VUE C — AJOUT MANUEL
          ================================================================ */}
          {view === 'add' && (
            <AddFlashcardView
              newFlashcard={newFlashcard}
              setNewFlashcard={setNewFlashcard}
              lecons={lecons}
              isGeneratingExample={isGeneratingExample}
              isAdding={isAdding}
              onGenerateExample={handleGenerateExample}
              onAdd={handleAddFlashcard}
            />
          )}

          {/* Modal de confirmation de suppression */}
          <Modal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            title="Supprimer la flashcard"
          >
            <div className="space-y-4">
              <p className="text-gray-400">
                Êtes-vous sûr de vouloir supprimer la flashcard <strong className="text-white">{flashcardToDelete?.motAllemand}</strong> ?
                Cette action est irréversible.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDeleteFlashcard}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANTS ENFANTS
// ============================================================================

// --- DashboardView ---
interface DashboardViewProps {
  flashcards: Flashcard[];
  flashcardsARevoirCount: number;
  lecons: Lecon[];
  getFlashcardsByNiveau: () => Record<number, number>;
  getProgressPercentage: () => number;
  getFlashcardsByLeconCount: () => Record<string, number>;
  onStartRevision: () => void;
  onAddFlashcard: () => void;
  onDeleteFlashcard: (flashcard: Flashcard) => void;
}

function DashboardView({
  flashcards,
  flashcardsARevoirCount,
  lecons,
  getFlashcardsByNiveau,
  getProgressPercentage,
  getFlashcardsByLeconCount,
  onStartRevision,
  onAddFlashcard,
  onDeleteFlashcard,
}: DashboardViewProps) {
  const niveauCounts = getFlashcardsByNiveau();
  const progressPercent = getProgressPercentage();
  const flashcardsByLecon = getFlashcardsByLeconCount();

  return (
    <div className="space-y-6">
      {/* Stats principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Cartes à réviser */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/20 rounded-full -translate-y-12 translate-x-12"></div>
          <div className="relative">
            <h3 className="text-gray-400 text-sm mb-2">À réviser aujourd'hui</h3>
            <div className="text-4xl font-bold text-white mb-2">{flashcardsARevoirCount}</div>
            <div className="text-gray-400 text-sm">carte(s)</div>
          </div>
          {flashcardsARevoirCount > 0 && (
            <button
              onClick={onStartRevision}
              className="mt-4 w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              Réviser maintenant
            </button>
          )}
        </div>

        {/* Total cartes */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-2">Total flashcards</h3>
          <div className="text-4xl font-bold text-white mb-2">{flashcards.length}</div>
          <div className="text-gray-400 text-sm">cartes enregistrées</div>
        </div>

        {/* Progression */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-2">Progression globale</h3>
          <div className="text-4xl font-bold text-white mb-2">{progressPercent}%</div>
          <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="text-gray-400 text-sm">{progressPercent}% cartes niveau ≥ 3</div>
        </div>

        {/* Niveau moyen */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-2">Niveau moyen</h3>
          {flashcards.length > 0 ? (
            <>
              <div className="text-4xl font-bold text-white mb-2">
                {Math.round(flashcards.reduce((sum, f) => sum + f.niveau, 0) / flashcards.length * 10) / 10}
              </div>
              <div className="text-gray-400 text-sm">/ 5</div>
            </>
          ) : (
            <div className="text-gray-400 text-2xl">—</div>
          )}
        </div>
      </div>

      {/* Répartition par niveau */}
      <div className="bg-white/10 backdrop-blur rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Répartition par niveau de maîtrise</h3>
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 6 }).map((_, niveau) => (
            <div key={niveau} className="flex items-center gap-3">
              <span className="text-white font-medium">Niveau {niveau}:</span>
              <div className="w-48 bg-gray-600 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500`}
                  style={{
                    width: `${niveauCounts[niveau] || 0}%`,
                    maxWidth: '100%',
                    backgroundColor: getNiveauColor(niveau),
                  }}
                ></div>
              </div>
              <span className="text-gray-400 text-sm w-8 text-right">{niveauCounts[niveau] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cartes par leçon */}
      <div className="bg-white/10 backdrop-blur rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Flashcards par leçon</h3>
        {lecons.length > 0 ? (
          <div className="space-y-3">
            {lecons.map((lecon) => {
              const count = flashcardsByLecon[lecon.id] || 0;
              return count > 0 ? (
                <div
                  key={lecon.id}
                  className="flex justify-between items-center p-3 bg-white/5 rounded-lg"
                >
                  <div>
                    <div className="text-white font-medium">{lecon.titre}</div>
                    <div className="text-gray-400 text-sm">{lecon.type}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white">{count} carte(s)</span>
                    <button
                      onClick={() => {
                        // Filtrer les flashcards de cette leçon
                        const leconFlashcards = flashcards.filter(f => f.leconId === lecon.id);
                        // Pour l'instant, juste un toast
                        alert(`Cette leçon a ${count} flashcards`);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      👁️
                    </button>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        ) : (
          <p className="text-gray-400">Aucune leçon importée</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 pt-6">
        <button
          onClick={onAddFlashcard}
          className="flex-1 sm:flex-none px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors duration-200 font-medium"
        >
          ➕ Ajouter une carte manuellement
        </button>
        {flashcardsARevoirCount > 0 && (
          <button
            onClick={onStartRevision}
            className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors duration-200 font-medium"
          >
            📖 Réviser les {flashcardsARevoirCount} cartes du jour
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="flex-1 sm:flex-none px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors duration-200 font-medium"
        >
          🔄 Actualiser
        </button>
      </div>
    </div>
  );
}

// --- RevisionView ---
interface RevisionViewProps {
  flashcard: Flashcard;
  showAnswer: boolean;
  currentIndex: number;
  totalCount: number;
  prochaineRevisionDate: string;
  onShowAnswer: () => void;
  onHideAnswer: () => void;
  onResult: (resultat: ResultatRevision) => void;
}

function RevisionView({
  flashcard,
  showAnswer,
  currentIndex,
  totalCount,
  prochaineRevisionDate,
  onShowAnswer,
  onHideAnswer,
  onResult,
}: RevisionViewProps) {
  const [animationClass, setAnimationClass] = useState('');

  const handleCardClick = () => {
    if (!showAnswer) {
      setAnimationClass('animate-flip');
      setTimeout(() => {
        onShowAnswer();
        setAnimationClass('');
      }, 300);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Barre de progression */}
      <div className="mb-6">
        <div className="flex justify-between text-gray-400 mb-2">
          <span>Carte {currentIndex + 1} / {totalCount}</span>
          <span>{Math.round(((currentIndex + 1) / totalCount) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2">
          <div
            className="bg-[#4f46e5] h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Carte de révision */}
      <div
        className={`bg-white/10 backdrop-blur rounded-2xl p-8 mb-8 cursor-pointer perspective-1000 ${animationClass}`}
        onClick={handleCardClick}
      >
        <div className="preserve-3d">
          {/* Recto (toujours visible) */}
          <div className={`backface-hidden ${showAnswer ? 'rotate-y-180' : ''} transition-transform duration-500`}>
            <div className="text-center">
              {flashcard.article && (
                <div className="text-blue-400 text-2xl mb-4 font-bold">{flashcard.article}</div>
              )}
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 break-words">
                {flashcard.motAllemand}
              </h2>
              <p className="text-gray-400 italic">Cliquez pour voir la réponse</p>
            </div>
          </div>

          {/* Verso */}
          <div className={`absolute top-0 left-0 w-full h-full bg-white/10 backdrop-blur rounded-2xl p-8 ${showAnswer ? '' : 'rotate-y-180'} transition-transform duration-500`}>
            <div className="text-center">
              {flashcard.article && (
                <div className="text-blue-400 text-xl mb-2 font-bold">{flashcard.article} {flashcard.motAllemand}</div>
              )}
              <h3 className="text-2xl font-bold text-green-400 mb-4">
                {flashcard.traductionFrancais}
              </h3>
              
              {flashcard.exemple && (
                <div className="mt-6 space-y-2">
                  <p className="text-gray-300 italic">"{flashcard.exemple}"</p>
                  {flashcard.traductionExemple && (
                    <p className="text-gray-400 text-sm">{flashcard.traductionExemple}</p>
                  )}
                </div>
              )}
              
              <div className="mt-6 text-sm text-gray-400">
                Niveau: {flashcard.niveau}/5 | Leçon: {flashcard.leconTitre}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons de réponse (affichés après avoir vu la réponse) */}
      {showAnswer && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => onResult('raté')}
            className="py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors duration-200 text-lg font-medium flex items-center justify-center gap-2"
          >
            <span>❌</span> Raté
          </button>
          <button
            onClick={() => onResult('difficile')}
            className="py-4 px-6 bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors duration-200 text-lg font-medium flex items-center justify-center gap-2"
          >
            <span>😓</span> Difficile
          </button>
          <button
            onClick={() => onResult('bien')}
            className="py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors duration-200 text-lg font-medium flex items-center justify-center gap-2"
          >
            <span>👍</span> Bien
          </button>
          <button
            onClick={() => onResult('facile')}
            className="py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors duration-200 text-lg font-medium flex items-center justify-center gap-2"
          >
            <span>🌟</span> Facile
          </button>
        </div>
      )}

      {/* Info prochaine révision */}
      {prochaineRevisionDate && showAnswer && (
        <div className="mt-6 text-center text-gray-400">
          <p>Prochaine révision : <span className="text-white">{prochaineRevisionDate}</span></p>
        </div>
      )}
    </div>
  );
}

// --- AddFlashcardView ---
interface AddFlashcardViewProps {
  newFlashcard: {
    motAllemand?: string;
    article?: string;
    traductionFrancais?: string;
    exemple?: string;
    traductionExemple?: string;
    leconId?: string;
    leconTitre?: string;
    niveau?: number;
  };
  setNewFlashcard: (value: any) => void;
  lecons: Lecon[];
  isGeneratingExample: boolean;
  isAdding: boolean;
  onGenerateExample: () => void;
  onAdd: () => void;
}

function AddFlashcardView({
  newFlashcard,
  setNewFlashcard,
  lecons,
  isGeneratingExample,
  isAdding,
  onGenerateExample,
  onAdd,
}: AddFlashcardViewProps) {
  return (
    <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur rounded-xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6">➕ Ajouter une flashcard</h2>

      <form onSubmit={(e) => { e.preventDefault(); onAdd(); }} className="space-y-6">
        {/* Mot allemand */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Mot en allemand <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={newFlashcard.motAllemand}
            onChange={(e) => setNewFlashcard({ ...newFlashcard, motAllemand: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: die Küche"
            required
          />
        </div>

        {/* Article */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Article (der/die/das) - optionnel
          </label>
          <select
            value={newFlashcard.article || ''}
            onChange={(e) => setNewFlashcard({ ...newFlashcard, article: e.target.value || undefined })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Aucun (verbe, adjectif, etc.)</option>
            <option value="der">der</option>
            <option value="die">die</option>
            <option value="das">das</option>
          </select>
        </div>

        {/* Traduction française */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Traduction en français <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={newFlashcard.traductionFrancais}
            onChange={(e) => setNewFlashcard({ ...newFlashcard, traductionFrancais: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: la cuisine"
            required
          />
        </div>

        {/* Exemple */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Exemple en allemand - optionnel
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFlashcard.exemple || ''}
              onChange={(e) => setNewFlashcard({ ...newFlashcard, exemple: e.target.value })}
              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Die Küche ist sehr groß."
            />
            <button
              type="button"
              onClick={onGenerateExample}
              disabled={isGeneratingExample || !newFlashcard.motAllemand}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors duration-200"
            >
              {isGeneratingExample ? (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block"></span>
              ) : (
                '🎲 Générer'
              )}
            </button>
          </div>
        </div>

        {/* Traduction exemple */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Traduction de l'exemple - optionnel
          </label>
          <input
            type="text"
            value={newFlashcard.traductionExemple || ''}
            onChange={(e) => setNewFlashcard({ ...newFlashcard, traductionExemple: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: La cuisine est très grande."
          />
        </div>

        {/* Leçon associée */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Leçon associée - optionnel
          </label>
          <select
            value={newFlashcard.leconId || ''}
            onChange={(e) => {
              const selectedLecon = lecons.find(l => l.id === e.target.value);
              setNewFlashcard({
                ...newFlashcard,
                leconId: e.target.value,
                leconTitre: selectedLecon?.titre || '',
              });
            }}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Aucune leçon (autre)</option>
            {lecons.map((lecon) => (
              <option key={lecon.id} value={lecon.id}>
                {lecon.titre} ({lecon.type})
              </option>
            ))}
          </select>
        </div>

        {/* Boutons */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => setNewFlashcard({
              motAllemand: '',
              article: '',
              traductionFrancais: '',
              exemple: '',
              traductionExemple: '',
              leconId: '',
              leconTitre: '',
            })}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors duration-200"
          >
            Effacer
          </button>
          <button
            type="submit"
            disabled={isAdding || !newFlashcard.motAllemand || !newFlashcard.traductionFrancais}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl transition-colors duration-200 font-medium"
          >
            {isAdding ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Ajout en cours...
              </span>
            ) : (
              '✅ Ajouter la flashcard'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// UTILITAIRES
// ============================================================================

function getNiveauColor(niveau: number): string {
  const colors = [
    '#ef4444', // rouge - niveau 0
    '#f97316', // orange - niveau 1
    '#f59e0b', // ambre - niveau 2
    '#10b981', // vert - niveau 3
    '#3b82f6', // bleu - niveau 4
    '#8b5cf6', // violet - niveau 5
  ];
  return colors[niveau] || '#6b7280';
}
