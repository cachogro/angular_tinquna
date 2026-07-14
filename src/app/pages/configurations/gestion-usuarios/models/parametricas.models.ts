// export interface Mineral {
//   id: number;
//   descripcion: string;
//   simbolo?: string;
//   unidadCotizacion?: string;
//   detalleMineral?: string;
//   factorConversion?: number;
//   calculoRegalia?: string | null;
//   tipo?: string;
//   activo?: boolean;
// }

// export interface Codificacion {
//   id: string;
//   codigo: string;
//   nombre: string;
//   minerales: Mineral[];
//   activo?: boolean;
//   usuarioUltimaModificacion?: string | null;
//   fechaUltimaModificacion?: string | null;
//   fechaRegistro?: string;
// }

// export interface CrearCodificacionRequest {
//   codigo: string;
//   nombre: string;
//   minerales: number[];
// }

// export interface ActualizarCodificacionRequest {
//   id: string;
//   codigo: string;
//   nombre: string;
//   minerales: number[];
// }