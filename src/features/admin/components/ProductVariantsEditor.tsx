"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Plus, ChevronDown, ChevronUp } from "lucide-react"
import { replaceVariantImages, deleteVariantImage } from "@/features/products/actions/productActions"
import { getVariantImagesByProductId } from "@/features/products/actions/productActions"
import { AlertDialog, ConfirmDialog } from "@/components/ui/modal"
import { VariantOptionEditor } from "@/features/admin/components/VariantOptionEditor"
import { VariantRow } from "@/features/admin/components/VariantRow"
import { useVariantActions } from "@/hooks/useVariantActions"
import { generateCartesianVariants } from "@/lib/utils/variantGenerator"
import type { OptionDef, VariantImage } from "@/features/products/types/product.types"

type ProductVariantsEditorProps = {
  initialOptions?: { name: string; values: string[] }[]
  initialVariants?: {
    id: string
    sku_code: string
    stock: number
    price_override: number | null
    active: boolean
    option_values: string[]
  }[]
  productId?: string
  hasVariants: boolean
  onHasVariantsChange: (value: boolean) => void
}

export default function ProductVariantsEditor({
  initialOptions = [],
  initialVariants = [],
  productId,
  hasVariants,
  onHasVariantsChange,
}: ProductVariantsEditorProps) {
  const [options, setOptions] = useState<OptionDef[]>(initialOptions)
  const [variantsExpanded, setVariantsExpanded] = useState(true)
  const [openVariantMenu, setOpenVariantMenu] = useState<string | null>(null)

  const [variantData, setVariantData] = useState<
    Record<string, { stock: number; price_override: number | null; active: boolean }>
  >(() => {
    const initial: Record<string, { stock: number; price_override: number | null; active: boolean }> = {}
    initialVariants.forEach((v) => {
      initial[v.id] = {
        stock: v.stock ?? 0,
        price_override: v.price_override ?? null,
        active: v.active ?? true,
      }
    })
    return initial
  })

  const [variantImages, setVariantImages] = useState<Record<string, VariantImage[]>>({})
  const [uploadingVariantId, setUploadingVariantId] = useState<string | null>(null)

  const [alertOpen, setAlertOpen] = useState(false)
  const [alertConfig, setAlertConfig] = useState({ title: "", description: "" })

  const handleAlert = useCallback((title: string, description: string) => {
    setAlertConfig({ title, description })
    setAlertOpen(true)
  }, [])

  const {
    variantsWithSales,
    confirmOpen,
    confirmConfig,
    fetchVariantSales,
    handleVariantAction,
    saveVariant,
    setConfirmOpen,
  } = useVariantActions(handleAlert)

  useEffect(() => {
    const realVariantIds = initialVariants.filter((v) => !v.id.startsWith("temp-")).map((v) => v.id)
    fetchVariantSales(realVariantIds)
  }, [initialVariants, fetchVariantSales])

  useEffect(() => {
    if (initialVariants.length === 0) return
    setVariantData((prev) => {
      const next = { ...prev }
      let hasChanges = false
      initialVariants.forEach((v) => {
        if (
          !next[v.id] ||
          next[v.id].stock !== v.stock ||
          next[v.id].price_override !== v.price_override ||
          next[v.id].active !== v.active
        ) {
          next[v.id] = {
            stock: v.stock ?? 0,
            price_override: v.price_override ?? null,
            active: v.active ?? true,
          }
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })
  }, [initialVariants])

  useEffect(() => {
    if (!productId) return
    const realVariantIds = initialVariants.filter((v) => !v.id.startsWith("temp-")).map((v) => v.id)
    if (realVariantIds.length === 0) return

    getVariantImagesByProductId(productId).then((grouped) => {
      setVariantImages(grouped)
    }).catch((err) => {
      console.error("Error loading variant images:", err)
    })
  }, [productId, initialVariants])

  const variants = useMemo(() => {
    if (!hasVariants || options.length === 0 || options.some((o) => o.values.length === 0)) {
      return []
    }

    const generated = generateCartesianVariants(options)

    return generated.map((g) => {
      const existingVariant = initialVariants.find((v) => v.sku_code === g.sku_code)
      const existingData = existingVariant ? variantData[existingVariant.id] : variantData[`temp-${g.sku_code}`]

      return {
        id: existingVariant?.id || `temp-${g.sku_code}`,
        sku_code: g.sku_code,
        optionValues: g.optionValues,
        stock: existingData?.stock ?? 0,
        price_override: existingData?.price_override ?? null,
        active: existingData?.active ?? true,
      }
    })
  }, [options, hasVariants, variantData, initialVariants])

  const totalVariantStock = useMemo(() => {
    return Object.values(variantData).reduce((sum, v) => sum + (v.active ? v.stock : 0), 0)
  }, [variantData])

  const activeVariantCount = useMemo(() => {
    return Object.values(variantData).filter((v) => v.active).length
  }, [variantData])

  const addOption = () => setOptions([...options, { name: "", values: [] }])
  const removeOption = (index: number) => setOptions(options.filter((_, i) => i !== index))
  const updateOptionName = (index: number, name: string) => {
    setOptions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], name }
      return next
    })
  }
  const addValue = (optIndex: number, value: string) => {
    if (!value.trim()) return
    setOptions((prev) => {
      const next = [...prev]
      if (!next[optIndex].values.includes(value.trim())) {
        next[optIndex] = { ...next[optIndex], values: [...next[optIndex].values, value.trim()] }
      }
      return next
    })
  }
  const removeValue = (optIndex: number, valIndex: number) => {
    setOptions((prev) => {
      const next = [...prev]
      next[optIndex] = { ...next[optIndex], values: next[optIndex].values.filter((_, i) => i !== valIndex) }
      return next
    })
  }

  const updateVariantField = (variantId: string, field: "stock" | "price_override" | "active", value: number | null | boolean) => {
    setVariantData((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: value,
      },
    }))
  }

  const handleVariantImageChange = async (variantId: string, files: FileList | null) => {
    if (!files || files.length === 0 || variantId.startsWith("temp-")) return
    setUploadingVariantId(variantId)
    const formData = new FormData()
    const { optimizeImage } = await import("@/shared/utils/imageOptimizer")
    for (const file of Array.from(files)) {
      try {
        const optimizedBlob = await optimizeImage(file)
        formData.append("images", optimizedBlob, file.name)
      } catch (err) {
        console.warn("Could not optimize image, sending raw", err)
        formData.append("images", file)
      }
    }
    try {
      await replaceVariantImages(variantId, formData)
      if (productId) {
        const grouped = await getVariantImagesByProductId(productId)
        setVariantImages(grouped)
      }
    } catch (err) {
      console.error("Error uploading variant images:", err)
      handleAlert("Error subiendo imagen", String(err))
    } finally {
      setUploadingVariantId(null)
    }
  }

  const handleDeleteVariantImage = async (imageId: string, url: string) => {
    try {
      await deleteVariantImage(imageId, url)
      if (productId) {
        const grouped = await getVariantImagesByProductId(productId)
        setVariantImages(grouped)
      }
    } catch (err) {
      console.error("Error deleting variant image:", err)
      handleAlert("Error", String(err))
    }
  }

  const handleToggleActive = (variantId: string) => {
    const newActive = !variantData[variantId]?.active
    updateVariantField(variantId, "active", newActive)
    if (!variantId.startsWith("temp-")) {
      saveVariant(variantId, { ...variantData[variantId], active: newActive })
    }
  }

  const handleToggle = () => {
    onHasVariantsChange(!hasVariants)
    if (!hasVariants && options.length === 0) {
      setOptions([{ name: "", values: [] }])
    }
  }

  const serializedOptions = JSON.stringify(options)
  const serializedVariants = JSON.stringify(
    variants.map((v) => ({
      id: v.id,
      sku_code: v.sku_code,
      stock: variantData[v.id]?.stock ?? 0,
      price_override: variantData[v.id]?.price_override ?? null,
      active: variantData[v.id]?.active ?? true,
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Variantes</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-muted-foreground">¿Tiene variantes?</span>
          <button
            type="button"
            onClick={handleToggle}
            className={`w-12 h-6 rounded-full transition-colors relative ${hasVariants ? "bg-primary" : "bg-muted"}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-primary-foreground shadow absolute top-0.5 transition-transform ${
                hasVariants ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      {hasVariants && (
        <div className="space-y-4">
          <div className="space-y-3">
            {options.map((opt, oIndex) => (
              <VariantOptionEditor
                key={oIndex}
                index={oIndex}
                name={opt.name}
                values={opt.values}
                onNameChange={updateOptionName}
                onRemove={removeOption}
                onAddValue={addValue}
                onRemoveValue={removeValue}
              />
            ))}

            <button
              type="button"
              onClick={addOption}
              className="w-full h-12 border-2 border-dashed border-input rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar opción
            </button>
          </div>

          {variants.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setVariantsExpanded(!variantsExpanded)}
                className="w-full flex items-center justify-between p-4 bg-muted/50 border-b border-border text-left"
              >
                <span className="text-sm font-medium">
                  {activeVariantCount}/{variants.length} variantes activas — Stock total: {totalVariantStock}
                </span>
                {variantsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {variantsExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left p-3 font-medium text-muted-foreground w-10">Activo</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">SKU</th>
                        {options.map((o) => (
                          <th key={o.name} className="text-left p-3 font-medium text-muted-foreground">
                            {o.name}
                          </th>
                        ))}
                        <th className="text-left p-3 font-medium text-muted-foreground w-24">Precio</th>
                        <th className="text-left p-3 font-medium text-muted-foreground w-24">Stock</th>
                        <th className="text-left p-3 font-medium text-muted-foreground w-28">Fotos</th>
                        <th className="text-left p-3 font-medium text-muted-foreground w-12">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <VariantRow
                          key={v.id}
                          variantId={v.id}
                          skuCode={v.sku_code}
                          isActive={variantData[v.id]?.active ?? true}
                          optionValues={v.optionValues}
                          options={options}
                          priceOverride={variantData[v.id]?.price_override ?? null}
                          stock={variantData[v.id]?.stock ?? 0}
                          images={variantImages[v.id] || []}
                          isUploading={uploadingVariantId === v.id}
                          onToggleActive={() => handleToggleActive(v.id)}
                          onPriceChange={(val) => updateVariantField(v.id, "price_override", val)}
                          onStockChange={(val) => updateVariantField(v.id, "stock", val)}
                          onImageChange={(files) => handleVariantImageChange(v.id, files)}
                          onDeleteImage={handleDeleteVariantImage}
                          onAction={handleVariantAction}
                          openMenuId={openVariantMenu}
                          onMenuToggle={(id) => setOpenVariantMenu(openVariantMenu === id ? null : id)}
                          hasSales={variantsWithSales.has(v.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <input type="hidden" name="has_variants" value={hasVariants ? "true" : "false"} />
      <input type="hidden" name="variant_options" value={serializedOptions} />
      <input type="hidden" name="variant_data" value={serializedVariants} />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        description={confirmConfig.description}
        confirmText={confirmConfig.confirmText}
        cancelText="Cancelar"
        destructive={confirmConfig.destructive}
      />

      <AlertDialog open={alertOpen} onClose={() => setAlertOpen(false)} title={alertConfig.title} description={alertConfig.description} />
    </div>
  )
}
