'use client';

import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatZAR } from '@/lib/currency';
import {
  calculateBudgetProgress,
  calculateDailyAllowance,
  getBudgetStatusColor,
  getCurrentBudgetPeriod,
} from '@/lib/calculations/budget';
import type { Budget, Category } from '@/lib/db/schema';

interface BudgetCardProps {
  budget: Budget;
  category?: Category;
  spent: number;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
}

export function BudgetCard({ budget, category, spent, onEdit, onDelete }: BudgetCardProps) {
  const period = getCurrentBudgetPeriod(budget);
  const remaining = Math.max(0, budget.amount - spent);
  const progress = calculateBudgetProgress(spent, budget.amount);
  const dailyAllowance = calculateDailyAllowance(remaining, period.daysRemaining);
  const status = getBudgetStatusColor(progress);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">{budget.name}</CardTitle>
          <CardDescription>
            {category ? `${category.icon} ${category.name}` : 'Unassigned category'}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(budget)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(budget)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="text-lg font-semibold">{formatZAR(budget.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="text-lg font-semibold">{formatZAR(spent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-semibold">{formatZAR(budget.amount - spent)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{progress}% used</span>
            <span className="text-muted-foreground capitalize">{status.status}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full ${
                status.color === 'green'
                  ? 'bg-green-500'
                  : status.color === 'yellow'
                    ? 'bg-yellow-500'
                    : status.color === 'orange'
                      ? 'bg-orange-500'
                      : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Current Period</p>
            <p>{format(period.start, 'MMM d')} - {format(period.end, 'MMM d')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Days Remaining</p>
            <p>{period.daysRemaining}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Daily Allowance</p>
            <p>{formatZAR(dailyAllowance)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
