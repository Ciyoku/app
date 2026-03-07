import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['js', 'scripts'];
const TARGET_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch (_) {
        return false;
    }
}

async function collectFiles(dirPath, output = []) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await collectFiles(fullPath, output);
            continue;
        }

        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase();
        if (!TARGET_EXTENSIONS.has(extension)) continue;
        output.push(fullPath);
    }

    return output;
}

function resolveCandidates(importerPath, specifier) {
    const resolved = path.resolve(path.dirname(importerPath), specifier);
    return [
        resolved,
        `${resolved}.js`,
        `${resolved}.mjs`,
        `${resolved}.cjs`,
        path.join(resolved, 'index.js')
    ];
}

async function hasExistingCandidate(candidates) {
    for (const candidate of candidates) {
        try {
            const stat = await fs.stat(candidate);
            if (stat.isFile()) return true;
        } catch (_) {
            // ignore
        }
    }

    return false;
}

async function main() {
    const files = [];
    for (const relativeDir of TARGET_DIRS) {
        const fullDir = path.join(ROOT, relativeDir);
        if (!await pathExists(fullDir)) continue;
        await collectFiles(fullDir, files);
    }

    files.sort((a, b) => a.localeCompare(b));

    const importPattern = /from\s+['"]([^'"]+)['"]/g;
    const failures = [];

    for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        let match = importPattern.exec(content);
        while (match) {
            const specifier = String(match[1] ?? '');
            if (specifier.startsWith('.')) {
                const candidates = resolveCandidates(filePath, specifier);
                if (!await hasExistingCandidate(candidates)) {
                    failures.push({
                        file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
                        specifier
                    });
                }
            }

            match = importPattern.exec(content);
        }
    }

    if (!failures.length) {
        console.log(`OK: verified relative imports for ${files.length} file(s).`);
        return;
    }

    console.error(`Relative import resolution failed for ${failures.length} import(s):`);
    failures.forEach((failure) => {
        console.error(`- ${failure.file}: ${failure.specifier}`);
    });
    process.exitCode = 1;
}

main().catch((error) => {
    console.error(`Import resolution check failed: ${error.message}`);
    process.exitCode = 1;
});
