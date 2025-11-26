import QRCode from 'qrcode';

interface QRCodeData {
  balance: number;
  year: number;
  unitNumber: string;
  variableSymbol: string | null;
  bankAccount: string | null;
}

export async function generateBillingQRCode(data: QRCodeData): Promise<string | undefined> {
  const { balance, year, unitNumber, variableSymbol, bankAccount } = data;

  if (balance >= 0) {
    return undefined;
  }

  const amount = Math.abs(balance);
  const account = bankAccount;
  const vs = variableSymbol;

  if (!account || !vs) {
    return undefined;
  }

  const msg = `Vyuctovani ${year} - ${unitNumber}`;
  // SPAY format
  const spayString = `SPD*1.0*ACC:${account}*AM:${amount.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:${msg.substring(0, 60)}`;

  try {
    return await QRCode.toDataURL(spayString);
  } catch (e) {
    console.error('Failed to generate QR code', e);
    return undefined;
  }
}
