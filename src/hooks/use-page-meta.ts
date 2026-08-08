import { useEffect } from "react";

const SITE_URL = "https://consultoriodigital.app";

const DEFAULTS = {
  title: "Tu Consultorio Digital - Bien Gestionado",
  description:
    "Sistema de gestión de consultorios con agenda inteligente, pacientes y pagos. Tu consultorio digital bien gestionado.",
};

function setMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

interface PageMeta {
  /** Título único de la página (idealmente menos de 60 caracteres). */
  title: string;
  /** Descripción única (50–160 caracteres). */
  description: string;
  /** Ruta canónica de la página, por ejemplo "/pricing". */
  canonicalPath: string;
}

/**
 * Define título, descripción y canonical propios de cada ruta pública.
 * Al desmontar restaura los valores por defecto del sitio.
 */
export function usePageMeta({ title, description, canonicalPath }: PageMeta) {
  useEffect(() => {
    const url = `${SITE_URL}${canonicalPath}`;
    document.title = title;
    setMetaByName("description", description);
    setCanonical(url);
    setMetaByProperty("og:title", title);
    setMetaByProperty("og:description", description);
    setMetaByProperty("og:url", url);
    setMetaByName("twitter:title", title);
    setMetaByName("twitter:description", description);

    return () => {
      document.title = DEFAULTS.title;
      setMetaByName("description", DEFAULTS.description);
      setCanonical(SITE_URL + "/");
    };
  }, [title, description, canonicalPath]);
}
