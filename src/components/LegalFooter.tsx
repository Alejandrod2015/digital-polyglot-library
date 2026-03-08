import Link from "next/link";

export default function LegalFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#06182d] px-4 py-4 text-xs text-blue-100/60 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>Digital Polyglot · Alberto Alejandro Del Carpio Olemar</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/impressum" className="hover:text-white">
            Impressum
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/cookies" className="hover:text-white">
            Cookies
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/data-deletion" className="hover:text-white">
            Data deletion
          </Link>
        </div>
      </div>
    </footer>
  );
}
