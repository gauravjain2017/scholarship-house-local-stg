import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { dealsAPI } from '../api/deals';
import submitPreview from '../assets/home/submitPreview.png';
import mypropertyPreview from '../assets/home/Myproperty.png';
import '../styles/main.css';

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

  // Submitter's own deals — same query key as MyProperties so the cache is shared.
  const { data: myDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['myProperties', user?.email],
    queryFn: dealsAPI.getMyDeals,
    enabled: !!user?.email,
  });

  // While the first fetch is in flight we don't yet know the real count —
  // show a skeleton instead of a premature "0".
  const statsLoading = !user?.email || dealsLoading;

  // Count properties submitted in the current calendar month.
  const now = new Date();
  const thisMonthCount = (Array.isArray(myDeals) ? myDeals : []).filter((d) => {
    const dt = new Date(d.submittedAt || d.createdAt || d.updatedAt);
    return (
      !isNaN(dt.getTime()) &&
      dt.getMonth() === now.getMonth() &&
      dt.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <div className="bg-app min-h-screen">
      <div className="md:p-10 p-7 max-w-7xl mx-auto padding-m">

        {/* ---------- Welcome ---------- */}
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 p-6 md:mb-10 mb-6 shadow-sm welcome-box">
		<div className="sub-box-1">
          <h1 className="text-2xl md:text-4xl font-semibold text-white mb-4">
            Welcome{getDisplayName(user) ? `, ${getDisplayName(user)}` : ''}
          </h1>
          <p className="text-base text-text-secondary mt-2">
          Submit short-term rental opportunities, track approvals, and watch your listings go live — all in one place. {withIndefiniteArticle('Submitter')}.
          </p>
		  
		  
          <div class="mt-6 flex gap-3 btns-col">
		  <a href="/submit" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 shadow h-10 rounded-full bg-white px-6 text-primary hover:bg-white/90">+ Submit New Property</a>
		  
		  <a href="/my-properties" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 border shadow-sm h-10 rounded-full border-white/30 bg-white/10 px-6 text-white backdrop-blur hover:bg-white/20 hover:text-white">My Properties</a></div>
		  </div>
		  
		<div className="sub-box-2 flex justify-end">
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur month-box">
		<div class="text-sm uppercase tracking-widest text-white/70">This month</div>
		{statsLoading ? (
		  <>
		    <div className="mt-2 h-12 w-12 rounded-md bg-white/20 animate-pulse" />
		    <div className="mt-2 h-4 w-32 rounded bg-white/15 animate-pulse" />
		  </>
		) : (
		  <>
		    <div class="mt-2 font-display text-5xl font-semibold">{thisMonthCount}</div>
		    <div class="mt-1 text-sm text-white/80">{thisMonthCount === 1 ? 'property submitted' : 'properties submitted'}</div>
		  </>
		)}
		</div>
		  </div>
		  
        </div>

        {/* ---------- How this platform works ---------- */}
        <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-10 shadow-sm p-6 mb-6 platform-box">
          <h2 className="text-xl font-semibold text-primary mb-3">How this platform works</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This platform showcases short-term rental investment opportunities submitted by vetted partners.
            Each property is reviewed before being published, so you can browse with confidence and focus on
            opportunities that match your goals.
          </p>
		  
		  <div class="mt-7 grid gap-4 md:grid-cols-3">
		  <div class="rounded-2xl bg-white p-5 work-box"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap h-5 w-5 text-brand" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>
		  <div class="mt-3 font-bold work-box-h">Submit fast</div>
		  
		  <div class="text-lg text-muted-foreground">Add a property in under 5 minutes.</div></div>
		  <div class="rounded-2xl bg-white p-5 work-box"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check h-5 w-5 text-brand" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
		  <div class="mt-3 font-bold work-box-h">Get reviewed</div>
		  
		  <div class="text-lg text-muted-foreground">Our team verifies every listing.</div></div>
		  <div class="rounded-2xl bg-white p-5 work-box"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up h-5 w-5 text-brand" aria-hidden="true"><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>
		  <div class="mt-3 font-bold work-box-h">Go live</div>
		  <div class="text-lg text-muted-foreground">Approved listings reach investors.</div>
		  </div>
		  </div>
		  
        </div>

        {/* ---------- Role explanation ---------- */}
        <div className="investment-box">
          <h2 className="text-xl font-semibold text-primary mb-6">Submit investment opportunities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-border-subtle rounded-2xl p-6 opp-box">
			<span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-primary text-brand-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-plus-corner h-5 w-5" aria-hidden="true"><path d="M11.35 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5.35"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M14 19h6"></path><path d="M17 16v6"></path></svg></span>
              <h3 className="text-lg font-bold text-primary mb-2">Create new property submissions</h3>
              <p className="text-lg text-text-secondary leading-relaxed">
                Submit short-term rental opportunities for review and approval.
              </p>
            </div>
			
            <div className="bg-white border border-border-subtle rounded-2xl p-6 opp-box">
			<span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-primary text-brand-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-checks h-5 w-5" aria-hidden="true"><path d="M13 5h8"></path><path d="M13 12h8"></path><path d="M13 19h8"></path><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path></svg></span>
              <h3 className="text-lg font-bold text-primary mb-2">Track submission status</h3>
              <p className="text-lg text-text-secondary leading-relaxed">
                Monitor whether your listings are pending, approved, or published.
              </p>
            </div>
			 <div className="bg-white border border-border-subtle rounded-2xl p-6 opp-box">
		<span class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-primary text-brand-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-plus h-5 w-5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg></span>
              <h3 className="text-lg font-bold text-primary mb-2">Submit on behalf of a user</h3>
              <p className="text-lg text-text-secondary leading-relaxed">
                Submit a property on behalf of another user from your partner network.
              </p>
            </div>
          </div>
        </div>
		
<div className="workspace p-6 mb-1">
 <h2 className="text-lg font-semibold mb-3 workspace-h">Your workspace</h2>
 <p className="text-sm leading-relaxed workspace-p">
            Jump back into a submission or review what you've sent.
          </p>
		  
        {/* ---------- Quick-access card ---------- */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-6 md:mb-14 mb-2 workspace-card">
          <HomeCard
            to="/submit"
            title="Submit a Property"
            description="Submit a property on behalf of another user."
            image={submitPreview}
          />
		   <HomeCard
            to="/my-properties"
            title="My Properties"
            description="Properties you have submitted."
            image={mypropertyPreview}
			
          />
		  </div>
        </div>
		
		 
		
      </div>
	  
	  	<footer class="copy-footer py-6"><div class="container text-center text-xs text-muted-foreground">© 2026 Scholarship House. All rights reserved.</div></footer>
    </div>

  );
};

export default Home;
