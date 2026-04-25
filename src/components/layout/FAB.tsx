'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-20 md:bottom-8 right-4 md:right-8 h-14 w-14 rounded-full shadow-lg z-40"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
