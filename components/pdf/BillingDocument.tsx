import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { BillingPdfData } from '@/lib/billing-pdf-data';
import { format } from 'date-fns';

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
    padding: 20,
    fontFamily: 'Roboto',
    fontSize: 8,
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
    flexDirection: 'column', // Changed to column to fit full width table
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Roboto-Bold',
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#f3f4f6',
    padding: 4,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  table: {
    width: '100%',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 3,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 4,
    fontFamily: 'Roboto-Bold',
    backgroundColor: '#1e293b',
    color: 'white',
    alignItems: 'center',
  },
  // Columns for Main Table (10 columns)
  col1: { width: '18%', paddingLeft: 4 }, // Položka
  col2: { width: '6%', textAlign: 'center' }, // Jednotka
  col3: { width: '5%', textAlign: 'center' }, // Podíl
  col4: { width: '10%', textAlign: 'right' }, // Náklad dům
  col5: { width: '8%', textAlign: 'right' }, // Jednotek (dům)
  col6: { width: '8%', textAlign: 'right' }, // Kč/jedn
  col7: { width: '8%', textAlign: 'right' }, // Jednotek (jednotka)
  col8: { width: '10%', textAlign: 'right', fontWeight: 'bold' }, // Náklad (jednotka)
  col9: { width: '10%', textAlign: 'right' }, // Záloha
  col10: { width: '12%', textAlign: 'right', paddingRight: 4, fontWeight: 'bold' }, // Rozdíl

  // Footer styles
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  
  // Info text
  infoText: {
    fontSize: 7,
    color: '#555',
    marginTop: 2,
  }
});

interface Props {
  data: BillingPdfData;
  qrCodeUrl?: string;
  logoPath?: string;
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00 Kč';
  return amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' Kč';
};

const formatNumber = (amount: number | null | undefined, decimals = 2) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return amount.toLocaleString('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/\s/g, ' ');
};

export const BillingDocument: React.FC<Props> = ({ data, qrCodeUrl }) => {
  const { result, building, unit, owner, readings, advances, payments } = data;
  const balance = result.result ?? 0; // Use result.result directly as per schema
  const isUnderpayment = balance < 0;

  // --- Service Merging Logic (Same as BillingStatement.tsx) ---
  const processServices = (services: typeof result.serviceCosts) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grouped: any[] = [];
    
    const getBaseName = (name: string) => {
      if (name.startsWith("Ohřev teplé vody")) return "Ohřev teplé vody";
      return name;
    };

    const groups = new Map<string, typeof result.serviceCosts>();
    services.forEach(s => {
      const base = getBaseName(s.service.name);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(s);
    });

    const processedBases = new Set<string>();
    services.forEach(s => {
      const base = getBaseName(s.service.name);
      if (processedBases.has(base)) return;
      processedBases.add(base);

      const group = groups.get(base)!;
      if (base === "Ohřev teplé vody" && group.length > 1) {
        // Merge
        const merged = { ...group[0] };
        // Create a synthetic service object for display
        merged.service = { ...merged.service, name: base, measurementUnit: 'viz rozúčtování' };
        
        merged.buildingTotalCost = group.reduce((sum, x) => sum + x.buildingTotalCost, 0);
        merged.unitAdvance = group.reduce((sum, x) => sum + x.unitAdvance, 0);
        merged.unitCost = group.reduce((sum, x) => sum + x.unitCost, 0);
        merged.unitBalance = group.reduce((sum, x) => sum + x.unitBalance, 0);
        
        // Clear specific columns
        merged.buildingConsumption = 0;
        merged.unitPricePerUnit = 0;
        merged.unitAssignedUnits = 0;
        
        grouped.push(merged);
      } else {
        group.forEach(item => grouped.push(item));
      }
    });

    return grouped;
  };

  const displayedServices = processServices(result.serviceCosts);

  // Příprava měsíčních dat
  const monthlyData = Array.from({ length: 12 }).map((_, i) => {
    const month = i + 1;
    const prescribed = advances
      .filter(a => a.month === month)
      .reduce((sum, a) => sum + a.amount, 0);
    
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
            <Text style={styles.title}>{owner.firstName} {owner.lastName}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
               <Text style={{ fontFamily: 'Roboto-Bold' }}>Adresa:</Text>
               <Text>{owner.address || building?.address}</Text>
            </View>
            {owner.email && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                 <Text style={{ fontFamily: 'Roboto-Bold' }}>Email:</Text>
                 <Text>{owner.email}</Text>
              </View>
            )}
            {owner.phone && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                 <Text style={{ fontFamily: 'Roboto-Bold' }}>Telefon:</Text>
                 <Text>{owner.phone}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
               <Text style={{ fontFamily: 'Roboto-Bold' }}>Bankovní spojení:</Text>
               <Text>{building?.bankAccount}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
               <Text style={{ fontFamily: 'Roboto-Bold' }}>Variabilní symbol:</Text>
               <Text>{unit.variableSymbol}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {/* Logo placeholder - in real PDF generation, path must be absolute or base64 */}
            {/* <Image src={effectiveLogo} style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 5 }} /> */}
            <Text style={{ fontSize: 20, fontFamily: 'Roboto-Bold', marginBottom: 5 }}>ADMIN REAL</Text>
            
            <Text style={{ fontSize: 8, color: '#666' }}>č. prostoru: {unit.unitNumber}</Text>
            <Text style={{ fontSize: 8, color: '#666' }}>
              zúčtovací období: {result.billingPeriod?.year}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Vyúčtování služeb: {result.billingPeriod?.year}</Text>

        {/* MAIN TABLE */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.col1}>Položka</Text>
            <Text style={styles.col2}>Jednotka</Text>
            <Text style={styles.col3}>Podíl</Text>
            <Text style={styles.col4}>Náklad (dům)</Text>
            <Text style={styles.col5}>Jednotek</Text>
            <Text style={styles.col6}>Kč/jedn</Text>
            <Text style={styles.col7}>Jednotek</Text>
            <Text style={styles.col8}>Náklad</Text>
            <Text style={styles.col9}>Záloha</Text>
            <Text style={styles.col10}>Přeplatek/nedoplatek</Text>
          </View>

          {/* Rows */}
          {displayedServices.filter(s => !(s.buildingTotalCost === 0 && s.unitAdvance === 0)).map((item, idx) => (
            <View key={idx} style={[styles.row, idx % 2 === 1 ? { backgroundColor: '#f9fafb' } : {}]}>
              <Text style={styles.col1}>{item.service.name}</Text>
              <Text style={styles.col2}>{item.service.measurementUnit || '-'}</Text>
              <Text style={styles.col3}>100%</Text>
              <Text style={styles.col4}>{formatCurrency(item.buildingTotalCost)}</Text>
              <Text style={styles.col5}>{formatNumber(item.buildingConsumption)}</Text>
              <Text style={styles.col6}>{formatNumber(item.unitPricePerUnit)}</Text>
              <Text style={styles.col7}>{formatNumber(item.unitAssignedUnits)}</Text>
              <Text style={styles.col8}>{formatCurrency(item.unitCost)}</Text>
              <Text style={styles.col9}>{formatCurrency(item.unitAdvance)}</Text>
              <Text style={[styles.col10, item.unitBalance < 0 ? styles.red : styles.green]}>
                {formatCurrency(item.unitBalance)}
              </Text>
            </View>
          ))}

          {/* Total Row */}
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#000', backgroundColor: '#f3f4f6' }]}>
            <Text style={[styles.col1, { fontFamily: 'Roboto-Bold' }]}>CELKEM NÁKLADY NA ODBĚRNÉ MÍSTO</Text>
            <Text style={styles.col2}></Text>
            <Text style={styles.col3}></Text>
            <Text style={[styles.col4, { fontFamily: 'Roboto-Bold' }]}>
              {formatCurrency(displayedServices.reduce((acc, s) => acc + s.buildingTotalCost, 0))}
            </Text>
            <Text style={styles.col5}></Text>
            <Text style={styles.col6}></Text>
            <Text style={styles.col7}></Text>
            <Text style={[styles.col8, { fontFamily: 'Roboto-Bold' }]}>{formatCurrency(result.totalCost)}</Text>
            <Text style={[styles.col9, { fontFamily: 'Roboto-Bold' }]}>{formatCurrency(result.totalAdvancePrescribed)}</Text>
            <Text style={[styles.col10, { fontFamily: 'Roboto-Bold', fontSize: 10, color: balance < 0 ? '#dc2626' : '#16a34a' }]}>
              {formatCurrency(balance)}
            </Text>
          </View>
        </View>

        {/* BOTTOM SECTION - 2 Columns */}
        <View style={{ flexDirection: 'row', gap: 20 }}>
          
          {/* LEFT: Payments & Readings */}
          <View style={{ width: '50%' }}>
             {/* Payments & Prescriptions Side-by-Side */}
             <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { fontSize: 9 }]}>Přehled úhrad</Text>
                  <View style={styles.table}>
                    <View style={[styles.row, { backgroundColor: '#eee', borderBottomWidth: 1, borderColor: '#999' }]}>
                      <Text style={{ width: '40%', paddingLeft: 4 }}>Měsíc</Text>
                      <Text style={{ width: '60%', textAlign: 'right', paddingRight: 4 }}>Uhrazeno</Text>
                    </View>
                    {monthlyData.map((d) => (
                      <View key={d.month} style={styles.monthRow}>
                        <Text style={{ width: '40%', paddingLeft: 4 }}>{d.month}</Text>
                        <Text style={{ width: '60%', textAlign: 'right', paddingRight: 4 }}>{formatCurrency(d.paid)}</Text>
                      </View>
                    ))}
                    <View style={[styles.monthRow, { borderTopWidth: 1, borderTopColor: '#000', backgroundColor: '#f9fafb' }]}>
                      <Text style={{ width: '40%', paddingLeft: 4, fontFamily: 'Roboto-Bold' }}>Celkem</Text>
                      <Text style={{ width: '60%', textAlign: 'right', paddingRight: 4, fontFamily: 'Roboto-Bold' }}>
                        {formatCurrency(monthlyData.reduce((s, i) => s + i.paid, 0))}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { fontSize: 9 }]}>Přehled předpisů</Text>
                  <View style={styles.table}>
                    <View style={[styles.row, { backgroundColor: '#eee', borderBottomWidth: 1, borderColor: '#999' }]}>
                      <Text style={{ width: '40%', paddingLeft: 4 }}>Měsíc</Text>
                      <Text style={{ width: '60%', textAlign: 'right', paddingRight: 4 }}>Předpis</Text>
                    </View>
                    {monthlyData.map((d) => (
                      <View key={d.month} style={styles.monthRow}>
                        <Text style={{ width: '40%', paddingLeft: 4 }}>{d.month}</Text>
                        <Text style={{ width: '60%', textAlign: 'right', paddingRight: 4 }}>{formatCurrency(d.prescribed)}</Text>
                      </View>
                    ))}
                    <View style={[styles.monthRow, { borderTopWidth: 1, borderTopColor: '#000', backgroundColor: '#f9fafb' }]}>
                      <Text style={{ width: '40%', paddingLeft: 4, fontFamily: 'Roboto-Bold' }}>Celkem</Text>
                      <Text style={{ width: '60%', textAlign: 'right', paddingRight: 4, fontFamily: 'Roboto-Bold' }}>
                        {formatCurrency(monthlyData.reduce((s, i) => s + i.prescribed, 0))}
                      </Text>
                    </View>
                  </View>
                </View>
             </View>

             {/* Readings */}
             {readings.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.sectionTitle, { fontSize: 9 }]}>Měřené služby</Text>
                <View style={styles.table}>
                  <View style={[styles.row, { backgroundColor: '#eee' }]}>
                    <Text style={{ width: '30%', paddingLeft: 4 }}>Služba</Text>
                    <Text style={{ width: '25%' }}>Měřidlo</Text>
                    <Text style={{ width: '15%', textAlign: 'right' }}>Poč. stav</Text>
                    <Text style={{ width: '15%', textAlign: 'right' }}>Kon. stav</Text>
                    <Text style={{ width: '15%', textAlign: 'right', paddingRight: 4 }}>Spotřeba</Text>
                  </View>
                  {readings.map((r, idx) => (
                    <View key={idx} style={styles.row}>
                      <Text style={{ width: '30%', paddingLeft: 4 }}>{r.serviceName}</Text>
                      <Text style={{ width: '25%' }}>{r.meterSerial}</Text>
                      <Text style={{ width: '15%', textAlign: 'right' }}>{formatNumber(r.startValue)}</Text>
                      <Text style={{ width: '15%', textAlign: 'right' }}>{formatNumber(r.endValue)}</Text>
                      <Text style={{ width: '15%', textAlign: 'right', paddingRight: 4, fontFamily: 'Roboto-Bold' }}>
                        {formatNumber(r.consumption)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* RIGHT: Result & Info */}
          <View style={{ width: '50%' }}>
             <View style={styles.balanceBox}>
              <View>
                <Text style={styles.balanceText}>VÝSLEDEK VYÚČTOVÁNÍ</Text>
                <Text style={{ fontSize: 10, color: '#666' }}>{isUnderpayment ? 'NEDOPLATEK' : 'PŘEPLATEK'}</Text>
              </View>
              <Text style={[styles.balanceText, isUnderpayment ? styles.red : styles.green, { fontSize: 20 }]}>
                {formatCurrency(balance)}
              </Text>
            </View>

            <View style={{ padding: 10, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#eee' }}>
               {isUnderpayment ? (
                 <View>
                   <Text style={{ fontFamily: 'Roboto-Bold', color: '#dc2626', marginBottom: 5 }}>
                     Nedoplatek uhraďte na účet číslo: {building?.bankAccount}
                   </Text>
                   <Text>Variabilní symbol: {unit.variableSymbol}</Text>
                 </View>
               ) : (
                 <View>
                   <Text style={{ fontFamily: 'Roboto-Bold', color: '#16a34a', marginBottom: 5 }}>
                     Přeplatek Vám bude vyplacen na účet {building?.bankAccount}
                   </Text>
                 </View>
               )}
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={styles.infoText}>
                Jednotková cena za m3 vody činila v roce {result.billingPeriod?.year} dle ceníku BVaK 105,53 Kč. Hodnota uvedená ve vyúčtování již zahrnuje rozdíl mezi náměrem hlavního a součtem náměrů poměrových vodoměrů.
              </Text>
              <Text style={styles.infoText}>
                Případné reklamace uplatněte výhradně písemnou (elektronickou) formou na adrese správce (viz. záhlaví) nejpozději do 30 dnů od doručení vyúčtování včetně případné změny Vašeho osobního účtu pro vyplacení přeplatku.
              </Text>
              <Text style={styles.infoText}>
                Přeplatky a nedoplatky z vyúčtování jsou splatné nejpozději do 7 (sedmi) měsíců od skončení zúčtovacího období.
              </Text>
            </View>

            {isUnderpayment && qrCodeUrl && (
                <View style={{ marginTop: 15, alignItems: 'center', borderWidth: 1, borderColor: '#ccc', padding: 10, alignSelf: 'center' }}>
                  {/* QR Code Image would go here */}
                  <Text style={{ fontSize: 8, marginTop: 4 }}>QR Platba</Text>
                </View>
            )}

            <View style={{ marginTop: 20, borderTopWidth: 1, borderColor: '#eee', paddingTop: 5 }}>
               <Text style={{ fontSize: 7, color: '#999', textAlign: 'right' }}>
                 Datum: {format(new Date(), 'd.M.yyyy')} | info@adminreal.cz | www.adminreal.cz
               </Text>
            </View>
          </View>

        </View>

      </Page>
    </Document>
  );
};
