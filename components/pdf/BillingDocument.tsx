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
    padding: 30,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: '#666',
  },
  mainContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  leftColumn: {
    width: '60%',
  },
  rightColumn: {
    width: '40%',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Roboto-Bold',
    marginTop: 10,
    marginBottom: 6,
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
    paddingVertical: 3,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 3,
    fontFamily: 'Roboto-Bold',
  },
  colName: { width: '40%' },
  colNum: { width: '20%', textAlign: 'right' },
  
  // Specifické pro patičku
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 10,
  },
  qrCode: {
    width: 80,
    height: 80,
  },
  balanceBox: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    marginTop: 10,
    marginBottom: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  balanceText: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
  },
  red: { color: '#dc2626' },
  green: { color: '#16a34a' },
  
  // Měsíční přehled
  monthRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 2,
  },
  monthCol: { width: '33%', textAlign: 'right' },
  monthNameCol: { width: '34%', textAlign: 'left' }
});

interface Props {
  data: BillingPdfData;
  qrCodeUrl?: string;
  logoPath?: string;
}

const formatCurrency = (amount: number) => 
  Math.round(amount).toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč';

export const BillingDocument: React.FC<Props> = ({ data, qrCodeUrl, logoPath }) => {
  const { result, building, unit, owner, readings, advances, payments } = data;
  const balance = Math.round(result.balance);
  const isUnderpayment = balance < 0;

  // Filtrace nulových položek
  const activeServices = result.serviceCosts.filter(
    c => Math.abs(c.unitCost) > 0 || Math.abs(c.unitAdvance) > 0
  );

  // Příprava měsíčních dat
  const monthlyData = Array.from({ length: 12 }).map((_, i) => {
    const month = i + 1;
    const prescribed = advances
      .filter(a => a.month === month)
      .reduce((sum, a) => sum + a.amount, 0);
    
    // Platby pro tento měsíc (podle data platby)
    const paid = payments
      .filter(p => {
         const d = new Date(p.paymentDate);
         return d.getMonth() + 1 === month;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    return { month, prescribed, paid };
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* HLAVIČKA */}
        <View style={styles.header}>
          <View>
            {logoPath && <Image src={logoPath} style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 5 }} />}
            <Text style={styles.title}>{building?.name}</Text>
            <Text style={styles.subtitle}>{building?.address}</Text>
            <Text style={styles.subtitle}>IČ: {building?.id}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>Vyúčtování služeb {result.year}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Roboto-Bold', marginBottom: 2 }}>Jednotka: {unit.unitNumber}</Text>
            <Text>{owner.firstName} {owner.lastName}</Text>
            <Text>{owner.address}</Text>
          </View>
        </View>

        <View style={styles.mainContainer}>
          {/* LEVÝ SLOUPEC - Rozúčtování */}
          <View style={styles.leftColumn}>
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
                <Text style={[styles.colNum, { fontFamily: 'Roboto-Bold' }]}>{formatCurrency(result.totalAdvancePrescribed)}</Text>
                <Text style={[styles.colNum, { fontFamily: 'Roboto-Bold', color: balance < 0 ? '#dc2626' : '#16a34a' }]}>
                  {formatCurrency(result.balance)}
                </Text>
              </View>
            </View>

            {/* MĚŘIDLA */}
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
          </View>

          {/* PRAVÝ SLOUPEC - Přehledy a Výsledek */}
          <View style={styles.rightColumn}>
            
            {/* Měsíční přehledy - Dvě tabulky vedle sebe */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Tabulka Úhrad */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { fontSize: 9 }]}>Přehled úhrad</Text>
                <View style={styles.table}>
                  <View style={styles.headerRow}>
                    <Text style={{ width: '40%' }}>Měsíc</Text>
                    <Text style={{ width: '60%', textAlign: 'right' }}>Uhrazeno</Text>
                  </View>
                  {monthlyData.map((d) => (
                    <View key={d.month} style={styles.monthRow}>
                      <Text style={{ width: '40%' }}>{d.month}</Text>
                      <Text style={{ width: '60%', textAlign: 'right' }}>{Math.round(d.paid)}</Text>
                    </View>
                  ))}
                  <View style={[styles.monthRow, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                    <Text style={{ width: '40%', fontFamily: 'Roboto-Bold' }}>Celkem</Text>
                    <Text style={{ width: '60%', textAlign: 'right', fontFamily: 'Roboto-Bold' }}>
                      {Math.round(monthlyData.reduce((s, i) => s + i.paid, 0))}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tabulka Předpisů */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { fontSize: 9 }]}>Přehled předpisů</Text>
                <View style={styles.table}>
                  <View style={styles.headerRow}>
                    <Text style={{ width: '40%' }}>Měsíc</Text>
                    <Text style={{ width: '60%', textAlign: 'right' }}>Předpis</Text>
                  </View>
                  {monthlyData.map((d) => (
                    <View key={d.month} style={styles.monthRow}>
                      <Text style={{ width: '40%' }}>{d.month}</Text>
                      <Text style={{ width: '60%', textAlign: 'right' }}>{Math.round(d.prescribed)}</Text>
                    </View>
                  ))}
                  <View style={[styles.monthRow, { borderTopWidth: 1, borderTopColor: '#000' }]}>
                    <Text style={{ width: '40%', fontFamily: 'Roboto-Bold' }}>Celkem</Text>
                    <Text style={{ width: '60%', textAlign: 'right', fontFamily: 'Roboto-Bold' }}>
                      {Math.round(monthlyData.reduce((s, i) => s + i.prescribed, 0))}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* VÝSLEDEK */}
            <View style={styles.balanceBox}>
              <View>
                <Text style={styles.balanceText}>VÝSLEDEK VYÚČTOVÁNÍ</Text>
                <Text style={{ fontSize: 10, color: '#666' }}>{isUnderpayment ? 'NEDOPLATEK' : 'PŘEPLATEK'}</Text>
              </View>
              <Text style={[styles.balanceText, isUnderpayment ? styles.red : styles.green, { fontSize: 16 }]}>
                {formatCurrency(balance)}
              </Text>
            </View>

            {/* PATIČKA A QR */}
            <View style={styles.footer}>
              {isUnderpayment ? (
                <View>
                  <Text style={{ fontFamily: 'Roboto-Bold', marginBottom: 5 }}>Pokyny k platbě:</Text>
                  <Text style={{ marginBottom: 2 }}>Číslo účtu: {building?.bankAccount || 'Není zadáno'}</Text>
                  <Text style={{ marginBottom: 2 }}>Variabilní symbol: {unit.variableSymbol}</Text>
                  <Text style={{ marginBottom: 2 }}>Částka: {formatCurrency(Math.abs(balance))}</Text>
                </View>
              ) : (
                <View>
                  <Text style={{ fontFamily: 'Roboto-Bold', marginBottom: 5 }}>Informace o přeplatku:</Text>
                  <Text>Přeplatek bude vyplacen na účet {building?.bankAccount || 'evidovaný u správce'}.</Text>
                </View>
              )}

              {isUnderpayment && qrCodeUrl && (
                <View style={{ marginTop: 15, alignItems: 'center', borderWidth: 1, borderColor: '#ccc', padding: 10, alignSelf: 'center' }}>
                  <Image src={qrCodeUrl} style={styles.qrCode} />
                  <Text style={{ fontSize: 8, marginTop: 4 }}>QR Platba</Text>
                </View>
              )}
              
              <View style={{ marginTop: 20 }}>
                 <Text style={{ fontSize: 7, color: '#666', textAlign: 'center' }}>
                   Vygenerováno: {new Date().toLocaleDateString('cs-CZ')} | AdminReal.cz
                 </Text>
              </View>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  );
};
