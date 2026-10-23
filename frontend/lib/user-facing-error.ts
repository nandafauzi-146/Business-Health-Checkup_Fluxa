const technicalErrorPattern =
  /\b(?:supabase|postgres(?:ql)?|sqlstate|pgrst\d*|rpc|constraint|schema|relation|database|migration|stack trace|permission denied|row.level security|jwt|foreign key|check constraint|failed to fetch|network error|unexpected token|cannot read properties|not a function|invalid input syntax|does not exist|violates|timed out)\b/i

export function getUserFacingError(error: unknown, fallback: string): string {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : error && typeof error === 'object' && typeof Reflect.get(error, 'message') === 'string'
        ? Reflect.get(error, 'message')
        : ''
  const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined

  if (
    typeof code === 'string' &&
    (/^PGRST\d+$/.test(code) || /^\d{5}$/.test(code))
  ) {
    return fallback
  }

  const safeMessage = message.trim()
  if (!safeMessage || technicalErrorPattern.test(safeMessage)) {
    return fallback
  }

  return safeMessage
}
