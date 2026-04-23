/**
 * Configuración global de la app.
 *
 * APP_URL es el dominio canónico de producción. Se usa para construir
 * cualquier URL que vaya a ser compartida con un paciente o profesional
 * (links de portal, invitaciones, reservas, etc.), de modo que nunca se
 * filtren dominios de preview (lovableproject.com / lovable.app).
 *
 * Para flujos internos del navegador que dependen del host actual
 * (por ejemplo redirects de OAuth / recuperación de contraseña) se debe
 * seguir usando window.location.origin.
 */
export const APP_URL = "https://consultoriodigital.app";

/**
 * Construye una URL absoluta sobre el dominio canónico de la app.
 * Acepta paths con o sin slash inicial.
 */
export const buildShareUrl = (path: string): string => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL}${normalized}`;
};