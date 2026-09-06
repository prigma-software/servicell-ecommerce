import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertAuthenticated, assertAdmin } from "./authGuards";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe("authGuards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertAuthenticated", () => {
    it("should throw 'Unauthorized' if no user session exists", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      await expect(assertAuthenticated()).rejects.toThrow("Unauthorized");
    });

    it("should return user details if authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "user@test.com" } },
        error: null,
      });

      const user = await assertAuthenticated();
      expect(user).toEqual({ id: "user-123", email: "user@test.com" });
    });
  });

  describe("assertAdmin", () => {
    it("should throw 'Unauthorized' if user is not logged in", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      await expect(assertAdmin()).rejects.toThrow("Unauthorized");
    });

    it("should throw 'Forbidden' if user role is not 'administrador'", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "customer@test.com" } },
        error: null,
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "cliente" },
              error: null,
            }),
          }),
        }),
      });

      await expect(assertAdmin()).rejects.toThrow("Forbidden");
    });

    it("should succeed and return admin details when user has 'administrador' role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@test.com" } },
        error: null,
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "administrador" },
              error: null,
            }),
          }),
        }),
      });

      const admin = await assertAdmin();
      expect(admin).toEqual({
        id: "admin-1",
        email: "admin@test.com",
        role: "administrador",
      });
    });
  });
});
