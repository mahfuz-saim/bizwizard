import {
    PrismaClient,
    UserRole,
    UserStatus,
    PaymentStatus,
    LotStatus,
    DebtStatus,
    ExpenseType,
    DiscountType,
} from '@prisma/client';

const prisma = new PrismaClient();

const SHOP_ID = '7af5edf8-81f7-4c05-aa07-2498f4954886';
// const SHOP_ID = 'shop-001';

const items = await prisma.shopVariant.findMany({
    where: {
        name: null,
        shopID: SHOP_ID,
    },
    include: {
        product: true,
    },
});

const name = items[0].name;

items.forEach(async item => {
    await prisma.shopVariant.update({
        where: {
            id: item.id,
        },
        data: {
            // variantName: item.product?.productName.replace(/\s+/g, '_') || '',
            name: item.product?.productName,
        },
    });
});

console.log(items.length);
console.log(name);
