'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useUserStore } from '@/stores/userStore';
import type { Budget } from '@/lib/db/schema';

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
}

function getInitialFormData(budget?: Budget) {
  return {
    name: budget?.name ?? '',
    category_id: budget?.category_id ?? '',
    amount: budget?.amount ? (budget.amount / 100).toString() : '',
    period: budget?.period ?? ('monthly' as Budget['period']),
    start_date: budget?.start_date ?? new Date().toISOString().split('T')[0],
    end_date: budget?.end_date ?? '',
    rollover_unused: budget?.rollover_unused ?? false,
    alert_threshold: budget?.alert_threshold?.toString() ?? '80',
    is_active: budget?.is_active ?? true,
  };
}

export function BudgetDialog({ open, onOpenChange, budget }: BudgetDialogProps) {
  const user = useUserStore((state) => state.user);
  const { categories } = useCategoryStore();
  const { createBudget, updateBudget } = useBudgetStore();
  const [formData, setFormData] = useState(getInitialFormData(budget));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData(budget));
  }, [budget, open]);

  const expenseCategories = categories.filter((category) => category.type === 'expense');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        user_id: user.id,
        name: formData.name.trim(),
        category_id: formData.category_id || undefined,
        amount: Math.round(parseFloat(formData.amount || '0') * 100),
        period: formData.period,
        start_date: formData.start_date,
        end_date: formData.period === 'custom' && formData.end_date ? formData.end_date : undefined,
        rollover_unused: formData.rollover_unused,
        alert_threshold: parseInt(formData.alert_threshold || '80', 10),
        is_active: formData.is_active,
      };

      if (budget) {
        await updateBudget(budget.id, payload);
      } else {
        await createBudget(payload);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save budget:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit Budget' : 'Create Budget'}</DialogTitle>
          <DialogDescription>
            Set a spending limit for a category and track it against your actual transactions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Budget Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Groceries Budget"
              required
            />
          </div>

          <div>
            <Label htmlFor="category_id">Category *</Label>
            <Select
              id="category_id"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              required
            >
              <option value="">Select category</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Budget Amount (ZAR) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <Label htmlFor="period">Period *</Label>
            <Select
              id="period"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value as Budget['period'] })}
              required
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="start_date">Start Date *</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>

          {formData.period === 'custom' && (
            <div>
              <Label htmlFor="end_date">End Date *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="alert_threshold">Alert Threshold (%)</Label>
            <Input
              id="alert_threshold"
              type="number"
              min="1"
              max="100"
              value={formData.alert_threshold}
              onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={formData.rollover_unused}
                onChange={(e) => setFormData({ ...formData, rollover_unused: e.target.checked })}
                className="h-4 w-4"
              />
              Roll over unused budget to the next period
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4"
              />
              Budget is active
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : budget ? 'Save Changes' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
