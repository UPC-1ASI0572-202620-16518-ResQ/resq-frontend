# ResQ Frontend ↔ Backend Integration Handoff

This frontend is structured feature-first. Pages consume presentation/application facades; bounded-context access is isolated behind gateway interfaces with mock and/or HTTP adapters.

## Integration rule

Pages and layout components must not import `core/mock-data/resq.mock.ts` directly. Mock data belongs only to `mock-*.gateway.ts` adapters. Switching to backend data should therefore be performed at the provider/adapter boundary rather than inside pages.

## Current bounded-context seams

| Bounded context | Frontend gateway | Current provider | HTTP readiness |
|---|---|---|---|
| Device Management | `DEVICE_GATEWAY` | Mock | HTTP adapter implemented for documented Device endpoints |
| Building Management | `BUILDING_GATEWAY` | Mock | HTTP adapter implemented for documented Building/Zone endpoints |
| Connectivity | `CONNECTIVITY_GATEWAY` | Mock | HTTP adapter implemented for documented status/offline queries |
| Monitoring | `MONITORING_GATEWAY` | Mock | Final HTTP resource contract still required |
| Risk Detection | `RISK_DETECTION_GATEWAY` | Mock | Placeholder HTTP adapter; final OpenAPI required |
| Alert & Response | `ALERT_RESPONSE_GATEWAY` | Mock | Placeholder HTTP adapter; final OpenAPI required |
| Incident Management | `INCIDENT_GATEWAY` | Mock | HTTP adapter implemented for list/detail/assign/resolve routes documented in the report |
| IAM | `IAM_GATEWAY` | Mock | Final authentication/session contract required |
| User | `USER_GATEWAY` | Mock | HTTP adapter prepared for `/api/v1/users/me` profile/contact/preferences contract |

## Visible sections migrated to bounded-context data

- **Devices** composes Device Management + Building Management + Monitoring + Connectivity + Risk Detection/Alerts for related evidence. It exposes Register, Edit Details, Assignment, Capability replacement and administrative lifecycle actions. No physical Delete action is exposed.
- **Alerts** composes Alert & Response + Risk Detection + Building + Device. Alerts are read-only. Human response authorization is exposed only for `HUMAN_REQUIRED` executions in `PENDING_AUTHORIZATION`.
- **Incidents** composes Incident Management + Building Management + current User. The operator can assign an incident to the current user and resolve it with notes. Manual incident creation is not exposed.
- **Analytics** is a frontend read model over Alerts + Incidents + Devices/Connectivity + Monitoring; it is not treated as its own domain bounded context.
- **Settings** separates User profile/preferences from IAM session/security information. Role/organization values are not editable free-text fields.
- **Topbar/Sidebar** use backend-ready search/alert/device read models, the project brand asset, and client-side sign-out.

## Provider switch points

`src/app/app.config.ts` currently keeps data sources on mock adapters. Contexts whose providers accept `mock | http` can be switched after the backend is running and `API_CONFIG.baseUrl` is configured.

Do not enable an HTTP adapter whose contract is marked as not finalized. First reconcile the DTO and mapper with the backend OpenAPI document.

## Backend information still required

Before the final backend switch, confirm:

1. API base URL per environment.
2. OpenAPI/Swagger document and exact JSON envelopes.
3. Authentication/session mechanism (cookie, Bearer token, JWT, opaque session, etc.).
4. Organization-context propagation.
5. Standard error response envelope.
6. Pagination and sorting parameter names/envelope.
7. `ETag` / `If-Match` behavior for versioned Device and Building writes.
8. Monitoring DTOs and final query routes.
9. Risk Detection DTOs and final rule/detection/evidence routes.
10. Alert/Response DTOs and final policy/execution/authorization routes.
11. IAM role catalog/query mechanism if role assignment is to be exposed in the Web UI.
12. CORS and time-zone/ISO-8601 conventions.

## Authentication note

The current mock session is in-memory. `Sign out` clears IAM and User frontend state and protected routes are guarded. A browser refresh requires signing in again until the backend session restoration mechanism is defined. This is deliberate: the frontend does not assume localStorage/JWT/cookie behavior that the backend has not yet specified.

## Validation

Run:

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

The project already had bundle/style budget warnings before this handoff. Do not silence those warnings by increasing budgets without first deciding whether bundle splitting or component stylesheet cleanup is appropriate.
