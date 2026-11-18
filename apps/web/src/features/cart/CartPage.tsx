import { Link } from 'react-router';
import { CartPanel } from './CartPanel';

/** Full-page cart for small screens, where the menu page has no room for a side panel. */
export function CartPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link to="/menu" className="text-sm font-medium text-leaf-700 underline underline-offset-4">
        Back to the menu
      </Link>
      <CartPanel className="mt-4" />
    </div>
  );
}
