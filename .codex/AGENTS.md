# Project Context

Obsidian plugin — очистка репозитория с make.md плагином до Spaces Navigator-плагина.


## Purpose

This file documents non-obvious pitfalls, gotchas, and project-specific conventions that are NOT discoverable from the code or existing docs.


# File system

- ❗️ NEVER run any scripts or make any changes outside of the project ROOT!
- Fully ignore the `.obsidian`, `node_modules`, `dist` folders in the root
- ALWAYS remove files via `trash` util. NEVER use `rm`


## Формат ссылок в ответах LLM

Ссылки на локальные файлы в ответах LLM оформляй только так:
- Всегда используй абсолютный путь
- Всегда используй схему `file://`
- Если нужна ссылка на строку, добавляй якорь `#{строка}`
- Колонка в строке не поддерживается — не используй
- Диапазон строк не поддерживается — не используй
- Номер строки дублируй в алиасе вручную в формате `:{строка}`
- Алиас составляется на осонове имени файла, не полного его пути и не относительного, а только имени.
  - Исключение: когда файл зовут `SKILL.md` — тогда пиши «$» и добавляй название родительской папки: `$supervision`

Примеры:
- `[CLAUDE.md](file:///Users/dword/Documents/My%20Notes/Clients/.claude/CLAUDE.md)`
- `[$client-session:10](file:///Users/dword/Documents/My%20Notes/Clients/.claude/skills/client-session/SKILL.md#10)`


## Rules

- Reply in a concise style in chats. Avoid unnecessary repetition or filler language
- If you encounter unexpected behavior or project conventions that contradict common defaults, OR when asked to add a rule, append a one-liner gotcha to the relevant existing section below.
- В тестах никогда не используй мои данные или данные которые я предоставил для диагностики. Всегда сочиняй собственный тестовый кейс, иллюстрирующий ситуацию


## Known Gotchas

- NEVER use Write to edit already existing non-empty files — always use Edit instead.
