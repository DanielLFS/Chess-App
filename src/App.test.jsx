import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { chessApi } from "./api";

vi.mock("./api", () => ({
  chessApi: {
    analyze: vi.fn(),
    engineMove: vi.fn(),
    validateMove: vi.fn(),
  },
}));

afterEach(cleanup);

describe("dual-engine controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chessApi.analyze.mockResolvedValue({
      elapsed_ms: 24,
      lines: [{ depth: 3, score_cp: 25, mate: null, moves: [{ uci: "e2e4", san: "e4" }] }],
      metrics: {
        engine: "daniel",
        depth: 3,
        nodes: 8902,
        nodes_per_second: 118000,
        beta_cutoffs: 420,
        elapsed_ms: 23,
      },
    });
  });

  it("starts with Daniel Engine and renders returned search metrics during play", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Build your opening position/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start match/ }));
    fireEvent.click(screen.getByRole("button", { name: "Analyse" }));

    await waitFor(() => expect(chessApi.analyze).toHaveBeenCalled());
    expect(chessApi.analyze.mock.calls[0][3]).toBe("daniel");
    expect(await screen.findByText("118.0k")).toBeInTheDocument();
    expect(screen.getByText("8,902")).toBeInTheDocument();
  });

  it("locks Stockfish selection after starting the match", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Stockfish" }));
    fireEvent.click(screen.getByRole("button", { name: /Start match/ }));

    expect(screen.getAllByText("Stockfish 17")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Stockfish" })).not.toBeInTheDocument();
    expect(screen.getByText("LOCKED")).toBeInTheDocument();
  });
});
