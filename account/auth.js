// 教科書連動アプリ共通のログイン処理（Firebase Authentication + Firestore）
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

export const enabled = Boolean(firebaseConfig);

let ctx = null;

export async function firebase() {
  if (ctx) return ctx;
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  ctx = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), authMod, fsMod };
  return ctx;
}

// 認証状態が確定するまで待つ（リダイレクトでログインした直後の結果も反映する）
export async function currentUser() {
  const { auth, authMod } = await firebase();
  try { await authMod.getRedirectResult(auth); } catch (e) { console.warn("[login]", e); }
  await auth.authStateReady();
  return auth.currentUser;
}

const cacheKey = (uid) => `bhy-profile:${uid}`;

// 氏名・所属の登録が済んでいるか
export async function hasProfile(user) {
  try {
    if (localStorage.getItem(cacheKey(user.uid)) === "1") return true;
  } catch {}
  const profile = await getProfile(user);
  const ok = Boolean(profile && profile.name && profile.affiliation);
  if (ok) {
    try { localStorage.setItem(cacheKey(user.uid), "1"); } catch {}
  }
  return ok;
}

export async function getProfile(user) {
  const { db, fsMod } = await firebase();
  const snap = await fsMod.getDoc(fsMod.doc(db, "users", user.uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(user, { name, affiliation }) {
  const { db, fsMod } = await firebase();
  const ref = fsMod.doc(db, "users", user.uid);
  const exists = (await fsMod.getDoc(ref)).exists();
  const data = {
    email: user.email,
    name,
    affiliation,
    updatedAt: fsMod.serverTimestamp(),
  };
  if (!exists) data.createdAt = fsMod.serverTimestamp();
  await fsMod.setDoc(ref, data, { merge: true });
  try { localStorage.setItem(cacheKey(user.uid), "1"); } catch {}
}

export async function signInWithGoogle() {
  const { auth, authMod } = await firebase();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return (await authMod.signInWithPopup(auth, provider)).user;
  } catch (e) {
    // ポップアップがブロックされた端末ではリダイレクトで再試行
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
      await authMod.signInWithRedirect(auth, provider);
      return null;
    }
    throw e;
  }
}

export async function signOut() {
  const { auth, authMod } = await firebase();
  const uid = auth.currentUser && auth.currentUser.uid;
  await authMod.signOut(auth);
  if (uid) { try { localStorage.removeItem(cacheKey(uid)); } catch {} }
}

export const loginUrl = (next) => {
  const u = new URL("login.html", import.meta.url);
  if (next) u.searchParams.set("next", next);
  return u.href;
};
