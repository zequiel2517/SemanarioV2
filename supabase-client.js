// ============================================================
//  Semanario Familiar V2 — Cliente Supabase + capa de datos
//  Uso:  <script type="module"> import { auth, families, ... } from './supabase-client.js'
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- Configuración del proyecto (la publishable key es pública y segura en el front) ----
const SUPABASE_URL = 'https://tqdxgkoyyxprbyjfgmkt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nA007BBfZPHWwrjwdYvdyQ_euaVkH8F';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Utilidades de fechas (fechas locales, sin líos de zona horaria) ----
export const iso = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const mondayOf = (d) => { const x = new Date(d); const js = x.getDay(); x.setDate(x.getDate() - ((js + 6) % 7)); x.setHours(0,0,0,0); return x; };
// weekday del recetario: 0=lunes … 6=domingo
const weekdayOf = (d) => (d.getDay() + 6) % 7;

// ============================================================
//  AUTH
// ============================================================
export const auth = {
  onChange(cb) { return supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null)); },
  async currentUser() { const { data } = await supabase.auth.getUser(); return data.user ?? null; },

  // Email + contraseña
  signUpEmail(email, password, displayName) {
    return supabase.auth.signUp({ email, password, options: { data: { display_name: displayName || null } } });
  },
  signInEmail(email, password) { return supabase.auth.signInWithPassword({ email, password }); },

  // Enlace mágico (sin contraseña). redirectTo debe estar permitido en Auth → URL Configuration.
  sendMagicLink(email) {
    return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  },

  // Opcional: Google (requiere configurar el provider en Supabase + Google Cloud)
  signInGoogle() {
    return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  },

  signOut() { return supabase.auth.signOut(); },
};

// ============================================================
//  FAMILIAS (alta / unión / miembros) — usan las funciones RPC del esquema
// ============================================================
export const families = {
  async create(name) {
    const { data, error } = await supabase.rpc('create_family', { p_name: name });
    if (error) throw error; return data;
  },
  async join(code) {
    const { data, error } = await supabase.rpc('join_family', { p_code: code });
    if (error) throw error; return data;
  },
  async mine() {
    const { data, error } = await supabase
      .from('memberships').select('role, families(id, name, invite_code)');
    if (error) throw error;
    return (data || []).map(m => ({ ...m.families, role: m.role }));
  },
  async members(familyId) {
    const { data, error } = await supabase
      .from('memberships').select('role, profiles(id, display_name)').eq('family_id', familyId);
    if (error) throw error;
    return (data || []).map(m => ({ ...m.profiles, role: m.role }));
  },
};

// ============================================================
//  RECETARIO
// ============================================================
export const recipes = {
  // Recetas de la familia + biblioteca común (family_id null); orden por favoritas y uso
  async list(familyId) {
    const { data, error } = await supabase
      .from('recipes').select('*')
      .or(`family_id.eq.${familyId},family_id.is.null`)
      .order('is_favorite', { ascending: false }).order('uses', { ascending: false });
    if (error) throw error; return data || [];
  },
  async get(recipeId) {
    const { data, error } = await supabase
      .from('recipes').select('*, recipe_ingredients(*)').eq('id', recipeId).single();
    if (error) throw error; return data;
  },
  // Crea o actualiza una receta (autoguardado desde el formulario).
  // Con id -> UPDATE por id (no toca family_id, así la RLS lo permite).
  // Sin id -> INSERT (debe incluir family_id).
  async upsert(recipe) {
    if (recipe.id) {
      const { id, family_id, ...patch } = recipe; // family_id NO se modifica al editar
      const { data, error } = await supabase.from('recipes').update(patch).eq('id', id).select().single();
      if (error) throw error; return data;
    }
    const { data, error } = await supabase.from('recipes').insert(recipe).select().single();
    if (error) throw error; return data;
  },
  async incrementUse(recipeId) {
    // pequeño contador de uso para "recientes/favoritas"
    const { data } = await supabase.from('recipes').select('uses').eq('id', recipeId).single();
    if (data) await supabase.from('recipes').update({ uses: (data.uses || 0) + 1 }).eq('id', recipeId);
  },
  // Reemplaza los ingredientes de una receta
  async saveIngredients(recipeId, items) {
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    if (!items.length) return [];
    const rows = items.map((it, i) => ({
      recipe_id: recipeId, ingredient_id: it.ingredient_id ?? null,
      name: it.name, quantity: it.quantity ?? null, unit: it.unit ?? null, position: i,
    }));
    const { data, error } = await supabase.from('recipe_ingredients').insert(rows).select();
    if (error) throw error; return data;
  },
};

// ============================================================
//  SEMANA (días, platos, flag de compra)  +  EVENTOS
//  week.get() devuelve 7 días listos para pintar, con recurrentes ya expandidos.
// ============================================================
export const week = {
  async get(familyId, anyDateInWeek = new Date()) {
    const monday = mondayOf(anyDateInWeek);
    const sunday = addDays(monday, 6);
    const from = iso(monday), to = iso(sunday);

    const [dishesR, eventsR, plansR, recurR] = await Promise.all([
      supabase.from('dishes').select('id, day, slot, position, recipe_id, free_text, side_recipe_id, side_text, recipes!recipe_id(title)').eq('family_id', familyId).gte('day', from).lte('day', to),
      supabase.from('events').select('*').eq('family_id', familyId).gte('day', from).lte('day', to),
      supabase.from('plan_days').select('day, include_in_shopping').eq('family_id', familyId).gte('day', from).lte('day', to),
      supabase.from('recurring_events').select('*').eq('family_id', familyId).eq('active', true),
    ]);
    for (const r of [dishesR, eventsR, plansR, recurR]) if (r.error) throw r.error;

    const recurring = recurR.data || [];
    const recurIds = recurring.map(r => r.id);
    let exceptions = [];
    if (recurIds.length) {
      const { data, error } = await supabase
        .from('recurring_exceptions').select('recurring_id, day')
        .in('recurring_id', recurIds).gte('day', from).lte('day', to);
      if (error) throw error; exceptions = data || [];
    }
    const isExcepted = (rid, dISO) => exceptions.some(e => e.recurring_id === rid && e.day === dISO);

    const planFlag = Object.fromEntries((plansR.data || []).map(p => [p.day, p.include_in_shopping]));

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i), dISO = iso(date), wd = weekdayOf(date);
      const dishesOf = (slot) => (dishesR.data || [])
        .filter(x => x.day === dISO && x.slot === slot)
        .sort((a, b) => a.position - b.position)
        .map(x => ({ id: x.id, recipe_id: x.recipe_id, free_text: x.free_text, title: x.recipes?.title || x.free_text || '', side_recipe_id: x.side_recipe_id, side_text: x.side_text }));

      const puntuales = (eventsR.data || []).filter(e => e.day === dISO)
        .map(e => ({ id: e.id, at_time: e.at_time, title: e.title, color: e.color, recurring: false }));
      const recurrentes = recurring.filter(r => r.weekday === wd && !isExcepted(r.id, dISO))
        .map(r => ({ recurring_id: r.id, at_time: r.at_time, title: r.title, color: r.color, recurring: true }));
      const eventos = [...puntuales, ...recurrentes]
        .sort((a, b) => String(a.at_time || '').localeCompare(String(b.at_time || '')));

      return { date: dISO, include_in_shopping: !!planFlag[dISO], comida: dishesOf('lunch'), cena: dishesOf('dinner'), eventos };
    });
  },

  async setDayShopping(familyId, dayISO, include) {
    const { error } = await supabase.from('plan_days')
      .upsert({ family_id: familyId, day: dayISO, include_in_shopping: include });
    if (error) throw error;
  },

  async addDish(familyId, dayISO, slot, { recipe_id = null, free_text = null, position = 0 }) {
    const { data, error } = await supabase.from('dishes')
      .insert({ family_id: familyId, day: dayISO, slot, recipe_id, free_text, position }).select().single();
    if (error) throw error;
    if (recipe_id) recipes.incrementUse(recipe_id);
    return data;
  },
  async updateDish(dishId, patch) {
    const { data, error } = await supabase.from('dishes').update(patch).eq('id', dishId).select().single();
    if (error) throw error; return data;
  },
  async removeDish(dishId) {
    const { error } = await supabase.from('dishes').delete().eq('id', dishId);
    if (error) throw error;
  },
};

export const events = {
  add(familyId, dayISO, { at_time = null, title, color = null }) {
    return supabase.from('events').insert({ family_id: familyId, day: dayISO, at_time, title, color }).select().single();
  },
  update(eventId, patch) { return supabase.from('events').update(patch).eq('id', eventId).select().single(); },
  remove(eventId) { return supabase.from('events').delete().eq('id', eventId); },

  recurring: {
    list(familyId) { return supabase.from('recurring_events').select('*').eq('family_id', familyId).order('weekday'); },
    add(familyId, { weekday, at_time = null, title, color = null }) {
      return supabase.from('recurring_events').insert({ family_id: familyId, weekday, at_time, title, color }).select().single();
    },
    remove(recurringId) { return supabase.from('recurring_events').delete().eq('id', recurringId); },
    // "Esta semana no": marca excepción para un recurrente en un día concreto
    skipOn(recurringId, dayISO) {
      return supabase.from('recurring_exceptions').upsert({ recurring_id: recurringId, day: dayISO });
    },
    unskipOn(recurringId, dayISO) {
      return supabase.from('recurring_exceptions').delete().eq('recurring_id', recurringId).eq('day', dayISO);
    },
  },
};

// ============================================================
//  LISTA DE LA COMPRA
//  generate() agrega los ingredientes de los platos con receta de los
//  días marcados con 🛒, suma repetidos y aparta los básicos de despensa.
// ============================================================
export const shopping = {
  async generate(familyId, anyDateInWeek = new Date()) {
    const monday = mondayOf(anyDateInWeek), from = iso(monday), to = iso(addDays(monday, 6)), weekStart = from;

    const [{ data: plans }, { data: pantry }, { data: basics }, { data: manual }] = await Promise.all([
      supabase.from('plan_days').select('day').eq('family_id', familyId).eq('include_in_shopping', true).gte('day', from).lte('day', to),
      supabase.from('pantry_items').select('name').eq('family_id', familyId),
      supabase.from('ingredients').select('name').eq('is_basic', true),
      supabase.from('shopping_items').select('*').eq('family_id', familyId).eq('week_start', weekStart),
    ]);
    const days = (plans || []).map(p => p.day);
    const basicSet = new Set([...(pantry || []), ...(basics || [])].map(x => x.name.trim().toLowerCase()));

    const map = new Map();
    if (days.length) {
      const { data: dishes, error } = await supabase
        .from('dishes')
        .select('recipe_id, side_recipe_id')
        .eq('family_id', familyId).in('day', days);
      if (error) throw error;

      // Recetas usadas (principal + guarnición), con repetición por plato
      const used = [];
      for (const d of (dishes || [])) { if (d.recipe_id) used.push(d.recipe_id); if (d.side_recipe_id) used.push(d.side_recipe_id); }

      if (used.length) {
        const ids = [...new Set(used)];
        const { data: ris, error: e2 } = await supabase
          .from('recipe_ingredients')
          .select('recipe_id, name, quantity, unit, ingredient_id')
          .in('recipe_id', ids);
        if (e2) throw e2;

        const byRecipe = new Map();
        for (const ri of (ris || [])) { const arr = byRecipe.get(ri.recipe_id) || []; arr.push(ri); byRecipe.set(ri.recipe_id, arr); }

        for (const rid of used) {
          for (const ing of (byRecipe.get(rid) || [])) {
            const key = (ing.ingredient_id || ing.name.trim().toLowerCase()) + '|' + (ing.unit || '');
            const cur = map.get(key) || { name: ing.name, unit: ing.unit || '', quantity: 0, basic: basicSet.has(ing.name.trim().toLowerCase()) };
            cur.quantity += Number(ing.quantity) || 0;
            map.set(key, cur);
          }
        }
      }
    }
    const all = [...map.values()];
    const manualItems = (manual || []).map(m => ({ id: m.id, name: m.name, quantity: m.quantity, unit: m.unit, manual: true }));
    return { days, weekStart, buy: [...all.filter(x => !x.basic), ...manualItems], pantry: all.filter(x => x.basic) };
  },

  // Productos añadidos a mano (limpieza, pan, servilletas…). Persisten por semana.
  async addManual(familyId, weekStart, name, quantity, unit) {
    const { data, error } = await supabase.from('shopping_items')
      .insert({ family_id: familyId, week_start: weekStart, name, quantity: (quantity ?? null), unit: (unit || null), source: 'manual' })
      .select().single();
    if (error) throw error; return data;
  },
  removeManual(id) { return supabase.from('shopping_items').delete().eq('id', id); },

  // Genera el texto para el enlace de WhatsApp (wa.me)
  whatsappUrl({ days, buy }) {
    const txt = `🛒 Lista de la compra${days.length ? ' · ' + days.join(', ') : ''}\n\n`
      + buy.map(x => `• ${x.name}${x.quantity ? ` — ${x.quantity} ${x.unit}` : ''}`).join('\n');
    return 'https://wa.me/?text=' + encodeURIComponent(txt);
  },
};

// ============================================================
//  DESPENSA (básicos por familia que se excluyen de la compra)
// ============================================================
export const pantry = {
  list(familyId) { return supabase.from('pantry_items').select('*').eq('family_id', familyId).order('name'); },
  add(familyId, name, ingredient_id = null) {
    return supabase.from('pantry_items').upsert({ family_id: familyId, name, ingredient_id });
  },
  remove(itemId) { return supabase.from('pantry_items').delete().eq('id', itemId); },
};
