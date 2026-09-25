export interface ApiSuccessResponse<TData = unknown> {
  success: true;
  data: TData;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  path: string;
  timestamp: string;
}