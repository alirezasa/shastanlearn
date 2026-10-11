<%@ Assembly Name="Microsoft.SharePoint.IdentityModel, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Assembly Name="Microsoft.SharePoint, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Page Language="C#" AutoEventWireup="false" Inherits="Microsoft.SharePoint.IdentityModel.Pages.FormsSignInPage" %>
<%@ Import Namespace="Microsoft.SharePoint" %>
<%--
  صفحه‌ی ورود اختصاصی پایگاه دانش شستان (FBA + LdapMembershipProvider روی Active Directory)
  محل: 16\TEMPLATE\LAYOUTS\KB\login.aspx  →  https://<site>/_layouts/15/KB/login.aspx
  تنظیم: Set-KBFormsAuth.ps1 (یا Central Admin → Authentication Providers → Sign In Page URL).
  کلاس پایه (FormsSignInPage) کنترل asp:Login با شناسه‌ی signInControl را پیدا می‌کند، احراز هویت را انجام می‌دهد و
  کاربر را به نشانی Source/ReturnUrl برمی‌گرداند؛ این صفحه فقط ظاهر را تعیین می‌کند.
--%>
<script runat="server">
  // مسیر سایت پایگاه دانش برای فایل‌های قالب و پیوندها (KBAssets، KBPages)
  protected string KbRoot()
  {
    try { return SPContext.Current.Web.ServerRelativeUrl.TrimEnd('/'); } catch { return ""; }
  }
  protected string WindowsSignInUrl()
  {
    string back = Request.QueryString["ReturnUrl"] ?? Request.QueryString["Source"] ?? (KbRoot() + "/");
    return "/_windows/default.aspx?ReturnUrl=" + HttpUtility.UrlEncode(back);
  }
</script>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head runat="server">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#008000">
  <title>ورود | پایگاه دانش شستان</title>
  <link rel="icon" type="image/svg+xml" href="<%= KbRoot() %>/KBAssets/img/logo-mark.svg">
  <link rel="stylesheet" href="<%= KbRoot() %>/KBAssets/css/kb.css">
</head>
<body class="kb-body">
<div id="kb-app">
  <div class="kb-auth">
    <aside class="kb-auth-side">
      <a class="kb-logo" href="<%= KbRoot() %>/"><span class="kb-logo-mark"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg></span><span><b>پایگاه دانش شستان</b><small>شرکت سرمایه‌گذاری تجاری شستان</small></span></a>
      <div>
        <h2>به پایگاه دانش خوش آمدید</h2>
        <ul class="kb-auth-points">
          <li><span><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><div><b>محتوای ویژه‌ی اعضا</b>راهنماها، اسناد و آموزش‌هایی که فقط پس از ورود در دسترس است</div></li>
          <li><span><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg></span><div><b>ذخیره و پیگیری</b>مطالب را برای مطالعه‌ی بعدی ذخیره کنید</div></li>
          <li><span><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg></span><div><b>گفت‌وگو و پرسش</b>نظر بدهید و از کارشناسان پاسخ بگیرید</div></li>
        </ul>
      </div>
      <p class="kb-auth-foot">ورود با حساب سازمانی (Active Directory)؛ رمز عبور شما در پایگاه دانش ذخیره نمی‌شود.</p>
    </aside>

    <main class="kb-auth-main">
      <div class="kb-auth-card">
        <a class="kb-logo kb-auth-mlogo" href="<%= KbRoot() %>/"><span class="kb-logo-mark"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg></span><span><b>پایگاه دانش شستان</b></span></a>
        <h1>ورود به پایگاه دانش</h1>
        <p class="kb-muted">با نام کاربری و رمز عبور سازمانی وارد شوید.</p>

        <form id="form1" runat="server" class="kb-auth-form" autocomplete="on">
          <asp:Login ID="signInControl" runat="server" RenderOuterTable="false" FailureText="نام کاربری یا رمز عبور نادرست است." DisplayRememberMe="true">
            <LayoutTemplate>
              <asp:Panel runat="server" DefaultButton="login">
                <div class="kb-alert kb-alert-error kb-login-error" role="alert"><asp:Literal ID="FailureText" runat="server" EnableViewState="false" /></div>
                <div class="kb-field">
                  <asp:Label runat="server" AssociatedControlID="UserName" CssClass="kb-label" Text="نام کاربری" />
                  <div class="kb-auth-input"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><asp:TextBox ID="UserName" runat="server" CssClass="kb-input kb-input-ltr" autocomplete="username" autofocus="autofocus" aria-describedby="kb-user-hint" /></div>
                  <span id="kb-user-hint" class="kb-hint">بدون نام دامنه؛ مثال: a.rezaei</span>
                  <asp:RequiredFieldValidator runat="server" ControlToValidate="UserName" Display="Dynamic" CssClass="kb-error" ErrorMessage="نام کاربری را وارد کنید." />
                </div>
                <div class="kb-field">
                  <asp:Label runat="server" AssociatedControlID="Password" CssClass="kb-label" Text="رمز عبور" />
                  <div class="kb-auth-input"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg><asp:TextBox ID="Password" runat="server" TextMode="Password" CssClass="kb-input kb-input-ltr" autocomplete="current-password" />
                    <button type="button" class="kb-auth-eye" onclick="kbTogglePassword(this)" aria-label="نمایش رمز عبور"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg></button></div>
                  <asp:RequiredFieldValidator runat="server" ControlToValidate="Password" Display="Dynamic" CssClass="kb-error" ErrorMessage="رمز عبور را وارد کنید." />
                </div>
                <div class="kb-row" style="justify-content:space-between;margin-bottom:18px">
                  <label class="kb-check"><asp:CheckBox ID="RememberMe" runat="server" /> مرا به خاطر بسپار</label>
                  <span class="kb-hint" style="margin:0">فراموشی رمز: تماس با واحد فناوری اطلاعات</span>
                </div>
                <asp:Button ID="login" runat="server" CommandName="Login" Text="ورود" CssClass="kb-btn kb-btn-brand kb-btn-lg kb-auth-submit" />
              </asp:Panel>
            </LayoutTemplate>
          </asp:Login>
        </form>

        <div class="kb-auth-alt">
          <a class="kb-btn kb-btn-ghost" href="<%= KbRoot() %>/KBPages/register.aspx"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>ثبت‌نام کاربر جدید</a>
          <a class="kb-btn kb-btn-ghost" href="<%= WindowsSignInUrl() %>"><svg class="kb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>ورود خودکار در شبکه‌ی داخلی</a>
        </div>
        <div class="kb-auth-links">
          <a href="<%= KbRoot() %>/KBPages/register.aspx#status"><svg class="kb-ico kb-ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 11 2 2 4-4"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> پیگیری درخواست ثبت‌نام</a>
          <a href="<%= KbRoot() %>/"><svg class="kb-ico kb-ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg> بازگشت به پایگاه دانش</a>
        </div>
      </div>
    </main>
  </div>
</div>
<script>
  function kbTogglePassword(btn) {
    var p = btn.parentNode.querySelector('input');
    var show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
    btn.classList.toggle('is-on', show);
  }
</script>
</body>
</html>
