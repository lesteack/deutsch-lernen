'use client';

/**
 * Page principale des leçons
 * Pour l'instant vide, sera développée dans une étape ultérieure
 */

export default function LeconsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Leçons</h1>
        <p className="text-gray-600">
          Cette page sera développée dans une étape ultérieure de la roadmap.
        </p>
        <p className="text-gray-600 mt-4">
          Pour importer un PDF, allez sur <a href="/lecons/import" className="text-blue-600 hover:underline">/lecons/import</a>
        </p>
      </div>
    </div>
  );
}
