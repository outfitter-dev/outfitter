# Error Taxonomy

Outfitter uses 10 error categories to classify all failure modes. Each category maps to a CLI exit code and an HTTP status code, ensuring consistent error handling across CLI, MCP, and API surfaces.

## Category Reference

| Category     | Exit Code | HTTP Status | Description                                         |
| ------------ | --------- | ----------- | --------------------------------------------------- |
| `validation` | 1         | 400         | Invalid input, schema violation, constraint failure |
| `not_found`  | 2         | 404         | Requested resource does not exist                   |
| `conflict`   | 3         | 409         | Resource state conflict (e.g., duplicate creation)  |
| `permission` | 4         | 403         | Insufficient permissions for the operation          |
| `timeout`    | 5         | 504         | Operation exceeded its time limit                   |
| `rate_limit` | 6         | 429         | Request rate exceeded, try again later              |
| `network`    | 7         | 502         | Network or upstream service failure                 |
| `internal`   | 8         | 500         | Unexpected internal error                           |
| `auth`       | 9         | 401         | Authentication required or invalid credentials      |
| `cancelled`  | 130       | 499         | Operation cancelled by user (POSIX: 128 + SIGINT)   |

## Usage

### Creating Errors

```typescript
import { ValidationError, NotFoundError } from "@outfitter/contracts";

ValidationError.create("email", "invalid format", { value: input });
NotFoundError.create("user", userId);
```

### Code Mapping

```typescript
import { getExitCode, getStatusCode } from "@outfitter/contracts";

getExitCode("not_found"); // 2
getStatusCode("not_found"); // 404
```

### Recovery Classification

Categories are classified by recoverability for retry logic:

- **Retryable** (automatic): `network`, `timeout`
- **Recoverable** (with intervention): `network`, `timeout`, `rate_limit`, `conflict`
- **Permanent**: `validation`, `not_found`, `permission`, `auth`, `internal`, `cancelled`

See `isRetryable()` and `isRecoverable()` from `@outfitter/contracts` for programmatic checks.
