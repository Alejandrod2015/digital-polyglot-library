'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Skeleton from '@/components/Skeleton';

type FavoriteItem = { word: string; translation: string };

export default function FavoritesPage() {
  const { user, isLoaded } = useUser();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isReady, setIsReady] = useState(false); // controla visibilidad final

  useEffect(() => {
    const load = async () => {
      // 1️⃣ Cargar de localStorage inmediatamente
      const stored = localStorage.getItem('favorites');
      const localFavs = stored ? (JSON.parse(stored) as FavoriteItem[]) : [];
      setFavorites(localFavs);

      // 2️⃣ Sincronizar backend (en segundo plano)
      if (isLoaded && user) {
        try {
          const res = await fetch('/api/favorites', { cache: 'no-store' });
          const remoteFavs = res.ok ? ((await res.json()) as FavoriteItem[]) : [];
          const merged = [
            ...remoteFavs,
            ...localFavs.filter((f) => !remoteFavs.some((r) => r.word === f.word)),
          ];

          await Promise.all(
            localFavs
              .filter((f) => !remoteFavs.some((r) => r.word === f.word))
              .map((fav) =>
                fetch('/api/favorites', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(fav),
                }),
              ),
          );

          localStorage.removeItem('favorites');
          setFavorites(merged);
        } catch {
          // no romper UI
        }
      }

      // 3️⃣ Mostrar el contenido tras pequeño delay para evitar flicker
      setTimeout(() => setIsReady(true), 250);
    };

    void load();
  }, [user, isLoaded]);

  const removeFavorite = async (word: string) => {
    const updated = favorites.filter((f) => f.word !== word);
    setFavorites(updated);

    if (user) {
      await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
    } else {
      localStorage.setItem('favorites', JSON.stringify(updated));
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">Favorites</h1>

      {/* Contenedor estructural fijo */}
      <div className="relative min-h-[200px]">
        {/* Skeleton visible hasta que isReady sea true */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="space-y-4">
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Contenido real debajo */}
        <div
          className={`transition-opacity duration-700 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {favorites.length === 0 ? (
            <p className="text-gray-400">
              {user ? 'No favorites saved yet.' : 'No favorites saved yet.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {favorites.map((fav, index) => (
                <li
                  key={index}
                  className="bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold">{fav.word}</p>
                    <p className="text-green-400">{fav.translation}</p>
                  </div>
                  <button
                    onClick={() => removeFavorite(fav.word)}
                    className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3-3h4a1 1 0 011 1v1H8V5a1 1 0 011-1z"
                      />
                    </svg>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
