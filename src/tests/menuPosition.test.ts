import { calculateBoundsBasedOnPosition } from "core/utils/ui/menu";

describe("calculateBoundsBasedOnPosition", () => {
    it("keeps the top edge fixed for bottom-anchored menus when height changes", () => {
        const target = { x: 10, y: 100, width: 40, height: 20 };
        const bounds = { width: 500, height: 140 };
        const tall = { width: 200, height: 160 } as DOMRect;
        const short = { width: 200, height: 80 } as DOMRect;

        expect(calculateBoundsBasedOnPosition(target, tall, bounds, "bottom").y).toBe(130);
        expect(calculateBoundsBasedOnPosition(target, short, bounds, "bottom").y).toBe(130);
        expect(calculateBoundsBasedOnPosition(target, tall, bounds, "bottom").height).toBe(10);
    });

    it("keeps wide bottom-anchored menus inside the viewport horizontally", () => {
        const target = { x: 450, y: 20, width: 40, height: 20 };
        const bounds = { width: 500, height: 500 };
        const wide = { width: 476, height: 100 } as DOMRect;

        const position = calculateBoundsBasedOnPosition(target, wide, bounds, "bottom");

        expect(position.x).toBe(12);
        expect(position.x + wide.width).toBe(488);
    });

    it("slides a right-anchored menu up just enough to hug the bottom edge", () => {
        const bounds = { width: 500, height: 1000 };
        const menu = { width: 200, height: 600 } as DOMRect;

        // Fits below: stays at the row.
        expect(calculateBoundsBasedOnPosition({ x: 10, y: 100, width: 40, height: 20 }, menu, bounds, "right").y).toBe(100);
        // Would overflow below but fits above: still slides, no flip above the row.
        expect(calculateBoundsBasedOnPosition({ x: 10, y: 800, width: 40, height: 20 }, menu, bounds, "right").y).toBe(388);
        // Would not fit above either: same bottom-hugging position.
        expect(calculateBoundsBasedOnPosition({ x: 10, y: 500, width: 40, height: 20 }, menu, bounds, "right").y).toBe(388);
    });

    it("never pushes a menu taller than the viewport above the top padding", () => {
        const bounds = { width: 500, height: 400 };
        const menu = { width: 200, height: 900 } as DOMRect;

        expect(calculateBoundsBasedOnPosition({ x: 10, y: 300, width: 40, height: 20 }, menu, bounds, "right").y).toBe(12);
    });
});
