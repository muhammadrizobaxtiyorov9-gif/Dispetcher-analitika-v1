import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, color = "blue" }) => {
  const styles = {
    blue: { 
      iconBg: "bg-blue-500", 
      iconColor: "text-white", 
      trendColor: "bg-blue-50 text-blue-700 ring-blue-500/20"
    },
    green: { 
      iconBg: "bg-emerald-500", 
      iconColor: "text-white",
      trendColor: "bg-emerald-50 text-emerald-700 ring-emerald-500/20"
    },
    red: { 
      iconBg: "bg-rose-500", 
      iconColor: "text-white",
      trendColor: "bg-rose-50 text-rose-700 ring-rose-500/20"
    },
    indigo: { 
      iconBg: "bg-indigo-500", 
      iconColor: "text-white",
      trendColor: "bg-indigo-50 text-indigo-700 ring-indigo-500/20"
    },
  };

  const activeStyle = styles[color as keyof typeof styles] || styles.blue;

  return (
    <div className="relative bg-white rounded-3xl p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] border border-slate-100/80 hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 ease-out group overflow-hidden">
      
      {/* Decorative gradient blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-slate-50 to-slate-100 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity"></div>

      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-none">{title}</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tighter tabular-nums leading-none">
            {value}
          </h3>
        </div>
        
        <div className={`p-3 rounded-2xl shadow-lg shadow-black/5 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ${activeStyle.iconBg} ${activeStyle.iconColor}`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" }) : icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 relative z-10">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${activeStyle.trendColor}`}>
            {trend}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatsCard;