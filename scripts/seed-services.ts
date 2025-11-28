import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const servicesList = [
  { code: '1', name: 'Elektřina' },
  { code: '2', name: 'Úklid vnitřní' },
  { code: '3', name: 'Komíny' },
  { code: '4', name: 'Pravidelná údržba výtah' },
  { code: '5', name: 'Vodné (studená voda)' },
  { code: '6', name: 'Vodné (teplá voda)' },
  { code: '7', name: 'Záloha na teplo' },
  { code: '8', name: 'Pojištění domu' },
  { code: '9', name: 'Ostatní náklady - UPC' },
  { code: '10', name: 'Ohřev teplé vody (30)' },
  { code: '11', name: 'Ohřev teplé vody (70)' },
  { code: '12', name: 'Správa' },
  { code: '13', name: 'Ostatní náklady (sklepy)' },
  { code: '14', name: 'Poplatek za psa' },
  { code: '15', name: 'Vodné (společné části a rozdíl)' },
  { code: '16', name: 'Mzdové náklady' },
  { code: '17', name: 'Poštovné' },
  { code: '18', name: 'Garáže' },
  { code: '19', name: 'Ohřev teplé vody (TUV)' },
  { code: '20', name: 'Ostatní nájemné' },
  { code: '21', name: 'Ostatní služby' },
  { code: '22', name: 'Vodné a stočné' },
  { code: '23', name: 'Bazén' },
  { code: '24', name: 'Fond společenství' },
  { code: '25', name: 'Úklid venkovní' },
  { code: '26', name: 'Fond oprav' },
  { code: '27', name: 'Prázdné' },
  { code: '28', name: 'Počet jednotek' },
  { code: '29', name: 'Osvětlení' },
  { code: '30', name: 'Úklid bytového domu' },
  { code: '31', name: 'Ostatní náklady (garáž a sklepy)' },
  { code: '33', name: 'Fond oprav nebytových prostor' },
  { code: '34', name: 'Servisy' },
  { code: '35', name: 'Účetnictví SVJ' },
  { code: '36', name: 'Úklid venkovní, sekání trávy a zimní údržba' },
  { code: '37', name: 'Odměna výboru' },
  { code: '39', name: 'Ostatní náklady - internet' },
  { code: '40', name: 'Studená voda' },
  { code: '41', name: 'Elektrická energie (společné prostory)' },
  { code: '42', name: 'Správa domu' },
  { code: '43', name: 'Společné náklady' },
  { code: '45', name: 'Ostatní služby 2' },
  { code: '46', name: 'Plyn' },
  { code: '47', name: 'Otop' },
  { code: '48', name: 'SUR voda' },
  { code: '49', name: 'Fond údržby' },
  { code: '50', name: 'Náklady vlastní správní činnosti|předseda' },
  { code: '51', name: 'Náklady vlastní správní činnosti|správce' },
  { code: '52', name: 'Náklady vlastní správní činnosti|revizor' },
  { code: '53', name: 'Ostatní správní činnost' },
  { code: '54', name: 'Záloha na ohřev vody' },
  { code: '55', name: 'Záloha na vodné a stočné' },
  { code: '56', name: 'Výtah' },
  { code: '57', name: 'Úklid' },
  { code: '58', name: 'Teplo' },
  { code: '59', name: 'Odměna statutárům' },
  { code: '60', name: 'Příspěvky na správu domu a pozemku (FO)' },
  { code: '61', name: 'Autovýtah - elektřina' },
  { code: '62', name: 'Bazén (servis) a teplo' },
  { code: '63', name: 'Drobná pořízení SVJ, úklid vnitřní, pojištění' },
  { code: '64', name: 'Servisní činnost(bez servisu bazénu)' },
  { code: '65', name: 'Účetnictví, odměna výboru, správa, bankovní poplatky' },
  { code: '66', name: 'venkovní úklid' },
  { code: '67', name: 'VZT' },
  { code: '68', name: 'Elektro společných prostor' },
  { code: '69', name: 'Uživatelská záloha' },
  { code: '70', name: 'Studená a teplá voda' },
  { code: '71', name: 'Společná elektřina' },
  { code: '72', name: 'Odměna výboru SVJ' },
  { code: '73', name: 'Správa nemovitosti' },
  { code: '74', name: 'Ostatní náklady (garáž)' },
  { code: '75', name: 'Ohřev teplé vody' },
  { code: '76', name: 'Úklid lidé' },
  { code: '77', name: 'Vodné a stočné měřené' },
  { code: '78', name: 'Správní poplatek' },
  { code: '79', name: 'SE byty' },
  { code: '80', name: 'Ostatní služby PBJ' },
  { code: '81', name: 'Fond společenství P' },
  { code: '82', name: 'Fond oprav SV PP' },
  { code: '83', name: 'Teplo měřené 40/60' },
  { code: '84', name: 'Ostatní služby P' },
  { code: '88', name: 'Autovýtah - údržba a provoz' },
  { code: '89', name: 'Odměny funkcionářů' },
  { code: '90', name: 'Pojištění' },
  { code: '91', name: 'Úvěr - balkón' },
  { code: '92', name: 'Poplatek za správu' },
  { code: '94', name: 'Teplo' },
  { code: '95', name: 'TUV' },
  { code: '96', name: 'STA' },
  { code: '97', name: 'Správa domu' },
  { code: '98', name: 'Úklid domu' },
  { code: '99', name: 'Ostatní služby 1' },
  { code: '100', name: 'Ostatní služby 2' },
  { code: '101', name: 'Odměna statutárům' },
  { code: '102', name: 'Ostatní náklady UPC' },
  { code: '103', name: 'Elektřina - garáže' },
  { code: '104', name: 'Odměny funkcionářů' },
  { code: '105', name: 'Úvěr - výtah' },
  { code: '106', name: 'Úklid - garáže' },
  { code: '107', name: 'Dlouhodobé zálohy / OPV' },
  { code: '108', name: 'Elektřina (spol. gar. prostory)' },
  { code: '109', name: 'Úklid (sklad)' },
  { code: '110', name: 'El. energie' },
  { code: '111', name: '____' },
  { code: '112', name: 'Pojištění nemovitosti' },
  { code: '113', name: 'Odměna statutárního orgánu' },
  { code: '114', name: 'Elektřina (garáž)' },
  { code: '115', name: 'Fond oprav (garáž)' },
  { code: '116', name: 'Pojištění nemovitosti (garáž)' },
  { code: '117', name: 'Společná elektřina (garáž)' },
  { code: '118', name: 'Správa domu (garáž)' },
  { code: '119', name: 'Úklid - garáž)' },
  { code: '120', name: 'Úklid (garáž)' },
  { code: '121', name: 'Výtah (garáž)' },
  { code: '122', name: 'Teplo - spotřební složka' },
  { code: '123', name: 'Teplo - základní složka' },
  { code: '124', name: 'Teplá voda' },
  { code: '125', name: 'Elektřina (sklad)' },
  { code: '126', name: 'Pojištění nemovitosti (sklad)' },
  { code: '127', name: 'OPV (sklad)' },
  { code: '128', name: 'Správa nemovitosti (sklad)' },
  { code: '129', name: 'El. energie - spol. garážové prostory' },
  { code: '130', name: 'Elektřina v jednotce (VT)' },
  { code: '131', name: 'El. energie - spol. garáž. prostory' },
  { code: '132', name: 'Spotřební složka TV' },
  { code: '133', name: 'Základní složka TV' },
  { code: '134', name: 'SV na TV' },
  { code: '135', name: 'Pojištění zaměstnavatele' },
  { code: '136', name: 'Elektřina (společné prostory)' },
  { code: '137', name: 'Vyhřívání vjezdu a ovládání vrat (garáž)' },
  { code: '138', name: 'Správní činnost' },
  { code: '139', name: 'Dlouhodobá záloha (fond oprav)' },
  { code: '140', name: 'Kominické služby' },
  { code: '141', name: 'Balkón - oprava minulých let' },
  { code: '142', name: 'Cena za jednotku' },
  { code: '143', name: 'Nájemné' },
  { code: '144', name: 'Elektřina v jednotce (NT)' },
  { code: '145', name: 'Revize kotlů' },
  { code: '146', name: 'Úklid společných prostor' },
  { code: '147', name: 'Správa a účetnictví' },
  { code: '148', name: 'Fond dlouhodobých záloh' },
  { code: '149', name: 'Odečty' },
  { code: '150', name: 'Dlouhodobá záloha na opravy' },
  { code: '151', name: 'Tvorba na splátku úvěru' },
  { code: '152', name: 'Externí služby' },
  { code: '153', name: 'Ostatní provozní náklady' },
  { code: '155', name: 'Fond oprav (sklep)' },
  { code: '156', name: 'Společná elektřina (sklep)' },
  { code: '157', name: 'Správa domu (sklep)' },
  { code: '158', name: 'Pojištění nemovitosti (sklep)' },
  { code: '159', name: 'Ostatní náklady (sklep)' },
  { code: '160', name: 'Vodné pro TUV' },
  { code: '161', name: 'Elektřina - společné prostory' },
  { code: '162', name: 'Fond režie' },
  { code: '163', name: 'Pronájem sklep' },
  { code: '164', name: 'Členský příspěvek' },
  { code: '165', name: 'Vedení účetnictví' },
  { code: '166', name: 'SIPO' },
  { code: '167', name: 'Spořící účet' },
  { code: '168', name: 'Úvěr' },
  { code: '169', name: 'Příjem z pronájmu' },
  { code: '170', name: 'Správa - společná' },
  { code: '171', name: 'Správa - byty' },
  { code: '172', name: 'Osvětlení společných prostor' },
  { code: '173', name: 'Tvorba na splátku úvěru|jednotka - okna, žaluzie, balkony' },
  { code: '174', name: 'Tvorba na splátku úvěru|dům - zateplení, střecha' },
  { code: '175', name: 'Elektřina|sklepní kóje' },
  { code: '176', name: 'Fond oprav|garáž' },
  { code: '177', name: 'Vodné|studená voda' },
  { code: '178', name: 'Vodné|teplá voda' },
  { code: '179', name: 'Elektřina|garáže' },
  { code: '180', name: 'Úklid|garáže' },
  { code: '181', name: 'Fond oprav|garáž' },
  { code: '182', name: 'Ostatní náklady|garáž' },
  { code: '183', name: 'Elektřina|společné prostory' },
  { code: '184', name: 'Úklid|domu' },
  { code: '185', name: 'Pojištění nemovitosti|garáž' },
  { code: '186', name: 'Fond oprav|byty' },
  { code: '187', name: 'Pojištění nemovitosti|byty' },
  { code: '188', name: 'Ostatní náklady|garáže' },
  { code: '189', name: 'Úklid | parkování' },
  { code: '190', name: 'Údržba zeleně' },
  { code: '191', name: 'Provozní režie' },
];

async function main() {
  console.log('🚀 Začínám import služeb...');

  const targetArg = process.argv[2];
  let buildings: Awaited<ReturnType<typeof prisma.building.findMany>>;

  if (targetArg && targetArg !== '--all') {
    const building = await prisma.building.findUnique({ where: { id: targetArg } });
    if (!building) {
      console.error(`❌ Budova s ID "${targetArg}" neexistuje.`);
      process.exit(1);
    }
    buildings = [building];
  } else {
    buildings = await prisma.building.findMany();
    if (!buildings.length) {
      console.error('❌ V databázi není žádná budova. Nejdříve vytvořte budovu.');
      process.exit(1);
    }
  }

  for (const building of buildings) {
    console.log(`🏢 Importuji služby pro budovu: ${building.name} (${building.id})`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const service of servicesList) {
      // Nahradit | za " - " pro lepší čitelnost
      const formattedName = service.name.replace(/\|/g, ' - ');

      // Upsert služby podle kódu
      const result = await prisma.service.upsert({
        where: {
          buildingId_code: {
            buildingId: building.id,
            code: service.code,
          },
        },
        update: {
          name: formattedName,
          // Neměníme metodiku, pokud už existuje, aby se nerozbilo nastavení
        },
        create: {
          buildingId: building.id,
          code: service.code,
          name: formattedName,
          methodology: 'OWNERSHIP_SHARE', // Defaultní metodika, uživatel si musí nastavit
          order: parseInt(service.code),
          showOnStatement: true,
        },
      });

      // Detekce vytvoření vs aktualizace (podle createdAt)
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        createdCount++;
      } else {
        updatedCount++;
      }
    }

    console.log(`   ✅ Hotovo pro ${building.name}`);
    console.log(`      Vytvořeno: ${createdCount}`);
    console.log(`      Aktualizováno: ${updatedCount}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
