import { NextRequest, NextResponse } from "next/server"
import { getProductsForPOS } from "@/features/pos/services/posProductService"
import { assertAdmin } from "@/shared/utils/authGuards"

export async function GET(request: NextRequest) {
  try {
    await assertAdmin()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const categoryId = searchParams.get("category_id") || ""

    const products = await getProductsForPOS(search, categoryId)

    return NextResponse.json({ products })
  } catch (error) {
    const message = (error as Error).message
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 })
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 })
    console.error("POS products error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}