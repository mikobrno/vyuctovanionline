# Analýza chybějících dat pro kompletní vyúčtování

## Porovnání s PDF vzorem

### ✅ Co již máme implementováno:

1. **Základní informace**
   - Název a adresa budovy ✓
   - Číslo jednotky ✓
   - Variabilní symbol ✓
   - Období vyúčtování ✓

2. **Služby a náklady**
   - Seznam služeb s názvy a kódy ✓
   - Celkové náklady na službu pro dům ✓
   - Náklad jednotky na službu ✓
   - Výpočetní vzorec ✓

3. **Zálohy**
   - Měsíční zálohy na jednotku ✓ (AdvancePaymentRecord)
   - Roční souhrn záloh ✓

4. **Vlastník**
   - Jméno vlastníka ✓
   - Email ✓
   - Telefon ✓

---

## ❌ Co nám CHYBÍ v databázi:

### 1. **Fond oprav**
**Status:** Částečně implementováno
- ✅ Pole `repairFund` přidáno do `BillingResult`
- ❌ Není nikde zadáváno uživatelem
- ❌ Není zahrnuto do výpočtu

**Řešení:**
- Přidat pole `repairFundPercentage` nebo `repairFundAmount` do `Service` modelu
- Umožnit konfiguraci v UI (služba "Fond oprav")
- Zahrnout do billingEngine.ts

### 2. **Detailní stavy měřidel**
**Status:** Chybí v zobrazení
- ✅ Máme `MeterReading` s hodnotou a datem
- ❌ Nezobrazujeme "počáteční stav" a "konečný stav" jako v PDF
- ❌ Není jasné, které čtení je za období 2024

**Řešení:**
- Při generování vyúčtování najít čtení k 1.1.{period} a 31.12.{period}
- Uložit do `BillingServiceCost`:
  ```typescript
  meterReadingStart?: number  // Počáteční stav
  meterReadingEnd?: number    // Konečný stav
  meterReadingStartDate?: Date
  meterReadingEndDate?: Date
  ```

### 3. **Adresa vlastníka pro doručení**
**Status:** Neúplné
- ✅ Máme pole `Owner.address`
- ❌ V PDF je "adresa společenství: Knížky Čechů..."
- ❌ Není zřejmé, kam se má doručovat

**Řešení:**
- Pole už existuje, jen potřebujeme ho vyplnit při importu
- Zobrazit v BillingStatement.tsx

### 4. **Přehled úhrad v PDF má navíc:**
- ❌ Tabulku "Přehled úhrad za rok 2024" (12 měsíců + souhrn)
- ❌ Tabulku "Přehled k úhradě od roku" (roční přehled)

**Status:** Máme data, chybí zobrazení
- ✅ `AdvancePaymentRecord` obsahuje měsíční zálohy
- ❌ Nezobrazujeme je v přehledové tabulce

**Řešení:**
- Přidat sekci do `BillingStatement.tsx` s měsíční tabulkou
- Načíst všechny záznamy pro rok z `AdvancePaymentRecord`

### 5. **Tabulka "Měřené služby"**
**Status:** Částečně implementováno
- ✅ Máme `Meter` a `MeterReading`
- ❌ Nezobrazujeme detailní tabulku jako v PDF:
  - Služba | Období | Měřidlo | Poč.stav | Kon.stav | Spotřeba

**Řešení:**
- Přidat sekci do `BillingStatement.tsx`
- Zobrazit měřidla použitá pro výpočet

### 6. **Sloupce v tabulce služeb:**

#### ✅ Implementované:
- Položka (název služby)
- Náklad (celkem pro dům)
- Náklad (připadá jednotce)
- Úhrada (zálohy)
- Přeplatek/nedoplatek

#### ❌ Chybí podrobnosti:
- **Jednotka** - "na byt", "vlastnický podíl 100", "odečet SV" atd.
  - Řešení: Uložit do `BillingServiceCost.distributionBase`
  
- **Jednotek** - celková spotřeba domu (např. 1441,10 m³)
  - Řešení: ✅ Máme jako `buildingConsumption`
  
- **Kč/jedn** - cena za jednotku (např. 22,00 Kč/m³)
  - Řešení: ✅ Máme jako `unitPricePerUnit`
  
- **Jednotek připadá** - kolik připadá na jednotku (např. 25,156)
  - Řešení: ✅ Máme jako `unitAssignedUnits`

---

## 🔧 Potřebné úpravy v billingEngine.ts:

```typescript
// Přidat do BillingServiceCost při ukládání:
{
  // ... existing fields
  unitAdvance: advanceForService,           // ✅ TODO
  unitBalance: unitCost - advanceForService, // ✅ TODO
  unitPricePerUnit: totalCost / totalConsumption, // ✅ TODO
  unitAssignedUnits: calculationResult.consumption || calculationResult.value, // ✅ TODO
  distributionBase: getDistributionBaseName(service), // ✅ TODO
}
```

---

## 📋 Sumář - Co implementovat:

### Priorita 1 - Kritické (pro správné vyúčtování):
1. ✅ Přidat pole do `BillingServiceCost` (HOTOVO - migrace proběhla)
2. ❌ Upravit `billingEngine.ts` - vypočítat a uložit detaily
3. ❌ Přidat podporu pro "Fond oprav" jako speciální službu

### Priorita 2 - Zobrazení (pro hezké PDF):
4. ❌ Vylepšit `BillingStatement.tsx` - přidat všechny sloupce
5. ❌ Přidat sekci "Přehled úhrad za rok" do BillingStatement
6. ❌ Přidat sekci "Měřené služby" s detaily odečtů

### Priorita 3 - Doplňkové (nice-to-have):
7. ❌ Generování PDF na serveru (knihovna @react-pdf/renderer)
8. ❌ Odesílání e-mailů s PDF přílohou
9. ❌ Historie vyúčtování - verzování

---

## 📊 Data z Excelu, která máme vs. potřebujeme:

### ✅ Máme v DB:
- Jednotky, vlastníci, služby ✓
- Faktury (costs) s částkami ✓
- Měsíční zálohy (AdvancePaymentRecord) ✓
- Odečty měřidel (MeterReading) ✓
- Osobo-měsíce (PersonMonth) ✓

### ❌ Nemáme/není doimplementováno:
- **Fond oprav** - potřebujeme částku/procento
- **Jednotková cena služby** - potřebujeme ji vypočítat a uložit
- **Základ pro rozúčtování** - potřebujeme textový popis (např. "vlastnický podíl 100")
- **Počáteční/koncový stav měřidel** - máme čtení, ale nepárujeme je k období

---

## 🎯 Doporučený postup:

1. **Krok 1:** Upravit `billingEngine.ts` - dopočítat všechny detaily
2. **Krok 2:** Otestovat generování s testovacími daty
3. **Krok 3:** Vylepšit `BillingStatement.tsx` - přidat chybějící sekce
4. **Krok 4:** Přidat konfiguraci fondu oprav do UI
5. **Krok 5:** Implementovat PDF export
6. **Krok 6:** Implementovat e-mailovou distribuci

---

Chceš, abych pokračoval s implementací těchto úprav?
