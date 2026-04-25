'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Theme = 'light' | 'dark' | 'system';

export function ThemeDialog({ open, onOpenChange }: ThemeDialogProps) {
  const [selectedTheme, setSelectedTheme] = useState<Theme>('system');

  useEffect(() => {
    // Load current theme from localStorage
    const stored = localStorage.getItem('theme') as Theme;
    if (stored) {
      setSelectedTheme(stored);
    }
  }, [open]);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }

    localStorage.setItem('theme', theme);
  };

  const handleSave = () => {
    applyTheme(selectedTheme);
    onOpenChange(false);
  };

  const themes: { value: Theme; label: string; icon: React.ReactNode; description: string }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: <Sun className="h-5 w-5" />,
      description: 'Always use light theme',
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Moon className="h-5 w-5" />,
      description: 'Always use dark theme',
    },
    {
      value: 'system',
      label: 'System',
      icon: <Monitor className="h-5 w-5" />,
      description: 'Follow system preference',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Theme</DialogTitle>
          <DialogDescription>
            Choose your preferred color theme
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {themes.map((theme) => (
            <button
              key={theme.value}
              onClick={() => setSelectedTheme(theme.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                selectedTheme === theme.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className={selectedTheme === theme.value ? 'text-primary' : 'text-muted-foreground'}>
                {theme.icon}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{theme.label}</p>
                <p className="text-sm text-muted-foreground">{theme.description}</p>
              </div>
              {selectedTheme === theme.value && (
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Theme
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
