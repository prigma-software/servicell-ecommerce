import { createClient } from "@/lib/supabase/server"
import { sanitizeSearchTerm } from "@/shared/utils/security"

type Category = {
  id: number
  name: string
}

type Variant = {
  id: number
  product_id: number
  sku_code: string
  price_override: number | null
  stock: number
  active: boolean
}

export type ProductWithCategoryAndVariants = {
  id: number
  name: string
  description: string | null
  price: number
  stock: number
  image_url: string | null
  active: boolean
  category_id: number | null
  category: Category | null
  variants: Variant[]
}

export async function getProductsForPOS(
  search?: string,
  categoryId?: string
): Promise<ProductWithCategoryAndVariants[]> {
  const supabase = await createClient()

  let query = supabase
    .from("products")
    .select("id, name, description, price, stock, image_url, active, category_id")
    .eq("active", true)
    .eq("archived", false)

  const sanitized = sanitizeSearchTerm(search)
  if (sanitized !== "") {
    query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId)
  }

  const { data: products, error } = await query.order("name").limit(50)

  if (error) throw new Error(error.message)
  if (!products || products.length === 0) return []

  const productIds = products.map((p) => p.id)

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")

  const categoryMap = new Map<number, Category>(
    categories?.map((c) => [c.id, c]) || []
  )

  const { data: allVariants } = await supabase
    .from("product_skus")
    .select("id, product_id, sku_code, price_override, stock, active")
    .in("product_id", productIds)
    .eq("active", true)

  const variantsMap = new Map<number, Variant[]>()
  allVariants?.forEach((v) => {
    if (!variantsMap.has(v.product_id)) {
      variantsMap.set(v.product_id, [])
    }
    variantsMap.get(v.product_id)!.push(v)
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    image_url: p.image_url,
    active: p.active,
    category_id: p.category_id,
    category: p.category_id ? categoryMap.get(p.category_id) || null : null,
    variants: variantsMap.get(p.id) || [],
  }))
}