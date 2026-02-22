import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SELF_FILE = 'scripts/enforce-no-legacy-features.mjs';

const FORBIDDEN_FILES = Object.freeze([
    'book-details.html',
    'favorites.html',
    'js/book-details-page.js',
    'js/favorites-page.js',
    'js/favorites-store.js',
    'js/reader/reading-progress.js',
    'js/shared/storage-keys.js'
]);

const TARGET_DIRECTORIES = Object.freeze([
    'js',
    'css',
    'scripts'
]);

const TARGET_ROOT_EXTENSIONS = new Set([
    '.html',
    '.xml',
    '.txt',
    '.md'
]);

const FORBIDDEN_PATTERNS = Object.freeze([
    { regex: /book-details\.html/iu, label: 'book-details URL' },
    { regex: /favorites\.html/iu, label: 'favorites URL' },
    { regex: /favorites-store\.js/iu, label: 'favorites module import' },
    { regex: /reading-progress\.js/iu, label: 'reader progress module import' },
    { regex: /\bloadBookProgress\b|\bsaveBookProgress\b|\bresolveRequestedState\b/iu, label: 'per-book persistence API' }
]);

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch (_) {
        return false;
    }
}

async function collectFilesFromDir(relativeDir, output = []) {
    const fullDir = path.join(ROOT, relativeDir);
    if (!await pathExists(fullDir)) return output;

    const entries = await fs.readdir(fullDir, { withFileTypes: true });
    for (const entry of entries) {
        const nextRelative = path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name);
        const nextFull = path.join(fullDir, entry.name);

        if (entry.isDirectory()) {
            await collectFilesFromDir(nextRelative, output);
            continue;
        }

        if (!entry.isFile()) continue;
        output.push(nextRelative);
    }

    return output;
}

async function collectRootFiles(output = []) {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase();
        if (!TARGET_ROOT_EXTENSIONS.has(extension)) continue;
        output.push(entry.name);
    }
    return output;
}

function findMatches(fileText) {
    const matches = [];
    FORBIDDEN_PATTERNS.forEach((rule) => {
        if (rule.regex.test(fileText)) {
            matches.push(rule.label);
        }
    });
    return matches;
}

async function main() {
    const violations = [];

    for (const relativeFile of FORBIDDEN_FILES) {
        const fullPath = path.join(ROOT, relativeFile);
        if (await pathExists(fullPath)) {
            violations.push(`${relativeFile}: file must not exist`);
        }
    }

    const scanFiles = [];
    for (const dir of TARGET_DIRECTORIES) {
        await collectFilesFromDir(dir, scanFiles);
    }
    await collectRootFiles(scanFiles);

    const uniqueFiles = [...new Set(scanFiles)].sort((a, b) => a.localeCompare(b));
    for (const relativeFile of uniqueFiles) {
        if (relativeFile === SELF_FILE) continue;
        const fullPath = path.join(ROOT, relativeFile);
        const content = await fs.readFile(fullPath, 'utf8');
        const hits = findMatches(content);
        if (!hits.length) continue;

        violations.push(`${relativeFile}: ${hits.join(', ')}`);
    }

    if (violations.length > 0) {
        console.error(`Legacy feature policy violations: ${violations.length}`);
        violations.forEach((line) => {
            console.error(`- ${line}`);
        });
        process.exitCode = 1;
        return;
    }

    console.log('OK: legacy feature policy checks passed');
}

main().catch((error) => {
    console.error(`Legacy policy check failed: ${error.message}`);
    process.exitCode = 1;
});
