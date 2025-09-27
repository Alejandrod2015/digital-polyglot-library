'use client';

import { useRef } from 'react';

export default function ReaderPage() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlay = () => {
    audioRef.current?.play();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">1. El Sabor del Maíz: Un Viaje a través de los Tacos</h1>
      
      <p>
        Es una mañana soleada en Ciudad de México. Las calles están llenas de vida, con el bullicio de coches,
        vendedores y el aroma inconfundible de comida callejera que invade el aire.
      </p>

      <p className="italic">
        Diego: Por fin, ¡el momento ha llegado! Tacos al pastor, los originales, en la mera CDMX.
      </p>

      <audio
  ref={audioRef}
  controls
  className="w-full mt-4"
  src="/audio/Audiobook_test.mp3"
/>




      <button
        onClick={handlePlay}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
      >
        Reproducir Audio
      </button>
    </div>
  );
}
