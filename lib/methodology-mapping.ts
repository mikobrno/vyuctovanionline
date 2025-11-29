/**
 * Mapování českých názvů způsobů rozúčtování na systémové metody
 */

export type CalculationMethodType = 
  | 'OWNERSHIP_SHARE'
  | 'AREA'
  | 'PERSON_MONTHS'
  | 'METER_READING'
  | 'EQUAL_SPLIT'
  | 'FIXED_PER_UNIT'
  | 'UNIT_PARAMETER'
  | 'CUSTOM'
  | 'NO_BILLING'

// Přesné mapování českých názvů na systémové metody
const exactMethodologyMap: Record<string, CalculationMethodType> = {
  // Vlastnický podíl
  'vlastnický podíl': 'OWNERSHIP_SHARE',
  'podíl bytové jednotky': 'OWNERSHIP_SHARE',
  'podíl garážové jednotky': 'OWNERSHIP_SHARE',
  
  // Plocha
  'm2 celkové plochy': 'AREA',
  'm2 plochy jednotky': 'AREA',
  'm2 plochy tuv': 'AREA',
  'm2 pp': 'AREA',
  'plocha m2': 'AREA',
  'započitatelná plocha': 'AREA',
  'podílem vytápěné plochy': 'AREA',
  'podílem ploch všech jednotek - domky': 'AREA',
  'podílem podlahových ploch všech jednotek': 'AREA',
  'podílem ploch všech jednotek': 'AREA',
  'poměr podlahových ploch': 'AREA',
  'gj, plocha m2': 'AREA',
  
  // Osoby
  'počet osob': 'PERSON_MONTHS',
  'počet osob výtah': 'PERSON_MONTHS',
  'výtah osob': 'PERSON_MONTHS',
  
  // Měřidla / Odečty
  'měřidlo': 'METER_READING',
  'odečty tuv': 'METER_READING',
  'odečet sv': 'METER_READING',
  'odečet elektroměr': 'METER_READING',
  'externí': 'METER_READING',
  'náměr m3': 'METER_READING',
  'gj, náměr m3': 'METER_READING',
  
  // Fixní na jednotku
  'na byt': 'FIXED_PER_UNIT',
  'jednotka': 'FIXED_PER_UNIT',
  'náklady jednotka': 'FIXED_PER_UNIT',
  'objekt': 'FIXED_PER_UNIT',
  
  // Rovným dílem
  'rovným dílem': 'EQUAL_SPLIT',
  'rovným dílem 1/22': 'EQUAL_SPLIT',
  
  // Parametry / speciální
  'komín': 'UNIT_PARAMETER',
  'počet kusů': 'UNIT_PARAMETER',
  'počet jízd autovýtahem': 'UNIT_PARAMETER',
  'počet garážových míst': 'UNIT_PARAMETER',
  'počet prostorů': 'UNIT_PARAMETER',
  
  // Speciální případy
  'uživatel': 'CUSTOM',
  'vyúčtovatel': 'CUSTOM',
  'odměny funkcionářů': 'CUSTOM',
  
  // Nevyúčtovává se
  'nevyúčtovává se': 'NO_BILLING',
  'prázdné': 'NO_BILLING',
}

/**
 * Mapuje český název způsobu rozúčtování na systémovou metodu
 */
export function mapMethodologyToSystem(methodology: string): CalculationMethodType {
  if (!methodology) return 'OWNERSHIP_SHARE'
  
  const m = methodology.toLowerCase().trim()
  
  // 1. Přesná shoda
  if (exactMethodologyMap[m]) {
    return exactMethodologyMap[m]
  }
  
  // 2. Částečná shoda (fallback)
  if (m.includes('měřidl') || m.includes('odečet') || m.includes('odečty') || m.includes('extern') || m.includes('náměr')) {
    return 'METER_READING'
  }
  if (m.includes('plocha') || m.includes('výměr') || m.includes('vyměr') || m.includes('m2') || m.includes('podílem') && m.includes('ploch')) {
    return 'AREA'
  }
  if (m.includes('osob') || m.includes('osobo') || m.includes('výtah') && m.includes('osob')) {
    return 'PERSON_MONTHS'
  }
  if (m.includes('byt') || m.includes('jednotk') || m.includes('objekt')) {
    return 'FIXED_PER_UNIT'
  }
  if (m.includes('rovn')) {
    return 'EQUAL_SPLIT'
  }
  if (m.includes('podíl') || m.includes('podil')) {
    return 'OWNERSHIP_SHARE'
  }
  if (m.includes('komín') || m.includes('kusů') || m.includes('jízd') || m.includes('garáž') || m.includes('prostor')) {
    return 'UNIT_PARAMETER'
  }
  if (m.includes('nevyúčt') || m.includes('prázdn')) {
    return 'NO_BILLING'
  }
  
  // 3. Výchozí hodnota
  return 'OWNERSHIP_SHARE'
}

/**
 * Vrací český popis pro systémovou metodu
 */
export function getMethodologyLabel(method: CalculationMethodType): string {
  const labels: Record<CalculationMethodType, string> = {
    'OWNERSHIP_SHARE': 'vlastnický podíl',
    'AREA': 'plocha m²',
    'PERSON_MONTHS': 'počet osob',
    'METER_READING': 'měřidlo',
    'EQUAL_SPLIT': 'rovným dílem',
    'FIXED_PER_UNIT': 'na byt',
    'UNIT_PARAMETER': 'parametr',
    'CUSTOM': 'vlastní vzorec',
    'NO_BILLING': 'nevyúčtovává se',
  }
  return labels[method] || method
}

/**
 * Vrací datový zdroj pro danou metodu
 */
export function getDataSourceForMethod(method: CalculationMethodType): {
  dataSourceType: string | null
  unitAttributeName: string | null
  measurementUnit: string | null
} {
  switch (method) {
    case 'METER_READING':
      return { dataSourceType: 'METER_DATA', unitAttributeName: null, measurementUnit: null }
    case 'AREA':
      return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'CELKOVA_VYMERA', measurementUnit: 'm²' }
    case 'PERSON_MONTHS':
      return { dataSourceType: 'PERSON_MONTHS', unitAttributeName: null, measurementUnit: 'osobo-měsíc' }
    case 'FIXED_PER_UNIT':
      return { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: null }
    case 'EQUAL_SPLIT':
      return { dataSourceType: 'UNIT_COUNT', unitAttributeName: null, measurementUnit: null }
    case 'OWNERSHIP_SHARE':
      return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'VLASTNICKY_PODIL', measurementUnit: null }
    case 'UNIT_PARAMETER':
      return { dataSourceType: 'UNIT_ATTRIBUTE', unitAttributeName: 'komin', measurementUnit: 'ks' }
    default:
      return { dataSourceType: null, unitAttributeName: null, measurementUnit: null }
  }
}
