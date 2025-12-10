import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ DB Connection OK:', result)
    
    const userCount = await prisma.user.count()
    console.log('✅ User count:', userCount)
  } catch (error: any) {
    console.log('❌ DB Connection ERROR:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
