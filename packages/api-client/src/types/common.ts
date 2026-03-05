export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
