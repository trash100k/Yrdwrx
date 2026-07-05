import { describe, it, expect } from "vitest";
import {
  recordProposalView,
  shouldFollowUp,
  deriveTiers,
  proposalDisplayStatus,
  engagementLabel,
  VIEW_DEDUPE_MS,
  FOLLOWUP_VIEW_THRESHOLD,
  FOLLOWUP_COOLDOWN_MS,
} from "./proposal";

const iso = (offsetMs = 0) => new Date(1_700_000_000_000 + offsetMs).toISOString();

describe("recordProposalView", () => {
  it("counts a first open and stamps first/last viewed", () => {
    const { proposal, counted } = recordProposalView({ status: "sent" }, { now: iso() });
    expect(counted).toBe(true);
    expect(proposal.viewCount).toBe(1);
    expect(proposal.firstViewedAt).toBe(iso());
    expect(proposal.lastViewedAt).toBe(iso());
    expect(proposal.views).toHaveLength(1);
    expect(proposal.status).toBe("viewed");
  });

  it("does not mutate the input proposal", () => {
    const input: any = { viewCount: 3, status: "sent" };
    const { proposal } = recordProposalView(input, { now: iso() });
    expect(input.viewCount).toBe(3);
    expect(proposal.viewCount).toBe(4);
    expect(proposal).not.toBe(input);
  });

  it("dedupes two opens inside the dedupe window (counts once)", () => {
    const first = recordProposalView({ status: "sent" }, { now: iso(0) }).proposal;
    const second = recordProposalView(first, { now: iso(VIEW_DEDUPE_MS - 1) });
    expect(second.counted).toBe(false);
    expect(second.proposal.viewCount).toBe(1);
    // lastViewedAt still advances even when the open was deduped
    expect(second.proposal.lastViewedAt).toBe(iso(VIEW_DEDUPE_MS - 1));
  });

  it("counts a second open once past the dedupe window", () => {
    const first = recordProposalView({ status: "sent" }, { now: iso(0) }).proposal;
    const second = recordProposalView(first, { now: iso(VIEW_DEDUPE_MS + 1) });
    expect(second.counted).toBe(true);
    expect(second.proposal.viewCount).toBe(2);
    expect(second.proposal.firstViewedAt).toBe(iso(0)); // preserved
  });

  it("never advances a signed proposal back to viewed", () => {
    const { proposal } = recordProposalView({ status: "accepted", viewCount: 5 }, { now: iso(1e6) });
    expect(proposal.status).toBe("accepted");
    // still logs the open for telemetry
    expect(proposal.viewCount).toBe(6);
  });

  it("respects the signed override even when status is stale", () => {
    const { proposal } = recordProposalView({ status: "viewed" }, { now: iso(), signed: true });
    expect(proposal.status).toBe("viewed"); // untouched, not forced to signed here
  });

  it("caps the stored view trail at 50", () => {
    let p: any = { status: "sent" };
    for (let i = 0; i < 60; i++) {
      p = recordProposalView(p, { now: iso(i * (VIEW_DEDUPE_MS + 1)) }).proposal;
    }
    expect(p.viewCount).toBe(60);
    expect(p.views.length).toBe(50);
  });
});

describe("shouldFollowUp", () => {
  it("is false below the view threshold", () => {
    expect(shouldFollowUp({ viewCount: FOLLOWUP_VIEW_THRESHOLD - 1, status: "viewed" })).toBe(false);
  });

  it("fires at the threshold when unsigned and never nudged", () => {
    expect(shouldFollowUp({ viewCount: FOLLOWUP_VIEW_THRESHOLD, status: "viewed" }, { now: iso() })).toBe(true);
  });

  it("is suppressed when the linked estimate is signed", () => {
    expect(shouldFollowUp({ viewCount: 5, status: "viewed" }, { signed: true })).toBe(false);
  });

  it("is suppressed for a signed/accepted/approved proposal", () => {
    expect(shouldFollowUp({ viewCount: 5, status: "signed" })).toBe(false);
    expect(shouldFollowUp({ viewCount: 5, status: "accepted" })).toBe(false);
    expect(shouldFollowUp({ viewCount: 5, approved: true })).toBe(false);
  });

  it("does not re-nudge inside the cooldown window", () => {
    const p = { viewCount: 3, status: "viewed", followUpSentAt: iso(0) };
    expect(shouldFollowUp(p, { now: iso(FOLLOWUP_COOLDOWN_MS - 1) })).toBe(false);
    expect(shouldFollowUp(p, { now: iso(FOLLOWUP_COOLDOWN_MS + 1) })).toBe(true);
  });

  it("is false for a null proposal", () => {
    expect(shouldFollowUp(null)).toBe(false);
  });
});

describe("deriveTiers", () => {
  it("builds a 3-tier ladder with the middle == the estimate total", () => {
    const tiers = deriveTiers(1000);
    expect(tiers.map((t) => t.id)).toEqual(["good", "better", "best"]);
    expect(tiers[1].price).toBe(1000);
    expect(tiers[0].price).toBeLessThan(tiers[1].price);
    expect(tiers[2].price).toBeGreaterThan(tiers[1].price);
  });

  it("rounds tier prices to clean $5 increments", () => {
    const tiers = deriveTiers(1234);
    for (const t of tiers) expect(t.price % 5).toBe(0);
  });

  it("handles a zero / invalid base without NaN", () => {
    const tiers = deriveTiers(0);
    expect(tiers.every((t) => t.price === 0)).toBe(true);
    const bad = deriveTiers(NaN as any);
    expect(bad.every((t) => Number.isFinite(t.price))).toBe(true);
  });
});

describe("proposalDisplayStatus + engagementLabel", () => {
  it("reports draft/sent/viewed/signed transitions", () => {
    expect(proposalDisplayStatus({})).toBe("draft");
    expect(proposalDisplayStatus({ sentAt: iso() })).toBe("sent");
    expect(proposalDisplayStatus({ sentAt: iso(), viewCount: 2 })).toBe("viewed");
    expect(proposalDisplayStatus({ viewCount: 2 }, true)).toBe("signed");
  });

  it("labels engagement for the owner badge", () => {
    expect(engagementLabel({ sentAt: iso() })).toBe("Sent · not opened");
    expect(engagementLabel({ sentAt: iso(), viewCount: 2 })).toBe("Opened 2× · not signed");
    expect(engagementLabel({ viewCount: 2 }, true)).toBe("Signed");
  });
});
