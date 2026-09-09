// Shared editor/runtime schema. Values are whole millimetres; geometry uses metres.
// The 450 mm floor is the existing grid/geometry minimum, not an editable price rule.
export const WINDOW_SIZE_MIN_MM = 450;
export const WINDOW_SIZE_MAX_MM = 25000;
export const DEFAULT_WINDOW_SIZE_LIMITS = Object.freeze({
    "overall": {
        "width": {
            "minMm": 450,
            "maxMm": 25000
        },
        "height": {
            "minMm": 450,
            "maxMm": 25000
        }
    },
    "individual": {
        "width": {
            "minMm": 450,
            "maxMm": 2500
        },
        "height": {
            "minMm": 450,
            "maxMm": 2500
        }
    }
});
for (const group of Object.values(DEFAULT_WINDOW_SIZE_LIMITS)) {
    for (const range of Object.values(group)) Object.freeze(range);
    Object.freeze(group);
}

export function validateWindowSizeLimits(value) {
    const exact = (object, keys) => object !== null && typeof object === 'object'
        && !Array.isArray(object) && Object.keys(object).length === keys.length
        && keys.every(key => Object.prototype.hasOwnProperty.call(object, key));
    const fail = (message, field = '') => {
        const error = new Error(message);
        error.field = field;
        throw error;
    };
    if (!exact(value, ['overall', 'individual'])) fail('Include both overall and individual window size limits.');
    const result = {};
    for (const scope of ['overall', 'individual']) {
        if (!exact(value[scope], ['width', 'height'])) fail(`Include width and height limits for ${scope} sizes.`);
        result[scope] = {};
        for (const axis of ['width', 'height']) {
            const range = value[scope][axis];
            const field = `${scope}.${axis}`;
            if (!exact(range, ['minMm', 'maxMm'])) fail(`Invalid ${scope} ${axis} range.`, field);
            for (const key of ['minMm', 'maxMm']) {
                if (!Number.isSafeInteger(range[key]) || range[key] < WINDOW_SIZE_MIN_MM || range[key] > WINDOW_SIZE_MAX_MM) {
                    fail(`Use whole millimetres between ${WINDOW_SIZE_MIN_MM} and ${WINDOW_SIZE_MAX_MM}.`, `${field}.${key}`);
                }
            }
            if (range.minMm >= range.maxMm) fail('The minimum must be smaller than the maximum.', `${field}.maxMm`);
            result[scope][axis] = { minMm: range.minMm, maxMm: range.maxMm };
        }
    }
    for (const axis of ['width', 'height']) {
        if (result.individual[axis].maxMm > result.overall[axis].maxMm) {
            fail(`Individual ${axis} cannot exceed the overall maximum.`, `individual.${axis}.maxMm`);
        }
    }
    return result;
}

export const WINDOW_SIZE_CONTROLS = Object.freeze([
    { scope: 'overall', axis: 'width', rangeId: 'overallWidthA', valueId: 'valOverallWidth' },
    { scope: 'overall', axis: 'height', rangeId: 'overallHeightB', valueId: 'valOverallHeight' },
    { scope: 'individual', axis: 'width', rangeId: 'widthA', valueId: 'valWidth' },
    { scope: 'individual', axis: 'height', rangeId: 'heightB', valueId: 'valHeight' },
].map(Object.freeze));

// Set attributes only: restoring a saved model must not silently resize its geometry.
export function applyWindowSliderBounds(limits, root = globalThis.document) {
    if (!root) return;
    const set = (input, key, value) => { if (input && input[key] !== value) input[key] = value; };
    for (const control of WINDOW_SIZE_CONTROLS) {
        const range = root.getElementById(control.rangeId);
        const number = root.getElementById(control.valueId);
        const bounds = limits[control.scope][control.axis];
        const layoutMin = control.scope === 'overall' ? Number(range?.dataset.layoutMinimumM) * 1000 || 0 : 0;
        const minMm = Math.min(bounds.maxMm, Math.max(bounds.minMm, Math.ceil(layoutMin - 1e-6)));
        set(range, 'min', (minMm / 1000).toFixed(3));
        set(range, 'max', (bounds.maxMm / 1000).toFixed(3));
        set(number, 'min', String(minMm));
        set(number, 'max', String(bounds.maxMm));
    }
}
