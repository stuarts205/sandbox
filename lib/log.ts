// Log attributes for a caught error. Sentry log attributes take only strings,
// numbers and booleans, so the error goes in as its name and message.
export function errorAttributes(error: unknown) {
  return error instanceof Error
    ? { "error.type": error.name, "error.message": error.message }
    : { "error.type": typeof error, "error.message": String(error) }
}
