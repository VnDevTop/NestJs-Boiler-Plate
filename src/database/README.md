# Database Layer

The `database` layer contains database infrastructure files.

## Purpose

This layer is responsible for shared database concerns and TypeORM-related infrastructure.

Examples:

- Migrations
- Seeds
- Factories
- Base entities
- Subscribers
- Database utilities

## Rules

- Do not place business logic in this layer.
- Feature-specific entities should usually stay inside their feature module.
- Shared base entities can live here.
- Migration files should be framework/database focused, not business-service focused.

## Suggested Structure
```text
database 
    ├── migrations 
    ├── seeds 
    ├── factories 
    ├── entities 
    │   └── base.entity.ts 
    ├── subscribers 
    └── README.md
```

## Notes

Feature entities should normally be placed in their modules:

```text
modules/users/entities/user.entity.ts 
modules/auth/entities/refresh-token.entity.ts
```

Shared database primitives may be placed here:

```text
database/entities/base.entity.ts
```

