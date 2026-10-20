// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RefundReviewLink } from "../src/components/chat/refund-review-link";
import { refunds } from "./helpers";
import type { ToolActivity } from "../src/components/chat/tool-activity";
afterEach(cleanup);
const call = (): ToolActivity => ({
  callId: "request",
  name: "request_refund",
  input: {},
  result: {
    refund: { ...refunds[0], status: "pending_approval" },
    requires_approval: true,
  },
  status: "done",
});
describe("customer refund next step", () => {
  it("links a validated pending request to its exact review card once", () => {
    render(
      <RefundReviewLink calls={[call(), { ...call(), callId: "repeat" }]} />,
    );
    const links = screen.getAllByRole("link", {
      name: "Review refund request",
    });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(
      `/approvals#refund-${refunds[0].id}`,
    );
    expect(screen.getByText(/No refund has been issued/)).toBeTruthy();
  });
  it("never presents a failed, incomplete, malformed or already-issued tool result as approval-ready", () => {
    render(
      <RefundReviewLink
        calls={[
          { ...call(), status: "failed" },
          { ...call(), status: "running" },
          {
            ...call(),
            result: { refund: { id: "invented" }, requires_approval: true },
          },
          {
            ...call(),
            result: {
              refund: { ...refunds[0], status: "succeeded" },
              requires_approval: true,
            },
          },
        ]}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
