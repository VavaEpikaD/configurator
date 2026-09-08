import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { SmoothScroll } from "./smooth-scroll";
import { DeferredWebGLStage } from "./deferred-webgl-stage";
import { ShowcaseControls } from "./showcase-controls";
import { SceneInteractor } from "./scene-interactor";
import { WindowConfiguratorPreview, WindowHeroRuntime } from "./window-preview";
import { CapabilityCube, ProductFeatureCube } from "./capability-cube";
import { getLocalizedConfigurators } from "../lib/configurators-localized";
import { homeCopy, localizedPath, type Locale, uiCopy } from "../lib/i18n";
import { absoluteUrl, graphSchema, organizationSchema, siteUrl, SITE_URL, websiteSchema } from "../lib/seo";

export function LocalizedHome({ locale }: { locale: Locale }) {
  const copy = homeCopy[locale];
  const ui = uiCopy[locale];
  const configurators = getLocalizedConfigurators(locale);
  const schemaDescription = locale === "ro" ? "Configuratoare 3D pentru produse industriale complexe, cu reguli tehnice, prețuri și liste de materiale." : locale === "de" ? "Visuelle und räumliche 3D-Produktkonfiguration für komplexe Industrieprodukte." : "Industrial 3D visual and spatial product configuration for complex products.";
  const structuredData = graphSchema([
    organizationSchema(locale, schemaDescription),
    websiteSchema(locale, schemaDescription),
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl(locale)}#webpage`,
      url: absoluteUrl(locale),
      name: copy.heroA,
      description: schemaDescription,
      inLanguage: locale,
      isPartOf: { "@id": `${siteUrl(locale)}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "ItemList",
      "@id": `${absoluteUrl(locale)}#configurators`,
      name: copy.systemsA,
      numberOfItems: configurators.length,
      itemListElement: configurators.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.title,
        url: absoluteUrl(locale, `/configurators/${item.slug}`),
      })),
    },
  ]);
  return (
    <main className="site-shell home-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SmoothScroll /><DeferredWebGLStage /><WindowHeroRuntime /><SiteHeader locale={locale} currentPath={localizedPath(locale)} />

      <section className="spatial-hero" data-scene="engine" id="top">
        <div className="hero-sticky page-frame">
          <div className="hero-index mono-label"><span>01</span> {copy.heroLabel.replace("01 / ", "")}</div>
          <h1>{copy.heroA}<span>{copy.heroB}</span></h1>
          <div className="hero-copy"><p>{copy.heroCopy}</p><a className="text-link" href="#configurators">{copy.explore} <span>↓</span></a></div>
          <div className="hero-axis" aria-hidden="true"><span>X 05.420</span><i /><span>Y 08.160</span></div>
        </div>
        <div className="hero-chapter chapter-debug page-frame"><div><span className="mono-label">{copy.stage2}</span><h2>{copy.breakA}<br/>{copy.breakB}</h2></div><p>{copy.breakCopy}</p></div>
        <div className="hero-chapter chapter-material page-frame"><div><span className="mono-label">{copy.stage3}</span><h2>{copy.surfaceA}<br/>{copy.surfaceB}</h2></div><p>{copy.surfaceCopy}</p></div>
        <div className="scroll-meter mono-label"><span>{copy.scroll}</span><i /></div>
      </section>

      <CapabilityCube locale={locale} />

      <section className="platform-manifesto" id="platform"><div className="page-frame manifesto-grid" data-reveal>
        <p className="mono-label">{copy.thesis}</p><h2>{copy.thesisA}<br/><em>{copy.thesisB}</em></h2><p className="manifesto-copy">{copy.thesisCopy}</p>
        <div className="manifesto-data"><span><b>3D</b>{copy.spatial}</span><span><b>BOM</b>{copy.resolved}</span><span><b>API</b>{copy.connected}</span></div>
      </div></section>

      <section className="configurator-sequence" id="configurators">
        <div className="sequence-intro page-frame" data-reveal><span className="mono-label">{copy.systems}</span><h2>{copy.systemsA}<br/>{copy.systemsB}</h2><p className="sequence-intro-copy">{copy.systemsCopy}</p></div>
        {configurators.map((item) => <article className={`spatial-showcase showcase-${item.slug}`} data-scene={item.slug} key={item.slug}>
          <div className="showcase-sticky page-frame">
            <div className="showcase-features"><ProductFeatureCube features={item.features} label={item.title} locale={locale} /></div>
            <div className="showcase-viewport" aria-label={`${item.title} ${ui.preview}`}>
              {item.slug === "window" ? <WindowConfiguratorPreview locale={locale} /> : <SceneInteractor scene={item.slug} locale={locale} />}
              <div className="viewport-brackets" aria-hidden="true"><i/><i/><i/><i/></div><span className="viewport-status mono-label"><i/> {ui.preview}</span>
              {item.slug !== "window" && <ShowcaseControls scene={item.slug} controls={item.controls} locale={locale} />}
            </div>
            <div className="showcase-story"><span className="mono-label">{copy.interactive} / {item.index}</span><h3>{item.shortTitle}</h3><p className="showcase-statement">{item.statement}</p><p>{item.description}</p>
              <div className="showcase-links"><a className="text-link" href={localizedPath(locale, `/configurators/${item.slug}`)}>{copy.viewCase} <span>→</span></a><a className="launch-link" href={item.launchUrl} target="_blank" rel="noreferrer">{copy.launch} <span>↗</span></a></div>
            </div>
          </div>
        </article>)}
      </section>

      <section className="custom-showcase" id="custom-system"><div className="page-frame custom-showcase-grid">
        <div className="custom-feature-column"><ProductFeatureCube label={copy.customViewport} locale={locale} features={copy.customFeatures.map(([title, short, body]) => ({ title, short, body }))}/></div>
        <div className="custom-blueprint" aria-label={copy.customViewport}><div className="viewport-brackets" aria-hidden="true"><i/><i/><i/><i/></div><span className="viewport-status mono-label"><i/> {copy.customViewport}</span><div className="blueprint-flow"><article><span>01 / INPUT</span><strong>CAD</strong><small>{copy.customStatus}</small></article><i>→</i><article><span>02 / LOGIC</span><strong>RULES</strong><small>{copy.customSignal}</small></article><i>→</i><article><span>03 / SYSTEM</span><strong>360°</strong><small>CONFIGURE / PRICE / OUTPUT</small></article></div><div className="blueprint-product"><i/><i/><i/><i/><div><span>PRODUCT</span><b>STATE</b></div></div></div>
        <div className="custom-showcase-story"><span className="mono-label">{copy.customLabel.replace("06 /", "07 /")}</span><h2>{copy.customA}<br/><em>{copy.customB}</em></h2><p className="custom-statement">{copy.customStatement}</p><p>{copy.customCopy}</p><div className="custom-showcase-actions"><a className="launch-link" href={`${localizedPath(locale, "/contact")}?project=custom-system`}>{copy.customCta}<span>↗</span></a><a className="text-link" href={`${localizedPath(locale, "/pricing")}#deployment-paths`}>{copy.customPricing}<span>→</span></a></div></div>
      </div></section>

      <section className="capability-field"><div className="page-frame"><div className="capability-heading" data-reveal><span className="mono-label">{copy.pipeline}</span><h2>{copy.pipelineA}<br/><em>{copy.pipelineB}</em></h2></div>
        <div className="capability-list">{copy.capabilities.map(([title, body], index) => <article key={title} data-reveal><span>0{index+1}</span><h3>{title}</h3><p>{body}</p><i>↗</i></article>)}</div>
      </div></section>

      <section className="process-section" id="process"><div className="page-frame process-layout" data-reveal><div><span className="mono-label">{copy.processLabel}</span><h2>{copy.processA}<br/>{copy.processB}</h2></div>
        <ol>{copy.steps.map(([title, body], index) => <li key={title}><span>0{index+1}</span><strong>{title}</strong><p>{body}</p></li>)}</ol>
      </div></section>

      <section className="final-cta"><div className="cta-orbit" aria-hidden="true"><i/><i/><i/></div><div className="page-frame" data-reveal><span className="mono-label">{copy.ctaLabel}</span><h2>{copy.ctaA}<br/><em>{copy.ctaB}</em></h2><p>{copy.ctaCopy}</p><a className="project-link" href={localizedPath(locale, "/contact")}><span>{copy.start}</span><b>↗</b></a></div></section>
      <SiteFooter locale={locale} />
    </main>
  );
}
