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
