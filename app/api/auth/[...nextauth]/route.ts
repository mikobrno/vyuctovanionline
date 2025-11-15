import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Ensure this API route runs on Node.js runtime (not Edge) for bcrypt/Prisma
export const runtime = 'nodejs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
          console.log('=== AUTH START ===')
          console.log('Environment:', process.env.NODE_ENV)
          console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
          console.log('NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET)
          console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
          
          if (!credentials?.email || !credentials?.password) {
            console.error('❌ Missing credentials')
            return null
          }

          const email = credentials.email.trim().toLowerCase()
          console.log('🔍 Looking for user:', email)

          const user = await prisma.user.findUnique({
            where: { email }
          })

          if (!user) {
            console.error('❌ User not found:', email)
            return null
          }

          console.log('✅ User found:', user.email, 'Role:', user.role)

          const isValid = await bcrypt.compare(credentials.password, user.password)
          console.log('🔑 Password valid:', isValid)

          if (!isValid) {
            console.error('❌ Invalid password')
            return null
          }

          console.log('✅ Auth successful')
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image
          }
        } catch (error) {
          console.error('❌ Auth error:', error)
          throw new Error('INTERNAL_AUTH_ERROR')
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
