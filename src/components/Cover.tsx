import Image from "next/image";

type CoverProps = {
  src?: string;       // ruta a /public/covers/...
  alt: string;        // texto alternativo
  className?: string; // para controlar el ancho desde fuera (ej. w-[220px])
};

/**
 * Muestra una portada con:
 * - ratio 2:3 fijo
 * - bordes redondeados visibles
 * - sin recortes (object-contain)
 * - fondo acorde al tema para que los márgenes no “canten”
 */
export default function Cover({ src = "/globe.svg", alt, className = "" }: CoverProps) {
  return (
    <div
  className={`relative aspect-[2/3] rounded-2xl overflow-hidden 
              bg-[#0D1B2A] shadow-lg ring-1 ring-white/10 ${className}`}
>
      <Image
        src={src}
        alt={alt}
        fill
        priority={false}
        sizes="(max-width: 768px) 220px, 240px"
        className="object-cover"
        />

    </div>
  );
}
