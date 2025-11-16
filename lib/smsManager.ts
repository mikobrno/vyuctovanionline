/**
 * SMS Manager API Client
 * Dokumentace: https://smsmanager.cz/docs/api/json/
 * API Reference: https://api-ref.smsmanager.com/openapi/en/json/jsonapi_v2
 */

const SMS_API_URL = 'https://api.smsmngr.com/v2/simple/message';
const SMS_API_KEY = process.env.SMS_API_KEY || 'hiSx4lipcGKgGfzSil4R9kndjgv2IY3u1DR9fRr2';

interface SendSmsParams {
  to: string; // Telefonní číslo ve formátu +420XXXXXXXXX
  text: string; // Text SMS zprávy
  sender?: string; // Volitelný odesílatel (musí být nejprve schválen v SMS Manageru)
}

interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: unknown;
}

/**
 * Odešle SMS zprávu přes SMS Manager API
 * @param params - Parametry SMS zprávy
 * @returns Promise s výsledkem odeslání
 */
export async function sendSms(params: SendSmsParams): Promise<SmsResponse> {
  try {
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SMS_API_KEY,
      },
      body: JSON.stringify({
        number: params.to,
        message: params.text,
        ...(params.sender && { sender: params.sender }),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        details: data,
      };
    }

    // SMS Manager API vrací ID zprávy jako UUID
    return {
      success: true,
      messageId: data.id || data.messageId,
    };
  } catch (error) {
    console.error('SMS send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Neznámá chyba při odesílání SMS',
    };
  }
}

/**
 * Odešle SMS notifikaci o vyúčtování vlastníkovi
 * @param params - Parametry SMS zprávy s informacemi o vyúčtování
 */
export async function sendBillingSms(params: {
  to: string;
  ownerName: string;
  unitName: string;
  year: number;
  balance: number;
}): Promise<SmsResponse> {
  const { to, ownerName, unitName, year, balance } = params;

  // Formátování bilance
  const balanceText = balance > 0
    ? `přeplatek ${balance.toFixed(2)} Kč`
    : balance < 0
    ? `nedoplatek ${Math.abs(balance).toFixed(2)} Kč`
    : 'vyrovnáno';

  // Sestavení textu SMS (max 160 znaků pro 1 SMS, 306 znaků pro 2 SMS)
  const text = `Vyúčtování ${year} - ${unitName}

Vážený/á ${ownerName},
bylo vyhotoveno vyúčtování nákladů.

Výsledek: ${balanceText}

Detail obdržíte emailem.

S pozdravem,
Správa`;

  return sendSms({
    to,
    text,
  });
}

/**
 * Normalizuje telefonní číslo na mezinárodní formát
 * @param phone - Telefonní číslo v různých formátech
 * @returns Normalizované číslo ve formátu +420XXXXXXXXX nebo null
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Odstranit mezery, pomlčky, závorky
  let normalized = phone.replace(/[\s\-\(\)]/g, '');

  // Pokud začíná na 00420, nahradit za +420
  if (normalized.startsWith('00420')) {
    normalized = '+420' + normalized.slice(5);
  }
  // Pokud začíná na 420 (bez +), přidat +
  else if (normalized.startsWith('420') && !normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  // Pokud je to lokální číslo (9 číslic), přidat +420
  else if (/^\d{9}$/.test(normalized)) {
    normalized = '+420' + normalized;
  }
  // Pokud nezačíná na +, je to neplatné
  else if (!normalized.startsWith('+')) {
    return null;
  }

  // Validace českého čísla: +420 následováno 9 číslicemi
  if (!/^\+420\d{9}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Validuje, zda je telefonní číslo platné
 * @param phone - Telefonní číslo k validaci
 * @returns true pokud je číslo platné
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  return normalizePhoneNumber(phone) !== null;
}
