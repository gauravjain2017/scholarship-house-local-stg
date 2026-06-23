const TagSection = ({ title, tags }) => {
  if (!Array.isArray(tags) || tags.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="font-semibold text-primary mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full bg-surface-alt text-primary text-sm font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TagSection;
