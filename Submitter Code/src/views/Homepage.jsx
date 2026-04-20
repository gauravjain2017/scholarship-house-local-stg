import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import submitPreview from '../assets/home/submitPreview.png';

/* ---------- Helpers ---------- */

const getDisplayName = (user) => {
  if (!user) return '';
  if (user.name) return user.name;
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  return user.email || '';
};

const withIndefiniteArticle = (phrase) => {
  if (!phrase) return '';
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
};

/* ---------- UI ---------- */

const HomeCard = ({ to, title, description, image }) => (
  <Link
    to={to}
    className="group bg-surface border border-border-subtle rounded-2xl overflow-hidden
               shadow-sm transition hover:shadow-lg hover:-translate-y-1"
  >
    {image && (
      <div className="h-32 bg-app overflow-hidden">
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
    )}
    <div className="p-6">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
      )}
    </div>
  </Link>
);

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="bg-app min-h-screen">
      <div className="md:p-10 p-7 max-w-7xl mx-auto">

        {/* ---------- Welcome ---------- */}
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 p-6 md:mb-10 mb-6 shadow-sm">
          <h1 className="text-2xl md:text-4xl font-semibold text-primary mb-3">
            Welcome{getDisplayName(user) ? `, ${getDisplayName(user)}` : ''}
          </h1>
          <p className="text-base text-text-secondary">
            You are {withIndefiniteArticle('Submitter')}.
          </p>
          <div className="md:mt-6 mt-3 h-1 w-32 bg-accent rounded-full" />
        </div>

        {/* ---------- How this platform works ---------- */}
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-10 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary mb-3">How this platform works</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This platform showcases short-term rental investment opportunities submitted by vetted partners.
            Each property is reviewed before being published, so you can browse with confidence and focus on
            opportunities that match your goals.
          </p>
        </div>

        {/* ---------- Role explanation ---------- */}
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-10 shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary mb-6">Submit investment opportunities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-panel border border-border-subtle rounded-2xl p-6">
              <h3 className="text-base font-semibold text-primary mb-2">Create new property submissions</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Submit short-term rental opportunities for review and approval.
              </p>
            </div>
            <div className="bg-panel border border-border-subtle rounded-2xl p-6">
              <h3 className="text-base font-semibold text-primary mb-2">Track submission status</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Monitor whether your listings are pending, approved, or published.
              </p>
            </div>
          </div>
        </div>

        {/* ---------- Quick-access card ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:mb-14 mb-6">
          <HomeCard
            to="/submit"
            title="Submit a Property"
            description="Submit a property on behalf of another user."
            image={submitPreview}
          />
        </div>

      </div>
    </div>
  );
};

export default Home;
