// Guía para habilitar notificaciones bloqueadas, por plataforma y navegador.
//
// Solo sabemos que Notification.permission === "denied": puede venir de una
// elección anterior, de un bloqueo automático del navegador o de una política
// del dispositivo. Por eso los textos NUNCA atribuyen el bloqueo a la persona.
//
// Pasos verificados contra la ayuda oficial (ver HELP_SOURCES y
// docs/ayuda-notificaciones-bloqueadas.md). Si cambian los menús, actualizar
// ambos lugares. Los nombres de menú en español pueden variar un poco según
// la versión y el idioma del sistema.

export type HelpPlatform = "android" | "iphone" | "mac" | "windows";
export type HelpBrowser = "chrome" | "safari" | "other";

export interface DetectedPlatform {
  platform: HelpPlatform;
  browser: HelpBrowser;
}

export interface HelpSource {
  label: string;
  url: string;
}

/** Ilustración (diagrama) de un paso. NO es una captura de pantalla. */
export type StepIllustration =
  | { kind: "address-bar"; device: "desktop" | "phone"; panelTitle: string; rowLabel: string; value: string }
  | { kind: "settings"; device: "desktop" | "phone"; title: string; breadcrumb?: string; rows: { label: string; highlight?: boolean; control?: "toggle" | "chevron" | "allow" }[] }
  | { kind: "home-screen"; appLabel: string };

export interface HelpStep {
  title: string;
  detail?: string;
  /** Ruta de menú exacta, una etiqueta por nivel. */
  path?: string[];
  illustration?: StepIllustration;
}

export interface HelpSection {
  id: string;
  heading: string;
  intro?: string;
  steps: HelpStep[];
}

export interface HelpGuide {
  platform: HelpPlatform;
  browser: HelpBrowser;
  /** Requisitos previos (p. ej. iPhone: app en pantalla de inicio). */
  requirements?: string[];
  sections: HelpSection[];
  /** Último paso: volver a la página y activar con el botón. */
  finish: string;
  sources: HelpSource[];
}

export const HELP_SOURCES = {
  chromeDesktop: {
    label: "Google Chrome: usar notificaciones (computadora)",
    url: "https://support.google.com/chrome/answer/3220216?hl=es-419&co=GENIE.Platform%3DDesktop",
  },
  chromeAndroid: {
    label: "Google Chrome: usar notificaciones (Android)",
    url: "https://support.google.com/chrome/answer/3220216?hl=es-419&co=GENIE.Platform%3DAndroid",
  },
  chromeSitePermsDesktop: {
    label: "Google Chrome: permisos de un sitio (computadora)",
    url: "https://support.google.com/chrome/answer/114662?hl=es-419&co=GENIE.Platform%3DDesktop",
  },
  chromeSitePermsAndroid: {
    label: "Google Chrome: permisos de un sitio (Android)",
    url: "https://support.google.com/chrome/answer/114662?hl=es-419&co=GENIE.Platform%3DAndroid",
  },
  chromeAutoRevoke: {
    label: "Chromium: Chrome puede quitar el permiso de avisos automáticamente",
    url: "https://blog.chromium.org/2025/10/automatic-notification-permission.html",
  },
  androidNotifications: {
    label: "Android: controlar notificaciones",
    url: "https://support.google.com/android/answer/9079661?hl=es-419",
  },
  iphoneAppNotifications: {
    label: "Apple: activar o desactivar las notificaciones de una app (iPhone)",
    url: "https://support.apple.com/es-lamr/120681",
  },
  iphoneWebApp: {
    label: "Apple: convertir un sitio web en una app en Safari (iPhone)",
    url: "https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios",
  },
  iphoneWebPush: {
    label: "WebKit: notificaciones para apps web en iOS y iPadOS 16.4",
    url: "https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/",
  },
  iphoneFocus: {
    label: "Apple: permitir o silenciar notificaciones en un modo Concentración",
    url: "https://support.apple.com/guide/iphone/allow-or-silence-notifications-for-a-focus-iph21d43af5b/ios",
  },
  safariMac: {
    label: "Apple: notificaciones de sitios web en Safari (Mac)",
    url: "https://support.apple.com/guide/safari/customize-website-notifications-sfri40734/mac",
  },
  macNotifications: {
    label: "Apple: configuración de Notificaciones en la Mac",
    url: "https://support.apple.com/guide/mac-help/change-notifications-settings-on-mac-mchl205da693/mac",
  },
  windowsNotifications: {
    label: "Microsoft: notificaciones y No molestar en Windows",
    url: "https://support.microsoft.com/es-es/windows/experience/notifications-and-do-not-disturb-in-windows",
  },
} satisfies Record<string, HelpSource>;

export const PLATFORM_LABELS: Record<HelpPlatform, string> = {
  android: "Android",
  iphone: "iPhone / iPad",
  mac: "Mac",
  windows: "Windows",
};

export const BROWSER_LABELS: Record<HelpBrowser, string> = {
  chrome: "Chrome",
  safari: "Safari",
  other: "Otro navegador",
};

/** Navegadores que la guía distingue en cada plataforma (el primero es el por defecto). */
export const PLATFORM_BROWSERS: Record<HelpPlatform, HelpBrowser[]> = {
  android: ["chrome", "other"],
  iphone: ["safari"],
  mac: ["safari", "chrome", "other"],
  windows: ["chrome", "other"],
};

/** Por qué puede estar bloqueado, sin culpar a nadie. */
export const BLOCKED_REASONS =
  "Puede pasar por una elección anterior en este dispositivo, porque el navegador las bloqueó por su cuenta " +
  "(por ejemplo, si el sitio no se usó por un tiempo) o porque el dispositivo lo administra una organización.";

export interface DetectInput {
  userAgent: string;
  maxTouchPoints?: number;
}

/** Plataforma y navegador más probables. Es solo una sugerencia: la persona puede elegir otra. */
export function detectHelpPlatform({ userAgent: ua, maxTouchPoints = 0 }: DetectInput): DetectedPlatform {
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1); // iPad se presenta como Mac
  if (isIOS) return { platform: "iphone", browser: "safari" };
  if (/Android/.test(ua)) return { platform: "android", browser: /Chrome\//.test(ua) && !/SamsungBrowser|EdgA|OPR|Firefox/.test(ua) ? "chrome" : "other" };
  const isChrome = /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua);
  if (/Macintosh|Mac OS X/.test(ua)) {
    if (isChrome) return { platform: "mac", browser: "chrome" };
    if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Firefox\//.test(ua)) return { platform: "mac", browser: "safari" };
    return { platform: "mac", browser: "other" };
  }
  if (/Windows/.test(ua)) return { platform: "windows", browser: isChrome ? "chrome" : "other" };
  return { platform: "windows", browser: isChrome ? "chrome" : "other" };
}

/** El navegador elegido si esa plataforma lo admite; si no, el primero de la plataforma. */
export function normalizeBrowser(platform: HelpPlatform, browser: HelpBrowser): HelpBrowser {
  return PLATFORM_BROWSERS[platform].includes(browser) ? browser : PLATFORM_BROWSERS[platform][0];
}

const FINISH =
  "Volvé a esta página, recargala y tocá «Activar notificaciones». El navegador puede volver a preguntarte: elegí Permitir.";

// ── Pasos reutilizables ──

const chromeDesktopSite: HelpSection = {
  id: "chrome-site",
  heading: "1. Permití los avisos de este sitio en Chrome",
  steps: [
    {
      title: "Hacé clic en el ícono a la izquierda de la dirección",
      detail: "Es el botón «Ver información del sitio», al lado de la dirección de esta página.",
      illustration: { kind: "address-bar", device: "desktop", panelTitle: "Ver información del sitio", rowLabel: "Notificaciones", value: "toggle" },
    },
    {
      title: "Activá «Notificaciones»",
      detail: "Si no aparece ahí, entrá en «Configuración de sitios» y en Notificaciones elegí Permitir.",
    },
    {
      title: "¿No lo encontrás? Desde la configuración de Chrome",
      path: ["Más (⋮)", "Configuración", "Privacidad y seguridad", "Configuración de sitios", "Notificaciones"],
      detail: "Buscá este sitio en «No pueden enviar notificaciones» y cambialo a Permitir.",
    },
  ],
};

const chromeAndroidSite: HelpSection = {
  id: "chrome-site",
  heading: "1. Permití los avisos de este sitio en Chrome",
  steps: [
    {
      title: "Tocá el ícono a la izquierda de la dirección",
      detail: "Es el botón «Ver información del sitio».",
      illustration: { kind: "address-bar", device: "phone", panelTitle: "Permisos", rowLabel: "Notificaciones", value: "Permitir" },
    },
    {
      title: "Entrá en «Permisos» → «Notificaciones» y elegí permitir",
    },
    {
      title: "¿No lo encontrás? Desde la configuración de Chrome",
      path: ["Más (⋮)", "Configuración", "Configuración de sitios", "Notificaciones"],
      detail: "Buscá este sitio y cambialo a Permitir.",
    },
  ],
};

const androidSystem: HelpSection = {
  id: "android-system",
  heading: "2. Revisá que Android deje mostrar avisos de Chrome",
  intro: "Si Chrome ya permite el sitio pero no llegan avisos, puede estar apagado en el teléfono.",
  steps: [
    {
      title: "Abrí Configuración del teléfono",
      path: ["Configuración", "Notificaciones", "Notificaciones de apps", "Chrome"],
      detail: "Los nombres pueden variar un poco según la marca del teléfono.",
      illustration: {
        kind: "settings", device: "phone", title: "Notificaciones de apps",
        rows: [{ label: "Calendario", control: "toggle" }, { label: "Chrome", control: "toggle", highlight: true }, { label: "Mensajes", control: "toggle" }],
      },
    },
    { title: "Activá las notificaciones de Chrome" },
  ],
};

function systemSectionMac(appLabel: string, detail?: string): HelpSection {
  return {
    id: "mac-system",
    heading: "2. Revisá que la Mac deje mostrar avisos",
    intro: "Aunque el navegador permita el sitio, macOS también tiene que permitirlo.",
    steps: [
      {
        title: "Abrí Configuración del Sistema",
        path: ["Menú Apple", "Configuración del Sistema", "Notificaciones", appLabel],
        detail,
        illustration: {
          kind: "settings", device: "desktop", title: "Notificaciones", breadcrumb: "Notificaciones de apps",
          rows: [{ label: "Calendario", control: "chevron" }, { label: appLabel, control: "chevron", highlight: true }, { label: "Mensajes", control: "chevron" }],
        },
      },
      { title: "Activá «Permitir notificaciones»" },
    ],
  };
}

const windowsSystem = (appName: string): HelpSection => ({
  id: "windows-system",
  heading: "2. Revisá que Windows deje mostrar avisos",
  intro: "Aunque el navegador permita el sitio, Windows también tiene que permitirlo.",
  steps: [
    {
      title: "Abrí la configuración de notificaciones",
      path: ["Inicio", "Configuración", "Sistema", "Notificaciones"],
      illustration: {
        kind: "settings", device: "desktop", title: "Sistema › Notificaciones", breadcrumb: "Notificaciones de aplicaciones y otros remitentes",
        rows: [{ label: "Calendario", control: "toggle" }, { label: appName, control: "toggle", highlight: true }, { label: "Correo", control: "toggle" }],
      },
    },
    { title: `En «Notificaciones de aplicaciones y otros remitentes», activá ${appName}` },
    { title: "Si tenés «No molestar» activado, los avisos no se muestran hasta que lo apagues" },
  ],
});

const otherBrowserSite: HelpSection = {
  id: "other-site",
  heading: "1. Permití los avisos de este sitio en tu navegador",
  steps: [
    {
      title: "Abrí la configuración de tu navegador",
      detail: "Buscá «Notificaciones» (suele estar en la configuración de sitios o de privacidad) y permití este sitio.",
    },
  ],
};

/** Guía completa para la plataforma y navegador elegidos. */
export function getBlockedGuide(platform: HelpPlatform, rawBrowser: HelpBrowser): HelpGuide {
  const browser = normalizeBrowser(platform, rawBrowser);

  if (platform === "iphone") {
    return {
      platform, browser,
      requirements: [
        "iPhone o iPad con iOS/iPadOS 16.4 o más nuevo.",
        "La app tiene que estar agregada a la pantalla de inicio y abierta desde su ícono: dentro de Safari o Chrome los avisos no están disponibles en iPhone.",
      ],
      sections: [
        {
          id: "iphone-install",
          heading: "1. Si todavía no la instalaste",
          steps: [
            {
              title: "En Safari, agregala a la pantalla de inicio",
              path: ["Compartir", "Agregar a inicio", "Agregar"],
              detail: "Según la versión, «Compartir» está en la barra de abajo o dentro del menú de la página. Si aparece «Abrir como app web», dejalo activado. Después abrila siempre desde el ícono.",
              illustration: { kind: "home-screen", appLabel: "Consultorio" },
            },
          ],
        },
        {
          id: "iphone-settings",
          heading: "2. Permití las notificaciones de la app",
          steps: [
            {
              title: "Abrí Configuración del iPhone",
              path: ["Configuración", "Apps", "(nombre de la app)", "Notificaciones"],
              detail: "Buscá la app con el nombre con el que aparece en tu pantalla de inicio. En iOS 17 o anterior: Configuración → Notificaciones → (la app).",
              illustration: {
                kind: "settings", device: "phone", title: "Notificaciones", breadcrumb: "(nombre de la app)",
                rows: [{ label: "Permitir notificaciones", control: "toggle", highlight: true }, { label: "Pantalla bloqueada", control: "chevron" }, { label: "Sonidos", control: "chevron" }],
              },
            },
            { title: "Activá «Permitir notificaciones»" },
            {
              title: "Si usás un modo Concentración (No molestar), revisá que permita esta app",
            },
          ],
        },
      ],
      finish: "Abrí la app desde su ícono en la pantalla de inicio y tocá «Activar notificaciones».",
      sources: [HELP_SOURCES.iphoneWebPush, HELP_SOURCES.iphoneWebApp, HELP_SOURCES.iphoneAppNotifications, HELP_SOURCES.iphoneFocus],
    };
  }

  if (platform === "android") {
    if (browser === "chrome") {
      return {
        platform, browser,
        sections: [chromeAndroidSite, androidSystem],
        finish: FINISH,
        sources: [HELP_SOURCES.chromeSitePermsAndroid, HELP_SOURCES.chromeAndroid, HELP_SOURCES.androidNotifications, HELP_SOURCES.chromeAutoRevoke],
      };
    }
    return {
      platform, browser,
      sections: [otherBrowserSite, { ...androidSystem, heading: "2. Revisá que Android deje mostrar avisos de tu navegador", steps: [
        { ...androidSystem.steps[0], path: ["Configuración", "Notificaciones", "Notificaciones de apps", "(tu navegador)"] },
        { title: "Activá las notificaciones de tu navegador" },
      ] }],
      finish: FINISH,
      sources: [HELP_SOURCES.androidNotifications],
    };
  }

  if (platform === "mac") {
    if (browser === "safari") {
      return {
        platform, browser,
        sections: [
          {
            id: "safari-site",
            heading: "1. Permití los avisos de este sitio en Safari",
            steps: [
              {
                title: "Abrí la configuración de Safari",
                path: ["Safari", "Configuración", "Sitios web", "Notificaciones"],
                illustration: {
                  kind: "settings", device: "desktop", title: "Sitios web › Notificaciones",
                  rows: [{ label: "otro-sitio.com", control: "allow" }, { label: "Este sitio", control: "allow", highlight: true }],
                },
              },
              { title: "Buscá este sitio en la lista y elegí «Permitir»" },
            ],
          },
          systemSectionMac("(este sitio)", "En «Notificaciones de apps», los sitios de Safari aparecen con su propio nombre."),
        ],
        finish: FINISH,
        sources: [HELP_SOURCES.safariMac, HELP_SOURCES.macNotifications],
      };
    }
    if (browser === "chrome") {
      return {
        platform, browser,
        sections: [chromeDesktopSite, systemSectionMac("Google Chrome")],
        finish: FINISH,
        sources: [HELP_SOURCES.chromeSitePermsDesktop, HELP_SOURCES.chromeDesktop, HELP_SOURCES.macNotifications, HELP_SOURCES.chromeAutoRevoke],
      };
    }
    return {
      platform, browser,
      sections: [otherBrowserSite, systemSectionMac("(tu navegador)")],
      finish: FINISH,
      sources: [HELP_SOURCES.macNotifications],
    };
  }

  // Windows
  if (browser === "chrome") {
    return {
      platform, browser,
      sections: [chromeDesktopSite, windowsSystem("Google Chrome")],
      finish: FINISH,
      sources: [HELP_SOURCES.chromeSitePermsDesktop, HELP_SOURCES.chromeDesktop, HELP_SOURCES.windowsNotifications, HELP_SOURCES.chromeAutoRevoke],
    };
  }
  return {
    platform, browser,
    sections: [otherBrowserSite, windowsSystem("(tu navegador)")],
    finish: FINISH,
    sources: [HELP_SOURCES.windowsNotifications],
  };
}
