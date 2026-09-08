const MESSAGES = Object.freeze({
  'en-US': Object.freeze({
    'project.type': 'Window',
    'loading.title': 'Loading CAD profiles...',
    'loading.subtitle': 'Analysing SVG files and metadata',
    'profile.sectionToggle': 'Toggle 10 cm section view',
    'profile.cadAssembly': 'CAD assembly',
    'profile.custom': 'Custom',
    'profile.cadReference': 'CAD section reference',
    'profile.outerFrame': 'Outer frame',
    'profile.sash': 'Sash / vent',
    'profile.windowLayout': 'Window layout',
    'profile.divider': 'Mullion / transom',
    'profile.trans': 'Double vent profile',
    'finish.title': 'Aluminum finish',
    'finish.modeAria': 'Inside and outside finish mode',
    'finish.uniform': 'Uniform',
    'finish.bicolor': 'Bicolor',
    'finish.debugAria': 'Toggle debug colors',
    'finish.debugTitle': 'Show original CAD/debug colors',
    'finish.outside': 'Outside',
    'finish.inside': 'Inside',
    'finish.insideOutside': 'Inside and outside',
    'finish.outsideTypeAria': 'Outside finish type',
    'finish.insideTypeAria': 'Inside finish type',
    'finish.type.mill': 'Mill finish',
    'finish.type.anodized': 'Anodized',
    'finish.type.coated': 'Color coated',
    'finish.preset.mill.natural': 'Natural aluminum gray',
    'finish.preset.anodized.natural': 'Natural anodized',
    'finish.preset.anodized.champagne': 'Champagne anodized',
    'finish.preset.anodized.light-bronze': 'Light bronze anodized',
    'finish.preset.anodized.dark-bronze': 'Dark bronze anodized',
    'finish.preset.anodized.black': 'Black anodized',
    'finish.preset.coated.ral-9016': 'RAL 9016 – Traffic white',
    'finish.preset.coated.ral-9010': 'RAL 9010 – Pure white',
    'finish.preset.coated.ral-9001': 'RAL 9001 – Cream',
    'finish.preset.coated.ral-7035': 'RAL 7035 – Light grey',
    'finish.preset.coated.ral-7040': 'RAL 7040 – Window grey',
    'finish.preset.coated.ral-7001': 'RAL 7001 – Silver grey',
    'finish.preset.coated.ral-7016': 'RAL 7016 – Anthracite grey',
    'finish.preset.coated.ral-7021': 'RAL 7021 – Black grey',
    'finish.preset.coated.ral-9005': 'RAL 9005 – Jet black',
    'finish.preset.coated.ral-8014': 'RAL 8014 – Sepia brown',
    'finish.preset.coated.ral-8017': 'RAL 8017 – Chocolate brown',
    'finish.preset.coated.ral-6005': 'RAL 6005 – Moss green',
    'finish.preset.coated.ral-6009': 'RAL 6009 – Fir green',
    'finish.preset.coated.ral-3005': 'RAL 3005 – Wine red',
    'finish.preset.coated.ral-5011': 'RAL 5011 – Steel blue',
    'dimension.width': 'Width',
    'dimension.height': 'Height',
    'dimension.glassThickness': 'Glass thickness',
    'accessory.preset': 'Accessory preset',
    'accessory.note': 'Disabled entries do not have usable geometry in the current CAD assembly.',
    'accessory.customSelection': 'Custom accessory selection.',
    'accessory.custom': 'Custom',
    'accessory.active': 'Active: {id}',
    'accessory.notInAssembly': '{ids} — not in current CAD assembly',
    'accessory.geometryMissing': '{ids} — geometry missing',
    'accessory.unavailableAssembly': 'Unavailable in current CAD assembly',
    'accessory.sourceRequired': 'Source geometry required',
    'accessory.missingVariant.one': 'Missing variant: {ids}',
    'accessory.missingVariant.other': 'Missing variants: {ids}',
    'accessory.preset.b2-6.description': 'Standard operable-sash accessories without the optional frame insulation profile.',
    'accessory.preset.b2-7.description': 'Standard operable-sash accessories without the optional frame insulation profile.',
    'accessory.preset.b2-8.description': 'Operable-sash accessories with the available 200988 insulation profile enabled.',
    'accessory.group.locking-bar.label': 'Locking bar',
    'accessory.group.locking-bar.description': 'Operating bar installed inside the sash hardware groove.',
    'accessory.group.centre-gasket.label': 'Centre gasket',
    'accessory.group.centre-gasket.description': 'Central EPDM seal between the outer frame and opening sash.',
    'accessory.group.insulation-profile.label': 'Insulation profile',
    'accessory.group.insulation-profile.description': 'PE foam insert fitted behind the central seal for higher thermal performance.',
    'accessory.group.glazing-rebate-insulation.label': 'Glazing rebate insulation',
    'accessory.group.glazing-rebate-insulation.description': 'PE foam insulation around the perimeter edge of the glass unit.',
    'accessory.group.rebate-gasket.label': 'Rebate gasket',
    'accessory.group.rebate-gasket.description': 'Perimeter EPDM stop gasket mounted on the frame and sash legs.',
    'accessory.group.outer-glazing-gasket.label': 'Outer glazing gasket',
    'accessory.group.outer-glazing-gasket.description': 'EPDM weather gasket supporting the outer face of the glass.',
    'accessory.group.inner-glazing-gasket.label': 'Inner glazing gasket',
    'accessory.group.inner-glazing-gasket.description': 'Glazing-bead gasket selected automatically from the glass thickness.',
    'accessory.group.glazing-bridge.label': 'Glazing bridge',
    'accessory.group.glazing-bridge.description': 'PVC support block in the bottom channel below the glass pane.',
    'accessory.group.joint-sealing-piece.label': 'Joint sealing piece',
    'accessory.group.joint-sealing-piece.description': 'Closed-cell EPDM sealing pad for mullion and transom joints.',
    'accessory.group.trans-end-cap.label': 'Trans end cap',
    'accessory.group.trans-end-cap.description': 'Top and bottom sealing caps for the floating trans profile.',
    'accessory.group.drainage-cap.label': 'Drainage cover cap',
    'accessory.group.drainage-cap.description': 'Exterior cap covering the drainage slots in the bottom outer frame.',
    'component.gasket': 'Gasket',
    'component.glazingBead': 'Glazing bead',
    'professional.title': 'Professional settings',
    'summary.title': 'Summary',
    'summary.bom': 'Bill of materials',
    'summary.cuts': 'Cut specifications',
    'summary.aluminiumRate': 'Aluminium price',
    'summary.glassRate': 'Glass price',
    'summary.sourceNote': 'The supplied manual points to a separate current price list, so aluminium and glass rates remain editable. Gaskets and plastic accessories use net Schüco trade-list prices where the exact article is publicly listed; items without a reliable public trade-list price use conservative engineering estimates. Aluminium and accessory weights are calculated from the current CAD contours. 6 m stock lengths, waste, labour and full opening hardware are ignored.',
    'summary.cutsNote': 'Workshop cuts use manufacturing joints rather than the temporary 3D intersection sockets.',
    'summary.empty': 'No manufacturing items are available yet.',
    'summary.vertical': 'vertical',
    'summary.horizontal': 'horizontal',
    'summary.betweenWindows': 'between windows {pairs}',
    'summary.profile.frame': 'Outer frame',
    'summary.profile.sash': 'Sash / vent',
    'summary.profile.mullion': 'Mullion / transom',
    'summary.profile.trans': 'Double vent profile',
    'summary.profile.bead': 'Glazing bead',
    'summary.profile.glass': 'Insulated glass unit',
    'summary.metric.aluminiumWeight': 'Aluminium weight',
    'summary.metric.glassArea': 'Glass area',
    'summary.metric.aluminiumCost': 'Aluminium cost',
    'summary.metric.otherPartsWeight': 'Gaskets / plastic weight',
    'summary.metric.accessoryCost': 'Gaskets / plastic cost',
    'summary.metric.total': 'Material total',
    'summary.accessory.profileInsulation': 'Thermal breaks / profile insulation',
    'summary.accessory.lockingBar': 'Locking bar',
    'summary.accessory.centreGasket': 'Centre gasket',
    'summary.accessory.insulationProfile': 'Insulation profile',
    'summary.accessory.rebateGasket': 'Rebate gasket',
    'summary.accessory.outerGlazingGasket': 'Outer glazing gasket',
    'summary.accessory.innerGlazingGasket': 'Inner glazing gasket',
    'summary.accessory.glazingBridge': 'Glazing bridge',
    'summary.accessory.drainageCap': 'Drainage cover cap',
    'summary.unit.pieces': 'pcs',
    'summary.unit.piece': 'pc',
    'summary.cut.length': 'Length',
    'summary.cut.joint': 'Joint cut',
    'summary.cut.start': 'start',
    'summary.cut.end': 'end',
    'summary.cut.bothEnds': 'both ends',
    'summary.cut.miter': '45° welded mitre',
    'summary.cut.square': '90° square cut',
    'summary.cut.squareFrame': '90° square cut · frame cleat',
    'summary.cut.squareDivider': '90° square cut · mullion/transom cleat',
    'summary.cut.squareSash': '90° square cut · sash connector',
    'summary.cut.transNote': 'Cut to the clear distance between the sash rails; the outer frame is not notched for this member.',
    'opening.mode': 'Opening mode',
    'opening.turn': 'Turn opening',
    'opening.tilt': 'Tilt opening',
    'opening.angle': 'Opening angle',
    'view.exploded': 'Exploded view',
    'view.showHouse': 'Show house',
    'components.types': 'Component types',
    'components.sideFilters': 'Side filters',
    'components.profileComponents': 'Profile components',
    'side.top': 'Top',
    'side.bottom': 'Bottom',
    'side.left': 'Left',
    'side.right': 'Right',
    'sidebar.show': 'Show sidebar',
    'sidebar.hide': 'Hide sidebar',
    'selection.aria': 'Selected component',
    'selection.close': 'Deselect component and close',
    'selection.kicker': 'Selected component',
    'selection.part': 'Part:',
    'selection.source.frame': 'Frame',
    'selection.source.bead': 'Glazing bead',
    'selection.source.sash': 'Sash / vent',
    'ar.platformAria': 'AR phone platform',
    'ar.generateQr': 'Generate AR QR',
    'ar.close': 'Close',
    'ar.exportTitle': 'Export and view this window in AR',
    'ar.description': 'Android selected: the browser will generate a GLB for Google Scene Viewer.',
    'ar.preparing': 'Preparing the optimized AR export…',
    'ar.openLauncher': 'Open phone launcher page',
    'ar.downloadModel': 'Download optimized model',
    'ar.checkPublished': 'Check published model and create QR',
    'ar.launchTitle': 'Window AR view',
    'ar.launchBody': 'The configured window is ready. Tap once to allow the browser to open the camera and place it automatically.',
    'ar.launchPreparing': 'Preparing AR…',
    'ar.profileLoading': 'Loading the selected profile…',
    'ar.qrLibraryMissing': 'The QR library could not be loaded. Reload the page and try again.',
    'ar.unsupportedPlatform': 'Unsupported AR platform: {platform}.',
    'ar.modelNotPublished': 'The model is not published yet (HTTP {status}).',
    'ar.fileSizeMismatch': 'A file exists at that URL, but its size is {publicBytes} bytes instead of {expectedBytes}. Republish the new AR model.',
    'ar.descriptionSelected': '{platform} selected: the browser will generate a {format} for {viewer}.',
    'ar.downloadOptimized': 'Download optimized {format}',
    'ar.profileStillLoading': 'The window profile is still loading. Close this dialog and try again in a moment.',
    'ar.stepBuild': '1/3 Building and simplifying the current production window for {viewer}…',
    'ar.stepSupabaseTicket': '2/3 The optimized {format} passed browser validation. Requesting a secure Supabase upload ticket…',
    'ar.stepServerUpload': '2/3 The optimized {format} passed browser validation. Uploading to the configured server…',
    'ar.stepPublishedCheck': '2/3 The optimized {format} passed browser validation. Checking whether this exact file is already published…',
    'ar.stepManualPublish': '3/3 Download and publish the optimized {format}, then verify it here. No paid storage service is involved.',
    'ar.generatedPublishFailed': 'The {format} was generated locally, but the publication or QR step failed.',
    'ar.exportFailed': 'The {format} export or optimization failed before publication.',
    'ar.prepareFailed': 'The configured window could not be prepared for AR.',
    'ar.httpsRequired': 'HTTPS required',
    'ar.httpsRequiredHelp': 'AR can only start from a secure HTTPS page.',
    'ar.notSupported': 'AR not supported',
    'ar.webxrMissing': 'This browser does not provide WebXR. Use Google Chrome on an ARCore-compatible Android phone.',
    'ar.view': 'View in AR',
    'ar.tapToOpen': 'Tap once to open the camera. The model will be placed automatically when a surface is detected.',
    'ar.immersiveUnavailable': 'Immersive AR is unavailable on this device or browser.',
    'ar.unavailable': 'AR unavailable',
    'ar.openingCamera': 'Opening camera…',
    'ar.waitPermission': 'Waiting for camera and spatial-tracking permission…',
    'ar.closed': 'AR closed. Tap to open it again.',
    'ar.tryAgain': 'Try AR again',
    'ar.profileLoadFailed': 'The configured profiles could not be loaded: {message}',
    'ar.verifiedQr': 'The public {format} was verified. Scan this {platform} QR, then press “View in AR” on the phone.',
    'ar.publishReady': 'The optimized {format} is ready but is not yet present on Netlify.',
    'ar.publishDownload': '1. Download',
    'ar.publishPlace': '2. Place it in',
    'ar.publishRedeploy': '3. Redeploy the existing Netlify site.',
    'ar.publishReturn': '4. Return here and press “Check published model and create QR”.',
    'ar.publishPlatform': 'Platform:',
    'ar.publishExpectedUrl': 'Expected public URL:',
    'ar.supabasePublicUnavailable': 'The uploaded Supabase model did not become publicly reachable.',
    'ar.supabaseUploading': '2/3 Uploading the optimized {format} directly to Supabase… {percentage}%',
    'ar.supabaseNoUrl': 'Supabase did not return a public {format} URL.',
    'ar.supabaseExists': '2/3 This exact {format} already exists in Supabase. Verifying its public URL…',
    'ar.supabaseUploaded': '3/3 Upload completed. Waiting for the public Supabase URL…',
    'ar.checkingPublished': 'Checking the published Netlify {format}…',
    'ar.stats.meshes': 'Meshes: {source} source → {merged} merged export meshes',
    'ar.stats.materials': 'Materials: {count}',
    'ar.stats.triangles': 'Triangles: {source} → {result} ({reduction}% reduction)',
    'ar.stats.vertices': 'Vertices: {source} → {result}',
    'ar.stats.dimensions': 'Dimensions: {x} × {y} × {z} m',
    'ar.stats.adaptive': 'Adaptive size passes: {passes}',
    'ar.stats.roundTrip': 'Round-trip: {meshes} meshes / {triangles} triangles',
    'ar.stats.gltf': 'glTF structure: {nodes} nodes, {accessors} accessors',
    'ar.stats.sceneSizeWarning': 'Warning: above Scene Viewer’s recommended 10 MB model size.',
    'ar.stats.sceneSizePassed': 'Scene Viewer 10 MB recommendation: passed.',
    'ar.stats.triangleWarning': 'Warning: above the ideal 30,000–50,000 triangle range.',
    'ar.stats.trianglePassed': 'Scene Viewer ideal triangle range: passed.',
    'ar.stats.usdzArchive': 'USDZ archive: {entries} entries; root {root}',
    'ar.stats.quickLook': 'Apple Quick Look export: validated as a USDZ ZIP archive.',
    'cad.checking': 'Checking CAD references…',
    'cad.referenceCount': 'CAD section reference ({count})',
    'cad.noReferences': 'No CAD references',
    'cad.unavailable': 'CAD references unavailable',
    'cad.loading': 'Loading reference screenshots…',
    'cad.noneFound': 'No screenshots were found for this CAD profile.',
    'cad.loadFailed': 'Reference screenshots could not be loaded: {message}',
    'cad.imageAlt': 'CAD section reference: {name}',
    'layout.overlayAria': 'Window layout editing controls',
    'layout.fixedTitle': 'Fixed window',
    'layout.fixed': 'Fixed',
    'layout.sashTitle': 'Sash window',
    'layout.sash': 'Sash',
    'layout.close': 'Close',
    'layout.cellMenu': 'Window options',
    'layout.selectedWindow': 'Selected window',
    'layout.window': 'Window',
    'layout.deleteWindow': 'Delete window',
    'layout.deleteLastDisabled': 'At least one window must remain',
    'layout.deleteSplitDisabled': 'This window cannot be deleted because the layout must remain rectangular and connected',
    'layout.unmerge': 'Unmerge',
    'layout.makeSash': 'Change to sash',
    'layout.makeFixed': 'Change to fixed',
    'layout.openLeft': 'Open from the left',
    'layout.openRight': 'Open from the right',
    'layout.add': 'Add window {direction}',
    'layout.merge': 'Merge windows',
    'layout.transAdd': 'Use double vent',
    'layout.transRemove': 'Remove double vent',
    'layout.direction.top': 'above',
    'layout.direction.bottom': 'below',
    'layout.direction.left': 'to the left',
    'layout.direction.right': 'to the right',
    'layout.single': 'Single opening',
    'layout.verticalDivider': 'Vertical mullion',
    'layout.verticalFixedFixed': 'Vertical mullion — fixed / fixed',
    'layout.threeFixedColumns': 'Three fixed columns',
    'layout.verticalSashSash': 'Vertical mullion — sash / sash',
    'layout.horizontalDivider': 'Horizontal transom',
    'layout.horizontalFixedFixed': 'Horizontal transom — fixed / fixed',
    'layout.threeFixedRows': 'Three fixed rows',
    'layout.topFixedTwoSashes': 'Top fixed — two sashes below',
    'profile.group.frame': 'Frame components',
    'profile.group.sash': 'Sash / vent components',
    'profile.group.bead': 'Glazing bead components',
    'profile.group.divider': 'Mullion / transom components',
    'profile.group.trans': 'Double vent profile',
    'profile.toggleAll': 'Toggle all',
    'profile.filter.frame': 'Frame',
    'profile.filter.sash': 'Sash',
    'profile.filter.gaskets': 'Gaskets and seals',
    'profile.filter.drainage': 'Drainage cover cap',
    'profile.filter.foam': 'Insulating foam',
    'profile.filter.bar': 'Insulating bar',
    'profile.filter.locking': 'Locking bars',
    'reset.confirm': 'Reset the window to its starting configuration?',
    'feedback.languageSwitchUnavailable': 'Could not preserve this configuration while changing language. Please try again.',
  }),
  'ro-RO': Object.freeze({
    'project.type': 'Fereastră',
    'loading.title': 'Se încarcă profilele CAD...',
    'loading.subtitle': 'Se analizează fișierele SVG și metadatele',
    'profile.sectionToggle': 'Afișează/ascunde secțiunea de 10 cm',
    'profile.cadAssembly': 'Ansamblu CAD',
    'profile.custom': 'Personalizat',
    'profile.cadReference': 'Referință secțiune CAD',
    'profile.outerFrame': 'Toc exterior',
    'profile.sash': 'Cercevea / parte mobilă',
    'profile.windowLayout': 'Compartimentare fereastră',
    'profile.divider': 'Montant / traversă',
    'profile.trans': 'Profil inversor',
    'finish.title': 'Finisaj aluminiu',
    'finish.modeAria': 'Mod finisaj interior și exterior',
    'finish.uniform': 'Uniform',
    'finish.bicolor': 'Bicolor',
    'finish.debugAria': 'Afișează/ascunde culorile de depanare',
    'finish.debugTitle': 'Arată culorile CAD/depanare originale',
    'finish.outside': 'Exterior',
    'finish.inside': 'Interior',
    'finish.insideOutside': 'Interior și exterior',
    'finish.outsideTypeAria': 'Tip finisaj exterior',
    'finish.insideTypeAria': 'Tip finisaj interior',
    'finish.type.mill': 'Aluminiu brut',
    'finish.type.anodized': 'Anodizat',
    'finish.type.coated': 'Vopsit',
    'finish.preset.mill.natural': 'Gri aluminiu natural',
    'finish.preset.anodized.natural': 'Anodizat natural',
    'finish.preset.anodized.champagne': 'Anodizat șampanie',
    'finish.preset.anodized.light-bronze': 'Anodizat bronz deschis',
    'finish.preset.anodized.dark-bronze': 'Anodizat bronz închis',
    'finish.preset.anodized.black': 'Anodizat negru',
    'finish.preset.coated.ral-9016': 'RAL 9016 – Alb trafic',
    'finish.preset.coated.ral-9010': 'RAL 9010 – Alb pur',
    'finish.preset.coated.ral-9001': 'RAL 9001 – Crem',
    'finish.preset.coated.ral-7035': 'RAL 7035 – Gri deschis',
    'finish.preset.coated.ral-7040': 'RAL 7040 – Gri fereastră',
    'finish.preset.coated.ral-7001': 'RAL 7001 – Gri argintiu',
    'finish.preset.coated.ral-7016': 'RAL 7016 – Gri antracit',
    'finish.preset.coated.ral-7021': 'RAL 7021 – Gri negru',
    'finish.preset.coated.ral-9005': 'RAL 9005 – Negru intens',
    'finish.preset.coated.ral-8014': 'RAL 8014 – Maro sepia',
    'finish.preset.coated.ral-8017': 'RAL 8017 – Maro ciocolatiu',
    'finish.preset.coated.ral-6005': 'RAL 6005 – Verde mușchi',
    'finish.preset.coated.ral-6009': 'RAL 6009 – Verde brad',
    'finish.preset.coated.ral-3005': 'RAL 3005 – Roșu vin',
    'finish.preset.coated.ral-5011': 'RAL 5011 – Albastru oțel',
    'dimension.width': 'Lățime',
    'dimension.height': 'Înălțime',
    'dimension.glassThickness': 'Grosime sticlă',
    'accessory.preset': 'Set de accesorii',
    'accessory.note': 'Elementele dezactivate nu au geometrie utilizabilă în ansamblul CAD curent.',
    'accessory.customSelection': 'Selecție personalizată de accesorii.',
    'accessory.custom': 'Personalizat',
    'accessory.active': 'Activ: {id}',
    'accessory.notInAssembly': '{ids} — nu există în ansamblul CAD curent',
    'accessory.geometryMissing': '{ids} — geometrie lipsă',
    'accessory.unavailableAssembly': 'Indisponibil în ansamblul CAD curent',
    'accessory.sourceRequired': 'Este necesară geometria sursă',
    'accessory.missingVariant.one': 'Variantă lipsă: {ids}',
    'accessory.missingVariant.other': 'Variante lipsă: {ids}',
    'accessory.preset.b2-6.description': 'Accesorii standard pentru cercevea mobilă, fără profilul opțional de izolație al tocului.',
    'accessory.preset.b2-7.description': 'Accesorii standard pentru cercevea mobilă, fără profilul opțional de izolație al tocului.',
    'accessory.preset.b2-8.description': 'Accesorii pentru cercevea mobilă cu profilul de izolație 200988 disponibil activat.',
    'accessory.group.locking-bar.label': 'Bară de închidere',
    'accessory.group.locking-bar.description': 'Bară de acționare montată în canalul de feronerie al cercevelei.',
    'accessory.group.centre-gasket.label': 'Garnitură centrală',
    'accessory.group.centre-gasket.description': 'Garnitură EPDM centrală între tocul exterior și cerceveaua mobilă.',
    'accessory.group.insulation-profile.label': 'Profil de izolație',
    'accessory.group.insulation-profile.description': 'Inserție din spumă PE montată în spatele garniturii centrale pentru performanță termică mai bună.',
    'accessory.group.glazing-rebate-insulation.label': 'Izolație falț vitraj',
    'accessory.group.glazing-rebate-insulation.description': 'Izolație din spumă PE pe conturul muchiei pachetului de sticlă.',
    'accessory.group.rebate-gasket.label': 'Garnitură de falț',
    'accessory.group.rebate-gasket.description': 'Garnitură EPDM perimetrală montată pe picioarele tocului și cercevelei.',
    'accessory.group.outer-glazing-gasket.label': 'Garnitură exterioară vitraj',
    'accessory.group.outer-glazing-gasket.description': 'Garnitură EPDM de etanșare care susține fața exterioară a sticlei.',
    'accessory.group.inner-glazing-gasket.label': 'Garnitură interioară vitraj',
    'accessory.group.inner-glazing-gasket.description': 'Garnitură a baghetei selectată automat în funcție de grosimea sticlei.',
    'accessory.group.glazing-bridge.label': 'Cală de vitraj',
    'accessory.group.glazing-bridge.description': 'Suport PVC în canalul inferior, sub panoul de sticlă.',
    'accessory.group.joint-sealing-piece.label': 'Piesă de etanșare îmbinare',
    'accessory.group.joint-sealing-piece.description': 'Piesă de etanșare EPDM cu celulă închisă pentru îmbinările montant/traversă.',
    'accessory.group.trans-end-cap.label': 'Capac capăt trans',
    'accessory.group.trans-end-cap.description': 'Capace de etanșare sus și jos pentru profilul flotant de trans.',
    'accessory.group.drainage-cap.label': 'Capac drenaj',
    'accessory.group.drainage-cap.description': 'Capac exterior care acoperă fantele de drenaj din partea inferioară a tocului.',
    'component.gasket': 'Garnitură',
    'component.glazingBead': 'Baghetă vitraj',
    'professional.title': 'Setări profesionale',
    'summary.title': 'Rezumat',
    'summary.bom': 'Listă de materiale',
    'summary.cuts': 'Specificații de debitare',
    'summary.aluminiumRate': 'Preț aluminiu',
    'summary.glassRate': 'Preț sticlă',
    'summary.sourceNote': 'Manualul furnizat face trimitere la o listă de prețuri separată, astfel că tarifele pentru aluminiu și sticlă rămân editabile. Garniturile și accesoriile din plastic folosesc prețuri nete din lista comercială Schüco acolo unde articolul exact este public; pentru piesele fără un preț public sigur din lista comercială sunt folosite estimări inginerești prudente. Greutățile aluminiului și accesoriilor sunt calculate din contururile CAD curente. Lungimile de stoc de 6 m, pierderile, manopera și feroneria completă de deschidere sunt ignorate.',
    'summary.cutsNote': 'Debitările de atelier folosesc îmbinările reale de fabricație, nu locașurile temporare folosite de geometria 3D.',
    'summary.empty': 'Nu există încă elemente de fabricație disponibile.',
    'summary.vertical': 'vertical',
    'summary.horizontal': 'orizontal',
    'summary.betweenWindows': 'între ferestrele {pairs}',
    'summary.profile.frame': 'Ramă exterioară',
    'summary.profile.sash': 'Cercevea / ventil',
    'summary.profile.mullion': 'Montant / traversă',
    'summary.profile.trans': 'Profil dublu ventil',
    'summary.profile.bead': 'Baghetă de vitrare',
    'summary.profile.glass': 'Geam termoizolant',
    'summary.metric.aluminiumWeight': 'Greutate aluminiu',
    'summary.metric.glassArea': 'Suprafață sticlă',
    'summary.metric.aluminiumCost': 'Cost aluminiu',
    'summary.metric.otherPartsWeight': 'Greutate garnituri / plastic',
    'summary.metric.accessoryCost': 'Cost garnituri / plastic',
    'summary.metric.total': 'Total materiale',
    'summary.accessory.profileInsulation': 'Barete termice / izolație profil',
    'summary.accessory.lockingBar': 'Bară de închidere',
    'summary.accessory.centreGasket': 'Garnitură centrală',
    'summary.accessory.insulationProfile': 'Profil de izolație',
    'summary.accessory.rebateGasket': 'Garnitură de falț',
    'summary.accessory.outerGlazingGasket': 'Garnitură exterioară de vitrare',
    'summary.accessory.innerGlazingGasket': 'Garnitură interioară de vitrare',
    'summary.accessory.glazingBridge': 'Suport de vitrare',
    'summary.accessory.drainageCap': 'Capac de drenaj',
    'summary.unit.pieces': 'buc.',
    'summary.unit.piece': 'buc.',
    'summary.cut.length': 'Lungime',
    'summary.cut.joint': 'Debitare îmbinare',
    'summary.cut.start': 'început',
    'summary.cut.end': 'sfârșit',
    'summary.cut.bothEnds': 'ambele capete',
    'summary.cut.miter': 'tăiere la 45° pentru sudare',
    'summary.cut.square': 'tăiere dreaptă la 90°',
    'summary.cut.squareFrame': 'tăiere dreaptă la 90° · clemă ramă',
    'summary.cut.squareDivider': 'tăiere dreaptă la 90° · clemă montant/traversă',
    'summary.cut.squareSash': 'tăiere dreaptă la 90° · conector cercevea',
    'summary.cut.transNote': 'Debitat la distanța liberă dintre profilele cercevelei; rama exterioară nu este decupată pentru această piesă.',
    'opening.mode': 'Mod de deschidere',
    'opening.turn': 'Deschidere batantă',
    'opening.tilt': 'Deschidere oscilantă',
    'opening.angle': 'Unghi de deschidere',
    'view.exploded': 'Vedere explodată',
    'view.showHouse': 'Arată casa',
    'components.types': 'Tipuri de componente',
    'components.sideFilters': 'Filtre pe laturi',
    'components.profileComponents': 'Componente profil',
    'side.top': 'Sus',
    'side.bottom': 'Jos',
    'side.left': 'Stânga',
    'side.right': 'Dreapta',
    'sidebar.show': 'Arată bara laterală',
    'sidebar.hide': 'Ascunde bara laterală',
    'selection.aria': 'Componentă selectată',
    'selection.close': 'Deselectează componenta și închide',
    'selection.kicker': 'Componentă selectată',
    'selection.part': 'Piesă:',
    'selection.source.frame': 'Toc',
    'selection.source.bead': 'Baghetă vitraj',
    'selection.source.sash': 'Cercevea / parte mobilă',
    'ar.platformAria': 'Platformă telefon pentru AR',
    'ar.generateQr': 'Generează QR pentru AR',
    'ar.close': 'Închide',
    'ar.exportTitle': 'Exportă și vizualizează această fereastră în AR',
    'ar.description': 'Android selectat: browserul va genera un GLB pentru Google Scene Viewer.',
    'ar.preparing': 'Se pregătește exportul AR optimizat…',
    'ar.openLauncher': 'Deschide pagina de lansare pe telefon',
    'ar.downloadModel': 'Descarcă modelul optimizat',
    'ar.checkPublished': 'Verifică modelul publicat și creează QR',
    'ar.launchTitle': 'Vizualizare AR fereastră',
    'ar.launchBody': 'Fereastra configurată este gata. Apasă o dată pentru a permite browserului să deschidă camera și să o plaseze automat.',
    'ar.launchPreparing': 'Se pregătește AR…',
    'ar.profileLoading': 'Se încarcă profilul selectat…',
    'ar.qrLibraryMissing': 'Biblioteca QR nu a putut fi încărcată. Reîncarcă pagina și încearcă din nou.',
    'ar.unsupportedPlatform': 'Platformă AR nesuportată: {platform}.',
    'ar.modelNotPublished': 'Modelul nu este încă publicat (HTTP {status}).',
    'ar.fileSizeMismatch': 'Există un fișier la acel URL, dar dimensiunea este {publicBytes} octeți în loc de {expectedBytes}. Republică noul model AR.',
    'ar.descriptionSelected': '{platform} selectat: browserul va genera un {format} pentru {viewer}.',
    'ar.downloadOptimized': 'Descarcă {format} optimizat',
    'ar.profileStillLoading': 'Profilul ferestrei încă se încarcă. Închide acest dialog și încearcă din nou în câteva momente.',
    'ar.stepBuild': '1/3 Se construiește și se simplifică fereastra curentă pentru {viewer}…',
    'ar.stepSupabaseTicket': '2/3 {format} optimizat a trecut validarea în browser. Se solicită autorizarea securizată pentru încărcarea în Supabase…',
    'ar.stepServerUpload': '2/3 {format} optimizat a trecut validarea în browser. Se încarcă pe serverul configurat…',
    'ar.stepPublishedCheck': '2/3 {format} optimizat a trecut validarea în browser. Se verifică dacă acest fișier exact este deja publicat…',
    'ar.stepManualPublish': '3/3 Descarcă și publică {format} optimizat, apoi verifică-l aici. Nu este implicat niciun serviciu de stocare plătit.',
    'ar.generatedPublishFailed': '{format} a fost generat local, dar publicarea sau pasul QR a eșuat.',
    'ar.exportFailed': 'Exportul sau optimizarea {format} a eșuat înainte de publicare.',
    'ar.prepareFailed': 'Fereastra configurată nu a putut fi pregătită pentru AR.',
    'ar.httpsRequired': 'Este necesar HTTPS',
    'ar.httpsRequiredHelp': 'AR poate porni doar dintr-o pagină HTTPS securizată.',
    'ar.notSupported': 'AR nu este suportat',
    'ar.webxrMissing': 'Acest browser nu oferă WebXR. Folosește Google Chrome pe un telefon Android compatibil ARCore.',
    'ar.view': 'Vezi în AR',
    'ar.tapToOpen': 'Apasă o dată pentru a deschide camera. Modelul va fi plasat automat când este detectată o suprafață.',
    'ar.immersiveUnavailable': 'AR imersiv nu este disponibil pe acest dispozitiv sau browser.',
    'ar.unavailable': 'AR indisponibil',
    'ar.openingCamera': 'Se deschide camera…',
    'ar.waitPermission': 'Se așteaptă permisiunea pentru cameră și urmărirea spațială…',
    'ar.closed': 'AR s-a închis. Apasă pentru a-l deschide din nou.',
    'ar.tryAgain': 'Încearcă AR din nou',
    'ar.profileLoadFailed': 'Profilele configurate nu au putut fi încărcate: {message}',
    'ar.verifiedQr': '{format} public a fost verificat. Scanează acest cod QR pentru {platform}, apoi apasă „Vezi în AR” pe telefon.',
    'ar.publishReady': '{format} optimizat este gata, dar nu este încă disponibil pe Netlify.',
    'ar.publishDownload': '1. Descarcă',
    'ar.publishPlace': '2. Plasează-l în',
    'ar.publishRedeploy': '3. Redeployează site-ul Netlify existent.',
    'ar.publishReturn': '4. Revino aici și apasă „Verifică modelul publicat și creează QR”.',
    'ar.publishPlatform': 'Platformă:',
    'ar.publishExpectedUrl': 'URL public estimat:',
    'ar.supabasePublicUnavailable': 'Modelul încărcat în Supabase nu a devenit accesibil public.',
    'ar.supabaseUploading': '2/3 Se încarcă {format} optimizat direct în Supabase… {percentage}%',
    'ar.supabaseNoUrl': 'Supabase nu a returnat un URL public pentru {format}.',
    'ar.supabaseExists': '2/3 Acest {format} există deja în Supabase. Se verifică URL-ul public…',
    'ar.supabaseUploaded': '3/3 Încărcarea s-a încheiat. Se așteaptă URL-ul public Supabase…',
    'ar.checkingPublished': 'Se verifică {format} publicat pe Netlify…',
    'ar.stats.meshes': 'Rețele 3D: {source} în model → {merged} combinate la export',
    'ar.stats.materials': 'Materiale: {count}',
    'ar.stats.triangles': 'Triunghiuri: {source} → {result} (reducere {reduction}%)',
    'ar.stats.vertices': 'Vârfuri: {source} → {result}',
    'ar.stats.dimensions': 'Dimensiuni: {x} × {y} × {z} m',
    'ar.stats.adaptive': 'Treceri adaptive pentru dimensiune: {passes}',
    'ar.stats.roundTrip': 'Verificare după export: {meshes} rețele 3D / {triangles} triunghiuri',
    'ar.stats.gltf': 'Structură glTF: {nodes} noduri, {accessors} accesori',
    'ar.stats.sceneSizeWarning': 'Avertisment: peste dimensiunea de model recomandată de 10 MB pentru Scene Viewer.',
    'ar.stats.sceneSizePassed': 'Recomandarea de 10 MB pentru Scene Viewer: îndeplinită.',
    'ar.stats.triangleWarning': 'Avertisment: peste intervalul ideal de 30.000–50.000 de triunghiuri.',
    'ar.stats.trianglePassed': 'Intervalul ideal de triunghiuri pentru Scene Viewer: îndeplinit.',
    'ar.stats.usdzArchive': 'Arhivă USDZ: {entries} intrări; rădăcină {root}',
    'ar.stats.quickLook': 'Export Apple Quick Look: validat ca arhivă ZIP USDZ.',
    'cad.checking': 'Se verifică referințele CAD…',
    'cad.referenceCount': 'Referință secțiune CAD ({count})',
    'cad.noReferences': 'Nu există referințe CAD',
    'cad.unavailable': 'Referințele CAD nu sunt disponibile',
    'cad.loading': 'Se încarcă capturile de referință…',
    'cad.noneFound': 'Nu au fost găsite capturi pentru acest profil CAD.',
    'cad.loadFailed': 'Capturile de referință nu au putut fi încărcate: {message}',
    'cad.imageAlt': 'Referință secțiune CAD: {name}',
    'layout.overlayAria': 'Controale pentru editarea compartimentării ferestrei',
    'layout.fixedTitle': 'Fereastră fixă',
    'layout.fixed': 'Fixă',
    'layout.sashTitle': 'Fereastră cu cercevea',
    'layout.sash': 'Cercevea',
    'layout.close': 'Închide',
    'layout.cellMenu': 'Opțiuni fereastră',
    'layout.selectedWindow': 'Fereastră selectată',
    'layout.window': 'Fereastra',
    'layout.deleteWindow': 'Șterge fereastra',
    'layout.deleteLastDisabled': 'Trebuie să rămână cel puțin o fereastră',
    'layout.deleteSplitDisabled': 'Această fereastră nu poate fi ștearsă deoarece configurația trebuie să rămână dreptunghiulară și conectată',
    'layout.unmerge': 'Separă',
    'layout.makeSash': 'Schimbă în cercevea',
    'layout.makeFixed': 'Schimbă în fix',
    'layout.openLeft': 'Deschidere din stânga',
    'layout.openRight': 'Deschidere din dreapta',
    'layout.add': 'Adaugă o fereastră {direction}',
    'layout.merge': 'Unește ferestrele',
    'layout.transAdd': 'Folosește profil inversor',
    'layout.transRemove': 'Elimină profil inversor',
    'layout.direction.top': 'deasupra',
    'layout.direction.bottom': 'dedesubt',
    'layout.direction.left': 'în stânga',
    'layout.direction.right': 'în dreapta',
    'layout.single': 'O singură deschidere',
    'layout.verticalDivider': 'Montant vertical',
    'layout.verticalFixedFixed': 'Montant vertical — fix / fix',
    'layout.threeFixedColumns': 'Trei coloane fixe',
    'layout.verticalSashSash': 'Montant vertical — cercevea / cercevea',
    'layout.horizontalDivider': 'Traversă orizontală',
    'layout.horizontalFixedFixed': 'Traversă orizontală — fix / fix',
    'layout.threeFixedRows': 'Trei rânduri fixe',
    'layout.topFixedTwoSashes': 'Fix sus — două cercevele jos',
    'profile.group.frame': 'Componente toc',
    'profile.group.sash': 'Componente cercevea / parte mobilă',
    'profile.group.bead': 'Componente baghetă vitraj',
    'profile.group.divider': 'Componente montant / traversă',
    'profile.group.trans': 'Profil inversor',
    'profile.toggleAll': 'Comută toate',
    'profile.filter.frame': 'Toc',
    'profile.filter.sash': 'Cercevea',
    'profile.filter.gaskets': 'Garnituri și etanșări',
    'profile.filter.drainage': 'Capac drenaj',
    'profile.filter.foam': 'Spumă izolatoare',
    'profile.filter.bar': 'Bară izolatoare',
    'profile.filter.locking': 'Bare de închidere',
    'reset.confirm': 'Resetezi fereastra la configurația inițială?',
    'feedback.languageSwitchUnavailable': 'Configurația nu a putut fi păstrată la schimbarea limbii. Încearcă din nou.',
  }),
  'de-DE': Object.freeze({
    'project.type': 'Fenster',
    'loading.title': 'CAD-Profile werden geladen...',
    'loading.subtitle': 'SVG-Dateien und Metadaten werden analysiert',
    'profile.sectionToggle': '10-cm-Schnittansicht ein-/ausblenden',
    'profile.cadAssembly': 'CAD-Baugruppe',
    'profile.custom': 'Benutzerdefiniert',
    'profile.cadReference': 'CAD-Schnittreferenz',
    'profile.outerFrame': 'Außenrahmen',
    'profile.sash': 'Flügel',
    'profile.windowLayout': 'Fensteraufteilung',
    'profile.divider': 'Pfosten / Riegel',
    'profile.trans': 'Stulpprofil',
    'finish.title': 'Aluminiumoberfläche',
    'finish.modeAria': 'Oberflächenmodus innen und außen',
    'finish.uniform': 'Einheitlich',
    'finish.bicolor': 'Bicolor',
    'finish.debugAria': 'Debug-Farben ein-/ausblenden',
    'finish.debugTitle': 'Ursprüngliche CAD-/Debug-Farben anzeigen',
    'finish.outside': 'Außen',
    'finish.inside': 'Innen',
    'finish.insideOutside': 'Innen und außen',
    'finish.outsideTypeAria': 'Art der Außenoberfläche',
    'finish.insideTypeAria': 'Art der Innenoberfläche',
    'finish.type.mill': 'Walzblank',
    'finish.type.anodized': 'Eloxiert',
    'finish.type.coated': 'Pulverbeschichtet',
    'finish.preset.mill.natural': 'Natur-Aluminiumgrau',
    'finish.preset.anodized.natural': 'Natureloxiert',
    'finish.preset.anodized.champagne': 'Champagner eloxiert',
    'finish.preset.anodized.light-bronze': 'Hellbronze eloxiert',
    'finish.preset.anodized.dark-bronze': 'Dunkelbronze eloxiert',
    'finish.preset.anodized.black': 'Schwarz eloxiert',
    'finish.preset.coated.ral-9016': 'RAL 9016 – Verkehrsweiß',
    'finish.preset.coated.ral-9010': 'RAL 9010 – Reinweiß',
    'finish.preset.coated.ral-9001': 'RAL 9001 – Cremeweiß',
    'finish.preset.coated.ral-7035': 'RAL 7035 – Lichtgrau',
    'finish.preset.coated.ral-7040': 'RAL 7040 – Fenstergrau',
    'finish.preset.coated.ral-7001': 'RAL 7001 – Silbergrau',
    'finish.preset.coated.ral-7016': 'RAL 7016 – Anthrazitgrau',
    'finish.preset.coated.ral-7021': 'RAL 7021 – Schwarzgrau',
    'finish.preset.coated.ral-9005': 'RAL 9005 – Tiefschwarz',
    'finish.preset.coated.ral-8014': 'RAL 8014 – Sepiabraun',
    'finish.preset.coated.ral-8017': 'RAL 8017 – Schokoladenbraun',
    'finish.preset.coated.ral-6005': 'RAL 6005 – Moosgrün',
    'finish.preset.coated.ral-6009': 'RAL 6009 – Tannengrün',
    'finish.preset.coated.ral-3005': 'RAL 3005 – Weinrot',
    'finish.preset.coated.ral-5011': 'RAL 5011 – Stahlblau',
    'dimension.width': 'Breite',
    'dimension.height': 'Höhe',
    'dimension.glassThickness': 'Glasdicke',
    'accessory.preset': 'Zubehör-Voreinstellung',
    'accessory.note': 'Deaktivierte Einträge besitzen in der aktuellen CAD-Baugruppe keine nutzbare Geometrie.',
    'accessory.customSelection': 'Benutzerdefinierte Zubehörauswahl.',
    'accessory.custom': 'Benutzerdefiniert',
    'accessory.active': 'Aktiv: {id}',
    'accessory.notInAssembly': '{ids} — nicht in der aktuellen CAD-Baugruppe',
    'accessory.geometryMissing': '{ids} — Geometrie fehlt',
    'accessory.unavailableAssembly': 'In der aktuellen CAD-Baugruppe nicht verfügbar',
    'accessory.sourceRequired': 'Quellgeometrie erforderlich',
    'accessory.missingVariant.one': 'Fehlende Variante: {ids}',
    'accessory.missingVariant.other': 'Fehlende Varianten: {ids}',
    'accessory.preset.b2-6.description': 'Standardzubehör für Öffnungsflügel ohne optionales Rahmen-Dämmprofil.',
    'accessory.preset.b2-7.description': 'Standardzubehör für Öffnungsflügel ohne optionales Rahmen-Dämmprofil.',
    'accessory.preset.b2-8.description': 'Zubehör für Öffnungsflügel mit aktiviertem verfügbarem Dämmprofil 200988.',
    'accessory.group.locking-bar.label': 'Verriegelungsstange',
    'accessory.group.locking-bar.description': 'Betätigungsstange in der Beschlagnut des Flügels.',
    'accessory.group.centre-gasket.label': 'Mitteldichtung',
    'accessory.group.centre-gasket.description': 'Zentrale EPDM-Dichtung zwischen Außenrahmen und Öffnungsflügel.',
    'accessory.group.insulation-profile.label': 'Dämmprofil',
    'accessory.group.insulation-profile.description': 'PE-Schaumeinlage hinter der Mitteldichtung für höhere Wärmedämmung.',
    'accessory.group.glazing-rebate-insulation.label': 'Glasfalz-Dämmung',
    'accessory.group.glazing-rebate-insulation.description': 'PE-Schaumdämmung entlang der Kante der Isolierglaseinheit.',
    'accessory.group.rebate-gasket.label': 'Falzdichtung',
    'accessory.group.rebate-gasket.description': 'Umlaufende EPDM-Anschlagdichtung an Rahmen- und Flügelschenkeln.',
    'accessory.group.outer-glazing-gasket.label': 'Äußere Verglasungsdichtung',
    'accessory.group.outer-glazing-gasket.description': 'EPDM-Wetterdichtung an der Außenseite der Verglasung.',
    'accessory.group.inner-glazing-gasket.label': 'Innere Verglasungsdichtung',
    'accessory.group.inner-glazing-gasket.description': 'Glasleistendichtung, automatisch nach Glasdicke ausgewählt.',
    'accessory.group.glazing-bridge.label': 'Glasauflage',
    'accessory.group.glazing-bridge.description': 'PVC-Auflage im unteren Kanal unter der Glasscheibe.',
    'accessory.group.joint-sealing-piece.label': 'Fugendichtstück',
    'accessory.group.joint-sealing-piece.description': 'Geschlossenzelliges EPDM-Dichtstück für Pfosten-/Riegelverbindungen.',
    'accessory.group.trans-end-cap.label': 'Endkappe Trans',
    'accessory.group.trans-end-cap.description': 'Obere und untere Dichtkappen für das schwimmende Transprofil.',
    'accessory.group.drainage-cap.label': 'Entwässerungskappe',
    'accessory.group.drainage-cap.description': 'Außenkappe über den Entwässerungsschlitzen im unteren Außenrahmen.',
    'component.gasket': 'Dichtung',
    'component.glazingBead': 'Glasleiste',
    'professional.title': 'Profi-Einstellungen',
    'summary.title': 'Zusammenfassung',
    'summary.bom': 'Stückliste',
    'summary.cuts': 'Zuschnittangaben',
    'summary.aluminiumRate': 'Aluminiumpreis',
    'summary.glassRate': 'Glaspreis',
    'summary.sourceNote': 'Das gelieferte Handbuch verweist auf eine separate aktuelle Preisliste; deshalb bleiben Aluminium- und Glaspreise editierbar. Dichtungen und Kunststoffzubehör verwenden Netto-Preise aus der Schüco-Handelspreisliste, sofern der genaue Artikel öffentlich gelistet ist; für Teile ohne verlässlichen öffentlichen Listenpreis werden konservative technische Schätzwerte verwendet. Aluminium- und Zubehörgewichte werden aus den aktuellen CAD-Konturen berechnet. 6-m-Lagerlängen, Verschnitt, Arbeit und der vollständige Öffnungsbeschlag werden ignoriert.',
    'summary.cutsNote': 'Die Werkstattzuschnitte verwenden reale Fertigungsverbindungen statt der temporären 3D-Sockelgeometrie.',
    'summary.empty': 'Noch keine Fertigungsteile verfügbar.',
    'summary.vertical': 'vertikal',
    'summary.horizontal': 'horizontal',
    'summary.betweenWindows': 'zwischen Fenstern {pairs}',
    'summary.profile.frame': 'Außenrahmen',
    'summary.profile.sash': 'Flügel',
    'summary.profile.mullion': 'Pfosten / Riegel',
    'summary.profile.trans': 'Doppelflügelprofil',
    'summary.profile.bead': 'Glasleiste',
    'summary.profile.glass': 'Isolierglaseinheit',
    'summary.metric.aluminiumWeight': 'Aluminiumgewicht',
    'summary.metric.glassArea': 'Glasfläche',
    'summary.metric.aluminiumCost': 'Aluminiumkosten',
    'summary.metric.otherPartsWeight': 'Dichtungs-/Kunststoffgewicht',
    'summary.metric.accessoryCost': 'Dichtungs-/Kunststoffkosten',
    'summary.metric.total': 'Materialsumme',
    'summary.accessory.profileInsulation': 'Isolierstege / Profildämmung',
    'summary.accessory.lockingBar': 'Riegelstange',
    'summary.accessory.centreGasket': 'Mitteldichtung',
    'summary.accessory.insulationProfile': 'Dämmprofil',
    'summary.accessory.rebateGasket': 'Anschlagdichtung',
    'summary.accessory.outerGlazingGasket': 'Äußere Verglasungsdichtung',
    'summary.accessory.innerGlazingGasket': 'Innere Verglasungsdichtung',
    'summary.accessory.glazingBridge': 'Glasbrücke',
    'summary.accessory.drainageCap': 'Entwässerungskappe',
    'summary.unit.pieces': 'Stk.',
    'summary.unit.piece': 'Stk.',
    'summary.cut.length': 'Länge',
    'summary.cut.joint': 'Verbindungsschnitt',
    'summary.cut.start': 'Anfang',
    'summary.cut.end': 'Ende',
    'summary.cut.bothEnds': 'beide Enden',
    'summary.cut.miter': '45° Schweißgehrung',
    'summary.cut.square': '90° gerader Schnitt',
    'summary.cut.squareFrame': '90° gerader Schnitt · Rahmenverbinder',
    'summary.cut.squareDivider': '90° gerader Schnitt · Pfosten-/Riegelverbinder',
    'summary.cut.squareSash': '90° gerader Schnitt · Flügelverbinder',
    'summary.cut.transNote': 'Auf das lichte Maß zwischen den Flügelprofilen zugeschnitten; der Außenrahmen wird für dieses Teil nicht ausgeklinkt.',
    'opening.mode': 'Öffnungsart',
    'opening.turn': 'Drehöffnung',
    'opening.tilt': 'Kippöffnung',
    'opening.angle': 'Öffnungswinkel',
    'view.exploded': 'Explosionsansicht',
    'view.showHouse': 'Haus anzeigen',
    'components.types': 'Komponententypen',
    'components.sideFilters': 'Seitenfilter',
    'components.profileComponents': 'Profilkomponenten',
    'side.top': 'Oben',
    'side.bottom': 'Unten',
    'side.left': 'Links',
    'side.right': 'Rechts',
    'sidebar.show': 'Seitenleiste anzeigen',
    'sidebar.hide': 'Seitenleiste ausblenden',
    'selection.aria': 'Ausgewählte Komponente',
    'selection.close': 'Komponente abwählen und schließen',
    'selection.kicker': 'Ausgewählte Komponente',
    'selection.part': 'Teil:',
    'selection.source.frame': 'Rahmen',
    'selection.source.bead': 'Glasleiste',
    'selection.source.sash': 'Flügel',
    'ar.platformAria': 'AR-Telefonplattform',
    'ar.generateQr': 'AR-QR erzeugen',
    'ar.close': 'Schließen',
    'ar.exportTitle': 'Dieses Fenster exportieren und in AR ansehen',
    'ar.description': 'Android ausgewählt: Der Browser erzeugt eine GLB-Datei für Google Scene Viewer.',
    'ar.preparing': 'Optimierter AR-Export wird vorbereitet…',
    'ar.openLauncher': 'Launcher-Seite auf dem Telefon öffnen',
    'ar.downloadModel': 'Optimiertes Modell herunterladen',
    'ar.checkPublished': 'Veröffentlichtes Modell prüfen und QR erstellen',
    'ar.launchTitle': 'Fenster-AR-Ansicht',
    'ar.launchBody': 'Das konfigurierte Fenster ist bereit. Tippen Sie einmal, damit der Browser die Kamera öffnen und das Modell automatisch platzieren kann.',
    'ar.launchPreparing': 'AR wird vorbereitet…',
    'ar.profileLoading': 'Ausgewähltes Profil wird geladen…',
    'ar.qrLibraryMissing': 'Die QR-Bibliothek konnte nicht geladen werden. Laden Sie die Seite neu und versuchen Sie es erneut.',
    'ar.unsupportedPlatform': 'Nicht unterstützte AR-Plattform: {platform}.',
    'ar.modelNotPublished': 'Das Modell ist noch nicht veröffentlicht (HTTP {status}).',
    'ar.fileSizeMismatch': 'Unter dieser URL existiert eine Datei, ihre Größe beträgt jedoch {publicBytes} Byte statt {expectedBytes}. Veröffentlichen Sie das neue AR-Modell erneut.',
    'ar.descriptionSelected': '{platform} ausgewählt: Der Browser erzeugt eine {format}-Datei für {viewer}.',
    'ar.downloadOptimized': 'Optimierte {format}-Datei herunterladen',
    'ar.profileStillLoading': 'Das Fensterprofil wird noch geladen. Schließen Sie diesen Dialog und versuchen Sie es gleich erneut.',
    'ar.stepBuild': '1/3 Das aktuelle Fenster wird für {viewer} aufgebaut und vereinfacht…',
    'ar.stepSupabaseTicket': '2/3 Die optimierte {format}-Datei hat die Browservalidierung bestanden. Ein sicheres Supabase-Upload-Ticket wird angefordert…',
    'ar.stepServerUpload': '2/3 Die optimierte {format}-Datei hat die Browservalidierung bestanden. Upload auf den konfigurierten Server…',
    'ar.stepPublishedCheck': '2/3 Die optimierte {format}-Datei hat die Browservalidierung bestanden. Es wird geprüft, ob genau diese Datei bereits veröffentlicht ist…',
    'ar.stepManualPublish': '3/3 Laden Sie die optimierte {format}-Datei herunter, veröffentlichen Sie sie und prüfen Sie sie anschließend hier. Es ist kein kostenpflichtiger Speicherdienst erforderlich.',
    'ar.generatedPublishFailed': 'Die {format}-Datei wurde lokal erzeugt, aber die Veröffentlichung oder der QR-Schritt ist fehlgeschlagen.',
    'ar.exportFailed': 'Export oder Optimierung der {format}-Datei ist vor der Veröffentlichung fehlgeschlagen.',
    'ar.prepareFailed': 'Das konfigurierte Fenster konnte nicht für AR vorbereitet werden.',
    'ar.httpsRequired': 'HTTPS erforderlich',
    'ar.httpsRequiredHelp': 'AR kann nur von einer sicheren HTTPS-Seite gestartet werden.',
    'ar.notSupported': 'AR nicht unterstützt',
    'ar.webxrMissing': 'Dieser Browser unterstützt WebXR nicht. Verwenden Sie Google Chrome auf einem ARCore-kompatiblen Android-Telefon.',
    'ar.view': 'In AR ansehen',
    'ar.tapToOpen': 'Tippen Sie einmal, um die Kamera zu öffnen. Das Modell wird automatisch platziert, sobald eine Oberfläche erkannt wird.',
    'ar.immersiveUnavailable': 'Immersives AR ist auf diesem Gerät oder Browser nicht verfügbar.',
    'ar.unavailable': 'AR nicht verfügbar',
    'ar.openingCamera': 'Kamera wird geöffnet…',
    'ar.waitPermission': 'Warten auf Kamera- und Spatial-Tracking-Berechtigung…',
    'ar.closed': 'AR wurde geschlossen. Tippen Sie, um es erneut zu öffnen.',
    'ar.tryAgain': 'AR erneut versuchen',
    'ar.profileLoadFailed': 'Die konfigurierten Profile konnten nicht geladen werden: {message}',
    'ar.verifiedQr': 'Die öffentliche {format}-Datei wurde geprüft. Scannen Sie diesen {platform}-QR-Code und tippen Sie auf dem Telefon auf „In AR ansehen“.',
    'ar.publishReady': 'Die optimierte {format}-Datei ist bereit, aber noch nicht auf Netlify vorhanden.',
    'ar.publishDownload': '1. Herunterladen:',
    'ar.publishPlace': '2. Datei ablegen unter',
    'ar.publishRedeploy': '3. Die bestehende Netlify-Site erneut bereitstellen.',
    'ar.publishReturn': '4. Hierher zurückkehren und „Veröffentlichtes Modell prüfen und QR erstellen“ drücken.',
    'ar.publishPlatform': 'Plattform:',
    'ar.publishExpectedUrl': 'Erwartete öffentliche URL:',
    'ar.supabasePublicUnavailable': 'Das hochgeladene Supabase-Modell wurde nicht öffentlich erreichbar.',
    'ar.supabaseUploading': '2/3 Die optimierte {format}-Datei wird direkt zu Supabase hochgeladen… {percentage}%',
    'ar.supabaseNoUrl': 'Supabase hat keine öffentliche URL für {format} zurückgegeben.',
    'ar.supabaseExists': '2/3 Genau diese {format}-Datei existiert bereits in Supabase. Öffentliche URL wird geprüft…',
    'ar.supabaseUploaded': '3/3 Upload abgeschlossen. Warten auf die öffentliche Supabase-URL…',
    'ar.checkingPublished': 'Die veröffentlichte Netlify-{format}-Datei wird geprüft…',
    'ar.stats.meshes': 'Meshes: {source} Quelle → {merged} zusammengeführte Export-Meshes',
    'ar.stats.materials': 'Materialien: {count}',
    'ar.stats.triangles': 'Dreiecke: {source} → {result} ({reduction}% Reduktion)',
    'ar.stats.vertices': 'Vertices: {source} → {result}',
    'ar.stats.dimensions': 'Abmessungen: {x} × {y} × {z} m',
    'ar.stats.adaptive': 'Adaptive Größen-Durchläufe: {passes}',
    'ar.stats.roundTrip': 'Round-Trip: {meshes} Meshes / {triangles} Dreiecke',
    'ar.stats.gltf': 'glTF-Struktur: {nodes} Nodes, {accessors} Accessors',
    'ar.stats.sceneSizeWarning': 'Warnung: über der empfohlenen Modellgröße von 10 MB für Scene Viewer.',
    'ar.stats.sceneSizePassed': 'Scene-Viewer-Empfehlung von 10 MB: erfüllt.',
    'ar.stats.triangleWarning': 'Warnung: über dem idealen Bereich von 30.000–50.000 Dreiecken.',
    'ar.stats.trianglePassed': 'Idealer Dreiecksbereich für Scene Viewer: erfüllt.',
    'ar.stats.usdzArchive': 'USDZ-Archiv: {entries} Einträge; Root {root}',
    'ar.stats.quickLook': 'Apple-Quick-Look-Export: als USDZ-ZIP-Archiv validiert.',
    'cad.checking': 'CAD-Referenzen werden geprüft…',
    'cad.referenceCount': 'CAD-Schnittreferenz ({count})',
    'cad.noReferences': 'Keine CAD-Referenzen',
    'cad.unavailable': 'CAD-Referenzen nicht verfügbar',
    'cad.loading': 'Referenzbilder werden geladen…',
    'cad.noneFound': 'Für dieses CAD-Profil wurden keine Screenshots gefunden.',
    'cad.loadFailed': 'Referenzbilder konnten nicht geladen werden: {message}',
    'cad.imageAlt': 'CAD-Schnittreferenz: {name}',
    'layout.overlayAria': 'Steuerelemente zur Bearbeitung der Fensteraufteilung',
    'layout.fixedTitle': 'Festverglasung',
    'layout.fixed': 'Fest',
    'layout.sashTitle': 'Flügelfenster',
    'layout.sash': 'Flügel',
    'layout.close': 'Schließen',
    'layout.cellMenu': 'Fensteroptionen',
    'layout.selectedWindow': 'Ausgewähltes Fenster',
    'layout.window': 'Fenster',
    'layout.deleteWindow': 'Fenster löschen',
    'layout.deleteLastDisabled': 'Mindestens ein Fenster muss erhalten bleiben',
    'layout.deleteSplitDisabled': 'Dieses Fenster kann nicht gelöscht werden, da die Anordnung rechteckig und verbunden bleiben muss',
    'layout.unmerge': 'Trennen',
    'layout.makeSash': 'In Flügel ändern',
    'layout.makeFixed': 'In Festverglasung ändern',
    'layout.openLeft': 'Von links öffnen',
    'layout.openRight': 'Von rechts öffnen',
    'layout.add': 'Fenster {direction} hinzufügen',
    'layout.merge': 'Fenster zusammenführen',
    'layout.transAdd': 'Stulpprofil verwenden',
    'layout.transRemove': 'Stulpprofil entfernen',
    'layout.direction.top': 'oben',
    'layout.direction.bottom': 'unten',
    'layout.direction.left': 'links',
    'layout.direction.right': 'rechts',
    'layout.single': 'Einzelfenster',
    'layout.verticalDivider': 'Vertikaler Pfosten',
    'layout.verticalFixedFixed': 'Vertikaler Pfosten — fest / fest',
    'layout.threeFixedColumns': 'Drei feste Felder',
    'layout.verticalSashSash': 'Vertikaler Pfosten — Flügel / Flügel',
    'layout.horizontalDivider': 'Horizontaler Riegel',
    'layout.horizontalFixedFixed': 'Horizontaler Riegel — fest / fest',
    'layout.threeFixedRows': 'Drei feste Reihen',
    'layout.topFixedTwoSashes': 'Oben fest — unten zwei Flügel',
    'profile.group.frame': 'Rahmenkomponenten',
    'profile.group.sash': 'Flügelkomponenten',
    'profile.group.bead': 'Glasleistenkomponenten',
    'profile.group.divider': 'Pfosten-/Riegelkomponenten',
    'profile.group.trans': 'Stulpprofil',
    'profile.toggleAll': 'Alle umschalten',
    'profile.filter.frame': 'Rahmen',
    'profile.filter.sash': 'Flügel',
    'profile.filter.gaskets': 'Dichtungen',
    'profile.filter.drainage': 'Entwässerungskappe',
    'profile.filter.foam': 'Dämmschaum',
    'profile.filter.bar': 'Dämmsteg',
    'profile.filter.locking': 'Verriegelungsstangen',
    'reset.confirm': 'Fenster auf die Ausgangskonfiguration zurücksetzen?',
    'feedback.languageSwitchUnavailable': 'Die Konfiguration konnte beim Sprachwechsel nicht beibehalten werden. Bitte versuchen Sie es erneut.',
  }),
});

let activeLocale = null;

function normalizeLocale(locale) {
  if (locale === 'ro' || locale === 'ro-RO') return 'ro-RO';
  if (locale === 'de' || locale === 'de-DE') return 'de-DE';
  return 'en-US';
}

function localeFromHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/\.$/, '');
  if (normalized === '360configurator.ro' || normalized === 'www.360configurator.ro') return 'ro-RO';
  if (normalized === '360konfigurator.de' || normalized === 'www.360konfigurator.de') return 'de-DE';
  return 'en-US';
}

function interpolate(message, variables = {}) {
  return String(message).replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : `{${key}}`
  ));
}

export function resolveWindowLocale(locale = null) {
  if (locale) return normalizeLocale(locale);
  if (activeLocale) return activeLocale;
  return localeFromHostname(typeof window !== 'undefined' ? window.location.hostname : '');
}

export function getWindowLocale() {
  return resolveWindowLocale();
}

export function windowT(locale, key, variables = {}) {
  const resolved = resolveWindowLocale(locale);
  const message = MESSAGES[resolved]?.[key] ?? MESSAGES['en-US'][key] ?? key;
  return interpolate(message, variables);
}

export function windowPlural(locale, key, count, variables = {}) {
  return windowT(locale, `${key}.${Number(count) === 1 ? 'one' : 'other'}`, { count, ...variables });
}

export function localizeAccessoryGroup(locale, group) {
  if (!group) return group;
  return {
    ...group,
    label: windowT(locale, `accessory.group.${group.id}.label`),
    description: windowT(locale, `accessory.group.${group.id}.description`),
  };
}

export function localizeAccessoryPreset(locale, preset) {
  if (!preset) return preset;
  return {
    ...preset,
    description: windowT(locale, `accessory.preset.${preset.id}.description`),
  };
}

export function localizeFinishSelection(locale, selection) {
  if (!selection) return '';
  return windowT(locale, `finish.preset.${selection.type}.${selection.presetId}`);
}

export function localizeLayoutLabel(locale, layoutId, fallback = '') {
  const keys = {
    'single': 'layout.single',
    'vertical-divider': 'layout.verticalDivider',
    'vertical-fixed-fixed': 'layout.verticalFixedFixed',
    'vertical-fixed-fixed-fixed': 'layout.threeFixedColumns',
    'vertical-sash-sash': 'layout.verticalSashSash',
    'horizontal-divider': 'layout.horizontalDivider',
    'horizontal-fixed-fixed': 'layout.horizontalFixedFixed',
    'horizontal-fixed-fixed-fixed': 'layout.threeFixedRows',
    'top-fixed-bottom-sash-sash': 'layout.topFixedTwoSashes',
  };
  return keys[layoutId] ? windowT(locale, keys[layoutId]) : fallback;
}

function setText(selector, locale, key) {
  const element = document.querySelector(selector);
  if (element) element.textContent = windowT(locale, key);
}

function setAttr(selector, attribute, locale, key) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, windowT(locale, key));
}

function setOption(selectSelector, value, locale, key) {
  const option = document.querySelector(`${selectSelector} option[value="${value}"]`);
  if (option) option.textContent = windowT(locale, key);
}

function translateFinishTypeButtons(locale) {
  document.querySelectorAll('[data-finish-type]').forEach((button) => {
    button.textContent = windowT(locale, `finish.type.${button.dataset.finishType}`);
  });
}

export function applyWindowTranslations(locale = null) {
  const resolved = normalizeLocale(locale || localeFromHostname(typeof window !== 'undefined' ? window.location.hostname : ''));
  activeLocale = resolved;
  if (typeof document === 'undefined') return resolved;

  document.documentElement.lang = resolved === 'ro-RO' ? 'ro' : resolved === 'de-DE' ? 'de' : 'en';

  setText('#loading > div:nth-child(2)', resolved, 'loading.title');
  setText('#loading > div:nth-child(3)', resolved, 'loading.subtitle');
  setAttr('#toggleSectionViewBtn', 'aria-label', resolved, 'profile.sectionToggle');
  setAttr('#toggleSectionViewBtn', 'title', resolved, 'profile.sectionToggle');
  setText('label[for="cadProfile"]', resolved, 'profile.cadAssembly');
  setOption('#cadProfile', 'custom', resolved, 'profile.custom');
  setAttr('#cad-reference-button', 'aria-label', resolved, 'profile.cadReference');
  setAttr('#cad-reference-button', 'title', resolved, 'profile.cadReference');
  setText('label[for="outerFrameProfile"]', resolved, 'profile.outerFrame');
  setText('label[for="sashProfile"]', resolved, 'profile.sash');
  setText('label[for="windowLayout"]', resolved, 'profile.windowLayout');
  setText('label[for="dividerProfile"]', resolved, 'profile.divider');
  setText('label[for="transProfile"]', resolved, 'profile.trans');

  setText('#aluminiumFinishControls > label', resolved, 'finish.title');
  setAttr('.finish-mode-toggle', 'aria-label', resolved, 'finish.modeAria');
  setText('#finishModeSame', resolved, 'finish.uniform');
  setText('#finishModeDifferent', resolved, 'finish.bicolor');
  setAttr('#debugColorsButton', 'aria-label', resolved, 'finish.debugAria');
  setAttr('#debugColorsButton', 'title', resolved, 'finish.debugTitle');
  setText('#outsideFinishTitle', resolved, 'finish.outside');
  setText('#insideFinishCard .finish-side-header span', resolved, 'finish.inside');
  setAttr('#outsideFinishType', 'aria-label', resolved, 'finish.outsideTypeAria');
  setAttr('#insideFinishType', 'aria-label', resolved, 'finish.insideTypeAria');
  translateFinishTypeButtons(resolved);

  const widthLabel = document.querySelector('#widthA')?.closest('.control-group')?.querySelector('label');
  if (widthLabel?.firstChild) widthLabel.firstChild.textContent = `${windowT(resolved, 'dimension.width')}: `;
  const heightLabel = document.querySelector('#heightB')?.closest('.control-group')?.querySelector('label');
  if (heightLabel?.firstChild) heightLabel.firstChild.textContent = `${windowT(resolved, 'dimension.height')}: `;
  const glassLabel = document.querySelector('#glassThickness')?.closest('.control-group')?.querySelector('label');
  if (glassLabel?.firstChild) glassLabel.firstChild.textContent = `${windowT(resolved, 'dimension.glassThickness')}: `;

  setText('label[for="accessoryPreset"]', resolved, 'accessory.preset');
  setAttr('#accessoryPreset', 'aria-label', resolved, 'accessory.preset');
  setText('.accessory-availability-note', resolved, 'accessory.note');
  setAttr('#gasketPic', 'alt', resolved, 'component.gasket');
  setAttr('#beadPic', 'alt', resolved, 'component.glazingBead');

  setText('#professional-settings > .clean-dropdown-header span', resolved, 'professional.title');
  setText('#summary-settings > .clean-dropdown-header span', resolved, 'summary.title');
  setText('#summary-bom > .clean-dropdown-header span', resolved, 'summary.bom');
  setText('#summary-cuts > .clean-dropdown-header span', resolved, 'summary.cuts');
  setText('label[for="summaryAluminiumRate"] > span', resolved, 'summary.aluminiumRate');
  setText('label[for="summaryGlassRate"] > span', resolved, 'summary.glassRate');
  setText('#window-bom-source-note', resolved, 'summary.sourceNote');
  setText('#window-cuts-note', resolved, 'summary.cutsNote');
  const openingModeLabel = document.querySelector('#mBatant')?.closest('.control-group')?.querySelector('label');
  if (openingModeLabel) openingModeLabel.textContent = `${windowT(resolved, 'opening.mode')}:`;
  setAttr('#btnModeBatant', 'aria-label', resolved, 'opening.turn');
  setAttr('#btnModeBatant', 'title', resolved, 'opening.turn');
  setAttr('#btnModeOscilo', 'aria-label', resolved, 'opening.tilt');
  setAttr('#btnModeOscilo', 'title', resolved, 'opening.tilt');
  const angleLabel = document.querySelector('#openAngle')?.closest('.control-group')?.querySelector('label');
  if (angleLabel?.firstChild) angleLabel.firstChild.textContent = `${windowT(resolved, 'opening.angle')}: `;
  const actionBoxes = [...document.querySelectorAll('.action-box > label:first-child')];
  if (actionBoxes[0]) actionBoxes[0].textContent = windowT(resolved, 'view.exploded');
  if (actionBoxes[1]) actionBoxes[1].textContent = windowT(resolved, 'view.showHouse');

  const cleanHeaders = [...document.querySelectorAll('.part-toggles .clean-dropdown-header > span:first-child')];
  if (cleanHeaders[0]) cleanHeaders[0].textContent = windowT(resolved, 'components.types');
  if (cleanHeaders[1]) cleanHeaders[1].textContent = windowT(resolved, 'components.sideFilters');
  if (cleanHeaders[2]) cleanHeaders[2].textContent = windowT(resolved, 'components.profileComponents');
  const sideSpans = document.querySelectorAll('#side-filters > div > span:first-child');
  ['side.top', 'side.bottom', 'side.left', 'side.right'].forEach((key, index) => {
    if (sideSpans[index]) sideSpans[index].textContent = windowT(resolved, key);
  });

  const sidebarCollapsed = document.getElementById('controls')?.classList.contains('sidebar-collapsed');
  const sidebarKey = sidebarCollapsed ? 'sidebar.show' : 'sidebar.hide';
  setAttr('#sidebar-toggle', 'aria-label', resolved, sidebarKey);
  setAttr('#sidebar-toggle', 'title', resolved, sidebarKey);

  setAttr('#selected-window-panel', 'aria-label', resolved, 'layout.selectedWindow');
  setAttr('#selectedWindowClose', 'aria-label', resolved, 'layout.close');
  setText('.selected-window-kicker', resolved, 'layout.selectedWindow');
  const selectedWindowTitle = document.querySelector('.selected-window-title');
  if (selectedWindowTitle?.firstChild) selectedWindowTitle.firstChild.textContent = `${windowT(resolved, 'layout.window')} `;
  setText('#selectedWindowUnmerge', resolved, 'layout.unmerge');
  setText('#selectedWindowDelete', resolved, 'layout.deleteWindow');
  setAttr('#selectedWindowOpenLeft', 'aria-label', resolved, 'layout.openLeft');
  setAttr('#selectedWindowOpenLeft', 'title', resolved, 'layout.openLeft');
  setAttr('#selectedWindowOpenRight', 'aria-label', resolved, 'layout.openRight');
  setAttr('#selectedWindowOpenRight', 'title', resolved, 'layout.openRight');
  const selectedWindowOpeningLabels = document.querySelectorAll('.selected-window-opening-action > span');
  if (selectedWindowOpeningLabels[0]) selectedWindowOpeningLabels[0].textContent = windowT(resolved, 'side.left');
  if (selectedWindowOpeningLabels[1]) selectedWindowOpeningLabels[1].textContent = windowT(resolved, 'side.right');

  setAttr('#component-selection-popup', 'aria-label', resolved, 'selection.aria');
  setAttr('#component-selection-close', 'aria-label', resolved, 'selection.close');
  setText('.component-selection-kicker', resolved, 'selection.kicker');
  const sourceLabel = document.querySelector('.component-selection-source');
  if (sourceLabel?.firstChild) sourceLabel.firstChild.textContent = `${windowT(resolved, 'selection.part')} `;

  setAttr('#ar-platform-switch', 'aria-label', resolved, 'ar.platformAria');
  setText('#qr-ar-button', resolved, 'ar.generateQr');
  setAttr('#qr-close', 'aria-label', resolved, 'ar.close');
  setText('#qr-title', resolved, 'ar.exportTitle');
  setText('#qr-description', resolved, 'ar.description');
  setText('#qr-status', resolved, 'ar.preparing');
  setText('#qr-launch-link', resolved, 'ar.openLauncher');
  setText('#qr-download-model', resolved, 'ar.downloadModel');
  setText('#qr-check-published', resolved, 'ar.checkPublished');
  setAttr('#cad-reference-close', 'aria-label', resolved, 'ar.close');
  setText('#cad-reference-status', resolved, 'cad.loading');
  setAttr('#cad-reference-main-image', 'alt', resolved, 'profile.cadReference');
  setText('#ar-launch h1', resolved, 'ar.launchTitle');
  setText('#ar-launch p', resolved, 'ar.launchBody');
  setText('#ar-start-button', resolved, 'ar.launchPreparing');
  setText('#ar-status', resolved, 'ar.profileLoading');

  setOption('#windowLayout', 'single', resolved, 'layout.single');
  setOption('#windowLayout', 'vertical-divider', resolved, 'layout.verticalDivider');
  setOption('#windowLayout', 'vertical-fixed-fixed', resolved, 'layout.verticalFixedFixed');
  setOption('#windowLayout', 'vertical-fixed-fixed-fixed', resolved, 'layout.threeFixedColumns');
  setOption('#windowLayout', 'vertical-sash-sash', resolved, 'layout.verticalSashSash');
  setOption('#windowLayout', 'horizontal-divider', resolved, 'layout.horizontalDivider');
  setOption('#windowLayout', 'horizontal-fixed-fixed', resolved, 'layout.horizontalFixedFixed');
  setOption('#windowLayout', 'horizontal-fixed-fixed-fixed', resolved, 'layout.threeFixedRows');

  window.dispatchEvent(new CustomEvent('window-locale-applied', { detail: { locale: resolved } }));
  return resolved;
}

export function getWindowMessages(locale) {
  return MESSAGES[resolveWindowLocale(locale)] ?? MESSAGES['en-US'];
}
