export const GTM_API_SCOPES = [
  "https://www.googleapis.com/auth/tagmanager.manage.accounts",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.delete.containers",
  "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
  "https://www.googleapis.com/auth/tagmanager.manage.users",
  "https://www.googleapis.com/auth/tagmanager.publish",
  "https://www.googleapis.com/auth/tagmanager.readonly",
];

export const GTM_OAUTH_SCOPES = ["email", "profile", ...GTM_API_SCOPES];

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_AUTHORIZE_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
