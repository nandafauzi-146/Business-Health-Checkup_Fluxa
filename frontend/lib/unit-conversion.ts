/**
 * Unit conversion & Recipe Ratio utility for POS FLUXA
 * Conforms to PRD: Recipe Ratio Calculation, Production Automation, Unit Conversion, and Shared Inventory Integration
 */

export type StandardUnit = 'g' | 'kg' | 'ml' | 'l' | 'porsi' | 'pcs'

export interface UnitInfo {
  dimension: 'weight' | 'volume' | 'count' | 'other'
  baseUnit: 'g' | 'ml' | 'pcs' | string
  multiplierToBase: number
}

const UNIT_MAP: Record<string, UnitInfo> = {
  // Weight units (base: g)
  g: { dimension: 'weight', baseUnit: 'g', multiplierToBase: 1 },
  gram: { dimension: 'weight', baseUnit: 'g', multiplierToBase: 1 },
  gr: { dimension: 'weight', baseUnit: 'g', multiplierToBase: 1 },
  kg: { dimension: 'weight', baseUnit: 'g', multiplierToBase: 1000 },
  kilogram: { dimension: 'weight', baseUnit: 'g', multiplierToBase: 1000 },

  // Volume units (base: ml)
  ml: { dimension: 'volume', baseUnit: 'ml', multiplierToBase: 1 },
  mililiter: { dimension: 'volume', baseUnit: 'ml', multiplierToBase: 1 },
  milliliter: { dimension: 'volume', baseUnit: 'ml', multiplierToBase: 1 },
  l: { dimension: 'volume', baseUnit: 'ml', multiplierToBase: 1000 },
  liter: { dimension: 'volume', baseUnit: 'ml', multiplierToBase: 1000 },
  ltr: { dimension: 'volume', baseUnit: 'ml', multiplierToBase: 1000 },

  // Count / sales units
  porsi: { dimension: 'count', baseUnit: 'porsi', multiplierToBase: 1 },
  pcs: { dimension: 'count', baseUnit: 'pcs', multiplierToBase: 1 },
  buah: { dimension: 'count', baseUnit: 'pcs', multiplierToBase: 1 },
  biji: { dimension: 'count', baseUnit: 'pcs', multiplierToBase: 1 },
  cup: { dimension: 'count', baseUnit: 'pcs', multiplierToBase: 1 },
  pax: { dimension: 'count', baseUnit: 'pcs', multiplierToBase: 1 },
}

export function normalizeUnitString(unit: string): string {
  const clean = (unit || '').toLowerCase().trim()
  if (clean === 'gram' || clean === 'gr') return 'g'
  if (clean === 'kilogram') return 'kg'
  if (clean === 'mililiter' || clean === 'milliliter') return 'ml'
  if (clean === 'liter' || clean === 'ltr') return 'l'
  return clean || 'g'
}

export function getUnitInfo(unit: string): UnitInfo {
  const clean = (unit || '').toLowerCase().trim()
  return (
    UNIT_MAP[clean] || {
      dimension: 'other',
      baseUnit: clean,
      multiplierToBase: 1,
    }
  )
}

/**
 * Convert quantity from one unit to another.
 * Cross-dimensional conversion (weight <-> volume) uses density (g/ml).
 * @param quantity The quantity to convert
 * @param fromUnit Source unit (e.g. 'kg', 'g', 'ml', 'l')
 * @param toUnit Target unit (e.g. 'g', 'kg', 'ml', 'l')
 * @param density Density in g/ml (default: 1.0)
 * @returns Converted quantity
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  density: number = 1.0,
): number {
  if (quantity === 0) return 0
  const cleanFrom = (fromUnit || '').toLowerCase().trim()
  const cleanTo = (toUnit || '').toLowerCase().trim()

  if (cleanFrom === cleanTo) return quantity

  const fromInfo = getUnitInfo(cleanFrom)
  const toInfo = getUnitInfo(cleanTo)

  const d = density && density > 0 ? density : 1.0

  // If dimensions match:
  if (fromInfo.dimension === toInfo.dimension) {
    const inBase = quantity * fromInfo.multiplierToBase
    return inBase / toInfo.multiplierToBase
  }

  // Cross-dimensional: Weight (g) <-> Volume (ml)
  if (fromInfo.dimension === 'weight' && toInfo.dimension === 'volume') {
    // 1. Convert source to grams
    const inGrams = quantity * fromInfo.multiplierToBase
    // 2. Convert grams to ml: ml = grams / density
    const inMl = inGrams / d
    // 3. Convert ml to target volume unit
    return inMl / toInfo.multiplierToBase
  }

  if (fromInfo.dimension === 'volume' && toInfo.dimension === 'weight') {
    // 1. Convert source to ml
    const inMl = quantity * fromInfo.multiplierToBase
    // 2. Convert ml to grams: grams = ml * density
    const inGrams = inMl * d
    // 3. Convert grams to target weight unit
    return inGrams / toInfo.multiplierToBase
  }

  // Fallback if dimensions cannot be converted directly
  return quantity
}

export interface SubIngredientRatioItem {
  sub_material_id: string
  sub_material_name?: string
  quantity: number
  unit: string
  density: number
  normalizedQuantity: number // in base unit (g for weight, ml for volume converted to g equivalent using density)
  ratio: number // 0 to 1 (fraction of total recipe composition)
  percentage: number // 0 to 100%
}

/**
 * Calculates recipe ingredient ratios based on PRD Section 2:
 * Total ingredient composition is used as a reference for calculating ingredient ratios.
 * Ingredient Ratio = Ingredient Quantity / Total Ingredient Composition.
 * Cross-dimensional ingredients (e.g. grams of egg + liters of oil) are normalized using density.
 */
export function calculateRecipeRatios(
  subIngredients: Array<{
    sub_material_id: string
    sub_material_name?: string
    quantity: number
    unit: string
    density?: number
  }>,
): {
  totalCompositionBase: number
  items: SubIngredientRatioItem[]
} {
  if (!subIngredients || subIngredients.length === 0) {
    return { totalCompositionBase: 0, items: [] }
  }

  // 1. Normalize each ingredient into base weight (g equivalent)
  const itemsWithNormalized = subIngredients.map(item => {
    const qty = Number(item.quantity) || 0
    const d = item.density && item.density > 0 ? item.density : 1.0
    const unitInfo = getUnitInfo(item.unit)

    let normalized = qty
    if (unitInfo.dimension === 'weight') {
      normalized = qty * unitInfo.multiplierToBase // in grams
    } else if (unitInfo.dimension === 'volume') {
      const inMl = qty * unitInfo.multiplierToBase
      normalized = inMl * d // converted to grams equivalent using density
    } else {
      normalized = qty
    }

    return {
      sub_material_id: item.sub_material_id,
      sub_material_name: item.sub_material_name,
      quantity: qty,
      unit: item.unit,
      density: d,
      normalizedQuantity: normalized,
      ratio: 0,
      percentage: 0,
    }
  })

  // 2. Sum total composition
  const totalCompositionBase = itemsWithNormalized.reduce(
    (sum, i) => sum + i.normalizedQuantity,
    0,
  )

  // 3. Calculate ratio and percentage
  const items: SubIngredientRatioItem[] = itemsWithNormalized.map(item => {
    const ratio =
      totalCompositionBase > 0 ? item.normalizedQuantity / totalCompositionBase : 0
    return {
      ...item,
      ratio,
      percentage: Math.round(ratio * 10000) / 100, // e.g. 56.25%
    }
  })

  return {
    totalCompositionBase,
    items,
  }
}

/**
 * Shared Inventory & Real-Time Ingredient Requirement calculation for Kasir (PRD Section 5 & 6)
 * Calculates required ingredients across all items in the cart, compares against shared stock balances,
 * and identifies shortages or affected product availability.
 */
export interface CartProductRequirement {
  materialId: string
  materialName: string
  materialType: 'raw' | 'semi_finished'
  unit: string
  availableStock: number
  totalRequired: number
  isShortage: boolean
  shortageAmount: number
  usedByProducts: Array<{
    productId: string
    productName: string
    cartQuantity: number
    requiredAmount: number
  }>
}

export function calculateCartSharedIngredients(
  cart: Array<{ product_id: string; quantity: number }>,
  products: Array<{ id: string; name: string }>,
  productIngredients: Array<{
    product_id: string
    raw_material_id: string
    quantity: number
    unit: string
  }>,
  rawMaterials: Array<{
    id: string
    name: string
    material_type?: 'raw' | 'semi_finished'
    stock: number
    unit: string
    density?: number
  }>,
): {
  hasShortage: boolean
  requirements: CartProductRequirement[]
  shortages: CartProductRequirement[]
} {
  const reqMap = new Map<string, CartProductRequirement>()

  for (const cartItem of cart) {
    if (cartItem.quantity <= 0) continue
    const prod = products.find(p => p.id === cartItem.product_id)
    const prodName = prod?.name || 'Produk'
    const ings = productIngredients.filter(pi => pi.product_id === cartItem.product_id)

    for (const ing of ings) {
      const mat = rawMaterials.find(m => m.id === ing.raw_material_id)
      if (!mat) continue

      // Convert recipe quantity to raw material storage unit
      const convertedQtyPerUnit = convertUnit(
        Number(ing.quantity) || 0,
        ing.unit,
        mat.unit,
        mat.density || 1.0,
      )
      const requiredForCartItem = convertedQtyPerUnit * cartItem.quantity

      if (!reqMap.has(mat.id)) {
        reqMap.set(mat.id, {
          materialId: mat.id,
          materialName: mat.name,
          materialType: mat.material_type || 'raw',
          unit: mat.unit,
          availableStock: mat.stock,
          totalRequired: 0,
          isShortage: false,
          shortageAmount: 0,
          usedByProducts: [],
        })
      }

      const entry = reqMap.get(mat.id)!
      entry.totalRequired += requiredForCartItem
      entry.usedByProducts.push({
        productId: cartItem.product_id,
        productName: prodName,
        cartQuantity: cartItem.quantity,
        requiredAmount: requiredForCartItem,
      })
    }
  }

  const requirements: CartProductRequirement[] = []
  const shortages: CartProductRequirement[] = []

  reqMap.forEach(entry => {
    entry.totalRequired = Math.round(entry.totalRequired * 100) / 100
    entry.isShortage = entry.totalRequired > entry.availableStock
    entry.shortageAmount = entry.isShortage
      ? Math.round((entry.totalRequired - entry.availableStock) * 100) / 100
      : 0

    requirements.push(entry)
    if (entry.isShortage) {
      shortages.push(entry)
    }
  })

  return {
    hasShortage: shortages.length > 0,
    requirements,
    shortages,
  }
}

