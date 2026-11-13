# Auditoría del frontend IoT de ResQ

## Estado posterior a la integración REST

La auditoría histórica de simulaciones quedó sustituida por la matriz vigente de
[`frontend-backend-integration.md`](./frontend-backend-integration.md). Los gateways
activos de dispositivos, conectividad, monitoreo, riesgos y alertas usan exclusivamente
los contratos HTTP del backend.

- El catálogo visual de sensores, iconos y unidades se conserva como información de presentación.
- Las mediciones mostradas proceden de las rutas actuales e históricas de Monitoring. El dashboard y el detalle del dispositivo no consultan el endpoint público de prototipo.
- Las reglas, detecciones, evidencias, alertas y ejecuciones de respuesta proceden de sus APIs.
- La edición de geometría y la simulación de telemetría permanecen visibles pero deshabilitadas porque el backend no ofrece contratos de persistencia para esas operaciones.
- No se confirma localmente ninguna activación física ni autorización de respuesta.

`BuildingStoreService` solo mantiene la proyección de edificios y zonas requerida por
las vistas 2D/3D existentes; su contenido se reemplaza con recursos obtenidos de la API
y no actúa como persistencia de negocio.

## Ingesta ThingSpeak hacia Monitoring

El frontend queda preparado para consumir el recorrido oficial:

`ESP32 → ThingSpeak → ThingSpeakImportWorker → Monitoring → MySQL → Angular`.

El worker del backend está registrado como servicio hospedado, pero no hace nada mientras
`ThingSpeak__Enabled` no sea `true`. La habilitación y la validación extremo a extremo
siguen pendientes y deben realizarse primero contra una base de datos de desarrollo.

### Identificadores y dispositivo

1. Iniciar sesión con un usuario de la organización que recibirá las mediciones.
2. Consultar `GET /api/v1/devices` con ese JWT. El `organizationId` de los recursos devueltos
   identifica la organización efectiva; debe coincidir en todos los recursos seleccionados.
3. Consultar `GET /api/v1/devices/{deviceId}` para confirmar el GUID, la asignación real,
   `administrativeStatus` y las capacidades.
4. No usar `Sensor_t` sin una corrección administrativa deliberada: se observó `INACTIVE`
   y solo con capacidad de temperatura, por lo que no cumple el contrato del ESP32.
5. El dispositivo elegido debe estar `ACTIVE`, asociado a un edificio real y, de preferencia,
   a una zona real. El worker no crea, activa ni reasigna dispositivos.

Capacidades `MEASUREMENT` requeridas y unidades exactas:

| Variable | Unidad |
|---|---|
| `GAS_ADC` | `ADC` |
| `TEMPERATURE_C` | `C` |
| `WIFI_RSSI` | `DBM` |
| `ALERT_FLAG` | `BOOLEAN` |
| `MOTION` | `BOOLEAN` |
| `HUMIDITY` | `PERCENT` |

Monitoring rechaza una medición si el dispositivo está inactivo, si no existe la capacidad
o si la unidad configurada no coincide. El valor MQ-2 permanece como ADC sin calibrar.

### Configuración del worker

Configurar como secretos/variables del backend, nunca en Angular:

| Variable | Uso |
|---|---|
| `ThingSpeak__Enabled` | `true` solo después de validar todo lo anterior |
| `ThingSpeak__ReadApiKey` | clave privada de lectura del canal |
| `ThingSpeak__ChannelId` | identificador numérico del canal |
| `ThingSpeak__OrganizationId` | GUID real obtenido del contexto autenticado |
| `ThingSpeak__DeviceId` | GUID del dispositivo físico activo |
| `ThingSpeak__PollIntervalSeconds` | periodo; `30` es el valor previsto y el worker limita el rango a 20–3600 s |
| `ThingSpeak__ImportHistorical` | `false` para establecer baseline sin importar el lote previo |
| `ThingSpeak__FetchCount` | tamaño del lote, entre 1 y 100; predeterminado 10 |
| `ThingSpeak__RequestTimeoutSeconds` | timeout HTTP; predeterminado 15 s |

`ThingSpeak__PublicDemoEnabled` controla únicamente la ruta pública `/prototype`; no habilita
la ingesta y no debe usarse como fuente del dashboard operativo.

### Prueba segura en desarrollo

1. Usar una instancia del backend y MySQL de desarrollo con una copia controlada de la
   organización, edificio, zona y dispositivo.
2. Mantener `ThingSpeak__ImportHistorical=false`, iniciar una única instancia del backend y
   comprobar en logs que el worker estableció su baseline.
3. Generar una entrada nueva desde el ESP32 y confirmar primero que aparece en ThingSpeak.
4. Esperar al siguiente sondeo y consultar
   `GET /api/v1/monitoring/devices/{deviceId}/measurements/history`.
5. Confirmar seis registros con el mismo `measuredAt`, variables/unidades correctas y los
   identificadores reales de dispositivo, edificio y zona.
6. Consultar `.../measurements/current`; solo devuelve variables dentro de
   `MonitoringSettings:MeasurementMaxAgeSeconds`.
7. Abrir `/dashboard` y `/devices/{deviceId}`. La actividad, el gráfico ambiental y el
   historial deben reflejar esos registros después del refresco de 30 segundos.
8. Reiniciar el backend en desarrollo y comprobar que no se duplican las mediciones ya
   persistidas antes de considerar producción.

### Límites conocidos del worker

- La deduplicación consulta `OrganizationId + DeviceId + VariableType + MeasuredAt`; no existe
  una restricción única transaccional. Solo se espera una instancia del worker.
- El cursor/baseline no es durable. Con `ImportHistorical=false`, un reinicio establece un
  baseline nuevo y puede omitir entradas producidas durante la caída.
- Si se guarda la medición y luego falla Risk Detection, el reintento detecta el registro y no
  repite automáticamente la evaluación.
- Importar una medición actualiza Monitoring, pero no registra un heartbeat. Connectivity debe
  recibir su propio `POST /api/v1/connectivity/heartbeats`; Angular no infiere `ONLINE` desde RSSI.
- `ALERT_FLAG` es una medición booleana. No equivale por sí sola a una alerta o incidente
  persistido; esos recursos solo existen si las reglas y servicios de backend los generan.

## Estado de verificación

- **Frontend preparado:** sí; consume exclusivamente Monitoring para el dashboard operativo.
- **Integración local:** verificada con `resq_demo_local`, el dispositivo `ESP32_RESQ_01`
  y una entrada física nueva que recorrió ThingSpeak, Monitoring y MySQL hasta las vistas Angular.
- **Ingesta de producción:** pendiente. Los GUID locales no deben copiarse ni suponerse válidos
  en Render.
- **Integración extremo a extremo en producción:** pendiente hasta completar el respaldo,
  registro administrativo y prueba controlada descritos a continuación.

## Lista de habilitación en producción

1. Confirmar en Render que el servicio despliega `main`, usa
   `ASPNETCORE_ENVIRONMENT=Production` y mantiene conexión con la base MySQL de producción.
2. Realizar un respaldo recuperable de esa base y verificar que el esquema contiene las tablas
   de Device Management, Monitoring, Risk Detection y Alert Management. No restaurar encima
   una copia de `resq_demo_local`.
3. Con un usuario de producción, obtener el `organizationId` real y registrar o seleccionar el
   dispositivo físico. Debe estar `ACTIVE`, asignado al edificio/zona correctos y tener las seis
   capacidades `MEASUREMENT` con las unidades de la tabla anterior.
4. Mantener `ThingSpeak__Enabled=false` mientras se configuran el canal, la clave secreta y los
   GUID de producción. Usar `ThingSpeak__ImportHistorical=false` para el primer arranque.
5. Evitar reglas temporales de laboratorio como `TEMPERATURE_TEST >= 26`. Si se valida Risk
   Detection, crear una regla de producción aprobada y retirarla mediante el flujo administrativo.
6. Activar una sola instancia del importador, generar una lectura física nueva y comprobar por
   orden: ThingSpeak, logs del worker, historial autenticado de Monitoring, dashboard y detalle
   del dispositivo.
7. Reiniciar una vez el servicio en una ventana controlada y confirmar que el historial no contiene
   duplicados. Debido al cursor no durable, revisar también si hubo una lectura durante la caída.
8. Confirmar separadamente Connectivity: la importación no crea heartbeats y no autoriza a Angular
   a mostrar el dispositivo como `ONLINE`.
