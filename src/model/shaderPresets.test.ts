// src/model/shaderPresets.test.ts
import { describe, it, expect } from 'vitest';
import { SHADER_PRESET_IDS, SHADER_PRESETS, SHADER_PRESET_METADATA } from './backgroundPresets';
import { ShaderPresetSchema } from './schema';

describe('Shader Preset Canonical Definition and Schema Validation', () => {
    it('contains all 25 canonical shader presets', () => {
        expect(SHADER_PRESET_IDS.length).toBe(25);
        expect(SHADER_PRESETS.length).toBe(25);
        expect(SHADER_PRESETS).toEqual(SHADER_PRESET_IDS);
    });

    it('has metadata for every canonical preset', () => {
        for (const id of SHADER_PRESET_IDS) {
            expect(SHADER_PRESET_METADATA[id]).toBeDefined();
            expect(typeof SHADER_PRESET_METADATA[id].label).toBe('string');
            expect(typeof SHADER_PRESET_METADATA[id].description).toBe('string');
        }
    });

    it('validates every canonical preset with ShaderPresetSchema', () => {
        for (const id of SHADER_PRESET_IDS) {
            const parseResult = ShaderPresetSchema.safeParse(id);
            expect(parseResult.success).toBe(true);
            if (parseResult.success) {
                expect(parseResult.data).toBe(id);
            }
        }
    });

    it('rejects invalid or unknown preset identifiers', () => {
        const invalidCases = ['invalidPreset', 'nonExistent', '', 'SILK', 123, null, undefined];
        for (const invalid of invalidCases) {
            const parseResult = ShaderPresetSchema.safeParse(invalid);
            expect(parseResult.success).toBe(false);
        }
    });
});
