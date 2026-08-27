/**
 * Porta estreita: "esta assinatura de custo existe NESTA organizacao?".
 *
 * Nao ha FK entre o Cofre e o mundo multi-tenant -- de proposito, porque uma
 * chave estrangeira entre os dois obrigaria o banco a conhecer os dois donos
 * ao mesmo tempo. O preco de nao ter FK e que a verificacao vira
 * responsabilidade de quem grava, e e esta porta.
 *
 * Ela fecha uma lacuna aberta na fase 5: `personal_subscriptions
 * .cost_subscription_id` era aceito sem conferir nada, e um id de outra
 * organizacao passaria batido.
 */
export interface CostSubscriptionVerifier {
  costSubscriptionExists(organizationId: string, costSubscriptionId: string): Promise<boolean>;
}
