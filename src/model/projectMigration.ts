export function migrateLegacyProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
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
      if (typeof shot.startMs === 'number') {
        shot.startMs = Math.max(0, shot.startMs);
      }

      if (Array.isArray(shot.cameraBlocks)) {
        for (const cb of shot.cameraBlocks) {
          if (typeof cb.durationMs === 'number') {
            cb.durationMs = Math.max(50, cb.durationMs);
          }
          if (typeof cb.startMs === 'number') {
            cb.startMs = Math.max(0, cb.startMs);
          }
        }
      }

      if (Array.isArray(shot.effectBlocks)) {
        for (const eb of shot.effectBlocks) {
          if (typeof eb.durationMs === 'number') {
            eb.durationMs = Math.max(50, eb.durationMs);
          }
          if (typeof eb.startMs === 'number') {
            eb.startMs = Math.max(0, eb.startMs);
          }
        }
      }

      if (Array.isArray(shot.lightBlocks)) {
        for (const lb of shot.lightBlocks) {
          if (typeof lb.durationMs === 'number') {
            lb.durationMs = Math.max(50, lb.durationMs);
          }
          if (typeof lb.startMs === 'number') {
            lb.startMs = Math.max(0, lb.startMs);
          }
        }
      }

      if (Array.isArray(shot.layers)) {
        for (const layer of shot.layers) {
          if (typeof layer.inMs === 'number') {
            layer.inMs = Math.max(0, layer.inMs);
          }
          if (typeof layer.outMs === 'number') {
            layer.outMs = Math.max((layer.inMs ?? 0) + 10, layer.outMs);
          }
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
              if (typeof blk.startMs === 'number') {
                blk.startMs = Math.max(0, blk.startMs);
              }
            }
          }
        }
      }
    }
  }

  if (project.audio && typeof project.audio === 'object') {
    if (typeof project.audio.masterVolume === 'number') {
      project.audio.masterVolume = Math.max(0, Math.min(1, project.audio.masterVolume));
    }
    if (Array.isArray(project.audio.clips)) {
      for (const clip of project.audio.clips) {
        if (typeof clip.startMs === 'number') {
          clip.startMs = Math.max(0, clip.startMs);
        }
        if (typeof clip.durationMs === 'number') {
          clip.durationMs = Math.max(0, clip.durationMs);
        }
        if (typeof clip.offsetMs === 'number') {
          clip.offsetMs = Math.max(0, clip.offsetMs);
        }
        if (typeof clip.volume === 'number') {
          clip.volume = Math.max(0, Math.min(1, clip.volume));
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

  if (!project.defaultCamera) {
    project.defaultCamera = {
      position: { x: -1.9, y: 0.7, z: 2.65 },
      rotation: { x: 0, y: 0, z: 0 },
      focalLength: 50,
    };
  }

  project.schemaVersion = 2;
  project.version = 2;
  return project;
}
