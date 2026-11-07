import { readFileSync } from "fs";

// The pointer-drag listeners are attached once at pointerdown and then live on the
// document for the whole gesture. Everything they call must come from a ref that is
// refreshed every render, otherwise they keep using the tree/handlers of the render
// in which the drag began (hideSectionChildren and reloadData rebuild the tree mid-drag).
describe("SpaceTreeView pointer drag", () => {
    const source = readFileSync("src/core/react/components/Navigator/SpaceTree/SpaceTreeView.tsx", "utf8");
    const start = source.indexOf("const onTreePointerDown = ");
    const end = source.indexOf('doc.addEventListener("pointercancel", onCancel);', start);
    const gesture = source.slice(start, end);

    it("refreshes the drag handlers ref on every render", () => {
        expect(source).toMatch(/pointerDragHandlersRef\.current = \{[^}]*dragStarted[^}]*dragOver[^}]*dragEnded[^}]*resetState[^}]*focuses[^}]*setFocuses[^}]*\};/s);
    });

    it("never calls render-frozen handlers from the gesture listeners", () => {
        expect(gesture.length).toBeGreaterThan(1000);
        expect(gesture).toContain("const handlers = pointerDragHandlersRef.current;");
        for (const name of ["dragStarted", "dragOver", "dragEnded", "resetState", "setFocuses"]) {
            const direct = new RegExp(`(?<![.\\w])${name}\\(`);
            expect(gesture).not.toMatch(direct);
            expect(gesture).toMatch(new RegExp(`(pointerDragHandlersRef\\.current|handlers)\\.${name}\\b`));
        }
        expect(gesture).not.toMatch(/(?<![.\w])focuses\.map\(/);
    });
});
