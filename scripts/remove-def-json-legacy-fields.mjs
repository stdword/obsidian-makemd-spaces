#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const fieldsToRemove = new Set(["_template", "_templateName", "readMode", "fullWidth", "_joins", "_contexts"]);
const root = path.resolve(process.argv[2] ?? ".");
const seenDirectories = new Set();

let scanned = 0;
let changed = 0;
let skipped = 0;

async function walk(currentPath) {
  let stats;
  try {
    stats = await fs.lstat(currentPath);
  } catch (error) {
    skipped++;
    console.warn(`skip: ${currentPath}: ${error.message}`);
    return;
  }

  if (stats.isSymbolicLink()) {
    try {
      const targetStats = await fs.stat(currentPath);
      if (!targetStats.isDirectory()) {
        if (path.basename(currentPath) === "def.json") {
          await cleanDefJson(currentPath);
        }
        return;
      }
    } catch (error) {
      skipped++;
      console.warn(`skip symlink: ${currentPath}: ${error.message}`);
      return;
    }
  } else if (!stats.isDirectory()) {
    if (path.basename(currentPath) === "def.json") {
      await cleanDefJson(currentPath);
    }
    return;
  }

  let realDirectory;
  try {
    realDirectory = await fs.realpath(currentPath);
  } catch (error) {
    skipped++;
    console.warn(`skip directory: ${currentPath}: ${error.message}`);
    return;
  }

  if (seenDirectories.has(realDirectory)) {
    return;
  }
  seenDirectories.add(realDirectory);

  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    skipped++;
    console.warn(`skip directory: ${currentPath}: ${error.message}`);
    return;
  }

  await Promise.all(entries.map((entry) => walk(path.join(currentPath, entry.name))));
}

async function cleanDefJson(filePath) {
  scanned++;

  let source;
  try {
    source = await fs.readFile(filePath, "utf8");
  } catch (error) {
    skipped++;
    console.warn(`skip file: ${filePath}: ${error.message}`);
    return;
  }

  let json;
  try {
    json = JSON.parse(source);
  } catch (error) {
    skipped++;
    console.warn(`skip invalid JSON: ${filePath}: ${error.message}`);
    return;
  }

  let hasChanges = false;
  for (const field of fieldsToRemove) {
    if (Object.prototype.hasOwnProperty.call(json, field)) {
      delete json[field];
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return;
  }

  const trailingNewline = source.endsWith("\n") ? "\n" : "";
  await fs.writeFile(filePath, JSON.stringify(json, null, 2) + trailingNewline, "utf8");
  changed++;
  console.log(`updated: ${filePath}`);
}

await walk(root);
console.log(`done: scanned ${scanned} def.json file(s), updated ${changed}, skipped ${skipped}`);
