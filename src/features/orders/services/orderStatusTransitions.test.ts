import { describe, it, expect } from "vitest"
import { canTransitionOrder } from "./orderStatusTransitions"

describe("OrderStatusTransitions (State Machine)", () => {
  it("should allow transitions from PENDING to APPROVED, DECLINED, or ERROR", () => {
    expect(canTransitionOrder("PENDING", "APPROVED")).toBe(true)
    expect(canTransitionOrder("PENDING", "DECLINED")).toBe(true)
    expect(canTransitionOrder("PENDING", "ERROR")).toBe(true)
    expect(canTransitionOrder("PENDING", "PENDING_MANUAL")).toBe(false)
  })

  it("should allow transitions from PENDING_MANUAL to APPROVED, DECLINED, or ERROR", () => {
    expect(canTransitionOrder("PENDING_MANUAL", "APPROVED")).toBe(true)
    expect(canTransitionOrder("PENDING_MANUAL", "DECLINED")).toBe(true)
    expect(canTransitionOrder("PENDING_MANUAL", "ERROR")).toBe(true)
  })

  it("should allow cancelling an APPROVED order (transition to DECLINED)", () => {
    expect(canTransitionOrder("APPROVED", "DECLINED")).toBe(true)
    expect(canTransitionOrder("APPROVED", "PENDING")).toBe(false)
    expect(canTransitionOrder("APPROVED", "PENDING_MANUAL")).toBe(false)
  })

  it("should block any transitions from terminal states DECLINED and ERROR", () => {
    expect(canTransitionOrder("DECLINED", "APPROVED")).toBe(false)
    expect(canTransitionOrder("DECLINED", "PENDING")).toBe(false)
    expect(canTransitionOrder("ERROR", "APPROVED")).toBe(false)
    expect(canTransitionOrder("ERROR", "PENDING")).toBe(false)
  })

  it("should allow identity transitions (same status to same status)", () => {
    expect(canTransitionOrder("APPROVED", "APPROVED")).toBe(true)
    expect(canTransitionOrder("DECLINED", "DECLINED")).toBe(true)
  })
})
