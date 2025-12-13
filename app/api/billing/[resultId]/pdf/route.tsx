
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

// Zvýšení timeoutu pro generování na 60s
export const maxDuration = 60;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ resultId: string }> }
) {
    // 1. Auth Check
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { resultId } = await params;

    // 2. Data Fetching (Logic duplicated from page.tsx for stability)
    const billingResult = await prisma.billingResult.findUnique({
        where: { id: resultId },
        include: {
            billingPeriod: {
                include: {
                    building: true
                }
            },
            unit: {
                include: {
                    ownerships: {
                        include: {
                            owner: true
                        },
                        orderBy: {
                            validFrom: 'desc'
                        }
                    }
                }
            },
            serviceCosts: {
                include: {
                    service: true
                },
                orderBy: {
                    service: {
                        order: 'asc'
                    }
                }
            }
        }
    });

    if (!billingResult) {
        return new NextResponse('Billing Result Not Found', { status: 404 });
    }

    const building = billingResult.billingPeriod.building;
    const year = billingResult.billingPeriod.year;

    // Helper parsing logic
    const parseSummary = (json: string | null) => {
        if (!json) return null;
        try { return JSON.parse(json); } catch { return null; }
    };
    const normalizeString = (val: any) => (typeof val === 'string' && val.trim().length > 0) ? val.trim() : null;
    const parseAmountValue = (val: any) => {
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        if (typeof val === 'string') {
            const n = Number(val.replace(/[\s\u00A0]/g, '').replace(',', '.').replace(/[^0-9+\-.]/g, ''));
            return Number.isFinite(n) ? n : null;
        }
        return null;
    };

    const summary = parseSummary(billingResult.summaryJson);
    const summaryFixedPayments = Array.isArray(summary?.fixedPayments)
        ? summary.fixedPayments.map((p: any) => ({
            name: normalizeString(p?.name),
            amount: parseAmountValue(p?.amount)
        })).filter((p: any) => p.name && p.amount !== null)
        : [];

    // Účet společenství je VŽDY účet budovy/SVJ.
    // summary.bankAccount je účet člena (pro přeplatek) a nesmí se použít jako účet SVJ.
    const buildingBankAccount = normalizeString(building.bankAccount);
    const memberBankAccount = normalizeString(summary?.bankAccount);
    const effectiveVariableSymbol = normalizeString(billingResult.unit.variableSymbol) || normalizeString(summary?.vs || summary?.variableSymbol);

    // Owner Logic
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const activeOwner = billingResult.unit.ownerships.find(o => {
        const start = o.validFrom;
        const end = o.validTo || new Date(9999, 11, 31);
        return start <= yearEnd && end >= yearStart;
    }) || billingResult.unit.ownerships[0];

    // Additional Data
    const meters = await prisma.meter.findMany({
        where: { unitId: billingResult.unitId },
        include: { readings: { where: { period: year } }, service: true }
    });

    const payments = await prisma.payment.findMany({
        where: { unitId: billingResult.unitId, period: year },
        orderBy: { paymentDate: 'asc' }
    });

    const advanceMonthlies = await prisma.advanceMonthly.findMany({
        where: { unitId: billingResult.unitId, year: year },
        include: { service: true }
    });

    const advanceByService = new Map<string, number>();
    advanceMonthlies.forEach(a => {
        advanceByService.set(a.serviceId, (advanceByService.get(a.serviceId) || 0) + a.amount);
    });

    const getMethodologyLabel = (service: any) => {
        switch (service.methodology) {
            case 'OWNERSHIP_SHARE': return 'vlastnický podíl';
            case 'AREA': return 'm2 plochy';
            case 'PERSON_MONTHS': return 'osobo-měsíce';
            case 'METER_READING': return service.measurementUnit === 'kWh' ? 'odečet tepla' : `odečet ${service.measurementUnit || ''}`.trim();
            case 'FIXED_PER_UNIT': return 'na byt';
            case 'EQUAL_SPLIT': return 'rovným dílem';
            case 'UNIT_PARAMETER': return 'dle parametru';
            default: return service.measurementUnit || '';
        }
    };

    const parseDistributionShare = (value?: string | null) => {
        if (!value) return null;
        const normalized = value.toString().replace(/%/g, '').replace(',', '.').trim();
        if (!normalized) return null;
        const num = Number(normalized);
        return Number.isFinite(num) ? num : value.trim();
    };

    // Prescriptions & Payments Arrays
    let prescriptions = (billingResult.monthlyPrescriptions as number[]) || [];
    if (prescriptions.length === 0 || prescriptions.every(v => v === 0)) {
        if (Array.isArray(billingResult.monthlyPayments) && (billingResult.monthlyPayments as number[]).some(v => v > 0)) {
            prescriptions = billingResult.monthlyPayments as number[];
        } else {
            // Calculate
            const calc = Array(12).fill(0);
            const totalAdv = advanceMonthlies.filter(a => a.service.code === 'TOTAL_ADVANCE' || a.service.name === 'Celková záloha');
            const source = totalAdv.length > 0 ? totalAdv : advanceMonthlies;
            source.forEach(rec => { if (rec.month >= 1 && rec.month <= 12) calc[rec.month - 1] += rec.amount; });
            if (calc.some(v => v > 0)) prescriptions = calc;
        }
    }
    if (prescriptions.length < 12) prescriptions = [...prescriptions, ...Array(12 - prescriptions.length).fill(0)];

    let paid = (billingResult.monthlyPayments as number[]) || [];
    if (paid.length === 0 || paid.every(v => v === 0)) {
        if (Array.isArray(billingResult.monthlyPrescriptions) && (billingResult.monthlyPrescriptions as number[]).some(v => v > 0)) {
            paid = billingResult.monthlyPrescriptions as number[];
        } else {
            const calcPaid = Array(12).fill(0);
            payments.forEach(p => { const m = p.paymentDate.getMonth(); if (m >= 0 && m < 12) calcPaid[m] += p.amount; });
            if (calcPaid.some(v => v > 0)) paid = calcPaid;
        }
    }
    if (paid.length < 12) paid = [...paid, ...Array(12 - paid.length).fill(0)];

    const paymentsData = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        prescribed: prescriptions[i] || 0,
        paid: paid[i] || 0
    }));

    // QR Code (Skip generation inside PDF route for speed, pass null or generate simpler?)
    // Using imported generator, but ignoring for now or fetching if exists in DB
    const qrCodeUrl = billingResult.pdfUrl ? '' : undefined; // Placeholder if needed

    // Readings
    const readingsFromSnapshot: any[] = [];
    billingResult.serviceCosts.forEach(cost => {
        if (cost.meterReadings) {
            try {
                const parsed = JSON.parse(cost.meterReadings as string);
                parsed.forEach((m: any) => readingsFromSnapshot.push({
                    service: cost.service.name, meterId: m.serial, startValue: m.start, endValue: m.end, consumption: m.consumption
                }));
            } catch { }
        }
    });

    const finalReadings = readingsFromSnapshot.length > 0
        ? readingsFromSnapshot
        : meters.flatMap(m => m.readings.map(r => ({
            service: m.service?.name || m.type,
            meterId: m.serialNumber,
            startValue: r.startValue || 0,
            endValue: r.endValue || r.value,
            consumption: r.consumption || (r.value - (r.startValue || 0))
        })));

    // Final Data Structure
    const statementData = {
        building: {
            name: building.name,
            address: `${building.address}, ${building.city}`,
            accountNumber: buildingBankAccount || '',
            variableSymbol: effectiveVariableSymbol || '',
            managerName: building.managerName || undefined
        },
        unit: {
            name: billingResult.unit.unitNumber,
            owner: activeOwner ? `${activeOwner.owner.firstName} ${activeOwner.owner.lastName}`.trim() : 'Neznámý vlastník',
            share: `${billingResult.unit.shareNumerator}/${billingResult.unit.shareDenominator}`,
            address: activeOwner?.owner?.address || '',
            email: activeOwner?.owner?.email || '',
            phone: activeOwner?.owner?.phone || '',
            bankAccount: memberBankAccount || activeOwner?.owner?.bankAccount || ''
        },
        period: {
            year: year,
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`
        },
        services: billingResult.serviceCosts.map(cost => {
            const distributionShare = parseDistributionShare(cost.distributionShare);
            return {
                name: cost.service.name,
                unit: cost.distributionBase || cost.calculationBasis || getMethodologyLabel(cost.service),
                share: distributionShare ?? (activeOwner?.sharePercent ?? 100),
                buildingCost: cost.buildingTotalCost,
                buildingUnits: cost.buildingUnits || cost.buildingConsumption || 0,
                pricePerUnit: cost.unitPrice || cost.unitPricePerUnit || 0,
                userUnits: cost.unitUnits || cost.unitConsumption || 0,
                userCost: cost.unitCost,
                advance: cost.unitAdvance || advanceByService.get(cost.serviceId) || 0,
                result: cost.unitBalance
            }
        }),
        fixedPayments: summaryFixedPayments,
        note: normalizeString(summary?.resultNote),
        totals: {
            cost: billingResult.totalCost,
            advance: billingResult.totalAdvancePrescribed,
            result: billingResult.result,
            repairFund: billingResult.repairFund
        },
        readings: finalReadings,
        payments: paymentsData,
        qrCodeUrl: undefined // QR code skipped in PDF for now to simplify
    };

    // 3. Generate HTML (bez React renderu - čistě stringový HTML)
    const formatNumber = (val: number | string, decimals = 2) => {
        if (typeof val === 'string') return val;
        return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(val));
    };

    const formatShare = (share: number | string | null | undefined) => {
        if (share === null || share === undefined || share === '') return '-';
        if (typeof share === 'string') return share;
        return `${formatNumber(share as number, 2)} %`;
    };

    const isBrnoReal = statementData.building.managerName?.toLowerCase().includes('brnoreal') || false;
    const logoSrc = isBrnoReal ? '/brnoreal.png' : '/adminreal.png';

    const displayedServices = statementData.services.filter(s => !(s.buildingCost === 0 && s.advance === 0));
    const fixedPayments = [...(statementData.fixedPayments ?? [])];
    if (statementData.totals.repairFund && statementData.totals.repairFund > 0) {
        fixedPayments.push({ name: 'Fond oprav', amount: statementData.totals.repairFund });
    }

    const serviceRowsHtml = displayedServices
        .map((service, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-300">
            <td class="p-1 px-2 text-left bg-gray-100 font-medium border-r border-gray-300">${service.name}</td>
            <td class="p-1 text-center">${service.unit}</td>
            <td class="p-1 text-center border-r border-black">${formatShare(service.share)}</td>
            <td class="p-1 text-right">${formatNumber(service.buildingCost)}</td>
            <td class="p-1 text-right">${formatNumber(service.buildingUnits)}</td>
            <td class="p-1 text-right border-r border-black">${formatNumber(service.pricePerUnit)}</td>
            <td class="p-1 text-right bg-white">${formatNumber(service.userUnits)}</td>
            <td class="p-1 text-right font-semibold bg-white">${formatNumber(service.userCost)}</td>
            <td class="p-1 text-right bg-white">${formatNumber(service.advance)}</td>
            <td class="p-1 text-right font-bold bg-gray-100 border-l border-black">${formatNumber(service.result)}</td>
        </tr>
        `).join('');

    const paymentsHtml = statementData.payments
        .map(p => `<div class="border-r border-gray-400 p-0.5 text-right px-1">${formatNumber(p.paid, 0)}</div>`)
        .join('');
    
    const prescriptionsHtml = statementData.payments
        .map(p => `<div class="border-r border-gray-400 p-0.5 text-right px-1">${formatNumber(p.prescribed, 0)}</div>`)
        .join('');

    const readingsHtml = statementData.readings.length > 0 ? `
        <div class="mt-4 border-t border-black pt-2">
            <h3 class="font-bold mb-2">Stavy měřidel</h3>
            <table class="w-full text-xs border-collapse">
                <thead>
                    <tr class="border-b border-black">
                        <th class="text-left py-1">Služba</th>
                        <th class="text-left py-1">Číslo měřidla</th>
                        <th class="text-right py-1">Počáteční stav</th>
                        <th class="text-right py-1">Konečný stav</th>
                        <th class="text-right py-1">Spotřeba</th>
                    </tr>
                </thead>
                <tbody>
                    ${statementData.readings.map(r => `
                    <tr class="border-b border-gray-200">
                        <td class="py-1">${r.service}</td>
                        <td class="py-1">${r.meterId}</td>
                        <td class="text-right py-1">${formatNumber(r.startValue)}</td>
                        <td class="text-right py-1">${formatNumber(r.endValue)}</td>
                        <td class="text-right py-1 font-bold">${formatNumber(r.consumption)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    const componentHtml = `
    <div class="max-w-[297mm] mx-auto bg-white p-6 text-[11px] font-sans leading-tight print:p-0 print:max-w-none text-black">
        <div class="flex justify-between items-start mb-2 pb-2 border-b-2 border-black">
            <div class="w-1/2">
                <h1 class="text-xl font-bold mb-1">${statementData.unit.owner}</h1>
                <div class="grid grid-cols-[120px_1fr] gap-x-2 gap-y-0.5">
                    <span class="font-bold">adresa společenství:</span>
                    <span>${statementData.building.name}, ${statementData.building.address}</span>
                    <span class="font-bold">bankovní spojení společenství:</span>
                    <span>${statementData.building.accountNumber}</span>
                </div>
            </div>
            <div class="w-1/2 text-right flex flex-col items-end">
                <img src="${logoSrc}" alt="logo" class="h-12 object-contain mb-2" />
                <div class="text-[10px] text-gray-600 mb-1">
                    ${isBrnoReal ? 'BrnoReal' : 'AdminReal s.r.o., Veveří 2581/102, 616 00 Brno, IČO 02827476'}
                </div>
                <div class="grid grid-cols-[auto_1fr] gap-x-4 text-left mt-2 w-full justify-end">
                    <div class="text-right">
                        <div class="mb-0.5"><span class="font-bold">bankovní spojení člena:</span> ${statementData.unit.bankAccount || '-'}</div>
                        <div><span class="font-bold">variabilní symbol pro platbu nedoplatku:</span> ${statementData.building.variableSymbol}</div>
                    </div>
                    <div class="text-right border-l pl-2 border-gray-300">
                        <div class="font-bold">č. prostoru: ${statementData.unit.name}</div>
                        <div>zúčtovací období: ${new Date(statementData.period.startDate).toLocaleDateString('cs-CZ')} - ${new Date(statementData.period.endDate).toLocaleDateString('cs-CZ')}</div>
                    </div>
                </div>
            </div>
        </div>

        <h2 class="text-center text-lg font-bold mb-2 border-b-2 border-black pb-1">
            Vyúčtování služeb: ${statementData.period.year}
        </h2>

        <div class="mb-4">
            <table class="w-full border-collapse border-b-2 border-black">
                <thead>
                    <tr class="border-b border-black">
                        <th colspan="3" class="p-1 border-r border-black font-normal text-right pr-4 bg-gray-100"></th>
                        <th colspan="3" class="p-1 border-r border-black font-normal text-center bg-gray-100">Odběrné místo (dům)</th>
                        <th colspan="4" class="p-1 font-normal text-center bg-gray-100">Uživatel</th>
                    </tr>
                    <tr class="bg-gray-200 border-b border-black font-semibold text-center">
                        <th class="p-1 text-left w-[25%]">Položka</th>
                        <th class="p-1 text-center w-[10%]">Jednotka</th>
                        <th class="p-1 text-center w-[8%] border-r border-black">Podíl</th>
                        <th class="p-1 text-right w-[10%]">Náklad</th>
                        <th class="p-1 text-right w-[8%]">Jednotek</th>
                        <th class="p-1 text-right w-[8%] border-r border-black">Kč/jedn</th>
                        <th class="p-1 text-right w-[8%]">Jednotek</th>
                        <th class="p-1 text-right w-[10%]">Náklad</th>
                        <th class="p-1 text-right w-[10%]">Záloha</th>
                        <th class="p-1 text-right w-[10%] bg-gray-300">Přeplatky|nedoplatky</th>
                    </tr>
                </thead>
                <tbody>
                    ${serviceRowsHtml}
                    <tr class="font-bold text-black text-[12px]">
                        <td colspan="3" class="p-2 text-left">Celkem náklady na odběrné místa</td>
                        <td class="p-2 text-right">${formatNumber(displayedServices.reduce((acc, s) => acc + s.buildingCost, 0))}</td>
                        <td colspan="2" class="border-r border-black"></td>
                        <td class="p-2 text-right" colspan="1">Celkem vyúčtování:</td>
                        <td class="p-2 text-right">${formatNumber(statementData.totals.cost)}</td>
                        <td class="p-2 text-right">${formatNumber(statementData.totals.advance)}</td>
                        <td class="p-2 text-right border-l border-black">${formatNumber(statementData.totals.result)} Kč</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="flex justify-end mb-6">
            <div class="w-[350px]">
                <div class="flex justify-between items-center text-sm mb-1">
                    <span>Nedoplatek v účtovaném období</span>
                    <span class="font-bold">${statementData.totals.result < 0 ? formatNumber(statementData.totals.result) : '0,00'} Kč</span>
                </div>
                <div class="flex justify-between items-center text-lg font-bold border-t-2 border-black pt-1 mt-1">
                    <span class="uppercase">${statementData.totals.result >= 0 ? 'PŘEPLATEK CELKEM' : 'NEDOPLATEK CELKEM'}</span>
                    <span>${formatNumber(statementData.totals.result)} Kč</span>
                </div>
                ${statementData.totals.result < 0 ? `
                <div class="bg-gray-200 text-center font-bold p-1 mt-2 border border-gray-400">
                    Nedoplatek uhraďte na účet číslo: ${statementData.building.accountNumber}, variabilní symbol ${statementData.building.variableSymbol}
                </div>
                ` : ''}
            </div>
        </div>

        <div class="grid grid-cols-[1fr_2fr] gap-8 mb-4">
            <div>
                <table class="w-full border-collapse border border-gray-400 text-xs">
                    <thead>
                        <tr class="bg-gray-200">
                            <th class="border border-gray-400 p-1">Pevné platby</th>
                            <th class="border border-gray-400 p-1 text-right">Celkem za rok</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fixedPayments.map(p => `
                        <tr>
                            <td class="border border-gray-400 p-1">${p.name}</td>
                            <td class="border border-gray-400 p-1 text-right font-bold">${formatNumber(p.amount)} Kč</td>
                        </tr>
                        `).join('')}
                        ${fixedPayments.length === 0 ? '<tr><td colspan="2" class="p-1 text-center text-gray-400">-</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            <div>
                <div class="mb-2">
                    <div class="bg-gray-200 font-bold text-center border border-gray-400 p-0.5 text-xs">Přehled úhrad za rok ${statementData.period.year}</div>
                    <div class="grid grid-cols-[80px_repeat(12,_1fr)] text-[10px] border-l border-b border-gray-400">
                        <div class="border-r border-t border-gray-400 p-0.5 font-bold">Měsíc</div>
                        ${Array.from({ length: 12 }).map((_, i) => `<div class="border-r border-t border-gray-400 p-0.5 text-center">${i + 1}/${statementData.period.year}</div>`).join('')}
                        <div class="border-r border-gray-400 p-0.5 font-bold">Uhrazeno</div>
                        ${paymentsHtml}
                        <div class="border-r border-gray-400 p-0.5 font-bold">Předpis</div>
                        ${prescriptionsHtml}
                    </div>
                </div>
            </div>
        </div>

        ${readingsHtml}

        <div class="mt-8 pt-2 border-t border-black text-[10px] text-gray-700 space-y-1">
            <p>Jednotková cena za m3 vody činila v roce ${statementData.period.year} dle ceníku BVaK 105,53 Kč.</p>
        </div>
    </div>
    `;

    // Load Base64 Images
    const publicDir = path.join(process.cwd(), 'public');
    let adminRealBase64 = '';
    let brnoRealBase64 = '';

    try {
        const adminRealBuff = await fs.readFile(path.join(publicDir, 'adminreal.png'));
        adminRealBase64 = `data:image/png;base64,${adminRealBuff.toString('base64')}`;
    } catch (e) { console.error('Failed to load adminreal.png', e); }

    try {
        const brnoRealBuff = await fs.readFile(path.join(publicDir, 'brnoreal.png'));
        brnoRealBase64 = `data:image/png;base64,${brnoRealBuff.toString('base64')}`;
    } catch (e) { console.error('Failed to load brnoreal.png', e); }

    // 4. Build Full HTML Document
    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>
        ${componentHtml}
      </body>
    </html>
    `;

    // 5. Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });

    await browser.close();

    // 6. Return PDF Response
    return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="vyuctovani-${billingResult.unit.unitNumber}-${year}.pdf"`
        }
    });
}
