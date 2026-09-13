import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
const labels = ["Postcards & Stamps","Photos & Faces","Board Games & Dice","Bikes & Repairs","Songs & Instruments","Buttons & Sewing","Notes & Magnets"];
const slug = (l: string) => l.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
(async () => {
  await assertTopicsGrounded({
    language: "German",
    proposals: labels.map((label) => ({ label, slug: slug(label) })),
    journeyEvidence: [
      "Now I would like to reconnect with my friends",
      "I made a lot of German friends",
      "to be able to read and possibly correspond in German",
    ],
    existingLabels: ["Old Town & River","Castle & Bridges","Forest & Hiking","Lake & Ferries","Coast & Beaches","Markets & Crafts","Mountains & Snow","Going Out","Greetings & Small Talk","Festivals & Neighbours","Eating & Drinking Out","Football & Work","Weekends & Everyday Life","Money & Chores","Food & Drink","Home & Family","Meeting New People","Places & Getting Around","Community & Celebrations","Nature & Adventure","Legends & Folklore"],
  });
  console.log("GROUNDED OK");
  process.exit(0);
})().catch((e) => { console.error("FALLA:", e.message); process.exit(1); });
