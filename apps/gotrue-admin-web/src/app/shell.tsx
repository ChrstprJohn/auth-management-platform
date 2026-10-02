import { useEffect } from 'react';
import { AppSidebar, shellLinks } from './app-sidebar';
import { RouteState } from '@/components/route-state';
import { LogOut, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './session';
import { useAccount } from '@/features/auth/hooks';
import { ActionOutcome } from '@/features/users/actions';
import { Failure, Blank, Loading } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
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
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

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
      location.pathname === '/users/invite'
        ? 'Invite user'
        : location.pathname.startsWith('/users/')
          ? 'Account details'
          : (shellLinks.find((item) => location.pathname.startsWith(item.to))
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
      <AppSidebar model={m} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:rounded-t-xl md:px-8">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb className="min-w-0 flex-1">
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
                <BreadcrumbPage className="truncate">{m.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
              aria-label="Header account menu"
            >
              <Avatar className="size-7">
                <AvatarFallback>
                  <UserRound className="size-4" />
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 max-w-[calc(100vw-2rem)]"
            >
              <div className="min-w-0 px-2 py-2 text-sm">
                <p className="font-medium">Operator</p>
                <p className="break-all text-xs text-muted-foreground">
                  {m.account.session?.operator.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link to="/account" />}>
                <UserRound />
                Current account
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={m.account.pending}
                onClick={m.account.logout}
              >
                <LogOut />
                {m.account.pending ? 'Signing out…' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[90rem] min-w-0 flex-1 space-y-4 p-4 pt-6 md:p-8 md:pt-6"
        >
          {m.account.error && <Failure error={m.account.error} />}
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
      <RouteState>
        <Loading label="Checking operator session" />
      </RouteState>
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
      <RouteState>
        <Blank
          title="Access denied"
          description="Operator access is unavailable. A trusted administrator can check eligibility."
          href="/login"
          action="Return to sign in"
        />
      </RouteState>
    );
  if (session.state === 'unavailable')
    return (
      <RouteState>
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
      </RouteState>
    );
  return (
    <SidebarProvider>
      <ShellContent />
    </SidebarProvider>
  );
}
