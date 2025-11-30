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

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Roboto',
    fontSize: 8,
    color: '#000000',
  },
  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    width: '60%',
  },
  headerRight: {
    width: '40%',
    alignItems: 'flex-end',
  },
  ownerName: {
    fontSize: 14,
    fontFamily: 'Roboto-Bold',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    width: 120,
    fontFamily: 'Roboto-Bold',
  },
  value: {
    fontFamily: 'Roboto',
  },
  logo: {
    width: 150,
    height: 50,
    objectFit: 'contain',
    marginBottom: 5,
  },
  // Title
  titleContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingVertical: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
  },
  // Main Table
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 14,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#e5e7eb',
    fontFamily: 'Roboto-Bold',
  },
  colPolozka: { width: '25%', paddingLeft: 2 },
  colJednotka: { width: '10%', textAlign: 'center' },
  colPodil: { width: '5%', textAlign: 'center' },
  // Odběrné místo group
  colOdbNaklad: { width: '10%', textAlign: 'right', paddingRight: 2 },
  colOdbJednotek: { width: '8%', textAlign: 'right', paddingRight: 2 },
  colOdbCena: { width: '8%', textAlign: 'right', paddingRight: 2 },
  // Uživatel group
  colUzivJednotek: { width: '8%', textAlign: 'right', paddingRight: 2 },
  colUzivNaklad: { width: '10%', textAlign: 'right', paddingRight: 2 },
  colUzivZaloha: { width: '8%', textAlign: 'right', paddingRight: 2 },
  colUzivPreplatek: { width: '8%', textAlign: 'right', paddingRight: 2 },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
    marginBottom: 2,
  },
  summaryLabel: {
    fontFamily: 'Roboto-Bold',
    marginRight: 10,
  },
  summaryValue: {
    fontFamily: 'Roboto-Bold',
    width: 80,
    textAlign: 'right',
  },
  
  // Fixed Payments & Monthly
  bottomSection: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 20,
  },
  fixedTable: {
    width: '30%',
    borderWidth: 1,
    borderColor: '#000000',
  },
  monthlyTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 10,
  },
  
  // Footer
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderColor: '#000000',
    paddingTop: 5,
    fontSize: 7,
  },
});

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
};

const formatNumber = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
};

interface BillingDocumentProps {
  data: BillingPdfData;
  logoPath: string;
  qrCodeUrl?: string;
}

export const BillingDocument: React.FC<BillingDocumentProps> = ({ data, logoPath }) => {
  const { result, unit, building } = data;
  
  // Parse summaryJson if available
  const summary = result.summaryJson ? JSON.parse(result.summaryJson) : {};
  const ownerName = summary.owner || (data.owner ? data.owner.firstName + ' ' + data.owner.lastName : 'Neznámý vlastník');
  const address = summary.address || unit.address || building?.address;
  const email = summary.email || (data.owner ? data.owner.email : '');
  
  // Filter services
  const fixedServices = result.serviceCosts.filter(sc => sc.service.name.toLowerCase().includes('fond oprav'));
  const mainServices = result.serviceCosts.filter(sc => !sc.service.name.toLowerCase().includes('fond oprav'));
  
  // Totals
  const totalBuildingCost = mainServices.reduce((sum, sc) => sum + sc.buildingTotalCost, 0);
  const totalUnitCost = result.totalCost;
  const totalAdvance = result.totalAdvancePrescribed; // Or Paid?
  const totalBalance = result.result;

  // Monthly data
  const monthlyPrescriptions = result.monthlyPrescriptions as number[] || Array(12).fill(0);
  // Assuming payments are same as prescriptions for now based on image
  const monthlyPayments = monthlyPrescriptions; 

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
              <Text style={styles.label}>bankovní spojení společenství:</Text>
              <Text style={styles.value}>{building?.bankAccount || '2400891032/2010'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {logoPath && <Image src={logoPath} style={styles.logo} />}
            <Text style={{ fontSize: 10, fontFamily: 'Roboto-Bold' }}>č. prostoru: {unit.name}</Text>
            <Text>zúčtovací období: 1.1.{result.billingPeriod.year} - 31.12.{result.billingPeriod.year}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Vyúčtování služeb: {result.billingPeriod.year}</Text>
        </View>

        {/* Main Table */}
        <View style={styles.table}>
          {/* Header Row 1 */}
          <View style={[styles.tableRow, styles.tableHeader, { height: 14 }]}>
            <View style={styles.colPolozka}><Text>Položka</Text></View>
            <View style={styles.colJednotka}><Text>Jednotka</Text></View>
            <View style={styles.colPodil}><Text>Podíl</Text></View>
            <View style={{ width: '26%', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#000000', textAlign: 'center' }}>
              <Text>Odběrné místo (dům)</Text>
            </View>
            <View style={{ width: '34%', textAlign: 'center' }}>
              <Text>Uživatel</Text>
            </View>
          </View>
          {/* Header Row 2 */}
          <View style={[styles.tableRow, styles.tableHeader, { height: 14 }]}>
            <View style={styles.colPolozka} />
            <View style={styles.colJednotka} />
            <View style={styles.colPodil} />
            {/* Odběrné místo subcols */}
            <View style={[styles.colOdbNaklad, { borderLeftWidth: 1, borderColor: '#000000' }]}><Text>Náklad</Text></View>
            <View style={styles.colOdbJednotek}><Text>Jednotek</Text></View>
            <View style={[styles.colOdbCena, { borderRightWidth: 1, borderColor: '#000000' }]}><Text>Kč/jedn</Text></View>
            {/* Uživatel subcols */}
            <View style={styles.colUzivJednotek}><Text>Jednotek</Text></View>
            <View style={styles.colUzivNaklad}><Text>Náklad</Text></View>
            <View style={styles.colUzivZaloha}><Text>Záloha</Text></View>
            <View style={styles.colUzivPreplatek}><Text>Přeplatky|nedoplatky</Text></View>
          </View>

          {/* Data Rows */}
          {mainServices.map((sc, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colPolozka}><Text>{sc.service.name}</Text></View>
              <View style={styles.colJednotka}><Text>{sc.calculationBasis || '-'}</Text></View>
              <View style={styles.colPodil}><Text>{sc.distributionBase || '-'}</Text></View>
              
              <View style={[styles.colOdbNaklad, { borderLeftWidth: 1, borderColor: '#000000' }]}>
                <Text>{formatCurrency(sc.buildingTotalCost)}</Text>
              </View>
              <View style={styles.colOdbJednotek}><Text>{formatNumber(sc.buildingConsumption)}</Text></View>
              <View style={[styles.colOdbCena, { borderRightWidth: 1, borderColor: '#000000' }]}>
                <Text>{formatCurrency(sc.unitPricePerUnit)}</Text>
              </View>
              
              <View style={styles.colUzivJednotek}><Text>{formatNumber(sc.unitConsumption)}</Text></View>
              <View style={styles.colUzivNaklad}><Text>{formatCurrency(sc.unitCost)}</Text></View>
              <View style={styles.colUzivZaloha}><Text>{formatCurrency(sc.unitAdvance)}</Text></View>
              <View style={styles.colUzivPreplatek}><Text>{formatCurrency(sc.unitBalance)}</Text></View>
            </View>
          ))}
          
          {/* Total Row */}
          <View style={[styles.tableRow, { borderTopWidth: 1, fontFamily: 'Roboto-Bold' }]}>
            <View style={{ width: '40%' }}><Text>Celkem náklady na odběrná místa</Text></View>
            <View style={[styles.colOdbNaklad, { borderLeftWidth: 1, borderColor: '#000000' }]}>
              <Text>{formatCurrency(totalBuildingCost)}</Text>
            </View>
            <View style={{ width: '16%', borderRightWidth: 1, borderColor: '#000000' }}><Text>Celkem vyúčtování:</Text></View>
            <View style={styles.colUzivNaklad}><Text>{formatCurrency(totalUnitCost)}</Text></View>
            <View style={styles.colUzivZaloha}><Text>{formatCurrency(totalAdvance)}</Text></View>
            <View style={styles.colUzivPreplatek}><Text>{formatCurrency(totalBalance)}</Text></View>
          </View>
        </View>

        {/* Summary Text */}
        <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
          <Text>Není evidován v účtovaném období přeplatek ani nedoplatek 0,00 Kč</Text>
          <Text>Není evidován v minulém období přeplatek ani nedoplatek 0,00 Kč</Text>
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            <Text style={{ fontFamily: 'Roboto-Bold', fontSize: 12, marginRight: 10 }}>PŘEPLATEK CELKEM</Text>
            <Text style={{ fontFamily: 'Roboto-Bold', fontSize: 12 }}>{formatCurrency(totalBalance)} Kč</Text>
          </View>
          <View style={{ backgroundColor: '#e5e7eb', padding: 2, marginTop: 2, width: '100%', alignItems: 'center' }}>
             <Text style={{ fontFamily: 'Roboto-Bold' }}>Přeplatek Vám bude vyplacen na číslo účtu {summary.bankAccount || '707156033/5500'}</Text>
          </View>
        </View>

        {/* Fixed Payments & Monthly */}
        <View style={{ flexDirection: 'row', gap: 20 }}>
          {/* Fixed Payments */}
          <View style={{ width: '20%' }}>
             <View style={[styles.table, { marginBottom: 0 }]}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                   <View style={{ width: '60%', paddingLeft: 2 }}><Text>Pevné platby</Text></View>
                   <View style={{ width: '40%', textAlign: 'right', paddingRight: 2 }}><Text>Celkem za rok</Text></View>
                </View>
                {fixedServices.map((sc, i) => (
                  <View key={i} style={styles.tableRow}>
                    <View style={{ width: '60%', paddingLeft: 2 }}><Text>{sc.service.name}</Text></View>
                    <View style={{ width: '40%', textAlign: 'right', paddingRight: 2 }}><Text>{formatCurrency(sc.unitCost)} Kč</Text></View>
                  </View>
                ))}
             </View>
          </View>

          {/* Monthly Table */}
          <View style={{ width: '80%' }}>
             <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader, { justifyContent: 'center' }]}>
                   <Text>Přehled úhrad za rok {result.billingPeriod.year}</Text>
                </View>
                <View style={styles.tableRow}>
                   {monthlyPayments.map((val, i) => (
                      <View key={i} style={{ width: `${100/12}%`, borderRightWidth: i<11?1:0, borderColor: '#000000', alignItems: 'center' }}>
                         <Text style={{ fontSize: 6, marginBottom: 2 }}>{i+1}/{result.billingPeriod.year}</Text>
                         <Text>{formatNumber(val)} Kč</Text>
                      </View>
                   ))}
                </View>
                <View style={[styles.tableRow, styles.tableHeader, { justifyContent: 'center' }]}>
                   <Text>Přehled předpisů za rok {result.billingPeriod.year}</Text>
                </View>
                <View style={styles.tableRow}>
                   {monthlyPrescriptions.map((val, i) => (
                      <View key={i} style={{ width: `${100/12}%`, borderRightWidth: i<11?1:0, borderColor: '#000000', alignItems: 'center' }}>
                         <Text style={{ fontSize: 6, marginBottom: 2 }}>{i+1}/{result.billingPeriod.year}</Text>
                         <Text>{formatNumber(val)} Kč</Text>
                      </View>
                   ))}
                </View>
                <View style={styles.tableRow}>
                   <View style={{ width: '25%', paddingLeft: 2 }}><Text>K úhradě za rok</Text></View>
                   <View style={{ width: '25%', paddingLeft: 2 }}><Text style={{ fontFamily: 'Roboto-Bold' }}>0 Kč</Text></View>
                </View>
             </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Jednotková cena za m3 vody činila v roce {result.billingPeriod.year} dle ceníku BVaK 105,53 Kč. Hodnota uvedená ve vyúčtování již zahrnuje rozdíl mezi náměrem hlavního a součtem náměrů poměrových vodoměrů.</Text>
          <Text style={{ marginTop: 5 }}>Případné reklamace uplatněte výhradně písemnou (elektronickou) formou na adrese správce (viz záhlaví) nejpozději do 30 dní od doručení vyúčtování včetně případné změny Vašeho osobního účtu pro vyplacení přeplatku.</Text>
          <Text style={{ marginTop: 5 }}>Přeplatek z vyúčtování bude vyplacen nejpozději ve lhůtě 2 měsíců ode dne doručení vyúčtování příjemci. V případě uplatněných reklamací se lhůta prodlouží. Nedoplatek prosím uhraďte na účet a pod variabilním symbolem (obojí viz. výše) nejdříve 30 dnů od doručení vyúčtování (neobdržíte-li v tomto termínu opravné vyúčtování). Nedoplatek z vyúčtování (nebude-li nahrazeno opravným) je splatný nejpozději do 4 měsíců ode dne doručení vyúčtování příjemci.</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
             <Text>Datum: {format(new Date(), 'dd.MM.yyyy')}</Text>
             <Text>info@adminreal.cz | mobil: 607 959 876</Text>
             <Text>www.adminreal.cz | www.onlinesprava.cz</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
