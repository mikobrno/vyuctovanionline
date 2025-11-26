/* eslint-disable jsx-a11y/alt-text */
import fs from 'fs';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { BillingPdfData } from '@/lib/billing-pdf-data';
import { format } from 'date-fns';

Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
  fontWeight: 'normal',
});

Font.register({
  family: 'Roboto-Bold',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
  fontWeight: 'bold',
});

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  headerCard: {
    borderWidth: 1.5,
    borderColor: '#f97316',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  ownerName: {
    fontSize: 22,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
  },
  headerLogo: {
    height: 75,
    width: 218,
    objectFit: 'contain',
  },
  brandFallback: {
    fontFamily: 'Roboto-Bold',
    fontSize: 18,
    color: '#f97316',
  },
  headerContent: {
    flexDirection: 'row',
    gap: 40,
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1.5,
  },
  headerRight: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  infoLabel: {
    width: 75,
    fontSize: 8,
    color: '#6b7280',
    fontFamily: 'Roboto-Bold',
  },
  infoValue: {
    fontSize: 11,
    color: '#111827',
    fontFamily: 'Roboto-Bold',
  },
  infoValueBold: {
    fontSize: 11,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
  },
  periodBadge: {
    marginTop: 1,
  },
  periodText: {
    fontSize: 8,
    color: '#6b7280',
  },
  periodValue: {
    fontSize: 10,
    color: '#111827',
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  infoCard: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    marginBottom: 8,
    color: '#111827',
  },
  detailsGrid: {
    flexDirection: 'column',
    gap: 3,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 6,
  },
  detailLabel: {
    width: 70,
    color: '#6b7280',
    fontSize: 8,
  },
  detailValue: {
    color: '#111827',
    fontSize: 9,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 6,
  },
  twoColumnItem: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 8,
    color: '#6b7280',
    width: 80,
  },
  highlightValue: {
    fontFamily: 'Roboto-Bold',
    fontSize: 9,
    color: '#111827',
  },
  metaText: {
    fontSize: 9,
    color: '#374151',
    textAlign: 'right',
  },
  mainHeadline: {
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 3,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 6,
  },
  tableShell: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  tableSectionRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  tableSectionCell: {
    paddingVertical: 6,
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5f5',
  },
  tableHeaderCell: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontFamily: 'Roboto-Bold',
    fontSize: 8,
    color: '#1f2937',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'center',
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    color: '#1f2937',
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
  },
  tableCellRight: {
    textAlign: 'right',
  },
  tableCellCenter: {
    textAlign: 'center',
  },
  tableTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1.5,
    borderTopColor: '#94a3b8',
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: '#111827',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 3,
  },
  simpleTable: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  simpleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  simpleHeader: {
    backgroundColor: '#f8fafc',
    fontFamily: 'Roboto-Bold',
    color: '#1f2937',
  },
  infoText: {
    fontSize: 7,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  resultWrapper: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  resultLabel: {
    fontFamily: 'Roboto-Bold',
    fontSize: 10,
    color: '#111827',
  },
  resultValue: {
    fontFamily: 'Roboto-Bold',
    fontSize: 20,
  },
  qrWrapper: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  qrLabel: {
    fontSize: 8,
    marginTop: 4,
    color: '#6b7280',
  },
  footer: {
    marginTop: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
  },
  dualTables: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  notesCard: {
    marginTop: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    backgroundColor: '#ffffff',
    gap: 3,
  },
});

const resolveLogoSource = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:/i.test(src)) return src;
  try {
    const fileBuffer = fs.readFileSync(src);
    const ext = src.split('.').pop()?.toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${fileBuffer.toString('base64')}`;
  } catch (error) {
    console.warn('Billing PDF: unable to load logo', error);
    return undefined;
  }
};

interface Props {
  data: BillingPdfData;
  qrCodeUrl?: string;
  logoPath?: string;
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00 Kč';
  return (
    amount
      .toLocaleString('cs-CZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      .replace(/\s/g, ' ') + ' Kč'
  );
};

const formatNumber = (amount: number | null | undefined, decimals = 2) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return amount
    .toLocaleString('cs-CZ', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/\s/g, ' ');
};

const formatUnitsValue = (amount: number | null | undefined, decimals = 2) =>
  amount && amount > 0 ? formatNumber(amount, decimals) : '-';

const unitCellStyle = (amount: number | null | undefined) => [
  amount && amount > 0 ? styles.tableCellRight : styles.tableCellCenter,
  !(amount && amount > 0) ? { color: '#9ca3af' } : {},
];

const getMonthLabel = (month: number, year: number) => `${month}/${year}`;

const mergeServices = (services: BillingPdfData['result']['serviceCosts']) => {
  const grouped: BillingPdfData['result']['serviceCosts'] = [];

  const getBaseName = (name: string) =>
    name.startsWith('Ohřev teplé vody') ? 'Ohřev teplé vody' : name;

  const groups = new Map<string, BillingPdfData['result']['serviceCosts']>();

  services.forEach((service) => {
    const base = getBaseName(service.service.name);
    const bucket = groups.get(base);
    if (bucket) {
      bucket.push(service);
    } else {
      groups.set(base, [service]);
    }
  });

  groups.forEach((group, base) => {
    if (base === 'Ohřev teplé vody' && group.length > 1) {
      const merged = { ...group[0] };
      merged.service = {
        ...merged.service,
        name: base,
        measurementUnit: 'viz rozúčtování',
      };
      merged.buildingTotalCost = group.reduce((sum, item) => sum + item.buildingTotalCost, 0);
      merged.unitAdvance = group.reduce((sum, item) => sum + (item.unitAdvance ?? 0), 0);
      merged.unitCost = group.reduce((sum, item) => sum + item.unitCost, 0);
      merged.unitBalance = group.reduce((sum, item) => sum + item.unitBalance, 0);
      merged.buildingConsumption = null;
      merged.unitPricePerUnit = null;
      merged.unitAssignedUnits = null;
      grouped.push(merged);
    } else {
      group.forEach((item) => grouped.push(item));
    }
  });

  return grouped;
};

export const BillingDocument: React.FC<Props> = ({ data, qrCodeUrl, logoPath }) => {
  const { result, building, unit, owner, readings, advances, payments, previousResult } = data;
  const balance = result.result ?? 0;
  const isUnderpayment = balance < 0;
  const previousBalance = previousResult?.result ?? 0;
  const currentPeriodText = isUnderpayment ? 'Nedoplatek v účtovaném období' : 'Přeplatek v účtovaném období';
  const previousPeriodText = previousResult
    ? previousBalance > 0
      ? 'Je evidován v minulém období přeplatek'
      : previousBalance < 0
        ? 'Je evidován v minulém období nedoplatek'
        : 'Není evidován v minulém období přeplatek ani nedoplatek'
    : 'Není evidován v minulém období přeplatek ani nedoplatek';
  const year = result.billingPeriod?.year ?? new Date().getFullYear();

  const managerName = building?.managerName?.toLowerCase() ?? '';
  const defaultLogo = managerName.includes('brnoreal')
    ? 'https://static.vyuctovani.online/branding/brnoreal-logo.png'
    : 'https://static.vyuctovani.online/branding/adminreal-logo.png';
  const logoSource = resolveLogoSource(logoPath) ?? defaultLogo;

  const displayedServices = mergeServices(result.serviceCosts);

  const monthlyPrescriptions = Array.isArray(result.monthlyPrescriptions)
    ? (result.monthlyPrescriptions as Array<number | string | null>)
    : [];

  const monthlyData = Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    const rawPrescription = monthlyPrescriptions[idx];
    const prescribedFromResult =
      typeof rawPrescription === 'number'
        ? rawPrescription
        : typeof rawPrescription === 'string'
          ? parseFloat(rawPrescription)
          : undefined;
    const prescribedFromAdvances = advances
      .filter((advance) => advance.month === month)
      .reduce((sum, advance) => sum + advance.amount, 0);
    const prescribed =
      typeof prescribedFromResult === 'number' ? prescribedFromResult : prescribedFromAdvances;

    const paid = payments
      .filter((payment) => {
        const date = new Date(payment.paymentDate);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

    return { month: getMonthLabel(month, year), paid, prescribed };
  });

  const totalPaid = monthlyData.reduce((sum, entry) => sum + entry.paid, 0);
  const totalPrescribed = monthlyData.reduce((sum, entry) => sum + entry.prescribed, 0);
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);
  const periodRangeLabel = `${format(periodStart, 'd.M.yyyy')} - ${format(periodEnd, 'd.M.yyyy')}`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>{owner.firstName} {owner.lastName}</Text>
              <View style={styles.periodBadge}>
                <Text style={styles.periodText}>Zúčtovací období:</Text>
                <Text style={styles.periodValue}>{periodRangeLabel}</Text>
              </View>
            </View>
            {logoSource ? (
              <Image src={logoSource} style={styles.headerLogo} />
            ) : (
              <Text style={styles.brandFallback}>adminreal</Text>
            )}
          </View>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Adresa:</Text>
                <Text style={styles.infoValue}>{owner.address || building?.address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{owner.email || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefon:</Text>
                <Text style={styles.infoValue}>{owner.phone || '-'}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Jednotka:</Text>
                <Text style={styles.infoValueBold}>{unit.unitNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bankovní:</Text>
                <Text style={styles.infoValueBold}>{owner.bankAccount || building?.bankAccount || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Var. symb.:</Text>
                <Text style={styles.infoValueBold}>{unit.variableSymbol || '-'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.dualTables}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Přehled úhrad za rok {year}</Text>
            <View style={styles.simpleTable}>
              <View style={[styles.simpleRow, styles.simpleHeader]}>
                <Text style={{ flex: 1 }}>Měsíc</Text>
                <Text style={{ width: '50%', textAlign: 'right' }}>Uhrazeno</Text>
              </View>
              {monthlyData.map((item) => (
                <View key={`paid-${item.month}`} style={styles.simpleRow}>
                  <Text style={{ flex: 1 }}>{item.month}</Text>
                  <Text style={{ width: '50%', textAlign: 'right' }}>{formatCurrency(item.paid)}</Text>
                </View>
              ))}
              <View style={[styles.simpleRow, styles.simpleHeader]}>
                <Text style={{ flex: 1 }}>Celkem</Text>
                <Text style={{ width: '50%', textAlign: 'right' }}>{formatCurrency(totalPaid)}</Text>
              </View>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Přehled předpisů za rok {year}</Text>
            <View style={styles.simpleTable}>
              <View style={[styles.simpleRow, styles.simpleHeader]}>
                <Text style={{ flex: 1 }}>Měsíc</Text>
                <Text style={{ width: '50%', textAlign: 'right' }}>Předpis</Text>
              </View>
              {monthlyData.map((item) => (
                <View key={`prescribed-${item.month}`} style={styles.simpleRow}>
                  <Text style={{ flex: 1 }}>{item.month}</Text>
                  <Text style={{ width: '50%', textAlign: 'right' }}>{formatCurrency(item.prescribed)}</Text>
                </View>
              ))}
              <View style={[styles.simpleRow, styles.simpleHeader]}>
                <Text style={{ flex: 1 }}>Celkem</Text>
                <Text style={{ width: '50%', textAlign: 'right' }}>{formatCurrency(totalPrescribed)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Datum: {format(new Date(), 'd.M.yyyy')}</Text>
          <Text>info@adminreal.cz • www.adminreal.cz</Text>
          <Text>www.onlinesprava.cz</Text>
        </View>
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.mainHeadline}>Vyúčtování služeb: {year}</Text>

        <View style={styles.tableShell}>
          <View style={styles.tableSectionRow}>
            <Text style={[styles.tableSectionCell, { width: '30%' }]}>Parametry služby</Text>
            <Text style={[styles.tableSectionCell, { width: '35%' }]}>Celkové náklady domu</Text>
            <Text style={[styles.tableSectionCell, { width: '20%' }]}>Náklady jednotky</Text>
            <Text style={[styles.tableSectionCell, { width: '15%', borderRightWidth: 0 }]}>Vyúčtování</Text>
          </View>

          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'left' }]}>Položka</Text>
            <Text style={[styles.tableHeaderCell, { width: '6%' }]}>Jed.</Text>
            <Text style={[styles.tableHeaderCell, { width: '6%' }]}>Podíl</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Náklad (d)</Text>
            <Text style={[styles.tableHeaderCell, { width: '8%' }]}>Jednotek</Text>
            <Text style={[styles.tableHeaderCell, { width: '9%' }]}>Kč/jedn</Text>
            <Text style={[styles.tableHeaderCell, { width: '8%' }]}>Jednotek</Text>
            <Text style={[styles.tableHeaderCell, { width: '13%' }]}>Náklad</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Záloha</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', borderRightWidth: 0 }]}>Přeplatek / nedoplatek</Text>
          </View>

          {displayedServices
            .filter((service) => !(service.buildingTotalCost === 0 && service.unitAdvance === 0))
            .filter((service) => service.service.name !== 'Celková záloha' && service.service.name !== 'TOTAL_ADVANCE')
            .map((service, index) => (
              <View
                key={`${service.service.id}-${index}`}
                style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: '#fcfdff' } : {}]}
              >
                <Text style={[styles.tableCell, { width: '18%' }]}>{service.service.name}</Text>
                <Text style={[styles.tableCell, styles.tableCellCenter, { width: '6%' }]}>
                  {service.service.measurementUnit || '-'}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellCenter, { width: '6%' }]}>100%</Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: '12%' }]}>{formatCurrency(service.buildingTotalCost)}</Text>
                <Text style={[styles.tableCell, { width: '8%' }, ...unitCellStyle(service.buildingConsumption)]}>
                  {formatUnitsValue(service.buildingConsumption)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: '9%' }]}>{formatNumber(service.unitPricePerUnit)}</Text>
                <Text style={[styles.tableCell, { width: '8%' }, ...unitCellStyle(service.unitAssignedUnits)]}>
                  {formatUnitsValue(service.unitAssignedUnits)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: '13%', fontFamily: 'Roboto-Bold' }]}>{formatCurrency(service.unitCost)}</Text>
                <Text style={[styles.tableCell, styles.tableCellRight, { width: '10%' }]}>{formatCurrency(service.unitAdvance)}</Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.tableCellRight,
                    {
                      width: '10%',
                      borderRightWidth: 0,
                      fontFamily: 'Roboto-Bold',
                      color: service.unitBalance < 0 ? '#dc2626' : '#16a34a',
                    },
                  ]}
                >
                  {formatCurrency(service.unitBalance)}
                </Text>
              </View>
            ))}

          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableCell, { width: '30%', fontFamily: 'Roboto-Bold' }]}>CELKEM NÁKLADY NA ODBĚRNÉ MÍSTO</Text>
            <Text style={[styles.tableCell, { width: '12%' }]} />
            <Text style={[styles.tableCell, { width: '3%' }]} />
            <Text style={[styles.tableCell, styles.tableCellRight, { width: '12%', fontFamily: 'Roboto-Bold' }]}>
              {formatCurrency(displayedServices.reduce((acc, service) => acc + service.buildingTotalCost, 0))}
            </Text>
            <Text style={[styles.tableCell, { width: '8%' }]} />
            <Text style={[styles.tableCell, { width: '9%' }]} />
            <Text style={[styles.tableCell, { width: '8%' }]} />
            <Text style={[styles.tableCell, styles.tableCellRight, { width: '13%', fontFamily: 'Roboto-Bold' }]}>
              {formatCurrency(result.totalCost)}
            </Text>
            <Text style={[styles.tableCell, styles.tableCellRight, { width: '10%', fontFamily: 'Roboto-Bold' }]}>
              {formatCurrency(result.totalAdvancePrescribed)}
            </Text>
            <Text
              style={[
                styles.tableCell,
                styles.tableCellRight,
                {
                  width: '10%',
                  borderRightWidth: 0,
                  fontFamily: 'Roboto-Bold',
                  fontSize: 11,
                  color: isUnderpayment ? '#dc2626' : '#16a34a',
                },
              ]}
            >
              {formatCurrency(balance)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <View style={styles.resultWrapper}>
              <Text style={styles.resultLabel}>Výsledek vyúčtování</Text>
              <Text style={{ fontSize: 11, color: '#6b7280' }}>{isUnderpayment ? 'NEDOPLATEK' : 'PŘEPLATEK'}</Text>
              <Text style={[styles.resultValue, { color: isUnderpayment ? '#dc2626' : '#16a34a' }]}>{formatCurrency(balance)}</Text>
            </View>
            <View style={[styles.simpleTable, { marginTop: 8 }]}>
              <View style={[styles.simpleRow, styles.simpleHeader]}>
                <Text style={{ flex: 1 }}>Období</Text>
                <Text style={{ width: '40%', textAlign: 'right' }}>Částka</Text>
              </View>
              <View style={styles.simpleRow}>
                <Text style={{ flex: 1 }}>{currentPeriodText}</Text>
                <Text style={{ width: '40%', textAlign: 'right', fontFamily: 'Roboto-Bold' }}>{formatCurrency(balance)}</Text>
              </View>
              <View style={styles.simpleRow}>
                <Text style={{ flex: 1 }}>{previousPeriodText}</Text>
                <Text style={{ width: '40%', textAlign: 'right', fontFamily: 'Roboto-Bold' }}>{formatCurrency(previousBalance)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <View style={styles.notesCard}>
              {isUnderpayment ? (
                <Text style={[styles.infoText, { fontFamily: 'Roboto-Bold', color: '#dc2626' }]}>Nedoplatek uhraďte na účet {building?.bankAccount} pod variabilním symbolem {unit.variableSymbol}.</Text>
              ) : (
                <Text style={[styles.infoText, { fontFamily: 'Roboto-Bold', color: '#16a34a' }]}>Přeplatek bude vyplacen na účet {building?.bankAccount}.</Text>
              )}
              <Text style={styles.infoText}>Jednotková cena za m3 vody činila v roce {year} dle ceníku BVaK 105,53 Kč. Hodnota již zahrnuje rozdíl mezi náměrem hlavního a součtem náměrů poměrových vodoměrů.</Text>
              <Text style={styles.infoText}>Případné reklamace uplatněte písemně (elektronicky) na adresu správce uvedenou v záhlaví nejpozději do 30 dnů od doručení.</Text>
              <Text style={styles.infoText}>Přeplatky a nedoplatky jsou splatné nejpozději do 7 měsíců od skončení zúčtovacího období.</Text>
            </View>
          </View>

          {isUnderpayment && qrCodeUrl && (
            <View style={{ width: 120 }}>
              <View style={styles.qrWrapper}>
                <Image src={qrCodeUrl} style={{ width: 80, height: 80 }} />
                <Text style={styles.qrLabel}>QR platba</Text>
              </View>
            </View>
          )}
        </View>

        {readings.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.sectionTitle}>Měřené služby</Text>
            <View style={styles.simpleTable}>
              <View style={[styles.simpleRow, styles.simpleHeader]}>
                <Text style={{ width: '28%' }}>Služba</Text>
                <Text style={{ width: '28%' }}>Měřidlo</Text>
                <Text style={{ width: '14%', textAlign: 'right' }}>Poč. stav</Text>
                <Text style={{ width: '14%', textAlign: 'right' }}>Kon. stav</Text>
                <Text style={{ width: '16%', textAlign: 'right' }}>Spotřeba</Text>
              </View>
              {readings.map((reading, idx) => (
                <View key={`${reading.meterSerial}-${idx}`} style={styles.simpleRow}>
                  <Text style={{ width: '28%' }}>{reading.serviceName}</Text>
                  <Text style={{ width: '28%' }}>{reading.meterSerial}</Text>
                  <Text style={{ width: '14%', textAlign: 'right' }}>{formatNumber(reading.startValue)}</Text>
                  <Text style={{ width: '14%', textAlign: 'right' }}>{formatNumber(reading.endValue)}</Text>
                  <Text style={{ width: '16%', textAlign: 'right', fontFamily: 'Roboto-Bold' }}>{formatNumber(reading.consumption)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Datum: {format(new Date(), 'd.M.yyyy')}</Text>
          <Text>info@adminreal.cz • www.adminreal.cz</Text>
          <Text>www.onlinesprava.cz</Text>
        </View>
      </Page>
    </Document>
  );
};
