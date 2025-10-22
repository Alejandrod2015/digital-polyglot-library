'use client';

import { useEffect, useState } from 'react';
import {
  getStoriesReadCount,
  getStoriesLimit,
  getReadingHistory,
  addStoryToHistory,
} from '@/utils/readingLimits';

type Props = {
  plan: 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';
  storyId: string;
  children: React.ReactNode;
  fallback: React.ReactNode;
  forceAllow?: boolean;
};

export default function StoryClientGate({
  plan,
  storyId,
  children,
  fallback,
  forceAllow = false,
}: Props) {
  const [allowed, setAllowed] = useState(true);
  const [truncatedContent, setTruncatedContent] = useState<React.ReactNode>(children);

  useEffect(() => {
    if (forceAllow) {
      setAllowed(true);
      setTruncatedContent(children);
      return;
    }

    if (plan === 'free' || plan === 'basic') {
      const history = getReadingHistory();
      const alreadyRead = history.some((s) => s.storyId === storyId);
      const count = getStoriesReadCount(plan);
      const limit = getStoriesLimit(plan);
      const withinLimit = count < limit;

      if (alreadyRead) {
        setAllowed(true);
        setTruncatedContent(children);
      } else {
        const isAllowed = withinLimit;
        setAllowed(isAllowed);
        if (isAllowed) addStoryToHistory(storyId);

        // ⚙️ Truncar contenido visible si no tiene acceso
        if (!isAllowed) {
          const childArray = Array.isArray(children) ? children : [children];
          const truncated = childArray.map((child, i) => {
            if (
              typeof child === 'object' &&
              child !== null &&
              'props' in child &&
              'dangerouslySetInnerHTML' in (child as any).props
            ) {
              const html = (child as any).props.dangerouslySetInnerHTML.__html as string;
              const paragraphs = html.split(/<\/p>/).filter(Boolean);
              const partial = paragraphs.slice(0, Math.max(1, Math.ceil(paragraphs.length * 0.2))).join('</p>') + '</p>';
              return {
                ...child,
                props: { ...child.props, dangerouslySetInnerHTML: { __html: partial } },
              };
            }
            return child;
          });
          setTruncatedContent(truncated);
        } else {
          setTruncatedContent(children);
        }
      }
    } else {
      setAllowed(true);
      setTruncatedContent(children);
    }
  }, [plan, forceAllow, storyId, children]);

  return (
    <>
      {truncatedContent}
      {!allowed && !forceAllow && fallback}
    </>
  );
}
