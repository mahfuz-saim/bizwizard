// prisma/seed.ts

import { PrismaClient, ProductCategory } from '@prisma/client';
import medicines from './medicines.json';

const prisma = new PrismaClient();

async function main() {
    const inventoryData = medicines.map(item => ({
        productName: item.combined,
        barcode: `med-${item['Brand Name']}`,
        measuringUnit: item['Dosage Form'],
        genericName: item['Generic Name'],
        category: ProductCategory.MEDICINE,
    }));

    await prisma.inventory.createMany({
        data: inventoryData,
        skipDuplicates: true, // ignores records with duplicate barcodes
    });

    console.log(`Inserted ${inventoryData.length} medicines`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
