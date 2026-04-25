'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useGoalStore } from '@/stores/goalStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUserStore } from '@/stores/userStore';
import type { Goal } from '@/lib/db/schema';

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal;
}

const GOAL_ICONS = ['🎯', '💰', '🏠', '🚗', '✈️', '🎓', '💍', '🏖️', '💳', '📱'];
const GOAL_COLORS = [
  '#10b981', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

const getInitialFormData = (goal?: Goal) => ({
  name: goal?.name || '',
  account_id: goal?.account_id || '',
  target_amount: goal?.target_amount ? (goal.target_amount / 100).toString() : '',
  current_amount: goal?.current_amount ? (goal.current_amount / 100).toString() : '0',
  target_date: goal?.target_date || '',
  icon: goal?.icon || '🎯',
  color: goal?.color || '#10b981',
});

export function GoalDialog({ open, onOpenChange, goal }: GoalDialogProps) {
  const user = useUserStore(state => state.user);
  const { createGoal, updateGoal } = useGoalStore();
  const { accounts } = useAccountStore();

  const [formData, setFormData] = useState(getInitialFormData(goal));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form data when goal prop changes or dialog opens/closes
  useEffect(() => {
    setFormData(getInitialFormData(goal));
  }, [goal, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const targetAmountInCents = Math.round(parseFloat(formData.target_amount || '0') * 100);
      const currentAmountInCents = Math.round(parseFloat(formData.current_amount || '0') * 100);

      const goalData = {
        user_id: user.id,
        name: formData.name,
        account_id: formData.account_id || undefined,
        target_amount: targetAmountInCents,
        current_amount: currentAmountInCents,
        target_date: formData.target_date || undefined,
        icon: formData.icon,
        color: formData.color,
        is_achieved: currentAmountInCents >= targetAmountInCents,
      };

      if (goal) {
        await updateGoal(goal.id, goalData);
      } else {
        await createGoal(goalData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter accounts to show only savings/investment accounts
  const savingsAccounts = accounts.filter(
    acc => acc.type === 'savings' || acc.type === 'investment' || acc.type === 'cheque'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
          <DialogDescription>
            {goal ? 'Update your goal details' : 'Set a savings target and track your progress'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal Name */}
          <div>
            <Label htmlFor="name">Goal Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Emergency Fund, New Car, Vacation"
              required
            />
          </div>

          {/* Linked Account */}
          {savingsAccounts.length > 0 && (
            <div>
              <Label htmlFor="account_id">Linked Account (Optional)</Label>
              <Select
                id="account_id"
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              >
                <option value="">No linked account</option>
                {savingsAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Link to track goal balance automatically
              </p>
            </div>
          )}

          {/* Target Amount and Current Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target_amount">Target Amount (R) *</Label>
              <Input
                id="target_amount"
                type="number"
                step="0.01"
                value={formData.target_amount}
                onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="current_amount">Current Amount (R)</Label>
              <Input
                id="current_amount"
                type="number"
                step="0.01"
                value={formData.current_amount}
                onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Target Date */}
          <div>
            <Label htmlFor="target_date">Target Date (Optional)</Label>
            <Input
              id="target_date"
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              When do you want to achieve this goal?
            </p>
          </div>

          {/* Icon Selection */}
          <div>
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`text-2xl p-2 rounded border-2 ${
                    formData.icon === icon ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {GOAL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
