import type { HandInput, SavedHand } from "./poker";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.json();
}

export const listHands = (offset = 0) =>
  request<SavedHand[]>(`/api/hands?limit=20&offset=${offset}`);
export const saveHand = (hand: HandInput) =>
  request<SavedHand>("/api/hands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hand),
  });
