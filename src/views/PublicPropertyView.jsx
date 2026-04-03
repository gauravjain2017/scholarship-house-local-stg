import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dealsAPI } from '../api/deals';
import { DealDetailView } from './CustomerView';
import Loader from '../components/Loader';
import logoDarkBlue from '../assets/icons/logo-scholarship-house/logo-title-black.png';

const PublicPropertyView = () => {
  const { dealId } = useParams();

  const { data: deal, isLoading, error } = useQuery({
    queryKey: ['public-deal', dealId],
    queryFn: () => dealsAPI.getPublicDealById(dealId),
    enabled: !!dealId,
  });


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <img src={logoDarkBlue} alt="ScholarshipHouse" style={{ height: "4rem" }}  />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Property Not Found</h1>
          <p className="text-gray-600">This property may no longer be available or the link may be invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header with logo only */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <img 
          src={logoDarkBlue} 
          alt="ScholarshipHouse" 
          style={{ height: "4rem" }} 
        />
      </div>

      {/* Property detail content — no sidebar, no nav */}
      <DealDetailView
        deal={deal}
        onBack={() => window.close()}
        canViewAddress={false}
        bckProperty={false}
      />
    </div>
  );
};

export default PublicPropertyView;
