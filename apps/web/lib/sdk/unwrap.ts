type MaybeFieldResponse<T> = T | { data: T };

export function unwrapSdkData<T>(response: MaybeFieldResponse<T>): T {
  if (
    typeof response === "object" &&
    response !== null &&
    "data" in response &&
    response.data !== undefined
  ) {
    return response.data as T;
  }

  return response as T;
}
