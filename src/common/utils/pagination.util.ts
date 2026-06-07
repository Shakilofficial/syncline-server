export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export class PaginationUtil {
  // ── Calculate Prisma skip/take ──────────────────────────────────────────────
  static getSkipTake(page = 1, limit = 10): { skip: number; take: number } {
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, limit);
    const skip = (validatedPage - 1) * validatedLimit;
    return { skip, take: validatedLimit };
  }

  // ── Construct Paginated Response Envelope ────────────────────────────────────
  static createResult<T>(
    data: T[],
    total: number,
    page = 1,
    limit = 10,
  ): PaginatedResult<T> {
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, limit);
    const totalPages = Math.ceil(total / validatedLimit);

    return {
      data,
      meta: {
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPrevPage: validatedPage > 1,
      },
    };
  }
}
