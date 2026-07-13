import { retrieveData } from "core/react/components/Navigator/SpaceTree/SpaceTreeView";

describe("focus-excluded navigator items", () => {
    it("hides an excluded folder and its branch, but keeps a linked child shown from another space", () => {
        const parentPath = { path: "Projects", name: "Projects", parent: "", type: "space", subtype: "folder" } as any;
        const excludedPath = { path: "Projects/Private", name: "Private", parent: "Projects", type: "space", subtype: "folder" } as any;
        const linkedRootPath = { path: "Dashboard", name: "Dashboard", parent: "", type: "space", subtype: "folder" } as any;
        const child = { path: "Projects/Private/Plan.md", name: "Plan.md", parent: excludedPath.path, type: "file" } as any;
        const parentSpace = { path: parentPath.path, name: "Projects", type: "folder", metadata: {}, space: {} } as any;
        const excludedSpace = { path: excludedPath.path, name: "Private", type: "folder", metadata: {}, space: {} } as any;
        const linkedSpace = { path: linkedRootPath.path, name: "Dashboard", type: "folder", metadata: {}, space: {} } as any;
        const superstate = {
            settings: {},
            spacesIndex: new Map([[parentPath.path, parentSpace], [excludedPath.path, excludedSpace], [linkedRootPath.path, linkedSpace]]),
            pathStateForPath: jest.fn((path: string) => path == parentPath.path ? parentPath : linkedRootPath),
            getSpaceItems: jest.fn((path: string) => path == parentPath.path ? [excludedPath] : path == excludedPath.path || path == linkedRootPath.path ? [child] : []),
        } as any;

        const tree = retrieveData(superstate, [parentPath, linkedRootPath], false, [parentPath.path, excludedPath.path, linkedRootPath.path], [excludedPath.path]);

        expect(tree.some((node) => node.path == excludedPath.path)).toBe(false);
        expect(tree.filter((node) => node.path == child.path)).toEqual([
            expect.objectContaining({ space: linkedRootPath.path }),
        ]);
    });

    it("keeps a child of an excluded folder when a tag space displays it", () => {
        const parentPath = { path: "Projects", name: "Projects", parent: "", type: "space", subtype: "folder" } as any;
        const excludedPath = { path: "Projects/Private", name: "Private", parent: "Projects", type: "space", subtype: "folder" } as any;
        const tagPath = { path: "spaces://#work", name: "work", parent: "", type: "space", subtype: "tag" } as any;
        const child = { path: "Projects/Private/Plan.md", name: "Plan.md", parent: excludedPath.path, type: "file" } as any;
        const parentSpace = { path: parentPath.path, name: "Projects", type: "folder", metadata: {}, space: {} } as any;
        const excludedSpace = { path: excludedPath.path, name: "Private", type: "folder", metadata: {}, space: {} } as any;
        const tagSpace = { path: tagPath.path, name: "work", type: "tag", metadata: {}, space: {} } as any;
        const superstate = {
            settings: {},
            spacesIndex: new Map([[parentPath.path, parentSpace], [excludedPath.path, excludedSpace], [tagPath.path, tagSpace]]),
            pathStateForPath: jest.fn((path: string) => path == parentPath.path ? parentPath : tagPath),
            getSpaceItems: jest.fn((path: string) => path == parentPath.path ? [excludedPath] : path == excludedPath.path || path == tagPath.path ? [child] : []),
        } as any;

        const tree = retrieveData(superstate, [parentPath, tagPath], false, [parentPath.path, excludedPath.path, tagPath.path], [excludedPath.path]);

        expect(tree.filter((node) => node.path == child.path)).toEqual([
            expect.objectContaining({ space: tagPath.path }),
        ]);
    });

    it("shows an excluded folder and its children when it is explicitly added as a level-zero section", () => {
        const sectionPath = { path: "Projects/Private", name: "Private", parent: "Projects", type: "space", subtype: "folder" } as any;
        const child = { path: "Projects/Private/Plan.md", name: "Plan.md", parent: sectionPath.path, type: "file" } as any;
        const sectionSpace = { path: sectionPath.path, name: "Private", type: "folder", metadata: {}, space: {} } as any;
        const superstate = {
            settings: {},
            spacesIndex: new Map([[sectionPath.path, sectionSpace]]),
            pathStateForPath: jest.fn(() => sectionPath),
            getSpaceItems: jest.fn(() => [child]),
        } as any;

        const tree = retrieveData(superstate, [sectionPath], false, [sectionPath.path], [sectionPath.path]);

        expect(tree).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: sectionPath.path, depth: 0, type: "group" }),
            expect.objectContaining({ path: child.path, space: sectionPath.path }),
        ]));
    });
});
