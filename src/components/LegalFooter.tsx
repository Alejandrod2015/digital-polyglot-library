import Link from "next/link";

export default function LegalFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#06182d] px-4 py-3 text-[11px] text-blue-100/55 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
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
