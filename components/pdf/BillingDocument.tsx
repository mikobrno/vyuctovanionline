import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { BillingPdfData } from '@/lib/billing-pdf-data';

// Registrace fontu pro české znaky (Roboto je bezpečnější než Helvetica pro UTF-8)
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
    padding: 40,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
    marginTop: 15,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
    padding: 4,
  },
  table: {
    width: '100%',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 4,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 4,
    fontFamily: 'Roboto-Bold',
  },
  colName: { width: '40%' },
  colNum: { width: '20%', textAlign: 'right' },
  
  // Specifické pro patičku
  footer: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qrCode: {
    width: 100,
    height: 100,
  },
  balanceBox: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    alignSelf: 'flex-end',
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  balanceText: {
    fontSize: 14,
    fontFamily: 'Roboto-Bold',
  },
  red: { color: '#dc2626' },
  green: { color: '#16a34a' },
});

interface Props {
  data: BillingPdfData;
  qrCodeUrl?: string;
}

const formatCurrency = (amount: number) => 
  Math.round(amount).toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč';

export const BillingDocument: React.FC<Props> = ({ data, qrCodeUrl }) => {
  const { result, building, unit, owner, readings, advances } = data;
  const balance = Math.round(result.balance);
  const isUnderpayment = balance < 0;

  // Filtrace nulových položek
  const activeServices = result.serviceCosts.filter(
    c => Math.abs(c.unitCost) > 0 || Math.abs(c.unitAdvance) > 0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HLAVIČKA */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{building?.name}</Text>
            <Text style={styles.subtitle}>{building?.address}</Text>
            <Text style={styles.subtitle}>IČ: {building?.id /* TODO: Přidat IČ do modelu */}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>Vyúčtování {result.year}</Text>
            <Text>Jednotka: {unit.unitNumber}</Text>
            <Text>{owner.firstName} {owner.lastName}</Text>
            <Text>{unit.email}</Text>
          </View>
        </View>

        {/* ROZÚČTOVÁNÍ NÁKLADŮ */}
        <Text style={styles.sectionTitle}>Rozúčtování nákladů</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.colName}>Položka</Text>
            <Text style={styles.colNum}>Náklad</Text>
            <Text style={styles.colNum}>Zálohy</Text>
            <Text style={styles.colNum}>Rozdíl</Text>
          </View>
          {activeServices.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.colName}>{item.service.name}</Text>
              <Text style={styles.colNum}>{formatCurrency(item.unitCost)}</Text>
              <Text style={styles.colNum}>{formatCurrency(item.unitAdvance)}</Text>
              <Text style={[styles.colNum, item.unitBalance < 0 ? styles.red : styles.green]}>
                {formatCurrency(item.unitBalance)}
              </Text>
            </View>
          ))}
          {/* Celkem řádek */}
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#000', marginTop: 5 }]}>
            <Text style={[styles.colName, { fontFamily: 'Roboto-Bold' }]}>CELKEM</Text>
            <Text style={[styles.colNum, { fontFamily: 'Roboto-Bold' }]}>{formatCurrency(result.totalCost)}</Text>
            <Text style={[styles.colNum, { fontFamily: 'Roboto-Bold' }]}>{formatCurrency(result.totalAdvance)}</Text>
            <Text style={[styles.colNum, { fontFamily: 'Roboto-Bold' }]}>{formatCurrency(result.balance)}</Text>
          </View>
        </View>

        {/* MĚŘIDLA (Podmíněné zobrazení) */}
        {readings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Stavy měřidel</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={{ width: '30%' }}>Služba</Text>
                <Text style={{ width: '25%' }}>Měřidlo</Text>
                <Text style={{ width: '15%', textAlign: 'right' }}>Počátek</Text>
                <Text style={{ width: '15%', textAlign: 'right' }}>Konec</Text>
                <Text style={{ width: '15%', textAlign: 'right' }}>Spotřeba</Text>
              </View>
              {readings.map((r, idx) => (
                <View key={idx} style={styles.row}>
                  <Text style={{ width: '30%' }}>{r.serviceName}</Text>
                  <Text style={{ width: '25%' }}>{r.meterSerial}</Text>
                  <Text style={{ width: '15%', textAlign: 'right' }}>{r.startValue}</Text>
                  <Text style={{ width: '15%', textAlign: 'right' }}>{r.endValue}</Text>
                  <Text style={{ width: '15%', textAlign: 'right' }}>{r.consumption.toFixed(2)} {r.unit}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* PŘEHLED ZÁLOH */}
        <Text style={styles.sectionTitle}>Přehled předepsaných záloh (měsíčně)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const month = i + 1;
            // Najdeme zálohy pro tento měsíc (může jich být víc, sečteme)
            const monthAmount = advances
              .filter(a => a.month === month)
              .reduce((sum, a) => sum + a.amount, 0);
            
            return (
              <View key={month} style={{ width: '16.6%', padding: 5, border: '1px solid #eee' }}>
                <Text style={{ fontSize: 8, color: '#666' }}>{month}/{result.year}</Text>
                <Text style={{ fontSize: 10 }}>{Math.round(monthAmount)}</Text>
              </View>
            );
          })}
        </View>

        {/* VÝSLEDEK A PATIČKA */}
        <View style={styles.balanceBox}>
          <Text style={styles.balanceText}>
            VÝSLEDEK VYÚČTOVÁNÍ: {isUnderpayment ? 'NEDOPLATEK' : 'PŘEPLATEK'}
          </Text>
          <Text style={[styles.balanceText, isUnderpayment ? styles.red : styles.green, { fontSize: 18 }]}>
            {formatCurrency(Math.abs(balance))}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={{ width: '70%' }}>
            {isUnderpayment ? (
              <>
                <Text style={{ fontFamily: 'Roboto-Bold', marginBottom: 5 }}>Pokyny k platbě:</Text>
                <Text>Prosíme o úhradu nedoplatku ve výši {formatCurrency(Math.abs(balance))} nejpozději do 14 dnů.</Text>
                <Text>Číslo účtu: {building?.bankAccount || 'Není zadáno'}</Text>
                <Text>Variabilní symbol: {unit.variableSymbol}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: 'Roboto-Bold', marginBottom: 5 }}>Informace o přeplatku:</Text>
                <Text>Přeplatek ve výši {formatCurrency(balance)} Vám bude zaslán na Váš bankovní účet.</Text>
                <Text>V případě nesrovnalostí kontaktujte správce.</Text>
              </>
            )}
            <Text style={{ marginTop: 10, fontSize: 8, color: '#999' }}>
              Vygenerováno systémem Vyúčtování Online dne {new Date().toLocaleDateString('cs-CZ')}
            </Text>
          </View>
          
          {/* QR Kód pouze pro nedoplatky */}
          {isUnderpayment && qrCodeUrl && (
            <View style={{ alignItems: 'center' }}>
              <Image src={qrCodeUrl} style={styles.qrCode} />
              <Text style={{ fontSize: 8, marginTop: 2 }}>QR Platba</Text>
            </View>
          )}
        </View>

      </Page>
    </Document>
  );
};
