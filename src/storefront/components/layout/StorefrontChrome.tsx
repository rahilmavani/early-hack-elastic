"use client";

import { usePathname } from "next/navigation";

// The observer surfaces (/admin, /replay) are not part of the shop, so they
// render without the announcement bar, header and footer.
export function isObserverRoute(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/replay/")
  );
}

export function StorefrontChrome({
  announcement,
  header,
  footer,
  children,
}: {
  announcement: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const observer = isObserverRoute(usePathname());
  if (observer) {
    return <div className="flex-1">{children}</div>;
  }
  return (
    <>
      {announcement}
      {header}
      <div className="flex-1">{children}</div>
      {footer}
    </>
  );
}
