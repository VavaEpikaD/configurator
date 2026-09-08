import { normalizeConfiguratorLocale } from '../../shared-ui/src/i18n.js';
import { getLocaleForHostname } from '../../shared-ui/src/config.js';

const MESSAGES = Object.freeze({
  'en-US': Object.freeze({
    'brand.subtitle': 'Parametric roof studio',
    'common.live': 'Live',
    'step.1': 'Step 1',
    'step.2': 'Step 2',
    'step.3': 'Step 3',
    'roof.type': 'Roof type',
    'roof.type.gable': '2 slopes',
    'roof.type.hip': '4 slopes',
    'roof.type.shed': '1 slope',
    'roof.type.lshape': 'L-shaped',
    'roof.type.dormer': 'Dormer',
    'roof.type.custom': 'Custom',
    'roof.name.gable': 'Two-slope roof',
    'roof.name.hip': 'Four-slope roof',
    'roof.name.shed': 'Single-slope roof',
    'roof.name.lshape': 'L-shaped roof',
    'roof.name.dormer': 'Two-slope roof with dormer',
    'roof.name.custom': 'Custom roof plan',
    'custom.uploadTitle': 'Upload custom roof planning',
    'custom.uploadBody': 'Proof of concept only — the file will be stored in this browser session but is not processed yet.',
    'custom.choose': 'Choose a plan or drop it here',
    'custom.fileTypes': 'PDF, image, DWG or DXF',
    'custom.noFile': 'No file selected',
    'custom.removeAria': 'Remove uploaded plan',
    'custom.viewerTitle': 'Custom plan mode',
    'custom.viewerBody': 'Upload is available as a proof of concept. Automatic geometry generation is not implemented yet.',
    'custom.unknownFileType': 'Unknown file type',
    'custom.uploadedFuture': '{size} · Uploaded for future processing',
    'dimensions.title': 'Dimensions',
    'dimensions.length': 'Length',
    'dimensions.depth': 'Depth',
    'dimensions.wallHeight': 'Wall height',
    'dimensions.pitch': 'Roof pitch',
    'dimensions.overhang': 'Eaves overhang',
    'dimensions.aria.length': 'Length in {unit}',
    'dimensions.aria.depth': 'Depth in {unit}',
    'dimensions.aria.wallHeight': 'Wall height in {unit}',
    'dimensions.aria.pitch': 'Roof pitch in degrees',
    'dimensions.aria.overhang': 'Eaves overhang in {unit}',
    'units.decimalFeet': 'decimal feet',
    'units.millimeters': 'millimeters',
    'covering.title': 'Covering',
    'covering.preset': 'Material preset',
    'covering.generic': 'Generic metal tile',
    'covering.roca': 'Mineral-granule metal tile',
    'covering.teclado': 'Slate-style mineral tile',
    'covering.rule.generic': 'Visualization preset - pitch is freely adjustable.',
    'covering.rule.roca': 'Mineral-granule roof preset: minimum visual pitch is set to 14°.',
    'covering.rule.teclado': 'Slate-style mineral tile preset: minimum visual pitch is set to 18°.',
    'covering.colour': 'Roof colour',
    'colour.burgundy': 'Burgundy',
    'colour.graphite': 'Graphite',
    'colour.brown': 'Brown',
    'colour.terracotta': 'Terracotta',
    'colour.forestGreen': 'Forest green',
    'viewer.bomPrice': 'BOM & price',
    'viewer.cameraControls': 'Camera controls',
    'viewer.front': 'Front',
    'viewer.top': 'Top',
    'viewer.reset': 'Reset',
    'viewer.resetTitle': 'Reset view',
    'viewer.modelOptions': 'Model display options',
    'viewer.technicalEdges': 'Technical edges',
    'viewer.realtime': 'Real-time model',
    'viewer.toolsControl': 'Tools control',
    'viewer.canvasAria': 'Interactive 3D roof model',
    'viewer.stageHint': 'Drag to orbit · Scroll to zoom · Right-drag to pan',
    'metrics.footprint': 'Footprint',
    'metrics.roofArea': 'Approx. roof area',
    'metrics.ridge': 'Ridge elevation',
    'metrics.pitch': 'Pitch',
    'sidebar.aria': 'Roof configuration controls',
    'sidebar.show': 'Show roof settings',
    'sidebar.hide': 'Hide roof settings',
    'environment.title': 'Light & orientation',
    'environment.closeAria': 'Close light and orientation menu',
    'environment.sun': 'Sun position',
    'environment.morning': 'Morning',
    'environment.evening': 'Evening',
    'environment.north': 'North direction',
    'environment.night': 'Night preview',
    'environment.nightHelp': 'Preview the configured lighting.',
    'tools.environmentTitle': 'Sun and orientation',
    'tools.dimensions': 'Toggle dimensions',
    'tools.dimensionsUnavailable': 'Dimensions unavailable for custom plans',
    'tools.hideCompass': 'Hide compass',
    'tools.showCompass': 'Show compass',
    'tools.components': 'Rainwater components',
    'tools.openComponents': 'Open rainwater components',
    'tools.closeComponents': 'Close rainwater components',
    'tools.changeOrientation': 'Change orientation: {view}',
    'reset.confirm': 'Reset the roof to its starting configuration?',
    'feedback.languageSwitchUnavailable': 'Could not preserve this configuration while changing language. Please try again.',
    'components.eyebrow': 'Reference library',
    'components.title': 'Rainwater system',
    'components.closeAria': 'Close rainwater components',
    'components.searchLabel': 'Search components',
    'components.searchPlaceholder': 'Gutter, bracket, downpipe…',
    'components.count': '21 parts',
    'components.overviewAlt': 'Exploded reference view of the rainwater system components',
    'components.overviewTitle': 'System overview',
    'components.overviewBody': 'The numbered view matches the cards. This catalog is visual reference only and is not yet connected to the 3D model or BOM.',
    'components.resultsAria': 'Rainwater components',
    'components.empty': 'No components match this search.',
    'bom.eyebrow': 'Proof-of-concept estimate',
    'bom.title': 'Bill of materials',
    'bom.closeAria': 'Close BOM',
    'bom.summaryAria': 'Price summary',
    'bom.withoutVat': 'Without VAT',
    'bom.vat': 'VAT 19%',
    'bom.estimatedTotal': 'Estimated total',
    'bom.disclaimer': 'Quantities are generated from the current roof geometry. Unit prices are copied from the supplied reference offer dated 30/10/2024 and are reused for every covering preset. This is not a construction quotation.',
    'bom.selectionAria': 'BOM inclusion controls',
    'bom.selectionStatus': '{included} of {total} items included',
    'bom.includeAll': 'Include all',
    'bom.excludeAll': 'Exclude all',
    'bom.toggleAllAria': 'Include or exclude all BOM items',
    'bom.table.number': 'No.',
    'bom.table.product': 'Product',
    'bom.table.unit': 'Unit',
    'bom.table.quantity': 'Qty.',
    'bom.table.unitPrice': 'Unit price',
    'bom.table.value': 'Value',
    'bom.calculationBasis': 'Calculation basis',
    'bom.excludedParameters': 'Roof-window items and the advance-payment row from the reference offer are excluded because the configurator does not currently expose those parameters.',
    'bom.exportCsv': 'Export CSV',
    'bom.done': 'Done',
    'bom.awaitingPlan': 'Awaiting plan',
    'bom.noBom': 'No BOM generated',
    'bom.customParsingUnavailable': 'Custom plan parsing is not implemented in this proof of concept.',
    'bom.planStatus': 'Plan status',
    'bom.fileSelected': 'File selected',
    'bom.awaitingUpload': 'Awaiting upload',
    'bom.customCurrencyNote': ' Currency conversion will be applied after a custom plan can generate a BOM.',
    'bom.includeLineAria': 'Include {name} in BOM',
    'bom.assumption.roofArea': 'Roof area',
    'bom.assumption.ridge': 'Ridge / hip lines',
    'bom.assumption.eaves': 'Eaves / gutters',
    'bom.assumption.gable': 'Gable edges',
    'bom.assumption.valleys': 'Valleys',
    'bom.assumption.panelCoverage': 'Panel coverage',
    'bom.assumption.tileWaste': 'Tile waste',
    'bom.currency.ron': ' Prices are shown in RON, the original currency of the reference offer.',
    'bom.currency.converted': ' Converted at 1 RON = {rate} {currency}{date}, using {source}{fallback}.',
    'bom.currency.date': ' for {date}',
    'bom.currency.fallback': ' (temporary offline fallback)',
    'rate.reference': 'reference currency',
    'rate.temporaryFallback': 'temporary fallback estimate',
    'rate.cached': 'cached daily reference rate',
    'rate.frankfurter': 'Frankfurter daily reference rate',
    'rate.offlineFallback': 'offline fallback estimate',
    'unit.piece': 'pcs.',
    'unit.box': 'box',
    'unit.roll': 'roll',
    'bom.line.tile.generic': 'Metal roof tile – generic preset',
    'bom.line.tile.roca': 'Lindab Roca Rustica mineral-granule metal tile',
    'bom.line.tile.teclado': 'Lindab Roca Teclado mineral-granule metal tile',
    'bom.line.screws': 'Lindab self-drilling timber screw',
    'bom.line.membrane': 'LAF75 anti-condensation membrane',
    'bom.line.ridge': 'Round ridge cap',
    'bom.line.ridgeShed': 'Ridge / upper closure',
    'bom.line.ridgeCap': 'Round ridge end cap',
    'bom.line.gableTrim': 'Rectangular gable trim',
    'bom.line.sideFlashing': 'Side flashing / valley',
    'bom.line.eavesApron': 'Lindab Roca eaves apron',
    'bom.line.flatSheet': 'Granulated flat sheet',
    'bom.line.gutter': 'Gutter',
    'bom.line.gutterJoint': 'Gutter connector',
    'bom.line.gutterCap': 'Gutter end cap',
    'bom.line.hanger': 'Gutter hook',
    'bom.line.gutterOutlet': 'Gutter-to-downpipe outlet',
    'bom.line.downpipeElbow': 'Downpipe elbow',
    'bom.line.downpipeExtension': '1 m downpipe extension',
    'bom.line.downpipe': 'Downpipe',
    'bom.line.downpipeBracket': 'Downpipe bracket',
    'bom.line.dischargeElbow': 'Discharge elbow',
    'bom.note.tile': 'POC reference price; 5% waste included',
    'bom.note.membrane': '20% overlap allowance included',
    'csv.number': 'No.',
    'csv.name': 'Description',
    'csv.unit': 'Unit',
    'csv.quantity': 'Qty.',
    'csv.unitPrice': 'Unit price excl. VAT ({currency})',
    'csv.value': 'Value excl. VAT ({currency})',
    'csv.vat': 'VAT ({currency})',
    'csv.vatRate': 'VAT {rate}%',
    'csv.subtotal': 'Total excl. VAT',
    'csv.total': 'Total due',
    'csv.displayCurrency': 'Display currency',
    'csv.rateAgainstRon': 'Rate against RON',
    'csv.rateSource': 'Rate source',
    'compass.north': 'N',
    'compass.east': 'E',
    'compass.south': 'S',
    'compass.west': 'W',
  }),
  'ro-RO': Object.freeze({
    'brand.subtitle': 'Studio parametric pentru acoperișuri',
    'common.live': 'Live',
    'step.1': 'Pasul 1',
    'step.2': 'Pasul 2',
    'step.3': 'Pasul 3',
    'roof.type': 'Tip acoperiș',
    'roof.type.gable': '2 ape',
    'roof.type.hip': '4 ape',
    'roof.type.shed': '1 apă',
    'roof.type.lshape': 'În formă de L',
    'roof.type.dormer': 'Cu lucarnă',
    'roof.type.custom': 'Personalizat',
    'roof.name.gable': 'Acoperiș în două ape',
    'roof.name.hip': 'Acoperiș în patru ape',
    'roof.name.shed': 'Acoperiș într-o apă',
    'roof.name.lshape': 'Acoperiș în formă de L',
    'roof.name.dormer': 'Acoperiș în două ape cu lucarnă',
    'roof.name.custom': 'Plan de acoperiș personalizat',
    'custom.uploadTitle': 'Încarcă planul unui acoperiș personalizat',
    'custom.uploadBody': 'Doar dovadă de concept — fișierul este păstrat în această sesiune de browser, dar nu este procesat încă.',
    'custom.choose': 'Alege un plan sau trage-l aici',
    'custom.fileTypes': 'PDF, imagine, DWG sau DXF',
    'custom.noFile': 'Niciun fișier selectat',
    'custom.removeAria': 'Elimină planul încărcat',
    'custom.viewerTitle': 'Mod plan personalizat',
    'custom.viewerBody': 'Încărcarea este disponibilă ca dovadă de concept. Generarea automată a geometriei nu este încă implementată.',
    'custom.unknownFileType': 'Tip de fișier necunoscut',
    'custom.uploadedFuture': '{size} · Încărcat pentru procesare viitoare',
    'dimensions.title': 'Dimensiuni',
    'dimensions.length': 'Lungime',
    'dimensions.depth': 'Adâncime',
    'dimensions.wallHeight': 'Înălțime pereți',
    'dimensions.pitch': 'Pantă acoperiș',
    'dimensions.overhang': 'Streașină',
    'dimensions.aria.length': 'Lungime în {unit}',
    'dimensions.aria.depth': 'Adâncime în {unit}',
    'dimensions.aria.wallHeight': 'Înălțime pereți în {unit}',
    'dimensions.aria.pitch': 'Pantă acoperiș în grade',
    'dimensions.aria.overhang': 'Streașină în {unit}',
    'units.decimalFeet': 'picioare zecimale',
    'units.millimeters': 'milimetri',
    'covering.title': 'Învelitoare',
    'covering.preset': 'Tip de învelitoare',
    'covering.generic': 'Țiglă metalică generică',
    'covering.roca': 'Țiglă metalică cu granule minerale',
    'covering.teclado': 'Țiglă minerală aspect ardezie',
    'covering.rule.generic': 'Pentru această învelitoare, panta poate fi reglată liber.',
    'covering.rule.roca': 'Pentru învelitoarea cu granule minerale, panta minimă afișată este 14°.',
    'covering.rule.teclado': 'Pentru învelitoarea cu aspect de ardezie, panta minimă afișată este 18°.',
    'covering.colour': 'Culoare acoperiș',
    'colour.burgundy': 'Bordo',
    'colour.graphite': 'Grafit',
    'colour.brown': 'Maro',
    'colour.terracotta': 'Teracotă',
    'colour.forestGreen': 'Verde pădure',
    'viewer.bomPrice': 'Materiale și preț',
    'viewer.cameraControls': 'Comenzi cameră',
    'viewer.front': 'Față',
    'viewer.top': 'Sus',
    'viewer.reset': 'Resetare',
    'viewer.resetTitle': 'Resetează vederea',
    'viewer.modelOptions': 'Opțiuni afișare model',
    'viewer.technicalEdges': 'Muchii tehnice',
    'viewer.realtime': 'Model în timp real',
    'viewer.toolsControl': 'Comandă instrumente',
    'viewer.canvasAria': 'Model 3D interactiv al acoperișului',
    'viewer.stageHint': 'Trage pentru rotire · Derulează pentru zoom · Trage cu butonul dreapta pentru panoramare',
    'metrics.footprint': 'Amprentă',
    'metrics.roofArea': 'Suprafață aprox. acoperiș',
    'metrics.ridge': 'Cota coamei',
    'metrics.pitch': 'Pantă',
    'sidebar.aria': 'Comenzi configurare acoperiș',
    'sidebar.show': 'Arată setările acoperișului',
    'sidebar.hide': 'Ascunde setările acoperișului',
    'environment.title': 'Lumină și orientare',
    'environment.closeAria': 'Închide meniul lumină și orientare',
    'environment.sun': 'Poziția soarelui',
    'environment.morning': 'Dimineață',
    'environment.evening': 'Seară',
    'environment.north': 'Direcția nordului',
    'environment.night': 'Previzualizare nocturnă',
    'environment.nightHelp': 'Previzualizează iluminarea configurată.',
    'tools.environmentTitle': 'Soare și orientare',
    'tools.dimensions': 'Afișează/ascunde dimensiunile',
    'tools.dimensionsUnavailable': 'Dimensiunile nu sunt disponibile pentru planurile personalizate',
    'tools.hideCompass': 'Ascunde busola',
    'tools.showCompass': 'Arată busola',
    'tools.components': 'Componente pluviale',
    'tools.openComponents': 'Deschide componentele pluviale',
    'tools.closeComponents': 'Închide componentele pluviale',
    'tools.changeOrientation': 'Schimbă orientarea: {view}',
    'reset.confirm': 'Resetezi acoperișul la configurația inițială?',
    'feedback.languageSwitchUnavailable': 'Configurația nu a putut fi păstrată la schimbarea limbii. Încearcă din nou.',
    'components.eyebrow': 'Bibliotecă de referință',
    'components.title': 'Sistem pluvial',
    'components.closeAria': 'Închide componentele sistemului pluvial',
    'components.searchLabel': 'Caută componente',
    'components.searchPlaceholder': 'Jgheab, cârlig, burlan…',
    'components.count': '21 componente',
    'components.overviewAlt': 'Vedere explodată de referință a componentelor sistemului pluvial',
    'components.overviewTitle': 'Prezentare sistem',
    'components.overviewBody': 'Vederea numerotată corespunde cardurilor. Acest catalog este doar o referință vizuală și nu este încă legat de modelul 3D sau de BOM.',
    'components.resultsAria': 'Componente sistem pluvial',
    'components.empty': 'Nicio componentă nu corespunde căutării.',
    'bom.eyebrow': 'Estimare dovadă de concept',
    'bom.title': 'Listă de materiale',
    'bom.closeAria': 'Închide lista de materiale',
    'bom.summaryAria': 'Sumar preț',
    'bom.withoutVat': 'Fără TVA',
    'bom.vat': 'TVA 19%',
    'bom.estimatedTotal': 'Total estimat',
    'bom.disclaimer': 'Cantitățile sunt generate din geometria curentă a acoperișului. Prețurile unitare sunt preluate din oferta de referință furnizată, datată 30/10/2024, și sunt reutilizate pentru toate preseturile de învelitoare. Aceasta nu este o ofertă de execuție.',
    'bom.selectionAria': 'Comenzi includere BOM',
    'bom.selectionStatus': '{included} din {total} articole incluse',
    'bom.includeAll': 'Include tot',
    'bom.excludeAll': 'Exclude tot',
    'bom.toggleAllAria': 'Include sau exclude toate articolele BOM',
    'bom.table.number': 'Nr.',
    'bom.table.product': 'Produs',
    'bom.table.unit': 'U.M.',
    'bom.table.quantity': 'Cant.',
    'bom.table.unitPrice': 'Preț unitar',
    'bom.table.value': 'Valoare',
    'bom.calculationBasis': 'Baza de calcul',
    'bom.excludedParameters': 'Articolele pentru ferestre de acoperiș și rândul de avans din oferta de referință sunt excluse deoarece configuratorul nu expune în prezent acești parametri.',
    'bom.exportCsv': 'Exportă CSV',
    'bom.done': 'Gata',
    'bom.awaitingPlan': 'Se așteaptă planul',
    'bom.noBom': 'BOM negenerat',
    'bom.customParsingUnavailable': 'Interpretarea planului personalizat nu este implementată în această dovadă de concept.',
    'bom.planStatus': 'Stare plan',
    'bom.fileSelected': 'Fișier selectat',
    'bom.awaitingUpload': 'Se așteaptă încărcarea',
    'bom.customCurrencyNote': ' Conversia valutară va fi aplicată după ce planul personalizat va putea genera un BOM.',
    'bom.includeLineAria': 'Include {name} în BOM',
    'bom.assumption.roofArea': 'Suprafață acoperiș',
    'bom.assumption.ridge': 'Coame / muchii de șold',
    'bom.assumption.eaves': 'Streașini / jgheaburi',
    'bom.assumption.gable': 'Muchii fronton',
    'bom.assumption.valleys': 'Dolii',
    'bom.assumption.panelCoverage': 'Acoperire panou',
    'bom.assumption.tileWaste': 'Pierderi țiglă',
    'bom.currency.ron': ' Prețurile sunt afișate în RON, moneda originală a ofertei de referință.',
    'bom.currency.converted': ' Conversie la 1 RON = {rate} {currency}{date}, folosind {source}{fallback}.',
    'bom.currency.date': ' pentru {date}',
    'bom.currency.fallback': ' (estimare offline temporară)',
    'rate.reference': 'monedă de referință',
    'rate.temporaryFallback': 'estimare temporară de rezervă',
    'rate.cached': 'curs zilnic de referință memorat',
    'rate.frankfurter': 'curs zilnic de referință Frankfurter',
    'rate.offlineFallback': 'estimare offline de rezervă',
    'unit.piece': 'buc.',
    'unit.box': 'cut.',
    'unit.roll': 'rolă',
    'bom.line.tile.generic': 'Țiglă metalică – preset generic',
    'bom.line.tile.roca': 'Țiglă metalică granulată Lindab Roca Rustica',
    'bom.line.tile.teclado': 'Țiglă metalică granulată Lindab Roca Teclado',
    'bom.line.screws': 'Șurub autofiletant Lindab pentru lemn',
    'bom.line.membrane': 'Folie anticondens LAF75',
    'bom.line.ridge': 'Coamă rotundă',
    'bom.line.ridgeShed': 'Coamă / închidere superioară',
    'bom.line.ridgeCap': 'Capac coamă rotundă',
    'bom.line.gableTrim': 'Fronton rectangular',
    'bom.line.sideFlashing': 'Racord lateral / dolie',
    'bom.line.eavesApron': 'Șorț streașină Lindab Roca',
    'bom.line.flatSheet': 'Tablă plană granulată',
    'bom.line.gutter': 'Jgheab',
    'bom.line.gutterJoint': 'Element îmbinare jgheab',
    'bom.line.gutterCap': 'Capac jgheab',
    'bom.line.hanger': 'Cârlig',
    'bom.line.gutterOutlet': 'Racord jgheab-burlan',
    'bom.line.downpipeElbow': 'Cot burlan',
    'bom.line.downpipeExtension': 'Prelungire burlan 1 m',
    'bom.line.downpipe': 'Burlan',
    'bom.line.downpipeBracket': 'Brățară burlan',
    'bom.line.dischargeElbow': 'Cot de evacuare',
    'bom.note.tile': 'Preț de referință POC; 5% pierderi incluse',
    'bom.note.membrane': '20% suprapuneri incluse',
    'csv.number': 'Nr.',
    'csv.name': 'Denumire',
    'csv.unit': 'U.M.',
    'csv.quantity': 'Cant.',
    'csv.unitPrice': 'Preț unitar fără TVA ({currency})',
    'csv.value': 'Valoare fără TVA ({currency})',
    'csv.vat': 'TVA ({currency})',
    'csv.vatRate': 'TVA {rate}%',
    'csv.subtotal': 'Total fără TVA',
    'csv.total': 'Total plată',
    'csv.displayCurrency': 'Monedă afișată',
    'csv.rateAgainstRon': 'Rată față de RON',
    'csv.rateSource': 'Sursă rată',
    'compass.north': 'N',
    'compass.east': 'E',
    'compass.south': 'S',
    'compass.west': 'V',
  }),
  'de-DE': Object.freeze({
    'brand.subtitle': 'Parametrisches Dachstudio',
    'common.live': 'Live',
    'step.1': 'Schritt 1',
    'step.2': 'Schritt 2',
    'step.3': 'Schritt 3',
    'roof.type': 'Dachform',
    'roof.type.gable': '2 Dachflächen',
    'roof.type.hip': '4 Dachflächen',
    'roof.type.shed': '1 Dachfläche',
    'roof.type.lshape': 'L-förmig',
    'roof.type.dormer': 'Mit Gaube',
    'roof.type.custom': 'Individuell',
    'roof.name.gable': 'Satteldach',
    'roof.name.hip': 'Walmdach',
    'roof.name.shed': 'Pultdach',
    'roof.name.lshape': 'L-förmiges Dach',
    'roof.name.dormer': 'Satteldach mit Gaube',
    'roof.name.custom': 'Individueller Dachplan',
    'custom.uploadTitle': 'Individuelle Dachplanung hochladen',
    'custom.uploadBody': 'Nur als Machbarkeitsnachweis — die Datei wird in dieser Browsersitzung gespeichert, aber noch nicht verarbeitet.',
    'custom.choose': 'Plan auswählen oder hier ablegen',
    'custom.fileTypes': 'PDF, Bild, DWG oder DXF',
    'custom.noFile': 'Keine Datei ausgewählt',
    'custom.removeAria': 'Hochgeladenen Plan entfernen',
    'custom.viewerTitle': 'Modus für individuellen Plan',
    'custom.viewerBody': 'Der Upload ist als Machbarkeitsnachweis verfügbar. Eine automatische Geometrieerzeugung ist noch nicht implementiert.',
    'custom.unknownFileType': 'Unbekannter Dateityp',
    'custom.uploadedFuture': '{size} · Für zukünftige Verarbeitung hochgeladen',
    'dimensions.title': 'Abmessungen',
    'dimensions.length': 'Länge',
    'dimensions.depth': 'Tiefe',
    'dimensions.wallHeight': 'Wandhöhe',
    'dimensions.pitch': 'Dachneigung',
    'dimensions.overhang': 'Dachüberstand',
    'dimensions.aria.length': 'Länge in {unit}',
    'dimensions.aria.depth': 'Tiefe in {unit}',
    'dimensions.aria.wallHeight': 'Wandhöhe in {unit}',
    'dimensions.aria.pitch': 'Dachneigung in Grad',
    'dimensions.aria.overhang': 'Dachüberstand in {unit}',
    'units.decimalFeet': 'Dezimalfuß',
    'units.millimeters': 'Millimeter',
    'covering.title': 'Dacheindeckung',
    'covering.preset': 'Materialvorgabe',
    'covering.generic': 'Generischer Metalldachstein',
    'covering.roca': 'Metalldachstein mit Mineralgranulat',
    'covering.teclado': 'Mineraldachstein in Schieferoptik',
    'covering.rule.generic': 'Visualisierungsvorgabe – die Dachneigung ist frei einstellbar.',
    'covering.rule.roca': 'Vorgabe mit Mineralgranulat: Die minimale visuelle Dachneigung beträgt 14°.',
    'covering.rule.teclado': 'Vorgabe in Schieferoptik: Die minimale visuelle Dachneigung beträgt 18°.',
    'covering.colour': 'Dachfarbe',
    'colour.burgundy': 'Bordeauxrot',
    'colour.graphite': 'Graphit',
    'colour.brown': 'Braun',
    'colour.terracotta': 'Terrakotta',
    'colour.forestGreen': 'Waldgrün',
    'viewer.bomPrice': 'Stückliste & Preis',
    'viewer.cameraControls': 'Kamerasteuerung',
    'viewer.front': 'Vorne',
    'viewer.top': 'Oben',
    'viewer.reset': 'Zurücksetzen',
    'viewer.resetTitle': 'Ansicht zurücksetzen',
    'viewer.modelOptions': 'Modellanzeige',
    'viewer.technicalEdges': 'Technische Kanten',
    'viewer.realtime': 'Echtzeitmodell',
    'viewer.toolsControl': 'Werkzeugsteuerung',
    'viewer.canvasAria': 'Interaktives 3D-Dachmodell',
    'viewer.stageHint': 'Ziehen zum Drehen · Scrollen zum Zoomen · Rechts ziehen zum Verschieben',
    'metrics.footprint': 'Grundfläche',
    'metrics.roofArea': 'Ca. Dachfläche',
    'metrics.ridge': 'Firsthöhe',
    'metrics.pitch': 'Neigung',
    'sidebar.aria': 'Steuerelemente der Dachkonfiguration',
    'sidebar.show': 'Dacheinstellungen anzeigen',
    'sidebar.hide': 'Dacheinstellungen ausblenden',
    'environment.title': 'Licht & Ausrichtung',
    'environment.closeAria': 'Menü Licht und Ausrichtung schließen',
    'environment.sun': 'Sonnenstand',
    'environment.morning': 'Morgen',
    'environment.evening': 'Abend',
    'environment.north': 'Nordrichtung',
    'environment.night': 'Nachtvorschau',
    'environment.nightHelp': 'Konfigurierte Beleuchtung in der Vorschau anzeigen.',
    'tools.environmentTitle': 'Sonne und Ausrichtung',
    'tools.dimensions': 'Bemaßung ein-/ausblenden',
    'tools.dimensionsUnavailable': 'Bemaßung ist für individuelle Pläne nicht verfügbar',
    'tools.hideCompass': 'Kompass ausblenden',
    'tools.showCompass': 'Kompass anzeigen',
    'tools.components': 'Dachentwässerung',
    'tools.openComponents': 'Dachentwässerung öffnen',
    'tools.closeComponents': 'Dachentwässerung schließen',
    'tools.changeOrientation': 'Ausrichtung wechseln: {view}',
    'reset.confirm': 'Dach auf die Ausgangskonfiguration zurücksetzen?',
    'feedback.languageSwitchUnavailable': 'Die Konfiguration konnte beim Sprachwechsel nicht beibehalten werden. Bitte versuchen Sie es erneut.',
    'components.eyebrow': 'Referenzbibliothek',
    'components.title': 'Dachentwässerungssystem',
    'components.closeAria': 'Komponenten der Dachentwässerung schließen',
    'components.searchLabel': 'Komponenten suchen',
    'components.searchPlaceholder': 'Rinne, Halter, Fallrohr…',
    'components.count': '21 Teile',
    'components.overviewAlt': 'Explosionsdarstellung der Komponenten des Dachentwässerungssystems',
    'components.overviewTitle': 'Systemübersicht',
    'components.overviewBody': 'Die nummerierte Darstellung entspricht den Karten. Dieser Katalog dient nur als visuelle Referenz und ist noch nicht mit dem 3D-Modell oder der Stückliste verknüpft.',
    'components.resultsAria': 'Komponenten der Dachentwässerung',
    'components.empty': 'Keine Komponenten entsprechen der Suche.',
    'bom.eyebrow': 'Machbarkeits-Kostenschätzung',
    'bom.title': 'Stückliste',
    'bom.closeAria': 'Stückliste schließen',
    'bom.summaryAria': 'Preisübersicht',
    'bom.withoutVat': 'Ohne MwSt.',
    'bom.vat': 'MwSt. 19 %',
    'bom.estimatedTotal': 'Geschätzter Gesamtpreis',
    'bom.disclaimer': 'Die Mengen werden aus der aktuellen Dachgeometrie ermittelt. Die Einheitspreise stammen aus dem bereitgestellten Referenzangebot vom 30.10.2024 und werden für alle Dacheindeckungsvorgaben wiederverwendet. Dies ist kein Bauangebot.',
    'bom.selectionAria': 'Steuerung der Stücklistenpositionen',
    'bom.selectionStatus': '{included} von {total} Positionen enthalten',
    'bom.includeAll': 'Alle einschließen',
    'bom.excludeAll': 'Alle ausschließen',
    'bom.toggleAllAria': 'Alle Stücklistenpositionen ein- oder ausschließen',
    'bom.table.number': 'Nr.',
    'bom.table.product': 'Produkt',
    'bom.table.unit': 'Einheit',
    'bom.table.quantity': 'Menge',
    'bom.table.unitPrice': 'Einheitspreis',
    'bom.table.value': 'Wert',
    'bom.calculationBasis': 'Berechnungsgrundlage',
    'bom.excludedParameters': 'Dachfensterpositionen und die Vorauszahlungszeile aus dem Referenzangebot sind ausgeschlossen, da der Konfigurator diese Parameter derzeit nicht bereitstellt.',
    'bom.exportCsv': 'CSV exportieren',
    'bom.done': 'Fertig',
    'bom.awaitingPlan': 'Plan ausstehend',
    'bom.noBom': 'Keine Stückliste erzeugt',
    'bom.customParsingUnavailable': 'Die Auswertung eines individuellen Plans ist in diesem Machbarkeitsnachweis nicht implementiert.',
    'bom.planStatus': 'Planstatus',
    'bom.fileSelected': 'Datei ausgewählt',
    'bom.awaitingUpload': 'Upload ausstehend',
    'bom.customCurrencyNote': ' Die Währungsumrechnung wird angewendet, sobald aus einem individuellen Plan eine Stückliste erzeugt werden kann.',
    'bom.includeLineAria': '{name} in die Stückliste aufnehmen',
    'bom.assumption.roofArea': 'Dachfläche',
    'bom.assumption.ridge': 'First- / Gratlinien',
    'bom.assumption.eaves': 'Traufen / Dachrinnen',
    'bom.assumption.gable': 'Ortgangkanten',
    'bom.assumption.valleys': 'Kehlen',
    'bom.assumption.panelCoverage': 'Deckfläche je Element',
    'bom.assumption.tileWaste': 'Verschnitt Dacheindeckung',
    'bom.currency.ron': ' Die Preise werden in RON angezeigt, der ursprünglichen Währung des Referenzangebots.',
    'bom.currency.converted': ' Umgerechnet mit 1 RON = {rate} {currency}{date}, Quelle: {source}{fallback}.',
    'bom.currency.date': ' am {date}',
    'bom.currency.fallback': ' (temporäre Offline-Ersatzschätzung)',
    'rate.reference': 'Referenzwährung',
    'rate.temporaryFallback': 'temporäre Ersatzschätzung',
    'rate.cached': 'zwischengespeicherter täglicher Referenzkurs',
    'rate.frankfurter': 'täglicher Frankfurter-Referenzkurs',
    'rate.offlineFallback': 'Offline-Ersatzschätzung',
    'unit.piece': 'Stk.',
    'unit.box': 'Karton',
    'unit.roll': 'Rolle',
    'bom.line.tile.generic': 'Metalldachstein – generische Vorgabe',
    'bom.line.tile.roca': 'Lindab Roca Rustica Metalldachstein mit Mineralgranulat',
    'bom.line.tile.teclado': 'Lindab Roca Teclado Metalldachstein mit Mineralgranulat',
    'bom.line.screws': 'Lindab selbstbohrende Holzschraube',
    'bom.line.membrane': 'Antikondensationsbahn LAF75',
    'bom.line.ridge': 'Runder First',
    'bom.line.ridgeShed': 'First / oberer Abschluss',
    'bom.line.ridgeCap': 'Runde Firstendkappe',
    'bom.line.gableTrim': 'Rechteckiges Ortgangprofil',
    'bom.line.sideFlashing': 'Seitlicher Anschluss / Kehle',
    'bom.line.eavesApron': 'Lindab Roca Traufblech',
    'bom.line.flatSheet': 'Granuliertes Flachblech',
    'bom.line.gutter': 'Dachrinne',
    'bom.line.gutterJoint': 'Rinnenverbinder',
    'bom.line.gutterCap': 'Rinnenendstück',
    'bom.line.hanger': 'Rinnenhalter',
    'bom.line.gutterOutlet': 'Rinnenstutzen zum Fallrohr',
    'bom.line.downpipeElbow': 'Fallrohrbogen',
    'bom.line.downpipeExtension': 'Fallrohrverlängerung 1 m',
    'bom.line.downpipe': 'Fallrohr',
    'bom.line.downpipeBracket': 'Fallrohrschelle',
    'bom.line.dischargeElbow': 'Auslaufbogen',
    'bom.note.tile': 'POC-Referenzpreis; 5 % Verschnitt enthalten',
    'bom.note.membrane': '20 % Überlappung enthalten',
    'csv.number': 'Nr.',
    'csv.name': 'Bezeichnung',
    'csv.unit': 'Einheit',
    'csv.quantity': 'Menge',
    'csv.unitPrice': 'Einheitspreis ohne MwSt. ({currency})',
    'csv.value': 'Wert ohne MwSt. ({currency})',
    'csv.vat': 'MwSt. ({currency})',
    'csv.vatRate': 'MwSt. {rate} %',
    'csv.subtotal': 'Gesamt ohne MwSt.',
    'csv.total': 'Gesamtbetrag',
    'csv.displayCurrency': 'Anzeigewährung',
    'csv.rateAgainstRon': 'Kurs gegenüber RON',
    'csv.rateSource': 'Kursquelle',
    'compass.north': 'N',
    'compass.east': 'O',
    'compass.south': 'S',
    'compass.west': 'W',
  }),
});

const RAINWATER = Object.freeze({
  'en-US': Object.freeze([
    ['Gutter', 'Collects water from the roof slopes. Available in 3 m and 4 m lengths for easier installation.'],
    ['Downpipe', 'Vertical Ø 90 mm or Ø 100 mm pipe that carries water down to ground level.'],
    ['Internal corner', 'Changes gutter direction by 90° toward the inside corner of the building.'],
    ['External corner', 'Changes gutter direction by 90° around the outside corner of the building.'],
    ['Gutter connector', 'Joins two gutter sections watertight with an integrated rubber seal.'],
    ['Gutter end cap', 'Closes the ends of the gutter. The pre-fitted seal removes the need for additional silicone.'],
    ['Gutter hook 210', 'Long hook for installation on rafters before the roof decking is fitted.'],
    ['Twisted hook', 'Variant for steep roof slopes or an inclined fascia board.'],
    ['Gutter hook 160', 'Short hook for mounting on the fascia or edge board.'],
    ['Combi hook', 'Versatile hook that can be mounted either on the rafter or on the fascia.'],
    ['Adjustable hook', 'Allows the gutter slope to be adjusted after installation.'],
    ['Gutter brace', 'Provides additional gutter restraint in areas with strong wind or heavy snow.'],
    ['Gutter-to-downpipe outlet', 'Connects the gutter to the downpipe using side clips and directs water into the downpipe.'],
    ['60° elbow', 'Connects the outlet to the downpipe or routes around façade elements.'],
    ['Intermediate extension', 'Adjusts the distance between two elbows where the façade has projections.'],
    ['Downpipe clamp', 'Fixes the downpipe to the wall. The recommended maximum spacing between fixings is 2 m.'],
    ['Downpipe bracket', 'Clamp with a rubber spacer that keeps the downpipe away from the wall and reduces noise.'],
    ['Collector hopper', 'Collects water from the gutter into the downpipe, with a larger outlet for higher flow rates.'],
    ['Downpipe branch', 'Allows two downpipes to merge into one, useful for complex roofs.'],
    ['Discharge diverter', 'Diverts water toward a grate, drain or collection tank.'],
    ['Discharge elbow', 'Directs water away from the façade at the base of the downpipe.'],
  ]),
  'ro-RO': Object.freeze([
    ['Jgheab', 'Colectează apa de pe versanți. Disponibil în lungimi de 3 m și 4 m pentru montaj facil.'],
    ['Burlan', 'Tub vertical Ø 90 mm sau Ø 100 mm care coboară apa spre sol.'],
    ['Colțar interior', 'Schimbă direcția jgheabului la 90° spre interiorul clădirii.'],
    ['Colțar exterior', 'Schimbă direcția jgheabului la 90° spre exteriorul clădirii.'],
    ['Element îmbinare jgheab', 'Unește două tronsoane de jgheab etanș, cu garnitură de cauciuc integrată.'],
    ['Capac jgheab', 'Închide capetele jgheabului. Garnitura pre-montată elimină siliconul suplimentar.'],
    ['Cârlig jgheab 210', 'Cârlig lung pentru montaj pe căpriori înainte de astereală.'],
    ['Cârlig răsucit', 'Variantă pentru pantă mare sau fruntar înclinat.'],
    ['Cârlig jgheab 160', 'Cârlig scurt pentru montaj pe fruntar sau scândura de margine.'],
    ['Cârlig combi', 'Cârlig versatil care se poate monta atât pe căprior, cât și pe fruntar.'],
    ['Cârlig reglabil', 'Permite ajustarea pantei jgheabului după montaj.'],
    ['Bridă jgheab', 'Asigură suplimentar jgheabul în zonele cu vânt puternic sau zăpadă mare.'],
    ['Racord jgheab-burlan', 'Leagă jgheabul de burlan prin clemele laterale și conduce apa către burlan.'],
    ['Cot 60°', 'Leagă racordul de burlan sau ocolește elementele fațadei.'],
    ['Prelungitor intermediar', 'Ajustează distanța dintre două coturi atunci când fațada are ieșiri.'],
    ['Colier burlan', 'Fixează burlanul de zid. Distanța maximă recomandată între prinderi este de 2 m.'],
    ['Brățară burlan', 'Colier cu distanțier din cauciuc, care ține burlanul departe de zid și reduce zgomotul.'],
    ['Pâlnie', 'Colectează apa din jgheab către burlan, cu ieșire mărită pentru debite mari.'],
    ['Ramificație burlan', 'Permite unirea a două burlane într-unul singur, utilă pentru acoperișuri complexe.'],
    ['Derivație evacuare', 'Deviază apa spre grilă, canal sau rezervor de colectare.'],
    ['Cot de evacuare', 'Direcționează apa la baza burlanului, departe de fațadă.'],
  ]),
  'de-DE': Object.freeze([
    ['Dachrinne', 'Sammelt das Wasser von den Dachflächen. Für eine einfache Montage in 3 m und 4 m Länge erhältlich.'],
    ['Fallrohr', 'Vertikales Rohr Ø 90 mm oder Ø 100 mm, das das Wasser zum Boden ableitet.'],
    ['Innenecke', 'Ändert die Rinnenrichtung um 90° zur inneren Gebäudeecke.'],
    ['Außenecke', 'Ändert die Rinnenrichtung um 90° um die äußere Gebäudeecke.'],
    ['Rinnenverbinder', 'Verbindet zwei Rinnenstücke dicht mit einer integrierten Gummidichtung.'],
    ['Rinnenendstück', 'Verschließt die Rinnenenden. Die vormontierte Dichtung macht zusätzliches Silikon überflüssig.'],
    ['Rinnenhalter 210', 'Langer Halter zur Montage auf Sparren vor der Dachschalung.'],
    ['Gedrehter Halter', 'Ausführung für große Dachneigungen oder geneigte Stirnbretter.'],
    ['Rinnenhalter 160', 'Kurzer Halter zur Montage am Stirn- oder Randbrett.'],
    ['Kombi-Halter', 'Vielseitiger Halter zur Montage sowohl am Sparren als auch am Stirnbrett.'],
    ['Verstellbarer Halter', 'Ermöglicht die Einstellung des Rinnengefälles nach der Montage.'],
    ['Rinnenstrebe', 'Sichert die Dachrinne zusätzlich in Bereichen mit starkem Wind oder hoher Schneelast.'],
    ['Rinnenstutzen', 'Verbindet die Dachrinne über seitliche Clips mit dem Fallrohr und leitet das Wasser hinein.'],
    ['60°-Bogen', 'Verbindet den Stutzen mit dem Fallrohr oder führt um Fassadenelemente herum.'],
    ['Zwischenverlängerung', 'Passt den Abstand zwischen zwei Bögen bei Vorsprüngen in der Fassade an.'],
    ['Fallrohrschelle', 'Befestigt das Fallrohr an der Wand. Der empfohlene maximale Abstand zwischen den Befestigungen beträgt 2 m.'],
    ['Fallrohrhalter mit Abstand', 'Schelle mit Gummiabstandhalter, die das Fallrohr von der Wand fernhält und Geräusche reduziert.'],
    ['Einlauftrichter', 'Leitet Wasser aus der Rinne in das Fallrohr; mit vergrößertem Auslass für hohe Durchflussmengen.'],
    ['Fallrohrabzweig', 'Ermöglicht das Zusammenführen zweier Fallrohre in ein Rohr, nützlich bei komplexen Dächern.'],
    ['Auslaufweiche', 'Leitet Wasser zu Gitterrost, Ablauf oder Sammelbehälter um.'],
    ['Auslaufbogen', 'Leitet Wasser am Fuß des Fallrohrs von der Fassade weg.'],
  ]),
});

function interpolate(message, variables = {}) {
  return String(message).replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : `{${key}}`
  ));
}

export function roofT(locale, key, variables = {}) {
  const resolved = normalizeConfiguratorLocale(locale);
  const message = MESSAGES[resolved]?.[key] ?? MESSAGES['en-US'][key] ?? key;
  return interpolate(message, variables);
}

export function resolveRoofLocale(locale = null) {
  if (locale) return normalizeConfiguratorLocale(locale);
  return normalizeConfiguratorLocale(getLocaleForHostname(window.location.hostname));
}

export function roofName(locale, roofType) {
  return roofT(locale, `roof.name.${roofType}`);
}

export function pitchRuleText(locale, covering) {
  return roofT(locale, `covering.rule.${covering}`);
}

export function roofRateSource(locale, source) {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'reference' || normalized === 'reference currency') return roofT(locale, 'rate.reference');
  if (normalized === 'temporary-fallback' || normalized === 'temporary fallback estimate') return roofT(locale, 'rate.temporaryFallback');
  if (normalized === 'cached-reference' || normalized === 'cached daily reference rate') return roofT(locale, 'rate.cached');
  if (normalized === 'frankfurter-reference' || normalized === 'frankfurter daily reference rate') return roofT(locale, 'rate.frankfurter');
  if (normalized === 'offline-fallback' || normalized === 'offline fallback estimate') return roofT(locale, 'rate.offlineFallback');
  return source || roofT(locale, 'rate.reference');
}

export function getRoofCompassLabels(locale) {
  return {
    north: roofT(locale, 'compass.north'),
    east: roofT(locale, 'compass.east'),
    south: roofT(locale, 'compass.south'),
    west: roofT(locale, 'compass.west'),
  };
}

function setText(selector, locale, key) {
  const element = document.querySelector(selector);
  if (element) element.textContent = roofT(locale, key);
}

function setAttribute(selector, attribute, locale, key) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, roofT(locale, key));
}

function setLivePill(locale) {
  const pill = document.querySelector('.live-pill');
  if (!pill) return;
  const textNode = [...pill.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = ` ${roofT(locale, 'common.live')}`;
}

function setControlLabel(key, locale, labelKey) {
  setText(`[data-control="${key}"] .control-label b`, locale, labelKey);
}

function setRoofCard(type, locale) {
  setText(`[data-roof-type="${type}"] span`, locale, `roof.type.${type}`);
}

function setCoveringOption(value, locale) {
  setText(`#coveringSelect option[value="${value}"]`, locale, `covering.${value}`);
}

function setSwatch(color, locale, key) {
  setAttribute(`.swatch[data-color="${color}"]`, 'aria-label', locale, key);
}

function setEnvironmentEnd(index, locale, key) {
  const element = document.querySelectorAll('.roof-environment-control__ends')[0]?.querySelectorAll('span')[index];
  if (element) element.textContent = roofT(locale, key);
}

function translateRainwater(locale) {
  const resolved = resolveRoofLocale(locale);
  const components = RAINWATER[resolved] ?? RAINWATER['en-US'];
  document.querySelectorAll('[data-component-card]').forEach((card, index) => {
    const [name, description] = components[index] ?? RAINWATER['en-US'][index] ?? ['', ''];
    const title = card.querySelector('h3');
    const paragraph = card.querySelector('p');
    const image = card.querySelector('img');
    if (title) title.textContent = name;
    if (paragraph) paragraph.textContent = description;
    if (image) image.alt = name;
    card.dataset.search = `${name} ${description}`.toLocaleLowerCase(resolved);
  });
}

export function applyRoofTranslations(locale) {
  const resolved = resolveRoofLocale(locale);
  document.documentElement.lang = resolved.split('-')[0];
  document.body.dataset.roofLocale = resolved;

  setText('.brand-subtitle', resolved, 'brand.subtitle');
  setLivePill(resolved);
  setText('.sidebar .panel-section:nth-of-type(1) .eyebrow', resolved, 'step.1');
  setText('.sidebar .panel-section:nth-of-type(1) h1', resolved, 'roof.type');
  ['gable', 'hip', 'shed', 'lshape', 'dormer', 'custom'].forEach((type) => setRoofCard(type, resolved));
  setText('.custom-plan-copy strong', resolved, 'custom.uploadTitle');
  setText('.custom-plan-copy span', resolved, 'custom.uploadBody');
  setText('.custom-plan-main', resolved, 'custom.choose');
  setText('.custom-plan-types', resolved, 'custom.fileTypes');
  setAttribute('#customPlanRemove', 'aria-label', resolved, 'custom.removeAria');

  setText('.sidebar .panel-section:nth-of-type(2) .eyebrow', resolved, 'step.2');
  setText('.sidebar .panel-section:nth-of-type(2) h2', resolved, 'dimensions.title');
  setControlLabel('length', resolved, 'dimensions.length');
  setControlLabel('depth', resolved, 'dimensions.depth');
  setControlLabel('wallHeight', resolved, 'dimensions.wallHeight');
  setControlLabel('pitch', resolved, 'dimensions.pitch');
  setControlLabel('overhang', resolved, 'dimensions.overhang');

  setText('.sidebar .panel-section:nth-of-type(3) .eyebrow', resolved, 'step.3');
  setText('.sidebar .panel-section:nth-of-type(3) h2', resolved, 'covering.title');
  setText('.select-label[for="coveringSelect"]', resolved, 'covering.preset');
  ['generic', 'roca', 'teclado'].forEach((value) => setCoveringOption(value, resolved));
  setText('.color-heading', resolved, 'covering.colour');
  setAttribute('#swatchRow', 'aria-label', resolved, 'covering.colour');
  setSwatch('#7f1d2d', resolved, 'colour.burgundy');
  setSwatch('#293544', resolved, 'colour.graphite');
  setSwatch('#684230', resolved, 'colour.brown');
  setSwatch('#8a3428', resolved, 'colour.terracotta');
  setSwatch('#315449', resolved, 'colour.forestGreen');

  setText('#bomOpenButton span', resolved, 'viewer.bomPrice');
  setAttribute('.view-actions', 'aria-label', resolved, 'viewer.cameraControls');
  setText('[data-view="front"]', resolved, 'viewer.front');
  setText('[data-view="top"]', resolved, 'viewer.top');
  setText('[data-view="reset"]', resolved, 'viewer.reset');
  setAttribute('[data-view="reset"]', 'title', resolved, 'viewer.resetTitle');
  setAttribute('.model-options', 'aria-label', resolved, 'viewer.modelOptions');
  const technicalLabel = document.querySelector('.model-options label');
  if (technicalLabel) {
    const textNode = [...technicalLabel.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = ` ${roofT(resolved, 'viewer.technicalEdges')}`;
  }
  setText('.viewer-title-block .eyebrow', resolved, 'viewer.realtime');
  setAttribute('#roofToolsAnchor', 'aria-label', resolved, 'viewer.toolsControl');
  setAttribute('#canvasHost', 'aria-label', resolved, 'viewer.canvasAria');
  setText('.stage-hint', resolved, 'viewer.stageHint');
  setText('#customViewerNotice strong', resolved, 'custom.viewerTitle');
  setText('#customViewerNotice p', resolved, 'custom.viewerBody');
  const metricLabels = document.querySelectorAll('.metrics-bar article > span');
  ['metrics.footprint', 'metrics.roofArea', 'metrics.ridge', 'metrics.pitch'].forEach((key, index) => {
    if (metricLabels[index]) metricLabels[index].textContent = roofT(resolved, key);
  });
  setAttribute('.sidebar', 'aria-label', resolved, 'sidebar.aria');

  setText('#roofEnvironmentTitle', resolved, 'environment.title');
  setAttribute('#roofEnvironmentClose', 'aria-label', resolved, 'environment.closeAria');
  setText('label[for="sunPositionControl"]', resolved, 'environment.sun');
  setEnvironmentEnd(0, resolved, 'environment.morning');
  setEnvironmentEnd(1, resolved, 'environment.evening');
  setText('label[for="northDirectionControl"]', resolved, 'environment.north');
  setText('.roof-night-preview__copy strong', resolved, 'environment.night');
  setText('.roof-night-preview__copy small', resolved, 'environment.nightHelp');

  setText('.roof-components-header .eyebrow', resolved, 'components.eyebrow');
  setText('#roofComponentsTitle', resolved, 'components.title');
  setAttribute('#roofComponentsClose', 'aria-label', resolved, 'components.closeAria');
  setText('label[for="roofComponentsSearch"]', resolved, 'components.searchLabel');
  setAttribute('#roofComponentsSearch', 'placeholder', resolved, 'components.searchPlaceholder');
  setText('.roof-components-search-row small', resolved, 'components.count');
  setAttribute('.roof-system-overview img', 'alt', resolved, 'components.overviewAlt');
  setText('.roof-system-overview figcaption strong', resolved, 'components.overviewTitle');
  setText('.roof-system-overview figcaption span', resolved, 'components.overviewBody');
  setAttribute('.roof-component-results', 'aria-label', resolved, 'components.resultsAria');
  setText('#roofComponentsEmpty', resolved, 'components.empty');
  translateRainwater(resolved);

  setText('.bom-header .eyebrow', resolved, 'bom.eyebrow');
  setText('#bomTitle', resolved, 'bom.title');
  setAttribute('#bomCloseButton', 'aria-label', resolved, 'bom.closeAria');
  setAttribute('.bom-summary', 'aria-label', resolved, 'bom.summaryAria');
  const summaryLabels = document.querySelectorAll('.bom-summary article > span');
  ['bom.withoutVat', 'bom.vat', 'bom.estimatedTotal'].forEach((key, index) => {
    if (summaryLabels[index]) summaryLabels[index].textContent = roofT(resolved, key);
  });
  const disclaimer = document.querySelector('.bom-disclaimer');
  if (disclaimer?.firstChild) disclaimer.firstChild.textContent = roofT(resolved, 'bom.disclaimer');
  setAttribute('.bom-selection-toolbar', 'aria-label', resolved, 'bom.selectionAria');
  setText('#bomIncludeAll', resolved, 'bom.includeAll');
  setText('#bomExcludeAll', resolved, 'bom.excludeAll');
  setAttribute('#bomToggleAll', 'aria-label', resolved, 'bom.toggleAllAria');
  const headerCells = document.querySelectorAll('.bom-table thead th');
  ['bom.table.number', 'bom.table.product', 'bom.table.unit', 'bom.table.quantity', 'bom.table.unitPrice', 'bom.table.value'].forEach((key, index) => {
    const cell = headerCells[index + 1];
    if (cell) cell.textContent = roofT(resolved, key);
  });
  setText('.bom-assumptions h3', resolved, 'bom.calculationBasis');
  setText('.bom-assumptions > p', resolved, 'bom.excludedParameters');
  setText('#bomExportButton', resolved, 'bom.exportCsv');
  setText('#bomDoneButton', resolved, 'bom.done');

  window.dispatchEvent(new CustomEvent('roof-locale-applied', { detail: { locale: resolved } }));
  return resolved;
}

export function getRoofMessages(locale) {
  return MESSAGES[resolveRoofLocale(locale)] ?? MESSAGES['en-US'];
}

export function getRainwaterComponents(locale) {
  return RAINWATER[resolveRoofLocale(locale)] ?? RAINWATER['en-US'];
}
