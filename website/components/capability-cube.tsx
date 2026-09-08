"use client";

import { useState } from "react";
import type { Locale } from "../lib/i18n";

const capabilitiesByLocale = { en: [
  {
    id: "bom",
    code: "01",
    title: "Bill of Materials",
    short: "BOM",
    description: "The approved visual state resolves into an exact component structure: profiles, panels, glass, hardware, accessories and quantities ready for downstream work.",
    signal: "Geometry → components",
  },
  {
    id: "price",
    code: "02",
    title: "Dynamic Price Updating",
    short: "Price",
    description: "Dimensions, materials and options feed the commercial engine continuously. Every valid change produces an immediate, traceable price update.",
    signal: "Rules → live total",
  },
  {
    id: "custom",
    code: "03",
    title: "Vast Customization",
    short: "Options",
    description: "Deep option trees remain understandable because every choice is constrained by the product’s real compatibility, dimensional and manufacturing rules.",
    signal: "Choice → valid state",
  },
  {
    id: "render",
    code: "04",
    title: "Real-Time Rendering",
    short: "Render",
    description: "Browser-native 3D responds as the product changes, keeping geometry, finishes, assemblies and camera feedback synchronized without a separate render workflow.",
    signal: "Input → spatial proof",
  },
  {
    id: "light",
    code: "05",
    title: "Dynamic Day & Night Lighting",
    short: "Light",
    description: "Environmental states reveal how materials, openings and integrated lighting behave across daylight, shadow and night—not only inside a neutral studio scene.",
    signal: "Time → atmosphere",
  },
  {
    id: "ui",
    code: "06",
    title: "Clean Unified UI",
    short: "UI",
    description: "One coherent interaction language connects visual choices, engineering constraints, pricing and outputs so complex products never feel complex to operate.",
    signal: "Complexity → clarity",
  },
], ro: [
  { id: "bom", code: "01", title: "Listă de materiale", short: "BOM", description: "Configurația vizuală aprobată se transformă într-o structură exactă de componente: profile, panouri, sticlă, feronerie, accesorii și cantități pregătite pentru fluxurile operaționale.", signal: "Geometrie → componente" },
  { id: "price", code: "02", title: "Preț actualizat în timp real", short: "Preț", description: "Dimensiunile, materialele și opțiunile recalculează automat prețul. Fiecare modificare validă rămâne înregistrată în configurație.", signal: "Reguli → preț actualizat" },
  { id: "custom", code: "03", title: "Opțiuni adaptate produsului", short: "Opțiuni", description: "Fiecare alegere respectă compatibilitatea, dimensiunile și regulile reale de fabricație, chiar și pentru produse cu multe variante.", signal: "Alegere → configurație validă" },
  { id: "render", code: "04", title: "Randare în timp real", short: "Randare", description: "Modelul 3D din browser răspunde imediat și păstrează geometria, finisajele, ansamblurile și camera sincronizate.", signal: "Comandă → confirmare 3D" },
  { id: "light", code: "05", title: "Iluminare dinamică zi/noapte", short: "Lumină", description: "Condițiile de mediu arată cum se văd materialele, deschiderile și iluminatul integrat în lumină naturală, umbră și noapte, nu doar într-un studio neutru.", signal: "Timp → atmosferă" },
  { id: "ui", code: "06", title: "Interfață unitară și clară", short: "Interfață", description: "Un singur limbaj de interacțiune conectează alegerile vizuale, constrângerile tehnice, prețurile și rezultatele, astfel încât un produs complex să rămână simplu de operat.", signal: "Complexitate → claritate" },
], de: [
  { id: "bom", code: "01", title: "Stückliste", short: "BOM", description: "Der freigegebene visuelle Zustand wird zu einer exakten Komponentenstruktur aus Profilen, Paneelen, Glas, Beschlägen, Zubehör und Mengen—bereit für nachgelagerte Prozesse.", signal: "Geometrie → Komponenten" },
  { id: "price", code: "02", title: "Dynamische Preisaktualisierung", short: "Preis", description: "Maße, Materialien und Optionen speisen die kaufmännische Logik kontinuierlich. Jede gültige Änderung erzeugt sofort eine nachvollziehbare Preisaktualisierung.", signal: "Regeln → Live-Gesamtpreis" },
  { id: "custom", code: "03", title: "Umfangreiche Individualisierung", short: "Optionen", description: "Tiefe Optionsstrukturen bleiben verständlich, weil jede Auswahl durch reale Kompatibilitäts-, Maß- und Fertigungsregeln begrenzt wird.", signal: "Auswahl → gültiger Zustand" },
  { id: "render", code: "04", title: "Echtzeit-Rendering", short: "Rendering", description: "Browsernatives 3D reagiert unmittelbar auf Änderungen und hält Geometrie, Oberflächen, Baugruppen und Kamerafeedback ohne separaten Renderprozess synchron.", signal: "Eingabe → räumlicher Beleg" },
  { id: "light", code: "05", title: "Dynamisches Tag- und Nachtlicht", short: "Licht", description: "Umgebungszustände zeigen Materialien, Öffnungen und integrierte Beleuchtung bei Tageslicht, Schatten und Nacht—nicht ausschließlich in einer neutralen Studioszene.", signal: "Zeit → Atmosphäre" },
  { id: "ui", code: "06", title: "Klare, einheitliche Oberfläche", short: "UI", description: "Eine konsistente Interaktionssprache verbindet visuelle Auswahl, technische Vorgaben, Preis und Ausgabe, damit komplexe Produkte einfach zu bedienen bleiben.", signal: "Komplexität → Klarheit" },
]} as const;

const rotations = [
  "rotateX(-16deg) rotateY(28deg)",
  "rotateX(-16deg) rotateY(-62deg)",
  "rotateX(-16deg) rotateY(-152deg)",
  "rotateX(-16deg) rotateY(118deg)",
  "rotateX(-68deg) rotateY(28deg)",
  "rotateX(112deg) rotateY(28deg)",
];

type Feature = { title: string; short: string; body: string };

function CubeObject({ active, labels, compact = false, onSelect, showLabel }: { active: number; labels: readonly string[]; compact?: boolean; onSelect: (index: number) => void; showLabel: string }) {
  return (
    <div className={compact ? "product-cube-stage" : "cube-stage"}>
      <div className="capability-cube" style={{ transform: rotations[active] }}>
        {labels.map((label, index) => (
          <button
            type="button"
            className={`cube-face cube-face-${index + 1} ${active === index ? "active" : ""}`}
            key={`${index}-${label}`}
            onClick={() => onSelect(index)}
            aria-label={`${showLabel} ${label}`}
          >
            <span>0{index + 1}</span>
            <strong>{compact ? label.split(/[ &]/)[0] : label}</strong>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>
      {!compact && <><span className="cube-axis cube-axis-x">X</span><span className="cube-axis cube-axis-y">Y</span></>}
    </div>
  );
}

export function CapabilityCube({ detail = false, locale = "en" }: { detail?: boolean; locale?: Locale }) {
  const [active, setActive] = useState(0);
  const capabilities = capabilitiesByLocale[locale];
  const selected = capabilities[active];
  const copy = locale === "ro"
    ? { shared: "Funcțiile comune ale platformei", core: "02 / Platformă", titleA: "Șase funcții.", titleB: "O singură configurație.", intro: "Fiecare implementare pornește de la aceeași bază 3D, tehnică și comercială, indiferent de produs.", cube: "Prezentarea interactivă a funcțiilor platformei", select: "Alege o funcție", show: "Afișează", face: "FUNCȚIE SELECTATĂ", signal: "Fluxul datelor" }
    : locale === "de"
      ? { shared: "Gemeinsame Plattform-DNA", core: "02 / Kernsystem", titleA: "Sechs Kräfte.", titleB: "Ein Produktzustand.", intro: "Jede Implementierung basiert auf derselben verknüpften kaufmännischen und räumlichen Grundlage—unabhängig von der Produktkategorie.", cube: "Interaktiver Würfel der Plattformfunktionen", select: "Funktion auswählen", show: "Anzeigen", face: "AKTIVE FLÄCHE", signal: "Signalweg" }
      : { shared: "Shared platform DNA", core: "02 / Core system", titleA: "Six forces.", titleB: "One product state.", intro: "Every deployment is built on the same connected commercial and spatial foundation—even as the product category changes.", cube: "Interactive platform capability cube", select: "Select a capability", show: "Show", face: "ACTIVE FACE", signal: "Signal path" };

  return (
    <section className={`capability-core ${detail ? "capability-core-detail" : ""}`} aria-labelledby={detail ? "shared-capabilities-title" : "platform-capabilities-title"}>
      <div className="capability-core-grid page-frame">
        <div className="capability-core-heading">
          <span className="mono-label">{detail ? copy.shared : copy.core}</span>
          <h2 id={detail ? "shared-capabilities-title" : "platform-capabilities-title"}>{copy.titleA}<br/>{copy.titleB}</h2>
          <p>{copy.intro}</p>
        </div>

        <div className="cube-console" aria-label={copy.cube}>
          <CubeObject active={active} labels={capabilities.map((item) => item.short)} onSelect={setActive} showLabel={copy.show} />
          <div className="cube-selector" aria-label={copy.select}>
            {capabilities.map((capability, index) => (
              <button type="button" key={capability.id} className={active === index ? "active" : ""} onClick={() => setActive(index)}>
                <span>{capability.code}</span>{capability.short}
              </button>
            ))}
          </div>
        </div>

        <div className="capability-readout" aria-live="polite">
          <div className="readout-index"><span>{selected.code}</span><i>{copy.face}</i></div>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <div className="readout-signal"><span>{copy.signal}</span><b>{selected.signal}</b></div>
        </div>
      </div>
    </section>
  );
}

export function ProductFeatureCube({ features, label, locale = "en" }: { features: Feature[]; label: string; locale?: Locale }) {
  const [active, setActive] = useState(0);
  const items = features.slice(0, 6);
  const selected = items[active];

  const copy = locale === "ro" ? { title: "Șase capabilități ale sistemului", show: "Afișează" } : locale === "de" ? { title: "Sechs Systemfunktionen", show: "Anzeigen" } : { title: "Six system capabilities", show: "Show" };
  return (
    <div className="product-feature-system" aria-label={`${label} capabilities`}>
      <span className="mono-label">{copy.title}</span>
      <CubeObject active={active} labels={items.map((item) => item.short)} compact onSelect={setActive} showLabel={copy.show} />
      <div className="product-feature-tabs">
        {items.map((feature, index) => (
          <button type="button" key={feature.title} className={active === index ? "active" : ""} onClick={() => setActive(index)}>
            <span>0{index + 1}</span>{feature.short}
          </button>
        ))}
      </div>
      <p className="product-feature-description"><b>{selected.title}</b>{selected.body}</p>
    </div>
  );
}
