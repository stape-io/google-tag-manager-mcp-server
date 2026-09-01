export interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    returned: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextPage: number | null;
    previousPage: number | null;
  };
}

export function paginateArray<T>(
  allItems: T[],
  page: number = 1,
  itemsPerPage = 20,
): PaginationResult<T> {
  const total = allItems.length;
  const currentPage = page || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = allItems.slice(startIndex, endIndex);
  const totalPages = Math.ceil(total / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  return {
    data: paginatedData,
    pagination: {
      currentPage: currentPage,
      itemsPerPage: itemsPerPage,
      totalItems: total,
      totalPages: totalPages,
      returned: paginatedData.length,
      hasNextPage: hasNextPage,
      hasPreviousPage: hasPreviousPage,
      nextPage: hasNextPage ? currentPage + 1 : null,
      previousPage: hasPreviousPage ? currentPage - 1 : null,
    },
  };
}
