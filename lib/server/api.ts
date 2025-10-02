export function handleApiError(error: any) {
  let status = 500;
  const errorMessage = error?.message || JSON.stringify(error);
  const results = { error: errorMessage };

  if (errorMessage.includes("Not authenticated")) status = 401;
  else if (errorMessage.includes("permission-denied")) status = 403;
  else console.error("API Error:", errorMessage, error);

  return { status, results };
}
