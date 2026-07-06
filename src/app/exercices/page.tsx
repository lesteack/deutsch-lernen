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

/** Type pour un exercice de production écrite */
interface ProductionExercise {
  type: 'production';
  question: string;
  textWithBlanks?: string;
  correctAnswer?: string[];
  explanation?: string;
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
  | DictationExercise
  | ProductionExercise
  | GenreExercise
  | GenreTextExercise
  | CasGrammaticalExercise;

// ==========================================================================
// NOUVEAUX TYPES POUR LES EXERCICES DE GENRE (der/die/das)
// ==========================================================================

/** Type pour un mot avec son article (exercice de genre - Mode A) */
interface GenreWord {
  nom: string;
  article: 'der' | 'die' | 'das' | 'die (pluriel)';
  traduction: string;
  astuce: string;
}

/** Type pour l'exercice de genre - Mode A (choix du déterminant) */
interface GenreExercise {
  type: 'genre';
  mots: GenreWord[];
}

/** Type pour un trou dans le texte à trous avec déterminants */
interface GenreTextGap {
  position: number;
  bonneReponse: 'Der' | 'Die' | 'Das' | 'Die';
  options: ('Der' | 'Die' | 'Das' | 'Die')[];
}

/** Type pour une phrase avec trous (exercice de genre - Mode B) */
interface GenreTextPhrase {
  texte: string;
  trous: GenreTextGap[];
}

/** Type pour l'exercice de genre - Mode B (texte à trous avec déterminants) */
interface GenreTextExercise {
  type: 'genre_texte';
  phrases: GenreTextPhrase[];
}

// ==========================================================================
// NOUVEAUX TYPES POUR LES EXERCICES DE CAS GRAMMATICAUX
// ==========================================================================

/** Type pour les cas grammaticaux */
type GrammaticalCase = 'Nominatif' | 'Accusatif' | 'Datif' | 'Génitif';

/** Type pour les fonctions grammaticales */
type GrammaticalFunction = 'Sujet' | 'COD' | 'COI' | 'Complément du nom';

/** Type pour une question d'identification de fonction (sous-exercice A) */
interface IdentifyFunctionQuestion {
  phrase: string;
  motEnEvidence: string;
  bonneReponse: GrammaticalFunction;
  cas: GrammaticalCase;
  explication: string;
  choix: GrammaticalFunction[];
}

/** Type pour l'exercice d'identification de fonction */
interface IdentifyFunctionExercise {
  type: 'identifier_fonction';
  questions: IdentifyFunctionQuestion[];
}

/** Type pour une question de choix de déterminant (sous-exercice B) */
interface ChooseDeterminantQuestion {
  phrase: string;
  fonction: string;
  genre: 'masculin' | 'féminin' | 'neutre' | 'pluriel';
  bonneReponse: string;
  choix: string[];
  explication: string;
}

/** Type pour l'exercice de choix de déterminant */
interface ChooseDeterminantExercise {
  type: 'choisir_determinant';
  questions: ChooseDeterminantQuestion[];
}

/** Type pour une cellule de déclinaison */
interface DeclensionCell {
  value: string;
  isVisible: boolean;
  isCorrect?: boolean;
  userAnswer?: string;
}

/** Type pour une ligne de déclinaison */
interface DeclensionRow {
  genre: 'Masculin' | 'Féminin' | 'Neutre' | 'Pluriel';
  nominatif: DeclensionCell;
  accusatif: DeclensionCell;
  datif: DeclensionCell;
  genitif: DeclensionCell;
}

/** Type pour l'exercice de tableau de déclinaison */
interface DeclensionTableExercise {
  type: 'tableau_declinaison';
  rows: DeclensionRow[];
}

/** Type union pour les exercices de cas grammaticaux */
type CasGrammaticalExercise = IdentifyFunctionExercise | ChooseDeterminantExercise | DeclensionTableExercise;

/** Type pour la réponse de Mistral (génération) */
interface MistralExerciseResponse {
  questions?: QCMPQuestion[]; // Pour QCM (20 questions)
  exercise?: GeneratedTextExercise | TranslationExercise | OpenQuestionExercise | ReorderExercise | ConjugationExercise | DialogueCompletionExercise | AssociationExercise | DictationExercise | GenreExercise | GenreTextExercise | CasGrammaticalExercise;
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
  const [selectedLecons, setSelectedLecons] = useState<Lecon[]>([]);
  const [leconFilter, setLeconFilter] = useState<'tous' | Lecon['type']>('tous');
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
  
  // ==========================================================================
  // NOUVEAUX ÉTATS POUR LES EXERCICES DE GENRE
  // ==========================================================================
  
  // Pour genre (choix du déterminant)
  const [genreAnswers, setGenreAnswers] = useState<Record<number, string | undefined>>({});
  const [genreScore, setGenreScore] = useState<number>(0);
  
  // Pour genre_texte (texte à trous avec déterminants)
  const [genreTextAnswers, setGenreTextAnswers] = useState<Record<number, Record<number, string>>>({});
  const [genreTextScore, setGenreTextScore] = useState<number>(0);
  
  // ==========================================================================
  // NOUVEAUX ÉTATS POUR LES EXERCICES DE CAS GRAMMATICAUX
  // ==========================================================================
  
  // Pour identifier_fonction
  const [functionIdentificationAnswers, setFunctionIdentificationAnswers] = useState<Record<number, GrammaticalFunction | undefined>>({});
  const [functionIdentificationScore, setFunctionIdentificationScore] = useState<number>(0);
  
  // Pour choisir_determinant
  const [determinantChoiceAnswers, setDeterminantChoiceAnswers] = useState<Record<number, string | undefined>>({});
  const [determinantChoiceScore, setDeterminantChoiceScore] = useState<number>(0);
  
  // Pour tableau_declinaison
  const [declensionTableAnswers, setDeclensionTableAnswers] = useState<Record<string, Record<string, string>>>({});
  const [declensionTableScore, setDeclensionTableScore] = useState<number>(0);
  
  // ==========================================================================
  // ÉTAT POUR LE PANNEAU AIDE-MÉMOIRE
  // ==========================================================================
  
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  
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
      setSelectedLecons([allLecons[randomIndex]]);
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
      case 'genre': return 'Genre des noms (der/die/das)';
      case 'genre_texte': return 'Genre - Texte à trous';
      case 'identifier_fonction': return 'Cas grammaticaux - Identifier fonction';
      case 'choisir_determinant': return 'Cas grammaticaux - Choisir déterminant';
      case 'tableau_declinaison': return 'Cas grammaticaux - Tableau de déclinaison';
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
      
      // ==========================================================================
      // NOUVEAUX EXERCICES : GENRE
      // ==========================================================================
      
      case 'genre':
        return Object.keys(genreAnswers).length < generatedExercise.mots.length || isLoading;
      
      case 'genre_texte':
        // Vérifier que toutes les réponses pour toutes les phrases sont fournies
        let allFilled = true;
        generatedExercise.phrases.forEach((phrase: any, phraseIndex: number) => {
          phrase.trous.forEach((trou: any, trouIndex: number) => {
            if (!genreTextAnswers[phraseIndex]?.[trouIndex]) {
              allFilled = false;
            }
          });
        });
        return !allFilled || isLoading;
      
      // ==========================================================================
      // NOUVEAUX EXERCICES : CAS GRAMMATICAUX
      // ==========================================================================
      
      case 'identifier_fonction':
        return Object.keys(functionIdentificationAnswers).length < generatedExercise.questions.length || isLoading;
      
      case 'choisir_determinant':
        return Object.keys(determinantChoiceAnswers).length < generatedExercise.questions.length || isLoading;
      
      case 'tableau_declinaison':
        // Vérifier que toutes les cellules cachées sont remplies
        let allDeclensionFilled = true;
        generatedExercise.rows.forEach((row: any) => {
          ['nominatif', 'accusatif', 'datif', 'genitif'].forEach((cas: string) => {
            const cell = row[cas as 'nominatif' | 'accusatif' | 'datif' | 'genitif'];
            if (!cell.isVisible && !declensionTableAnswers[row.genre]?.[cas]) {
              allDeclensionFilled = false;
            }
          });
        });
        return !allDeclensionFilled || isLoading;
      
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
      case 'production': return 1;
      case 'genre': return generatedExercise.mots.length;
      case 'genre_texte': 
        return generatedExercise.phrases.reduce((count: number, phrase: any) => 
          count + phrase.trous.length, 0);
      case 'identifier_fonction': return generatedExercise.questions.length;
      case 'choisir_determinant': return generatedExercise.questions.length;
      case 'tableau_declinaison': 
        return generatedExercise.rows.reduce((count: number, row: any) => {
          let rowCount = 0;
          ['nominatif', 'accusatif', 'datif', 'genitif'].forEach((cas: string) => {
            const cell = row[cas as 'nominatif' | 'accusatif' | 'datif' | 'genitif'];
            if (!cell.isVisible) rowCount++;
          });
          return count + rowCount;
        }, 0);
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
    if (themeSource === 'cours' && selectedLecons.length > 0) {
      // Concaténer les contenus des leçons sélectionnées
      const leconsContent = selectedLecons.map(lecon => 
        `[Leçon - ${lecon.titre}] : ${lecon.contenuTexte}`
      ).join('\n\n');
      
      const leconsTitles = selectedLecons.map(l => l.titre).join(', ');
      
      return {
        type: 'lecon',
        value: leconsContent,
        title: `Basé sur : ${leconsTitles}`,
      };
    } else {
      const finalTheme = customTheme.trim() || selectedTheme;
      return {
        type: 'theme',
        value: finalTheme,
        title: `Thème : ${finalTheme}`,
      };
    }
  }, [themeSource, selectedLecons, selectedTheme, customTheme]);

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

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "qcm",
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

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "qcm".`;
    }
    
    if (type === 'texteATrous') {
      return `${basePrompt}
Crée un exercice de texte à trous basé sur le contenu ci-dessus.
- Prends une phrase ou un court paragraphe du texte
- Remplace 1 à 3 mots par des trous (_____)
- Le niveau doit correspondre à ${niveauCECRL}
- Les trous doivent porter sur des notions importantes

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "texteATrous",
  "question": "[consigne en français]",
  "textWithBlanks": "[texte avec des _____ pour les trous]",
  "correctAnswer": ["mot1", "mot2", ...],
  "explanation": "[explication en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "texteATrous".`;
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
  "exercice": "traduction",
  "sentence": "[phrase à traduire]",
  "direction": "${translationDirection}",
  "correctTranslation": "[traduction correcte]",
  "context": "[contexte optionnel en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "traduction".`;
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
  "exercice": "questionsOuvertes",
  "question": "[question en allemand]",
  "expectedAnswer": "[réponse attendue en allemand]",
  "difficulty": "${niveauCECRL}"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "questionsOuvertes".`;
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
  "exercice": "remiseEnOrdre",
  "words": ["[mot1]", "[mot2]", "[mot3]", ...],
  "correctOrder": ["[mot1]", "[mot2]", "[mot3]", ...],
  "sentence": "[phrase complète correcte]",
  "grammaticalRule": "[explication de la règle grammaticale en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "remiseEnOrdre".`;
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
  "exercice": "conjugaison",
  "verb": "[verbe à l'infinitif]",
  "pronoun": "[pronom]",
  "tense": "[temps en allemand]",
  "correctForm": "[forme conjuguée correcte]",
  "ruleExplanation": "[explication de la règle en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "conjugaison".`;
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
  "exercice": "completionDialogue",
  "dialogue": [
    {"speaker": "A", "text": "[réplique de A]", "isBlank": false},
    {"speaker": "B", "text": "", "isBlank": true, "expectedAnswer": "[réponse attendue]"},
    {"speaker": "A", "text": "[réplique de A]", "isBlank": false},
    {"speaker": "B", "text": "", "isBlank": true, "expectedAnswer": "[réponse attendue]"}
  ],
  "context": "[contexte du dialogue en français]"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "completionDialogue".`;
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
  "exercice": "association",
  "leftColumn": ["[mot1]", "[mot2]", "[mot3]", "[mot4]"],
  "rightColumn": ["[définition1]", "[définition2]", "[définition3]", "[définition4]"],
  "correctPairs": [[0, 0], [1, 1], [2, 2], [3, 3]]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "association".
Les paires correctes doivent être des tableaux [index_gauche, index_droit].`;
    }

    if (type === 'dictee') {
      return `${basePrompt}
Crée un exercice de dictée (Diktat) basé sur le contenu ci-dessus.
- Génère UNE phrase courte en allemand (8-12 mots max)
- La phrase doit utiliser du vocabulaire du contenu
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "dictee",
  "sentence": "[phrase à dicter]",
  "words": ["[mot1]", "[mot2]", ...]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "dictee".`;
    }

    // ==========================================================================
    // NOUVEAUX EXERCICES : GENRE DES NOMS (der/die/das)
    // ==========================================================================

    if (type === 'genre') {
      return `${basePrompt}
Crée un exercice de genre des noms (der/die/das) basé sur le contenu ci-dessus.
- Génère EXACTEMENT 10 noms allemands tirés du vocabulaire du contenu
- Pour chaque nom, fournit son article défini correct (der, die, das) ou "die (pluriel)" pour les pluriels
- Ajoute une traduction en français
- Ajoute une astuce mnémotechnique utile en français

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "genre",
  "mots": [
    {
      "nom": "Tisch",
      "article": "der",
      "traduction": "la table",
      "astuce": "Les meubles sont souvent masculins"
    },
    ... (9 autres noms)
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "genre".
Le tableau doit contenir EXACTEMENT 10 mots.`;
    }

    if (type === 'genre_texte') {
      return `${basePrompt}
Crée un exercice de genre avec texte à trous (determinants) basé sur le contenu ci-dessus.
- Génère un court texte de 5-6 phrases en allemand
- Remplace les articles définis par des trous (___)
- Chaque trou doit être remplacé par Der, Die, Das ou Die (pluriel)
- Fournis les options possibles pour chaque trou
- Niveau adapté : ${niveauCECRL}

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "genre_texte",
  "phrases": [
    {
      "texte": "___ Hund ist groß. ___ Katze ist klein.",
      "trous": [
        {"position": 0, "bonneReponse": "Der", "options": ["Der", "Die", "Das"]},
        {"position": 1, "bonneReponse": "Die", "options": ["Der", "Die", "Das"]}
      ]
    }
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "genre_texte".`;
    }

    // ==========================================================================
    // NOUVEAUX EXERCICES : CAS GRAMMATICAUX
    // ==========================================================================

    if (type === 'identifier_fonction') {
      return `${basePrompt}
Crée un exercice pour identifier la fonction grammaticale des mots en allemand.
- Génère 5-8 questions
- Chaque question doit contenir une phrase en allemand avec un mot en évidence (entouré de **)
- L'utilisateur doit identifier la fonction du mot : Sujet, COD, COI, Complément du nom
- Indique aussi le cas grammatical correspondant (Nominatif, Accusatif, Datif, Génitif)
- Fournis une explication pédagogique en français

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "identifier_fonction",
  "questions": [
    {
      "phrase": "Ich gebe **dem Mann** ein Buch.",
      "motEnEvidence": "dem Mann",
      "bonneReponse": "COI",
      "cas": "Datif",
      "explication": "'dem Mann' est le destinataire de l'action → COI → Datif",
      "choix": ["Sujet", "COD", "COI", "Complément du nom"]
    },
    ... (4-7 autres questions)
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "identifier_fonction".`;
    }

    if (type === 'choisir_determinant') {
      return `${basePrompt}
Crée un exercice pour choisir le bon déterminant selon la fonction grammaticale.
- Génères 5-8 questions
- Chaque question contient une phrase avec un trou pour un article/déterminant
- Indique la fonction du mot manquant (ex: "COD (Accusatif)") et son genre
- Fournis 4 options de réponse (ex: der, den, dem, des)
- L'utilisateur doit choisir la bonne déclinaison

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "choisir_determinant",
  "questions": [
    {
      "phrase": "Ich sehe ___ Mann.",
      "fonction": "COD (Accusatif)",
      "genre": "masculin",
      "bonneReponse": "den",
      "choix": ["der", "den", "dem", "des"],
      "explication": "COD masculin → Accusatif → 'den'"
    },
    ... (4-7 autres questions)
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "choisir_determinant".`;
    }

    if (type === 'tableau_declinaison') {
      return `${basePrompt}
Crée un exercice de tableau de déclinaison interactif.
- Génère un tableau complet des articles définis déclinés selon les 4 cas grammaticaux
- Masque aléatoirement certaines cellules (environ 50% des cellules)
- L'utilisateur doit compléter les cellules manquantes

Réponds avec UN SEUL objet JSON contenant :
{
  "exercice": "tableau_declinaison",
  "rows": [
    {
      "genre": "Masculin",
      "nominatif": {"value": "der", "isVisible": true},
      "accusatif": {"value": "den", "isVisible": false},
      "datif": {"value": "dem", "isVisible": true},
      "genitif": {"value": "des", "isVisible": false}
    },
    {
      "genre": "Féminin",
      "nominatif": {"value": "die", "isVisible": false},
      "accusatif": {"value": "die", "isVisible": true},
      "datif": {"value": "der", "isVisible": false},
      "genitif": {"value": "der", "isVisible": true}
    },
    {
      "genre": "Neutre",
      "nominatif": {"value": "das", "isVisible": true},
      "accusatif": {"value": "das", "isVisible": false},
      "datif": {"value": "dem", "isVisible": true},
      "genitif": {"value": "des", "isVisible": false}
    },
    {
      "genre": "Pluriel",
      "nominatif": {"value": "die", "isVisible": false},
      "accusatif": {"value": "die", "isVisible": true},
      "datif": {"value": "den", "isVisible": false},
      "genitif": {"value": "der", "isVisible": true}
    }
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON demandé.
Pas de texte avant, pas de texte après, pas de markdown.
Le JSON doit contenir une clé 'exercice' à la racine avec la valeur "tableau_declinaison".`;
    }
    
    // Pour les autres types
    return `${basePrompt}
Crée un exercice de type ${type}. Réponds avec un JSON valide.`;
  }, [getCurrentContext, niveauCECRL, translationDirection]);

  /**
   * Génère un exercice via l'API Mistral
   */
  const generateExercise = useCallback(async () => {
    if ((themeSource === 'cours' && selectedLecons.length === 0) || (themeSource === 'libre' && !selectedTheme && !customTheme)) {
      setError('Veuillez sélectionner au moins une leçon ou un thème');
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
      
      // Logger la réponse brute en cas d'erreur pour le debug
      console.log('Réponse Mistral brute:', data);
      
      // Vérifier que la réponse contient la clé 'exercice' à la racine
      if (!data.exercice) {
        console.error('Réponse Mistral invalide : clé "exercice" manquante', data);
        throw new Error(`Réponse Mistral invalide : clé 'exercice' manquante. Reçu : ${JSON.stringify(data).substring(0, 200)}`);
      }
      
      // Vérifier que le type correspond
      if (data.exercice !== selectedType) {
        console.error(`Type d'exercice incompatible : attendu '${selectedType}', reçu '${data.exercice}'`, data);
        throw new Error(`Type d'exercice incompatible : attendu '${selectedType}', reçu '${data.exercice}'`);
      }

      // Parser selon le type
      let exercise: GeneratedExercise;
      const exerciseData = data;

      switch (selectedType) {
        case 'qcm':
          // Attendre un tableau de questions
          if (!exerciseData.questions || !Array.isArray(exerciseData.questions) || exerciseData.questions.length !== 20) {
            console.error('Réponse Mistral invalide pour QCM:', exerciseData);
            throw new Error(`Réponse Mistral invalide : attendu 20 questions pour QCM, reçu ${exerciseData.questions?.length || 0}`);
          }
          
          // Valider chaque question
          const validQuestions = exerciseData.questions.map((q: any, index: number) => {
            if (!q.question || !q.choix || !Array.isArray(q.choix) || q.choix.length !== 4 || 
                q.bonneReponse === undefined || q.bonneReponse === null) {
              console.error(`Question QCM ${index + 1} invalide:`, q);
              throw new Error(`Question ${index + 1} invalide pour QCM`);
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
          break;

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
              direction: (exerciseData.direction === 'de-fr' || exerciseData.direction === 'fr-de') 
                ? exerciseData.direction 
                : 'fr-de',
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

          // ==========================================================================
          // NOUVEAUX EXERCICES : GENRE DES NOMS
          // ==========================================================================

          case 'genre':
            if (!exerciseData.mots || !Array.isArray(exerciseData.mots) || exerciseData.mots.length !== 10) {
              throw new Error(`Réponse Mistral invalide : attendu 10 mots pour genre, reçu ${exerciseData.mots?.length || 0}`);
            }
            
            exercise = {
              type: 'genre',
              mots: exerciseData.mots.map((m: any) => ({
                nom: String(m.nom || ''),
                article: String(m.article || ''),
                traduction: String(m.traduction || ''),
                astuce: String(m.astuce || ''),
              })),
            };
            break;

          case 'genre_texte':
            if (!exerciseData.phrases || !Array.isArray(exerciseData.phrases)) {
              throw new Error('Réponse Mistral invalide : phrases manquantes pour genre_texte');
            }
            
            exercise = {
              type: 'genre_texte',
              phrases: exerciseData.phrases.map((p: any) => ({
                texte: String(p.texte || ''),
                trous: Array.isArray(p.trous) ? p.trous.map((t: any) => ({
                  position: Number(t.position || 0),
                  bonneReponse: String(t.bonneReponse || ''),
                  options: Array.isArray(t.options) ? t.options.map(String) : ['Der', 'Die', 'Das', 'Die'],
                })) : [],
              })),
            };
            break;

          // ==========================================================================
          // NOUVEAUX EXERCICES : CAS GRAMMATICAUX
          // ==========================================================================

          case 'identifier_fonction':
            if (!exerciseData.questions || !Array.isArray(exerciseData.questions)) {
              throw new Error('Réponse Mistral invalide : questions manquantes pour identifier_fonction');
            }
            
            exercise = {
              type: 'identifier_fonction',
              questions: exerciseData.questions.map((q: any) => ({
                phrase: String(q.phrase || ''),
                motEnEvidence: String(q.motEnEvidence || ''),
                bonneReponse: String(q.bonneReponse || ''),
                cas: String(q.cas || ''),
                explication: String(q.explication || ''),
                choix: Array.isArray(q.choix) ? q.choix.map(String) : ['Sujet', 'COD', 'COI', 'Complément du nom'],
              })),
            };
            break;

          case 'choisir_determinant':
            if (!exerciseData.questions || !Array.isArray(exerciseData.questions)) {
              throw new Error('Réponse Mistral invalide : questions manquantes pour choisir_determinant');
            }
            
            exercise = {
              type: 'choisir_determinant',
              questions: exerciseData.questions.map((q: any) => ({
                phrase: String(q.phrase || ''),
                fonction: String(q.fonction || ''),
                genre: String(q.genre || ''),
                bonneReponse: String(q.bonneReponse || ''),
                choix: Array.isArray(q.choix) ? q.choix.map(String) : ['der', 'den', 'dem', 'des'],
                explication: String(q.explication || ''),
              })),
            };
            break;

          case 'tableau_declinaison':
            if (!exerciseData.rows || !Array.isArray(exerciseData.rows)) {
              throw new Error('Réponse Mistral invalide : rows manquantes pour tableau_declinaison');
            }
            
            exercise = {
              type: 'tableau_declinaison',
              rows: exerciseData.rows.map((r: any) => ({
                genre: String(r.genre || ''),
                nominatif: {
                  value: String(r.nominatif?.value || ''),
                  isVisible: Boolean(r.nominatif?.isVisible || true),
                },
                accusatif: {
                  value: String(r.accusatif?.value || ''),
                  isVisible: Boolean(r.accusatif?.isVisible || true),
                },
                datif: {
                  value: String(r.datif?.value || ''),
                  isVisible: Boolean(r.datif?.isVisible || true),
                },
                genitif: {
                  value: String(r.genitif?.value || ''),
                  isVisible: Boolean(r.genitif?.isVisible || true),
                },
              })),
            };
            break;

          default:
            throw new Error(`Type d'exercice non implémenté : ${selectedType}`);
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
  }, [selectedType, buildExercisePrompt, themeSource, selectedLecons, selectedTheme, customTheme]);

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
              correctCount: dialogueCorrection.corrections.filter((c: {isCorrect: boolean}) => c.isCorrect).length,
              corrections: dialogueCorrection.corrections.map((c: {isCorrect: boolean; userAnswer: string; correctAnswer: string}, i: number) => ({
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
              correctCount: dictationCorrection.wordCorrections.filter((w: {isCorrect: boolean}) => w.isCorrect).length,
              corrections: dictationCorrection.wordCorrections.map((wc: {isCorrect: boolean; expected: string; actual: string}, i: number) => ({
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
          // Correction par défaut pour production
          correctionResult = correctTextExercise();
          break;
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
          contenuJSON = {
            type: 'production',
            question: (generatedExercise as any).question,
          };
          reponseUtilisateur = textAnswer;
          correctionText = `Score: ${score}/100`;
          break;
        default:
          // Ce cas ne devrait jamais arriver, mais on le gère pour la sécurité
          contenuJSON = {
            type: 'texteATrous' as ExerciceType,
            question: (generatedExercise as GeneratedExercise).type,
          };
          reponseUtilisateur = textAnswer;
          correctionText = `Score: ${score}/100`;
          break;
      }

      // Sauvegarder via storage
      const newExercice = addExercice({
        type: generatedExercise.type,
        leconsAssociees: themeSource === 'cours' ? selectedLecons.map(l => l.id) : [],
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
    selectedLecons, 
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
  // TABLEAU RÉCAPITULATIF DES RÈGLES (AIDE-MÉMOIRE)
  // ==========================================================================

  /**
   * Contenu du panneau aide-mémoire pour les déclinaisons et cas grammaticaux
   */
  const GrammarHelpPanel = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#1e1b4b]">📋 Aide-mémoire - Déclinaisons Allemandes</h2>
        <button
          onClick={() => setShowHelpPanel(false)}
          className="text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>
      </div>

      {/* Tableau complet des déclinaisons */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-[#1e1b4b] mb-4">📚 Tableau des articles définis (der/die/das)</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-[#3730a3] text-white">
                <th className="p-2 border border-gray-300">Cas / Genre</th>
                <th className="p-2 border border-gray-300">Masculin</th>
                <th className="p-2 border border-gray-300">Féminin</th>
                <th className="p-2 border border-gray-300">Neutre</th>
                <th className="p-2 border border-gray-300">Pluriel</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="p-2 border border-gray-300 font-medium">Nominatif</td>
                <td className="p-2 border border-gray-300 text-center">der</td>
                <td className="p-2 border border-gray-300 text-center">die</td>
                <td className="p-2 border border-gray-300 text-center">das</td>
                <td className="p-2 border border-gray-300 text-center">die</td>
              </tr>
              <tr className="bg-white">
                <td className="p-2 border border-gray-300 font-medium">Accusatif</td>
                <td className="p-2 border border-gray-300 text-center">den</td>
                <td className="p-2 border border-gray-300 text-center">die</td>
                <td className="p-2 border border-gray-300 text-center">das</td>
                <td className="p-2 border border-gray-300 text-center">die</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="p-2 border border-gray-300 font-medium">Datif</td>
                <td className="p-2 border border-gray-300 text-center">dem</td>
                <td className="p-2 border border-gray-300 text-center">der</td>
                <td className="p-2 border border-gray-300 text-center">dem</td>
                <td className="p-2 border border-gray-300 text-center">den</td>
              </tr>
              <tr className="bg-white">
                <td className="p-2 border border-gray-300 font-medium">Génitif</td>
                <td className="p-2 border border-gray-300 text-center">des</td>
                <td className="p-2 border border-gray-300 text-center">der</td>
                <td className="p-2 border border-gray-300 text-center">des</td>
                <td className="p-2 border border-gray-300 text-center">der</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau des pronoms personnels */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-[#1e1b4b] mb-4">👥 Pronoms personnels par cas</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-[#3730a3] text-white">
                <th className="p-2 border border-gray-300">Cas / Personne</th>
                <th className="p-2 border border-gray-300">ich</th>
                <th className="p-2 border border-gray-300">du</th>
                <th className="p-2 border border-gray-300">er</th>
                <th className="p-2 border border-gray-300">sie</th>
                <th className="p-2 border border-gray-300">es</th>
                <th className="p-2 border border-gray-300">wir</th>
                <th className="p-2 border border-gray-300">ihr</th>
                <th className="p-2 border border-gray-300">sie/Sie</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="p-2 border border-gray-300 font-medium">Nominatif</td>
                <td className="p-2 border border-gray-300 text-center">ich</td>
                <td className="p-2 border border-gray-300 text-center">du</td>
                <td className="p-2 border border-gray-300 text-center">er</td>
                <td className="p-2 border border-gray-300 text-center">sie</td>
                <td className="p-2 border border-gray-300 text-center">es</td>
                <td className="p-2 border border-gray-300 text-center">wir</td>
                <td className="p-2 border border-gray-300 text-center">ihr</td>
                <td className="p-2 border border-gray-300 text-center">sie/Sie</td>
              </tr>
              <tr className="bg-white">
                <td className="p-2 border border-gray-300 font-medium">Accusatif</td>
                <td className="p-2 border border-gray-300 text-center">mich</td>
                <td className="p-2 border border-gray-300 text-center">dich</td>
                <td className="p-2 border border-gray-300 text-center">ihn</td>
                <td className="p-2 border border-gray-300 text-center">sie</td>
                <td className="p-2 border border-gray-300 text-center">es</td>
                <td className="p-2 border border-gray-300 text-center">uns</td>
                <td className="p-2 border border-gray-300 text-center">euch</td>
                <td className="p-2 border border-gray-300 text-center">sie/Sie</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="p-2 border border-gray-300 font-medium">Datif</td>
                <td className="p-2 border border-gray-300 text-center">mir</td>
                <td className="p-2 border border-gray-300 text-center">dir</td>
                <td className="p-2 border border-gray-300 text-center">ihm</td>
                <td className="p-2 border border-gray-300 text-center">ihr</td>
                <td className="p-2 border border-gray-300 text-center">ihm</td>
                <td className="p-2 border border-gray-300 text-center">uns</td>
                <td className="p-2 border border-gray-300 text-center">euch</td>
                <td className="p-2 border border-gray-300 text-center">ihnen/Ihnen</td>
              </tr>
              <tr className="bg-white">
                <td className="p-2 border border-gray-300 font-medium">Génitif</td>
                <td className="p-2 border border-gray-300 text-center">meiner</td>
                <td className="p-2 border border-gray-300 text-center">deiner</td>
                <td className="p-2 border border-gray-300 text-center">seiner</td>
                <td className="p-2 border border-gray-300 text-center">ihrer</td>
                <td className="p-2 border border-gray-300 text-center">seiner</td>
                <td className="p-2 border border-gray-300 text-center">unser</td>
                <td className="p-2 border border-gray-300 text-center">euer</td>
                <td className="p-2 border border-gray-300 text-center">ihrer/Ihrer</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Règles pour identifier le cas */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-[#1e1b4b] mb-4">🔍 Règles pour identifier le cas d'un mot</h3>
        <div className="space-y-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">✅ Nominatif</h4>
            <p><strong>Sujet</strong> de la phrase : <em>Der Mann</em> <strong>läuft</strong>.</p>
            <p><strong>Après :</strong> sein, das ist, werden, etc.</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">✅ Accusatif</h4>
            <p><strong>COD (Complément d'Objet Direct)</strong> : Ich sehe <em>den Mann</em>.</p>
            <p><strong>Après les prépositions :</strong> durch, für, gegen, ohne, um, bis</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <h4 className="font-medium text-orange-800 mb-2">✅ Datif</h4>
            <p><strong>COI (Complément d'Objet Indirect)</strong> : Ich gebe <em>dem Mann</em> ein Buch.</p>
            <p><strong>Après les prépositions :</strong> aus, bei, mit, nach, von, zu, seit, außer, gegenüber</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">✅ Génitif</h4>
            <p><strong>Complément du nom</strong> : Das ist die Farbe <em>des Himmels</em>.</p>
            <p><strong>Après les prépositions :</strong> während, wegen, trotz, außerhalb, innerhalb</p>
          </div>
        </div>
      </div>

      {/* Exemples de phrases */}
      <div>
        <h3 className="text-lg font-semibold text-[#1e1b4b] mb-4">📝 Exemples de phrases par cas</h3>
        <div className="space-y-3 text-sm">
          <div className="bg-purple-50 p-3 rounded-lg">
            <p><strong>Nominatif:</strong> <em>Der Hund</em> bellt. (<em>Le chien</em> aboie - sujet)</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p><strong>Accusatif:</strong> Ich habe <em>den Hund</em> gesehen. (J'ai vu <em>le chien</em> - COD)</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p><strong>Datif:</strong> Ich gebe <em>dem Hund</em> Futter. (Je donne à <em>donner au chien</em> à manger - COI)</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p><strong>Génitif:</strong> Das ist die Leine <em>des Hundes</em>. (C'est la laisse <em>du chien</em> - complément du nom)</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDU
  // ==========================================================================

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 relative">
      <div className="max-w-4xl mx-auto">
        {/* Panneau aide-mémoire */}
        {showHelpPanel && <GrammarHelpPanel />}
        {/* En-tête avec dégradé */}
        <div className="bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] rounded-xl p-6 mb-8 shadow-lg">
          <h1 className="text-3xl font-bold text-white">Exercices</h1>
          <p className="text-white/80 mt-2">
            Générez et corrigez des exercices à partir de vos leçons
          </p>
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            <div className="flex justify-between items-start">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 text-xl"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ======================================================================
             ÉTAPE 1 : SÉLECTION + SÉLECTEUR DE THÈME
           ====================================================================== */}
        {step === 'select' && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
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
                    if (lecon) setSelectedLecons([lecon]);
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
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-800">Sélectionner les leçons à travailler</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (lecons.length > 0) {
                          setSelectedLecons([...lecons]);
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                      Tout sélectionner
                    </button>
                    <button
                      onClick={() => setSelectedLecons([])}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium transition-colors"
                    >
                      Tout désélectionner
                    </button>
                    <button
                      onClick={() => {
                        if (lecons.length > 0) {
                          const randomIndex = Math.floor(Math.random() * lecons.length);
                          setSelectedLecons([lecons[randomIndex]]);
                        }
                      }}
                      className="px-3 py-1 bg-[#3730a3]/10 text-[#3730a3] rounded-xl hover:bg-[#3730a3]/20 text-sm font-medium transition-all duration-200"
                    >
                      🔄 Choisir aléatoirement
                    </button>
                  </div>
                </div>

                {/* Filtre par type */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setLeconFilter('tous')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      leconFilter === 'tous' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setLeconFilter('grammaire')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      leconFilter === 'grammaire' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Grammaire
                  </button>
                  <button
                    onClick={() => setLeconFilter('vocabulaire')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      leconFilter === 'vocabulaire' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Vocabulaire
                  </button>
                  <button
                    onClick={() => setLeconFilter('conjugaison')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      leconFilter === 'conjugaison' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Conjugaison
                  </button>
                  <button
                    onClick={() => setLeconFilter('autre')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      leconFilter === 'autre' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Autre
                  </button>
                </div>

                {/* Liste des leçons avec cases à cocher */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                  {lecons.filter(lecon => leconFilter === 'tous' || lecon.type === leconFilter).length === 0 ? (
                    <p className="text-gray-500 text-sm p-4">
                      Aucune leçon disponible. Importez un PDF via <a href="/lecons/import" className="text-blue-600 hover:underline">/lecons/import</a>
                    </p>
                  ) : (
                    lecons
                      .filter(lecon => leconFilter === 'tous' || lecon.type === leconFilter)
                      .map((lecon) => {
                        const isSelected = selectedLecons.some(l => l.id === lecon.id);
                        
                        // Badge coloré selon le type
                        const getTypeColor = (type: Lecon['type']) => {
                          switch (type) {
                            case 'grammaire': return 'bg-blue-100 text-blue-700';
                            case 'vocabulaire': return 'bg-green-100 text-green-700';
                            case 'conjugaison': return 'bg-purple-100 text-purple-700';
                            case 'autre': return 'bg-gray-100 text-gray-700';
                            default: return 'bg-gray-100 text-gray-700';
                          }
                        };

                        return (
                          <label
                            key={lecon.id}
                            className={`flex items-start gap-3 p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLecons([...selectedLecons, lecon]);
                                } else {
                                  setSelectedLecons(selectedLecons.filter(l => l.id !== lecon.id));
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <p className="font-medium text-gray-800 truncate">{lecon.titre}</p>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(lecon.type)}`}>
                                  {lecon.type}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {lecon.contenuTexte.substring(0, 50)}{lecon.contenuTexte.length > 50 ? '...' : ''}
                              </p>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>

                {/* Compteur */}
                <p className="text-sm text-gray-600">
                  {selectedLecons.length} leçon(s) sélectionnée(s)
                </p>

                {/* Aperçu des leçons sélectionnées */}
                {selectedLecons.length > 0 && (
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Leçons sélectionnées :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedLecons.map(lecon => (
                        <span key={lecon.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          {lecon.titre}
                        </span>
                      ))}
                    </div>
                  </div>
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
                <option value="genre">Genre (der/die/das) - Choix</option>
                <option value="genre_texte">Genre (der/die/das) - Texte à trous</option>
                <option value="identifier_fonction">Cas grammaticaux - Identifier fonction</option>
                <option value="choisir_determinant">Cas grammaticaux - Choisir déterminant</option>
                <option value="tableau_declinaison">Cas grammaticaux - Tableau de déclinaison</option>
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

            {/* Bouton Aide-mémoire (visible pour tous les exercices de grammaire) */}
            {['genre', 'genre_texte', 'identifier_fonction', 'choisir_determinant', 'tableau_declinaison'].includes(selectedType) && (
              <div className="mb-4">
                <button
                  onClick={() => setShowHelpPanel(true)}
                  className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📋</span>
                  <span>Aide-mémoire des déclinaisons</span>
                </button>
              </div>
            )}

            {/* Bouton de génération */}
            {(themeSource === 'cours' && selectedLecons.length === 0) ? (
              <button
                className="w-full px-6 py-3 bg-gray-300 text-gray-600 rounded-md cursor-not-allowed"
                disabled
              >
                Veuillez sélectionner au moins une leçon
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
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3730a3] mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-[#1e293b] mb-2">
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
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
            {/* En-tête de l'exercice */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1e293b]">
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
                    className={`px-4 py-2 rounded-xl text-white font-medium transition-all duration-200
                      ${isPlayingDictation ? 'bg-yellow-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer'}`}
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
                    className="px-4 py-2 bg-white border border-[#3730a3] text-[#3730a3] rounded-xl hover:bg-[#f8fafc] transition-all duration-200 font-medium"
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
                className="px-4 py-2 bg-white border border-[#3730a3] text-[#3730a3] rounded-xl hover:bg-[#f8fafc] transition-all duration-200 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={correctExercise}
                disabled={getIsExerciseComplete()}
                className={`px-6 py-3 rounded-xl text-white font-medium flex-1 
                  ${!getIsExerciseComplete() 
                    ? 'bg-[#3730a3] hover:bg-[#4f46e5] cursor-pointer' 
                    : 'bg-[#3730a3]/50 cursor-not-allowed'}
                  transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2`}
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
        
        {/* ========================================================================
             NOUVEAUX EXERCICES : AFFICHAGE DES RÉSULTATS
           ======================================================================== */}
        
        {/* Résultats pour Genre - Mode A */}
        {step === 'correcting' && generatedExercise?.type === 'genre' && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e1b4b] mb-2">
                {genreScore >= 80 ? (
                  <span className="text-green-600">✓ Excellent travail !</span>
                ) : genreScore >= 50 ? (
                  <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                ) : (
                  <span className="text-red-600">✗ Revisez ces notions</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={genreScore >= 80 ? 'text-green-600' : genreScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {genreScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                Genre des noms - Mode choix du déterminant
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setGeneratedExercise(null);
                  setGenreAnswers({});
                  setGenreScore(0);
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Faire un autre exercice
              </button>
            </div>

            {/* Détails des réponses */}
            <div className="bg-gray-50 p-4 rounded-md space-y-3 max-h-[50vh] overflow-y-auto">
              <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
              {generatedExercise.mots.map((mot: GenreWord, index: number) => {
                const userAnswer = genreAnswers[index];
                const isCorrect = userAnswer === mot.article;
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-md border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                  >
                    <p className="font-medium text-gray-800 mb-1">
                      {index + 1}. {mot.nom} ({mot.traduction})
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Votre réponse:</span> 
                      <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                        {userAnswer || 'Non répondue'}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Réponse correcte:</span> 
                      <span className="text-green-700 font-medium">{mot.article}</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-xs text-gray-500 mt-1"><strong>Astuce:</strong> {mot.astuce}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Résultats pour Genre - Mode B */}
        {step === 'correcting' && generatedExercise?.type === 'genre_texte' && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e1b4b] mb-2">
                {genreTextScore >= 80 ? (
                  <span className="text-green-600">✓ Excellent travail !</span>
                ) : genreTextScore >= 50 ? (
                  <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                ) : (
                  <span className="text-red-600">✗ Revisez ces notions</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={genreTextScore >= 80 ? 'text-green-600' : genreTextScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {genreTextScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                Genre des noms - Mode texte à trous
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setGeneratedExercise(null);
                  setGenreTextAnswers({});
                  setGenreTextScore(0);
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Faire un autre exercice
              </button>
            </div>

            {/* Détails des réponses */}
            <div className="bg-gray-50 p-4 rounded-md space-y-3 max-h-[50vh] overflow-y-auto">
              <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
              {generatedExercise.phrases.map((phrase: GenreTextPhrase, phraseIndex: number) => (
                <div key={phraseIndex} className="bg-white p-3 rounded-md border border-gray-200">
                  <p className="font-medium text-gray-800 mb-2">Phrase {phraseIndex + 1}</p>
                  {phrase.texte.split('___').map((part: string, partIndex: number) => {
                    if (partIndex === 0) return <span key={partIndex}>{part}</span>;
                    
                    const trou = phrase.trous[partIndex - 1];
                    const userAnswer = genreTextAnswers[phraseIndex]?.[partIndex - 1];
                    const isCorrect = userAnswer === trou.bonneReponse;
                    
                    return (
                      <span key={partIndex}>
                        <span className={`px-2 py-1 rounded text-sm ${
                          isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {userAnswer || '---'}
                        </span>
                        {part}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Résultats pour Cas grammaticaux - Identifier fonction */}
        {step === 'correcting' && generatedExercise?.type === 'identifier_fonction' && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e1b4b] mb-2">
                {functionIdentificationScore >= 80 ? (
                  <span className="text-green-600">✓ Excellent travail !</span>
                ) : functionIdentificationScore >= 50 ? (
                  <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                ) : (
                  <span className="text-red-600">✗ Revisez ces notions</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={functionIdentificationScore >= 80 ? 'text-green-600' : functionIdentificationScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {functionIdentificationScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                Cas grammaticaux - Identifier fonction
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setGeneratedExercise(null);
                  setFunctionIdentificationAnswers({});
                  setFunctionIdentificationScore(0);
                }}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
              >
                Faire un autre exercice
              </button>
            </div>

            {/* Détails des réponses */}
            <div className="bg-gray-50 p-4 rounded-md space-y-3 max-h-[50vh] overflow-y-auto">
              <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
              {generatedExercise.questions.map((question: IdentifyFunctionQuestion, index: number) => {
                const userAnswer = functionIdentificationAnswers[index];
                const isCorrect = userAnswer === question.bonneReponse;
                const phraseWithHtml = question.phrase.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-md border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                  >
                    <p className="font-medium text-gray-800 mb-2" 
                       dangerouslySetInnerHTML={{ __html: phraseWithHtml }}>
                    </p>
                    <p className="text-sm mb-2">
                      Mot: <strong>{question.motEnEvidence}</strong>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Votre réponse:</span> 
                      <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                        {userAnswer || 'Non répondue'}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Réponse correcte:</span> 
                      <span className="text-green-700 font-medium">{question.bonneReponse}</span>
                      <span className="text-gray-500"> ({question.cas})</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-xs text-gray-500 mt-1"><strong>Explication:</strong> {question.explication}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Résultats pour Cas grammaticaux - Choisir déterminant */}
        {step === 'correcting' && generatedExercise?.type === 'choisir_determinant' && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e1b4b] mb-2">
                {determinantChoiceScore >= 80 ? (
                  <span className="text-green-600">✓ Excellent travail !</span>
                ) : determinantChoiceScore >= 50 ? (
                  <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                ) : (
                  <span className="text-red-600">✗ Revisez ces notions</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={determinantChoiceScore >= 80 ? 'text-green-600' : determinantChoiceScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {determinantChoiceScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                Cas grammaticaux - Choisir déterminant
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setGeneratedExercise(null);
                  setDeterminantChoiceAnswers({});
                  setDeterminantChoiceScore(0);
                }}
                className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium"
              >
                Faire un autre exercice
              </button>
            </div>

            {/* Détails des réponses */}
            <div className="bg-gray-50 p-4 rounded-md space-y-3 max-h-[50vh] overflow-y-auto">
              <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
              {generatedExercise.questions.map((question: ChooseDeterminantQuestion, index: number) => {
                const userAnswer = determinantChoiceAnswers[index];
                const isCorrect = userAnswer === question.bonneReponse;
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-md border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                  >
                    <p className="font-medium text-gray-800 mb-2">
                      Question {index + 1}: {question.phrase}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      {question.fonction} | Genre: {question.genre}
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Votre réponse:</span> 
                      <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                        {userAnswer || 'Non répondue'}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Réponse correcte:</span> 
                      <span className="text-green-700 font-medium">{question.bonneReponse}</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-xs text-gray-500 mt-1"><strong>Explication:</strong> {question.explication}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Résultats pour Cas grammaticaux - Tableau de déclinaison */}
        {step === 'correcting' && generatedExercise?.type === 'tableau_declinaison' && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1e1b4b] mb-2">
                {declensionTableScore >= 80 ? (
                  <span className="text-green-600">✓ Excellent travail !</span>
                ) : declensionTableScore >= 50 ? (
                  <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                ) : (
                  <span className="text-red-600">✗ Revisez ces notions</span>
                )}
              </h2>
              <div className="text-5xl font-bold mb-2">
                <span className={declensionTableScore >= 80 ? 'text-green-600' : declensionTableScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {declensionTableScore}/100
                </span>
              </div>
              <p className="text-gray-600">
                Cas grammaticaux - Tableau de déclinaison
              </p>
            </div>

            {/* Tableau complet avec corrections */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm bg-white">
                <thead>
                  <tr className="bg-[#3730a3] text-white">
                    <th className="p-2 border border-gray-300">Cas / Genre</th>
                    <th className="p-2 border border-gray-300">Nominatif</th>
                    <th className="p-2 border border-gray-300">Accusatif</th>
                    <th className="p-2 border border-gray-300">Datif</th>
                    <th className="p-2 border border-gray-300">Génitif</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedExercise.rows.map((row: DeclensionRow, rowIndex: number) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}> 
                      <td className="p-2 border border-gray-300 font-medium">{row.genre}</td>
                      {['nominatif', 'accusatif', 'datif', 'genitif'].map((cas: string) => {
                        const cell = row[cas as 'nominatif' | 'accusatif' | 'datif' | 'genitif'];
                        const userAnswer = declensionTableAnswers[row.genre]?.[cas];
                        const isCorrect = userAnswer === cell.value;
                        const isAnswered = userAnswer !== undefined && userAnswer !== '';
                        
                        return (
                          <td key={cas} className="p-2 border border-gray-300 text-center">
                            {cell.isVisible ? (
                              <span className="font-medium text-gray-700">{cell.value}</span>
                            ) : (
                              <div>
                                <span className={`font-medium ${
                                  isAnswered 
                                    ? (isCorrect ? 'text-green-600' : 'text-red-600')
                                    : 'text-gray-600'
                                }`}>
                                  {userAnswer || '?>'}
                                </span>
                                {!isCorrect && isAnswered && (
                                  <div className="text-xs text-red-600">→ {cell.value}</div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(step === 'correcting' || step === 'saved') && correction && generatedExercise && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
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

            {/* TRADUCTION */}
            {generatedExercise.type === 'traduction' && translationCorrection && (
              <div className="bg-purple-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-purple-700 mb-3">Correction de la traduction</h3>
                
                <div className="bg-white p-3 rounded-md border border-purple-200">
                  <p className="text-sm text-gray-600 mb-1">Phrase à traduire</p>
                  <p className="font-medium text-gray-800">{generatedExercise.sentence}</p>
                  <p className="text-sm text-purple-600 mt-2">
                    Direction: {generatedExercise.direction === 'fr-de' ? 'Français → Allemand' : 'Allemand → Français'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-md border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Votre traduction</p>
                    <p className="font-medium text-gray-800">{translationAnswer || 'Aucune réponse'}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-green-200">
                    <p className="text-sm text-gray-600 mb-1">Traduction correcte</p>
                    <p className="font-medium text-green-700">{translationCorrection.traductionCorrecte}</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-md border border-purple-200">
                  <p className="text-sm text-gray-600 mb-2">Score: <span className="font-bold text-purple-700">{translationCorrection.score}/100</span></p>
                </div>

                {translationCorrection.erreurs.length > 0 && (
                  <div className="bg-red-50 p-3 rounded-md border border-red-200">
                    <p className="text-sm text-red-700 mb-2">Erreurs identifiées :</p>
                    <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                      {translationCorrection.erreurs.map((erreur, index) => (
                        <li key={index}>{erreur}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {translationCorrection.conseils && (
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                    <p className="text-sm text-blue-700 mb-2">Conseils pour améliorer :</p>
                    <p className="text-blue-700 text-sm whitespace-pre-wrap">{translationCorrection.conseils}</p>
                  </div>
                )}
              </div>
            )}

            {/* QUESTIONS OUVERTES */}
            {generatedExercise.type === 'questionsOuvertes' && openQuestionCorrection && (
              <div className="bg-orange-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-orange-700 mb-3">Correction de la question ouverte</h3>
                
                <div className="bg-white p-3 rounded-md border border-orange-200">
                  <p className="text-sm text-gray-600 mb-1">Question</p>
                  <p className="font-medium text-gray-800">{generatedExercise.question}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-md border border-orange-200">
                    <p className="text-sm text-gray-600 mb-1">Votre réponse</p>
                    <p className="font-medium text-gray-800">{openQuestionAnswer || 'Aucune réponse'}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-green-200">
                    <p className="text-sm text-gray-600 mb-1">Réponse attendue</p>
                    <p className="font-medium text-green-700">{generatedExercise.expectedAnswer}</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-md border border-orange-200">
                  <p className="text-sm text-gray-600 mb-2">Score: <span className="font-bold text-orange-700">{openQuestionCorrection.score}/100</span></p>
                </div>

                {openQuestionCorrection.retour && (
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                    <p className="text-sm text-blue-700 mb-2">Retour détaillé :</p>
                    <p className="text-blue-700 text-sm whitespace-pre-wrap">{openQuestionCorrection.retour}</p>
                  </div>
                )}

                {openQuestionCorrection.explicationComplete && (
                  <div className="bg-green-50 p-3 rounded-md border border-green-200">
                    <p className="text-sm text-green-700 mb-2">Explication complète :</p>
                    <p className="text-green-700 text-sm whitespace-pre-wrap">{openQuestionCorrection.explicationComplete}</p>
                  </div>
                )}
              </div>
            )}

            {/* REMISE EN ORDRE */}
            {generatedExercise.type === 'remiseEnOrdre' && reorderCorrection && (
              <div className="bg-cyan-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-cyan-700 mb-3">Correction de la remise en ordre</h3>
                
                <div className="bg-white p-3 rounded-md border border-cyan-200">
                  <p className="text-sm text-gray-600 mb-2">Votre proposition</p>
                  <p className="font-medium text-cyan-800">
                    {reorderSelected.join(' ') || 'Aucune réponse'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-md border border-green-200">
                  <p className="text-sm text-gray-600 mb-2">Phrase correcte</p>
                  <p className="font-medium text-green-700">{reorderCorrection.correctSentence}</p>
                </div>

                <div className="bg-white p-3 rounded-md border border-cyan-200">
                  <p className="text-sm text-gray-600 mb-2">
                    Résultat: <span className={`font-bold ${reorderCorrection.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {reorderCorrection.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Score: <span className="font-bold text-cyan-700">{reorderCorrection.score}/100</span>
                  </p>
                </div>

                {reorderCorrection.grammaticalExplanation && (
                  <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                    <p className="text-sm text-yellow-700 mb-2">Explication grammaticale :</p>
                    <p className="text-yellow-700 text-sm whitespace-pre-wrap">{reorderCorrection.grammaticalExplanation}</p>
                  </div>
                )}
              </div>
            )}

            {/* CONJUGAISON */}
            {generatedExercise.type === 'conjugaison' && conjugationCorrection && (
              <div className="bg-pink-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-pink-700 mb-3">Correction de la conjugaison</h3>
                
                <div className="bg-white p-3 rounded-md border border-pink-200">
                  <p className="text-sm text-gray-600 mb-1">Verbe à conjuguer</p>
                  <p className="font-medium text-gray-800">
                    {generatedExercise.verb} - {generatedExercise.pronoun} - {generatedExercise.tense}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-md border border-pink-200">
                    <p className="text-sm text-gray-600 mb-1">Votre réponse</p>
                    <p className="font-medium text-pink-800">{conjugationAnswer || 'Aucune réponse'}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-green-200">
                    <p className="text-sm text-gray-600 mb-1">Forme correcte</p>
                    <p className="font-medium text-green-700">{conjugationCorrection.correctForm}</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-md border border-pink-200">
                  <p className="text-sm text-gray-600 mb-2">
                    Résultat: <span className={`font-bold ${conjugationCorrection.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {conjugationCorrection.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Score: <span className="font-bold text-pink-700">{conjugationCorrection.score}/100</span>
                  </p>
                </div>

                {conjugationCorrection.ruleExplanation && (
                  <div className="bg-purple-50 p-3 rounded-md border border-purple-200">
                    <p className="text-sm text-purple-700 mb-2">Explication de la règle :</p>
                    <p className="text-purple-700 text-sm whitespace-pre-wrap">{conjugationCorrection.ruleExplanation}</p>
                  </div>
                )}
              </div>
            )}

            {/* DIALOGUE */}
            {generatedExercise.type === 'completionDialogue' && dialogueCorrection && (
              <div className="bg-indigo-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-indigo-700 mb-3">Correction du dialogue</h3>
                
                <div className="bg-white p-3 rounded-md border border-indigo-200">
                  <p className="text-sm text-gray-600 mb-2">Contexte: {generatedExercise.context}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-indigo-700">Correction par réplique :</h4>
                  {dialogueCorrection.corrections.map((corr, index) => {
                    const dialogueLine = generatedExercise.dialogue.find((_, i) => i === corr.blankIndex);
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-md border-l-4 ${corr.isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                      >
                        <p className="text-sm text-gray-600 mb-1">
                          Réplique {index + 1} ({dialogueLine?.speaker || '?'})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Votre réponse:</p>
                            <p className={`font-medium ${corr.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                              {corr.userAnswer || 'Non répondue'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Version correcte:</p>
                            <p className="font-medium text-green-700">{corr.correctAnswer}</p>
                          </div>
                        </div>
                        <p className={`text-xs mt-1 ${corr.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {corr.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white p-3 rounded-md border border-indigo-200">
                  <p className="text-sm text-gray-600 mb-2">
                    Score global: <span className="font-bold text-indigo-700">{dialogueCorrection.score}/100</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Réponses correctes: {dialogueCorrection.corrections.filter(c => c.isCorrect).length}/{dialogueCorrection.corrections.length}
                  </p>
                </div>
              </div>
            )}

            {/* ASSOCIATION */}
            {generatedExercise.type === 'association' && associationCorrection && (
              <div className="bg-emerald-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-emerald-700 mb-3">Correction de l'association</h3>
                
                <div className="bg-white p-3 rounded-md border border-emerald-200">
                  <p className="text-sm text-gray-600 mb-2">
                    Score: <span className="font-bold text-emerald-700">{associationCorrection.score}/100</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Paires correctes: {correction.correctCount}/{correction.totalQuestions}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-emerald-700">Corrections par paire :</h4>
                  {associationCorrection.correctPairs.map(([leftIndex, rightIndex], pairIndex) => {
                    const leftWord = generatedExercise.leftColumn[leftIndex];
                    const rightDef = generatedExercise.rightColumn[rightIndex];
                    const isUserCorrect = associationCorrection.userPairs.some(
                      u => u[0] === leftIndex && u[1] === rightIndex
                    );
                    
                    return (
                      <div
                        key={pairIndex}
                        className={`p-3 rounded-md border-l-4 ${isUserCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Mot allemand:</p>
                            <p className="font-medium text-emerald-800">{leftWord}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Définition/Traduction:</p>
                            <p className="font-medium text-emerald-800">{rightDef}</p>
                          </div>
                        </div>
                        <p className={`text-xs mt-1 ${isUserCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {isUserCorrect ? '✓ Paire correcte' : '✗ Paire incorrecte ou manquante'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DICTÉE */}
            {generatedExercise.type === 'dictee' && dictationCorrection && (
              <div className="bg-rose-50 p-4 rounded-md space-y-4">
                <h3 className="font-medium text-rose-700 mb-3">Correction de la dictée</h3>
                
                <div className="bg-white p-3 rounded-md border border-rose-200">
                  <p className="text-sm text-gray-600 mb-2">
                    Score: <span className="font-bold text-rose-700">{dictationCorrection.score}/100</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Mots corrects: {dictationCorrection.wordCorrections.filter(w => w.isCorrect).length}/{dictationCorrection.wordCorrections.length}
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-rose-700">Comparaison mot par mot :</h4>
                  
                  <div className="bg-white p-3 rounded-md border border-rose-200">
                    <p className="text-xs text-gray-500 mb-2">Votre version :</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {dictationCorrection.wordCorrections.map((wc, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 rounded text-sm ${wc.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {wc.actual}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-green-50 p-3 rounded-md border border-green-200">
                    <p className="text-xs text-gray-500 mb-2">Version correcte :</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {dictationCorrection.wordCorrections.map((wc, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 rounded text-sm bg-green-100 text-green-800"
                        >
                          {wc.expected}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-rose-700">Détails par mot :</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {dictationCorrection.wordCorrections.map((wc, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded border text-xs ${wc.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
                        >
                          <p className="font-medium mb-1">
                            Mot {index + 1}: <span className={wc.isCorrect ? 'text-green-700' : 'text-red-700'}>
                              {wc.actual}
                            </span>
                          </p>
                          {!wc.isCorrect && (
                            <p className="text-red-600">
                              Attendu: <span className="font-medium">{wc.expected}</span>
                            </p>
                          )}
                          <p className={wc.isCorrect ? 'text-green-600' : 'text-red-600'}>
                            {wc.isCorrect ? '✓ Correct' : '✗ Erreur'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================
                 NOUVEAUX EXERCICES : GENRE DES NOMS
               ======================================================================== */}

            {/* GENRE - Mode A : Choix du déterminant */}
            {generatedExercise.type === 'genre' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  Choisissez le bon article (der, die, das, die pluriel) pour chaque nom.
                  Score final sur {generatedExercise.mots.length}.
                </p>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                  {generatedExercise.mots.map((mot: GenreWord, index: number) => {
                    const userAnswer = genreAnswers[index];
                    const isCorrect = userAnswer === mot.article;
                    const isAnswered = userAnswer !== undefined;

                    return (
                      <div 
                        key={index}
                        className={`bg-white p-4 rounded-md shadow-sm border-2 transition-colors ${
                          isAnswered ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xl">___</span>
                          <span className="text-xl font-medium text-gray-800">{mot.nom}</span>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">Traduction: {mot.traduction}</p>

                        <div className="flex flex-wrap gap-2">
                          {['der', 'die', 'das', 'die (pluriel)'].map((article: string) => {
                            const isSelected = userAnswer === article;
                            return (
                              <button
                                key={article}
                                onClick={() => {
                                  setGenreAnswers(prev => ({
                                    ...prev,
                                    [index]: isSelected ? undefined : article
                                  }));
                                }}
                                disabled={isAnswered && !isSelected}
                                className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                                  isSelected
                                    ? (isCorrect ? 'bg-green-600' : 'bg-red-600')
                                    : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                              >
                                {article}
                              </button>
                            );
                          })}
                        </div>

                        {isAnswered && !isCorrect && (
                          <div className="mt-3 bg-red-50 p-2 rounded border border-red-200">
                            <p className="text-xs text-red-700">
                              <span className="font-medium">Astuce:</span> {mot.astuce}
                            </p>
                          </div>
                        )}

                        {isAnswered && isCorrect && (
                          <div className="mt-3 bg-green-50 p-2 rounded border border-green-200">
                            <p className="text-xs text-green-700">✓ Correct !</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bouton de correction */}
                <div className="pt-4">
                  <button
                    onClick={() => {
                      let correctCount = 0;
                      generatedExercise.mots.forEach((mot: GenreWord, index: number) => {
                        if (genreAnswers[index] === mot.article) {
                          correctCount++;
                        }
                      });
                      const score = Math.round((correctCount / generatedExercise.mots.length) * 100);
                      setGenreScore(score);
                      
                      // Sauvegarder l'exercice
                      const newExercice = addExercice({
                        type: generatedExercise.type,
                        leconsAssociees: themeSource === 'cours' ? selectedLecons.map(l => l.id) : [selectedTheme],
                        contenuJSON: {
                          mots: generatedExercise.mots,
                          answers: genreAnswers
                        },
                        reponseUtilisateur: genreAnswers,
                        correction: `Score: ${score}/100. ${correctCount} bonnes réponses sur ${generatedExercise.mots.length}.`,
                        score: score,
                      });
                      
                      setStep('correcting');
                    }}
                    disabled={Object.keys(genreAnswers).length < generatedExercise.mots.length || isLoading}
                    className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
                      Object.keys(genreAnswers).length >= generatedExercise.mots.length
                        ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer w-full'
                        : 'bg-blue-300 cursor-not-allowed w-full'
                    }`}
                  >
                    {isLoading ? 'Correction en cours...' : `Corriger (${Object.keys(genreAnswers).length}/${generatedExercise.mots.length})`}
                  </button>
                </div>
              </div>
            )}

            {/* GENRE - Mode B : Texte à trous avec déterminants */}
            {generatedExercise.type === 'genre_texte' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  Complétez les trous avec le bon article (Der, Die, Das, Die).
                </p>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                  {generatedExercise.phrases.map((phrase: GenreTextPhrase, phraseIndex: number) => (
                    <div key={phraseIndex} className="bg-white p-4 rounded-md shadow-sm">
                      <p className="mb-3 font-medium text-gray-800">Phrase {phraseIndex + 1}</p>
                      
                      {/* Affichage du texte avec trous */}
                      <div className="mb-4">
                        {phrase.texte.split('___').map((part: string, partIndex: number) => {
                          const trou = phrase.trous[partIndex];
                          const userAnswer = genreTextAnswers[phraseIndex]?.[partIndex];
                          
                          if (partIndex === 0) {
                            return <span key={partIndex}>{part}</span>;
                          }
                          
                          // Trou
                          const isCorrect = userAnswer === trou?.bonneReponse;
                          const isAnswered = userAnswer !== undefined;
                          
                          return (
                            <span key={partIndex}>
                              <select
                                value={userAnswer || ''}
                                onChange={(e) => {
                                  const answer = e.target.value;
                                  setGenreTextAnswers(prev => ({
                                    ...prev,
                                    [phraseIndex]: {
                                      ...prev[phraseIndex],
                                      [partIndex - 1]: answer
                                    }
                                  }));
                                }}
                                className={`px-2 py-1 rounded border text-sm ${
                                  isAnswered 
                                    ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                                    : 'border-gray-300 bg-white'
                                }`}
                              >
                                <option value="">---</option>
                                {trou?.options.map((option: string) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                              {part}
                            </span>
                          );
                        })}
                      </div>

                      {phrase.trous.map((trou: GenreTextGap, trouIndex: number) => {
                        const userAnswer = genreTextAnswers[phraseIndex]?.[trouIndex];
                        const isCorrect = userAnswer === trou.bonneReponse;
                        const isAnswered = userAnswer !== undefined;
                        
                        return isAnswered && !isCorrect ? (
                          <div key={trouIndex} className="bg-red-50 p-2 rounded border border-red-200 mt-2">
                            <p className="text-xs text-red-700">
                              La bonne réponse était: <strong>{trou.bonneReponse}</strong>
                            </p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ))}
                </div>

                {/* Bouton de correction */}
                <div className="pt-4">
                  <button
                    onClick={() => {
                      let correctCount = 0;
                      let totalQuestions = 0;
                      
                      generatedExercise.phrases.forEach((phrase: GenreTextPhrase, phraseIndex: number) => {
                        phrase.trous.forEach((trou: GenreTextGap, trouIndex: number) => {
                          totalQuestions++;
                          if (genreTextAnswers[phraseIndex]?.[trouIndex] === trou.bonneReponse) {
                            correctCount++;
                          }
                        });
                      });
                      
                      const score = Math.round((correctCount / totalQuestions) * 100);
                      setGenreTextScore(score);
                      
                      // Sauvegarder l'exercice
                      const newExercice = addExercice({
                        type: generatedExercise.type,
                        leconsAssociees: themeSource === 'cours' ? selectedLecons.map(l => l.id) : [selectedTheme],
                        contenuJSON: {
                          phrases: generatedExercise.phrases,
                          answers: genreTextAnswers
                        },
                        reponseUtilisateur: genreTextAnswers,
                        correction: `Score: ${score}/100. ${correctCount} bonnes réponses sur ${totalQuestions}.`,
                        score: score,
                      });
                      
                      setStep('correcting');
                    }}
                    disabled={!getIsExerciseComplete() || isLoading}
                    className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
                      !getIsExerciseComplete() 
                        ? 'bg-blue-300 cursor-not-allowed w-full'
                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer w-full'
                    }`}
                  >
                    {isLoading ? 'Correction en cours...' : `Corriger`}
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================
                 NOUVEAUX EXERCICES : CAS GRAMMATICAUX
               ======================================================================== */}

            {/* CAS GRAMMATICAUX - Sous-exercice A : Identifier la fonction */}
            {generatedExercise.type === 'identifier_fonction' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  Identifiez la fonction grammaticale du mot en évidence dans chaque phrase.
                  Score final sur {generatedExercise.questions.length}.
                </p>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                  {generatedExercise.questions.map((question: IdentifyFunctionQuestion, index: number) => {
                    const userAnswer = functionIdentificationAnswers[index];
                    const isCorrect = userAnswer === question.bonneReponse;
                    const isAnswered = userAnswer !== undefined;

                    // Remplacer **mot** par <strong>mot</strong>
                    const phraseWithHtml = question.phrase.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                    return (
                      <div 
                        key={index}
                        className={`bg-white p-4 rounded-md shadow-sm border-2 transition-colors ${
                          isAnswered ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-200'
                        }`}
                      >
                        <p className="font-medium text-gray-800 mb-3" 
                           dangerouslySetInnerHTML={{ __html: phraseWithHtml }}>
                        </p>

                        <p className="text-sm text-gray-600 mb-3">
                          Mot en évidence: <strong>{question.motEnEvidence}</strong>
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {question.choix.map((choix: GrammaticalFunction) => {
                            const isSelected = userAnswer === choix;
                            return (
                              <button
                                key={choix}
                                onClick={() => {
                                  setFunctionIdentificationAnswers(prev => ({
                                    ...prev,
                                    [index]: isSelected ? undefined : choix
                                  }));
                                }}
                                disabled={isAnswered && !isSelected}
                                className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                                  isSelected
                                    ? (isCorrect ? 'bg-green-600' : 'bg-red-600')
                                    : 'bg-purple-600 hover:bg-purple-700'
                                }`}
                              >
                                {choix}
                              </button>
                            );
                          })}
                        </div>

                        {isAnswered && !isCorrect && (
                          <div className="mt-3 bg-red-50 p-2 rounded border border-red-200">
                            <p className="text-xs text-red-700">
                              <span className="font-medium">Explication:</span> {question.explication}
                              <br />
                              <span className="font-medium">Cas:</span> {question.cas}
                            </p>
                          </div>
                        )}

                        {isAnswered && isCorrect && (
                          <div className="mt-3 bg-green-50 p-2 rounded border border-green-200">
                            <p className="text-xs text-green-700">
                              ✓ Correct ! Cas: {question.cas}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bouton de correction */}
                <div className="pt-4">
                  <button
                    onClick={() => {
                      let correctCount = 0;
                      generatedExercise.questions.forEach((question: IdentifyFunctionQuestion, index: number) => {
                        if (functionIdentificationAnswers[index] === question.bonneReponse) {
                          correctCount++;
                        }
                      });
                      const score = Math.round((correctCount / generatedExercise.questions.length) * 100);
                      setFunctionIdentificationScore(score);
                      
                      // Sauvegarder l'exercice
                      const newExercice = addExercice({
                        type: generatedExercise.type,
                        leconsAssociees: themeSource === 'cours' ? selectedLecons.map(l => l.id) : [selectedTheme],
                        contenuJSON: {
                          questions: generatedExercise.questions,
                          answers: functionIdentificationAnswers
                        },
                        reponseUtilisateur: functionIdentificationAnswers,
                        correction: `Score: ${score}/100. ${correctCount} bonnes réponses sur ${generatedExercise.questions.length}.`,
                        score: score,
                      });
                      
                      setStep('correcting');
                    }}
                    disabled={Object.keys(functionIdentificationAnswers).length < generatedExercise.questions.length || isLoading}
                    className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
                      Object.keys(functionIdentificationAnswers).length >= generatedExercise.questions.length
                        ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer w-full'
                        : 'bg-purple-300 cursor-not-allowed w-full'
                    }`}
                  >
                    {isLoading ? 'Correction en cours...' : `Corriger (${Object.keys(functionIdentificationAnswers).length}/${generatedExercise.questions.length})`}
                  </button>
                </div>
              </div>
            )}

            {/* CAS GRAMMATICAUX - Sous-exercice B : Choisir le déterminant */}
            {generatedExercise.type === 'choisir_determinant' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  Choisissez le bon article/déterminant selon la fonction et le genre indiqués.
                  Score final sur {generatedExercise.questions.length}.
                </p>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
                  {generatedExercise.questions.map((question: ChooseDeterminantQuestion, index: number) => {
                    const userAnswer = determinantChoiceAnswers[index];
                    const isCorrect = userAnswer === question.bonneReponse;
                    const isAnswered = userAnswer !== undefined;

                    return (
                      <div 
                        key={index}
                        className={`bg-white p-4 rounded-md shadow-sm border-2 transition-colors ${
                          isAnswered ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-200'
                        }`}
                      >
                        <p className="font-medium text-gray-800 mb-2">
                          Question {index + 1}: {question.phrase}
                        </p>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          Fonction: <strong>{question.fonction}</strong> | Genre: <strong>{question.genre}</strong>
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {question.choix.map((choix: string) => {
                            const isSelected = userAnswer === choix;
                            return (
                              <button
                                key={choix}
                                onClick={() => {
                                  setDeterminantChoiceAnswers(prev => ({
                                    ...prev,
                                    [index]: isSelected ? undefined : choix
                                  }));
                                }}
                                disabled={isAnswered && !isSelected}
                                className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                                  isSelected
                                    ? (isCorrect ? 'bg-green-600' : 'bg-red-600')
                                    : 'bg-orange-600 hover:bg-orange-700'
                                }`}
                              >
                                {choix}
                              </button>
                            );
                          })}
                        </div>

                        {isAnswered && !isCorrect && (
                          <div className="mt-3 bg-red-50 p-2 rounded border border-red-200">
                            <p className="text-xs text-red-700">
                              <span className="font-medium">Explication:</span> {question.explication}
                              <br />
                              <span className="font-medium">Bonne réponse:</span> {question.bonneReponse}
                            </p>
                          </div>
                        )}

                        {isAnswered && isCorrect && (
                          <div className="mt-3 bg-green-50 p-2 rounded border border-green-200">
                            <p className="text-xs text-green-700">✓ Correct !</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bouton de correction */}
                <div className="pt-4">
                  <button
                    onClick={() => {
                      let correctCount = 0;
                      generatedExercise.questions.forEach((question: ChooseDeterminantQuestion, index: number) => {
                        if (determinantChoiceAnswers[index] === question.bonneReponse) {
                          correctCount++;
                        }
                      });
                      const score = Math.round((correctCount / generatedExercise.questions.length) * 100);
                      setDeterminantChoiceScore(score);
                      
                      // Sauvegarder l'exercice
                      const newExercice = addExercice({
                        type: generatedExercise.type,
                        leconsAssociees: themeSource === 'cours' ? selectedLecons.map(l => l.id) : [selectedTheme],
                        contenuJSON: {
                          questions: generatedExercise.questions,
                          answers: determinantChoiceAnswers
                        },
                        reponseUtilisateur: determinantChoiceAnswers,
                        correction: `Score: ${score}/100. ${correctCount} bonnes réponses sur ${generatedExercise.questions.length}.`,
                        score: score,
                      });
                      
                      setStep('correcting');
                    }}
                    disabled={Object.keys(determinantChoiceAnswers).length < generatedExercise.questions.length || isLoading}
                    className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
                      Object.keys(determinantChoiceAnswers).length >= generatedExercise.questions.length
                        ? 'bg-orange-600 hover:bg-orange-700 cursor-pointer w-full'
                        : 'bg-orange-300 cursor-not-allowed w-full'
                    }`}
                  >
                    {isLoading ? 'Correction en cours...' : `Corriger (${Object.keys(determinantChoiceAnswers).length}/${generatedExercise.questions.length})`}
                  </button>
                </div>
              </div>
            )}

            {/* CAS GRAMMATICAUX - Sous-exercice C : Tableau de déclinaison */}
            {generatedExercise.type === 'tableau_declinaison' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  Complétez les cellules manquantes du tableau de déclinaison.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm bg-white">
                    <thead>
                      <tr className="bg-[#3730a3] text-white">
                        <th className="p-2 border border-gray-300">Cas / Genre</th>
                        <th className="p-2 border border-gray-300">Nominatif</th>
                        <th className="p-2 border border-gray-300">Accusatif</th>
                        <th className="p-2 border border-gray-300">Datif</th>
                        <th className="p-2 border border-gray-300">Génitif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedExercise.rows.map((row: DeclensionRow, rowIndex: number) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="p-2 border border-gray-300 font-medium">{row.genre}</td>
                          {['nominatif', 'accusatif', 'datif', 'genitif'].map((cas: string) => {
                            const cell = row[cas as 'nominatif' | 'accusatif' | 'datif' | 'genitif'];
                            const userAnswer = declensionTableAnswers[row.genre]?.[cas];
                            const isCorrect = userAnswer === cell.value;
                            const isAnswered = userAnswer !== undefined && userAnswer !== '';
                            
                            return (
                              <td key={cas} className="p-1 border border-gray-300">
                                {cell.isVisible ? (
                                  <div className="p-2 text-center font-medium text-gray-700">{cell.value}</div>
                                ) : (
                                  <input
                                    type="text"
                                    value={userAnswer || ''}
                                    onChange={(e) => {
                                      const answer = e.target.value;
                                      setDeclensionTableAnswers(prev => ({
                                        ...prev,
                                        [row.genre]: {
                                          ...prev[row.genre],
                                          [cas]: answer
                                        }
                                      }));
                                    }}
                                    className={`w-full p-2 text-center rounded border ${
                                      isAnswered 
                                        ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                                        : 'border-gray-300'
                                    }`}
                                    placeholder="?"
                                  />
                                )}
                                {isAnswered && !isCorrect && (
                                  <div className="text-xs text-red-600 text-center mt-1">
                                    Réponse: {cell.value}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bouton de correction */}
                <div className="pt-4">
                  <button
                    onClick={() => {
                      let correctCount = 0;
                      let totalQuestions = 0;
                      
                      generatedExercise.rows.forEach((row: DeclensionRow) => {
                        ['nominatif', 'accusatif', 'datif', 'genitif'].forEach((cas: string) => {
                          const cell = row[cas as 'nominatif' | 'accusatif' | 'datif' | 'genitif'];
                          if (!cell.isVisible) {
                            totalQuestions++;
                            if (declensionTableAnswers[row.genre]?.[cas] === cell.value) {
                              correctCount++;
                            }
                          }
                        });
                      });
                      
                      const score = Math.round((correctCount / totalQuestions) * 100);
                      setDeclensionTableScore(score);
                      
                      // Sauvegarder l'exercice
                      const newExercice = addExercice({
                        type: generatedExercise.type,
                        leconsAssociees: themeSource === 'cours' ? selectedLecons.map(l => l.id) : [selectedTheme],
                        contenuJSON: {
                          rows: generatedExercise.rows,
                          answers: declensionTableAnswers
                        },
                        reponseUtilisateur: declensionTableAnswers,
                        correction: `Score: ${score}/100. ${correctCount} bonnes réponses sur ${totalQuestions}.`,
                        score: score,
                      });
                      
                      setStep('correcting');
                    }}
                    disabled={!getIsExerciseComplete() || isLoading}
                    className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
                      !getIsExerciseComplete() 
                        ? 'bg-green-300 cursor-not-allowed w-full'
                        : 'bg-green-600 hover:bg-green-700 cursor-pointer w-full'
                    }`}
                  >
                    {isLoading ? 'Correction en cours...' : `Corriger`}
                  </button>
                </div>
              </div>
            )}

            {/* Sauvegarde */}
            {step === 'correcting' && (
              <button
                onClick={() => {
                  saveExercise();
                  setStep('saved');
                }}
                className="w-full px-6 py-3 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium"
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
                    setTranslationAnswer('');
                    setOpenQuestionAnswer('');
                    setReorderSelected([]);
                    setConjugationAnswer('');
                    setDialogueAnswers([]);
                    setAssociationPairs([]);
                    setDictationAnswer('');
                    setCorrection(null);
                    setTranslationCorrection(null);
                    setOpenQuestionCorrection(null);
                    setReorderCorrection(null);
                    setConjugationCorrection(null);
                    setDialogueCorrection(null);
                    setAssociationCorrection(null);
                    setDictationCorrection(null);
                  }}
                  className="px-6 py-3 bg-[#3730a3] text-white rounded-xl hover:bg-[#4f46e5] transition-all duration-200 font-medium"
                >
                  Nouvel exercice
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
