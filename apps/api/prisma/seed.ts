import { prisma } from '../src/lib/prisma.js';

const menu = [
  {
    category: 'Rice & Curry',
    description: 'Lunch favourites',
    items: [
      { name: 'Chicken Rice & Curry', price: '850.00', description: 'Rice with chicken curry, dhal and two vegetables' },
      { name: 'Vegetable Rice & Curry', price: '600.00', description: 'Rice with dhal and three vegetable curries' },
    ],
  },
  {
    category: 'Kottu',
    description: 'Chopped roti specials',
    items: [
      { name: 'Chicken Kottu', price: '1200.00', description: 'Chopped roti with chicken and vegetables' },
      { name: 'Cheese Kottu', price: '1400.00', description: 'Chicken kottu with melted cheese' },
    ],
  },
  {
    category: 'Short Eats',
    description: 'Quick bites',
    items: [
      { name: 'Fish Roll', price: '150.00', description: 'Crumbed roll with spiced fish filling' },
      { name: 'Vegetable Samosa', price: '120.00', description: 'Crispy pastry with spiced vegetables' },
    ],
  },
  {
    category: 'Drinks',
    description: 'Cold and fresh',
    items: [
      { name: 'Iced Milo', price: '450.00', description: 'Chilled Milo with milk' },
      { name: 'Fresh Lime Juice', price: '350.00', description: 'Freshly squeezed lime with soda' },
    ],
  },
];

async function main() {
  for (const group of menu) {
    const nameNormalized = group.category.trim().toLowerCase();

    const category = await prisma.category.upsert({
      where: { nameNormalized },
      update: {},
      create: { name: group.category, nameNormalized, description: group.description },
    });

    for (const item of group.items) {
      const existing = await prisma.menuItem.findFirst({
        where: { categoryId: category.id, name: item.name },
      });
      if (!existing) {
        await prisma.menuItem.create({ data: { ...item, categoryId: category.id } });
      }
    }
  }
  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());