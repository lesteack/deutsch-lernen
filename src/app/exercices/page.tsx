'use client';

import { useState, useEffect } from 'react';
import {
  getAllLecons,
  getProgression,
  addExercice,
  type Lecon,
  type ExerciceType,
} from '@/lib/storage';
import { mettreAJourProgression } from '@/lib/progression';

// ============================================================================
// TYPES
// ============================================================================

type PageState = 'selection' | 'generation' | 'exercice' | 'correction';

// Type pour réponse Mistral - QCM
interface MistralQCM {
  questions: Array<{
    question: string;
    choix: [string, string, string, string];
    bonneReponse: number;
    explication: string;
  }>;
}

// Type pour réponse Mistral - Genre
interface MistralGenre {
  mots: Array<{
    nom: string;
    article: string;
    traduction: string;
    astuce: string;
  }>;
}

// Type pour réponse Mistral - Texte à trous
interface MistralTexteATrous {
  phrases: Array<{
    texteAvecTrous: string;
    trous: Array<{
      position: number;
      bonneReponse: string;
      options: string[];
    }>;
  }>;
}

// Type pour réponse Mistral - Conjugaison
interface MistralConjugaison {
  exercices: Array<{
    verbe: string;
    pronom: string;
    temps: string;
    bonneReponse: string;
    explication: string;
  }>;
}

// Type pour réponse Mistral - Traduction
interface MistralTraduction {
  phrases: Array<{
    fr: string;
    de: string;
    indice: string;
  }>;
}

// Type pour réponse Mistral - Surprise (Mistral choisit le type)
interface MistralSurprise {
  typeChoisi: 'qcm' | 'genre' | 'texteATrous' | 'conjugaison' | 'traduction';
  raisonChoix: string;
  exercice: MistralQCM | MistralGenre | MistralTexteATrous | MistralConjugaison | MistralTraduction;
}

type MistralResponse = MistralQCM | MistralGenre | MistralTexteATrous | MistralConjugaison | MistralTraduction | MistralSurprise;

// Type pour suivre les réponses QCM
interface QCMAnswers {
  [key: number]: number | null;
}

// Type pour suivre les réponses Genre
interface GenreAnswers {
  [key: number]: string | null;
}

// Type pour suivre les réponses Texte à trous
interface TexteATrousAnswers {
  [phraseIndex: number]: {
    [trouIndex: number]: string | null;
  };
}

// Type pour les corrections
interface CorrectionResult {
  totalScore: number;
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

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ExercicesPage() {
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [pageState, setPageState] = useState<PageState>('selection');
  const [lecons, setLecons] = useState<Lecon[]>([]);
  const [selectedLecons, setSelectedLecons] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<ExerciceType | 'surprise'>('qcm');
  const [niveau, setNiveau] = useState<string>('B1');
  
  // State pour l'exercice généré
  const [exerciseData, setExerciseData] = useState<MistralResponse | null>(null);
  
  // State pour les réponses
  const [qcmAnswers, setQcmAnswers] = useState<QCMAnswers>({});
  const [genreAnswers, setGenreAnswers] = useState<GenreAnswers>({});
  const [texteATrousAnswers, setTexteATrousAnswers] = useState<TexteATrousAnswers>({});
  const [conjugaisonAnswers, setConjugaisonAnswers] = useState<Record<number, string>>({});
  const [traductionAnswers, setTraductionAnswers] = useState<Record<number, string>>({});
  
  // State pour le type choisi par Mistral en mode surprise
  const [surpriseType, setSurpriseType] = useState<ExerciceType | null>(null);
  const [surpriseReason, setSurpriseReason] = useState<string | null>(null);
  
  // State pour la correction
  const [correction, setCorrection] = useState<CorrectionResult | null>(null);
  
  // State UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // INITIALISATION
  // ==========================================================================

  useEffect(() => {
    const allLecons = getAllLecons();
    setLecons(allLecons);
    
    const progression = getProgression();
    setNiveau(progression.niveauEstimeCECRL);
    
    // Sélectionner la première leçon par défaut
    if (allLecons.length > 0) {
      setSelectedLecons([allLecons[0].id]);
    }
  }, []);

  // ==========================================================================
  // FONCTIONS
  // ==========================================================================

  // Sélectionner/désélectionner une leçon
  const toggleLecon = (leconId: string) => {
    setSelectedLecons(prev => {
      if (prev.includes(leconId)) {
        return prev.filter(id => id !== leconId);
      } else {
        return [...prev, leconId];
      }
    });
  };

  // Sélectionner toutes les leçons
  const selectAllLecons = () => {
    setSelectedLecons(lecons.map(l => l.id));
  };

  // Désélectionner toutes les leçons
  const deselectAllLecons = () => {
    setSelectedLecons([]);
  };

  // Vérifier qu'au moins une leçon est sélectionnée
  const hasSelectedLecons = selectedLecons.length > 0;

  // Construire le contenu à partir des leçons sélectionnées
  const getContent = () => {
    const selectedLeconObjects = lecons.filter(l => selectedLecons.includes(l.id));
    return selectedLeconObjects.map(l => `[Lecon: ${l.titre}] ${l.contenuTexte}`).join('\n\n');
  };

  // Construire le prompt pour Mistral selon le type
  const buildPrompt = () => {
    const content = getContent();
    
    if (selectedType === 'surprise') {
      return `Tu es un professeur d'allemand expert.
Analyse ce contenu de leçon : ${content}

1. Choisis le TYPE D'EXERCICE le plus pédagogique pour ce contenu parmi :
   - qcm : si le contenu contient des règles, définitions, ou vocabulaire varié
   - genre : si le contenu contient beaucoup de noms avec articles
   - texteATrous : si le contenu contient des structures grammaticales répétitives
   - conjugaison : si le contenu parle de verbes et de temps
   - traduction : si le contenu est un lexique bilingue ou liste de vocabulaire

2. Génère l'exercice correspondant.

Réponds UNIQUEMENT en JSON sans markdown :
{
  "typeChoisi": "qcm" | "genre" | "texteATrous" | "conjugaison" | "traduction",
  "raisonChoix": "Explication courte en français du pourquoi ce type",
  "exercice": {
    ... (structure JSON du type choisi)
  }
}

Rappel des structures attendues :
- qcm → { questions: [{question, choix: [4 options], bonneReponse: index, explication}] }
- genre → { mots: [{nom, article, traduction, astuce}] }
- texteATrous → { phrases: [{texteAvecTrous, trous: [{position, bonneReponse, options}]}] }
- conjugaison → { exercices: [{verbe, pronom, temps, bonneReponse, explication}] }
- traduction → { phrases: [{fr, de, indice}] }`;
    }
    
    if (selectedType === 'qcm') {
      return `Génère 10 questions QCM en allemand sur ce contenu : ${content}.
Niveau : ${niveau}.
Réponds UNIQUEMENT en JSON sans markdown :
{
  "questions": [
    {
      "question": "...",
      "choix": ["A","B","C","D"],
      "bonneReponse": 0,
      "explication": "..."
    }
  ]
}`;
    }
    
    if (selectedType === 'genre') {
      return `Génère 10 noms allemands avec leur article tirés de ce contenu : ${content}.
Réponds UNIQUEMENT en JSON sans markdown :
{
  "mots": [
    {
      "nom": "Tisch",
      "article": "der",
      "traduction": "la table",
      "astuce": "Les meubles sont souvent masculins"
    }
  ]
}`;
    }
    
    if (selectedType === 'texteATrous') {
      return `Génère 5 phrases en allemand avec des trous pour les articles (der/die/das/den/dem/des).
Basé sur ce contenu : ${content}.
Réponds UNIQUEMENT en JSON sans markdown :
{
  "phrases": [
    {
      "texteAvecTrous": "___ Hund ist groß. ___ Katze schläft.",
      "trous": [
        {"position": 0, "bonneReponse": "Der", "options": ["Der","Die","Das","Den","Dem"]},
        {"position": 1, "bonneReponse": "Die", "options": ["Der","Die","Das","Den","Dem"]}
      ]
    }
  ]
}`;
    }
    
    return '';
  };

  // Générer l'exercice
  const generateExercise = async () => {
    if (!hasSelectedLecons) {
      setError('Veuillez sélectionner au moins une leçon');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPageState('generation');

    try {
      const prompt = buildPrompt();
      
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
      
      // LOGGER LA RÉPONSE BRUTE POUR LE DEBUG
      console.log('Réponse Mistral brute:', data);
      
      // Gérer le cas où la réponse contient un warning
      let parsedData: MistralResponse;
      if (data.warning && data.rawResponse) {
        console.error('Warning:', data.warning);
        console.error('Raw response:', data.rawResponse);
        try {
          parsedData = JSON.parse(data.rawResponse);
        } catch (parseError) {
          throw new Error(`Réponse Mistral invalide : ${data.warning}. Raw: ${data.rawResponse?.substring(0, 200)}`);
        }
      } else {
        parsedData = data;
      }
      
      // Vérifier que la structure est valide
      if (!parsedData || Object.keys(parsedData).length === 0) {
        throw new Error('Réponse Mistral vide ou invalide');
      }
      
      // Gérer le mode surprise
      if (selectedType === 'surprise') {
        const surpriseData = parsedData as MistralSurprise;
        
        // Vérifier la structure de la surprise
        if (!surpriseData.typeChoisi || !surpriseData.raisonChoix || !surpriseData.exercice) {
          throw new Error('Réponse Mistral invalide pour Surprise : structure incorrecte');
        }
        
        // Vérifier que typeChoisi est valide
        const validTypes = ['qcm', 'genre', 'texteATrous', 'conjugaison', 'traduction'];
        if (!validTypes.includes(surpriseData.typeChoisi)) {
          throw new Error(`Type choisi invalide : ${surpriseData.typeChoisi}`);
        }
        
        // Stocker le type choisi et la raison
        setSurpriseType(surpriseData.typeChoisi);
        setSurpriseReason(surpriseData.raisonChoix);
        
        // Extraire l'exercice
        setExerciseData(surpriseData.exercice);
        setPageState('exercice');
      } else {
        // Vérifier selon le type
        if (selectedType === 'qcm') {
          const qcmData = parsedData as MistralQCM;
          if (!qcmData.questions || !Array.isArray(qcmData.questions) || qcmData.questions.length === 0) {
            throw new Error('Réponse Mistral invalide pour QCM : questions manquantes ou vide');
          }
        } else if (selectedType === 'genre') {
          const genreData = parsedData as MistralGenre;
          if (!genreData.mots || !Array.isArray(genreData.mots) || genreData.mots.length === 0) {
            throw new Error('Réponse Mistral invalide pour Genre : mots manquantes ou vide');
          }
        } else if (selectedType === 'texteATrous') {
          const texteData = parsedData as MistralTexteATrous;
          if (!texteData.phrases || !Array.isArray(texteData.phrases) || texteData.phrases.length === 0) {
            throw new Error('Réponse Mistral invalide pour Texte à trous : phrases manquantes ou vide');
          }
        } else if (selectedType === 'conjugaison') {
          const conjugaisonData = parsedData as MistralConjugaison;
          if (!conjugaisonData.exercices || !Array.isArray(conjugaisonData.exercices) || conjugaisonData.exercices.length === 0) {
            throw new Error('Réponse Mistral invalide pour Conjugaison : exercices manquantes ou vide');
          }
        } else if (selectedType === 'traduction') {
          const traductionData = parsedData as MistralTraduction;
          if (!traductionData.phrases || !Array.isArray(traductionData.phrases) || traductionData.phrases.length === 0) {
            throw new Error('Réponse Mistral invalide pour Traduction : phrases manquantes ou vide');
          }
        } else {
          throw new Error('Type d\'exercice non reconnu');
        }
        
        // Réinitialiser le type surprise
        setSurpriseType(null);
        setSurpriseReason(null);
        
        setExerciseData(parsedData);
        setPageState('exercice');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer l'exercice : ${errorMessage}`);
      setPageState('selection');
    } finally {
      setIsLoading(false);
    }
  };

  // Vérifier si l'exercice est complet
  const isExerciseComplete = () => {
    if (!exerciseData) return false;
    
    const effectiveType = getEffectiveType();
    
    try {
      if (effectiveType === 'qcm') {
        return Object.keys(qcmAnswers).length === (exerciseData as MistralQCM).questions.length;
      } else if (effectiveType === 'genre') {
        return Object.keys(genreAnswers).length === (exerciseData as MistralGenre).mots.length;
      } else if (effectiveType === 'texteATrous') {
        const texteData = exerciseData as MistralTexteATrous;
        let allFilled = true;
        for (let p = 0; p < texteData.phrases.length; p++) {
          const phrase = texteData.phrases[p];
          for (let t = 0; t < phrase.trous.length; t++) {
            if (!texteATrousAnswers[p]?.[t]) {
              allFilled = false;
              break;
            }
          }
          if (!allFilled) break;
        }
        return allFilled;
      } else if (effectiveType === 'conjugaison') {
        return Object.keys(conjugaisonAnswers).length === (exerciseData as MistralConjugaison).exercices.length;
      } else if (effectiveType === 'traduction') {
        return Object.keys(traductionAnswers).length === (exerciseData as MistralTraduction).phrases.length;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Corriger l'exercice
  const correctExercise = () => {
    if (!exerciseData) return;
    
    let correctionResult: CorrectionResult | null = null;
    
    const effectiveType = getEffectiveType();
    
    switch (effectiveType) {
      case 'qcm': {
        const qcmData = exerciseData as MistralQCM;
        let correctCount = 0;
        const corrections: CorrectionResult['corrections'] = [];
        
        qcmData.questions.forEach((q, index) => {
          const userAnswer = qcmAnswers[index];
          const isCorrect = userAnswer === q.bonneReponse;
          if (isCorrect) correctCount++;
          
          corrections.push({
            questionIndex: index,
            isCorrect,
            userAnswer: userAnswer !== null && userAnswer !== undefined 
              ? q.choix[userAnswer] 
              : null,
            correctAnswer: q.choix[q.bonneReponse],
            explanation: q.explication,
          });
        });
        
        const totalScore = Math.round((correctCount / qcmData.questions.length) * 100);
        correctionResult = {
          totalScore,
          totalQuestions: qcmData.questions.length,
          correctCount,
          corrections,
        };
        break;
      }
      
      case 'genre': {
        const genreData = exerciseData as MistralGenre;
        let correctCount = 0;
        const corrections: CorrectionResult['corrections'] = [];
        
        genreData.mots.forEach((mot, index) => {
          const userAnswer = genreAnswers[index];
          const isCorrect = userAnswer === mot.article;
          if (isCorrect) correctCount++;
          
          corrections.push({
            questionIndex: index,
            isCorrect,
            userAnswer: userAnswer || null,
            correctAnswer: mot.article,
            explanation: isCorrect ? '' : mot.astuce,
          });
        });
        
        const totalScore = Math.round((correctCount / genreData.mots.length) * 100);
        correctionResult = {
          totalScore,
          totalQuestions: genreData.mots.length,
          correctCount,
          corrections,
        };
        break;
      }
      
      case 'texteATrous': {
        const texteData = exerciseData as MistralTexteATrous;
        let correctCount = 0;
        let totalQuestions = 0;
        const corrections: CorrectionResult['corrections'] = [];
        
        texteData.phrases.forEach((phrase, phraseIndex) => {
          phrase.trous.forEach((trou, trouIndex) => {
            totalQuestions++;
            const userAnswer = texteATrousAnswers[phraseIndex]?.[trouIndex];
            const isCorrect = userAnswer === trou.bonneReponse;
            if (isCorrect) correctCount++;
            
            corrections.push({
              questionIndex: totalQuestions - 1,
              isCorrect,
              userAnswer: userAnswer || null,
              correctAnswer: trou.bonneReponse,
              explanation: isCorrect ? '' : `La bonne réponse était: ${trou.bonneReponse}`,
            });
          });
        });
        
        const totalScore = Math.round((correctCount / Math.max(totalQuestions, 1)) * 100);
        correctionResult = {
          totalScore,
          totalQuestions,
          correctCount,
          corrections,
        };
        break;
      }
      
      case 'conjugaison': {
        const conjugaisonData = exerciseData as MistralConjugaison;
        let correctCount = 0;
        const corrections: CorrectionResult['corrections'] = [];
        
        conjugaisonData.exercices.forEach((exercice, index) => {
          const userAnswer = conjugaisonAnswers[index];
          const isCorrect = userAnswer?.toLowerCase() === exercice.bonneReponse.toLowerCase();
          if (isCorrect) correctCount++;
          
          corrections.push({
            questionIndex: index,
            isCorrect,
            userAnswer: userAnswer || null,
            correctAnswer: exercice.bonneReponse,
            explanation: isCorrect ? '' : exercice.explication,
          });
        });
        
        const totalScore = Math.round((correctCount / conjugaisonData.exercices.length) * 100);
        correctionResult = {
          totalScore,
          totalQuestions: conjugaisonData.exercices.length,
          correctCount,
          corrections,
        };
        break;
      }
      
      case 'traduction': {
        const traductionData = exerciseData as MistralTraduction;
        let correctCount = 0;
        const corrections: CorrectionResult['corrections'] = [];
        
        traductionData.phrases.forEach((phrase, index) => {
          const userAnswer = traductionAnswers[index];
          const isCorrect = userAnswer?.toLowerCase() === phrase.de.toLowerCase();
          if (isCorrect) correctCount++;
          
          corrections.push({
            questionIndex: index,
            isCorrect,
            userAnswer: userAnswer || null,
            correctAnswer: phrase.de,
            explanation: isCorrect ? '' : phrase.indice,
          });
        });
        
        const totalScore = Math.round((correctCount / traductionData.phrases.length) * 100);
        correctionResult = {
          totalScore,
          totalQuestions: traductionData.phrases.length,
          correctCount,
          corrections,
        };
        break;
      }
    }
    
    setCorrection(correctionResult);
    setPageState('correction');
    
    // Sauvegarder l'exercice
    if (correctionResult) {
      const effectiveType = getEffectiveType();
      // En mode surprise, on utilise surpriseType qui est toujours un ExerciceType
      const typeToSave: ExerciceType = effectiveType === 'surprise' ? surpriseType! : effectiveType;
      const exerciceToSave = {
        type: typeToSave,
        leconsAssociees: selectedLecons,
        contenuJSON: exerciseData as unknown as Record<string, unknown>,
        reponseUtilisateur: effectiveType === 'qcm' ? qcmAnswers : 
                        effectiveType === 'genre' ? genreAnswers :
                        effectiveType === 'texteATrous' ? texteATrousAnswers :
                        effectiveType === 'conjugaison' ? conjugaisonAnswers :
                        traductionAnswers,
        correction: `Score: ${correctionResult.totalScore}/100. ${correctionResult.correctCount}/${correctionResult.totalQuestions} bonnes réponses.`,
        score: correctionResult.totalScore,
      };
      
      addExercice(exerciceToSave);
      mettreAJourProgression();
    }
  };

  // Retour à la sélection
  const backToSelection = () => {
    setPageState('selection');
    setExerciseData(null);
    setQcmAnswers({});
    setGenreAnswers({});
    setTexteATrousAnswers({});
    setConjugaisonAnswers({});
    setTraductionAnswers({});
    setCorrection(null);
    setError(null);
    setSurpriseType(null);
    setSurpriseReason(null);
  };

  // Get question count for display
  const getQuestionCount = () => {
    if (!exerciseData) return 0;
    
    const effectiveType = getEffectiveType();
    
    if (effectiveType === 'qcm') {
      return (exerciseData as MistralQCM).questions.length;
    }
    if (effectiveType === 'genre') {
      return (exerciseData as MistralGenre).mots.length;
    }
    if (effectiveType === 'texteATrous') {
      return (exerciseData as MistralTexteATrous).phrases.reduce(
        (count, phrase) => count + phrase.trous.length, 0
      );
    }
    if (effectiveType === 'conjugaison') {
      return (exerciseData as MistralConjugaison).exercices.length;
    }
    if (effectiveType === 'traduction') {
      return (exerciseData as MistralTraduction).phrases.length;
    }
    return 0;
  };

  // Get score message
  const getScoreMessage = () => {
    if (!correction) return '';
    
    if (correction.totalScore >= 80) return 'Excellent travail ! 🎉';
    if (correction.totalScore >= 60) return 'Bien joué ! 👍';
    if (correction.totalScore >= 40) return 'Pas mal, continuez ! 💪';
    return 'Courage, pratiquez encore ! 📚';
  };

  // Convertir type technique en label français
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'qcm': 'QCM - 10 questions',
      'genre': 'Genre des noms (der/die/das)',
      'texteATrous': 'Texte à trous avec articles',
      'conjugaison': 'Conjugaison',
      'traduction': 'Traduction',
    };
    return labels[type] || type;
  };

  // Retourne le type effectif (gère le mode surprise)
  const getEffectiveType = (): ExerciceType | 'surprise' => {
    if (selectedType === 'surprise' && surpriseType) {
      return surpriseType as ExerciceType;
    }
    return selectedType;
  };

  // ==========================================================================
  // RENDU
  // ==========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#667eea] to-[#764ba2] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Exercices d'allemand
          </h1>
          <p className="text-white/80">
            Générez des exercices à partir de vos leçons
          </p>
        </header>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* =============================================================== */}
        {/* ÉTAPE 1 : SÉLECTION */}
        {/* =============================================================== */}
        {pageState === 'selection' && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {/* Sélection des leçons */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">
                  Sélectionnez les leçons à travailler
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllLecons}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    onClick={deselectAllLecons}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>
              
              {lecons.length === 0 ? (
                <p className="text-gray-500">
                  Aucune leçon disponible. Importez d'abord un PDF via /lecons/import
                </p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                  {lecons.map((lecon) => (
                    <label
                      key={lecon.id}
                      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                        selectedLecons.includes(lecon.id) 
                          ? 'bg-blue-100 border border-blue-200' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLecons.includes(lecon.id)}
                        onChange={() => toggleLecon(lecon.id)}
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{lecon.titre}</p>
                        <p className="text-sm text-gray-500 truncate">{lecon.contenuTexte.substring(0, 100)}...</p>
                      </div>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                        {lecon.type}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              
              <p className="text-sm text-gray-500">
                {selectedLecons.length} leçon(s) sélectionnée(s)
              </p>
            </div>

            {/* Sélection du type d'exercice */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-800">
                Type d'exercice
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Surprise en première position */}
                <button
                  onClick={() => setSelectedType('surprise')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === 'surprise'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">🎲 Surprise</p>
                    <p className="text-sm text-gray-500">Mistral choisit le meilleur exercice</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedType('qcm')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === 'qcm'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">QCM</p>
                    <p className="text-sm text-gray-500">10 questions à choix multiples</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedType('genre')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === 'genre'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Genre (der/die/das)</p>
                    <p className="text-sm text-gray-500">10 noms à classer</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedType('texteATrous')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === 'texteATrous'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Texte à trous</p>
                    <p className="text-sm text-gray-500">5 phrases avec articles</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedType('conjugaison')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === 'conjugaison'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Conjugaison</p>
                    <p className="text-sm text-gray-500">Verbes à conjuguer</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setSelectedType('traduction')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === 'traduction'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Traduction</p>
                    <p className="text-sm text-gray-500">Phrases à traduire</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Niveau */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Niveau
              </label>
              <select
                value={niveau}
                onChange={(e) => setNiveau(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </select>
            </div>

            {/* Bouton Générer */}
            <button
              onClick={generateExercise}
              disabled={!hasSelectedLecons || isLoading}
              className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all ${
                hasSelectedLecons && !isLoading
                  ? 'bg-[#3730a3] hover:bg-[#4f46e5] cursor-pointer'
                  : 'bg-[#3730a3]/50 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  Génération en cours...
                </span>
              ) : (
                'Générer l\'exercice'
              )}
            </button>
          </div>
        )}

        {/* =============================================================== */}
        {/* ÉTAPE 2 : GÉNÉRATION */}
        {/* =============================================================== */}
        {pageState === 'generation' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">
              {selectedType === 'surprise' 
                ? '🎲 Mistral analyse votre leçon et choisit le meilleur exercice...' 
                : `Mistral génère votre exercice de ${getTypeLabel(selectedType)}...`}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Cela peut prendre quelques secondes
            </p>
          </div>
        )}

        {/* =============================================================== */}
        {/* ÉTAPE 3 : EXERCICE */}
        {/* =============================================================== */}
        {pageState === 'exercice' && exerciseData && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {/* Bandeau Surprise */}
            {surpriseType && surpriseReason && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                <p className="text-indigo-800 font-medium">
                  🎲 Mistral a choisi : {getTypeLabel(surpriseType)}
                </p>
                <p className="text-indigo-600 text-sm mt-1">
                  Pourquoi : {surpriseReason}
                </p>
              </div>
            )}
            
            {/* En-tête */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {getTypeLabel(getEffectiveType())}
              </h2>
              <span className="text-sm text-gray-500">
                Niveau: {niveau}
              </span>
            </div>

            {/* Rendu selon le type */}
            {selectedType === 'qcm' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {(exerciseData as MistralQCM).questions.map((q, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-medium text-gray-800 mb-3">
                      Question {index + 1}/{getQuestionCount()}
                    </h3>
                    <p className="text-gray-700 mb-4">{q.question}</p>
                    <div className="space-y-2">
                      {q.choix.map((choice, choiceIndex) => (
                        <button
                          key={choiceIndex}
                          onClick={() => setQcmAnswers(prev => ({
                            ...prev,
                            [index]: choiceIndex
                          }))}
                          className={`w-full text-left p-3 rounded-md border-2 transition-colors ${
                            qcmAnswers[index] === choiceIndex
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <span className="font-medium text-gray-700">{String.fromCharCode(65 + choiceIndex)}.</span>
                          <span className="ml-3 text-gray-700">{choice}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedType === 'genre' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {(exerciseData as MistralGenre).mots.map((mot, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-2xl text-gray-400">___</span>
                      <span className="text-xl font-medium text-gray-800">{mot.nom}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Traduction: {mot.traduction}</p>
                    <div className="flex flex-wrap gap-2">
                      {['der', 'die', 'das', 'die (pluriel)'].map((article) => (
                        <button
                          key={article}
                          onClick={() => setGenreAnswers(prev => ({
                            ...prev,
                            [index]: article
                          }))}
                          className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                            genreAnswers[index] === article
                              ? 'bg-blue-600'
                              : 'bg-gray-400 hover:bg-gray-500'
                          }`}
                        >
                          {article}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {getEffectiveType() === 'texteATrous' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {(exerciseData as MistralTexteATrous).phrases.map((phrase, phraseIndex) => (
                  <div key={phraseIndex} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-800 mb-3">Phrase {phraseIndex + 1}</p>
                    <div className="text-gray-700">
                      {phrase.texteAvecTrous.split('___').map((part, partIndex) => {
                        const trou = phrase.trous[partIndex];
                        if (partIndex === 0) return <span key={partIndex}>{part}</span>;
                        
                        return (
                          <span key={partIndex}>
                            <select
                              value={texteATrousAnswers[phraseIndex]?.[partIndex - 1] || ''}
                              onChange={(e) => {
                                setTexteATrousAnswers(prev => ({
                                  ...prev,
                                  [phraseIndex]: {
                                    ...prev[phraseIndex],
                                    [partIndex - 1]: e.target.value
                                  }
                                }));
                              }}
                              className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
                            >
                              <option value="">---</option>
                              {trou?.options.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            {part}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {getEffectiveType() === 'conjugaison' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {(exerciseData as MistralConjugaison).exercices.map((exercice, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-800 mb-2">
                      Question {index + 1}/{getQuestionCount()}
                    </p>
                    <p className="text-gray-700 mb-3">
                      Conjuguez le verbe <strong>{exercice.verbe}</strong> avec le pronom <strong>{exercice.pronom}</strong> au <strong>{exercice.temps}</strong>:
                    </p>
                    <input
                      type="text"
                      value={conjugaisonAnswers[index] || ''}
                      onChange={(e) => setConjugaisonAnswers(prev => ({
                        ...prev,
                        [index]: e.target.value
                      }))}
                      placeholder="Votre réponse"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {getEffectiveType() === 'traduction' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {(exerciseData as MistralTraduction).phrases.map((phrase, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-800 mb-2">
                      Question {index + 1}/{getQuestionCount()}
                    </p>
                    <p className="text-gray-700 mb-3">
                      Traduisz en allemand: <strong>{phrase.fr}</strong>
                    </p>
                    {phrase.indice && (
                      <p className="text-sm text-blue-600 mb-2">Indice: {phrase.indice}</p>
                    )}
                    <input
                      type="text"
                      value={traductionAnswers[index] || ''}
                      onChange={(e) => setTraductionAnswers(prev => ({
                        ...prev,
                        [index]: e.target.value
                      }))}
                      placeholder="Votre réponse"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Indicateur de progression */}
            <div className="text-sm text-gray-500">
              {getEffectiveType() === 'qcm' ? Object.keys(qcmAnswers).length :
               getEffectiveType() === 'genre' ? Object.keys(genreAnswers).length :
               getEffectiveType() === 'conjugaison' ? Object.keys(conjugaisonAnswers).length :
               getEffectiveType() === 'traduction' ? Object.keys(traductionAnswers).length :
               Object.values(texteATrousAnswers).reduce((count, phraseAnswers) => 
                 count + Object.keys(phraseAnswers).length, 0
               )}
              /{getQuestionCount()} réponses données
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={backToSelection}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Annuler
              </button>
              <button
                onClick={correctExercise}
                disabled={!isExerciseComplete() || isLoading}
                className={`flex-1 px-6 py-3 rounded-xl text-white font-medium transition-all ${
                  isExerciseComplete() && !isLoading
                    ? 'bg-[#3730a3] hover:bg-[#4f46e5] cursor-pointer'
                    : 'bg-[#3730a3]/50 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Correction en cours...
                  </span>
                ) : (
                  `Valider mes réponses (${getQuestionCount()} question${getQuestionCount() > 1 ? 's' : ''})`
                )}
              </button>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* ÉTAPE 4 : CORRECTION */}
        {/* =============================================================== */}
        {pageState === 'correction' && correction && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {/* Résultat global */}
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                <span className={correction.totalScore >= 80 ? 'text-green-600' : 
                                       correction.totalScore >= 60 ? 'text-yellow-600' : 
                                       'text-red-600'}>
                  {getScoreMessage()}
                </span>
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={correction.totalScore >= 80 ? 'text-green-600' : 
                                       correction.totalScore >= 60 ? 'text-yellow-600' : 
                                       'text-red-600'}>
                  {correction.totalScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                {correction.correctCount}/{correction.totalQuestions} bonnes réponses
              </p>
            </div>

            {/* Détails des réponses */}
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {correction.corrections.map((corr, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    corr.isCorrect 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <p className="font-medium text-gray-800 mb-2">
                    Question {index + 1}
                  </p>
                  <p className="text-sm mb-2">
                    <span className="text-gray-600">Votre réponse:</span> 
                    <span className={corr.isCorrect ? 'text-green-700' : 'text-red-700'}>
                      {corr.userAnswer || 'Non répondue'}
                    </span>
                  </p>
                  <p className="text-sm mb-1">
                    <span className="text-gray-600">Réponse correcte:</span> 
                    <span className="text-green-700 font-medium">{corr.correctAnswer}</span>
                  </p>
                  {corr.explanation && (
                    <p className="text-xs text-gray-500 mt-1">{corr.explanation}</p>
                  )}
                  <p className={`text-xs mt-1 font-medium ${
                    corr.isCorrect ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {corr.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </p>
                </div>
              ))}
            </div>

            {/* Bouton Nouvel exercice */}
            <button
              onClick={backToSelection}
              className="w-full py-4 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
            >
              Nouvel exercice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
