import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { ListChecks } from 'lucide-react';

export function Header() {
  return (
    <header className="flex items-center justify-between py-4 border-b">
      <Link href="/" className="flex items-center gap-2">
        <ListChecks className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Taskdown</h1>
      </Link>
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
