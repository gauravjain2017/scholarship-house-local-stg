const Metric = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div>
      <span className="text-gray-500 text-sm">{label}</span>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
};

export default Metric;
