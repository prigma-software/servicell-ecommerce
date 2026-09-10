import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { LicenseProvider } from './LicenseProvider'

let mockPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

describe('LicenseProvider', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = '/'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('renders children and does not check license on public routes', async () => {
    mockPathname = '/products'
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    render(
      <LicenseProvider>
        <div data-testid="public-content">Public Store Content</div>
      </LicenseProvider>
    )

    expect(screen.getByTestId('public-content')).toBeDefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('renders children on admin routes when license is active', async () => {
    mockPathname = '/admin'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blocked: false,
        mensaje: null,
      }),
    })

    render(
      <LicenseProvider>
        <div data-testid="admin-content">Admin Dashboard Content</div>
      </LicenseProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeDefined()
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/licencia/check')
  })

  it('renders LicenseOverlay on admin routes when license is blocked', async () => {
    mockPathname = '/admin/products'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blocked: true,
        mensaje: {
          title: 'PAGO NO REGISTRADO',
          description: 'Tu licencia se encuentra suspendida.',
          status: 'suspended',
        },
      }),
    })

    render(
      <LicenseProvider>
        <div data-testid="admin-content">Admin Products Content</div>
      </LicenseProvider>
    )

    await waitFor(() => {
      expect(screen.queryByTestId('admin-content')).toBeNull()
      expect(screen.getByText('PAGO NO REGISTRADO')).toBeDefined()
    })
  })

  it('does not block public content even if API reported blocked status', async () => {
    // If somehow mounted on public route
    mockPathname = '/cart'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blocked: true,
        mensaje: {
          title: 'LICENCIA INACTIVA',
          description: 'Comunícate con PRIGMA.',
          status: 'cancelled',
        },
      }),
    })

    render(
      <LicenseProvider>
        <div data-testid="cart-content">Cart Content</div>
      </LicenseProvider>
    )

    expect(screen.getByTestId('cart-content')).toBeDefined()
    expect(screen.queryByText('LICENCIA INACTIVA')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
