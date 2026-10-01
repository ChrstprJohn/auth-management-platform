import type { SafeUser } from '@auth/contracts';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function UserRowActions({ user }: { user: SafeUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Actions for ${user.email ?? user.id}`}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link to={`/users/${user.id}`} />}>
          <Eye />
          View account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
