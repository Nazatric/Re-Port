import { EmptyState, Hero } from '../components/ui';
import { Link } from '../lib/router';

export default function NotFound({ title = 'Page not found', text = 'That page does not exist.' }: { title?: string; text?: string }) {
  return (
    <>
      <Hero title="Not Found" />
      <main id="main" tabIndex={-1} className="wrap safe-bottom outline-none">
        <EmptyState title={title} text={text} icon="help">
          <div className="mt-2 flex gap-2">
            <Link to="/" className="btn-a small">
              Back to home
            </Link>
            <Link to="/library" className="btn-glass">
              Open the library
            </Link>
          </div>
        </EmptyState>
      </main>
    </>
  );
}
