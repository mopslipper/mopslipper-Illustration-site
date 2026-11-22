---
name: publish-illustrations
description: Use when the user reports that new illustration files have been added or asks to add/publish works. Register the works, write Japanese descriptions and tags, validate, and publish to GitHub Pages.
---

# Publishing New Illustrations

When the user says new illustration files have been added to the works folder, treat that report as a request to add them to the portfolio and publish them. Do not wait for a separate “please upload/push” instruction. This standing workflow applies only to new illustration records and their image files, not unrelated changes.

## 1. Find the correct source and repository

- Use the active `mopslipper/mopslipper-Illustration-site` checkout that contains `manager.bat`, `tools/manager/`, `data/works.json`, and `site/`. Its current site implementation is the Astro v2 site.
- If the user gives a different image-folder path, inspect it for the newly added files. It may be an older checkout kept only as the source of image files.
- Compare the source and active checkout’s `git remote`, branch, and `origin/main` before choosing where to edit. Prefer the active checkout aligned with the latest `origin/main`; do not publish from an older checkout just because it contains the source images.
- Copy or upload only the new files relevant to this request. Do not pull in other untracked images from the source folder.
- Check `git status --short` before using the manager. Its publish operation stages the whole repository (`git add -A`); if unrelated changes are present, do not publish them. Keep the requested work isolated or stop and explain the blocker.

## 2. Identify the works and prepare metadata

- List the candidate files in `static/img/works/` (or the supplied source folder), including extensions and variant images. Inspect the actual artwork before writing titles, descriptions, tags, or content flags.
- Check `data/works.json` and the manager’s next ID to avoid duplicate IDs or slugs. Keep each distinct illustration as its own work unless the user says variants belong on one work page.
- Use a numeric slug by default (`153` for work 153). Use a descriptive slug only when the user requests it or an established related-work convention calls for it.
- Write a concise, accurate Japanese title and description, plus useful Japanese tags grounded in visible details. Include `オリジナル` for original works; use the existing category/tag vocabulary where it fits. Do not invent character identities, settings, or other facts not supported by the art or user.
- Use the local current date and `Original` for original works. Do not mark works sensitive, hidden, or R-18 without evidence and policy support. R-18 works must not be added to this site.
- Keep variants on one work only when they clearly belong together or the user requests it. Preserve all requested variants as additional images; apply a multi-image row setting only when requested or clearly required by the established layout for that group.

## 3. Register through the manager

- Use the repository’s manager (`manager.bat`, or its local manager UI/API), not direct ad-hoc edits to `data/works.json`.
- The manager requires Node.js 22.18 or newer. Upload each main image through the manager so it validates the image and generates the JPG thumbnail. Use the returned image and thumbnail paths in the work record.
- Register each work with its ID, slug, title, date, category, image/thumbnail paths, tags, description, and appropriate visibility flags. Do not attach request IDs unless the user explicitly identifies a related request.
- For an existing file collision, inspect whether the file is already used by another work. Never overwrite another work’s image. Ask before replacing a same-work image if the user’s intent is not clear.

## 4. Validate before publishing

- Run the manager’s publish check and resolve every reported problem.
- Run `npm test` and `npm run build` from `site/`.
- Verify that each new work page is generated and references its image and thumbnail. Confirm the repository status contains only this request’s intended data and image files.
- If validation fails, fix the cause and rerun the relevant checks. Do not push a failing or incomplete result.

## 5. Commit, push, and verify deployment

- Publish through the manager’s validated publish action, which commits and pushes the active branch. Use a concise message such as `Add illustration 153: Blue-ribbon girl` or `Add illustrations 153 and 154`.
- Include this commit trailer:

  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

- Confirm the commit is on the remote and the worktree is clean. Check the GitHub Actions deploy workflow for the commit; report test/build/deploy failures explicitly.
- After deployment succeeds, request each generated work page and the image URLs referenced by those pages, and verify they return HTTP 200. Do not say the works are live while deployment is still running or has failed.

## 6. Report

In Japanese, give the work IDs and titles, link to each live work page, include the short commit hash, and summarize test/build/deploy verification. If deployment is still pending, distinguish “pushed” from “live”.

## Example triggers

- “153と154を追加しました。画像は `static/img/works` にあります。”
- “新作を作品フォルダに保存しました。サイトにも追加して。”
- “155の派生画像も同じ作品ページに載せて公開して。”
