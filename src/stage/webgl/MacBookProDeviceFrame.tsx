// src/stage/webgl/MacBookProDeviceFrame.tsx
import React from 'react';
import type { DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';
import { MacBookProFrame } from './MacBookProFrame';

export interface MacBookProDeviceFrameProps {
    metrics: DeviceFrameMetrics;
    settings: DeviceFrameSettings;
    rotation?: { x: number; y: number; z: number };
}

export const MacBookProDeviceFrame: React.FC<MacBookProDeviceFrameProps> = (props) => {
    return <MacBookProFrame {...props} />;
};
