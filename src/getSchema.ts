'use strict';
import path from 'path';
import child_process, { ExecFileSyncOptionsWithStringEncoding } from 'child_process';

// TODO: make this async
const getSchema = () => {
  let stdin = new Uint8Array();
  const f = child_process.execFileSync(path.join(__dirname, 'schema'), {
    cwd: process.cwd(),
    windowsHide: true,
    input: stdin,
    maxBuffer: process.env.ESBUILD_MAX_BUFFER || 16 * 1024 * 1024,
  } as ExecFileSyncOptionsWithStringEncoding);

  return JSON.parse(f.toString());
};

export default getSchema;
