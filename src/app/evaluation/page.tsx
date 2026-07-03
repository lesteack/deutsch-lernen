'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getAllLecons,
  getProgression,
  addEvaluation,
  getEvaluations,
  type Lecon,
  type TexteSupport,
  type TexteSupportType,
  type Evaluation,
  type CritereEvaluation,
  type NiveauCECRL,
} from '@/lib/storage';
import { mettreAJourProgression } from '@/lib/progression';
import { predefinedThemes } from '@/lib/themes';

// ============================================================================
// TYPES
// ============================================================================

type EvaluationTab = 'comprehensionOrale' | 'comprehensionEcrite' | 'expressionEcrite' | 'expressionOrale' | 'testGlobal';

/** Type pour une question QCM */
interface QCMQuestion {
  type: 'qcm';
  question: string;
  choix: string[]; // 4 choix
  bonneReponse: number; // index de la bonne réponse (0-3)
  explication: string;
}

/** Type pour une question de production écrite */
interface ProductionQuestion {
  type: 'production';
  question: string;
  consigne: string;
  correctionCriteres: string[];
}

/** Type union pour les questions de compréhension */
type ComprehensionQuestion = QCMQuestion | ProductionQuestion;

/** Type pour une question de test global (QCM) */
interface GlobalTestQCMQuestion {
  type: 'qcm';
  critere: 'comprehensionEcrite' | 'comprehensionOrale' | 'expressionEcrite' | 'expressionOrale';
  question: string;
  choix: string[];
  bonneReponse: number;
  explication: string;
}

/** Type pour une question de test global (production écrite) */
interface GlobalTestProductionQuestion {
  type: 'production';
  critere: 'expressionEcrite';
  consigne: string;
  correctionCriteres: string[];
}

/** Type pour une question de test global (oral) */
interface GlobalTestOralQuestion {
  type: 'oral';
  critere: 'expressionOrale';
  consigne: string;
  correctionCriteres: string[];
}

/** Type union pour les questions du test global */
type GlobalTestQuestion = GlobalTestQCMQuestion | GlobalTestProductionQuestion | GlobalTestOralQuestion;

/** État du test global */
type GlobalTestState = 'start' | 'generating' | 'inProgress' | 'correcting' | 'results';

/** Type pour le texte généré par Mistral */
interface GeneratedText {
  texte: string;
  titre: string;
  vocabulaireCle: string[];
}

/** Type pour une évaluation de compréhension */
interface ComprehensionEvaluation {
  generatedText: GeneratedText;
  questions: ComprehensionQuestion[];
}

/** Type pour les réponses utilisateur (mix QCM et production) */
interface UserAnswers {
  qcm?: Record<number, number>; // index question -> index réponse
  production?: Record<number, string>; // index question -> texte réponse
}

/** Type pour un sujet d'expression écrite/orale */
interface ExpressionSubject {
  sujet: string;
  consigne: string;
  dureeConseillee: string;
  niveauVise: NiveauCECRL;
  motsCles: string[];
}

/** Type pour la correction d'expression écrite */
interface WrittenCorrection {
  score: number;
  grammaire: string;
  vocabulaire: string;
  structure: string;
  conseils: string;
}

/** Type pour la correction d'expression orale */
interface OralCorrection {
  score: number;
  prononciation: string;
  grammaire: string;
  vocabulaire: string;
  conseils: string;
}

/** Type pour la correction d'une réponse de production (CO/CE) */
interface ProductionAnswerCorrection {
  score: number;
  comprehension: string;
  vocabulaire: string;
  grammaire: string;
  conseils: string;
}

/** Type de source pour le thème */
type ThemeSource = 'cours' | 'libre';

/** Étapes du flux d'évaluation */
type EvaluationStep = 'setup' | 'generatingText' | 'answering' | 'recording' | 'correcting' | 'saved';

// ============================================================================
// CONSTANTES
// ============================================================================

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

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function EvaluationPage() {
  const [activeTab, setActiveTab] = useState<EvaluationTab>('comprehensionOrale');
  
  // État pour la source du thème
  const [themeSource, setThemeSource] = useState<ThemeSource>('cours');
  const [selectedLecon, setSelectedLecon] = useState<Lecon | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>('Voyage');
  const [customTheme, setCustomTheme] = useState<string>('');
  const [niveauCECRL, setNiveauCECRL] = useState<NiveauCECRL>('A1');
  
  // État pour la compréhension écrite/orale
  const [generatedText, setGeneratedText] = useState<GeneratedText | null>(null);
  const [evaluationData, setEvaluationData] = useState<ComprehensionEvaluation | null>(null);
  const [step, setStep] = useState<EvaluationStep>('setup');
  const [answers, setAnswers] = useState<UserAnswers>({});
  const [score, setScore] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const [vocabularyTranslations, setVocabularyTranslations] = useState<Record<string, string>>({});
  
  // État pour les réponses rédigées en CO (compréhension orale)
  const [oralComprehensionAnswer, setOralComprehensionAnswer] = useState<string>('');
  const [isRecordingComprehension, setIsRecordingComprehension] = useState(false);
  
  // État pour l'expression écrite
  const [expressionSubject, setExpressionSubject] = useState<ExpressionSubject | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState<string>('');
  const [writtenCorrection, setWrittenCorrection] = useState<WrittenCorrection | null>(null);
  
  // État pour l'expression orale
  const [oralSubject, setOralSubject] = useState<ExpressionSubject | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [oralCorrection, setOralCorrection] = useState<OralCorrection | null>(null);
  
  // État pour la correction des réponses de production (CO/CE)
  const [productionCorrection, setProductionCorrection] = useState<ProductionAnswerCorrection | null>(null);
  
  // État pour le test global
  const [globalTestState, setGlobalTestState] = useState<GlobalTestState>('start');
  const [globalTestQuestions, setGlobalTestQuestions] = useState<GlobalTestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [globalTestAnswers, setGlobalTestAnswers] = useState<Record<number, any>>({});
  const [globalTestScores, setGlobalTestScores] = useState<Record<string, number>>({});
  const [globalTestCorrections, setGlobalTestCorrections] = useState<Record<number, any>>({});
  const [globalTestResults, setGlobalTestResults] = useState<{
    scoreGlobal: number;
    scoresParCritere: Record<string, number>;
    nouveauNiveau: string;
    justification: string;
    pointsForts: string[];
    axesAmelioration: string[];
  } | null>(null);
  const [oralTranscript, setOralTranscript] = useState<string>('');
  const [isRecordingGlobal, setIsRecordingGlobal] = useState(false);
  
  // État UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // ==========================================================================
  // CHARGEMENT INITIAL
  // ==========================================================================

  // État pour les évaluations existantes
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  // Charger les leçons, la progression et les évaluations au montage
  useEffect(() => {
    const lecons = getAllLecons();
    const progression = getProgression();
    const evals = getEvaluations();
    
    if (lecons.length > 0) {
      // Sélectionner une leçon aléatoire pour le mode 'cours'
      const randomIndex = Math.floor(Math.random() * lecons.length);
      setSelectedLecon(lecons[randomIndex]);
    }
    
    setNiveauCECRL(progression.niveauEstimeCECRL);
    setEvaluations(evals);
  }, []);

  // Réinitialiser lors du changement d'onglet
  useEffect(() => {
    setStep('setup');
    setGeneratedText(null);
    setEvaluationData(null);
    setExpressionSubject(null);
    setOralSubject(null);
    setAnswers({});
    setWrittenAnswer('');
    setTranscript('');
    setScore(null);
    setShowText(false);
    setWrittenCorrection(null);
    setOralCorrection(null);
    setError(null);
    setVocabularyTranslations({});
  }, [activeTab]);

  // ==========================================================================
  // SÉLECTEUR DE THÈME
  // ==========================================================================

  /**
   * Récupère une leçon aléatoire
   */
  const selectRandomLecon = useCallback(() => {
    const lecons = getAllLecons();
    if (lecons.length === 0) {
      setError('Aucune leçon disponible. Importez d\'abord un PDF via /lecons/import');
      return null;
    }
    const randomIndex = Math.floor(Math.random() * lecons.length);
    return lecons[randomIndex];
  }, []);

  /**
   * Récupère le contexte/thème actuel
   */
  const getCurrentContext = useCallback((): { type: 'lecon' | 'theme'; value: string; title: string; vocabulaire?: string[] } => {
    if (themeSource === 'cours' && selectedLecon) {
      return {
        type: 'lecon',
        value: selectedLecon.contenuTexte,
        title: `Basé sur : ${selectedLecon.titre}`,
        vocabulaire: selectedLecon.notionsCles,
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
  // GÉNÉRATION DU TEXTE (CO/CE)
  // ==========================================================================

  /**
   * Génère un NOUVEAU texte via Mistral
   * NE PAS utiliser le contenu brut de la leçon
   */
  const generateText = useCallback(async () => {
    const context = getCurrentContext();
    setIsLoading(true);
    setError(null);

    try {
      let prompt: string;

      if (context.type === 'lecon') {
        // Basé sur le vocabulaire de la leçon
        const vocabulaire = context.vocabulaire?.join(', ') || '';
        prompt = `Tu es un professeur d'allemand. Crée un NOUVEAU texte en allemand de 150-200 mots pour un élève de niveau ${niveauCECRL}.

---
Thème basé sur la leçon: ${selectedLecon?.titre || 'Inconnu'}
Vocabulaire à réutiliser: ${vocabulaire}
Niveau: ${niveauCECRL}
---

Le texte doit :
- Être ORIGINAL et NOUVEAU (ne pas copier le contenu de la leçon)
- Contenir 150-200 mots
- Utiliser le vocabulaire fourni
- Être adapté au niveau spécifié
- Être clair et pédagogique

Réponds avec UN SEUL objet JSON :
{
  "texte": "[texte en allemand original]",
  "titre": "[titre en français]",
  "vocabulaireCle": ["mot1", "mot2", "mot3", ...]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
      } else {
        // Basé sur un thème libre
        prompt = `Tu es un professeur d'allemand. Crée un NOUVEAU texte en allemand de 150-200 mots sur le thème suivant, pour un élève de niveau ${niveauCECRL}.

---
Thème: ${context.value}
Niveau: ${niveauCECRL}
---

Le texte doit :
- Être ORIGINAL et NOUVEAU
- Contenir 150-200 mots
- Porter sur le thème spécifié
- Être adapté au niveau
- Être clair et pédagogique

Réponds avec UN SEUL objet JSON :
{
  "texte": "[texte en allemand original]",
  "titre": "[titre en français]",
  "vocabulaireCle": ["mot1", "mot2", "mot3", ...]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;
      }

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
        throw new Error(errorData.error || 'Erreur lors de la génération du texte');
      }

      const data = await response.json();
      
      // Valider la réponse
      if (!data.texte || !data.titre || !data.vocabulaireCle) {
        throw new Error('Réponse Mistral invalide : texte, titre ou vocabulaireCle manquant');
      }

      const newText: GeneratedText = {
        texte: String(data.texte),
        titre: String(data.titre),
        vocabulaireCle: Array.isArray(data.vocabulaireCle) 
          ? data.vocabulaireCle.map(String) 
          : [String(data.vocabulaireCle)],
      };

      setGeneratedText(newText);
      setStep('answering');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer le texte : ${errorMessage}`);
      setStep('setup');
      setIsLoading(false);
    }
  }, [getCurrentContext, niveauCECRL, selectedLecon]);

  // ==========================================================================
  // TRADUCTION DU VOCABULAIRE
  // ==========================================================================

  /**
   * Traduit le vocabulaire clé en français via Mistral
   */
  const translateVocabulary = useCallback(async (words: string[]) => {
    if (words.length === 0) return;

    try {
      const prompt = `Tu es un traducteur allemand-français. Traduis ces mots en allemand en français.

---
Mots à traduire: ${words.join(', ')}
---

Réponds avec UN SEUL objet JSON contenant les traductions :
{
  "${words[0]}": "traduction1",
  "${words[1]}": "traduction2",
  ...
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
        throw new Error(errorData.error || 'Erreur lors de la traduction');
      }

      const data = await response.json();
      setVocabularyTranslations(data);

    } catch (err) {
      console.error('Erreur lors de la traduction du vocabulaire:', err);
      // On ne bloque pas, on garde les mots en allemand
    }
  }, []);

  // ==========================================================================
  // GÉNÉRATION DES QUESTIONS (CO/CE)
  // ==========================================================================

  /**
   * Génère des questions de compréhension via Mistral
   * 2 questions QCM + 3 questions de production écrite
   */
  const generateQuestions = useCallback(async () => {
    if (!generatedText) return;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Crée UN SEUL message JSON contenant EXACTEMENT 5 questions de compréhension sur le texte suivant.

---
Titre: ${generatedText.titre}
Texte: ${generatedText.texte}
Niveau: ${niveauCECRL}
---

Le JSON doit contenir EXACTEMENT 2 questions QCM et 3 questions de production écrite.

Pour les questions QCM :
- type: "qcm"
- question: question claire en allemand
- choix: 4 réponses (1 correcte, 3 incorrectes mais plausibles)
- bonneReponse: index (0, 1, 2 ou 3)
- explication: explication en français

Pour les questions de production :
- type: "production"
- question: question en allemand
- consigne: consigne en allemand (ex: "Répondez en allemand en 2-3 phrases.")
- correctionCriteres: ["compréhension", "vocabulaire"]

Réponds avec UN SEUL objet JSON :
{
  "questions": [
    {
      "type": "qcm",
      "question": "[question en allemand]",
      "choix": ["choix A", "choix B", "choix C", "choix D"],
      "bonneReponse": 0,
      "explication": "[explication en français]"
    },
    {
      "type": "qcm",
      "question": "[question en allemand]",
      "choix": ["choix A", "choix B", "choix C", "choix D"],
      "bonneReponse": 2,
      "explication": "[explication en français]"
    },
    {
      "type": "production",
      "question": "[question en allemand]",
      "consigne": "Répondez en allemand en 2-3 phrases.",
      "correctionCriteres": ["compréhension", "vocabulaire"]
    },
    {
      "type": "production",
      "question": "[question en allemand]",
      "consigne": "Répondez en allemand en 2-3 phrases.",
      "correctionCriteres": ["compréhension", "vocabulaire"]
    },
    {
      "type": "production",
      "question": "[question en allemand]",
      "consigne": "Répondez en allemand en 2-3 phrases.",
      "correctionCriteres": ["expression", "vocabulaire"]
    }
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON. Le tableau doit contenir EXACTEMENT 5 questions (2 QCM + 3 production).`;

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
        throw new Error(errorData.error || 'Erreur lors de la génération des questions');
      }

      const data = await response.json();
      
      // Valider la réponse
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length !== 5) {
        throw new Error(`Réponse Mistral invalide : attendu 5 questions, reçu ${data.questions?.length || 0}`);
      }

      // Valider chaque question
      const validQuestions: ComprehensionQuestion[] = data.questions.map((q: any, index: number) => {
        if (q.type === 'qcm') {
          if (!q.question || !q.choix || !Array.isArray(q.choix) || q.choix.length !== 4 || 
              q.bonneReponse === undefined || q.bonneReponse === null) {
            throw new Error(`Question QCM ${index + 1} invalide`);
          }
          return {
            type: 'qcm',
            question: String(q.question),
            choix: q.choix.map((c: any) => String(c)),
            bonneReponse: Number(q.bonneReponse),
            explication: String(q.explication || ''),
          };
        } else if (q.type === 'production') {
          if (!q.question || !q.consigne) {
            throw new Error(`Question production ${index + 1} invalide`);
          }
          return {
            type: 'production',
            question: String(q.question),
            consigne: String(q.consigne),
            correctionCriteres: Array.isArray(q.correctionCriteres) 
              ? q.correctionCriteres.map(String) 
              : [],
          };
        } else {
          throw new Error(`Type de question invalide: ${q.type}`);
        }
      });

      setEvaluationData({
        generatedText,
        questions: validQuestions,
      });
      
      // Précharger les traductions du vocabulaire
      if (generatedText.vocabulaireCle.length > 0) {
        translateVocabulary(generatedText.vocabulaireCle);
      }
      
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer les questions : ${errorMessage}`);
      setStep('answering'); // Reste sur la même étape pour réessayer
      setIsLoading(false);
    }
  }, [generatedText, niveauCECRL, translateVocabulary]);

  // ==========================================================================
  // GÉNÉRATION DE SUJETS (EE/EO)
  // ==========================================================================

  /**
   * Génère un sujet d'expression via Mistral
   * Le sujet et la consigne doivent être ENTIÈREMENT en allemand
   */
  const generateExpressionSubject = useCallback(async (forOral: boolean = false) => {
    const context = getCurrentContext();
    setIsLoading(true);
    setError(null);

    try {
      const contextVocab = context.type === 'lecon' 
        ? context.vocabulaire?.join(', ') || ''
        : context.value;

      const prompt = `Tu es un professeur d'allemand. Crée un sujet d'expression ${forOral ? 'orale' : 'écrite'} ENTIÈREMENT EN ALLEMAND pour un élève de niveau ${niveauCECRL}.

---
Contexte: ${contextVocab}
Niveau: ${niveauCECRL}
Type: ${forOral ? 'oral' : 'écrit'}
--- 

${forOral ? 
        'Crée un sujet court (1-2 phrases max) en allemand pour une expression orale spontanée. Le sujet doit être clair et permettre à l\'élève de parler pendant 1-2 minutes. La consigne doit guider l\'élève pour structurer sa réponse.' :
        'Crée un sujet de rédaction en allemand avec des consignes claires. Le sujet doit être adapté au niveau et permettre à l\'élève d\'écrire un texte de 100-150 mots. La consigne doit être précise et en allemand.'
      }

Réponds avec UN SEUL objet JSON avec TOUS les champs en allemand :
{
  "sujet": "[problématique en allemand - 1 phrase claire]",
  "consigne": "[consigne détaillée en allemand pour guider l'élève]",
  "dureeConseillee": "15 Minuten",
  "niveauVise": "${niveauCECRL}",
  "motsCles": ["mot1", "mot2", "mot3", ...]
}

Exemple:
{
  "sujet": "Sind soziale Netzwerke gut oder schlecht für Jugendliche?",
  "consigne": "Geben Sie Ihre Meinung mit 2 Argumenten dafür und 2 Argumenten dagegen. Benutzen Sie konkrete Beispiele.",
  "dureeConseillee": "15 Minuten",
  "niveauVise": "B1",
  "motsCles": ["soziale Netzwerke", "Jugendliche", "Vorteile", "Nachteile", "Beispiele"]
}

IMPORTANT : TOUT doit être en allemand. Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

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
        throw new Error(errorData.error || 'Erreur lors de la génération du sujet');
      }

      const data = await response.json();
      
      if (!data.sujet || !data.consigne) {
        throw new Error('Réponse Mistral invalide : sujet ou consigne manquants');
      }

      const subject: ExpressionSubject = {
        sujet: String(data.sujet),
        consigne: String(data.consigne),
        dureeConseillee: String(data.dureeConseillee || (forOral ? '2 Minuten' : '15 Minuten')),
        niveauVise: (data.niveauVise as NiveauCECRL) || niveauCECRL,
        motsCles: Array.isArray(data.motsCles) ? data.motsCles.map(String) : [],
      };

      if (forOral) {
        setOralSubject(subject);
      } else {
        setExpressionSubject(subject);
      }
      setStep('answering');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer le sujet : ${errorMessage}`);
      setStep('setup');
      setIsLoading(false);
    }
  }, [getCurrentContext, niveauCECRL]);

  // ==========================================================================
  // SPEECH SYNTHESIS (CO)
  // ==========================================================================

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (event) => {
      setIsPlaying(false);
      setError(`Erreur de synthèse vocale : ${(event as SpeechSynthesisErrorEvent).error}`);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  // ==========================================================================
  // SPEECH RECOGNITION (EO)
  // ==========================================================================

  const startRecording = useCallback(() => {
    if (typeof window === 'undefined') {
      setError('La reconnaissance vocale n\'est pas disponible dans cet environnement');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(prev => prev + finalTranscript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      setError(`Erreur de reconnaissance vocale : ${event.error}`);
    };

    recognition.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && (window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
    }
    setIsRecording(false);
  }, []);

  // ==========================================================================
  // CORRECTION
  // ==========================================================================

  /**
   * Corrige les réponses de compréhension (mix QCM + production)
   */
  const correctComprehensionAnswers = useCallback(async () => {
    if (!evaluationData) return;

    setIsLoading(true);
    setError(null);

    try {
      // Compter les bonnes réponses QCM
      let correctCount = 0;
      let qcmCount = 0;
      
      for (let i = 0; i < evaluationData.questions.length; i++) {
        const question = evaluationData.questions[i];
        if (question.type === 'qcm') {
          qcmCount++;
          const userAnswer = answers.qcm?.[i];
          if (userAnswer !== undefined && userAnswer === question.bonneReponse) {
            correctCount++;
          }
        }
      }

      // Corriger les questions de production avec Mistral
      const productionQuestions = evaluationData.questions.filter(q => q.type === 'production');
      let productionScore = 0;
      const productionCorrections: Record<number, ProductionAnswerCorrection> = {};
      
      for (const [indexStr, answerText] of Object.entries(answers.production || {})) {
        const index = parseInt(indexStr);
        const question = evaluationData.questions[index];
        if (question && question.type === 'production' && answerText) {
          const correction = await correctProductionAnswer(answerText, question, niveauCECRL);
          productionCorrections[index] = correction;
          productionScore += correction.score;
        }
      }

      // Score final : moyenne entre QCM et production
      const totalQuestions = evaluationData.questions.length;
      const productionCount = productionQuestions.length;
      const averageProductionScore = productionCount > 0 ? productionScore / productionCount : 0;
      
      const qcmScore = qcmCount > 0 ? (correctCount / qcmCount) * 100 : 0;
      const finalScore = Math.round((qcmScore * (qcmCount / totalQuestions)) + 
                                     (averageProductionScore * (productionCount / totalQuestions)));
      
      setScore(finalScore);
      setProductionCorrection(null); // Reset pour éviter les conflits
      setStep('correcting');

      // Sauvegarder l'évaluation
      saveEvaluation(finalScore, activeTab === 'comprehensionOrale' ? 'comprehensionOrale' : 'comprehensionEcrite');
      
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger : ${errorMessage}`);
      setIsLoading(false);
    }
  }, [evaluationData, answers, activeTab, niveauCECRL]);

  /**
   * Corrige la réponse de compréhension orale (réponse rédigée) via Mistral
   */
  const correctComprehensionProduction = useCallback(async (answer: string, text: string, niveau: NiveauCECRL): Promise<ProductionAnswerCorrection> => {
    const prompt = `Tu es un professeur d'allemand. Corrige cette réponse de compréhension orale écrite par un élève de niveau ${niveau}.

---
Texte original: ${text}
Réponse de l'élève: ${answer}
Niveau: ${niveau}
---

Évalue la réponse par rapport au texte original.

Fais une correction détaillée avec :
- Un score sur 100 (basé sur la compréhension, le vocabulaire et la grammaire)
- Des commentaires sur ce qui a été compris
- Des commentaires sur le vocabulaire utilisé
- Des commentaires sur la grammaire
- Des conseils pour progresser

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "comprehension": "[commentaires sur la compréhension en français]",
  "vocabulaire": "[commentaires sur le vocabulaire en français]",
  "grammaire": "[commentaires sur la grammaire en français]",
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
      comprehension: String(data.comprehension || ''),
      vocabulaire: String(data.vocabulaire || ''),
      grammaire: String(data.grammaire || ''),
      conseils: String(data.conseils || ''),
    };
  }, []);

  /**
   * Corrige une réponse de production via Mistral
   */
  const correctProductionAnswer = useCallback(async (answer: string, question: ProductionQuestion, niveau: NiveauCECRL): Promise<ProductionAnswerCorrection> => {
    const prompt = `Tu es un professeur d'allemand. Corrige cette réponse écrite par un élève de niveau ${niveau}.

---
Question: ${question.question}
Consigne: ${question.consigne}
Réponse de l'élève: ${answer}
Niveau: ${niveau}
Critères à évaluer: ${question.correctionCriteres.join(', ')}
---

Fais une correction détaillée avec :
- Un score sur 100
- Des commentaires sur la compréhension du texte
- Des commentaires sur le vocabulaire utilisé
- Des commentaires sur la grammaire
- Des conseils pour progresser

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "comprehension": "[commentaires sur la compréhension en français]",
  "vocabulaire": "[commentaires sur le vocabulaire en français]",
  "grammaire": "[commentaires sur la grammaire en français]",
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
      comprehension: String(data.comprehension || ''),
      vocabulaire: String(data.vocabulaire || ''),
      grammaire: String(data.grammaire || ''),
      conseils: String(data.conseils || ''),
    };
  }, []);

  /**
   * Corrige l'expression écrite
   */
  const correctWrittenExpression = useCallback(async () => {
    if (!expressionSubject || !writtenAnswer.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige ce texte écrit par un élève de niveau ${niveauCECRL}.

---
Sujet: ${expressionSubject.sujet}
Texte de l'élève: ${writtenAnswer}
Niveau: ${niveauCECRL}
---

Fais une correction détaillée et bienveillante avec :
- Un score global sur 100
- Des commentaires sur la grammaire
- Des commentaires sur le vocabulaire
- Des commentaires sur la structure
- Des conseils pour améliorer

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "grammaire": "[commentaires sur la grammaire en français]",
  "vocabulaire": "[commentaires sur le vocabulaire en français]",
  "structure": "[commentaires sur la structure en français]",
  "conseils": "[conseils généraux en français]"
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

      const correction: WrittenCorrection = {
        score: Number(data.score),
        grammaire: String(data.grammaire || ''),
        vocabulaire: String(data.vocabulaire || ''),
        structure: String(data.structure || ''),
        conseils: String(data.conseils || ''),
      };

      setWrittenCorrection(correction);
      setScore(correction.score);
      setStep('correcting');

      // Sauvegarder
      saveEvaluation(correction.score, 'expressionEcrite');

      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger : ${errorMessage}`);
      setIsLoading(false);
    }
  }, [expressionSubject, writtenAnswer, niveauCECRL]);

  /**
   * Corrige l'expression orale
   */
  const correctOralExpression = useCallback(async () => {
    if (!oralSubject || !transcript.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige cette transcription d'expression orale d'un élève de niveau ${niveauCECRL}.

---
Sujet: ${oralSubject.sujet}
Transcription: ${transcript}
Niveau: ${niveauCECRL}
---

Fais une correction détaillée avec :
- Un score global sur 100
- Des commentaires sur la prononciation
- Des commentaires sur la grammaire
- Des commentaires sur le vocabulaire
- Des conseils pour améliorer

Note : Sois bienveillant et encourageant. La transcription peut contenir des erreurs dues à la reconnaissance vocale.

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "prononciation": "[commentaires sur la prononciation en français]",
  "grammaire": "[commentaires sur la grammaire en français]",
  "vocabulaire": "[commentaires sur le vocabulaire en français]",
  "conseils": "[conseils généraux en français]"
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

      const correction: OralCorrection = {
        score: Number(data.score),
        prononciation: String(data.prononciation || ''),
        grammaire: String(data.grammaire || ''),
        vocabulaire: String(data.vocabulaire || ''),
        conseils: String(data.conseils || ''),
      };

      setOralCorrection(correction);
      setScore(correction.score);
      setStep('correcting');

      // Sauvegarder
      saveEvaluation(correction.score, 'expressionOrale');

      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger : ${errorMessage}`);
      setIsLoading(false);
    }
  }, [oralSubject, transcript, niveauCECRL]);

  /**
   * Sauvegarde l'évaluation
   */
  const saveEvaluation = useCallback((finalScore: number, critere: CritereEvaluation) => {
    try {
      const context = getCurrentContext();
      const newEvaluation: Omit<Evaluation, 'id' | 'dateRealisation'> = {
        critere,
        portee: 'sequence',
        sequenceCible: context.title,
        scoreGlobal: finalScore,
      };

      addEvaluation(newEvaluation);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(`Impossible de sauvegarder l'évaluation`);
    }
  }, [getCurrentContext]);

  // ==========================================================================
  // FONCTIONS POUR LE TEST GLOBAL
  // ==========================================================================

  /**
   * Génère les questions du test global à partir de toutes les leçons
   */
  const generateGlobalTestQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGlobalTestState('generating');

    try {
      const lecons = getAllLecons();
      const progression = getProgression();
      
      if (lecons.length === 0) {
        throw new Error('Aucune leçon disponible. Importez d\'abord un PDF via /lecons/import');
      }

      // Préparer le contexte : titres + notionsCles de toutes les leçons
      const leconsContext = lecons.map(l => ({
        titre: l.titre,
        notionsCles: l.notionsCles,
        type: l.type,
      }));

      // Calculer les poids : plus de poids aux leçons anciennes et non testées
      const poidsParLecon = lecons.map((lecon, index) => {
        let poids = 1;
        
        // Plus de poids aux leçons anciennes
        const ageEnJours = Math.floor(
          (new Date().getTime() - new Date(lecon.dateAjout).getTime()) / (1000 * 60 * 60 * 24)
        );
        poids += Math.min(ageEnJours / 7, 2); // +2 max pour les très anciennes
        
        // Plus de poids aux leçons jamais testées
        const estTestee = evaluations.some(e => 
          e.sequenceCible?.includes(lecon.titre) || 
          e.sequenceCible?.includes(lecon.id)
        );
        if (!estTestee) {
          poids += 3; // Bonus important pour les non-testées
        }
        
        return Math.round(poids * 100) / 100;
      });

      const prompt = `Tu es un professeur d'allemand. Crée un test global complet pour évaluer toutes les compétences d'un élève.

---
Contexte: L'élève a étudié les leçons suivantes :
${leconsContext.map(l => `- ${l.titre} (mots-clés: ${l.notionsCles.slice(0, 5).join(', ')})`).join('\n')}

Niveau actuel estimé: ${progression.niveauEstimeCECRL || 'A1'}
Poids par leçon: ${poidsParLecon.map((p, i) => `${lecons[i].titre}: ${p}`).join(', ')}

---

Crée EXACTEMENT 10 questions variées avec la répartition suivante :
- 5 questions QCM
- 3 questions de production écrite
- 2 questions d'expression orale

Les questions doivent couvrir tous les critères CECRL :
- comprehensionEcrite (compréhension écrite)
- comprehensionOrale (compréhension orale)
- expressionEcrite (expression écrite)
- expressionOrale (expression orale)

Pour les QCM :
- type: "qcm"
- critere: un des 4 critères ci-dessus
- question: question en allemand
- choix: 4 réponses (1 correcte, 3 incorrectes)
- bonneReponse: index (0-3)
- explication: explication en français

Pour les productions écrites :
- type: "production"
- critere: "expressionEcrite"
- consigne: consigne en allemand (ex: "Schreiben Sie 3-4 Sätze über...")
- correctionCriteres: ["grammaire", "vocabulaire", "structure"]

Pour les oraux :
- type: "oral"
- critere: "expressionOrale"
- consigne: consigne en allemand (ex: "Sprechen Sie 1 Minute über...")
- correctionCriteres: ["prononciation", "vocabulaire", "fluidite"]

Donne plus de poids aux leçons anciennes et non testées dans tes questions.

Réponds avec UN SEUL objet JSON :
{
  "questions": [
    {
      "type": "qcm",
      "critere": "comprehensionEcrite",
      "question": "...",
      "choix": ["A", "B", "C", "D"],
      "bonneReponse": 0,
      "explication": "..."
    },
    ... (9 autres questions)
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON. Le tableau doit contenir EXACTEMENT 10 questions.`;

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
        throw new Error(errorData.error || 'Erreur lors de la génération du test global');
      }

      const data = await response.json();
      
      // Valider la réponse
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length !== 10) {
        throw new Error(`Réponse Mistral invalide : attendu 10 questions, reçu ${data.questions?.length || 0}`);
      }

      // Valider et parser les questions
      const validQuestions: GlobalTestQuestion[] = data.questions.map((q: any, index: number) => {
        if (q.type === 'qcm') {
          if (!q.question || !q.choix || !Array.isArray(q.choix) || q.choix.length !== 4 || 
              q.bonneReponse === undefined || !q.critere) {
            throw new Error(`Question QCM ${index + 1} invalide`);
          }
          return {
            type: 'qcm',
            critere: q.critere,
            question: String(q.question),
            choix: q.choix.map((c: any) => String(c)),
            bonneReponse: Number(q.bonneReponse),
            explication: String(q.explication || ''),
          };
        } else if (q.type === 'production') {
          if (!q.consigne || !q.critere) {
            throw new Error(`Question production ${index + 1} invalide`);
          }
          return {
            type: 'production',
            critere: q.critere,
            consigne: String(q.consigne),
            correctionCriteres: Array.isArray(q.correctionCriteres) 
              ? q.correctionCriteres.map(String) 
              : ['grammaire', 'vocabulaire'],
          };
        } else if (q.type === 'oral') {
          if (!q.consigne || !q.critere) {
            throw new Error(`Question orale ${index + 1} invalide`);
          }
          return {
            type: 'oral',
            critere: q.critere,
            consigne: String(q.consigne),
            correctionCriteres: Array.isArray(q.correctionCriteres) 
              ? q.correctionCriteres.map(String) 
              : ['prononciation', 'vocabulaire', 'fluidite'],
          };
        } else {
          throw new Error(`Type de question invalide: ${q.type}`);
        }
      });

      setGlobalTestQuestions(validQuestions);
      setGlobalTestState('inProgress');
      setCurrentQuestionIndex(0);
      setGlobalTestAnswers({});
      setGlobalTestScores({});
      setGlobalTestCorrections({});
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer le test global : ${errorMessage}`);
      setGlobalTestState('start');
      setIsLoading(false);
    }
  }, [evaluations]);

  /**
   * Corrige une réponse QCM du test global
   */
  const correctGlobalTestQCM = useCallback(async (questionIndex: number, answerIndex: number) => {
    const question = globalTestQuestions[questionIndex];
    if (question.type !== 'qcm') return;

    const isCorrect = answerIndex === question.bonneReponse;
    const score = isCorrect ? 100 : 0;

    // Stocker la réponse et le score
    setGlobalTestAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex,
    }));

    setGlobalTestScores(prev => ({
      ...prev,
      [question.critere]: prev[question.critere] ? 
        Math.round((prev[question.critere] + score) / 2) : score,
    }));

    setGlobalTestCorrections(prev => ({
      ...prev,
      [questionIndex]: {
        isCorrect,
        explication: question.explication,
        bonneReponse: question.choix[question.bonneReponse],
        userAnswer: question.choix[answerIndex],
      },
    }));
  }, [globalTestQuestions]);

  /**
   * Corrige une réponse de production écrite du test global
   */
  const correctGlobalTestProduction = useCallback(async (questionIndex: number, answer: string) => {
    const question = globalTestQuestions[questionIndex];
    if (question.type !== 'production') return;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige cette réponse d'expression écrite pour le test global.

---
Consigne: ${question.consigne}
Réponse de l'élève: ${answer}
Critères à évaluer: ${question.correctionCriteres.join(', ')}
---

Fais une correction détaillée avec :
- Un score sur 100
- Des commentaires sur la grammaire
- Des commentaires sur le vocabulaire  
- Des commentaires sur la structure
- Des conseils pour améliorer

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "grammaire": "[commentaires en français]",
  "vocabulaire": "[commentaires en français]",
  "structure": "[commentaires en français]",
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

      const correction = {
        score: Number(data.score),
        grammaire: String(data.grammaire || ''),
        vocabulaire: String(data.vocabulaire || ''),
        structure: String(data.structure || ''),
        conseils: String(data.conseils || ''),
      };

      // Stocker la réponse, le score et la correction
      setGlobalTestAnswers(prev => ({
        ...prev,
        [questionIndex]: answer,
      }));

      setGlobalTestScores(prev => ({
        ...prev,
        [question.critere]: prev[question.critere] ? 
          Math.round((prev[question.critere] + correction.score) / 2) : correction.score,
      }));

      setGlobalTestCorrections(prev => ({
        ...prev,
        [questionIndex]: correction,
      }));

      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger : ${errorMessage}`);
      setIsLoading(false);
    }
  }, [globalTestQuestions]);

  /**
   * Corrige une réponse orale du test global
   */
  const correctGlobalTestOral = useCallback(async (questionIndex: number, transcript: string) => {
    const question = globalTestQuestions[questionIndex];
    if (question.type !== 'oral') return;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Tu es un professeur d'allemand. Corrige cette réponse d'expression orale pour le test global.

---
Consigne: ${question.consigne}
Transcription: ${transcript}
Critères à évaluer: ${question.correctionCriteres.join(', ')}
---

Fais une correction détaillée avec :
- Un score sur 100
- Des commentaires sur la prononciation
- Des commentaires sur la grammaire
- Des commentaires sur le vocabulaire
- Des conseils pour améliorer

Note : Sois bienveillant. La transcription peut contenir des erreurs de reconnaissance vocale.

Réponds avec UN SEUL objet JSON :
{
  "score": number (0-100),
  "prononciation": "[commentaires en français]",
  "grammaire": "[commentaires en français]",
  "vocabulaire": "[commentaires en français]",
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

      const correction = {
        score: Number(data.score),
        prononciation: String(data.prononciation || ''),
        grammaire: String(data.grammaire || ''),
        vocabulaire: String(data.vocabulaire || ''),
        conseils: String(data.conseils || ''),
        transcript,
      };

      // Stocker la réponse, le score et la correction
      setGlobalTestAnswers(prev => ({
        ...prev,
        [questionIndex]: transcript,
      }));

      setGlobalTestScores(prev => ({
        ...prev,
        [question.critere]: prev[question.critere] ? 
          Math.round((prev[question.critere] + correction.score) / 2) : correction.score,
      }));

      setGlobalTestCorrections(prev => ({
        ...prev,
        [questionIndex]: correction,
      }));

      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de corriger : ${errorMessage}`);
      setIsLoading(false);
    }
  }, [globalTestQuestions]);

  /**
   * Passe à la question suivante
   */
  const goToNextQuestion = useCallback(() => {
    if (currentQuestionIndex < globalTestQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Dernière question, calculer les résultats finaux
      calculateGlobalTestResults();
    }
  }, [currentQuestionIndex, globalTestQuestions.length]);

  /**
   * Calcule les résultats finaux du test global
   */
  const calculateGlobalTestResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGlobalTestState('results');

    try {
      // Calculer les scores finaux par critère
      const scoresFinaux: Record<string, number> = {
        comprehensionOrale: 0,
        comprehensionEcrite: 0,
        expressionOrale: 0,
        expressionEcrite: 0,
      };

      // Compter les questions par critère
      const countParCritere: Record<string, number> = {
        comprehensionOrale: 0,
        comprehensionEcrite: 0,
        expressionOrale: 0,
        expressionEcrite: 0,
      };

      // Compter les questions par critère
      globalTestQuestions.forEach(question => {
        countParCritere[question.critere] = (countParCritere[question.critere] || 0) + 1;
      });

      // Calculer les scores moyens par critère
      Object.entries(globalTestScores).forEach(([critere, score]) => {
        scoresFinaux[critere as keyof typeof scoresFinaux] += score;
      });

      // Calculer la moyenne par critère
      const scoresParCritere: Record<string, number> = {};
      Object.keys(scoresFinaux).forEach(critere => {
        if (countParCritere[critere] > 0) {
          scoresParCritere[critere] = Math.round(scoresFinaux[critere as keyof typeof scoresFinaux] / countParCritere[critere]);
        } else {
          scoresParCritere[critere] = 0;
        }
      });

      // Calculer le score global
      const allScores = Object.values(scoresParCritere);
      const scoreGlobal = Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length);

      // Mettre à jour la progression et obtenir le nouveau niveau
      const progressionMiseAJour = await mettreAJourProgression();

      // Sauvegarder chaque évaluation
      globalTestQuestions.forEach((question, index) => {
        const answer = globalTestAnswers[index];
        if (answer !== undefined) {
          const score = globalTestCorrections[index]?.score || 
                       (question.type === 'qcm' ? 
                         (answer === question.bonneReponse ? 100 : 0) : 0);
          
          addEvaluation({
            critere: question.critere,
            portee: 'global',
            sequenceCible: 'Test global complet',
            scoreGlobal: score,
          });
        }
      });

      // Déterminer points forts et axes d'amélioration
      const pointsForts: string[] = [];
      const axesAmelioration: string[] = [];

      Object.entries(scoresParCritere).forEach(([critere, score]) => {
        if (score >= 70) {
          pointsForts.push(critere);
        } else {
          axesAmelioration.push(critere);
        }
      });

      setGlobalTestResults({
        scoreGlobal,
        scoresParCritere,
        nouveauNiveau: progressionMiseAJour.niveauEstimeCECRL,
        justification: progressionMiseAJour.justificationMistral || '',
        pointsForts,
        axesAmelioration,
      });

      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de calculer les résultats : ${errorMessage}`);
      setIsLoading(false);
    }
  }, [globalTestQuestions, globalTestAnswers, globalTestScores, globalTestCorrections]);

  /**
   * Démarre l'enregistrement pour une question orale du test global
   */
  const startGlobalRecording = useCallback(() => {
    if (typeof window === 'undefined') {
      setError('La reconnaissance vocale n\'est pas disponible dans cet environnement');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsRecordingGlobal(true);
      setOralTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText + ' ';
        } else {
          interimTranscript += transcriptText;
        }
      }

      setOralTranscript(prev => prev + finalTranscript);
    };

    recognition.onend = () => {
      setIsRecordingGlobal(false);
      // Stocker la transcription dans les réponses si elle n'est pas vide
      if (oralTranscript.trim()) {
        setGlobalTestAnswers(prev => ({
          ...prev,
          [currentQuestionIndex]: oralTranscript,
        }));
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecordingGlobal(false);
      setError(`Erreur de reconnaissance vocale : ${event.error}`);
    };

    recognition.start();
    (window as any).currentGlobalRecognition = recognition;
  }, []);

  /**
   * Arrête l'enregistrement pour une question orale du test global
   */
  const stopGlobalRecording = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && (window as any).currentGlobalRecognition) {
      (window as any).currentGlobalRecognition.stop();
    }
    setIsRecordingGlobal(false);
    // Stocker la transcription dans les réponses si elle n'est pas vide
    if (oralTranscript.trim()) {
      setGlobalTestAnswers(prev => ({
        ...prev,
        [currentQuestionIndex]: oralTranscript,
      }));
    }
  }, [currentQuestionIndex, oralTranscript]);

  // ==========================================================================
  // RENDU
  // ==========================================================================

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* En-tête avec dégradé */}
        <div className="bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] rounded-xl p-6 mb-8 shadow-lg text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Évaluation
          </h1>
          <p className="text-white/80">
            Testez et améliorez vos compétences en allemand
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
           ONGLETS DE NAVIGATION
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-2 mb-8">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2
                ${activeTab === tab.id
                  ? `bg-[#3730a3] text-white border-b-4 border-yellow-400`
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================================
           SÉLECTEUR DE THÈME (pour tous les onglets sauf Test Global)
         ====================================================================== */}
      {(activeTab !== 'testGlobal') && step === 'setup' && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <h2 className="text-lg font-semibold font-serif text-[#1e1b4b]">
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
                  <p className="text-xs text-gray-500 mt-1">
                    Vocabulaire : {selectedLecon.notionsCles.slice(0, 5).join(', ')}
                    {selectedLecon.notionsCles.length > 5 && '...'}
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

          {/* Sélecteur de niveau */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Niveau CECRL
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

          {/* Affichage du contexte sélectionné */}
          {getCurrentContext().title && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                {getCurrentContext().title}
              </p>
            </div>
          )}

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
              onClick={() => {
                if (activeTab === 'comprehensionOrale' || activeTab === 'comprehensionEcrite') {
                  generateText();
                } else if (activeTab === 'expressionEcrite') {
                  generateExpressionSubject(false);
                } else if (activeTab === 'expressionOrale') {
                  generateExpressionSubject(true);
                }
              }}
              disabled={isLoading}
              className={`w-full px-6 py-3 rounded-md text-white font-medium transition-colors
                ${!isLoading 
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' 
                  : 'bg-blue-300 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                  Génération en cours...
                </>
              ) : (
                `Générer ${activeTab === 'comprehensionOrale' || activeTab === 'comprehensionEcrite' ? 'un texte' : 'un sujet'}`
              )}
            </button>
          )}
        </div>
      )}

      {/* ======================================================================
           COMPRÉHENSION ORALE - Réponse rédigée
         ====================================================================== */}
      {activeTab === 'comprehensionOrale' && step === 'answering' && generatedText && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Hörverstehen
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
            <p className="text-xs text-gray-500">
              Ein Text wurde generiert. Hören Sie ihn aufmerksam an.
            </p>
          </div>

          {/* Texte CACHÉ par défaut */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => speakText(generatedText.texte)}
                disabled={isPlaying}
                className={`px-4 py-2 rounded-md text-white font-medium transition-colors
                  ${isPlaying 
                    ? 'bg-orange-400 cursor-not-allowed' 
                    : 'bg-orange-600 hover:bg-orange-700 cursor-pointer'}
                  flex items-center gap-2`}
              >
                {isPlaying ? (
                  <>
                    <span className="animate-pulse">🔊</span>
                    Wird abgespielt...
                  </>
                ) : (
                  <>
                    <span>🔊</span>
                    Text anhören
                  </>
                )}
              </button>
              <button
                onClick={() => setShowText(!showText)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                {showText ? '🙈' : '👁'}
                {showText ? ' Text ausblenden' : ' Text anzeigen'}
              </button>
              <button
                onClick={stopSpeaking}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Stop
              </button>
            </div>
            
            {showText && (
              <div className="max-h-48 overflow-y-auto bg-white p-3 rounded-md">
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {generatedText.texte}
                </p>
              </div>
            )}
            
            {!showText && (
              <div className="text-center py-8 text-gray-400">
                <p>Der Text ist versteckt. Hören Sie ihn aufmerksam an, bevor Sie antworten.</p>
                <p className="text-xs mt-2">Sie können ihn nach dem Anhören einblenden.</p>
              </div>
            )}
          </div>

          {/* Question ouverte unique pour CO */}
          <div className="bg-orange-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-orange-800 mb-3">Frage</h3>
            <p className="text-orange-700 text-lg">
              Was haben Sie verstanden? Fassen Sie den Text auf Deutsch zusammen.
            </p>
            <p className="text-sm text-orange-600 mt-1">
              (Qu'avez-vous compris ? Résumez le texte en allemand.)
            </p>
          </div>

          {/* Zone de réponse */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ihre Antwort
            </label>
            <textarea
              value={oralComprehensionAnswer}
              onChange={(e) => setOralComprehensionAnswer(e.target.value)}
              placeholder="Schreiben Sie hier auf Deutsch was Sie verstanden haben..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[150px]"
              rows={6}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    if (SpeechRecognitionAPI) {
                      setIsRecordingComprehension(true);
                      const recognition = new SpeechRecognitionAPI();
                      recognition.lang = 'de-DE';
                      recognition.interimResults = true;
                      recognition.continuous = false;

                      recognition.onstart = () => setIsRecordingComprehension(true);
                      recognition.onend = () => setIsRecordingComprehension(false);
                      recognition.onerror = (event: any) => {
                        setIsRecordingComprehension(false);
                        setError(`Erreur de reconnaissance vocale : ${event.error}`);
                      };

                      let finalTranscript = '';
                      recognition.onresult = (event: any) => {
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                          const transcript = event.results[i][0].transcript;
                          if (event.results[i].isFinal) {
                            finalTranscript += transcript + ' ';
                          }
                        }
                        setOralComprehensionAnswer(prev => prev + finalTranscript);
                      };

                      recognition.start();
                      (window as any).currentComprehensionRecognition = recognition;
                    } else {
                      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur');
                    }
                  }
                }}
                disabled={isRecordingComprehension}
                className={`px-4 py-2 rounded-md text-white font-medium transition-colors flex items-center gap-2
                  ${isRecordingComprehension ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 cursor-pointer'}`}
              >
                {isRecordingComprehension ? (
                  <>
                    <span className="animate-pulse">🎤</span>
                    Aufnahme läuft...
                  </>
                ) : (
                  <>
                    <span>🎤</span>
                    Mikrofon
                  </>
                )}
              </button>
              {isRecordingComprehension && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).currentComprehensionRecognition) {
                      (window as any).currentComprehensionRecognition.stop();
                      setIsRecordingComprehension(false);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {oralComprehensionAnswer.length} Zeichen
            </p>
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            <button
              onClick={() => speakText(generatedText.texte)}
              disabled={isPlaying}
              className="px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors flex items-center gap-2"
            >
              {isPlaying ? 'Wird abgespielt...' : '🔊 Nochmal anhören'}
            </button>
            <button
              onClick={async () => {
                if (!oralComprehensionAnswer.trim()) {
                  setError('Bitte geben Sie eine Antwort ein');
                  return;
                }
                setIsLoading(true);
                setError(null);
                try {
                  // Corriger la réponse avec Mistral
                  const correction = await correctComprehensionProduction(oralComprehensionAnswer, generatedText.texte, niveauCECRL);
                  setProductionCorrection(correction);
                  setScore(correction.score);
                  setStep('correcting');
                  saveEvaluation(correction.score, 'comprehensionOrale');
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
                  setError(`Impossible de corriger : ${errorMessage}`);
                }
                setIsLoading(false);
              }}
              disabled={!oralComprehensionAnswer.trim() || isLoading}
              className={`px-6 py-2 rounded-md text-white font-medium flex-1 transition-colors
                ${oralComprehensionAnswer.trim() && !isLoading
                  ? 'bg-orange-600 hover:bg-orange-700 cursor-pointer'
                  : 'bg-orange-300 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                  Korrektur läuft...
                </>
              ) : (
                'Antwort überprüfen'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
           COMPRÉHENSION ÉCRITE
         ====================================================================== */}
      {activeTab === 'comprehensionEcrite' && step === 'answering' && generatedText && !evaluationData && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Compréhension écrite
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
            <p className="text-xs text-gray-500">
              Un texte a été généré. Lisez-le attentivement.
            </p>
          </div>

          {/* Texte visible */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="max-h-48 overflow-y-auto">
              <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                {generatedText.texte}
              </p>
            </div>
          </div>

          {/* Bouton pour générer les questions */}
          <button
            onClick={generateQuestions}
            disabled={isLoading}
            className={`w-full px-6 py-3 rounded-md text-white font-medium transition-colors
              ${!isLoading 
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' 
                : 'bg-blue-300 cursor-not-allowed'}`}
          >
            {isLoading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                Génération des questions...
              </>
            ) : (
              'Générer les questions de compréhension'
            )}
          </button>
        </div>
      )}

      {/* ======================================================================
           COMPRÉHENSION ÉCRITE - QUESTIONS (2 QCM + 3 production)
         ====================================================================== */}
      {activeTab === 'comprehensionEcrite' && 
       step === 'answering' && evaluationData && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Fragen zum Textverständnis
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
          </div>

          {/* Texte visible */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="max-h-48 overflow-y-auto">
              <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                {evaluationData.generatedText.texte}
              </p>
            </div>
          </div>

          {/* Questions (mix QCM + production) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[#1e1b4b]">
              Fragen ({evaluationData.questions.length})
            </h3>
            
            {evaluationData.questions.map((question, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="font-medium text-gray-800 mb-3">
                  Frage {index + 1}/{evaluationData.questions.length}
                </p>
                <p className="text-gray-700 mb-4">{question.question}</p>
                
                {question.type === 'qcm' && (
                  <div className="space-y-2">
                    {question.choix.map((choice, choiceIndex) => (
                      <label
                        key={choiceIndex}
                        className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border-2 transition-colors
                          ${answers.qcm?.[index] === choiceIndex 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        <input
                          type="radio"
                          name={`qcm-${index}`}
                          value={choiceIndex}
                          checked={answers.qcm?.[index] === choiceIndex}
                          onChange={(e) => {
                            setAnswers(prev => ({
                              ...prev,
                              qcm: {
                                ...prev.qcm,
                                [index]: Number(e.target.value),
                              },
                            }));
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">{choice}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {question.type === 'production' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">{question.consigne}</p>
                    <textarea
                      value={answers.production?.[index] || ''}
                      onChange={(e) => {
                        setAnswers(prev => ({
                          ...prev,
                          production: {
                            ...prev.production,
                            [index]: e.target.value,
                          },
                        }));
                      }}
                      placeholder="Schreiben Sie Ihre Antwort hier auf Deutsch..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                      rows={4}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Indicateur de progression */}
          <div className="text-sm text-gray-500">
            {Object.keys(answers.qcm || {}).length} QCM beantwortet, 
            {Object.keys(answers.production || {}).length} Produktionsfragen beantwortet
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={correctComprehensionAnswers}
              disabled={(
                Object.keys(answers.qcm || {}).length < 2 || 
                Object.keys(answers.production || {}).length < 3
              )}
              className={`px-6 py-2 rounded-md text-white font-medium flex-1 transition-colors
                ${(Object.keys(answers.qcm || {}).length >= 2 && Object.keys(answers.production || {}).length >= 3)
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  : 'bg-blue-300 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                  Korrektur läuft...
                </>
              ) : (
                'Antworten überprüfen'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
           EXPRESSION ÉCRITE
         ====================================================================== */}
      {activeTab === 'expressionEcrite' && step === 'answering' && expressionSubject && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Schriftlicher Ausdruck
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
          </div>

          {/* Sujet */}
          <div className="bg-purple-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-purple-800 mb-2">Thema</h3>
            <p className="text-purple-700 mb-3 text-lg font-medium">{expressionSubject.sujet}</p>
            <p className="text-sm text-purple-600 mb-3">{expressionSubject.consigne}</p>
            {expressionSubject.motsCles && expressionSubject.motsCles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-200">
                <p className="text-xs text-purple-500 mb-2">Schlüsselwörter:</p>
                <div className="flex flex-wrap gap-1">
                  {expressionSubject.motsCles.map((word, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-purple-400 mt-2">
              Empfohlene Dauer: {expressionSubject.dureeConseillee} | Niveau: {expressionSubject.niveauVise}
            </p>
          </div>

          {/* Zone de saisie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ihr Text (empfohlen: 100-150 Wörter)
            </label>
            <textarea
              value={writtenAnswer}
              onChange={(e) => setWrittenAnswer(e.target.value)}
              placeholder="Schreiben Sie Ihren Text hier auf Deutsch..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[200px]"
              rows={10}
            />
            <p className="text-xs text-gray-500 mt-1">
              {writtenAnswer.length} Zeichen
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep('setup')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Thema ändern
            </button>
            <button
              onClick={correctWrittenExpression}
              disabled={!writtenAnswer.trim() || isLoading}
              className={`px-6 py-2 rounded-md text-white font-medium flex-1 transition-colors
                ${writtenAnswer.trim() && !isLoading
                  ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer'
                  : 'bg-purple-300 cursor-not-allowed'}`}
            >
              {isLoading ? 'Korrektur läuft...' : 'Zur Korrektur einreichen'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
           EXPRESSION ORALE
         ====================================================================== */}
      {activeTab === 'expressionOrale' && step === 'answering' && oralSubject && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Mündlicher Ausdruck
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
          </div>

          {/* Sujet */}
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-green-800 mb-2">Thema</h3>
            <p className="text-green-700 mb-3 text-lg font-medium">{oralSubject.sujet}</p>
            <p className="text-sm text-green-600 mb-3">{oralSubject.consigne}</p>
            {oralSubject.motsCles && oralSubject.motsCles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-500 mb-2">Schlüsselwörter:</p>
                <div className="flex flex-wrap gap-1">
                  {oralSubject.motsCles.map((word, index) => (
                    <span key={index} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-green-400 mt-2">
              Empfohlene Dauer: {oralSubject.dureeConseillee} | Niveau: {oralSubject.niveauVise}
            </p>
          </div>

          {/* Enregistrement */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-3">Aufnahme</h3>
            
            {!isRecording ? (
              <button
                onClick={() => {
                  startRecording();
                  (window as any).currentRecognition = true;
                }}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
              >
                🎤 Aufnahme starten
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    stopRecording();
                    delete (window as any).currentRecognition;
                  }}
                  className="w-full px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  ⏹ Aufnahme stoppen
                </button>
                <div className="bg-white rounded-md p-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Transkription:</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{transcript || 'Sprechen Sie...'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Soumission */}
          {transcript.trim() && !isRecording && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  startRecording();
                  (window as any).currentRecognition = true;
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Neu aufnehmen
              </button>
              <button
                onClick={correctOralExpression}
                disabled={isLoading}
                className={`px-6 py-2 rounded-md text-white font-medium flex-1 transition-colors
                  ${!isLoading
                    ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                    : 'bg-green-300 cursor-not-allowed'}`}
              >
                {isLoading ? 'Korrektur läuft...' : 'Zur Korrektur einreichen'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
           CORRECTION (tous les types)
         ====================================================================== */}
      {step === 'correcting' && score !== null && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          {/* Résultat global */}
          <div className="text-center">
            <h2 className="text-2xl font-bold font-serif mb-2">
              {score >= 80 ? (
                <span className="text-green-600">✓ Excellent travail !</span>
              ) : score >= 50 ? (
                <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
              ) : (
                <span className="text-red-600">✗ Revisez ces notions</span>
              )}
            </h2>
            <div className="text-5xl font-bold mb-2">
              <span className={score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                {score}/100
              </span>
            </div>
            <p className="text-gray-600">
              {activeTab === 'comprehensionOrale' ?
                `Score global` :
                activeTab === 'comprehensionEcrite' ?
                `${Math.round((score / 100) * (evaluationData?.questions.length || 5))}/${evaluationData?.questions.length || 5} bonnes réponses` :
                `Score global`}
            </p>
          </div>

          {/* Vocabulaire clé (pour CO/CE) */}
          {((activeTab === 'comprehensionOrale' && generatedText) || 
            (activeTab === 'comprehensionEcrite' && evaluationData)) && 
           (generatedText?.vocabulaireCle.length || 0) > 0 && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-3">
                {activeTab === 'comprehensionOrale' ? 'Schlüsselwörter des Textes' : 'Vocabulaire clé du texte'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(activeTab === 'comprehensionOrale' ? generatedText!.vocabulaireCle : evaluationData!.generatedText.vocabulaireCle).map((word, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{word}</span>
                    <span className="text-gray-500">—</span>
                    <span className="text-yellow-700">
                      {vocabularyTranslations[word] || word}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Afficher le texte original pour CO */}
          {activeTab === 'comprehensionOrale' && generatedText && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="font-medium text-orange-800 mb-3">Originaltext</h3>
              <div className="max-h-48 overflow-y-auto bg-white p-3 rounded-md">
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {generatedText.texte}
                </p>
              </div>
            </div>
          )}

          {/* Détails selon le type */}
          
          {/* Correction Compréhension Orale (réponse rédigée) */}
          {activeTab === 'comprehensionOrale' && productionCorrection && (
            <div className="bg-orange-50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-orange-800 mb-3">Detaillierte Korrektur</h3>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-orange-700">Compréhension</h4>
                  <p className="text-sm text-orange-600">{productionCorrection.comprehension || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-orange-700">Vocabulaire</h4>
                  <p className="text-sm text-orange-600">{productionCorrection.vocabulaire || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-orange-700">Grammaire</h4>
                  <p className="text-sm text-orange-600">{productionCorrection.grammaire || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-orange-700">Conseils</h4>
                  <p className="text-sm text-orange-600">{productionCorrection.conseils || 'Aucun commentaire'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Correction Compréhension Écrite (mix QCM + production) */}
          {activeTab === 'comprehensionEcrite' && evaluationData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
              <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
              {evaluationData.questions.map((question, index) => {
                if (question.type === 'qcm') {
                  const userAnswer = answers.qcm?.[index];
                  const isCorrect = userAnswer !== undefined && userAnswer === question.bonneReponse;
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-md border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                    >
                      <p className="font-medium text-gray-800 mb-1">
                        Frage {index + 1}: {question.question}
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Ihre Antwort:</span> 
                        <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                          {userAnswer !== undefined ? question.choix[userAnswer] : 'Nicht beantwortet'}
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Richtige Antwort:</span> 
                        <span className="text-green-700 font-medium">{question.choix[question.bonneReponse]}</span>
                      </p>
                      {question.explication && (
                        <p className="text-xs text-gray-500 mt-1">{question.explication}</p>
                      )}
                    </div>
                  );
                } else if (question.type === 'production') {
                  const userAnswer = answers.production?.[index];
                  return (
                    <div key={index} className="p-3 rounded-md border-l-4 border-blue-500 bg-blue-50">
                      <p className="font-medium text-gray-800 mb-1">
                        Frage {index + 1}: {question.question}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">{question.consigne}</p>
                      <p className="text-sm">
                        <span className="text-gray-600">Ihre Antwort:</span> 
                        <span className="text-blue-700">{userAnswer || 'Nicht beantwortet'}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Correction Expression Écrite */}
          {activeTab === 'expressionEcrite' && writtenCorrection && (
            <div className="bg-purple-50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-purple-800 mb-3">Correction détaillée</h3>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-purple-700">Grammaire</h4>
                  <p className="text-sm text-purple-600">{writtenCorrection.grammaire || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-purple-700">Vocabulaire</h4>
                  <p className="text-sm text-purple-600">{writtenCorrection.vocabulaire || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-purple-700">Structure</h4>
                  <p className="text-sm text-purple-600">{writtenCorrection.structure || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-purple-700">Conseils</h4>
                  <p className="text-sm text-purple-600">{writtenCorrection.conseils || 'Aucun commentaire'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Correction Expression Orale */}
          {activeTab === 'expressionOrale' && oralCorrection && (
            <div className="bg-green-50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-green-800 mb-3">Correction détaillée</h3>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-green-700">Prononciation</h4>
                  <p className="text-sm text-green-600">{oralCorrection.prononciation || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-green-700">Grammaire</h4>
                  <p className="text-sm text-green-600">{oralCorrection.grammaire || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-green-700">Vocabulaire</h4>
                  <p className="text-sm text-green-600">{oralCorrection.vocabulaire || 'Aucun commentaire'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-green-700">Conseils</h4>
                  <p className="text-sm text-green-600">{oralCorrection.conseils || 'Aucun commentaire'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Bouton pour revenir */}
          <button
            onClick={() => setStep('setup')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Faire une autre évaluation
          </button>
        </div>
      )}

      {/* ======================================================================
           TEST GLOBAL
         ====================================================================== */}
      {activeTab === 'testGlobal' && (
        <div className="space-y-6">
          {/* Écran de démarrage */}
          {globalTestState === 'start' && (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold font-serif text-[#1e1b4b] mb-4">
                Test global
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Ce test couvre toutes vos notions apprises et met à jour votre niveau CECRL
              </p>
              <p className="text-sm text-gray-500 mb-8">
                Durée estimée : ~20 minutes
              </p>
              <button
                onClick={generateGlobalTestQuestions}
                disabled={isLoading}
                className={`px-8 py-3 rounded-lg text-white font-medium text-lg transition-colors
                  ${!isLoading 
                    ? 'bg-red-600 hover:bg-red-700 cursor-pointer' 
                    : 'bg-red-300 cursor-not-allowed'}`}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block mr-2"></span>
                    Génération en cours...
                  </>
                ) : (
                  'Commencer le test global'
                )}
              </button>
            </div>
          )}

          {/* Écran de génération */}
          {globalTestState === 'generating' && (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold font-serif text-[#1e1b4b] mb-4">
                Génération du test
              </h2>
              <p className="text-gray-600 mb-6">
                Nous analysons vos leçons et générons un test personnalisé...
              </p>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
            </div>
          )}

          {/* Écran de test en cours */}
          {globalTestState === 'inProgress' && globalTestQuestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
              {/* Barre de progression */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-600">
                  Question {currentQuestionIndex + 1} / {globalTestQuestions.length}
                </span>
                <div className="w-full mx-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${((currentQuestionIndex) / globalTestQuestions.length) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Affichage de la question actuelle */}
              {(() => {
                const currentQuestion = globalTestQuestions[currentQuestionIndex];
                const questionAnswer = globalTestAnswers[currentQuestionIndex];
                
                if (currentQuestion.type === 'qcm') {
                  return (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-medium text-gray-800 mb-2">
                          Frage {currentQuestionIndex + 1}/{globalTestQuestions.length}
                        </h3>
                        <p className="text-gray-700 mb-4">{currentQuestion.question}</p>
                        
                        <div className="space-y-2">
                          {currentQuestion.choix.map((choice, choiceIndex) => {
                            const isSelected = questionAnswer === choiceIndex;
                            const isCorrect = globalTestCorrections[currentQuestionIndex]?.isCorrect;
                            const isAnswered = questionAnswer !== undefined;
                            
                            return (
                              <label
                                key={choiceIndex}
                                className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border-2 transition-colors
                                  ${isSelected 
                                    ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                              >
                                <input
                                  type="radio"
                                  name={`global-qcm-${currentQuestionIndex}`}
                                  value={choiceIndex}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const answerIndex = Number(e.target.value);
                                    correctGlobalTestQCM(currentQuestionIndex, answerIndex);
                                  }}
                                  disabled={isAnswered}
                                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                                />
                                <span className="text-gray-700">{choice}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bouton suivant */}
                      {questionAnswer !== undefined && (
                        <button
                          onClick={goToNextQuestion}
                          className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                        >
                          Question suivante →
                        </button>
                      )}
                    </div>
                  );
                }

                else if (currentQuestion.type === 'production') {
                  return (
                    <div className="space-y-4">
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h3 className="font-medium text-purple-800 mb-2">
                          Frage {currentQuestionIndex + 1}/{globalTestQuestions.length}
                        </h3>
                        <p className="text-purple-700 mb-4">{currentQuestion.consigne}</p>
                        
                        <textarea
                          value={questionAnswer || ''}
                          onChange={(e) => {
                            setGlobalTestAnswers(prev => ({
                              ...prev,
                              [currentQuestionIndex]: e.target.value,
                            }));
                          }}
                          placeholder="Schreiben Sie Ihre Antwort hier auf Deutsch..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[150px]"
                          rows={6}
                          disabled={globalTestCorrections[currentQuestionIndex]}
                        />
                        
                        {/* Boutons */}
                        <div className="flex gap-3 mt-4">
                          {globalTestCorrections[currentQuestionIndex] ? (
                            <button
                              onClick={goToNextQuestion}
                              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
                            >
                              Question suivante →
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                await correctGlobalTestProduction(currentQuestionIndex, questionAnswer || '');
                              }}
                              disabled={!questionAnswer || isLoading}
                              className={`px-6 py-2 rounded-md text-white font-medium transition-colors
                                ${!questionAnswer || isLoading 
                                  ? 'bg-purple-300 cursor-not-allowed' 
                                  : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}
                            >
                              {isLoading ? 'Korrektur läuft...' : 'Corriger'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                else if (currentQuestion.type === 'oral') {
                  return (
                    <div className="space-y-4">
                      <div className="bg-green-50 rounded-lg p-4">
                        <h3 className="font-medium text-green-800 mb-2">
                          Frage {currentQuestionIndex + 1}/{globalTestQuestions.length}
                        </h3>
                        <p className="text-green-700 mb-4">{currentQuestion.consigne}</p>
                        
                        {/* Zone de transcription */}
                        <div className="bg-white rounded-md p-4 border border-green-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Transkription:
                          </p>
                          <p className="text-gray-600 whitespace-pre-wrap min-h-[80px]">
                            {oralTranscript || (questionAnswer || 'Sprechen Sie hier...')}
                          </p>
                        </div>

                        {/* Boutons d'enregistrement */}
                        <div className="flex gap-3 mt-4">
                          {!isRecordingGlobal && !questionAnswer ? (
                            <button
                              onClick={startGlobalRecording}
                              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex-1"
                            >
                              🎤 Aufnahme starten
                            </button>
                          ) : null}
                          
                          {isRecordingGlobal && (
                            <button
                              onClick={stopGlobalRecording}
                              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                            >
                              ⏹ Aufnahme stoppen
                            </button>
                          )}
                          
                          {!isRecordingGlobal && questionAnswer && !globalTestCorrections[currentQuestionIndex] && (
                            <button
                              onClick={async () => {
                                await correctGlobalTestOral(currentQuestionIndex, questionAnswer);
                              }}
                              disabled={isLoading}
                              className={`px-6 py-2 rounded-md text-white font-medium transition-colors
                                ${isLoading 
                                  ? 'bg-green-300 cursor-not-allowed' 
                                  : 'bg-green-600 hover:bg-green-700 cursor-pointer'}`}
                            >
                              {isLoading ? 'Korrektur läuft...' : 'Corriger'}
                            </button>
                          )}
                          
                          {globalTestCorrections[currentQuestionIndex] && (
                            <button
                              onClick={goToNextQuestion}
                              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                            >
                              Question suivante →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          )}

          {/* Écran de résultats */}
          {globalTestState === 'results' && globalTestResults && (
            <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
              {/* Résultat global */}
              <div className="text-center">
                <h2 className="text-2xl font-bold font-serif mb-2">
                  {globalTestResults.scoreGlobal >= 80 ? (
                    <span className="text-green-600">✓ Excellent travail !</span>
                  ) : globalTestResults.scoreGlobal >= 50 ? (
                    <span className="text-yellow-600">⚠ Bien, mais peut mieux faire</span>
                  ) : (
                    <span className="text-red-600">✗ Revisez vos compétences</span>
                  )}
                </h2>
                <div className="text-5xl font-bold mb-2">
                  <span className={globalTestResults.scoreGlobal >= 80 ? 'text-green-600' : 
                                        globalTestResults.scoreGlobal >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                    {globalTestResults.scoreGlobal}/100
                  </span>
                </div>
                <p className="text-gray-600">
                  Score global du test
                </p>
              </div>

              {/* Nouveau niveau CECRL */}
              <div className="bg-gradient-to-r from-[#3730a3] to-[#6366f1] rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-3 text-center">
                  Nouveau niveau CECRL estimé
                </h3>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 border-2 border-white/30 mb-4">
                    <span className="text-4xl font-bold">{globalTestResults.nouveauNiveau}</span>
                  </div>
                  <p className="text-sm opacity-90 max-w-md mx-auto">
                    {globalTestResults.justification}
                  </p>
                </div>
              </div>

              {/* Scores par critère */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-center">
                  Scores par compétence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(globalTestResults.scoresParCritere).map(([critere, score]) => {
                    const isPointFort = globalTestResults.pointsForts.includes(critere);
                    return (
                      <div
                        key={critere}
                        className={`p-4 rounded-lg ${isPointFort ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-700">
                            {critere === 'comprehensionOrale' && 'Compréhension orale'}
                            {critere === 'comprehensionEcrite' && 'Compréhension écrite'}
                            {critere === 'expressionOrale' && 'Expression orale'}
                            {critere === 'expressionEcrite' && 'Expression écrite'}
                          </span>
                          <span className={`font-bold ${isPointFort ? 'text-green-600' : 'text-orange-600'}`}>
                            {score}/100
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${isPointFort ? 'bg-green-500' : 'bg-orange-500'}`}
                            style={{ width: `${score}%` }}
                          ></div>
                        </div>
                        <p className={`text-xs mt-2 ${isPointFort ? 'text-green-600' : 'text-orange-600'}`}>
                          {isPointFort ? '✓ Point fort' : '⚠ À améliorer'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Points forts et axes d'amélioration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Points forts */}
                {globalTestResults.pointsForts.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-3 text-center">
                      ✓ Points forts
                    </h4>
                    <ul className="text-sm text-green-700 space-y-2">
                      {globalTestResults.pointsForts.map((critere, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span>✓</span>
                          <span>
                            {critere === 'comprehensionOrale' && 'Compréhension orale'}
                            {critere === 'comprehensionEcrite' && 'Compréhension écrite'}
                            {critere === 'expressionOrale' && 'Expression orale'}
                            {critere === 'expressionEcrite' && 'Expression écrite'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Axes d'amélioration */}
                {globalTestResults.axesAmelioration.length > 0 && (
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h4 className="font-medium text-orange-800 mb-3 text-center">
                      ⚠ Axes d'amélioration
                    </h4>
                    <ul className="text-sm text-orange-700 space-y-2">
                      {globalTestResults.axesAmelioration.map((critere, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span>⚠</span>
                          <span>
                            {critere === 'comprehensionOrale' && 'Compréhension orale'}
                            {critere === 'comprehensionEcrite' && 'Compréhension écrite'}
                            {critere === 'expressionOrale' && 'Expression orale'}
                            {critere === 'expressionEcrite' && 'Expression écrite'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Boutons d'action */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Link
                  href="/"
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-center"
                >
                  Retour au dashboard
                </Link>
                <button
                  onClick={() => {
                    setGlobalTestState('start');
                    setGlobalTestQuestions([]);
                    setCurrentQuestionIndex(0);
                    setGlobalTestAnswers({});
                    setGlobalTestScores({});
                    setGlobalTestCorrections({});
                    setGlobalTestResults(null);
                    setOralTranscript('');
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
                >
                  Recommencer le test
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
