import type { Locale } from "./i18n";

type Context = "path" | "systems" | "scope";

const pathDetails = {
  en: {
    "existing-system": [
      "runs in managed production infrastructure with the operational platform covered by the active subscription.",
      "provides a dedicated branded address without separating the deployment from the maintained platform.",
      "applies the approved identity, colors and content while preserving the validated product interaction model.",
      "reuses proven dimensional relationships, dependencies and configuration behavior already operating in the selected system.",
      "keeps commercial calculations connected to valid product choices wherever the established deployment supports them.",
      "captures configuration activity and qualified enquiries through the standard measurement and lead-routing layer.",
      "keeps the shared technical foundation maintained as browsers, devices and platform capabilities evolve.",
      "provides an accountable route for operational questions, reproducible issues and deployment context.",
      "allows the ongoing service to follow the billing cadence agreed for the live production platform.",
      "covers production readiness, validated release and an explicit operational handover to the client team.",
    ],
    "adapted-system": [
      "translates proprietary sizes, tolerances and engineering limits into enforceable configuration behavior.",
      "maps the manufacturer’s real catalogue structure instead of forcing products into generic option groups.",
      "rebuilds or refines visual assets so the configured result represents the actual branded product range.",
      "connects selected options to the client’s calculation model, qualification logic and commercial outputs.",
      "aligns quantities, assemblies and manufacturing outputs with the adapted product definition.",
      "reshapes the interaction sequence around how the client’s team specifies, validates and sells the product.",
      "defines authenticated data exchange, ownership and failure handling for each connected business system.",
      "accounts for regional content, availability and commercial variation without fragmenting configuration state.",
      "turns technical evidence into a documented delivery boundary, dependencies and credible implementation estimate.",
      "covers final validation, release coordination and handover of the adapted production deployment.",
    ],
    "custom-system": [
      "turns product knowledge, user needs and commercial objectives into an agreed technical specification.",
      "defines how geometry, rules, data, pricing, outputs and integrations operate as one configuration system.",
      "prepares source geometry for browser delivery, product variation and dependable real-time interaction.",
      "encodes dimensional relationships so changes rebuild a valid product rather than stretch decorative geometry.",
      "prevents incompatible choices and explains the constraints needed to reach a manufacturable result.",
      "keeps calculations and material outputs traceable to the selected product state and approved data sources.",
      "organizes complex decisions into a clear, responsive workflow for buyers, dealers and internal teams.",
      "connects the finished engine to its production environment and the agreed operational systems.",
      "validates devices, rules, outputs and edge cases before coordinated release into production.",
      "keeps the deployed system hosted, maintained and supported after the implementation is complete.",
    ],
  },
  ro: {
    "existing-system": ["rulează într-o infrastructură administrată, acoperită de abonamentul activ.", "oferă o adresă dedicată brandului și rămâne conectat la platforma pe care o întreținem.", "aplică identitatea, culorile și conținutul aprobate, fără să schimbe modul de utilizare deja validat.", "reutilizează relațiile dimensionale, dependențele și comportamentul de configurare deja verificate.", "păstrează calculele comerciale conectate la opțiunile valide, acolo unde configuratorul le include.", "măsoară activitatea și direcționează solicitările calificate prin instrumentele standard de analiză.", "menține baza tehnică actualizată pe măsură ce evoluează browserele, dispozitivele și platforma.", "oferă un proces clar pentru întrebări operaționale și probleme tehnice reproductibile.", "permite facturarea lunară sau anuală a serviciului continuu.", "include pregătirea pentru producție, lansarea validată și predarea către echipa clientului."],
    "adapted-system": ["transformă dimensiunile, toleranțele și limitele tehnice proprii în reguli aplicabile.", "reproduce catalogul real al producătorului, fără să forțeze produsele în grupuri generice.", "reconstruiește modelele vizuale astfel încât rezultatul să reprezinte gama reală de produse.", "conectează opțiunile la calculele și rezultatele comerciale ale clientului.", "aliniază cantitățile, ansamblurile și datele pentru fabricație cu produsul adaptat.", "organizează pașii după modul real în care produsul este specificat, verificat și vândut.", "definește schimbul de date, responsabilitatea și tratarea erorilor pentru sistemele conectate.", "păstrează într-o singură configurație variațiile regionale de conținut, disponibilitate și reguli comerciale.", "transformă analiza tehnică într-o delimitare clară a lucrărilor, dependențelor și costurilor.", "include validarea finală, coordonarea lansării și predarea configuratorului adaptat."],
    "custom-system": ["transformă informațiile despre produs și obiectivele comerciale într-o specificație agreată.", "definește cum funcționează împreună geometria, regulile, datele, prețul și integrările.", "pregătește geometria pentru browser, variante de produs și interacțiune fiabilă în timp real.", "codifică relațiile dimensionale astfel încât modificările să reconstruiască un produs valid.", "previne alegerile incompatibile și explică limitele necesare pentru un produs fabricabil.", "păstrează calculele și materialele legate de configurația aleasă și de sursele de date aprobate.", "organizează deciziile complexe într-un proces clar și adaptabil pentru fiecare tip de utilizator.", "conectează configuratorul la mediul de producție și la sistemele operaționale convenite.", "verifică dispozitivele, regulile, rezultatele și cazurile-limită înainte de lansare.", "asigură găzduirea, mentenanța și suportul după finalizarea implementării."],
  },
  de: {
    "existing-system": ["läuft in verwalteter Produktionsinfrastruktur, deren Betrieb durch das aktive Abonnement abgedeckt ist.", "bietet eine eigene Markenadresse innerhalb der weiterhin gepflegten Plattform.", "wendet freigegebene Identität, Farben und Inhalte auf das validierte Interaktionsmodell an.", "verwendet bewährte Maße, Abhängigkeiten und Konfigurationsabläufe des ausgewählten Systems.", "verknüpft kaufmännische Berechnungen mit gültigen Produktentscheidungen, sofern das System sie unterstützt.", "erfasst Nutzung und qualifizierte Anfragen über die standardisierte Analytics- und Lead-Ebene.", "hält die technische Basis bei neuen Browsern, Geräten und Plattformfunktionen aktuell.", "schafft einen klaren Weg für Betriebsfragen, reproduzierbare Fehler und technischen Kontext.", "ermöglicht den vereinbarten Abrechnungsrhythmus für den laufenden Plattformbetrieb.", "umfasst Produktionsreife, validierte Freigabe und geregelte Übergabe an das Kundenteam."],
    "adapted-system": ["übersetzt proprietäre Maße, Toleranzen und technische Grenzen in durchsetzbare Regeln.", "bildet den realen Herstellerkatalog ab, ohne Produkte in generische Gruppen zu zwingen.", "erstellt visuelle Assets so, dass das konfigurierte Ergebnis das reale Sortiment repräsentiert.", "verbindet Optionen mit Kalkulation, Qualifizierung und kaufmännischen Ausgaben des Kunden.", "richtet Mengen, Baugruppen und Fertigungsausgaben am angepassten Produkt aus.", "formt den Ablauf nach der realen Spezifikation, Prüfung und dem Vertrieb des Produkts.", "definiert Datenaustausch, Eigentum und Fehlerbehandlung für jedes angebundene System.", "berücksichtigt regionale Inhalte, Verfügbarkeit und Regeln in einem kohärenten Zustand.", "überführt technische Erkenntnisse in Grenzen, Abhängigkeiten und eine belastbare Schätzung.", "umfasst Endprüfung, koordinierte Freigabe und Übergabe der angepassten Bereitstellung."],
    "custom-system": ["überführt Produktwissen, Nutzerbedarf und Geschäftsziele in eine vereinbarte Spezifikation.", "definiert Geometrie, Regeln, Daten, Preis, Ausgaben und Integrationen als Gesamtsystem.", "bereitet Geometrie für Browser, Produktvarianten und verlässliche Echtzeitinteraktion auf.", "codiert Maßbeziehungen, damit Änderungen ein gültiges Produkt neu aufbauen.", "verhindert inkompatible Entscheidungen und erklärt die Grenzen eines fertigbaren Ergebnisses.", "hält Kalkulationen und Materialien zum Produktzustand und zu freigegebenen Quellen rückverfolgbar.", "ordnet komplexe Entscheidungen in einen klaren responsiven Ablauf für alle Nutzergruppen.", "verbindet die fertige Engine mit Produktionsumgebung und vereinbarten Betriebssystemen.", "validiert Geräte, Regeln, Ausgaben und Grenzfälle vor der Produktionsfreigabe.", "hält das System nach der Implementierung gehostet, gepflegt und unterstützt."],
  },
} as const;

const systemDetails = {
  en: ["uses proven structural spans, louver logic, enclosure options and live commercial outputs for configurable outdoor systems.", "models roof form, dimensions, pitch, coverings, rainwater components and a geometry-derived bill of materials.", "connects profile dimensions, openings, hardware and compatibility rules into a precise configurable assembly.", "coordinates structural bays, cladding, openings and load-driven choices for industrial building concepts.", "combines location, roof geometry, real sun position, photovoltaic layout, storage and energy performance.", "configures perimeter layout, bay dimensions, infill systems, finishes, gates and installation conditions in one model."],
  ro: ["folosește deschideri structurale, logică de lamele, închideri și rezultate comerciale validate pentru sisteme exterioare.", "modelează forma, dimensiunile, panta, învelitoarea, sistemul pluvial și necesarul calculat din geometrie.", "conectează profilele, golurile, feroneria și compatibilitatea într-un ansamblu configurabil precis.", "coordonează travei, închideri, goluri și alegeri structurale pentru concepte de hale industriale.", "combină locația, acoperișul, poziția reală a soarelui, panourile, stocarea și performanța energetică.", "configurează traseul, traveile, panourile, finisajele, porțile și montajul într-un singur model."],
  de: ["nutzt bewährte Spannweiten, Lamellenlogik, Abschlüsse und kaufmännische Ausgaben für Außensysteme.", "modelliert Dachform, Maße, Neigung, Deckung, Entwässerung und eine geometriebasierte Stückliste.", "verknüpft Profilmaße, Öffnungen, Beschläge und Kompatibilität zu einer präzisen Baugruppe.", "koordiniert Raster, Bekleidung, Öffnungen und lastabhängige Entscheidungen für Hallenkonzepte.", "kombiniert Standort, Dachgeometrie, Sonnenstand, PV-Belegung, Speicher und Energieertrag.", "konfiguriert Verlauf, Felder, Füllungen, Oberflächen, Tore und Montagebedingungen in einem Modell."],
} as const;

const scopeDetails = {
  en: ["defines how many families, variants and geometric relationships the configuration engine must represent.", "determines what can be reused directly and what requires cleanup, reconstruction or new production assets.", "measures the dependencies, constraints and exceptions that must remain valid through every user decision.", "covers formulas, price sources, quantities, assemblies, taxes and outputs connected to configuration state.", "defines who configures, reviews, approves, quotes and manages the product across the operating process.", "captures APIs, authentication, data ownership, exchange direction and operational responsibility for connected systems.", "accounts for regional content, units, currencies, availability, domains and deployment-specific technical requirements.", "sets acceptance criteria, product validation, ownership, release sequencing and readiness for reliable production use."],
  ro: ["definește câte familii, variante și relații geometrice trebuie reprezentate de motor.", "arată ce poate fi reutilizat și ce necesită curățare, reconstrucție sau active noi.", "măsoară dependențele, constrângerile și excepțiile care trebuie menținute la fiecare alegere.", "acoperă formule, surse de preț, cantități, ansamble, taxe și ieșiri comerciale.", "definește cine configurează, verifică, aprobă, ofertează și administrează produsul.", "clarifică API-uri, autentificare, proprietatea datelor, direcția schimbului și responsabilitatea operațională.", "include conținut regional, unități, monede, disponibilitate, domenii și cerințe de implementare.", "stabilește criterii de acceptare, validare, proprietate, succesiunea lansării și pregătirea producției."],
  de: ["bestimmt, wie viele Familien, Varianten und geometrische Beziehungen die Engine abbilden muss.", "zeigt, was direkt verwendbar ist und was Bereinigung, Rekonstruktion oder neue Assets benötigt.", "misst Abhängigkeiten, Einschränkungen und Ausnahmen, die bei jeder Entscheidung gültig bleiben.", "umfasst Formeln, Preisquellen, Mengen, Baugruppen, Steuern und zustandsabhängige Ausgaben.", "definiert, wer konfiguriert, prüft, freigibt, anbietet und das Produkt verwaltet.", "klärt APIs, Authentifizierung, Dateneigentum, Austauschrichtung und operative Verantwortung.", "berücksichtigt regionale Inhalte, Einheiten, Währungen, Verfügbarkeit, Domains und technische Umgebungen.", "setzt Abnahmekriterien, Validierung, Verantwortung, Freigabereihenfolge und Produktionsreife."],
} as const;

export function pricingFaceDescriptions(locale: Locale, context: Context, items: readonly string[], pathId?: string) {
  const details = context === "path"
    ? pathDetails[locale][pathId as keyof typeof pathDetails.en]
    : context === "systems" ? systemDetails[locale] : scopeDetails[locale];
  return items.map((item, index) => `${item} ${details[index] ?? details[details.length - 1]}`);
}
