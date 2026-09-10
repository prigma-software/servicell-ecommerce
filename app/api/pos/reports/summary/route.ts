import { NextRequest, NextResponse } from "next/server"
import { getReportsSummary } from "@/features/pos/services/posSaleService"
import { assertAdmin } from "@/shared/utils/authGuards"

export async function GET(request: NextRequest) {
  try {
    const admin = await assertAdmin()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const summary = await getReportsSummary(admin.id, from, to)

    return NextResponse.json(summary)
  } catch (error) {
    const message = (error as Error).message
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 })
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 })
    console.error("POS summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}