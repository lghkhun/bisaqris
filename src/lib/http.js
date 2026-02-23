export function jsonOk(data, status = 200, headers = {}) {
  return Response.json({ success: true, data }, { status, headers });
}

export function jsonError(code, message, status = 400, details, headers = {}) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
        details: details || [],
      },
    },
    { status, headers },
  );
}
