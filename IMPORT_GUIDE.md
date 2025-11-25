# 📥 Průvodce importem dat z Excelu

Tento dokument popisuje strukturu Excel souboru pro import dat do systému Vyúčtování Online. Importní skript je navržen tak, aby byl flexibilní, ale pro správnou funkčnost vyžaduje dodržení určitých konvencí v názvech listů a sloupců.

## 📑 Podporované listy (Záložky)

Importér hledá listy podle klíčových slov v jejich názvu. Velikost písmen nehraje roli.

| Typ dat | Hledaný název listu (klíčová slova) | Popis |
|---------|-------------------------------------|-------|
| **Konfigurace** | `Vstupní data`, `Input` | Základní údaje o domě a mapování sloupců záloh. |
| **Vlastníci** | `Evidence` | Seznam jednotek, vlastníků, podílů a osob. |
| **Náklady** | `Faktury`, `Invoice` | Seznam nákladů (faktur) a definice služeb. |
| **Zálohy** | `Předpis po mesici`, `Zálohy` | Předepsané měsíční zálohy. |
| **Odečty** | `Vodoměry TUV`, `Vodoměry SV`, `Teplo`, `Elektroměry` | Stavy měřidel (počáteční a konečné). |
| **Platby** | `Úhrady`, `Platby` | Skutečně zaplacené částky (bankovní výpis). |
| **Parametry** | `Parametry`, `Parameters` | Doplňkové parametry jednotek (např. počet žeber radiátorů). |

---

## 1. List "Vstupní data" (Konfigurace)

Tento list slouží k nastavení parametrů budovy a mapování služeb pro import záloh.

*   **B3**: Název domu
*   **B12**: Rok vyúčtování (např. 2024)
*   **B18**: Celková plocha domu
*   **B19**: Započitatelná plocha
*   **B34**: Jméno správce

### Mapování sloupců záloh
Na tomto listu se také definuje, který sloupec v listu "Předpis po mesici" patří které službě.
*   **Řádek 30 (index 29)**: Odkaz na sloupec (např. "JC", "AB").
*   **Řádek 31 (index 30)**: Název služby (musí odpovídat názvu ve Fakturách).

---

## 2. List "Faktury" (Náklady a Služby)

Tento list je **klíčový** pro definici služeb a jejich metodiky rozúčtování.

**Očekávaná struktura sloupců:**
*   **Sloupec A (1)**: Název služby (např. "Vodné a stočné", "Teplo", "Správa").
*   **Sloupec C (3)**: Metodika rozúčtování (např. "odečet SV", "na byt", "vlastnický podíl").
*   **Sloupec E (5)**: Částka nákladu za rok.
*   **Sloupec M (13)**: (Volitelné) Písmeno sloupce pro zálohy (alternativa k mapování ve Vstupních datech).

**Pravidla pro detekci metodiky:**
*   `odečet`, `spotřeba`, `m3`, `kwh` -> **Měřidla**
*   `m2`, `plocha` -> **Plocha**
*   `osob` -> **Osoby**
*   `na byt`, `rovným dílem` -> **Rovným dílem**
*   `podíl`, `fond` -> **Vlastnický podíl**

> **Pozor:** Řádky, kde je ve sloupci "Metodika" text jako "Způsob rozúčtování" (hlavička), jsou automaticky přeskočeny.

---

## 3. List "Předpis po mesici" (Zálohy)

Obsahuje předepsané zálohy pro jednotlivé jednotky a měsíce.

**Struktura:**
*   **Sloupec A**: Číslo jednotky (musí odpovídat číslu v Evidenci).
*   **Další sloupce**: Částky záloh pro jednotlivé služby.

**Jak systém pozná, který sloupec je která služba?**
1.  Podívá se do listu **Vstupní data** (řádky 30/31).
2.  Pokud nenajde, podívá se do listu **Faktury** (sloupec M).
3.  Jako poslední možnost zkouší hledat názvy služeb přímo v hlavičce tohoto listu.

---

## 4. List "Evidence" (Vlastníci)

Seznam jednotek a vlastníků.

*   **Sloupec A**: Číslo jednotky (např. "318/01").
*   **Sloupec B**: Jméno vlastníka.
*   **Sloupec C**: Adresa.
*   **Sloupec D**: Email.
*   **Sloupec L/M**: Podíl (jmenovatel/čitatel).
*   **Sloupec N**: Podíl v %.

---

## 5. Listy s odečty (Měřidla)

Názvy listů určují typ měřidla:
*   `Vodoměry TUV` -> Teplá voda
*   `Vodoměry SV` -> Studená voda
*   `Teplo` -> Kalorimetry/Poměrová měřidla

**Struktura:**
*   **Sloupec A**: Číslo jednotky.
*   **Sloupec F**: Výrobní číslo měřidla.
*   **Sloupec G**: Počáteční stav.
*   **Sloupec H**: Konečný stav.

---

## Řešení častých problémů

### ❌ "Nenačítají se náklady (Faktury)"
*   Zkontrolujte, zda se list jmenuje "Faktury".
*   Ověřte, že částky jsou ve sloupci **E**.
*   Ujistěte se, že metodika není prázdná.

### ❌ "Nenačítají se zálohy"
*   Zkontrolujte název listu ("Předpis po mesici").
*   Ověřte mapování sloupců v listu "Vstupní data" nebo ve sloupci M na listu "Faktury".
*   Pokud se zálohy načítají špatně, zkontrolujte, zda systém nebere data z jiného listu (např. "Zálohy byt"). Systém preferuje "Předpis po mesici".

### ❌ "Chybí jednotky"
*   Jednotky se zakládají primárně z listu "Evidence". Pokud v Evidenci chybí, mohou se vytvořit z jiných listů, ale budou mít neúplné údaje.
