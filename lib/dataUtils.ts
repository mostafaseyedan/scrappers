// Sanitize before saving to db. Convert date strings to Date objects.
export function sanitizeForDb(obj: Record<string, any>) {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value?.toString().match(/^\d{4}-\d{2}-\d{2}/)) {
      sanitized[key] = new Date(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Firebase to json
export function fbToJs(fbData: Record<string, any>) {
  let jsData = {} as Record<string, any>;

  for (const [key, value] of Object.entries(fbData)) {
    if (value?.seconds) {
      jsData[key] = new Date(value.seconds * 1000);
    } else {
      jsData[key] = value;
    }
  }

  return jsData;
}
