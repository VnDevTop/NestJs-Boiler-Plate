# Modules Layer

The `modules` layer contains business features.

## Purpose

Each folder inside `modules` should represent a business or domain module.

Initial modules:

- `auth`
- `users`
- `admin`

Future modules can be added here as the product grows.

## Rules

- Keep controllers thin.
- Put business logic in services.
- Keep feature-specific DTOs inside the feature module.
- Keep feature-specific entities inside the feature module.
- Avoid circular dependencies between modules.
- Export only what other modules need.
- Do not put generic framework utilities here; use `common` or `core` instead.

## Suggested Structure
```text
modules 
    ├── auth 
    │ ├── dto 
    │ ├── entities 
    │ ├── strategies 
    │ ├── types 
    │ ├── auth.controller.ts 
    │ ├── auth.module.ts 
    │ └── auth.service.ts 
    │ ├── users 
    │ ├── dto 
    │ ├── entities 
    │ ├── repositories 
    │ ├── users.controller.ts 
    │ ├── users.module.ts 
    │ └── users.service.ts 
    │ └── admin 
    ├── admin.controller.ts 
    ├── admin.module.ts 
    └── admin.service.ts
```

## Initial Route Direction

Public auth routes:
```text
POST /auth/register 
POST /auth/login
```

Authenticated user routes:
```text
GET /auth/me 
GET /users/me 
PATCH /users/me
```

Manager/admin routes:
```text
GET /admin/dashboard 
GET /admin/users
```

