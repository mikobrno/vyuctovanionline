/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { BillingPdfData } from '@/lib/billing-pdf-data';
import { format } from 'date-fns';

// Register fonts
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

// Pomocné typy
interface MeterReading {
  serial: string;
  start: number;
  end: number;
  consumption: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontFamily: 'Roboto',
    fontSize: 7,
    color: '#000000',
  },
  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    width: '60%',
  },
  headerRight: {
    width: '40%',
    alignItems: 'flex-end',
  },
  ownerName: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
    marginBottom: 3,
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  label: {
    width: 110,
    fontFamily: 'Roboto-Bold',
    fontSize: 7,
  },
  value: {
    fontFamily: 'Roboto',
    fontSize: 7,
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
    marginBottom: 3,
  },
  // Title
  titleContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingVertical: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 11,
    fontFamily: 'Roboto-Bold',
  },
  // Main Table
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 12,
    alignItems: 'center',
  },
  tableRowNoBorder: {
    flexDirection: 'row',
    minHeight: 12,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#e5e7eb',
    fontFamily: 'Roboto-Bold',
  },
  // Sloupce hlavní tabulky - přizpůsobené pro EXPORT_FULL
  colPolozka: { width: '25%', paddingLeft: 4 },
  colDumJednotek: { width: '10%', textAlign: 'right', paddingRight: 4 }, // Nový
  colDumNaklad: { width: '12%', textAlign: 'right', paddingRight: 4 },
  colCenaJedn: { width: '10%', textAlign: 'right', paddingRight: 4 },    // Nový
  colUzivJednotek: { width: '10%', textAlign: 'right', paddingRight: 4 }, // Spotřeba
  colUzivNaklad: { width: '11%', textAlign: 'right', paddingRight: 4 },
  colUzivZaloha: { width: '11%', textAlign: 'right', paddingRight: 4 },
  colUzivPreplatek: { width: '11%', textAlign: 'right', paddingRight: 4 },
  // Měřidla
  meterTable: {
    marginLeft: 20,
    marginBottom: 3,
    borderWidth: 0.5,
    borderColor: '#999999',
  },
  meterRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#999999',
    minHeight: 10,
    alignItems: 'center',
  },
  meterCell: {
    width: 55,
    fontSize: 6,
    padding: 1,
    textAlign: 'center',
  },
  meterHeader: {
    backgroundColor: '#f0f0f0',
    fontFamily: 'Roboto-Bold',
  },
  // Pevné platby
  fixedPaymentWrapper: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 8,
  },
  fixedPaymentHeader: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  fixedPaymentRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 14,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  fixedPaymentName: {
    flex: 1,
    fontSize: 7,
  },
  fixedPaymentAmount: {
    width: 80,
    textAlign: 'right',
    fontSize: 7,
    fontFamily: 'Roboto-Bold',
  },
  // Měsíční přehled
  monthlySection: {
    marginTop: 10,
  },
  monthlyTitle: {
    fontSize: 9,
    fontFamily: 'Roboto-Bold',
    marginBottom: 3,
  },
  monthlyTable: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  monthlyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 14,
    alignItems: 'center',
  },
  monthlyRowLast: {
    borderBottomWidth: 0,
  },
  monthlyLabel: {
    width: 55,
    padding: 2,
    fontFamily: 'Roboto-Bold',
    backgroundColor: '#f0f0f0',
    fontSize: 7,
  },
  monthlyCell: {
    flex: 1,
    padding: 2,
    borderRightWidth: 1,
    borderColor: '#000000',
    textAlign: 'center',
    fontSize: 6,
  },
  monthlyCellLast: {
    borderRightWidth: 0,
  },
  monthlyCellHead: { flex: 1, fontSize: 7, textAlign: 'center', padding: 2 },
  monthlyHeader: { backgroundColor: '#f3f4f6', fontFamily: 'Roboto-Bold', borderBottomWidth: 1, borderColor: '#000' },
  // Výsledky
  resultPositive: {
    color: '#228B22',
  },
  resultNegative: {
    color: '#DC143C',
  },
  noData: {
    textAlign: 'center',
    color: '#666666',
    fontStyle: 'italic',
    padding: 8,
    fontSize: 7,
  },
  // Footer
  footer: {
    marginTop: 15,
    borderTopWidth: 1,
    borderColor: '#000000',
    paddingTop: 4,
    fontSize: 6,
  },
});

const MONTHS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
};

const formatNumber = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
};

const formatInteger = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '-';
  return Math.round(val).toLocaleString('cs-CZ');
};

// Parsuje JSON pole měřidel
const parseMeterReadings = (jsonStr: string | null | undefined): MeterReading[] => {
  if (!jsonStr) return [];
  try {
    return JSON.parse(jsonStr) as MeterReading[];
  } catch {
    return [];
  }
};

interface BillingDocumentProps {
  data: BillingPdfData;
  logoPath: string;
  qrCodeUrl?: string;
}

export const BillingDocument: React.FC<BillingDocumentProps> = ({ data, logoPath, qrCodeUrl }) => {
  const { result, unit, building } = data;
  
  // Parse summaryJson if available
  const summary = result.summaryJson ? JSON.parse(result.summaryJson) : {};
  const ownerName = summary.owner || summary.ownerName || (data.owner ? data.owner.firstName + ' ' + data.owner.lastName : 'Neznámý vlastník');
  const address = summary.address || unit.address || building?.address;
  const email = summary.email || (data.owner ? data.owner.email : '');
  const normalizeSummaryString = (val: unknown): string | undefined => {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const parseSummaryAmount = (val: unknown): number | null => {
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string') {
      const cleaned = val.replace(/[\s\u00A0]/g, '').replace(',', '.').replace(/[^0-9+\-.]/g, '');
      if (!cleaned) {
        return null;
      }
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const parseFixedPayments = (): { name: string; amount: number }[] => {
    if (!Array.isArray(summary.fixedPayments)) {
      return [];
    }
    return (summary.fixedPayments as Array<{ name?: string; amount?: number | string }>).
      map(payment => {
        const name = normalizeSummaryString(payment?.name);
        const amount = parseSummaryAmount(payment?.amount ?? undefined);
        if (!name || amount === null) {
          return null;
        }
        return { name, amount };
      }).
      filter((payment): payment is { name: string; amount: number } => Boolean(payment));
  };
  const summaryBankAccount = normalizeSummaryString(summary.bankAccount);
  const summaryVariableSymbol = normalizeSummaryString(summary.vs) || normalizeSummaryString(summary.variableSymbol);
  const summaryResultNote = normalizeSummaryString(summary.resultNote);
  const effectiveBankAccount = summaryBankAccount || building?.bankAccount;
  const effectiveVariableSymbol = unit.variableSymbol || summaryVariableSymbol;
  const fixedPayments = parseFixedPayments();
  
  // Filter services
  const fundServices = result.serviceCosts.filter(sc => 
    sc.service.name.toLowerCase().includes('fond oprav') ||
    sc.service.name.toLowerCase().includes('fond')
  );
  const mainServices = result.serviceCosts.filter(sc => 
    !sc.service.name.toLowerCase().includes('fond oprav') &&
    !sc.service.name.toLowerCase().includes('fond')
  );
  
  // Totals
  const totalBuildingCost = mainServices.reduce((sum, sc) => sum + sc.buildingTotalCost, 0);
  const totalUnitCost = result.totalCost;
  const totalAdvance = result.totalAdvancePrescribed;
  const totalBalance = result.result;

  // Monthly data - z databáze
  const monthlyPrescriptions = (result.monthlyPrescriptions as number[]) || Array(12).fill(0);
  const monthlyPayments = (result.monthlyPayments as number[]) || Array(12).fill(0);
  const hasMonthlyData = monthlyPrescriptions.some(v => v > 0) || monthlyPayments.some(v => v > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.ownerName}>{ownerName}</Text>
            <View style={styles.addressRow}>
              <Text style={styles.label}>adresa společenství:</Text>
              <Text style={styles.value}>{building?.address}, {building?.zip} {building?.city}</Text>
            </View>
            <View style={styles.addressRow}>
              <Text style={styles.label}>bankovní spojení:</Text>
              <Text style={styles.value}>{effectiveBankAccount || '-'}</Text>
            </View>
            {email && (
              <View style={styles.addressRow}>
                <Text style={styles.label}>e-mail:</Text>
                <Text style={styles.value}>{email}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {logoPath && <Image src={logoPath} style={styles.logo} />}
            <Text style={{ fontSize: 9, fontFamily: 'Roboto-Bold' }}>č. prostoru: {unit.name}</Text>
            <Text style={{ fontSize: 7 }}>VS: {effectiveVariableSymbol || '-'}</Text>
            <Text style={{ fontSize: 7 }}>období: 1.1.{result.billingPeriod.year} - 31.12.{result.billingPeriod.year}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Vyúčtování služeb: {result.billingPeriod.year}</Text>
        </View>

        {/* Main Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.colPolozka}><Text>Služba</Text></View>
            <View style={styles.colDumJednotek}><Text>Jedn. dům</Text></View>
            <View style={styles.colDumNaklad}><Text>Náklad dům</Text></View>
            <View style={styles.colCenaJedn}><Text>Kč/jedn.</Text></View>
            <View style={styles.colUzivJednotek}><Text>Spotřeba</Text></View>
            <View style={styles.colUzivNaklad}><Text>Náklad</Text></View>
            <View style={styles.colUzivZaloha}><Text>Záloha</Text></View>
            <View style={styles.colUzivPreplatek}><Text>Rozdíl</Text></View>
          </View>

          {/* Data Rows - služby */}
          {mainServices.map((sc, i) => {
            const meters = parseMeterReadings(sc.meterReadings);
            const hasMeters = meters.length > 0;
            
            return (
              <React.Fragment key={i}>
                <View style={styles.tableRow}>
                  <View style={styles.colPolozka}><Text>{sc.service.name}</Text></View>
                  
                  {/* Nové sloupce z DB (String) nebo fallback na čísla */}
                  <View style={styles.colDumJednotek}>
                    <Text>{sc.buildingUnits || formatNumber(sc.buildingConsumption)}</Text>
                  </View>
                  
                  <View style={styles.colDumNaklad}><Text>{formatCurrency(sc.buildingTotalCost)}</Text></View>
                  
                  <View style={styles.colCenaJedn}>
                    <Text>{sc.unitPrice || formatNumber(sc.unitPricePerUnit)}</Text>
                  </View>
                  
                  <View style={styles.colUzivJednotek}>
                    <Text>{sc.unitUnits || formatNumber(sc.unitConsumption)}</Text>
                  </View>
                  
                  <View style={styles.colUzivNaklad}><Text>{formatCurrency(sc.unitCost)}</Text></View>
                  <View style={styles.colUzivZaloha}><Text>{formatCurrency(sc.unitAdvance)}</Text></View>
                  <View style={styles.colUzivPreplatek}>
                    <Text style={sc.unitBalance >= 0 ? styles.resultPositive : styles.resultNegative}>
                      {formatCurrency(sc.unitBalance)}
                    </Text>
                  </View>
                </View>
                
                {/* Tabulka měřidel pod službou */}
                {hasMeters && (
                  <View style={styles.meterTable}>
                    <View style={[styles.meterRow, styles.meterHeader]}>
                      <Text style={styles.meterCell}>Č. měřidla</Text>
                      <Text style={styles.meterCell}>Poč. stav</Text>
                      <Text style={styles.meterCell}>Kon. stav</Text>
                      <Text style={styles.meterCell}>Spotřeba</Text>
                    </View>
                    {meters.map((m, mIdx) => (
                      <React.Fragment key={mIdx}>
                        <View style={[styles.meterRow, mIdx === meters.length - 1 && { borderBottomWidth: 0 }]}>
                          <Text style={styles.meterCell}>{m.serial}</Text>
                          <Text style={styles.meterCell}>{formatInteger(m.start)}</Text>
                          <Text style={styles.meterCell}>{formatInteger(m.end)}</Text>
                          <Text style={styles.meterCell}>{formatInteger(m.consumption)}</Text>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </React.Fragment>
            );
          })}
          
          {/* Fond oprav */}
          {fundServices.map((sc, i) => (
            <React.Fragment key={`fund-${i}`}>
              <View style={styles.tableRow}>
                <View style={styles.colPolozka}><Text>{sc.service.name}</Text></View>
                <View style={styles.colDumJednotek}><Text>-</Text></View>
                <View style={styles.colDumNaklad}><Text>{formatCurrency(sc.buildingTotalCost)}</Text></View>
                <View style={styles.colCenaJedn}><Text>-</Text></View>
                <View style={styles.colUzivJednotek}><Text>-</Text></View>
                <View style={styles.colUzivNaklad}><Text>{formatCurrency(sc.unitCost)}</Text></View>
                <View style={styles.colUzivZaloha}><Text>{formatCurrency(sc.unitAdvance)}</Text></View>
                <View style={styles.colUzivPreplatek}>
                  <Text style={sc.unitBalance >= 0 ? styles.resultPositive : styles.resultNegative}>
                    {formatCurrency(sc.unitBalance)}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          ))}
          
          {/* Total Row */}
          <View style={[styles.tableRowNoBorder, styles.tableHeader]}>
            <View style={{ width: '30%', paddingLeft: 2 }}><Text>Celkem náklady</Text></View>
            <View style={styles.colDumNaklad}>
              <Text>{formatCurrency(totalBuildingCost)}</Text>
            </View>
            <View style={{ width: '14%', textAlign: 'right', paddingRight: 2, borderRightWidth: 1, borderColor: '#000000' }}>
              <Text>Celkem:</Text>
            </View>
            <View style={{ width: '7%' }} />
            <View style={styles.colUzivNaklad}><Text>{formatCurrency(totalUnitCost)}</Text></View>
            <View style={styles.colUzivZaloha}><Text>{formatCurrency(totalAdvance)}</Text></View>
            <View style={styles.colUzivPreplatek}>
              <Text style={[{ fontFamily: 'Roboto-Bold' }, totalBalance >= 0 ? styles.resultPositive : styles.resultNegative]}>
                {formatCurrency(totalBalance)}
              </Text>
            </View>
          </View>
        </View>

        {fixedPayments.length > 0 && (
          <View style={styles.fixedPaymentWrapper}>
            <View style={styles.fixedPaymentHeader}>
              <Text style={{ fontFamily: 'Roboto-Bold' }}>Pevné platby</Text>
            </View>
            {fixedPayments.map((payment, idx) => (
              <View key={idx} style={[styles.fixedPaymentRow, idx === fixedPayments.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.fixedPaymentName}>{payment.name}</Text>
                <Text style={styles.fixedPaymentAmount}>{formatCurrency(payment.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Summary */}
        <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', marginTop: 3 }}>
            <Text style={{ fontFamily: 'Roboto-Bold', fontSize: 11, marginRight: 10 }}>
              {totalBalance >= 0 ? 'PŘEPLATEK CELKEM:' : 'NEDOPLATEK CELKEM:'}
            </Text>
            <Text style={[{ fontFamily: 'Roboto-Bold', fontSize: 11 }, totalBalance >= 0 ? styles.resultPositive : styles.resultNegative]}>
              {formatCurrency(Math.abs(totalBalance))} Kč
            </Text>
          </View>
          {summary.bankAccount && totalBalance > 0 && (
            <View style={{ backgroundColor: '#e5e7eb', padding: 3, marginTop: 2 }}>
              <Text style={{ fontFamily: 'Roboto-Bold', fontSize: 7 }}>
                Přeplatek bude vyplacen na účet: {summary.bankAccount}
              </Text>
            </View>
          )}
          {summaryResultNote && (
            <View style={{ backgroundColor: '#dbeafe', padding: 4, marginTop: 4, borderLeftWidth: 2, borderColor: '#1d4ed8' }}>
              <Text style={{ fontFamily: 'Roboto-Bold', fontSize: 7 }}>{summaryResultNote}</Text>
            </View>
          )}
        </View>

        {/* Měsíční přehled plateb */}
        <View style={styles.monthlySection}>
          <Text style={styles.monthlyTitle}>Přehled plateb za rok {result.billingPeriod.year}</Text>
          
          {hasMonthlyData ? (
            <View style={styles.monthlyTable}>
              {/* Hlavička měsíců */}
              <View style={styles.monthlyRow}>
                <Text style={styles.monthlyLabel}></Text>
                {MONTHS.map((m, i) => (
                  <React.Fragment key={i}>
                    <Text style={[styles.monthlyCell, i === 11 && styles.monthlyCellLast]}>
                      {m}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
              
              {/* Předpisy */}
              <View style={styles.monthlyRow}>
                <Text style={styles.monthlyLabel}>Předpis</Text>
                {monthlyPrescriptions.map((val, i) => (
                  <React.Fragment key={i}>
                    <Text style={[styles.monthlyCell, i === 11 && styles.monthlyCellLast]}>
                      {val > 0 ? formatInteger(val) : '-'}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
              
              {/* Úhrady */}
              <View style={styles.monthlyRow}>
                <Text style={styles.monthlyLabel}>Úhrada</Text>
                {monthlyPayments.map((val, i) => (
                  <React.Fragment key={i}>
                    <Text style={[styles.monthlyCell, i === 11 && styles.monthlyCellLast]}>
                      {val > 0 ? formatInteger(val) : '-'}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
              
              {/* Rozdíl */}
              <View style={[styles.monthlyRow, styles.monthlyRowLast]}>
                <Text style={styles.monthlyLabel}>Rozdíl</Text>
                {monthlyPrescriptions.map((presc, i) => {
                  const diff = presc - monthlyPayments[i];
                  const hasData = presc > 0 || monthlyPayments[i] > 0;
                  return (
                    <React.Fragment key={i}>
                      <Text style={[
                        styles.monthlyCell, 
                        i === 11 && styles.monthlyCellLast,
                        diff > 0 ? styles.resultNegative : (diff < 0 ? styles.resultPositive : {})
                      ]}>
                        {hasData ? formatInteger(diff) : '-'}
                      </Text>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.noData}>Měsíční data nejsou k dispozici</Text>
          )}
        </View>

        {/* QR kód pro platbu nedoplatku */}
        {qrCodeUrl && totalBalance < 0 && (
          <View style={{ marginTop: 10, alignItems: 'center' }}>
            <Image src={qrCodeUrl} style={{ width: 80, height: 80 }} />
            <Text style={{ fontSize: 6, marginTop: 2 }}>QR platba nedoplatku</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Případné reklamace uplatněte písemnou formou na adrese správce nejpozději do 30 dní od doručení vyúčtování.</Text>
          <Text style={{ marginTop: 3 }}>Přeplatek bude vyplacen do 2 měsíců od doručení. Nedoplatek uhraďte na účet společenství pod VS uvedeným výše.</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
            <Text>Datum: {format(new Date(), 'dd.MM.yyyy')}</Text>
            <Text>{building?.email || 'info@adminreal.cz'}</Text>
            <Text>www.onlinesprava.cz</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
