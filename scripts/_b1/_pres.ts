import { presente } from "../../scripts/buildGlossForms";
for (const v of ["devolver","encender","faltar","constar"]) console.log(v, JSON.stringify(presente(v, "spain")));
