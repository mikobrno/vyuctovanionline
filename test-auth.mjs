import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testAuth() {
  console.log('🔍 Testování autentizace...\n')
  
  try {
    // Najít admin uživatele
    const user = await prisma.user.findUnique({
      where: { email: 'admin@vyuctovani.cz' }
    })

    if (!user) {
      console.log('❌ Uživatel admin@vyuctovani.cz nebyl nalezen v databázi!')
      console.log('\n💡 Spusťte: npx prisma db seed')
      return
    }

    console.log('✅ Uživatel nalezen:')
    console.log('   Email:', user.email)
    console.log('   Jméno:', user.name)
    console.log('   Role:', user.role)
    console.log('   Hash hesla:', user.password.substring(0, 20) + '...')

    // Test hesla
    const testPassword = 'admin123'
    const isValid = await bcrypt.compare(testPassword, user.password)
    
    console.log('\n🔑 Test hesla "admin123":')
    console.log('   Výsledek:', isValid ? '✅ SPRÁVNÉ' : '❌ ŠPATNÉ')

    if (!isValid) {
      console.log('\n🔧 Opravuji heslo...')
      const newHash = await bcrypt.hash('admin123', 10)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHash }
      })
      console.log('✅ Heslo opraveno!')
    }

  } catch (error) {
    console.error('❌ Chyba:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testAuth()
