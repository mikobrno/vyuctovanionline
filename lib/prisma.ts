import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing database connection string. Set DATABASE_URL.')
}

try {
  const parsed = new URL(databaseUrl)
  console.log(`[Prisma] Using database host ${parsed.hostname}:${parsed.port || 'default'}`)
} catch {
  console.warn('[Prisma] DATABASE_URL is not a valid URL, continuing without host logging')
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: databaseUrl
    }
  }
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
