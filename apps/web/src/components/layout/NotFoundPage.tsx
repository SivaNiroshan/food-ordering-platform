import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="py-16">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-ash">The page you’re looking for doesn’t exist or has moved.</p>
      <Link
        to="/"
        className="mt-6 inline-block font-medium text-leaf-700 underline underline-offset-4"
      >
        Go to the start page
      </Link>
    </section>
  );
}
