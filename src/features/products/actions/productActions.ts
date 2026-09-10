"use server"

import { revalidatePath } from "next/cache"
import { assertAdmin } from "@/shared/utils/authGuards"
import {
  getProductOptions as svcGetProductOptions,
  getProductVariants as svcGetProductVariants,
  getProductImages as svcGetProductImages,
  getVariantImagesByProductId as svcGetVariantImagesByProductId,
  createProduct as svcCreateProduct,
  updateProduct as svcUpdateProduct,
  updateVariant as svcUpdateVariant,
  toggleProductActive as svcToggleProductActive,
  replaceVariantImages as svcReplaceVariantImages,
  deleteVariantImage as svcDeleteVariantImage,
  archiveProduct as svcArchiveProduct,
  unarchiveProduct as svcUnarchiveProduct,
  archiveVariant as svcArchiveVariant,
  unarchiveVariant as svcUnarchiveVariant,
  deleteProduct as svcDeleteProduct,
  deleteVariant as svcDeleteVariant,
  hasSales as svcHasSales,
  hasVariantSales as svcHasVariantSales,
} from "@/features/products/services/productService"

// ============================================
// READ
// ============================================

export const getProductOptions = svcGetProductOptions
export const getProductVariants = svcGetProductVariants
export const getProductImages = svcGetProductImages
export const getVariantImagesByProductId = svcGetVariantImagesByProductId
export const hasSales = svcHasSales
export const hasVariantSales = svcHasVariantSales


// ============================================
// CREATE & UPDATE
// ============================================

export async function createProduct(formData: FormData) {
  await assertAdmin()
  const result = await svcCreateProduct(formData)
  revalidatePath("/admin/products")
  return result
}

export async function updateProduct(formData: FormData) {
  await assertAdmin()
  await svcUpdateProduct(formData)
  revalidatePath("/admin/products")
}

export async function updateVariant(
  variantId: string,
  updates: { stock?: number; price_override?: number | null; active?: boolean }
) {
  await assertAdmin()
  await svcUpdateVariant(variantId, updates)
  revalidatePath("/admin/products")
}

export async function toggleProductActive(productId: string, active: boolean) {
  await assertAdmin()
  await svcToggleProductActive(productId, active)
  revalidatePath("/admin/products")
}

export async function replaceVariantImages(variantId: string, formData: FormData) {
  await assertAdmin()
  await svcReplaceVariantImages(variantId, formData)
  revalidatePath("/admin/products")
}

export async function deleteVariantImage(imageId: string, url: string) {
  await assertAdmin()
  await svcDeleteVariantImage(imageId, url)
  revalidatePath("/admin/products")
}

// ============================================
// ARCHIVE
// ============================================

export async function archiveProduct(id: string) {
  await assertAdmin()
  await svcArchiveProduct(id)
  revalidatePath("/admin/products")
}

export async function unarchiveProduct(id: string) {
  await assertAdmin()
  await svcUnarchiveProduct(id)
  revalidatePath("/admin/products")
}

export async function archiveVariant(id: string) {
  await assertAdmin()
  await svcArchiveVariant(id)
  revalidatePath("/admin/products")
}

export async function unarchiveVariant(id: string) {
  await assertAdmin()
  await svcUnarchiveVariant(id)
  revalidatePath("/admin/products")
}

// ============================================
// DELETE
// ============================================

export async function deleteProduct(
  id: string,
  forceArchive?: boolean
): Promise<{ success: boolean; archived?: boolean }> {
  await assertAdmin()
  const result = await svcDeleteProduct(id, forceArchive)
  if (result.success) revalidatePath("/admin/products")
  return result
}

export async function deleteVariant(
  id: string
): Promise<{ success: boolean; archived?: boolean }> {
  await assertAdmin()
  const result = await svcDeleteVariant(id)
  if (result.success) revalidatePath("/admin/products")
  return result
}
