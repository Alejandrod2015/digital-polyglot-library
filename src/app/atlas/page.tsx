import AtlasClient from "./AtlasClient";
import { buildAtlasLevels } from "./atlasData";

export const metadata = {
  title: "Atlas | Digital Polyglot",
  description: "Move through language by level and topic, one story path at a time.",
};

export default function AtlasPage() {
  const levels = buildAtlasLevels();
  return <AtlasClient levels={levels} />;
}
