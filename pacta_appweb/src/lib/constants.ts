/**
 * Archivo centralizado de constantes para la aplicación PACTA.
 * Contiene configuraciones de la aplicación, estados de contrato y tipos de contrato.
 */

/**
 * Configuración global de la aplicación.
 * @property {string} APP_NAME - Nombre de la aplicación
 * @property {string} APP_VERSION - Versión actual de la aplicación
 * @property {string} DEFAULT_LANGUAGE - Idioma por defecto
 * @property {string[]} SUPPORTED_LANGUAGES - Lista de idiomas soportados
 * @property {number} ITEMS_PER_PAGE - Cantidad de elementos por página en listados
 */
export const APP_CONFIG = {
  APP_NAME: "PACTA",
  APP_VERSION: "1.0.0",
  DEFAULT_LANGUAGE: "es",
  SUPPORTED_LANGUAGES: ["es", "en"] as const,
  ITEMS_PER_PAGE: 50,
} as const;

/**
 * Estados posibles de un contrato.
 * @property {string} ACTIVE - Contrato activo y vigente
 * @property {string} EXPIRED - Contrato expirado
 * @property {string} PENDING - Contrato pendiente de aprobación
 * @property {string} CANCELLED - Contrato cancelado
 */
export const CONTRACT_STATUSES = {
  ACTIVE: "active",
  EXPIRED: "expired",
  PENDING: "pending",
  CANCELLED: "cancelled",
} as const;

/**
 * Etiquetas legibles en español para los estados de contrato.
 * @property {string} active - Etiqueta para estado activo
 * @property {string} expired - Etiqueta para estado expirado
 * @property {string} pending - Etiqueta para estado pendiente
 * @property {string} cancelled - Etiqueta para estado cancelado
 */
export const CONTRACT_STATUS_LABELS = {
  active: "Activo",
  expired: "Expirado",
  pending: "Pendiente",
  cancelled: "Cancelado",
} as const;

/**
 * Tipos de contrato permitidos en el sistema.
 * Contiene todos los tipos de contratos definidos en el dominio legal.
 */
export const CONTRACT_TYPES = {
  COMPRAVENTA: "compraventa",
  SUMINISTRO: "suministro",
  PERMUTA: "permuta",
  DONACION: "donacion",
  DEPOSITO: "deposito",
  PRESTACION_SERVICIOS: "prestacion_servicios",
  AGENCIA: "agencia",
  COMISION: "comision",
  CONSIGNACION: "consignacion",
  COMODATO: "comodato",
  ARRENDAMIENTO: "arrendamiento",
  LEASING: "leasing",
  COOPERACION: "cooperacion",
  ADMINISTRACION: "administracion",
  TRANSPORTE: "transporte",
  OTRO: "otro",
} as const;

/**
 * Etiquetas legibles en español para cada tipo de contrato.
 */
export const CONTRACT_TYPE_LABELS = {
  compraventa: "Compraventa",
  suministro: "Suministro",
  permuta: "Permuta",
  donacion: "Donación",
  deposito: "Depósito",
  prestacion_servicios: "Prestación de Servicios",
  agencia: "Agencia",
  comision: "Comisión",
  consignacion: "Consignación",
  comodato: "Comodato",
  arrendamiento: "Arrendamiento",
  leasing: "Leasing",
  cooperacion: "Cooperación",
  administracion: "Administración",
  transporte: "Transporte",
  otro: "Otro",
} as const;

/**
 * Tipo que representa todos los valores posibles de estado de contrato.
 */
export type ContractStatus = (typeof CONTRACT_STATUSES)[keyof typeof CONTRACT_STATUSES];

/**
 * Tipo que representa todos los valores posibles de tipo de contrato.
 */
export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES];
