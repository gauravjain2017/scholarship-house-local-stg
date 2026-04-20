import { useState, useEffect } from 'react';
import api from '../api/api';
import {
  BlockPreviewContent,
  blockStyleToCSS,
  DEFAULT_BLOCK_STYLE,
} from '../components/BlockRenderers';

const ClientAboutPage = () => {
  const [blocks, setBlocks] = useState([]);
  const [globalCSS, setGlobalCSS] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLayout = async () => {
      try {
        const res = await api.get('/manage-homepages/client_about');
        const { payload, global_css } = res.data.data;
        if (payload) {
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
          if (Array.isArray(parsed)) setBlocks(parsed);
        }
        if (global_css) setGlobalCSS(global_css);
      } catch (e) {
        // API failed — ignore
      } finally {
        setLoading(false);
      }
    };
    fetchLayout();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">No layout has been configured yet.</p>
      </div>
    );
  }

  return (
    <>
      {globalCSS && <style>{globalCSS}</style>}
      <div className="min-h-screen bg-gray-50">
        {blocks
          .filter((b) => !b.hidden)
          .map((block, i) => {
            const customStyle = blockStyleToCSS(block.style || DEFAULT_BLOCK_STYLE);
            return (
              <div key={i} style={customStyle} className={block.cssClass || ''} id={block.cssId || undefined}>
                {block.customCSS && <style>{block.customCSS}</style>}
                <BlockPreviewContent type={block.type} data={block.data} />
              </div>
            );
          })}
      </div>
    </>
  );
};

export default ClientAboutPage;
