import { NextResponse } from 'next/server';

// Route API vide pour l'instant - répond simplement { ok: true }
// Cette route servira de proxy sécurisé vers l'API Mistral
// La clé API sera injectée via process.env.MISTRAL_API_KEY (variable d'environnement Vercel)

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return NextResponse.json({ ok: true });
}
