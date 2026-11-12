# Auditoría del frontend IoT de ResQ

## Estado posterior a la integración REST

La auditoría histórica de simulaciones quedó sustituida por la matriz vigente de
[`frontend-backend-integration.md`](./frontend-backend-integration.md). Los gateways
activos de dispositivos, conectividad, monitoreo, riesgos y alertas usan exclusivamente
los contratos HTTP del backend.

- El catálogo visual de sensores, iconos y unidades se conserva como información de presentación.
- Las mediciones mostradas proceden de las rutas de medición actual; no se generan series históricas.
- Las reglas, detecciones, evidencias, alertas y ejecuciones de respuesta proceden de sus APIs.
- La edición de geometría y la simulación de telemetría permanecen visibles pero deshabilitadas porque el backend no ofrece contratos de persistencia para esas operaciones.
- No se confirma localmente ninguna activación física ni autorización de respuesta.

`BuildingStoreService` solo mantiene la proyección de edificios y zonas requerida por
las vistas 2D/3D existentes; su contenido se reemplaza con recursos obtenidos de la API
y no actúa como persistencia de negocio.
