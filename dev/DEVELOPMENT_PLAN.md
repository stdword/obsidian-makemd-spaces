# План разработки: поэтапное отключение лишнего до Navigator-плагина

## Цель

Превратить текущий репозиторий в самостоятельный Obsidian-плагин Navigator.

Плагин должен оставлять только функциональность отдельной панели навигации по vault: папки, файлы, открытие элементов, подсветка активного файла и выбранные базовые операции с файловым деревом. Все подсистемы make.md, не нужные для этой задачи, сначала должны быть точечно отключены минимальными изменениями. Физическое удаление кода, файлов, настроек и зависимостей допускается только после отдельного подтверждения, что Navigator работает как надо.

## Итоговый продукт

Минимальная первая версия должна:

- регистрировать один основной Obsidian view для Navigator;
- открывать панель Navigator командой Obsidian;
- опционально открывать панель при запуске;
- показывать дерево vault с папками и файлами;
- открывать файл по выбору в дереве;
- раскрывать/сворачивать папки;
- подсвечивать активный файл;
- поддерживать только явно выбранные действия контекстного меню;
- корректно выгружаться без оставшихся view, listeners и runtime-ошибок;
- собираться через `npm run build`;
- проверяться в живом Obsidian через `obsidian` CLI.

## Текущая структура

Основные файлы проекта:

- `src/main.ts` - текущая точка входа плагина, класс `MakeMDPlugin`.
- `manifest.json` - manifest Obsidian-плагина, текущий id: `make-md-spaces`.
- `package.json` - команды сборки и зависимости.
- `esbuild.config.mjs` - сборка плагина.

Текущий путь рендера Navigator:

- `src/main.ts` регистрирует `FILE_TREE_VIEW_TYPE`.
- `src/adapters/obsidian/ui/navigator/NavigatorView.tsx` реализует Obsidian `ItemView`.
- `src/core/react/components/Navigator/Navigator.tsx` рендерит React-корень панели.
- `src/core/react/context/SidebarContext.tsx` хранит состояние панели.
- `src/core/react/components/Navigator/MainList.tsx` собирает основной UI.
- `src/core/react/components/Navigator/MainMenu.tsx` содержит верхнее меню.
- `src/core/react/components/Navigator/Focuses/*` отвечает за фокусы/наборы путей.
- `src/core/react/components/Navigator/SpaceTree/*` отвечает за дерево.
- `src/core/react/components/UI/Menus/navigator/*` содержит контекстные меню.
- `src/core/utils/dnd/*` содержит drag-and-drop путей.
- `src/css/Panels/Navigator/*` содержит стили панели.

Вероятные временные зависимости Navigator:

- `src/core/superstate/*` - индекс, события, настройки, состояние vault.
- `src/core/spaceManager/*` - операции с spaces, focuses и путями.
- `src/adapters/obsidian/filesystem/*` - файловый адаптер Obsidian.
- `src/adapters/obsidian/utils/file.ts` - открытие файлов и путей.
- `src/core/schemas/settings.ts` и `src/shared/types/settings.ts` - настройки.
- `src/shared/i18n.ts` и `src/shared/en.ts` - строки UI.
- `src/adapters/obsidian/ui/ui.tsx` - React root, modals, notifications.

## Границы очистки

Кандидаты на отключение после проверки зависимостей:

- `SpaceView`, `SpaceViewContainer`, space fragments и embedded spaces;
- `MDBFileViewer`, `MKitFileViewer`, `HTMLFileViewer`, `FileLinkView`;
- MDB/SQL/local cache, если дерево Navigator может работать без них;
- frames, visualization, actions, editor nodes, slides, overlays;
- markdown post-processors и inline context;
- make.md basics, flow editor и патчи markdown/editor UI;
- release notes/get started ссылки на make.md;
- лишние CSS-файлы за пределами Navigator;
- зависимости `package.json`, которые используются только подсистемами-кандидатами на будущее удаление.

Не отключать без отдельной проверки:

- `Superstate`;
- `SpaceManager`;
- filesystem adapters;
- settings/i18n;
- navigator menus;
- drag-and-drop;
- CSS из `src/css/Panels/Navigator/*`.

Эти части могут быть слишком широкими, но сначала должны быть покрыты картой фактических зависимостей.

## Правила изменений

До явного подтверждения работоспособности запрещено:

- удалять файлы и папки;
- удалять npm dependencies;
- удалять настройки из схем и сохраненных данных;
- переписывать архитектуру;
- заменять крупные подсистемы новым кодом;
- делать массовые комментарии по большим блокам.

Разрешено:

- точечно отключать регистрацию view, command, event listener, extension или post-processor;
- точечно комментировать import только если он стал не нужен после отключения регистрации;
- добавлять короткий комментарий рядом с отключением, если без него причина неочевидна;
- вносить минимальные правки, необходимые для сборки после отключения;
- возвращать отключенное место обратно, если проверка показала регрессию.

Принцип работы: микрошаг, сборка, проверка в Obsidian, фиксация результата. Изменение считается слишком большим, если оно одновременно отключает несколько независимых подсистем и затрудняет понимание причины поломки.

## Ключевые решения

Перед активным отключением нужно принять решения:

- Navigator показывает обычное дерево vault или сохраняет make.md spaces-модель?
- Нужны ли `Focuses` в первой версии?
- Нужен ли `EverLeafView` или это отдельная make.md-функция?
- Что делает выбор папки: раскрывает папку в дереве, открывает стандартное Obsidian-представление или временно оставляет переход в `SPACE_VIEW_TYPE`?
- Какие команды остаются в Command Palette?
- Какие действия контекстного меню входят в MVP?
- Нужен ли drag-and-drop в первой версии?
- Нужно ли сохранять совместимость со старыми make.md settings/data?
- Плагин остается desktop-only или должна появиться мобильная поддержка?

Рекомендуемое решение для первой версии: обычный файловый Navigator без make.md editor/viewer подсистем. `Focuses`, `EverLeafView`, drag-and-drop и расширенные контекстные действия считать опциональными, пока не доказано, что они нужны для базового дерева.

## Известные риски

`FileTreeView` уже выглядит как отдельный Navigator, но содержит связь с make.md views: `revealInFolder()` открывает `SPACE_VIEW_TYPE` для папок. Это нужно заменить или явно оставить как временную зависимость.

`src/commands.tsx` содержит много команд, не относящихся к Navigator: overview, warnings, logs, path fixer, move space data folder, release notes, get started, pin active file to space, backlinks, blink, homepage, context view. Их нужно разделить на команды Navigator и команды отключаемого make.md слоя.

`Superstate` и `SpaceManager` могут быть центральной связкой для дерева, индекса, focuses, settings и filesystem. Их нельзя удалять первыми. Сначала нужен узкий интерфейс Navigator поверх текущей модели.

`package.json` содержит много зависимостей UI/editor/database-слоя. До подтверждения работоспособности зависимости не трогать; после подтверждения удалять их только микрошагами после отключения импортов и успешной сборки.

## План работ

### 1. Зафиксировать baseline

- Запустить `npm run build`.
- Проверить, что плагин загружается в Obsidian.
- Перезагрузить плагин: `obsidian plugin:reload id=make-md-spaces`.
- Проверить ошибки: `obsidian dev:errors`.
- Проверить ошибки консоли: `obsidian dev:console level=error`.
- Проверить наличие view: `obsidian eval code="app.workspace.getLeavesOfType('mk-path-view').length"`.
- Проверить DOM панели: `obsidian dev:dom selector=".mk-sidebar" text`.

Результат: короткий baseline-отчет с текущими ошибками, если они есть.

### 2. Составить карту зависимостей Navigator

- Описать все imports из `src/adapters/obsidian/ui/navigator/NavigatorView.tsx`.
- Описать все imports из `src/core/react/components/Navigator/*`.
- Описать все imports из `src/core/react/context/SidebarContext.tsx`.
- Описать все imports из `src/core/react/components/UI/Menus/navigator/*`.
- Описать settings, реально читаемые Navigator.
- Описать events, реально используемые Navigator.
- Описать CSS, реально нужный панели.

Результат: таблица `оставить / временно оставить / отключить / проверить`.

### 3. Сузить публичный API Navigator

Ввести или описать минимальный интерфейс, который нужен UI панели:

- получить дерево элементов;
- получить активный путь;
- открыть файл;
- раскрыть/свернуть папку;
- создать файл или папку, если действие входит в MVP;
- переименовать/удалить/переместить, если действие входит в MVP;
- подписаться на изменения vault;
- подписаться на изменение активного файла;
- сохранить настройки панели.

На этом этапе можно оставить реализацию через `Superstate`, но UI Navigator не должен напрямую зависеть от лишних make.md editor/viewer возможностей.

### 4. Минимально отключить лишнее в `src/main.ts`

- Не переименовывать `MakeMDPlugin` на первом проходе, чтобы не создавать лишний diff.
- Оставить регистрацию `FILE_TREE_VIEW_TYPE`.
- Проверить необходимость `EVER_VIEW_TYPE`; если не входит в MVP, точечно отключить его регистрацию.
- Точечно отключить регистрацию editor/viewer views, не относящихся к Navigator.
- Точечно отключить release notes/get started.
- Оставить только нужные `workspace` и `vault` events.
- Проверить `openFileTreeLeaf`, `detachFileTreeLeafs`, `onunload`.
- Проверить зависимость `FileTreeView.revealInFolder()` от `SPACE_VIEW_TYPE`; менять ее только отдельным микрошагом.

После каждого изменения запускать сборку.

### 5. Минимально отключить команды

Оставить только команды первой версии:

- открыть Navigator;
- reveal active file in Navigator, если реализовано;
- создать файл/папку, если действие входит в MVP;
- expand/collapse folders, если поддерживается.

Все остальные команды сначала только отключить в `attachCommands`. Не удалять реализации, imports и связанные UI-компоненты, пока Navigator не проверен. Imports комментировать только точечно, если TypeScript/build требует этого после отключения команды.

### 6. Минимально отключить настройки

Оставить только настройки Navigator:

- включить/отключить Navigator;
- открывать Navigator при запуске;
- сторона панели;
- скрытые файлы/расширения;
- высота строки;
- режим производительности, если реально используется;
- раскрытие папки по клику;
- reveal active file;
- preview on hover, если остается;
- override native menu, если остается.

Settings UI для spaces/editor/context/frames/appearance сначала только скрыть или отключить из регистрации секций. Не удалять schema/default settings до подтверждения работоспособности.

### 7. Проверить отключенные подсистемы

Отключать итерациями:

- отключить импорт или регистрацию;
- запустить `npm run build`;
- перезагрузить плагин через `obsidian plugin:reload id=make-md-spaces`;
- проверить `obsidian dev:errors` и `obsidian dev:console level=error`.

Порядок отключения:

- editor/viewer views;
- markdown post-processors и inline context;
- basics/flow;
- frames/visualization/actions;
- MDB/SQL/local cache, если Navigator больше не зависит от них.

CSS и npm dependencies на этом этапе не удалять. Их можно пометить как кандидатов на удаление в отчете, но физически не трогать до подтверждения.

### 8. Подтвердить работоспособность

После серии отключений нужно подтвердить:

- Navigator открывается;
- дерево отображается;
- открытие файлов работает;
- папки ведут себя выбранным способом;
- активный файл подсвечивается;
- оставленные команды работают;
- отключенные подсистемы не вызывают ошибок;
- пользователь подтвердил, что текущее поведение подходит.

### 9. Удаление после подтверждения

Только после отдельного подтверждения можно переходить к физическому удалению:

- удалить отключенные registrations/imports/code paths;
- удалить недостижимые файлы;
- удалить лишние CSS;
- удалить лишние npm dependencies;
- переименовать `MakeMDPlugin`, если это все еще нужно;
- упростить settings schema/defaults;
- обновить metadata и документацию.

Удаление также выполнять микрошагами: одно логическое удаление, сборка, проверка.

### 10. Обновить metadata и документацию

- Обновить `manifest.json`: id, name, description, author, authorUrl, desktop/mobile policy.
- Обновить `README.md`: что делает плагин, как собрать, как установить, какие функции входят в Navigator.
- Проверить, что `main.js`, `styles.css`, `manifest.json` соответствуют Obsidian plugin layout.

## Проверка готовности

Сборка:

- `npm run build` проходит без ошибок.

Проверка в Obsidian:

- `obsidian plugin:reload id=make-md-spaces` перезагружает плагин.
- `obsidian dev:errors` не показывает ошибок плагина.
- `obsidian dev:console level=error` не показывает runtime-ошибок плагина.
- `obsidian eval code="app.workspace.getLeavesOfType('mk-path-view').length"` возвращает ожидаемое количество открытых Navigator view.
- `obsidian dev:dom selector=".mk-sidebar" text` показывает содержимое панели.
- `obsidian dev:screenshot path=/tmp/navigator.png` дает визуально корректную панель.

Функциональная проверка:

- Navigator открывается командой.
- Navigator открывается при запуске, если настройка включена.
- Дерево показывает папки и файлы vault.
- Файл открывается по клику.
- Папка раскрывается или выполняет выбранное целевое действие.
- Активный файл подсвечивается.
- Оставленные контекстные действия работают.
- Отключение плагина закрывает view и не оставляет ошибок.

## Рабочий чеклист

- [ ] Baseline build выполнен.
- [ ] Baseline проверен через `obsidian` CLI.
- [ ] Карта зависимостей Navigator составлена.
- [ ] Минимальный API Navigator описан.
- [ ] Решено, нужна ли make.md spaces-модель.
- [ ] Решено, нужен ли `EverLeafView`.
- [ ] Решено, нужны ли `Focuses`.
- [ ] Решено, нужен ли drag-and-drop.
- [ ] Решено поведение выбора папки.
- [ ] `src/main.ts` минимально отключен до Navigator.
- [ ] Команды минимально отключены до Navigator.
- [ ] Settings UI минимально отключен до Navigator.
- [ ] Неиспользуемые views отключены, но не удалены.
- [ ] Неиспользуемые editor/flow/frame подсистемы отключены, но не удалены.
- [ ] Работоспособность после отключений подтверждена пользователем.
- [ ] После подтверждения неиспользуемые CSS удалены.
- [ ] После подтверждения неиспользуемые npm dependencies удалены.
- [ ] `manifest.json` обновлен.
- [ ] `README.md` обновлен.
- [ ] Финальная сборка проходит.
- [ ] Финальная проверка в Obsidian проходит.

## Критерии завершения первой версии

Первая версия считается готовой, когда репозиторий содержит самостоятельный Navigator-плагин, который открывается в Obsidian, показывает файловое дерево vault, открывает файлы, корректно обрабатывает выбранное поведение папок и не регистрирует make.md editor/viewer подсистемы. До пользовательского подтверждения готовности кодовая база может сохранять отключенные, но еще не удаленные подсистемы.
