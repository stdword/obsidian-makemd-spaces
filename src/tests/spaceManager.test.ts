import { SpaceManager } from "core/spaceManager/spaceManager";

describe("SpaceManager", () => {
    it("recognizes a root tag-space URI as a tag instead of the vault", () => {
        const manager = new SpaceManager();
        const uri = manager.uriByString("spaces://#asd");

        expect(uri.authority).toBe("#asd");
        expect(uri.path).toBe("/");
        expect(manager.spaceTypeByString(uri)).toBe("tag");
    });

    it("serializes file and folder rename events", async () => {
        jest.useFakeTimers();
        const manager = new SpaceManager();
        const calls: string[] = [];
        let releaseFirst: () => void;
        const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
        manager.superstate = {
            dispatchEvent: jest.fn(),
            onPathRename: jest.fn(async (oldPath: string) => {
                calls.push(`start:${oldPath}`);
                if (oldPath == "Old/First.md") await firstPending;
                calls.push(`end:${oldPath}`);
            }),
            onSpaceRenamed: jest.fn(async (oldPath: string) => {
                calls.push(`space:${oldPath}`);
            }),
        } as any;
        manager.spaceInfoForPath = jest.fn((path: string) => ({ path })) as any;

        const first = manager.onPathChanged("New/First.md", "Old/First.md");
        const second = manager.onSpaceRenamed("New/Folder", "Old/Folder");
        expect(manager.isRenaming).toBe(true);
        await Promise.resolve();
        expect(calls).toEqual(["start:Old/First.md"]);

        releaseFirst();
        await Promise.all([first, second]);
        expect(calls).toEqual([
            "start:Old/First.md",
            "end:Old/First.md",
            "space:Old/Folder",
            "start:Old/Folder",
            "end:Old/Folder",
        ]);
        expect(manager.isRenaming).toBe(true);
        jest.advanceTimersByTime(150);
        expect(manager.isRenaming).toBe(false);
        expect(manager.superstate.dispatchEvent).toHaveBeenCalledWith("superstateUpdated", null);
        jest.useRealTimers();
    });
});
