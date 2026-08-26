export interface TeamInvitationNotifier {
  send(input: {
    to: string;
    organizationName: string;
    inviterName: string;
    roleName: string;
    inviteUrl: string;
    expiresAt: Date;
  }): Promise<boolean>;
}
