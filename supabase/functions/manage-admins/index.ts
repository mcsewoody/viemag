// VIEMAG — staff account management (Edge Function)
//
// WHY THIS EXISTS AS A FUNCTION: creating, deleting or resetting the password
// of a Supabase Auth user requires the service_role key. That key bypasses all
// Row Level Security, so it must never reach a browser — and /admin is served
// as static files from a PUBLIC GitHub repo. This function is therefore the
// only place account mutations can happen: it holds service_role server-side,
// and re-derives the caller's identity from their own JWT before doing anything.
//
// Authorisation model (see supabase/migrations/*_admin_users.sql):
//   any authenticated staff  -> may `list` the roster
//   role = 'owner'           -> may invite / update / delete
// There is no self-service password change: by design (Woody, 2026-07-29) an
// owner resets a colleague's password for them. An owner editing their OWN row
// may change their name and password but not their role.
//
// Lock-out rails, enforced here because Postgres cannot express them per-row:
//   - you cannot delete or demote yourself
//   - the last remaining owner cannot be deleted or demoted
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
// the platform; this function needs no secrets of its own.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/* Password rules. Staff accounts can edit the whole public catalogue, and an
   owner account can also add and remove other staff, so these are deliberately
   stricter than the project's Auth setting. Enforced HERE, server-side, because
   that is the only place a client cannot skip: /admin mirrors the same rules to
   give live feedback, but that copy is a convenience, not the boundary. */
/* 10, not 12 (Woody, 2026-07-29: 12 was too long to type). Paired with the
   required character classes below and the project's HaveIBeenPwned check, this
   is reasonable for a small staff console. To change it, change all three
   places listed above the class table — including the project Auth setting. */
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200; // bcrypt truncates far below this; reject rather than silently accept
/* Lower + upper + digit, symbols optional. This is not a free choice: the
   project's Auth setting (password_required_characters) enforces exactly these
   three groups, so a looser rule here would pass our own check and then be
   rejected by Supabase with an error the operator cannot act on. Change both or
   neither. HaveIBeenPwned checking is also on at the project level, which
   catches breached passwords that satisfy every rule below. */
const REQUIRED_CLASSES: Array<[string, RegExp]> = [
  ['no_lower', /[a-z]/],
  ['no_upper', /[A-Z]/],
  ['no_digit', /[0-9]/],
];

/* CORS is not the security boundary here (the JWT check is) — these requests
   carry a bearer token, not cookies. Still, there is no reason for an arbitrary
   page to be able to read this endpoint's responses, unlike export-site-data. */
const ALLOWED_ORIGINS = [
  'https://viemag.biz',
  'https://www.viemag.biz',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

type Role = 'owner' | 'editor';

interface Caller {
  id: string;
  email: string;
  role: Role;
}

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* Identify the caller from their own JWT, then read their role with
   service_role. Never trust a role sent in the request body. */
async function verifyCaller(req: Request): Promise<{ ok: true; caller: Caller } | { ok: false; reason: string }> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return { ok: false, reason: 'missing Authorization header' };

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await asCaller.auth.getUser();
  if (error || !data.user) return { ok: false, reason: 'not signed in' };

  const { data: profile, error: profileErr } = await admin()
    .from('admin_users').select('role').eq('user_id', data.user.id).maybeSingle();
  if (profileErr) throw new Error(`role lookup failed: ${profileErr.message}`);
  /* No profile row should be impossible (a trigger creates one), but treat a
     missing row as the least privilege rather than as an error. */
  const role: Role = profile?.role === 'owner' ? 'owner' : 'editor';

  return { ok: true, caller: { id: data.user.id, email: data.user.email ?? '', role } };
}

function validEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v) && v.length <= 254;
}

/* Returns the list of unmet rules, so /admin can show exactly what is missing
   instead of a bare "invalid password". Kept in sync with passwordProblems() in
   admin/admin.js — if you change one, change the other. */
function passwordProblems(v: string, email?: string): string[] {
  const problems: string[] = [];
  if (v.length < MIN_PASSWORD) problems.push('too_short');
  if (v.length > MAX_PASSWORD) problems.push('too_long');
  if (/\s/.test(v)) problems.push('whitespace');

  for (const [key, re] of REQUIRED_CLASSES) if (!re.test(v)) problems.push(key);

  /* A password containing the account's own name is the first thing anyone
     guesses, and "set it to their email" is exactly what a busy owner does. */
  const local = (email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && v.toLowerCase().includes(local)) problems.push('contains_email');

  return problems;
}

function checkPassword(v: unknown, email?: string): string {
  if (typeof v !== 'string') throw new BadRequest('password is required');
  const problems = passwordProblems(v, email);
  if (problems.length) throw new BadRequest('weak_password:' + problems.join(','));
  return v;
}

class BadRequest extends Error {}
class Forbidden extends Error {}

function requireOwner(caller: Caller) {
  if (caller.role !== 'owner') throw new Forbidden('only an owner may manage staff accounts');
}

async function ownerCount(): Promise<number> {
  const { count, error } = await admin()
    .from('admin_users').select('user_id', { count: 'exact', head: true }).eq('role', 'owner');
  if (error) throw new Error(`owner count failed: ${error.message}`);
  return count ?? 0;
}

async function targetProfile(userId: unknown) {
  if (typeof userId !== 'string' || !userId) throw new BadRequest('user_id is required');
  const { data, error } = await admin()
    .from('admin_users').select('user_id, email, role').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`target lookup failed: ${error.message}`);
  if (!data) throw new BadRequest('no such staff account');
  return data as { user_id: string; email: string; role: Role };
}

/* ---------------- actions ---------------- */

async function actionList() {
  /* auth.users holds the sign-in facts (last_sign_in_at, confirmation state);
     admin_users holds the role and display name. Join them in memory — the
     roster is a handful of rows, and only these fields are ever returned. */
  const sb = admin();
  const { data: authList, error: authErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authErr) throw new Error(`listUsers failed: ${authErr.message}`);

  const { data: profiles, error: profErr } = await sb
    .from('admin_users').select('user_id, email, display_name, role, created_at');
  if (profErr) throw new Error(`roster query failed: ${profErr.message}`);

  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const users = authList.users.map((u) => {
    const p = byId.get(u.id);
    return {
      user_id: u.id,
      email: u.email ?? p?.email ?? '',
      display_name: p?.display_name ?? null,
      role: (p?.role === 'owner' ? 'owner' : 'editor') as Role,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed: Boolean(u.email_confirmed_at),
    };
  });
  users.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return { users };
}

async function actionInvite(caller: Caller, body: Record<string, unknown>) {
  requireOwner(caller);
  if (!validEmail(body.email)) throw new BadRequest('a valid email is required');
  const password = checkPassword(body.password, body.email);
  const role: Role = body.role === 'owner' ? 'owner' : 'editor';
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 80) : null;

  const sb = admin();
  /* email_confirm: true because this project has no SMTP configured — an
     invite email would never arrive. The owner sets a first password and passes
     it on out of band; the colleague changes it from /admin on first login. */
  const { data, error } = await sb.auth.admin.createUser({
    email: body.email.toLowerCase(),
    password,
    email_confirm: true,
  });
  if (error) throw new BadRequest(error.message);

  /* The auth.users trigger already inserted an 'editor' profile row; fill in
     the name and any promotion the owner asked for. */
  const { error: upErr } = await sb.from('admin_users')
    .update({ display_name: displayName, role }).eq('user_id', data.user.id);
  if (upErr) throw new Error(`profile update failed: ${upErr.message}`);

  return { user_id: data.user.id, email: data.user.email, role };
}

/* One edit action behind /admin's single edit form: name, role and an optional
   password reset arrive together, so they are applied together. Any field left
   out is left alone — notably, an absent `password` is NOT a request to clear it. */
async function actionUpdate(caller: Caller, body: Record<string, unknown>) {
  requireOwner(caller);
  const target = await targetProfile(body.user_id);
  const isSelf = target.user_id === caller.id;
  const changed: string[] = [];

  const patch: Record<string, unknown> = {};
  if (body.display_name !== undefined) {
    patch.display_name = typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim().slice(0, 80)
      : null;
    changed.push('display_name');
  }

  if (body.role !== undefined) {
    if (body.role !== 'owner' && body.role !== 'editor') throw new BadRequest('role must be owner or editor');
    if (body.role !== target.role) {
      /* Refusing a no-op self-edit would be user-hostile — /admin sends the whole
         form back, including the unchanged role — so only a real CHANGE is barred. */
      if (isSelf) throw new Forbidden('you cannot change your own role');
      if (target.role === 'owner' && (await ownerCount()) <= 1) {
        throw new Forbidden('at least one owner must remain');
      }
      patch.role = body.role;
      changed.push('role');
    }
  }

  if (Object.keys(patch).length) {
    const { error } = await admin().from('admin_users').update(patch).eq('user_id', target.user_id);
    if (error) throw new Error(`profile update failed: ${error.message}`);
  }

  /* An empty string means "leave the password alone" — that is what /admin's
     optional reset field submits when the owner did not fill it in. */
  if (typeof body.password === 'string' && body.password !== '') {
    const password = checkPassword(body.password, target.email);
    const { error } = await admin().auth.admin.updateUserById(target.user_id, { password });
    if (error) throw new BadRequest(error.message);
    changed.push('password');
  }

  return { user_id: target.user_id, email: target.email, changed };
}

async function actionDelete(caller: Caller, body: Record<string, unknown>) {
  requireOwner(caller);
  const target = await targetProfile(body.user_id);

  if (target.user_id === caller.id) throw new Forbidden('you cannot delete your own account');
  if (target.role === 'owner' && (await ownerCount()) <= 1) {
    throw new Forbidden('at least one owner must remain');
  }

  /* admin_users.user_id is ON DELETE CASCADE, so the profile row goes with it. */
  const { error } = await admin().auth.admin.deleteUser(target.user_id);
  if (error) throw new BadRequest(error.message);
  return { user_id: target.user_id, email: target.email };
}

/* ---------------- entry point ---------------- */

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const auth = await verifyCaller(req);
    if (!auth.ok) return json({ error: auth.reason }, 401);
    const caller = auth.caller;

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      throw new BadRequest('invalid JSON body');
    }

    let result: unknown;
    switch (body.action) {
      case 'list':         result = await actionList(); break;
      case 'invite':       result = await actionInvite(caller, body); break;
      case 'update':       result = await actionUpdate(caller, body); break;
      case 'delete':       result = await actionDelete(caller, body); break;
      default: throw new BadRequest('unknown action');
    }

    /* An audit trail in the function logs: who did what to whom. Never the
       password itself. */
    if (body.action !== 'list') {
      console.log('manage-admins', JSON.stringify({ by: caller.email, action: body.action, result }));
    }
    return json({ ok: true, ...(result as object) });
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message }, 400);
    if (e instanceof Forbidden) return json({ error: e.message }, 403);
    console.error('manage-admins failed', e);
    return json({ error: 'account operation failed — see function logs' }, 500);
  }
});
