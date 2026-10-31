// Security settings checked when the server starts.

// The secret key signs the "passes" given at sign-in. It must be long, random and private.
const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_HINTS = ['changeme', 'change_me', 'change-me', 'your_secret', 'your-secret', 'yoursecret', 'secret', 'password', 'example', 'placeholder', 'replace', 'dev_secret', 'testsecret'];

// Returns a plain-English problem with the secret key, or null when it is fine.
function jwtSecretProblem(secret) {
  const s = String(secret || '').trim();
  if (!s) return 'JWT_SECRET is missing from backend\\.env.';
  if (s.length < MIN_SECRET_LENGTH) return `JWT_SECRET is too short (${s.length} characters; at least ${MIN_SECRET_LENGTH} are needed).`;
  const lower = s.toLowerCase();
  if (PLACEHOLDER_HINTS.some(h => lower.includes(h))) return 'JWT_SECRET still looks like a placeholder.';
  return null;
}

// Websites allowed to call the API from a browser. CORS_ORIGINS holds them, comma-separated.
// In development, any page on this computer (localhost / 127.0.0.1, any port) is allowed.
function parseOrigins(value) {
  return String(value || '').split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);
}

function corsOptions(env = process.env) {
  const listed = parseOrigins(env.CORS_ORIGINS);
  const dev = env.NODE_ENV !== 'production';
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  return {
    origin(origin, cb) {
      // No Origin header: not a browser cross-site call (same-site page, curl, a server). Allowed.
      if (!origin) return cb(null, true);
      if (listed.includes(origin.replace(/\/+$/, ''))) return cb(null, true);
      if (dev && local.test(origin)) return cb(null, true);
      return cb(null, false);
    },
  };
}

// In production the list of allowed websites must be set; otherwise the site could not be reached
// from a browser, or would have to be left open to everyone.
function corsProblem(env = process.env) {
  if (env.NODE_ENV === 'production' && parseOrigins(env.CORS_ORIGINS).length === 0) {
    return 'CORS_ORIGINS is missing from backend\\.env. List the website address(es) that may use this server, separated by commas.';
  }
  return null;
}

module.exports = { MIN_SECRET_LENGTH, jwtSecretProblem, parseOrigins, corsOptions, corsProblem };
