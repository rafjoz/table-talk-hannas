/* Table Talk: sign-up, approval and team access.
   Loaded by index.html (its <script> tag sits just before the main script).
   Uses these from index.html: sb, byId, esc, toast, fmtDate, showStaffState, staffLogout, loadSubmissions.
   The titles below must match the list in the database (handle_new_user in the Step 1 SQL). */

const AUTH_TITLES = ['Owner', 'Manager', 'Chef', 'Server', 'Bartender', 'Host', 'Other'];
let myUserId = null;
let team = [];
let deciding = false;

/* ---------- build the extra screens (runs once, as the page loads) ---------- */
function injectAuthUi(){
  const $ = id => document.getElementById(id);
  const loginForm = $('login-form');
  if(!loginForm || $('signup-form')) return;
  const inputCls = 'w-full bg-surface-container rounded-2xl px-sm py-3 text-body-md outline-none focus:ring-2 focus:ring-primary';

  // Give the page heading an id and add a message box under it
  const heading = document.querySelector('#staff-login h1');
  if(heading){
    heading.id = 'auth-title';
    heading.insertAdjacentHTML('afterend',
      '<p id="auth-notice" class="hidden w-full bg-tertiary-fixed text-on-surface rounded-2xl p-sm mb-sm text-body-md"></p>');
  }

  // "Request access" link + sign-up form, right under the sign-in form
  const options = AUTH_TITLES.map(t => '<option value="' + t + '">' + t + '</option>').join('');
  loginForm.insertAdjacentHTML('afterend', `
    <button id="to-signup" type="button" onclick="showAuthMode('signup')" class="mt-md text-label-md text-primary hover:underline">New here? Request access</button>
    <form id="signup-form" class="hidden w-full bg-surface-container-lowest rounded-3xl p-md ambient-shadow flex flex-col gap-sm" onsubmit="staffSignUp(event)">
      <p class="text-label-sm text-on-surface-variant">Your request goes to the owner or manager. You get access once they approve it.</p>
      <label for="signup-name" class="text-label-md text-on-surface">Your name</label>
      <input id="signup-name" type="text" required maxlength="100" autocomplete="name" class="${inputCls}">
      <label for="signup-title" class="text-label-md text-on-surface">Your title</label>
      <select id="signup-title" required class="${inputCls}"><option value="">Select your title</option>${options}</select>
      <label for="signup-email" class="text-label-md text-on-surface">Email</label>
      <input id="signup-email" type="email" required maxlength="200" autocomplete="email" class="${inputCls}">
      <label for="signup-password" class="text-label-md text-on-surface">Password (at least 8 characters)</label>
      <input id="signup-password" type="password" required minlength="8" autocomplete="new-password" class="${inputCls}">
      <p id="signup-error" class="text-label-sm text-error hidden"></p>
      <button id="signup-btn" type="submit" class="mt-xs w-full bg-primary text-on-primary text-label-md py-4 rounded-full shadow-lg hover:bg-primary-container transition-colors">Request access</button>
      <button type="button" onclick="showAuthMode('login')" class="text-label-md text-secondary hover:text-on-surface">Back to sign in</button>
    </form>`);

  // "Waiting for approval / not approved" screen
  const loginSection = $('staff-login');
  if(loginSection) loginSection.insertAdjacentHTML('afterend', `
    <section id="staff-pending" class="hidden min-h-screen flex flex-col items-center justify-center px-container-margin py-xl w-full max-w-[440px] mx-auto text-center">
      <div class="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mb-sm ambient-shadow">
        <img src="logo.png" alt="Hanna's on Main logo" class="w-full h-full object-cover">
      </div>
      <span class="text-label-sm text-primary tracking-[0.15em] uppercase mb-1">Table Talk · Hanna's on Main</span>
      <h1 id="pending-title" class="text-headline-md text-on-surface mb-xs"></h1>
      <p id="pending-text" class="text-body-md text-on-surface-variant mb-md"></p>
      <div class="flex gap-xs">
        <button type="button" onclick="showStaffState()" class="px-5 py-3 rounded-full bg-primary text-on-primary text-label-md">Check again</button>
        <button type="button" onclick="staffLogout()" class="px-5 py-3 rounded-full bg-surface-container text-on-surface text-label-md">Sign out</button>
      </div>
    </section>`);

  // Admin-only "Team access" panel, above the feedback
  const notStaff = $('staff-notstaff');
  if(notStaff) notStaff.insertAdjacentHTML('afterend', `
    <section id="team-panel" class="hidden bg-surface-container-lowest rounded-3xl p-md ambient-shadow mb-md">
      <div class="flex items-center justify-between gap-sm mb-xs">
        <h2 class="text-headline-md text-on-surface">Team access <span id="team-badge" class="hidden align-middle ml-1 px-3 py-1 rounded-full text-label-sm type-pill-issue"></span></h2>
        <button id="team-refresh" type="button" onclick="loadTeam()" class="px-4 py-2 rounded-full bg-surface-container text-label-md text-on-surface hover:bg-surface-container-high transition-colors">Refresh</button>
      </div>
      <p class="text-label-sm text-on-surface-variant mb-sm">New sign-ups wait here until you approve them. A title is only what the person picked at sign-up; it doesn't give extra permissions.</p>
      <div id="team-list" class="flex flex-col gap-xs"></div>
    </section>`);

  // "Signed in as" label next to Sign out
  const signOut = document.querySelector('#staff-dashboard button[onclick="staffLogout()"]');
  if(signOut) signOut.insertAdjacentHTML('beforebegin',
    '<span id="staff-who" class="hidden sm:inline text-label-sm text-on-surface-variant mr-1"></span>');
}

/* ---------- sign in / sign up switch ---------- */
function setAuthNotice(msg){
  const n = byId('auth-notice');
  if(!n) return;
  n.textContent = msg || '';
  n.classList.toggle('hidden', !msg);
}
function showAuthMode(mode){
  const signup = mode === 'signup';
  byId('login-form').classList.toggle('hidden', signup);
  byId('to-signup').classList.toggle('hidden', signup);
  byId('signup-form').classList.toggle('hidden', !signup);
  byId('auth-title').textContent = signup ? 'Request access' : 'Sign in';
  byId('signup-error').classList.add('hidden');
  byId('login-error').classList.add('hidden');
  setAuthNotice('');
}

/* ---------- sign up ---------- */
async function staffSignUp(e){
  e.preventDefault();
  const btn = byId('signup-btn'), err = byId('signup-error');
  err.classList.add('hidden');
  const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
  const name = byId('signup-name').value.trim();
  const title = byId('signup-title').value;
  const email = byId('signup-email').value.trim();
  const password = byId('signup-password').value;
  if(!sb) return fail("Can't reach the server right now. Check your connection.");
  if(!name) return fail("Please enter your name.");
  if(!AUTH_TITLES.includes(title)) return fail("Please pick your title.");
  if(!/^\S+@\S+\.\S+$/.test(email)) return fail("That email doesn't look right.");
  if(password.length < 8) return fail("Use a password with at least 8 characters.");

  btn.disabled = true; btn.textContent = "Sending…";
  let res;
  try {
    res = await sb.auth.signUp({
      email, password,
      options: {
        data: { full_name: name.slice(0, 100), title },
        emailRedirectTo: location.origin + location.pathname + '#login'
      }
    });
  } catch(ex){ res = { error: ex }; }
  btn.disabled = false; btn.textContent = "Request access";

  const { data, error } = res;
  if(error){
    console.error("Sign-up failed:", error);
    const msg = (error.message || "");
    if(/registered|already/i.test(msg)) return fail("That email already has an account. Try signing in.");
    if(error.status === 429 || /rate limit/i.test(msg)) return fail("Too many sign-up emails right now. Please try again in a little while.");
    return fail("Sign-up didn't go through. Please try again.");
  }
  // When an account already exists, Supabase answers with a user that has no identities
  if(data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
    return fail("That email already has an account. Try signing in.");
  }
  byId('signup-password').value = '';
  showAuthMode('login');
  if(data && data.session){
    showStaffState();     // signed in right away: goes to the waiting-for-approval screen
    return;
  }
  setAuthNotice("Request sent. Check your email to confirm your address, then sign in here. You'll get access once the owner or manager approves you.");
}

/* ---------- after sign-in: waiting screen or dashboard ---------- */
async function enterStaffArea(session){
  myUserId = session.user.id;
  let me = null, failed = false;
  try {
    const res = await sb.from('profiles')
      .select('full_name, title, status, is_admin')
      .eq('user_id', myUserId)
      .maybeSingle();
    me = res.data; failed = !!res.error;
  } catch(ex){ failed = true; }
  if(failed){ showPending('error', null); return; }
  if(!me){ showPending('missing', null); return; }
  if(me.status !== 'approved'){ showPending(me.status, me); return; }

  byId('staff-pending').classList.add('hidden');
  byId('staff-dashboard').classList.remove('hidden');
  const who = byId('staff-who');
  if(who) who.textContent = [me.full_name, me.title].filter(Boolean).join(' · ');
  byId('team-panel').classList.toggle('hidden', !me.is_admin);
  loadSubmissions();
  if(me.is_admin) loadTeam();
}
function showPending(kind, me){
  byId('staff-dashboard').classList.add('hidden');
  byId('staff-pending').classList.remove('hidden');
  const first = me && me.full_name ? me.full_name.trim().split(' ')[0] : '';
  const copy = {
    pending:  ["Waiting for approval", (first ? "Thanks, " + first + ". " : "") + "Your request is in. The owner or manager has to approve it before you can see anything. Tap Check again once they have."],
    rejected: ["Access not approved", "This account wasn't approved for the Table Talk dashboard. If that's a mistake, ask the owner or manager."],
    missing:  ["Account not ready", "We couldn't find a request for this account. Ask the person who manages Table Talk for help."],
    error:    ["Couldn't check your account", "Something went wrong reaching the server. Tap Check again."]
  };
  const c = copy[kind] || copy.error;
  byId('pending-title').textContent = c[0];
  byId('pending-text').textContent = c[1];
}

/* ---------- admins: approve / reject ---------- */
async function loadTeam(){
  const btn = byId('team-refresh');
  btn.disabled = true; btn.textContent = "Loading…";
  const { data, error } = await sb.from('profiles')
    .select('user_id, email, full_name, title, status, is_admin, created_at')
    .order('created_at', { ascending: false });
  btn.disabled = false; btn.textContent = "Refresh";
  if(error){ toast("Couldn't load the team list. Tap Refresh to try again."); return; }
  team = data || [];
  renderTeam();
}
function renderTeam(){
  const order = { pending: 0, approved: 1, rejected: 2 };
  const rows = team.slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const waiting = team.filter(p => p.status === 'pending').length;
  const badge = byId('team-badge');
  badge.textContent = waiting ? waiting + ' waiting' : '';
  badge.classList.toggle('hidden', !waiting);
  byId('team-list').innerHTML = rows.length
    ? rows.map(teamRowHtml).join('')
    : '<p class="text-body-md text-on-surface-variant">No one has signed up yet.</p>';
}
function teamRowHtml(p){
  const id = esc(p.user_id);
  const isMe = p.user_id === myUserId;
  const pill = { pending: 'type-pill-rating', approved: 'type-pill-compliment', rejected: 'type-pill-issue' }[p.status] || 'type-pill-suggestion';
  const primaryBtn = 'px-4 py-2 rounded-full bg-primary text-on-primary text-label-md';
  const quietBtn = 'px-4 py-2 rounded-full bg-surface-container text-on-surface text-label-md';
  let actions;
  if(isMe) actions = '<span class="text-label-sm text-on-surface-variant">You</span>';
  else if(p.status === 'pending') actions =
    `<button type="button" onclick="decideAccess('${id}','approved')" class="${primaryBtn}">Approve</button>` +
    `<button type="button" onclick="decideAccess('${id}','rejected')" class="${quietBtn}">Reject</button>`;
  else if(p.status === 'approved') actions =
    `<button type="button" onclick="decideAccess('${id}','rejected')" class="${quietBtn}">Remove access</button>`;
  else actions = `<button type="button" onclick="decideAccess('${id}','approved')" class="${primaryBtn}">Approve</button>`;
  return `
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-xs rounded-2xl bg-surface-container-low p-sm">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-1">
        <span class="text-label-md text-on-surface break-words">${esc(p.full_name || '(no name)')}</span>
        <span class="px-2 py-0.5 rounded-full bg-surface-container text-label-sm text-on-surface-variant">${esc(p.title)}</span>
        <span class="px-2 py-0.5 rounded-full text-label-sm ${pill}">${esc(p.status)}</span>
        ${p.is_admin ? '<span class="px-2 py-0.5 rounded-full text-label-sm type-pill-suggestion">Admin</span>' : ''}
      </div>
      <div class="text-label-sm text-on-surface-variant break-all">${esc(p.email || '')} · ${esc(fmtDate(p.created_at))}</div>
    </div>
    <div class="flex gap-xs">${actions}</div>
  </div>`;
}
async function decideAccess(id, status){
  const p = team.find(x => x.user_id === id);
  if(!p || deciding) return;
  if(status === 'rejected' && p.status === 'approved' && !confirm("Remove access for " + (p.full_name || p.email || "this person") + "?")) return;
  const wasApproved = p.status === 'approved';
  deciding = true;
  const { data, error } = await sb.from('profiles')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('user_id', id)
    .select('user_id');   // confirms a row was really changed (a blocked update would otherwise look like success)
  deciding = false;
  if(error || !data || !data.length){
    console.error("Access change failed:", error);
    toast("Couldn't update that. Please try again.");
    return;
  }
  p.status = status;
  toast(status === 'approved' ? "Approved." : (wasApproved ? "Access removed." : "Rejected."));
  renderTeam();
}

injectAuthUi();
