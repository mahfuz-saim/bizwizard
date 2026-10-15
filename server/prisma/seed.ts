import {
    PrismaClient,
    UserRole,
    UserStatus,
    ShopCategory,
    User,
    Shop,
    Inventory,
    Owner,
    Admin,
    Buyer,
    Employee,
    SalesRepresentative,
    Supplier,
    Tenant,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Load seed data
const seedData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8'),
);

async function cleanup() {
    console.log('Cleaning up existing data...');

    // Delete data in reverse order of dependencies
    await prisma.pickupItem.deleteMany();
    await prisma.pickup.deleteMany();
    await prisma.checkoutItem.deleteMany();
    await prisma.checkout.deleteMany();
    await prisma.debt.deleteMany();
    await prisma.expenseItem.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.note.deleteMany();
    await prisma.lot.deleteMany();
    await prisma.shopVariant.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.shopSupplier.deleteMany();
    await prisma.shopBuyer.deleteMany();
    await prisma.shopJoinRequest.deleteMany();
    await prisma.address.deleteMany();
    await prisma.shop.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.buyer.deleteMany();
    await prisma.salesRepresentative.deleteMany();
    await prisma.owner.deleteMany();
    await prisma.admin.deleteMany();
    await prisma.forgetRequest.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.creditConversionRate.deleteMany();

    console.log('Cleanup completed');
}

async function main() {
    try {
        await cleanup();
        console.log('Starting to seed data...');

        // Create Users first
        const createdUsers: User[] = [];
        for (const userData of seedData.users) {
            const user = await prisma.user.create({
                data: {
                    id: userData.id,
                    number: userData.number,
                    password: userData.password
                        ? await bcrypt.hash(userData.password, 10)
                        : null,
                    role: [userData.role as UserRole],
                    status: userData.status as UserStatus,
                    OTP: userData.OTP,
                    email: userData.email || null,
                },
            });
            createdUsers.push(user);
        }
        console.log(`Created ${createdUsers.length} users`);

        // Create user profiles based on role
        const createdAdmins: Admin[] = [];
        const createdOwners: Owner[] = [];
        const createdTenants: Tenant[] = [];
        const createdBuyers: Buyer[] = [];
        const createdEmployees: Employee[] = [];
        const createdSalesReps: SalesRepresentative[] = [];
        const createdSuppliers: Supplier[] = [];

        // Create Admins
        for (const adminData of seedData.admins) {
            const user = createdUsers.find(u => u.id === adminData.userID);
            if (user) {
                const admin = await prisma.admin.create({
                    data: {
                        id: adminData.id,
                        userID: adminData.userID,
                        name: adminData.name,
                        image: adminData.image,
                        number: adminData.number,
                    },
                });
                createdAdmins.push(admin);
            }
        }
        console.log(`Created ${createdAdmins.length} admins`);

        // Create Owners
        for (const ownerData of seedData.owners) {
            const user = createdUsers.find(u => u.id === ownerData.userID);
            if (user) {
                const owner = await prisma.owner.create({
                    data: {
                        id: ownerData.id,
                        userID: ownerData.userID,
                        name: ownerData.name,
                        image: ownerData.image,
                        dob: ownerData.dob,
                        nid: ownerData.nid,
                        birthCertificate: ownerData.birthCertificate,
                        address: ownerData.address,
                        number: ownerData.number,
                        email: ownerData.email,
                    },
                });
                createdOwners.push(owner);
            }
        }
        console.log(`Created ${createdOwners.length} owners`);

        // Create one tenant per owner by default
        const tenantByOwnerId = new Map<string, Tenant>();
        for (const owner of createdOwners) {
            const tenant = await prisma.tenant.create({
                data: {
                    id: `tenant-${owner.id}`,
                    name: `${owner.name} Primary Tenant`,
                    code: `TEN-${owner.id}`,
                    ownerID: owner.userID,
                },
            });
            tenantByOwnerId.set(owner.id, tenant);
            createdTenants.push(tenant);
        }
        console.log(`Created ${createdTenants.length} tenants`);

        // Create Buyers
        for (const buyerData of seedData.buyers) {
            const user = createdUsers.find(u => u.id === buyerData.userID);
            if (user) {
                const buyer = await prisma.buyer.create({
                    data: {
                        id: buyerData.id,
                        userID: buyerData.userID,
                        number: buyerData.number,
                        name: buyerData.name,
                        address: buyerData.address,
                    },
                });
                createdBuyers.push(buyer);
            }
        }
        console.log(`Created ${createdBuyers.length} buyers`);

        // Create Suppliers
        for (const supplierData of seedData.suppliers) {
            const user = createdUsers.find(u => u.id === supplierData.userID);
            if (user) {
                const supplier = await prisma.supplier.create({
                    data: {
                        id: supplierData.id,
                        userID: supplierData.userID,
                        number: supplierData.number,
                        name: supplierData.name,
                        company: supplierData.company,
                        image: supplierData.image,
                    },
                });
                createdSuppliers.push(supplier);
            }
        }
        console.log(`Created ${createdSuppliers.length} suppliers`);

        // Create Sales Representatives
        for (const salesRepData of seedData.salesRepresentatives) {
            const user = createdUsers.find(u => u.id === salesRepData.userID);
            if (user) {
                const salesRep = await prisma.salesRepresentative.create({
                    data: {
                        id: salesRepData.id,
                        userID: salesRepData.userID,
                        name: salesRepData.name,
                        image: salesRepData.image,
                        number: salesRepData.number,
                    },
                });
                createdSalesReps.push(salesRep);
            }
        }
        console.log(`Created ${createdSalesReps.length} sales representatives`);

        // Create Shops
        const createdShops: Shop[] = [];
        for (const shopData of seedData.shops) {
            const owner = createdOwners.find(o => o.id === shopData.ownerId);
            const tenant = tenantByOwnerId.get(shopData.ownerId);
            if (owner && tenant) {
                const shop = await prisma.shop.create({
                    data: {
                        id: shopData.id,
                        shopName: shopData.shopName,
                        contact: shopData.contact,
                        tradeLicense: shopData.tradeLicense,
                        category: shopData.category as ShopCategory,
                        shopCode: shopData.shopCode,
                        tenantID: tenant.id,
                        ownerID: owner.userID,
                        credit: shopData.credit,
                        address: shopData.address
                            ? {
                                  create: {
                                      id: shopData.address.id,
                                      tenantID: tenant.id,
                                      street: shopData.address.street,
                                      upazila: shopData.address.upazila,
                                      district: shopData.address.district,
                                  },
                              }
                            : undefined,
                    },
                });
                createdShops.push(shop);
            }
        }
        console.log(`Created ${createdShops.length} shops`);

        // Create Employees (after shops are created)
        for (const employeeData of seedData.employees) {
            const user = createdUsers.find(u => u.id === employeeData.userID);
            const shop = createdShops.find(s => s.id === employeeData.shopID);
            if (user) {
                if (!shop) {
                    throw new Error(
                        `Missing shop for employee ${employeeData.id}. Each employee must be associated with exactly one shop and tenant.`,
                    );
                }

                const employee = await prisma.employee.create({
                    data: {
                        id: employeeData.id,
                        userID: employeeData.userID,
                        number: employeeData.number,
                        name: employeeData.name,
                        address: employeeData.address,
                        dob: employeeData.dob,
                        nid: employeeData.nid,
                        birthCertificate: employeeData.birthCertificate,
                        tenantID: shop.tenantID,
                        shopID: shop.id,
                    },
                });
                createdEmployees.push(employee);
            }
        }
        console.log(`Created ${createdEmployees.length} employees`);

        // Create Inventory Items
        const createdInventory: Inventory[] = [];
        for (const inventoryData of seedData.inventory) {
            const inventory = await prisma.inventory.create({
                data: {
                    id: inventoryData.id,
                    productName: inventoryData.productName,
                    barcode: inventoryData.barcode,
                    measuringUnit: inventoryData.measuringUnit,
                    image: inventoryData.image,
                    isPrivate: inventoryData.isPrivate || false,
                },
            });
            createdInventory.push(inventory);
        }
        console.log(`Created ${createdInventory.length} inventory items`);

        // Create Product Amounts
        const createdProductAmounts = [];
        for (const shopVariantData of seedData.shopVariants) {
            const inventory = createdInventory.find(
                i => i.id === shopVariantData.productID,
            );
            const shop = createdShops.find(
                s => s.id === shopVariantData.shopID,
            );

            if (inventory && shop) {
                const shopVariant = await prisma.shopVariant.create({
                    data: {
                        id: shopVariantData.id,
                        productID: inventory.id,
                        name: shopVariantData.name,
                        variantName: shopVariantData.variantName,
                        variantCode: shopVariantData.variantCode,
                        packOf: shopVariantData.packOf,
                        shopID: shop.id,
                        tenantID: shop.tenantID,
                        lowStock: shopVariantData.lowStock,
                        lowStockSMS: shopVariantData.lowStockSMS,
                        lastSoldDate: shopVariantData.lastSoldDate
                            ? new Date(shopVariantData.lastSoldDate)
                            : null,
                        notifyAfterNotSold: shopVariantData.notifyAfterNotSold,
                        notSoldSMS: shopVariantData.notSoldSMS,
                        totalProducts: shopVariantData.totalProducts,
                    },
                });
                createdProductAmounts.push(shopVariant);
            }
        }
        console.log(`Created ${createdProductAmounts.length} product amounts`);

        // Create Lots
        for (const lotData of seedData.lots) {
            const shopVariant = createdProductAmounts.find(
                pa => pa.id === lotData.shopVariantId,
            );
            if (shopVariant) {
                await prisma.lot.create({
                    data: {
                        id: lotData.id,
                        stock: lotData.stock,
                        mrp: lotData.mrp,
                        isMRPDefault: lotData.isMRPDefault,
                        retail: lotData.retail,
                        includeVAT: lotData.includeVAT,
                        buyPrice: lotData.buyPrice,
                        sellPrice: lotData.sellPrice,
                        vat: lotData.vat,
                        mfgDate: lotData.mfgDate
                            ? new Date(lotData.mfgDate)
                            : null,
                        expDate: lotData.expDate
                            ? new Date(lotData.expDate)
                            : null,
                        locationAtStore: lotData.locationAtStore,
                        note: lotData.note,
                        tenantID: shopVariant.tenantID,
                        shopVariantId: shopVariant.id,
                    },
                });
            }
        }
        console.log('Created lots');
        await prisma.appVersion.create({
            data: {
                version: '0.0.1',
                description: 'First Build',
                appType: 'SHOP',
                isMandatory: true,
            },
        });
        console.log('Created app version 0.0.1');

        await prisma.subscriptionPlan.create({
            data: {
                name: 'Basic',
                price: 199,
                months: 1,
                isActive: true,
                discountedPrice: 149,
            },
        });

        await prisma.creditConversionRate.create({
            data: {
                currencyCode: 'BDT',
                rate: 2,
                isActive: true,
            },
        });

        await prisma.subscriptionPlan.create({
            data: {
                id: 'SubscriptionPlan-1',
                name: 'Basic',
                months: 1,
                price: 199,
                discountedPrice: 149,
            },
        });

        await prisma.subscriptionPlan.create({
            data: {
                id: 'TRIAL-1',
                name: 'TRIAL',
                months: 1,
                price: 0,
                discountedPrice: 0,
                features: {
                    days: 15,
                    subType: 'TRIAL',
                },
            },
        });

        await prisma.employeeSubscriptionPlan.create({
            data: {
                id: 'EmployeeSubscriptionPlan-1',
                name: 'Basic',
                pricePerEmployee: 49,
                discountedPrice: 49,
            },
        });
        console.log('Created subscription plans and credit conversion rates');
        console.log('\nSeeding completed successfully!');
    } catch (error) {
        console.error('Error seeding data:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error('Error in main:', error);
    process.exit(1);
});
