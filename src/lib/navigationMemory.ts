// /src/lib/navigationMemory.ts
let lastSection: string | null = null;

export function setLastSection(section: string) {
  lastSection = section;
}

export function getLastSection() {
  return lastSection;
}
