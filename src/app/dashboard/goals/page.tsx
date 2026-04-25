'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUserStore } from '@/stores/userStore';
import { useGoalStore } from '@/stores/goalStore';
import { useAccountStore } from '@/stores/accountStore';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalDialog } from '@/components/goals/GoalDialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Plus, Target, TrendingUp, CheckCircle2 } from 'lucide-react';
import { formatZAR } from '@/lib/currency';
import type { Goal } from '@/lib/db/schema';

export default function GoalsPage() {
  const user = useUserStore(state => state.user);
  const { goals, isLoading, loadGoals, deleteGoal } = useGoalStore();
  const { accounts, loadAccounts } = useAccountStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | undefined>();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'achieved'>('all');
  const [sortBy, setSortBy] = useState<'created' | 'progress' | 'target_date'>('created');

  // Filter and sort goals
  const filteredAndSortedGoals = useMemo(() => {
    let filtered = goals;

    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter(g => !g.is_achieved);
    } else if (filterStatus === 'achieved') {
      filtered = filtered.filter(g => g.is_achieved);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'progress': {
          const progressA = a.target_amount > 0 ? (a.current_amount / a.target_amount) : 0;
          const progressB = b.target_amount > 0 ? (b.current_amount / b.target_amount) : 0;
          return progressB - progressA; // Highest progress first
        }
        case 'target_date': {
          if (!a.target_date && !b.target_date) return 0;
          if (!a.target_date) return 1;
          if (!b.target_date) return -1;
          return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
        }
        case 'created':
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });

    return sorted;
  }, [goals, filterStatus, sortBy]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const activeGoals = goals.filter(g => !g.is_achieved);
    const achievedGoals = goals.filter(g => g.is_achieved);

    const totalTargetAmount = activeGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0);
    const totalCurrentAmount = activeGoals.reduce((sum, g) => sum + (g.current_amount || 0), 0);
    const totalRemaining = Math.max(0, totalTargetAmount - totalCurrentAmount);

    return {
      totalGoals: goals.length,
      activeGoals: activeGoals.length,
      achievedGoals: achievedGoals.length,
      totalTargetAmount,
      totalCurrentAmount,
      totalRemaining,
    };
  }, [goals]);

  useEffect(() => {
    if (user) {
      loadGoals(user.id);
      loadAccounts(user.id);
    }
  }, [user, loadGoals, loadAccounts]);

  const handleAddGoal = () => {
    setSelectedGoal(undefined);
    setIsDialogOpen(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsDialogOpen(true);
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (confirm(`Are you sure you want to delete the goal "${goal.name}"?`)) {
      await deleteGoal(goal.id);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedGoal(undefined);
    }
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Goals</h1>
          <p className="text-muted-foreground mt-1">
            Track your savings targets and financial milestones
          </p>
        </div>
        <Button onClick={handleAddGoal}>
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Summary Cards */}
      {goals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Total Goals</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalGoals}</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Active Goals</span>
            </div>
            <p className="text-2xl font-bold">{summary.activeGoals}</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Achieved</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summary.achievedGoals}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="text-sm">Total Saved</span>
            </div>
            <p className="text-2xl font-bold">{formatZAR(summary.totalCurrentAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              of {formatZAR(summary.totalTargetAmount)} target
            </p>
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      {goals.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="filter-status" className="text-sm font-medium mb-2 block">
              Filter by Status
            </label>
            <Select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">All Goals</option>
              <option value="active">Active Goals</option>
              <option value="achieved">Achieved Goals</option>
            </Select>
          </div>

          <div className="flex-1">
            <label htmlFor="sort-by" className="text-sm font-medium mb-2 block">
              Sort By
            </label>
            <Select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="created">Recently Created</option>
              <option value="progress">Progress (Highest First)</option>
              <option value="target_date">Target Date (Nearest First)</option>
            </Select>
          </div>
        </div>
      )}

      {/* Goals List */}
      {filteredAndSortedGoals.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {filteredAndSortedGoals.map((goal) => {
            const linkedAccount = goal.account_id
              ? accounts.find((acc) => acc.id === goal.account_id)
              : undefined;

            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                account={linkedAccount}
                onEdit={handleEditGoal}
                onDelete={handleDeleteGoal}
              />
            );
          })}
        </div>
      ) : goals.length === 0 ? (
        // Empty State - No goals at all
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No goals yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Start tracking your savings targets and financial milestones. Create your first goal to get started!
          </p>
          <Button onClick={handleAddGoal}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Goal
          </Button>
        </div>
      ) : (
        // Empty State - No goals matching filter
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            No {filterStatus === 'all' ? '' : filterStatus} goals found.
          </p>
        </div>
      )}

      {/* Goal Dialog */}
      <GoalDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        goal={selectedGoal}
      />
    </div>
  );
}
