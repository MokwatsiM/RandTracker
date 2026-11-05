'use client';

import { useRouter } from 'next/navigation';
import { MoreHorizontal, Star, Edit, Trash2, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { formatZAR, calculatePercentage } from '@/lib/currency';
import type { Account } from '@/lib/db/schema';

interface AccountsTableViewProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onSetPrimary: (account: Account) => void;
}

export function AccountsTableView({ accounts, onEdit, onDelete, onSetPrimary }: AccountsTableViewProps) {
  const router = useRouter();

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        <p>No accounts found</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right hidden md:table-cell">Details</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
            const isCreditCard = account.type === 'credit_card' || account.type === 'store_card';
            const isLoan = account.type === 'loan';
            const isDebt = isCreditCard || isLoan;
            const currentBalance = Math.abs(account.current_balance);

            // Calculate credit utilization for credit cards
            const creditUtilization = isCreditCard && account.credit_limit
              ? calculatePercentage(currentBalance, account.credit_limit)
              : 0;

            // Calculate loan progress
            const loanProgress = isLoan && account.loan_principal
              ? calculatePercentage(
                  account.loan_principal - currentBalance,
                  account.loan_principal
                )
              : 0;

            return (
              <TableRow
                key={account.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
              >
                {/* Icon */}
                <TableCell>
                  <div
                    className="text-xl w-8 h-8 rounded-full flex items-center justify-center text-center"
                    style={{ backgroundColor: account.color + '20' }}
                  >
                    {account.icon}
                  </div>
                </TableCell>

                {/* Name */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {account.name}
                        {account.is_primary && (
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground md:hidden capitalize">
                        {account.type.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell className="hidden md:table-cell">
                  <span className="capitalize text-sm text-muted-foreground">
                    {account.type.replace('_', ' ')}
                  </span>
                </TableCell>

                {/* Balance */}
                <TableCell className="text-right">
                  <div className={`font-semibold ${isDebt ? 'text-red-600' : ''}`}>
                    {formatZAR(isDebt ? currentBalance : account.current_balance)}
                  </div>
                  {isCreditCard && account.credit_limit && (
                    <div className="text-xs text-muted-foreground">
                      {creditUtilization}% used
                    </div>
                  )}
                  {isLoan && account.loan_principal && (
                    <div className="text-xs text-green-600">
                      {loanProgress}% paid
                    </div>
                  )}
                </TableCell>

                {/* Details */}
                <TableCell className="text-right hidden md:table-cell">
                  {isCreditCard && account.credit_limit && (
                    <div className="text-xs">
                      <div className="text-muted-foreground">
                        {formatZAR(account.credit_limit - currentBalance)} available
                      </div>
                    </div>
                  )}
                  {isLoan && account.monthly_instalment && (
                    <div className="text-xs text-muted-foreground">
                      {formatZAR(account.monthly_instalment)}/mo
                    </div>
                  )}
                  {!isDebt && (
                    <div className="text-xs text-muted-foreground">
                      {/* Empty for regular accounts */}
                    </div>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/accounts/${account.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(account)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {!account.is_primary && (
                        <DropdownMenuItem onClick={() => onSetPrimary(account)}>
                          <Star className="mr-2 h-4 w-4" />
                          Set as Primary
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(account)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
