'use client';

import PlayerWrapper from "@/components/PlayerWrapper";

export default function StoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">{children}</main>

      {/* Player solo en páginas de stories */}
      <div className="fixed bottom-0 left-0 right-0 z-20 md:ml-64">
        <PlayerWrapper />
      </div>
    </div>
  );
}
