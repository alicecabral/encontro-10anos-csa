import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(apiRoot, 'assets');
const destination = path.join(apiRoot, 'dist', 'assets');

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
