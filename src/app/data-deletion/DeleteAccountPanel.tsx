"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

/**
 * Self-service account + data deletion for a signed-in user. Rendered at the
 * top of /data-deletion (and its /de variant); the email-based instructions
 * below it stay as the fallback for anyone who can't sign in. Play requires a
 * readily discoverable way to delete the account and its data — this is it.
 *
 * Copy is localizable via the `copy` prop (defaults to English) so the German
 * page can reuse the same logic without duplicating the flow.
 */
export type DeleteAccountCopy = {
  signedOutTitle: string;
  signedOutBody: string;
  signedInTitle: string;
  signedInBody: string;
  accountLabel: string;
  deleteButton: string;
  confirmButton: string;
  deletingLabel: string;
  cancelButton: string;
  doneBody: string;
  genericError: string;
};

const DEFAULT_COPY: DeleteAccountCopy = {
  signedOutTitle: "Delete your account now",
  signedOutBody:
    "Sign in on this device to delete your account and data instantly. If you can't sign in, use the email method below.",
  signedInTitle: "Delete your account now",
  signedInBody:
    "This permanently deletes your account and all associated data: learning history, favorites, saved stories, metrics and billing records. This cannot be undone.",
  accountLabel: "Account",
  deleteButton: "Delete my account",
  confirmButton: "Yes, delete everything",
  deletingLabel: "Deleting…",
  cancelButton: "Cancel",
  doneBody: "Your account and personal data have been deleted. Signing you out…",
  genericError: "Deletion failed. Please try again or email us.",
};

export function DeleteAccountPanel({ copy = DEFAULT_COPY }: { copy?: DeleteAccountCopy }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/delete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? copy.genericError);
      }
      setDone(true);
      // The account is gone; end the local session and send them home.
      await signOut({ redirectUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.genericError);
      setBusy(false);
    }
  }

  if (!isLoaded) return null;

  const box = "mt-8 rounded-2xl border border-[var(--border,rgba(0,0,0,0.12))] p-5";

  if (done) {
    return (
      <div className={box}>
        <p className="text-[15px] leading-7">{copy.doneBody}</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={box}>
        <h2 className="text-lg font-semibold">{copy.signedOutTitle}</h2>
        <p className="mt-2 text-[15px] leading-7 text-[var(--muted)]">{copy.signedOutBody}</p>
      </div>
    );
  }

  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className={box}>
      <h2 className="text-lg font-semibold">{copy.signedInTitle}</h2>
      <p className="mt-2 text-[15px] leading-7 text-[var(--muted)]">{copy.signedInBody}</p>
      {email ? (
        <p className="mt-2 text-[15px] leading-7 text-[var(--muted)]">
          {copy.accountLabel}: <span className="font-medium">{email}</span>
        </p>
      ) : null}

      {error ? <p className="mt-3 text-[15px] leading-7 text-red-500">{error}</p> : null}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-full border border-red-500 px-5 py-2.5 text-[15px] font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
        >
          {copy.deleteButton}
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="rounded-full bg-red-500 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {busy ? copy.deletingLabel : copy.confirmButton}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="rounded-full px-4 py-2.5 text-[15px] font-medium text-[var(--muted)] hover:underline disabled:opacity-60"
          >
            {copy.cancelButton}
          </button>
        </div>
      )}
    </div>
  );
}
