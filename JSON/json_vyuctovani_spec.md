# JSON Export Specification for Vyuctovani

This document describes the structure of the JSON response returned by the `actionJsonVyuctovani` endpoint.

## Root Object

| Key | Type | Description |
| :--- | :--- | :--- |
| `house_info` | Object | Basic information about the house (building). |
| `faktury` | Array | List of invoices and their calculations. |
| `uhrady` | Array | Payment history for each unit/member. |
| `preplatky_nedoplatky` | Array | Overpayments and underpayments calculations. |
| `vstupni_data` | Object | Input parameters for the calculation (bank info, costs, etc.). |
| `params` | Object | House parameters (e.g., coefficients). |
| `meridla` | Array | Meter readings (water, heat, electricity, etc.). |
| `pocet_osob` | Array | Number of persons registered per unit per month. |
| `evidence` | Array | Detailed evidence data for each unit/member. |
| `predpisy` | Array | Breakdown of monthly prescriptions (advances) by category. |
| `vytahy` | Array | Elevator usage data. |

---

## Detailed Structures

### 1. house_info
| Key | Type | Description |
| :--- | :--- | :--- |
| `nazev` | String | Name of the house/SVJ. |
| `sidlo` | String | Registered address of the house. |

### 2. faktury
An array of objects, where each object represents an invoice item (or a category of invoices).

| Key | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Name of the invoice item or category. |
| `faktura` | Object\|Null | Details of the invoice calculation. Null if not applicable. |

**faktura Object:**
| Key | Type | Description |
| :--- | :--- | :--- |
| `jednotka` | String | Unit of measurement (e.g., "m2", "ks"). |
| `podil` | String/Number | Share/ratio used for calculation. |
| `cena` | String/Number | Total price or price formula. |
| `jednotek_dum` | String/Number | Total units for the house. |
| `kc_jedn_dum` | String/Number | Price per unit for the house. |
| `jednotek_uzivatel` | String/Number | Units attributed to the user. |
| `naklad_uzivatel` | String/Number | Cost attributed to the user. |
| `zaloha_uzivatel` | String/Number | Advances paid by the user. |
| `preplatky_nedoplatky` | String/Number | Final settlement amount. |

### 3. uhrady
An array of objects representing payments for each unit.

| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation (e.g., "Byt č.1"). |
| `platby` | Array of Numbers | Array of 12 numbers representing payments for months 1-12. |

### 4. preplatky_nedoplatky
An array of objects representing the final financial settlement.

| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `preplatek` | Number | Overpayment amount. |
| `nedoplatek` | Number | Underpayment amount. |
| `uhrazeno_datum` | String | Date when the settlement was paid (or "Nezadáno"). |
| `prevedeno` | Number | Amount transferred to next period. |
| `required_total` | Number | Total required amount. |
| `payed_total` | Number | Total paid amount. |

### 5. vstupni_data
Key parameters and metadata for the settlement period.

| Key | Type | Description |
| :--- | :--- | :--- |
| `spravce` | String | Name of the administrator. |
| `cislo_uctu_dum` | String | House bank account number. |
| `predcisli_spolecenstvi` | String | Bank account prefix. |
| `cislo_uctu_spolecenstvi` | String | SVJ bank account number. |
| `kod_banky_spolecenstvi` | String | Bank code. |
| `rok` | Number | The year of the settlement. |
| `pocet_jednotek` | Number | Total number of units. |
| `cena_bvak` | Number | Price for water/sewage (BVAK). |
| `reklamace` | String | Complaint period/details. |
| `vyuctovani_do` | String | Deadline for payout. |
| `plocha_domu` | Number | Total area of the house. |
| `plocha_domu_zapoc` | Number | Total chargeable area. |
| `adresa` | String | Address. |
| `prijem_svj` | Number | Total income of SVJ. |
| `naklady_svj` | Number | Total costs of SVJ. |

### 6. params
House-specific parameters and their values for each unit.

| Key | Type | Description |
| :--- | :--- | :--- |
| `param_names` | Array of Strings | Names of the parameters. |
| `data` | Array | Array of objects containing unit data. |

**data Object:**
| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `params` | Array of Strings/Numbers | Values corresponding to `param_names` by index. |

### 7. meridla
Meter readings for various services.

| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `tuv` | Array | Hot water meters (TUV). |
| `sv` | Array | Cold water meters (SV). |
| `teplo` | Array | Heat meters. |
| `elektro` | Array | Electricity meters. |
| `parking` | Array | Parking spots. |
| `vytahy_meridla` | Array of Numbers | Elevator usage stats (calculated differences). |

**Meter Object (tuv, sv, teplo, etc.):**
| Key | Type | Description |
| :--- | :--- | :--- |
| `typ` | String | Meter type name. |
| `datum_odectu` | String | Date of reading (DD MM YYYY). |
| `meridlo` | String | Meter identifier/serial number. |
| `pocatecni_hodnota` | Number | Initial reading value. |
| `koncova_hodnota` | Number | Final reading value. |
| `rocni_naklad` | Number | Annual cost/consumption. |
| `radio_module` | String | Radio module ID (if any). |
| `import_id` | String/Null | Optional import ID. |

### 8. pocet_osob
| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `uzivatel` | String | Full name of the user. |
| `pocet_osob_by_month` | Object | Map of month index (1-12) to number of persons. |

### 9. evidence
Comprehensive unit and member details.

| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `uzivatel` | String | Representative's full name. |
| `bydliste` | String | Representative's address. |
| `email` | String | Email address. |
| `telefon` | String | Phone number. |
| `osloveni` | String | Salutation. |
| `kominy` | String | Chimney details. |
| `vymera` | Number | Area size. |
| `vymera_zapocitatelna` | Number | Chargeable area size. |
| `podil_dum` | String | Share on common parts. |
| `vs` | String | Variable symbol. |
| `vs_modified` | String | Modified variable symbol. |
| `od` | String | Validity start date. |
| `do` | String | Validity end date. |
| `od_do` | String | Combined validity string. |
| `bankovni_spojeni` | String | Bank account number. |

### 10. predpisy
Breakdown of monthly advances for various categories.

| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `uzivatel` | String | User name. |
| `elektrika` | Object | Monthly data (1-12) for electricity advances. |
| `uklid` | Object | Monthly data (1-12) for cleaning. |
| `komin` | Object | Monthly data (1-12) for chimney sweep. |
| `vytah` | Object | Monthly data (1-12) for elevator. |
| `voda` | Object | Monthly data (1-12) for water. |
| `sprava` | Object | Monthly data (1-12) for administration. |
| `opravy` | Object | Monthly data (1-12) for repairs (fund). |
| `teplo` | Object | Monthly data (1-12) for heat. |
| `tuv` | Object | Monthly data (1-12) for hot water. |
| `pojisteni` | Object | Monthly data (1-12) for insurance. |
| `ostatni_sklep` | Object | Monthly data (1-12) for other (cellar). |
| `internet` | Object | Monthly data (1-12) for internet. |
| `ostatni_upc` | Object | Monthly data (1-12) for UPC/cable. |
| `sta` | Object | Monthly data (1-12) for shared antenna. |
| `spolecne_naklady` | Object | Monthly data (1-12) for common costs. |
| `statutari` | Object | Monthly data (1-12) for statutory body rewards. |
| `najemne` | Object | Monthly data (1-12) for rent. |
| `sluzby` | Object | Monthly data (1-12) for services. |
| `ostatni_sluzby` | Object | Monthly data (1-12) for other services. |
| `poplatek_pes` | Object | Monthly data (1-12) for dog fees. |

*Note: All category objects map month index (1-12) to the amount.*

### 11. vytahy
| Key | Type | Description |
| :--- | :--- | :--- |
| `oznaceni` | String | Unit designation. |
| `vytah` | Number/String | Elevator usage data/coefficient. |
