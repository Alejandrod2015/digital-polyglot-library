'use client'; // 👈 obligatorio porque importamos un client component (Skeleton)

import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto p-8 text-white">
      <h1 className="text-3xl font-bold mb-8">Explore</h1>

      <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex bg-[#141A33] rounded-2xl overflow-hidden shadow-lg animate-pulse"
          >
            <div className="w-40 flex-shrink-0 bg-gray-700 h-48" />
            <div className="p-5 flex-1">
              <Skeleton lines={3} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
