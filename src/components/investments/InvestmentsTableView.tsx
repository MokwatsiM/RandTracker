'use client';

import { MoreHorizontal, Edit, Trash2, Eye, TrendingUp, TrendingDown } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { formatZAR } from '@/lib/currency';
import type { Investment } from '@/stores/investmentStore';

interface InvestmentsTableViewProps {
  investments: Investment[];
  onEdit: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
  onClick: (investment: Investment) => void;
}

export function InvestmentsTableView({ investments, onEdit, onDelete, onClick }: InvestmentsTableViewProps) {
  if (investments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        <p>No investments found</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Investment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Current Value</TableHead>
            <TableHead className="text-right hidden md:table-cell">Gain/Loss</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Return %</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {investments.map((investment) => {
            const gainLoss = investment.current_value - investment.total_contributions;
            const gainLossPercentage = investment.total_contributions > 0
              ? (gainLoss / investment.total_contributions) * 100
              : 0;
            const isPositive = gainLoss >= 0;

            return (
              <TableRow
                key={investment.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => onClick(investment)}
              >
                {/* Icon */}
                <TableCell>
                  <div
                    className="text-xl w-8 h-8 rounded-full flex items-center justify-center text-center"
                    style={{ backgroundColor: investment.color + '20' }}
                  >
                    {investment.icon}
                  </div>
                </TableCell>

                {/* Name */}
                <TableCell>
                  <div>
                    <div className="font-medium">{investment.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {investment.provider && (
                        <span>{investment.provider}</span>
                      )}
                      <div className="flex gap-1 md:hidden">
                        {investment.is_tfsa && (
                          <Badge variant="secondary" className="text-xs">TFSA</Badge>
                        )}
                        {investment.is_fixed_deposit && (
                          <Badge variant="outline" className="text-xs">Fixed</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-sm text-muted-foreground">
                      {investment.type.replace('_', ' ')}
                    </span>
                    <div className="flex gap-1">
                      {investment.is_tfsa && (
                        <Badge variant="secondary" className="text-xs">TFSA</Badge>
                      )}
                      {investment.is_fixed_deposit && (
                        <Badge variant="outline" className="text-xs">Fixed</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Current Value */}
                <TableCell className="text-right">
                  <div className="font-semibold">
                    {formatZAR(investment.current_value)}
                  </div>
                  <div className="text-xs text-muted-foreground md:hidden">
                    {isPositive ? (
                      <span className="text-green-600">
                        +{formatZAR(gainLoss)} ({gainLossPercentage.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-red-600">
                        {formatZAR(gainLoss)} ({gainLossPercentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Gain/Loss */}
                <TableCell className="text-right hidden md:table-cell">
                  <div className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{formatZAR(gainLoss)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Contributed: {formatZAR(investment.total_contributions)}
                  </div>
                </TableCell>

                {/* Return % */}
                <TableCell className="text-right hidden lg:table-cell">
                  <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="font-medium">
                      {isPositive ? '+' : ''}{gainLossPercentage.toFixed(2)}%
                    </span>
                  </div>
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
                      <DropdownMenuItem onClick={() => onClick(investment)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Transactions
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(investment)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(investment)}
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
