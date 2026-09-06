import { subjuntivoPresenteES } from "../glossMoods";
for (const v of ["encender","faltar","devolver","gritar","constar","empezar"])
  console.log(v.padEnd(10), JSON.stringify(subjuntivoPresenteES(v)));
