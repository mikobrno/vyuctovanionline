
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { BillingStatement } from '@/components/buildings/BillingStatement';
import { renderToStaticMarkup } from 'react-dom/server';
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

    const effectiveBankAccount = normalizeString(summary?.bankAccount) || normalizeString(building.bankAccount);
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
            accountNumber: effectiveBankAccount || '',
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
            bankAccount: activeOwner?.owner?.bankAccount || ''
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

    // 3. Render HTML
    const componentHtml = renderToStaticMarkup(<BillingStatement data={ statementData } />);

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
    return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="vyuctovani-${billingResult.unit.unitNumber}-${year}.pdf"`
        }
    });
}
