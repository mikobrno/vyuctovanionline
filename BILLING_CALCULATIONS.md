# Dokumentace výpočtů vyúčtování

Tento dokument popisuje, jak aplikace počítá vyúčtování pro jednotlivé služby podle různých metodik rozúčtování.

## Přehled metodik

| Metodika | Název v UI | Příklad použití |
|----------|-----------|-----------------|
| `OWNERSHIP_SHARE` | Dle vlastnického podílu | Elektřina, Pojištění |
| `AREA` | Dle podlahové plochy (m²) | Topení (alternativa) |
| `PERSON_MONTHS` | Dle počtu osob (osobo-měsíců) | Výtah |
| `METER_READING` | Dle odečtu měřidel | Vodné, TUV, Teplo |
| `FIXED_PER_UNIT` | Dle počtu jednotek (bytů) | Správa |
| `EQUAL_SPLIT` | Rovným dílem | Úklid |
| `NO_BILLING` | Nevyúčtovávat (převod na účet) | Fond oprav |
| `CUSTOM` | Vlastní vzorec | (rezervováno pro budoucnost) |

## Kontrolní panel (jako list "Faktury" v Excelu)

Pro každou službu aplikace zobrazuje:

- **Služba**: Název služby (např. "Vodné a stočné")
- **Metodika rozúčtování**: Vybraný způsob výpočtu
- **Náklad za rok**: Celková částka za službu pro celý dům (z listu "Náklady na dům")
- **Jednotek (dům)**: Celkový počet "dílů", na které se náklad dělí
- **Kč/jedn (dům)**: Vypočítaná cena za jeden "díl"

### Výpočet "Jednotek (dům)" podle metodiky:

| Metodika | Co se sčítá | Příklad |
|----------|-------------|---------|
| OWNERSHIP_SHARE | Součet všech vlastnických podílů | 100 % |
| AREA | Součet všech ploch bytů | 1 543,2 m² |
| PERSON_MONTHS | Součet všech osobo-měsíců | 264 os-měs |
| METER_READING | Součet všech spotřeb z měřidel | 1 441,097 m³ |
| FIXED_PER_UNIT | Počet jednotek (bytů) | 22 bytů |
| EQUAL_SPLIT | Počet jednotek (bytů) | 22 bytů |
| NO_BILLING | 0 (nevyúčtovává se) | 0 |

### Výpočet "Kč/jedn (dům)":

**Kč/jedn = Náklad za rok ÷ Jednotek (dům)**

Příklady:
- Vodné: 167 208 Kč ÷ 1 441,097 m³ = **116,03 Kč/m³**
- Správa: 56 005 Kč ÷ 22 bytů = **2 545,68 Kč/byt**
- Elektřina: 99 606 Kč ÷ 100 % = **996,06 Kč/%**

## Detailní výpočty pro jednotlivé jednotky

### 1. VLASTNICKÝ PODÍL (OWNERSHIP_SHARE)

**Použití**: Elektřina, Pojištění, běžné náklady

**Vzorec**:
```
Náklad jednotky = Náklad za rok × Vlastnický podíl jednotky
```

**Příklad** (Elektřina):
- Náklad za rok: 99 606 Kč
- Jednotek (dům): 100 % (součet všech podílů)
- Kč/jedn: 996,06 Kč/%
- Byt má podíl: 5,366 %

**Výpočet**:
```
99 606 Kč × 0,05366 = 5 344,66 Kč
nebo
996,06 Kč/% × 5,366 % = 5 344,66 Kč
```

### 2. PODLE PODLAHOVÉ PLOCHY (AREA)

**Použití**: Topení (pokud není měřeno)

**Vzorec**:
```
Náklad jednotky = (Náklad za rok ÷ Celková plocha domu) × Plocha bytu
```

**Příklad**:
- Náklad za rok: 153 365 Kč
- Celková plocha domu: 1 543,2 m²
- Kč/jedn: 99,41 Kč/m²
- Byt má plochu: 45,5 m²

**Výpočet**:
```
(153 365 Kč ÷ 1 543,2 m²) × 45,5 m² = 4 523,16 Kč
```

### 3. OSOBO-MĚSÍCE (PERSON_MONTHS)

**Použití**: Výtah, úklid (pokud podle počtu osob)

**Vzorec**:
```
Náklad jednotky = (Náklad za rok ÷ Celkem osobo-měsíců) × Osobo-měsíce bytu
```

**Příklad**:
- Náklad za rok: 24 000 Kč
- Celkem osobo-měsíců v domě: 264 os-měs
- Kč/jedn: 90,91 Kč/os-měs
- V bytě žili: 2 osoby po celý rok = 24 os-měs

**Výpočet**:
```
(24 000 Kč ÷ 264 os-měs) × 24 os-měs = 2 181,82 Kč
```

### 4. PODLE MĚŘIDEL (METER_READING)

**Použití**: Vodné a stočné (SV), Ohřev TUV, Teplo

**Vzorec**:
```
Náklad jednotky = (Náklad za rok ÷ Celková spotřeba domu) × Spotřeba bytu
```

**Příklad** (Vodné a stočné):
- Náklad za rok: 167 208 Kč
- Celková spotřeba domu (SV): 1 441,097 m³
- Kč/jedn: 116,03 Kč/m³
- Byt spotřeboval: 24,1 m³

**Výpočet**:
```
(167 208 Kč ÷ 1 441,097 m³) × 24,1 m³ = 2 796,32 Kč
nebo
116,03 Kč/m³ × 24,1 m³ = 2 796,32 Kč
```

### 5. FIXNÍ ČÁSTKA NA BYT (FIXED_PER_UNIT)

**Použití**: Správa, poplatky za byt

**Vzorec**:
```
Náklad jednotky = Náklad za rok ÷ Počet bytů
```

**Příklad** (Správa):
- Náklad za rok: 56 005 Kč
- Počet bytů: 22
- Kč/jedn: 2 545,68 Kč/byt

**Výpočet**:
```
56 005 Kč ÷ 22 bytů = 2 545,68 Kč
```

**Poznámka**: Každý byt platí **stejnou částku** bez ohledu na velikost nebo podíl.

### 6. ROVNÝM DÍLEM (EQUAL_SPLIT)

**Použití**: Úklid, některé společné náklady

**Vzorec**:
```
Náklad jednotky = Náklad za rok ÷ Počet bytů
```

**Příklad** (Úklid):
- Náklad za rok: 56 460 Kč
- Počet bytů: 22
- Kč/jedn: 2 566,36 Kč/byt

**Výpočet**:
```
56 460 Kč ÷ 22 bytů = 2 566,36 Kč
```

**Poznámka**: Stejné jako FIXED_PER_UNIT, ale používá se pro běžné náklady místo fixních poplatků.

### 7. NEVYÚČTOVÁVAT (NO_BILLING)

**Použití**: Fond oprav, rezervní fond

**Vzorec**:
```
Náklad jednotky = 0 Kč
```

**Vysvětlení**:
Tato položka se **nepřenáší do vyúčtování**. Peníze jdou přímo na vyhrazený účet (fond oprav) a nezapočítávají se do přeplatku/nedoplatku jednotky.

Ve vyúčtování se zobrazí pouze jako informace o platbách do fondu, ale **neporovnává se s náklady**.

### 8. VLASTNÍ VZOREC (CUSTOM)

**Použití**: Speciální případy (rezervováno pro budoucnost)

**Stav**: Zatím není implementováno. Bude umožňovat zadat vlastní matematický vzorec.

## Celkové vyúčtování jednotky

**Vzorec**:
```
Celkový náklad = Σ (Náklady všech služeb)
Uhrazeno = Σ (Zálohy zaplacené během roku)
Výsledek = Uhrazeno - Celkový náklad
```

**Interpretace výsledku**:
- **Kladné číslo** (např. +1 500 Kč) = **PŘEPLATEK** → Vrátit vlastníkovi
- **Záporné číslo** (např. -800 Kč) = **NEDOPLATEK** → Vlastník musí doplatit
- **Nula** (0 Kč) = Ideální stav, vše vyrovnáno

## Příklad kompletního vyúčtování jednotky 101

| Služba | Metodika | Náklad jednotky |
|--------|----------|-----------------|
| Fond oprav | NO_BILLING | 0,00 Kč |
| Správa | FIXED_PER_UNIT | 2 545,68 Kč |
| Vodné a stočné | METER_READING | 2 796,32 Kč |
| Ohřev TUV | METER_READING | 1 453,20 Kč |
| Teplo | METER_READING | 8 234,56 Kč |
| Elektřina | OWNERSHIP_SHARE | 5 344,66 Kč |
| Pojištění | OWNERSHIP_SHARE | 2 156,34 Kč |
| Úklid | EQUAL_SPLIT | 2 566,36 Kč |

**Celkový náklad**: 25 097,12 Kč
**Uhrazeno (zálohy)**: 26 500,00 Kč
**Výsledek**: **+1 402,88 Kč** (přeplatek - vrátit vlastníkovi)

---

## Technická implementace

### Databázový model

```prisma
enum CalculationMethod {
  OWNERSHIP_SHARE  // Podle vlastnického podílu
  AREA             // Podle podlahové plochy
  PERSON_MONTHS    // Podle počtu osob (osobo-měsíců)
  METER_READING    // Podle odečtu měřidel
  FIXED_PER_UNIT   // Fixní částka na byt (dle počtu jednotek)
  EQUAL_SPLIT      // Rovným dílem
  NO_BILLING       // Nevyúčtovávat (např. Fond oprav)
  CUSTOM           // Vlastní vzorec
}

model Service {
  id                    String             @id @default(cuid())
  name                  String
  code                  String?
  methodology           CalculationMethod
  measurementUnit       String?            // např. "m³", "kWh"
  fixedAmountPerUnit    Float?             // pro FIXED_PER_UNIT
  advancePaymentColumn  String?            // odkaz na sloupec v předpisu záloh
  showOnStatement       Boolean            @default(true)
  // ...
}
```

### Kalkulační engine

Třída `BillingCalculator` v `lib/billing-calculator.ts` obsahuje veškerou logiku výpočtů.

Hlavní metody:
- `calculate()` - Spustí kompletní výpočet vyúčtování
- `calculateServiceForUnit()` - Vypočítá náklad jednotky na konkrétní službu
- `calculateBuildingUnits()` - Vypočítá celkový počet jednotek (dům)

---

**Poslední aktualizace**: 16. listopadu 2024
**Verze**: 1.0
