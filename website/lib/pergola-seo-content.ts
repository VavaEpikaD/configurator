import type { Locale } from "./i18n";

export type ConfiguratorSeoContent = {
  intro: {
    label: string;
    heading: string;
    body: string;
    launch: string;
    learn: string;
  };
  workflow: {
    label: string;
    heading: string;
    intro: string;
    steps: { title: string; body: string }[];
  };
  decisions: {
    label: string;
    heading: string;
    intro: string;
    groups: { title: string; body: string; items: string[] }[];
  };
  outcomes: {
    label: string;
    heading: string;
    body: string;
    items: { title: string; body: string }[];
  };
  faq: {
    label: string;
    heading: string;
    items: { question: string; answer: string }[];
  };
  finalCta: {
    eyebrow: string;
    heading: string;
    body: string;
    launch: string;
    contact: string;
  };
};

export const pergolaSeoContent: Record<Locale, ConfiguratorSeoContent> = {
  en: {
    intro: {
      label: "3D pergola planning",
      heading: "Configure the pergola before the quote.",
      body: "The 360Configurator pergola tool starts from a parametric structure rather than a static product image. Choose a freestanding or wall-mounted installation, set the main dimensions, then configure the louvers, each side enclosure and the comfort accessories. The 3D model and estimated price respond as the configuration changes, so the product can be understood before a quote is requested.",
      launch: "Open the 3D pergola configurator",
      learn: "See how it works",
    },
    workflow: {
      label: "How it works",
      heading: "From dimensions to a configured pergola in five steps.",
      intro: "The workflow follows the same decisions that shape the physical product. Each change remains visible in the same spatial model instead of being split across separate forms, drawings and price sheets.",
      steps: [
        { title: "Choose installation and dimensions", body: "Start with a freestanding or wall-mounted pergola, then set width, depth and height within the available configuration limits." },
        { title: "Configure the louvered roof", body: "Set the louver orientation and tilt, then use sun position, north direction and the night preview to understand shade and light conditions." },
        { title: "Resolve every side independently", body: "Keep a side open or add a pull-down screen, motorized screen, privacy element or frameless sliding glass. Each edge of the pergola can be configured separately." },
        { title: "Add lighting, heat and weather sensing", body: "Configure perimeter LED lighting, integrated spotlights, infrared heaters and rain or wind sensors directly on the pergola model." },
        { title: "Review the commercial result", body: "Check the estimated price breakdown and configuration summary, then continue to the quote workflow with the selected geometry and options still synchronized." },
      ],
    },
    decisions: {
      label: "Configuration decisions",
      heading: "Test the choices that actually change the finished pergola.",
      intro: "The configurator is built to make product decisions visible. It is useful when several options interact and a flat catalogue image is no longer enough to explain the result.",
      groups: [
        { title: "Geometry & installation", body: "Establish the overall architectural footprint before accessories are added.", items: ["Freestanding or wall-mounted installation", "Width, depth and overall height", "Louver direction and roof orientation", "Visible dimensions in the 3D scene"] },
        { title: "Light & environment", body: "Evaluate the pergola as lighting conditions change rather than in one fixed render.", items: ["Louver tilt", "Sun-position control", "North-direction control and compass", "Day/night preview and integrated lighting"] },
        { title: "Sides & privacy", body: "Treat each elevation as its own configurable zone.", items: ["Open side", "Pull-down screen", "Motorized screen", "Privacy element", "Frameless sliding glass"] },
        { title: "Comfort & commercial options", body: "Add the options that affect use, automation and the estimated total.", items: ["Perimeter LED lighting", "Integrated spotlights", "Infrared heaters", "Rain and wind sensors", "Estimated price and quote summary"] },
      ],
    },
    outcomes: {
      label: "Why configure in 3D",
      heading: "A better decision before fabrication or installation.",
      body: "A pergola is not a single visual choice. Dimensions, louver behavior, side closures and accessories affect one another. Keeping those choices in one interactive model makes the proposal easier to review and reduces the gap between what is discussed and what is ultimately selected.",
      items: [
        { title: "For the buyer", body: "Compare configurations visually and understand what each option changes before committing to a final proposal." },
        { title: "For sales teams", body: "Keep geometry, visible options and the estimated commercial state aligned during the same conversation." },
        { title: "For configurable-product businesses", body: "Use one browser-based product state as the starting point for a more connected quotation and downstream workflow." },
      ],
    },
    faq: {
      label: "Pergola configurator FAQ",
      heading: "Common questions about the 3D pergola configurator.",
      items: [
        { question: "Can I configure both freestanding and wall-mounted pergolas?", answer: "Yes. The configurator includes both freestanding and wall-mounted installation modes, and the supporting geometry updates according to the selected condition." },
        { question: "Can I change the pergola dimensions?", answer: "Yes. Width, depth and height are configurable, and the parametric structure rebuilds as those dimensions change." },
        { question: "Can I test the louvers, sunlight and night lighting?", answer: "Yes. You can change louver orientation and tilt, adjust sun position and north direction, show the compass and switch to a night preview to inspect the lighting setup." },
        { question: "Which side closures are available?", answer: "Each side can remain open or use a pull-down screen, motorized screen, privacy element or frameless sliding-glass solution, depending on the configuration." },
        { question: "Can I add lighting, heaters and weather sensors?", answer: "Yes. The current configurator supports perimeter LED lighting, integrated spotlights, infrared heaters, and rain and wind sensors positioned on the pergola." },
        { question: "Does the pergola configurator calculate a price?", answer: "It provides an estimated price and breakdown that update with the configured dimensions and options. The summary can then be used as the basis for the quote workflow." },
        { question: "Do I need to install software?", answer: "No. The configurator runs in a modern web browser and uses WebGL for the interactive 3D view." },
      ],
    },
    finalCta: {
      eyebrow: "Try the actual product",
      heading: "Build a pergola configuration in the browser.",
      body: "Open the live configurator to test the geometry, louvers, side closures, lighting and accessories yourself, or contact us if you need a similar configurator for your own product system.",
      launch: "Launch pergola configurator",
      contact: "Discuss a configurator project",
    },
  },
  ro: {
    intro: {
      label: "Proiectare pergolă 3D",
      heading: "Configurează pergola înainte de ofertă.",
      body: "Configuratorul de pergole 3D 360Configurator pornește de la o structură parametrică, nu de la o imagine statică. Alegi montajul independent sau la perete, setezi dimensiunile principale, apoi configurezi lamelele, fiecare închidere laterală și accesoriile de confort. Modelul 3D și prețul estimativ se actualizează pe măsură ce schimbi configurația, astfel încât produsul poate fi înțeles înainte de solicitarea ofertei.",
      launch: "Deschide configuratorul de pergole 3D",
      learn: "Vezi cum funcționează",
    },
    workflow: {
      label: "Cum funcționează",
      heading: "De la dimensiuni la o pergolă configurată în cinci pași.",
      intro: "Fluxul urmărește deciziile care definesc produsul fizic. Fiecare modificare rămâne vizibilă în același model 3D, fără să fie împărțită între formulare, schițe și calcule separate.",
      steps: [
        { title: "Alege montajul și dimensiunile", body: "Pornește cu o pergolă autoportantă sau montată la perete, apoi stabilește lățimea, adâncimea și înălțimea în limitele disponibile." },
        { title: "Configurează acoperișul cu lamele", body: "Alege orientarea și înclinarea lamelelor, apoi folosește poziția soarelui, direcția nordului și previzualizarea de noapte pentru a înțelege umbra și lumina." },
        { title: "Configurează separat fiecare segment", body: "Lasă segmentul deschis sau adaugă un rulou manual, un rulou ZIP motorizat, un perete cu lamele ori panouri glisante din sticlă." },
        { title: "Adaugă iluminat, încălzire și senzori", body: "Configurează LED-ul perimetral, spoturile integrate, încălzitoarele cu infraroșu și senzorii de ploaie sau vânt direct pe modelul pergolei." },
        { title: "Verifică rezultatul comercial", body: "Vezi estimarea de preț, detalierea costurilor și rezumatul configurației, apoi continuă către ofertare fără să pierzi geometria și opțiunile alese." },
      ],
    },
    decisions: {
      label: "Ce poți configura",
      heading: "Testează deciziile care schimbă efectiv pergola finală.",
      intro: "Configuratorul face vizibile opțiunile care se influențează reciproc. Este util atunci când o simplă fotografie de catalog nu mai poate explica suficient diferența dintre două configurații.",
      groups: [
        { title: "Geometrie și montaj", body: "Stabilește forma pergolei înainte de a adăuga accesoriile.", items: ["Montaj autoportant sau la perete", "Lățime, adâncime și înălțime", "Direcția lamelelor și orientarea acoperișului", "Afișarea dimensiunilor în modelul 3D"] },
        { title: "Lumină și orientare", body: "Evaluează pergola în condiții diferite de lumină, nu într-un singur rand static.", items: ["Unghiul lamelelor", "Poziția soarelui", "Direcția nordului și busola", "Previzualizare zi/noapte și iluminat integrat"] },
        { title: "Închideri laterale", body: "Configurează independent fiecare segment al pergolei.", items: ["Latură deschisă", "Rulou textil manual", "Rulou ZIP motorizat", "Perete cu lamele", "Panouri glisante din sticlă"] },
        { title: "Confort și opțiuni comerciale", body: "Adaugă elementele care influențează utilizarea, automatizarea și totalul estimativ.", items: ["LED perimetral", "Spoturi integrate", "Încălzitoare cu infraroșu", "Senzori de ploaie și vânt", "Preț estimativ și rezumat de ofertă"] },
      ],
    },
    outcomes: {
      label: "De ce configurare 3D",
      heading: "O decizie mai clară înainte de fabricație sau montaj.",
      body: "O pergolă nu înseamnă o singură alegere vizuală. Dimensiunile, comportamentul lamelelor, închiderile laterale și accesoriile se influențează reciproc. Păstrarea lor într-un singur model interactiv face propunerea mai ușor de verificat și reduce diferența dintre ceea ce se discută și ceea ce se selectează în final.",
      items: [
        { title: "Pentru client", body: "Compară vizual configurații și înțelege ce schimbă fiecare opțiune înainte de alegerea variantei finale." },
        { title: "Pentru echipa de vânzări", body: "Păstrează geometria, opțiunile vizibile și estimarea comercială sincronizate în aceeași discuție." },
        { title: "Pentru producători și distribuitori", body: "Folosește configurația din browser ca punct de pornire pentru ofertare și procesarea comenzii." },
      ],
    },
    faq: {
      label: "Întrebări despre configurator",
      heading: "Întrebări frecvente despre configuratorul de pergole 3D.",
      items: [
        { question: "Pot configura atât o pergolă autoportantă, cât și una montată la perete?", answer: "Da. Configuratorul include montaj autoportant și montaj la perete, iar structura de susținere se adaptează opțiunii alese." },
        { question: "Pot modifica dimensiunile pergolei?", answer: "Da. Lățimea, adâncimea și înălțimea sunt configurabile, iar structura parametrică se reconstruiește pe măsură ce dimensiunile se schimbă." },
        { question: "Pot testa lamelele, poziția soarelui și iluminatul de noapte?", answer: "Da. Poți schimba orientarea și unghiul lamelelor, poziția soarelui și direcția nordului, poți afișa busola și poți activa previzualizarea de noapte pentru a verifica iluminatul." },
        { question: "Ce tipuri de închideri laterale pot adăuga?", answer: "Fiecare segment poate rămâne deschis sau poate avea rulou textil manual, rulou ZIP motorizat, perete cu lamele ori panouri glisante din sticlă." },
        { question: "Pot adăuga iluminat, încălzitoare și senzori meteo?", answer: "Da. Configuratorul actual permite LED perimetral, spoturi integrate, încălzitoare cu infraroșu și senzori de ploaie și vânt poziționați pe pergolă." },
        { question: "Configuratorul de pergole calculează și prețul?", answer: "Da, afișează un preț estimativ și o detaliere care se actualizează în funcție de dimensiuni și opțiuni. Rezumatul poate fi apoi folosit ca bază pentru fluxul de ofertare." },
        { question: "Trebuie să instalez un program pentru a folosi configuratorul?", answer: "Nu. Configuratorul rulează direct într-un browser modern și folosește WebGL pentru vizualizarea 3D interactivă." },
      ],
    },
    finalCta: {
      eyebrow: "Testează produsul real",
      heading: "Construiește o configurație de pergolă direct în browser.",
      body: "Deschide configuratorul pentru a testa geometria, lamelele, închiderile laterale, iluminatul și accesoriile sau contactează-ne dacă ai nevoie de un configurator similar pentru propria gamă de produse.",
      launch: "Deschide configuratorul de pergole",
      contact: "Discută un proiect de configurator",
    },
  },
  de: {
    intro: {
      label: "3D Pergola-Planung",
      heading: "Konfigurieren Sie die Pergola vor dem Angebot.",
      body: "Der 3D Pergola-Konfigurator von 360Configurator basiert auf einer parametrischen Struktur statt auf einem statischen Produktbild. Wählen Sie freistehende oder wandmontierte Ausführung, legen Sie die Hauptmaße fest und konfigurieren Sie anschließend Lamellen, jede Seitenlösung und Komfortzubehör. 3D-Modell und geschätzter Preis reagieren auf die Änderungen, sodass das Produkt vor der Angebotsanfrage verständlich wird.",
      launch: "3D Pergola-Konfigurator öffnen",
      learn: "So funktioniert es",
    },
    workflow: {
      label: "So funktioniert es",
      heading: "In fünf Schritten von den Maßen zur konfigurierten Pergola.",
      intro: "Der Ablauf folgt den Entscheidungen, die das reale Produkt bestimmen. Jede Änderung bleibt im selben räumlichen Modell sichtbar, anstatt auf getrennte Formulare, Zeichnungen und Preislisten verteilt zu werden.",
      steps: [
        { title: "Montageart und Maße wählen", body: "Beginnen Sie mit einer freistehenden oder wandmontierten Pergola und legen Sie Breite, Tiefe und Höhe innerhalb der verfügbaren Konfigurationsgrenzen fest." },
        { title: "Lamellendach konfigurieren", body: "Bestimmen Sie Ausrichtung und Neigung der Lamellen und nutzen Sie Sonnenstand, Nordrichtung und Nachtansicht, um Licht und Verschattung zu beurteilen." },
        { title: "Jede Seite separat lösen", body: "Lassen Sie eine Seite offen oder ergänzen Sie Screen, motorisierten Screen, Sichtschutzelement oder rahmenlose Schiebeverglasung. Jede Pergolaseite kann unabhängig konfiguriert werden." },
        { title: "Licht, Wärme und Sensorik ergänzen", body: "Konfigurieren Sie umlaufende LED-Beleuchtung, integrierte Spots, Infrarotstrahler sowie Regen- oder Windsensoren direkt am Pergolamodell." },
        { title: "Kaufmännisches Ergebnis prüfen", body: "Prüfen Sie die geschätzte Preisaufstellung und die Konfigurationsübersicht und gehen Sie anschließend in den Angebotsprozess, ohne Geometrie und Optionen neu erfassen zu müssen." },
      ],
    },
    decisions: {
      label: "Konfigurierbare Entscheidungen",
      heading: "Testen Sie die Optionen, die die fertige Pergola wirklich verändern.",
      intro: "Der Konfigurator macht Wechselwirkungen zwischen Produktoptionen sichtbar. Das ist besonders hilfreich, wenn ein einzelnes Katalogbild die Unterschiede zwischen zwei Konfigurationen nicht mehr ausreichend erklären kann.",
      groups: [
        { title: "Geometrie & Montage", body: "Legen Sie zuerst die architektonische Grundform fest.", items: ["Freistehende oder wandmontierte Ausführung", "Breite, Tiefe und Gesamthöhe", "Lamellenrichtung und Dachorientierung", "Maßanzeige in der 3D-Szene"] },
        { title: "Licht & Orientierung", body: "Bewerten Sie die Pergola unter wechselnden Lichtbedingungen statt nur in einem festen Rendering.", items: ["Lamellenwinkel", "Sonnenstand", "Nordrichtung und Kompass", "Tag-/Nachtansicht und integrierte Beleuchtung"] },
        { title: "Seiten & Privatsphäre", body: "Behandeln Sie jede Seite als eigenständige konfigurierbare Zone.", items: ["Offene Seite", "Manueller Screen", "Motorisierter Screen", "Sichtschutzelement", "Rahmenlose Schiebeverglasung"] },
        { title: "Komfort & kaufmännische Optionen", body: "Ergänzen Sie Komponenten, die Nutzung, Automatisierung und den geschätzten Gesamtpreis beeinflussen.", items: ["Umlaufende LED-Beleuchtung", "Integrierte Spots", "Infrarotstrahler", "Regen- und Windsensoren", "Geschätzter Preis und Angebotsübersicht"] },
      ],
    },
    outcomes: {
      label: "Warum 3D-Konfiguration",
      heading: "Eine klarere Entscheidung vor Fertigung oder Montage.",
      body: "Eine Pergola besteht nicht aus nur einer visuellen Entscheidung. Maße, Lamellenverhalten, Seitenabschlüsse und Zubehör beeinflussen sich gegenseitig. Ein gemeinsames interaktives Modell macht den Vorschlag leichter prüfbar und verkleinert die Lücke zwischen Beratung und tatsächlich gewählter Ausführung.",
      items: [
        { title: "Für Käufer", body: "Vergleichen Sie Varianten visuell und erkennen Sie vor der finalen Entscheidung, was jede Option am Produkt verändert." },
        { title: "Für Vertriebsteams", body: "Halten Sie Geometrie, sichtbare Optionen und den geschätzten kaufmännischen Zustand im selben Gespräch synchron." },
        { title: "Für Hersteller und Händler", body: "Nutzen Sie einen browserbasierten Produktzustand als Ausgangspunkt für einen stärker verbundenen Angebots- und Folgeprozess." },
      ],
    },
    faq: {
      label: "Pergola-Konfigurator FAQ",
      heading: "Häufige Fragen zum 3D Pergola-Konfigurator.",
      items: [
        { question: "Kann ich freistehende und wandmontierte Pergolen konfigurieren?", answer: "Ja. Der Konfigurator unterstützt freistehende und wandmontierte Ausführungen; die Traggeometrie passt sich an die gewählte Montageart an." },
        { question: "Kann ich die Pergolamaße verändern?", answer: "Ja. Breite, Tiefe und Höhe sind konfigurierbar und die parametrische Struktur wird bei Maßänderungen neu aufgebaut." },
        { question: "Kann ich Lamellen, Sonnenstand und Nachtbeleuchtung testen?", answer: "Ja. Sie können Lamellenausrichtung und -winkel, Sonnenstand und Nordrichtung ändern, den Kompass einblenden und in die Nachtansicht wechseln, um die Beleuchtung zu prüfen." },
        { question: "Welche Seitenabschlüsse kann ich hinzufügen?", answer: "Jede Seite kann offen bleiben oder mit manuellem Screen, motorisiertem Screen, Sichtschutzelement oder rahmenloser Schiebeverglasung konfiguriert werden." },
        { question: "Kann ich Beleuchtung, Heizstrahler und Wettersensoren ergänzen?", answer: "Ja. Der aktuelle Konfigurator unterstützt umlaufende LEDs, integrierte Spots, Infrarotstrahler sowie Regen- und Windsensoren am Pergolamodell." },
        { question: "Berechnet der Pergola-Konfigurator auch einen Preis?", answer: "Er zeigt einen geschätzten Preis mit Aufschlüsselung, der sich mit Maßen und Optionen aktualisiert. Die Zusammenfassung kann anschließend als Grundlage für den Angebotsprozess dienen." },
        { question: "Muss ich Software installieren?", answer: "Nein. Der Konfigurator läuft direkt in einem modernen Webbrowser und verwendet WebGL für die interaktive 3D-Darstellung." },
      ],
    },
    finalCta: {
      eyebrow: "Das echte Produkt testen",
      heading: "Erstellen Sie eine Pergola-Konfiguration direkt im Browser.",
      body: "Öffnen Sie den Live-Konfigurator und testen Sie Geometrie, Lamellen, Seitenabschlüsse, Beleuchtung und Zubehör selbst. Oder sprechen Sie mit uns, wenn Sie einen vergleichbaren Konfigurator für Ihr eigenes Produktsystem benötigen.",
      launch: "Pergola-Konfigurator starten",
      contact: "Konfigurator-Projekt besprechen",
    },
  },
};
