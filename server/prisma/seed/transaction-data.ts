import { Prisma, ProductCategory } from '@prisma/client';

export const SEED_PASSWORD = 'BizWizard@2026!';
export const seedAccounts = [
    {
        key: 'year',
        email: 'ownery@mail.com',
        name: 'Mahmud Hasan',
        shop: 'Gazipur Family Mart',
        number: '01000000001',
        customers: 180,
        years: 2,
    },
    {
        key: 'week',
        email: 'ownerw@mail.com',
        name: 'Nusrat Rahman',
        shop: 'Dhaka Neighbourhood Store',
        number: '01000000002',
        customers: 60,
        years: 0,
    },
] as const;
export type SeedAccount = (typeof seedAccounts)[number];

// Fixed namespaces make reruns safe and make fixtures easy to identify.
export const seedId = (account: SeedAccount, kind: string, index = 0) =>
    `seed-v2-${account.key}-${kind}-${index}`;
const money = (value: number) => Math.round(value * 100) / 100;
const firstNames = [
    'Arif',
    'Rina',
    'Kamal',
    'Fatema',
    'Rahim',
    'Shila',
    'Jamal',
    'Nadia',
    'Sajid',
    'Mariam',
    'Hasan',
    'Farhana',
    'Imran',
    'Sadia',
    'Rafiq',
    'Salma',
    'Tanvir',
    'Ayesha',
];
const lastNames = [
    'Ahmed',
    'Begum',
    'Islam',
    'Khan',
    'Akter',
    'Hossain',
    'Sarker',
    'Chowdhury',
    'Ali',
    'Rahman',
];
const streets = [
    'Chandana Chowrasta',
    'Joydebpur',
    'Tongi Bazar',
    'Board Bazar',
    'Uttara',
    'Mirpur',
];

// 40 everyday products, each with three pack sizes: 120 distinct catalog items.
const catalog: [string, ProductCategory, number][] = [
    ['Miniket rice', 'PANTRY_STAPLES', 72],
    ['Nazirshail rice', 'PANTRY_STAPLES', 88],
    ['Whole wheat flour', 'PANTRY_STAPLES', 62],
    ['Masoor dal', 'PANTRY_STAPLES', 125],
    ['Moong dal', 'PANTRY_STAPLES', 155],
    ['Chickpeas', 'PANTRY_STAPLES', 110],
    ['White sugar', 'PANTRY_STAPLES', 135],
    ['Iodized salt', 'PANTRY_STAPLES', 42],
    ['Soybean oil', 'PANTRY_STAPLES', 175],
    ['Mustard oil', 'PANTRY_STAPLES', 240],
    ['Turmeric powder', 'PANTRY_STAPLES', 65],
    ['Chilli powder', 'PANTRY_STAPLES', 80],
    ['Cumin powder', 'PANTRY_STAPLES', 95],
    ['Coriander powder', 'PANTRY_STAPLES', 55],
    ['Black tea', 'BEVERAGES', 110],
    ['Instant coffee', 'BEVERAGES', 180],
    ['Mango juice', 'BEVERAGES', 85],
    ['Drinking water', 'BEVERAGES', 25],
    ['Orange drink', 'BEVERAGES', 50],
    ['Lemon soda', 'BEVERAGES', 45],
    ['UHT milk', 'DAIRY_PRODUCTS', 100],
    ['Milk powder', 'DAIRY_PRODUCTS', 290],
    ['Ghee', 'DAIRY_PRODUCTS', 320],
    ['Cheese spread', 'DAIRY_PRODUCTS', 180],
    ['Butter cookies', 'SNACKS_AND_CONFECTIONERY', 60],
    ['Cream biscuits', 'SNACKS_AND_CONFECTIONERY', 35],
    ['Potato chips', 'SNACKS_AND_CONFECTIONERY', 30],
    ['Chanachur', 'SNACKS_AND_CONFECTIONERY', 55],
    ['Chocolate bar', 'SNACKS_AND_CONFECTIONERY', 40],
    ['Instant noodles', 'PANTRY_STAPLES', 45],
    ['Vermicelli', 'PANTRY_STAPLES', 50],
    ['Tomato sauce', 'CANNED_AND_JARRED_GOODS', 120],
    ['Laundry detergent', 'HOUSEHOLD_SUPPLIES', 130],
    ['Dishwashing liquid', 'HOUSEHOLD_SUPPLIES', 95],
    ['Floor cleaner', 'HOUSEHOLD_SUPPLIES', 160],
    ['Tissue box', 'HOUSEHOLD_SUPPLIES', 75],
    ['Bath soap', 'PERSONAL_CARE_PRODUCTS', 65],
    ['Shampoo', 'PERSONAL_CARE_PRODUCTS', 180],
    ['Toothpaste', 'PERSONAL_CARE_PRODUCTS', 100],
    ['Baby wipes', 'BABY_PRODUCTS', 160],
];

export function buildTransactionData(account: SeedAccount, now = new Date()) {
    let state = account.years ? 20261016 : 20261017;
    const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const integer = (min: number, max: number) =>
        min + Math.floor(random() * (max - min + 1));
    // UTC boundaries keep the fixture independent of the machine's timezone.
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    if (account.years) start.setUTCFullYear(start.getUTCFullYear() - 2);
    else start.setUTCDate(start.getUTCDate() - 6); // Seven calendar days including today.
    const userID = seedId(account, 'user');
    const tenantID = seedId(account, 'tenant');
    const shopID = seedId(account, 'shop');
    const data = {
        users: [] as Prisma.UserCreateManyInput[],
        buyers: [] as Prisma.BuyerCreateManyInput[],
        shopBuyers: [] as Prisma.ShopBuyerCreateManyInput[],
        suppliers: [] as Prisma.SupplierCreateManyInput[],
        shopSuppliers: [] as Prisma.ShopSupplierCreateManyInput[],
        inventory: [] as Prisma.InventoryCreateManyInput[],
        variants: [] as Prisma.ShopVariantCreateManyInput[],
        lots: [] as Prisma.LotCreateManyInput[],
        checkouts: [] as Prisma.CheckoutCreateManyInput[],
        items: [] as Prisma.CheckoutItemCreateManyInput[],
        debts: [] as Prisma.DebtCreateManyInput[],
        payments: [] as Prisma.DebtPaymentsCreateManyInput[],
        ledger: [] as Prisma.BuyerDebtLedgerCreateManyInput[],
        expenses: [] as Prisma.ExpenseCreateManyInput[],
        expenseItems: [] as Prisma.ExpenseItemCreateManyInput[],
        employees: [] as Prisma.EmployeeCreateManyInput[],
        attendance: [] as Prisma.AttendanceCreateManyInput[],
        pickups: [] as Prisma.PickupCreateManyInput[],
        pickupItems: [] as Prisma.PickupItemCreateManyInput[],
        losses: [] as Prisma.LotDeletionCreateManyInput[],
        notes: [] as Prisma.noteCreateManyInput[],
    };
    const stamp = (date: Date) => ({
        createdAt: new Date(date),
        updatedAt: new Date(date),
    });
    for (let i = 0; i < account.customers; i++) {
        const id = seedId(account, 'customer-user', i);
        const number = `010${account.years ? '1' : '2'}${String(i).padStart(7, '0')}`;
        const name = `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`;
        const address = `${i + 12}, ${streets[i % streets.length]}, Dhaka Division`;
        data.users.push({
            id,
            number,
            name,
            role: ['BUYER'],
            status: 'ACTIVE',
            OTP: 0,
            ...stamp(start),
        });
        data.buyers.push({
            id: seedId(account, 'buyer', i),
            userID: id,
            number,
            name,
            address,
            ...stamp(start),
        });
        data.shopBuyers.push({
            id: seedId(account, 'shop-buyer', i),
            buyerID: id,
            shopID,
            tenantID,
            number,
            name,
            address,
            ...stamp(start),
        });
    }
    for (let i = 0; i < 3; i++) {
        const id = seedId(account, 'employee-user', i);
        const number = `010${account.years ? '5' : '6'}${String(i).padStart(7, '0')}`;
        const name = ['Sabbir Ahmed', 'Rokeya Begum', 'Faisal Islam'][i];
        data.users.push({
            id,
            number,
            name,
            role: ['EMPLOYEE'],
            status: 'ACTIVE',
            OTP: 0,
            ...stamp(start),
        });
        data.employees.push({
            id: seedId(account, 'employee', i),
            userID: id,
            number,
            name,
            address: 'Gazipur, Dhaka Division',
            dob: '1996-05-10',
            tenantID,
            shopID,
            ...stamp(start),
        });
    }
    const companies = [
        'Meghna Wholesale',
        'Bashundhara Distribution',
        'City Consumer Goods',
        'Pran Regional Supply',
        'Square Toiletries',
        'Fresh Foods Trading',
        'Tongi General Supply',
        'Gazipur Essentials',
    ];
    companies.forEach((company, i) => {
        const id = seedId(account, 'supplier-user', i);
        const number = `010${account.years ? '3' : '4'}${String(i).padStart(7, '0')}`;
        const name = `${firstNames[i]} ${lastNames[i]}`;
        data.users.push({
            id,
            number,
            name,
            role: ['SUPPLIER'],
            status: 'ACTIVE',
            OTP: 0,
            ...stamp(start),
        });
        data.suppliers.push({
            id: seedId(account, 'supplier', i),
            userID: id,
            number,
            name,
            company,
            ...stamp(start),
        });
        data.shopSuppliers.push({
            id: seedId(account, 'shop-supplier', i),
            supplierId: id,
            shopId: shopID,
            tenantID,
            number,
            supplierName: name,
            company,
        });
    });

    const prices: number[] = [];
    const lotQueues: Prisma.LotCreateManyInput[][] = [];
    for (const [
        baseIndex,
        [baseName, category, basePrice],
    ] of catalog.entries()) {
        for (let size = 0; size < 3; size++) {
            const i = data.inventory.length;
            const productID = seedId(account, 'product', i);
            const name = `${baseName} — ${['Small', 'Regular', 'Family'][size]} pack`;
            data.inventory.push({
                id: productID,
                productName: name,
                barcode: `BW2-${account.key}-${String(i).padStart(4, '0')}`,
                measuringUnit: 'Piece (pc)',
                category,
                isPrivate: true,
                ...stamp(start),
            });
            data.variants.push({
                id: seedId(account, 'variant', i),
                productID,
                name,
                variantName: ['Small', 'Regular', 'Family'][size],
                variantCode: `SKU-${baseIndex}-${size}`,
                packOf: 1,
                shopID,
                tenantID,
                lowStock: 15,
                lowStockSMS: false,
                totalProducts: 0,
                ...stamp(start),
            });
            prices.push(money(basePrice * [0.5, 1, 2.5][size]));
            lotQueues.push([]);
        }
    }

    const expenseByMonth = new Map<string, Prisma.ExpenseCreateManyInput>();
    function expenseItem(
        date: Date,
        item: Omit<Prisma.ExpenseItemCreateManyInput, 'expenseID' | 'tenantID'>,
    ) {
        const month = date.getUTCMonth() + 1;
        const year = date.getUTCFullYear();
        const key = `${year}-${month}`;
        let expense = expenseByMonth.get(key);
        if (!expense) {
            expense = {
                id: seedId(account, `expense-${key}`),
                shopID,
                tenantID,
                year,
                month,
                totalAmount: 0,
                ...stamp(date),
            };
            expenseByMonth.set(key, expense);
            data.expenses.push(expense);
        }
        expense.totalAmount = money(Number(expense.totalAmount) + item.amount);
        expense.updatedAt = date;
        data.expenseItems.push({
            id: seedId(account, 'expense-item', data.expenseItems.length),
            expenseID: expense.id!,
            tenantID,
            ...item,
            ...stamp(date),
        });
    }
    function restock(i: number, date: Date, orderedQuantity?: number) {
        const quantity =
            orderedQuantity ??
            (account.years ? integer(55, 130) : integer(12, 30));
        const buyPrice = money(prices[i] * (0.73 + random() * 0.1));
        const supplier = data.shopSuppliers[i % companies.length];
        supplier.lastSuppliedAt = date;
        const lot: Prisma.LotCreateManyInput = {
            id: seedId(account, 'lot', data.lots.length),
            shopVariantId: data.variants[i].id!,
            tenantID,
            stock: quantity,
            mrp: prices[i],
            isMRPDefault: true,
            retail: prices[i],
            buyPrice,
            sellPrice: prices[i],
            includeVAT: true,
            supplyId: supplier.id,
            status: 'ACTIVE',
            locationAtStore: `Aisle ${(i % 8) + 1}`,
            note: 'Synthetic seed purchase',
            ...stamp(date),
        };
        data.lots.push(lot);
        lotQueues[i].push(lot);
        expenseItem(date, {
            name: `Stock purchase: ${data.inventory[i].productName}`,
            expenseType: 'PRODUCT',
            amount: money(quantity * buyPrice),
            quantity,
            unitPrice: buyPrice,
            lotId: lot.id,
            shopVariantId: lot.shopVariantId,
            supplierId: supplier.id,
        });
    }
    // A new shop starts with small quantities of fast movers, so its first week
    // includes genuine sell-through and repeat supplier purchases as well.
    data.variants.forEach((_, i) =>
        restock(i, start, !account.years && i < 40 ? integer(3, 9) : undefined),
    );
    const balances = new Map<string, number>();
    function ledger(
        buyer: string,
        date: Date,
        debt: Prisma.DebtCreateManyInput,
        amount: number,
        payment: boolean,
    ) {
        const previousBalance = balances.get(buyer) || 0;
        const newBalance = money(
            previousBalance + (payment ? -amount : amount),
        );
        balances.set(buyer, newBalance);
        data.ledger.push({
            id: seedId(account, 'ledger', data.ledger.length),
            shopId: shopID,
            buyerId: buyer,
            tenantID,
            type: payment ? 'PAYMENT_SINGLE' : 'DEBT_CREATED',
            amount,
            previousBalance,
            newBalance,
            debtId: debt.id,
            checkoutId: debt.checkoutID,
            description: payment ? 'Customer credit payment' : 'Credit sale',
            createdAt: date,
        });
    }
    const outstanding: {
        debt: Prisma.DebtCreateManyInput;
        checkout: Prisma.CheckoutCreateManyInput;
    }[] = [];
    const day = new Date(start);
    let dayIndex = 0;
    while (day <= now) {
        const dateAt = (fraction: number) =>
            new Date(
                day.getTime() +
                    Math.floor(
                        Math.min(86399999, now.getTime() - day.getTime()) *
                            fraction,
                    ),
            );
        const presentEmployees = data.employees.filter((employee, i) => {
            const present = (dayIndex + i) % 13 !== 12;
            data.attendance.push({
                id: seedId(account, 'attendance', data.attendance.length),
                employeeId: employee.userID,
                tenantID,
                date: new Date(day),
                month: day.getUTCMonth() + 1,
                year: day.getUTCFullYear(),
                inTime: present ? dateAt(0.25) : null,
                outTime:
                    present && day.getTime() + 86400000 <= now.getTime()
                        ? dateAt(0.9)
                        : null,
                inStatus: present
                    ? (dayIndex + i) % 7 === 0
                        ? 'LATE'
                        : 'PRESENT'
                    : 'ABSENT',
                outStatus:
                    present && day.getTime() + 86400000 <= now.getTime()
                        ? 'PRESENT'
                        : 'ABSENT',
                ...stamp(new Date(day)),
            });
            return present;
        });
        // Supplier delivery routes replenish low shelves before the day's sales.
        // Historical restocks are linked to the exact lot and expense, not just notes.
        if (dayIndex > 0 && dayIndex % 2 === 0) {
            data.variants.forEach((_, i) => {
                if (lotQueues[i].reduce((n, lot) => n + lot.stock, 0) < 12)
                    restock(i, new Date(day));
            });
        }
        if (dayIndex % 3 === 0)
            data.notes.push({
                id: seedId(account, 'note', data.notes.length),
                shopID,
                tenantID,
                name:
                    dayIndex % 2
                        ? 'Supplier follow-up'
                        : 'Customer credit follow-up',
                note:
                    dayIndex % 2
                        ? 'Confirm next delivery and check fast-moving stock.'
                        : 'Review outstanding customer balances and arrange collection.',
                dueDate: dateAt(0.95),
                isComplete: now.getTime() - day.getTime() > 86400000,
                ...stamp(new Date(day)),
            });
        // Expenses occur inside the selected history window, not at seed execution time.
        if (day.getTime() === start.getTime() || day.getUTCDate() === 1) {
            const ratio = account.years ? 1 : 7 / 30;
            for (const [name, amount, type] of [
                ['Shop rent', 18000, 'GENERAL'],
                ['Staff salaries', 28000, 'EMPLOYEE_SALARY'],
                ['Electricity and internet', 4200, 'GENERAL'],
            ] as const)
                expenseItem(new Date(day), {
                    name,
                    amount: money(amount * ratio),
                    expenseType: type,
                });
        }
        if (day.getUTCDay() === 2)
            expenseItem(new Date(day), {
                name: 'Delivery and local transport',
                amount: integer(200, 650),
                expenseType: 'GENERAL',
            });
        // Collect older credit balances in chronological order, leaving recent unpaid sales.
        for (let i = outstanding.length - 1; i >= 0; i--) {
            const entry = outstanding[i];
            const age =
                (day.getTime() - new Date(entry.debt.createdAt!).getTime()) /
                86400000;
            if (age < 3 || (age < 21 && random() > 0.18)) continue;
            const amount = money(
                entry.checkout.totalPrice - Number(entry.debt.paidAmount),
            );
            const date = new Date(day);
            data.payments.push({
                id: seedId(account, 'payment', data.payments.length),
                debtId: entry.debt.id!,
                amount,
                ...stamp(date),
            });
            ledger(entry.debt.buyerID, date, entry.debt, amount, true);
            entry.debt.paidAmount = entry.checkout.totalPrice;
            entry.debt.status = 'PAID';
            entry.debt.updatedAt = date;
            entry.checkout.status = 'PAID';
            entry.checkout.updatedAt = date;
            outstanding.splice(i, 1);
        }
        const sales = integer(12, 28) + (day.getUTCDay() === 5 ? 8 : 0);
        for (let sale = 0; sale < sales; sale++) {
            // Spread sales through the elapsed portion of each day; never create future records.
            const elapsed = Math.min(86399999, now.getTime() - day.getTime());
            const date = new Date(
                day.getTime() +
                    Math.floor(
                        elapsed * (0.3 + (0.4 * (sale + 1)) / (sales + 1)),
                    ),
            );
            const buyerIndex =
                data.checkouts.length < data.buyers.length
                    ? data.checkouts.length
                    : integer(0, data.buyers.length - 1);
            const buyerID = data.buyers[buyerIndex].userID;
            const cashier =
                sale % 3 === 0
                    ? null
                    : presentEmployees[sale % presentEmployees.length];
            const checkout: Prisma.CheckoutCreateManyInput = {
                id: seedId(account, 'checkout', data.checkouts.length),
                shopID,
                tenantID,
                buyerID,
                totalPrice: 0,
                totalQuantity: 0,
                totalDiscount: 0,
                discountType: 'AMOUNT',
                status: 'PAID',
                soldBy: cashier ? 'EMPLOYEE' : 'OWNER',
                soldByOwnerId: cashier ? null : userID,
                soldByEmployeeId: cashier?.userID,
                isDraft: false,
                ...stamp(date),
            };
            const chosen = new Set<number>();
            const itemCount = integer(1, 7);
            while (chosen.size < itemCount) {
                // A smaller fast-moving selection receives most demand.
                chosen.add(
                    random() < 0.65
                        ? integer(0, 39)
                        : integer(0, prices.length - 1),
                );
            }
            for (const i of chosen) {
                let remaining = integer(1, 4);
                const discount = random() < 0.15 ? money(prices[i] * 0.05) : 0;
                while (remaining > 0) {
                    let lot = lotQueues[i].find(l => l.stock > 0);
                    if (!lot) {
                        restock(i, date);
                        lot = lotQueues[i][lotQueues[i].length - 1];
                    }
                    const quantity = Math.min(remaining, lot.stock);
                    lot.stock -= quantity;
                    remaining -= quantity;
                    lot.updatedAt = date;
                    lot.status = lot.stock === 0 ? 'SOLD' : 'ACTIVE';
                    const lineTotal = money((prices[i] - discount) * quantity);
                    data.items.push({
                        id: seedId(account, 'item', data.items.length),
                        checkoutID: checkout.id!,
                        tenantID,
                        lotId: lot.id,
                        inventoryId: data.inventory[i].id,
                        variantId: data.variants[i].id,
                        productName: data.inventory[i].productName,
                        variantName: data.variants[i].variantName,
                        unitPrice: prices[i],
                        discountedPrice: money(prices[i] - discount),
                        itemDiscount: discount,
                        discountType: 'AMOUNT',
                        quantity,
                        ...stamp(date),
                    });
                    checkout.totalQuantity += quantity;
                    checkout.totalPrice = money(
                        checkout.totalPrice + lineTotal,
                    );
                    data.variants[i].lastSoldDate = date;
                }
            }
            const cartDiscount =
                random() < 0.12 ? money(checkout.totalPrice * 0.03) : 0;
            checkout.totalDiscount = cartDiscount;
            checkout.totalPrice = money(checkout.totalPrice - cartDiscount);
            data.checkouts.push(checkout);
            if (random() < 0.28) {
                const partial = random() < 0.55;
                const paidAmount = partial
                    ? money(checkout.totalPrice * 0.4)
                    : 0;
                checkout.status = partial ? 'PENDING' : 'UNPAID';
                const debt: Prisma.DebtCreateManyInput = {
                    id: seedId(account, 'debt', data.debts.length),
                    checkoutID: checkout.id!,
                    buyerID,
                    shopID,
                    tenantID,
                    paidAmount,
                    status: partial ? 'PARTIALLY_PAID' : 'UNPAID',
                    ...stamp(date),
                };
                data.debts.push(debt);
                ledger(buyerID, date, debt, checkout.totalPrice, false);
                if (paidAmount) {
                    data.payments.push({
                        id: seedId(account, 'payment', data.payments.length),
                        debtId: debt.id!,
                        amount: paidAmount,
                        ...stamp(date),
                    });
                    ledger(buyerID, date, debt, paidAmount, true);
                }
                outstanding.push({ debt, checkout });
            }
        }
        // Pickup orders reserve stock just like the backend pickup flow. Canceled
        // orders release reservations; completed orders are not duplicated as sales.
        const pickupDate = dateAt(0.8);
        const recent = now.getTime() - day.getTime() < 2 * 86400000;
        const pickupStatus = recent
            ? dayIndex % 2
                ? 'PROCESSING'
                : 'PENDING'
            : dayIndex % 5 === 1
              ? 'CANCELED'
              : 'COMPLETE';
        const buyer = data.buyers[dayIndex % data.buyers.length];
        const pickup: Prisma.PickupCreateManyInput = {
            id: seedId(account, 'pickup', data.pickups.length),
            shopID,
            tenantID,
            buyerID: buyer.id!,
            status: pickupStatus,
            paymentStatus: pickupStatus === 'COMPLETE' ? 'PAID' : 'UNPAID',
            totalPrice: 0,
            totalQuantity: 0,
            ...stamp(pickupDate),
        };
        for (let j = 0; j < 3; j++) {
            const i = (dayIndex * 3 + j) % prices.length;
            let lot = lotQueues[i].find(l => l.stock > 0);
            if (!lot) {
                restock(i, pickupDate);
                lot = lotQueues[i][lotQueues[i].length - 1];
            }
            const quantity = Math.min(integer(1, 3), lot.stock);
            data.pickupItems.push({
                id: seedId(account, 'pickup-item', data.pickupItems.length),
                pickupID: pickup.id!,
                tenantID,
                lotId: lot.id!,
                inventoryId: data.inventory[i].id,
                productName: data.inventory[i].productName,
                unitPrice: prices[i],
                quantity,
                ...stamp(pickupDate),
            });
            if (pickupStatus !== 'CANCELED') {
                lot.stock -= quantity;
                lot.updatedAt = pickupDate;
                lot.status = lot.stock ? 'ACTIVE' : 'SOLD';
            }
            pickup.totalPrice = money(
                Number(pickup.totalPrice) + prices[i] * quantity,
            );
            pickup.totalQuantity = Number(pickup.totalQuantity) + quantity;
        }
        data.pickups.push(pickup);
        // Periodic damaged deliveries and supplier returns with auditable stock losses.
        if (dayIndex % 14 === 2 || dayIndex === 4) {
            const date = dateAt(0.85);
            const i = dayIndex % prices.length;
            restock(i, date, integer(2, 6));
            const lot = lotQueues[i][lotQueues[i].length - 1];
            const returned = dayIndex % 28 === 2;
            data.losses.push({
                id: seedId(account, 'loss', data.losses.length),
                tenantID,
                shopVariantId: lot.shopVariantId,
                lotId: lot.id!,
                stock: lot.stock,
                buyPrice: lot.buyPrice,
                reason: returned ? 'RETURNED' : 'DAMAGED',
                lossType: returned ? 'NO_LOSS' : 'FULL_LOSS',
                lossAmount: returned ? 0 : money(lot.stock * lot.buyPrice),
                note: returned
                    ? 'Rejected delivery returned to supplier for full credit.'
                    : 'Damaged packaging found during receiving inspection.',
                deletedByType: 'OWNER',
                deletedByOwnerId: userID,
                deletionDate: date,
                ...stamp(date),
            });
            lot.stock = 0;
            lot.status = 'DELETED';
            lot.updatedAt = date;
        }
        dayIndex++;
        day.setUTCDate(day.getUTCDate() + 1);
    }
    data.variants.forEach((variant, i) => {
        variant.totalProducts = lotQueues[i].reduce(
            (sum, lot) => sum + lot.stock,
            0,
        );
        variant.updatedAt = now;
    });
    return { data, start, now, userID, tenantID, shopID };
}
