import { v4 as uuidv4 } from 'uuid';
import type { Category, Subcategory } from './schema';

export interface CategoryWithSubcategories extends Category {
  subcategories?: Omit<Subcategory, 'id' | 'category_id'>[];
}

export const defaultCategories: Omit<CategoryWithSubcategories, 'id' | 'user_id' | 'created_at'>[] = [
  // Expense Categories
  {
    name: 'Groceries',
    icon: '🛒',
    color: '#10b981',
    type: 'expense',
    is_system: true,
    sort_order: 1,
    subcategories: [
      { name: 'Supermarket', icon: '🏪', sort_order: 1 },
      { name: 'Fresh Produce', icon: '🥬', sort_order: 2 },
      { name: 'Butchery', icon: '🥩', sort_order: 3 },
    ],
  },
  {
    name: 'Transport & Petrol',
    icon: '⛽',
    color: '#f59e0b',
    type: 'expense',
    is_system: true,
    sort_order: 2,
    subcategories: [
      { name: 'Petrol', icon: '⛽', sort_order: 1 },
      { name: 'Uber', icon: '🚗', sort_order: 2 },
      { name: 'Taxi', icon: '🚕', sort_order: 3 },
      { name: 'Tolls', icon: '🛣️', sort_order: 4 },
      { name: 'Parking', icon: '🅿️', sort_order: 5 },
    ],
  },
  {
    name: 'Airtime & Data',
    icon: '📱',
    color: '#3b82f6',
    type: 'expense',
    is_system: true,
    sort_order: 3,
    subcategories: [
      { name: 'Airtime', sort_order: 1 },
      { name: 'Data Bundles', sort_order: 2 },
      { name: 'Mobile Contract', sort_order: 3 },
    ],
  },
  {
    name: 'Electricity & Utilities',
    icon: '⚡',
    color: '#eab308',
    type: 'expense',
    is_system: true,
    sort_order: 4,
    subcategories: [
      { name: 'Prepaid Electricity', icon: '💡', sort_order: 1 },
      { name: 'Water', icon: '💧', sort_order: 2 },
      { name: 'Gas', icon: '🔥', sort_order: 3 },
    ],
  },
  {
    name: 'Medical Aid & Healthcare',
    icon: '🏥',
    color: '#ef4444',
    type: 'expense',
    is_system: true,
    sort_order: 5,
    subcategories: [
      { name: 'Medical Aid', sort_order: 1 },
      { name: 'Doctor', icon: '👨‍⚕️', sort_order: 2 },
      { name: 'Pharmacy', icon: '💊', sort_order: 3 },
      { name: 'Dentist', icon: '🦷', sort_order: 4 },
    ],
  },
  {
    name: 'Insurance',
    icon: '🛡️',
    color: '#8b5cf6',
    type: 'expense',
    is_system: true,
    sort_order: 6,
    subcategories: [
      { name: 'Car Insurance', icon: '🚗', sort_order: 1 },
      { name: 'Home Insurance', icon: '🏠', sort_order: 2 },
      { name: 'Life Insurance', sort_order: 3 },
    ],
  },
  {
    name: 'Rent & Bond',
    icon: '🏠',
    color: '#6366f1',
    type: 'expense',
    is_system: true,
    sort_order: 7,
    subcategories: [
      { name: 'Monthly Rent', sort_order: 1 },
      { name: 'Bond Payment', sort_order: 2 },
      { name: 'Levies', sort_order: 3 },
    ],
  },
  {
    name: 'School Fees & Education',
    icon: '🎓',
    color: '#06b6d4',
    type: 'expense',
    is_system: true,
    sort_order: 8,
    subcategories: [
      { name: 'School Fees', sort_order: 1 },
      { name: 'University', sort_order: 2 },
      { name: 'Books & Stationery', icon: '📚', sort_order: 3 },
      { name: 'Tuition', sort_order: 4 },
    ],
  },
  {
    name: 'Entertainment',
    icon: '🎬',
    color: '#ec4899',
    type: 'expense',
    is_system: true,
    sort_order: 9,
    subcategories: [
      { name: 'Movies', icon: '🎥', sort_order: 1 },
      { name: 'Streaming', icon: '📺', sort_order: 2 },
      { name: 'Music', icon: '🎵', sort_order: 3 },
      { name: 'Events', icon: '🎫', sort_order: 4 },
    ],
  },
  {
    name: 'Eating Out',
    icon: '🍽️',
    color: '#f97316',
    type: 'expense',
    is_system: true,
    sort_order: 10,
    subcategories: [
      { name: 'Restaurants', sort_order: 1 },
      { name: 'Fast Food', icon: '🍔', sort_order: 2 },
      { name: 'Coffee', icon: '☕', sort_order: 3 },
      { name: 'Takeaways', sort_order: 4 },
    ],
  },
  {
    name: 'Clothing & Fashion',
    icon: '👕',
    color: '#a855f7',
    type: 'expense',
    is_system: true,
    sort_order: 11,
    subcategories: [
      { name: 'Clothes', sort_order: 1 },
      { name: 'Shoes', icon: '👟', sort_order: 2 },
      { name: 'Accessories', sort_order: 3 },
    ],
  },
  {
    name: 'Personal Care',
    icon: '💅',
    color: '#db2777',
    type: 'expense',
    is_system: true,
    sort_order: 12,
    subcategories: [
      { name: 'Haircut', icon: '✂️', sort_order: 1 },
      { name: 'Salon', sort_order: 2 },
      { name: 'Cosmetics', icon: '💄', sort_order: 3 },
      { name: 'Toiletries', sort_order: 4 },
    ],
  },
  {
    name: 'Home & Garden',
    icon: '🏡',
    color: '#84cc16',
    type: 'expense',
    is_system: true,
    sort_order: 13,
    subcategories: [
      { name: 'Furniture', icon: '🛋️', sort_order: 1 },
      { name: 'Maintenance', icon: '🔧', sort_order: 2 },
      { name: 'Garden', icon: '🌱', sort_order: 3 },
      { name: 'Appliances', sort_order: 4 },
    ],
  },
  {
    name: 'Debt Repayment',
    icon: '💳',
    color: '#dc2626',
    type: 'expense',
    is_system: true,
    sort_order: 14,
    subcategories: [
      { name: 'Credit Card', sort_order: 1 },
      { name: 'Personal Loan', sort_order: 2 },
      { name: 'Store Card', sort_order: 3 },
      { name: 'Other Debt', sort_order: 4 },
    ],
  },
  {
    name: 'Savings & Investments',
    icon: '💰',
    color: '#059669',
    type: 'expense',
    is_system: true,
    sort_order: 15,
    subcategories: [
      { name: 'Savings Account', sort_order: 1 },
      { name: 'Investment', icon: '📈', sort_order: 2 },
      { name: 'Retirement Annuity', sort_order: 3 },
      { name: 'Emergency Fund', sort_order: 4 },
    ],
  },
  {
    name: 'Other Expenses',
    icon: '📦',
    color: '#64748b',
    type: 'expense',
    is_system: true,
    sort_order: 16,
  },

  // Income Categories
  {
    name: 'Salary',
    icon: '💼',
    color: '#10b981',
    type: 'income',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Freelance',
    icon: '💻',
    color: '#3b82f6',
    type: 'income',
    is_system: true,
    sort_order: 2,
  },
  {
    name: 'Side Hustle',
    icon: '🚀',
    color: '#f59e0b',
    type: 'income',
    is_system: true,
    sort_order: 3,
  },
  {
    name: 'Interest & Dividends',
    icon: '📊',
    color: '#8b5cf6',
    type: 'income',
    is_system: true,
    sort_order: 4,
  },
  {
    name: 'Rental Income',
    icon: '🏘️',
    color: '#06b6d4',
    type: 'income',
    is_system: true,
    sort_order: 5,
  },
  {
    name: 'Other Income',
    icon: '💵',
    color: '#64748b',
    type: 'income',
    is_system: true,
    sort_order: 6,
  },
];

export function generateDefaultCategories(userId: string): { categories: Category[]; subcategories: Subcategory[] } {
  const categories: Category[] = [];
  const subcategories: Subcategory[] = [];
  const now = new Date().toISOString();

  defaultCategories.forEach((cat) => {
    const categoryId = uuidv4();
    categories.push({
      id: categoryId,
      user_id: userId,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
      is_system: cat.is_system,
      sort_order: cat.sort_order,
      created_at: now,
    });

    if (cat.subcategories) {
      cat.subcategories.forEach((sub) => {
        subcategories.push({
          id: uuidv4(),
          category_id: categoryId,
          name: sub.name,
          icon: sub.icon,
          sort_order: sub.sort_order,
        });
      });
    }
  });

  return { categories, subcategories };
}
