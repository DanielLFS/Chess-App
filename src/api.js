const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8010").replace(/\/$/, "");

async function request(path, body, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Request failed (${response.status})`);
  return payload;
}

export const chessApi = {
  validateMove: (fen, move, signal) => request("/v1/move", { fen, move }, signal),
  engineMove: (fen, timeMs, signal) =>
    request("/v1/engine-move", { fen, time_ms: timeMs, multipv: 1 }, signal),
  analyze: (fen, timeMs, multipv, signal) =>
    request("/v1/analyze", { fen, time_ms: timeMs, multipv }, signal),
};

