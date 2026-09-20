import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { summariseTerms, similarityPercent } from "../DuplicateCandidates";
import type { DuplicateReport } from "../../../../domain/interfaces/i.riskLink";

const mockGetDuplicateCandidates = vi.fn();

vi.mock("../../../../application/repository/riskLink.repository", () => ({
  getDuplicateCandidates: (...args: unknown[]) => mockGetDuplicateCandidates(...args),
}));

vi.mock("../../../../application/hooks/useUsers", () => ({
  default: () => ({
    users: [{ id: 7, name: "Ada", surname: "Lovelace", email: "ada@x.io", roleId: 1 }],
    loading: false,
    error: null,
    refreshUsers: vi.fn(),
  }),
}));

import DuplicateCandidates from "../DuplicateCandidates";

describe("duplicate candidate helpers", () => {
  it("caps a long term list and counts the rest instead of scrolling it", () => {
    const terms = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(summariseTerms(terms)).toBe("a, b, c, d, e, f +2 more");
    expect(summariseTerms(terms.slice(0, 6))).toBe("a, b, c, d, e, f");
  });

  it("renders a dash rather than a blank cell for no shared terms", () => {
    expect(summariseTerms([])).toBe("—");
  });

  it("reads the 0-1 ratio as a whole percent", () => {
    expect(similarityPercent(0.25)).toBe(25);
    expect(similarityPercent(0.335)).toBe(34);
    expect(similarityPercent(1)).toBe(100);
  });
});

describe("DuplicateCandidates rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const report = (overrides: Partial<DuplicateReport> = {}): DuplicateReport => ({
    organization_id: 1,
    scanned: 12,
    compared: 30,
    truncated: false,
    candidates: [],
    ...overrides,
  });

  const pair = {
    risk_a: { id: 11, risk_name: "Model drift unnoticed", risk_owner: 7 },
    risk_b: { id: 12, risk_name: "Model drift undetected", risk_owner: null },
    similarity: 0.62,
    shared_tokens: ["model", "drift"],
    also_shares: ["category: Operational risk", "project"],
  };

  const expand = async () => {
    render(<DuplicateCandidates />);
    await userEvent.click(await screen.findByText("Duplicate candidates"));
  };

  it("resolves both owners — a known id by name, a null one as unassigned", async () => {
    mockGetDuplicateCandidates.mockResolvedValue(report({ candidates: [pair] }));
    await expand();

    expect(await screen.findByText("Model drift unnoticed")).toBeInTheDocument();
    expect(screen.getByText(/#11 · Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/#12 · Unassigned/)).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("falls back to the id when the user list does not carry the owner", async () => {
    mockGetDuplicateCandidates.mockResolvedValue(
      report({
        candidates: [{ ...pair, risk_a: { ...pair.risk_a, risk_owner: 999 } }],
      }),
    );
    await expand();

    expect(await screen.findByText(/#11 · User #999/)).toBeInTheDocument();
  });

  it("says the scan was capped rather than passing a sample off as the whole org", async () => {
    mockGetDuplicateCandidates.mockResolvedValue(report({ truncated: true, candidates: [pair] }));
    await expand();

    expect(await screen.findByRole("status")).toHaveTextContent(/size limit/i);
  });

  it("reports no duplicates as a result, quoting how many pairs were compared", async () => {
    mockGetDuplicateCandidates.mockResolvedValue(report());
    await expand();

    expect(await screen.findByText(/No likely duplicates/)).toBeInTheDocument();
    expect(screen.getByText(/30 pairs compared/)).toBeInTheDocument();
  });

  it("distinguishes an empty organization from a clean scan", async () => {
    mockGetDuplicateCandidates.mockResolvedValue(report({ scanned: 0, compared: 0 }));
    await expand();

    expect(await screen.findByText("No risks to scan yet.")).toBeInTheDocument();
  });

  it("surfaces a failed fetch instead of an empty table", async () => {
    mockGetDuplicateCandidates.mockRejectedValue(new Error("boom"));
    await expand();

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
