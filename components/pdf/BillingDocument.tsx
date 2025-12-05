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

// Barvy inspirované HTML verzí
const colors = {
  primary: '#1e293b',      // slate-800
  secondary: '#64748b',    // slate-500
  accent: '#3b82f6',       // blue-500
  success: '#16a34a',      // green-600
  danger: '#dc2626',       // red-600
  lightGray: '#f8fafc',    // slate-50
  mediumGray: '#e2e8f0',   // slate-200
  border: '#cbd5e1',       // slate-300
  highlight: '#fef9c3',    // yellow-100
};

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontFamily: 'Roboto',
    fontSize: 8,
    color: colors.primary,
    backgroundColor: '#ffffff',
  },
  // Header - podobné HTML
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderColor: colors.mediumGray,
  },
  headerLeft: {
    width: '60%',
  },
  headerRight: {
    width: '35%',
    alignItems: 'flex-end',
  },
  ownerName: {
    fontSize: 14,
    fontFamily: 'Roboto-Bold',
    marginBottom: 6,
    color: colors.primary,
  },
  infoGrid: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoLabel: {
    width: 130,
    fontSize: 7,
    color: colors.secondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 7,
    fontFamily: 'Roboto-Bold',
    color: colors.primary,
  },
  logo: {
    width: 110,
    height: 36,
    objectFit: 'contain',
    marginBottom: 6,
  },
  unitInfo: {
    fontSize: 7,
    color: colors.secondary,
    textAlign: 'right',
    marginTop: 2,
  },
  unitInfoBold: {
    fontSize: 9,
    fontFamily: 'Roboto-Bold',
    color: colors.primary,
  },
  // Title - s pozadím jako v HTML
  titleContainer: {
    backgroundColor: colors.lightGray,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
    color: colors.primary,
  },
  // Main Table - vylepšená verze
  table: {
    width: '100%',
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    minHeight: 22,
    alignItems: 'center',
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontSize: 7,
    fontFamily: 'Roboto-Bold',
    padding: 4,
  },
  tableSubHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderBottomWidth: 2,
    borderColor: colors.border,
    minHeight: 18,
    alignItems: 'center',
  },
  tableSubHeaderCell: {
    fontSize: 7,
    fontFamily: 'Roboto-Bold',
    color: colors.secondary,
    padding: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: colors.mediumGray,
    minHeight: 16,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: colors.lightGray,
  },
  tableCell: {
    fontSize: 7,
    padding: 3,
    color: colors.primary,
  },
  tableCellBold: {
    fontFamily: 'Roboto-Bold',
  },
  tableCellRight: {
    textAlign: 'right',
  },
  tableCellCenter: {
    textAlign: 'center',
  },
  // Šířky sloupců
  colService: { width: '22%' },
  colUnit: { width: '8%' },
  colShare: { width: '6%' },
  colBuildingCost: { width: '11%' },
  colBuildingUnits: { width: '9%' },
  colPricePerUnit: { width: '9%' },
  colUserUnits: { width: '9%' },
  colUserCost: { width: '10%' },
  colAdvance: { width: '8%' },
  colResult: { width: '8%' },
  // Highlight pro náklady uživatele
  highlightCell: {
    backgroundColor: colors.highlight,
  },
  // Totals row
  totalRow: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderTopWidth: 2,
    borderColor: colors.primary,
    minHeight: 22,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 8,
    fontFamily: 'Roboto-Bold',
    color: colors.primary,
    padding: 4,
  },
  totalValue: {
    fontSize: 8,
    fontFamily: 'Roboto-Bold',
    padding: 4,
    textAlign: 'right',
  },
  // Result colors
  positive: { color: colors.success },
  negative: { color: colors.danger },
  // Sekce s měsíčními daty
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Roboto-Bold',
    color: colors.primary,
    backgroundColor: colors.mediumGray,
    padding: 4,
    marginTop: 10,
    marginBottom: 4,
  },
  monthlyContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 10,
  },
  monthlyBox: {
    flex: 1,
  },
  monthlyTable: {
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  monthlyRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: colors.border,
    minHeight: 14,
    alignItems: 'center',
  },
  monthlyLabel: {
    width: 50,
    fontSize: 7,
    padding: 2,
  },
  monthlyValue: {
    flex: 1,
    fontSize: 7,
    textAlign: 'right',
    padding: 2,
  },
  monthlyTotal: {
    backgroundColor: colors.lightGray,
    fontFamily: 'Roboto-Bold',
  },
  // Měřidla
  metersTable: {
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  meterRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: colors.border,
    minHeight: 14,
    alignItems: 'center',
  },
  meterHeader: {
    backgroundColor: colors.lightGray,
    fontFamily: 'Roboto-Bold',
  },
  meterCell: {
    flex: 1,
    fontSize: 7,
    padding: 3,
    textAlign: 'center',
  },
  meterCellService: {
    width: '25%',
    textAlign: 'left',
  },
  // Result section
  resultSection: {
    marginTop: 15,
    borderTopWidth: 2,
    borderColor: colors.primary,
    paddingTop: 10,
  },
  resultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 11,
  },
  resultValue: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
  },
  // Payment info box
  paymentInfo: {
    backgroundColor: colors.lightGray,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 4,
  },
  paymentInfoText: {
    fontSize: 8,
    fontFamily: 'Roboto-Bold',
  },
  // QR section
  qrSection: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  qrLabel: {
    fontSize: 8,
    fontFamily: 'Roboto-Bold',
    marginBottom: 4,
  },
  // Footer
  footer: {
    marginTop: 15,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.mediumGray,
  },
  footerText: {
    fontSize: 6,
    color: colors.secondary,
    marginBottom: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    fontSize: 6,
    color: colors.secondary,
  },
  // Fixed payment section
  fixedPaymentBox: {
    marginTop: 8,
    padding: 6,
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fixedPaymentTitle: {
    fontSize: 8,
    fontFamily: 'Roboto-Bold',
    marginBottom: 4,
  },
  fixedPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fixedPaymentLabel: {
    fontSize: 7,
  },
  fixedPaymentValue: {
    fontSize: 8,
    fontFamily: 'Roboto-Bold',
  },
  noData: {
    textAlign: 'center',
    color: colors.secondary,
    fontStyle: 'italic',
    padding: 8,
    fontSize: 7,
  },
});

const MONTHS = ['1/2024', '2/2024', '3/2024', '4/2024', '5/2024', '6/2024', '7/2024', '8/2024', '9/2024', '10/2024', '11/2024', '12/2024'];
const MONTHS_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '-';
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(val);
};

const formatNumber = (val: number | null | undefined, decimals = 2): string => {
  if (val === null || val === undefined) return '-';
  return new Intl.NumberFormat('cs-CZ', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  }).format(val);
};

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
  const ownerName = summary.owner || summary.ownerName || (data.owner ? `${data.owner.firstName} ${data.owner.lastName}` : 'Neznámý vlastník');
  const address = summary.address || unit.address || building?.address;
  const email = summary.email || (data.owner ? data.owner.email : '');
  const bankAccount = summary.bankAccount || data.owner?.bankAccount || '';
  const variableSymbol = unit.variableSymbol || summary.variableSymbol || '';
  
  // Filter services - oddělíme fond oprav
  const fundServices = result.serviceCosts.filter(sc => 
    sc.service.name.toLowerCase().includes('fond')
  );
  const mainServices = result.serviceCosts.filter(sc => 
    !sc.service.name.toLowerCase().includes('fond')
  ).filter(sc => 
    // Vyfiltruj služby s nulovými náklady a zálohami
    sc.buildingTotalCost !== 0 || sc.unitAdvance !== 0 || sc.unitCost !== 0
  );
  
  // Totals
  const totalBuildingCost = mainServices.reduce((sum, sc) => sum + sc.buildingTotalCost, 0);
  const totalUnitCost = result.totalCost;
  const totalAdvance = result.totalAdvancePrescribed;
  const totalBalance = result.result;

  // Monthly data
  const monthlyPrescriptions = (result.monthlyPrescriptions as number[]) || Array(12).fill(0);
  const monthlyPayments = (result.monthlyPayments as number[]) || Array(12).fill(0);
  const hasMonthlyData = monthlyPrescriptions.some(v => v > 0) || monthlyPayments.some(v => v > 0);

  // Fixed payments (Fond oprav) from summary
  const fixedPayments = summary.fixedPayments || fundServices.map(f => ({
    name: f.service.name,
    value: f.unitCost
  }));

  const year = result.billingPeriod.year;

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.ownerName}>{ownerName}</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>adresa společenství:</Text>
                <Text style={styles.infoValue}>{building?.address}, {building?.zip} {building?.city}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>bankovní spojení společenství:</Text>
                <Text style={styles.infoValue}>{building?.bankAccount || '-'}</Text>
              </View>
              {email && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>e-mail:</Text>
                  <Text style={styles.infoValue}>{email}</Text>
                </View>
              )}
              {bankAccount && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>bankovní spojení člena:</Text>
                  <Text style={styles.infoValue}>{bankAccount}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>variabilní symbol pro platbu:</Text>
                <Text style={styles.infoValue}>{variableSymbol}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            {logoPath && <Image src={logoPath} style={styles.logo} />}
            <Text style={styles.unitInfoBold}>č. prostoru: {unit.name}</Text>
            <Text style={styles.unitInfo}>zúčtovací období: 1.1.{year} - 31.12.{year}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Vyúčtování služeb: {year}</Text>
        </View>

        {/* Main Table */}
        <View style={styles.table}>
          {/* Group Headers */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.colService, styles.colUnit, styles.colShare, { width: '36%' }]}>
              <Text style={styles.tableHeaderCell}>Parametry služby</Text>
            </View>
            <View style={[styles.colBuildingCost, styles.colBuildingUnits, styles.colPricePerUnit, { width: '29%' }]}>
              <Text style={[styles.tableHeaderCell, { textAlign: 'center' }]}>Celkové náklady domu</Text>
            </View>
            <View style={[styles.colUserUnits, styles.colUserCost, { width: '19%' }]}>
              <Text style={[styles.tableHeaderCell, { textAlign: 'center' }]}>Náklady jednotky</Text>
            </View>
            <View style={[styles.colAdvance, styles.colResult, { width: '16%' }]}>
              <Text style={[styles.tableHeaderCell, { textAlign: 'center' }]}>Vyúčtování</Text>
            </View>
          </View>
          
          {/* Sub Headers */}
          <View style={styles.tableSubHeaderRow}>
            <View style={styles.colService}><Text style={styles.tableSubHeaderCell}>Položka</Text></View>
            <View style={styles.colUnit}><Text style={[styles.tableSubHeaderCell, styles.tableCellCenter]}>Jednotka</Text></View>
            <View style={styles.colShare}><Text style={[styles.tableSubHeaderCell, styles.tableCellCenter]}>Podíl</Text></View>
            <View style={styles.colBuildingCost}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Náklad</Text></View>
            <View style={styles.colBuildingUnits}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Jednotek</Text></View>
            <View style={styles.colPricePerUnit}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Kč/jedn</Text></View>
            <View style={styles.colUserUnits}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Jednotek</Text></View>
            <View style={styles.colUserCost}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Náklad</Text></View>
            <View style={styles.colAdvance}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Záloha</Text></View>
            <View style={styles.colResult}><Text style={[styles.tableSubHeaderCell, styles.tableCellRight]}>Rozdíl</Text></View>
          </View>

          {/* Data Rows */}
          {mainServices.map((sc, i) => {
            const isAlt = i % 2 === 1;
            const meters = parseMeterReadings(sc.meterReadings);
            
            return (
              <View key={i} style={[styles.tableRow, isAlt && styles.tableRowAlt]}>
                <View style={styles.colService}>
                  <Text style={[styles.tableCell, styles.tableCellBold]}>{sc.service.name}</Text>
                </View>
                <View style={styles.colUnit}>
                  <Text style={[styles.tableCell, styles.tableCellCenter]}>
                    {sc.service.measurementUnit || '-'}
                  </Text>
                </View>
                <View style={styles.colShare}>
                  <Text style={[styles.tableCell, styles.tableCellCenter]}>
                    {sc.share ? `${sc.share}%` : '-'}
                  </Text>
                </View>
                <View style={styles.colBuildingCost}>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>
                    {formatCurrency(sc.buildingTotalCost)}
                  </Text>
                </View>
                <View style={styles.colBuildingUnits}>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>
                    {sc.buildingUnits || (sc.buildingConsumption ? formatNumber(sc.buildingConsumption) : '-')}
                  </Text>
                </View>
                <View style={styles.colPricePerUnit}>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>
                    {sc.unitPrice || (sc.unitPricePerUnit ? formatNumber(sc.unitPricePerUnit) : '-')}
                  </Text>
                </View>
                <View style={styles.colUserUnits}>
                  <Text style={[styles.tableCell, styles.tableCellRight, styles.tableCellBold]}>
                    {sc.unitUnits || (sc.unitConsumption ? formatNumber(sc.unitConsumption) : '-')}
                  </Text>
                </View>
                <View style={[styles.colUserCost, styles.highlightCell]}>
                  <Text style={[styles.tableCell, styles.tableCellRight, styles.tableCellBold]}>
                    {formatCurrency(sc.unitCost)}
                  </Text>
                </View>
                <View style={styles.colAdvance}>
                  <Text style={[styles.tableCell, styles.tableCellRight]}>
                    {formatCurrency(sc.unitAdvance)}
                  </Text>
                </View>
                <View style={styles.colResult}>
                  <Text style={[
                    styles.tableCell, 
                    styles.tableCellRight, 
                    styles.tableCellBold,
                    sc.unitBalance >= 0 ? styles.positive : styles.negative
                  ]}>
                    {formatCurrency(sc.unitBalance)}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Total Row */}
          <View style={styles.totalRow}>
            <View style={[styles.colService, styles.colUnit, styles.colShare, { width: '36%' }]}>
              <Text style={styles.totalLabel}>CELKEM NÁKLADY NA ODBĚRNÉ MÍSTO</Text>
            </View>
            <View style={styles.colBuildingCost}>
              <Text style={styles.totalValue}>{formatCurrency(totalBuildingCost)}</Text>
            </View>
            <View style={styles.colBuildingUnits}><Text style={styles.tableCell}></Text></View>
            <View style={styles.colPricePerUnit}><Text style={styles.tableCell}></Text></View>
            <View style={styles.colUserUnits}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.colUserCost, { backgroundColor: colors.highlight }]}>
              <Text style={styles.totalValue}>{formatCurrency(totalUnitCost)}</Text>
            </View>
            <View style={styles.colAdvance}>
              <Text style={styles.totalValue}>{formatCurrency(totalAdvance)}</Text>
            </View>
            <View style={styles.colResult}>
              <Text style={[
                styles.totalValue,
                { fontSize: 10 },
                totalBalance >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(totalBalance)}
              </Text>
            </View>
          </View>
        </View>

        {/* Fixed Payments - Fond oprav */}
        {(fixedPayments.length > 0 || fundServices.length > 0) && (
          <View style={styles.fixedPaymentBox}>
            <Text style={styles.fixedPaymentTitle}>Pevné platby</Text>
            {fundServices.map((fp, i) => (
              <View key={i} style={styles.fixedPaymentRow}>
                <Text style={styles.fixedPaymentLabel}>{fp.service.name}</Text>
                <Text style={styles.fixedPaymentValue}>{formatCurrency(fp.unitCost)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Monthly Data - side by side */}
        <View style={styles.monthlyContainer}>
          {/* Úhrady */}
          <View style={styles.monthlyBox}>
            <Text style={styles.sectionTitle}>Přehled úhrad za rok {year}</Text>
            {hasMonthlyData ? (
              <View style={styles.monthlyTable}>
                {monthlyPayments.map((val, i) => (
                  <View key={i} style={styles.monthlyRow}>
                    <Text style={styles.monthlyLabel}>{MONTHS_SHORT[i]}</Text>
                    <Text style={styles.monthlyValue}>
                      {val > 0 ? formatCurrency(val) : '-'}
                    </Text>
                  </View>
                ))}
                <View style={[styles.monthlyRow, styles.monthlyTotal]}>
                  <Text style={styles.monthlyLabel}>Celkem</Text>
                  <Text style={styles.monthlyValue}>
                    {formatCurrency(monthlyPayments.reduce((a, b) => a + b, 0))}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noData}>Data nejsou k dispozici</Text>
            )}
          </View>

          {/* Předpisy */}
          <View style={styles.monthlyBox}>
            <Text style={styles.sectionTitle}>Přehled předpisů za rok {year}</Text>
            {hasMonthlyData ? (
              <View style={styles.monthlyTable}>
                {monthlyPrescriptions.map((val, i) => (
                  <View key={i} style={styles.monthlyRow}>
                    <Text style={styles.monthlyLabel}>{MONTHS_SHORT[i]}</Text>
                    <Text style={styles.monthlyValue}>
                      {val > 0 ? formatCurrency(val) : '-'}
                    </Text>
                  </View>
                ))}
                <View style={[styles.monthlyRow, styles.monthlyTotal]}>
                  <Text style={styles.monthlyLabel}>Celkem</Text>
                  <Text style={styles.monthlyValue}>
                    {formatCurrency(monthlyPrescriptions.reduce((a, b) => a + b, 0))}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noData}>Data nejsou k dispozici</Text>
            )}
          </View>
        </View>

        {/* Měřené služby */}
        {data.readings && data.readings.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Měřené služby</Text>
            <View style={styles.metersTable}>
              <View style={[styles.meterRow, styles.meterHeader]}>
                <Text style={[styles.meterCell, styles.meterCellService]}>Služba</Text>
                <Text style={styles.meterCell}>Měřidlo</Text>
                <Text style={styles.meterCell}>Poč. stav</Text>
                <Text style={styles.meterCell}>Kon. stav</Text>
                <Text style={styles.meterCell}>Spotřeba</Text>
              </View>
              {data.readings.map((r, i) => (
                <View key={i} style={styles.meterRow}>
                  <Text style={[styles.meterCell, styles.meterCellService]}>{r.serviceName}</Text>
                  <Text style={styles.meterCell}>{r.meterSerial}</Text>
                  <Text style={styles.meterCell}>{formatNumber(r.startValue, 0)}</Text>
                  <Text style={styles.meterCell}>{formatNumber(r.endValue, 0)}</Text>
                  <Text style={[styles.meterCell, styles.tableCellBold]}>{formatNumber(r.consumption, 0)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Result Section */}
        <View style={styles.resultSection}>
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>
              Výsledek vyúčtování: {' '}
              <Text style={[styles.tableCellBold, totalBalance >= 0 ? styles.positive : styles.negative]}>
                {totalBalance >= 0 ? 'PŘEPLATEK' : 'NEDOPLATEK'}
              </Text>
            </Text>
            <Text style={[styles.resultValue, totalBalance >= 0 ? styles.positive : styles.negative]}>
              {formatCurrency(Math.abs(totalBalance))}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={{ flex: 2 }}>
              {totalBalance < 0 ? (
                <View style={[styles.paymentInfo, { borderColor: colors.danger }]}>
                  <Text style={styles.paymentInfoText}>
                    Nedoplatek uhraďte na účet číslo: {building?.bankAccount} pod variabilním symbolem {variableSymbol}
                  </Text>
                </View>
              ) : (
                <View style={[styles.paymentInfo, { borderColor: colors.success }]}>
                  <Text style={styles.paymentInfoText}>
                    Přeplatek Vám bude vyplacen na číslo účtu {bankAccount || building?.bankAccount}
                  </Text>
                </View>
              )}

              <View style={{ marginTop: 8 }}>
                <Text style={styles.footerText}>
                  Jednotková cena za m3 vody činila v roce {year} dle ceníku BVaK 105,53 Kč.
                </Text>
                <Text style={styles.footerText}>
                  Případné reklamace uplatněte písemně do 30 dnů od doručení vyúčtování.
                </Text>
                <Text style={styles.footerText}>
                  Přeplatky a nedoplatky jsou splatné do 7 měsíců od skončení zúčtovacího období.
                </Text>
              </View>
            </View>

            {/* QR Code */}
            {qrCodeUrl && totalBalance < 0 && (
              <View style={styles.qrSection}>
                <Text style={styles.qrLabel}>QR Platba</Text>
                <Image src={qrCodeUrl} style={styles.qrImage} />
                <Text style={{ fontSize: 6, marginTop: 2 }}>Naskenujte pro platbu</Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text>Datum: {format(new Date(), 'dd.MM.yyyy')}</Text>
            <Text>{building?.email || 'info@adminreal.cz'} | mobil: 607 959 876</Text>
            <Text>www.adminreal.cz | www.onlinesprava.cz</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
