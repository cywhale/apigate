# apigate 1.7.0 release checklist

本清單描述將 `chore/openapi31-modernization` 合併為新 production baseline 的順序。所有 command 先由 code developer 執行，code reviewer 檢查 diff、測試與 deployment evidence 後才進行 push/merge/tag。

## Release scope

- release version：`1.7.0`（本 repo 使用 pnpm lockfile v6，lockfile 沒有 package importer version；只需更新 `server/package.json`，並確認依賴 lockfile 未被意外改動）。
- Git tag：建議建立 annotated tag `v1.7.0`，但在 merge 到 `main`、production smoke test 與 rollback evidence 完成後再建立/推送。
- OAS document version：目前 `info.version` 是既有 API 文件版本 `1.0.0`；除非 APIverse consumer 明確要求，不因 package release 而改動。
- SQL procedure snapshots：隨 release 版控，但不由 Node startup、CI 或 package install 自動執行。

## Pre-merge

1. 確認工作樹只有預期的 docs/version/changelog/test 變更：

   ```bash
   git status --short
   git diff --check
   git diff --stat
   ```

2. 以 pinned runtime 執行測試：

   ```bash
   cd server
   nvm use 24.20.0
   pnpm install --frozen-lockfile
   pnpm test
   ```

3. 確認結果至少包含：OAS 3.1、`/api/ctd`/`/api/sadcp` identity、response shape、日期/dep_mode、raw/cruise disabled、stream lifecycle、Node 24、PM2/NGINX migration tests。
4. code reviewer 檢查 `server/src/`、`database/stored-procedures/current/`、`server/tests/` 與文件是否一致；任何 SQL table/index 變更另行處理。
5. 在非 production port 做候選 build smoke test；不得使用 NGINX production upstream port 作為測試 listener。

## Version and merge

1. 更新 `server/package.json` version 至 `1.7.0`；不要改 OAS `info.version`，除非已取得 APIverse 確認。
2. 以小而可理解的 commit 完成 docs/version/changelog；先讓 reviewer review，再 push branch。
3. push branch，建立 pull request 到 `main`。merge 前保留 CI/test log 與 reviewer approval。
4. merge 後確認 `main` 的 commit 仍通過完整測試，再建立 annotated tag：

   ```bash
   git tag -a v1.7.0 -m "apigate 1.7.0"
   git push origin main
   git push origin v1.7.0
   ```

若 repository policy 要求 PR merge 後由 remote UI 建 tag，則以該 policy 為準，不在未合併 branch 上先推 tag。

## Production cutover

1. 先確認 Node 24 PM2 service 健康、`/api/json` 回傳 OAS `3.1.0`，再由既有 migration script 修改 NGINX；需要 sudo 的設定只由維運者執行。
2. NGINX migration 先做 `nginx -t`，reload 後以 production HTTPS 做 `/api/json`、CTD、SADCP smoke test；TLS 由 NGINX 終止，Fastify upstream 維持 localhost HTTP。
3. 準備 rollback：保留上一個 upstream port/PM2 process 與 NGINX backup；若 smoke test、錯誤率、latency 或 response shape 不符，立即切回上一個 upstream。
4. SQL procedure 只在 DB owner 已確認、且已有 backup/previous definition、result set 與 execution plan evidence 時另行部署；1.7.0 application deployment 不代表 SQL procedure 自動升版。
5. 上線後記錄：release commit/tag、PM2 process/runtime、upstream port、smoke test URL/結果、SQL procedure snapshot 版本與 rollback location。
