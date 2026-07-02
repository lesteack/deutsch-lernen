'use client';

import { useState } from 'react';

/**
 * Page de test pour la Route API /api/mistral
 * Cette page permet de tester le bon fonctionnement de la route API
 * sans avoir besoin de l'UI complète du site.
 */

export default function TestMistralPage() {
  const [prompt, setPrompt] = useState('Dis-moi bonjour en allemand');
  const [responseFormat, setResponseFormat] = useState<'text' | 'json_object'>('text');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    data?: any;
    error?: string;
    duration?: number;
  } | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/mistral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          responseFormat,
        }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setResult({
          success: false,
          error: errorData.error || `Erreur ${response.status}`,
          duration,
        });
        return;
      }

      const data = await response.json();

      setResult({
        success: true,
        data,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur réseau',
        duration,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Test de la Route API /api/mistral
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Paramètres de la requête
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Saisissez votre prompt ici..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format de réponse
              </label>
              <select
                value={responseFormat}
                onChange={(e) => setResponseFormat(e.target.value as 'text' | 'json_object')}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="text">Texte (text)</option>
                <option value="json_object">JSON structuré (json_object)</option>
              </select>
            </div>

            <button
              onClick={handleTest}
              disabled={loading}
              className={`px-4 py-2 rounded-md text-white font-medium ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
            >
              {loading ? 'Test en cours...' : 'Tester la route API'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`rounded-lg p-6 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h2 className="text-xl font-semibold mb-4">
              {result.success ? '✅ Succès' : '❌ Échec'}
            </h2>

            {result.duration && (
              <p className="text-sm text-gray-600 mb-2">
                Durée : {result.duration}ms
              </p>
            )}

            {result.error && (
              <pre className="text-red-700 bg-red-100 p-3 rounded-md overflow-x-auto">
                {result.error}
              </pre>
            )}

            {result.data && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Réponse :</h3>
                <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto text-sm">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Instructions pour tester depuis la console
          </h2>
          <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto text-sm">
{`// Test simple GET (vérifie que la route est accessible)
fetch('/api/mistral')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Test POST avec un prompt
fetch('/api/mistral', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Dis-moi bonjour en allemand',
    responseFormat: 'text'
  })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Test POST avec JSON structuré
fetch('/api/mistral', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Réponds avec un JSON contenant {greeting: string}',
    responseFormat: 'json_object'
  })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);`}
          </pre>
        </div>
      </div>
    </div>
  );
}
