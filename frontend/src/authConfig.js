export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ZOELIBRARYAPP_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI || 'http://localhost:3002',
    postLogoutRedirectUri: import.meta.env.VITE_ZOELIBRARYAPP_AZURE_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3002',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  }
}

// Requests a token for OUR OWN API (see backend token_required()), not for
// Microsoft Graph. This requires the "access_as_user" scope to be exposed
// on this app registration (Entra Portal -> App registrations -> this app
// -> Expose an API -> Add a scope). A Graph scope like 'User.Read' would
// produce a token whose audience is Graph, which the backend can never
// validate as its own.
export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID}/access_as_user`]
}
