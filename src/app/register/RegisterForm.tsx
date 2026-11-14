"use client";

import Link from "next/link";
import { useEffect, useRef, useState, version as reactVersion } from "react";
import { checkPasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import {
  SIGNUP_FORM_MIN_FILL_MS,
  SIGNUP_FORM_TOKEN_FIELD,
  SIGNUP_FORM_TRAP_FIELD,
} from "@/lib/auth/signup-guard-fields";

const PASSWORD_MIN = PASSWORD_MIN_LENGTH;

/** A little past the server's minimum, so the server's clock never sees a press as early. */
const HOLD_UNTIL_MS = SIGNUP_FORM_MIN_FILL_MS + 500;

const TRAP_ID = "register-website";

/**
 * `inert` takes the trap out of the Tab order, a screen reader's reach, iOS's previous and
 * next field arrows, and find-in-page. The pages run the React that Next bundles (19), where
 * `inert` is true or false and an empty string turns it off; React 18, which the unit tests
 * run, knows no `inert` and passes a string through as it is. Either way the page gets
 * `inert=""`, from its first paint.
 */
const INERT = (Number.parseInt(reactVersion, 10) >= 19 ? { inert: true } : { inert: "" }) as Record<
  string,
  boolean | string
>;

export type RegisterFormLabels = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  passwordRequirements: string;
  submit: string;
  show: string;
  hide: string;
  weakPassword: string;
  mismatch: string;
  privacyBefore: string;
  privacyLink: string;
  privacyAfter: string;
  /** The trap field's label, seen only where the page's styles never load. */
  leaveEmpty: string;
};

export type RegisterErrorField = "email" | "password" | "passwordConfirm";

function isStrongPassword(value: string): boolean {
  return checkPasswordStrength(value) === null;
}

type ValidationKind = "weak" | "mismatch";

const SERVER_ERROR_ID = "register-error";

export function RegisterForm({
  labels,
  formToken,
  next,
  values,
  error,
  errorField,
}: {
  labels: RegisterFormLabels;
  /** The server's signed note of when this copy of the form was made. */
  formToken?: string;
  next?: string;
  /** What the reader typed, apart from the passwords, when a failure sent them back. */
  values?: { firstName?: string; lastName?: string; email?: string };
  /** A failure the server sent the reader back with. */
  error?: string | null;
  /** The field that failure belongs to, when it belongs to one. */
  errorField?: RegisterErrorField;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  // Validation kicks in only after the user has interacted with the password
  // fields. The requirements message is hidden by default and surfaces only
  // when a constraint is broken — never as a passive hint.
  const [touched, setTouched] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  // When the form appeared, and a press being held until it has been up long enough.
  const shownAt = useRef<number | null>(null);
  const heldSubmit = useRef<number | null>(null);

  // The server turns away a form sent back within SIGNUP_FORM_MIN_FILL_MS of being made,
  // as only a script is that quick. Should a person with everything filled in for them
  // ever be that quick, their press is held here until then, rather than sending them
  // back to type their password again.
  useEffect(() => {
    shownAt.current = Date.now();
    return () => {
      if (heldSubmit.current !== null) window.clearTimeout(heldSubmit.current);
    };
  }, []);

  // These two fields have no value prop, so hydration cannot wipe what a reader or a
  // password manager put in them while the page's script was still on its way. This
  // picks that up, since the checks below read the state.
  useEffect(() => {
    if (passwordRef.current?.value) setPassword(passwordRef.current.value);
    if (confirmRef.current?.value) setPasswordConfirm(confirmRef.current.value);
  }, []);

  // The server redirects back with the failure in the URL, so the message is on
  // the page from first paint and a live region stays silent. Focusing the field
  // it belongs to makes a screen reader read the field with its error. The
  // browser's own scroll on focus centres the field, which at enlarged text put
  // the message above it off the screen, so the message and then the field are
  // each brought only as far as needed to be seen, below the sticky header. A
  // message too long to share the screen leaves the field in view, with the end of
  // the message directly above it.
  useEffect(() => {
    if (!error) return;
    const target =
      errorField === "email"
        ? emailRef
        : errorField === "password"
          ? passwordRef
          : errorField === "passwordConfirm"
            ? confirmRef
            : firstNameRef;
    const field = target.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    document.getElementById(SERVER_ERROR_ID)?.scrollIntoView?.({ block: "nearest" });
    field.scrollIntoView?.({ block: "nearest" });
  }, [error, errorField]);

  const validation: ValidationKind | null = (() => {
    if (!touched) return null;
    if (password.length === 0) return null;
    if (!isStrongPassword(password)) return "weak";
    if (passwordConfirm.length > 0 && password !== passwordConfirm) return "mismatch";
    return null;
  })();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setTouched(true);
    if (!isStrongPassword(password)) {
      event.preventDefault();
      passwordRef.current?.focus();
      return;
    }
    if (password !== passwordConfirm) {
      event.preventDefault();
      confirmRef.current?.focus();
      return;
    }
    const wait = shownAt.current === null ? 0 : shownAt.current + HOLD_UNTIL_MS - Date.now();
    if (wait > 0) {
      event.preventDefault();
      // A second press while one is held sends nothing more.
      if (heldSubmit.current !== null) return;
      const form = event.currentTarget;
      heldSubmit.current = window.setTimeout(() => {
        heldSubmit.current = null;
        // requestSubmit passes through this handler again; the older submit() does not.
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
      }, wait);
    }
  }

  // The server's verdict on a field stands until the reader's own edit has been
  // checked here, so a field is never marked invalid for two reasons at once.
  const serverInvalid = (field: RegisterErrorField) =>
    error && errorField === field && !validation
      ? { "aria-invalid": true, "aria-describedby": SERVER_ERROR_ID }
      : null;

  // A failure that belongs to a field stands directly above that field, so the two
  // are read in order and fit on one screen together at any text size. One that
  // belongs to no field heads the form.
  const noticeAbove = (field: RegisterErrorField | undefined) =>
    error && errorField === field ? (
      <p id={SERVER_ERROR_ID} role="alert" className="vf-notice vf-notice-error">
        {error}
      </p>
    ) : null;

  return (
    <form method="post" action="/api/auth/register" className="vf-form" onSubmit={handleSubmit}>
      {/* Where to land after registering — set when an account-gated control
          (e.g. Favorite on a parish) sent the visitor here. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formToken ? <input type="hidden" name={SIGNUP_FORM_TOKEN_FIELD} value={formToken} /> : null}
      {noticeAbove(undefined)}
      <div className="vf-field-pair">
        <div>
          <label htmlFor="firstName" className="vf-label">
            {labels.firstName}
          </label>
          <input
            ref={firstNameRef}
            id="firstName"
            name="firstName"
            type="text"
            required
            className="vf-input"
            autoComplete="given-name"
            autoCapitalize="words"
            maxLength={80}
            defaultValue={values?.firstName}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="vf-label">
            {labels.lastName}
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            className="vf-input"
            autoComplete="family-name"
            autoCapitalize="words"
            maxLength={80}
            defaultValue={values?.lastName}
          />
        </div>
      </div>

      {/* A box only a machine fills in: a post with anything in it makes no account. A
          person never meets it. It is off the screen (not display:none, which such
          machines know to pass over), inert and aria-hidden so neither the Tab key nor a
          screen reader reaches it, and kept from browsers' and password managers'
          autofill. It sits between the names and the email so that no password manager
          takes it for the username before the password. Its label is seen only where the
          page's styles never load. */}
      <div className="vf-form-trap" aria-hidden="true" {...INERT}>
        <label htmlFor={TRAP_ID}>{labels.leaveEmpty}</label>
        <input
          id={TRAP_ID}
          name={SIGNUP_FORM_TRAP_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore=""
          data-form-type="other"
          defaultValue=""
        />
      </div>

      {noticeAbove("email")}
      <div>
        <label htmlFor="email" className="vf-label">
          {labels.email}
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          required
          className="vf-input"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={200}
          defaultValue={values?.email}
          {...serverInvalid("email")}
        />
      </div>

      {noticeAbove("password")}
      <div className="vf-field-split">
        <label htmlFor="password" className="vf-label">
          {labels.password}
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={PASSWORD_MIN}
          aria-describedby={validation === "weak" ? "password-error" : undefined}
          aria-invalid={validation === "weak"}
          className="vf-input"
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          {...serverInvalid("password")}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="vf-field-toggle vf-link-action"
        >
          {showPassword ? labels.hide : labels.show}
        </button>
        {validation === "weak" ? (
          <p id="password-error" role="alert" className="vf-field-error">
            {labels.weakPassword}
          </p>
        ) : null}
      </div>

      {noticeAbove("passwordConfirm")}
      <div>
        <label htmlFor="passwordConfirm" className="vf-label">
          {labels.passwordConfirm}
        </label>
        <input
          ref={confirmRef}
          id="passwordConfirm"
          name="passwordConfirm"
          type={showPassword ? "text" : "password"}
          required
          minLength={PASSWORD_MIN}
          aria-describedby={validation === "mismatch" ? "passwordConfirm-error" : undefined}
          aria-invalid={validation === "mismatch"}
          className="vf-input"
          autoComplete="new-password"
          onChange={(e) => setPasswordConfirm(e.target.value)}
          onBlur={() => setTouched(true)}
          {...serverInvalid("passwordConfirm")}
        />
        {validation === "mismatch" ? (
          <p id="passwordConfirm-error" role="alert" className="vf-field-error">
            {labels.mismatch}
          </p>
        ) : null}
      </div>

      <p className="vf-form-note" data-testid="register-privacy-notice">
        {labels.privacyBefore}
        <Link href="/privacy" className="vf-link">
          {labels.privacyLink}
        </Link>
        {labels.privacyAfter}
      </p>

      <button type="submit" className="vf-btn vf-btn-primary vf-btn-block">
        {labels.submit}
      </button>
    </form>
  );
}
