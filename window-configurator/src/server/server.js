const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..');
const CLIENT_ROOT = path.join(PROJECT_ROOT, 'src', 'client');
const SHARED_UI_ROOT = path.join(WORKSPACE_ROOT, 'shared-ui');
const SHARED_3D_ROOT = path.join(WORKSPACE_ROOT, 'shared-3d');
const GENERATED_DIR = path.join(PROJECT_ROOT, 'runtime', 'generated');
const CAD_SCREENSHOTS_DIR = path.join(CLIENT_ROOT, 'cad_screenshots');
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_MODEL_BYTES = 25 * 1024 * 1024;
const MODEL_TTL_MS = Number.parseInt(process.env.MODEL_TTL_MS || String(24 * 60 * 60 * 1000), 10);
const VIEWPORT = { width: 1200, height: 900 };


const PROFILE_SELECTIONS = Object.freeze({
    '2_4_Oeffnungselemnt_Vertikal': Object.freeze({
        profile: '2_4_Oeffnungselemnt_Vertikal',
        outerFrameProfileId: '575760',
        sashProfileId: '575780',
    }),
    '2_5_Oeffnungselemnt_Vertikal': Object.freeze({
        profile: '2_5_Oeffnungselemnt_Vertikal',
        outerFrameProfileId: '575770',
        sashProfileId: '575790',
    }),
    '2_6_Oeffnungselemnt_Vertikal': Object.freeze({
        profile: '2_6_Oeffnungselemnt_Vertikal',
        outerFrameProfileId: '575770',
        sashProfileId: '575790',
    }),
});

const PROFILE_ALIASES = Object.freeze({
    '2_6_Oeffnungselement_Vertikal': '2_6_Oeffnungselemnt_Vertikal',
});

function normalizeProfileSetId(value) {
    const requested = String(value || '').trim();
    return PROFILE_ALIASES[requested] || requested;
}

function resolveRenderProfileSelection(payload) {
    const requestedProfileValue = payload.profile || '2_6_Oeffnungselemnt_Vertikal';
    const requestedProfileId = normalizeProfileSetId(requestedProfileValue);
    const requestedProfile = PROFILE_SELECTIONS[requestedProfileId] || null;

    if (!requestedProfile) {
        throw new Error('Unsupported CAD profile.');
    }

    const outerFrameProfileId = String(
        payload.outer_frame_profile
        ?? payload.outer_frame
        ?? payload.outerFrameProfileId
        ?? requestedProfile.outerFrameProfileId
    ).trim();
    const sashProfileId = String(
        payload.sash_profile
        ?? payload.sashProfileId
        ?? requestedProfile.sashProfileId
    ).trim();

    const availableOuterFrames = new Set(['575760', '575770']);
    const availableSashes = new Set(['575780', '575790']);

    if (!availableOuterFrames.has(outerFrameProfileId)) {
        throw new Error(`Outer-frame profile ${outerFrameProfileId} has no converted geometry.`);
    }
    if (!availableSashes.has(sashProfileId)) {
        throw new Error(`Sash profile ${sashProfileId} has no converted geometry.`);
    }

    // Frame and sash are intentionally independent. The selected complete CAD
    // assembly is retained only as a temporary source for legacy geometry.
    return {
        ...requestedProfile,
        outerFrameProfileId,
        sashProfileId,
    };
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.glb': 'model/gltf-binary',
    '.usdz': 'model/vnd.usdz+zip',
    '.gltf': 'model/gltf+json'
};

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.mkdirSync(CAD_SCREENSHOTS_DIR, { recursive: true });

let browserPromise = null;
let renderPageState = null;
let renderQueue = Promise.resolve();

function getBrowser() {
    if (!browserPromise) {
        browserPromise = chromium.launch({
            headless: true,
            args: ['--disable-dev-shm-usage'],
        }).catch((error) => {
            browserPromise = null;
            throw error;
        });
    }
    return browserPromise;
}

async function resetRenderPage() {
    if (renderPageState) {
        try {
            await renderPageState.context.close();
        } catch {
            // Ignore cleanup errors.
        }
        renderPageState = null;
    }
}

async function getRenderPage() {
    if (renderPageState && !renderPageState.page.isClosed()) {
        return renderPageState.page;
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            console.error(`[browser:${message.type()}]`, message.text());
        }
    });
    page.on('pageerror', (error) => {
        console.error('[browser:pageerror]', error);
    });
    page.on('requestfailed', (request) => {
        console.error('[browser:requestfailed]', request.url(), request.failure()?.errorText || 'unknown error');
    });

    const pageUrl = `http://127.0.0.1:${PORT}/?capture=1`;

    await page.goto(pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
    });

    await page.waitForFunction(
        () => window.CONFIGURATOR_READY === true,
        null,
        { timeout: 15000 }
    );

    renderPageState = { context, page };
    return page;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    const body = Buffer.from(JSON.stringify(payload));
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        ...extraHeaders,
    });
    res.end(body);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;

        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(new Error('Request body is too large.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch {
                reject(new Error('Request body must be valid JSON.'));
            }
        });

        req.on('error', reject);
    });
}

function parseBooleanPayload(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (value === null || value === undefined || value === '') return fallback;

    const normalized = String(value).trim().toLowerCase();
    if (['0', 'false', 'off', 'no', 'disabled'].includes(normalized)) return false;
    if (['1', 'true', 'on', 'yes', 'enabled'].includes(normalized)) return true;
    return fallback;
}


const ACCESSORY_PRESET_DEFAULTS = Object.freeze({
    'b2-6': Object.freeze({ insulationProfile: false }),
    'b2-7': Object.freeze({ insulationProfile: false }),
    'b2-8': Object.freeze({ insulationProfile: true }),
});

const ACCESSORY_FIELDS = Object.freeze([
    ['lockingBar', 'locking_bar', 'locking-bar', true],
    ['centreGasket', 'centre_gasket', 'centre-gasket', true],
    ['insulationProfile', 'insulation_profile', 'insulation-profile', false],
    ['glazingRebateInsulation', 'glazing_rebate_insulation', 'glazing-rebate-insulation', false],
    ['rebateGasket', 'rebate_gasket', 'rebate-gasket', true],
    ['outerGlazingGasket', 'outer_glazing_gasket', 'outer-glazing-gasket', true],
    ['innerGlazingGasket', 'inner_glazing_gasket', 'inner-glazing-gasket', true],
    ['glazingBridge', 'glazing_bridge', 'glazing-bridge', true],
    ['jointSealingPiece', 'joint_sealing_piece', 'joint-sealing-piece', false],
    ['transEndCap', 'trans_end_cap', 'trans-end-cap', false],
    ['drainageCap', 'drainage_cap', 'drainage-cap', true],
]);

function parseAccessoryPayload(payload) {
    const requestedPreset = String(
        payload.accessory_preset
        ?? payload.accessoryPreset
        ?? 'b2-6'
    ).trim().toLowerCase();
    const basePresetId = ACCESSORY_PRESET_DEFAULTS[requestedPreset]
        ? requestedPreset
        : 'b2-6';
    const presetDefaults = ACCESSORY_PRESET_DEFAULTS[basePresetId];
    const result = {};
    let customized = requestedPreset === 'custom';

    for (const [camelKey, snakeKey, groupId, fallback] of ACCESSORY_FIELDS) {
        const nestedValue = payload.accessories?.[groupId]?.enabled;
        const rawValue = payload[snakeKey] ?? payload[camelKey] ?? nestedValue;
        const defaultValue = Object.prototype.hasOwnProperty.call(presetDefaults, camelKey)
            ? presetDefaults[camelKey]
            : fallback;
        result[camelKey] = parseBooleanPayload(rawValue, defaultValue);
        if (rawValue !== undefined && result[camelKey] !== defaultValue) {
            customized = true;
        }
    }

    result.accessoryPreset = customized ? 'custom' : basePresetId;
    return result;
}

function parseRenderPayload(payload) {
    const widthMm = Number(payload.width_mm ?? payload.width);
    const heightMm = Number(payload.height_mm ?? payload.height);
    const widthM = widthMm > 10 ? widthMm / 1000 : widthMm;
    const heightM = heightMm > 10 ? heightMm / 1000 : heightMm;

    if (!Number.isFinite(widthM) || widthM < 0.5 || widthM > 3.0) {
        throw new Error('Width must be between 500 and 3000 mm.');
    }
    if (!Number.isFinite(heightM) || heightM < 0.5 || heightM > 3.0) {
        throw new Error('Height must be between 500 and 3000 mm.');
    }

    const glassThicknessMm = Number(
        payload.glass_thickness_mm
        ?? payload.glassThicknessMm
        ?? payload.glass_thickness
        ?? 24
    );
    if (!Number.isFinite(glassThicknessMm) || glassThicknessMm < 16 || glassThicknessMm > 29) {
        throw new Error('Glass thickness must be between 16 and 29 mm.');
    }

    const accessoryConfiguration = parseAccessoryPayload(payload);

    const colour = String(payload.colour || payload.color || '#e2e8f0');
    if (!/^#[0-9a-fA-F]{6}$/.test(colour)) {
        throw new Error('Colour must use the #RRGGBB format.');
    }

    const profileSelection = resolveRenderProfileSelection(payload);

    return {
        widthM,
        heightM,
        colour,
        profile: profileSelection.profile,
        outerFrameProfileId: profileSelection.outerFrameProfileId,
        sashProfileId: profileSelection.sashProfileId,
        glassThicknessMm,
        ...accessoryConfiguration,
        requestId: String(payload.request_id || ''),
    };
}

async function performRender(payload) {
    const requestToken = crypto.randomUUID();
    const requested = { ...payload, requestToken };
    let page;

    async function applyAndVerify(targetPage) {
        const applied = await targetPage.evaluate(async (configuration) => {
            return await window.applyConfiguration(configuration);
        }, requested);

        const matches = applied
            && applied.requestToken === requestToken
            && Math.abs(applied.widthM - payload.widthM) < 0.000001
            && Math.abs(applied.heightM - payload.heightM) < 0.000001
            && String(applied.colour).toLowerCase() === payload.colour.toLowerCase()
            && applied.profile === payload.profile
            && applied.outerFrameProfileId === payload.outerFrameProfileId
            && applied.sashProfileId === payload.sashProfileId
            && Math.abs(applied.glassThicknessMm - payload.glassThicknessMm) < 0.000001
            && applied.accessoryPreset === payload.accessoryPreset
            && ACCESSORY_FIELDS.every(([camelKey]) => applied[camelKey] === payload[camelKey]);

        if (!matches) {
            throw new Error(`Configurator state verification failed. Applied: ${JSON.stringify(applied)}`);
        }

        await targetPage.waitForFunction(
            (token) => window.CONFIGURATOR_READY === true
                && window.LAST_APPLIED_CONFIGURATION
                && window.LAST_APPLIED_CONFIGURATION.requestToken === token,
            requestToken,
            { timeout: 10000 }
        );
    }

    try {
        page = await getRenderPage();
        await applyAndVerify(page);
    } catch (firstError) {
        console.warn('[render] first attempt failed; recreating render page:', firstError.message);
        await resetRenderPage();
        page = await getRenderPage();
        await applyAndVerify(page);
    }

    return await page.screenshot({
        type: 'png',
        clip: {
            x: 0,
            y: 0,
            width: VIEWPORT.width,
            height: VIEWPORT.height,
        },
    });
}

async function renderConfigurator(req, res) {
    try {
        const payload = parseRenderPayload(await readJsonBody(req));

        const job = renderQueue.then(() => performRender(payload));
        renderQueue = job.catch(() => undefined);
        const image = await job;

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': image.length,
            'Cache-Control': 'no-store',
            'X-Render-Request-Id': payload.requestId,
        });
        res.end(image);
    } catch (error) {
        console.error('[render]', error);
        sendJson(res, 400, {
            success: false,
            error: error.message || 'Render failed.',
        });
    }
}

function publicOrigin(req) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const protocol = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
    const host = forwardedHost || req.headers.host || `localhost:${PORT}`;
    return `${protocol}://${host}`;
}

function cleanupExpiredModels() {
    const now = Date.now();
    fs.readdir(GENERATED_DIR, { withFileTypes: true }, (readError, entries) => {
        if (readError) return;
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.glb')) continue;
            const filePath = path.join(GENERATED_DIR, entry.name);
            fs.stat(filePath, (statError, stat) => {
                if (!statError && now - stat.mtimeMs > MODEL_TTL_MS) {
                    fs.unlink(filePath, () => {});
                }
            });
        }
    });
}

function handleModelUpload(req, res) {
    const chunks = [];
    let received = 0;

    req.on('data', chunk => {
        received += chunk.length;
        if (received > MAX_MODEL_BYTES) {
            sendJson(res, 413, { error: 'The generated model is too large.' });
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });

    req.on('end', () => {
        if (res.writableEnded) return;
        const model = Buffer.concat(chunks);
        if (model.length < 20 || model.toString('utf8', 0, 4) !== 'glTF') {
            sendJson(res, 400, { error: 'The upload is not a valid binary glTF (.glb) file.' });
            return;
        }

        const id = crypto.randomUUID();
        const filename = `${id}.glb`;
        const filePath = path.join(GENERATED_DIR, filename);

        fs.writeFile(filePath, model, writeError => {
            if (writeError) {
                sendJson(res, 500, { error: 'Could not store the generated AR model.' });
                return;
            }

            const origin = publicOrigin(req);
            const modelUrl = `${origin}/generated/${filename}`;
            const launchUrl = `${origin}/ar.html?model=${encodeURIComponent(modelUrl)}`;
            sendJson(res, 201, {
                id,
                modelUrl,
                launchUrl,
                expiresInSeconds: Math.floor(MODEL_TTL_MS / 1000)
            });
        });
    });

    req.on('error', error => {
        if (!res.writableEnded) {
            sendJson(res, 500, { error: error.message });
        }
    });
}

function inspectUploadedGLB(buffer) {
    if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') {
        throw new Error('Missing GLB header.');
    }
    const version = buffer.readUInt32LE(4);
    const declaredLength = buffer.readUInt32LE(8);
    const jsonLength = buffer.readUInt32LE(12);
    const jsonType = buffer.readUInt32LE(16);
    if (version !== 2) throw new Error(`Unsupported GLB version ${version}.`);
    if (declaredLength !== buffer.length) throw new Error('GLB file length does not match its header.');
    if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.length) {
        throw new Error('Invalid GLB JSON chunk.');
    }
    const document = JSON.parse(
        buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/g, '').trim()
    );
    if (document.asset?.version !== '2.0' || !document.meshes?.length) {
        throw new Error('The GLB is not a mesh-containing glTF 2.0 asset.');
    }
    return {
        meshes: document.meshes.length,
        materials: document.materials?.length || 0,
        nodes: document.nodes?.length || 0,
    };
}

function handleContentAddressedModelUpload(req, res) {
    const chunks = [];
    let received = 0;
    let rejected = false;

    req.on('data', chunk => {
        if (rejected) return;
        received += chunk.length;
        if (received > MAX_MODEL_BYTES) {
            rejected = true;
            sendJson(res, 413, { error: `The generated GLB exceeds ${MAX_MODEL_BYTES} bytes.` });
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });

    req.on('end', () => {
        if (rejected || res.writableEnded) return;
        const model = Buffer.concat(chunks);
        let structure;
        try {
            structure = inspectUploadedGLB(model);
        } catch (error) {
            sendJson(res, 400, { error: `GLB validation failed: ${error.message}` });
            return;
        }

        const hash = crypto.createHash('sha256').update(model).digest('hex');
        const directory = path.join(GENERATED_DIR, hash.slice(0, 2));
        const filename = `${hash}.glb`;
        const filePath = path.join(directory, filename);
        fs.mkdirSync(directory, { recursive: true });
        const created = !fs.existsSync(filePath);
        if (created) fs.writeFileSync(filePath, model);

        const origin = publicOrigin(req);
        sendJson(res, created ? 201 : 200, {
            ok: true,
            created,
            key: `models/${hash.slice(0, 2)}/${filename}`,
            modelUrl: `${origin}/models/${hash.slice(0, 2)}/${filename}`,
            size: model.length,
            sha256: hash,
            structure,
            note: 'This local URL is not reachable from a phone unless the server is exposed over public HTTPS.',
        });
    });

    req.on('error', error => {
        if (!res.writableEnded) sendJson(res, 500, { error: error.message });
    });
}

function serveContentAddressedModel(req, res, pathname) {
    const match = pathname.match(/^\/models\/([a-f0-9]{2})\/([a-f0-9]{64})\.glb$/);
    if (!match) return false;

    const filePath = path.join(GENERATED_DIR, match[1], `${match[2]}.glb`);
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
        });
        res.end('Not Found');
        return true;
    }

    const stat = fs.statSync(filePath);
    const headers = {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
    };

    const range = req.headers.range;
    if (range) {
        const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!parsed) {
            res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return true;
        }
        const start = parsed[1] ? Number.parseInt(parsed[1], 10) : 0;
        const end = parsed[2] ? Math.min(Number.parseInt(parsed[2], 10), stat.size - 1) : stat.size - 1;
        if (start > end || start >= stat.size) {
            res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return true;
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(filePath, { start, end }).pipe(res);
        return true;
    }

    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(filePath).pipe(res);
    return true;
}

function listCadScreenshots(req, res, requestUrl) {
    const allowedProfiles = new Set([
        '2_6_Oeffnungselement_Vertikal',
        '2_6_Oeffnungselemnt_Vertikal',
        '2_5_Oeffnungselement_Vertikal',
        '2_5_Oeffnungselemnt_Vertikal',
        '2_4_Oeffnungselemnt_Vertikal',
    ]);
    const profile = String(requestUrl.searchParams.get('profile') || '');

    if (!allowedProfiles.has(profile)) {
        sendJson(res, 400, {
            success: false,
            error: 'Unsupported CAD profile.',
        });
        return;
    }

    const profileDirectory = path.join(CAD_SCREENSHOTS_DIR, profile);

    fs.readdir(profileDirectory, { withFileTypes: true }, (error, entries) => {
        if (error) {
            if (error.code === 'ENOENT') {
                sendJson(res, 200, {
                    success: true,
                    profile,
                    images: [],
                });
                return;
            }

            sendJson(res, 500, {
                success: false,
                error: error.message,
            });
            return;
        }

        const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
        const images = entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(filename => allowedExtensions.has(path.extname(filename).toLowerCase()))
            .sort((a, b) => a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base',
            }))
            .map(filename => ({
                filename,
                url: `/cad_screenshots/${encodeURIComponent(profile)}/${encodeURIComponent(filename)}`,
            }));

        sendJson(res, 200, {
            success: true,
            profile,
            images,
        });
    });
}

function serveStaticFile(req, res, pathname) {
    const isGeneratedModel = pathname.startsWith('/generated/');
    const isSharedUi = pathname.startsWith('/shared-ui/');
    const isShared3d = pathname.startsWith('/shared-3d/');
    const baseDirectory = isGeneratedModel
        ? GENERATED_DIR
        : isSharedUi
            ? SHARED_UI_ROOT
            : isShared3d ? SHARED_3D_ROOT : CLIENT_ROOT;
    const requestedFile = pathname === '/' ? '/index.html' : pathname;
    const relativePath = isGeneratedModel
        ? requestedFile.slice('/generated'.length)
        : isSharedUi
            ? requestedFile.slice('/shared-ui'.length)
            : isShared3d ? requestedFile.slice('/shared-3d'.length) : requestedFile;
    const filePath = path.resolve(baseDirectory, `.${relativePath}`);

    if (filePath !== baseDirectory && !filePath.startsWith(`${baseDirectory}${path.sep}`)) {
        sendJson(res, 403, { success: false, error: 'Forbidden path.' });
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendJson(res, error.code === 'ENOENT' ? 404 : 500, {
                success: false,
                error: error.code === 'ENOENT' ? 'Not found.' : error.message,
            });
            return;
        }

        const extname = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[extname] || 'application/octet-stream',
            'Cache-Control': isGeneratedModel ? 'public, max-age=86400, immutable' : 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    try {
        const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
        const pathname = decodeURIComponent(requestUrl.pathname);

        if (req.method === 'OPTIONS' && pathname === '/api/models') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Model-Name, X-App-Build',
                'Access-Control-Max-Age': '86400',
            });
            res.end();
            return;
        }

        if (req.method === 'POST' && pathname === '/api/models') {
            handleContentAddressedModelUpload(req, res);
            return;
        }

        if ((req.method === 'GET' || req.method === 'HEAD') && serveContentAddressedModel(req, res, pathname)) {
            return;
        }

        if (req.method === 'GET' && pathname === '/health') {
            sendJson(res, 200, { ok: true });
            return;
        }

        if (req.method === 'GET' && pathname === '/api/health') {
            sendJson(res, 200, { success: true, service: 'window-configurator' });
            return;
        }

        if (req.method === 'GET' && pathname === '/api/cad-screenshots') {
            listCadScreenshots(req, res, requestUrl);
            return;
        }

        if (req.method === 'POST' && pathname === '/api/render') {
            await renderConfigurator(req, res);
            return;
        }

        if (req.method === 'POST' && pathname === '/api/ar-model') {
            handleModelUpload(req, res);
            return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendJson(res, 405, { success: false, error: 'Method not allowed.' });
            return;
        }

        serveStaticFile(req, res, pathname);
    } catch (error) {
        sendJson(res, 400, { success: false, error: `Bad request: ${error.message}` });
    }
});

cleanupExpiredModels();
setInterval(cleanupExpiredModels, 60 * 60 * 1000).unref();

server.listen(PORT, HOST, () => {
    console.log(`Window Configurator: http://localhost:${PORT}/`);
    console.log(`Render endpoint:     POST http://localhost:${PORT}/api/render`);
    console.log(`Local AR upload:     POST http://localhost:${PORT}/api/models`);

    // Automatically open browser (if not in a headless/automated environment)
    if (!process.env.PORT && !process.env.HOST) {
        const { exec } = require('child_process');
        let startCmd = 'start';
        if (process.platform === 'darwin') startCmd = 'open';
        if (process.platform === 'linux') startCmd = 'xdg-open';
        exec(`${startCmd} http://localhost:${PORT}/`);
    }
});

async function shutdown() {
    server.close();
    await resetRenderPage();
    if (browserPromise) {
        try {
            const browser = await browserPromise;
            await browser.close();
        } catch {
            // Ignore shutdown errors.
        }
    }
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
