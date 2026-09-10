import { describe, it, expect } from "vitest"

describe("Tracking Metadata Sanitization", () => {
  const SENSITIVE_METADATA_KEYS = new Set([
    "password",
    "contraseña",
    "pin",
    "clave",
    "pass",
    "secret",
    "token",
  ])

  function filterMetadata(metadata: Record<string, any>) {
    return Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_METADATA_KEYS.has(key.toLowerCase().trim()))
      .reduce((acc, [key, val]) => {
        acc[key] = val
        return acc
      }, {} as Record<string, any>)
  }

  it("elimina llaves sensibles de contraseñas y pines", () => {
    const rawMetadata = {
      device_model: "iPhone 13 Pro",
      issue_description: "Pantalla rota",
      password: "SuperSecretPassword123",
      contraseña: "claveSecreta456",
      pin: "1234",
      clave: "9876",
      token: "xyz-abc",
      color: "Azul Sierra",
    }

    const filtered = filterMetadata(rawMetadata)

    expect(filtered).toHaveProperty("device_model", "iPhone 13 Pro")
    expect(filtered).toHaveProperty("issue_description", "Pantalla rota")
    expect(filtered).toHaveProperty("color", "Azul Sierra")

    expect(filtered).not.toHaveProperty("password")
    expect(filtered).not.toHaveProperty("contraseña")
    expect(filtered).not.toHaveProperty("pin")
    expect(filtered).not.toHaveProperty("clave")
    expect(filtered).not.toHaveProperty("token")
  })

  it("elimina llaves sensibles independientemente de mayúsculas/minúsculas y espacios", () => {
    const rawMetadata = {
      " PASSWORD ": "secret1",
      "Contraseña": "secret2",
      " PIN": "9999",
      legitimate_field: "ok",
    }

    const filtered = filterMetadata(rawMetadata)

    expect(Object.keys(filtered)).toEqual(["legitimate_field"])
  })
})
