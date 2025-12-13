# EXPORT_FULL Import Guide

## Přehled

Tento systém importuje data z "Master Export" souboru `EXPORT_FULL.csv` generovaného Office Scripts v Excelu. Soubor obsahuje kompletní data vyúčtování v denormalizované (ploché) formě, která se následně převádí do strukturovaného formátu pro generování PDF vyúčtování.

## Struktura EXPORT_FULL.csv

### Sloupce

| Sloupec | Popis | Příklad |
|---------|-------|---------|
| `UnitName` | Název jednotky | "Byt 1513/01" |
| `DataType` | Typ řádku | BUILDING_INFO, INFO, COST, METER, PAYMENT_MONTHLY, ADVANCE_MONTHLY, FIXED_PAYMENT |
| `Key` | Název položky | "Studená voda", "Teplo" |
| `Val1-Val13` | Hodnoty (závislé na DataType) | "1 250,50", "64,23" |
| `SourceRow` | Odkaz na Excel řádek (debug) | "Row39" |

### Typy řádků (DataType)

#### 0. BUILDING_INFO - Údaje o budově (SVJ)
```csv
UnitName,DataType,Key,Val1,Val2,Val3,...
"__BUILDING__",BUILDING_INFO,BuildingBankAccount,"224623004/0300","Kníničky 318, Brno","SVJ Kníničky 318",...
```

**Mapování:**
- `Val1` → Bankovní účet budovy / SVJ
- `Val2` → Adresa budovy
- `Val3` → Název / popis budovy
- Řádek se vyskytuje nejvýše jednou a slouží k aktualizaci bankovního spojení a adresy v DB

#### 1. INFO - Základní údaje jednotky
```csv
UnitName,DataType,Key,Val1,Val2,Val3,Val4,Val5,...
"Byt 1513/01",INFO,Detail,"Jan Novák","1513001","jan@email.cz","-15486,00","CZ1234...",...
```

**Mapování:**
- `Val1` → Jméno vlastníka
- `Val2` → Variabilní symbol
- `Val3` → Email
- `Val4` → Celkový výsledek (přeplatek/nedoplatek)
- `Val5` → Bankovní účet

#### 2. COST - Náklady služby
```csv
UnitName,DataType,Key,Val1,Val2,Val3,Val4,Val5,Val6,Val7,Val8,Val9,...
"Byt 1513/01",COST,"Studená voda","3083,04","3083,04","840,00","2243,04","m³","320,00","66,94","48","9,63%",...
```

**Mapování:**
- `Key` → Název služby
- `Val1` → Náklad domu (Kč)
- `Val2` → Náklad bytu (Kč)
- `Val3` → Záloha bytu (Kč)
- `Val4` → Výsledek (Kč)
- `Val5` → Jednotka (m², m³, os, GJ)
- `Val6` → Počet jednotek dům
- `Val7` → Cena za jednotku (Kč/m²)
- `Val8` → Spotřeba bytu
- `Val9` → Metodika / Podíl

#### 3. METER - Odečty měřidel
```csv
UnitName,DataType,Key,Val1,Val2,Val3,Val4,...
"Byt 1513/01",METER,"Studená voda","123456","10","58","48",...
```

**Mapování:**
- `Key` → Název služby (pro propojení)
- `Val1` → Výrobní číslo měřidla
- `Val2` → Počáteční stav
- `Val3` → Konečný stav
- `Val4` → Spotřeba

#### 4. PAYMENT_MONTHLY - Měsíční úhrady
```csv
UnitName,DataType,Key,Val1,Val2,...,Val12,...
"Byt 1513/01",PAYMENT_MONTHLY,Úhrady,"1000","1000",...,"1000",...
```

**Mapování:**
- `Val1-Val12` → Úhrady za měsíce 1-12

#### 5. ADVANCE_MONTHLY - Měsíční předpisy
```csv
UnitName,DataType,Key,Val1,Val2,...,Val12,...
"Byt 1513/01",ADVANCE_MONTHLY,Předpisy,"1200","1200",...,"1200",...
```

**Mapování:**
- `Val1-Val12` → Předpisy za měsíce 1-12

#### 6. FIXED_PAYMENT - Pevné platby (Fond oprav)
```csv
UnitName,DataType,Key,Val1,...
"Byt 1513/01",FIXED_PAYMENT,"Fond oprav budovy","2400,00",...
```

**Mapování:**
- `Key` → Název platby
- `Val1` → Částka

## Použití

### 1. Testování parseru (bez zápisu do DB)

```bash
npx tsx scripts/test-export-full-parser.ts ./EXPORT_FULL.csv
```

**Parametry:**
- `<cesta-k-csv>` - cesta k souboru EXPORT_FULL.csv
- `[limit]` - počet jednotek k výpisu (výchozí: 3)

**Výstup:**
- Statistiky (počet jednotek, služeb, měřidel)
- Detailní výpis prvních N jednotek
- JSON soubor `EXPORT_FULL_parsed.json` s celou strukturou

**Příklad:**
```bash
npx tsx scripts/test-export-full-parser.ts ./EXPORT_FULL.csv 5
```

### 2. Import do databáze

```bash
npx tsx scripts/import-export-full.ts ./EXPORT_FULL.csv "Kníničky 318" 2024
```

**Parametry:**
- `<cesta-k-csv>` - cesta k souboru EXPORT_FULL.csv
- `<název-budovy>` - název budovy (musí existovat v DB nebo se vytvoří)
- `<rok>` - rok vyúčtování (např. 2024)

**Co script dělá:**
1. Načte CSV soubor
2. Agreguje řádky podle `UnitName`
3. Vytvoří/najde budovu v databázi
4. Vytvoří/najde vyúčtovací období
5. Pro každou jednotku:
   - Vytvoří/aktualizuje jednotku (`Unit`)
   - Vytvoří/aktualizuje vlastníka (`Owner`) a vlastnictví (`Ownership`)
   - Importuje služby a náklady (`BillingServiceCost`)
   - Importuje odečty měřidel (`Meter`, `Reading`)
   - Importuje měsíční platby (`Payment`)
   - Importuje měsíční předpisy (`AdvanceMonthly`)
   - Vytvoří výsledek vyúčtování (`BillingResult`)

## Zpracování "špinavých" dat

### Funkce `parseCzechNumber()`

Robustně parsuje české číslo z různých formátů:

**Podporované formáty:**
- `"1250,50"` → `1250.50`
- `"1 250,50"` → `1250.50`
- `"1 250,50 Kč"` → `1250.50`
- `"64,23 m²"` → `64.23`
- `"-500"` → `-500`

**Ignorované hodnoty (vrací 0):**
- `#N/A`, `#NENÍ_K_DISPOZICI`, `#NAME?`, `#REF!`
- `null`, `undefined`, `""`
- `"-"`, `"—"`
- Jakýkoli text začínající `#`

### Funkce `cleanTextValue()`

Pro textové hodnoty (Val6-Val9) - zachovává formátování, ale čistí chyby:

```typescript
cleanTextValue("64,23")  // "64,23" (zachová formát)
cleanTextValue("#N/A")   // ""
cleanTextValue("-")      // ""
```

## Výstupní JSON struktura

```json
{
  "unitName": "Byt 1513/01",
  "info": {
    "owner": "Jan Novák",
    "variableSymbol": "1513001",
    "email": "jan@email.cz",
    "totalResult": -15486.00,
    "bankAccount": "CZ1234567890"
  },
  "services": [
    {
      "name": "Studená voda",
      "buildingTotalCost": 3083.04,
      "unitCost": 3083.04,
      "unitAdvance": 840.00,
      "unitBalance": 2243.04,
      "distributionShare": "9,63%",
      "details": {
        "unit": "m³",
        "buildingUnits": "320,00",
        "unitPrice": "66,94",
        "unitUnits": "48",
        "calculationMethod": "měřeno"
      },
      "meters": [
        {
          "serial": "123456",
          "start": 10,
          "end": 58,
          "consumption": 48
        }
      ]
    }
  ],
  "fixedPayments": [
    {
      "name": "Fond oprav budovy",
      "amount": 2400.00
    }
  ],
  "monthlyData": {
    "payments": [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
    "advances": [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200]
  }
}
```

## Databázové mapování

### Hlavní entity

```
Building (Budova)
  └── BillingPeriod (Vyúčtovací období)
       ├── Unit (Jednotka)
       │    ├── Owner (Vlastník) via Ownership
       │    ├── Meter (Měřidlo)
       │    │    └── Reading (Odečet)
       │    ├── Payment (Platba)
       │    ├── AdvanceMonthly (Měsíční záloha)
       │    └── BillingResult (Výsledek vyúčtování)
       └── Service (Služba)
            └── BillingServiceCost (Náklady služby pro jednotku)
```

### Klíčové vazby

- `BillingServiceCost.metadata` - JSON pole s detaily (Val6-Val9)
- `Service.code` - normalizovaný kód služby (např. `studena_voda`)
- `Unit.variableSymbol` - VS z INFO řádku
- `Owner` - automaticky vytvoří z jména (split na křestní/příjmení)

## Řešení problémů

### CSV není správně parsován
- Ověřte encoding (měl by být UTF-8 s BOM)
- Zkontrolujte oddělovač (`,` nebo `;`)
- Použijte testovací script pro kontrolu struktury

### Služby se nespárují s měřidly
- Zkontrolujte, že `Key` v řádku METER odpovídá názvu služby v COST
- Parser hledá částečnou shodu (case-insensitive)

### Čísla se neimportují správně
- Zkontrolujte formát (české formátování s `,` jako desetinná čárka)
- Ověřte, že Excel neexportoval chyby (`#N/A`)

### Duplicitní data v DB
- Script používá `upsert` pro většinu operací
- Platby se vkládají vždy nové (kontrolujte duplicity ručně)

## Příklady

### Kompletní workflow

```bash
# 1. Export z Excelu (Office Scripts) → EXPORT_FULL.csv

# 2. Test parsování
npx tsx scripts/test-export-full-parser.ts ./public/import/EXPORT_FULL.csv 10

# 3. Kontrola JSON výstupu
cat ./public/import/EXPORT_FULL_parsed.json | jq '.[] | select(.unitName == "Byt 1513/01")'

# 4. Import do DB
npx tsx scripts/import-export-full.ts ./public/import/EXPORT_FULL.csv "Kníničky 318" 2024

# 5. Ověření v DB (Prisma Studio)
npx prisma studio
```

### Filtrování dat před importem

Pokud chcete importovat jen některé jednotky:

```bash
# 1. Export JSON
npx tsx scripts/test-export-full-parser.ts ./EXPORT_FULL.csv 999

# 2. Filtrovat JSON (např. jen jednotky s emailem)
cat EXPORT_FULL_parsed.json | jq '[.[] | select(.info.email != "")]' > filtered.json

# 3. Vytvořit nový CSV z JSON (vlastní script)
```

## Rozšíření

### Přidání nového DataType

1. Aktualizovat typ `CsvRow` v obou souborech
2. Přidat handler do `aggregateUnitData()` funkce
3. Implementovat import do DB v `importUnitData()`

### Vlastní formátování čísel

Upravit funkci `parseCzechNumber()` podle potřeby:

```typescript
function parseCzechNumber(value: string): number {
  // Vaše vlastní logika
}
```

## Reference

- Office Scripts dokumentace: https://learn.microsoft.com/office/dev/scripts/
- Prisma ORM: https://www.prisma.io/docs
- CSV Parser: https://csv.js.org/parse/
