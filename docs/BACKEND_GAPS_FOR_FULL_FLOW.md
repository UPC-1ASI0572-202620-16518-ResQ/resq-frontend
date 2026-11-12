# Contratos backend del flujo integral

Actualizado: 2026-11-12.

## Implementado en el backend local

- Correlación persistida `riskDetectionId` / `alertId` en incidentes y creación automática idempotente para severidad `CRITICAL`.
- `generatedIncidentIds` y `generatedAlertIds` en evaluación e ingesta de mediciones.
- `PUT /api/v1/incidents/{id}/assign/me` con usuario entero obtenido del JWT; `assignedTo` GUID se conserva por compatibilidad.
- Organización obligatoria en incidentes y consultas/mutaciones aisladas por organización.
- Acciones humanas, verificación segura calculada por servidor, actores/fechas de asignación, resolución y cierre.
- Resolución crítica bloqueada hasta que el usuario asignado obtenga una verificación segura satisfactoria.
- Perfil efectivo de monitoreo por zona con fallback global y uso real durante evaluación.
- Historial de mediciones por dispositivo y zona.
- Políticas de respuesta persistidas; sus acciones se materializan automáticamente al generar alertas.
- Plano remoto por edificio y `floorLabel`, con contenido completo de geometría y posiciones.
- Aseguramiento incremental de tablas/columnas compatible con el uso existente de `EnsureCreated`.

## Pendientes auténticos

- El adaptador físico IoT todavía no confirma que un actuador ejecutó una orden. `EXECUTION_REQUESTED` no equivale a resultado físico.
- La organización continúa viniendo de `DevelopmentSettings:OrganizationId`; el JWT aún no contiene membresía multi-organización.
- Los perfiles por zona se reemplazan como colección y no usan ETag/versionado optimista.
- Los assets de fondo del plano se guardan dentro del JSON; no existe almacenamiento de objetos dedicado.
- No se ejecutó una prueba end-to-end contra una base MySQL o una cuenta remota en esta tarea; sí se validó compilación y presencia de contratos.
