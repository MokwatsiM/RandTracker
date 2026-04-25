import { create } from 'zustand';
import type { Category, Subcategory } from '@/lib/db/schema';
import {
  createCategoryRecord,
  createSubcategoryRecord,
  deleteCategoryRecord,
  deleteSubcategoryRecord,
  fetchCategories,
  initializeDefaultCategoriesForUser,
  updateCategoryRecord,
  updateSubcategoryRecord,
} from '@/lib/supabase/data';

interface CategoryStore {
  categories: Category[];
  subcategories: Subcategory[];
  isLoading: boolean;
  error: string | null;
  loadCategories: (userId: string) => Promise<void>;
  initializeDefaultCategories: (userId: string) => Promise<void>;
  createCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createSubcategory: (subcategory: Omit<Subcategory, 'id'>) => Promise<Subcategory>;
  updateSubcategory: (id: string, updates: Partial<Subcategory>) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;
  getCategoryById: (id: string) => Category | undefined;
  getSubcategoriesByCategory: (categoryId: string) => Subcategory[];
  getCategoriesByType: (type: 'income' | 'expense') => Category[];
  getRecentlyUsedCategories: (limit?: number) => Category[];
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  subcategories: [],
  isLoading: false,
  error: null,

  loadCategories: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { categories, subcategories } = await fetchCategories(userId);
      set({ categories, subcategories, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  initializeDefaultCategories: async (userId: string) => {
    try {
      const { categories, subcategories } = await initializeDefaultCategoriesForUser(userId);
      set({ categories, subcategories });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  createCategory: async (categoryData) => {
    try {
      const newCategory = await createCategoryRecord(categoryData);
      set((state) => ({ categories: [...state.categories, newCategory] }));
      return newCategory;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateCategory: async (id, updates) => {
    try {
      const updatedCategory = await updateCategoryRecord(id, updates);
      set((state) => ({
        categories: state.categories.map((category) => (category.id === id ? updatedCategory : category)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteCategory: async (id) => {
    try {
      await deleteCategoryRecord(id);
      set((state) => ({
        categories: state.categories.filter((category) => category.id !== id),
        subcategories: state.subcategories.filter((subcategory) => subcategory.category_id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  createSubcategory: async (subcategoryData) => {
    try {
      const newSubcategory = await createSubcategoryRecord(subcategoryData);
      set((state) => ({ subcategories: [...state.subcategories, newSubcategory] }));
      return newSubcategory;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateSubcategory: async (id, updates) => {
    try {
      const updatedSubcategory = await updateSubcategoryRecord(id, updates);
      set((state) => ({
        subcategories: state.subcategories.map((subcategory) =>
          subcategory.id === id ? updatedSubcategory : subcategory
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteSubcategory: async (id) => {
    try {
      await deleteSubcategoryRecord(id);
      set((state) => ({
        subcategories: state.subcategories.filter((subcategory) => subcategory.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  getCategoryById: (id) => get().categories.find((category) => category.id === id),

  getSubcategoriesByCategory: (categoryId) =>
    get().subcategories.filter((subcategory) => subcategory.category_id === categoryId),

  getCategoriesByType: (type) => get().categories.filter((category) => category.type === type),

  getRecentlyUsedCategories: (limit = 5) =>
    get()
      .categories.filter((category) => category.type === 'expense')
      .slice(0, limit),
}));
