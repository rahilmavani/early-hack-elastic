import { Search } from "lucide-react";

export function SearchForm() {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="relative hidden md:block"
    >
      <label htmlFor="header-search" className="sr-only">
        Search
      </label>
      <Search
        size={16}
        strokeWidth={1.5}
        className="text-ink-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <input
        id="header-search"
        name="q"
        type="search"
        placeholder="Search"
        autoComplete="off"
        className="border-line bg-canvas-muted placeholder:text-ink-faint focus:border-ink focus:bg-canvas h-9 w-56 border pr-3 pl-9 text-sm transition-colors outline-none"
      />
    </form>
  );
}
