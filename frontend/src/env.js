// The address path the app is served under. Empty means the site's root, which is what you want
// for your own website. Set REACT_APP_BASE_PATH (for example /crm) before building only if the app
// has to live in a sub-folder.
export const BASE_PATH = process.env.REACT_APP_BASE_PATH || '';
