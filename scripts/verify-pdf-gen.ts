
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { BillingStatement } from '@/components/buildings/BillingStatement';

// Mock data
const mockData = {
  building: {
    name: "Společenství vlastníků Mikšíčkova 1513/20",
    address: "Mikšíčkova 1513/20, Židenice, 615 00 Brno",
    accountNumber: "224623004/0300",
    variableSymbol: "1513200119",
    managerName: "AdminReal s.r.o."
  },
  unit: {
    name: "Byt č. 1513/01",
    owner: "Mgr. Patrik Neuwirth",
    share: "100/100",
    address: "Mikšíčkova 1513/20, Židenice, 615 00 Brno",
    variableSymbol: "1513200118",
    bankAccount: "2001002103/2010"
  },
  period: {
    year: 2024,
    startDate: "2024-01-01",
    endDate: "2024-12-31"
  },
  services: [
    { name: "Elektrická energie (společné prostory)", unit: "počet osob", share: "100", buildingCost: 20552.81, buildingUnits: "320.00", pricePerUnit: "64.23", userUnits: "48", userCost: 3083.04, advance: 840.00, result: -2243.04 },
    { name: "Úklid bytového domu", unit: "počet osob", share: "100", buildingCost: 21420.00, buildingUnits: "320.00", pricePerUnit: "66.94", userUnits: "48", userCost: 3213.12, advance: 1080.00, result: -2133.12 }
  ],
  totals: {
    cost: 31264.71,
    advance: 24514.00,
    result: -6750.71,
    repairFund: 20316
  },
  readings: [],
  payments: [],
  fixedPayments: [],
  note: "Nedoplatek uhraďte na účet..."
};

async function run() {
  console.log('Rendering HTML...');
  const html = renderToStaticMarkup(React.createElement(BillingStatement, { data: mockData }));

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
           @page { size: A4; margin: 0; }
           body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
           * { box-sizing: border-box; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log('Setting content...');
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log('Generating PDF...');
  await page.pdf({
    path: 'test-billing.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
  });

  await browser.close();
  console.log('PDF generated at test-billing.pdf');
}

run().catch(console.error);
