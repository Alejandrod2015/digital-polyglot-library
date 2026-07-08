import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const EDITS: Record<string,[string,string]> = {
  "sonntags-schliesst-sogar-berlin": [
    "Die Straßen: ausgestorben. Nur Kirchenglocken läuten. Vor Katjas Späti: drei Menschen mit demselben verlorenen Blick.",
    "Die Straßen liegen ausgestorben. Nur Kirchenglocken läuten. Vor Katjas Späti stehen drei Menschen mit demselben verlorenen Blick."],
  "ganz-berlin-wartet-auf-einen-mord": [
    "Im Wohnzimmer: sechs Nachbarn, drei Platten Schnittchen, ein Fernseher aus einem anderen Jahrhundert.",
    "Im Wohnzimmer warten sechs Nachbarn, drei Platten Schnittchen und ein Fernseher aus einem anderen Jahrhundert."],
  "umzug-ohne-aufzug": [
    "Abends: Pizza auf dem Übergabeprotokoll, Kartons als Möbel.",
    "Abends gibt es Pizza auf dem Übergabeprotokoll, Kartons als Möbel."],
  "feierabend-ist-ein-versprechen": [
    "Dann Schritte: Frau Brandt, den Mantel über dem Arm.",
    "Dann kommen Schritte näher, und Frau Brandt steht da, den Mantel über dem Arm."],
};
(async()=>{
  for(const [slug,[from,to]] of Object.entries(EDITS)){
    const s=await prisma.journeyStory.findFirst({where:{slug},select:{id:true,text:true}}) as any;
    if(!s.text.includes(from)){console.log(`  ✗ ${slug}: linea no encontrada`);continue;}
    const text=s.text.replace(from,to);
    await prisma.journeyStory.update({where:{id:s.id},data:{text}});
    console.log(`  ✓ ${slug} editado`);
  }
})().finally(()=>prisma.$disconnect());
