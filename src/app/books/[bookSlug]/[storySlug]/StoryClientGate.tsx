'use client';

import { useEffect, useState } from 'react';

type Props = {
  plan: 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';
  storyId: string;
  children: React.ReactNode;
  fallback: React.ReactNode;
  forceAllow?: boolean;
};

/**
 * StoryClientGate — versión limpia y visual:
 * - Si `forceAllow` es true → muestra todo.
 * - Si no → muestra 20 % del texto + degradado + fallback (estilo Medium).
 */
export default function StoryClientGate({
  plan,
  storyId,
  children,
  fallback,
  forceAllow = false,
}: Props) {
  const [allowed, setAllowed] = useState(false);
  const [truncatedContent, setTruncatedContent] = useState<React.ReactNode>(children);

  useEffect(() => {
    if (forceAllow) {
      setAllowed(true);
      setTruncatedContent(children);
      return;
    }

    const childArray = Array.isArray(children) ? children : [children];
    const truncated = childArray.map((child) => {
      if (
        typeof child === 'object' &&
        child !== null &&
        'props' in child &&
        'dangerouslySetInnerHTML' in (child as any).props
      ) {
        const html = (child as any).props.dangerouslySetInnerHTML.__html as string;
        const partial = html.slice(0, 700);

      // evita cortar dentro de una etiqueta abierta (muy raro pero seguro)
      const safePartial = partial.endsWith('<')
        ? partial.slice(0, -1)
        : partial;

      // cierra etiquetas abiertas si hace falta
      const fixedPartial = safePartial.replace(/<([^>]+)?$/, '');

      // añade puntos suspensivos
      const finalHtml = `${fixedPartial}…`;

      return {
        ...child,
        props: { ...child.props, dangerouslySetInnerHTML: { __html: finalHtml } },
      };

      }
      return child;
    });

    setAllowed(false);
    setTruncatedContent(truncated);
  }, [plan, forceAllow, storyId, children]);

    return (
    <div className="relative">
      {truncatedContent}

      {!allowed && !forceAllow && (
        // Deja que el 'fallback' controle su propio layout (horizontal),
        // sin contenedores extra ni estilos que lo fuercen a columna.
        <>{fallback}</>
      )}
    </div>
  );

}
