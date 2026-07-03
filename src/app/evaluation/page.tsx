'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllLecons,
  getProgression,
  addEvaluation,
  type Lecon,
  type TexteSupport,
  type TexteSupportType,
  type Evaluation,
  type CritereEvaluation,
  type NiveauCECRL,
} from '@/lib/storage';
import { predefinedThemes } from '@/lib/themes';

// ============================================================================
// TYPES
// ============================================================================

type EvaluationTab = 'comprehensionOrale' | 'comprehensionEcrite' | 'expressionEcrite' | 'expressionOrale' | 'testGlobal';

/** Type pour une question de compréhension */
interface ComprehensionQuestion {
  question: string;
  choix: string[]; // 4 choix
  bonneReponse: number; // index de la bonne réponse (0-3)
  explication: string;
}

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
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const [vocabularyTranslations, setVocabularyTranslations] = useState<Record<string, string>>({});
  
  // État pour l'expression écrite
  const [expressionSubject, setExpressionSubject] = useState<ExpressionSubject | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState<string>('');
  const [writtenCorrection, setWrittenCorrection] = useState<WrittenCorrection | null>(null);
  
  // État pour l'expression orale
  const [oralSubject, setOralSubject] = useState<ExpressionSubject | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [oralCorrection, setOralCorrection] = useState<OralCorrection | null>(null);
  
  // État UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // ==========================================================================
  // CHARGEMENT INITIAL
  // ==========================================================================

  // Charger les leçons et la progression au montage
  useEffect(() => {
    const lecons = getAllLecons();
    const progression = getProgression();
    
    if (lecons.length > 0) {
      // Sélectionner une leçon aléatoire pour le mode 'cours'
      const randomIndex = Math.floor(Math.random() * lecons.length);
      setSelectedLecon(lecons[randomIndex]);
    }
    
    setNiveauCECRL(progression.niveauEstimeCECRL);
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

Chaque question doit avoir :
- Une question claire en allemand (basée sur le contenu du texte)
- 4 choix de réponse (1 correcte, 3 incorrectes mais plausibles)
- La bonne réponse indiquée par son INDEX (0, 1, 2 ou 3)
- Une explication pédagogique en français

Réponds avec UN SEUL objet JSON contenant UN tableau "questions" avec EXACTEMENT 5 éléments :
{
  "questions": [
    {
      "question": "[question en allemand]",
      "choix": ["choix A", "choix B", "choix C", "choix D"],
      "bonneReponse": 0,
      "explication": "[explication en français]"
    },
    ... (4 autres questions)
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire. Le tableau doit contenir EXACTEMENT 5 questions.`;

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
   * Corrige les réponses de compréhension
   */
  const correctComprehensionAnswers = useCallback(() => {
    if (!evaluationData) return;

    let correctCount = 0;

    for (let i = 0; i < evaluationData.questions.length; i++) {
      const question = evaluationData.questions[i];
      const userAnswer = answers[i];
      const isCorrect = userAnswer === question.bonneReponse;
      
      if (isCorrect) {
        correctCount++;
      }
    }

    const finalScore = Math.round((correctCount / evaluationData.questions.length) * 100);
    setScore(finalScore);
    setStep('correcting');

    // Sauvegarder l'évaluation
    saveEvaluation(finalScore, activeTab === 'comprehensionOrale' ? 'comprehensionOrale' : 'comprehensionEcrite');
  }, [evaluationData, answers, activeTab]);

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
  // RENDU
  // ==========================================================================

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* En-tête */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif text-[#1e1b4b] mb-2">
          Évaluation
        </h1>
        <p className="text-gray-600">
          Testez et améliorez vos compétences en allemand
        </p>
      </div>

      {/* Affichage des erreurs */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-500 hover:text-red-700 mt-1"
          >
            ×
          </button>
        </div>
      )}

      {/* ======================================================================
           ONGLETS DE NAVIGATION
         ====================================================================== */}
      <div className="bg-white rounded-xl shadow-md p-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2
                ${activeTab === tab.id
                  ? `bg-${tabColors[tab.id]}-100 text-${tabColors[tab.id]}-700`
                  : 'text-gray-600 hover:bg-gray-100'
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
           COMPRÉHENSION ORALE
         ====================================================================== */}
      {activeTab === 'comprehensionOrale' && step === 'answering' && generatedText && !evaluationData && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Compréhension orale
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
            <p className="text-xs text-gray-500">
              Un texte a été généré. Écoutez-le attentivement.
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
                    Lecture en cours...
                  </>
                ) : (
                  <>
                    <span>🔊</span>
                    Écouter le texte
                  </>
                )}
              </button>
              <button
                onClick={() => setShowText(!showText)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                {showText ? '🙈' : '👁'}
                {showText ? ' Cacher le texte' : ' Voir le texte'}
              </button>
              <button
                onClick={stopSpeaking}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Arrêter
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
                <p>Le texte est caché. Écoutez-le attentivement avant de répondre.</p>
                <p className="text-xs mt-2">Vous pourrez le voir après avoir écouté.</p>
              </div>
            )}
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
           COMPRÉHENSION ORALE/ÉCRITE - QUESTIONS
         ====================================================================== */}
      {(activeTab === 'comprehensionOrale' || activeTab === 'comprehensionEcrite') && 
       step === 'answering' && evaluationData && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold font-serif text-[#1e1b4b]">
              Questions de compréhension
            </h2>
            <p className="text-gray-600 text-sm">
              {getCurrentContext().title}
            </p>
          </div>

          {/* Texte (visible pour CE, masquable pour CO) */}
          {activeTab === 'comprehensionOrale' && (
            <div className="bg-orange-50 rounded-lg p-4 mb-6">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => speakText(evaluationData.generatedText.texte)}
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
                      Lecture...
                    </>
                  ) : (
                    <>
                      <span>🔊</span>
                      Réécouter
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowText(!showText)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  {showText ? '🙈' : '👁'}
                  {showText ? ' Cacher' : ' Voir le texte'}
                </button>
              </div>
              
              {showText && (
                <div className="max-h-48 overflow-y-auto bg-white p-3 rounded-md">
                  <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {evaluationData.generatedText.texte}
                  </p>
                </div>
              )}
              
              {!showText && (
                <div className="text-center py-4 text-gray-400">
                  <p>Le texte est caché. Utilisez le bouton ci-dessus pour le voir.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comprehensionEcrite' && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="max-h-48 overflow-y-auto">
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {evaluationData.generatedText.texte}
                </p>
              </div>
            </div>
          )}

          {/* Questions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[#1e1b4b]">
              Questions ({evaluationData.questions.length})
            </h3>
            
            {evaluationData.questions.map((question, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="font-medium text-gray-800 mb-3">
                  Question {index + 1}/{evaluationData.questions.length}
                </p>
                <p className="text-gray-700 mb-4">{question.question}</p>
                <div className="space-y-2">
                  {question.choix.map((choice, choiceIndex) => (
                    <label
                      key={choiceIndex}
                      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border-2 transition-colors
                        ${answers[index] === choiceIndex 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <input
                        type="radio"
                        name={`q-${index}`}
                        value={choiceIndex}
                        checked={answers[index] === choiceIndex}
                        onChange={(e) => {
                          setAnswers(prev => ({
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
            {Object.keys(answers).length} questions répondus sur {evaluationData.questions.length}
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-4">
            {activeTab === 'comprehensionOrale' && (
              <button
                onClick={() => speakText(evaluationData.generatedText.texte)}
                disabled={isPlaying}
                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
              >
                {isPlaying ? 'Lecture...' : '🔊 Réécouter'}
              </button>
            )}
            <button
              onClick={correctComprehensionAnswers}
              disabled={Object.keys(answers).length < evaluationData.questions.length}
              className={`px-6 py-2 rounded-md text-white font-medium flex-1 transition-colors
                ${Object.keys(answers).length === evaluationData.questions.length
                  ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                  : 'bg-green-300 cursor-not-allowed'}`}
            >
              Valider mes réponses
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
              {activeTab === 'comprehensionOrale' || activeTab === 'comprehensionEcrite' ?
                `${Math.round((score / 100) * (evaluationData?.questions.length || 5))}/${evaluationData?.questions.length || 5} bonnes réponses` :
                `Score global`}
            </p>
          </div>

          {/* Vocabulaire clé (pour CO/CE) */}
          {(activeTab === 'comprehensionOrale' || activeTab === 'comprehensionEcrite') && 
           evaluationData && evaluationData.generatedText.vocabulaireCle.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-3">Vocabulaire clé du texte</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {evaluationData.generatedText.vocabulaireCle.map((word, index) => (
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

          {/* Détails selon le type */}
          
          {/* Correction Compréhension */}
          {(activeTab === 'comprehensionOrale' || activeTab === 'comprehensionEcrite') && evaluationData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
              <h3 className="font-medium text-gray-700 mb-3">Détail des réponses</h3>
              {evaluationData.questions.map((question, index) => {
                const userAnswer = answers[index];
                const isCorrect = userAnswer === question.bonneReponse;
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-md border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
                  >
                    <p className="font-medium text-gray-800 mb-1">
                      Question {index + 1}: {question.question}
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Votre réponse:</span> 
                      <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                        {userAnswer !== undefined ? question.choix[userAnswer] : 'Non répondue'}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Réponse correcte:</span> 
                      <span className="text-green-700 font-medium">{question.choix[question.bonneReponse]}</span>
                    </p>
                    {question.explication && (
                      <p className="text-xs text-gray-500 mt-1">{question.explication}</p>
                    )}
                  </div>
                );
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
           TEST GLOBAL (Placeholder)
         ====================================================================== */}
      {activeTab === 'testGlobal' && (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-6xl mb-4">{tabs.find(t => t.id === activeTab)?.icon}</div>
          <h2 className="text-2xl font-bold font-serif text-[#1e1b4b] mb-4">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>
          <p className="text-sm text-gray-500">
            Ce contenu sera développé dans une prochaine étape
          </p>
        </div>
      )}
    </div>
  );
}
