The UX we're building
Think Supabase dashboard, but much simpler and focused specifically on your Auth server.
1. Login
┌──────────────────────────────────┐
│          Auth Dashboard          │
│                                  │
│        Email                     │
│        [________________]        │
│                                  │
│        Password                  │
│        [________________]        │
│                                  │
│             [ Login ]            │
└──────────────────────────────────┘
This login is for you/admins managing the Auth server, not the end users of your applications.
2. Projects
After logging in:
┌─────────────────────────────────────────────────────┐
│ Auth Dashboard                         [+ New Project]│
│                                                     │
│ Your Projects                                       │
│                                                     │
│ ┌───────────────────┐  ┌───────────────────┐       │
│ │ CRM               │  │ Dental Website    │       │
│ │ Authentication    │  │ Authentication    │       │
│ │                   │  │                   │       │
│ │ 124 users         │  │ 38 users          │       │
│ │                   │  │                   │       │
│ │ [Open Project]    │  │ [Open Project]    │       │
│ └───────────────────┘  └───────────────────┘       │
│                                                     │
└─────────────────────────────────────────────────────┘
The important concept:
A project is an organizational layer in your dashboard.
GoTrue itself can still contain the users centrally.
For example:
Auth Server
│
├── CRM
│   ├── users
│   └── settings
│
├── Dental
│   ├── users
│   └── settings
│
└── Portfolio
    ├── users
    └── settings
Your dashboard uses the app_id metadata you've already been testing to associate users with projects.
3. Project Overview
Clicking a project:
CRM
Authentication

┌─────────────────────────────────────────────┐
│ Overview                                    │
│                                             │
│ Total Users             124                 │
│ Verified Users          98                  │
│ Unverified Users        26                  │
│                                             │
│ Recent Signups                              │
│ ──────────────────────────────────────────  │
│ john@email.com       Today                  │
│ jane@email.com       Yesterday              │
│ mike@email.com       Aug 27                 │
└─────────────────────────────────────────────┘
4. Users
This should be the main page.
CRM / Users

[ Search users... ]     [Filter]    [Add User]

┌────────────────────────────────────────────────────┐
│ Email             Status       Created       •••   │
├────────────────────────────────────────────────────┤
│ john@email.com    Verified     Aug 29        •••   │
│ jane@email.com    Pending      Aug 28        •••   │
│ mike@email.com    Verified     Aug 27        •••   │
└────────────────────────────────────────────────────┘
Clicking a user:
User Details

john@email.com

Status
✓ Email verified

User ID
81f0e673-...

Created
Aug 29, 2026

Last Sign In
Aug 29, 2026

Metadata
{
  "app_id": "crm"
}

────────────────────

[ Disable User ]
[ Delete User ]
5. API / Developer page
This is very important for your use case.
Each project should have a page showing how developers actually use your Auth server.
Example:
CRM / API

Authentication Endpoint

https://auth.chrbuilds.dev

────────────────────────────

Sign Up

POST /signup

Example:

curl -X POST \
  https://auth.chrbuilds.dev/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password",
    "data": {
      "app_id": "crm"
    }
  }'

                         [Copy]
Then:
Sign In
Refresh Session
Sign Out
Get User
Reset Password
Verify Email
Update User
etc.
Basically your dashboard becomes the documentation portal for your own Auth service.
6. Project Settings
CRM / Settings

General
────────────────────

Project Name
[ CRM                         ]

App ID
[ crm                         ]

────────────────────

Authentication

☑ Email authentication

☐ Google

☐ GitHub

────────────────────

Danger Zone

[ Delete Project ]
Don't actually implement dangerous operations until the backend/admin API is ready.
Important architecture decision
For now, don't make the frontend directly perform privileged database operations.
Your architecture should eventually be:
                    ┌──────────────────┐
                    │ Auth Dashboard    │
                    │ React + Vite      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Admin API         │
                    │ Your backend      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ GoTrue            │
                    │ auth.chrbuilds.dev│
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ PostgreSQL        │
                    │ auth_db           │
                    └──────────────────┘
The public application can use GoTrue directly:
My Website
     │
     └──────► auth.chrbuilds.dev
But your admin dashboard should eventually have an admin/backend layer:
Admin Dashboard
     │
     ▼
Your Admin API
     │
     ▼
GoTrue / PostgreSQL
That keeps database credentials and privileged operations out of the browser.
Development order
Tell the AI to build it in this order:
PHASE 1
├── Dashboard shell
├── Sidebar
├── Topbar
├── Routing
└── shadcn components

PHASE 2
├── Login UI
├── Projects page
├── Project cards
└── Project selection

PHASE 3
├── Project overview
├── Users table
├── Search
├── Filters
└── User details

PHASE 4
├── API documentation page
├── Code examples
├── Copy buttons
└── Endpoint reference

PHASE 5
├── Project settings
├── Auth settings
└── UI polish

PHASE 6
├── Connect real GoTrue API
├── Admin API
├── Real user management
└── Real project/app management
And the design goal
Tell the AI:
Build a clean, minimal, professional authentication management dashboard inspired by Supabase's dashboard UX, but do not copy Supabase's branding. The primary concept is Projects → Project Dashboard → Users/API/Settings. Use TypeScript, React, Vite, Tailwind CSS v4, shadcn/ui with the Nova preset, and React Compiler. Prioritize excellent UX, responsive layout, clean typography, simple navigation, useful empty/loading/error states, and reusable components. Keep the architecture ready for connecting to my self-hosted GoTrue server at https://auth.chrbuilds.dev.

That gives the AI a clear enough architecture without letting it start randomly creating pages/components.

## Frontend architecture and coding pattern

Use a React-friendly version of MVC / feature architecture. Do not force traditional MVC classes into React; instead, keep the same separation of responsibilities:

```
src/
├── pages/                  # Route-level composition only
├── components/             # Reusable presentational UI
│   ├── ui/                 # shadcn primitives
│   ├── layout/             # Sidebar, topbar, page shells
│   └── <feature>/          # Feature-specific view components
├── features/               # One folder per domain: projects, users, auth
│   └── <feature>/
│       ├── hooks/          # Controller-style UI/data logic
│       ├── services/       # Requests to the future Admin API
│       ├── types.ts        # Domain models and API contracts
│       └── utils.ts        # Pure feature helpers
├── hooks/                  # Shared reusable hooks only
├── context/                # Small, app-wide client state only
└── lib/                    # Shared utilities and API client configuration
```

### Responsibilities

- **Views:** Pages and components render props and emit user events. Keep them as declarative and presentational as practical. They may keep tiny, local UI state such as whether a menu or dialog is open.
- **Hooks:** Put reusable interaction and controller logic here: fetching state, form submission, search/filter state, optimistic updates, clipboard behavior, and mapping API data for a view. A hook should expose data, derived state, actions, loading, and error state—not JSX.
- **Services:** Services make HTTP calls only. They must not import React, access components, or contain UI behavior. All privileged calls go through the future Admin API, never directly to PostgreSQL or GoTrue admin credentials from the browser.
- **Models:** Use TypeScript types for domain and API contracts. Avoid `any`; validate or safely handle untrusted API responses at the boundary.
- **Context:** Use context sparingly for true app-wide client concerns (for example session state, theme, or selected project). Do not make it a catch-all server-data store.

### Current pattern and migration plan

The current app is a UI prototype using `MOCK_PROJECTS` and a mock `AuthContext`. Keep this mock layer isolated and clearly labelled. When Phase 6 begins, replace mock reads with feature hooks and service calls while preserving the view component APIs where possible.

Example flow:

```
UsersPage (route composition)
  → useProjectUsers(projectId) (state, actions, loading/error)
  → usersService.list(projectId) (Admin API request)
  → Admin API → GoTrue / PostgreSQL
```

### Implementation rules

- Prefer small, focused components with typed props over large page files.
- Put business rules, request orchestration, and reusable event logic in hooks or pure utilities, not inline in JSX.
- Keep route parameters parsing and missing-project handling at the route/page boundary.
- Every async screen must support loading, empty, error, and success states.
- Keep destructive operations disabled or mocked until the Admin API is implemented, with clear user feedback.
- Use descriptive names: `useProjectUsers`, `usersService`, `ProjectUser`, `CreateUserInput`.
- Run `pnpm typecheck` and `pnpm lint` before considering a change complete; keep both passing.
