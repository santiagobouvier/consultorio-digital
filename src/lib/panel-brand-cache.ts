// Caché local de la marca del PANEL, separada POR CONSULTORIO.
//
// Antes existía una única clave global `panel_brand`: al entrar a otro
// consultorio (típicamente el super admin desde el panel admin) el preloader
// mostraba el logo/color del consultorio anterior. Ahora cada consultorio
// tiene su propia entrada y los lectores resuelven cuál está activo.
export interface PanelBrand {
  logoUrl: string | null;
  /** HSL sin hsl(), ej: "176 100% 32%" */
  color: string | null;
  name: string | null;
}

const SAAS_SELECTED_BUSINESS_KEY = "saas_selected_business";
const LAST_BUSINESS_KEY = "panel_brand_business";
const brandKey = (businessId: string) => `panel_brand_${businessId}`;

/** Consultorio activo del panel: el elegido por el super admin, o el propio. */
export const getActivePanelBusinessId = (): string | null => {
  try {
    return (
      sessionStorage.getItem(SAAS_SELECTED_BUSINESS_KEY) ||
      localStorage.getItem(LAST_BUSINESS_KEY)
    );
  } catch {
    return null;
  }
};

export const cachePanelBrand = (businessId: string | null | undefined, brand: PanelBrand) => {
  if (!businessId) return;
  try {
    localStorage.setItem(brandKey(businessId), JSON.stringify(brand));
    // Solo el consultorio propio queda como "último" para el próximo arranque:
    // la visita del super admin no debe pisar la marca del panel del dueño.
    if (!sessionStorage.getItem(SAAS_SELECTED_BUSINESS_KEY)) {
      localStorage.setItem(LAST_BUSINESS_KEY, businessId);
    }
  } catch {
    /* ignore */
  }
};

export const getPanelBrand = (businessId?: string | null): PanelBrand | null => {
  const id = businessId ?? getActivePanelBusinessId();
  if (!id) return null;
  try {
    const raw = localStorage.getItem(brandKey(id));
    return raw ? (JSON.parse(raw) as PanelBrand) : null;
  } catch {
    return null;
  }
};
