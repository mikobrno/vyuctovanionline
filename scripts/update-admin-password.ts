import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function updateAdminPassword() {
  try {
    console.log('🔍 Hledám uživatele admin@vyuctovani.cz...')
    
    const user = await prisma.user.findUnique({
      where: { email: 'admin@vyuctovani.cz' }
    })

    if (!user) {
      console.log('❌ Uživatel admin@vyuctovani.cz nenalezen')
      console.log('📝 Vytvářím nového admin uživatele...')
      
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const newUser = await prisma.user.create({
        data: {
          email: 'admin@vyuctovani.cz',
          name: 'Admin',
          password: hashedPassword,
          role: 'ADMIN'
        }
      })
      
      console.log('✅ Admin uživatel vytvořen:', newUser.email)
    } else {
      console.log('✅ Uživatel nalezen:', user.email)
      console.log('🔑 Aktualizuji heslo...')
      
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await prisma.user.update({
        where: { email: 'admin@vyuctovani.cz' },
        data: { password: hashedPassword }
      })
      
      console.log('✅ Heslo úspěšně aktualizováno na: admin123')
    }
  } catch (error) {
    console.error('❌ Chyba:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateAdminPassword()
