'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

type FavoriteItem = { word: string; translation: string };

export default function FavoritesPage() {
  const { user, isLoaded } = useUser();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar favoritos (local o backend)
  useEffect(() => {
  if (!isLoaded) return;

  const syncFavorites = async () => {
    if (user) {
      // 1️⃣ leer locales
      const stored = localStorage.getItem('favorites');
      const localFavs = stored ? (JSON.parse(stored) as FavoriteItem[]) : [];

      // 2️⃣ leer backend
      const res = await fetch('/api/favorites');
      const remoteFavs = res.ok ? ((await res.json()) as FavoriteItem[]) : [];

      // 3️⃣ combinar y eliminar duplicados
      const merged = [
        ...remoteFavs,
        ...localFavs.filter((f) => !remoteFavs.some((r) => r.word === f.word)),
      ];

      // 4️⃣ subir los que falten
      for (const fav of localFavs) {
        if (!remoteFavs.some((r) => r.word === fav.word)) {
          await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fav),
          });
        }
      }

      // 5️⃣ limpiar localStorage y actualizar vista
      localStorage.removeItem('favorites');
      setFavorites(merged);
    } else {
      const stored = localStorage.getItem('favorites');
      if (stored) setFavorites(JSON.parse(stored) as FavoriteItem[]);
    }
    setLoading(false);
  };

  syncFavorites();
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

  if (loading) return <div className="p-8 text-gray-400">Cargando favoritos...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">⭐ Favorites</h1>

      {favorites.length === 0 ? (
        <p className="text-gray-400">
          {user ? 'Aún no tienes favoritos guardados.' : 'No favorites saved yet.'}
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
                className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded"
              >
                🗑 Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
