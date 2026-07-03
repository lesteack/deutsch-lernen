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

// ============================================================================
// NOUVEAUX TYPES POUR LES EXERCICES
// ============================================================================

/** Type pour un exercice de traduction */
interface TranslationExercise {
  type: 'traduction';
  sentence: string; // Phrase à traduire
  direction: 'fr-de' | 'de-fr'; // Direction de traduction
  correctTranslation: string; // Traduction correcte
  context?: string; // Contexte optionnel
}

/** Type pour un exercice de questions ouvertes */
interface OpenQuestionExercise {
  type: 'questionsOuvertes';
  question: string; // Question ouverte en allemand
  expectedAnswer: string; // Réponse attendue (pour référence)
  difficulty: string; // Niveau de difficulté
}

/** Type pour un exercice de remise en ordre */
interface ReorderExercise {
  type: 'remiseEnOrdre';
  words: string[]; // Mots dans le désordre
  correctOrder: string[]; // Ordre correct
  sentence: string; // Phrase complète correcte
  grammaticalRule: string; // Règle grammaticale expliquée
}

/** Type pour un exercice de conjugaison */
interface ConjugationExercise {
  type: 'conjugaison';
  verb: string; // Verbe à conjuguer
  pronoun: string; // Pronom (ich, du, er, wir, ihr, sie, Sie)
  tense: string; // Temps (Präsens, Präteritum, Perfekt, etc.)
  correctForm: string; // Forme correcte
  ruleExplanation: string; // Explication de la règle
}

/** Type pour un dialogue avec trous */
interface DialogueCompletionExercise {
  type: 'completionDialogue';
  dialogue: Array<{
    speaker: string; // A ou B
    text: string; // Texte de la réplique (peut être vide pour les trous)
    isBlank: boolean; // Si c'est un trou à remplir
    expectedAnswer?: string; // Réponse attendue pour les trous
  }>;
  context: string; // Contexte du dialogue
}

/** Type pour un exercice d'association */
interface AssociationExercise {
  type: 'association';
  leftColumn: string[]; // Mots/expressions en allemand
  rightColumn: string[]; // Définitions/situations en français
  correctPairs: [number, number][]; // Paires correctes (index gauche -> index droit)
}

/** Type pour un exercice de dictée */
interface DictationExercise {
  type: 'dictee';
  sentence: string; // Phrase à dicter
  words: string[]; // Mots individuels pour la correction
}

// ============================================================================
// TYPES UNION
// ============================================================================

/** Type pour l'exercice généré (union) */
type GeneratedExercise = 
  | GeneratedQCMExercise 
  | GeneratedTextExercise
  | TranslationExercise
  | OpenQuestionExercise
  | ReorderExercise
  | ConjugationExercise
  | DialogueCompletionExercise
  | AssociationExercise
  | DictationExercise;

/** Type pour la réponse de Mistral (génération) */
interface MistralExerciseResponse {
  questions?: QCMPQuestion[]; // Pour QCM (20 questions)
  exercise?: GeneratedTextExercise | TranslationExercise | OpenQuestionExercise | ReorderExercise | ConjugationExercise | DialogueCompletionExercise | AssociationExercise | DictationExercise;
}

/** Type pour une réponse utilisateur à une question QCM */
interface UserQCMAnswer {
  [questionIndex: number]: number | null; // index du choix sélectionné
}

/** Type pour les réponses de traduction */
interface TranslationAnswer {
  translation: string;
}

/** Type pour les réponses de questions ouvertes */
interface OpenQuestionAnswer {
  answer: string;
}

/** Type pour les réponses de remise en ordre */
interface ReorderAnswer {
  orderedWords: string[];
}

/** Type pour les réponses de conjugaison */
interface ConjugationAnswer {
  conjugatedForm: string;
}

/** Type pour les réponses de dialogue */
interface DialogueAnswer {
  filledBlanks: string[]; // Réponses pour chaque trou
}

/** Type pour les réponses d'association */
interface AssociationAnswer {
  pairs: [number, number][]; // Paires choisies par l'utilisateur
}

/** Type pour les réponses de dictée */
interface DictationAnswer {
  transcribedText: string;
}

/** Type pour la correction complète */
interface ExerciseCorrection {
  totalScore: number; // Score global sur 100
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
// TYPES POUR LES CORRECTIONS SPÉCIFIQUES
// ============================================================================

/** Correction pour la traduction */
interface TranslationCorrection {
  score: number;
  traductionCorrecte: string;
  erreurs: string[];
  conseils: string;
}

/** Correction pour les questions ouvertes */
interface OpenQuestionCorrection {
  score: number;
  retour: string;
  explicationComplete: string;
}

/** Correction pour la remise en ordre */
interface ReorderCorrection {
  score: number;
  isCorrect: boolean;
  correctSentence: string;
  grammaticalExplanation: string;
}

/** Correction pour la conjugaison */
interface ConjugationCorrection {
  score: number;
  isCorrect: boolean;
  correctForm: string;
  ruleExplanation: string;
}

/** Correction pour le dialogue */
interface DialogueCorrection {
  score: number;
  corrections: Array<{
    blankIndex: number;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
  }>;
}

/** Correction pour l'association */
interface AssociationCorrection {
  score: number;
  correctPairs: [number, number][];
  userPairs: [number, number][];
}

/** Correction pour la dictée */
interface DictationCorrection {
  score: number;
  wordCorrections: Array<{
    word: string;
    isCorrect: boolean;
    expected: string;
    actual: string;
  }>;
}

/** Type de source pour le thème */
type ThemeSource = 'cours' | 'libre';

/** Étapes du flux */
type ExerciseStep = 'select' | 'generating' | 'answering' | 'correcting' | 'saved';

/** Direction de traduction */
type TranslationDirection = 'fr-de' | 'de-fr';

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
  // Pour traduction
  const [translationDirection, setTranslationDirection] = useState<TranslationDirection>('fr-de');
  const [translationAnswer, setTranslationAnswer] = useState<string>('');
  const [translationCorrection, setTranslationCorrection] = useState<TranslationCorrection | null>(null);
  
  // Pour questions ouvertes
  const [openQuestionAnswer, setOpenQuestionAnswer] = useState<string>('');
  const [openQuestionCorrection, setOpenQuestionCorrection] = useState<OpenQuestionCorrection | null>(null);
  
  // Pour remise en ordre
  const [reorderSelected, setReorderSelected] = useState<string[]>([]);
  const [reorderCorrection, setReorderCorrection] = useState<ReorderCorrection | null>(null);
  
  // Pour conjugaison
  const [conjugationAnswer, setConjugationAnswer] = useState<string>('');
  const [conjugationCorrection, setConjugationCorrection] = useState<ConjugationCorrection | null>(null);
  
  // Pour dialogue
  const [dialogueAnswers, setDialogueAnswers] = useState<string[]>([]);
  const [dialogueCorrection, setDialogueCorrection] = useState<DialogueCorrection | null>(null);
  
  // Pour association
  const [associationPairs, setAssociationPairs] = useState<[number, number][]>([]);
  const [associationCorrection, setAssociationCorrection] = useState<AssociationCorrection | null>(null);
  
  // Pour dictée
  const [dictationAnswer, setDictationAnswer] = useState<string>('');
  const [dictationCorrection, setDictationCorrection] = useState<DictationCorrection | null>(null);
  const [isPlayingDictation, setIsPlayingDictation] = useState(false);
  
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
  // FONCTIONS UTILITAIRES
  // ==========================================================================

  /**
   * Retourne le titre de l'exercice selon son type
   */
  const getExerciseTitle = useCallback((type: ExerciceType): string => {
    switch (type) {
      case 'qcm': return 'QCM - 20 questions';
      case 'texteATrous': return 'Texte à trous';
      case 'traduction': return 'Traduction';
      case 'questionsOuvertes': return 'Question ouverte';
      case 'remiseEnOrdre': return 'Remise en ordre';
      case 'conjugaison': return 'Conjugaison';
      case 'completionDialogue': return 'Complétion de dialogue';
      case 'association': return 'Association';
      case 'dictee': return 'Dictée';
      case 'production': return 'Production écrite';
      default: return type;
    }
  }, []);

  /**
   * Vérifie si l'exercice est complet (toutes les réponses fournies)
   */
  const getIsExerciseComplete = useCallback((): boolean => {
    if (!generatedExercise) return true;
    
    switch (generatedExercise.type) {
      case 'qcm':
        return Object.keys(qcmAnswers).length < generatedExercise.questions.length || isLoading;
      case 'texteATrous':
        return !textAnswer.trim() || isLoading;
      case 'traduction':
        return !translationAnswer.trim() || isLoading;
      case 'questionsOuvertes':
        return !openQuestionAnswer.trim() || isLoading;
      case 'remiseEnOrdre':
        return reorderSelected.length !== generatedExercise.words.length || isLoading;
      case 'conjugaison':
        return !conjugationAnswer.trim() || isLoading;
      case 'completionDialogue':
        // Vérifier que tous les trous sont remplis
        const blanksFilled = generatedExercise.dialogue.every((line: any, index: number) => 
          !line.isBlank || (dialogueAnswers[index] && dialogueAnswers[index].trim())
        );
        return !blanksFilled || isLoading;
      case 'association':
        return associationPairs.length !== Math.min(generatedExercise.leftColumn.length, generatedExercise.rightColumn.length) || isLoading;
      case 'dictee':
        return !dictationAnswer.trim() || isLoading;
      case 'production':
        return !textAnswer.trim() || isLoading;
      default:
        return isLoading;
    }
  }, [generatedExercise, qcmAnswers, textAnswer, translationAnswer, openQuestionAnswer, reorderSelected, conjugationAnswer, dialogueAnswers, associationPairs, dictationAnswer, isLoading]);

  /**
   * Retourne le nombre de questions pour l'exercice
   */
  const getQuestionCount = useCallback((): number => {
    if (!generatedExercise) return 1;
    
    switch (generatedExercise.type) {
      case 'qcm': return generatedExercise.questions.length;
      default: return 1;
    }
  }, [generatedExercise]);

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

    if (type === 'traduction') {
      return `${basePrompt}
Crée un exercice de traduction basé sur le contenu ci-dessus.
- Génère UNE SEULE phrase à traduire (15-20 mots max)
- Direction : ${translationDirection === 'fr-de' ? 'Français → Allemand' : 'Allemand → Français'}
- La phrase doit utiliser du vocabulaire pertinent du contenu
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "traduction",
    "sentence": "[phrase à traduire]",
    "direction": "${translationDirection}",
    "correctTranslation": "[traduction correcte]",
    "context": "[contexte optionnel en français]"
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
    }

    if (type === 'questionsOuvertes') {
      return `${basePrompt}
Crée UNE SEULE question ouverte basée sur le contenu ci-dessus.
- La question doit être en allemand
- Elle doit porter sur un point grammatical, lexical ou culturel important
- Niveau adapté : ${niveauCECRL}

Exemples de questions :
- "Was ist der Unterschied zwischen 'haben' und 'sein' im Perfekt?"
- "Wie bildet man den Konjunktiv II von 'gehen'?"
- "Welche Präposition verwendet man mit 'interessiert'?"

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "questionsOuvertes",
    "question": "[question en allemand]",
    "expectedAnswer": "[réponse attendue en allemand]",
    "difficulty": "${niveauCECRL}"
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
    }

    if (type === 'remiseEnOrdre') {
      return `${basePrompt}
Crée un exercice de remise en ordre (Satzstellung) basé sur le contenu ci-dessus.
- Génère UNE phrase allemande de 5-8 mots
- Mélange les mots dans un ordre aléatoire
- La phrase doit illustrer une règle grammaticale importante
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "remiseEnOrdre",
    "words": ["[mot1]", "[mot2]", "[mot3]", ...],
    "correctOrder": ["[mot1]", "[mot2]", "[mot3]", ...],
    "sentence": "[phrase complète correcte]",
    "grammaticalRule": "[explication de la règle grammaticale en français]"
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
    }

    if (type === 'conjugaison') {
      return `${basePrompt}
Crée un exercice de conjugaison basé sur le contenu ci-dessus.
- Choisis un verbe courant en allemand
- Sélectionne un pronom (ich, du, er, sie, es, wir, ihr, sie, Sie)
- Choisis un temps (Präsens, Präteritum, Perfekt, Futur I, etc.)
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "conjugaison",
    "verb": "[verbe à l'infinitif]",
    "pronoun": "[pronom]",
    "tense": "[temps en allemand]",
    "correctForm": "[forme conjuguée correcte]",
    "ruleExplanation": "[explication de la règle en français]"
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
    }

    if (type === 'completionDialogue') {
      return `${basePrompt}
Crée un exercice de complétion de dialogue basé sur le contenu ci-dessus.
- Génère un mini-dialogue de 3-5 répliques
- 1-2 répliques doivent être des trous à remplir
- Le dialogue doit être naturel et contextuel
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "completionDialogue",
    "dialogue": [
      {"speaker": "A", "text": "[réplique de A]", "isBlank": false},
      {"speaker": "B", "text": "", "isBlank": true, "expectedAnswer": "[réponse attendue]"},
      {"speaker": "A", "text": "[réplique de A]", "isBlank": false},
      {"speaker": "B", "text": "", "isBlank": true, "expectedAnswer": "[réponse attendue]"}
    ],
    "context": "[contexte du dialogue en français]"
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
    }

    if (type === 'association') {
      return `${basePrompt}
Crée un exercice d'association (Zuordnung) basé sur le contenu ci-dessus.
- Génère 4-6 mots/expressions en allemand
- Génère 4-6 définitions/situations en français
- Chaque mot doit correspondre à une définition
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "association",
    "leftColumn": ["[mot1]", "[mot2]", "[mot3]", "[mot4]"],
    "rightColumn": ["[définition1]", "[définition2]", "[définition3]", "[définition4]"],
    "correctPairs": [[0, 0], [1, 1], [2, 2], [3, 3]]
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire. Les paires correctes doivent être des tableaux [index_gauche, index_droit].`;
    }

    if (type === 'dictee') {
      return `${basePrompt}
Crée un exercice de dictée (Diktat) basé sur le contenu ci-dessus.
- Génère UNE phrase courte en allemand (8-12 mots max)
- La phrase doit utiliser du vocabulaire du contenu
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercise": {
    "type": "dictee",
    "sentence": "[phrase à dicter]",
    "words": ["[mot1]", "[mot2]", ...]
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
    }
    
    // Pour les autres types
    return `${basePrompt}
Crée un exercice de type ${type}. Réponds avec un JSON valide.`;
  }, [getCurrentContext, niveauCECRL, translationDirection]);

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
        // Texte à trous ou autres types
        if (!data.exercise) {
          throw new Error('Réponse Mistral invalide : exercice manquant');
        }

        const exerciseData = data.exercise;

        switch (selectedType) {
          case 'texteATrous':
            exercise = {
              type: 'texteATrous',
              question: String(exerciseData.question || ''),
              textWithBlanks: String(exerciseData.textWithBlanks || ''),
              correctAnswer: Array.isArray(exerciseData.correctAnswer) 
                ? exerciseData.correctAnswer.map(String) 
                : [String(exerciseData.correctAnswer || '')],
              explanation: String(exerciseData.explanation || ''),
            };
            break;

          case 'traduction':
            exercise = {
              type: 'traduction',
              sentence: String(exerciseData.sentence || ''),
              direction: String(exerciseData.direction || 'fr-de'),
              correctTranslation: String(exerciseData.correctTranslation || ''),
              context: String(exerciseData.context || ''),
            };
            break;

          case 'questionsOuvertes':
            exercise = {
              type: 'questionsOuvertes',
              question: String(exerciseData.question || ''),
              expectedAnswer: String(exerciseData.expectedAnswer || ''),
              difficulty: String(exerciseData.difficulty || niveauCECRL),
            };
            break;

          case 'remiseEnOrdre':
            exercise = {
              type: 'remiseEnOrdre',
              words: Array.isArray(exerciseData.words) 
                ? exerciseData.words.map(String) 
                : [String(exerciseData.words || '')],
              correctOrder: Array.isArray(exerciseData.correctOrder) 
                ? exerciseData.correctOrder.map(String) 
                : [],
              sentence: String(exerciseData.sentence || ''),
              grammaticalRule: String(exerciseData.grammaticalRule || ''),
            };
            break;

          case 'conjugaison':
            exercise = {
              type: 'conjugaison',
              verb: String(exerciseData.verb || ''),
              pronoun: String(exerciseData.pronoun || ''),
              tense: String(exerciseData.tense || ''),
              correctForm: String(exerciseData.correctForm || ''),
              ruleExplanation: String(exerciseData.ruleExplanation || ''),
            };
            break;

          case 'completionDialogue':
            exercise = {
              type: 'completionDialogue',
              dialogue: Array.isArray(exerciseData.dialogue) 
                ? exerciseData.dialogue.map((d: any) => ({
                    speaker: String(d.speaker || ''),
                    text: String(d.text || ''),
                    isBlank: Boolean(d.isBlank || false),
                    expectedAnswer: String(d.expectedAnswer || ''),
                  }))
                : [],
              context: String(exerciseData.context || ''),
            };
            break;

          case 'association':
            exercise = {
              type: 'association',
              leftColumn: Array.isArray(exerciseData.leftColumn) 
                ? exerciseData.leftColumn.map(String) 
                : [],
              rightColumn: Array.isArray(exerciseData.rightColumn) 
                ? exerciseData.rightColumn.map(String) 
                : [],
              correctPairs: Array.isArray(exerciseData.correctPairs) 
                ? exerciseData.correctPairs.map((p: any) => [Number(p[0]), Number(p[1])])
                : [],
            };
            break;

          case 'dictee':
            exercise = {
              type: 'dictee',
              sentence: String(exerciseData.sentence || ''),
              words: Array.isArray(exerciseData.words) 
                ? exerciseData.words.map(String) 
                : [String(exerciseData.words || '')],
            };
            break;

          case 'production':
            // Production écrite (déjà existante)
            exercise = {
              type: 'production',
              question: String(exerciseData.question || ''),
              textWithBlanks: '',
              correctAnswer: [],
              explanation: String(exerciseData.explanation || ''),
            } as any;
            break;

          default:
            throw new Error(`Type d'exercice non implémenté : ${selectedType}`);
        }
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
   * Corrige la traduction via Mistral
   */
  const correctTranslationExercise = useCallback(async () => {
    if (!generatedExercise || generatedExercise.type !== 'traduction') return null;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige cette traduction.

---
Phrase à traduire: ${generatedExercise.sentence}
Direction: ${generatedExercise.direction}
Traduction de l'élève: ${translationAnswer}
Traduction correcte: ${generatedExercise.correctTranslation}
Niveau: ${niveauCECRL}
---

Évalue la traduction avec :
- Un score sur 100
- Les erreurs spécifiques
- Des conseils pour améliorer

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "traductionCorrecte": "[traduction correcte]",
  "erreurs": ["erreur1", "erreur2", ...],
  "conseils": "[conseils en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

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

      const data = await response.json();
      
      if (!data.score || data.score < 0 || data.score > 100) {
        throw new Error('Score invalide');
      }

      return {
        score: Number(data.score),
        traductionCorrecte: String(data.traductionCorrecte || generatedExercise.correctTranslation),
        erreurs: Array.isArray(data.erreurs) ? data.erreurs.map(String) : [],
        conseils: String(data.conseils || ''),
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger la traduction : ${errorMessage}`);
      setIsLoading(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [generatedExercise, translationAnswer, niveauCECRL]);

  /**
   * Corrige les questions ouvertes via Mistral
   */
  const correctOpenQuestionExercise = useCallback(async () => {
    if (!generatedExercise || generatedExercise.type !== 'questionsOuvertes') return null;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige cette réponse à une question ouverte.

---
Question: ${generatedExercise.question}
Réponse de l'élève: ${openQuestionAnswer}
Réponse attendue: ${generatedExercise.expectedAnswer}
Niveau: ${niveauCECRL}
---

Évalue la réponse avec :
- Un score sur 100
- Un retour détaillé sur la qualité de la réponse
- Une explication complète

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "retour": "[retour détaillé en français]",
  "explicationComplete": "[explication complète en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

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

      const data = await response.json();
      
      if (!data.score || data.score < 0 || data.score > 100) {
        throw new Error('Score invalide');
      }

      return {
        score: Number(data.score),
        retour: String(data.retour || ''),
        explicationComplete: String(data.explicationComplete || ''),
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger la question ouverte : ${errorMessage}`);
      setIsLoading(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [generatedExercise, openQuestionAnswer, niveauCECRL]);

  /**
   * Corrige la remise en ordre (correction automatique)
   */
  const correctReorderExercise = useCallback(() => {
    if (!generatedExercise || generatedExercise.type !== 'remiseEnOrdre') return null;

    const isCorrect = reorderSelected.join(',') === generatedExercise.correctOrder.join(',');
    const score = isCorrect ? 100 : 0;

    return {
      score,
      isCorrect,
      correctSentence: generatedExercise.sentence,
      grammaticalExplanation: generatedExercise.grammaticalRule,
    };
  }, [generatedExercise, reorderSelected]);

  /**
   * Corrige la conjugaison (correction automatique)
   */
  const correctConjugationExercise = useCallback(() => {
    if (!generatedExercise || generatedExercise.type !== 'conjugaison') return null;

    const isCorrect = conjugationAnswer.trim().toLowerCase() === generatedExercise.correctForm.toLowerCase();
    const score = isCorrect ? 100 : 0;

    return {
      score,
      isCorrect,
      correctForm: generatedExercise.correctForm,
      ruleExplanation: generatedExercise.ruleExplanation,
    };
  }, [generatedExercise, conjugationAnswer]);

  /**
   * Corrige le dialogue via Mistral
   */
  const correctDialogueExercise = useCallback(async () => {
    if (!generatedExercise || generatedExercise.type !== 'completionDialogue') return null;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige ce dialogue complété par l'élève.

---
Dialogue:
${generatedExercise.dialogue.map((d: any, i: number) => 
  `${d.speaker}: ${d.isBlank ? `[${dialogueAnswers[i] || '...'}]` : d.text}`
).join('\n')}

Réponses attendues:
${generatedExercise.dialogue.map((d: any, i: number) => 
  d.isBlank ? `${d.speaker}: ${d.expectedAnswer}` : ''
).filter(Boolean).join('\n')}
Niveau: ${niveauCECRL}
---

Évalue chaque trou avec :
- Un score global sur 100
- Pour chaque trou : si correct, la réponse de l'élève, la réponse attendue

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "corrections": [
    {"blankIndex": 0, "isCorrect": true/false, "userAnswer": "[réponse élève]", "correctAnswer": "[réponse attendue]"},
    ...
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

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

      const data = await response.json();
      
      if (!data.score || data.score < 0 || data.score > 100) {
        throw new Error('Score invalide');
      }

      return {
        score: Number(data.score),
        corrections: Array.isArray(data.corrections) 
          ? data.corrections.map((c: any) => ({
              blankIndex: Number(c.blankIndex),
              isCorrect: Boolean(c.isCorrect),
              userAnswer: String(c.userAnswer || ''),
              correctAnswer: String(c.correctAnswer || ''),
            }))
          : [],
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger le dialogue : ${errorMessage}`);
      setIsLoading(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [generatedExercise, dialogueAnswers, niveauCECRL]);

  /**
   * Corrige l'association (correction automatique)
   */
  const correctAssociationExercise = useCallback(() => {
    if (!generatedExercise || generatedExercise.type !== 'association') return null;

    let correctCount = 0;
    const totalPairs = Math.min(generatedExercise.leftColumn.length, generatedExercise.rightColumn.length);

    // Compter les paires correctes
    associationPairs.forEach(([leftIndex, rightIndex]) => {
      const isCorrect = generatedExercise.correctPairs.some(
        ([correctLeft, correctRight]) => correctLeft === leftIndex && correctRight === rightIndex
      );
      if (isCorrect) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / Math.max(totalPairs, 1)) * 100);

    return {
      score,
      correctPairs: generatedExercise.correctPairs,
      userPairs: associationPairs,
    };
  }, [generatedExercise, associationPairs]);

  /**
   * Corrige la dictée via Mistral
   */
  const correctDictationExercise = useCallback(async () => {
    if (!generatedExercise || generatedExercise.type !== 'dictee') return null;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige cette dictée.

---
Phrase à dicter: ${generatedExercise.sentence}
Texte de l'élève: ${dictationAnswer}
Mots attendus: ${generatedExercise.words.join(', ')}
Niveau: ${niveauCECRL}
---

Corrige mot par mot et donne :
- Un score global sur 100
- Pour chaque mot : si correct, le mot attendu, le mot écrit par l'élève

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "wordCorrections": [
    {"word": "[mot attendu]", "isCorrect": true/false, "expected": "[mot attendu]", "actual": "[mot écrit par l'élève]"},
    ...
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

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

      const data = await response.json();
      
      if (!data.score || data.score < 0 || data.score > 100) {
        throw new Error('Score invalide');
      }

      return {
        score: Number(data.score),
        wordCorrections: Array.isArray(data.wordCorrections) 
          ? data.wordCorrections.map((wc: any) => ({
              word: String(wc.word || ''),
              isCorrect: Boolean(wc.isCorrect),
              expected: String(wc.expected || ''),
              actual: String(wc.actual || ''),
            }))
          : [],
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger la dictée : ${errorMessage}`);
      setIsLoading(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [generatedExercise, dictationAnswer, niveauCECRL]);

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

      switch (generatedExercise.type) {
        case 'qcm':
          correctionResult = correctQCMExercise();
          break;
        case 'texteATrous':
          correctionResult = correctTextExercise();
          break;
        case 'traduction':
          const translationCorrection = await correctTranslationExercise();
          if (translationCorrection) {
            setTranslationCorrection(translationCorrection);
            // Convertir en ExerciseCorrection pour la compatibilité
            correctionResult = {
              totalScore: translationCorrection.score,
              totalQuestions: 1,
              correctCount: translationCorrection.score >= 50 ? 1 : 0,
              corrections: [{
                questionIndex: 0,
                isCorrect: translationCorrection.score >= 50,
                userAnswer: translationAnswer,
                correctAnswer: translationCorrection.traductionCorrecte,
                explanation: `${translationCorrection.erreurs.join('; ')}. ${translationCorrection.conseils}`,
              }],
            };
          }
          break;
        case 'questionsOuvertes':
          const openCorrection = await correctOpenQuestionExercise();
          if (openCorrection) {
            setOpenQuestionCorrection(openCorrection);
            correctionResult = {
              totalScore: openCorrection.score,
              totalQuestions: 1,
              correctCount: openCorrection.score >= 50 ? 1 : 0,
              corrections: [{
                questionIndex: 0,
                isCorrect: openCorrection.score >= 50,
                userAnswer: openQuestionAnswer,
                correctAnswer: generatedExercise.expectedAnswer,
                explanation: openCorrection.explicationComplete,
              }],
            };
          }
          break;
        case 'remiseEnOrdre':
          const reorderCorrection = correctReorderExercise();
          if (reorderCorrection) {
            setReorderCorrection(reorderCorrection);
            correctionResult = {
              totalScore: reorderCorrection.score,
              totalQuestions: 1,
              correctCount: reorderCorrection.isCorrect ? 1 : 0,
              corrections: [{
                questionIndex: 0,
                isCorrect: reorderCorrection.isCorrect,
                userAnswer: reorderSelected.join(' '),
                correctAnswer: generatedExercise.sentence,
                explanation: reorderCorrection.grammaticalExplanation,
              }],
            };
          }
          break;
        case 'conjugaison':
          const conjugationCorrection = correctConjugationExercise();
          if (conjugationCorrection) {
            setConjugationCorrection(conjugationCorrection);
            correctionResult = {
              totalScore: conjugationCorrection.score,
              totalQuestions: 1,
              correctCount: conjugationCorrection.isCorrect ? 1 : 0,
              corrections: [{
                questionIndex: 0,
                isCorrect: conjugationCorrection.isCorrect,
                userAnswer: conjugationAnswer,
                correctAnswer: conjugationCorrection.correctForm,
                explanation: conjugationCorrection.ruleExplanation,
              }],
            };
          }
          break;
        case 'completionDialogue':
          const dialogueCorrection = await correctDialogueExercise();
          if (dialogueCorrection) {
            setDialogueCorrection(dialogueCorrection);
            correctionResult = {
              totalScore: dialogueCorrection.score,
              totalQuestions: dialogueCorrection.corrections.length,
              correctCount: dialogueCorrection.corrections.filter(c => c.isCorrect).length,
              corrections: dialogueCorrection.corrections.map((c, i) => ({
                questionIndex: i,
                isCorrect: c.isCorrect,
                userAnswer: c.userAnswer,
                correctAnswer: c.correctAnswer,
                explanation: '',
              })),
            };
          }
          break;
        case 'association':
          const associationCorrection = correctAssociationExercise();
          if (associationCorrection) {
            setAssociationCorrection(associationCorrection);
            correctionResult = {
              totalScore: associationCorrection.score,
              totalQuestions: associationCorrection.correctPairs.length,
              correctCount: associationCorrection.correctPairs.filter((_, i) => 
                associationCorrection.userPairs.some(u => 
                  u[0] === associationCorrection.correctPairs[i][0] && 
                  u[1] === associationCorrection.correctPairs[i][1]
                )
              ).length,
              corrections: associationCorrection.correctPairs.map((_, i) => ({
                questionIndex: i,
                isCorrect: associationCorrection.userPairs.some(u => 
                  u[0] === associationCorrection.correctPairs[i][0] && 
                  u[1] === associationCorrection.correctPairs[i][1]
                ),
                userAnswer: '',
                correctAnswer: '',
                explanation: '',
              })),
            };
          }
          break;
        case 'dictee':
          const dictationCorrection = await correctDictationExercise();
          if (dictationCorrection) {
            setDictationCorrection(dictationCorrection);
            correctionResult = {
              totalScore: dictationCorrection.score,
              totalQuestions: dictationCorrection.wordCorrections.length,
              correctCount: dictationCorrection.wordCorrections.filter(w => w.isCorrect).length,
              corrections: dictationCorrection.wordCorrections.map((wc, i) => ({
                questionIndex: i,
                isCorrect: wc.isCorrect,
                userAnswer: wc.actual,
                correctAnswer: wc.expected,
                explanation: '',
              })),
            };
          }
          break;
        case 'production':
        default:
          // Correction par défaut
          correctionResult = correctTextExercise();
          break;
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
  }, [
    generatedExercise, 
    correctQCMExercise, 
    correctTextExercise,
    correctTranslationExercise,
    correctOpenQuestionExercise,
    correctReorderExercise,
    correctConjugationExercise,
    correctDialogueExercise,
    correctAssociationExercise,
    correctDictationExercise,
    translationAnswer,
    openQuestionAnswer,
    reorderSelected,
    conjugationAnswer,
    dialogueAnswers,
    associationPairs,
    dictationAnswer
  ]);

  // ==========================================================================
  // SAUVEGARDE
  // ==========================================================================

  /**
   * Sauvegarde l'exercice et son résultat
   */
  const saveExercise = useCallback(() => {
    if (!generatedExercise || !correction) return null;

    try {
      let contenuJSON: Record<string, unknown>;
      let score: number;
      let reponseUtilisateur: unknown;
      let correctionText: string;

      score = correction.totalScore;

      switch (generatedExercise.type) {
        case 'qcm':
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
          reponseUtilisateur = JSON.stringify(qcmAnswers);
          correctionText = `Score: ${score}/100 - ${correction.correctCount}/${correction.totalQuestions} bonnes réponses`;
          break;

        case 'texteATrous':
          contenuJSON = {
            type: 'texteATrous',
            question: generatedExercise.question,
            textWithBlanks: generatedExercise.textWithBlanks,
            correctAnswer: generatedExercise.correctAnswer,
          };
          reponseUtilisateur = textAnswer;
          correctionText = `Score: ${score}/100 - ${correction.correctCount}/${correction.totalQuestions} bonnes réponses`;
          break;

        case 'traduction':
          contenuJSON = {
            type: 'traduction',
            sentence: generatedExercise.sentence,
            direction: generatedExercise.direction,
            correctTranslation: generatedExercise.correctTranslation,
          };
          reponseUtilisateur = translationAnswer;
          correctionText = `Score: ${score}/100 - ${translationCorrection?.erreurs?.join('; ') || 'Voir détails'}`;
          break;

        case 'questionsOuvertes':
          contenuJSON = {
            type: 'questionsOuvertes',
            question: generatedExercise.question,
            expectedAnswer: generatedExercise.expectedAnswer,
          };
          reponseUtilisateur = openQuestionAnswer;
          correctionText = `Score: ${score}/100 - ${openQuestionCorrection?.retour || 'Voir détails'}`;
          break;

        case 'remiseEnOrdre':
          contenuJSON = {
            type: 'remiseEnOrdre',
            words: generatedExercise.words,
            correctOrder: generatedExercise.correctOrder,
            sentence: generatedExercise.sentence,
          };
          reponseUtilisateur = reorderSelected;
          correctionText = `Score: ${score}/100 - ${reorderCorrection?.isCorrect ? 'Correct' : 'Incorrect'}`;
          break;

        case 'conjugaison':
          contenuJSON = {
            type: 'conjugaison',
            verb: generatedExercise.verb,
            pronoun: generatedExercise.pronoun,
            tense: generatedExercise.tense,
            correctForm: generatedExercise.correctForm,
          };
          reponseUtilisateur = conjugationAnswer;
          correctionText = `Score: ${score}/100 - ${conjugationCorrection?.isCorrect ? 'Correct' : 'Incorrect'}`;
          break;

        case 'completionDialogue':
          contenuJSON = {
            type: 'completionDialogue',
            dialogue: generatedExercise.dialogue,
            context: generatedExercise.context,
          };
          reponseUtilisateur = dialogueAnswers;
          correctionText = `Score: ${score}/100 - ${correction.correctCount}/${correction.totalQuestions} bonnes réponses`;
          break;

        case 'association':
          contenuJSON = {
            type: 'association',
            leftColumn: generatedExercise.leftColumn,
            rightColumn: generatedExercise.rightColumn,
            correctPairs: generatedExercise.correctPairs,
          };
          reponseUtilisateur = associationPairs;
          correctionText = `Score: ${score}/100 - ${associationCorrection?.score || score}/100`;
          break;

        case 'dictee':
          contenuJSON = {
            type: 'dictee',
            sentence: generatedExercise.sentence,
            words: generatedExercise.words,
          };
          reponseUtilisateur = dictationAnswer;
          correctionText = `Score: ${score}/100 - ${dictationCorrection?.wordCorrections?.filter(w => w.isCorrect).length || 0}/${dictationCorrection?.wordCorrections?.length || 1} mots corrects`;
          break;

        case 'production':
        default:
          contenuJSON = {
            type: generatedExercise.type,
            question: (generatedExercise as any).question,
          };
          reponseUtilisateur = textAnswer;
          correctionText = `Score: ${score}/100`;
          break;
      }

      // Sauvegarder via storage
      const newExercice = addExercice({
        type: generatedExercise.type,
        leconsAssociees: themeSource === 'cours' && selectedLecon ? [selectedLecon.id] : [],
        contenuJSON,
        reponseUtilisateur,
        correction: correctionText,
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
  }, [
    generatedExercise, 
    correction, 
    selectedLecon, 
    qcmAnswers, 
    textAnswer, 
    themeSource,
    translationAnswer,
    openQuestionAnswer,
    reorderSelected,
    conjugationAnswer,
    dialogueAnswers,
    associationPairs,
    dictationAnswer,
    translationCorrection,
    openQuestionCorrection,
    reorderCorrection,
    conjugationCorrection,
    associationCorrection,
    dictationCorrection
  ]);

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
                <option value="traduction">Traduction</option>
                <option value="questionsOuvertes">Questions ouvertes</option>
                <option value="remiseEnOrdre">Remise en ordre</option>
                <option value="conjugaison">Conjugaison</option>
                <option value="completionDialogue">Complétion de dialogue</option>
                <option value="association">Association</option>
                <option value="dictee">Dictée</option>
                <option value="production">Production écrite</option>
              </select>
              {selectedType === 'qcm' && (
                <p className="text-xs text-gray-500 mt-1">
                  20 questions à choix multiples générées automatiquement
                </p>
              )}
              {selectedType === 'texteATrous' && (
                <p className="text-xs text-gray-500 mt-1">
                  Complétez les trous dans un texte
                </p>
              )}
              {selectedType === 'traduction' && (
                <div className="mt-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="radio"
                      name="translationDirection"
                      value="fr-de"
                      checked={translationDirection === 'fr-de'}
                      onChange={(e) => setTranslationDirection(e.target.value as TranslationDirection)}
                      className="h-3 w-3 text-blue-600"
                    />
                    <span>Français → Allemand</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="radio"
                      name="translationDirection"
                      value="de-fr"
                      checked={translationDirection === 'de-fr'}
                      onChange={(e) => setTranslationDirection(e.target.value as TranslationDirection)}
                      className="h-3 w-3 text-blue-600"
                    />
                    <span>Allemand → Français</span>
                  </label>
                </div>
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
                {getExerciseTitle(generatedExercise.type)}
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

            {/* TRADUCTION */}
            {generatedExercise.type === 'traduction' && (
              <div className="bg-purple-50 p-4 rounded-md space-y-4">
                <div className="flex items-center gap-2 text-purple-700">
                  <span className="font-medium">
                    {generatedExercise.direction === 'fr-de' ? 'Français → Allemand' : 'Allemand → Français'}
                  </span>
                </div>
                <p className="text-lg text-purple-800 bg-white p-3 rounded-md">
                  {generatedExercise.sentence}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Votre traduction
                  </label>
                  <textarea
                    value={translationAnswer}
                    onChange={(e) => setTranslationAnswer(e.target.value)}
                    placeholder={`Traduisez la phrase ci-dessus en ${generatedExercise.direction === 'fr-de' ? 'allemand' : 'français'}...`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[100px]"
                    rows={4}
                  />
                </div>
                {generatedExercise.context && (
                  <p className="text-xs text-purple-500">{generatedExercise.context}</p>
                )}
              </div>
            )}

            {/* QUESTIONS OUVERTES */}
            {generatedExercise.type === 'questionsOuvertes' && (
              <div className="bg-green-50 p-4 rounded-md space-y-4">
                <p className="text-lg text-green-800 bg-white p-3 rounded-md">
                  {generatedExercise.question}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ihre Antwort (Répondez en allemand)
                  </label>
                  <textarea
                    value={openQuestionAnswer}
                    onChange={(e) => setOpenQuestionAnswer(e.target.value)}
                    placeholder="Schreiben Sie Ihre Antwort hier auf Deutsch..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[120px]"
                    rows={5}
                  />
                </div>
                <p className="text-xs text-green-600">
                  Niveau: {generatedExercise.difficulty}
                </p>
              </div>
            )}

            {/* REMISE EN ORDRE */}
            {generatedExercise.type === 'remiseEnOrdre' && (
              <div className="bg-orange-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-orange-800">
                  Remettez les mots dans l'ordre pour former une phrase correcte
                </h3>
                <p className="text-sm text-orange-600">
                  {generatedExercise.grammaticalRule}
                </p>
                <div className="bg-white p-4 rounded-md border border-orange-200">
                  <div className="text-center mb-4">
                    <strong>Mots disponibles :</strong>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {generatedExercise.words.map((word, index) => {
                      const isSelected = reorderSelected.includes(word);
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            if (isSelected) {
                              // Retirer du sélection
                              setReorderSelected(prev => prev.filter(w => w !== word));
                            } else {
                              // Ajouter au sélection
                              setReorderSelected(prev => [...prev, word]);
                            }
                          }}
                          className={`px-3 py-2 rounded-md border-2 transition-colors
                            ${isSelected 
                              ? 'bg-orange-100 border-orange-500 text-orange-800' 
                              : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300'}`}
                        >
                          {word}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 text-center">
                    <strong>Votre phrase :</strong>
                    <p className="text-orange-700 mt-2 min-h-[40px]">
                      {reorderSelected.length > 0 ? reorderSelected.join(' ') : 'Sélectionnez les mots dans le bon ordre'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CONJUGAISON */}
            {generatedExercise.type === 'conjugaison' && (
              <div className="bg-blue-50 p-4 rounded-md space-y-4">
                <p className="text-lg text-blue-800">
                  Conjuguez le verbe &laquo;{generatedExercise.verb}&raquo; avec le pronom &laquo;{generatedExercise.pronoun}&raquo; au {generatedExercise.tense}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Votre réponse
                  </label>
                  <input
                    type="text"
                    value={conjugationAnswer}
                    onChange={(e) => setConjugationAnswer(e.target.value)}
                    placeholder="Ex: gehe, ging, bin gegangen..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg"
                  />
                </div>
                <p className="text-sm text-blue-600">
                  {generatedExercise.ruleExplanation}
                </p>
              </div>
            )}

            {/* COMPLÉTION DE DIALOGUE */}
            {generatedExercise.type === 'completionDialogue' && (
              <div className="bg-pink-50 p-4 rounded-md space-y-4">
                <p className="text-lg text-pink-800">{generatedExercise.context}</p>
                <div className="bg-white p-4 rounded-md border border-pink-200 space-y-4">
                  {generatedExercise.dialogue.map((line: any, index) => (
                    <div key={index} className="flex gap-3">
                      <span className="font-medium text-pink-600 w-8">{line.speaker} :</span>
                      {line.isBlank ? (
                        <input
                          type="text"
                          value={dialogueAnswers[index] || ''}
                          onChange={(e) => {
                            const newAnswers = [...dialogueAnswers];
                            newAnswers[index] = e.target.value;
                            setDialogueAnswers(newAnswers);
                          }}
                          placeholder="Votre réponse..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        />
                      ) : (
                        <span className="flex-1 py-2 text-gray-700">{line.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ASSOCIATION */}
            {generatedExercise.type === 'association' && (
              <div className="bg-indigo-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-indigo-800">
                  Associez chaque mot/expression à sa définition
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-md border border-indigo-200">
                    <h4 className="font-medium text-indigo-700 mb-2">Allemagne</h4>
                    <div className="space-y-2">
                      {generatedExercise.leftColumn.map((word, index) => (
                        <div key={index} className="p-2 bg-indigo-50 rounded-md text-indigo-800">
                          {word}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-indigo-200">
                    <h4 className="font-medium text-indigo-700 mb-2">Définitions</h4>
                    <div className="space-y-2">
                      {generatedExercise.rightColumn.map((def, index) => (
                        <div key={index} className="p-2 bg-indigo-50 rounded-md text-indigo-800">
                          {def}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-md border border-indigo-200">
                  <h4 className="font-medium text-indigo-700 mb-3">
                    Faites glisser ou cliquez pour associer
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {generatedExercise.leftColumn.map((leftWord, leftIndex) => (
                      <select
                        key={leftIndex}
                        value={associationPairs.find(p => p[0] === leftIndex)?.[1] || ''}
                        onChange={(e) => {
                          const rightIndex = Number(e.target.value);
                          const newPairs = associationPairs.filter(p => p[0] !== leftIndex);
                          if (rightIndex !== -1) {
                            newPairs.push([leftIndex, rightIndex]);
                          }
                          setAssociationPairs(newPairs);
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">-- Sélectionner --</option>
                        {generatedExercise.rightColumn.map((_, rightIndex) => (
                          <option key={rightIndex} value={rightIndex}>
                            {generatedExercise.rightColumn[rightIndex]}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DICTÉE */}
            {generatedExercise.type === 'dictee' && (
              <div className="bg-red-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-red-800">
                  Dictée - Écoutez et écrivez
                </h3>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const utterance = new SpeechSynthesisUtterance(generatedExercise.sentence);
                        utterance.lang = 'de-DE';
                        utterance.rate = 0.7;
                        utterance.onstart = () => setIsPlayingDictation(true);
                        utterance.onend = () => setIsPlayingDictation(false);
                        window.speechSynthesis.speak(utterance);
                      }
                    }}
                    disabled={isPlayingDictation}
                    className={`px-4 py-2 rounded-md text-white font-medium transition-colors
                      ${isPlayingDictation ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 cursor-pointer'}`}
                  >
                    {isPlayingDictation ? '⏳ Lecture en cours...' : '🔊 Écouter la phrase'}
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.speechSynthesis.cancel();
                        setIsPlayingDictation(false);
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    ⏹ Arrêter
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Écrivez ce que vous entendez
                  </label>
                  <textarea
                    value={dictationAnswer}
                    onChange={(e) => setDictationAnswer(e.target.value)}
                    placeholder="Écrivez la phrase en allemand..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                    rows={4}
                  />
                </div>
                <p className="text-xs text-red-600">
                  Conseils : écoutez attentivement, notez les mots que vous comprenez, puis écoutez à nouveau.
                </p>
              </div>
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
                disabled={getIsExerciseComplete()}
                className={`px-6 py-2 rounded-md text-white font-medium flex-1 
                  ${!getIsExerciseComplete() 
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
                  `Valider mes réponses (${getQuestionCount()} question${getQuestionCount() > 1 ? 's' : ''})`
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
