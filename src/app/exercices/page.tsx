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
import { mettreAJourProgression } from '@/lib/progression';
import { predefinedThemes } from '@/lib/themes';

// ============================================================================
// TYPES
// ============================================================================

/** Type pour une question QCM */
interface QCMPQuestion {
  question: string;
  choix: string[]; // 4 choix
  bonneReponse: number; // index de la bonne réponse (0-3)
  explication: string;
}

/** Type pour un exercice QCM généré (20 questions) */
interface GeneratedQCMExercise {
  type: 'qcm';
  questions: QCMPQuestion[];
}

/** Type pour un exercice texte à trous généré */
interface GeneratedTextExercise {
  type: 'texteATrous';
  question: string;
  textWithBlanks: string;
  correctAnswer: string[]; // Tableau des réponses attendues
  explanation: string;
}

/** Type pour l'exercice généré (union) */
type GeneratedExercise = GeneratedQCMExercise | GeneratedTextExercise;

/** Type pour la réponse de Mistral (génération) */
interface MistralExerciseResponse {
  questions?: QCMPQuestion[]; // Pour QCM (20 questions)
  exercise?: GeneratedTextExercise; // Pour texte à trous
}

/** Type pour une réponse utilisateur à une question QCM */
interface UserQCMAnswer {
  [questionIndex: number]: number | null; // index du choix sélectionné
}

/** Type pour la correction complète */
interface ExerciseCorrection {
  totalScore: number; // Score global sur 100 (ou sur 20 pour QCM)
  totalQuestions: number;
  correctCount: number;
  corrections: Array<{
    questionIndex: number;
    isCorrect: boolean;
    userAnswer: string | null;
    correctAnswer: string;
    explanation: string;
  }>;
}

/** Type de source pour le thème */
type ThemeSource = 'cours' | 'libre';

/** Étapes du flux */
type ExerciseStep = 'select' | 'generating' | 'answering' | 'correcting' | 'saved';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ExercicesPage() {
  // État pour les leçons disponibles
  const [lecons, setLecons] = useState<Lecon[]>([]);
  
  // État pour le sélecteur de thème
  const [themeSource, setThemeSource] = useState<ThemeSource>('cours');
  const [selectedLecon, setSelectedLecon] = useState<Lecon | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>('Voyage');
  const [customTheme, setCustomTheme] = useState<string>('');
  
  const [selectedType, setSelectedType] = useState<ExerciceType>('qcm');
  const [niveauCECRL, setNiveauCECRL] = useState<NiveauCECRL>('A1');
  
  // État pour le flux d'exercice
  const [step, setStep] = useState<ExerciseStep>('select');
  const [generatedExercise, setGeneratedExercise] = useState<GeneratedExercise | null>(null);
  
  // Pour QCM : réponses de l'utilisateur par index de question
  const [qcmAnswers, setQcmAnswers] = useState<UserQCMAnswer>({});
  // Pour texte à trous : réponse unique
  const [textAnswer, setTextAnswer] = useState<string>('');
  
  const [correction, setCorrection] = useState<ExerciseCorrection | null>(null);
  
  // État UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les leçons et la progression au montage
  useEffect(() => {
    const allLecons = getAllLecons();
    setLecons(allLecons);
    
    const progression = getProgression();
    setNiveauCECRL(progression.niveauEstimeCECRL);
    
    // Sélectionner une leçon aléatoire pour le mode 'cours'
    if (allLecons.length > 0) {
      const randomIndex = Math.floor(Math.random() * allLecons.length);
      setSelectedLecon(allLecons[randomIndex]);
    }
  }, []);

  // ==========================================================================
  // SÉLECTEUR DE THÈME
  // ==========================================================================

  /**
   * Sélectionne une leçon aléatoire
   */
  const selectRandomLecon = useCallback(() => {
    if (lecons.length === 0) {
      setError('Aucune leçon disponible. Importez d\'abord un PDF via /lecons/import');
      return null;
    }
    const randomIndex = Math.floor(Math.random() * lecons.length);
    return lecons[randomIndex];
  }, [lecons]);

  /**
   * Récupère le contexte/thème actuel
   */
  const getCurrentContext = useCallback((): { type: 'lecon' | 'theme'; value: string; title: string } => {
    if (themeSource === 'cours' && selectedLecon) {
      return {
        type: 'lecon',
        value: selectedLecon.contenuTexte,
        title: `Basé sur : ${selectedLecon.titre}`,
      };
    } else {
      const finalTheme = customTheme.trim() || selectedTheme;
      return {
        type: 'theme',
        value: finalTheme,
        title: `Thème : ${finalTheme}`,
      };
    }
  }, [themeSource, selectedLecon, selectedTheme, customTheme]);

  // ==========================================================================
  // GÉNÉRATION D'EXERCICE
  // ==========================================================================

  /**
   * Génère un prompt pour Mistral selon le type d'exercice
   */
  const buildExercisePrompt = useCallback((type: ExerciceType): string => {
    const context = getCurrentContext();
    const content = context.type === 'lecon' ? context.value : context.value;
    const title = context.title;

    const basePrompt = `Tu es un professeur d'allemand. Crée un exercice basé sur le contenu suivant :

---
Titre: ${title}
Contenu: ${content.substring(0, 1000)}
Niveau de l'élève: ${niveauCECRL}
---

`;

    if (type === 'qcm') {
      return `${basePrompt}
Crée UN SEUL message JSON contenant EXACTEMENT 20 questions QCM (Question à Choix Multiples).

Chaque question doit avoir :
- Une question claire en allemand
- 4 choix de réponse (1 correcte, 3 incorrectes mais plausibles)
- La bonne réponse indiquée par son INDEX (0, 1, 2 ou 3)
- Une explication pédagogique en français

Réponds avec UN SEUL objet JSON contenant UN tableau "questions" avec EXACTEMENT 20 éléments :
{
  "questions": [
    {
      "question": "[question en allemand]",
      "choix": ["choix A", "choix B", "choix C", "choix D"],
      "bonneReponse": 0,
      "explication": "[explication en français]"
    },
    ... (19 autres questions)
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire. Le tableau doit contenir EXACTEMENT 20 questions.`;
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
    
    // Pour les autres types
    return `${basePrompt}
Crée un exercice de type ${type}. Réponds avec un JSON valide.`;
  }, [getCurrentContext, niveauCECRL]);

  /**
   * Génère un exercice via l'API Mistral
   */
  const generateExercise = useCallback(async () => {
    if ((themeSource === 'cours' && !selectedLecon) || (themeSource === 'libre' && !selectedTheme && !customTheme)) {
      setError('Veuillez sélectionner une leçon ou un thème');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('generating');

    try {
      const prompt = buildExercisePrompt(selectedType);

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

      const data = await response.json();
      
      // Parser selon le type
      let exercise: GeneratedExercise;
      
      if (selectedType === 'qcm') {
        // Attendre un tableau de questions
        if (!data.questions || !Array.isArray(data.questions) || data.questions.length !== 20) {
          throw new Error(`Réponse Mistral invalide : attendu 20 questions, reçu ${data.questions?.length || 0}`);
        }
        
        // Valider chaque question
        const validQuestions = data.questions.map((q: any, index: number) => {
          if (!q.question || !q.choix || !Array.isArray(q.choix) || q.choix.length !== 4 || 
              q.bonneReponse === undefined || q.bonneReponse === null) {
            throw new Error(`Question ${index + 1} invalide`);
          }
          return {
            question: String(q.question),
            choix: q.choix.map((c: any) => String(c)),
            bonneReponse: Number(q.bonneReponse),
            explication: String(q.explication || ''),
          };
        });
        
        exercise = {
          type: 'qcm',
          questions: validQuestions,
        };
      } else {
        // Texte à trous ou autre
        if (!data.exercise) {
          throw new Error('Réponse Mistral invalide : exercice manquant');
        }
        
        exercise = {
          type: selectedType,
          question: data.exercise.question,
          textWithBlanks: data.exercise.textWithBlanks,
          correctAnswer: Array.isArray(data.exercise.correctAnswer) 
            ? data.exercise.correctAnswer.map(String) 
            : [String(data.exercise.correctAnswer)],
          explanation: data.exercise.explanation || '',
        };
      }

      setGeneratedExercise(exercise);
      setStep('answering');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer l'exercice : ${errorMessage}`);
      setStep('select');
      setIsLoading(false);
    }
  }, [selectedType, buildExercisePrompt, themeSource, selectedLecon, selectedTheme, customTheme]);

  // ==========================================================================
  // CORRECTION
  // ==========================================================================

  /**
   * Corrige un exercice QCM
   */
  const correctQCMExercise = useCallback(() => {
    if (!generatedExercise || generatedExercise.type !== 'qcm') return null;

    const questions = generatedExercise.questions;
    let correctCount = 0;
    const corrections: ExerciseCorrection['corrections'] = [];

    for (let i = 0; i < questions.length; i++) {
      const userAnswerIndex = qcmAnswers[i];
      const isCorrect = userAnswerIndex === questions[i].bonneReponse;
      
      if (isCorrect) {
        correctCount++;
      }

      corrections.push({
        questionIndex: i,
        isCorrect,
        userAnswer: userAnswerIndex !== null && userAnswerIndex !== undefined 
          ? questions[i].choix[userAnswerIndex] 
          : null,
        correctAnswer: questions[i].choix[questions[i].bonneReponse],
        explanation: questions[i].explication,
      });
    }

    // Score sur 100
    const totalScore = Math.round((correctCount / questions.length) * 100);

    return {
      totalScore,
      totalQuestions: questions.length,
      correctCount,
      corrections,
    };
  }, [generatedExercise, qcmAnswers]);

  /**
   * Corrige un exercice texte à trous
   */
  const correctTextExercise = useCallback(() => {
    if (!generatedExercise || generatedExercise.type !== 'texteATrous') return null;

    const userAnswers = textAnswer.split(',').map(a => a.trim().toLowerCase());
    const correctAnswers = generatedExercise.correctAnswer.map(a => a.toLowerCase());
    
    let correctCount = 0;
    const corrections: ExerciseCorrection['corrections'] = [];

    for (let i = 0; i < Math.max(userAnswers.length, correctAnswers.length); i++) {
      const userAnswer = userAnswers[i] || '';
      const correctAnswer = correctAnswers[i] || '';
      const isCorrect = userAnswer === correctAnswer;
      
      if (isCorrect) {
        correctCount++;
      }

      corrections.push({
        questionIndex: i,
        isCorrect,
        userAnswer: userAnswer || null,
        correctAnswer: correctAnswer,
        explanation: generatedExercise.explanation,
      });
    }

    const totalScore = Math.round((correctCount / Math.max(correctAnswers.length, 1)) * 100);

    return {
      totalScore,
      totalQuestions: correctAnswers.length,
      correctCount,
      corrections,
    };
  }, [generatedExercise, textAnswer]);

  /**
   * Corrige l'exercice (appel à Mistral pour la correction détaillée)
   * Pour QCM, on fait la correction locale car c'est déterministe
   */
  const correctExercise = useCallback(async () => {
    if (!generatedExercise) return;

    setIsLoading(true);
    setError(null);
    setStep('correcting');

    try {
      let correctionResult: ExerciseCorrection | null = null;

      if (generatedExercise.type === 'qcm') {
        // Correction locale pour QCM (déterministe)
        correctionResult = correctQCMExercise();
      } else {
        // Pour texte à trous, on pourrait aussi faire de la correction locale
        // Mais on garde l'appel à Mistral pour une explication pédagogique
        correctionResult = correctTextExercise();
      }

      if (!correctionResult) {
        throw new Error('Impossible de corriger l\'exercice');
      }

      setCorrection(correctionResult);
      setStep('saved');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger l'exercice : ${errorMessage}`);
      setStep('answering');
      setIsLoading(false);
    }
  }, [generatedExercise, correctQCMExercise, correctTextExercise]);

  // ==========================================================================
  // SAUVEGARDE
  // ==========================================================================

  /**
   * Sauvegarde l'exercice et son résultat
   */
  const saveExercise = useCallback(() => {
    if (!generatedExercise || !correction || !selectedLecon) return null;

    try {
      let contenuJSON: Record<string, unknown>;
      let score: number;

      if (generatedExercise.type === 'qcm') {
        // Pour QCM, sauvegarder le tableau de questions et le score global
        score = correction.totalScore;
        contenuJSON = {
          type: 'qcm',
          totalQuestions: correction.totalQuestions,
          correctCount: correction.correctCount,
          questions: generatedExercise.questions.map(q => ({
            question: q.question,
            choix: q.choix,
            bonneReponse: q.bonneReponse,
          })),
        };
      } else {
        // Pour texte à trous
        score = correction.totalScore;
        contenuJSON = {
          type: 'texteATrous',
          question: generatedExercise.question,
          textWithBlanks: generatedExercise.textWithBlanks,
          correctAnswer: generatedExercise.correctAnswer,
        };
      }

      // Sauvegarder via storage
      const newExercice = addExercice({
        type: generatedExercise.type,
        leconsAssociees: themeSource === 'cours' && selectedLecon ? [selectedLecon.id] : [],
        contenuJSON,
        reponseUtilisateur: generatedExercise.type === 'qcm' 
          ? JSON.stringify(qcmAnswers) 
          : textAnswer,
        correction: `Score: ${score}/100 - ${correction.correctCount}/${correction.totalQuestions} bonnes réponses`,
        score,
      });

      // Mettre à jour la progression globale
      mettreAJourProgression();

      return newExercice;
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(`Impossible de sauvegarder l'exercice : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      return null;
    }
  }, [generatedExercise, correction, selectedLecon, qcmAnswers, textAnswer, themeSource]);

  // ==========================================================================
  // RENDU
  // ==========================================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif text-[#1e1b4b]">Exercices</h1>
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
             ÉTAPE 1 : SÉLECTION + SÉLECTEUR DE THÈME
           ====================================================================== */}
        {step === 'select' && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Sélectionnez votre source de contenu
            </h2>

            {/* Options de source */}
            <div className="flex gap-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="themeSource"
                  value="cours"
                  checked={themeSource === 'cours'}
                  onChange={(e) => {
                    setThemeSource(e.target.value as ThemeSource);
                    const lecon = selectRandomLecon();
                    if (lecon) setSelectedLecon(lecon);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Option A — Basé sur mes cours</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="themeSource"
                  value="libre"
                  checked={themeSource === 'libre'}
                  onChange={(e) => setThemeSource(e.target.value as ThemeSource)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Option B — Choisir un thème libre</span>
              </label>
            </div>

            {/* Option A : Basé sur mes cours */}
            {themeSource === 'cours' && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-800">Leçon sélectionnée</h3>
                  <button
                    onClick={() => {
                      const lecon = selectRandomLecon();
                      if (lecon) setSelectedLecon(lecon);
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
                  >
                    🔄 Choisir aléatoirement
                  </button>
                </div>
                
                {selectedLecon ? (
                  <div className="space-y-2">
                    <p className="font-medium text-gray-700">
                      {selectedLecon.titre} <span className="text-sm text-gray-500">({selectedLecon.type})</span>
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {selectedLecon.contenuTexte}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    Aucune leçon disponible. Importez un PDF via <a href="/lecons/import" className="text-blue-600 hover:underline">/lecons/import</a>
                  </p>
                )}
              </div>
            )}

            {/* Option B : Choisir un thème libre */}
            {themeSource === 'libre' && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionner un thème prédéfini
                  </label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {predefinedThemes.map((theme) => (
                      <option key={theme} value={theme}>{theme}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ou saisir un autre thème
                  </label>
                  <input
                    type="text"
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                    placeholder="Ex: Les voyages en train, Mon animal préféré..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Affichage du contexte sélectionné */}
            {getCurrentContext().title && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  {getCurrentContext().title}
                </p>
              </div>
            )}

            {/* Sélection du type d'exercice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'exercice
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as ExerciceType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="qcm">QCM (20 questions)</option>
                <option value="texteATrous">Texte à trous</option>
              </select>
              {selectedType === 'qcm' && (
                <p className="text-xs text-gray-500 mt-1">
                  20 questions à choix multiples générées automatiquement
                </p>
              )}
            </div>

            {/* Sélection du niveau CECRL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Niveau estimé
              </label>
              <select
                value={niveauCECRL}
                onChange={(e) => setNiveauCECRL(e.target.value as NiveauCECRL)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            {(themeSource === 'cours' && !selectedLecon) ? (
              <button
                className="w-full px-6 py-3 bg-gray-300 text-gray-600 rounded-md cursor-not-allowed"
                disabled
              >
                Veuillez importer une leçon d\'abord
              </button>
            ) : (
              <button
                onClick={generateExercise}
                disabled={isLoading}
                className={`w-full px-6 py-3 rounded-md text-white font-medium  
                  ${!isLoading 
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
                  `Générer ${selectedType === 'qcm' ? '20 questions QCM' : 'un exercice'}`
                )}
              </button>
            )}
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
              {selectedType === 'qcm' 
                ? 'Mistral génère 20 questions QCM à partir de votre contenu...' 
                : 'Mistral génère un exercice à partir de votre contenu...'}
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
              <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
                {generatedExercise.type === 'qcm' ? 'QCM - 20 questions' : 'Texte à trous'}
              </h2>
              <span className="text-sm text-gray-500">
                Niveau: {niveauCECRL}
              </span>
            </div>

            {generatedExercise.type === 'qcm' && (
              <>
                {/* QCM : Afficher toutes les 20 questions */}
                <p className="text-sm text-gray-600 mb-4">
                  Répondez à toutes les questions. Validez à la fin pour obtenir votre score.
                </p>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                  {generatedExercise.questions.map((question, index) => (
                    <div key={index} className="bg-white p-4 rounded-md shadow-sm">
                      <h3 className="font-medium text-gray-800 mb-3">
                        Question {index + 1}/{generatedExercise.questions.length}
                      </h3>
                      <p className="text-gray-700 mb-4">{question.question}</p>
                      <div className="space-y-2">
                        {question.choix.map((choice, choiceIndex) => (
                          <label
                            key={choiceIndex}
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer border-2 transition-colors
                              ${qcmAnswers[index] === choiceIndex 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            <input
                              type="radio"
                              name={`qcm-${index}`}
                              value={choiceIndex}
                              checked={qcmAnswers[index] === choiceIndex}
                              onChange={(e) => {
                                setQcmAnswers(prev => ({
                                  ...prev,
                                  [index]: Number(e.target.value),
                                }));
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{choice}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Indicateur de progression */}
                <div className="text-sm text-gray-500">
                  {Object.keys(qcmAnswers).length} questions répondus sur {generatedExercise.questions.length}
                </div>
              </>
            )}

            {generatedExercise.type === 'texteATrous' && (
              <>
                {/* Texte à trous */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-700 mb-2">{generatedExercise.question}</p>
                  <p className="text-gray-700 whitespace-pre-wrap mb-4">
                    {generatedExercise.textWithBlanks}
                  </p>
                  <input
                    type="text"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Votre réponse (séparer par des virgules si plusieurs mots)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

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
                disabled={
                  (generatedExercise.type === 'qcm' && Object.keys(qcmAnswers).length < generatedExercise.questions.length) ||
                  (generatedExercise.type === 'texteATrous' && !textAnswer.trim()) ||
                  isLoading
                }
                className={`px-6 py-2 rounded-md text-white font-medium flex-1 
                  ${(generatedExercise.type === 'qcm' ? Object.keys(qcmAnswers).length === generatedExercise.questions.length : textAnswer.trim() !== '') && !isLoading 
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
                  `Valider mes réponses (${generatedExercise.type === 'qcm' ? generatedExercise.questions.length : '1'} question${generatedExercise.type === 'qcm' ? 's' : ''})`
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
            {/* Résultat global */}
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                {correction.totalScore >= 80 ? (
                  <span className="text-green-600">✓ Excellent travail !</span>
                ) : correction.totalScore >= 50 ? (
                  <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                ) : (
                  <span className="text-red-600">✗ Revisez ces notions</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={correction.totalScore >= 80 ? 'text-green-600' : correction.totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {correction.totalScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                {correction.correctCount}/{correction.totalQuestions} bonnes réponses
              </p>
            </div>

            {/* Détails par question (QCM) */}
            {generatedExercise.type === 'qcm' && (
              <div className="bg-gray-50 p-4 rounded-md space-y-4 max-h-[50vh] overflow-y-auto">
                <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
                {correction.corrections.map((corr, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md border-l-4 ${corr.isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                  >
                    <p className="font-medium text-gray-800 mb-1">
                      Question {index + 1}: {generatedExercise.questions[index].question}
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Votre réponse:</span> 
                      <span className={corr.isCorrect ? 'text-green-700' : 'text-red-700'}>{
                        corr.userAnswer || 'Non répondue'
                      }</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Réponse correcte:</span> 
                      <span className="text-green-700 font-medium">{corr.correctAnswer}</span>
                    </p>
                    {corr.explanation && (
                      <p className="text-xs text-gray-500 mt-1">{corr.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Résumé texte à trous */}
            {generatedExercise.type === 'texteATrous' && (
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium text-gray-700 mb-2">Explication</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{generatedExercise.explanation}</p>
              </div>
            )}

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
                <p className="text-green-700 mb-3">
                  ✓ Exercice sauvegardé dans votre historique avec un score de {correction.totalScore}/100
                </p>
                <p className="text-sm text-green-600 mb-4">
                  Votre progression CECRL a été mise à jour automatiquement.
                </p>
                <button
                  onClick={() => {
                    setStep('select');
                    setGeneratedExercise(null);
                    setQcmAnswers({});
                    setTextAnswer('');
                    setCorrection(null);
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
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
