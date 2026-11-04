import { OAuth2Client } from "google-auth-library";

let client;

// Verifies the ID token (signature, expiry, audience) and returns its payload.
export async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google sign-in is not configured");
  }

  client ||= new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  return ticket.getPayload();
}
