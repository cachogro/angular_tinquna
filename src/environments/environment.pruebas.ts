// Environment de pruebas/staging.
// Por ahora apunta a localhost:3000 (mismo backend que development) hasta que
// exista un servidor de pruebas real; cuando lo tengan, solo cambiar apiUrl aquí.
export const environment = {
  production: false,
  envName: 'pruebas',
  apiUrl: 'http://localhost:3000/api',
};
