#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const USAGE = `Usage:
  node scripts/vault-spaces-delete.js <vault-root> [--apply]

Deletes .space directories whose only direct child is def.json.
Without --apply, prints a dry-run list and does not delete anything.`;

const SPACE_CONFIG_FILE = "context.json";

function parseArgs(argv) {
    const args = argv.slice(2);
    const apply = args.includes("--apply");
    const help = args.includes("--help") || args.includes("-h");
    const paths = args.filter((arg) => arg !== "--apply" && arg !== "--help" && arg !== "-h");

    if (help) {
        return { help: true, apply, root: null };
    }

    if (paths.length !== 1) {
        throw new Error(USAGE);
    }

    return { help: false, apply, root: path.resolve(paths[0]) };
}

function isOnlyConfigFile(entries) {
    return entries.length === 1 && entries[0].name === SPACE_CONFIG_FILE && entries[0].isFile();
}

function readDir(dir) {
    return fs.readdirSync(dir, { withFileTypes: true });
}

function listEmptySpaces(root) {
    const rootStat = fs.statSync(root);
    if (!rootStat.isDirectory()) {
        throw new Error(`Vault root is not a directory: ${root}`);
    }

    const visited = new Set();
    const candidates = [];

    function walk(dir) {
        let realDir;
        try {
            realDir = fs.realpathSync(dir);
        } catch (error) {
            console.warn(`Skipping unreadable path: ${dir}`);
            return;
        }

        if (visited.has(realDir)) {
            return;
        }
        visited.add(realDir);

        let entries;
        try {
            entries = readDir(dir);
        } catch (error) {
            console.warn(`Skipping unreadable directory: ${dir}`);
            return;
        }

        if (path.basename(dir) === ".space" && isOnlyConfigFile(entries)) {
            candidates.push(dir);
            return;
        }

        for (const entry of entries) {
            const child = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                walk(child);
                continue;
            }

            if (entry.isSymbolicLink()) {
                let targetStat;
                try {
                    targetStat = fs.statSync(child);
                } catch (error) {
                    console.warn(`Skipping broken symlink: ${child}`);
                    continue;
                }

                if (targetStat.isDirectory()) {
                    walk(child);
                }
            }
        }
    }

    walk(root);
    return candidates.sort();
}

function trashPaths(pathsToTrash) {
    for (const target of pathsToTrash) {
        const result = spawnSync("trash", [target], { encoding: "utf8" });
        if (result.status !== 0) {
            const message = result.stderr.trim() || result.stdout.trim() || `trash exited with ${result.status}`;
            throw new Error(`Failed to trash ${target}: ${message}`);
        }
    }
}

function main() {
    const { help, apply, root } = parseArgs(process.argv);
    if (help) {
        console.log(USAGE);
        return;
    }

    const candidates = listEmptySpaces(root);

    if (candidates.length === 0) {
        console.log("No matching .space directories found.");
        return;
    }

    const action = apply ? "Deleting via trash" : "Dry run, would delete";
    console.log(`${action} ${candidates.length} .space director${candidates.length === 1 ? "y" : "ies"}:`);
    for (const candidate of candidates) {
        console.log(candidate);
    }

    if (apply) {
        trashPaths(candidates);
        console.log("Done.");
    } else {
        console.log("\nRun again with --apply to move these directories to Trash.");
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
