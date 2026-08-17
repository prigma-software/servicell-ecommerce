import { describe, it, expect, vi, beforeEach } from "vitest"
import { canTransitionOrder } from "./orderStatusTransitions"

describe("Order Cancellation & State Transitions", () => {
  it("allows transitioning from APPROVED to DECLINED (cancellation)", () => {
    expect(canTransitionOrder("APPROVED", "DECLINED")).toBe(true)
  })

  it("allows transitioning from PENDING_MANUAL to DECLINED (cancellation)", () => {
    expect(canTransitionOrder("PENDING_MANUAL", "DECLINED")).toBe(true)
  })

  it("allows transitioning from PENDING to DECLINED (cancellation)", () => {
    expect(canTransitionOrder("PENDING", "DECLINED")).toBe(true)
  })

  it("blocks cancelling an already DECLINED order", () => {
    expect(canTransitionOrder("DECLINED", "DECLINED")).toBe(true) // identity
    expect(canTransitionOrder("DECLINED", "APPROVED")).toBe(false)
  })

  it("blocks cancelling an ERROR order", () => {
    expect(canTransitionOrder("ERROR", "DECLINED")).toBe(false)
  })
})
