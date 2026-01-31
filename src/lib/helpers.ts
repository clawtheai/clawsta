// Helper to safely get string from query params
export function getStringParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export function getRequiredStringParam(value: unknown): string {
  const result = getStringParam(value);
  if (!result) throw new Error('Required parameter missing');
  return result;
}
