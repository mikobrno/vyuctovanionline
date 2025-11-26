export type BrandKey = 'adminreal' | 'brnoreal' | 'generic';

export interface BrandProfile {
  key: BrandKey;
  companyName: string;
  logoFilename: string;
  emailSignatureLines: string[];
  smsSignature: string;
}

const BRAND_PROFILES: Record<BrandKey, BrandProfile> = {
  adminreal: {
    key: 'adminreal',
    companyName: 'AdminReal s.r.o.',
    logoFilename: 'adminreal.png',
    emailSignatureLines: [
      'AdminReal s.r.o.',
      'Veveří 2581/102, 616 00 Brno',
      'tel: +420 777 338 203',
      '',
      'info@adminreal.cz',
      'www.adminreal.cz',
      'www.onlinesprava.cz',
    ],
    smsSignature: 'AdminReal s.r.o.',
  },
  brnoreal: {
    key: 'brnoreal',
    companyName: 'Brnoreal s.r.o.',
    logoFilename: 'brnoreal.png',
    emailSignatureLines: [
      'Brnoreal s.r.o.',
      'Veveří 2581/102, 616 00 Brno',
      'tel: +420 777 338 203',
      '',
      'info@brnoreal.cz',
      'www.brnoreal.cz',
    ],
    smsSignature: 'Brnoreal s.r.o.',
  },
  generic: {
    key: 'generic',
    companyName: 'Správa domu',
    logoFilename: 'adminreal.png',
    emailSignatureLines: [
      'Správa domu',
      'Veveří 2581/102, 616 00 Brno',
      'tel: +420 777 338 203',
      '',
      'info@adminreal.cz',
    ],
    smsSignature: 'Správa domu',
  },
};

const MANAGER_HINTS: Record<BrandKey, string[]> = {
  adminreal: ['adminreal', 'admin real'],
  brnoreal: ['brnoreal', 'brno real'],
  generic: [],
};

export function resolveBrandProfile(managerName?: string | null): BrandProfile {
  if (managerName) {
    const normalized = managerName.toLowerCase();
    if (MANAGER_HINTS.brnoreal.some((hint) => normalized.includes(hint))) {
      return BRAND_PROFILES.brnoreal;
    }
    if (MANAGER_HINTS.adminreal.some((hint) => normalized.includes(hint))) {
      return BRAND_PROFILES.adminreal;
    }
  }
  return BRAND_PROFILES.generic;
}
