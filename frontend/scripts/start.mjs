import {cpSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
if(!existsSync(resolve(root,'.next/standalone/server.js'))){throw new Error('Run npm run build before starting the server.');}
cpSync(resolve(root,'public'),resolve(root,'.next/standalone/public'),{recursive:true});
cpSync(resolve(root,'.next/static'),resolve(root,'.next/standalone/.next/static'),{recursive:true});
process.env.HOSTNAME=process.env.APP_HOST||'0.0.0.0';
await import(pathToFileURL(resolve(root,'.next/standalone/server.js')).href);
