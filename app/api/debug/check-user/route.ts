import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email') || 'admin@vyuctovani.cz'
    const password = searchParams.get('password') || 'admin123'

    console.log('=== DEBUG CHECK USER ===')
    console.log('Looking for email:', email)

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found',
        email: email.trim().toLowerCase(),
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    return NextResponse.json({
      success: true,
      userExists: true,
      passwordValid: isPasswordValid,
      userData: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: user.password.substring(0, 20) + '...',
      },
      testPassword: password,
    })
  } catch (error) {
    console.error('Debug check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
