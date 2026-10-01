import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Users,
  History,
  HeartPulse,
  UserRound,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { useSession } from './session';
import { useAccount } from '@/features/auth/hooks';
import { ActionOutcome } from '@/features/users/actions';
import { Failure, Blank, Loading } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
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
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BrandMark } from '@/components/brand';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/history', label: 'Action history', icon: History },
  { to: '/status', label: 'Service status', icon: HeartPulse },
  { to: '/account', label: 'Current account', icon: UserRound },
];
function useShell() {
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const account = useAccount();
  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);
  return {
    account,
    active: location.pathname,
    menuSide: isMobile ? ('bottom' as const) : ('right' as const),
    userParent: location.pathname.startsWith('/users/'),
    title:
      location.pathname === '/users/new'
        ? 'Create user'
        : location.pathname.startsWith('/users/')
          ? 'Account details'
          : (links.find((item) => location.pathname.startsWith(item.to))
              ?.label ?? 'GoTrue Operator'),
  };
}
function ShellContent() {
  const m = useShell();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
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
                  <span className="truncate font-semibold">
                    GoTrue Operator
                  </span>
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
                {links.map((item) => (
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
          {m.account.error && <Failure error={m.account.error} />}
        </SidebarFooter>
        <SidebarRail aria-label="Collapse or expand sidebar" />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 md:px-6">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              {m.userParent && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link to="/users" />}>
                      Users
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{m.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[90rem] min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8 xl:px-8"
        >
          <ActionOutcome />
          <Outlet />
        </main>
      </SidebarInset>
    </>
  );
}
export function ProtectedShell() {
  const session = useSession();
  const location = useLocation();
  if (session.state === 'loading')
    return (
      <main className="public-form">
        <Loading label="Checking operator session" />
      </main>
    );
  if (session.state === 'expired')
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
      />
    );
  if (session.state === 'denied')
    return (
      <main className="public-form">
        <Blank
          title="Access denied"
          description="Operator access is unavailable. A trusted administrator can check eligibility."
          href="/login"
          action="Return to sign in"
        />
      </main>
    );
  if (session.state === 'unavailable')
    return (
      <main className="public-form">
        <h1>Session check unavailable</h1>
        <p>
          Protected data remains blocked until the API can verify your session.
        </p>
        <Failure error={session.error} retry={session.retry} />
        <Button
          nativeButton={false}
          render={<Link to="/forgot-password" />}
          variant="outline"
        >
          Password recovery
        </Button>
      </main>
    );
  return (
    <SidebarProvider>
      <ShellContent />
    </SidebarProvider>
  );
}
