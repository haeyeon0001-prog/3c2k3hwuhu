// 各ページの <head> で読み込む。未ログイン・未登録ならログイン画面へ移動する。
//   <style id="bhy-gate">html{visibility:hidden}</style>
//   <script type="module" src="account/gate.js"></script>
import { enabled, currentUser, hasProfile, loginUrl } from "./auth.js";

const reveal = () => document.getElementById("bhy-gate")?.remove();

async function main() {
  if (!enabled) return reveal();
  const user = await currentUser();
  if (user && (await hasProfile(user))) return reveal();
  location.replace(loginUrl(location.href));
}

main().catch((e) => {
  console.error("[login]", e);
  reveal();
  document.body.innerHTML =
    '<p style="font-family:sans-serif;padding:32px 20px;line-height:1.8">' +
    "ログイン状態を確認できませんでした。通信状況を確認して、ページを再読み込みしてください。</p>";
});
