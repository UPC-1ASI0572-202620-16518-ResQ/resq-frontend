export interface PageRequest {
  page: number;
  size: number;
  sort?: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export function paginateInMemory<T>(
  items: readonly T[],
  request: PageRequest,
): PagedResult<T> {
  const page = Math.max(
    0,
    Math.trunc(request.page),
  );

  const size = Math.max(
    1,
    Math.trunc(request.size),
  );

  const start = page * size;
  const totalElements = items.length;

  return {
    items: items.slice(
      start,
      start + size,
    ),

    page,

    size,

    totalElements,

    totalPages:
      totalElements === 0
        ? 0
        : Math.ceil(
            totalElements / size,
          ),
  };
}