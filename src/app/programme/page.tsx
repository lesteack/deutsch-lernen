'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getProgramme,
  getProgression,
  calculerProgressionGlobale,
  determineBlocEnCours,
  type ProgrammeBloc,
  type NiveauCECRL,
} from '@/lib/storage';

// ============================================================================
// CONSEILS DE MISE EN ŒUVRE
// ============================================================================

const conseilsMiseEnOeuvre = [
  {
    titre: 'Pratique quotidienne',
    description: 'Consacrez au moins 30 minutes par jour à l\'allemand. La régularité est la clé pour progresser rapidement.',
    couleur: 'bg-blue-100',
    icone: '📅',
  },
  {
    titre: 'Immersion totale',
    description: 'Changez la langue de votre téléphone, regardez des films en allemand avec sous-titres, écoutez des podcasts.',
    couleur: 'bg-green-100',
    icone: '🎧',
  },
  {
    titre: 'Pratique des 4 compétences',
    description: 'Ne négligez aucune compétence : écoutez, lisez, écrivez et parlez régulièrement.',
    couleur: 'bg-purple-100',
    icone: '🎯',
  },
  {
    titre: 'Révisions actives',
    description: 'Relisez vos notes, refaites les exercices difficiles, testez-vous avec des quiz.',
    couleur: 'bg-orange-100',
    icone: '📚',
  },
];

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ProgrammePage() {
  const [programme, setProgramme] = useState<ProgrammeBloc[]>([]);
  const [progression, setProgression] = useState<NiveauCECRL>('A1');
  const [progressionPourcentage, setProgressionPourcentage] = useState<number>(0);
  const [blocEnCours, setBlocEnCours] = useState<ProgrammeBloc | null>(null);
  const [expandedBlocs, setExpandedBlocs] = useState<Record<string, boolean>>({});

  // Charger les données au montage
  useEffect(() => {
    const prog = getProgramme();
    const userProgression = getProgression();
    
    setProgramme(prog);
    setProgression(userProgression.niveauEstimeCECRL);
    
    const pct = calculerProgressionGlobale(userProgression.niveauEstimeCECRL);
    setProgressionPourcentage(pct);
    
    const currentBloc = determineBlocEnCours(userProgression.niveauEstimeCECRL);
    setBlocEnCours(currentBloc);
    
    // Initialiser les blocs expandés
    setExpandedBlocs({});
  }, []);

  // Toggle pour l'accordéon
  const toggleExpand = (blocId: string) => {
    setExpandedBlocs(prev => ({
      ...prev,
      [blocId]: !prev[blocId],
    }));
  };

  // Obtenir l'icône de statut pour un bloc
  const getStatutIcon = (statut: 'non_commence' | 'en_cours' | 'termine') => {
    switch (statut) {
      case 'non_commence':
        return { icon: '🔒', label: 'Non commencé', color: 'gray' };
      case 'en_cours':
        return { icon: '➡️', label: 'En cours', color: 'blue' };
      case 'termine':
        return { icon: '✅', label: 'Terminé', color: 'green' };
      default:
        return { icon: '❓', label: 'Inconnu', color: 'gray' };
    }
  };

  // Obtenir la classe CSS pour la carte selon le statut
  const getBlocCardClass = (statut: 'non_commence' | 'en_cours' | 'termine') => {
    switch (statut) {
      case 'non_commence':
        return 'bg-gray-50 border-gray-200';
      case 'en_cours':
        return 'bg-blue-50 border-blue-200 ring-2 ring-blue-500';
      case 'termine':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  // Déterminer le statut de chaque bloc basé sur la progression
  const determineBlocStatut = (bloc: ProgrammeBloc): 'non_commence' | 'en_cours' | 'termine' => {
    if (blocEnCours?.numero === bloc.numero) {
      return 'en_cours';
    }
    if (bloc.numero < (blocEnCours?.numero || 1)) {
      return 'termine';
    }
    return 'non_commence';
  };

  // Calculer la progression dans le bloc en cours (si applicable)
  const getBlocProgress = (bloc: ProgrammeBloc): number => {
    if (blocEnCours?.id !== bloc.id) return 0;
    
    // Calcul simple basé sur le mois dans le bloc
    // Bloc 1: mois 1-3, Bloc 2: mois 4-6, Bloc 3: mois 7-9
    const moisTotal = bloc.moisFin - bloc.moisDebut + 1;
    const moisEcoulés = Math.min(
      Math.max(0, progressionPourcentage / (100 / 9) - bloc.moisDebut + 1),
      moisTotal
    );
    
    return Math.round((moisEcoulés / moisTotal) * 100);
  };

  // Formater le niveau pour l'affichage
  const formatNiveau = (niveau: NiveauCECRL): string => {
    const labels: Record<NiveauCECRL, string> = {
      A1: 'A1',
      A2: 'A2',
      B1: 'B1',
      B2: 'B2',
      C1: 'C1',
      C2: 'C2',
    };
    return labels[niveau] || niveau;
  };

  if (programme.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500">Chargement du programme...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-6xl mx-auto">
        {/* ======================================================================
             HEADER
           ====================================================================== */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-serif text-[#1e1b4b] mb-4">
            Mon Programme B1 → C1
          </h1>
          <p className="text-xl text-gray-600 font-medium">
            9 mois pour atteindre le C1
          </p>
          <p className="text-lg text-gray-500 mt-2">
            Niveau actuel : <span className={`font-bold ${progression === 'C1' || progression === 'C2' ? 'text-purple-600' : progression === 'B2' ? 'text-blue-600' : 'text-green-600'}`}>
              {formatNiveau(progression)}
            </span>
          </p>
        </div>

        {/* ======================================================================
             BARRE DE PROGRESSION GLOBALE
           ====================================================================== */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Progression globale</span>
            <span className="text-sm font-bold text-[#1e1b4b]">{progressionPourcentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progressionPourcentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>A1/A2</span>
            <span>B1</span>
            <span>B2</span>
            <span>C1</span>
          </div>
        </div>

        {/* ======================================================================
             CARTES DES BLOCS
           ====================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {programme.map((bloc) => {
            const statut = determineBlocStatut(bloc);
            const statutInfo = getStatutIcon(statut);
            const blocProgress = getBlocProgress(bloc);
            const isBlocEnCours = statut === 'en_cours';
            const isBlocTermine = statut === 'termine';

            return (
              <div
                key={bloc.id}
                className={`border-2 rounded-xl p-6 transition-all duration-300 ${getBlocCardClass(statut)}`}
              >
                {/* En-tête de la carte */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold font-serif text-[#1e1b4b]">
                      Bloc {bloc.numero}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{bloc.titre}</p>
                  </div>
                  <span className={`text-2xl ${isBlocTermine ? 'text-green-600' : isBlocEnCours ? 'text-blue-600' : 'text-gray-400'}`}>
                    {statutInfo.icon}
                  </span>
                </div>

                {/* Badge de statut */}
                <div className="mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium $
                    ${isBlocTermine ? 'bg-green-100 text-green-700' : isBlocEnCours ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}
                  `}>
                    {statutInfo.label}
                  </span>
                </div>

                {/* Période */}
                <p className="text-sm text-gray-600 mb-2">
                  Mois {bloc.moisDebut}-{bloc.moisFin}
                </p>

                {/* Barre de progression du bloc (si en cours) */}
                {isBlocEnCours && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-600">Progression</span>
                      <span className="text-xs font-bold text-blue-600">{blocProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${blocProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Objectif */}
                <p className="text-sm text-gray-700 mb-4 italic">
                  "{bloc.objectif}"
                </p>

                {/* Jalon */}
                <div className="bg-white/50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Jalon à atteindre :</p>
                  <p className="text-sm text-[#1e1b4b] font-medium">{bloc.sections.jalon}</p>
                </div>

                {/* Accordéon "Voir le contenu" */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => toggleExpand(bloc.id)}
                    className="flex items-center justify-between w-full text-sm font-medium text-[#1e1b4b] hover:text-blue-600 transition-colors"
                  >
                    <span>Voir le contenu</span>
                    <span className={`transform transition-transform ${expandedBlocs[bloc.id] ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {expandedBlocs[bloc.id] && (
                    <div className="mt-4 space-y-4 text-sm">
                      {/* Grammaire */}
                      <div>
                        <h4 className="font-medium text-[#1e1b4b] mb-2">📖 Grammaire</h4>
                        <ul className="space-y-1">
                          {bloc.sections.grammaire.map((item, index) => (
                            <li key={index} className="text-gray-600 text-xs pl-4">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Vocabulaire */}
                      <div>
                        <h4 className="font-medium text-[#1e1b4b] mb-2">💬 Vocabulaire</h4>
                        <ul className="space-y-1">
                          {bloc.sections.vocabulaire.map((item, index) => (
                            <li key={index} className="text-gray-600 text-xs pl-4">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Compétences */}
                      <div>
                        <h4 className="font-medium text-[#1e1b4b] mb-2">🎯 Compétences</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-blue-50 rounded p-2">
                            <p className="font-medium text-blue-700">Lecture</p>
                            <p className="text-gray-600">{bloc.sections.competences.lecture}</p>
                          </div>
                          <div className="bg-green-50 rounded p-2">
                            <p className="font-medium text-green-700">Écoute</p>
                            <p className="text-gray-600">{bloc.sections.competences.ecoute}</p>
                          </div>
                          <div className="bg-purple-50 rounded p-2">
                            <p className="font-medium text-purple-700">Écriture</p>
                            <p className="text-gray-600">{bloc.sections.competences.ecriture}</p>
                          </div>
                          <div className="bg-orange-50 rounded p-2">
                            <p className="font-medium text-orange-700">Oral</p>
                            <p className="text-gray-600">{bloc.sections.competences.oral}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Boutons pour le bloc en cours */}
                {isBlocEnCours && (
                  <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                    <Link
                      href={{ pathname: '/exercices', query: { bloc: bloc.numero } }}
                      className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Générer un exercice de ce bloc
                    </Link>
                    <Link
                      href="/evaluation"
                      className="block w-full text-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      S'évaluer sur ce bloc
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ======================================================================
             CONSEILS DE MISE EN ŒUVRE
           ====================================================================== */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold font-serif text-[#1e1b4b] mb-6 text-center">
            Conseils de mise en œuvre
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {conseilsMiseEnOeuvre.map((conseil, index) => (
              <div
                key={index}
                className={`${conseil.couleur} rounded-lg p-4 transition-transform hover:scale-105`}
              >
                <div className="text-2xl mb-2">{conseil.icone}</div>
                <h3 className="font-medium text-[#1e1b4b] mb-1">{conseil.titre}</h3>
                <p className="text-sm text-gray-600">{conseil.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lien de retour */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            ← Retour au Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
