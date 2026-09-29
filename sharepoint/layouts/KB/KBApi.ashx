<%@ WebHandler Language="C#" Class="Shastan.KB.KBApiHandler" %>
<%@ Assembly Name="Microsoft.SharePoint, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>
<%@ Assembly Name="System.Core, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" %>
// =====================================================================================================
//  پایگاه دانش شستان — سرویس سمت سرور (SharePoint Server 2019)
//  محل استقرار: 16\TEMPLATE\LAYOUTS\KB\KBApi.ashx   →   http://<site>/_layouts/15/KB/KBApi.ashx
//
//  چرا هندلر سمت سرور؟
//   - لیست KnowledgeContent هیچ مجوزی برای کاربر ناشناس و کاربران عادی ندارد؛ بنابراین محتوای «خصوصی»،
//     پیش‌نویس‌ها و پیوست‌ها حتی با فراخوانی مستقیم REST هم قابل خواندن نیستند.
//   - این هندلر فقط محتوای «منتشرشده» را برمی‌گرداند: محتوای «عمومی» برای همه و «خصوصی» فقط برای کاربر واردشده.
//   - بازدید، پسند، ذخیره و نظر با هویت واقعی کاربر (نه مقدار ارسالی مرورگر) و با دسترسی سیستمی ثبت می‌شود.
//   - عملیات مدیریتی (ذخیره، انتشار، حذف) با «هویت و مجوز خود کاربر» انجام می‌شود؛ شیرپوینت مجوز را اعمال می‌کند.
//
//  با کامپایلر C# 5 (ASP.NET 4.x) سازگار است؛ از قابلیت‌های جدیدتر زبان استفاده نکنید.
// =====================================================================================================
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Script.Serialization;
using Microsoft.SharePoint;
using Microsoft.SharePoint.Administration;
using Microsoft.SharePoint.Utilities;

namespace Shastan.KB
{
    public class KBApiHandler : IHttpHandler
    {
        private const string Version = "1.0.0";
        private const string SettingsListTitle = "KBSettings";
        private const string CategoriesListTitle = "KBCategories";
        private const string CommentsListTitle = "KBComments";
        private const string ReactionsListTitle = "KBReactions";
        private const string AuditListTitle = "KBAuditLog";
        private const int IndexSeconds = 60;
        private const int ConfigSeconds = 120;

        private static readonly string[] PublicSettingKeys = { "SiteTitle", "SiteSubtitle", "HeroTitle", "HeroText", "FooterText", "Copyright", "CommentsEnabled", "CommentModeration" };
        private static readonly string[] EditableSettingKeys = { "SiteTitle", "SiteSubtitle", "HeroTitle", "HeroText", "FooterText", "Copyright", "CommentsEnabled", "CommentModeration", "NotifyEmails", "DefaultVisibility" };
        private static readonly string[] LogicalFields = { "Title", "Summary", "Body", "ThumbnailUrl", "ContentType", "Category", "Views", "ReadingMinutes", "IsFeatured", "AuthorName", "AuthorBio", "AuthorImageUrl", "PublishAt", "Visibility", "Status", "Tags", "MediaUrl", "LikesCount", "CommentsCount", "AllowComments" };
        private static readonly string[] DefaultTypes = { "مقاله", "ویدیو", "پادکست", "راهنما و آموزش", "گزارش", "گزارش تصویری", "سند و فایل", "خبر", "اینفوگرافیک", "پرسش و پاسخ" };
        private static readonly object Sync = new object();

        public bool IsReusable { get { return false; } }

        // ------------------------------------------------------------------ وضعیت درخواست
        private HttpContext ctx;
        private HttpRequest req;
        private Guid siteId;
        private Guid webId;
        private SPUrlZone zone;
        private SPUser user;
        private string userKey;
        private string role;
        private Config cfg;
        private Dictionary<string, object> body;
        private SPTimeZone tz;

        private class ApiException : Exception
        {
            public int Status;
            public string Code;
            public ApiException(int status, string message) : base(message) { Status = status; }
            public ApiException(int status, string message, string code) : base(message) { Status = status; Code = code; }
        }

        private class Config
        {
            public Dictionary<string, string> Settings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, Guid> Ids = new Dictionary<string, Guid>();
            public Dictionary<string, string> Names = new Dictionary<string, string>();
            public Dictionary<string, string> Types = new Dictionary<string, string>();
            public List<string> TypeChoices = new List<string>();
            public List<string> CategoryChoices = new List<string>();
            public string ContentList;
            public string ContentListUrl;
            public string MediaLibrary;
            public string MediaUrl;
            public string MediaTitle;
            public long MaxUploadMb;
        }

        private class Entry
        {
            public int Id;
            public string Title = "", Summary = "", Body = "", Thumb = "", Media = "", Type = "", Category = "";
            public List<string> Tags = new List<string>();
            public double Views, Likes, Comments, Minutes;
            public bool Featured, AllowComments = true, IsPublic, HasAttachments;
            public string Status = "Draft";
            public DateTime? PublishAt;
            public DateTime Created, Modified;
            public string AuthorName = "", AuthorBio = "", AuthorImage = "", CreatedBy = "", Editor = "";
            public string SearchTitle = "", SearchTags = "", SearchSummary = "", SearchBody = "", SearchOther = "";
        }

        private class CatRow
        {
            public int Id;
            public string Title = "", Icon = "folder", Color = "#008000", Description = "";
            public double Sort;
            public bool Active = true;
        }

        // ------------------------------------------------------------------ ورودی
        public void ProcessRequest(HttpContext context)
        {
            ctx = context;
            req = context.Request;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
            context.Response.AddHeader("X-Content-Type-Options", "nosniff");
            try
            {
                SPWeb web = SPContext.Current.Web;
                siteId = SPContext.Current.Site.ID;
                webId = web.ID;
                zone = SPContext.Current.Site.Zone;
                user = web.CurrentUser;
                userKey = user == null ? null : (user.LoginName ?? "").ToLowerInvariant();
                try { tz = web.RegionalSettings.TimeZone; } catch { tz = null; }

                string action = (req.QueryString["action"] ?? "").Trim().ToLowerInvariant();
                bool isPost = string.Equals(req.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase);
                if (isPost) { CheckCsrf(); ReadBody(); } else body = new Dictionary<string, object>();

                cfg = LoadConfig(false);
                role = DetectRole();

                object result = Dispatch(action, isPost);
                if (result != null) Write(result);
            }
            catch (ApiException ex)
            {
                context.Response.StatusCode = ex.Status;
                Write(new Dictionary<string, object> { { "ok", false }, { "message", ex.Message }, { "code", ex.Code } });
            }
            catch (UnauthorizedAccessException)
            {
                context.Response.StatusCode = user == null ? 401 : 403;
                Write(new Dictionary<string, object> { { "ok", false }, { "message", user == null ? "برای این کار باید وارد سامانه شوید." : "دسترسی لازم برای این کار را ندارید." } });
            }
            catch (Exception ex)
            {
                Log(ex);
                context.Response.StatusCode = 500;
                Write(new Dictionary<string, object> { { "ok", false }, { "message", "خطای سرور پایگاه دانش: " + ex.Message } });
            }
        }

        private object Dispatch(string action, bool isPost)
        {
            switch (action)
            {
                case "bootstrap": return Bootstrap();
                case "list": return ListAction();
                case "get": return GetAction();
                case "file": FileAction(); return null;
                case "comments": return CommentsAction();
                case "view": RequirePost(isPost); return ViewAction();
                case "react": RequirePost(isPost); return ReactAction();
                case "comment": RequirePost(isPost); return CommentAction();
                case "comment-delete": RequirePost(isPost); return CommentDeleteAction();
            }
            if (action.StartsWith("admin-", StringComparison.Ordinal))
            {
                RequireManager();
                switch (action)
                {
                    case "admin-meta": return AdminMeta();
                    case "admin-dashboard": return AdminDashboard();
                    case "admin-list": return AdminList();
                    case "admin-get": return AdminGet(QInt("id"));
                    case "admin-authors": return AdminAuthors();
                    case "admin-comments": return AdminComments();
                    case "admin-categories": return AdminCategories();
                    case "admin-save": RequirePost(isPost); return AdminSave();
                    case "admin-status": RequirePost(isPost); return AdminStatus();
                    case "admin-delete": RequirePost(isPost); return AdminDelete();
                    case "admin-duplicate": RequirePost(isPost); return AdminDuplicate();
                    case "admin-comment-status": RequirePost(isPost); return AdminCommentStatus();
                    case "admin-comment-delete": RequirePost(isPost); return AdminCommentDelete();
                    case "admin-category-save": RequirePost(isPost); return AdminCategorySave();
                    case "admin-category-delete": RequirePost(isPost); return AdminCategoryDelete();
                    case "admin-flush": RequirePost(isPost); Flush(true); return Ok();
                    case "admin-settings": RequireAdmin(); return AdminSettings();
                    case "admin-settings-save": RequirePost(isPost); RequireAdmin(); return AdminSettingsSave();
                    case "admin-audit": RequireAdmin(); return AdminAudit();
                }
            }
            throw new ApiException(400, "عملیات نامعتبر است.");
        }

        // ------------------------------------------------------------------ امنیت درخواست
        private void CheckCsrf()
        {
            // درخواست دارای هدر سفارشی از سایت دیگر بدون CORS preflight ارسال نمی‌شود؛ شیرپوینت CORS را مجاز نمی‌کند.
            if (req.Headers["X-KB-Request"] != "1") throw new ApiException(403, "درخواست نامعتبر است.");
            string origin = req.Headers["Origin"];
            if (!string.IsNullOrEmpty(origin) && origin != "null")
            {
                Uri o;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out o) || !string.Equals(o.Host, req.Url.Host, StringComparison.OrdinalIgnoreCase))
                    throw new ApiException(403, "درخواست از مبدأ نامعتبر.");
            }
        }

        private void RequirePost(bool isPost) { if (!isPost) throw new ApiException(405, "روش درخواست نامعتبر است."); }
        private bool IsManager { get { return role == "hr" || role == "admin"; } }
        private void RequireLogin() { if (user == null) throw new ApiException(401, "برای این کار باید با حساب سازمانی وارد شوید.", "login"); }
        private void RequireManager() { RequireLogin(); if (!IsManager) throw new ApiException(403, "فقط منابع انسانی و مدیران سامانه به این بخش دسترسی دارند."); }
        private void RequireAdmin() { if (role != "admin") throw new ApiException(403, "فقط مدیر سامانه به این بخش دسترسی دارد."); }

        private string DetectRole()
        {
            if (user == null) return "anonymous";
            SPWeb web = SPContext.Current.Web;
            try { if (web.DoesUserHavePermissions(SPBasePermissions.ManageWeb)) return "admin"; } catch { }
            try
            {
                SPList list = web.Lists.TryGetList(cfg.ContentList);
                if (list != null && list.DoesUserHavePermissions(SPBasePermissions.EditListItems)) return "hr";
            }
            catch { }
            return "reader";
        }

        // ------------------------------------------------------------------ پیکربندی و نگاشت ستون‌ها
        private delegate void WebAction(SPWeb web);

        private void Elevated(WebAction action)
        {
            Guid s = siteId, w = webId;
            SPUrlZone z = zone;
            SPSecurity.RunWithElevatedPrivileges(delegate
            {
                using (SPSite site = new SPSite(s, z))
                using (SPWeb web = site.OpenWeb(w))
                {
                    web.AllowUnsafeUpdates = true;
                    action(web);
                }
            });
        }

        private Config LoadConfig(bool force)
        {
            string key = "kb.cfg." + webId;
            Config c = force ? null : HttpRuntime.Cache[key] as Config;
            if (c != null) return c;
            c = new Config();
            Config target = c;
            Elevated(delegate (SPWeb web)
            {
                SPList settings = web.Lists.TryGetList(SettingsListTitle);
                if (settings == null) throw new ApiException(500, "لیست KBSettings یافت نشد؛ اسکریپت Install-KBPortal.ps1 را اجرا کنید.");
                foreach (SPListItem it in settings.Items)
                {
                    string k = Convert.ToString(it["Title"]);
                    if (!string.IsNullOrEmpty(k)) target.Settings[k] = Convert.ToString(it["Value"]) ?? "";
                }
                target.ContentList = Setting(target, "ContentList", "KnowledgeContent");
                target.MediaLibrary = Setting(target, "MediaLibrary", "DocLib");
                SPList list = web.Lists.TryGetList(target.ContentList);
                if (list == null) throw new ApiException(500, "لیست محتوا («" + target.ContentList + "») یافت نشد.");
                target.ContentListUrl = list.RootFolder.ServerRelativeUrl.TrimEnd('/');

                Dictionary<string, string> map = new Dictionary<string, string>();
                string json = Setting(target, "FieldMap", "");
                if (json.Length > 0)
                {
                    try
                    {
                        Dictionary<string, object> m = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
                        foreach (KeyValuePair<string, object> p in m) map[p.Key] = Convert.ToString(p.Value);
                    }
                    catch { }
                }
                foreach (string logical in LogicalFields)
                {
                    string internalName;
                    if (!map.TryGetValue(logical, out internalName) || string.IsNullOrEmpty(internalName)) internalName = logical;
                    SPField f = null;
                    try { f = list.Fields.GetFieldByInternalName(internalName); } catch { f = null; }
                    if (f == null) continue;
                    target.Ids[logical] = f.Id;
                    target.Names[logical] = f.InternalName;
                    target.Types[logical] = f.TypeAsString;
                    SPFieldChoice ch = f as SPFieldChoice;
                    if (ch != null)
                    {
                        List<string> dest = logical == "ContentType" ? target.TypeChoices : logical == "Category" ? target.CategoryChoices : null;
                        if (dest != null) foreach (string v in ch.Choices) dest.Add(v);
                    }
                }
                foreach (string required in new[] { "Title", "Status", "Visibility" })
                    if (!target.Ids.ContainsKey(required)) throw new ApiException(500, "ستون «" + required + "» در لیست محتوا یافت نشد؛ اسکریپت Install-KBPortal.ps1 را اجرا کنید.");

                SPList media = web.Lists.TryGetList(target.MediaLibrary);
                target.MediaUrl = media != null ? media.RootFolder.ServerRelativeUrl.TrimEnd('/') : "";
                target.MediaTitle = media != null ? media.Title : target.MediaLibrary;
                try { target.MaxUploadMb = web.Site.WebApplication.MaximumFileSize; } catch { target.MaxUploadMb = 250; }
            });
            HttpRuntime.Cache.Insert(key, c, null, DateTime.UtcNow.AddSeconds(ConfigSeconds), System.Web.Caching.Cache.NoSlidingExpiration);
            return c;
        }

        private static string Setting(Config c, string key, string fallback)
        {
            string v;
            return c.Settings.TryGetValue(key, out v) && !string.IsNullOrEmpty(v) ? v : fallback;
        }

        private void Flush(bool config)
        {
            HttpRuntime.Cache.Remove("kb.idx." + webId);
            HttpRuntime.Cache.Remove("kb.cats." + webId);
            if (config) HttpRuntime.Cache.Remove("kb.cfg." + webId);
        }

        // ------------------------------------------------------------------ خواندن ستون‌ها
        private object Raw(SPListItem it, string key)
        {
            Guid id;
            if (!cfg.Ids.TryGetValue(key, out id)) return null;
            try { return it[id]; } catch { return null; }
        }

        private string Str(SPListItem it, string key)
        {
            object v = Raw(it, key);
            if (v == null) return "";
            string t;
            cfg.Types.TryGetValue(key, out t);
            string s = Convert.ToString(v, CultureInfo.InvariantCulture) ?? "";
            switch (t)
            {
                case "URL":
                    return new SPFieldUrlValue(s).Url ?? "";
                case "Lookup":
                case "User":
                    return new SPFieldLookupValue(s).LookupValue ?? "";
                case "LookupMulti":
                case "UserMulti":
                    return string.Join("، ", new SPFieldLookupValueCollection(s).Select(x => x.LookupValue).ToArray());
                case "MultiChoice":
                    return string.Join("، ", s.Split(new[] { ";#" }, StringSplitOptions.RemoveEmptyEntries));
                case "TaxonomyFieldType":
                case "TaxonomyFieldTypeMulti":
                    {
                        int i = s.IndexOf(";#", StringComparison.Ordinal);
                        if (i >= 0) s = s.Substring(i + 2);
                        int p = s.IndexOf('|');
                        return p >= 0 ? s.Substring(0, p) : s;
                    }
            }
            return s;
        }

        private double Num(SPListItem it, string key)
        {
            object v = Raw(it, key);
            if (v == null) return 0;
            if (v is double) return (double)v;
            double d;
            return double.TryParse(Convert.ToString(v, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out d) ? d : 0;
        }

        private bool Bool(SPListItem it, string key, bool fallback)
        {
            object v = Raw(it, key);
            if (v == null) return fallback;
            if (v is bool) return (bool)v;
            string s = Convert.ToString(v).Trim().ToLowerInvariant();
            if (s.Length == 0) return fallback;
            return s == "1" || s == "true" || s == "yes" || s == "بله" || s == "بلی";
        }

        private DateTime ToUtc(DateTime local)
        {
            if (tz != null) { try { return tz.LocalTimeToUTC(local); } catch { } }
            return DateTime.SpecifyKind(local, DateTimeKind.Local).ToUniversalTime();
        }

        private DateTime ToLocal(DateTime utc)
        {
            if (tz != null) { try { return tz.UTCToLocalTime(utc); } catch { } }
            return DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToLocalTime();
        }

        private DateTime? Date(SPListItem it, string key)
        {
            object v = Raw(it, key);
            if (v is DateTime) return ToUtc((DateTime)v);
            return null;
        }

        private static string Iso(DateTime? utc)
        {
            return utc.HasValue ? DateTime.SpecifyKind(utc.Value, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture) : null;
        }

        private static string NormStatus(string s)
        {
            string v = (s ?? "").Replace("‌", "").Replace(" ", "").ToLowerInvariant();
            if (v == "published" || v == "منتشرشده" || v == "منتشر") return "Published";
            if (v == "archived" || v == "بایگانی" || v == "بایگانیشده") return "Archived";
            return "Draft";
        }

        private static bool NormPublic(string s)
        {
            string v = (s ?? "").Trim().ToLowerInvariant();
            return v == "public" || v == "عمومی";
        }

        private static List<string> SplitTags(string s)
        {
            return (s ?? "").Split(new[] { ',', '،', ';', '؛', '#', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim()).Where(t => t.Length > 0).Distinct().ToList();
        }

        private static readonly Regex TagRx = new Regex("<(script|style)[\\s\\S]*?</\\1>|<[^>]+>", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static string PlainText(string html)
        {
            if (string.IsNullOrEmpty(html)) return "";
            string t = HttpUtility.HtmlDecode(TagRx.Replace(html, " "));
            return Regex.Replace(t, "\\s+", " ").Trim();
        }

        /// <summary>یکسان‌سازی متن فارسی برای جستجو (ی/ک عربی، ارقام، نیم‌فاصله)</summary>
        private static string Norm(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            StringBuilder sb = new StringBuilder(s.Length);
            foreach (char ch in s)
            {
                char c = ch;
                if (c == 'ي' || c == 'ى') c = 'ی';
                else if (c == 'ك') c = 'ک';
                else if (c == 'ۀ' || c == 'ة') c = 'ه';
                else if (c == 'أ' || c == 'إ' || c == 'آ') c = 'ا';
                else if (c >= '۰' && c <= '۹') c = (char)('0' + (c - '۰'));
                else if (c >= '٠' && c <= '٩') c = (char)('0' + (c - '٠'));
                else if (c == '‌') c = ' ';
                else if (c >= 'ً' && c <= 'ٟ') continue;
                sb.Append(char.ToLowerInvariant(c));
            }
            return Regex.Replace(sb.ToString(), "\\s+", " ").Trim();
        }

        private Entry FromItem(SPListItem it, bool keepBody)
        {
            Entry e = new Entry();
            e.Id = it.ID;
            e.Title = Str(it, "Title");
            e.Summary = Str(it, "Summary");
            string bodyHtml = Str(it, "Body");
            e.Thumb = Str(it, "ThumbnailUrl");
            e.Media = Str(it, "MediaUrl");
            e.Type = Str(it, "ContentType");
            e.Category = Str(it, "Category");
            e.Tags = SplitTags(Str(it, "Tags"));
            e.Views = Num(it, "Views");
            e.Likes = Num(it, "LikesCount");
            e.Comments = Num(it, "CommentsCount");
            e.Minutes = Num(it, "ReadingMinutes");
            e.Featured = Bool(it, "IsFeatured", false);
            e.AllowComments = Bool(it, "AllowComments", true);
            e.IsPublic = NormPublic(Str(it, "Visibility"));
            e.Status = NormStatus(Str(it, "Status"));
            e.PublishAt = Date(it, "PublishAt");
            e.AuthorName = Str(it, "AuthorName");
            e.AuthorBio = Str(it, "AuthorBio");
            e.AuthorImage = Str(it, "AuthorImageUrl");
            try { e.Created = ToUtc((DateTime)it[SPBuiltInFieldId.Created]); } catch { }
            try { e.Modified = ToUtc((DateTime)it[SPBuiltInFieldId.Modified]); } catch { }
            try { e.CreatedBy = new SPFieldLookupValue(Convert.ToString(it[SPBuiltInFieldId.Author])).LookupValue ?? ""; } catch { }
            try { e.Editor = new SPFieldLookupValue(Convert.ToString(it[SPBuiltInFieldId.Editor])).LookupValue ?? ""; } catch { }
            try { e.HasAttachments = Convert.ToBoolean(it[SPBuiltInFieldId.Attachments]); } catch { }
            string plain = PlainText(bodyHtml);
            if (e.Minutes <= 0 && plain.Length > 0) e.Minutes = Math.Max(1, Math.Round(plain.Split(' ').Length / 200.0));
            e.SearchTitle = Norm(e.Title);
            e.SearchTags = Norm(string.Join(" ", e.Tags.ToArray()));
            e.SearchSummary = Norm(e.Summary);
            e.SearchBody = Norm(plain.Length > 6000 ? plain.Substring(0, 6000) : plain);
            e.SearchOther = Norm(e.Category + " " + e.Type + " " + e.AuthorName);
            if (keepBody) e.Body = bodyHtml;
            return e;
        }

        private string ViewFieldsXml()
        {
            StringBuilder sb = new StringBuilder();
            foreach (KeyValuePair<string, string> p in cfg.Names) sb.Append("<FieldRef Name='").Append(p.Value).Append("' />");
            sb.Append("<FieldRef Name='ID' /><FieldRef Name='Created' /><FieldRef Name='Modified' /><FieldRef Name='Author' /><FieldRef Name='Editor' /><FieldRef Name='Attachments' />");
            return sb.ToString();
        }

        private List<Entry> LoadEntries(SPList list, bool publishedOnly)
        {
            List<Entry> result = new List<Entry>();
            SPQuery q = new SPQuery();
            q.ViewAttributes = "Scope='Recursive'";
            q.ViewFields = ViewFieldsXml();
            q.ViewFieldsOnly = true;
            q.RowLimit = 1000;
            if (publishedOnly)
                q.Query = "<Where><Eq><FieldRef Name='" + cfg.Names["Status"] + "' /><Value Type='Text'>Published</Value></Eq></Where>";
            do
            {
                SPListItemCollection items = list.GetItems(q);
                foreach (SPListItem it in items) result.Add(FromItem(it, false));
                q.ListItemCollectionPosition = items.ListItemCollectionPosition;
            } while (q.ListItemCollectionPosition != null);
            return result;
        }

        /// <summary>همه‌ی اقلام منتشرشده (عمومی و خصوصی) — ۶۰ ثانیه در حافظه</summary>
        private List<Entry> PublishedIndex()
        {
            string key = "kb.idx." + webId;
            List<Entry> idx = HttpRuntime.Cache[key] as List<Entry>;
            if (idx != null) return idx;
            List<Entry> loaded = null;
            Elevated(delegate (SPWeb web) { loaded = LoadEntries(web.Lists[cfg.ContentList], true); });
            HttpRuntime.Cache.Insert(key, loaded, null, DateTime.UtcNow.AddSeconds(IndexSeconds), System.Web.Caching.Cache.NoSlidingExpiration);
            return loaded;
        }

        private List<Entry> AllEntries()
        {
            List<Entry> loaded = null;
            Elevated(delegate (SPWeb web) { loaded = LoadEntries(web.Lists[cfg.ContentList], false); });
            return loaded;
        }

        private static bool IsLive(Entry e) { return e.Status == "Published" && (!e.PublishAt.HasValue || e.PublishAt.Value <= DateTime.UtcNow); }
        private bool CanView(Entry e) { return IsLive(e) && (e.IsPublic || user != null); }
        private List<Entry> Visible() { return PublishedIndex().Where(CanView).ToList(); }

        // ------------------------------------------------------------------ نشانی‌ها
        private string HandlerUrl
        {
            get { return SPContext.Current.Web.ServerRelativeUrl.TrimEnd('/') + "/_layouts/15/KB/KBApi.ashx"; }
        }

        private string Relative(string url)
        {
            if (string.IsNullOrEmpty(url)) return "";
            Uri u;
            if (Uri.TryCreate(url, UriKind.Absolute, out u) && (u.Scheme == "http" || u.Scheme == "https") &&
                string.Equals(u.Host, req.Url.Host, StringComparison.OrdinalIgnoreCase))
                return u.PathAndQuery;
            return url;
        }

        /// <summary>پیوست‌های لیست محتوا مستقیماً قابل دریافت نیستند؛ از طریق همین هندلر (با بررسی دسترسی) سرو می‌شوند.</summary>
        private string PublicUrl(string url)
        {
            string u = Relative(url);
            if (u.Length == 0) return "";
            string prefix = cfg.ContentListUrl + "/Attachments/";
            if (u.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                string rest = u.Substring(prefix.Length);
                int slash = rest.IndexOf('/');
                int id;
                if (slash > 0 && int.TryParse(rest.Substring(0, slash), out id))
                    return HandlerUrl + "?action=file&id=" + id + "&name=" + HttpUtility.UrlEncode(HttpUtility.UrlDecode(rest.Substring(slash + 1)));
            }
            return u;
        }

        private string RewriteBody(string html)
        {
            if (string.IsNullOrEmpty(html)) return "";
            string pattern = "(?:https?://[^/\"'\\s]+)?" + Regex.Escape(cfg.ContentListUrl) + "/Attachments/(\\d+)/([^\"'\\s<>?#]+)";
            string handler = HandlerUrl;
            return Regex.Replace(html, pattern, m => handler + "?action=file&amp;id=" + m.Groups[1].Value + "&amp;name=" +
                HttpUtility.UrlEncode(HttpUtility.UrlDecode(HttpUtility.HtmlDecode(m.Groups[2].Value))), RegexOptions.IgnoreCase);
        }

        // ------------------------------------------------------------------ خروجی JSON
        private Dictionary<string, object> Summary(Entry e)
        {
            return new Dictionary<string, object>
            {
                { "id", e.Id }, { "title", e.Title }, { "summary", e.Summary }, { "thumb", PublicUrl(e.Thumb) }, { "media", PublicUrl(e.Media) },
                { "type", e.Type }, { "category", e.Category }, { "tags", e.Tags }, { "views", e.Views }, { "likes", e.Likes }, { "comments", e.Comments },
                { "minutes", e.Minutes }, { "featured", e.Featured }, { "visibility", e.IsPublic ? "Public" : "Private" }, { "status", e.Status },
                { "publishAt", Iso(e.PublishAt) }, { "created", Iso(e.Created) }, { "modified", Iso(e.Modified) },
                { "author", new Dictionary<string, object> { { "name", e.AuthorName }, { "image", PublicUrl(e.AuthorImage) } } },
                { "attachmentsCount", e.HasAttachments ? 1 : 0 }, { "editor", e.Editor }
            };
        }

        private List<Dictionary<string, object>> Summaries(IEnumerable<Entry> list) { return list.Select(Summary).ToList(); }

        private static Dictionary<string, object> Ok() { return new Dictionary<string, object> { { "ok", true } }; }

        private void Write(object value)
        {
            JavaScriptSerializer js = new JavaScriptSerializer();
            js.MaxJsonLength = int.MaxValue;
            ctx.Response.Write(js.Serialize(value));
        }

        // ------------------------------------------------------------------ پارامترها
        private void ReadBody()
        {
            string raw;
            using (StreamReader r = new StreamReader(req.InputStream, Encoding.UTF8)) raw = r.ReadToEnd();
            body = new Dictionary<string, object>();
            if (string.IsNullOrWhiteSpace(raw)) return;
            JavaScriptSerializer js = new JavaScriptSerializer();
            js.MaxJsonLength = int.MaxValue;
            try { body = js.Deserialize<Dictionary<string, object>>(raw) ?? new Dictionary<string, object>(); }
            catch { throw new ApiException(400, "داده‌ی ارسالی نامعتبر است."); }
        }

        private bool Has(string key) { return body.ContainsKey(key); }

        private string BStr(string key, int max)
        {
            object v;
            if (!body.TryGetValue(key, out v) || v == null) return "";
            string s = Convert.ToString(v, CultureInfo.InvariantCulture).Trim();
            return max > 0 && s.Length > max ? s.Substring(0, max) : s;
        }

        private int BInt(string key)
        {
            int i;
            return int.TryParse(BStr(key, 20), NumberStyles.Integer, CultureInfo.InvariantCulture, out i) ? i : 0;
        }

        private bool BBool(string key)
        {
            object v;
            if (!body.TryGetValue(key, out v) || v == null) return false;
            if (v is bool) return (bool)v;
            string s = Convert.ToString(v).ToLowerInvariant();
            return s == "true" || s == "1";
        }

        private List<int> BIds(string key)
        {
            List<int> ids = new List<int>();
            object v;
            if (!body.TryGetValue(key, out v) || v == null) return ids;
            IEnumerable list = v as IEnumerable;
            if (list == null || v is string) return ids;
            foreach (object o in list)
            {
                int i;
                if (int.TryParse(Convert.ToString(o, CultureInfo.InvariantCulture), out i) && i > 0 && !ids.Contains(i)) ids.Add(i);
            }
            if (ids.Count > 500) throw new ApiException(400, "تعداد موارد انتخاب‌شده زیاد است.");
            return ids;
        }

        private List<string> BList(string key)
        {
            List<string> r = new List<string>();
            object v;
            if (!body.TryGetValue(key, out v) || v == null) return r;
            if (v is string) return SplitTags((string)v);
            IEnumerable list = v as IEnumerable;
            if (list != null) foreach (object o in list) { string s = Convert.ToString(o).Trim(); if (s.Length > 0 && !r.Contains(s)) r.Add(s); }
            return r;
        }

        private string Q(string key) { return (req.QueryString[key] ?? "").Trim(); }

        private int QInt(string key)
        {
            int i;
            return int.TryParse(Q(key), out i) ? i : 0;
        }

        private string ClientIp()
        {
            return req.UserHostAddress ?? "unknown";
        }

        // ==================================================================== عمومی
        private object Bootstrap()
        {
            List<Entry> vis = Visible();
            List<CatRow> cats = Categories();
            Dictionary<string, int> catCount = Count(vis.Where(e => e.Category.Length > 0).Select(e => e.Category));
            List<Dictionary<string, object>> catOut = new List<Dictionary<string, object>>();
            foreach (CatRow c in cats.Where(c => c.Active)) catOut.Add(CatJson(c, catCount.ContainsKey(c.Title) ? catCount[c.Title] : 0));
            foreach (KeyValuePair<string, int> p in catCount)
                if (!cats.Any(c => c.Title == p.Key)) catOut.Add(CatJson(new CatRow { Id = 0, Title = p.Key, Sort = 9999 }, p.Value));

            Dictionary<string, object> settings = new Dictionary<string, object>();
            foreach (string k in PublicSettingKeys) settings[k] = Setting(cfg, k, "");
            Dictionary<string, object> u = new Dictionary<string, object> { { "anonymous", user == null }, { "role", role } };
            if (user != null) { u["name"] = user.Name; u["email"] = user.Email; u["login"] = user.LoginName; }

            return new Dictionary<string, object>
            {
                { "user", u },
                { "settings", settings },
                { "categories", catOut },
                { "types", Count(vis.Where(e => e.Type.Length > 0).Select(e => e.Type)).OrderByDescending(p => p.Value).Select(p => new Dictionary<string, object> { { "value", p.Key }, { "count", p.Value } }).ToList() },
                { "tags", Count(vis.SelectMany(e => e.Tags)).OrderByDescending(p => p.Value).Take(30).Select(p => new Dictionary<string, object> { { "tag", p.Key }, { "count", p.Value } }).ToList() },
                { "stats", new Dictionary<string, object> {
                    { "total", vis.Count }, { "views", vis.Sum(e => e.Views) },
                    { "videos", vis.Count(e => IsMediaType(e.Type)) },
                    { "privateCount", user == null ? PublishedIndex().Count(e => IsLive(e) && !e.IsPublic) : 0 } } }
            };
        }

        private static bool IsMediaType(string t)
        {
            string v = Norm(t);
            return v.Contains("ویدیو") || v.Contains("ویدئو") || v.Contains("video") || v.Contains("پادکست") || v.Contains("podcast") || v.Contains("صوت");
        }

        private static Dictionary<string, int> Count(IEnumerable<string> values)
        {
            Dictionary<string, int> d = new Dictionary<string, int>();
            foreach (string v in values) { int n; d.TryGetValue(v, out n); d[v] = n + 1; }
            return d;
        }

        private Dictionary<string, object> CatJson(CatRow c, int count)
        {
            return new Dictionary<string, object>
            {
                { "id", c.Id }, { "title", c.Title }, { "icon", c.Icon }, { "color", c.Color }, { "description", c.Description },
                { "sort", c.Sort }, { "active", c.Active }, { "count", count }
            };
        }

        private List<CatRow> Categories()
        {
            string key = "kb.cats." + webId;
            List<CatRow> cached = HttpRuntime.Cache[key] as List<CatRow>;
            if (cached != null) return cached;
            List<CatRow> rows = new List<CatRow>();
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists.TryGetList(CategoriesListTitle);
                if (list == null) return;
                foreach (SPListItem it in list.Items) rows.Add(CatFromItem(it));
            });
            rows = rows.OrderBy(c => c.Sort).ThenBy(c => c.Title).ToList();
            HttpRuntime.Cache.Insert(key, rows, null, DateTime.UtcNow.AddSeconds(IndexSeconds), System.Web.Caching.Cache.NoSlidingExpiration);
            return rows;
        }

        private static CatRow CatFromItem(SPListItem it)
        {
            CatRow c = new CatRow();
            c.Id = it.ID;
            c.Title = Convert.ToString(it["Title"]) ?? "";
            c.Icon = FirstNonEmpty(Convert.ToString(it["Icon"]), "folder");
            c.Color = FirstNonEmpty(Convert.ToString(it["Color"]), "#008000");
            c.Description = Convert.ToString(it["Description"]) ?? "";
            try { c.Sort = it["SortOrder"] == null ? 0 : Convert.ToDouble(it["SortOrder"], CultureInfo.InvariantCulture); } catch { }
            try { c.Active = it["IsActive"] == null || Convert.ToBoolean(it["IsActive"]); } catch { }
            return c;
        }

        private static string FirstNonEmpty(string a, string b) { return string.IsNullOrEmpty(a) ? b : a; }

        private class Page<T>
        {
            public List<T> Items;
            public int Total, Number, Pages;
        }

        private static Page<T> Paginate<T>(List<T> all, int page, int size)
        {
            if (size <= 0) size = 12;
            if (size > 100) size = 100;
            Page<T> p = new Page<T>();
            p.Total = all.Count;
            p.Pages = Math.Max(1, (int)Math.Ceiling(all.Count / (double)size));
            p.Number = Math.Min(Math.Max(1, page), p.Pages);
            p.Items = all.Skip((p.Number - 1) * size).Take(size).ToList();
            return p;
        }

        private static int Score(Entry e, string[] words)
        {
            int total = 0;
            foreach (string w in words)
            {
                int s = 0;
                if (e.SearchTitle.Contains(w)) s += 6;
                if (e.SearchTags.Contains(w)) s += 4;
                if (e.SearchSummary.Contains(w)) s += 2;
                if (e.SearchOther.Contains(w)) s += 2;
                if (e.SearchBody.Contains(w)) s += 1;
                if (s == 0) return 0;
                total += s;
            }
            return total;
        }

        private static DateTime PubDate(Entry e) { return e.PublishAt.HasValue ? e.PublishAt.Value : e.Created; }

        private static IEnumerable<Entry> Sort(IEnumerable<Entry> items, string sort, Dictionary<int, int> scores)
        {
            switch (sort)
            {
                case "relevance": return scores != null && scores.Count > 0 ? items.OrderByDescending(e => scores.ContainsKey(e.Id) ? scores[e.Id] : 0).ThenByDescending(PubDate) : items.OrderByDescending(PubDate);
                case "old": return items.OrderBy(PubDate);
                case "views": return items.OrderByDescending(e => e.Views);
                case "likes": return items.OrderByDescending(e => e.Likes).ThenByDescending(e => e.Views);
                case "comments": return items.OrderByDescending(e => e.Comments);
                case "title": return items.OrderBy(e => e.Title, StringComparer.Create(new CultureInfo("fa-IR"), true));
                case "modified": return items.OrderByDescending(e => e.Modified);
                default: return items.OrderByDescending(PubDate);
            }
        }

        /// <summary>جستجو، فیلتر، مرتب‌سازی و صفحه‌بندی مشترک (صفحات عمومی و پنل)</summary>
        private Dictionary<string, object> Query(List<Entry> source, bool admin)
        {
            string[] words = Norm(Q("q")).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            IEnumerable<Entry> items = source;
            Dictionary<int, int> scores = new Dictionary<int, int>();
            if (words.Length > 0)
            {
                foreach (Entry e in source) { int s = Score(e, words); if (s > 0) scores[e.Id] = s; }
                items = items.Where(e => scores.ContainsKey(e.Id));
            }
            if (Q("saved") == "1")
            {
                RequireLogin();
                HashSet<int> saved = new HashSet<int>(UserReactionIds("Bookmark"));
                items = items.Where(e => saved.Contains(e.Id));
            }
            string vis = Q("vis");
            if (vis == "Public") items = items.Where(e => e.IsPublic);
            else if (vis == "Private") items = items.Where(e => !e.IsPublic);
            List<Entry> facetBase = items.ToList();

            string type = Q("type"), cat = Q("cat"), tag = Q("tag"), author = Q("author"), status = Q("status");
            items = facetBase;
            if (type.Length > 0) items = items.Where(e => e.Type == type);
            if (cat.Length > 0) items = items.Where(e => e.Category == cat);
            if (tag.Length > 0) items = items.Where(e => e.Tags.Contains(tag));
            if (author.Length > 0) items = items.Where(e => e.AuthorName == author);
            if (Q("featured") == "1") items = items.Where(e => e.Featured);
            int exclude = QInt("exclude");
            if (exclude > 0) items = items.Where(e => e.Id != exclude);
            if (admin && status.Length > 0)
            {
                DateTime now = DateTime.UtcNow;
                if (status == "Scheduled") items = items.Where(e => e.Status == "Published" && e.PublishAt.HasValue && e.PublishAt.Value > now);
                else if (status == "Published") items = items.Where(IsLive);
                else items = items.Where(e => e.Status == status);
            }
            string sort = Q("sort");
            if (sort == "relevance" && words.Length == 0) sort = "new";
            Page<Entry> page = Paginate(Sort(items, sort, scores).ToList(), QInt("page"), QInt("size") > 0 ? QInt("size") : 12);

            Dictionary<string, object> r = new Dictionary<string, object>
            {
                { "items", Summaries(page.Items) }, { "total", page.Total }, { "page", page.Number }, { "pages", page.Pages },
                { "facets", new Dictionary<string, object> {
                    { "types", Facet(facetBase.Where(e => cat.Length == 0 || e.Category == cat).Select(e => e.Type)) },
                    { "categories", Facet(facetBase.Where(e => type.Length == 0 || e.Type == type).Select(e => e.Category)) } } }
            };
            return r;
        }

        private static List<Dictionary<string, object>> Facet(IEnumerable<string> values)
        {
            return Count(values.Where(v => !string.IsNullOrEmpty(v))).OrderByDescending(p => p.Value)
                .Select(p => new Dictionary<string, object> { { "value", p.Key }, { "count", p.Value } }).ToList();
        }

        private object ListAction() { return Query(Visible(), false); }

        private Entry FindVisible(int id, bool allowPreview)
        {
            Entry e = PublishedIndex().FirstOrDefault(x => x.Id == id);
            if (e != null && IsLive(e))
            {
                if (!e.IsPublic && user == null) throw new ApiException(401, "این محتوا ویژه‌ی کارکنان است؛ برای مشاهده وارد شوید.", "login");
                return e;
            }
            if (allowPreview && IsManager) return e ?? LoadEntry(id, false);
            throw new ApiException(404, "محتوا یافت نشد.");
        }

        private Entry LoadEntry(int id, bool keepBody)
        {
            Entry e = null;
            Elevated(delegate (SPWeb web)
            {
                try { e = FromItem(web.Lists[cfg.ContentList].GetItemById(id), keepBody); }
                catch (ArgumentException) { e = null; }
            });
            if (e == null) throw new ApiException(404, "محتوا یافت نشد.");
            return e;
        }

        private List<Dictionary<string, object>> AttachmentsOf(int id, bool direct)
        {
            List<Dictionary<string, object>> files = new List<Dictionary<string, object>>();
            string handler = HandlerUrl;
            Elevated(delegate (SPWeb web)
            {
                SPListItem it = web.Lists[cfg.ContentList].GetItemById(id);
                foreach (string name in it.Attachments)
                {
                    string url = it.Attachments.UrlPrefix + name;
                    long size = 0;
                    try { size = web.GetFile(url).Length; } catch { }
                    string rel = Relative(url);
                    files.Add(new Dictionary<string, object>
                    {
                        { "name", name }, { "size", size },
                        { "url", direct ? rel : handler + "?action=file&id=" + id + "&name=" + HttpUtility.UrlEncode(name) },
                        { "rawUrl", rel }
                    });
                }
            });
            return files;
        }

        private object GetAction()
        {
            int id = QInt("id");
            bool preview = Q("preview") == "1";
            Entry idx = FindVisible(id, preview);
            Entry e = LoadEntry(idx.Id, true);
            if (!IsManager && !CanView(e)) throw new ApiException(404, "محتوا یافت نشد.");

            Dictionary<string, object> r = Summary(e);
            r["body"] = RewriteBody(e.Body);
            r["allowComments"] = e.AllowComments;
            r["author"] = new Dictionary<string, object> { { "name", e.AuthorName }, { "bio", e.AuthorBio }, { "image", PublicUrl(e.AuthorImage) } };
            r["attachments"] = e.HasAttachments ? AttachmentsOf(e.Id, false) : new List<Dictionary<string, object>>();
            List<string> mine = user == null ? new List<string>() : UserReactionKinds(e.Id);
            r["viewer"] = new Dictionary<string, object> { { "liked", mine.Contains("Like") }, { "bookmarked", mine.Contains("Bookmark") }, { "canEdit", IsManager } };

            HashSet<string> tags = new HashSet<string>(e.Tags);
            r["related"] = Summaries(Visible().Where(x => x.Id != e.Id)
                .Select(x => new { x, s = (x.Category.Length > 0 && x.Category == e.Category ? 3 : 0) + x.Tags.Count(tags.Contains) * 2 + (x.Type == e.Type ? 1 : 0) })
                .Where(p => p.s > 0).OrderByDescending(p => p.s).ThenByDescending(p => p.x.Views).Take(7).Select(p => p.x));
            return r;
        }

        // ------------------------------------------------------------------ فایل پیوست (با بررسی دسترسی)
        private void FileAction()
        {
            int id = QInt("id");
            string name = Q("name");
            if (id <= 0 || name.Length == 0 || name.IndexOfAny(new[] { '/', '\\' }) >= 0) throw new ApiException(400, "درخواست نامعتبر است.");
            Entry e = PublishedIndex().FirstOrDefault(x => x.Id == id);
            bool allowed = IsManager || (e != null && CanView(e));
            if (!allowed)
            {
                if (e != null && IsLive(e) && user == null) throw new ApiException(401, "برای دریافت این فایل وارد شوید.", "login");
                throw new ApiException(404, "فایل یافت نشد.");
            }
            HttpResponse res = ctx.Response;
            Elevated(delegate (SPWeb web)
            {
                SPListItem it;
                try { it = web.Lists[cfg.ContentList].GetItemById(id); } catch (ArgumentException) { throw new ApiException(404, "فایل یافت نشد."); }
                SPFile file = web.GetFile(it.Attachments.UrlPrefix + name);
                if (!file.Exists) throw new ApiException(404, "فایل یافت نشد.");
                Stream(res, file, name);
            });
        }

        private void Stream(HttpResponse res, SPFile file, string name)
        {
            string ext = Path.GetExtension(name).ToLowerInvariant();
            string mime = MimeMapping.GetMimeMapping(name);
            bool dangerous = ext == ".html" || ext == ".htm" || ext == ".svg" || ext == ".xml" || ext == ".js" || ext == ".xhtml" || ext == ".aspx";
            bool inline = !dangerous && Q("dl") != "1" && (mime.StartsWith("image/") || mime.StartsWith("video/") || mime.StartsWith("audio/") || mime == "application/pdf");
            if (dangerous) mime = "application/octet-stream";
            long length = file.Length;
            long start = 0, end = length - 1;
            string range = req.Headers["Range"];
            bool partial = false;
            if (!string.IsNullOrEmpty(range) && range.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase) && length > 0)
            {
                string[] parts = range.Substring(6).Split(',')[0].Split('-');
                long a, b;
                if (parts.Length == 2)
                {
                    if (parts[0].Length == 0 && long.TryParse(parts[1], out b)) { start = Math.Max(0, length - b); }
                    else if (long.TryParse(parts[0], out a))
                    {
                        start = a;
                        if (parts[1].Length > 0 && long.TryParse(parts[1], out b)) end = Math.Min(b, length - 1);
                    }
                    if (start > end || start >= length) { res.StatusCode = 416; res.AddHeader("Content-Range", "bytes */" + length); return; }
                    partial = true;
                }
            }
            res.Clear();
            res.BufferOutput = false;
            res.ContentType = mime;
            res.Cache.SetCacheability(HttpCacheability.Private);
            res.Cache.SetMaxAge(TimeSpan.FromMinutes(10));
            res.AddHeader("X-Content-Type-Options", "nosniff");
            res.AddHeader("Accept-Ranges", "bytes");
            res.AddHeader("Content-Disposition", (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + Uri.EscapeDataString(name));
            if (partial)
            {
                res.StatusCode = 206;
                res.AddHeader("Content-Range", "bytes " + start + "-" + end + "/" + length);
            }
            long count = end - start + 1;
            res.AddHeader("Content-Length", count.ToString(CultureInfo.InvariantCulture));
            using (Stream s = file.OpenBinaryStream())
            {
                if (start > 0)
                {
                    if (s.CanSeek) s.Seek(start, SeekOrigin.Begin);
                    else { byte[] skip = new byte[81920]; long left = start; while (left > 0) { int n = s.Read(skip, 0, (int)Math.Min(skip.Length, left)); if (n <= 0) break; left -= n; } }
                }
                byte[] buf = new byte[81920];
                while (count > 0 && res.IsClientConnected)
                {
                    int n = s.Read(buf, 0, (int)Math.Min(buf.Length, count));
                    if (n <= 0) break;
                    res.OutputStream.Write(buf, 0, n);
                    count -= n;
                }
            }
        }

        // ------------------------------------------------------------------ بازدید، پسند، ذخیره
        private object ViewAction()
        {
            int id = BInt("id");
            Entry e = PublishedIndex().FirstOrDefault(x => x.Id == id);
            if (e == null || !CanView(e)) return Ok();
            string key = "kb.v." + webId + "." + id + "." + (userKey ?? ClientIp());
            if (HttpRuntime.Cache[key] != null) return Ok();
            HttpRuntime.Cache.Insert(key, true, null, DateTime.UtcNow.AddMinutes(30), System.Web.Caching.Cache.NoSlidingExpiration);
            if (!cfg.Ids.ContainsKey("Views")) return Ok();
            try
            {
                Elevated(delegate (SPWeb web)
                {
                    SPListItem it = web.Lists[cfg.ContentList].GetItemById(id);
                    double n = Num(it, "Views") + 1;
                    it[cfg.Ids["Views"]] = n;
                    it.SystemUpdate(false);
                    e.Views = n;
                });
            }
            catch (SPException) { /* هم‌زمانی ویرایش؛ این بازدید شمرده نمی‌شود */ }
            return Ok();
        }

        private string Caml(string field, string type, string value)
        {
            return "<Eq><FieldRef Name='" + field + "' /><Value Type='" + type + "'>" + SPEncode.HtmlEncode(value) + "</Value></Eq>";
        }

        private static string And(params string[] parts)
        {
            string r = parts[0];
            for (int i = 1; i < parts.Length; i++) r = "<And>" + r + parts[i] + "</And>";
            return r;
        }

        private List<int> UserReactionIds(string kind)
        {
            List<int> ids = new List<int>();
            if (user == null) return ids;
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists.TryGetList(ReactionsListTitle);
                if (list == null) return;
                SPQuery q = new SPQuery();
                q.Query = "<Where>" + And(Caml("UserKey", "Text", userKey), Caml("Kind", "Text", kind)) + "</Where>";
                q.ViewFields = "<FieldRef Name='ContentId' />";
                q.RowLimit = 5000;
                foreach (SPListItem it in list.GetItems(q)) ids.Add(Convert.ToInt32(it["ContentId"], CultureInfo.InvariantCulture));
            });
            return ids;
        }

        private List<string> UserReactionKinds(int id)
        {
            List<string> kinds = new List<string>();
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists.TryGetList(ReactionsListTitle);
                if (list == null) return;
                SPQuery q = new SPQuery();
                q.Query = "<Where>" + And(Caml("ContentId", "Number", id.ToString(CultureInfo.InvariantCulture)), Caml("UserKey", "Text", userKey)) + "</Where>";
                q.RowLimit = 10;
                foreach (SPListItem it in list.GetItems(q)) kinds.Add(Convert.ToString(it["Kind"]));
            });
            return kinds;
        }

        private object ReactAction()
        {
            RequireLogin();
            int id = BInt("id");
            string kind = BStr("kind", 20) == "Bookmark" ? "Bookmark" : "Like";
            Entry e = FindVisible(id, false);
            bool active = false;
            double count = 0;
            lock (Sync)
            {
                Elevated(delegate (SPWeb web)
                {
                    SPList list = web.Lists[ReactionsListTitle];
                    SPQuery q = new SPQuery();
                    q.Query = "<Where>" + And(Caml("ContentId", "Number", id.ToString(CultureInfo.InvariantCulture)), Caml("UserKey", "Text", userKey), Caml("Kind", "Text", kind)) + "</Where>";
                    q.RowLimit = 5;
                    SPListItemCollection found = list.GetItems(q);
                    if (found.Count > 0)
                    {
                        for (int i = found.Count - 1; i >= 0; i--) found[i].Delete();
                        active = false;
                    }
                    else
                    {
                        SPListItem it = list.AddItem();
                        it["Title"] = Truncate(e.Title, 255);
                        it["ContentId"] = id;
                        it["UserKey"] = userKey;
                        it["Kind"] = kind;
                        it.Update();
                        active = true;
                    }
                    if (kind == "Like")
                    {
                        SPQuery cq = new SPQuery();
                        cq.Query = "<Where>" + And(Caml("ContentId", "Number", id.ToString(CultureInfo.InvariantCulture)), Caml("Kind", "Text", "Like")) + "</Where>";
                        cq.ViewFields = "<FieldRef Name='ID' />";
                        cq.RowLimit = 100000;
                        count = list.GetItems(cq).Count;
                        if (cfg.Ids.ContainsKey("LikesCount"))
                        {
                            SPListItem content = web.Lists[cfg.ContentList].GetItemById(id);
                            content[cfg.Ids["LikesCount"]] = count;
                            try { content.SystemUpdate(false); } catch (SPException) { }
                        }
                        e.Likes = count;
                    }
                });
            }
            return new Dictionary<string, object> { { "ok", true }, { "active", active }, { "count", count } };
        }

        // ------------------------------------------------------------------ نظرات
        private class CommentRow
        {
            public int Id, ContentId, ParentId;
            public string Body = "", Author = "", Login = "", Status = "Approved";
            public bool IsStaff;
            public DateTime Date;
        }

        private CommentRow CommentFromItem(SPListItem it)
        {
            CommentRow c = new CommentRow();
            c.Id = it.ID;
            c.ContentId = Convert.ToInt32(it["ContentId"] ?? 0, CultureInfo.InvariantCulture);
            c.ParentId = Convert.ToInt32(it["ParentId"] ?? 0, CultureInfo.InvariantCulture);
            c.Body = Convert.ToString(it["Body"]) ?? "";
            c.Author = Convert.ToString(it["AuthorName"]) ?? "";
            c.Login = (Convert.ToString(it["AuthorLogin"]) ?? "").ToLowerInvariant();
            c.Status = FirstNonEmpty(Convert.ToString(it["Status"]), "Approved");
            try { c.IsStaff = it["IsStaff"] != null && Convert.ToBoolean(it["IsStaff"]); } catch { }
            try { c.Date = ToUtc((DateTime)it[SPBuiltInFieldId.Created]); } catch { }
            return c;
        }

        private List<CommentRow> LoadComments(int contentId)
        {
            List<CommentRow> rows = new List<CommentRow>();
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists.TryGetList(CommentsListTitle);
                if (list == null) return;
                SPQuery q = new SPQuery();
                q.Query = (contentId > 0 ? "<Where>" + Caml("ContentId", "Number", contentId.ToString(CultureInfo.InvariantCulture)) + "</Where>" : "") + "<OrderBy><FieldRef Name='ID' Ascending='FALSE' /></OrderBy>";
                q.RowLimit = contentId > 0 ? 2000u : 5000u;
                foreach (SPListItem it in list.GetItems(q)) rows.Add(CommentFromItem(it));
            });
            return rows;
        }

        private Dictionary<string, object> CommentJson(CommentRow c)
        {
            return new Dictionary<string, object>
            {
                { "id", c.Id }, { "contentId", c.ContentId }, { "parentId", c.ParentId }, { "body", c.Body }, { "author", c.Author },
                { "date", Iso(c.Date) }, { "status", c.Status }, { "isStaff", c.IsStaff }, { "canDelete", IsManager || (userKey != null && c.Login == userKey) }
            };
        }

        private bool CommentsEnabled(Entry e)
        {
            return Setting(cfg, "CommentsEnabled", "true") != "false" && e.AllowComments;
        }

        private object CommentsAction()
        {
            Entry e = FindVisible(QInt("id"), true);
            List<CommentRow> rows = LoadComments(e.Id).Where(c => c.Status == "Approved" || IsManager || (userKey != null && c.Login == userKey && c.Status == "Pending")).ToList();
            bool enabled = CommentsEnabled(e);
            return new Dictionary<string, object>
            {
                { "items", rows.OrderBy(c => c.Id).Select(CommentJson).ToList() }, { "allowComments", enabled }, { "canComment", enabled && user != null },
                { "moderation", Setting(cfg, "CommentModeration", "Post") }
            };
        }

        private void RecountComments(SPWeb web, int contentId)
        {
            if (!cfg.Ids.ContainsKey("CommentsCount")) return;
            SPList list = web.Lists[CommentsListTitle];
            SPQuery q = new SPQuery();
            q.Query = "<Where>" + And(Caml("ContentId", "Number", contentId.ToString(CultureInfo.InvariantCulture)), Caml("Status", "Text", "Approved")) + "</Where>";
            q.ViewFields = "<FieldRef Name='ID' />";
            q.RowLimit = 100000;
            int count = list.GetItems(q).Count;
            try
            {
                SPListItem content = web.Lists[cfg.ContentList].GetItemById(contentId);
                content[cfg.Ids["CommentsCount"]] = count;
                content.SystemUpdate(false);
            }
            catch (ArgumentException) { }
            catch (SPException) { }
            Entry cached = PublishedIndex().FirstOrDefault(x => x.Id == contentId);
            if (cached != null) cached.Comments = count;
        }

        private object CommentAction()
        {
            RequireLogin();
            Entry e = FindVisible(BInt("id"), true);
            if (!CommentsEnabled(e)) throw new ApiException(400, "ثبت نظر برای این محتوا غیرفعال است.");
            string text = BStr("body", 4000);
            if (text.Length < 2) throw new ApiException(400, "متن نظر خیلی کوتاه است.");
            if (text.Length > 3000) throw new ApiException(400, "متن نظر حداکثر ۳۰۰۰ نویسه است.");
            int parentId = BInt("parentId");
            string rateKey = "kb.c." + webId + "." + userKey;
            int n = HttpRuntime.Cache[rateKey] is int ? (int)HttpRuntime.Cache[rateKey] : 0;
            if (n >= 10 && !IsManager) throw new ApiException(429, "تعداد نظرات شما در چند دقیقه‌ی اخیر زیاد است؛ کمی بعد دوباره تلاش کنید.");
            HttpRuntime.Cache.Insert(rateKey, n + 1, null, DateTime.UtcNow.AddMinutes(10), System.Web.Caching.Cache.NoSlidingExpiration);

            bool pending = Setting(cfg, "CommentModeration", "Post") == "Pre" && !IsManager;
            CommentRow saved = null;
            string name = user.Name, login = userKey, ip = ClientIp();
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists[CommentsListTitle];
                if (parentId > 0)
                {
                    try
                    {
                        SPListItem parent = list.GetItemById(parentId);
                        if (Convert.ToInt32(parent["ContentId"], CultureInfo.InvariantCulture) != e.Id) parentId = 0;
                    }
                    catch (ArgumentException) { parentId = 0; }
                }
                SPListItem it = list.AddItem();
                it["Title"] = Truncate(text.Replace("\n", " "), 120);
                it["ContentId"] = e.Id;
                it["ParentId"] = parentId;
                it["Body"] = text;
                it["AuthorName"] = Truncate(name, 255);
                it["AuthorLogin"] = Truncate(login, 255);
                it["Status"] = pending ? "Pending" : "Approved";
                it["IsStaff"] = IsManager;
                it["SourceIp"] = Truncate(ip, 64);
                it.Update();
                saved = CommentFromItem(it);
                if (!pending) RecountComments(web, e.Id);
                if (pending) Notify(web, "نظر جدید در انتظار تأیید: " + e.Title,
                    "<div dir='rtl' style='font-family:Tahoma'><b>" + HttpUtility.HtmlEncode(name) + "</b> برای «" + HttpUtility.HtmlEncode(e.Title) + "» نوشته است:<br><br>" +
                    HttpUtility.HtmlEncode(text).Replace("\n", "<br>") + "</div>");
            });
            return new Dictionary<string, object> { { "ok", true }, { "pending", pending }, { "comment", CommentJson(saved) } };
        }

        private object CommentDeleteAction()
        {
            RequireLogin();
            int id = BInt("id");
            bool manager = IsManager;
            string me = userKey;
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists[CommentsListTitle];
                SPListItem it;
                try { it = list.GetItemById(id); } catch (ArgumentException) { throw new ApiException(404, "نظر یافت نشد."); }
                CommentRow c = CommentFromItem(it);
                if (!manager && c.Login != me) throw new ApiException(403, "اجازه‌ی حذف این نظر را ندارید.");
                DeleteCommentTree(list, c.Id);
                RecountComments(web, c.ContentId);
            });
            return Ok();
        }

        private void DeleteCommentTree(SPList list, int id)
        {
            SPQuery q = new SPQuery();
            q.Query = "<Where>" + Caml("ParentId", "Number", id.ToString(CultureInfo.InvariantCulture)) + "</Where>";
            q.RowLimit = 1000;
            List<int> children = new List<int>();
            foreach (SPListItem child in list.GetItems(q)) children.Add(child.ID);
            foreach (int child in children) { try { list.GetItemById(child).Recycle(); } catch (ArgumentException) { } }
            try { list.GetItemById(id).Recycle(); } catch (ArgumentException) { }
        }

        private void Notify(SPWeb web, string subject, string html)
        {
            try
            {
                string to = Setting(cfg, "NotifyEmails", "");
                if (to.Length == 0 || !SPUtility.IsEmailServerSet(web)) return;
                foreach (string addr in to.Split(new[] { ',', ';', ' ', '\n', '\r', '،' }, StringSplitOptions.RemoveEmptyEntries))
                    SPUtility.SendEmail(web, false, false, addr.Trim(), subject, html);
            }
            catch (Exception ex) { Log(ex); }
        }

        // ==================================================================== پنل مدیریت
        private object AdminMeta()
        {
            List<string> types = cfg.TypeChoices.Count > 0 ? new List<string>(cfg.TypeChoices) : new List<string>(DefaultTypes);
            string pending = "0";
            try { pending = LoadComments(0).Count(c => c.Status == "Pending").ToString(CultureInfo.InvariantCulture); } catch { }
            if (cfg.TypeChoices.Count == 0)
                foreach (string t in PublishedIndex().Select(e => e.Type).Where(t => t.Length > 0).Distinct()) if (!types.Contains(t)) types.Add(t);
            return new Dictionary<string, object>
            {
                { "contentList", cfg.ContentList }, { "mediaUrl", cfg.MediaUrl }, { "mediaTitle", cfg.MediaTitle }, { "types", types },
                { "categoryChoices", cfg.CategoryChoices }, { "defaultVisibility", Setting(cfg, "DefaultVisibility", "Public") },
                { "maxUploadMb", cfg.MaxUploadMb }, { "pendingComments", int.Parse(pending, CultureInfo.InvariantCulture) }, { "version", Version }, { "role", role },
                { "fieldTypes", cfg.Types }
            };
        }

        private object AdminDashboard()
        {
            List<Entry> all = AllEntries();
            DateTime now = DateTime.UtcNow;
            List<CommentRow> comments = LoadComments(0);
            Dictionary<int, string> titles = all.ToDictionary(e => e.Id, e => e.Title);
            return new Dictionary<string, object>
            {
                { "counts", new Dictionary<string, object> {
                    { "total", all.Count }, { "published", all.Count(IsLive) }, { "draft", all.Count(e => e.Status == "Draft") },
                    { "scheduled", all.Count(e => e.Status == "Published" && e.PublishAt.HasValue && e.PublishAt.Value > now) },
                    { "archived", all.Count(e => e.Status == "Archived") }, { "private", all.Count(e => !e.IsPublic) }, { "public", all.Count(e => e.IsPublic) } } },
                { "views", all.Sum(e => e.Views) }, { "likes", all.Sum(e => e.Likes) },
                { "comments", new Dictionary<string, object> { { "total", comments.Count }, { "pending", comments.Count(c => c.Status == "Pending") } } },
                { "top", Summaries(all.Where(IsLive).OrderByDescending(e => e.Views).Take(6)) },
                { "recent", Summaries(all.OrderByDescending(e => e.Modified).Take(6)) },
                { "recentComments", comments.Take(5).Select(c => new Dictionary<string, object> {
                    { "id", c.Id }, { "contentId", c.ContentId }, { "contentTitle", titles.ContainsKey(c.ContentId) ? titles[c.ContentId] : "(حذف‌شده)" },
                    { "author", c.Author }, { "body", c.Body }, { "date", Iso(c.Date) }, { "status", c.Status } }).ToList() },
                { "byType", Count(all.Where(e => e.Type.Length > 0).Select(e => e.Type)) },
                { "byCategory", Count(all.Where(e => e.Category.Length > 0).Select(e => e.Category)) }
            };
        }

        private object AdminList()
        {
            List<Entry> all = AllEntries();
            Dictionary<string, object> r = Query(all, true);
            DateTime now = DateTime.UtcNow;
            r["counts"] = new Dictionary<string, object>
            {
                { "all", all.Count }, { "Published", all.Count(IsLive) }, { "Draft", all.Count(e => e.Status == "Draft") },
                { "Scheduled", all.Count(e => e.Status == "Published" && e.PublishAt.HasValue && e.PublishAt.Value > now) },
                { "Archived", all.Count(e => e.Status == "Archived") }
            };
            return r;
        }

        private Dictionary<string, object> AdminGet(int id)
        {
            Entry e = LoadEntry(id, true);
            Dictionary<string, object> r = Summary(e);
            r["body"] = e.Body;
            r["thumb"] = Relative(e.Thumb);
            r["rawThumb"] = Relative(e.Thumb);
            r["media"] = Relative(e.Media);
            r["rawMedia"] = Relative(e.Media);
            r["allowComments"] = e.AllowComments;
            r["minutes"] = Num0(id, "ReadingMinutes");
            r["author"] = new Dictionary<string, object> { { "name", e.AuthorName }, { "bio", e.AuthorBio }, { "image", Relative(e.AuthorImage) }, { "rawImage", Relative(e.AuthorImage) } };
            r["attachments"] = e.HasAttachments ? AttachmentsOf(e.Id, true) : new List<Dictionary<string, object>>();
            r["createdBy"] = e.CreatedBy;
            r["editor"] = e.Editor;
            return r;
        }

        /// <summary>مقدار ذخیره‌شده (نه برآوردشده) یک ستون عددی</summary>
        private double Num0(int id, string key)
        {
            double v = 0;
            Elevated(delegate (SPWeb web) { v = Num(web.Lists[cfg.ContentList].GetItemById(id), key); });
            return v;
        }

        private object AdminAuthors()
        {
            Dictionary<string, Dictionary<string, object>> m = new Dictionary<string, Dictionary<string, object>>();
            foreach (Entry e in AllEntries().OrderBy(x => x.Modified))
            {
                if (e.AuthorName.Length == 0) continue;
                Dictionary<string, object> a;
                if (!m.TryGetValue(e.AuthorName, out a)) { a = new Dictionary<string, object> { { "name", e.AuthorName }, { "bio", "" }, { "image", "" }, { "count", 0 } }; m[e.AuthorName] = a; }
                a["count"] = (int)a["count"] + 1;
                if (e.AuthorBio.Length > 0) a["bio"] = e.AuthorBio;
                if (e.AuthorImage.Length > 0) a["image"] = Relative(e.AuthorImage);
            }
            return new Dictionary<string, object> { { "items", m.Values.OrderByDescending(a => (int)a["count"]).ToList() } };
        }

        // ------------------------------------------------------------------ ذخیره‌ی محتوا (با مجوز خود کاربر)
        private SPList UserContentList()
        {
            SPWeb web = SPContext.Current.Web;
            web.AllowUnsafeUpdates = true;
            return web.Lists[cfg.ContentList];
        }

        private void SetValue(SPListItem it, string key, object value)
        {
            Guid id;
            if (!cfg.Ids.TryGetValue(key, out id)) return;
            string t = cfg.Types[key];
            string s = value == null ? "" : Convert.ToString(value, CultureInfo.InvariantCulture);
            switch (t)
            {
                case "Text":
                    it[id] = Truncate(s, 255);
                    return;
                case "URL":
                    if (s.Length == 0) { it[id] = null; return; }
                    string abs = s.StartsWith("/") ? req.Url.GetLeftPart(UriPartial.Authority) + s : s;
                    if (abs.Length > 255) throw new ApiException(400, "نشانی «" + key + "» بیش از ۲۵۵ نویسه است.");
                    SPFieldUrlValue uv = new SPFieldUrlValue();
                    uv.Url = abs;
                    uv.Description = Truncate(Path.GetFileName(s.Split('?')[0]), 200);
                    it[id] = uv;
                    return;
                case "Choice":
                    if (s.Length > 0) EnsureChoice(key, s);
                    it[id] = s.Length == 0 ? null : s;
                    return;
                case "Lookup":
                    it[id] = s.Length == 0 ? null : LookupValue(key, s);
                    return;
                case "Boolean":
                    it[id] = value is bool ? (bool)value : (s == "1" || s.ToLowerInvariant() == "true");
                    return;
                case "Number":
                case "Currency":
                    double d;
                    if (s.Length == 0) it[id] = null;
                    else if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out d)) it[id] = d;
                    return;
                case "DateTime":
                    DateTime dt;
                    if (s.Length == 0) it[id] = null;
                    else if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out dt)) it[id] = ToLocal(dt);
                    return;
                case "TaxonomyFieldType":
                case "TaxonomyFieldTypeMulti":
                case "MultiChoice":
                case "LookupMulti":
                    throw new ApiException(400, "نوع ستون «" + key + "» (" + t + ") برای ویرایش از پنل پشتیبانی نمی‌شود؛ آن را به Choice یا متن تغییر دهید.");
                default:
                    it[id] = s;
                    return;
            }
        }

        /// <summary>افزودن مقدار جدید به ستون Choice (نوع محتوا / دسته) در صورت نیاز</summary>
        private void EnsureChoice(string key, string value)
        {
            List<string> list = key == "ContentType" ? cfg.TypeChoices : key == "Category" ? cfg.CategoryChoices : null;
            if (list == null || list.Contains(value)) return;
            Guid fid = cfg.Ids[key];
            Elevated(delegate (SPWeb web)
            {
                SPFieldChoice f = web.Lists[cfg.ContentList].Fields[fid] as SPFieldChoice;
                if (f != null && !f.Choices.Contains(value)) { f.Choices.Add(value); f.Update(); }
            });
            list.Add(value);
            Flush(true);
        }

        private SPFieldLookupValue LookupValue(string key, string title)
        {
            SPFieldLookupValue result = null;
            Guid fid = cfg.Ids[key];
            Elevated(delegate (SPWeb web)
            {
                SPFieldLookup f = (SPFieldLookup)web.Lists[cfg.ContentList].Fields[fid];
                SPList target = web.Lists[new Guid(f.LookupList)];
                string show = string.IsNullOrEmpty(f.LookupField) ? "Title" : f.LookupField;
                SPQuery q = new SPQuery();
                q.Query = "<Where>" + Caml(show, "Text", title) + "</Where>";
                q.RowLimit = 1;
                SPListItemCollection found = target.GetItems(q);
                SPListItem it;
                if (found.Count > 0) it = found[0];
                else { it = target.AddItem(); it[show] = title; it.Update(); }
                result = new SPFieldLookupValue(it.ID, title);
            });
            return result;
        }

        private object AdminSave()
        {
            int id = BInt("id");
            string title = BStr("title", 255);
            if (title.Length == 0) throw new ApiException(400, "عنوان الزامی است.");
            string status = NormStatus(BStr("status", 20));
            SPList list = UserContentList();
            SPListItem it = id > 0 ? list.GetItemById(id) : list.AddItem();
            bool isNew = id <= 0;
            string before = isNew ? "" : NormStatus(Str(it, "Status"));

            SetValue(it, "Title", title);
            SetValue(it, "Summary", BStr("summary", 4000));
            SetValue(it, "Body", BStr("body", 0));
            SetValue(it, "ContentType", BStr("type", 255));
            SetValue(it, "Category", BStr("category", 255));
            SetValue(it, "Tags", string.Join(", ", BList("tags").ToArray()));
            SetValue(it, "Status", status);
            SetValue(it, "Visibility", BStr("visibility", 20) == "Public" ? "Public" : "Private");
            SetValue(it, "IsFeatured", BBool("featured"));
            SetValue(it, "AllowComments", !Has("allowComments") || BBool("allowComments"));
            SetValue(it, "ThumbnailUrl", BStr("thumb", 1000));
            SetValue(it, "MediaUrl", BStr("media", 1000));
            SetValue(it, "ReadingMinutes", BInt("minutes") > 0 ? (object)BInt("minutes") : null);
            SetValue(it, "AuthorName", BStr("authorName", 255));
            SetValue(it, "AuthorBio", BStr("authorBio", 2000));
            SetValue(it, "AuthorImageUrl", BStr("authorImage", 1000));
            string publishAt = BStr("publishAt", 40);
            if (publishAt.Length > 0) SetValue(it, "PublishAt", publishAt);
            else if (status == "Published" && (isNew || !Date(it, "PublishAt").HasValue)) SetValue(it, "PublishAt", Iso(DateTime.UtcNow));
            if (isNew)
            {
                SetValue(it, "Views", 0);
                SetValue(it, "LikesCount", 0);
                SetValue(it, "CommentsCount", 0);
            }
            it.Update();
            Flush(false);
            Audit(isNew ? "Create" : status == "Published" && before != "Published" ? "Publish" : status != "Published" && before == "Published" ? "Unpublish" : "Update", it.ID, title, "");
            return new Dictionary<string, object> { { "ok", true }, { "item", AdminGet(it.ID) } };
        }

        private object AdminStatus()
        {
            List<int> ids = BIds("ids");
            string status = Has("status") && BStr("status", 20).Length > 0 ? NormStatus(BStr("status", 20)) : null;
            SPList list = UserContentList();
            foreach (int id in ids)
            {
                SPListItem it = list.GetItemById(id);
                string title = Str(it, "Title");
                if (status != null)
                {
                    string before = NormStatus(Str(it, "Status"));
                    SetValue(it, "Status", status);
                    if (status == "Published" && !Date(it, "PublishAt").HasValue) SetValue(it, "PublishAt", Iso(DateTime.UtcNow));
                    Audit(status == "Published" ? "Publish" : status == "Archived" ? "Archive" : before == "Published" ? "Unpublish" : "Status", id, title, status);
                }
                if (Has("visibility")) { SetValue(it, "Visibility", BStr("visibility", 20) == "Public" ? "Public" : "Private"); Audit("Visibility", id, title, BStr("visibility", 20)); }
                if (Has("featured")) { SetValue(it, "IsFeatured", BBool("featured")); Audit("Featured", id, title, BBool("featured") ? "بله" : "خیر"); }
                it.Update();
            }
            Flush(false);
            return Ok();
        }

        private object AdminDelete()
        {
            SPList list = UserContentList();
            foreach (int id in BIds("ids"))
            {
                SPListItem it = list.GetItemById(id);
                string title = Str(it, "Title");
                it.Recycle();
                Audit("Delete", id, title, "");
            }
            Flush(false);
            return Ok();
        }

        private object AdminDuplicate()
        {
            SPList list = UserContentList();
            SPListItem src = list.GetItemById(BInt("id"));
            SPListItem it = list.AddItem();
            foreach (string key in new[] { "Summary", "Body", "ThumbnailUrl", "ContentType", "Category", "ReadingMinutes", "AuthorName", "AuthorBio", "AuthorImageUrl", "Visibility", "Tags", "MediaUrl", "AllowComments" })
            {
                Guid g;
                if (cfg.Ids.TryGetValue(key, out g)) it[g] = src[g];
            }
            SetValue(it, "Title", Truncate(Str(src, "Title") + " (کپی)", 255));
            SetValue(it, "Status", "Draft");
            SetValue(it, "IsFeatured", false);
            SetValue(it, "Views", 0);
            SetValue(it, "LikesCount", 0);
            SetValue(it, "CommentsCount", 0);
            it.Update();
            Audit("Duplicate", it.ID, Str(it, "Title"), "از #" + src.ID);
            return new Dictionary<string, object> { { "ok", true }, { "item", AdminGet(it.ID) } };
        }

        // ------------------------------------------------------------------ نظرات (مدیریت)
        private object AdminComments()
        {
            List<CommentRow> all = LoadComments(0);
            Dictionary<int, string> titles = AllEntries().ToDictionary(e => e.Id, e => e.Title);
            string status = Q("status");
            string[] words = Norm(Q("q")).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            List<CommentRow> rows = all.Where(c => (status.Length == 0 || c.Status == status) &&
                (words.Length == 0 || words.All(w => Norm(c.Body + " " + c.Author + " " + (titles.ContainsKey(c.ContentId) ? titles[c.ContentId] : "")).Contains(w)))).ToList();
            Page<CommentRow> page = Paginate(rows, QInt("page"), QInt("size") > 0 ? QInt("size") : 20);
            return new Dictionary<string, object>
            {
                { "items", page.Items.Select(c => { Dictionary<string, object> j = CommentJson(c); j["contentTitle"] = titles.ContainsKey(c.ContentId) ? titles[c.ContentId] : "(حذف‌شده)"; return j; }).ToList() },
                { "total", page.Total }, { "page", page.Number }, { "pages", page.Pages },
                { "counts", new Dictionary<string, object> { { "all", all.Count }, { "Pending", all.Count(c => c.Status == "Pending") }, { "Approved", all.Count(c => c.Status == "Approved") }, { "Hidden", all.Count(c => c.Status == "Hidden") } } }
            };
        }

        private object AdminCommentStatus()
        {
            List<int> ids = BIds("ids");
            string status = BStr("status", 20);
            if (status != "Approved" && status != "Hidden" && status != "Pending") throw new ApiException(400, "وضعیت نامعتبر است.");
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists[CommentsListTitle];
                HashSet<int> contents = new HashSet<int>();
                foreach (int id in ids)
                {
                    try
                    {
                        SPListItem it = list.GetItemById(id);
                        it["Status"] = status;
                        it.Update();
                        contents.Add(Convert.ToInt32(it["ContentId"], CultureInfo.InvariantCulture));
                    }
                    catch (ArgumentException) { }
                }
                foreach (int c in contents) RecountComments(web, c);
            });
            Audit(status == "Approved" ? "CommentApprove" : "CommentHide", 0, "", ids.Count + " نظر");
            return Ok();
        }

        private object AdminCommentDelete()
        {
            List<int> ids = BIds("ids");
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists[CommentsListTitle];
                HashSet<int> contents = new HashSet<int>();
                foreach (int id in ids)
                {
                    try
                    {
                        SPListItem it = list.GetItemById(id);
                        contents.Add(Convert.ToInt32(it["ContentId"], CultureInfo.InvariantCulture));
                        DeleteCommentTree(list, id);
                    }
                    catch (ArgumentException) { }
                }
                foreach (int c in contents) RecountComments(web, c);
            });
            Audit("CommentDelete", 0, "", ids.Count + " نظر");
            return Ok();
        }

        // ------------------------------------------------------------------ دسته‌بندی‌ها
        private object AdminCategories()
        {
            HttpRuntime.Cache.Remove("kb.cats." + webId);
            List<CatRow> cats = Categories();
            Dictionary<string, int> counts = Count(AllEntries().Where(e => e.Category.Length > 0).Select(e => e.Category));
            List<Dictionary<string, object>> items = cats.Select(c => CatJson(c, counts.ContainsKey(c.Title) ? counts[c.Title] : 0)).ToList();
            foreach (KeyValuePair<string, int> p in counts)
                if (!cats.Any(c => c.Title == p.Key)) items.Add(CatJson(new CatRow { Id = 0, Title = p.Key, Icon = "folder", Color = "#475569", Sort = 9999 }, p.Value));
            return new Dictionary<string, object> { { "items", items } };
        }

        private object AdminCategorySave()
        {
            int id = BInt("id");
            string title = BStr("title", 120);
            string oldTitle = BStr("oldTitle", 255);
            if (title.Length == 0) throw new ApiException(400, "عنوان دسته الزامی است.");
            HttpRuntime.Cache.Remove("kb.cats." + webId);
            if (Categories().Any(c => c.Title == title && c.Id != id)) throw new ApiException(400, "دسته‌ای با این عنوان وجود دارد.");
            SPWeb web = SPContext.Current.Web;
            web.AllowUnsafeUpdates = true;
            SPList list = web.Lists[CategoriesListTitle];
            SPListItem it = id > 0 ? list.GetItemById(id) : list.AddItem();
            if (id > 0 && oldTitle.Length == 0) oldTitle = Convert.ToString(it["Title"]);
            it["Title"] = title;
            it["Description"] = BStr("description", 1000);
            it["Icon"] = BStr("icon", 60);
            it["Color"] = BStr("color", 20);
            it["SortOrder"] = BInt("sort");
            it["IsActive"] = !Has("active") || BBool("active");
            it.Update();

            int renamed = 0;
            if (oldTitle.Length > 0 && oldTitle != title && cfg.Ids.ContainsKey("Category"))
            {
                if (cfg.Types["Category"] == "Choice") EnsureChoice("Category", title);
                List<int> ids = AllEntries().Where(e => e.Category == oldTitle).Select(e => e.Id).ToList();
                SPList content = UserContentList();
                foreach (int cid in ids)
                {
                    SPListItem c = content.GetItemById(cid);
                    SetValue(c, "Category", title);
                    c.SystemUpdate(false);
                    renamed++;
                }
            }
            Flush(false);
            Audit("CategorySave", 0, title, renamed > 0 ? "تغییر نام از «" + oldTitle + "» در " + renamed + " محتوا" : "");
            CatRow row = CatFromItem(it);
            return new Dictionary<string, object> { { "ok", true }, { "item", CatJson(row, AllEntries().Count(e => e.Category == title)) } };
        }

        private object AdminCategoryDelete()
        {
            int id = BInt("id");
            SPWeb web = SPContext.Current.Web;
            web.AllowUnsafeUpdates = true;
            SPListItem it = web.Lists[CategoriesListTitle].GetItemById(id);
            string title = Convert.ToString(it["Title"]);
            int used = AllEntries().Count(e => e.Category == title);
            if (used > 0) throw new ApiException(400, "این دسته در " + used + " محتوا استفاده شده و قابل حذف نیست.");
            it.Recycle();
            Flush(false);
            Audit("CategoryDelete", 0, title, "");
            return Ok();
        }

        // ------------------------------------------------------------------ تنظیمات و گزارش فعالیت (مدیر سامانه)
        private object AdminSettings()
        {
            Dictionary<string, object> s = new Dictionary<string, object>();
            foreach (string k in EditableSettingKeys) s[k] = Setting(cfg, k, "");
            return new Dictionary<string, object> { { "settings", s } };
        }

        private object AdminSettingsSave()
        {
            Dictionary<string, object> values = null;
            object v;
            if (body.TryGetValue("settings", out v)) values = v as Dictionary<string, object>;
            if (values == null) throw new ApiException(400, "داده‌ی نامعتبر.");
            List<string> changed = new List<string>();
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists[SettingsListTitle];
                foreach (string key in EditableSettingKeys)
                {
                    if (!values.ContainsKey(key)) continue;
                    string value = Convert.ToString(values[key]) ?? "";
                    if (value.Length > 4000) value = value.Substring(0, 4000);
                    SPQuery q = new SPQuery();
                    q.Query = "<Where>" + Caml("Title", "Text", key) + "</Where>";
                    q.RowLimit = 1;
                    SPListItemCollection found = list.GetItems(q);
                    SPListItem it = found.Count > 0 ? found[0] : list.AddItem();
                    if (found.Count > 0 && Convert.ToString(it["Value"]) == value) continue;
                    it["Title"] = key;
                    it["Value"] = value;
                    it.Update();
                    changed.Add(key);
                }
            });
            Flush(true);
            if (changed.Count > 0) Audit("Settings", 0, "", string.Join("، ", changed.ToArray()));
            return Ok();
        }

        private void Audit(string action, int contentId, string title, string details)
        {
            try
            {
                string actor = user != null ? user.Name : "";
                Elevated(delegate (SPWeb web)
                {
                    SPList list = web.Lists.TryGetList(AuditListTitle);
                    if (list == null) return;
                    SPListItem it = list.AddItem();
                    it["Title"] = Truncate(title ?? "", 255);
                    it["Action"] = action;
                    it["ContentId"] = contentId;
                    it["Actor"] = Truncate(actor, 255);
                    it["Details"] = details ?? "";
                    it.Update();
                });
            }
            catch (Exception ex) { Log(ex); }
        }

        private object AdminAudit()
        {
            List<Dictionary<string, object>> rows = new List<Dictionary<string, object>>();
            Elevated(delegate (SPWeb web)
            {
                SPList list = web.Lists.TryGetList(AuditListTitle);
                if (list == null) return;
                SPQuery q = new SPQuery();
                q.Query = "<OrderBy><FieldRef Name='ID' Ascending='FALSE' /></OrderBy>";
                q.RowLimit = 3000;
                foreach (SPListItem it in list.GetItems(q))
                {
                    DateTime created = DateTime.UtcNow;
                    try { created = ToUtc((DateTime)it[SPBuiltInFieldId.Created]); } catch { }
                    rows.Add(new Dictionary<string, object>
                    {
                        { "date", Iso(created) }, { "actor", Convert.ToString(it["Actor"]) }, { "action", Convert.ToString(it["Action"]) },
                        { "contentId", Convert.ToInt32(it["ContentId"] ?? 0, CultureInfo.InvariantCulture) }, { "title", Convert.ToString(it["Title"]) }, { "details", Convert.ToString(it["Details"]) }
                    });
                }
            });
            string[] words = Norm(Q("q")).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (words.Length > 0) rows = rows.Where(r => words.All(w => Norm(r["actor"] + " " + r["action"] + " " + r["title"] + " " + r["details"]).Contains(w))).ToList();
            Page<Dictionary<string, object>> page = Paginate(rows, QInt("page"), QInt("size") > 0 ? QInt("size") : 30);
            return new Dictionary<string, object> { { "items", page.Items }, { "total", page.Total }, { "page", page.Number }, { "pages", page.Pages } };
        }

        // ------------------------------------------------------------------ ابزار
        private static string Truncate(string s, int max) { s = s ?? ""; return s.Length <= max ? s : s.Substring(0, max); }

        private static void Log(Exception ex)
        {
            try
            {
                SPDiagnosticsService.Local.WriteTrace(0, new SPDiagnosticsCategory("ShastanKB", TraceSeverity.Unexpected, EventSeverity.Error),
                    TraceSeverity.Unexpected, "Shastan KB error: {0}", new object[] { ex.ToString() });
            }
            catch { }
        }
    }
}
