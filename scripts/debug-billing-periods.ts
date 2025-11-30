import { prisma } from '../lib/prisma';

async function main() {
  const buildingId = 'cmikmr76z0000jkps06anasbc';
  
  const periods = await prisma.billingPeriod.findMany({
    where: { buildingId },
    include: {
      results: {
        include: {
          serviceCosts: {
            include: {
              service: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${periods.length} billing periods`);
  
  for (const p of periods) {
    console.log(`\nYear ${p.year}: ${p.results.length} results`);
    if (p.results[0]) {
      console.log(`  First result ID: ${p.results[0].id}`);
      console.log(`  First result totalCost: ${p.results[0].totalCost}`);
      console.log(`  First result serviceCosts: ${p.results[0].serviceCosts.length}`);
      p.results[0].serviceCosts.slice(0, 3).forEach(sc => {
        console.log(`    - ${sc.service.name}: unitCost=${sc.unitCost}, buildingTotalCost=${sc.buildingTotalCost}`);
      });
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
