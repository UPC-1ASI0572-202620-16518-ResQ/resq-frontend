# Auditoría del frontend IoT de ResQ

## Hallazgos antes de refactorizar

- Angular 22, signals, componentes standalone y gateways por contexto. Los adaptadores HTTP existen pero Monitoring/Risk/Response no tienen contrato final. No se deben inventar endpoints ni confirmaciones físicas.
- Device soporta diez tipos; las listas, unidades, prefijos y capacidades se repiten en modelos, editor, mocks y presentación.
- El store guarda dispositivos tanto en una lista como dentro de espacios. El editor guarda otra copia y puede sobrescribir mediciones/estados al guardar o deshacer geometría.
- MockDeviceGateway mezcla un catálogo privado con el store: listados incluyen altas del plano, pero escrituras/ETags consultan el catálogo privado y borrados pueden reaparecer.
- SensorResponseService usa find (solo una regla), casts incompatibles Normal/Online, reglas globales sin objetivos por ID y estados que se apagan al recibir otra medición normal.
- La OLED y el LED normal no agregan el estado de la zona; el servomotor no tiene acciones ejecutables; eventos sin ubicación no se pueden filtrar correctamente.
- MQ-2 produce ADC; la zona contiene thresholds ppm. Esa comparación no es válida.
- La edición del plano solo modifica displayName; falta configuración de threshold, unidad, regla, objetivos y acciones.
- El modal hereda estilos de panel oculto, varios overrides contradictorios y una tercera columna vacía. Abre durante pointerdown e interfiere con arrastre. Creaciones superpuestas no se distinguen.
- Espacios usan snapshots y valores ficticios de historial. El dashboard y las páginas de gateways no muestran actividad de simulación.

## Fuentes de verdad y alcance

| Dato | Fuente |
|---|---|
| Tipos, categorías, iconos, unidades y capacidades conocidas | DEVICE_CATALOG y funciones de dominio |
| Dispositivos y mediciones de sesión | BuildingStoreService.devices |
| Jerarquía y thresholds de área | BuildingStoreService, proyección de dispositivos por asignación |
| Threshold específico en otra unidad (ADC) | configuración del sensor |
| Reglas, objetivos concretos y eventos | BuildingStoreService |
| Comparaciones y evaluación | funciones puras + RiskEvaluationService |
| Coordinación de ingestión/simulación y respuestas | SensorResponseService |
| Formularios detallados y simulación | componente compartido de configuración de dispositivos |
| Geometría pendiente del plano | borrador del editor; no es una copia de telemetría |

Los mocks inicializan datos. Los eventos locales son actividad de sesión, no notificaciones entregadas ni incidentes/órdenes confirmados por backend. HVAC y servomotor permanecen capacidades futuras/simuladas, distinguibles del buzzer/LED/OLED del MVP. Los contratos HTTP conservan su estructura.
