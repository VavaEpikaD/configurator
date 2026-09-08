"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ConfiguratorSlug } from "../lib/configurators";
import type { Locale } from "../lib/i18n";
import { useMobileDeckSwipe } from "./use-mobile-deck-swipe";
import { buildPoleGrid } from "../lib/scenes/pergola-layout.js";
import { bomToCsv } from "../../roof-configurator/js/bom.js";
import { formatCurrency } from "../../roof-configurator/js/preferences.js";
import { FenceControls, HallControls, SolarControls } from "./extended-showcase-controls";

type ControlValue = string | number | boolean | Record<string, string>;

type RoofBom = {
  lines: Array<{ key: string; name: string; unit: string; quantity: number; unitPrice: number; value: number; included?: boolean }>;
  subtotal: number;
  vat: number;
  total: number;
  vatRate: number;
  currency: string;
  locale: string;
  assumptions: { roofArea: number; ridgeLength: number; eavesLength: number; valleyLength: number };
};

type PergolaSegment = {
  id: string;
  axis: "horizontal" | "vertical";
  row: number;
  column: number;
  boundary: "front" | "back" | "left" | "right" | null;
  lengthMm: number;
};

type PergolaGrid = {
  rows: number;
  columns: number;
  segments: PergolaSegment[];
  poles: Array<{ id: string; row: number; column: number }>;
};

function defaultSideClosings(width: number, depth: number) {
  return Object.fromEntries(
    (buildPoleGrid({ width: width * 1000, depth: depth * 1000, height: 2700 }) as PergolaGrid).segments
      .map((segment) => [segment.id, segment.boundary === "front" ? "glass" : "none"]),
  );
}

function emit(scene: ConfiguratorSlug, control: string, value: ControlValue) {
  window.dispatchEvent(new CustomEvent("configurator-control", { detail: { scene, control, value } }));
}

function RangeControl({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="scene-range">
      <span>{label}<b>{value}{unit}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function RoofBomModal({ bom, locale, onClose }: { bom: RoofBom; locale: Locale; onClose: () => void }) {
  const text = locale === "ro" ? {
    eyebrow: "MATERIALE / LIVE", title: "Necesar de materiale", close: "Închide", item: "Element", qty: "Cant.", unit: "U.M.", value: "Valoare", area: "Suprafață acoperiș", subtotal: "Subtotal", vat: "TVA", total: "Total", download: "Descarcă CSV",
  } : locale === "de" ? {
    eyebrow: "MATERIAL / LIVE", title: "Materialliste", close: "Schließen", item: "Position", qty: "Menge", unit: "Einheit", value: "Wert", area: "Dachfläche", subtotal: "Zwischensumme", vat: "MwSt.", total: "Gesamt", download: "CSV laden",
  } : {
    eyebrow: "MATERIALS / LIVE", title: "Bill of materials", close: "Close", item: "Item", qty: "Qty.", unit: "Unit", value: "Value", area: "Roof area", subtotal: "Subtotal", vat: "VAT", total: "Total", download: "Download CSV",
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const downloadCsv = () => {
    const blob = new Blob([`\uFEFF${bomToCsv(bom, bom.locale)}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "roof-bill-of-materials.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="energy-modal roof-bom-modal" role="dialog" aria-modal="true" aria-label={text.title}>
      <button className="energy-modal-backdrop" aria-label={text.close} onClick={onClose} />
      <div className="energy-modal-panel roof-bom-panel" data-lenis-prevent onWheel={(event) => event.stopPropagation()}>
        <header className="roof-bom-header">
          <div><span className="mono-label">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.area}: {bom.assumptions.roofArea.toFixed(1)} m²</p></div>
          <button type="button" onClick={onClose}>{text.close} ×</button>
        </header>
        <div className="roof-bom-table" role="table" data-lenis-prevent onWheel={(event) => event.stopPropagation()}>
          <div className="roof-bom-row roof-bom-head" role="row"><span>{text.item}</span><span>{text.qty}</span><span>{text.unit}</span><span>{text.value}</span></div>
          {bom.lines.filter((line) => line.included !== false).map((line) => <div className="roof-bom-row" role="row" key={line.key}><span>{line.name}</span><b>{line.quantity}</b><span>{line.unit}</span><span>{formatCurrency(line.value, bom.currency)}</span></div>)}
        </div>
        <footer className="roof-bom-summary">
          <div><span>{text.subtotal}</span><b>{formatCurrency(bom.subtotal, bom.currency)}</b><span>{text.vat} {Math.round(bom.vatRate * 100)}%</span><b>{formatCurrency(bom.vat, bom.currency)}</b><strong>{text.total}</strong><strong>{formatCurrency(bom.total, bom.currency)}</strong></div>
          <button type="button" onClick={downloadCsv}>{text.download} ↗</button>
        </footer>
      </div>
    </div>
  );
}

function LegacyShowcaseControls({ scene, locale = "en" }: { scene: ConfiguratorSlug; controls?: string[]; locale?: Locale }) {
  const text = locale === "ro" ? {
    resolving: "Se calculează…", structure: "STRUCTURĂ / LIVE", roof: "ACOPERIȘ PARAMETRIC", environment: "MEDIU / LIVE", controls: "Personalizează", hide: "Vezi modelul",
    length: "Lungime", depth: "Adâncime", wall: "Înălțime pereți", pitch: "Pantă", eaves: "Streașină", graphite: "Grafit", slate: "Ardezie", oxide: "Oxid",
    slopes2: "2 ape", slopes4: "4 ape", slope1: "1 apă", lshape: "Formă L", dormer: "Lucarnă", louver: "Unghi lamele", width: "Lățime",
    open: "Deschis", screen: "Rulou manual", motorized: "Rulou ZIP motorizat", privacy: "Perete cu lamele", glass: "Sticlă", day: "Mod zi", night: "Mod noapte", perimeter: "LED perimetral", spots: "Spoturi integrate", cool: "Rece", ice: "Albastru glaciar", sunset: "Apus", closings: "Închideri laterale", chooseSegment: "Alege segmentul", segment: "Segment", covering: "Învelitoare", materialPreset: "Tip de învelitoare", roofColour: "Culoare acoperiș", genericTile: "Țiglă metalică", mineralTile: "Țiglă cu granule minerale", slateTile: "Țiglă minerală tip ardezie", burgundy: "Bordo", brown: "Maro", terracotta: "Teracotă", forestGreen: "Verde pădure",
  } : locale === "de" ? {
    resolving: "Wird berechnet…", structure: "STRUKTUR / LIVE", roof: "PARAMETRISCHES DACH", environment: "UMGEBUNG / LIVE", controls: "Konfigurieren", hide: "Modell ansehen",
    length: "Länge", depth: "Tiefe", wall: "Wandhöhe", pitch: "Dachneigung", eaves: "Traufe", graphite: "Graphit", slate: "Schiefer", oxide: "Oxid",
    slopes2: "2 Flächen", slopes4: "4 Flächen", slope1: "1 Fläche", lshape: "L-Form", dormer: "Gaube", louver: "Lamellenwinkel", width: "Breite",
    open: "Offen", screen: "Screen", motorized: "Motor-Screen", privacy: "Sichtschutz", glass: "Glas", day: "Tagmodus", night: "Nachtmodus", perimeter: "Umlaufende LED", spots: "Integrierte Spots", cool: "Kaltweiß", ice: "Eisblau", sunset: "Sonnenuntergang", closings: "Seitenabschlüsse", chooseSegment: "Segment wählen", segment: "Segment", covering: "Dacheindeckung", materialPreset: "Materialvorgabe", roofColour: "Dachfarbe", genericTile: "Metalldachpfanne", mineralTile: "Mineralgranulat-Metalldachpfanne", slateTile: "Schieferartige Mineralpfanne", burgundy: "Burgunderrot", brown: "Braun", terracotta: "Terrakotta", forestGreen: "Waldgrün",
  } : {
    resolving: "Resolving…", structure: "STRUCTURE / LIVE", roof: "PARAMETRIC ROOF", environment: "ENVIRONMENT / LIVE", controls: "Customize", hide: "View model",
    length: "Length", depth: "Depth", wall: "Wall height", pitch: "Roof pitch", eaves: "Eaves", graphite: "Graphite", slate: "Slate", oxide: "Oxide",
    slopes2: "2 slope", slopes4: "4 slope", slope1: "1 slope", lshape: "L shape", dormer: "Dormer", louver: "Louver tilt", width: "Width",
    open: "Open", screen: "Pull-down", motorized: "Motorized", privacy: "Privacy", glass: "Glass", day: "Day mode", night: "Night mode", perimeter: "Perimeter LED", spots: "Integrated spots", cool: "Cool", ice: "Ice blue", sunset: "Sunset", closings: "Side closings", chooseSegment: "Choose segment", segment: "Segment", covering: "Roof covering", materialPreset: "Material preset", roofColour: "Roof colour", genericTile: "Generic metal tile", mineralTile: "Mineral-granule metal tile", slateTile: "Slate-style mineral tile", burgundy: "Burgundy", brown: "Brown", terracotta: "Terracotta", forestGreen: "Forest green",
  };
  const [collapsed, setCollapsed] = useState(false);
  const deckSwipe = useMobileDeckSwipe(setCollapsed);
  const [tilt, setTilt] = useState(0);
  const [width, setWidth] = useState(6);
  const [depth, setDepth] = useState(4);
  const [sideClosings, setSideClosings] = useState<Record<string, string>>(() => defaultSideClosings(6, 4));
  const [closingsOpen, setClosingsOpen] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState("h-r0-c0");
  const [night, setNight] = useState(false);
  const [roofLength, setRoofLength] = useState(10);
  const [roofDepth, setRoofDepth] = useState(7);
  const [wallHeight, setWallHeight] = useState(3);
  const [roofPitch, setRoofPitch] = useState(30);
  const [overhang, setOverhang] = useState(0.4);
  const [roofCovering, setRoofCovering] = useState("generic");
  const [roofColor, setRoofColor] = useState("#7f1d2d");
  const [coveringOpen, setCoveringOpen] = useState(false);
  const [roofShape, setRoofShape] = useState("lshape");
  const [led, setLed] = useState(true);
  const [ledColor, setLedColor] = useState("#fff1b4");
  const [spotlights, setSpotlights] = useState(4);
  const [price, setPrice] = useState<{ total: number; currency: string } | null>(null);
  const [roofBom, setRoofBom] = useState<RoofBom | null>(null);
  const [roofBomOpen, setRoofBomOpen] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 720px), ((max-width: 1050px) and (pointer: coarse))");
    const frame = window.requestAnimationFrame(() => setCollapsed(mobile.matches));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onPrice = (event: Event) => {
      const detail = (event as CustomEvent<{ scene: ConfiguratorSlug; total: number; currency: string }>).detail;
      if (detail.scene === scene) setPrice({ total: detail.total, currency: detail.currency });
    };
    window.addEventListener("configurator-price", onPrice);
    const timer = window.setTimeout(() => emit(scene, "requestPrice", true), 120);
    return () => { window.clearTimeout(timer); window.removeEventListener("configurator-price", onPrice); };
  }, [scene]);

  useEffect(() => {
    if (scene !== "roof") return;
    const onBom = (event: Event) => setRoofBom((event as CustomEvent<RoofBom>).detail);
    window.addEventListener("roof-bom", onBom);
    return () => window.removeEventListener("roof-bom", onBom);
  }, [scene]);

  const pergolaGrid = useMemo(
    () => buildPoleGrid({ width: width * 1000, depth: depth * 1000, height: 2700 }) as PergolaGrid,
    [width, depth],
  );

  const updatePergolaSize = (axis: "width" | "depth", value: number) => {
    const nextWidth = axis === "width" ? value : width;
    const nextDepth = axis === "depth" ? value : depth;
    const nextGrid = buildPoleGrid({ width: nextWidth * 1000, depth: nextDepth * 1000, height: 2700 }) as PergolaGrid;
    const nextClosings = Object.fromEntries(nextGrid.segments.map((segment) => [segment.id, sideClosings[segment.id] ?? "none"]));
    if (axis === "width") setWidth(value);
    else setDepth(value);
    setSideClosings(nextClosings);
    if (!nextGrid.segments.some((segment) => segment.id === selectedSegmentId)) {
      setSelectedSegmentId(nextGrid.segments.find((segment) => segment.boundary === "front")?.id ?? nextGrid.segments[0]?.id ?? "");
    }
    emit(scene, axis, value);
    emit(scene, "sideClosings", nextClosings);
  };

  const formattedPrice = price ? new Intl.NumberFormat(price.currency === "RON" ? "ro-RO" : "en-US", {
    style: "currency", currency: price.currency, maximumFractionDigits: 0,
  }).format(price.total) : text.resolving;

  useEffect(() => {
    if (scene !== "pergola") return;
    const sync = () => {
      const isNight = document.documentElement.dataset.theme !== "light";
      setNight(isNight);
      setTilt(isNight ? 34 : 0);
    };
    const frame = requestAnimationFrame(sync);
    window.addEventListener("themechange", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("themechange", sync); };
  }, [scene]);

  if (scene === "window") return null;

  if (scene === "roof") {
    const materials = [["generic", text.genericTile], ["roca", text.mineralTile], ["teclado", text.slateTile]];
    const roofColors = [["#7f1d2d", text.burgundy], ["#293544", text.graphite], ["#684230", text.brown], ["#8a3428", text.terracotta], ["#315449", text.forestGreen]];
    const shapes = [["gable", text.slopes2], ["hip", text.slopes4], ["shed", text.slope1], ["lshape", text.lshape], ["dormer", text.dormer]];
    const coveringLabel = materials.find(([value]) => value === roofCovering)?.[1] ?? text.genericTile;
    const selectCovering = (value: string) => {
      const minimumPitch = value === "roca" ? 14 : value === "teclado" ? 18 : 5;
      setRoofCovering(value);
      emit(scene, "materialPreset", value);
      if (roofPitch < minimumPitch) {
        setRoofPitch(minimumPitch);
        emit(scene, "pitch", minimumPitch);
      }
    };
    return (
      <>
      <div className={`scene-controls scene-controls-panel instrument-console roof-controls ${collapsed ? "is-collapsed" : ""}`} aria-label="Roof preview controls">
        <div className="console-header" {...deckSwipe}><span>{text.structure}</span><b>{text.roof}</b><strong className="live-price">LIVE {formattedPrice}</strong><button className="console-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}>{collapsed ? text.controls : text.hide}</button></div>
        <div className="console-body" aria-hidden={collapsed} inert={collapsed || undefined}>
        <div className="scene-control-grid">
          <RangeControl label={text.length} value={roofLength} min={7} max={14} step={0.5} unit=" m" onChange={(value) => { setRoofLength(value); emit(scene, "length", value); }} />
          <RangeControl label={text.depth} value={roofDepth} min={5} max={10} step={0.5} unit=" m" onChange={(value) => { setRoofDepth(value); emit(scene, "depth", value); }} />
          <RangeControl label={text.wall} value={wallHeight} min={2.2} max={4.5} step={0.1} unit=" m" onChange={(value) => { setWallHeight(value); emit(scene, "wallHeight", value); }} />
          <RangeControl label={text.pitch} value={roofPitch} min={10} max={55} step={1} unit="°" onChange={(value) => { setRoofPitch(value); emit(scene, "pitch", value); }} />
          <RangeControl label={text.eaves} value={overhang} min={0.1} max={1} step={0.05} unit=" m" onChange={(value) => { setOverhang(value); emit(scene, "overhang", value); }} />
        </div>
        <div className="scene-preset-row shape-row" aria-label="Roof shape">
          {shapes.map(([value, label]) => <button key={value} className={roofShape === value ? "active" : ""} onClick={() => { setRoofShape(value); emit(scene, "shape", value); }}>{label}</button>)}
        </div>
        <div className="roof-covering-toolbar">
          <button className={coveringOpen ? "active" : ""} type="button" onClick={() => setCoveringOpen((value) => !value)} aria-expanded={coveringOpen}><span>{text.covering}</span><b>{coveringLabel}</b><i style={{ background: roofColor }} /></button>
        </div>
        {coveringOpen && <div className="roof-covering-editor">
          <div><span className="control-section-label">{text.materialPreset}</span><div className="scene-preset-row material-row" aria-label={text.materialPreset}>{materials.map(([value, label]) => <button key={value} className={roofCovering === value ? "active" : ""} onClick={() => selectCovering(value)}>{label}</button>)}</div></div>
          <div><span className="control-section-label">{text.roofColour}</span><div className="roof-color-row" aria-label={text.roofColour}>{roofColors.map(([value, label]) => <button key={value} className={roofColor === value ? "active" : ""} type="button" title={label} aria-label={label} aria-pressed={roofColor === value} onClick={() => { setRoofColor(value); emit(scene, "roofColor", value); }}><i style={{ background: value }} /><span>{label}</span></button>)}</div></div>
        </div>}
        </div>
      </div>
      <button className="analytics-bubble roof-bom-bubble" type="button" onClick={() => { setRoofBomOpen(true); emit(scene, "requestBom", true); }} aria-label={locale === "ro" ? "Deschide necesarul de materiale" : locale === "de" ? "Materialliste öffnen" : "Open bill of materials"}>
        <span>BOM</span><b>{locale === "ro" ? <>MATERIALE<br />LIVE</> : locale === "de" ? <>MATERIAL<br />LIVE</> : <>LIVE<br />MATERIALS</>}</b><i>↗</i>
      </button>
      {roofBomOpen && roofBom && <RoofBomModal bom={roofBom} locale={locale} onClose={() => setRoofBomOpen(false)} />}
      </>
    );
  }

  const closingOptions = [["none", text.open], ["screen", text.screen], ["motorized-screen", text.motorized], ["privacy-wall", text.privacy], ["glass", text.glass]];
  const selectedSegment = pergolaGrid.segments.find((segment) => segment.id === selectedSegmentId) ?? pergolaGrid.segments[0];
  const segmentLabel = (segment: PergolaSegment) => {
    const ordinal = segment.axis === "horizontal" ? segment.column + 1 : segment.row + 1;
    const side = segment.boundary ? segment.boundary.toUpperCase() : text.segment.toUpperCase();
    return `${side} ${ordinal}`;
  };
  const ledColors = [
    ["#ffca73", "2700K"], ["#ffe5a3", "3000K"], ["#fff1cf", "4000K"],
    ["#dbeeff", text.cool], ["#86b8ff", text.ice], ["#ff8f77", text.sunset],
  ];
  return (
    <div className={`scene-controls scene-controls-panel instrument-console pergola-controls ${collapsed ? "is-collapsed" : ""}`} aria-label="Pergola preview controls">
      <div className="console-header" {...deckSwipe}><span>{text.environment}</span><b>PERGOLA 6 × 4 M</b><strong className="live-price">LIVE {formattedPrice}</strong><button className="console-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}>{collapsed ? text.controls : text.hide}</button></div>
      <div className="console-body" aria-hidden={collapsed} inert={collapsed || undefined}>
      <div className="scene-control-grid">
        <RangeControl label={text.louver} value={tilt} min={0} max={80} step={1} unit="°" onChange={(value) => { setTilt(value); emit(scene, "tilt", value); }} />
        <RangeControl label={text.width} value={width} min={4} max={10} step={0.25} unit=" m" onChange={(value) => updatePergolaSize("width", value)} />
        <RangeControl label={text.depth} value={depth} min={3} max={10} step={0.25} unit=" m" onChange={(value) => updatePergolaSize("depth", value)} />
      </div>
      <div className="pergola-closing-toolbar">
        <button className={closingsOpen ? "active" : ""} type="button" onClick={() => setClosingsOpen((value) => !value)} aria-expanded={closingsOpen}>{text.closings}<span>{Object.values(sideClosings).filter((value) => value !== "none").length}</span></button>
        <span>{selectedSegment ? `${segmentLabel(selectedSegment)} · ${(selectedSegment.lengthMm / 1000).toFixed(2)} M` : text.chooseSegment}</span>
        <button className={`night-control ${night ? "active" : ""}`} onClick={() => {
          const next = !night;
          setNight(next);
          setTilt(next ? 34 : 0);
          emit(scene, "night", next);
          const theme = next ? "dark" : "light";
          document.documentElement.dataset.theme = theme;
          localStorage.setItem("360-theme", theme);
          window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
        }}>{night ? text.day : text.night}</button>
      </div>
      {closingsOpen && selectedSegment && <div className="pergola-closing-editor">
        <div className="pergola-segment-plan" style={{ "--plan-aspect": Math.min(3.2, Math.max(0.7, width / depth)) } as CSSProperties} aria-label={text.chooseSegment}>
          <div>
            {pergolaGrid.segments.map((segment) => {
              const x = (column: number) => (column / (pergolaGrid.columns - 1)) * 100;
              const y = (row: number) => 100 - (row / (pergolaGrid.rows - 1)) * 100;
              const style = segment.axis === "horizontal"
                ? { left: `${x(segment.column)}%`, top: `${y(segment.row)}%`, width: `${x(segment.column + 1) - x(segment.column)}%` }
                : { left: `${x(segment.column)}%`, top: `${Math.min(y(segment.row), y(segment.row + 1))}%`, height: `${Math.abs(y(segment.row + 1) - y(segment.row))}%` };
              return <button key={segment.id} type="button" style={style} className={`${segment.axis} ${selectedSegmentId === segment.id ? "selected" : ""} ${sideClosings[segment.id] !== "none" ? "configured" : ""}`} aria-label={segmentLabel(segment)} aria-pressed={selectedSegmentId === segment.id} onClick={() => setSelectedSegmentId(segment.id)} />;
            })}
            {pergolaGrid.poles.map((pole) => <i key={pole.id} style={{ left: `${(pole.column / (pergolaGrid.columns - 1)) * 100}%`, top: `${100 - (pole.row / (pergolaGrid.rows - 1)) * 100}%` }} />)}
          </div>
        </div>
        <div className="pergola-closing-types">
          <header><span>{segmentLabel(selectedSegment)}</span><b>{(selectedSegment.lengthMm / 1000).toFixed(2)} M</b></header>
          <div>{closingOptions.map(([value, label]) => <button key={value} type="button" className={sideClosings[selectedSegment.id] === value ? "active" : ""} onClick={() => {
            const next = { ...sideClosings, [selectedSegment.id]: value };
            setSideClosings(next);
            emit(scene, "sideClosings", next);
          }}>{label}</button>)}</div>
        </div>
      </div>}
      {night && <div className="lighting-console">
        <button className={`led-switch ${led ? "active" : ""}`} onClick={() => { const next = !led; setLed(next); emit(scene, "led", next); }}><i />{text.perimeter}</button>
        <div className="led-colors" aria-label="LED color">
          {ledColors.map(([color, label]) => <button key={color} className={ledColor === color ? "active" : ""} title={label} style={{ "--led-color": color } as CSSProperties} onClick={() => { setLedColor(color); emit(scene, "ledColor", color); }}><i /><span>{label}</span></button>)}
        </div>
        <div className="spotlight-stepper"><span>{text.spots}</span><button onClick={() => { const next = Math.max(0, spotlights - 1); setSpotlights(next); emit(scene, "spotlights", next); }}>−</button><b>{spotlights}</b><button onClick={() => { const next = Math.min(8, spotlights + 1); setSpotlights(next); emit(scene, "spotlights", next); }}>+</button></div>
      </div>}
      </div>
    </div>
  );
}

export function ShowcaseControls(props: { scene: ConfiguratorSlug; controls?: string[]; locale?: Locale }) {
  if (props.scene === "hall") return <HallControls locale={props.locale ?? "en"} />;
  if (props.scene === "solar") return <SolarControls locale={props.locale ?? "en"} />;
  if (props.scene === "fence") return <FenceControls locale={props.locale ?? "en"} />;
  return <LegacyShowcaseControls {...props} />;
}
