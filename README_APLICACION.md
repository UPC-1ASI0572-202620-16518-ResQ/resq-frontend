# ResQ: registro de dispositivos — parche exclusivo frontend

Abre el frontend y descomprime este ZIP en la raíz del proyecto `resq-frontend`, reemplazando los dos archivos indicados. Antes guarda tu trabajo local (`git diff`) o una copia de esos archivos.

El parche agrega un botón + Add Device en `/devices`, un formulario integrado con la operación HTTP existente `POST /api/v1/devices`, validaciones y sincronización posterior. Reutiliza los estilos SCSS existentes; no modifica rutas ni el backend. El botón de colocar dispositivos sobre un plano sigue deshabilitado porque el backend no permite almacenar posiciones.

Verificación realizada: `tsc -p tsconfig.app.json --noEmit` y compilador Angular `ngc` correctos. Build completo pendiente de ejecutar en Windows por diferencia de versión local de Node.js en el entorno de revisión.

Pasos Windows:
1. Copia el ZIP en Downloads.
2. Desde PowerShell: `Expand-Archive -Path "$env:USERPROFILE\Downloads\resq-device-registration-fix.zip" -DestinationPath "C:\Users\ffaal\OneDrive\Documentos\GitHub\resq-frontend" -Force`
3. En la carpeta del frontend: `npx tsc -p tsconfig.app.json --noEmit` y `npm run build`.
4. `npm start` → `/devices` → `+ Add Device`.
5. Selecciona edificio, zona opcional y al menos una capacidad. Confirma `POST /api/v1/devices` en Chrome Network.

No se enviaron solicitudes de escritura a la API pública.
