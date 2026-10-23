// src/model/id.ts

/**
 * Collision-resistant ID generation utility.
 * Generates unique IDs using crypto.randomUUID() when available,
 * with a high-entropy fallback for older runtimes.
 */
let fallbackCounter = 0;

export function generateId(prefix = 'id'): string {
    fallbackCounter = (fallbackCounter + 1) & 0xffff;

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${prefix}-${hex}`;
    }

    const rand = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix}-${time}-${rand}-${fallbackCounter.toString(36)}`;
}

/**
 * Ensures an ID is unique within a given set of existing IDs.
 */
export function ensureUniqueId(preferredId: string, existingIds: Set<string>, prefix = 'id'): string {
    if (!existingIds.has(preferredId)) {
        return preferredId;
    }
    let candidate = preferredId;
    while (existingIds.has(candidate)) {
        candidate = generateId(prefix);
    }
    return candidate;
}
