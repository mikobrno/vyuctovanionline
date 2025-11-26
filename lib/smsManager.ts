import { resolveBrandProfile } from './branding';

/**
 * SMS Manager API Client
 * Dokumentace: https://smsmanager.cz/docs/api/json/
 * API Reference: https://api-ref.smsmanager.com/openapi/en/json/jsonapi_v2
 */

const SMS_API_URL = process.env.SMSMANAGER_ENDPOINT || 'https://api.smsmngr.com/v2/simple/message';
const SMS_API_KEY = process.env.SMSMANAGER_API_KEY || process.env.SMS_API_KEY || 'hiSx4lipcGKgGfzSil4R9kndjgv2IY3u1DR9fRr2';
const SMS_SENDER = process.env.SMSMANAGER_SENDER;
const SMS_TTL = process.env.SMSMANAGER_SMS_TTL ? parseInt(process.env.SMSMANAGER_SMS_TTL) : undefined;
const SMS_TAG = process.env.SMSMANAGER_TAG;

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
    // Rozhodnutí o formátu payloadu podle endpointu
    const isAdvancedEndpoint = SMS_API_URL.includes('/v2/message') && !SMS_API_URL.includes('/simple/');
    
    let body: unknown;
    
    if (isAdvancedEndpoint) {
      // Advanced endpoint payload (JSON API v2)
      // Dokumentace: https://api-ref.smsmanager.com/openapi/cs/json/jsonapi_v2
      // Endpoint: /message (POST)
      
      interface SmsFlowConfig {
        sender?: string;
        ttl?: number;
      }

      interface MessagePayload {
        body: string;
        to: { phone_number: string }[];
        tag?: string;
        flow?: { sms: SmsFlowConfig }[];
      }
      
      const messageData: MessagePayload = {
        body: params.text,
        to: [
          { phone_number: params.to }
        ]
      };

      if (SMS_TAG) {
        messageData.tag = SMS_TAG;
      }

      // Konfigurace kanálu (SMS)
      const smsConfig: SmsFlowConfig = {};
      
      if (params.sender || SMS_SENDER) {
        smsConfig.sender = params.sender || SMS_SENDER;
      }
      
      if (SMS_TTL) {
        smsConfig.ttl = SMS_TTL;
      }

      // Pokud máme nějakou konfiguraci pro SMS, přidáme ji do flow
      if (Object.keys(smsConfig).length > 0) {
        messageData.flow = [
          { sms: smsConfig }
        ];
      }

      body = messageData;
    } else {
      // Simple endpoint payload
      body = {
        number: params.to,
        message: params.text,
        sender: params.sender || SMS_SENDER,
      };
    }

    console.log('Sending SMS:', {
      url: SMS_API_URL,
      isAdvanced: isAdvancedEndpoint,
      body: JSON.stringify(body)
    });

    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SMS_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log('SMS Response:', {
      status: response.status,
      data
    });

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        details: data,
      };
    }

    // Zpracování odpovědi
    if (isAdvancedEndpoint) {
      // Advanced endpoint (/message) vrací přímo objekt MessageResponse s ID
      if (data.id) {
        return {
          success: true,
          messageId: String(data.id),
          details: data
        };
      }

      // Pokud by API vracelo data wrapper (např. batch endpoint)
      const result = data.data?.[0];
      if (result) {
        return {
          success: true, // Pokud jsme tady a status je 200/201, je to success
          messageId: String(result.id),
          details: result
        };
      }
      
      return { success: true, details: data };
    } else {
      // Simple endpoint vrací ID zprávy jako UUID
      return {
        success: true,
        messageId: data.id || data.messageId,
      };
    }
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
  salutation?: string | null;
  unitName: string;
  year: number;
  balance: number;
  buildingName?: string;
  email?: string | null;
  template?: string | null;
  managerName?: string | null;
}): Promise<SmsResponse> {
  const {
    to,
    ownerName,
    salutation,
    unitName,
    year,
    balance,
    buildingName,
    email,
    template,
    managerName,
  } = params;

  const brand = resolveBrandProfile(managerName);
  const greeting = salutation || ownerName || 'Vlastníku';

  // Formátování bilance
  const balanceText = balance > 0
    ? `přeplatek ${balance.toFixed(2)} Kč`
    : balance < 0
    ? `nedoplatek ${Math.abs(balance).toFixed(2)} Kč`
    : 'vyrovnáno';

  let text = '';

  if (template && template.trim().length > 0) {
    // Použití šablony
    // Mapování proměnných:
    // #osloveni# -> salutation (pokud existuje) jinak ownerName
    // #email# -> email
    // #jednotka_cislo# -> unitName
    // #bytovy_dum# -> buildingName
    // #rok# -> year
    // #vysledek# -> balanceText (přidáno navíc pro flexibilitu)
    // #spravce# -> název správce / firmy

    text = template
      .replace(/#osloveni#/g, greeting)
      .replace(/#email#/g, email || 'váš email')
      .replace(/#jednotka_cislo#/g, unitName)
      .replace(/#bytovy_dum#/g, buildingName || 'domě')
      .replace(/#rok#/g, year.toString())
      .replace(/#vysledek#/g, balanceText)
      .replace(/#spravce#/g, brand.companyName);
      
  } else {
    // Výchozí text
    const houseLabel = buildingName ? ` v domě ${buildingName}` : '';
    const emailTarget = email || 'váš email';

    text = `${greeting},
vyúčtování ${year} pro jednotku ${unitName}${houseLabel} je připraveno.
Výsledek: ${balanceText}.
Detail jsme zaslali na ${emailTarget}.

${brand.smsSignature}`;
  }

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
