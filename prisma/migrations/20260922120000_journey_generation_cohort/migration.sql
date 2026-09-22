-- Cohorte de generacion del journey: con que molde editorial se escribio.
--
-- WHY (2026-09-22): el Friends ES Mexico C1 es un borrador del molde viejo
-- (siete temas = siete ciudades, protagonista que viaja). Sostenia el peldano
-- C1 de la escalera Friends/mexico, asi que crear el A0 de esa misma familia
-- dejaba hueco en A1, A2, B1 y B2 y el porton lo bloqueaba. Archivarlo lo
-- desbloqueaba, pero mataba 21 historias con practica y glosas. La salida es
-- clasificarlo, no matarlo.
--
-- Aditiva: `null` significa el molde actual, que es lo que son todas las filas
-- salvo las cuatro marcadas abajo.
ALTER TABLE "dp_journeys_v1"
  ADD COLUMN IF NOT EXISTS "generationCohort" TEXT;

-- Los cuatro Friends del molde de ciudades, medidos por sus temas:
--   Friends ES mexico c1     (friends-drinks, monterrey, veracruz, tijuana...)
--   Friends ES colombia c1   (bogota, medellin, cali, barranquilla...)
--   Friends ES argentina c1  (buenos-aires, cordoba, rosario, mendoza...)
--   Friends ES spain a1      (madrid, barcelona, sevilla, valencia...)
-- El de Espana esta LIVE y sigue sosteniendo su peldano: la cohorte lo
-- distingue en la tabla, no lo saca de la escalera. Eso solo pasa con los
-- borradores (ver src/lib/journeyLadder.ts).
UPDATE "dp_journeys_v1"
   SET "generationCohort" = 'cities-2026-07'
 WHERE "id" IN (
   'cmrrrpru1000032nnzsmraa7h',
   'cmrpm0tra000032vgxcs33wrb',
   'cmrqn1s5s000032tj3kq0gykb',
   'cmrr5hnbl000032k1esry5n8g'
 );
