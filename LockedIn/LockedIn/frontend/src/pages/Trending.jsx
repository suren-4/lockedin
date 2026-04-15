import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiUrl } from '../services/api';

const Trending = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(apiUrl('/api/news/trending'));
        if (!response.ok) throw new Error('Failed to fetch news');
        const data = await response.json();
        
        // Filter out articles with removed content or missing titles/urls
        const articles = (data.articles || []).filter(
          (article) => 
            article.title && 
            article.title !== '[Removed]' && 
            article.url && 
            article.urlToImage
        );
        
        setNews(articles);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 drop-shadow-sm">
            Trending News
          </h1>
          <p className="text-gray-500 mt-2">Latest updates in tech, software, and the job market.</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 flex items-center gap-3">
          <span>⚠️</span>
          <p>Unable to load trending news. Please try again later.</p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {news.map((article, index) => (
            <motion.a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col h-full border border-white/10"
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={article.urlToImage} 
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/400x200?text=News';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-3 left-3 right-3 text-white text-xs font-medium">
                  {new Date(article.publishedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-xs text-red-500 font-bold mb-2 uppercase tracking-wider">
                  {article.source?.name || 'News Source'}
                </div>
                <h3 className="font-bold text-gray-100 mb-2 line-clamp-2 leading-tight">
                  {article.title}
                </h3>
                <p className="text-gray-400 text-sm line-clamp-3 mb-4 flex-1">
                  {article.description}
                </p>
                <div className="mt-auto flex items-center text-red-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                  Read Article <span className="ml-1">→</span>
                </div>
              </div>
            </motion.a>
          ))}
          
          {news.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-12">
              No recent news found based on your parameters.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Trending;
