
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const units = await prisma.unit.findMany({
    where: {
      building: {
        name: 'Kníničky 318'
      }
    },
    select: {
      id: true,
      unitNumber: true
    }
  });

  console.log('Units:', units);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
