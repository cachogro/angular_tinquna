// Producción: el front y la API salen por el mismo servidor (el proxy pasa
// /api a NestJS), así que la URL es relativa y no depende de la IP ni del
// dominio. Ver back-end/deploy/Caddyfile.
export const environment = {
  production: true,
  envName: 'production',
  apiUrl: '/api',
};
