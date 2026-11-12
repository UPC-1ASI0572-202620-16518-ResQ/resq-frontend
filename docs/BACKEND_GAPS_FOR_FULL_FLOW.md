# Contratos backend faltantes para el flujo integral

Este backlog se obtuvo inspeccionando el backend local actual. Son propuestas de contrato; **no se implementan en el frontend ni en el backend en este trabajo**.

## P0 — críticos para flujo humano/IoT

### 1. Relación Incidente → Detección → Alerta

- Evidencia: `IncidentResource` solo expone `Id`, `ZoneId`, `Type`, `Level`, `Status`, `AssignedTo`, `CreatedAt`, `ResolvedAt` y `ResolutionNotes`.
- Propuesta: ampliar `GET /api/v1/incidents/{incidentId}` (y el listado) con `riskDetectionId: Guid?` y `alertId: Guid?`; alternativamente `GET /api/v1/incidents/{id}/origin`.
- Respuesta mínima: `{ incidentId, riskDetectionId, alertId }`.
- Dependencia: persistir las referencias al crear el incidente desde Risk Detection.
- Habilita: evidencia original confirmada, acciones de respuesta, navegación y línea temporal sin correlaciones por hora/zona.

### 2. Identidad IAM entera ↔ attendant GUID

- Evidencia: IAM/Profile devuelve id entero/string numérico; `PUT /api/v1/incidents/{id}/assign` recibe `AssignIncidentResource(Guid AttendantId)`.
- Propuesta: `GET /api/v1/identity/me/incident-attendant`.
- Respuesta mínima: `{ identityId: int, profileUserId: int, attendantId: Guid }`.
- Alternativa: cambiar assign a `{ userId: int }` y resolver el attendant en el servidor.
- Dependencia: vínculo persistente y único entre IAM/Profile e Incident Management.
- Habilita: **Asignarme** real sin UUID inventado.

### 3. Creación automática de incidentes críticos

- Evidencia: Risk Detection publica alertas mediante `IAlertsContextFacade`, pero no consume `IIncidentContextFacade`; esta última solo está registrada. El publicador genera alertas para eventos y no crea incidentes.
- Propuesta interna preferida: al crear/escalar una detección a `Critical`, invocar `IIncidentContextFacade.CreateIncident(...)` pasando además `riskDetectionId` y `alertId`.
- Contrato REST observable: la respuesta de `POST /api/v1/risk-detections/evaluations` podría añadir `generatedIncidentIds: Guid[]`.
- Dependencia: gap 1 para conservar trazabilidad e idempotencia/correlación para evitar duplicados.
- Habilita: historia automática medición crítica → detección → alerta → incidente.

### 4. Generación de acciones en alertas automáticas

- Evidencia: `AlertManagementRiskDetectionEventPublisher` y `AlertsContextFacade` llaman a `GenerateAlertCommand` con `responseActions: []`.
- Propuesta: política persistida consultable, por ejemplo `GET/POST/PUT /api/v1/response-policies`, y resolución de acciones al generar la alerta.
- DTO mínimo: `{ riskTypeCode, status, actions: [{ actionCode, targetSelector|targetDeviceId, targetCapabilityCode, authorizationMode, critical }] }`.
- Respuesta: política versionada; la alerta automática crea `ResponseExecutionResource[]`.
- Dependencia: validar dispositivos/capacidades activos y definir semántica de selección por zona.
- Habilita: acciones humanas reales en alertas producidas automáticamente, no solo en alertas creadas manualmente.

## P1 — importantes

### 5. Umbrales por zona / perfiles de sensibilidad

- Propuesta: `GET/PUT /api/v1/buildings/{buildingId}/zones/{zoneId}/monitoring-profile`.
- DTO mínimo: `{ sensitivityCode, rules: [{ variableType, warningRuleId|condition, criticalRuleId|condition }] , version }`.
- Respuesta: perfil versionado con ETag.
- Dependencia: definir precedencia entre reglas globales y overrides de zona.
- Habilita: Monitoring Configuration por zona sin modificar reglas globales.

### 6. Verificación persistida de condición segura

- Propuesta: `POST /api/v1/incidents/{id}/safe-condition-verifications`.
- DTO mínimo: `{ measurementId, deviceId, connectivitySnapshotId?, verifiedByUserId?, note? }`.
- Respuesta: `{ verificationId, incidentId, result, measuredAt, verifiedAt, thresholdsApplied[] }`.
- Dependencia: vínculo del incidente con la detección/dispositivo y política de frescura del servidor.
- Habilita: etapa “Safe condition verified” auditable y precondición server-side opcional para resolve.

### 7. Comando y confirmación real de actuadores

- Propuesta: `POST /api/v1/alerts/{alertId}/response-executions/{id}/dispatch` y `PUT /api/v1/response-executions/{id}/result` para el adaptador IoT.
- DTO dispatch: `{ expectedDeviceVersion?, idempotencyKey }`.
- Respuesta: `{ status: EXECUTION_REQUESTED, requestedAt, commandId }`.
- DTO result: `{ commandId, successful, resultCode, message, completedAt }`.
- Dependencia: canal seguro hacia gateway/hardware, idempotencia y autenticación de dispositivo.
- Habilita: distinguir autorización, solicitud, ejecución y resultado físico confirmado.

### 8. Historial consultable de mediciones

- Propuesta: `GET /api/v1/monitoring/devices/{deviceId}/measurements?from=&to=&variableType=&page=&size=` y equivalente por zona.
- Respuesta mínima: página de `{ measurementId, deviceId, zoneId, variableType, measurementValue, measuredAt, recordedAt }`.
- Dependencia: retención, paginación y límites de rango.
- Habilita: gráficos e investigación histórica sin replicar una lectura actual.

## P2 — visuales/complementarios

### 9. Persistencia remota de plano 2D/3D

- Propuesta: `GET/PUT /api/v1/buildings/{buildingId}/floors/{floorLabel}/plan`.
- DTO mínimo: `{ version, backgroundAssetId?, elements: [{ id, type, geometry, zoneId? }] }`.
- Respuesta: plano versionado con ETag.
- Dependencia: estrategia para `floorLabel` estable o un recurso Floor real; almacenamiento de assets.
- Habilita: sincronización entre navegadores y usuarios.

### 10. Coordenadas de dispositivos

- Propuesta: `PUT /api/v1/buildings/{buildingId}/zones/{zoneId}/device-positions/{deviceId}`.
- DTO mínimo: `{ floorLabel, xRatio, yRatio, rotation?, planVersion }`.
- Respuesta: posición versionada.
- Dependencia: plan remoto y validación de que el dispositivo esté asignado a la zona.
- Habilita: posicionamiento persistente sin cambiar asignación administrativa.

### 11. Timestamps/actores completos del ciclo de incidente

- Propuesta: ampliar `IncidentResource` con `assignedAt`, `resolvedBy`, `closedAt`, `closedBy` y, si se adopta el gap 6, `safeAt`/última verificación.
- Dependencia: persistir actor y hora en cada comando.
- Habilita: timeline completo sin mostrar timestamps inexistentes.

### 12. Suscripciones (fuera de alcance actual)

- Evidencia: se observó HTTP 500 en `/api/v1/subscriptions`.
- Propuesta: estabilizar `GET /api/v1/subscriptions/me` y publicar catálogo/operaciones antes de habilitar compra o renovación en UI.
- DTO/respuesta: contrato versionado de plan, estado, fechas y operaciones permitidas.
- Dependencia: definición del producto de suscripción.
- Habilita: Settings de suscripción sin suposiciones ni reintentos ruidosos.
