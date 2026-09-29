#!/usr/bin/env bash
# بررسی کامپایل KBApi.ashx با قواعد C# 5 (کامپایلر ASP.NET روی SharePoint 2019) — نیاز: mono (mcs)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d)"
# حذف دستورهای <%@ ... %> ابتدای فایل و BOM
sed -e '1s/^\xEF\xBB\xBF//' -e '/^<%@/d' "$DIR/../../sharepoint/layouts/KB/KBApi.ashx" > "$OUT/KBApi.cs"
mcs -langversion:5 -target:library -nowarn:0168,0219 -warnaserror- \
  -r:System.Web.dll -r:System.Web.Extensions.dll -r:System.Core.dll \
  -out:"$OUT/kb.dll" "$DIR/SharePointStubs.cs" "$OUT/KBApi.cs"
echo "✔ KBApi.ashx compiles (C# 5)"
