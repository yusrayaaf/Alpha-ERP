// api/_auth.js — Alpha Ultimate ERP v11
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'alpha-erp-change-this-secret-in-production';

function b64url(s) { return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function b64dec(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  return Buffer.from(s,'base64').toString('utf8');
}

export function signJWT(payload, expiresIn = 86400 * 30) {
  const h = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const b = b64url(JSON.stringify({...payload, exp:Math.floor(Date.now()/1000)+expiresIn, iat:Math.floor(Date.now()/1000)}));
  const s = crypto.createHmac('sha256',SECRET).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${s}`;
}

export function verifyJWT(token) {
  try {
    const [h,b,s] = token.split('.');
    if (crypto.createHmac('sha256',SECRET).update(`${h}.${b}`).digest('base64url') !== s) return null;
    const p = JSON.parse(b64dec(b));
    if (p.exp < Math.floor(Date.now()/1000)) return null;
    return p;
  } catch { return null; }
}

// SHA-256 hex — EXACTLY matches: SELECT encode(digest('password','sha256'),'hex')
export function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

export const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export function requireAuth(req) {
  const auth = (req.headers['authorization'] || '');
  if (!auth.startsWith('Bearer ')) throw new Error('No token');
  const p = verifyJWT(auth.slice(7));
  if (!p) throw new Error('Invalid or expired token');
  return p;
}
