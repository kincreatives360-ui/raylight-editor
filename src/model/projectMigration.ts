export function migrateLegacyProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = structuredClone(raw) as Record<string, any>;

  if (project.assets && typeof project.assets === 'object') {
    for (const asset of Object.values(project.assets)) {
      if (asset && typeof asset === 'object' && !('dataUrl' in asset)) {
        (asset as { dataUrl?: string }).dataUrl = '';
      }
    }
  }

  if (project.version == null && project.schemaVersion != null) {
    project.version = project.schemaVersion;
  }
  if (project.schemaVersion == null && project.version != null) {
    project.schemaVersion = project.version;
  }

  const schemaVer = project.schemaVersion ?? project.version ?? 1;
  if (schemaVer < 2) {
    if (Array.isArray(project.shots)) {
      for (const shot of project.shots) {
        if (Array.isArray(shot.framings)) {
          for (const f of shot.framings) {
            if (f && f.target) {
              if (typeof f.target.x === 'number') {
                f.target.x = Math.round(f.target.x * 1920);
              }
              if (typeof f.target.y === 'number') {
                f.target.y = Math.round(-f.target.y * 1080);
              }
            }
          }
        }
        if (Array.isArray(shot.cameraBlocks)) {
          for (const cb of shot.cameraBlocks) {
            if (cb.from) {
              if (typeof cb.from.anchorX === 'number') {
                cb.from.anchorX = Math.round(cb.from.anchorX * 1920);
              }
              if (typeof cb.from.anchorY === 'number') {
                cb.from.anchorY = Math.round(-cb.from.anchorY * 1080);
              }
            }
            if (cb.to) {
              if (typeof cb.to.anchorX === 'number') {
                cb.to.anchorX = Math.round(cb.to.anchorX * 1920);
              }
              if (typeof cb.to.anchorY === 'number') {
                cb.to.anchorY = Math.round(-cb.to.anchorY * 1080);
              }
            }
          }
        }
      }
    }
    project.schemaVersion = 2;
    project.version = 2;
  }

  if (Array.isArray(project.shots)) {
    for (const shot of project.shots) {
      if (typeof shot.durationMs === 'number') {
        shot.durationMs = Math.max(200, shot.durationMs);
      }

      if (Array.isArray(shot.cameraBlocks)) {
        for (const cb of shot.cameraBlocks) {
          if (typeof cb.durationMs === 'number') {
            cb.durationMs = Math.max(50, cb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.focusBlocks)) {
        for (const fb of shot.focusBlocks) {
          if (typeof fb.durationMs === 'number') {
            fb.durationMs = Math.max(10, fb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.effectBlocks)) {
        for (const eb of shot.effectBlocks) {
          if (typeof eb.durationMs === 'number') {
            eb.durationMs = Math.max(50, eb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.lightBlocks)) {
        for (const lb of shot.lightBlocks) {
          if (typeof lb.durationMs === 'number') {
            lb.durationMs = Math.max(50, lb.durationMs);
          }
        }
      }

      if (Array.isArray(shot.layers)) {
        for (const layer of shot.layers) {
          if (layer.entrance && layer.entrance.type === 'slide') {
            layer.entrance.type = 'slide-up';
          }
          if (layer.exit && layer.exit.type === 'slide') {
            layer.exit.type = 'slide-right';
          }
          if (Array.isArray(layer.entrances)) {
            for (const ent of layer.entrances) {
              if (ent && ent.type === 'slide') {
                ent.type = 'slide-up';
              }
            }
          }
          if (Array.isArray(layer.exits)) {
            for (const ex of layer.exits) {
              if (ex && ex.type === 'slide') {
                ex.type = 'slide-right';
              }
            }
          }

          if (Array.isArray(layer.blocks)) {
            for (const blk of layer.blocks) {
              if (typeof blk.durationMs === 'number') {
                blk.durationMs = Math.max(10, blk.durationMs);
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(project.shots)) {
    for (const shot of project.shots) {
      if (Array.isArray(shot.groups)) {
        for (const g of shot.groups) {
          if (g && typeof g === 'object') {
            if (g.collapsed === undefined) g.collapsed = false;
            if (g.hidden === undefined) g.hidden = false;
            if (g.locked === undefined) g.locked = false;
          }
        }
      }
    }
  }

  return project;
}

