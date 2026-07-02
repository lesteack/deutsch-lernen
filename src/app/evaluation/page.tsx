'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getTextesSupport,
  addEvaluation,
  type TexteSupport,
  type TexteSupportType,
  type Evaluation,
  type CritereEvaluation,
} from '@/lib/storage';

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

/** Type pour une évaluation de compréhension */
interface ComprehensionEvaluation {
  texte: string;
  titre: string;
  questions: ComprehensionQuestion[];
}

/** Étapes du flux d'évaluation */
type EvaluationStep = 'reading' | 'answering' | 'correcting' | 'saved';

// ============================================================================
// TEXTE DE DÉMONSTRATION
// ============================================================================

const demoTextEcrite: TexteSupport = {
  id: 'demo-ecrit',
  titre: 'Texte de démonstration - Compréhension écrite',
  type: 'ecrit',
  contenu: `Guten Tag! Ich heiße Anna und ich komme aus Berlin. Berlin ist die Hauptstadt von Deutschland und eine sehr lebendige Stadt.

Ich wohne in einem kleinen Haus mit meinem Hund Max. Max ist ein intelligenter und freundlicher Hund. Jeden Morgen gehe ich mit Max im Park spazieren. Der Park ist sehr schön und groß. Dort gibt es viele Bäume, Blumen und einen kleinen See.

Am Wochenende besuche ich oft meine Freunde. Wir trinken Kaffee und reden über verschiedene Themen. Manchmal gehen wir ins Kino oder in ein Restaurant. Ich liebe die deutsche Küche, besonders die Bratwurst mit Sauerkraut.

In Berlin gibt es viele interessante Orte zu besichtigen: das Brandenburger Tor, den Fernsehturm und viele Museen. Ich arbeite als Lehrerin in einer Grundschule. Meine Schüler sind sehr nett und fleißig. Ich unterrichte Mathe und Deutsch.

Ich reise auch gern. Letztes Jahr war ich in München und Hamburg. Nächstes Jahr möchte ich nach Österreich fahren, um die Berge zu sehen.

Das ist mein Leben in Deutschland!`,
  niveauCECRL: 'A2',
  notionsCles: ['präsentieren', 'wohnort', 'familie', 'beruf', 'reisen', 'deutschland'],
};

const demoTextOral: TexteSupport = {
  id: 'demo-audio',
  titre: 'Texte de démonstration - Compréhension orale',
  type: 'audio',
  contenu: `Hallo! Mein Name ist Thomas. Ich bin 25 Jahre alt und ich studiere Medizin an der Universität Heidelberg.

Heute möchte ich über meinen Tagesablauf erzählen. Um sieben Uhr stehe ich auf. Dann dusche ich und ziehe mich an. Um halb acht frühstücke ich: ich trinke einen Kaffee und esse ein Brot mit Marmelade.

Um acht Uhr beginne ich mit dem Lernen. Ich lese Bücher und mache Übungen. Um zwölf Uhr habe ich eine Pause. Ich esse ein Sandwich und trinke Wasser. Dann lerne ich weiter bis vier Uhr nachmittags.

Nach dem Lernen gehe ich oft zum Sport. Ich spiele Fußball oder gehe schwimmen. Das macht mir viel Spaß und es ist gut für die Gesundheit.

Am Abend koche ich für meine Mitbewohner. Wir essen zusammen und reden über unseren Tag. Manchmal schauen wir einen Film oder spielen Gesellschaftsspiele.

Um elf Uhr gehe ich ins Bett. Ich schlafe sehr gut, weil ich einen anstrengenden aber schönen Tag hatte.

Das war mein typischer Tag als Student.`,
  niveauCECRL: 'A2',
  notionsCles: ['tagesablauf', 'studium', 'essen', 'sport', 'gesundheit', 'freizeit'],
};

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
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère un TexteSupport de type spécifique ou utilise le demo
 */
function getTexteSupportByType(type: TexteSupportType): TexteSupport {
  if (typeof window === 'undefined') {
    return type === 'ecrit' ? demoTextEcrite : demoTextOral;
  }
  
  const textes = getTextesSupport();
  const filtered = textes.filter(t => t.type === type);
  
  if (filtered.length > 0) {
    return filtered[0];
  }
  
  return type === 'ecrit' ? demoTextEcrite : demoTextOral;
}

/**
 * Extrait les 10 premiers mots pour un titre court
 */
function extractShortTitle(text: string, maxWords: number = 10): string {
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const shortWords = words.slice(0, maxWords);
  return shortWords.join(' ') + (words.length > maxWords ? '...' : '');
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function EvaluationPage() {
  const [activeTab, setActiveTab] = useState<EvaluationTab>('comprehensionOrale');
  
  // État pour la compréhension écrite/orale
  const [evaluationData, setEvaluationData] = useState<ComprehensionEvaluation | null>(null);
  const [step, setStep] = useState<EvaluationStep>('reading');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  
  // État UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // ==========================================================================
  // GÉNÉRATION DES QUESTIONS
  // ==========================================================================

  /**
   * Génère des questions de compréhension via Mistral
   */
  const generateQuestions = useCallback(async (texte: string, titre: string, critere: CritereEvaluation) => {
    setIsLoading(true);
    setError(null);
    setStep('answering');

    try {
      const prompt = `Tu es un professeur d'allemand. Crée UN SEUL message JSON contenant EXACTEMENT 5 questions de compréhension sur le texte suivant.

---
Titre: ${titre}
Texte: ${texte}
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
        texte,
        titre,
        questions: validQuestions,
      });
      
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de générer les questions : ${errorMessage}`);
      setStep('reading');
      setIsLoading(false);
    }
  }, []);

  /**
   * Lit le texte à voix haute (Compréhension Orale)
   */
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    
    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE'; // Voix allemande
    utterance.rate = 0.9; // Légèrement plus lent pour la compréhension
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (event) => {
      setIsPlaying(false);
      setError(`Erreur de synthèse vocale : ${(event as SpeechSynthesisErrorEvent).error}`);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  /**
   * Arrête la lecture
   */
  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  // ==========================================================================
  // CORRECTION
  // ==========================================================================

  /**
   * Corrige les réponses
   */
  const correctAnswers = useCallback(() => {
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
    saveEvaluation(finalScore);
  }, [evaluationData, answers]);

  /**
   * Sauvegarde l'évaluation
   */
  const saveEvaluation = useCallback((finalScore: number) => {
    if (!evaluationData) return;

    try {
      const critere: CritereEvaluation = 
        activeTab === 'comprehensionOrale' ? 'comprehensionOrale' : 'comprehensionEcrite';

      const newEvaluation: Omit<Evaluation, 'id' | 'dateRealisation'> = {
        critere,
        portee: 'sequence',
        sequenceCible: evaluationData.titre,
        scoreGlobal: finalScore,
      };

      addEvaluation(newEvaluation);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(`Impossible de sauvegarder l'évaluation`);
    }
  }, [evaluationData, activeTab]);

  // ==========================================================================
  // CHARGEMENT INITIAL
  // ==========================================================================

  // Démarrer avec un texte de démonstration
  useEffect(() => {
    if (activeTab === 'comprehensionEcrite' || activeTab === 'comprehensionOrale') {
      const type = activeTab === 'comprehensionEcrite' ? 'ecrit' : 'audio';
      const texte = getTexteSupportByType(type);
      
      // Générer les questions automatiquement
      const critere: CritereEvaluation = activeTab === 'comprehensionOrale' ? 'comprehensionOrale' : 'comprehensionEcrite';
      generateQuestions(texte.contenu, texte.titre, critere);
    }
  }, [activeTab, generateQuestions]);

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
              onClick={() => {
                setActiveTab(tab.id);
                setStep('reading');
                setEvaluationData(null);
                setAnswers({});
                setScore(null);
              }}
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
           CONTENU SELON L'ONGLET
         ====================================================================== */}
      
      {(activeTab === 'comprehensionEcrite' || activeTab === 'comprehensionOrale') && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          {/* ÉTAPE 1 : LECTURE / ÉCOUTE */}
          {step === 'reading' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement du texte et génération des questions...</p>
            </div>
          )}

          {/* ÉTAPE 2 : QUESTIONNAIRE */}
          {step === 'answering' && evaluationData && (
            <div className="space-y-6">
              {/* En-tête */}
              <div className="text-center">
                <h2 className="text-xl font-semibold font-serif text-[#1e1b4b] mb-2">
                  {activeTab === 'comprehensionOrale' ? 'Compréhension orale' : 'Compréhension écrite'}
                </h2>
                <p className="text-gray-600 text-sm mb-4">
                  Texte : {extractShortTitle(evaluationData.titre, 8)}
                </p>
              </div>

              {/* Texte à lire/écouter */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                {activeTab === 'comprehensionOrale' && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => speakText(evaluationData.texte)}
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
                      onClick={stopSpeaking}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Arrêter
                    </button>
                  </div>
                )}
                
                <div className="max-h-48 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {evaluationData.texte}
                  </p>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-[#1e1b4b]">
                  Questions ({evaluationData.questions.length})
                </h3>
                
                {evaluationData.questions.map((question, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <p className="font-medium text-gray-800 mb-3">
                      Question {index + 1}/{evaluationData.questions.length}
                    </p>
                    <p className="text-gray-700 mb-4">
                      {question.question}
                    </p>
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
                <button
                  onClick={() => {
                    // Réécouter le texte
                    if (activeTab === 'comprehensionOrale') {
                      speakText(evaluationData.texte);
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {activeTab === 'comprehensionOrale' ? 'Réécouter' : 'Relire'}
                </button>
                <button
                  onClick={correctAnswers}
                  disabled={Object.keys(answers).length < evaluationData.questions.length || isLoading}
                  className={`px-6 py-2 rounded-md text-white font-medium flex-1 transition-colors
                    ${Object.keys(answers).length === evaluationData.questions.length && !isLoading
                      ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                      : 'bg-green-300 cursor-not-allowed'}`}
                >
                  Valider mes réponses
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : CORRECTION */}
          {step === 'correcting' && evaluationData && score !== null && (
            <div className="space-y-6">
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
                  {Math.round((score / 100) * evaluationData.questions.length)}/{evaluationData.questions.length} bonnes réponses
                </p>
              </div>

              {/* Détails des corrections */}
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

              {/* Bouton pour revenir */}
              <button
                onClick={() => {
                  setStep('reading');
                  setEvaluationData(null);
                  setAnswers({});
                  setScore(null);
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Faire une autre évaluation
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
           AUTRES ONGLETS (Placeholder)
         ====================================================================== */}
      {(activeTab === 'expressionEcrite' || activeTab === 'expressionOrale' || activeTab === 'testGlobal') && (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-6xl mb-4">{tabs.find(t => t.id === activeTab)?.icon}</div>
          <h2 className="text-2xl font-bold font-serif text-[#1e1b4b] mb-4">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>
          <p className="text-sm text-gray-500">
            Ce contenu sera développé dans les prochaines étapes
          </p>
        </div>
      )}
    </div>
  );
}
