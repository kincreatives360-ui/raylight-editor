/** Workspace allocation never writes back to the user's saved panel preferences. */
export const MIN_STAGE_WIDTH = 340;
export const MIN_LEFT_PANEL_WIDTH = 200;
export const MAX_LEFT_PANEL_WIDTH = 460;
export const DEFAULT_LEFT_PANEL_WIDTH = 260;
export const MIN_RIGHT_SIDEBAR_WIDTH = 260;
export const MAX_RIGHT_SIDEBAR_WIDTH = 500;
export function defaultInspectorWidth(viewport: number) {
    return Math.round(Math.max(260, Math.min(300, 260 + (viewport - 1536) * 40 / 384)));
}
export function clampPanelWidth(value: number, min: number, max: number, available = max) {
    return Math.max(min, Math.min(max, available, Number.isFinite(value) ? Math.round(value) : min));
}
export function getWorkspaceLayout({ viewport, left, right, leftOpen, rightOpen, priority }: { viewport: number; left: number; right: number; leftOpen: boolean; rightOpen: boolean; priority?: 'left' | 'right' }) {
    let showLeft = leftOpen;
    let showRight = rightOpen;
    const minimumPanel = rightOpen ? MIN_RIGHT_SIDEBAR_WIDTH : MIN_LEFT_PANEL_WIDTH;
    const budget = Math.max(0, viewport - Math.min(MIN_STAGE_WIDTH, Math.max(0, viewport - minimumPanel)));
    if ((showLeft ? MIN_LEFT_PANEL_WIDTH : 0) + (showRight ? MIN_RIGHT_SIDEBAR_WIDTH : 0) > budget) showLeft = false;
    if (showRight && MIN_RIGHT_SIDEBAR_WIDTH > budget) showRight = false;
    let l = showLeft ? clampPanelWidth(left, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH) : 0;
    let r = showRight ? clampPanelWidth(right, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH) : 0;
    const excess = Math.max(0, l + r - budget);
    const slackL = showLeft ? l - MIN_LEFT_PANEL_WIDTH : 0;
    const slackR = showRight ? r - MIN_RIGHT_SIDEBAR_WIDTH : 0;
    if (excess && slackL + slackR) {
        const reduceL = Math.min(slackL, priority === 'right' ? excess : priority === 'left' ? Math.max(0, excess - slackR) : Math.ceil(excess * slackL / (slackL + slackR)));
        l -= reduceL;
        r -= excess - reduceL;
    }
    return { left: l, right: r, showLeft, showRight };
}
