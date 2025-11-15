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
          if (!credentials?.email || !credentials?.password) {
            console.error('Missing credentials')
            return null
          }

          // Normalize user input (trim + lowercase email)
          const email = String(credentials.email).trim().toLowerCase()

          const user = await prisma.user.findUnique({
            where: { email }
          })

          if (!user) {
            console.error('User not found:', email)
            return null
          }

          const isValid = await bcrypt.compare(String(credentials.password), user.password)

          if (!isValid) {
            console.error('Invalid password for:', email)
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  // In serverless/proxied environments (Netlify) allow dynamic host
  // @ts-expect-error - available in NextAuth runtime, not typed in our version
  trustHost: true,
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
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Set the NEXTAUTH_URL environment variable for production
  ...(process.env.NODE_ENV === 'production' && {
    basePath: '/api/auth',
    // This is required for production environments
    // It should be the canonical URL of your site
    // See: https://next-auth.js.org/configuration/options#nextauth_url
    // and https://next-auth.js.org/deployment#nextauth_url
    // You must set the NEXTAUTH_URL environment variable
    // on your hosting provider (e.g., Vercel, Netlify).
    // Example: https://example.com
    // If you're using a custom domain, it should be that domain.
    // If you're not, it should be the URL provided by your host.
    // For Netlify, it would be https://<your-site-name>.netlify.app
    url: process.env.NEXTAUTH_URL,
  }),
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
