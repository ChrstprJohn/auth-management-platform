export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-input/20 bg-card/50 py-2 px-4">
        <h1 className="text-sm font-medium truncate">Auth Dashboard</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-sidebar flex-shrink-0 border-r border-input/20 p-4 flex flex-col">
          <nav className="flex-1 flex flex-col gap-2">
            <a
              href="#"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/40 accent-color:focus-visible ring-2 ring-inset ring-accent/40"
            >
              Projects
            </a>
            <a
              href="#"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/40 accent-color:focus-visible ring-2 ring-inset ring-accent/40"
            >
              Users
            </a>
            <a
              href="#"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/40 accent-color:focus-visible ring-2 ring-inset ring-accent/40"
            >
              API
            </a>
            <a
              href="#"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/40 accent-color:focus-visible ring-2 ring-inset ring-accent/40"
            >
              Settings
            </a>
          </nav>
        </aside>
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}