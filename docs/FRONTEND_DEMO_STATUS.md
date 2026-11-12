# Estado del frontend para la demostración

Actualizado: 2026-11-12.

| Área | Estado | Comportamiento verificable |
|---|---|---|
| Login y sesión | `REAL_FUNCIONAL` | JWT, interceptor, perfil y logout. |
| Buildings / Zones | `REAL_FUNCIONAL` | Catálogo y mutaciones reales; `floorLabel` agrupa pisos. |
| Devices | `REAL_FUNCIONAL` | Registro, capacidades, asignación, estado, monitoreo y conectividad. |
| Editor de plano | `REAL_FUNCIONAL_CON_FALLBACK` | Selecciona o registra un dispositivo real, lo ubica en su zona y guarda el plano remoto. `localStorage` queda como fallback visible. |
| Perfil de monitoreo por zona | `REAL_FUNCIONAL` | Lee reglas efectivas, muestra si vienen del override o fallback global y guarda un override real. |
| Historial | `REAL_FUNCIONAL` | Device detail consume el endpoint histórico, no replica la lectura actual. |
| Alertas / acciones | `REAL_FUNCIONAL` | Evidencia y ejecuciones reales; autorización crítica disponible solo para Volunteer. |
| Incidentes | `REAL_FUNCIONAL` | Correlación confirmada, asignarme, acciones humanas, verify-safe, resolución y cierre persistidos. Refresco cada 15 segundos cuando no hay edición activa. |
| Condición segura | `SERVER_VERIFIED` | El frontend muestra el resultado persistido; el backend decide usando evidencia, frescura, conectividad y regla enlazada. |

## Verificación local

- `npm run build -- --configuration development`: correcto.
- `npm run build`: correcto; conserva un warning preexistente de presupuesto SCSS en `buildings.pages.ts`.
- No se usaron credenciales ni se modificaron datos de producción.
