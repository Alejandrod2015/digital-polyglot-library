'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';
import Link from 'next/link';
import { PenLine } from 'lucide-react';

type Plan = 'free' | 'basic' | 'premium' | 'polyglot';

const regionsByLanguage: Record<string, string[]> = {
  Spanish: ['Colombia', 'Mexico', 'Argentina', 'Peru', 'Spain', 'Chile', 'Other'],
  English: ['US', 'UK', 'Australia', 'Canada', 'Other'],
  German: ['Germany', 'Austria', 'Switzerland', 'Other'],
  French: ['France', 'Canada', 'Belgium', 'Other'],
  Italian: ['Italy', 'Switzerland', 'Other'],
  Portuguese: ['Portugal', 'Brazil', 'Other'],
};

const levels = ['Beginner', 'Intermediate', 'Advanced'];
const focuses = ['Verbs', 'Nouns', 'Adjectives', 'Phrases'];
const topics = ['Daily life', 'Travel', 'Work', 'Culture', 'Food', 'Family'];

export default function CreatePage() {
  const { user, isLoaded } = useUser();
  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('');
  const [level, setLevel] = useState('');
  const [focus, setFocus] = useState('');
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!isLoaded) return null;

  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? 'free';

  if (plan !== 'polyglot') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-gray-300">
        <h2 className="text-2xl font-semibold mb-4">Restricted Access</h2>
        <p className="max-w-md mb-4">
          This section is only available to users with a Polyglot plan.
        </p>
        <Link
          href="/plans"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
        >
          View Plans
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    try {
      const body = { language, region, level, focus, topic };
      const res = await fetch('/api/user/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error('Error:', error);
      setResponse({ error: 'Request failed' });
    } finally {
      setLoading(false);
    }
  }

  const availableRegions =
    regionsByLanguage[language as keyof typeof regionsByLanguage] || [];

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-gray-100">
      <div className="flex items-center gap-3 mb-8">
        <PenLine className="h-7 w-7 text-emerald-400" />
        <h1 className="text-3xl font-bold text-white">Create a Story</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-[#0D1B2A] p-6 rounded-xl border border-gray-700"
      >
        {/* Language */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Language</label>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setRegion('');
            }}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select language</option>
            {Object.keys(regionsByLanguage).map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Region (optional, depends on language) */}
        {availableRegions.length > 0 && (
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Region (optional)
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
            >
              <option value="">No region</option>
              {availableRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Level */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select level</option>
            {levels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        {/* Focus */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Focus</label>
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select focus</option>
            {focuses.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Topic</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select topic</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md transition"
        >
          {loading ? 'Generating...' : 'Generate Story'}
        </button>
      </form>

            {response && response.story && (
  <div className="mt-10 bg-[#1B263B] border border-gray-700 rounded-xl p-6">
    <h2 className="text-2xl font-bold mb-2 text-emerald-400">
      {response.story.title}
    </h2>

    <p className="text-sm text-gray-400 mb-4">
      {response.story.language} • {response.story.level} •{" "}
      {response.story.region || "General"}
    </p>

    <blockquote
      className="text-gray-200 italic line-clamp-3 leading-relaxed mb-6"
      dangerouslySetInnerHTML={{ __html: response.story.text }}
    />

    <div className="flex items-center justify-between mt-4">
      {response.story.audioUrl && (
        <audio
          controls
          src={response.story.audioUrl}
          className="flex-1 mr-4 rounded-md"
        />
      )}
      <Link
        href={`/stories/${response.story.id}`}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition font-medium"
      >
        Read full story →
      </Link>
    </div>
  </div>
)}

      {/* Mostrar error si existe */}
      {response && response.error && (
        <div className="mt-8 border border-red-700 rounded-xl p-6 bg-red-900/40">
          <h2 className="text-lg font-semibold mb-2 text-red-400">Error</h2>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap">
            {JSON.stringify(response.error, null, 2)}
          </pre>
        </div>
      )}

    </div>
  );
}
