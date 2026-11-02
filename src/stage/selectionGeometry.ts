export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };

function pointInRect(point: Point, rect: Rect): boolean {
    return point.x >= rect.left && point.x <= rect.right
        && point.y >= rect.top && point.y <= rect.bottom;
}

function cross(a: Point, b: Point, c: Point): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
    return cross(start, end, point) === 0
        && point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x)
        && point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);

    if (abC === 0 && pointOnSegment(c, a, b)) return true;
    if (abD === 0 && pointOnSegment(d, a, b)) return true;
    if (cdA === 0 && pointOnSegment(a, c, d)) return true;
    if (cdB === 0 && pointOnSegment(b, c, d)) return true;

    const abStraddles = (abC < 0 && abD > 0) || (abC > 0 && abD < 0);
    const cdStraddles = (cdA < 0 && cdB > 0) || (cdA > 0 && cdB < 0);
    return abStraddles && cdStraddles;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const current = polygon[i];
        const previous = polygon[j];

        if (pointOnSegment(point, previous, current)) return true;

        if ((current.y > point.y) !== (previous.y > point.y)
            && point.x < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x) {
            inside = !inside;
        }
    }

    return inside;
}

export function polygonsIntersectRect(polygon: Point[], rect: Rect): boolean {
    if (polygon.length === 0) return false;
    if (polygon.some(point => pointInRect(point, rect))) return true;

    const corners: Point[] = [
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.top },
        { x: rect.right, y: rect.bottom },
        { x: rect.left, y: rect.bottom },
    ];

    if (corners.some(corner => pointInPolygon(corner, polygon))) return true;

    for (let i = 0; i < polygon.length; i++) {
        const start = polygon[i];
        const end = polygon[(i + 1) % polygon.length];

        for (let j = 0; j < corners.length; j++) {
            if (segmentsIntersect(start, end, corners[j], corners[(j + 1) % corners.length])) return true;
        }
    }

    return false;
}

export function unionRects(rects: Rect[]): Rect | null {
    if (rects.length === 0) return null;

    return rects.reduce((union, rect) => ({
        left: Math.min(union.left, rect.left),
        top: Math.min(union.top, rect.top),
        right: Math.max(union.right, rect.right),
        bottom: Math.max(union.bottom, rect.bottom),
    }));
}
