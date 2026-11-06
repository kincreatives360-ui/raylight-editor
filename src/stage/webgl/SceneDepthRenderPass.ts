import * as THREE from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

/**
 * Renders the scene into its own colour + depth target, then copies the colour into the composer's
 * working buffer. The depth texture belongs to that target only, so no later pass ever draws into a
 * buffer that also holds the depth texture it is reading. That mix-up (a WebGL "feedback loop") made
 * depth of field flicker whenever the composer's two buffers swapped roles.
 */
export class SceneDepthRenderPass extends RenderPass {
    readonly sceneTarget: THREE.WebGLRenderTarget;
    private readonly copyPass = new ShaderPass(CopyShader);

    constructor(scene: THREE.Scene, camera: THREE.Camera, sceneTarget: THREE.WebGLRenderTarget) {
        super(scene, camera);
        this.sceneTarget = sceneTarget;
    }

    override render(
        renderer: THREE.WebGLRenderer,
        writeBuffer: THREE.WebGLRenderTarget,
        readBuffer: THREE.WebGLRenderTarget,
        deltaTime?: number,
        maskActive?: boolean
    ): void {
        // The composer's current read buffer is where the next effect pass expects the scene colour.
        super.render(renderer, writeBuffer, this.sceneTarget, deltaTime, maskActive);
        this.copyPass.render(renderer, readBuffer, this.sceneTarget, deltaTime, maskActive);
    }

    override dispose(): void {
        this.copyPass.dispose();
        super.dispose();
    }
}
