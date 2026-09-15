import { withBasePath } from "@/lib/urls";

/** Plain GET form; the search page renders results on the server. */
export function SearchForm({ query = "" }: { query?: string }) {
  return (
    <form role="search" action={withBasePath("/search")} method="get" className="search-form">
      <label htmlFor="search-q" className="sr-only">
        Search the archive
      </label>
      <input
        id="search-q"
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search stories"
        autoComplete="off"
        required
      />
      <button type="submit">Search</button>
    </form>
  );
}
