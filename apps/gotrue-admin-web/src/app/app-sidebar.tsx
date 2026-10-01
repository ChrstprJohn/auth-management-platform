import { Link } from 'react-router-dom';
import {
  Users,
  History,
  HeartPulse,
  UserRound,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import type { useAccount } from '@/features/auth/hooks';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BrandMark } from '@/components/brand';

export const shellLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/history', label: 'Action history', icon: History },
  { to: '/status', label: 'Service status', icon: HeartPulse },
  { to: '/account', label: 'Current account', icon: UserRound },
];
export function AppSidebar({
  model: m,
}: {
  model: {
    active: string;
    account: ReturnType<typeof useAccount>;
    menuSide: 'bottom' | 'right';
  };
}) {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/users" />}
              tooltip="GoTrue Operator"
            >
              <BrandMark />
              <span className="grid min-w-0 gap-0.5 leading-tight">
                <span className="truncate font-semibold">GoTrue Operator</span>
                <span className="truncate text-xs text-muted-foreground">
                  Shared identity management
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shellLinks.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    isActive={m.active.startsWith(item.to)}
                    tooltip={item.label}
                    aria-current={
                      m.active.startsWith(item.to) ? 'page' : undefined
                    }
                    render={<Link to={item.to} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="aria-expanded:bg-sidebar-accent"
                    aria-label="Operator account menu"
                    tooltip="Operator account"
                  />
                }
              >
                <Avatar className="rounded-lg">
                  <AvatarFallback>OP</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Operator</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.account.session?.operator.email}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={m.menuSide}
                align="end"
                className="min-w-56"
              >
                <DropdownMenuItem render={<Link to="/account" />}>
                  <UserRound />
                  Current account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={m.account.pending}
                  onClick={m.account.logout}
                >
                  <LogOut />
                  {m.account.pending ? 'Signing out…' : 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail aria-label="Collapse or expand sidebar" />
    </Sidebar>
  );
}
