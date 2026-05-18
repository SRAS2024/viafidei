export {
  sendTransactionalEmail,
  isEmailConfigured,
  type SendEmailInput,
  type SendEmailResult,
} from "./resend";
export { buildPasswordResetLink, buildEmailVerificationLink, getAppBaseUrl } from "./links";
export {
  renderPasswordResetEmail,
  renderEmailVerificationEmail,
  renderWelcomeEmail,
  SITE_NAME,
  SITE_URL_DEFAULT,
  type RenderedEmail,
  type WelcomeEmailParams,
  type PasswordResetParams,
  type EmailVerificationParams,
} from "./templates";
export {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendAccountEmail,
} from "./send";
export { resolveEmailLocale, translateEmail, type EmailLocale } from "./translations";
export {
  readAdminEmail,
  sendBiweeklyAdminReport,
  sendMonthlyArchiveCleanupReport,
  sendMonthlySourceQualityReport,
  sendMonthlyDataManagementReport,
  sendThresholdMilestoneAlert,
  sendCriticalFailureAlert,
  sendSecurityBreachAlert,
  sendSuspiciousActivityAlert,
  sendMonthlyErrorReport,
  type ContentManagementCounts,
  type AdminSendOutcome,
  type IngestionHealthSummary,
  type ContentQASummary,
  type SourceQualityRow,
  type StrictQAHealthSummary,
  type CleanupCategoryCounts,
  type DataManagementReportData,
} from "./admin-send";
export {
  renderAdminEmail,
  formatAdded,
  formatDeleted,
  formatPlain,
  CONTENT_TYPE_ROWS,
  type AdminEmailSection,
} from "./admin-templates";
export { buildTextPdfBase64 } from "./pdf";
