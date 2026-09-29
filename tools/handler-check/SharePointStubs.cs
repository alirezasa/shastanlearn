// حداقل امضای کلاس‌های شیرپوینت که KBApi.ashx استفاده می‌کند — فقط برای بررسی کامپایل (C# 5) بیرون از سرور.
// پیاده‌سازی ندارند و در استقرار استفاده نمی‌شوند.  اجرا: bash tools/handler-check/check.sh
#pragma warning disable 0067, 0649
using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;

namespace Microsoft.SharePoint
{
    public enum SPUrlZone { Default, Intranet, Internet, Custom, Extranet }
    [Flags] public enum SPBasePermissions : ulong { EmptyMask = 0, ViewListItems = 1, AddListItems = 2, EditListItems = 4, ManageLists = 2048, ManageWeb = 1073741824, FullMask = ulong.MaxValue }
    public class SPException : Exception { }
    public class SPContext { public static SPContext Current { get { return null; } } public SPWeb Web { get { return null; } } public SPSite Site { get { return null; } } }
    public class SPSite : IDisposable
    {
        public SPSite(Guid id, SPUrlZone zone) { }
        public Guid ID { get { return Guid.Empty; } }
        public SPUrlZone Zone { get { return SPUrlZone.Default; } }
        public SPWeb OpenWeb(Guid id) { return null; }
        public Microsoft.SharePoint.Administration.SPWebApplication WebApplication { get { return null; } }
        public void Dispose() { }
    }
    public class SPWeb : IDisposable
    {
        public Guid ID { get { return Guid.Empty; } }
        public SPUser CurrentUser { get { return null; } }
        public SPRegionalSettings RegionalSettings { get { return null; } }
        public SPListCollection Lists { get { return null; } }
        public bool AllowUnsafeUpdates { get; set; }
        public string ServerRelativeUrl { get { return ""; } }
        public SPSite Site { get { return null; } }
        public bool DoesUserHavePermissions(SPBasePermissions p) { return false; }
        public SPFile GetFile(string url) { return null; }
        public void Dispose() { }
    }
    public class SPUser { public string LoginName { get { return ""; } } public string Name { get { return ""; } } public string Email { get { return ""; } } }
    public class SPRegionalSettings { public SPTimeZone TimeZone { get { return null; } } }
    public class SPTimeZone { public DateTime LocalTimeToUTC(DateTime d) { return d; } public DateTime UTCToLocalTime(DateTime d) { return d; } }
    public class SPListCollection { public SPList TryGetList(string t) { return null; } public SPList this[string t] { get { return null; } } public SPList this[Guid g] { get { return null; } } }
    public class SPList
    {
        public string Title { get { return ""; } }
        public SPFieldCollection Fields { get { return null; } }
        public SPFolder RootFolder { get { return null; } }
        public SPListItemCollection Items { get { return null; } }
        public SPListItemCollection GetItems(SPQuery q) { return null; }
        public SPListItem GetItemById(int id) { return null; }
        public SPListItem AddItem() { return null; }
        public bool DoesUserHavePermissions(SPBasePermissions p) { return false; }
    }
    public class SPFolder { public string ServerRelativeUrl { get { return ""; } } }
    public class SPFieldCollection { public SPField GetFieldByInternalName(string n) { return null; } public SPField this[Guid g] { get { return null; } } }
    public class SPField { public Guid Id { get { return Guid.Empty; } } public string InternalName { get { return ""; } } public string TypeAsString { get { return ""; } } public void Update() { } }
    public class SPFieldMultiChoice : SPField { public StringCollection Choices { get { return null; } } }
    public class SPFieldChoice : SPFieldMultiChoice { }
    public class SPFieldLookup : SPField { public string LookupList { get { return ""; } } public string LookupField { get { return ""; } } }
    public class SPListItem
    {
        public int ID { get { return 0; } }
        public object this[string n] { get { return null; } set { } }
        public object this[Guid g] { get { return null; } set { } }
        public SPAttachmentCollection Attachments { get { return null; } }
        public void Update() { }
        public void SystemUpdate(bool incrementVersion) { }
        public void Delete() { }
        public Guid Recycle() { return Guid.Empty; }
    }
    public class SPAttachmentCollection : IEnumerable { public string UrlPrefix { get { return ""; } } public IEnumerator GetEnumerator() { return null; } }
    public class SPListItemCollection : IEnumerable
    {
        public int Count { get { return 0; } }
        public SPListItem this[int i] { get { return null; } }
        public SPListItemCollectionPosition ListItemCollectionPosition { get { return null; } }
        public IEnumerator GetEnumerator() { return null; }
    }
    public class SPListItemCollectionPosition { }
    public class SPQuery
    {
        public string Query { get; set; }
        public string ViewFields { get; set; }
        public bool ViewFieldsOnly { get; set; }
        public uint RowLimit { get; set; }
        public string ViewAttributes { get; set; }
        public SPListItemCollectionPosition ListItemCollectionPosition { get; set; }
    }
    public class SPFile { public bool Exists { get { return false; } } public long Length { get { return 0; } } public Stream OpenBinaryStream() { return null; } }
    public class SPFieldUrlValue { public SPFieldUrlValue() { } public SPFieldUrlValue(string s) { } public string Url { get; set; } public string Description { get; set; } }
    public class SPFieldLookupValue { public SPFieldLookupValue(string s) { } public SPFieldLookupValue(int id, string v) { } public string LookupValue { get { return ""; } } public int LookupId { get { return 0; } } }
    public class SPFieldLookupValueCollection : List<SPFieldLookupValue> { public SPFieldLookupValueCollection(string s) { } }
    public static class SPBuiltInFieldId { public static readonly Guid Created, Modified, Author, Editor, Attachments; }
    public delegate void CodeToRunElevated();
    public static class SPSecurity { public static void RunWithElevatedPrivileges(CodeToRunElevated code) { } }
}
namespace Microsoft.SharePoint.Administration
{
    public class SPWebApplication { public int MaximumFileSize { get { return 0; } } }
    public enum TraceSeverity { None, Unexpected, Monitorable, High, Medium, Verbose }
    public enum EventSeverity { None, Error, Warning, Information }
    public class SPDiagnosticsCategory { public SPDiagnosticsCategory(string n, TraceSeverity t, EventSeverity e) { } }
    public class SPDiagnosticsService { public static SPDiagnosticsService Local { get { return null; } } public void WriteTrace(uint id, SPDiagnosticsCategory c, TraceSeverity s, string f, params object[] d) { } }
}
namespace Microsoft.SharePoint.Utilities
{
    public static class SPUtility
    {
        public static bool IsEmailServerSet(Microsoft.SharePoint.SPWeb web) { return false; }
        public static bool SendEmail(Microsoft.SharePoint.SPWeb web, bool appendHtmlTag, bool htmlEncode, string to, string subject, string htmlBody) { return false; }
    }
    public static class SPEncode { public static string HtmlEncode(string s) { return s; } }
}
