
/**
 * Sanitize database/API error messages to prevent information leakage.
 * Maps known error codes to safe user-facing messages.
 */
export function sanitizeError(error: any): string {
  const safeMessages: Record<string, string> = {
    '23505': 'This record already exists.',
    '23503': 'Cannot perform this action due to related data.',
    '23502': 'A required field is missing.',
    '42501': 'You do not have permission to perform this action.',
    '42P01': 'An error occurred. Please try again.',
    'PGRST116': 'Record not found.',
    'PGRST301': 'Request failed. Please try again.',
  };

  const code = error?.code;
  if (code && safeMessages[code]) {
    return safeMessages[code];
  }

  return 'An error occurred. Please try again.';
}



