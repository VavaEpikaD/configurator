export const locales = ["en", "ro", "de"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export const localeOrigins: Record<Locale, string> = {
  en: "https://www.360configurator.com",
  ro: "https://www.360configurator.ro",
  de: "https://www.360konfigurator.de",
};

export const configuratorPublicPaths = {
  en: {
    pergola: "/pergola-configurator/",
    roof: "/roof-configurator/",
    window: "/window-configurator/",
    hall: "/hall-configurator/",
    solar: "/solar-configurator/",
    fence: "/fence-configurator/",
    cardbox: "/cardbox-configurator/",
  },
  ro: {
    pergola: "/configurator-pergola/",
    roof: "/configurator-acoperis/",
    window: "/configurator-ferestre/",
    hall: "/configurator-hala/",
    solar: "/configurator-solar/",
    fence: "/configurator-garduri/",
    cardbox: "/configurator-cutii-carton/",
  },
  de: {
    pergola: "/pergola-konfigurator/",
    roof: "/dach-konfigurator/",
    window: "/fenster-konfigurator/",
    hall: "/hallen-konfigurator/",
    solar: "/solar-konfigurator/",
    fence: "/zaun-konfigurator/",
    cardbox: "/karton-konfigurator/",
  },
} as const;

export type ConfiguratorRouteSlug = keyof typeof configuratorPublicPaths.en;

// Localized pages are stored below /ro and /de by the static build, but the
// public URL space is domain-based. Links therefore never expose /ro or /de.
export function localizedPath(_locale: Locale, path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized || "/";
}

export function localizedUrl(locale: Locale, path = "/") {
  return `${localeOrigins[locale]}${localizedPath(locale, path)}`;
}

export function configuratorPath(locale: Locale, slug: ConfiguratorRouteSlug) {
  return configuratorPublicPaths[locale][slug];
}

export function configuratorUrl(locale: Locale, slug: ConfiguratorRouteSlug) {
  return `${localeOrigins[locale]}${configuratorPath(locale, slug)}`;
}

export function localeFromHostname(hostname: string): Locale {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized === "360configurator.ro" || normalized === "www.360configurator.ro") return "ro";
  if (normalized === "360konfigurator.de" || normalized === "www.360konfigurator.de") return "de";
  return "en";
}

export function contactEmail(locale: Locale) {
  return locale === "ro" ? "office@360configurator.ro" : "office@360configurator.com";
}

export const contactPhone = Object.freeze({
  display: "0744 142 357",
  international: "+40744142357",
});

export const uiCopy = {
  en: {
    language: "Language", home: "Home", configurators: "Configurators", pricing: "Pricing", about: "About us", contact: "Contact us",
    start: "Start a project", deployed: "Deployed systems", live: "Live", more: "More systems are currently in development.",
    footerLine: "Spatial product configuration for complex industrial products.", contactLabel: "Contact",
    begin: "Begin a project", location: "Bucharest · Romania", render: "Render systems online",
    launch: "Launch full configurator", preview: "Live spatial preview", explore: "Explore 3D", release: "Release scroll",
    loading: "Loading native B2-6 system", controls: "Controls +", hide: "Hide −",
  },
  ro: {
    language: "Limbă", home: "Acasă", configurators: "Configuratoare", pricing: "Prețuri", about: "Despre noi", contact: "Contact",
    start: "Începe un proiect", deployed: "Configuratoare realizate", live: "Deschide", more: "Alte configuratoare sunt în curs de dezvoltare.",
    footerLine: "Configuratoare 3D pentru produse industriale complexe.", contactLabel: "Contact",
    begin: "Pornește un proiect", location: "București · România", render: "Sisteme de randare online",
    launch: "Deschide configuratorul complet", preview: "Previzualizare 3D interactivă", explore: "Explorează modelul 3D", release: "Revino la pagină",
    loading: "Se încarcă sistemul nativ B2-6", controls: "Comenzi +", hide: "Ascunde −",
  },
  de: {
    language: "Sprache", home: "Startseite", configurators: "Konfiguratoren", pricing: "Preise", about: "Über uns", contact: "Kontakt",
    start: "Projekt starten", deployed: "Realisierte Systeme", live: "Live", more: "Weitere Systeme befinden sich in Entwicklung.",
    footerLine: "Räumliche Produktkonfiguration für komplexe Industrieprodukte.", contactLabel: "Kontakt",
    begin: "Projekt anfragen", location: "Bukarest · Rumänien", render: "Render-Systeme online",
    launch: "Vollständigen Konfigurator öffnen", preview: "Räumliche Live-Vorschau", explore: "3D erkunden", release: "Scrollen freigeben",
    loading: "Natives B2-6-System wird geladen", controls: "Steuerung +", hide: "Ausblenden −",
  },
} as const;

export const homeCopy = {
  en: {
    heroLabel: "01 / Spatial product infrastructure", heroA: "Complex products.", heroB: "Made self-evident.",
    heroCopy: "We transform industrial product logic into spatial systems people can see, configure, price and understand in real time.",
    explore: "Explore live systems", stage2: "Stage 02 / CAD resolution", breakA: "Break the object.", breakB: "Reveal the system.",
    breakCopy: "Geometry separates into glazing, profiles, seals and thermal layers—turning a finished product into legible engineering.",
    stage3: "Stage 03 / Material intelligence", surfaceA: "Every surface", surfaceB: "carries a decision.",
    surfaceCopy: "Interior and exterior finishes, dimensional constraints and product behavior remain synchronized as one configuration state.",
    scroll: "Scroll to resolve", thesis: "03 / Platform thesis", thesisA: "One product state.", thesisB: "Every decision connected.",
    thesisCopy: "A 360Configurator deployment combines an interactive 3D product, its engineering constraints, its commercial rules and its downstream outputs. One state—from first exploration to qualified quote.",
    spatial: "Spatial interface", resolved: "Resolved output", connected: "System connection",
    systems: "04 / Deployed systems", systemsA: "Live systems.", systemsB: "An expanding field of possibilities.",
    systemsCopy: "Explore the deployments available today—part of a platform designed to grow across products, industries and new forms of complexity.",
    customLabel: "06 / Custom system", customA: "Your product could be", customB: "the next system.", customStatement: "Begin with the product you already manufacture—not a software template.", customCopy: "We map its geometry, options, compatibility rules, pricing and outputs into a configuration system engineered for the way your business actually works.", customStatus: "Product logic intake", customSignal: "CAD + rules + commercial model", customCta: "Discuss your product", customPricing: "See the Custom System path", customViewport: "Configuration blueprint", customFeatures: [["Product data", "CAD", "Existing CAD, drawings, component records and product knowledge become the technical source for the system, preserving the manufacturing reality that already defines your commercial product."], ["Geometry", "Geometry", "Dimensions, assemblies, connection logic and valid spatial relationships define what the configured product can become, ensuring visual changes remain credible as a physical manufactured result."], ["Rules", "Rules", "Compatibility constraints, dependencies and required selections prevent users from creating invalid product states while explaining which decisions remain available at every point in the configuration."], ["Commercial", "Price", "Price logic, BOM structure, margins and lead qualification remain connected to every visual decision, turning a configured product into a commercially usable and traceable project state."], ["Workflow", "Flow", "The interface follows the real decision sequence used by customers, sales and technical teams, reducing interpretation gaps between initial exploration, qualification, engineering review and final handover."], ["Integration", "API", "Qualified configurations can connect with CRM, ERP, commerce, product-data and downstream production systems, keeping selected options and project context available beyond the visual configuration experience."]],
    interactive: "Interactive system", viewCase: "View full case", launch: "Launch full configurator",
    pipeline: "05 / Visual CPQ pipeline", pipelineA: "From interaction.", pipelineB: "To commercial resolution.",
    processLabel: "06 / Deployment path", processA: "From product rules", processB: "to a living interface.",
    ctaLabel: "Build the impossible product interface", ctaA: "Make complexity", ctaB: "feel inevitable.",
    ctaCopy: "Bring us the product that is too configurable, too technical or too difficult to explain. That is where spatial systems become valuable.",
    start: "Start a project",
    capabilities: [
      ["Configure", "A browser-native spatial interface governed by the product’s real dimensions, dependencies and compatibility rules."],
      ["Price", "Every visual selection enters the commercial model immediately—without a spreadsheet handoff between customer and sales."],
      ["Resolve", "Approved geometry becomes a precise BOM and a component-level state that downstream teams can actually use."],
      ["Quote", "The configured product moves forward as a clear, customer-ready commercial record for connected business systems."],
    ],
    steps: [["Decode", "Products, geometry, dependencies and commercial intent."], ["Engineer", "Parametric logic, assets, pricing and production resolution."], ["Deploy", "A spatial configurator integrated into the systems you already use."]],
  },
  ro: {
    heroLabel: "01 / Configuratoare 3D pentru produse", heroA: "Produse complexe.", heroB: "Decizii mai clare.",
    heroCopy: "Transformăm regulile produselor industriale în configuratoare 3D pe care clienții și echipele tale le pot folosi direct în browser.",
    explore: "Vezi configuratoarele", stage2: "Etapa 02 / Detaliere CAD", breakA: "Vezi fiecare componentă.", breakB: "Înțelege întregul ansamblu.",
    breakCopy: "Separăm vitrajul, profilele, garniturile și straturile termice, astfel încât construcția produsului finit să fie ușor de înțeles.",
    stage3: "Etapa 03 / Materiale și finisaje", surfaceA: "Fiecare finisaj", surfaceB: "schimbă produsul.",
    surfaceCopy: "Finisajele interioare și exterioare, constrângerile dimensionale și comportamentul produsului rămân sincronizate într-o singură configurație.",
    scroll: "Derulează pentru detalii", thesis: "03 / Cum funcționează platforma", thesisA: "O singură configurație.", thesisB: "Fiecare decizie conectată.",
    thesisCopy: "360Configurator păstrează împreună modelul 3D, regulile tehnice, calculul comercial și datele necesare mai departe, de la prima variantă până la cererea de ofertă.",
    spatial: "Configurare 3D", resolved: "Date structurate", connected: "Integrări",
    systems: "04 / Configuratoare realizate", systemsA: "Configuratoare disponibile.", systemsB: "Mai multe produse, aceeași platformă.",
    systemsCopy: "Explorează configuratoarele disponibile și vezi cum aceeași platformă se adaptează unor produse, industrii și reguli diferite.",
    customLabel: "06 / Configurator personalizat", customA: "Produsul tău poate avea", customB: "propriul configurator.", customStatement: "Pornim de la produsul pe care îl fabrici deja și de la procesul real de vânzare.", customCopy: "Transformăm geometria, opțiunile, regulile de compatibilitate și calculul de preț într-un configurator adaptat companiei tale.", customStatus: "Analiza regulilor produsului", customSignal: "CAD + reguli + calcul comercial", customCta: "Discută despre produs", customPricing: "Vezi opțiunea Configurator personalizat", customViewport: "Structura configuratorului", customFeatures: [["Date de produs", "CAD", "Folosim desenele, modelele CAD, listele de componente și cunoștințele echipei tale ca bază tehnică pentru configurator."], ["Geometrie", "Geometrie", "Dimensiunile, ansamblurile și conexiunile stabilesc variantele care pot fi configurate și fabricate."], ["Reguli", "Reguli", "Regulile de compatibilitate și selecțiile obligatorii împiedică variantele imposibile și arată ce opțiuni rămân disponibile."], ["Comercial", "Preț", "Prețul, lista de materiale, marjele și datele solicitării rămân legate de fiecare alegere făcută în model."], ["Flux", "Flux", "Interfața urmează pașii reali folosiți de clienți, vânzări și echipele tehnice, de la alegerea variantei până la predare."], ["Integrare", "API", "Configurațiile pot fi trimise către CRM, ERP, platforme de comerț electronic sau sisteme de producție prin integrările disponibile."]],
    interactive: "Sistem interactiv", viewCase: "Vezi studiul complet", launch: "Deschide configuratorul complet",
    pipeline: "05 / Flux CPQ vizual", pipelineA: "De la interacțiune.", pipelineB: "La rezultat comercial.",
    processLabel: "06 / Procesul de implementare", processA: "De la regulile produsului", processB: "la un configurator funcțional.",
    ctaLabel: "Pentru produse care nu încap într-un formular", ctaA: "Transformă alegerile complexe", ctaB: "într-un proces clar.",
    ctaCopy: "Arată-ne produsul, variantele și regulile sale. Îți propunem un configurator pe care clienții îl pot înțelege și echipa ta îl poate folosi.",
    start: "Începe un proiect",
    capabilities: [
      ["Configurează", "Clientul lucrează direct în browser, în limitele dimensionale și regulile reale de compatibilitate ale produsului."],
      ["Calculează", "Fiecare alegere din model actualizează calculul comercial, fără transfer manual între client, vânzări și foi de calcul."],
      ["Generează", "Configurația aprobată produce lista de materiale și datele de care au nevoie echipele de ofertare, producție și montaj."],
      ["Pregătește oferta", "Produsul configurat devine o cerere clară, pregătită pentru client și pentru sistemele companiei."],
    ],
    steps: [["Analizăm", "Produsul, geometria, dependențele și obiectivele comerciale."], ["Construim", "Logica parametrică, modelele 3D, prețurile și rezultatele tehnice."], ["Implementăm", "Un configurator 3D conectat la sistemele pe care le folosești deja."]],
  },
  de: {
    heroLabel: "01 / Räumliche Produktinfrastruktur", heroA: "Komplexe Produkte.", heroB: "Unmittelbar verständlich.",
    heroCopy: "Wir übersetzen industrielle Produktlogik in räumliche Systeme, die Menschen in Echtzeit sehen, konfigurieren, kalkulieren und verstehen können.",
    explore: "Live-Systeme entdecken", stage2: "Phase 02 / CAD-Auflösung", breakA: "Das Objekt zerlegen.", breakB: "Das System verstehen.",
    breakCopy: "Geometrie trennt sich in Verglasung, Profile, Dichtungen und thermische Ebenen—und macht die Technik im fertigen Produkt lesbar.",
    stage3: "Phase 03 / Materialintelligenz", surfaceA: "Jede Oberfläche", surfaceB: "trägt eine Entscheidung.",
    surfaceCopy: "Innen- und Außenoberflächen, Maßvorgaben und Produktverhalten bleiben in einem einzigen Konfigurationszustand synchron.",
    scroll: "Scrollen, um aufzulösen", thesis: "03 / Plattformprinzip", thesisA: "Ein Produktzustand.", thesisB: "Jede Entscheidung verknüpft.",
    thesisCopy: "Eine 360Configurator-Implementierung verbindet das interaktive 3D-Produkt, technische Vorgaben, kaufmännische Regeln und nachgelagerte Ergebnisse. Ein Zustand—von der ersten Exploration bis zum qualifizierten Angebot.",
    spatial: "Räumliche Oberfläche", resolved: "Strukturiertes Ergebnis", connected: "Systemanbindung",
    systems: "04 / Realisierte Systeme", systemsA: "Live-Systeme.", systemsB: "Ein wachsendes Feld von Möglichkeiten.",
    systemsCopy: "Entdecken Sie die heute verfügbaren Implementierungen—Teil einer Plattform, die mit Produkten, Branchen und neuen Formen von Komplexität wächst.",
    customLabel: "06 / Individuelles System", customA: "Ihr Produkt kann", customB: "das nächste System werden.", customStatement: "Wir beginnen mit dem Produkt, das Sie bereits fertigen—nicht mit einer Softwarevorlage.", customCopy: "Wir übersetzen Geometrie, Optionen, Kompatibilitätsregeln, Kalkulation und Ausgaben in ein Konfigurationssystem, das für Ihre tatsächlichen Geschäftsabläufe entwickelt ist.", customStatus: "Aufnahme der Produktlogik", customSignal: "CAD + Regeln + kaufmännisches Modell", customCta: "Produkt besprechen", customPricing: "Zum individuellen Implementierungsweg", customViewport: "Konfigurationsarchitektur", customFeatures: [["Produktdaten", "CAD", "CAD-Daten, Zeichnungen, Komponentenverzeichnisse und Produktwissen bilden die technische Quelle des Systems und bewahren die Fertigungsrealität, die Ihr bestehendes kommerzielles Produkt bereits definiert."], ["Geometrie", "Geometrie", "Maße, Baugruppen, Verbindungslogik und gültige räumliche Beziehungen definieren das konfigurierbare Produkt, damit jede visuelle Änderung als physisch herstellbares Ergebnis glaubwürdig bleibt."], ["Regeln", "Regeln", "Kompatibilitätsvorgaben, Abhängigkeiten und erforderliche Auswahlen verhindern ungültige Produktzustände und erklären, welche Entscheidungen an jedem Punkt der Konfiguration weiterhin möglich sind."], ["Kaufmännisch", "Preis", "Preislogik, Stücklistenstruktur, Margen und Lead-Qualifizierung bleiben mit jeder visuellen Entscheidung verbunden und verwandeln die Konfiguration in einen nutzbaren, nachvollziehbaren Projektzustand."], ["Workflow", "Ablauf", "Die Oberfläche folgt der realen Entscheidungsfolge von Kunden, Vertrieb und technischen Teams und reduziert Interpretationslücken zwischen Erkundung, Qualifizierung, technischer Prüfung und Übergabe."], ["Integration", "API", "Qualifizierte Konfigurationen lassen sich mit CRM, ERP, Commerce, Produktdaten und Produktion verbinden, damit gewählte Optionen und Projektkontext über die visuelle Erfahrung hinaus verfügbar bleiben."]],
    interactive: "Interaktives System", viewCase: "Gesamten Case ansehen", launch: "Vollständigen Konfigurator öffnen",
    pipeline: "05 / Visuelle CPQ-Pipeline", pipelineA: "Von der Interaktion.", pipelineB: "Zur kommerziellen Lösung.",
    processLabel: "06 / Implementierungsweg", processA: "Von Produktregeln", processB: "zu einer lebendigen Oberfläche.",
    ctaLabel: "Die Oberfläche für das scheinbar unmögliche Produkt", ctaA: "Komplexität so gestalten,", ctaB: "dass sie selbstverständlich wirkt.",
    ctaCopy: "Bringen Sie uns das Produkt, das zu variantenreich, zu technisch oder zu schwer zu erklären scheint. Genau dort entfalten räumliche Systeme ihren Wert.",
    start: "Projekt starten",
    capabilities: [
      ["Konfigurieren", "Eine browsernative räumliche Oberfläche, gesteuert durch reale Maße, Abhängigkeiten und Kompatibilitätsregeln des Produkts."],
      ["Kalkulieren", "Jede visuelle Auswahl fließt unmittelbar in das kaufmännische Modell ein—ohne Medienbruch zwischen Kunde und Vertrieb."],
      ["Auflösen", "Freigegebene Geometrie wird zu einer präzisen Stückliste und einem komponentengenauen Zustand für nachgelagerte Teams."],
      ["Angebot", "Das konfigurierte Produkt wird zu einem klaren, kundenfähigen kaufmännischen Datensatz für angebundene Geschäftssysteme."],
    ],
    steps: [["Erfassen", "Produkt, Geometrie, Abhängigkeiten und kaufmännische Zielsetzung."], ["Entwickeln", "Parametrische Logik, 3D-Assets, Preisregeln und technische Auflösung."], ["Integrieren", "Ein räumlicher Konfigurator, eingebunden in Ihre bestehenden Systeme."]],
  },
} as const;

export const detailCopy = {
  en: { overview: "System overview", capabilities: "Capabilities / 06", resolves: "What the system resolves.", state: "Resolved state", outputA: "From visual decision", outputB: "to usable output.", deployment: "Full deployment", exploreA: "Explore every rule.", exploreB: "Configure the real system.", open: "Open live configurator", continue: "Continue exploring" },
  ro: { overview: "Prezentarea configuratorului", capabilities: "Funcții / 06", resolves: "Ce poți face.", state: "Configurație completă", outputA: "De la alegerea vizuală", outputB: "la date gata de folosit.", deployment: "Implementare completă", exploreA: "Vezi fiecare regulă.", exploreB: "Configurează produsul real.", open: "Deschide configuratorul", continue: "Vezi celelalte funcții" },
  de: { overview: "Systemüberblick", capabilities: "Funktionen / 06", resolves: "Was das System auflöst.", state: "Aufgelöster Zustand", outputA: "Von der visuellen Entscheidung", outputB: "zum nutzbaren Ergebnis.", deployment: "Vollständige Implementierung", exploreA: "Jede Regel entdecken.", exploreB: "Das reale System konfigurieren.", open: "Live-Konfigurator öffnen", continue: "Weiter entdecken" },
} as const;
