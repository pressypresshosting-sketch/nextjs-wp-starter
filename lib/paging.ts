/** Parse a `/page/[n]` segment. Only integers of 2 or more are valid; page 1 is the bare route. */
export function parsePageParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  return page >= 2 ? page : null;
}

/** Numbers 2..totalPages for generateStaticParams of `/page/[n]` routes. */
export function extraPages(total: number, perPage: number): number[] {
  const totalPages = Math.ceil(total / perPage);
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
}
