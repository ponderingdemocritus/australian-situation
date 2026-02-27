export type SeriesRepositoryErrorCode = "UNSUPPORTED_REGION" | "UNKNOWN_SERIES_ID";

export class SeriesRepositoryError extends Error {
  readonly code: SeriesRepositoryErrorCode;
  readonly status: number;

  constructor(code: SeriesRepositoryErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
