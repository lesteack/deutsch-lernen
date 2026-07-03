'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  addManuel,
  addChapitre,
  addLecon,
  updateLecon,
  type Manuel,
  type Chapitre,
  type Lecon,
  type FicheRevision,
} from '@/lib/storage';

// ============================================================================
// TYPES
// ============================================================================

/** Représente une section de texte extraite du PDF (deviendra une leçon) */
interface PdfTextSection {
  id: string;
  text: string;
  title: string; // Titre proposé, éditable
}

/** Représente un chapitre avec ses leçons */
interface PdfChapter {
  id: string;
  title: string;
  lessons: PdfTextSection[];
}

/** Étapes du processus d'import */
type ImportStep = 'upload' | 'extracting' | 'preview' | 'organize';

// ============================================================================
// CONSTANTES
// ============================================================================

const TARGET_WORDS_PER_SECTION = 400;
const SECTIONS_PER_CHAPTER = 6;

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function PdfImportPage() {
  // État général
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [manuelTitle, setManuelTitle] = useState('');
  const [editor, setEditor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingFiche, setIsGeneratingFiche] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  // État pour le contenu extrait
  const [rawText, setRawText] = useState('');
  const [chapters, setChapters] = useState<PdfChapter[]>([]);
  
  // Type de leçon par défaut pour le manuel
  const [defaultLessonType, setDefaultLessonType] = useState<Lecon['type']>('autre');

  const router = useRouter();

  // ==========================================================================
  // EXTRACTION DU TEXTE (chargement dynamique de pdfjs-dist)
  // ==========================================================================

  /**
   * Extrait le texte de toutes les pages d'un PDF
   * Charge pdfjs-dist dynamiquement pour éviter les erreurs SSR
   */
  const extractTextFromPdf = useCallback(async (pdfFile: File) => {
    // Vérifier qu'on est bien côté client
    if (typeof window === 'undefined') {
      setError('Impossible de traiter le PDF : environnement non supporté');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('extracting');

    try {
      // Charger pdfjs-dist dynamiquement
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configurer le worker avec l'URL CDN pour la version 6.1.200
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://unpkg.com/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs';

      // Lire le fichier comme ArrayBuffer
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // Charger le document PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';

      // Extraire le texte de chaque page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        
        // pdfjs-dist peut retourner différents types d'items
        // On extrait le champ 'str' de chaque item
        const textItems: string[] = content.items.map((item: any) => item.str || '');
        const pageText = textItems.join(' ').trim();
        
        fullText += pageText + '\n\n';
      }

      setRawText(fullText);
      
      // Découper automatiquement en sections/leçons
      const sections = splitTextIntoSections(fullText);
      
      // Organiser les sections en chapitres
      const initialChapters = organizeIntoChapters(sections);
      
      setChapters(initialChapters);
      setStep('preview');
      setIsLoading(false);

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Une erreur inconnue est survenue';
      setError(`Erreur lors de l'extraction du PDF: ${errorMessage}`);
      setIsLoading(false);
    }
  }, []);

  /**
   * Découpe le texte en sections (futures leçons)
   * Une section = ~400 mots
   */
  const splitTextIntoSections = (text: string): PdfTextSection[] => {
    // Nettoyer le texte : remplacer les espaces multiples
    const cleanedText = text.replace(/\s+/g, ' ').trim();

    if (cleanedText.length === 0) {
      return [{
        id: crypto.randomUUID(),
        text: '',
        title: 'Nouvelle section',
      }];
    }

    // Découper en paragraphes (2 sauts de ligne ou plus)
    const paragraphs = cleanedText.split(/\n{2,}/).filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) {
      return [{
        id: crypto.randomUUID(),
        text: cleanedText,
        title: 'Section 1',
      }];
    }

    // Regrouper les paragraphes en sections de ~TARGET_WORDS_PER_SECTION mots
    const sections: PdfTextSection[] = [];
    let currentSection: { text: string; paragraphs: string[] } = { 
      text: '', 
      paragraphs: [] 
    };
    let currentWordCount = 0;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(w => w.trim().length > 0);
      const paraWordCount = paraWords.length;

      // Si ajouter ce paragraphe dépasse la cible, finaliser la section actuelle
      if (currentWordCount + paraWordCount > TARGET_WORDS_PER_SECTION && currentSection.text.length > 0) {
        sections.push({
          id: crypto.randomUUID(),
          text: currentSection.text.trim(),
          title: generateSectionTitle(currentSection.paragraphs),
        });
        currentSection = { text: '', paragraphs: [] };
        currentWordCount = 0;
      }

      // Ajouter le paragraphe à la section actuelle
      const separator = currentSection.text.length > 0 ? '\n\n' : '';
      currentSection.text += separator + para;
      currentSection.paragraphs.push(para);
      currentWordCount += paraWordCount;
    }

    // Ajouter la dernière section
    if (currentSection.text.trim().length > 0) {
      sections.push({
        id: crypto.randomUUID(),
        text: currentSection.text.trim(),
        title: generateSectionTitle(currentSection.paragraphs),
      });
    }

    // Si on a une seule section très longue, la découper en plusieurs
    if (sections.length === 1 && currentWordCount > TARGET_WORDS_PER_SECTION * 2) {
      return splitLongSection(sections[0], TARGET_WORDS_PER_SECTION);
    }

    return sections;
  };

  /**
   * Découpe une section trop longue en plusieurs sections
   */
  const splitLongSection = (section: PdfTextSection, targetWords: number): PdfTextSection[] => {
    const words = section.text.split(/\s+/);
    const sections: PdfTextSection[] = [];
    
    for (let i = 0; i < words.length; i += targetWords) {
      const chunk = words.slice(i, i + targetWords).join(' ');
      sections.push({
        id: crypto.randomUUID(),
        text: chunk,
        title: `Partie ${Math.floor(i / targetWords) + 1}`,
      });
    }
    
    return sections;
  };

  /**
   * Génère un titre à partir des premiers mots d'une section
   */
  const generateSectionTitle = (paragraphs: string[]): string => {
    const firstPara = paragraphs[0] || '';
    
    // Nettoyer et obtenir les mots
    const words = firstPara
      .split(/\s+/)
      .map(w => w.replace(/[^\w\säöüßÄÖÜ]/g, ''))
      .filter(w => w.length >= 3);
    
    if (words.length === 0) {
      return 'Nouvelle section';
    }
    
    // Prendre les 3-5 premiers mots
    const titleWords = words.slice(0, Math.min(5, words.length));
    let title = titleWords.join(' ');
    
    // Ajouter ... si on a tronqué
    if (words.length > 5) {
      title += '...';
    }
    
    // Capitaliser la première lettre
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    return title;
  };

  /**
   * Organise les sections en chapitres (6 sections par chapitre par défaut)
   */
  const organizeIntoChapters = (sections: PdfTextSection[]): PdfChapter[] => {
    if (sections.length === 0) {
      return [{
        id: crypto.randomUUID(),
        title: 'Chapitre 1',
        lessons: [],
      }];
    }

    const chapters: PdfChapter[] = [];
    
    for (let i = 0; i < sections.length; i += SECTIONS_PER_CHAPTER) {
      const chunk = sections.slice(i, i + SECTIONS_PER_CHAPTER);
      chapters.push({
        id: crypto.randomUUID(),
        title: `Chapitre ${chapters.length + 1}`,
        lessons: chunk,
      });
    }

    return chapters;
  };

  // ==========================================================================
  // GESTIONNAIRES D'ÉVÉNEMENTS
  // ==========================================================================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const pdfFile = e.target.files[0];
      setFile(pdfFile);
      // Proposer le nom du fichier (sans extension) comme titre par défaut
      setManuelTitle(pdfFile.name.replace('.pdf', '').replace(/\.pdf$/i, ''));
    }
  };

  const handleSubmitUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      extractTextFromPdf(file);
    }
  };

  // Gestion des chapitres
  const handleChapterTitleChange = (chapterId: string, newTitle: string) => {
    setChapters(prev => prev.map(ch => 
      ch.id === chapterId ? { ...ch, title: newTitle } : ch
    ));
  };

  const handleLessonTitleChange = (chapterId: string, lessonId: string, newTitle: string) => {
    setChapters(prev => prev.map(ch => {
      if (ch.id !== chapterId) return ch;
      return {
        ...ch,
        lessons: ch.lessons.map(l => 
          l.id === lessonId ? { ...l, title: newTitle } : l
        ),
      };
    }));
  };

  const handleLessonTextChange = (chapterId: string, lessonId: string, newText: string) => {
    setChapters(prev => prev.map(ch => {
      if (ch.id !== chapterId) return ch;
      return {
        ...ch,
        lessons: ch.lessons.map(l => 
          l.id === lessonId ? { ...l, text: newText } : l
        ),
      };
    }));
  };

  // Ajouter un nouveau chapitre
  const addChapter = () => {
    setChapters(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: `Chapitre ${prev.length + 1}`,
        lessons: [],
      },
    ]);
  };

  // Supprimer un chapitre
  const removeChapter = (chapterId: string) => {
    setChapters(prev => prev.filter(ch => ch.id !== chapterId));
  };

  // Ajouter une leçon à un chapitre
  const addLessonToChapter = (chapterId: string) => {
    setChapters(prev => prev.map(ch => {
      if (ch.id !== chapterId) return ch;
      return {
        ...ch,
        lessons: [
          ...ch.lessons,
          {
            id: crypto.randomUUID(),
            text: '',
            title: `Nouvelle leçon ${ch.lessons.length + 1}`,
          },
        ],
      };
    }));
  };

  // Supprimer une leçon
  const removeLesson = (chapterId: string, lessonId: string) => {
    setChapters(prev => prev.map(ch => {
      if (ch.id !== chapterId) return ch;
      return {
        ...ch,
        lessons: ch.lessons.filter(l => l.id !== lessonId),
      };
    }));
  };

  // ==========================================================================
  // GÉNÉRATION DE FICHE DE RÉVISION
  // ==========================================================================

  /**
   * Génère une fiche de révision pour une leçon via Mistral
   */
  const generateFicheRevisionForLecon = useCallback(async (leconId: string, leconContent: string, leconTitle: string, leconType: Lecon['type']): Promise<FicheRevision | null> => {
    try {
      const prompt = `Tu es un professeur d'allemand. Crée une fiche de révision complète et structurée basée sur le contenu suivant :

---
Contenu de la leçon:
${leconContent.substring(0, 2000)}
Type: ${leconType}
Titre: ${leconTitle}
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
      console.error('Erreur lors de la génération de la fiche:', err);
      return null;
    }
  }, []);

  // ==========================================================================
  // SAUVEGARDE
  // ==========================================================================

  const handleSave = useCallback(async () => {
    if (typeof window === 'undefined') {
      setError('Impossible de sauvegarder : environnement non supporté');
      return;
    }

    if (!manuelTitle.trim()) {
      setError('Veuillez donner un titre au manuel');
      return;
    }

    // Extraire tout le texte du PDF
    const allText = chapters.map(chapter => 
      chapter.lessons.map(lesson => lesson.text).join('\n\n')
    ).join('\n\n');

    if (!allText.trim()) {
      setError('Aucun contenu valide trouvé dans le PDF');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGenerationStatus('✅ Leçon sauvegardée, génération de la fiche de révision en cours...');
    setIsGeneratingFiche(true);

    try {
      // Créer le manuel
      const manuelData: Omit<Manuel, 'id'> = {
        titre: manuelTitle.trim(),
        editeur: editor.trim() || 'Inconnu',
        dateImport: new Date().toISOString().split('T')[0],
        chapitres: [],
      };

      const createdManuel = addManuel(manuelData);

      // Créer un chapitre unique pour cette leçon (1 PDF = 1 leçon)
      const chapitreData: Omit<Chapitre, 'id'> = {
        titre: 'Contenu principal',
        ordre: 0,
        lecons: [],
      };

      const createdChapter = addChapitre(createdManuel.id, chapitreData);
      if (!createdChapter) {
        throw new Error('Impossible de créer le chapitre');
      }

      // Créer la leçon avec tout le contenu du PDF
      const leconData: Omit<Lecon, 'id' | 'dateAjout'> = {
        titre: manuelTitle.trim(),
        type: defaultLessonType,
        contenuTexte: allText.trim(),
        notionsCles: extractNotionsFromText(allText),
        ficheRevision: undefined, // Sera généré après
      };

      const createdLecon = addLecon(createdManuel.id, createdChapter.id, leconData);
      
      if (!createdLecon) {
        throw new Error('Impossible de créer la leçon');
      }

      // Générer la fiche de révision automatiquement
      setGenerationStatus('Génération de la fiche de révision en cours...');
      
      const ficheRevision = await generateFicheRevisionForLecon(
        createdLecon.id,
        createdLecon.contenuTexte,
        createdLecon.titre,
        createdLecon.type
      );

      if (ficheRevision) {
        // Mettre à jour la leçon avec la fiche de révision
        updateLecon(createdManuel.id, createdChapter.id, createdLecon.id, {
          ficheRevision,
        });
        setGenerationStatus('✅ Fiche de révision générée !');
      } else {
        setGenerationStatus('⚠️ Fiche de révision non générée (erreur)');
      }

      // Rediriger vers /lecons après un court délai
      setTimeout(() => {
        router.push('/lecons');
      }, 1500);

    } catch (err) {
      setError(`Erreur lors de la sauvegarde: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setIsLoading(false);
      setIsGeneratingFiche(false);
    }
  }, [manuelTitle, editor, chapters, defaultLessonType, generateFicheRevisionForLecon, router]);

  /**
   * Extrait des notions clés depuis un texte
   * (implémentation basique - à améliorer avec Mistral plus tard)
   */
  const extractNotionsFromText = (text: string): string[] => {
    const notions: Set<string> = new Set();
    
    // Mots fréquents en allemand qui pourraient être des notions
    const commonNotions = [
      'artikel', 'der', 'die', 'das', 'nomen', 'verb', 'adjektiv',
      'präposition', 'konjunktion', 'grammatik', 'vokabel',
      'präsens', 'präteritum', 'perfekt', 'futur',
      'akkusativ', 'dativ', 'genitiv', 'nominativ',
    ];

    const lowerText = text.toLowerCase();
    
    for (const notion of commonNotions) {
      if (lowerText.includes(notion)) {
        notions.add(notion);
      }
    }

    // Limiter à 10 notions max
    return Array.from(notions).slice(0, 10);
  };

  // ==========================================================================
  // RENDU
  // ==========================================================================

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* En-tête avec dégradé */}
        <div className="bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] rounded-xl p-6 mb-8 shadow-lg">
          <h1 className="text-3xl font-bold text-white mb-2">Importer un cours PDF</h1>
          <p className="text-white/80">
            Extrayez le contenu de vos manuels pour créer des exercices personnalisés
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

        {/* ÉTAPE 1 : UPLOAD DU FICHIER */}
        {step === 'upload' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              Étape 1 : Sélectionner un fichier PDF
            </h2>
            
            <form onSubmit={handleSubmitUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fichier PDF *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  required
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formats acceptés : PDF (max 50Mo recommandé)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre du manuel *
                </label>
                <input
                  type="text"
                  value={manuelTitle}
                  onChange={(e) => setManuelTitle(e.target.value)}
                  placeholder="Ex: Deutsch für Anfänger, Netzwerk A1, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Éditeur (optionnel)
                </label>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  placeholder="Ex: Klett, Hueber, Cornelsen, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de leçon par défaut
                </label>
                <select
                  value={defaultLessonType}
                  onChange={(e) => setDefaultLessonType(e.target.value as Lecon['type'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="grammaire">Grammaire</option>
                  <option value="vocabulaire">Vocabulaire</option>
                  <option value="conjugaison">Conjugaison</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!file || isLoading}
                  className={`px-6 py-2 rounded-md text-white font-medium 
                    ${file && !isLoading 
                      ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' 
                      : 'bg-blue-300 cursor-not-allowed'}
                    transition-colors disabled:opacity-50`}
                >
                  {isLoading ? 'Extraction en cours...' : 'Extraire le texte du PDF'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ÉTAPE 2 : EXTRACTION EN COURS */}
        {step === 'extracting' && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Extraction du texte
            </h2>
            <p className="text-gray-600">
              Nous extrayons le contenu de votre PDF...
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Cela peut prendre quelques secondes selon la taille du fichier.
            </p>
          </div>
        )}

        {/* ÉTAPE 3 : APERÇU DU TEXTE EXTRAIT */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Étape 2 : Aperçu du texte extrait
              </h2>
              <p className="text-gray-600 mb-4">
                Nous avons extrait le texte de votre PDF et l'avons automatiquement 
                découpé en {chapters.length} chapitre(s) et {chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)} leçon(s).
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={() => setStep('organize')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Organiser le contenu
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {chapters.map((chapter, chapterIndex) => (
                <div key={chapter.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">
                      {chapter.title} ({chapter.lessons.length} leçons)
                    </h3>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {chapter.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.id} className="p-4">
                        <h4 className="font-medium text-blue-600 mb-2">
                          {lessonIndex + 1}. {lesson.title}
                        </h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                          {lesson.text}
                        </p>
                        {lesson.text.length > 200 && (
                          <details className="mt-2">
                            <summary className="text-sm text-blue-500 cursor-pointer hover:underline">
                              Voir le texte complet ({lesson.text.length} caractères)
                            </summary>
                            <pre className="text-sm text-gray-700 mt-2 p-3 bg-gray-50 rounded overflow-x-auto whitespace-pre-wrap">
                              {lesson.text}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : ORGANISATION ET ÉDITION */}
        {step === 'organize' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Étape 3 : Organiser et éditer le contenu
              </h2>
              <p className="text-gray-600 mb-4">
                Modifiez les titres des chapitres et des leçons avant de sauvegarder.
                Vous pourrez toujours les modifier plus tard.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Retour à l'aperçu
                </button>
                <button
                  onClick={addChapter}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                >
                  + Nouveau chapitre
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading || isGeneratingFiche || !manuelTitle.trim()}
                  className={`px-6 py-2 rounded-xl text-white font-medium 
                    ${manuelTitle.trim() && !isLoading && !isGeneratingFiche 
                      ? 'bg-[#3730a3] hover:bg-[#4f46e5]' 
                      : 'bg-[#3730a3]/50 cursor-not-allowed'}
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading || isGeneratingFiche ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      {isGeneratingFiche ? 'Génération...' : 'Sauvegarde...'}
                    </span>
                  ) : (
                    'Enregistrer tout'
                  )}
                </button>
              </div>
              
              {/* Indicateur de génération de fiche */}
              {generationStatus && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-700 text-center">{generationStatus}</p>
                  {isGeneratingFiche && (
                    <div className="flex justify-center mt-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3730a3]"></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {chapters.map((chapter, chapterIndex) => (
                <div key={chapter.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="bg-blue-50 p-4 border-b border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 font-medium">Chapitre {chapterIndex + 1}</span>
                        <input
                          type="text"
                          value={chapter.title}
                          onChange={(e) => handleChapterTitleChange(chapter.id, e.target.value)}
                          placeholder="Titre du chapitre..."
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <button
                        onClick={() => removeChapter(chapter.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                        title="Supprimer ce chapitre"
                        disabled={chapter.lessons.length > 0}
                      >
                        Supprimer
                      </button>
                    </div>
                    
                    <button
                      onClick={() => addLessonToChapter(chapter.id)}
                      className="mt-3 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                    >
                      + Nouvelle leçon
                    </button>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {chapter.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.id} className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-gray-500 text-sm">{lessonIndex + 1}.</span>
                              <input
                                type="text"
                                value={lesson.title}
                                onChange={(e) => handleLessonTitleChange(chapter.id, lesson.id, e.target.value)}
                                placeholder="Titre de la leçon..."
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            
                            <textarea
                              value={lesson.text}
                              onChange={(e) => handleLessonTextChange(chapter.id, lesson.id, e.target.value)}
                              placeholder="Texte de la leçon..."
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm min-h-[100px]"
                              rows={4}
                            />
                          </div>
                          
                          <button
                            onClick={() => removeLesson(chapter.id, lesson.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                            title="Supprimer cette leçon"
                          >
                            ×
                          </button>
                        </div>

                        <div className="text-xs text-gray-500">
                          {lesson.text.split(/\s+/).filter(w => w.length > 0).length} mots
                        </div>
                      </div>
                    ))}
                    
                    {chapter.lessons.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Aucune leçon dans ce chapitre. Ajoutez-en une avec le bouton ci-dessus.
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chapters.length === 0 && (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                  <p>Aucun chapitre. Commencez par ajouter un chapitre.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
