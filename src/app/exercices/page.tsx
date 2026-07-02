'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllLecons,
  getProgression,
  addExercice,
  type Lecon,
  type ExerciceType,
  type NiveauCECRL,
} from '@/lib/storage';

// ============================================================================
// TYPES
// ============================================================================

/** Type pour un exercice généré par Mistral */
interface GeneratedExercise {
  type: ExerciceType;
  question: string;
  choices?: string[]; // Pour QCM
  textWithBlanks?: string; // Pour texte à trous
  correctAnswer: string | string[]; // Réponse attendue
  explanation?: string;
}

/** Type pour la réponse de Mistral (génération) */
interface MistralExerciseResponse {
  exercise: GeneratedExercise;
  difficulty?: NiveauCECRL;
}

/** Type pour la correction de Mistral */
interface MistralCorrectionResponse {
  score: number; // 0-100
  isCorrect: boolean;
  correction: string; // Explication pédagogique
  expectedAnswer: string | string[];
  userAnswer: string | string[];
}

/** Étapes du flux */
type ExerciseStep = 'select' | 'generating' | 'answering' | 'correcting' | 'saved';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ExercicesPage() {
  // État pour les leçons disponibles
  const [lecons, setLecons] = useState<Lecon[]>([]);
  const [selectedLecon, setSelectedLecon] = useState<Lecon | null>(null);
  const [selectedType, setSelectedType] = useState<ExerciceType>('qcm');
  
  // État pour le flux d'exercice
  const [step, setStep] = useState<ExerciseStep>('select');
  const [generatedExercise, setGeneratedExercise] = useState<GeneratedExercise | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [correction, setCorrection] = useState<MistralCorrectionResponse | null>(null);
  const [niveauCECRL, setNiveauCECRL] = useState<NiveauCECRL>('A1');
  
  // État UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les leçons et la progression au montage
  useEffect(() => {
    const allLecons = getAllLecons();
    setLecons(allLecons);
    
    const progression = getProgression();
    setNiveauCECRL(progression.niveauEstimeCECRL);
  }, []);

  // ==========================================================================
  // GÉNÉRATION D'EXERCICE
  // ==========================================================================

  /**
   * Génère un prompt pour Mistral selon le type d'exercice
   */
  const buildExercisePrompt = useCallback((lecon: Lecon, type: ExerciceType): string => {
    const content = lecon.contenuTexte;
    const title = lecon.titre;
    const notions = lecon.notionsCles.join(', ');
    
    const basePrompt = `Tu es un professeur d'allemand. Crée un exercice basé sur le contenu suivant :

---
Titre: ${title}
Notions: ${notions}
Contenu: ${content}
---

Niveau de l'élève: ${niveauCECRL}
`;

    if (type === 'qcm') {
      return `${basePrompt}
Crée un QCM (Question à Choix Multiples) avec :
- 1 question claire en allemand
- 4 choix de réponse (1 correcte, 3 incorrectes mais plausibles)
- Le sujet porte sur les notions ou le contenu ci-dessus
- Niveau adapté: ${niveauCECRL}

Réponds avec un JSON contenant :
{
  "exercise": {
    "type": "qcm",
    "question": "[question en allemand]",
    "choices": ["choix 1", "choix 2", "choix 3", "choix 4"],
    "correctAnswer": "[index ou texte de la réponse correcte]",
    "explanation": "[explication en français]"
  }
}`;
    }
    
    if (type === 'texteATrous') {
      return `${basePrompt}
Crée un exercice de texte à trous basé sur le contenu ci-dessus.
- Prends une phrase ou un court paragraphe du texte
- Remplace 1 à 3 mots par des trous (_____)
- Le niveau doit correspondre à ${niveauCECRL}
- Les trous doivent porter sur des notions importantes

Réponds avec un JSON contenant :
{
  "exercise": {
    "type": "texteATrous",
    "question": "[consigne en français]",
    "textWithBlanks": "[texte avec des _____ pour les trous]",
    "correctAnswer": ["mot1", "mot2", ...],
    "explanation": "[explication en français]"
  }
}`;
    }
    
    // Pour les autres types (traduction, production)
    return `${basePrompt}
Crée un exercice de type ${type}.
Réponds avec un JSON valide contenant les champs appropriés.`;
  }, [niveauCECRL]);

  /**
   * Génère un exercice via l'API Mistral
   */
  const generateExercise = useCallback(async () => {
    if (!selectedLecon) return;

    setIsLoading(true);
    setError(null);
    setStep('generating');

    try {
      const prompt = buildExercisePrompt(selectedLecon, selectedType);

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
        throw new Error(errorData.error || 'Erreur lors de la génération');
      }

      const data: MistralExerciseResponse = await response.json();
      
      // Valider la réponse
      if (!data.exercise) {
        throw new Error('Réponse Mistral invalide : exercice manquant');
      }

      setGeneratedExercise(data.exercise);
      setStep('answering');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer l'exercice : ${errorMessage}`);
      setStep('select');
      setIsLoading(false);
    }
  }, [selectedLecon, selectedType, buildExercisePrompt]);

  // ==========================================================================
  // CORRECTION
  // ==========================================================================

  /**
   * Construit le prompt de correction pour Mistral
   */
  const buildCorrectionPrompt = useCallback((exercise: GeneratedExercise, userAnswer: string): string => {
    if (exercise.type === 'qcm') {
      const correctIndex = typeof exercise.correctAnswer === 'number' 
        ? exercise.correctAnswer 
        : exercise.choices?.findIndex(c => c === exercise.correctAnswer) ?? 0;
      const correctChoice = exercise.choices?.[correctIndex] || exercise.correctAnswer;
      
      return `Tu es un professeur d'allemand. Corrige cette réponse d'élève :

Question: ${exercise.question}
Choix: ${exercise.choices?.join(', ')}
Réponse de l'élève: ${userAnswer}
Réponse correcte: ${correctChoice}

Donne :
- Un score sur 100
- Une explication pédagogique en français
- Indique si la réponse est correcte

Réponds avec un JSON :
{
  "score": [0-100],
  "isCorrect": [true/false],
  "correction": "[explication détaillée]",
  "expectedAnswer": "[réponse attendue]",
  "userAnswer": "${userAnswer}"
}`;
    }
    
    if (exercise.type === 'texteATrous') {
      const expectedAnswers = Array.isArray(exercise.correctAnswer) 
        ? exercise.correctAnswer 
        : [exercise.correctAnswer];
      
      return `Tu es un professeur d'allemand. Corrige cet exercice de texte à trous :

Texte avec trous: ${exercise.textWithBlanks}
Réponse de l'élève: ${userAnswer}
Réponses attendues: ${expectedAnswers.join(', ')}

Donne :
- Un score sur 100 (100 si tout est correct, proportionnel sinon)
- Une explication pédagogique en français
- Indique si la réponse est correcte

Réponds avec un JSON :
{
  "score": [0-100],
  "isCorrect": [true/false],
  "correction": "[explication détaillée]",
  "expectedAnswer": ${JSON.stringify(expectedAnswers)},
  "userAnswer": "${userAnswer}"
}`;
    }
    
    return `Corrige cet exercice. Réponds avec un JSON contenant score (0-100), isCorrect, correction, expectedAnswer, userAnswer.`;
  }, []);

  /**
   * Corrige l'exercice via l'API Mistral
   */
  const correctExercise = useCallback(async () => {
    if (!generatedExercise || !userAnswer.trim()) return;

    setIsLoading(true);
    setError(null);
    setStep('correcting');

    try {
      const prompt = buildCorrectionPrompt(generatedExercise, userAnswer);

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
        throw new Error(errorData.error || 'Erreur lors de la correction');
      }

      const data: MistralCorrectionResponse = await response.json();
      
      // Valider la réponse
      if (typeof data.score !== 'number' || data.score < 0 || data.score > 100) {
        throw new Error('Score invalide');
      }

      setCorrection(data);
      setStep('saved');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger l'exercice : ${errorMessage}`);
      setStep('answering');
      setIsLoading(false);
    }
  }, [generatedExercise, userAnswer, buildCorrectionPrompt]);

  // ==========================================================================
  // SAUVEGARDE
  // ==========================================================================

  /**
   * Sauvegarde l'exercice et son résultat
   */
  const saveExercise = useCallback(() => {
    if (!generatedExercise || !correction || !selectedLecon) return;

    try {
      // Préparer le contenu JSON de l'exercice
      const contenuJSON: Record<string, unknown> = {
        type: generatedExercise.type,
        question: generatedExercise.question,
        ...(generatedExercise.choices && { choices: generatedExercise.choices }),
        ...(generatedExercise.textWithBlanks && { textWithBlanks: generatedExercise.textWithBlanks }),
        correctAnswer: generatedExercise.correctAnswer,
      };

      // Sauvegarder via storage
      const newExercice = addExercice({
        type: generatedExercise.type,
        leconsAssociees: [selectedLecon.id],
        contenuJSON,
        reponseUtilisateur: userAnswer,
        correction: correction.correction,
        score: correction.score,
        // dateRealisation sera ajoutée automatiquement
      });

      // L'exercice est sauvegardé
      return newExercice;
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(`Impossible de sauvegarder l'exercice : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      return null;
    }
  }, [generatedExercise, correction, userAnswer, selectedLecon]);

  // ==========================================================================
  // RENDU
  // ==========================================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Exercices</h1>
          <p className="text-gray-600 mt-2">
            Générez et corrigez des exercices à partir de vos leçons
          </p>
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
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
             ÉTAPE 1 : SÉLECTION
           ====================================================================== */}
        {step === 'select' && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-700">
              Générer un exercice
            </h2>

            {/* Sélection de la leçon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner une leçon
              </label>
              {lecons.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Aucune leçon disponible. Importez d'abord un PDF via 
                  <a href="/lecons/import" className="text-blue-600 hover:underline">/lecons/import</a>
                </p>
              ) : (
                <select
                  value={selectedLecon?.id || ''}
                  onChange={(e) => {
                    const leconId = e.target.value;
                    const lecon = lecons.find(l => l.id === leconId);
                    setSelectedLecon(lecon || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Choix d'une leçon --</option>
                  {lecons.map(lecon => (
                    <option key={lecon.id} value={lecon.id}>
                      {lecon.titre} ({lecon.type}) - {lecon.contenuTexte.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sélection du type d'exercice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'exercice
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as ExerciceType)}
                disabled={!selectedLecon}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="qcm">QCM (Question à choix multiples)</option>
                <option value="texteATrous">Texte à trous</option>
              </select>
            </div>

            {/* Niveau CECRL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Niveau estimé
              </label>
              <select
                value={niveauCECRL}
                onChange={(e) => setNiveauCECRL(e.target.value as NiveauCECRL)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="A1">A1 - Débutant</option>
                <option value="A2">A2 - Élémentaire</option>
                <option value="B1">B1 - Intermédiaire</option>
                <option value="B2">B2 - Intermédiaire avancé</option>
                <option value="C1">C1 - Autonome</option>
                <option value="C2">C2 - Maîtrise</option>
              </select>
            </div>

            {/* Bouton de génération */}
            <button
              onClick={generateExercise}
              disabled={!selectedLecon || isLoading}
              className={`w-full px-6 py-3 rounded-md text-white font-medium 
                ${selectedLecon && !isLoading 
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' 
                  : 'bg-blue-300 cursor-not-allowed'}
                transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Génération en cours...
                </>
              ) : (
                'Générer un exercice'
              )}
            </button>
          </div>
        )}

        {/* ======================================================================
             ÉTAPE 2 : GÉNÉRATION
           ====================================================================== */}
        {step === 'generating' && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Génération de l'exercice
            </h2>
            <p className="text-gray-600">
              Mistral génère un exercice personnalisé à partir de votre leçon...
            </p>
          </div>
        )}

        {/* ======================================================================
             ÉTAPE 3 : RÉPONSE
           ====================================================================== */}
        {step === 'answering' && generatedExercise && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* En-tête de l'exercice */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-700">
                {generatedExercise.type === 'qcm' ? 'QCM' : 'Texte à trous'}
              </h2>
              <span className="text-sm text-gray-500">
                Niveau: {niveauCECRL}
              </span>
            </div>

            {/* Affichage de l'exercice */}
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-gray-700 mb-4">{generatedExercise.question}</p>
              
              {generatedExercise.type === 'qcm' && generatedExercise.choices && (
                <div className="space-y-3">
                  {generatedExercise.choices.map((choice, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-3 p-3 bg-white rounded-md border border-gray-200 cursor-pointer hover:border-blue-300"
                    >
                      <input
                        type="radio"
                        name="qcm-answer"
                        value={choice}
                        checked={userAnswer === choice}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{choice}</span>
                    </label>
                  ))}
                </div>
              )}

              {generatedExercise.type === 'texteATrous' && generatedExercise.textWithBlanks && (
                <div>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {generatedExercise.textWithBlanks}
                  </p>
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Votre réponse (séparer par des virgules si plusieurs mots)"
                    className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={correctExercise}
                disabled={!userAnswer.trim() || isLoading}
                className={`px-6 py-2 rounded-md text-white font-medium flex-1 
                  ${userAnswer.trim() && !isLoading 
                    ? 'bg-green-600 hover:bg-green-700 cursor-pointer' 
                    : 'bg-green-300 cursor-not-allowed'}
                  transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Correction en cours...
                  </>
                ) : (
                  'Valider ma réponse'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================================
             ÉTAPE 4 : CORRECTION + SAUVEGARDE
           ====================================================================== */}
        {(step === 'correcting' || step === 'saved') && correction && generatedExercise && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* Résultat */}
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                {correction.isCorrect ? (
                  <span className="text-green-600">✓ Bravo !</span>
                ) : (
                  <span className="text-red-600">✗ Presque...</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-4">
                <span className={correction.score >= 80 ? 'text-green-600' : correction.score >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {correction.score}/100
                </span>
              </div>
            </div>

            {/* Exercice et réponse */}
            <div className="bg-gray-50 p-4 rounded-md space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Question</h3>
                <p className="text-gray-600">{generatedExercise.question}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">Votre réponse</h3>
                <p className="text-gray-600">{userAnswer}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">Réponse attendue</h3>
                <p className="text-green-700">
                  {Array.isArray(correction.expectedAnswer) 
                    ? correction.expectedAnswer.join(', ') 
                    : correction.expectedAnswer}
                </p>
              </div>
            </div>

            {/* Correction détaillée */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="font-medium text-blue-800 mb-2">Explication</h3>
              <p className="text-blue-700 whitespace-pre-wrap">{correction.correction}</p>
            </div>

            {/* Sauvegarde */}
            {step === 'correcting' && (
              <button
                onClick={() => {
                  saveExercise();
                  setStep('saved');
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Sauvegarder cet exercice
              </button>
            )}

            {step === 'saved' && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-md text-center">
                <p className="text-green-700">
                  ✓ Exercice sauvegardé dans votre historique
                </p>
                <button
                  onClick={() => {
                    setStep('select');
                    setGeneratedExercise(null);
                    setUserAnswer('');
                    setCorrection(null);
                  }}
                  className="mt-3 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Faire un autre exercice
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
