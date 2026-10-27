import * as Linking from 'expo-linking';

/** The deep-link path that opens AcceptInvitation; `sora://invite?token=…` in a release build. */
export const INVITATION_LINK_PATH = 'invite';

export function invitationLink(token: string): string {
  return Linking.createURL(INVITATION_LINK_PATH, { queryParams: { token } });
}
