'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plus } from 'lucide-react';
import { formatZAR } from '@/lib/currency';
import type { Goal } from '@/lib/db/schema';
import type { Account } from '@/lib/db/schema';

interface GoalCardProps {
  goal: Goal;
  account?: Account;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onAddContribution?: (goal: Goal) => void;
}

export function GoalCard({ goal, account, onEdit, onDelete, onAddContribution }: GoalCardProps) {
  const currentAmount = goal.current_amount || 0;
  const targetAmount = goal.target_amount || 0;
  const progress = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;
  const remainingAmount = Math.max(0, targetAmount - currentAmount);

  // Calculate days remaining if target date exists
  const daysRemaining = goal.target_date
    ? Math.ceil((new Date(goal.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isAchieved = goal.is_achieved || progress >= 100;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="pb-4"
        style={{
          borderLeft: `4px solid ${goal.color || '#10b981'}`,
          backgroundColor: isAchieved ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-3xl">{goal.icon || '🎯'}</div>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {goal.name}
                {isAchieved && (
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Achieved
                  </span>
                )}
              </CardTitle>
              {account && (
                <p className="text-sm text-muted-foreground mt-1">
                  Linked to: {account.icon} {account.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isAchieved && onAddContribution && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddContribution(goal)}
                title="Add contribution"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(goal)}
              title="Edit goal"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(goal)}
              title="Delete goal"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Amount</p>
            <p className="text-lg font-semibold">{formatZAR(currentAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Target Amount</p>
            <p className="text-lg font-semibold">{formatZAR(targetAmount)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: isAchieved ? '#10b981' : goal.color || '#10b981',
              }}
            />
          </div>
        </div>

        {/* Remaining Amount */}
        {!isAchieved && remainingAmount > 0 && (
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-semibold text-foreground">{formatZAR(remainingAmount)}</span>
            </div>
          </div>
        )}

        {/* Target Date Information */}
        {goal.target_date && (
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target Date</span>
              <span className={`font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                {new Date(goal.target_date).toLocaleDateString('en-ZA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
            {daysRemaining !== null && !isAchieved && (
              <div className="mt-1 text-sm">
                {isOverdue ? (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    Overdue by {Math.abs(daysRemaining)} days
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {daysRemaining} days remaining
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Achievement Message */}
        {isAchieved && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span className="text-2xl">🎉</span>
              <span className="text-sm font-medium">
                Congratulations! You've achieved your goal!
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
