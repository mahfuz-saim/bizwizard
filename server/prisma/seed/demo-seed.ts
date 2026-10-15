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

// =======================
// CONFIGURATION - FILL THESE
// =======================
const SHOP_ID = '7af5edf8-81f7-4c05-aa07-2498f4954886';
const OWNER_ID = 'a9166c13-bb42-4543-93d5-89a8945b1e7f';
// =======================

// Helper to generate Bangladesh phone numbers
function generateBangladeshPhone(): string {
    const prefixes = ['017', '018', '019', '016', '015'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 9000000 + 1000000);
    return `${prefix}${suffix}`;
}

// =======================
// REALISTIC BANGLADESHI DATA
// =======================

const INVENTORY_DATA = [
    // Rice & Grains
    {
        name: 'Premium Chinigura Rice 5kg',
        barcode: 'RICE001',
        unit: 'bag',
        category: 'PANTRY_STAPLES',
        mrp: 650,
        retail: 620,
        buy: 580,
    },
    {
        name: 'Miniket Rice 5kg',
        barcode: 'RICE002',
        unit: 'bag',
        category: 'PANTRY_STAPLES',
        mrp: 580,
        retail: 560,
        buy: 530,
    },
    {
        name: 'Nazirshail Rice 5kg',
        barcode: 'RICE003',
        unit: 'bag',
        category: 'PANTRY_STAPLES',
        mrp: 520,
        retail: 500,
        buy: 470,
    },
    {
        name: 'Broken Rice 5kg',
        barcode: 'RICE004',
        unit: 'bag',
        category: 'PANTRY_STAPLES',
        mrp: 350,
        retail: 330,
        buy: 310,
    },
    {
        name: 'Flour (Atta) 5kg',
        barcode: 'FLOUR001',
        unit: 'bag',
        category: 'PANTRY_STAPLES',
        mrp: 280,
        retail: 265,
        buy: 250,
    },
    {
        name: 'Maida 5kg',
        barcode: 'FLOUR002',
        unit: 'bag',
        category: 'PANTRY_STAPLES',
        mrp: 260,
        retail: 245,
        buy: 230,
    },
    {
        name: 'Chal Doi 1kg',
        barcode: 'CHAL001',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 45,
        retail: 42,
        buy: 40,
    },
    // Lentils (Dal)
    {
        name: 'Moong Dal 1kg',
        barcode: 'DAL001',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 140,
        retail: 135,
        buy: 125,
    },
    {
        name: 'Masoor Dal 1kg',
        barcode: 'DAL002',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 130,
        retail: 125,
        buy: 115,
    },
    {
        name: 'Chola Dal 1kg',
        barcode: 'DAL003',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 125,
        retail: 120,
        buy: 110,
    },
    {
        name: 'Mug Dal 1kg',
        barcode: 'DAL004',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 160,
        retail: 155,
        buy: 145,
    },
    {
        name: 'Boot Dal 1kg',
        barcode: 'DAL005',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 135,
        retail: 130,
        buy: 120,
    },
    // Spices
    {
        name: 'Turmeric Powder 200g',
        barcode: 'SPICE001',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 85,
        retail: 80,
        buy: 75,
    },
    {
        name: 'Red Chilli Powder 200g',
        barcode: 'SPICE002',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 95,
        retail: 90,
        buy: 85,
    },
    {
        name: 'Cumin Seeds 200g',
        barcode: 'SPICE003',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 120,
        retail: 115,
        buy: 105,
    },
    {
        name: 'Coriander Powder 200g',
        barcode: 'SPICE004',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 80,
        retail: 75,
        buy: 70,
    },
    {
        name: 'Garam Masala 200g',
        barcode: 'SPICE005',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 150,
        retail: 145,
        buy: 135,
    },
    {
        name: 'Chat Masala 200g',
        barcode: 'SPICE006',
        unit: 'pack',
        category: 'PANTRY_STAPLES', // Fixed typo: was PANANT_STAPLES
        mrp: 110,
        retail: 105,
        buy: 95,
    },
    {
        name: 'Black Pepper 100g',
        barcode: 'SPICE007',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 180,
        retail: 175,
        buy: 160,
    },
    {
        name: 'Whole Cumin 200g',
        barcode: 'SPICE008',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 130,
        retail: 125,
        buy: 115,
    },
    {
        name: 'Fenugreek Seeds 200g',
        barcode: 'SPICE009',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 75,
        retail: 70,
        buy: 65,
    },
    {
        name: 'Cinnamon Sticks 50g',
        barcode: 'SPICE010',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 120,
        retail: 115,
        buy: 105,
    },
    // Edible Oil
    {
        name: 'Pran Soyabean Oil 5L',
        barcode: 'OIL001',
        unit: 'bottle',
        category: 'PANTRY_STAPLES',
        mrp: 780,
        retail: 760,
        buy: 720,
    },
    {
        name: 'Rupchanda Oil 5L',
        barcode: 'OIL002',
        unit: 'bottle',
        category: 'PANTRY_STAPLES',
        mrp: 950,
        retail: 930,
        buy: 880,
    },
    {
        name: 'Fresh Soyabean Oil 5L',
        barcode: 'OIL003',
        unit: 'bottle',
        category: 'PANTRY_STAPLES',
        mrp: 750,
        retail: 730,
        buy: 690,
    },
    {
        name: 'Mustard Oil 1L',
        barcode: 'OIL004',
        unit: 'bottle',
        category: 'PANTRY_STAPLES',
        mrp: 280,
        retail: 270,
        buy: 255,
    },
    {
        name: 'Olive Oil 500ml',
        barcode: 'OIL005',
        unit: 'bottle',
        category: 'PANTRY_STAPLES',
        mrp: 850,
        retail: 830,
        buy: 780,
    },
    // Sugar & Salt
    {
        name: 'Sugar 1kg',
        barcode: 'SUGAR001',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Loose Sugar 1kg',
        barcode: 'SUGAR002',
        unit: 'kg',
        category: 'PANTRY_STAPLES',
        mrp: 110,
        retail: 105,
        buy: 100,
    },
    {
        name: 'Salt 1kg',
        barcode: 'SALT001',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 35,
        retail: 32,
        buy: 30,
    },
    {
        name: 'Iodized Salt 1kg',
        barcode: 'SALT002',
        unit: 'pack',
        category: 'PANTRY_STAPLES',
        mrp: 45,
        retail: 42,
        buy: 38,
    },
    // Fish & Meat
    {
        name: 'Hilsha Fish (5pcs)',
        barcode: 'FISH001',
        unit: 'pack',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 2500,
        retail: 2400,
        buy: 2250,
    },
    {
        name: 'Rohu Fish 1kg',
        barcode: 'FISH002',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 350,
        retail: 340,
        buy: 320,
    },
    {
        name: 'Catla Fish 1kg',
        barcode: 'FISH003',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 320,
        retail: 310,
        buy: 290,
    },
    {
        name: 'Pangas Fish 1kg',
        barcode: 'FISH004',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 180,
        retail: 170,
        buy: 160,
    },
    {
        name: 'Dried Fish (Loitta) 500g',
        barcode: 'FISH005',
        unit: 'pack',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 450,
        retail: 430,
        buy: 400,
    },
    {
        name: 'Shrimp (Bagda) 500g',
        barcode: 'FISH006',
        unit: 'pack',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 550,
        retail: 530,
        buy: 500,
    },
    {
        name: 'Beef 1kg',
        barcode: 'MEAT001',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 650,
        retail: 630,
        buy: 590,
    },
    {
        name: 'Mutton 1kg',
        barcode: 'MEAT002',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 950,
        retail: 920,
        buy: 870,
    },
    {
        name: 'Chicken (Broiler) 1kg',
        barcode: 'MEAT003',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 180,
        retail: 170,
        buy: 160,
    },
    {
        name: 'Chicken (Layer) 1kg',
        barcode: 'MEAT004',
        unit: 'kg',
        category: 'MEAT_AND_SEAFOOD',
        mrp: 220,
        retail: 210,
        buy: 195,
    },
    // Vegetables
    {
        name: 'Potato 5kg',
        barcode: 'VEG001',
        unit: 'bag',
        category: 'FRESH_PRODUCE',
        mrp: 150,
        retail: 140,
        buy: 130,
    },
    {
        name: 'Onion 5kg',
        barcode: 'VEG002',
        unit: 'bag',
        category: 'FRESH_PRODUCE',
        mrp: 200,
        retail: 190,
        buy: 175,
    },
    {
        name: 'Garlic 500g',
        barcode: 'VEG003',
        unit: 'pack',
        category: 'FRESH_PRODUCE',
        mrp: 80,
        retail: 75,
        buy: 70,
    },
    {
        name: 'Ginger 500g',
        barcode: 'VEG004',
        unit: 'pack',
        category: 'FRESH_PRODUCE',
        mrp: 60,
        retail: 55,
        buy: 50,
    },
    {
        name: 'Tomato 1kg',
        barcode: 'VEG005',
        unit: 'kg',
        category: 'FRESH_PRODUCE',
        mrp: 80,
        retail: 75,
        buy: 70,
    },
    {
        name: 'Eggplant 1kg',
        barcode: 'VEG006',
        unit: 'kg',
        category: 'FRESH_PRODUCE',
        mrp: 60,
        retail: 55,
        buy: 50,
    },
    {
        name: 'Green Chilli 250g',
        barcode: 'VEG007',
        unit: 'pack',
        category: 'FRESH_PRODUCE',
        mrp: 40,
        retail: 38,
        buy: 35,
    },
    {
        name: 'Cabbage 1pc',
        barcode: 'VEG008',
        unit: 'piece',
        category: 'FRESH_PRODUCE',
        mrp: 35,
        retail: 32,
        buy: 28,
    },
    {
        name: 'Cauliflower 1pc',
        barcode: 'VEG009',
        unit: 'piece',
        category: 'FRESH_PRODUCE',
        mrp: 40,
        retail: 38,
        buy: 34,
    },
    {
        name: 'Carrot 1kg',
        barcode: 'VEG010',
        unit: 'kg',
        category: 'FRESH_PRODUCE',
        mrp: 90,
        retail: 85,
        buy: 78,
    },
    {
        name: 'Bitter Gourd 500g',
        barcode: 'VEG011',
        unit: 'pack',
        category: 'FRESH_PRODUCE',
        mrp: 50,
        retail: 48,
        buy: 44,
    },
    {
        name: 'Ladies Finger 500g',
        barcode: 'VEG012',
        unit: 'pack',
        category: 'FRESH_PRODUCE',
        mrp: 45,
        retail: 42,
        buy: 38,
    },
    {
        name: 'Pumpkin 1pc',
        barcode: 'VEG013',
        unit: 'piece',
        category: 'FRESH_PRODUCE',
        mrp: 80,
        retail: 75,
        buy: 68,
    },
    {
        name: 'Green Leafy Mix 250g',
        barcode: 'VEG014',
        unit: 'pack',
        category: 'FRESH_PRODUCE',
        mrp: 35,
        retail: 32,
        buy: 28,
    },
    // Dairy Products
    {
        name: 'Milk 1L',
        barcode: 'DAIRY001',
        unit: 'carton',
        category: 'DAIRY_PRODUCTS',
        mrp: 90,
        retail: 88,
        buy: 82,
    },
    {
        name: 'Powder Milk 400g',
        barcode: 'DAIRY002',
        unit: 'pack',
        category: 'DAIRY_PRODUCTS',
        mrp: 380,
        retail: 370,
        buy: 350,
    },
    {
        name: 'Cheese Slice 200g',
        barcode: 'DAIRY003',
        unit: 'pack',
        category: 'DAIRY_PRODUCTS',
        mrp: 220,
        retail: 210,
        buy: 195,
    },
    {
        name: 'Butter 250g',
        barcode: 'DAIRY004',
        unit: 'pack',
        category: 'DAIRY_PRODUCTS',
        mrp: 280,
        retail: 270,
        buy: 250,
    },
    {
        name: 'Ghee 500g',
        barcode: 'DAIRY005',
        unit: 'jar',
        category: 'DAIRY_PRODUCTS',
        mrp: 750,
        retail: 730,
        buy: 680,
    },
    {
        name: 'Yogurt 1kg',
        barcode: 'DAIRY006',
        unit: 'pack',
        category: 'DAIRY_PRODUCTS',
        mrp: 180,
        retail: 170,
        buy: 160,
    },
    {
        name: 'Condensed Milk 400g',
        barcode: 'DAIRY007',
        unit: 'tin',
        category: 'DAIRY_PRODUCTS',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Cream 250ml',
        barcode: 'DAIRY008',
        unit: 'pack',
        category: 'DAIRY_PRODUCTS',
        mrp: 150,
        retail: 145,
        buy: 135,
    },
    // Eggs
    {
        name: 'Egg (Deshi) 12pcs',
        barcode: 'EGG001',
        unit: 'tray',
        category: 'DAIRY_PRODUCTS',
        mrp: 180,
        retail: 175,
        buy: 165,
    },
    {
        name: 'Egg (Farm) 12pcs',
        barcode: 'EGG002',
        unit: 'tray',
        category: 'DAIRY_PRODUCTS',
        mrp: 140,
        retail: 135,
        buy: 125,
    },
    // Biscuits & Snacks
    {
        name: 'Parle-G 10pcs',
        barcode: 'BISCUIT001',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Lux Cozy 200g',
        barcode: 'BISCUIT002',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 80,
        retail: 75,
        buy: 70,
    },
    {
        name: 'Munch 60g',
        barcode: 'BISCUIT003',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 30,
        retail: 28,
        buy: 26,
    },
    {
        name: 'Oreo 137g',
        barcode: 'BISCUIT004',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 130,
        retail: 125,
        buy: 118,
    },
    {
        name: 'Chocolate Cake 150g',
        barcode: 'SNACK001',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Chips 100g',
        barcode: 'SNACK002',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 50,
        retail: 48,
        buy: 44,
    },
    {
        name: 'Chanachur 200g',
        barcode: 'SNACK003',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 80,
        retail: 75,
        buy: 70,
    },
    {
        name: 'Mixed Borhani 250ml',
        barcode: 'SNACK004',
        unit: 'bottle',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 50,
        retail: 48,
        buy: 44,
    },
    {
        name: 'Singara 5pcs',
        barcode: 'SNACK005',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 100,
        retail: 95,
        buy: 88,
    },
    {
        name: 'Samucha 6pcs',
        barcode: 'SNACK006',
        unit: 'pack',
        category: 'SNACKS_AND_CONFECTIONERY',
        mrp: 90,
        retail: 85,
        buy: 78,
    },
    // Beverages
    {
        name: 'Coca Cola 1.5L',
        barcode: 'BEV001',
        unit: 'bottle',
        category: 'BEVERAGES',
        mrp: 100,
        retail: 98,
        buy: 92,
    },
    {
        name: 'Pepsi 1.5L',
        barcode: 'BEV002',
        unit: 'bottle',
        category: 'BEVERAGES',
        mrp: 100,
        retail: 98,
        buy: 92,
    },
    {
        name: 'Fanta 1.5L',
        barcode: 'BEV003',
        unit: 'bottle',
        category: 'BEVERAGES',
        mrp: 100,
        retail: 98,
        buy: 92,
    },
    {
        name: 'Sprite 1.5L',
        barcode: 'BEV004',
        unit: 'bottle',
        category: 'BEVERAGES',
        mrp: 100,
        retail: 98,
        buy: 92,
    },
    {
        name: 'Red Label 750ml',
        barcode: 'BEV005',
        unit: 'bottle',
        category: 'BEVERAGES',
        mrp: 380,
        retail: 370,
        buy: 350,
    },
    {
        name: 'Tea (Bangladesh) 500g',
        barcode: 'BEV006',
        unit: 'pack',
        category: 'BEVERAGES',
        mrp: 350,
        retail: 340,
        buy: 320,
    },
    {
        name: 'Green Tea 100 bags',
        barcode: 'BEV007',
        unit: 'box',
        category: 'BEVERAGES',
        mrp: 280,
        retail: 270,
        buy: 250,
    },
    {
        name: 'Horlicks 500g',
        barcode: 'BEV008',
        unit: 'jar',
        category: 'BEVERAGES',
        mrp: 650,
        retail: 630,
        buy: 590,
    },
    {
        name: 'Bournvita 500g',
        barcode: 'BEV009',
        unit: 'jar',
        category: 'BEVERAGES',
        mrp: 580,
        retail: 560,
        buy: 520,
    },
    {
        name: 'Mineral Water 1.5L',
        barcode: 'BEV010',
        unit: 'bottle',
        category: 'BEVERAGES',
        mrp: 25,
        retail: 23,
        buy: 20,
    },
    // Personal Care
    {
        name: 'Fair & Lovely 100g',
        barcode: 'PC001',
        unit: 'tube',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 250,
        retail: 240,
        buy: 225,
    },
    {
        name: 'Dove Soap 100g',
        barcode: 'PC002',
        unit: 'bar',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Lux Soap 100g',
        barcode: 'PC003',
        unit: 'bar',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 55,
        retail: 52,
        buy: 48,
    },
    {
        name: 'Colgate 150g',
        barcode: 'PC004',
        unit: 'tube',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 180,
        retail: 175,
        buy: 165,
    },
    {
        name: 'Close Up 150g',
        barcode: 'PC005',
        unit: 'tube',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 150,
        retail: 145,
        buy: 138,
    },
    {
        name: 'Head & Shoulders 400ml',
        barcode: 'PC006',
        unit: 'bottle',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 450,
        retail: 435,
        buy: 410,
    },
    {
        name: 'Pantene 400ml',
        barcode: 'PC007',
        unit: 'bottle',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 480,
        retail: 465,
        buy: 440,
    },
    {
        name: 'Lifebuoy Handwash 200ml',
        barcode: 'PC008',
        unit: 'bottle',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Dettol Antiseptic 500ml',
        barcode: 'PC009',
        unit: 'bottle',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 280,
        retail: 270,
        buy: 255,
    },
    {
        name: 'Shower Gel 300ml',
        barcode: 'PC010',
        unit: 'bottle',
        category: 'PERSONAL_CARE_PRODUCTS',
        mrp: 350,
        retail: 340,
        buy: 320,
    },
    // Household
    {
        name: 'Dishwashing Liquid 750ml',
        barcode: 'HH001',
        unit: 'bottle',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 220,
        retail: 210,
        buy: 195,
    },
    {
        name: 'White Detergent 1kg',
        barcode: 'HH002',
        unit: 'pack',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 180,
        retail: 170,
        buy: 160,
    },
    {
        name: 'Wheel Powder 1kg',
        barcode: 'HH003',
        unit: 'pack',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 150,
        retail: 145,
        buy: 135,
    },
    {
        name: 'Floor Cleaner 1L',
        barcode: 'HH004',
        unit: 'bottle',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 180,
        retail: 170,
        buy: 160,
    },
    {
        name: 'Toilet Cleaner 500ml',
        barcode: 'HH005',
        unit: 'bottle',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 150,
        retail: 145,
        buy: 135,
    },
    {
        name: 'Mosquito Coil 10pcs',
        barcode: 'HH006',
        unit: 'pack',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
    {
        name: 'Hit Spray 400ml',
        barcode: 'HH007',
        unit: 'can',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 280,
        retail: 270,
        buy: 255,
    },
    {
        name: 'Aluminum Foil 25m',
        barcode: 'HH008',
        unit: 'roll',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 150,
        retail: 145,
        buy: 138,
    },
    {
        name: 'Plastic Bag Roll 50pcs',
        barcode: 'HH009',
        unit: 'roll',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 80,
        retail: 75,
        buy: 70,
    },
    {
        name: 'Garbage Bag 30pcs',
        barcode: 'HH010',
        unit: 'pack',
        category: 'HOUSEHOLD_SUPPLIES',
        mrp: 120,
        retail: 115,
        buy: 108,
    },
];

const BUYER_DATA = [
    { name: 'Rahim Uddin', address: 'Bashiruddin Road, Chittagong' },
    { name: 'Fatema Begum', address: 'Gulshan-2, Dhaka' },
    { name: 'Abdul Karim', address: 'Uposhotto, Sylhet' },
    { name: 'Khatun Jahan', address: 'Dhanmondi-15, Dhaka' },
    { name: 'Mohammad Ali', address: 'Kotwali, Rajshahi' },
    { name: 'Salma Khatun', address: 'Khalishpur, Khulna' },
    { name: 'Ahmed Hassan', address: 'Tikatuli, Dhaka' },
    { name: 'Nargis Akter', address: 'Kag Bazaar, Chittagong' },
    { name: 'Jahid Hasan', address: 'Mymensingh Sadar' },
    { name: 'Shampa Rani', address: 'Mirpur-10, Dhaka' },
    { name: 'Sultan Ahmed', address: 'Gulistan, Dhaka' },
    { name: 'Minara Begum', address: 'Lalmatia, Dhaka' },
];

const SUPPLIER_DATA = [
    {
        name: 'Kashem Enterprise',
        company: 'Kashem Trading Co.',
        contact: '031-654321',
    },
    {
        name: 'Rahim & Sons',
        company: 'Rahim & Sons Ltd.',
        contact: '01711-222333',
    },
    {
        name: 'Baba Supply Co.',
        company: 'Baba Wholesale',
        contact: '01815-444555',
    },
    {
        name: 'Chittagong Mart',
        company: 'Chittagong Mart Ltd.',
        contact: '031-765432',
    },
    {
        name: 'Dhaka Distributors',
        company: 'Dhaka Distributors',
        contact: '02-8888888',
    },
];

async function main() {
    console.log('🚀 Starting seed data generation...\n');

    // Verify shop exists
    const shop = await prisma.shop.findUnique({
        where: { id: SHOP_ID },
        include: { tenant: true },
    });

    if (!shop) {
        console.error('❌ Shop not found! Please check SHOP_ID');
        process.exit(1);
    }

    console.log(
        `✅ Found shop: ${shop.shopName} (Tenant: ${shop.tenant.name})`,
    );
    console.log(`📍 Shop ID: ${SHOP_ID}`);
    console.log(`👤 Owner ID: ${OWNER_ID}\n`);

    const tenantID = shop.tenantID;

    // =======================
    // STEP 1: Create Suppliers + ShopSupplier links
    // =======================
    console.log('📦 Creating Suppliers & ShopSupplier links...');
    const shopSuppliers: any[] = [];

    for (const sup of SUPPLIER_DATA) {
        const user = await prisma.user.create({
            data: {
                number: generateBangladeshPhone(),
                role: [UserRole.SUPPLIER],
                status: UserStatus.ACTIVE,
                OTP: 0,
            },
        });

        const supplier = await prisma.supplier.create({
            data: {
                userID: user.id,
                number: sup.contact,
                name: sup.name,
                company: sup.company,
            },
        });

        // Link supplier to this shop via ShopSupplier
        const shopSupplier = await prisma.shopSupplier.create({
            data: {
                supplierId: supplier.userID,
                shopId: SHOP_ID,
                tenantID: tenantID,
                number: supplier.number,
                company: supplier.company,
                supplierName: supplier.name,
            },
        });

        shopSuppliers.push(shopSupplier);
        console.log(
            `✓ Created supplier: ${supplier.name} → ShopSupplier: ${shopSupplier.id}`,
        );
    }
    console.log(`✅ Created ${shopSuppliers.length} shop-supplier links\n`);

    // =======================
    // STEP 2: Create Inventory
    // =======================
    console.log('📦 Creating Inventory...');
    const inventoryItems: any[] = [];

    for (const item of INVENTORY_DATA) {
        const inv = await prisma.inventory.create({
            data: {
                productName: item.name,
                barcode: item.barcode,
                measuringUnit: item.unit,
                category: item.category as any,
            },
        });
        // Attach pricing data to inventory item for later use
        inventoryItems.push({ ...inv, retail: item.retail });
    }
    console.log(`✅ Created ${inventoryItems.length} inventory items\n`);

    // =======================
    // STEP 3: Create ShopVariants + Lots
    // =======================
    console.log('📦 Creating ShopVariants with Lots...');
    const shopVariants: any[] = [];

    for (const item of inventoryItems) {
        const variant = await prisma.shopVariant.create({
            data: {
                productID: item.id,
                name: item.name,
                variantCode: item.barcode,
                shopID: SHOP_ID,
                tenantID: tenantID,
                totalProducts: 0,
                lowStock: 10,
                lowStockSMS: true,
                notifyAfterNotSold: 7,
                notifyBeforeExp: 7,
                notSoldSMS: true,
            },
        });

        // Create 1-3 lots per product with varied stock
        const numLots = Math.floor(Math.random() * 3) + 1;
        let totalStock = 0;

        for (let i = 0; i < numLots; i++) {
            // 70% chance of having a supplier for realistic mix
            const useSupplier = Math.random() < 0.7;
            const supplierIndex = Math.floor(
                Math.random() * shopSuppliers.length,
            );
            const stock = Math.floor(Math.random() * 150) + 20; // 20-170 stock
            const hasExpiry = Math.random() < 0.6; // 60% have expiry

            const mfgDate = new Date();
            mfgDate.setDate(mfgDate.getDate() - Math.floor(Math.random() * 30));

            const expDate = new Date();
            expDate.setDate(
                expDate.getDate() + Math.floor(Math.random() * 180) + 30,
            );

            const lot = await prisma.lot.create({
                data: {
                    stock: stock,
                    mrp: item.mrp || 100,
                    isMRPDefault: true,
                    retail: item.retail || 90,
                    buyPrice: item.buy || 80,
                    sellPrice: item.retail || 90,
                    includeVAT: false,
                    vat: 0,
                    mfgDate: mfgDate,
                    expDate: hasExpiry ? expDate : null,
                    shopVariantId: variant.id,
                    tenantID: tenantID,
                    supplyId: useSupplier
                        ? shopSuppliers[supplierIndex].id
                        : null,
                    status: LotStatus.ACTIVE,
                },
            });

            totalStock += stock;
        }

        // Update total products
        await prisma.shopVariant.update({
            where: { id: variant.id },
            data: { totalProducts: totalStock },
        });

        // Store retailPrice for checkout calculations
        shopVariants.push({
            ...variant,
            totalProducts: totalStock,
            retailPrice: item.retail,
        });
    }
    console.log(`✅ Created ${shopVariants.length} shop variants with lots\n`);

    // =======================
    // STEP 4: Create Buyers + ShopBuyers
    // =======================
    console.log('👥 Creating Buyers...');
    const buyers: any[] = [];

    for (const buyerData of BUYER_DATA) {
        const user = await prisma.user.create({
            data: {
                number: generateBangladeshPhone(),
                role: [UserRole.BUYER],
                status: UserStatus.ACTIVE,
                OTP: 0,
            },
        });

        const buyer = await prisma.buyer.create({
            data: {
                number: user.number,
                name: buyerData.name,
                address: buyerData.address,
                userID: user.id,
            },
        });

        // Create ShopBuyer (link to shop)
        const shopBuyer = await prisma.shopBuyer.create({
            data: {
                shopID: SHOP_ID,
                tenantID: tenantID,
                buyerID: user.id,
                name: buyerData.name,
                number: buyer.number,
                address: buyerData.address,
            },
        });

        buyers.push({ ...buyer, userID: user.id });
        console.log(
            `✓ Created buyer: ${buyerData.name} (ShopBuyer ID: ${shopBuyer.id})`,
        );
    }
    console.log(`✅ Created ${buyers.length} buyers\n`);

    // =======================
    // STEP 5: Create Checkouts (Sales History)
    // =======================
    console.log('🛒 Creating Checkouts (30 days of sales)...');
    const checkouts: any[] = [];

    for (let i = 0; i < 25; i++) {
        const buyerIndex = Math.floor(Math.random() * buyers.length);
        const buyer = buyers[buyerIndex];

        // Random date within last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const saleDate = new Date();
        saleDate.setDate(saleDate.getDate() - daysAgo);
        saleDate.setHours(Math.floor(Math.random() * 12) + 8);
        saleDate.setMinutes(Math.floor(Math.random() * 60));

        // 70% PAID, 20% UNPAID, 10% PENDING
        const rand = Math.random();
        let status: PaymentStatus;
        if (rand < 0.7) status = PaymentStatus.PAID;
        else if (rand < 0.9) status = PaymentStatus.UNPAID;
        else status = PaymentStatus.PENDING;

        // Random items for this checkout (2-6 items)
        const numItems = Math.floor(Math.random() * 5) + 2;
        const selectedVariants = shopVariants
            .sort(() => Math.random() - 0.5)
            .slice(0, numItems);

        let totalPrice = 0;
        let totalQuantity = 0;

        const checkout = await prisma.checkout.create({
            data: {
                shopID: SHOP_ID,
                tenantID: tenantID,
                buyerID: buyer.userID,
                status: status,
                totalPrice: 0,
                totalQuantity: 0,
                totalDiscount:
                    Math.random() < 0.3
                        ? Math.floor(Math.random() * 50) + 10
                        : 0,
                discountType: DiscountType.PERCENTAGE,
                soldByOwnerId: OWNER_ID,
                isDraft: false,
                createdAt: saleDate,
                updatedAt: saleDate,
            },
        });

        const checkoutItems: any[] = [];

        for (const variant of selectedVariants) {
            const quantity = Math.floor(Math.random() * 4) + 1;
            // Use the retail price we stored in Step 3
            const unitPrice =
                variant.totalProducts > 0 ? variant.retailPrice : 100;
            const itemDiscount =
                Math.random() < 0.3 ? Math.floor(Math.random() * 10) : 0;

            const item = await prisma.checkoutItem.create({
                data: {
                    checkoutID: checkout.id,
                    tenantID: tenantID,
                    lotId: null,
                    productName: variant.name || 'Unknown Product',
                    variantId: variant.id,
                    variantName: variant.name,
                    unitPrice: unitPrice,
                    discountedPrice: unitPrice - itemDiscount,
                    itemDiscount: itemDiscount,
                    discountType: DiscountType.PERCENTAGE,
                    quantity: quantity,
                    inventoryId: variant.productID,
                    createdAt: saleDate,
                    updatedAt: saleDate,
                },
            });

            checkoutItems.push(item);
            totalPrice += (unitPrice - itemDiscount) * quantity;
            totalQuantity += quantity;
        }

        // Update checkout totals AND push the updated object (Fix: was pushing checkout with 0 totals)
        const updatedCheckout = await prisma.checkout.update({
            where: { id: checkout.id },
            data: {
                totalPrice: totalPrice,
                totalQuantity: totalQuantity,
            },
        });

        checkouts.push(updatedCheckout);
        console.log(
            `✓ Checkout #${i + 1} - ৳${totalPrice.toFixed(0)} - ${status} - ${saleDate.toLocaleDateString()}`,
        );
    }
    console.log(`✅ Created ${checkouts.length} checkouts\n`);

    // =======================
    // STEP 6: Create Debts + DebtPayments
    // =======================
    console.log('💳 Creating Debts...');

    // Find UNPAID and PENDING checkouts
    const unpaidCheckouts = checkouts.filter(
        c =>
            c.status === PaymentStatus.UNPAID ||
            c.status === PaymentStatus.PENDING,
    );

    let debtsCreated = 0;

    for (const checkout of unpaidCheckouts) {
        // If PENDING, simulate a partial payment
        const paidAmount =
            checkout.status === PaymentStatus.PENDING
                ? Math.floor(Math.random() * (checkout.totalPrice * 0.6)) +
                  checkout.totalPrice * 0.1
                : 0;

        const debt = await prisma.debt.create({
            data: {
                checkoutID: checkout.id,
                buyerID: checkout.buyerID,
                shopID: SHOP_ID,
                tenantID: tenantID,
                paidAmount: paidAmount,
                status:
                    checkout.status === PaymentStatus.PENDING
                        ? DebtStatus.PARTIALLY_PAID
                        : DebtStatus.UNPAID,
            },
        });

        // Create payments for pending debts
        if (checkout.status === PaymentStatus.PENDING && paidAmount > 0) {
            const paymentDate = new Date(checkout.createdAt);
            paymentDate.setDate(
                paymentDate.getDate() + Math.floor(Math.random() * 3) + 1,
            );

            await prisma.debtPayments.create({
                data: {
                    amount: paidAmount,
                    debtId: debt.id,
                    createdAt: paymentDate,
                    updatedAt: paymentDate,
                },
            });

            await prisma.buyerDebtLedger.create({
                data: {
                    shopId: SHOP_ID,
                    buyerId: checkout.buyerID,
                    tenantID: tenantID,
                    type: 'PAYMENT_SINGLE',
                    amount: paidAmount,
                    previousBalance: checkout.totalPrice,
                    newBalance: checkout.totalPrice - paidAmount,
                    debtId: debt.id,
                    checkoutId: checkout.id,
                    description: `Payment for checkout #${checkout.id.slice(0, 8)}`,
                },
            });
        }

        // Create ledger entry for debt
        await prisma.buyerDebtLedger.create({
            data: {
                shopId: SHOP_ID,
                buyerId: checkout.buyerID,
                tenantID: tenantID,
                type: 'DEBT_CREATED',
                amount: checkout.totalPrice,
                previousBalance: 0,
                newBalance: checkout.totalPrice - paidAmount,
                debtId: debt.id,
                checkoutId: checkout.id,
                description: `Credit sale - Checkout #${checkout.id.slice(0, 8)}`,
            },
        });

        debtsCreated++;
        console.log(
            `✓ Debt created: ৳${checkout.totalPrice.toFixed(2)} (Paid: ৳${paidAmount.toFixed(2)})`,
        );
    }
    console.log(`✅ Created ${debtsCreated} debts\n`);

    // =======================
    // STEP 7: Create Expenses
    // =======================
    console.log('💰 Creating Expenses...');

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Create expenses for current and previous month
    const months = [
        {
            month: currentMonth === 1 ? 12 : currentMonth - 1,
            year: currentMonth === 1 ? currentYear - 1 : currentYear,
        },
        { month: currentMonth, year: currentYear },
    ];

    for (const { month, year } of months) {
        // 1. Create ONE expense record per month (Unique constraint: shopID+year+month)
        const salaryAmount = 45000;
        const generalAmount = 8500;
        const totalMonthExpense = salaryAmount + generalAmount;

        const expense = await prisma.expense.create({
            data: {
                shopID: SHOP_ID,
                tenantID: tenantID,
                totalAmount: totalMonthExpense,
                month: month,
                year: year,
            },
        });

        // 2. Create items for this single expense record

        // Salary Item
        await prisma.expenseItem.create({
            data: {
                expenseID: expense.id,
                tenantID: tenantID,
                amount: salaryAmount,
                name: 'Staff Salary',
                expenseType: ExpenseType.EMPLOYEE_SALARY,
            },
        });

        // General Items
        const generalItems = [
            { name: 'Electric Bill', amount: 3500 },
            { name: 'Internet', amount: 2000 },
            { name: 'Transport', amount: 3000 },
        ];

        for (const item of generalItems) {
            await prisma.expenseItem.create({
                data: {
                    expenseID: expense.id,
                    tenantID: tenantID,
                    amount: item.amount,
                    name: item.name,
                    expenseType: ExpenseType.GENERAL,
                },
            });
        }

        console.log(
            `✓ Expenses for ${year}-${month.toString().padStart(2, '0')}: ৳${totalMonthExpense.toLocaleString()}`,
        );
    }
    console.log('✅ Created expenses for 2 months\n');

    // =======================
    // SUMMARY
    // =======================
    console.log('='.repeat(50));
    console.log('✅ SEED DATA COMPLETE!');
    console.log('='.repeat(50));
    console.log(`
📊 Summary:
   • Suppliers: ${shopSuppliers.length}
   • Inventory: ${inventoryItems.length}
   • ShopVariants: ${shopVariants.length}
   • Buyers: ${buyers.length}
   • Checkouts: ${checkouts.length}
   • Debts: ${debtsCreated}
   • Expense Months: 2
  `);
    console.log('='.repeat(50));
}

main()
    .catch(e => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
