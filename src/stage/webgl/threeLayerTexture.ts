import * as THREE from 'three';


export function configureLayerTexture(tex: THREE.Texture, maxAnisotropy = 16): THREE.Texture {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.max(1, Math.min(16, maxAnisotropy));
    tex.needsUpdate = true;
    return tex;
}
