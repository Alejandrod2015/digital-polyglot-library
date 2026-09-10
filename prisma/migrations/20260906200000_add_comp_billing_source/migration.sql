-- Add 'comp' (cortesia) to the BillingSource enum: entitlement premium sin
-- pago, para el grupo insider post-launch (miembro = premium mientras
-- participe). Additive, non-destructive.
ALTER TYPE "BillingSource" ADD VALUE IF NOT EXISTS 'comp';
