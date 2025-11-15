# 🏢 Vyúčtování Online - Systém pro správu SVJ

Moderní webová aplikace pro vyúčtování služeb společenství vlastníků (SVJ).

## ✨ Klíčové Funkce

- 🏗️ **Správa bytových domů** - Evidence domů, jednotek a vlastníků
- 💰 **Automatické rozúčtování** - Podpora všech metodik (podíl, měřidla, osoby, kombinace)
- 📊 **Pokročilé výpočty** - Automatický výpočet přeplatků a nedoplatků
- 📄 **PDF reporty** - Generování vyúčtování s QR kódy pro platby
- ✉️ **Hromadné rozesílání** - Automatické rozesílání vyúčtování e-mailem
- 🔐 **Přístupové role** - Admin, Správce SVJ, Vlastník
- 📱 **Responzivní design** - Funguje na PC, tabletu i mobilu

## 🚀 Rychlý Start

### Prerequisity

- Node.js 18+ 
- npm nebo yarn

### Instalace

```bash
# Instalujte závislosti
npm install

# Vytvořte databázi a naplňte demo daty
npx prisma migrate dev --name init

# Spusťte dev server
npm run dev
```

Aplikace poběží na [http://localhost:3000](http://localhost:3000)

### 🔑 Demo Přihlašovací Údaje

**Administrátor:**
- Email: `admin@vyuctovani.cz`
- Heslo: `admin123`

**Správce SVJ:**
- Email: `spravce@vyuctovani.cz`
- Heslo: `spravce123`

## 📋 Technologie

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Databáze:** SQLite (dev), PostgreSQL (produkce)
- **ORM:** Prisma
- **Autentizace:** NextAuth.js
- **PDF:** jsPDF
- **Email:** Nodemailer

## 🗂️ Struktura Projektu

```
vyuctovanionline/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard stránka
│   ├── login/             # Přihlášení
│   ├── buildings/         # Správa domů
│   ├── units/             # Správa jednotek
│   ├── owners/            # Správa vlastníků
│   └── billing/           # Vyúčtování
├── components/            # React komponenty
│   ├── dashboard/        # Dashboard komponenty
│   └── ui/               # UI komponenty
├── lib/                  # Utility funkce
├── prisma/              # Databázové schema a migrace
│   ├── schema.prisma    # Datový model
│   └── seed.ts          # Demo data
└── types/               # TypeScript typy
```

## 📊 Datový Model

### Klíčové Entity

- **Building** - Bytový dům
- **Unit** - Jednotka (byt, garáž, sklep)
- **Owner** - Vlastník
- **Service** - Služba (Teplo, Vodné, Správa, atd.)
- **Meter** - Měřidlo
- **Cost** - Náklad (faktura)
- **Payment** - Platba
- **BillingPeriod** - Období vyúčtování
- **BillingResult** - Výsledek vyúčtování

### Metodiky Rozúčtování

1. **BY_SHARE** - Dle podílu na domě
2. **BY_METER** - Dle odečtu měřidla
3. **BY_PERSON** - Dle počtu osob
4. **BY_AREA** - Dle výměry
5. **BY_UNIT** - Fixní částka na jednotku
6. **COMBINED** - Kombinace metod (např. 30% dle m², 70% dle měřidel)

## 🛠️ Příkazy

```bash
# Development
npm run dev          # Spustit dev server
npm run build        # Build pro produkci
npm run start        # Spustit produkční server

# Databáze
npx prisma studio    # Otevřít databázový GUI
npx prisma migrate dev    # Vytvořit novou migraci
npx prisma db seed   # Naplnit databázi demo daty
npx prisma generate  # Generovat Prisma Client
```

## 📝 Konfigurace

Vytvořte `.env` soubor s následujícími proměnnými:

```env
# Databáze
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Email
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="noreply@vyuctovani.cz"
```

## 🚀 Deployment

### Vercel (Doporučeno)

1. Pushněte kód na GitHub
2. Importujte projekt na Vercel
3. Nastavte environment variables
4. Deploy!

## 📖 Dokumentace

Kompletní specifikace zahrnuje:
- Správu bytových domů, jednotek a vlastníků
- Evidence nákladů, měřidel a plateb
- Automatické rozúčtování podle různých metodik
- Generování PDF reportů a hromadné rozesílání
- Výpočet přeplatků a nedoplatků
- Návrh nových záloh

## 🤝 Přispívání

Příspěvky jsou vítány! Prosím, vytvořte issue nebo pull request.

## 📄 Licence

MIT

---

⭐ Pokud se vám projekt líbí, dejte mu hvězdičku na GitHubu!
