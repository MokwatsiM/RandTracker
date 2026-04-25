'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface PaydayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPayday?: number;
  onSave: (paydayDate: number) => Promise<void>;
}

export function PaydayDialog({ open, onOpenChange, currentPayday, onSave }: PaydayDialogProps) {
  const [selectedDay, setSelectedDay] = useState(currentPayday?.toString() || '25');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave(parseInt(selectedDay));
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update payday:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Payday Date</DialogTitle>
          <DialogDescription>
            Set the day of the month you receive your salary
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="payday" className="text-sm font-medium mb-2 block">
              Day of Month
            </label>
            <Select
              id="payday"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day.toString()}>
                  {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
                </option>
              ))}
            </Select>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              This helps with budget planning and recurring payment scheduling.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
