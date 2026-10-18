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
    '<button id="profile-btn" type="button" onclick="openProfile()" title="My profile" aria-label="My profile" class="flex items-center gap-2 px-1 py-1 mr-1 rounded-full hover:bg-surface-container transition-colors"><span id="staff-avatar" class="w-8 h-8 rounded-full bg-primary-fixed text-primary text-label-sm flex items-center justify-center overflow-hidden shrink-0"></span><span id="staff-who" class="hidden sm:inline text-label-sm text-on-surface-variant pr-2"></span></button>');
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
  byId('login-error').classList.add('hidden'); ['forgot-form','recover-form'].forEach(function(x){ const f = byId(x); if(f) f.classList.add('hidden'); });
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
      .select('full_name, title, status, is_admin, avatar')
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
  myProfile = me; myProfile.email = session.user.email; paintHeaderAvatar(); byId('team-panel').classList.toggle('hidden', !me.is_admin); document.querySelectorAll('[data-admin-only]').forEach(function(el){ el.classList.toggle('hidden', !me.is_admin); });
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

let myProfile = null; let pendingAvatar = null; const AVATAR_PREFIX = 'data:image/jpeg;base64,'; function initialsOf(name){ const parts = String(name || '').trim().split(' ').filter(Boolean); if(!parts.length) return '?'; const first = Array.from(parts[0])[0]; const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : ''; return (first + last).toUpperCase(); } function avatarInner(p){ const v = (p && typeof p.avatar === 'string') ? p.avatar : ''; if(v.indexOf(AVATAR_PREFIX) === 0 && v.length > AVATAR_PREFIX.length && !/[^A-Za-z0-9+/=]/.test(v.slice(AVATAR_PREFIX.length))){ return '<img src="' + esc(v) + '" alt="" class="w-full h-full object-cover">'; } return esc(initialsOf(p && p.full_name)); } function paintHeaderAvatar(){ const a = document.getElementById('staff-avatar'); if(a) a.innerHTML = avatarInner(myProfile); } function authMsg(id, text, bad){ const m = document.getElementById(id); if(!m) return; m.textContent = text || ''; m.classList.toggle('hidden', !text); m.classList.toggle('text-error', !!bad); m.classList.toggle('text-tertiary', !bad); } function paintProfilePhoto(){ const nameBox = document.getElementById('profile-name'); const shown = { full_name: (nameBox && nameBox.value.trim()) || myProfile.full_name, avatar: pendingAvatar === null ? myProfile.avatar : (pendingAvatar || null) }; document.getElementById('profile-photo').innerHTML = avatarInner(shown); } function ensureProfileModal(){ if(document.getElementById('profile-modal')) return; const inputCls = 'w-full bg-surface-container rounded-2xl px-sm py-3 text-body-md outline-none focus:ring-2 focus:ring-primary'; document.body.insertAdjacentHTML('beforeend', '<div id="profile-modal" class="hidden fixed inset-0 z-[90] bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onclick="if(event.target===this)closeProfile()"><div class="bg-surface-container-lowest rounded-3xl p-md ambient-shadow w-full max-w-[440px] my-auto"><div class="flex items-center justify-between mb-sm"><h2 class="text-headline-md text-on-surface">My profile</h2><button type="button" onclick="closeProfile()" class="px-3 py-1 rounded-full text-label-md text-on-surface-variant hover:bg-surface-container">Close</button></div><div class="flex items-center gap-md mb-sm"><div id="profile-photo" class="w-24 h-24 rounded-full bg-primary-fixed text-primary text-headline-md flex items-center justify-center overflow-hidden shrink-0"></div><div class="flex flex-col gap-xs"><label class="px-4 py-2 rounded-full bg-surface-container text-label-md text-on-surface hover:bg-surface-container-high cursor-pointer text-center">Choose photo<input id="profile-file" type="file" accept="image/*" class="hidden" onchange="pickPhoto(this)"></label><button type="button" onclick="removePhoto()" class="px-4 py-2 rounded-full text-label-md text-on-surface-variant hover:bg-surface-container">Remove photo</button></div></div><label for="profile-name" class="text-label-md text-on-surface">Your name</label><input id="profile-name" type="text" maxlength="100" autocomplete="name" oninput="paintProfilePhoto()" class="' + inputCls + ' mb-xs"><p id="profile-info" class="text-label-sm text-on-surface-variant mb-sm break-all"></p><button id="profile-save" type="button" onclick="saveProfile()" class="w-full bg-primary text-on-primary text-label-md py-3 rounded-full shadow-lg hover:bg-primary-container transition-colors">Save profile</button><hr class="border-surface-variant my-md"><h3 class="text-label-md text-on-surface mb-xs">Change password</h3><form id="pw-form" onsubmit="changePassword(event)" class="flex flex-col gap-sm"><input id="pw-new" type="password" minlength="8" autocomplete="new-password" placeholder="New password (at least 8 characters)" class="' + inputCls + '"><input id="pw-confirm" type="password" minlength="8" autocomplete="new-password" placeholder="Type it again" class="' + inputCls + '"><button id="pw-btn" type="submit" class="w-full bg-surface-container text-on-surface text-label-md py-3 rounded-full hover:bg-surface-container-high transition-colors">Change password</button></form><p id="profile-msg" class="hidden text-label-sm mt-sm"></p></div></div>'); } function openProfile(){ if(!myProfile) return; ensureProfileModal(); pendingAvatar = null; byId('profile-name').value = myProfile.full_name || ''; byId('profile-info').textContent = [myProfile.title, myProfile.email].filter(Boolean).join(' / '); byId('pw-new').value = ''; byId('pw-confirm').value = ''; authMsg('profile-msg', ''); paintProfilePhoto(); byId('profile-modal').classList.remove('hidden'); } function closeProfile(){ const m = document.getElementById('profile-modal'); if(m) m.classList.add('hidden'); } function pickPhoto(input){ const file = input.files && input.files[0]; input.value = ''; if(!file) return; if(file.size > 15 * 1024 * 1024){ authMsg('profile-msg', 'That photo is too large. Pick one under 15 MB.', true); return; } const url = URL.createObjectURL(file); const img = new Image(); img.onload = function(){ try { const size = 160; const c = document.createElement('canvas'); c.width = size; c.height = size; const side = Math.min(img.naturalWidth, img.naturalHeight); const sx = (img.naturalWidth - side) / 2; const sy = (img.naturalHeight - side) / 2; const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size); ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size); const data = c.toDataURL('image/jpeg', 0.82); if(data.indexOf(AVATAR_PREFIX) !== 0 || data.length > 50000) throw new Error('bad photo'); pendingAvatar = data; paintProfilePhoto(); authMsg('profile-msg', 'Photo ready. Tap Save profile to keep it.'); } catch(ex){ console.error('Photo failed:', ex); authMsg('profile-msg', "Couldn't use that photo. Try a JPG or PNG.", true); } URL.revokeObjectURL(url); }; img.onerror = function(){ URL.revokeObjectURL(url); authMsg('profile-msg', "Couldn't read that photo. Try a JPG or PNG.", true); }; img.src = url; } function removePhoto(){ pendingAvatar = ''; paintProfilePhoto(); authMsg('profile-msg', 'The photo will be removed when you tap Save profile.'); } async function saveProfile(){ const name = byId('profile-name').value.trim().slice(0, 100); if(!name){ authMsg('profile-msg', 'Please enter your name.', true); return; } const btn = byId('profile-save'); btn.disabled = true; btn.textContent = 'Saving...'; let res; try { res = await sb.rpc('update_my_profile', { p_name: name, p_avatar: pendingAvatar }); } catch(ex){ res = { error: ex }; } btn.disabled = false; btn.textContent = 'Save profile'; if(res.error){ console.error('Profile save failed:', res.error); authMsg('profile-msg', "Couldn't save your profile. Please try again.", true); return; } myProfile.full_name = name; if(pendingAvatar !== null) myProfile.avatar = pendingAvatar === '' ? null : pendingAvatar; pendingAvatar = null; const who = byId('staff-who'); if(who) who.textContent = [myProfile.full_name, myProfile.title].filter(Boolean).join(' / '); paintHeaderAvatar(); paintProfilePhoto(); authMsg('profile-msg', 'Profile saved.'); if(myProfile.is_admin) loadTeam(); } async function changePassword(e){ e.preventDefault(); const a = byId('pw-new').value; const b = byId('pw-confirm').value; if(a.length < 8){ authMsg('profile-msg', 'Use a password with at least 8 characters.', true); return; } if(a !== b){ authMsg('profile-msg', "The two passwords don't match.", true); return; } const btn = byId('pw-btn'); btn.disabled = true; btn.textContent = 'Changing...'; let res; try { res = await sb.auth.updateUser({ password: a }); } catch(ex){ res = { error: ex }; } btn.disabled = false; btn.textContent = 'Change password'; if(res.error){ console.error('Password change failed:', res.error); authMsg('profile-msg', /different|same/i.test(res.error.message || '') ? 'Pick a password you have not used before.' : "Couldn't change the password. Try signing out and back in, then try again.", true); return; } byId('pw-new').value = ''; byId('pw-confirm').value = ''; authMsg('profile-msg', 'Password changed.'); } function injectRecoveryUi(){ const loginForm = document.getElementById('login-form'); if(!loginForm || document.getElementById('forgot-form')) return; const inputCls = 'w-full bg-surface-container rounded-2xl px-sm py-3 text-body-md outline-none focus:ring-2 focus:ring-primary'; const btnCls = 'mt-xs w-full bg-primary text-on-primary text-label-md py-4 rounded-full shadow-lg hover:bg-primary-container transition-colors'; const boxCls = 'hidden w-full bg-surface-container-lowest rounded-3xl p-md ambient-shadow flex flex-col gap-sm'; loginForm.insertAdjacentHTML('beforeend', '<button type="button" onclick="showForgot()" class="text-label-md text-secondary hover:text-on-surface">Forgot password?</button>'); loginForm.insertAdjacentHTML('afterend', '<form id="forgot-form" class="' + boxCls + '" onsubmit="sendReset(event)"><p class="text-label-sm text-on-surface-variant">Enter the email you signed up with. We will email you a link to choose a new password.</p><label for="forgot-email" class="text-label-md text-on-surface">Email</label><input id="forgot-email" type="email" required maxlength="200" autocomplete="email" class="' + inputCls + '"><p id="forgot-msg" class="hidden text-label-sm"></p><button id="forgot-btn" type="submit" class="' + btnCls + '">Send reset link</button><button type="button" onclick="backToLogin()" class="text-label-md text-secondary hover:text-on-surface">Back to sign in</button></form><form id="recover-form" class="' + boxCls + '" onsubmit="saveRecovery(event)"><p class="text-label-sm text-on-surface-variant">Choose a new password for your account.</p><label for="rec-new" class="text-label-md text-on-surface">New password (at least 8 characters)</label><input id="rec-new" type="password" required minlength="8" autocomplete="new-password" class="' + inputCls + '"><label for="rec-confirm" class="text-label-md text-on-surface">Type it again</label><input id="rec-confirm" type="password" required minlength="8" autocomplete="new-password" class="' + inputCls + '"><p id="rec-msg" class="hidden text-label-sm"></p><button id="rec-btn" type="submit" class="' + btnCls + '">Save new password</button></form>'); } function backToLogin(){ showAuthMode('login'); } function showForgot(){ showAuthMode('login'); byId('login-form').classList.add('hidden'); byId('to-signup').classList.add('hidden'); byId('forgot-form').classList.remove('hidden'); byId('auth-title').textContent = 'Reset password'; byId('forgot-email').value = byId('login-email').value.trim(); authMsg('forgot-msg', ''); } async function sendReset(e){ e.preventDefault(); const email = byId('forgot-email').value.trim(); const btn = byId('forgot-btn'); if(!sb){ authMsg('forgot-msg', "Can't reach the server right now. Check your connection.", true); return; } if(email.indexOf('@') < 1){ authMsg('forgot-msg', "That email doesn't look right.", true); return; } btn.disabled = true; btn.textContent = 'Sending...'; let res; try { res = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); } catch(ex){ res = { error: ex }; } btn.disabled = false; btn.textContent = 'Send reset link'; if(res.error){ console.error('Reset request failed:', res.error); if(res.error.status === 429 || /rate limit/i.test(res.error.message || '')){ authMsg('forgot-msg', 'Too many emails right now. Please try again in a little while.', true); return; } authMsg('forgot-msg', "That didn't go through. Please try again.", true); return; } authMsg('forgot-msg', 'If that email has an account, a reset link is on its way. Check your spam folder too. The link only works for a limited time.'); } function showRecoverForm(){ byId('staff-dashboard').classList.add('hidden'); byId('staff-pending').classList.add('hidden'); byId('staff-login').classList.remove('hidden'); byId('login-form').classList.add('hidden'); byId('to-signup').classList.add('hidden'); byId('signup-form').classList.add('hidden'); byId('forgot-form').classList.add('hidden'); byId('recover-form').classList.remove('hidden'); byId('auth-title').textContent = 'Choose a new password'; setAuthNotice(''); } function startRecovery(){ window.__recovering = true; if(location.hash !== '#staff') location.hash = '#staff'; showRecoverForm(); } async function saveRecovery(e){ e.preventDefault(); const a = byId('rec-new').value; const b = byId('rec-confirm').value; const btn = byId('rec-btn'); if(a.length < 8){ authMsg('rec-msg', 'Use a password with at least 8 characters.', true); return; } if(a !== b){ authMsg('rec-msg', "The two passwords don't match.", true); return; } btn.disabled = true; btn.textContent = 'Saving...'; let res; try { res = await sb.auth.updateUser({ password: a }); } catch(ex){ res = { error: ex }; } btn.disabled = false; btn.textContent = 'Save new password'; if(res.error){ console.error('Recovery failed:', res.error); authMsg('rec-msg', /different|same/i.test(res.error.message || '') ? 'Pick a password you have not used before.' : "Couldn't save the new password. The link may have expired. Request a new one.", true); return; } window.__recovering = false; byId('rec-new').value = ''; byId('rec-confirm').value = ''; authMsg('rec-msg', ''); showAuthMode('login'); toast('Password changed. You are signed in.'); showStaffState(); } injectRecoveryUi(); injectAuthUi();
