// scratch preload: carga .env y .env.local (DATABASE_URL vive en .env, R2 en .env.local)
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
