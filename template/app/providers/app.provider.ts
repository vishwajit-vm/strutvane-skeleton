// Your application's service provider (Laravel's AppServiceProvider).
//
// - register(): bind your own services into the container. Don't resolve other services here;
//   they may not be registered yet.
// - boot(): use services: read config, add sidebar entries, listen to events.
import { type Application, ServiceProvider } from '@strutvane/framework'

export class AppServiceProvider extends ServiceProvider {
  override register(_app: Application): void {
    // _app.container.singleton(PaymentGatewayToken, () => new StripeGateway())
  }

  override boot(_app: Application): void {
    // _app.navigation.add({ name: 'reports', label: 'Reports', path: '/reports', icon: 'chart' })
  }
}
