'use client';

import { useEffect, useState } from 'react';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<{ word: string; translation: string }[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('favorites');
    if (stored) {
      setFavorites(JSON.parse(stored));
    }
  }, []);

  const removeFavorite = (word: string) => {
    const updated = favorites.filter((fav) => fav.word !== word);
    setFavorites(updated);
    localStorage.setItem('favorites', JSON.stringify(updated));
  };

  return (
    <div className="p-8 max-w-2xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">⭐ Favorites</h1>

      {favorites.length === 0 ? (
        <p className="text-gray-400">No favorites saved yet.</p>
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
