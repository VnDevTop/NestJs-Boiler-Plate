# Common Layer

The `common` layer contains reusable application building blocks.

## Purpose

This layer provides generic utilities and framework components that can be reused across modules.

Examples:

- Decorators
- Guards
- Pipes
- Filters
- Interceptors
- Common DTOs
- Common interfaces
- Common enums
- Common constants
- Exceptions
- Middlewares
- Serializers
- Utilities

## Rules

- `common` must not depend on business modules.
- Keep code generic and reusable.
- Avoid business-specific logic.
- Prefer reading request context in guards instead of injecting feature services.
- Metadata keys should be defined in constants to avoid string duplication.

## Suggested Structure

```text

common 
    ├── constants 
    ├── decorators 
    ├── dto 
    ├── enums 
    ├── exceptions 
    ├── filters 
    ├── guards 
    ├── interceptors 
    ├── interfaces 
    ├── middlewares 
    ├── pipes 
    ├── serializers 
    └── utils

```
## Common Examples

Decorators:
```text
@Public() 
@CurrentUser() 
@Roles() 
@ManagerOnly() 
@Permissions()
```

Guards:
```text
JwtAuthGuard 
RolesGuard 
ManagerGuard 
PermissionsGuard
```

Filters:
```text
HttpExceptionFilter 
AllExceptionsFilter
```

Interceptors:
```text
ResponseTransformInterceptor 
RequestIdInterceptor 
TimeoutInterceptor
```

Pipes:
```text
ValidationPipe
```

