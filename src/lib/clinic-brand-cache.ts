// Caché local de la marca de cada consultorio (logo + color del portal).
// Lo escriben las páginas públicas/portal al cargar la marca real, y lo lee
// la pantalla de carga para mostrar la identidad del consultorio al instante
// en las visitas siguientes — nunca el logo de Consultorio Digital.
export interface CachedClinicBrand {
  logoUrl: string | null;
  /** HSL sin hsl(), ej: "176 100% 32%" */
  color: string | null;
}

const key = (slug: string) => `clinic_brand_${slug}`;

export const cacheClinicBrand = (slug: string | null | undefined, brand: CachedClinicBrand) => {
  if (!slug) return;
  try {
    localStorage.setItem(key(slug), JSON.stringify(brand));
  } catch {
    /* ignore */
  }
};

export const getCachedClinicBrand = (slug: string | null | undefined): CachedClinicBrand | null => {
  if (!slug) return null;
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as CachedClinicBrand) : null;
  } catch {
    return null;
  }
};
