# Spaces

This is everything you need to stay focused on what you're working on.

**Spaces** is an advanced file explorer for Obsidian that replaces the core File Explorer. It is the core Navigator extracted from the [make.md](https://www.make.md) plugin with lots of improvements, to make one job: organizing your vault with spaces.

> ⚠️ Desktop only.


<img width="270" src="https://github.com/user-attachments/assets/69017fe4-ebb3-47bf-b9a4-765a671e886c" />

<img width="400" src="https://github.com/user-attachments/assets/08d8d364-ceb7-4f98-b4f1-a177cbd662f7" />
<br/>

<img width="420" src="https://github.com/user-attachments/assets/4e7b587a-854e-4375-a1f6-9d14e9aab2a3" />

<img width="500" src="https://github.com/user-attachments/assets/be097f6d-e54a-4169-92f2-69aac2039947" />


# Features

## Focuses

A *focus* is a named tab at the top of the sidebar holding a set of top-level sections (folders, tags, files). Switch focuses to switch context.

- **Create / edit / duplicate / archive** focuses from the tab bar and its context menu. Each focus has a name and a sticker.
- **Reorder** focus tabs by dragging.
- **Add sections** via the "Open" row at the bottom of the tree: pick an existing folder, tag or file, or create a new folder or tag on the spot. Hold `Shift` to include hidden items in the picker.
- **Drag onto a focus tab** to add items as sections of that focus.
- **Remove from Focus** detaches a section without touching files.
- **Exclude from Focus** hides a file or folder in the current focus only (per-focus exclusions, managed in the "Excluded Items (from focus)" dialog).
- **Reveal** finds the focus that contains the active file and switches to it.


## Spaces

Every folder and every tag is a *space*. Spaces carry their own metadata, stored in a `.space/context.json` file inside the folder.

- **Folder spaces** show the folder's files, subfolders and linked items.
- **Tag spaces** (`#tag`) show every note tagged with it. Hierarchical tags can be grouped as nested sub-tag spaces. A tag space linked into a folder can be set to **Use as Filter** to show only the folder's notes with that tag.
- **Vault (Home)** is the root space.
- **Links**: any file, folder or tag can be linked into a space without moving it ("Link to..."). Linked items are marked and can be unlinked.
- **Pin to Top** keeps chosen items above everything else in a space.
- **Separators** split a space's item list into visual groups and can be reordered like any item. Adding one switches the space to custom sort.
- **Sorting** per space: custom (manual rank), name, created or modified time, ascending or descending. Toggles for *Folders at the Top*, *Group by Sub-tags* (tags), and *Apply to Sub-folders / Sub-tags*. "Reset to Default" falls back to the global default.
- **Merge tag-spaces**: merge one tag space's metadata into another.


## Icons and colors

- **Stickers** on files, folders, tags and focuses: Lucide icons, emoji or images, picked from a searchable palette.
- **Colors** on any item from a built-in palette; file colors can be scoped to the space they are shown in.
- **Apply to Sub-items**: set a default sticker and color for everything inside a space.


## Tree navigation

- Click to open a file; `Cmd/Ctrl`-click or middle-click opens it in a new tab, `Cmd/Ctrl+Alt` in a split.
- Click a folder to open its **folder note** (Folder Notes plugin integration); double-click toggles expansion.
- **Multi-select** with `Shift`-click (range) and `Alt`-click (toggle); bulk actions in the context menu.
- **Expand / collapse all** spaces from the main menu. Expanded state is remembered and survives renames.
- **Reveal Active File** option follows the open note automatically.
- **Row height** and **folder indentation lines** are configurable.


## Drag and drop

Pointer-based drag and drop with precise insertion lines and container highlights. The UI only shows an action that will actually happen; no-op drops do nothing.

- **Reorder** inside a space that uses custom sort.
- **Move** into another folder.
- **Link** with `Shift` held.
- **Copy** with `Alt/Option` held.
- **Add to focus** by dropping on the focus level or a focus tab.
- Drop **external files** from the OS into any folder; name collisions are resolved automatically.
- `Cmd/Ctrl`-drag uses the native Obsidian drag (e.g. to drop a link into an editor or canvas).


## Context menu

Right-click any item for a menu tailored to its type (file, folder, tag, linked item, multi-selection):

- **New**: Note, Folder, Canvas, Base, Drawing (when Excalidraw is installed), Separator, Link Item.
- Color, Sticker, Sort, Apply to Sub-items.
- Copy path (as Obsidian URL, from vault, from system root), Pin / Unpin, Use as Filter.
- Duplicate, Rename, Move to..., Link to..., Wrap to Folder, Wrap Each to Folder, Merge into... (tags).
- Reveal in Spaces, Reveal in Finder / Explorer, More options (the native Obsidian menu).
- Remove from Focus, Unlink, Exclude from Focus, Delete (with confirmation).


## Hidden and excluded items

- **Hidden Items** (vault-wide): hide paths, or any name / suffix / extension pattern. `.mdb` is hidden by default.
- **Excluded Items** (per focus): hide specific files and folders only while that focus is active.


## Storage and integrations

- Space metadata lives next to your files in `.space/context.json`; focuses in root `.space/focuses.json`. Nothing is written into notes' frontmatter.
- Supported file types: Markdown, Canvas, Bases, JSON, Excalidraw drawings.
- Integrates with the **Folder Notes** and **Excalidraw** plugins when they are installed.
- Spaces registers itself as the `file-explorer` view, so "Reveal in navigation" from other plugins opens Spaces instead of the core explorer.


## Credits

Originally forked from the [make.md](https://github.com/Make-md/makemd) plugin by make.md. MIT license.
