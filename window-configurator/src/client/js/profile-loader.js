import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { normalizeHexColour } from './config.js';
import { simplifyProfileShape } from './geometry-utils.js?v=pbr-6';
import {
    collapseProfileShapes,
    extractFilledSvgShapes,
    mapProfileShapes,
} from './svg-profile-shapes.js';
import {
    DEFAULT_GASKET_PROFILE_ID,
    DEFAULT_GLAZING_BEAD_PROFILE_ID,
    createLegacyComponentMetadata,
    getGlazingBeadProfileIds,
    getLegacySvgCandidates,
    getProfileCatalogEntry,
    getSelectableGasketProfileIds,
    getStandaloneProfileMetadataUrl,
} from './profile-catalog.js';

const GLAZING_BEAD_CODES = getGlazingBeadProfileIds().filter(
    code => code !== DEFAULT_GLAZING_BEAD_PROFILE_ID
);
const GASKET_CODES = getSelectableGasketProfileIds().filter(
    code => code !== DEFAULT_GASKET_PROFILE_ID
);

function getProfileRole(profileClass) {
    if (profileClass === 'outer-frame') return 'frame';
    if (profileClass === 'sash') return 'sash';
    if (profileClass === 'trans') return 'trans';
    if (profileClass === 'mullion-transom') return 'divider';
    return 'frame';
}

function getPartMaterialInfo(part = {}) {
    const layer = String(part.layer || '').toLowerCase();
    const blockName = String(part.blockName || '').toLowerCase();

    const isAlu = layer.includes('al') || layer.includes('alu');
    const isIso = layer.includes('isolation') || layer.includes('isoli') || layer.includes('iso');
    const isGlass = layer.includes('glas') || layer.includes('glass');
    const isFoam = layer.includes('dämmung')
        || layer.includes('daemmung')
        || layer.includes('dämm')
        || layer.includes('daemm')
        || layer.includes('foam');

    const reviewedLayerColour = isFoam
        ? '#00ffbf'
        : (isIso
            ? '#66cc7f'
            : (isAlu ? '#adadad' : null));
    const baseCadColor = normalizeHexColour(part.color)
        || reviewedLayerColour
        || '#78716c';
    const isCentralSeal = baseCadColor === '#7fbfff'
        || baseCadColor === '#38bdf8'
        || layer.includes('grau_13')
        || blockName.includes('224068')
        || blockName.includes('problema');
    const isEPDM = !isCentralSeal && (
        layer.includes('epdm')
        || layer.includes('dichtung')
        || layer.includes('dicht')
        || layer.includes('gasket')
        || baseCadColor === '#ffbf7f'
        || baseCadColor === '#ea580c'
        || /^(200|224|244)/.test(blockName)
    );

    let materialKey = 'default';
    if (isGlass) {
        materialKey = 'glass';
    } else if (isCentralSeal) {
        materialKey = 'centralSeal';
    } else if (isEPDM) {
        materialKey = 'epdm';
    } else if (isIso) {
        materialKey = 'iso';
    } else if (isFoam) {
        materialKey = 'foam';
    } else if (isAlu) {
        materialKey = 'alu';
    }

    return {
        layer,
        blockName,
        baseCadColor,
        materialKey,
        isAlu,
        isIso,
    };
}

function optimizeLoadedShapes(shapes, materialKey) {
    const optimizedShape = mapProfileShapes(
        shapes,
        shape => simplifyProfileShape(shape, materialKey)
    );
    const optimizedShapes = Array.isArray(optimizedShape)
        ? optimizedShape
        : [optimizedShape];

    return {
        optimizedShape,
        sourceContourPoints: optimizedShapes.reduce(
            (sum, shape) => sum + (shape.userData?.sourcePointCount || 0),
            0
        ),
        optimizedContourPoints: optimizedShapes.reduce(
            (sum, shape) => sum + (shape.userData?.optimizedPointCount || 0),
            0
        ),
    };
}

function logContourOptimization(label, profiles) {
    const sourceContourPoints = profiles.reduce(
        (sum, profile) => sum + profile.sourceContourPoints,
        0
    );
    const optimizedContourPoints = profiles.reduce(
        (sum, profile) => sum + profile.optimizedContourPoints,
        0
    );

    if (sourceContourPoints <= 0) return;

    const reduction = 100 * (1 - optimizedContourPoints / sourceContourPoints);
    console.info(
        `Profile contour optimization for ${label}: `
        + `${sourceContourPoints.toLocaleString()} → `
        + `${optimizedContourPoints.toLocaleString()} points `
        + `(${reduction.toFixed(1)}% fewer).`
    );
}

function getComponentBounds(components) {
    const bounds = (components || [])
        .map(component => component.bbox)
        .filter(Boolean);

    if (!bounds.length) {
        return {
            globalMinX: 0,
            globalMaxX: 0,
            globalMinY: 0,
            globalMaxY: 0,
            globalCenterX: 0,
        };
    }

    const globalMinX = Math.min(...bounds.map(bbox => Number(bbox.minX)));
    const globalMaxX = Math.max(...bounds.map(bbox => Number(bbox.maxX)));
    const globalMinY = Math.min(...bounds.map(bbox => Number(bbox.minY)));
    const globalMaxY = Math.max(...bounds.map(bbox => Number(bbox.maxY)));

    return {
        globalMinX,
        globalMaxX,
        globalMinY,
        globalMaxY,
        globalCenterX: (globalMinX + globalMaxX) / 2,
    };
}

export function createProfileLoader() {
    const svgLoader = new SVGLoader();
    const profileCache = new Map();
    const standaloneProfileCache = new Map();

    function loadSvg(url) {
        return new Promise((resolve, reject) => {
            svgLoader.load(url, resolve, null, reject);
        });
    }

    async function loadFirstAvailableSvg(urls) {
        let lastError = null;

        for (const url of urls) {
            try {
                return await loadSvg(url);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error(
            `None of the SVG candidates could be loaded: ${urls.join(', ')}`
        );
    }

    async function loadCatalogAccessoryShapes(profileFolder, code, section) {
        const candidates = getLegacySvgCandidates(code, profileFolder, section);
        if (!candidates.length) {
            throw new Error(`No legacy SVG candidates are cataloged for profile ${code}.`);
        }

        const data = await loadFirstAvailableSvg(candidates);
        const shapes = extractFilledSvgShapes(data);
        const filename = candidates[0].split('/').pop();

        if (!shapes.length) {
            throw new Error(`No filled profile shape was found in ${filename}.`);
        }

        return collapseProfileShapes(shapes);
    }

    async function loadGasketShapes(profileFolder, code, section) {
        return loadCatalogAccessoryShapes(profileFolder, code, section);
    }

    async function loadGlazingBeadShapes(profileFolder, code, section) {
        return loadCatalogAccessoryShapes(profileFolder, code, section);
    }

    async function loadProfilePart(profileFolder, metadata, part) {
        const url = `svg/${profileFolder}/${part.relativeUrl || part.filename}`;
        const data = await loadSvg(url);
        const shapes = extractFilledSvgShapes(data);

        if (!shapes.length) {
            throw new Error(`No filled profile shape could be created from ${url}.`);
        }

        const materialInfo = getPartMaterialInfo(part);
        const legacyComponentMetadata = createLegacyComponentMetadata({
            profileFolder,
            part,
            materialKey: materialInfo.materialKey,
        });
        const {
            optimizedShape,
            sourceContourPoints,
            optimizedContourPoints,
        } = optimizeLoadedShapes(shapes, materialInfo.materialKey);

        let baseExplode = 0.12;
        if (part.role === 'sash') {
            baseExplode = 0.26;
        } else if (materialInfo.isIso) {
            baseExplode = 0.18;
        }

        const section = part.section || 'top';
        const isGlazingBeadTemplate = legacyComponentMetadata.profileId
            === DEFAULT_GLAZING_BEAD_PROFILE_ID;
        let beadShapes = null;

        if (isGlazingBeadTemplate) {
            beadShapes = {
                [DEFAULT_GLAZING_BEAD_PROFILE_ID]: optimizedShape,
            };

            for (const beadCode of GLAZING_BEAD_CODES) {
                try {
                    beadShapes[beadCode] = await loadGlazingBeadShapes(
                        profileFolder,
                        beadCode,
                        section
                    );
                } catch (error) {
                    console.warn(
                        `Could not load glazing bead ${beadCode} (${section}); `
                        + '573940 will be used as a fallback.',
                        error
                    );
                }
            }
        }

        const isGasketTemplate = legacyComponentMetadata.profileId
            === DEFAULT_GASKET_PROFILE_ID;
        let gasketShapes = null;

        if (isGasketTemplate) {
            gasketShapes = {
                [DEFAULT_GASKET_PROFILE_ID]: optimizedShape,
            };

            for (const gasketCode of GASKET_CODES) {
                try {
                    gasketShapes[gasketCode] = await loadGasketShapes(
                        profileFolder,
                        gasketCode,
                        section
                    );
                } catch (error) {
                    console.warn(
                        `Could not load gasket ${gasketCode} (${section}); `
                        + '224378 will be used as a fallback.',
                        error
                    );
                }
            }
        }

        const bboxCenterX = part.bbox
            ? (Number(part.bbox.minX) + Number(part.bbox.maxX)) / 2
            : metadata.globalCenterX;
        const aluminiumSide = materialInfo.materialKey === 'alu'
            ? (bboxCenterX < metadata.globalCenterX ? 'outside' : 'inside')
            : null;

        return {
            ...legacyComponentMetadata,
            index: part.index,
            layer: part.layer,
            blockName: part.blockName || `Part ${part.index}`,
            parentBlock: part.parentBlock,
            role: part.role,
            section,
            shape: optimizedShape,
            isGlazingBeadTemplate,
            beadShapes,
            isGasketTemplate,
            gasketShapes,
            sourceContourPoints,
            optimizedContourPoints,
            baseCadColor: materialInfo.baseCadColor,
            materialKey: materialInfo.materialKey,
            aluminiumSide,
            explodeOffset: baseExplode,
            bbox: part.bbox,
            sourceTransform: part.sourceTransform || null,
            isAlu: materialInfo.isAlu,
        };
    }

    async function loadStandaloneProfilePart({
        entry,
        metadata,
        component,
        componentIndex,
        baseUrl,
    }) {
        const url = `${baseUrl}/${component.svg}`;
        const data = await loadSvg(url);
        const shapes = extractFilledSvgShapes(data);

        if (!shapes.length) {
            throw new Error(`No filled standalone profile shape could be created from ${url}.`);
        }

        const materialInfo = getPartMaterialInfo(component);
        const {
            optimizedShape,
            sourceContourPoints,
            optimizedContourPoints,
        } = optimizeLoadedShapes(shapes, materialInfo.materialKey);
        const role = getProfileRole(entry.profileClass);

        let explodeOffset = role === 'sash' ? 0.26 : 0.12;
        if (materialInfo.isIso) {
            explodeOffset = 0.18;
        }

        return {
            index: componentIndex,
            legacyIndex: null,
            legacyIndexes: [],
            componentId: `standalone:${entry.id}:${component.id}`,
            componentType: 'aluminium-profile',
            componentRole: entry.profileClass,
            profileId: entry.id,
            catalogProfileId: entry.id,
            layer: component.layer || '',
            blockName: component.blockName || component.id || `Part ${componentIndex}`,
            parentBlock: component.parentBlock || metadata.id,
            rootBlock: component.rootBlock || metadata.id,
            role,
            section: 'top',
            placementSection: 'all',
            shape: optimizedShape,
            sourceContourPoints,
            optimizedContourPoints,
            baseCadColor: materialInfo.baseCadColor,
            materialKey: materialInfo.materialKey,
            aluminiumSide: null,
            explodeOffset,
            bbox: component.bbox,
            isAlu: materialInfo.isAlu,
            isStandaloneProfileComponent: true,
            standaloneProfileId: entry.id,
            standaloneComponentId: component.id,
            standaloneMetadataUrl: entry.geometry.generatedMetadata,
            standaloneSvgUrl: url,
            sourceHierarchy: component.hierarchy || [],
        };
    }

    async function getProfileDefinition(profileFolder) {
        if (profileCache.has(profileFolder)) {
            return profileCache.get(profileFolder);
        }

        const response = await fetch(`svg/${profileFolder}/metadata.json`);
        if (!response.ok) {
            throw new Error(`Metadata request failed with HTTP ${response.status}`);
        }

        const metadata = await response.json();
        const profiles = await Promise.all(
            metadata.parts.map(part => loadProfilePart(profileFolder, metadata, part))
        );

        logContourOptimization(profileFolder, profiles);

        const definition = { metadata, profiles };
        profileCache.set(profileFolder, definition);
        return definition;
    }

    async function getStandaloneProfileDefinition(profileId) {
        const entry = getProfileCatalogEntry(profileId);
        const metadataUrl = getStandaloneProfileMetadataUrl(entry);
        if (!entry || !metadataUrl) {
            throw new Error(`Profile ${profileId} has no registered standalone runtime geometry.`);
        }

        if (standaloneProfileCache.has(entry.id)) {
            return standaloneProfileCache.get(entry.id);
        }

        const response = await fetch(metadataUrl);
        if (!response.ok) {
            throw new Error(
                `Standalone metadata request for ${entry.id} failed with HTTP ${response.status}`
            );
        }

        const rawMetadata = await response.json();
        const components = rawMetadata.geometry?.components || [];
        if (!components.length) {
            throw new Error(`Standalone profile ${entry.id} contains no selectable components.`);
        }

        const baseUrl = metadataUrl.slice(0, metadataUrl.lastIndexOf('/'));
        const profiles = await Promise.all(components.map((component, componentIndex) =>
            loadStandaloneProfilePart({
                entry,
                metadata: rawMetadata,
                component,
                componentIndex,
                baseUrl,
            })
        ));
        const componentBounds = getComponentBounds(components);
        const metadata = {
            ...rawMetadata,
            ...componentBounds,
            profileId: entry.id,
            profileClass: entry.profileClass,
            isVertical: false,
            hasSplit: false,
            geometrySource: 'standalone-profile',
        };

        logContourOptimization(`standalone ${entry.id}`, profiles);

        const definition = {
            metadata,
            rawMetadata,
            profiles,
            catalogEntry: entry,
        };
        standaloneProfileCache.set(entry.id, definition);
        return definition;
    }

    return {
        getProfileDefinition,
        getStandaloneProfileDefinition,
    };
}
