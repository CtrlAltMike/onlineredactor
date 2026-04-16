// Empty-module stub for Turbopack/webpack aliases in the browser bundle.
// Used to no-op Node built-ins (`module`) and optional native deps (`canvas`)
// that `mupdf-wasm.js` and `pdfjs-dist` reach for behind environment guards
// that evaluate false in the browser. The stub itself is never evaluated;
// aliases point here so the bundler resolver doesn't fail.
export default {};
export const createRequire = () => {
  throw new Error('createRequire is not available in the browser');
};
