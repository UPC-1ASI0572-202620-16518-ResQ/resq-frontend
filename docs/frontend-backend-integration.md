# ResQ frontend/backend integration

The frontend uses the backend REST API as its operational source of truth. All active dependency-injection providers resolve to HTTP gateways; mock gateways and demo business datasets were removed.

## Environment configuration

| Build | API base URL |
|---|---|
| Development (`ng serve`) | `http://localhost:5058` |
| Production (`ng build`) | Same origin (`''`), intended for a reverse proxy/runtime host |

The values live in `src/environments/`. API paths are composed centrally through `API_CONFIG` and `buildApiUrl`.

## Integration matrix

| Context | Backend operations used | Status |
|---|---|---|
| IAM | `POST /api/v1/authentication/sign-in` | Integrated. JWT is restored from browser storage until its `exp`, attached as Bearer, and removed on logout/401. No refresh/revocation endpoint is assumed. |
| Profiles | `GET /api/v1/profiles/me`, `PUT /api/v1/profiles/contact-info` | Integrated. Preferences remain client-only because the API has no preferences operation. |
| Users | `GET /api/v1/users`, `/users/{id}`, `/users/role/{role}` | Contract audited; no current screen needs the list API. |
| Buildings | `GET/POST /api/v1/buildings`, detail/status updates, zone list/detail/create/update/status | Gateway integrated. Building create/edit uses the API. Building delete is disabled because no endpoint exists. |
| Devices | `GET/POST /api/v1/devices`, detail/capability/assignment/status updates, external reference query | Integrated. No physical delete is exposed. |
| Connectivity | device status and offline device queries | Integrated. Heartbeat ingestion is not exposed in the operator UI. |
| Monitoring | building/zone/device status and current device/zone measurements | Integrated. Charts only use current measurements; no historical series is fabricated. |
| Risk Detection | detection/evidence detail and rule create/status | Integrated for the operations used by the UI. Evaluation ingestion is not exposed in the operator UI. |
| Alerts/Response | alert list/detail, response executions by alert, authorization decision | Integrated. The frontend resolves an execution's parent alert before the authorization `PUT`. Response-policy screens/actions remain unavailable because the backend has no policy endpoints. |
| Incidents | list/detail, assignment, resolution | List/detail and resolution are integrated and refreshed after mutation. “Assign to me” is disabled: Incident requires a GUID attendant while IAM/Profile exposes an integer user id and no mapping endpoint exists. |
| Subscriptions | current/create/renew/cancel/expire | Current subscription and cancellation are connected. Activation/renewal controls are disabled until the API exposes a plan/price/period catalog; the UI does not invent a one-year product rule. |
| Dashboard/Analytics | aggregation over Buildings, Devices, Connectivity, Monitoring, Alerts and Incidents | Integrated. Counts and charts derive only from API records. Missing historical monitoring data renders empty/current-only results. |

## Contract observations

- ASP.NET serializes enum resources such as building/device/incident statuses as camelCase. Frontend mappers normalize these values into the existing uppercase domain types.
- Buildings and Devices expose a numeric `version`, but controllers do not implement `ETag` or validate `If-Match`. The existing gateway seam remains version-aware, but no claim of server-side optimistic concurrency is made.
- Incident list returns a JSON array and only accepts `zoneId`; frontend-only filters and paging are applied after that real response.
- Backend errors are primarily `{ "message": "..." }` with ASP.NET validation dictionaries for model-binding failures. `mapHttpError` also handles 401, 403, 404, 409 and network failures.
- Organization context is currently injected by backend middleware from `DevelopmentSettings:OrganizationId`; it is not a JWT claim.

## Unsupported visual capabilities

The UI layout is preserved, but unsupported mutations do not report fake success:

- Building deletion: no backend endpoint.
- Floor-plan/image/3D-layout persistence: no backend resource.
- Telemetry simulation: disabled in real-backend mode.
- Persisted profile preferences: no backend endpoint.
- Response-policy configuration: no backend endpoints.
- Incident “assign to current user”: incompatible IAM integer id versus Incident GUID attendant id.
- Subscription plan selection/pricing: no plan catalog or pricing contract.

## Validation commands

```powershell
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

`npm test` is not available because `angular.json` has no test target and the repository has no configured test runner.
