// src/model/idUniqueness.test.ts
import { describe, it, expect } from 'vitest';
import { generateId, ensureUniqueId } from './id';

describe('ID Generation Uniqueness', () => {
    it('P2: generates 10,000 unique collision-resistant IDs in a single synchronous tick', () => {
        const idSet = new Set<string>();
        const count = 10000;

        for (let i = 0; i < count; i++) {
            const id = generateId('test');
            expect(idSet.has(id)).toBe(false);
            idSet.add(id);
        }

        expect(idSet.size).toBe(count);
    });

    it('P2: ensureUniqueId guarantees uniqueness within existing ID sets', () => {
        const existing = new Set(['shot-1', 'shot-2']);
        const unique = ensureUniqueId('shot-1', existing, 'shot');
        expect(unique).not.toBe('shot-1');
        expect(existing.has(unique)).toBe(false);

        const newId = ensureUniqueId('shot-new', existing, 'shot');
        expect(newId).toBe('shot-new');
    });
});
