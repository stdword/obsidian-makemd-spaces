jest.mock("main", () => jest.fn());
jest.mock("react-dom/client", () => ({ createRoot: () => ({ render: jest.fn(), unmount: jest.fn() }) }));
jest.mock(
    "obsidian",
    () => {
        class TFile {
            name = "";
        }
        class Menu {
            items: { title?: string; onClick?: () => void }[] = [];
            addItem(cb: (item: any) => void) {
                const entry: { title?: string; onClick?: () => void } = {};
                cb({
                    setTitle: (title: string) => { entry.title = title; },
                    setIcon: (): void => undefined,
                    onClick: (handler: () => void) => { entry.onClick = handler; },
                });
                this.items.push(entry);
                return this;
            }
            showAtPosition() { return this; }
        }
        const mocked: Record<string, unknown> = {
            Menu,
            TFile,
            TFolder: class TFolder {},
            Notice: class Notice {},
            Platform: {},
            FileSystemAdapter: class FileSystemAdapter {},
            getIcon: (): null => null,
            normalizePath: (path: string) => path,
        };
        return mocked;
    },
    { virtual: true },
);

import { ObsidianUI } from "adapters/obsidian/ui/ui";
import { Menu, TFile } from "obsidian";
import i18n from "shared/i18n";

describe("ObsidianUI.nativePathMenu", () => {
    beforeAll(() => {
        (global as any).document = {
            createElement: () => ({ className: "" }),
            body: { appendChild: jest.fn() },
        };
        (global as any).window = {};
    });
    afterAll(() => {
        delete (global as any).document;
        delete (global as any).window;
    });

    it("asks for confirmation before deleting a file and never calls vault.delete directly", () => {
        const file = new TFile();
        file.name = "Scratch.md";
        const vaultDelete = jest.fn();
        let menu: Menu | null = null;
        const plugin = {
            app: {
                vault: { getAbstractFileByPath: jest.fn(() => file), delete: vaultDelete },
                workspace: { trigger: jest.fn((_name: string, m: Menu) => { menu = m; }) },
            },
        };
        const ui = new ObsidianUI(plugin as any);
        (ui as any).manager = { superstate: {} };
        const openModal = jest.fn();
        ui.openModal = openModal as any;

        ui.nativePathMenu({ currentTarget: { getBoundingClientRect: () => ({ left: 0, bottom: 0 }) } } as any, "Inbox/Scratch.md");

        const deleteItem = (menu as any).items.find((i: any) => i.title == i18n.menu.delete);
        deleteItem.onClick();

        expect(vaultDelete).not.toHaveBeenCalled();
        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal.mock.calls[0][0]).toBe(i18n.labels.deleteFile);
    });
});
