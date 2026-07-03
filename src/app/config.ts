// TU config.ts, con SOLO el bloque "inactivity" agregado dentro de APP_CONFIG
export interface AppSettings {
  sidenavOpened: boolean;
  sidenavCollapsed: boolean;
}
export const defaults: AppSettings = {
  sidenavOpened: false,
  sidenavCollapsed: false,
};
export const APP_CONFIG = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  applicationName: 'Sistema Tinkuriquna',
  version: '1.0.0',
  inactivity: {
    // <-- NUEVO: usado por InactivityService
    timeoutMinutes: 15, // cierra sesión tras 15 min sin actividad
    warningMinutes: 1, // muestra el aviso 1 min antes de cerrar
  },
};
