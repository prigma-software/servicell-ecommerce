import { describe, it, expect } from "vitest"

describe("Edge Middleware Route Security Checks", () => {
  function classifyRoute(pathname: string) {
    const isAdminPath = pathname.startsWith("/admin")
    const isAdminApiPath =
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/pos") ||
      pathname === "/api/orders/export" ||
      pathname.startsWith("/api/users")
    const isProfilePath = pathname.startsWith("/profile")
    const requiresPrivateCache = isAdminPath || isAdminApiPath || isProfilePath

    return {
      isAdminPath,
      isAdminApiPath,
      isProfilePath,
      requiresPrivateCache,
    }
  }

  it("clasifica correctamente todas las rutas API administrativas y del POS", () => {
    const protectedApis = [
      "/api/admin/metrics",
      "/api/pos/sales",
      "/api/pos/products",
      "/api/pos/cashup",
      "/api/pos/bogo-offers",
      "/api/pos/reports/summary",
      "/api/pos/validate",
      "/api/orders/export",
      "/api/users",
      "/api/users?role=administrador",
    ]

    for (const path of protectedApis) {
      const pathname = path.split("?")[0]
      const { isAdminApiPath, requiresPrivateCache } = classifyRoute(pathname)
      expect(isAdminApiPath, `Ruta no protegida como API admin: ${pathname}`).toBe(true)
      expect(requiresPrivateCache).toBe(true)
    }
  })

  it("clasifica correctamente las páginas de administración", () => {
    const adminPages = [
      "/admin",
      "/admin/products",
      "/admin/orders",
      "/admin/pos",
      "/admin/pos/cashup",
      "/admin/users",
    ]

    for (const path of adminPages) {
      const { isAdminPath, requiresPrivateCache } = classifyRoute(path)
      expect(isAdminPath).toBe(true)
      expect(requiresPrivateCache).toBe(true)
    }
  })

  it("no bloquea indebidamente rutas públicas o de clientes", () => {
    const publicPaths = [
      "/",
      "/products",
      "/products/123",
      "/cart",
      "/checkout",
      "/tracking",
      "/tracking/ORD-123",
      "/api/cart/validate",
      "/api/cart/reserve",
      "/api/webhooks/wompi",
    ]

    for (const path of publicPaths) {
      const { isAdminPath, isAdminApiPath } = classifyRoute(path)
      expect(isAdminPath, `Falso positivo en ruta pública: ${path}`).toBe(false)
      expect(isAdminApiPath, `Falso positivo en API pública: ${path}`).toBe(false)
    }
  })

  it("garantiza que query parameters como ?bloqueado=si no alteran la protección", () => {
    const url = new URL("https://example.com/admin?bloqueado=si")
    const { isAdminPath } = classifyRoute(url.pathname)
    expect(isAdminPath).toBe(true)
  })
})
