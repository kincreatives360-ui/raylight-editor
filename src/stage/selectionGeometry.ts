export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };

function pointInRect(point: Point, rect: Rect): boolean {
    return point.x >= rect.left && point.x <= rect.right
        && point.y >= rect.top && point.y <= rect.bottom;
}

function orientation(a: Point, b: Point, c: Point): number {
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const acX = c.x - a.x;
    const acY = c.y - a.y;
    const determinant = abX * acY - abY * acX;
    const productMagnitude = Math.abs(abX * acY) + Math.abs(abY * acX);
    const coordinateMagnitude = Math.max(
        Math.abs(a.x), Math.abs(a.y),
        Math.abs(b.x), Math.abs(b.y),
        Math.abs(c.x), Math.abs(c.y),
    );
    const differenceMagnitude = Math.abs(abX) + Math.abs(abY) + Math.abs(acX) + Math.abs(acY);
    // Scale the roundoff bound to determinant products and coordinate subtraction error.
    const errorBound = Number.EPSILON * (productMagnitude + 2 * coordinateMagnitude * differenceMagnitude);

    if (Math.abs(determinant) <= errorBound) return 0;
    return determinant < 0 ? -1 : 1;
}

function withinSegmentBounds(value: number, start: number, end: number): boolean {
    const tolerance = Number.EPSILON * 2 * Math.max(Math.abs(value), Math.abs(start), Math.abs(end));
    return value >= Math.min(start, end) - tolerance
        && value <= Math.max(start, end) + tolerance;
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
    return orientation(start, end, point) === 0
        && withinSegmentBounds(point.x, start.x, end.x)
        && withinSegmentBounds(point.y, start.y, end.y);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
    const abC = orientation(a, b, c);
    const abD = orientation(a, b, d);
    const cdA = orientation(c, d, a);
    const cdB = orientation(c, d, b);

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
