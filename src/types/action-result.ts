/**
 * Server Action 표준 반환 타입
 * 모든 Server Action은 이 타입으로 반환하여 일관성 보장
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * 페이지네이션 포함 목록 반환용
 */
export type PaginatedResult<T> = ActionResult<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}>;
