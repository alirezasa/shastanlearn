<%@ Page Language="C#" MasterPageFile="~sitecollection/_catalogs/masterpage/kb.master" Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=16.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%-- صفحه‌ی پنل در کتابخانه‌ی KBPanel است که دسترسی ناشناس ندارد؛ باز کردن آن بدون ورود، صفحه‌ی ورود را نشان می‌دهد. --%>
<asp:Content ContentPlaceHolderID="PlaceHolderPageTitle" runat="server">پنل مدیریت محتوا</asp:Content>
<asp:Content ContentPlaceHolderID="PlaceHolderAdditionalPageHead" runat="server"><meta name="robots" content="noindex"></asp:Content>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server"><div data-kb-page="panel"></div></asp:Content>
<asp:Content ContentPlaceHolderID="PlaceHolderKBScripts" runat="server">
  <script src="{{site}}/KBAssets/js/kb-editor.js?v={{v}}"></script>
  <script src="{{site}}/KBAssets/js/kb-panel.js?v={{v}}"></script>
</asp:Content>
