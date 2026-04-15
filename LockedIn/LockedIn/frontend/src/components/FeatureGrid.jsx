import React from 'react';
import { motion } from 'framer-motion';
import { featureCards } from '../utils/featureCards';

const FeatureGrid = ({ theme = 'light', title, eyebrow, description }) => {
  const isDark = theme === 'dark';

  return (
    <section>
      {(eyebrow || title || description) && (
        <div className={isDark ? 'mb-12 text-center' : 'mb-8'}>
          {eyebrow && (
            <p className={isDark ? 'uppercase tracking-[0.35em] text-xs md:text-sm text-red-400/90 font-semibold' : 'text-xs font-semibold uppercase tracking-[0.28em] text-red-600'}>
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className={isDark ? 'text-4xl md:text-5xl font-black mt-3' : 'mt-3 text-2xl md:text-3xl font-bold text-gray-100'}>
              {title}
            </h2>
          )}
          {description && (
            <p className={isDark ? 'text-gray-400 mt-4 max-w-2xl mx-auto' : 'mt-3 max-w-2xl text-sm md:text-base text-gray-400'}>
              {description}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {featureCards.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className={isDark
                ? 'relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm'
                : `relative overflow-hidden rounded-2xl border border-white/20 bg-[#151521] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-1 ${feature.ring} transition-all hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className={isDark ? 'absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_#ffffff_0%,_transparent_55%)]' : `absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${feature.accent} opacity-10`} />
              <div className="relative">
                <div className={isDark ? `w-12 h-12 rounded-xl bg-gradient-to-br ${feature.accent} p-[1px] mb-5` : `mb-5 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-br ${feature.accent} p-[1px]`}>
                  <div className={isDark ? 'w-full h-full rounded-xl bg-black/80 flex items-center justify-center' : 'flex h-12 w-12 items-center justify-center rounded-2xl bg-[#151521]'}>
                    <Icon size={20} className={isDark ? 'text-white' : feature.iconClassName} />
                  </div>
                </div>

                {!isDark && (
                  <span className="mb-4 inline-flex rounded-full bg-[#1e1e2d] px-3 py-1 text-xs font-semibold text-gray-400">
                    {feature.badge}
                  </span>
                )}

                <h3 className={isDark ? 'text-2xl font-bold mb-2 text-white' : 'text-xl font-bold text-gray-100'}>
                  {feature.title}
                </h3>
                <p className={isDark ? 'text-gray-300 leading-relaxed' : 'mt-2 leading-relaxed text-gray-400'}>
                  {feature.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default FeatureGrid;