'use client';

export default function AppSkeleton() {
  return (
    <div className="p-8 animate-pulse text-white">
      <div className="h-8 bg-gray-800 w-1/3 rounded mb-8" />
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-800 p-4 rounded-lg shadow">
            <div className="w-full h-48 bg-gray-700 rounded-md mb-3" />
            <div className="h-4 bg-gray-700 rounded w-5/6 mb-2" />
            <div className="h-4 bg-gray-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
