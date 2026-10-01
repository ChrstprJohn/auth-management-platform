import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Users,
  History,
  HeartPulse,
  UserRound,
  ChevronDown,
} from 'lucide-react';
import { useSession } from './session';
import { useAccount } from '@/features/auth/hooks';
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
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const links = [
  { to: '/users', label: 'Users', icon: Users },
  { to: '/history', label: 'Action history', icon: History },
  { to: '/status', label: 'Service status', icon: HeartPulse },
  { to: '/account', label: 'Current account', icon: UserRound },
];
function useShell() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const account = useAccount();
  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);
  return {
    account,
    active: location.pathname,
    title:
      links.find((item) => location.pathname.startsWith(item.to))?.label ??
      'GoTrue Operator',
  };
}
function ShellContent() {
  const m = useShell();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar>
        <SidebarHeader>
          <Link to="/users" className="px-2 py-3 text-lg font-semibold">
            GoTrue Operator
          </Link>
          <p className="px-2 text-xs text-muted-foreground">
            Shared identity management
          </p>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={m.active.startsWith(item.to)}
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start"
                />
              }
            >
              <Avatar>
                <AvatarFallback>OP</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-left">
                {m.account.session?.operator.email}
              </span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem render={<Link to="/account" />}>
                Current account
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={m.account.pending}
                onClick={m.account.logout}
              >
                {m.account.pending ? 'Signing out…' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {m.account.error && <Failure error={m.account.error} />}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{m.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl min-w-0 p-4 md:p-8"
        >
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
