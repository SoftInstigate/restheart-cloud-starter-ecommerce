export const environment = {
  // TODO: point this at the service that has the `stripe` plugin enabled.
  apiUrl: 'https://acac36.eu-central-1-free-1.restheart.com',

  /**
   * Collection names are configured per service
   * (`stripeConfig.products.catalog-collection` / `.orders-collection`), and the
   * interceptors match on the *configured* name — so the HTTP path really does
   * change if a deployment renamed them. These are the defaults the service
   * uses when it hasn't.
   */
  catalogCollection: 'catalog',
  catalogOrdersCollection: 'orders',

  features: {
    emailRegistration: true,
    passwordReset: true,
    oauthLogin: true,
    oauthProviders: ['google'] as const,
    teamInvitations: true,
  },
};
