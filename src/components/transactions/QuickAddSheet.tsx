'use client';

import { useState } from 'react';
import { Delete, ArrowRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useUserStore } from '@/stores/userStore';
import { formatZAR } from '@/lib/currency';
import type { Category } from '@/lib/db/schema';

interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'amount' | 'category' | 'done';

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  const user = useUserStore(state => state.user);
  const { accounts } = useAccountStore();
  const { categories } = useCategoryStore();
  const { createTransaction } = useTransactionStore();

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get primary account or first account
  const primaryAccount = accounts.find(acc => acc.is_primary) || accounts[0];

  // Get expense categories
  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  const handleNumberClick = (num: string) => {
    if (step !== 'amount') return;

    if (amount === '0') {
      setAmount(num);
    } else {
      // Limit to reasonable amount (10 million)
      if (amount.replace('.', '').length < 10) {
        setAmount(amount + num);
      }
    }
  };

  const handleDecimalClick = () => {
    if (step !== 'amount') return;
    if (!amount.includes('.')) {
      setAmount(amount + '.');
    }
  };

  const handleBackspace = () => {
    if (step !== 'amount') return;
    if (amount.length > 1) {
      setAmount(amount.slice(0, -1));
    } else {
      setAmount('0');
    }
  };

  const handleClear = () => {
    setAmount('0');
  };

  const handleNext = () => {
    if (step === 'amount' && parseFloat(amount) > 0) {
      setStep('category');
    }
  };

  const handleCategorySelect = async (category: Category) => {
    if (!user || !primaryAccount) return;

    setSelectedCategory(category);
    setIsSubmitting(true);

    try {
      const amountInCents = Math.round(parseFloat(amount) * 100);

      await createTransaction({
        user_id: user.id,
        account_id: primaryAccount.id,
        type: 'expense',
        amount: amountInCents,
        category_id: category.id,
        title: category.name,
        date: new Date().toISOString().split('T')[0],
        is_recurring: false,
        is_subscription: false,
        is_debt_payment: false,
        is_paid: true,
        exclude_from_budget: false,
      });

      // Success - reset and close
      setStep('amount');
      setAmount('0');
      setSelectedCategory(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'category') {
      setStep('amount');
      setSelectedCategory(null);
    }
  };

  const displayAmount = amount === '0' ? 'R 0.00' : formatZAR(Math.round(parseFloat(amount || '0') * 100));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="pb-safe">
        <SheetClose onClick={() => onOpenChange(false)} />

        <SheetHeader>
          <SheetTitle>
            {step === 'amount' ? 'How much?' : 'What category?'}
          </SheetTitle>
        </SheetHeader>

        {/* Amount Display */}
        <div className="px-6 py-8">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{displayAmount}</div>
            {primaryAccount && (
              <div className="text-sm text-muted-foreground">
                from {primaryAccount.name}
              </div>
            )}
          </div>
        </div>

        {/* Amount Input - Numpad */}
        {step === 'amount' && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  className="h-16 text-2xl font-semibold bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleDecimalClick}
                className="h-16 text-2xl font-semibold bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                .
              </button>
              <button
                onClick={() => handleNumberClick('0')}
                className="h-16 text-2xl font-semibold bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="h-16 flex items-center justify-center bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                <Delete className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                variant="outline"
                onClick={handleClear}
                className="h-12"
              >
                Clear
              </Button>
              <Button
                onClick={handleNext}
                disabled={parseFloat(amount) <= 0}
                className="h-12"
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Category Selection */}
        {step === 'category' && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
              {expenseCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category)}
                  disabled={isSubmitting}
                  className="p-4 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
                  style={{ borderLeft: `4px solid ${category.color}` }}
                >
                  <span className="text-3xl">{category.icon}</span>
                  <span className="text-sm font-medium text-center">{category.name}</span>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={handleBack}
              className="w-full mt-4"
            >
              Back
            </Button>
          </div>
        )}

        {!primaryAccount && (
          <div className="px-6 pb-6">
            <div className="text-center text-muted-foreground py-8">
              <p>Please create an account first</p>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
