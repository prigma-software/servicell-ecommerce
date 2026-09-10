import { NextRequest, NextResponse } from "next/server"
import { createCashup, getCashups } from "@/features/pos/services/posSaleService"
import { assertAdmin } from "@/shared/utils/authGuards"

export async function POST(request: NextRequest) {
  try {
    const admin = await assertAdmin()

    const body = await request.json()
    const { declared_amount, notes } = body

    if (declared_amount === undefined) {
      return NextResponse.json({ error: "declared_amount is required" }, { status: 400 })
    }

    const summary = await createCashup(admin.id, declared_amount, notes)

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    const message = (error as Error).message
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 })
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 })
    console.error("Cashup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await assertAdmin()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const cashups = await getCashups(from, to)
    return NextResponse.json({ cashups })
  } catch (error) {
    const message = (error as Error).message
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 })
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 })
    console.error("Cashup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}