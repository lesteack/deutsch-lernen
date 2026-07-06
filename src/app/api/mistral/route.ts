import { NextResponse } from 'next/server';

// Types pour la requête entrante
type RequestBody = {
  prompt: string;
  responseFormat?: 'text' | 'json_object';
};

// Types pour la réponse Mistral
type MistralResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

// Constantes
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';
const TIMEOUT_MS = 30000; // 30 secondes
const MAX_RETRIES = 1;

// Fonction utilitaire pour timeout
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout après ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

// Appel à l'API Mistral avec retry
async function callMistralApi(
  apiKey: string,
  prompt: string,
  responseFormat: 'text' | 'json_object' = 'text'
): Promise<string> {
  const body = {
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    ...(responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Erreur API Mistral (${response.status}): ${errorData.message || 'Unknown error'}`
        );
      }

      const data: MistralResponse = await response.json();

      // Vérifier que la réponse contient du contenu
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Réponse Mistral invalide : contenu manquant');
      }

      return data.choices[0].message.content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Ne pas retry sur certaines erreurs
      if (lastError.message.includes('Timeout') || attempt === MAX_RETRIES) {
        throw lastError;
      }

      // Attendre avant le retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('Échec de l\'appel à Mistral après retries');
}

// Route API POST principale
export async function POST(request: Request) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API Mistral non configurée côté serveur' },
        { status: 500 }
      );
    }

    // Parser le body de la requête
    let requestBody: RequestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps de requête invalide - JSON attendu' },
        { status: 400 }
      );
    }

    // Valider les champs obligatoires
    if (!requestBody.prompt || typeof requestBody.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Champ "prompt" requis et doit être une chaîne de caractères' },
        { status: 400 }
      );
    }

    // Appeler Mistral avec timeout global
    const response = await withTimeout(
      callMistralApi(apiKey, requestBody.prompt, requestBody.responseFormat),
      TIMEOUT_MS
    );

    // Si json_object a été demandé, essayer de parser la réponse
    if (requestBody.responseFormat === 'json_object') {
      try {
        // Essayer de parser directement
        return NextResponse.json(JSON.parse(response));
      } catch {
        // Si le parse échoue, essayer d'extraire le JSON de structures courantes
        try {
          // Cas 1: Réponse wrapée dans {outputs: [{text: "..."}]}
          const parsed = JSON.parse(response);
          if (parsed?.outputs?.[0]?.text) {
            return NextResponse.json(JSON.parse(parsed.outputs[0].text));
          }
          // Cas 2: Réponse wrapée dans {choices: [{message: {content: "..."}}]}
          if (parsed?.choices?.[0]?.message?.content) {
            return NextResponse.json(JSON.parse(parsed.choices[0].message.content));
          }
          // Cas 3: Réponse est une string JSON valide
          return NextResponse.json(JSON.parse(response));
        } catch (innerError) {
          // Si tout échoue, retourner la réponse brute avec un warning
          console.error('[API Mistral] Impossible de parser la réponse JSON:', innerError);
          return NextResponse.json({
            warning: 'La réponse n\'est pas un JSON valide',
            rawResponse: response,
          });
        }
      }
    }

    return NextResponse.json({ response });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    // Ne pas exposer la clé API dans les logs ou les erreurs
    console.error('[API Mistral]', errorMessage);

    return NextResponse.json(
      { error: `Impossible de contacter l'API Mistral : ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Méthode GET pour test simple
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Route API Mistral prête' });
}
