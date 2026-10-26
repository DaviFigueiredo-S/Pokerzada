import {createAuthHandler} from './handler.js';
const secretKey=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const publicKey=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY');
Deno.serve(createAuthHandler({url:Deno.env.get('SUPABASE_URL'),secretKey,publicKey}));

