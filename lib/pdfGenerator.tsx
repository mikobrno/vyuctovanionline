/**
 * PDF generátor pro vyúčtování
 * Používá @react-pdf/renderer pro generování PDF na serveru
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { renderToBuffer } from '@react-pdf/renderer'

// Styly pro PDF dokument
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000'
  },
  headerLeft: {
    flex: 1
  },
  headerRight: {
    flex: 1,
    textAlign: 'right'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2
  },
  infoPanel: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 10,
    marginBottom: 15,
    borderRadius: 4
  },
  infoItem: {
    flex: 1
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 3,
    textTransform: 'uppercase'
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center'
  },
  table: {
    marginBottom: 15
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 5
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    fontSize: 8,
    paddingVertical: 6
  },
  tableCell: {
    fontSize: 9,
    paddingHorizontal: 3
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 3
  },
  col1: { width: '20%' },
  col2: { width: '12%' },
  col3: { width: '10%', textAlign: 'right' },
  col4: { width: '10%', textAlign: 'right' },
  col5: { width: '10%', textAlign: 'right' },
  col6: { width: '10%', textAlign: 'right' },
  col7: { width: '10%', textAlign: 'right' },
  col8: { width: '10%', textAlign: 'right' },
  col9: { width: '8%', textAlign: 'right' },
  totalRow: {
    backgroundColor: '#e8f4f8',
    fontWeight: 'bold',
    paddingVertical: 8
  },
  balanceRow: {
    backgroundColor: '#fff3cd',
    fontWeight: 'bold',
    fontSize: 11,
    paddingVertical: 10
  },
  balancePositive: {
    color: '#dc3545'
  },
  balanceNegative: {
    color: '#28a745'
  },
  notice: {
    backgroundColor: '#fff3cd',
    padding: 10,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
    fontSize: 8
  },
  footer: {
    marginTop: 15,
    fontSize: 7,
    color: '#666',
    lineHeight: 1.4
  },
  monthlyTable: {
    marginBottom: 15
  },
  monthCell: {
    width: '8.33%',
    textAlign: 'center',
    fontSize: 8,
    paddingHorizontal: 2
  }
})

interface BillingPDFProps {
  building: {
    name: string
    address: string
    city: string
  }
  period: number
  unit: {
    name: string
    unitNumber: string
    variableSymbol: string | null
  }
  owner: {
    firstName: string
    lastName: string
    address: string | null
    email: string | null
  } | null
  serviceCosts: Array<{
    service: {
      name: string
      code: string
    }
    buildingTotalCost: number
    buildingConsumption: number | null
    unitConsumption: number | null
    unitCost: number
    unitAdvance: number
    unitBalance: number
    unitPricePerUnit: number | null
    distributionBase: string | null
  }>
  totalCost: number
  totalAdvancePrescribed: number
  repairFund: number
  result: number
}

const BillingPDF: React.FC<BillingPDFProps> = ({
  building,
  period,
  unit,
  owner,
  serviceCosts,
  totalCost,
  totalAdvancePrescribed,
  repairFund,
  result
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Hlavička */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{building.name}</Text>
          <Text style={styles.subtitle}>{building.address}, {building.city}</Text>
        </View>
        <View style={styles.headerRight}>
          {owner && (
            <>
              <Text style={styles.title}>{owner.firstName} {owner.lastName}</Text>
              {owner.address && <Text style={styles.subtitle}>{owner.address}</Text>}
              {owner.email && <Text style={styles.subtitle}>{owner.email}</Text>}
            </>
          )}
        </View>
      </View>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Jednotka</Text>
          <Text style={styles.infoValue}>{unit.name}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Variabilní symbol</Text>
          <Text style={styles.infoValue}>{unit.variableSymbol || '-'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Období</Text>
          <Text style={styles.infoValue}>Rok {period}</Text>
        </View>
      </View>

      {/* Nadpis */}
      <Text style={styles.sectionTitle}>Vyúčtování služeb: {period}</Text>

      {/* Tabulka služeb */}
      <View style={styles.table}>
        {/* Header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.col1]}>Položka</Text>
          <Text style={[styles.tableCell, styles.col2]}>Jednotka</Text>
          <Text style={[styles.tableCell, styles.col3]}>Náklad</Text>
          <Text style={[styles.tableCell, styles.col4]}>Jednotek</Text>
          <Text style={[styles.tableCell, styles.col5]}>Kč/jedn</Text>
          <Text style={[styles.tableCell, styles.col6]}>Připadá</Text>
          <Text style={[styles.tableCell, styles.col7]}>Náklad</Text>
          <Text style={[styles.tableCell, styles.col8]}>Úhrada</Text>
          <Text style={[styles.tableCell, styles.col9]}>Přepl./Nedopl.</Text>
        </View>

        {/* Služby */}
        {serviceCosts.map((sc, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.col1]}>{sc.service.name}</Text>
            <Text style={[styles.tableCell, styles.col2]}>{sc.distributionBase || '-'}</Text>
            <Text style={[styles.tableCellBold, styles.col3]}>
              {sc.buildingTotalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.tableCell, styles.col4]}>
              {sc.buildingConsumption?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || '-'}
            </Text>
            <Text style={[styles.tableCell, styles.col5]}>
              {sc.unitPricePerUnit?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || '-'}
            </Text>
            <Text style={[styles.tableCell, styles.col6]}>
              {sc.unitConsumption?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) || '-'}
            </Text>
            <Text style={[styles.tableCellBold, styles.col7]}>
              {sc.unitCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.tableCell, styles.col8]}>
              {sc.unitAdvance.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.tableCellBold, styles.col9, sc.unitBalance > 0 ? { color: '#dc3545' } : sc.unitBalance < 0 ? { color: '#28a745' } : {}]}>
              {sc.unitBalance.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        ))}

        {/* Fond oprav */}
        {repairFund > 0 && (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.col1]}>Fond oprav</Text>
            <Text style={[styles.tableCell, styles.col2]}>na byt</Text>
            <Text style={[styles.tableCellBold, styles.col3]}>
              {repairFund.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.tableCell, styles.col4]}>100,00</Text>
            <Text style={[styles.tableCell, styles.col5]}>
              {(repairFund / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.tableCell, styles.col6]}>100</Text>
            <Text style={[styles.tableCellBold, styles.col7]}>
              {repairFund.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.tableCell, styles.col8]}>0,00</Text>
            <Text style={[styles.tableCellBold, styles.col9, { color: '#dc3545' }]}>
              {repairFund.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        {/* Celkem */}
        <View style={[styles.tableRow, styles.totalRow]}>
          <Text style={[styles.tableCellBold, styles.col1]}>Celkem náklady:</Text>
          <Text style={[styles.tableCell, styles.col2]}></Text>
          <Text style={[styles.tableCellBold, styles.col3]}>
            {totalCost.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.tableCell, styles.col4]}></Text>
          <Text style={[styles.tableCell, styles.col5]}></Text>
          <Text style={[styles.tableCell, styles.col6]}></Text>
          <Text style={[styles.tableCell, styles.col7]}></Text>
          <Text style={[styles.tableCell, styles.col8]}></Text>
          <Text style={[styles.tableCell, styles.col9]}></Text>
        </View>

        {/* Bilance */}
        <View style={[styles.tableRow, styles.balanceRow]}>
          <Text style={[styles.tableCellBold, { width: '82%' }]}>
            {result >= 0 ? 'NEDOPLATEK CELKEM' : 'PŘEPLATEK CELKEM'}
          </Text>
          <Text style={[styles.tableCellBold, styles.col9, result >= 0 ? styles.balancePositive : styles.balanceNegative]}>
            {Math.abs(result).toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
          </Text>
        </View>
      </View>

      {/* Upozornění */}
      <View style={styles.notice}>
        <Text>
          {result >= 0 ? (
            'Případné reklamace uplatněte písemnou formou na adrese správce nejpozději do 30 dnů od doručení vyúčtování, jinak se vyúčtování považuje za akceptované.'
          ) : (
            `Přeplatek Vám bude vyplacen na číslo účtu ${unit.variableSymbol || 'registrované u správce'}.`
          )}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Přeplatky a nedoplatky z vyúčtování jsou splatné nejpozději do 7 (sedmi) měsíců od skončení zúčtovacího období.</Text>
        <Text style={{ marginTop: 5 }}>Datum: {new Date().toLocaleDateString('cs-CZ')}</Text>
      </View>
    </Page>
  </Document>
)

/**
 * Vygenerování PDF jako Buffer
 */
export async function generateBillingPDF(data: BillingPDFProps): Promise<Buffer> {
  const pdfDoc = <BillingPDF {...data} />
  return await renderToBuffer(pdfDoc)
}

/**
 * Vygenerování PDF jako Base64 string (pro email přílohu)
 */
export async function generateBillingPDFBase64(data: BillingPDFProps): Promise<string> {
  const buffer = await generateBillingPDF(data)
  return buffer.toString('base64')
}
