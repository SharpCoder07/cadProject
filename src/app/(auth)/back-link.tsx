"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Top-right back button on the sign-in pages: "Back to login" on password reset, none on sign up. */
export function AuthBackLink({ siteName }: { siteName: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/signup")) return null;
  const toLogin = pathname.startsWith("/reset-password");
  return (
    <Link
      href={toLogin ? "/login" : "/"}
      className="group absolute right-5 top-5 inline-flex h-9 items-center gap-1.5 rounded-full px-3 leading-none text-sm font-medium text-muted transition hover:bg-bg hover:text-ink sm:right-8 sm:top-8"
    >
      <ArrowLeft className="relative top-px block h-4 w-4 shrink-0 transition group-hover:-translate-x-0.5" aria-hidden />
      <span className="leading-none">{toLogin ? "Back to login" : `Back to ${siteName}`}</span>
    </Link>
  );
}
