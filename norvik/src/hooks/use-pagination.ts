import { useState } from "react";

export function usePagination(defaultLimit = 10) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(defaultLimit);

  const nextPage = () => setOffset((prev) => prev + limit);
  const prevPage = () => setOffset((prev) => Math.max(0, prev - limit));
  const resetPage = () => setOffset(0);

  return { offset, limit, setOffset, setLimit, nextPage, prevPage, resetPage };
}