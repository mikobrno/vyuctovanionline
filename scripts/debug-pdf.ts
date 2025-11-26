import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { BillingDocument } from '@/components/pdf/BillingDocument'

async function main() {
  const year = 2024
  const data: any = {
    result: {
      result: -1234.56,
      totalCost: 19031.59,
      totalAdvancePrescribed: 22000,
      billingPeriod: { year },
      serviceCosts: [
        {
          service: { id: '1', name: 'Vodné a stočné', measurementUnit: 'm3' },
          buildingTotalCost: 167208,
          unitAdvance: 5000,
          unitCost: 3012,
          unitBalance: -1988,
          buildingConsumption: 116.73,
          unitPricePerUnit: 1944.6,
          unitAssignedUnits: 22.129,
        },
        {
          service: { id: '2', name: 'Bazén', measurementUnit: 'rovným dílem 1/22' },
          buildingTotalCost: 42746,
          unitAdvance: 3000,
          unitCost: 1781,
          unitBalance: -1218,
          buildingConsumption: 288,
          unitPricePerUnit: 148.42,
          unitAssignedUnits: 12,
        },
        {
          service: { id: '3', name: 'Ohřev teplé vody (70)', measurementUnit: 'odečet m³' },
          buildingTotalCost: 76347,
          unitAdvance: 0,
          unitCost: 0,
          unitBalance: 0,
          buildingConsumption: null,
          unitPricePerUnit: null,
          unitAssignedUnits: null,
        },
      ],
    },
    advances: Array.from({ length: 12 }, (_, idx) => ({ month: idx + 1, amount: 3027 })),
    payments: Array.from({ length: 12 }, (_, idx) => ({ amount: 3027, paymentDate: new Date(year, idx, 15).toISOString() })),
    readings: [],
    building: { managerName: 'AdminReal', bankAccount: 'CZ123456789/0100', address: 'Kníničská 318/3' },
    unit: { variableSymbol: '3', unitNumber: '318/03' },
    owner: { firstName: 'Igor', lastName: 'Pelka', address: 'Zborovská 937/1', email: 'pelka@example.com', phone: '721716526' },
    previousResult: { result: 0 },
  }

  const buffer = await renderToBuffer(<BillingDocument data={data} />)
  console.log('PDF size', buffer.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
