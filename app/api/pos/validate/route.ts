import { NextRequest, NextResponse } from "next/server"
import { validatePosItems } from "@/features/pos/services/posValidateService"
import { assertAdmin } from "@/shared/utils/authGuards"

export async function POST(request: NextRequest) {
  try {
    await assertAdmin()

    const body = await request.json()
    const { items } = body

    const result = await validatePosItems(items || [])

    return NextResponse.json(result)
  } catch (error) {
    const message = (error as Error).message
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 })
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 })
    console.error("POS validate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}