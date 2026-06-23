import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/main.css';

const getDisplayName = (user) => {
  if (!user) return '';
  if (user.name) return user.name;
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  return user.email || '';
};

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="bg-app min-h-screen">
      <div className="md:p-10 p-7 max-w-7xl mx-auto wlcm-box">

        {/* ---------- Welcome ---------- */}
        <div
          className="rounded-3xl md:p-10 p-6 md:mb-10 mb-6 welcome-box"
          style={{ background: 'linear-gradient(135deg, #2563a8 0%, #1d5496 60%, #1a4f8e 100%)' }}
        >
          {/* text + buttons */}
          <div className="min-w-0 sub-box-1">
            <h1 className="text-2xl md:text-4xl font-semibold text-white mb-3">
              Welcome{getDisplayName(user) ? `, ${getDisplayName(user)}` : ''}
            </h1>
            <p className="text-base text-white">
Browse available properties, claim the ones you're interested in, and stay on top of every update with real-time notifications — all from one powerful dashboard.
            </p>
            <div className="mt-6 flex gap-3 flex-wrap">
              <Link
                to="/deals"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-10 rounded-full bg-white px-6 text-blue-700 shadow hover:bg-white/90 transition-colors submit-btn"
              >
                Browse Properties
              </Link>
              <Link
                to="/property-notifications"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-10 rounded-full border border-white/30 bg-white/10 px-6 text-white backdrop-blur hover:bg-white/20 transition-colors property-btn"
              >
                My Notifications
              </Link>
            </div>
          </div>
        </div>

        {/* ---------- How this platform works ---------- */}
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-10 shadow-sm p-6 mb-6 platform-box">
          <h2 className="text-xl font-semibold text-primary mb-3">How this platform works</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This platform brings vetted property investment opportunities together in one place.
            Browse published listings, claim the ones that match your goals, and get notified the
            moment something new becomes available.
          </p>

		  <div class="mt-7 grid gap-4 md:grid-cols-3">
		  <div class="rounded-2xl bg-white p-5 work-box"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap h-5 w-5 text-brand" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>
		  <div class="mt-3 font-bold work-box-h">Browse Properties</div>

		  <div class="text-lg text-muted-foreground">Explore vetted, ready-to-review property listings with detailed metrics — all in one place.</div></div>
		  <div class="rounded-2xl bg-white p-5 work-box"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check h-5 w-5 text-brand" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
		  <div class="mt-3 font-bold work-box-h">Claim with Confidence</div>

		  <div class="text-lg text-muted-foreground">Found a property you like? Claim it in one click to register your interest and keep it in your list.</div></div>
		  <div class="rounded-2xl bg-white p-5 work-box"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up h-5 w-5 text-brand" aria-hidden="true"><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>
		  <div class="mt-3 font-bold work-box-h">Stay Notified</div>
		  <div class="text-lg text-muted-foreground">Get real-time notifications when new properties are published or there's an update on ones you're following.</div>
		  </div>
		  </div>
        </div>

          {/* ---------- Role explanation ---------- */}
        <div className="investment-box">
          <h2 className="text-xl font-semibold text-primary mb-6">Explore Property Opportunities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-border-subtle rounded-2xl p-6 opp-box">
			<span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-primary text-brand-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-plus-corner h-5 w-5" aria-hidden="true"><path d="M11.35 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5.35"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M14 19h6"></path><path d="M17 16v6"></path></svg></span>
              <h3 className="text-lg font-bold text-primary mb-1 mt-4">Browse Available Properties</h3>
              <p className="text-lg text-text-secondary leading-relaxed">
                View published property listings with full details and investment metrics.
              </p>
            </div>

            <div className="bg-white border border-border-subtle rounded-2xl p-6 opp-box">
			<span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-primary text-brand-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-checks h-5 w-5" aria-hidden="true"><path d="M13 5h8"></path><path d="M13 12h8"></path><path d="M13 19h8"></path><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path></svg></span>
              <h3 className="text-lg font-bold text-primary mb-1 mt-4">Claim Properties</h3>
              <p className="text-lg text-text-secondary leading-relaxed">
                Claim the listings you're interested in to register intent and track them from your account.
              </p>
            </div>
			 <div className="bg-white border border-border-subtle rounded-2xl p-6 opp-box">
		<span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-primary text-brand-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-plus h-5 w-5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg></span>
              <h3 className="text-lg font-bold text-primary mb-1 mt-4">Manage Notifications</h3>
              <p className="text-lg text-text-secondary leading-relaxed">
                Stay updated with alerts on new listings and changes to properties you follow.
              </p>
            </div>
          </div>
        </div>

<div className="workspace p-6 mb-1">
 <h2 className="text-lg font-semibold mb-3 workspace-h">Your workspace</h2>
 <p className="text-sm leading-relaxed workspace-p">
            Jump back into browsing, revisit the properties you've claimed, or run the numbers on a deal.
          </p>
        {/* ---------- Quick-access cards ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:mb-14 mb-6">

          {[
            {
              to: '/deals',
              title: 'Browse Properties',
              description: 'View published properties available to claim.',
              cta: 'Browse now',
              icon: (
                <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></>
              ),
            },
            {
              to: '/favorite-properties',
              title: 'Favorite Properties',
              description: "Revisit and manage the properties you've favorited or claimed.",
              cta: 'View favorites',
              icon: (
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              ),
            },
            {
              to: '/calculator',
              title: 'JV Calculator',
              description: 'Run the numbers on a deal and estimate your joint-venture returns.',
              cta: 'Open calculator',
              icon: (
                <><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></>
              ),
            },
          ].map(({ to, title, description, cta, icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col bg-white border border-border-subtle rounded-2xl px-6 py-6 shadow-sm transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-[#1e7ac0]/40"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #1e7ac0, #1a4f8e)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {icon}
                </svg>
              </span>
              <h3 className="text-lg font-semibold mt-4 mb-1" style={{ color: '#072b53' }}>{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1e7ac0]">
                {cta}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </span>
            </Link>
          ))}
        </div>
 </div>
      </div>
    </div>
  );
};

export default Home;
