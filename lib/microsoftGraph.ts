/**
 * Microsoft Graph API Client
 * Pro odesílání emailů přes Azure/Microsoft 365
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { promises as fs } from 'fs'
import path from 'path'
import 'isomorphic-fetch'
import { resolveBrandProfile } from './branding'

let credential: ClientSecretCredential | null = null

const getCredential = () => {
  if (!credential) {
    credential = new ClientSecretCredential(
      process.env.GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID!,
      process.env.GRAPH_CLIENT_ID || process.env.AZURE_CLIENT_ID!,
      process.env.GRAPH_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET!
    )
  }
  return credential
}

const getGraphClient = () => {
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const cred = getCredential()
        const token = await cred.getToken('https://graph.microsoft.com/.default')
        return token.token
      }
    }
  })
}

const emailLogoCache = new Map<string, string>()

async function getEmailLogoDataUri(logoFilename: string): Promise<string | null> {
  if (emailLogoCache.has(logoFilename)) {
    const cached = emailLogoCache.get(logoFilename)
    return cached ? cached : null
  }

  try {
    const logoPath = path.join(process.cwd(), 'public', logoFilename)
    const buffer = await fs.readFile(logoPath)
    const dataUri = `data:image/png;base64,${buffer.toString('base64')}`
    emailLogoCache.set(logoFilename, dataUri)
    return dataUri
  } catch (error) {
    console.warn('Email logo not found:', { logoFilename, error })
    emailLogoCache.set(logoFilename, '')
    return null
  }
}

interface EmailAttachment {
  name: string
  contentType: string
  contentBytes: string // base64
}

interface SendEmailParams {
  to: string[]
  cc?: string[]
  subject: string
  htmlBody: string
  textBody?: string
  attachments?: EmailAttachment[]
}

/**
 * Odeslání emailu přes Microsoft Graph API
 */
export async function sendEmail({
  to,
  cc = [],
  subject,
  htmlBody,
  attachments = []
}: SendEmailParams): Promise<void> {
  const client = getGraphClient()
  const mailboxUser = process.env.GRAPH_SENDER_UPN || process.env.AZURE_MAILBOX_USER!

  const message = {
    subject,
    body: {
      contentType: 'HTML',
      content: htmlBody
    },
    toRecipients: to.map(email => ({
      emailAddress: { address: email }
    })),
    ccRecipients: cc.map(email => ({
      emailAddress: { address: email }
    })),
    attachments: attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes
    }))
  }

  try {
    await client
      .api(`/users/${mailboxUser}/sendMail`)
      .post({
        message,
        saveToSentItems: true
      })

    console.log(`Email sent successfully to ${to.join(', ')}`)
  } catch (error) {
    console.error('Error sending email via Microsoft Graph:', error)
    throw new Error('Failed to send email')
  }
}

/**
 * Odeslání vyúčtování emailem
 */
export async function sendBillingEmail({
  to,
  salutation,
  unitName,
  buildingAddress,
  buildingName,
  year,
  balance,
  managerName,
  pdfBase64,
  subjectTemplate,
  bodyTemplate
}: {
  to: string
  salutation: string | null
  unitName: string
  buildingAddress: string
  buildingName?: string
  year: number
  balance: number
  managerName: string | null
  pdfBase64: string
  subjectTemplate?: string | null
  bodyTemplate?: string | null
}): Promise<void> {
  const brand = resolveBrandProfile(managerName)
  // Použít oslovení z Excelu nebo výchozí
  const greeting = salutation || 'Vážený/á vlastníku/vlastnice'
  
  // Použít správce z Excelu nebo výchozí
  const manager = managerName?.trim() || brand.companyName
  
  // Název domu (nebo adresa, pokud není název)
  const buildingLabel = buildingName || buildingAddress

  const logoDataUri = await getEmailLogoDataUri(brand.logoFilename)

  // 1. PŘEDMĚT
  let subject = `vyúčtování ${year} | jednotka ${unitName} | ${buildingLabel}`
  if (subjectTemplate && subjectTemplate.trim().length > 0) {
    subject = subjectTemplate
      .replace(/#rok#/g, year.toString())
      .replace(/#jednotka_cislo#/g, unitName)
      .replace(/#bytovy_dum#/g, buildingLabel)
  }

  // 2. TĚLO
  let contentHtml = ''
  
  if (bodyTemplate && bodyTemplate.trim().length > 0) {
    // Nahrazení proměnných v šabloně
    const body = bodyTemplate
      .replace(/#osloveni#/g, greeting)
      .replace(/#jednotka_cislo#/g, unitName)
      .replace(/#bytovy_dum#/g, buildingLabel)
      .replace(/#rok#/g, year.toString())
      .replace(/#spravce#/g, manager)
      
    // Převod newlines na <br>
    contentHtml = body.replace(/\n/g, '<br>')
  } else {
    // Výchozí tělo
    const balanceText = balance > 0 
      ? `nedoplatek <strong>${balance.toLocaleString('cs-CZ')} Kč</strong>`
      : balance < 0
      ? `přeplatek <strong>${Math.abs(balance).toLocaleString('cs-CZ')} Kč</strong>`
      : 'vyrovnáno'

    const signatureHtml = brand.emailSignatureLines
      .map(line => (line ? line : '&nbsp;'))
      .map(line => `<div>${line}</div>`)
      .join('')

    contentHtml = `
          <p>${greeting},</p>
          
          <p>dnes Vám bylo na email <strong>${to}</strong> zasláno vyúčtování za rok <strong>${year}</strong> k Vaší bytové jednotce <strong>${unitName}</strong> v bytovém domě <strong>${buildingLabel}</strong>.</p>
          
          <div class="balance">
            Výsledek vyúčtování: ${balanceText}
          </div>

          ${balance > 0 ? `
            <p><strong>Prosím o úhradu nedoplatku do 30 dnů od doručení tohoto vyúčtování.</strong></p>
          ` : balance < 0 ? `
            <p>Přeplatek Vám bude vrácen na registrovaný účet do 7 měsíců od konce zúčtovacího období.</p>
          ` : ''}
          
          <p>V případě dotazů nebo připomínek nás prosím kontaktujte.</p>
          
          <p>S pozdravem,</p>
          <div class="signature">
            ${signatureHtml}
          </div>
    `
  }

  const htmlBody = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #0078d4; color: white; padding: 20px; text-align: center; }
          .logo { max-height: 48px; margin-bottom: 12px; }
          .content { padding: 20px; }
          .footer { background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .balance { font-size: 18px; margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #0078d4; }
          .signature { margin-top: 20px; font-size: 13px; color: #444; }
          .signature div { line-height: 1.4; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo správce" class="logo" />` : ''}
          <h1>Vyúčtování služeb ${year}</h1>
          <p style="margin: 0; font-size: 14px;">Jednotka ${unitName} &middot; ${buildingLabel}</p>
        </div>
        <div class="content">
          ${contentHtml}
        </div>
        <div class="footer">
          <p>Tento email byl vygenerován automaticky systémem OnlineSprava.</p>
          <p>Případné reklamace uplatněte písemně do 30 dnů od doručení.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: [to],
    subject,
    htmlBody,
    attachments: [{
      name: `Vyuctovani_${year}_${unitName.replace(/\s+/g, '_')}.pdf`,
      contentType: 'application/pdf',
      contentBytes: pdfBase64
    }]
  })
}
