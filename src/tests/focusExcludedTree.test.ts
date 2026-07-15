import { constrainLinkedItemProjection, constrainSeparatorProjection, constrainTagSpaceProjection, dragModifierForActiveItem, isParentDropNoOp, resolveDragModifier, retrieveData, revealTreePath, separatorDropRank } from "core/react/components/Navigator/SpaceTree/SpaceTreeView";
import { SPACE_HIDDEN_SEPARATOR_PATH, SPACE_SEPARATOR_PATH } from "schemas/builtin";

describe("focus-excluded navigator items", () => {
    it("finishes a drop on the direct parent immediately when there is no action", () => {
        const item = { id: "Folder/Item.md", parentId: "Folder" } as any;

        expect(isParentDropNoOp(item, "Folder")).toBe(true);
        expect(isParentDropNoOp(item, "Other")).toBe(false);
    });

    it("links a tag space across containers but keeps reorder within its container", () => {
        const tagSpace = { type: "space", parentId: "Folder", item: { path: "spaces://#fixture", type: "space", subtype: "tag" } } as any;

        expect(dragModifierForActiveItem(tagSpace, { altKey: false, shiftKey: false } as any)).toBe("link");
        expect(dragModifierForActiveItem(tagSpace, { altKey: true, shiftKey: false } as any)).toBe("link");
        expect(dragModifierForActiveItem(tagSpace, { altKey: false, shiftKey: true } as any)).toBe("link");
        expect(resolveDragModifier(tagSpace, { reorder: false } as any, "link")).toBe("link");
        expect(resolveDragModifier(tagSpace, { reorder: true } as any, "link")).toBe("move");
    });

    it("treats dropping a tag space into its parent tag space as a no-op", () => {
        const parent = { id: "parent", item: { path: "spaces://#topic", type: "space", subtype: "tag" } } as any;
        const child = { id: "child", item: { path: "spaces://#topic/child", type: "space", subtype: "tag" } } as any;
        const unrelated = { id: "unrelated", item: { path: "spaces://#other", type: "space", subtype: "tag" } } as any;
        const projection = { insert: true, overId: parent.id, parentId: parent.id } as any;
        const reorderProjection = { ...projection, insert: false, reorder: true };

        expect(constrainTagSpaceProjection(child, projection, [parent, child])).toBeNull();
        expect(constrainTagSpaceProjection(child, reorderProjection, [parent, child])).toBe(reorderProjection);
        expect(constrainTagSpaceProjection(child, { ...projection, overId: unrelated.id, parentId: unrelated.id }, [parent, child, unrelated])).toBeNull();
    });

    it("only reorders a linked item in place and links it to another space", () => {
        const source = { id: "source", item: { path: "Source", type: "space" } } as any;
        const target = { id: "target", item: { path: "Target", type: "space" } } as any;
        const linked = {
            id: "source/item",
            parentId: source.id,
            depth: 1,
            space: "Source",
            item: { path: "Elsewhere/item.md", type: "file", linkedSpaces: ["Source"] },
        } as any;
        const reorder = { reorder: true, parentId: source.id, insert: false, overId: "source/sibling" } as any;
        const ownContainer = { reorder: false, parentId: source.id, insert: true, overId: source.id } as any;
        const otherContainer = { reorder: false, parentId: target.id, insert: true, overId: target.id } as any;

        expect(dragModifierForActiveItem(linked, { altKey: false, shiftKey: false } as any)).toBe("link");
        expect(resolveDragModifier(linked, reorder, "link")).toBe("move");
        expect(constrainLinkedItemProjection(linked, reorder, [source, target, linked])).toBe(reorder);
        expect(constrainLinkedItemProjection(linked, ownContainer, [source, target, linked])).toBeNull();
        expect(constrainLinkedItemProjection(linked, otherContainer, [source, target, linked])).toBe(otherContainer);
        const focusSection = { ...otherContainer, insert: false, parentId: null, overId: "section" };
        expect(constrainLinkedItemProjection(linked, focusSection, [source, target, linked])).toBe(focusSection);
        expect(resolveDragModifier(linked, focusSection, "link")).toBe("link");
    });

    it("uses root order when dropping a separator between focus sections", () => {
        const separator = { id: "separator", parentId: null, type: "separator", rank: 0 } as any;
        const first = { id: "first", parentId: null, type: "group", rank: null } as any;
        const second = { id: "second", parentId: null, type: "group", rank: null } as any;
        const third = { id: "third", parentId: null, type: "group", rank: null } as any;
        const placeholder = { id: "placeholder", parentId: null, type: "new" } as any;

        expect(separatorDropRank(
            { parentId: null, insert: false, linePosition: "bottom" } as any,
            third,
            [separator, first, second, third, placeholder],
            0,
        )).toBe(4);
    });

    it("uses the stored target rank for a separator drop when hidden items shift visual ranks", () => {
        const separatorPath = SPACE_SEPARATOR_PATH;
        const order = [
            "Board/PinnedOne.md",
            "Board/PinnedTwo.md",
            "Board/First.md",
            "Board/Second.md",
            "Board/Third.md",
            "Board/Overview.canvas",
            separatorPath,
            "Board/Fourth.md",
            "Board/Fifth.md",
        ];
        const parent = { id: "Board", parentId: null, type: "group", item: { path: "Board" } } as any;
        const target = {
            id: "Board/Board/Fifth.md",
            parentId: parent.id,
            type: "file",
            path: "Board/Fifth.md",
            item: { path: "Board/Fifth.md" },
            rank: 7,
        } as any;

        expect(separatorDropRank(
            { parentId: parent.id, insert: false, linePosition: "top" } as any,
            target,
            [parent, target],
            order.length,
            order,
        )).toBe(8);
    });

    it("keeps bottom-line separator drops relative to the stored target", () => {
        const order = ["Board/Overview.canvas", SPACE_SEPARATOR_PATH, "Board/Alpha.md", "Board/Beta.md"];
        const target = {
            id: "Board/Board/Alpha.md",
            parentId: "Board",
            type: "file",
            path: "Board/Alpha.md",
            item: { path: "Board/Alpha.md" },
            rank: 1,
        } as any;

        expect(separatorDropRank(
            { parentId: "Board", insert: false, linePosition: "bottom" } as any,
            target,
            [target],
            order.length,
            order,
        )).toBe(3);
    });

    it("only allows separator projections within its original container", () => {
        const separator = { type: "separator", parentId: "Source" } as any;
        const sameContainer = { parentId: "Source", sortable: true, insert: false } as any;

        expect(constrainSeparatorProjection(separator, sameContainer)).toBe(sameContainer);
        expect(constrainSeparatorProjection(separator, { ...sameContainer, parentId: "Target" })).toBeNull();
        expect(constrainSeparatorProjection(separator, { ...sameContainer, insert: true })).toBeNull();
        expect(constrainSeparatorProjection(separator, { ...sameContainer, sortable: false })).toBeNull();
    });

    it("renders rank-order separators only for manual sorting", () => {
        const sectionPath = { path: "Projects", name: "Projects", parent: "", type: "space", subtype: "folder" } as any;
        const child = { path: "Projects/Plan.md", name: "Plan.md", parent: sectionPath.path, type: "file", rank: 1 } as any;
        const createSuperstate = (field: string) => ({
            settings: {},
            spacesIndex: new Map([[sectionPath.path, {
                path: sectionPath.path,
                name: "Projects",
                type: "folder",
                metadata: { sort: { field, asc: true }, "rank-order": [SPACE_SEPARATOR_PATH, child.path] },
                space: {},
            }]]),
            pathStateForPath: jest.fn(() => sectionPath),
            getSpaceItems: jest.fn(() => [child]),
        }) as any;

        const manualTree = retrieveData(createSuperstate("rank"), [sectionPath], false, [sectionPath.path], []);
        const alphabeticalTree = retrieveData(createSuperstate("name"), [sectionPath], false, [sectionPath.path], []);

        expect(manualTree.find((node) => node.type == "separator")).toEqual(expect.objectContaining({
            path: SPACE_SEPARATOR_PATH,
            depth: 1,
            childrenCount: 0,
            collapsed: true,
        }));
        expect(alphabeticalTree.some((node) => node.type == "separator")).toBe(false);
    });

    it("renders pinned items before the manual rank order", () => {
        const sectionPath = { path: "Projects", name: "Projects", parent: "", type: "space", subtype: "folder" } as any;
        const first = { path: "Projects/First.md", name: "First", parent: sectionPath.path, type: "file", rank: 0 } as any;
        const pinned = { path: "Projects/Pinned.md", name: "Pinned", parent: sectionPath.path, type: "file", rank: 1 } as any;
        const superstate = {
            settings: {},
            spacesIndex: new Map([[sectionPath.path, {
                path: sectionPath.path,
                name: "Projects",
                type: "folder",
                metadata: {
                    sort: { field: "rank", asc: true },
                    "rank-order": [first.path, pinned.path],
                    pinned: [pinned.path],
                },
                space: {},
            }]]),
            pathStateForPath: jest.fn(() => sectionPath),
            getSpaceItems: jest.fn(() => [first, pinned]),
        } as any;

        const tree = retrieveData(superstate, [sectionPath], false, [sectionPath.path], []);

        expect(tree.filter((node) => node.parentId == sectionPath.path).map((node) => node.path)).toEqual([
            pinned.path,
            first.path,
        ]);
    });

    it("stores direct folder and file counts on a space tree node", () => {
        const sectionPath = { path: "Library", name: "Library", parent: "", type: "space", subtype: "folder" } as any;
        const folder = { path: "Library/Books", name: "Books", parent: sectionPath.path, type: "space", subtype: "folder" } as any;
        const files = ["Index.md", "Notes.md"].map((name) => ({
            path: `${sectionPath.path}/${name}`,
            name,
            parent: sectionPath.path,
            type: "file",
        }));
        const superstate = {
            settings: {},
            spacesIndex: new Map([[sectionPath.path, {
                ...sectionPath,
                metadata: { sort: { field: "name", asc: true } },
                space: {},
            }]]),
            pathStateForPath: jest.fn(() => sectionPath),
            getSpaceItems: jest.fn(() => [folder, ...files]),
        } as any;

        const tree = retrieveData(superstate, [sectionPath], false, [], []);

        expect(tree[0]).toEqual(expect.objectContaining({
            childrenCount: 3,
            folderCount: 1,
            fileCount: 2,
        }));
    });

    it("assigns displayed ranks when manual sorting starts without a stored rank order", () => {
        const sectionPath = { path: "Workshop", name: "Workshop", parent: "", type: "space", subtype: "folder" } as any;
        const children = ["Ideas", "Drafts", "Archive"].map((name) => ({
            path: `${sectionPath.path}/${name}`,
            name,
            parent: sectionPath.path,
            type: "space",
            subtype: "folder",
            rank: -1,
        }));
        const spaces = [sectionPath, ...children].map((item) => [item.path, {
            ...item,
            metadata: item.path == sectionPath.path ? { sort: { field: "rank", asc: true }, "rank-order": [] } : {},
            space: {},
        }] as const);
        const superstate = {
            settings: {},
            spacesIndex: new Map(spaces),
            pathStateForPath: jest.fn((path: string) => path == sectionPath.path ? sectionPath : children.find((item) => item.path == path)),
            getSpaceItems: jest.fn((path: string) => path == sectionPath.path ? children : []),
        } as any;

        const tree = retrieveData(superstate, [sectionPath], false, [sectionPath.path], []);

        expect(tree.filter((node) => node.parentId == sectionPath.path).map((node) => node.rank)).toEqual([0, 1, 2]);
    });

    it("keeps each separator occurrence at its original rank-order index", () => {
        const sectionPath = { path: "Projects", name: "Projects", parent: "", type: "space", subtype: "folder" } as any;
        const child = { path: "Projects/Plan.md", name: "Plan.md", parent: sectionPath.path, type: "file" } as any;
        const rankOrder = [child.path, SPACE_SEPARATOR_PATH, "Projects/Missing A.md", "Projects/Missing B.md", SPACE_SEPARATOR_PATH];
        const superstate = {
            settings: {},
            spacesIndex: new Map([[sectionPath.path, {
                path: sectionPath.path,
                name: "Projects",
                type: "folder",
                metadata: { sort: { field: "rank", asc: true }, "rank-order": rankOrder },
                space: {},
            }]]),
            pathStateForPath: jest.fn(() => sectionPath),
            getSpaceItems: jest.fn(() => [child]),
        } as any;

        const tree = retrieveData(superstate, [sectionPath], false, [sectionPath.path], []);
        const separators = tree.filter((node) => node.type == "separator");

        expect(separators.map((node) => node.rank)).toEqual([1, 4]);
        expect(separators.map((node) => node.id)).toEqual([
            `${sectionPath.path}/${SPACE_SEPARATOR_PATH}/1`,
            `${sectionPath.path}/${SPACE_SEPARATOR_PATH}/4`,
        ]);
    });

    it("renders a focus-level separator as its own section row", () => {
        const separator = { path: SPACE_SEPARATOR_PATH, name: "", parent: "", type: "file", subtype: "separator" } as any;
        const tree = retrieveData({ spacesIndex: new Map() } as any, [separator], false, [], []);

        expect(tree[0]).toEqual(expect.objectContaining({
            type: "separator",
            path: SPACE_SEPARATOR_PATH,
            parentId: null,
            depth: 0,
            rank: 0,
        }));
    });

    it("renders a non-visible separator as the same interactive separator node", () => {
        const separator = { path: SPACE_HIDDEN_SEPARATOR_PATH, name: "", parent: "", type: "file", subtype: "separator" } as any;
        const tree = retrieveData({ spacesIndex: new Map() } as any, [separator], false, [], []);

        expect(tree[0]).toEqual(expect.objectContaining({
            type: "separator",
            path: SPACE_HIDDEN_SEPARATOR_PATH,
            parentId: null,
        }));
    });


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

    it("reveals from the most specific physical section without using linked or tag sections", () => {
        const route = revealTreePath("Archive/Novels/Example Book.md", [
            "Archive/Novels",
            "Archive",
            "Dashboard",
            "spaces://#reading",
        ]);

        expect(route).toEqual({
            openPaths: ["Archive/Novels", "Archive/Novels/Archive/Novels/Example Book.md"],
            targetId: "Archive/Novels/Archive/Novels/Example Book.md",
        });
    });
});
