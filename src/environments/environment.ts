export const environment = {
  apiUrl: 'https://acac36.eu-central-1-free-1.restheart.com',
  features: {
    emailRegistration: true,
    passwordReset: true,
    oauthLogin: true,
    oauthProviders: ['google'] as const,
    teamInvitations: true,
  },
};
