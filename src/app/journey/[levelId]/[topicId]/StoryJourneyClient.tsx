"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Lock, Map, Sparkles, Star } from "lucide-react";

type StoryJourneyNode =
  | {
      kind: "story";
      id: string;
      title: string;
      href?: string;
      coverUrl?: string | null;
      label: string;
      meta: string;
      badge: string;
      badgeTone: "lime" | "sky" | "emerald" | "slate";
      unlocked: boolean;
    }
  | {
      kind: "final";
      id: string;
      href?: string;
      badge: string;
      badgeTone: "amber" | "slate" | "emerald";
      unlocked: boolean;
      icon: "sparkles";
    };

type StoryJourneyClientProps = {
  nodes: StoryJourneyNode[];
};

const laneOffsets = [0, 46, 8, 52, 14, 44];

function badgeClasses(tone: StoryJourneyNode["badgeTone"]) {
  switch (tone) {
    case "lime":
      return "border-lime-200/20 bg-[#13284a] text-lime-200";
    case "sky":
      return "border-sky-200/20 bg-[#13284a] text-sky-200";
    case "emerald":
      return "border-emerald-200/20 bg-[#13284a] text-emerald-200";
    case "amber":
      return "border-amber-200/20 bg-[#13284a] text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

export default function StoryJourneyClient({ nodes }: StoryJourneyClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [connectorFrame, setConnectorFrame] = useState({ width: 0, height: 0 });
  const [connectorPaths, setConnectorPaths] = useState<string[]>([]);

  useEffect(() => {
    const measureConnectors = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const nextPaths: string[] = [];

      for (let index = 0; index < nodes.length - 1; index += 1) {
        const current = nodeRefs.current[index];
        const next = nodeRefs.current[index + 1];
        if (!current || !next) continue;

        const currentRect = current.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        const goingRight = nextRect.left > currentRect.left;
        const startX = goingRight
          ? currentRect.right - containerRect.left - 3
          : currentRect.left - containerRect.left + 3;
        const endX = goingRight
          ? nextRect.left - containerRect.left + 3
          : nextRect.right - containerRect.left - 3;
        const startY =
          currentRect.top -
          containerRect.top +
          currentRect.height * (goingRight ? 0.36 : 0.68);
        const endY =
          nextRect.top -
          containerRect.top +
          nextRect.height * (goingRight ? 0.3 : 0.62);
        const horizontalGap = Math.abs(endX - startX);
        const controlOffset = Math.max(28, horizontalGap * 0.42);
        const exitX = goingRight ? startX + controlOffset : startX - controlOffset;
        const entryX = goingRight ? endX - controlOffset : endX + controlOffset;

        nextPaths.push(
          `M ${startX} ${startY} C ${exitX} ${startY}, ${entryX} ${endY}, ${endX} ${endY}`
        );
      }

      setConnectorFrame({ width: containerRect.width, height: containerRect.height });
      setConnectorPaths(nextPaths);
    };

    measureConnectors();
    const frameId = window.requestAnimationFrame(measureConnectors);
    window.addEventListener("resize", measureConnectors);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measureConnectors);
    };
  }, [nodes]);

  return (
    <div ref={containerRef} className="relative mx-auto max-w-[24rem] pb-1.5 pt-0">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${Math.max(connectorFrame.width, 1)} ${Math.max(connectorFrame.height, 1)}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="journey-story-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0 0 L8 4 L0 8"
              fill="none"
              stroke="rgba(163,230,53,0.55)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        {connectorPaths.map((path, index) => (
          <path
            key={`story-connector-${index}`}
            d={path}
            fill="none"
            stroke="rgba(163,230,53,0.34)"
            strokeWidth="1"
            strokeDasharray="1.8 5.4"
            strokeLinecap="round"
            markerEnd="url(#journey-story-arrow)"
          />
        ))}
      </svg>

      <div className="relative flex flex-col gap-3.5">
        {nodes.map((node, index) => {
          const offset = laneOffsets[index % laneOffsets.length];

          if (node.kind === "story") {
            const content = (
              <>
                <span
                  className={`mb-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${badgeClasses(node.badgeTone)}`}
                >
                  {node.badge === "Start" ? <Star size={12} /> : node.badge === "Locked" ? <Lock size={12} /> : null}
                  {node.badge}
                </span>

                <span
                  ref={(element) => {
                    nodeRefs.current[index] = element;
                  }}
                  className={`relative flex h-[3.85rem] w-[3.85rem] items-center justify-center overflow-hidden rounded-[0.95rem] border-[3px] border-[#20395b] ${
                    node.unlocked
                      ? "bg-[linear-gradient(180deg,#75d9ff_0%,#4f8df7_100%)] text-slate-950 shadow-[0_8px_18px_rgba(59,130,246,0.18)]"
                      : "bg-[#314861] text-white/45 shadow-[inset_0_-10px_0_rgba(0,0,0,0.16)]"
                  }`}
                >
                  {node.coverUrl ? (
                    <Image
                      src={node.coverUrl}
                      alt={node.title}
                      fill
                      sizes="72px"
                      className={node.unlocked ? "object-cover" : "object-cover grayscale opacity-55"}
                    />
                  ) : (
                    <Map size={24} />
                  )}
                </span>

                <span className="mt-1.5 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200/75">
                  {node.label}
                </span>
                <h3 className={`mt-1 text-[0.92rem] font-black leading-tight tracking-tight ${node.unlocked ? "text-white" : "text-white/80"}`}>
                  {node.title}
                </h3>
                <p className={`mt-0.5 line-clamp-2 text-[10px] uppercase tracking-[0.14em] ${node.unlocked ? "text-slate-300/65" : "text-slate-300/55"}`}>
                  {node.meta}
                </p>
              </>
            );

            return (
              <div key={node.id} className="w-full" style={{ marginLeft: `${offset}%` }}>
                {node.unlocked && node.href ? (
                  <Link href={node.href} className="group flex max-w-[210px] flex-col items-center text-center">
                    {content}
                  </Link>
                ) : (
                  <div className="flex max-w-[210px] flex-col items-center text-center opacity-72">{content}</div>
                )}
              </div>
            );
          }

          const finalContent = (
            <>
              <span
                className={`mb-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${badgeClasses(node.badgeTone)}`}
              >
                {node.badge === "Checkpoint" ? <Star size={12} /> : node.badge === "Finish this journey" ? <Lock size={12} /> : null}
                {node.badge}
              </span>
              <span
                ref={(element) => {
                  nodeRefs.current[index] = element;
                }}
                className={`flex h-[3.85rem] w-[3.85rem] items-center justify-center rounded-[0.95rem] border-[3px] border-[#20395b] ${
                  node.badgeTone === "amber"
                    ? "bg-[linear-gradient(180deg,#fde68a_0%,#f59e0b_100%)] text-slate-950 shadow-[0_8px_18px_rgba(245,158,11,0.18)]"
                    : node.badgeTone === "emerald"
                      ? "bg-[linear-gradient(180deg,#6ee7b7_0%,#10b981_100%)] text-slate-950 shadow-[0_8px_18px_rgba(16,185,129,0.18)]"
                      : "bg-[#314861] text-white/45 shadow-[inset_0_-10px_0_rgba(0,0,0,0.16)]"
                }`}
              >
                <Sparkles size={20} />
              </span>
            </>
          );

          return (
            <div key={node.id} className="w-full" style={{ marginLeft: `${offset}%` }}>
              {node.unlocked && node.href ? (
                <Link href={node.href} className="group flex max-w-[210px] flex-col items-center text-center">
                  {finalContent}
                </Link>
              ) : (
                <div className={`flex max-w-[210px] flex-col items-center text-center ${node.badgeTone === "emerald" ? "opacity-90" : "opacity-72"}`}>
                  {finalContent}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
