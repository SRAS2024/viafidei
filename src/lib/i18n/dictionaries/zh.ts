import type { Dict } from "./types";
import { en } from "./en";

export const zh: Dict = {
  ...en,
  "brand.tagline": "信仰之路",
  "nav.home": "首页",
  "nav.prayers": "祈祷文",
  "nav.saints": "圣人与圣母",
  "nav.login": "登录",
  "parishes.distanceAway": "距您{distance}",
  "parishes.locate.button": "使用我的位置",
  "parishes.locate.locating": "正在查找您附近的堂区…",
  "parishes.locate.tryAgain": "重试",
  "parishes.locate.howTo": "如何开启定位",
  "parishes.locate.blocked":
    "您的浏览器已阻止此网站使用位置信息，因此无法向您询问。请允许后再试一次。",
  "parishes.locate.notShared":
    "您的设备没有共享位置。如果您没有看到询问，可能是浏览器的定位服务已关闭。",
  "parishes.locate.timeout": "您的设备查找位置的时间过长。请确认定位服务已开启，然后再试一次。",
  "parishes.locate.unavailable":
    "您的设备目前无法确定您的位置。请确认定位服务已开启，然后再试一次。",
  "parishes.locate.unsupported": "此浏览器无法共享您的位置。您仍可浏览下方的目录。",
  "parishes.locate.insecure": "定位功能仅在安全连接下可用。请通过 https 打开此页面后再试一次。",
  "parishes.locate.lookupFailed": "无法加载您附近的堂区。下方的目录仍可使用。",
  "parishes.locate.steps.iosSafariSettings":
    "打开“设置”›“隐私与安全性”›“定位服务”，确认已开启，然后轻点“Safari 浏览器网站”，选择“使用 App 期间”。",
  "parishes.locate.steps.iosSafariSite":
    "在 Safari 浏览器中，轻点地址栏中的“aA”›“网站设置”›“位置”，然后选择“询问”或“允许”。",
  "parishes.locate.steps.iosOtherSettings":
    "打开“设置”›“隐私与安全性”›“定位服务”，确认已开启，然后轻点您正在使用的浏览器或 App，选择“使用 App 期间”。",
  "parishes.locate.steps.androidSite": "轻点网址左侧的图标 ›“权限”›“位置信息”，然后选择“允许”。",
  "parishes.locate.steps.androidDevice": "请确认手机快捷设置中的“位置信息”已开启。",
  "parishes.locate.steps.macSafariSite":
    "在 Safari 浏览器中，打开“Safari 浏览器”›“设置”›“网站”›“位置”，然后为此网站选择“询问”或“允许”。",
  "parishes.locate.steps.desktopSite": "点击地址栏中的位置图标或锁形图标，允许此网站使用位置信息。",
  "parishes.locate.steps.desktopDevice":
    "如果电脑已关闭定位，请在隐私设置中开启（Mac：“系统设置”›“隐私与安全性”›“定位服务”）。",
  "listSearch.submit": "搜索",
  "listSearch.clear": "清除搜索",
  "listSearch.results.other": "“{query}”共有 {count} 个结果",
  "listSearch.none": "没有与“{query}”匹配的内容。",
  "listSearch.noneHint": "请尝试减少关键词或换一种拼写。",
  "listSearch.prayers": "搜索祈祷文",
  "listSearch.litanies": "搜索祷文",
  "listSearch.saints": "搜索圣人",
  "listSearch.ourLady": "搜索圣母称号与显现",
  "listSearch.doctors": "搜索教会圣师",
  "listSearch.popes": "搜索教宗",
  "listSearch.parishes": "按名称、城市或邮政编码搜索",
  "listSearch.parishesPlaceholder": "名称、城市或邮政编码",
  "listSearch.spiritualLife": "搜索灵修操练",
  "listSearch.guides": "搜索指南",
  "listSearch.liturgy": "搜索礼仪",
  "listSearch.rites": "搜索礼仪传统",
  "listSearch.churchDocuments": "搜索教会文献",
  "listSearch.devotions": "搜索敬礼",
  "listSearch.novenas": "搜索九日敬礼",
  "admin.loading.greeting": "欢迎！",
  "admin.login.title": "管理员登录",
  "admin.login.submit": "进入",
  "admin.dashboard.title": "管理面板",
  "admin.signOut": "退出管理",
  "admin.welcomeLine": "您已以管理员身份登录。",
  "common.loading": "加载中",
};
