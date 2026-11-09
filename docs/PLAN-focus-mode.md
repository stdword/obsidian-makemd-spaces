# Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пункт контекстного меню Focus Mode открывает временный, существующий только в памяти focus из выбранных элементов.

**Architecture:** Временный focus лежит в `superstate.focusMode` (не в `superstate.focuses`) и адресуется индексом-сентинелом `FOCUS_MODE_INDEX = -1`. Один модуль `core/utils/superstate/focusMode.ts` даёт «прочитать / изменить focus по индексу» и «текущий focus»; все места, которые сегодня пишут `superstate.focuses[settings.currentFocus]`, переводятся на него. `settings.currentFocus` во время Focus Mode не меняется — это и есть «исходный focus». Свёрнутость временного focus хранится там же в памяти.

**Tech Stack:** TypeScript, React, Obsidian API, Jest 30 + ts-jest (`testEnvironment: node`, только `src/**/*.test.ts`).

**Spec:** [docs/PRD-focus-mode.md](PRD-focus-mode.md)

## Global Constraints

- Временный focus никогда не передаётся в `spaceManager.saveFocuses` и не попадает в `focuses.json`.
- `settings.currentFocus` не меняется при входе в Focus Mode и при изменениях внутри него.
- Подписи: `Focus Mode`, `Exit Focus Mode`; заголовок окна исключений во временном focus — `i18n.labels.excludedItems` с подстановкой `Focus Mode`.
- Настройка `focusModeKeepExpanded: boolean`, по умолчанию `false`.
- Нативное меню Obsidian (`overrideNativeMenu`) не трогаем; новых команд палитры не добавляем.
- Тесты: только поведение, на собственных придуманных данных. Без тестов на содержимое исходников и на факт рефакторинга. Файлы тестов — `src/tests/*.test.ts`, React-компоненты не рендерятся (нет DOM).
- Существующие непустые файлы правятся через Edit, не через Write. Удаление файлов — через `trash`.
- Проверка каждой задачи: `npm test` (всё зелёное) и `npx tsc -noEmit -skipLibCheck` (без ошибок).

## Review Focus

Случаи, которые PRD подразумевает и которые легко упустить. Тест для каждого добавлен в задачу-владельца.

1. `focuses.json` меняется извне во время Focus Mode (`SpaceManager.onFocusesUpdated`) — временный focus остаётся открытым. → Задача 1.
2. Переименование папки-секции временного focus: обновляются её путь, исключения, ключи свёрнутости и `origins`. → Задача 2.
3. Исходный focus архивирован или удалён к моменту выхода — открывается первый неархивированный. → Задача 1.
4. Ctrl+клик на macOS по вкладке — это правый клик: только закрывает Focus Mode, не переключает focus. → Задача 3.
5. Focus Mode внутри Focus Mode на элементе, добавленном через «+ Open» (нет исходного места): при включённой настройке его свёрнутость не пишется в настройки. → Задача 1.

## File Structure

| Файл | Ответственность |
|---|---|
| `src/core/utils/superstate/focusMode.ts` (новый) | Состояние Focus Mode: вход, выход, чтение/изменение focus по индексу, свёрнутость, обработка нажатий на вкладки |
| `src/core/utils/superstate/expandedIds.ts` (новый) | Чистые функции перевода ключей свёрнутости между позициями дерева |
| `src/core/utils/superstate/focus.ts` | Исключения — через `focusAtIndex` / `updateFocusAtIndex` |
| `src/core/superstate/superstate.ts`, `src/shared/types/superstate.ts` | Поле `focusMode`; переименование и удаление путей затрагивают временный focus |
| `src/core/react/context/SidebarContext.tsx` | Контекст читает текущий focus через модуль; `treeOrderRef` |
| `src/core/react/components/Navigator/**` | Дерево, вкладки, редактор focus |
| `src/core/react/components/UI/Menus/navigator/*.tsx` | Пункт Focus Mode |
| `src/adapters/obsidian/ui/showMainMenu.tsx`, `src/commands.tsx`, `src/core/commands/revealPathInSpaces.ts`, `src/core/utils/dnd/dropPath.ts` | Переход на текущий focus |
| `src/adapters/obsidian/settings.ts`, `src/shared/en.ts`, `src/shared/types/settings.ts`, `src/schemas/settings.ts` | Настройка и строки |

---

### Task 1: Ядро Focus Mode

**Files:**
- Create: `src/core/utils/superstate/expandedIds.ts`, `src/core/utils/superstate/focusMode.ts`
- Modify: `src/core/superstate/superstate.ts` (поле рядом с `focuses`, ~188 и ~208), `src/shared/types/superstate.ts:27`, `src/shared/types/settings.ts`, `src/schemas/settings.ts`
- Test: `src/tests/expandedIds.test.ts`, `src/tests/focusMode.test.ts`

**Interfaces — Produces:**

```ts
// expandedIds.ts
export type ExpandedIdMapping = { from: string; to: string };
/** Оставляет только id, равные mapping.from или начинающиеся с `${from}/`, заменяя префикс на to. Без дубликатов. */
export const translateExpandedIds = (expanded: string[], mappings: ExpandedIdMapping[]): string[];
/** Для каждого mapping убирает из settingsExpanded id с префиксом mapping.to и добавляет id из tempExpanded с префиксом mapping.from, заменив его на to. Остальное не трогает. */
export const writeBackExpandedIds = (settingsExpanded: string[], tempExpanded: string[], mappings: ExpandedIdMapping[]): string[];

// focusMode.ts
export const FOCUS_MODE_INDEX = -1;
export type FocusModeSource = { path: string; originId?: string };
export type FocusModeState = { focus: Focus; expandedSpaces: string[]; origins: { path: string; originId: string }[] };

export const isFocusModeActive = (superstate: Superstate): boolean;
export const currentFocusIndex = (superstate: Superstate): number;          // FOCUS_MODE_INDEX | settings.currentFocus
export const focusAtIndex = (superstate: Superstate, index: number): Focus | undefined;
export const currentFocus = (superstate: Superstate): Focus | undefined;
export const updateFocusAtIndex = (superstate: Superstate, index: number, update: (focus: Focus) => Focus): Promise<void>;
export const updateCurrentFocus = (superstate: Superstate, update: (focus: Focus) => Focus): Promise<void>;
export const enterFocusMode = (superstate: Superstate, sources: FocusModeSource[]): void;
export const exitFocusMode = (superstate: Superstate, nextFocusIndex?: number): Promise<void>;
export const currentExpandedSpaces = (superstate: Superstate): string[];
export const setCurrentExpandedSpaces = (superstate: Superstate, ids: string[]): void;
```

Поле: `Superstate.focusMode: FocusModeState | null = null` (и в `ISuperstate`). Настройка: `MakeMDSettings.focusModeKeepExpanded: boolean`, в `DEFAULT_SETTINGS` — `false`.

Решения, которые сигнатуры не определяют:

- Ключ свёрнутости секции — её путь; вложенного элемента — `parentId + "/" + path` (см. `treeForSpace`). Поэтому перенос поддерева — замена префикса id.
- `enterFocusMode`:
  - пути без дубликатов, порядок как в `sources`; пустой список — ничего не делает;
  - focus = `{ name: "", sticker: "", paths }`, без `excluded-paths`;
  - `origins` — источники с `originId`. Если Focus Mode уже активен, `originId` источника — это id во временном дереве: он переводится в id обычного дерева через прежние `origins` (`writeBackExpandedIds`-логика для одного id); источник, не попавший ни под один прежний origin, в `origins` не входит;
  - `expandedSpaces = translateExpandedIds(currentExpandedSpaces(superstate), sources с originId → { from: originId, to: path })`, вычисляется до замены состояния;
  - при замене прежнего временного focus и `focusModeKeepExpanded == true` сначала выполняется перенос свёрнутости обратно (как при выходе);
  - в конце `dispatchEvent("focusesChanged", null)` и `dispatchEvent("settingsChanged", null)`.
- `exitFocusMode`:
  - не активен — ничего не делает;
  - при `focusModeKeepExpanded` — `settings.expandedSpaces = writeBackExpandedIds(settings.expandedSpaces, focusMode.expandedSpaces, origins → { from: path, to: originId })`;
  - `focusMode = null`;
  - целевой индекс: `nextFocusIndex ?? settings.currentFocus`; если focus по нему нет или он `archived` — индекс первого неархивированного (или 0); результат пишется в `settings.currentFocus`;
  - `await superstate.saveSettings()` (он рассылает `settingsChanged`), затем `dispatchEvent("focusesChanged", null)`.
- `updateFocusAtIndex`:
  - `FOCUS_MODE_INDEX`: `focusMode.focus = update(focusMode.focus)`; если после этого не осталось ни одного пути, не являющегося сепаратором (`isSpaceSeparatorPath` из `schemas/builtin`), — `exitFocusMode`; иначе `dispatchEvent("focusesChanged", null)`. `saveFocuses` не вызывается;
  - обычный индекс: `spaceManager.saveFocuses(focuses.map(...))`; отсутствующий focus — ничего.
- `setCurrentExpandedSpaces`: в Focus Mode пишет `focusMode.expandedSpaces` и рассылает `settingsChanged` без сохранения; иначе `settings.expandedSpaces = ids` и `saveSettings(false)`.

- [ ] **Step 1: Написать падающие тесты `expandedIds.test.ts`**

```ts
it("moves a subtree's expanded state to its new root", () => {
    expect(translateExpandedIds(["Lab", "Lab/Lab/Notes", "Lab/Lab/Notes/Lab/Notes/Old", "Garden"], [{ from: "Lab/Lab/Notes", to: "Lab/Notes" }]))
        .toEqual(["Lab/Notes", "Lab/Notes/Lab/Notes/Old"]);
});
it("does not treat a sibling with a shared name prefix as part of the subtree", () => {
    expect(translateExpandedIds(["Lab/Lab/Notes2"], [{ from: "Lab/Lab/Notes", to: "Lab/Notes" }])).toEqual([]);
});
it("writes the temporary state back over the origin subtree only", () => {
    expect(writeBackExpandedIds(["Lab", "Lab/Lab/Notes", "Garden"], ["Lab/Notes/Lab/Notes/Old"], [{ from: "Lab/Notes", to: "Lab/Lab/Notes" }]))
        .toEqual(["Lab", "Garden", "Lab/Lab/Notes/Lab/Notes/Old"]);
});
```

- [ ] **Step 2: Запустить — `npx jest src/tests/expandedIds.test.ts` — FAIL (модуль не найден)**
- [ ] **Step 3: Реализовать `expandedIds.ts`**
- [ ] **Step 4: Запустить — PASS**
- [ ] **Step 5: Написать падающие тесты `focusMode.test.ts`**

Общий стаб: `makeSuperstate({ focuses, currentFocus, expandedSpaces, keepExpanded })` возвращает объект с `focuses`, `focusMode: null`, `settings`, `saveSettings: jest.fn()`, `dispatchEvent: jest.fn()`, `spaceManager: { saveFocuses: jest.fn((f) => { superstate.focuses = f; }) }`. Данные: focuses `Kitchen` (`paths: ["Recipes"]`) и `Workshop` (`paths: ["Tools"]`).

Тесты (имя → утверждения):

- `enters focus mode with the selected paths as sections` — после `enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }, { path: "Recipes/Soups" }, { path: "Tools/Saw.md" }])`: `currentFocus(s).paths` = `["Recipes/Soups", "Tools/Saw.md"]`, `currentFocusIndex(s)` = `-1`, `s.settings.currentFocus` = `0`, `saveFocuses` не вызван, `currentFocus(s)["excluded-paths"]` = `undefined`.
- `keeps the collapsed state the items had before entry` — `expandedSpaces: ["Recipes", "Recipes/Recipes/Soups"]` → `currentExpandedSpaces(s)` = `["Recipes/Soups"]`; `s.settings.expandedSpaces` не изменился.
- `changes inside focus mode never reach saveFocuses` — `updateCurrentFocus(s, f => ({ ...f, paths: [...f.paths, "Tools"] }))` → путь добавлен, `saveFocuses` не вызван, `s.focuses` прежние.
- `closes itself when the last section is removed` — убрать все пути → `isFocusModeActive(s)` = `false`, `currentFocusIndex(s)` = `0`.
- `stays open while only a separator is removed` и `closes when only separators remain` — с путём-сепаратором из `schemas/builtin`.
- `exit returns to the origin focus` — `currentFocus: 1`, вход, `exitFocusMode(s)` → `currentFocus(s).name` = `"Workshop"`.
- `exit to a chosen focus` — `exitFocusMode(s, 1)` при `currentFocus: 0` → `s.settings.currentFocus` = `1`.
- `exit falls back to the first unarchived focus` — исходный focus помечен `archived: true` после входа → открыт первый неархивированный. *(Review Focus 3)*
- `survives an external reload of the focus list` — после входа `s.focuses = [{ name: "Pantry", sticker: "", paths: ["Jars"] }]` → `isFocusModeActive(s)` = `true`, пути временного focus прежние. *(Review Focus 1)*
- `discards collapse changes on exit by default` — `setCurrentExpandedSpaces(s, [])`, выход → `s.settings.expandedSpaces` как до входа.
- `writes collapse changes back when the setting is on` — `keepExpanded: true`, вход с `originId: "Recipes/Recipes/Soups"`, `setCurrentExpandedSpaces(s, ["Recipes/Soups", "Recipes/Soups/Recipes/Soups/Cold"])`, выход → `s.settings.expandedSpaces` содержит `"Recipes/Recipes/Soups"` и `"Recipes/Recipes/Soups/Recipes/Soups/Cold"`.
- `replacing focus mode keeps the original origin` — `currentFocus: 1`, вход, второй вход на другом пути, выход → focus `Workshop`; второй временный focus стартует без исключений первого.
- `an item with no origin place leaves no collapse state behind` — `keepExpanded: true`; вход; `updateCurrentFocus` добавляет `"Tools"`; второй вход с `{ path: "Tools", originId: "Tools" }`; разворачиваем `"Tools"`; выход → в `s.settings.expandedSpaces` нет `"Tools"`. *(Review Focus 5)*

- [ ] **Step 6: Запустить — `npx jest src/tests/focusMode.test.ts` — FAIL**
- [ ] **Step 7: Добавить поле `focusMode` и настройку, реализовать `focusMode.ts`**
- [ ] **Step 8: Запустить `npm test` и `npx tsc -noEmit -skipLibCheck` — PASS, без ошибок**
- [ ] **Step 9: Commit** — `feat: in-memory focus mode state`

---

### Task 2: Писатели текущего focus уважают Focus Mode

**Files:**
- Modify: `src/core/utils/superstate/focus.ts`, `src/core/react/components/UI/Modals/ExcludedFiles.tsx:14-17`, `src/core/utils/dnd/dropPath.ts:136-156`, `src/commands.tsx:20-78`, `src/core/commands/revealPathInSpaces.ts`, `src/core/superstate/superstate.ts` (`renameExpandedSpaces` ~168; обработчики ~532-548, ~573-578, ~704-720, ~852-858, ~868-872), `src/core/utils/superstate/tags.ts:80-95`
- Test: дополнить `src/tests/focusExclusions.test.ts`, `src/tests/dropPath.test.ts`, `src/tests/revealPathInSpaces.test.ts`, `src/tests/superstate.test.ts`

**Interfaces:**
- Consumes: всё из Task 1.
- Produces (в `focusMode.ts`):

```ts
/** Переименовывает путь во временном focus: paths, excluded-paths, expandedSpaces, origins. Ничего не сохраняет. */
export const renameFocusModePath = (superstate: Superstate, oldPath: string, newPath: string): void;
/** Убирает путь из секций временного focus; при опустении закрывает Focus Mode. */
export const removeFocusModePath = (superstate: Superstate, path: string): Promise<void>;
```

Что меняется:

- `focus.ts`: `excludePathsFromCurrentFocus` использует `currentFocusIndex`; `excludePathsFromFocus` и `removeExcludedPathFromFocus` — `updateFocusAtIndex` (поведение для обычных индексов прежнее).
- `ExcludedFiles`: читает focus через `focusAtIndex(superstate, props.focusIndex)`.
- `reorderOpenSpace`: вычисляет новые `paths` и применяет через `updateCurrentFocus`, без мутации объекта focus на месте.
- `mk-open-excluded`: индекс — `currentFocusIndex`, focus — `focusAtIndex`; в заголовок вместо имени подставляется `i18n.menu.focusMode` при `FOCUS_MODE_INDEX` (ключ добавляется в Task 4; до тех пор — литерал `"Focus Mode"`, заменить в Task 4).
- `mk-link-active-file`: ветка «есть focuses» идёт через `currentFocus` / `updateCurrentFocus`.
- `revealPathInSpaces`: порядок поиска начинается с `currentFocusIndex(superstate)`, focus берётся через `focusAtIndex`. Если найден обычный focus, отличный от текущего: в Focus Mode — `await exitFocusMode(superstate, foundFocusIndex)`, иначе как сейчас.
- `superstate.ts`: в каждом обработчике переименования рядом с обходом `this.focuses` вызывается `renameFocusModePath`; в `onTagDeleted` и `onSpaceDeleted` — `removeFocusModePath`. `renameExpandedSpaces` не трогает `focusMode` (это делает `renameFocusModePath` через `renameExpandedSpacePaths`).
- `tags.ts` (слияние тегов): путь тега во временном focus переименовывается через `renameFocusModePath`.

- [ ] **Step 1: Написать падающие тесты**

Данные свои: focuses `Kitchen`/`Workshop`, временный focus из `["Recipes/Soups"]`.

- `focusExclusions.test.ts`:
  - `excluding inside focus mode affects only the temporary focus` — `excludePathsFromCurrentFocus(s, ["Recipes/Soups/Cold"])` → `currentFocus(s)["excluded-paths"]` = `["Recipes/Soups/Cold"]`, `saveFocuses` не вызван, у `Kitchen` исключений нет.
  - `an exclusion made in focus mode can be removed` — `removeExcludedPathFromFocus(s, FOCUS_MODE_INDEX, "Recipes/Soups/Cold")` → список пуст.
  - `exclusions are gone after leaving and re-entering` — выход, повторный вход → `excluded-paths` = `undefined`.
- `dropPath.test.ts`: `dropping onto the focus level in focus mode adds a temporary section` — через существующий в файле способ вызвать drop на depth 0 → путь в `currentFocus(s).paths`, `saveFocuses` не вызван.
- `revealPathInSpaces.test.ts`:
  - `finds the file in the temporary focus without leaving it` — файл под `Recipes/Soups` → Focus Mode активен, `settings.currentFocus` не менялся.
  - `leaves focus mode when the file is only in a regular focus` — файл под `Tools` → Focus Mode закрыт, `settings.currentFocus` = `1`.
- `superstate.test.ts` (или `focusMode.test.ts`, если обработчик там не вызвать):
  - `renaming a temporary section keeps it in the tree` — `renameFocusModePath(s, "Recipes/Soups", "Recipes/Broths")` при `excluded-paths: ["Recipes/Soups/Cold"]`, `expandedSpaces: ["Recipes/Soups"]`, origin `"Recipes/Recipes/Soups"` → пути `["Recipes/Broths"]`, исключения `["Recipes/Broths/Cold"]`, свёрнутость `["Recipes/Broths"]`, origin `{ path: "Recipes/Broths", originId: "Recipes/Recipes/Broths" }`; `saveFocuses` не вызван. *(Review Focus 2)*
  - `deleting the only temporary section closes focus mode` — `removeFocusModePath(s, "Recipes/Soups")` → не активен.

- [ ] **Step 2: Запустить — FAIL**
- [ ] **Step 3: Реализовать изменения из списка выше**
- [ ] **Step 4: Запустить `npm test` и `npx tsc -noEmit -skipLibCheck` — PASS**
- [ ] **Step 5: Commit** — `feat: route current-focus writers through focus mode`

---

### Task 3: Навигатор показывает временный focus

**Files:**
- Modify: `src/core/react/context/SidebarContext.tsx`, `src/core/react/components/Navigator/SpaceTree/SpaceTreeView.tsx` (312, 346, 394, 402-420, 562, 755-778, 802-810, 1117-1129), `src/core/react/components/Navigator/SpaceTree/SpaceTreeVirtualized.tsx:162-178`, `src/core/react/components/Navigator/SpaceTree/NavigatorFocusEditor.tsx`, `src/core/react/components/Navigator/Focuses/Focus.tsx:110-145`
- Test: дополнить `src/tests/focusMode.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (в `focusMode.ts`):

```ts
/** Нажатие на вкладку обычного focus. Возвращает true, если Focus Mode был закрыт. */
export const focusTabPointerDown = (superstate: Superstate, index: number, e: { button: number; ctrlKey: boolean }): boolean;
/** Правый клик по вкладке. Возвращает true, если Focus Mode был закрыт и меню показывать нельзя. */
export const focusTabContextMenu = (superstate: Superstate): boolean;
```

- Produces (в `NavigatorContext`): `currentFocus: Focus | undefined`, `updateCurrentFocus: (update: (focus: Focus) => Focus) => void`, `treeOrderRef: React.MutableRefObject<string[]>` (стабильный ref, id строк дерева в порядке показа).

Решения:

- `focusTabPointerDown`: срабатывает только при активном Focus Mode, `button == 0` и `!ctrlKey` → `exitFocusMode(superstate, index)`. Иначе `false`.
- `focusTabContextMenu`: активен → `exitFocusMode(superstate)` и `true`; иначе `false`.
- `Focus.tsx`: `onPointerDown` вызывает `focusTabPointerDown`; `onContextMenu` после `preventDefault` вызывает `focusTabContextMenu` и при `true` меню не открывает. Класс `mk-active` — только если `!isFocusModeActive(superstate)`.
- `SidebarContext`: `activeFocus` = `currentFocusIndex(superstate)`; `activeViewSpaces` строится из `currentFocus(superstate)?.paths`; `setActiveViewSpaceByPath`, `closeActiveViewSpace` — через `updateCurrentFocus`, без мутации на месте; `refreshSpaces` проверяет пути текущего focus. `treeOrderRef` создаётся `useRef<string[]>([])`.
- `SpaceTreeView`:
  - `treeOrderRef.current = flattenedTree.map((node) => node.id)` при каждом рендере;
  - `excludedPaths` — из `currentFocus` контекста;
  - начальное значение и ресинхронизация `expandedSpaces` — `currentExpandedSpaces(superstate)`; `handleCollapse` и `revealPath` пишут через `setCurrentExpandedSpaces`;
  - три операции с сепараторами в `dragEnded` и две в `SpaceTreeVirtualized` — через `updateCurrentFocus` контекста;
  - `FocusEditor` в Focus Mode не рендерится никогда: условие на ~1117 дополняется `!isFocusModeActive(superstate)`; пустое дерево в Focus Mode невозможно (он закрывается сам).
- `NavigatorFocusEditor`: без изменений поведения для обычных focuses.

- [ ] **Step 1: Написать падающие тесты в `focusMode.test.ts`**

- `pressing a regular focus tab leaves focus mode for that focus` — `focusTabPointerDown(s, 1, { button: 0, ctrlKey: false })` = `true`, `settings.currentFocus` = `1`, не активен.
- `a right-button press does not switch focus` — `{ button: 2, ctrlKey: false }` → `false`, Focus Mode активен.
- `ctrl+click is a right click, not a switch` — `{ button: 0, ctrlKey: true }` → `false`, активен. *(Review Focus 4)*
- `right click only closes focus mode` — `currentFocus: 0`, вход, `focusTabContextMenu(s)` = `true`, `settings.currentFocus` = `0`, не активен; повторный вызов = `false`.
- `tab presses outside focus mode are left alone` — оба возвращают `false`, `saveSettings` не вызван.

- [ ] **Step 2: Запустить — FAIL**
- [ ] **Step 3: Реализовать две функции, затем правки компонентов из списка**
- [ ] **Step 4: Запустить `npm test` и `npx tsc -noEmit -skipLibCheck` — PASS**
- [ ] **Step 5: Commit** — `feat: navigator renders the temporary focus`

---

### Task 4: Меню, строки, настройка

**Files:**
- Modify: `src/shared/en.ts`, `src/core/react/components/UI/Menus/navigator/contextMenuItems.tsx`, `.../pathContextMenu.tsx`, `.../spaceContextMenu.tsx`, `src/core/react/components/Navigator/SpaceTree/SpaceTreeItem.tsx:165-184`, `src/adapters/obsidian/ui/showMainMenu.tsx`, `src/commands.tsx`, `src/adapters/obsidian/settings.ts` (~127)
- Test: дополнить `src/tests/pathContextMenu.test.ts`, `src/tests/contextMenuItems.test.ts`, `src/tests/mainMenu.test.ts`

**Interfaces:**
- Consumes: Task 1 (`enterFocusMode`, `exitFocusMode`, `FocusModeSource`, `currentFocusIndex`, `focusAtIndex`, `currentFocus`, `setCurrentExpandedSpaces`), Task 3 (`treeOrderRef`).
- Produces:
  - `ContextMenuTarget.focusMode?: FocusModeSource[]`;
  - `menuItems.focusMode` — `when: (t) => !!t.focusMode?.length`, имя `i18n.menu.focusMode`, `onClick: () => enterFocusMode(t.superstate, t.focusMode)`; иконка на выбор исполнителя;
  - `showPathContextMenu(..., depth = 0, nodeId?: string)` и `showSpaceContextMenu(..., depth = 0, nodeId?: string)` — новый последний параметр;
  - `triggerMultiPathMenu(superstate, selectedPaths, e, treeOrder?: string[])`, то же для `triggerMultiPathMenuForTagSpace`.

Строки в `en.ts`: `menu.focusMode: "Focus Mode"`, `menu.exitFocusMode: "Exit Focus Mode"`, `settings.focusModeKeepExpanded: { name: "Keep Focus Mode Folding", desc: "After leaving Focus Mode, keep folders expanded or collapsed the way you left them" }`.

Расположение (PRD 4.1):

| Построитель | Группы |
|---|---|
| `showPathContextMenu` | новая первая группа `[menuItems.focusMode]`, затем `[menuItems.changeColor]` |
| `showSpaceContextMenu` | первая группа `[...newItems, menuItems.focusMode]` (и для папки, и для tag space) |
| `triggerMultiPathMenu`, `triggerMultiPathMenuForTagSpace` | `[menuItems.openInTab, menuItems.focusMode]` |

Источники:

- одиночные меню: `focusMode: [{ path, originId: nodeId }]`;
- множественные: узлы сортируются по позиции `node.id` в `treeOrder` (без `treeOrder` — порядок выделения), затем `{ path: node.item.path, originId: node.id }`. `item.path` у linked item — путь оригинала, поэтому секцией становится оригинал;
- `SpaceTreeItem`: передаёт `data.id` последним аргументом `showPathContextMenu` и `treeOrderRef.current` в `triggerMultiPathMenu`.

Главное меню (`showMainMenu`):

- первый пункт: в Focus Mode — `{ name: i18n.menu.exitFocusMode, icon: "ui//close", onClick: () => exitFocusMode(superstate) }`, иначе — прежний New Focus;
- `toggleSections`: `setCurrentExpandedSpaces(superstate, collapse ? [] : currentFocus(superstate)?.paths ?? [])`;
- пункт Excluded Items: индекс `currentFocusIndex`, focus `focusAtIndex`; в заголовке вместо имени — `i18n.menu.focusMode` при `FOCUS_MODE_INDEX`.

`commands.tsx`: литерал `"Focus Mode"` из Task 2 заменить на `i18n.menu.focusMode`.

Настройка: в `adapters/obsidian/settings.ts` добавить `{ name: "focusModeKeepExpanded", category: "system", type: "boolean" }` после `revealActiveFile`.

- [ ] **Step 1: Написать падающие тесты**

Использовать уже принятый в этих файлах способ собрать опции меню (стаб `superstate` с `ui.openMenu`). Данные свои.

- `pathContextMenu.test.ts`:
  - `a single file gets Focus Mode as its own group above Color` — имена: `[Focus Mode, <separator>, Color, …]`.
  - `a folder gets Focus Mode last in the New group` — пункт сразу перед первым сепаратором, после `i18n.menu.new`; следующая группа начинается с Color.
  - `a tag space gets Focus Mode right after New Separator`.
  - `multi-select gets Focus Mode right after Open in Tabs` — и для обычного, и для tag-space варианта: имена начинаются с `[Open in Tabs, Focus Mode, <separator>]`.
  - `Focus Mode on a selection uses tree order, not click order` — выделение `[Tools/Saw.md (id "Tools/Tools/Saw.md"), Recipes (id "Recipes")]`, `treeOrder: ["Recipes", "Tools", "Tools/Tools/Saw.md"]`; клик по пункту → `superstate.focusMode.focus.paths` = `["Recipes", "Tools/Saw.md"]`.
  - `Focus Mode on a single nested folder makes it a section` — клик → `focusMode.focus.paths` = `["Recipes/Soups"]`, `saveFocuses` не вызван.
- `contextMenuItems.test.ts`: `Focus Mode is absent when the target has nothing to focus` — `buildContextMenu({ ...target, focusMode: undefined }, [[menuItems.focusMode]])` = `[]`.
- `mainMenu.test.ts`:
  - `shows Exit Focus Mode instead of New Focus while focus mode is on` — первый пункт `i18n.menu.exitFocusMode`, пункта `"New Focus"` нет; Excluded Items присутствует.
  - `Exit Focus Mode returns to the origin focus` — клик → `superstate.focusMode` = `null`, `settings.currentFocus` прежний.
  - `the exclusions window is titled for Focus Mode` — заголовок = `i18n.labels.excludedItems.replace("${1}", "Focus Mode")`.
  - `Expand All inside focus mode leaves the saved folding alone` — клик по Expand All → `focusMode.expandedSpaces` = пути временного focus, `settings.expandedSpaces` не изменился.

- [ ] **Step 2: Запустить — FAIL**
- [ ] **Step 3: Реализовать строки, спецификацию пункта, расположение, главное меню, настройку**
- [ ] **Step 4: Запустить `npm test` и `npx tsc -noEmit -skipLibCheck` — PASS**
- [ ] **Step 5: Commit** — `feat: Focus Mode menu items and setting`

---

### Task 5: Проверка в живом Obsidian

Автотесты не рендерят React, поэтому поведение UI проверяется вручную через навык `obsidian-cli` (см. память `obsidian-live-debug`: `obsidian-cli eval`, состояние в `app.plugins.plugins["make-md-spaces"].superstate`).

**Files:** нет изменений кода, кроме исправлений найденного.

- [ ] **Step 1: Собрать** — `npm run build`, без ошибок; перезагрузить плагин.
- [ ] **Step 2: Пройти критерии приёмки PRD (раздел 10), каждый отметить отдельно:**
  - 1–4: вход с одного файла; с выделения из папки, вложенного файла и tag space; места пункта в четырёх меню; свёрнутость сохранена;
  - 5: ни одна вкладка не подсвечена; в многоточии Exit Focus Mode вместо New Focus;
  - 6–8: исключения (пустой старт, исключить, вернуть через окно); после drop на focus level, «+ Open», Remove from Focus, переименования файла `.space/focuses.json` не содержит временного focus (сравнить содержимое файла до и после);
  - 8a/8b: настройка выключена и включена;
  - 9–10c: Exit; левое нажатие на вкладку (выход уже на нажатии); drop элемента на вкладку не закрывает; правый клик закрывает без меню;
  - 11–12: Focus Mode внутри Focus Mode; удаление последней секции;
  - 13: перезагрузка плагина открывает исходный focus;
  - 14: переименование файла-секции;
  - 10b: Focus Mode на linked item показывает оригинал.
- [ ] **Step 3: Найденные расхождения исправить, на каждое — тест поведения в соответствующем файле `src/tests`, затем `npm test`.**
- [ ] **Step 4: Commit исправлений (если были)** — `fix: focus mode <что именно>`
