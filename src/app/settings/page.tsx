"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";

type LanguageOption = { code: string; name: string };
type Plan = "free" | "basic" | "premium" | "polyglot" | "owner" | undefined;

const LANGUAGES: LanguageOption[] = [
  { code: "English", name: "English" },
  { code: "Spanish", name: "Spanish" },
  { code: "French", name: "French" },
  { code: "German", name: "German" },
  { code: "Italian", name: "Italian" },
  { code: "Portuguese", name: "Portuguese" },
  { code: "Japanese", name: "Japanese" },
  { code: "Korean", name: "Korean" },
  { code: "Chinese", name: "Chinese" },
];

function toStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const plan = (user?.publicMetadata?.plan as Plan) ?? "free";
  const isFree = plan === "free";

  useEffect(() => {
    if (!isLoaded) return;
    const current = toStringArray(user?.publicMetadata?.targetLanguages);
    setSelected(current);
  }, [isLoaded, user]);

  const toggleLanguage = (code: string) => {
    if (isFree) return; // No permite cambiar selección en plan free
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const savePreferences = async () => {
    if (isFree) return;
    try {
      setSaving(true);
      setMessage("");

      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguages: Array.from(new Set(selected.map((s) => s.trim()))),
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: unknown = await res.json();
      const serverTL = toStringArray(
        (data as Record<string, unknown>)?.targetLanguages
      );
      setSelected(serverTL);
      await user?.reload();

      setMessage("Preferences saved successfully!");
    } catch (err) {
      console.error(err);
      setMessage("Error saving preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white p-6">
      <h1 className="text-2xl font-semibold mb-6">Language Preferences</h1>

      {isFree ? (
        <p className="mb-6 text-yellow-400 bg-yellow-800/30 p-3 rounded-xl text-sm max-w-md">
          Your current plan (<span className="font-semibold">Free</span>) doesn’t allow changing language preferences. 
          Log in or upgrade your plan to customize your learning languages.
        </p>
      ) : (
        <p className="mb-4 text-gray-300">
          Select one or more languages to personalize your recommendations.
        </p>
      )}

      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6 ${
          isFree ? "opacity-50 pointer-events-none select-none" : ""
        }`}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => toggleLanguage(lang.code)}
            className={`rounded-xl px-4 py-2 font-medium border transition-colors ${
              selected.includes(lang.code)
                ? "bg-emerald-600 border-emerald-500"
                : "bg-gray-800 border-gray-700 hover:bg-gray-700"
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>

      <button
        onClick={savePreferences}
        disabled={saving || isFree}
        className={`rounded-xl px-6 py-2 font-semibold ${
          isFree
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-sky-600 hover:bg-sky-500 text-white"
        }`}
      >
        {saving ? "Saving..." : "Save Preferences"}
      </button>

      {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
    </div>
  );
}