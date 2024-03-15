export const safeJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value);
  } catch (e) {
    /* empty */
  }

  return null;
};
